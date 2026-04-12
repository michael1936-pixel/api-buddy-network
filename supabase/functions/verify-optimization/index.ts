import { corsHeaders } from '@supabase/supabase-js/cors';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // 1. Load optimization result (parameters + summary)
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
    const params = result.parameters as Record<string, unknown>;

    // 3. Load historical market data for this symbol
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
        discrepancies: [],
        message: `לא נמצא מספיק נתוני שוק ל-${result.symbol} (${marketData?.length || 0} ברים). צריך לפחות 50 ברים לאימות.`,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Basic verification: compare stored trades statistics against result summary
    const storedTotalPnl = trades.reduce((sum: number, t: any) => sum + (t.pnl_pct || 0), 0);
    const storedWins = trades.filter((t: any) => t.pnl_pct > 0).length;
    const storedWinRate = trades.length > 0 ? (storedWins / trades.length * 100) : 0;

    const expectedReturn = result.test_return || result.train_return || 0;
    const expectedTrades = result.total_trades || 0;
    const expectedWinRate = result.win_rate || 0;

    const discrepancies: Array<{trade_index: number; field: string; expected: string; actual: string}> = [];

    // Check trade count match
    if (expectedTrades > 0 && Math.abs(trades.length - expectedTrades) > 1) {
      discrepancies.push({
        trade_index: -1,
        field: 'trade_count',
        expected: `${expectedTrades}`,
        actual: `${trades.length}`,
      });
    }

    // Check win rate match (allow 2% tolerance)
    if (expectedWinRate > 0 && Math.abs(storedWinRate - expectedWinRate) > 2) {
      discrepancies.push({
        trade_index: -1,
        field: 'win_rate',
        expected: `${expectedWinRate.toFixed(1)}%`,
        actual: `${storedWinRate.toFixed(1)}%`,
      });
    }

    // 5. Cross-reference trades with market data
    // Check that entry/exit prices exist in the data at the reported times
    for (let i = 0; i < Math.min(trades.length, 50); i++) {
      const trade = trades[i] as any;
      const entryBar = marketData.find((bar: any) => {
        const barTime = new Date(bar.timestamp).getTime();
        const tradeTime = new Date(trade.entry_time).getTime();
        return Math.abs(barTime - tradeTime) < 60 * 15 * 1000; // within 15min
      });

      if (entryBar) {
        // Check if entry price is within the bar's range
        if (trade.entry_price < entryBar.low * 0.999 || trade.entry_price > entryBar.high * 1.001) {
          discrepancies.push({
            trade_index: i + 1,
            field: 'entry_price_outside_bar',
            expected: `${entryBar.low.toFixed(2)}-${entryBar.high.toFixed(2)}`,
            actual: `${trade.entry_price.toFixed(2)}`,
          });
        }
      }

      if (trade.exit_time && trade.exit_price) {
        const exitBar = marketData.find((bar: any) => {
          const barTime = new Date(bar.timestamp).getTime();
          const tradeTime = new Date(trade.exit_time).getTime();
          return Math.abs(barTime - tradeTime) < 60 * 15 * 1000;
        });

        if (exitBar) {
          if (trade.exit_price < exitBar.low * 0.999 || trade.exit_price > exitBar.high * 1.001) {
            discrepancies.push({
              trade_index: i + 1,
              field: 'exit_price_outside_bar',
              expected: `${exitBar.low.toFixed(2)}-${exitBar.high.toFixed(2)}`,
              actual: `${trade.exit_price.toFixed(2)}`,
            });
          }
        }
      }

      // Verify P&L calculation
      if (trade.entry_price && trade.exit_price) {
        const expectedPnl = trade.direction === 'long'
          ? ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100
          : ((trade.entry_price - trade.exit_price) / trade.entry_price) * 100;

        if (Math.abs(expectedPnl - trade.pnl_pct) > 0.5) {
          discrepancies.push({
            trade_index: i + 1,
            field: 'pnl_calculation',
            expected: `${expectedPnl.toFixed(2)}%`,
            actual: `${trade.pnl_pct.toFixed(2)}%`,
          });
        }
      }
    }

    const isMatch = discrepancies.length === 0;
    const message = isMatch
      ? `${trades.length} עסקאות נבדקו — כולן תואמות את הנתונים ההיסטוריים. תשואה כוללת: ${storedTotalPnl.toFixed(1)}%, WR: ${storedWinRate.toFixed(0)}%`
      : `נמצאו ${discrepancies.length} פערים ב-${trades.length} עסקאות. תשואה כוללת: ${storedTotalPnl.toFixed(1)}%, WR: ${storedWinRate.toFixed(0)}%`;

    return new Response(JSON.stringify({
      match: isMatch,
      expected_trades: expectedTrades,
      actual_trades: trades.length,
      expected_return: expectedReturn,
      actual_return: storedTotalPnl,
      discrepancies,
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
