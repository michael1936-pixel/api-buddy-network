import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { symbols, enabled_stages, config: userConfig } = await req.json();

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return new Response(
        JSON.stringify({ error: "symbols array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const railwayUrl = Deno.env.get("RAILWAY_API_URL");
    const railwayToken = Deno.env.get("RAILWAY_API_TOKEN");

    if (!railwayUrl) {
      return new Response(
        JSON.stringify({ error: "RAILWAY_API_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch historical market data for all symbols
    const symbolsData: Array<{
      symbol: string;
      data: Array<{ timestamp: string; open: number; high: number; low: number; close: number; volume: number }>;
    }> = [];

    for (const symbol of symbols) {
      // Fetch all bars ordered by timestamp
      let allBars: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data: bars, error: barsError } = await supabase
          .from("market_data")
          .select("timestamp, open, high, low, close, volume")
          .eq("symbol", symbol)
          .order("timestamp", { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (barsError) {
          console.error(`Failed to fetch data for ${symbol}:`, barsError.message);
          break;
        }
        if (!bars || bars.length === 0) break;
        allBars = allBars.concat(bars);
        if (bars.length < batchSize) break;
        offset += batchSize;
      }

      if (allBars.length === 0) {
        console.error(`No market data found for ${symbol}`);
        continue;
      }

      console.log(`Loaded ${allBars.length} bars for ${symbol}`);
      symbolsData.push({ symbol, data: allBars });
    }

    if (symbolsData.length === 0) {
      return new Response(
        JSON.stringify({ error: "No market data found for any of the requested symbols" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Build periodSplit (70% train, 30% test)
    // Use the first symbol's data range for the split
    const firstData = symbolsData[0].data;
    const trainPercent = 70;
    const splitIndex = Math.floor(firstData.length * (trainPercent / 100));
    
    const periodSplit = {
      trainStartDate: firstData[0].timestamp,
      trainEndDate: firstData[splitIndex - 1].timestamp,
      testStartDate: firstData[splitIndex].timestamp,
      testEndDate: firstData[firstData.length - 1].timestamp,
      trainPercent,
    };

    // 3. Build config — use NNE preset config (same as client)
    const config = userConfig || getNNEPresetConfig();

    // 4. Create optimization_runs row
    const runIds: number[] = [];
    for (const symbol of symbols) {
      const { data, error } = await supabase
        .from("optimization_runs")
        .insert({
          symbol,
          status: "pending",
          total_stages: 30,
          current_stage: 0,
          current_combo: 0,
          total_combos: 0,
        })
        .select("id")
        .single();

      if (error) {
        console.error(`Failed to create run for ${symbol}:`, error.message);
        continue;
      }
      runIds.push(data.id);
    }

    if (runIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to create optimization runs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Send to Railway server
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (railwayToken) {
      headers["Authorization"] = `Bearer ${railwayToken}`;
    }

    const baseUrl = railwayUrl.startsWith('http') ? railwayUrl : `https://${railwayUrl}`;
    
    // Send one request per symbol (Railway handles one at a time)
    const results: any[] = [];
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      const symData = symbolsData.find(s => s.symbol === symbol);
      if (!symData) continue;

      const railwayResponse = await fetch(`${baseUrl}/api/optimize`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          symbolsData: [symData],
          config,
          periodSplit,
          runId: runIds[i],
          mode: 'single',
          enabled_stages: enabled_stages || null,
        }),
      });

      if (!railwayResponse.ok) {
        const errText = await railwayResponse.text();
        console.error(`Railway error for ${symbol}:`, errText);
        await supabase
          .from("optimization_runs")
          .update({ status: "failed", error_message: `Railway error: ${errText}` })
          .eq("id", runIds[i]);
        results.push({ symbol, error: errText });
      } else {
        const railwayData = await railwayResponse.json();
        results.push({ symbol, ...railwayData });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        run_ids: runIds,
        symbols,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("start-optimization error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** NNE Preset Config — mirrors src/lib/optimizer/presetConfigs.ts */
function getNNEPresetConfig() {
  return {
    strategyType: 'stocks',
    bars_between_trades: { min: 0, max: 0, step: 1 },
    cooldown_after_loss_bars: { min: 0, max: 0, step: 1 },
    allow_flip_L2S: true, allow_flip_S2L: true, signals_on_close: true,
    stop_distance_percent_long: { min: 1, max: 10, step: 1 },
    be_trigger_pct_long: { min: 35, max: 35, step: 1 },
    trail_rsi_pct_input_long: { min: 1, max: 35, step: 1 },
    tp_percent_long: { min: 1, max: 15, step: 0.5 },
    tp_trail_distance_long: { min: 1, max: 10, step: 0.5 },
    rsi_long_entry_min: { min: 45, max: 62, step: 1 },
    rsi_trail_long: { min: 66, max: 90, step: 1 },
    stop_distance_percent_short: { min: 1, max: 15, step: 1 },
    be_trigger_pct_short: { min: 35, max: 35, step: 1 },
    trail_rsi_pct_input_short: { min: 1, max: 35, step: 1 },
    tp_percent_short: { min: 1, max: 15, step: 0.5 },
    tp_trail_distance_short: { min: 1, max: 10, step: 0.5 },
    rsi_short_entry_max: { min: 22, max: 40, step: 1 },
    rsi_trail_short: { min: 22, max: 40, step: 1 },
    ma_len: { min: 50, max: 50, step: 1 },
    non_regress_stop: false, prefer_tp_priority: true, close_only_trail: false,
    stop_on_close_only: false, avoid_opening_bar: false, block_close_bar: false,
    use_big_bar_filter: false, big_bar_atr_mult: { min: 2, max: 8, step: 0.1 },
    use_dist_filter: false, max_dist_from_ema50_pc: { min: 13, max: 25, step: 0.5 },
    use_post_trail_tighten: false, post_trail_tighten_pct: { min: 4, max: 4, step: 0.1 },
    use_min_bars_post_trail: false, min_bars_post_trail: { min: 12, max: 12, step: 1 },
    exit_all_now: false, block_new_entries: false,
    use_vix_range_filter: false, vix_normal_min: { min: 10, max: 10, step: 1 }, vix_normal_max: { min: 30, max: 30, step: 1 },
    use_vix_exit_long: false, use_vix_exit_short: false,
    use_vix_freeze: false, vix_lookback_bars: { min: 1, max: 1, step: 1 }, vix_spike_pct: { min: 8, max: 8, step: 1 }, vix_freeze_bars: { min: 1, max: 1, step: 1 },
    use_atr_sl: false, atr_mult_long: { min: 0.2, max: 3, step: 0.1 }, atr_mult_short: { min: 0.2, max: 3, step: 0.1 },
    enable_strat1: true, enable_rsi_exit: false,
    rsi_exit_long: { min: 40, max: 75, step: 1 }, rsi_exit_short: { min: 20, max: 60, step: 1 },
    min_bars_in_trade_exit: { min: 2, max: 12, step: 1 },
    s1_ema_fast_len: { min: 9, max: 9, step: 1 },
    s1_ema_mid_len: { min: 21, max: 21, step: 1 },
    s1_ema_trend_len: { min: 50, max: 50, step: 1 },
    s1_rsi_len: { min: 14, max: 14, step: 1 },
    s1_atr_len: { min: 16, max: 16, step: 1 },
    s1_atr_ma_len: { min: 12, max: 12, step: 1 },
    s1_atr_hi_mult: { min: 0.85, max: 0.85, step: 0.01 },
    s1_adx_len: { min: 11, max: 11, step: 1 },
    s1_adx_strong: { min: 18, max: 18, step: 1 },
    s1_bb_len: { min: 20, max: 20, step: 1 },
    s1_bb_mult: { min: 2.2, max: 2.2, step: 0.1 },
    s1_far_from_bb_pc: { min: 2, max: 2, step: 1 },
    s1_vol_len: { min: 16, max: 16, step: 1 },
    s1_hi_vol_mult: { min: 1, max: 1, step: 0.1 },
    s1_min_conds: { min: 3, max: 3, step: 1 },
    enable_strat2: false, bb2_use_trend_filter: false,
    bb2_ma_len: { min: 20, max: 150, step: 20 }, bb2_adx_max: { min: 14, max: 30, step: 1 },
    bb2_adx_len: { min: 11, max: 11, step: 1 },
    bb2_rsi_long_max: { min: 45, max: 62, step: 1 }, bb2_rsi_short_min: { min: 25, max: 40, step: 1 },
    bb2_bb_len: { min: 20, max: 20, step: 1 }, bb2_bb_mult: { min: 2.2, max: 2.2, step: 0.1 },
    enable_strat3: false,
    s3_breakout_len: { min: 10, max: 35, step: 1 }, s3_adx_min: { min: 3, max: 25, step: 1 },
    s3_use_vol_filter: false, s3_vol_mult: { min: 1, max: 5, step: 0.1 },
    s3_rsi_long_min: { min: 45, max: 62, step: 1 }, s3_rsi_short_max: { min: 25, max: 40, step: 1 },
    enable_strat4: false, s4_use_trend_filter: false,
    s4_min_inside_range_pc: { min: 0.1, max: 3, step: 0.1 },
    s4_rsi_long_min: { min: 45, max: 62, step: 1 }, s4_rsi_short_max: { min: 25, max: 40, step: 1 },
    enable_strat5: false,
    s5_squeeze_len: { min: 1, max: 15, step: 1 }, s5_atr_mult_low: { min: 0.5, max: 4, step: 0.1 },
    s5_range_len: { min: 2, max: 20, step: 1 },
    s5_use_vol_filter: false, s5_vol_mult: { min: 0.5, max: 3, step: 0.1 },
    s5_rsi_long_min: { min: 45, max: 62, step: 1 }, s5_rsi_short_max: { min: 25, max: 40, step: 1 },
  };
}
