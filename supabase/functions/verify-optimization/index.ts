import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Indicator helpers (Pine-compatible) ──

function calcEMA(data: number[], period: number): number[] {
  const ema: number[] = new Array(data.length).fill(NaN);
  if (data.length === 0 || period <= 0) return ema;
  // SMA seed
  let sum = 0;
  for (let i = 0; i < Math.min(period, data.length); i++) sum += data[i];
  ema[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calcRSI(closes: number[], period: number): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length < period + 1) return rsi;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function calcATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const atr: number[] = new Array(highs.length).fill(0);
  if (highs.length < 2) return atr;
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < highs.length; i++) {
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  let sum = 0;
  for (let i = 0; i < Math.min(period, tr.length); i++) sum += tr[i];
  atr[period - 1] = sum / period;
  for (let i = period; i < tr.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr;
}

function simpleSMA(values: number[], length: number): number[] {
  const out = new Array(values.length).fill(NaN);
  if (length <= 0) return out;
  let s = 0;
  for (let i = 0; i < values.length; i++) {
    s += values[i];
    if (i >= length) s -= values[i - length];
    if (i >= length - 1) out[i] = s / length;
  }
  return out;
}

// ── Lightweight strategy replay ──

interface ReplayTrade {
  direction: string;
  entry_time: string;
  entry_price: number;
  exit_time: string | null;
  exit_price: number | null;
  pnl_pct: number;
  exit_reason: string;
  bars_held: number;
  strategy_id: number;
}

function replayStrategy(
  marketData: Array<{ timestamp: string; open: number; high: number; low: number; close: number; volume: number }>,
  params: Record<string, any>,
): ReplayTrade[] {
  if (marketData.length < 100) return [];

  const closes = marketData.map(b => b.close);
  const highs = marketData.map(b => b.high);
  const lows = marketData.map(b => b.low);

  // Compute indicators using actual param keys from optimization
  const rsiLen = params.s1_rsi_len ?? 14;
  const atrLen = params.s1_atr_len ?? 14;
  const emaTrendLen = params.s1_ema_trend_len ?? 50;
  const emaFastLen = params.s1_ema_fast_len ?? 9;
  const emaMidLen = params.s1_ema_mid_len ?? 21;

  const rsiArr = calcRSI(closes, rsiLen);
  const atrArr = calcATR(highs, lows, closes, atrLen);
  const ema50 = calcEMA(closes, emaTrendLen);
  const ema9 = calcEMA(closes, emaFastLen);
  const ema21 = calcEMA(closes, emaMidLen);
  const atrAvg = simpleSMA(atrArr, params.s1_atr_ma_len ?? 14);

  const startBar = Math.max(emaTrendLen, rsiLen, atrLen, 50) + 5;
  const trades: ReplayTrade[] = [];

  let position = 0; // 0=flat, 1=long, -1=short
  let entryPrice = 0, entryBar = 0, lastEntryBar = -999;
  let entrySid = 0;

  for (let i = startBar; i < marketData.length; i++) {
    const cl = closes[i], hi = highs[i], lo = lows[i], op = marketData[i].open;
    const rsi = rsiArr[i];
    const atr = atrArr[i];
    const e50 = ema50[i], e9 = ema9[i], e21 = ema21[i];
    const pe9 = ema9[i - 1], pe21 = ema21[i - 1], pe50 = ema50[i - 1];

    if (isNaN(rsi) || isNaN(e9) || isNaN(e21) || isNaN(e50)) continue;

    const spacingOk = i - lastEntryBar >= (params.bars_between_trades ?? 3);

    // S1 — EMA crossover
    let buy = false, sell = false;
    if (params.enable_strat1 !== false) {
      const co21 = pe9 < pe21 && e9 > e21;
      const co50 = pe9 < pe50 && e9 > e50;
      const cu21 = pe9 > pe21 && e9 < e21;
      const cu50 = pe9 > pe50 && e9 < e50;
      if ((co21 || co50) && rsi > 50 && rsi > (params.rsi_long_entry_min ?? 30)) { buy = true; entrySid = 1; }
      if ((cu21 || cu50) && rsi < 50 && rsi < (params.rsi_short_entry_max ?? 70)) { sell = true; entrySid = 1; }
    }

    if (buy && sell) sell = false;

    // RSI exit
    let exitL = false, exitS = false;
    const prevRSI = i > 0 ? rsiArr[i - 1] : rsi;
    if (params.enable_rsi_exit && position === 1) {
      if (e9 < e21 && prevRSI > (params.rsi_exit_long ?? 70) && rsi < (params.rsi_exit_long ?? 70)) exitL = true;
    }
    if (params.enable_rsi_exit && position === -1) {
      if (e9 > e21 && prevRSI < (params.rsi_exit_short ?? 30) && rsi > (params.rsi_exit_short ?? 30)) exitS = true;
    }

    // Stop loss check (simplified)
    let stopHit = false;
    if (position === 1) {
      const slPct = (params.stop_distance_percent_long ?? 3) / 100;
      if (lo <= entryPrice * (1 - slPct)) stopHit = true;
    } else if (position === -1) {
      const slPct = (params.stop_distance_percent_short ?? 3) / 100;
      if (hi >= entryPrice * (1 + slPct)) stopHit = true;
    }

    // Exit
    if (position !== 0) {
      let shouldExit = false, reason = 'signal';
      if (stopHit) { shouldExit = true; reason = 'stop_loss'; }
      else if (position === 1 && exitL) { shouldExit = true; reason = 'signal'; }
      else if (position === -1 && exitS) { shouldExit = true; reason = 'signal'; }
      else if (position === 1 && sell && params.allow_flip_L2S) { shouldExit = true; reason = 'flip'; }
      else if (position === -1 && buy && params.allow_flip_S2L) { shouldExit = true; reason = 'flip'; }

      if (shouldExit) {
        const dir = position === 1 ? 1 : -1;
        const pnl = ((cl - entryPrice) / entryPrice) * 100 * dir;
        trades.push({
          direction: position === 1 ? 'long' : 'short',
          entry_time: marketData[entryBar].timestamp,
          entry_price: entryPrice,
          exit_time: marketData[i].timestamp,
          exit_price: cl,
          pnl_pct: Math.round(pnl * 100) / 100,
          exit_reason: reason,
          bars_held: i - entryBar,
          strategy_id: entrySid,
        });
        position = 0;
        // Handle flip
        if (reason === 'flip') {
          position = sell ? -1 : 1;
          entryPrice = cl; entryBar = i; lastEntryBar = i;
        }
        continue;
      }
    }

    // Entry
    if (position === 0 && spacingOk) {
      if (buy) {
        position = 1; entryPrice = cl; entryBar = i; lastEntryBar = i;
      } else if (sell) {
        position = -1; entryPrice = cl; entryBar = i; lastEntryBar = i;
      }
    }
  }

  // Close open trade
  if (position !== 0) {
    const last = marketData[marketData.length - 1];
    const dir = position === 1 ? 1 : -1;
    const pnl = ((last.close - entryPrice) / entryPrice) * 100 * dir;
    trades.push({
      direction: position === 1 ? 'long' : 'short',
      entry_time: marketData[entryBar].timestamp,
      entry_price: entryPrice,
      exit_time: last.timestamp,
      exit_price: last.close,
      pnl_pct: Math.round(pnl * 100) / 100,
      exit_reason: 'end_of_data',
      bars_held: marketData.length - 1 - entryBar,
      strategy_id: entrySid,
    });
  }

  return trades;
}

// ── Gap diagnosis ──

interface GapDiagnosis {
  trade_index: number;
  field: string;
  expected: string;
  actual: string;
  source: string;
  detail: string;
}

function diagnoseGap(field: string, expected: string, actual: string, context: Record<string, unknown>): { source: string; detail: string } {
  if (field === 'trade_count') {
    const exp = parseInt(expected), act = parseInt(actual), diff = act - exp;
    if (context.missingBars && (context.missingBars as number) > 0)
      return { source: 'missing_data', detail: `חסרים ${context.missingBars} ברים — ייתכן שגרם לדילוג על עסקאות` };
    if (Math.abs(diff) <= 3)
      return { source: 'boundary_condition', detail: `הפרש קטן (${diff}) — תנאי שוליים בתחילת/סוף הטווח` };
    return { source: 'logic_divergence', detail: `הפרש גדול (${diff}) — הבדל בלוגיקת כניסה/יציאה` };
  }
  if (field === 'win_rate')
    return { source: 'cumulative_drift', detail: 'הפרש ב-Win Rate נובע מהבדלים בעסקאות בודדות' };
  if (field.includes('price_outside'))
    return { source: 'price_mismatch', detail: `מחיר מחוץ לטווח הבר — ייתכן שימוש ב-close במקום limit/stop` };
  if (field === 'pnl_mismatch')
    return { source: 'calculation_error', detail: `פער ב-P&L (${expected} vs ${actual}) — ייתכן הבדל בעמלות/slippage` };
  if (field === 'direction_mismatch')
    return { source: 'logic_divergence', detail: `כיוון שונה — long vs short, הבדל בלוגיקת כניסה` };
  if (field === 'timing_mismatch')
    return { source: 'boundary_condition', detail: `הפרש בזמן כניסה/יציאה — ייתכן הבדל ב-bar alignment` };
  return { source: 'unknown', detail: 'פער לא מזוהה — דרוש חקירה ידנית' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { optimization_result_id } = await req.json();
    if (!optimization_result_id) {
      return new Response(JSON.stringify({ error: 'optimization_result_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Load optimization result
    const { data: result, error: resErr } = await supabase
      .from('optimization_results')
      .select('*')
      .eq('id', optimization_result_id)
      .single();

    if (resErr || !result) {
      return new Response(JSON.stringify({ error: 'Optimization result not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Load stored trades
    const { data: storedTrades, error: trErr } = await supabase
      .from('optimization_trades')
      .select('*')
      .eq('optimization_result_id', optimization_result_id)
      .order('entry_time', { ascending: true });

    if (trErr) {
      return new Response(JSON.stringify({ error: 'Failed to load trades' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trades = storedTrades || [];
    const params = result.parameters as Record<string, any>;

    // 3. Load market data for replay
    const { data: marketData, error: mdErr } = await supabase
      .from('market_data')
      .select('timestamp, open, high, low, close, volume')
      .eq('symbol', result.symbol)
      .eq('interval', '15min')
      .order('timestamp', { ascending: true })
      .limit(10000);

    if (mdErr || !marketData || marketData.length < 50) {
      return new Response(JSON.stringify({
        match: false,
        expected_trades: trades.length,
        actual_trades: 0,
        expected_return: result.test_return || 0,
        actual_return: 0,
        replay_trades: [],
        discrepancies: [],
        stats: null,
        message: `לא נמצא מספיק נתוני שוק ל-${result.symbol} (${marketData?.length || 0} ברים). צריך לפחות 50 ברים.`,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for missing bars
    let missingBars = 0;
    for (let i = 1; i < marketData.length; i++) {
      const diff = new Date(marketData[i].timestamp).getTime() - new Date(marketData[i - 1].timestamp).getTime();
      if (diff > 2 * 60 * 60 * 1000) missingBars++;
    }

    // 4. REPLAY — run strategy with same params on same data
    const replayTrades = replayStrategy(marketData, params);

    // 5. Compare stored trades vs replay trades
    const discrepancies: GapDiagnosis[] = [];

    // Trade count comparison
    if (trades.length > 0 && Math.abs(trades.length - replayTrades.length) > 1) {
      const diag = diagnoseGap('trade_count', `${trades.length}`, `${replayTrades.length}`, { missingBars });
      discrepancies.push({ trade_index: -1, field: 'trade_count', expected: `${trades.length} (שמור)`, actual: `${replayTrades.length} (replay)`, ...diag });
    }

    // Compare with optimization_results metadata
    const expectedTrades = result.total_trades || 0;
    const expectedWinRate = result.win_rate || 0;

    if (expectedTrades > 0 && Math.abs(replayTrades.length - expectedTrades) > 2) {
      const diag = diagnoseGap('trade_count', `${expectedTrades}`, `${replayTrades.length}`, { missingBars });
      discrepancies.push({ trade_index: -1, field: 'replay_vs_metadata_count', expected: `${expectedTrades} (metadata)`, actual: `${replayTrades.length} (replay)`, ...diag });
    }

    // Per-trade comparison (stored vs replay)
    const compareLen = Math.min(trades.length, replayTrades.length, 100);
    for (let i = 0; i < compareLen; i++) {
      const stored = trades[i] as any;
      const replay = replayTrades[i];

      // Direction mismatch
      if (stored.direction !== replay.direction) {
        const diag = diagnoseGap('direction_mismatch', stored.direction, replay.direction, {});
        discrepancies.push({ trade_index: i + 1, field: 'direction', expected: stored.direction, actual: replay.direction, ...diag });
      }

      // Entry price comparison (within 0.5%)
      if (stored.entry_price && replay.entry_price) {
        const priceDiff = Math.abs(stored.entry_price - replay.entry_price) / stored.entry_price * 100;
        if (priceDiff > 0.5) {
          discrepancies.push({
            trade_index: i + 1, field: 'entry_price',
            expected: `${stored.entry_price.toFixed(2)}`, actual: `${replay.entry_price.toFixed(2)}`,
            source: 'price_mismatch', detail: `הפרש ${priceDiff.toFixed(2)}% במחיר כניסה`,
          });
        }
      }

      // PnL comparison
      if (stored.pnl_pct !== null && replay.pnl_pct !== null) {
        const pnlDiff = Math.abs(stored.pnl_pct - replay.pnl_pct);
        if (pnlDiff > 0.5) {
          const diag = diagnoseGap('pnl_mismatch', `${stored.pnl_pct.toFixed(2)}%`, `${replay.pnl_pct.toFixed(2)}%`, {});
          discrepancies.push({ trade_index: i + 1, field: 'pnl_pct', expected: `${stored.pnl_pct.toFixed(2)}%`, actual: `${replay.pnl_pct.toFixed(2)}%`, ...diag });
        }
      }

      // Timing comparison
      if (stored.entry_time && replay.entry_time) {
        const timeDiff = Math.abs(new Date(stored.entry_time).getTime() - new Date(replay.entry_time).getTime());
        if (timeDiff > 30 * 60 * 1000) { // > 30 min
          const diag = diagnoseGap('timing_mismatch', stored.entry_time, replay.entry_time, {});
          discrepancies.push({ trade_index: i + 1, field: 'entry_time', expected: stored.entry_time, actual: replay.entry_time, ...diag });
        }
      }
    }

    // Also verify replay trades against market data bars
    for (let i = 0; i < Math.min(replayTrades.length, 100); i++) {
      const rt = replayTrades[i];
      const entryBarIdx = marketData.findIndex(bar => {
        const barTime = new Date(bar.timestamp).getTime();
        const tradeTime = new Date(rt.entry_time).getTime();
        return Math.abs(barTime - tradeTime) < 60 * 15 * 1000;
      });
      if (entryBarIdx >= 0) {
        const bar = marketData[entryBarIdx];
        if (rt.entry_price < bar.low * 0.999 || rt.entry_price > bar.high * 1.001) {
          discrepancies.push({
            trade_index: i + 1, field: 'replay_entry_outside_bar',
            expected: `${bar.low.toFixed(2)}-${bar.high.toFixed(2)}`,
            actual: `${rt.entry_price.toFixed(2)}`,
            source: 'price_mismatch',
            detail: `מחיר כניסה של ה-replay מחוץ לטווח הבר`,
          });
        }
      }
    }

    // 6. Stats from replay
    const replayPnl = replayTrades.reduce((sum, t) => sum + t.pnl_pct, 0);
    const replayWins = replayTrades.filter(t => t.pnl_pct > 0).length;
    const replayLosses = replayTrades.filter(t => t.pnl_pct < 0).length;
    const replayWR = replayTrades.length > 0 ? (replayWins / replayTrades.length * 100) : 0;
    const avgWin = replayWins > 0 ? replayTrades.filter(t => t.pnl_pct > 0).reduce((a, t) => a + t.pnl_pct, 0) / replayWins : 0;
    const avgLoss = replayLosses > 0 ? replayTrades.filter(t => t.pnl_pct < 0).reduce((a, t) => a + t.pnl_pct, 0) / replayLosses : 0;

    // Streaks
    let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
    for (const t of replayTrades) {
      if (t.pnl_pct > 0) { curWin++; curLoss = 0; maxWinStreak = Math.max(maxWinStreak, curWin); }
      else { curLoss++; curWin = 0; maxLossStreak = Math.max(maxLossStreak, curLoss); }
    }

    // Max DD
    let peak = 0, maxDD = 0, equity = 0;
    for (const t of replayTrades) {
      equity += t.pnl_pct;
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      if (dd > maxDD) maxDD = dd;
    }

    // Profit factor
    const grossProfit = replayTrades.filter(t => t.pnl_pct > 0).reduce((a, t) => a + t.pnl_pct, 0);
    const grossLoss = Math.abs(replayTrades.filter(t => t.pnl_pct < 0).reduce((a, t) => a + t.pnl_pct, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Sharpe
    const mean = replayTrades.length > 0 ? replayPnl / replayTrades.length : 0;
    const variance = replayTrades.length > 1 ? replayTrades.reduce((a, t) => a + (t.pnl_pct - mean) ** 2, 0) / (replayTrades.length - 1) : 0;
    const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;

    // Gap summary
    const gapSummary: Record<string, number> = {};
    for (const d of discrepancies) {
      gapSummary[d.source] = (gapSummary[d.source] || 0) + 1;
    }

    // Stored trades stats (for comparison)
    const storedPnl = trades.reduce((sum: number, t: any) => sum + (t.pnl_pct || 0), 0);
    const storedWins = trades.filter((t: any) => t.pnl_pct > 0).length;
    const storedWR = trades.length > 0 ? (storedWins / trades.length * 100) : 0;

    const isMatch = discrepancies.length === 0;
    const hasStoredTrades = trades.length > 0;

    let message: string;
    if (!hasStoredTrades) {
      message = `🔄 אין עסקאות שמורות. ה-replay מצא ${replayTrades.length} עסקאות עם תשואה ${replayPnl.toFixed(1)}%, WR: ${replayWR.toFixed(0)}%, Sharpe: ${sharpe.toFixed(2)}`;
    } else if (isMatch) {
      message = `✅ ${trades.length} עסקאות שמורות תואמות ל-replay (${replayTrades.length}). תשואה: ${storedPnl.toFixed(1)}%, Sharpe: ${sharpe.toFixed(2)}`;
    } else {
      message = `⚠️ ${discrepancies.length} פערים בין ${trades.length} שמורות ל-${replayTrades.length} replay. שמור: ${storedPnl.toFixed(1)}%, replay: ${replayPnl.toFixed(1)}%`;
    }

    return new Response(JSON.stringify({
      match: isMatch,
      has_stored_trades: hasStoredTrades,
      expected_trades: hasStoredTrades ? trades.length : expectedTrades,
      actual_trades: replayTrades.length,
      expected_return: hasStoredTrades ? storedPnl : (result.test_return || result.train_return || 0),
      actual_return: replayPnl,
      replay_trades: replayTrades.slice(0, 50), // Send first 50 for UI display
      discrepancies,
      gap_summary: gapSummary,
      stats: {
        total_pnl: replayPnl,
        win_rate: replayWR,
        avg_win: avgWin,
        avg_loss: avgLoss,
        max_win_streak: maxWinStreak,
        max_loss_streak: maxLossStreak,
        max_drawdown: maxDD,
        profit_factor: profitFactor,
        sharpe,
        total_trades: replayTrades.length,
        wins: replayWins,
        losses: replayLosses,
        missing_bars: missingBars,
        stored_total_pnl: storedPnl,
        stored_win_rate: storedWR,
        stored_count: trades.length,
      },
      message,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
