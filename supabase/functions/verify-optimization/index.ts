import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Indicator helpers (mirrors client-side logic) ──

function calcEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
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

// ── Gap diagnosis ──

interface GapDiagnosis {
  trade_index: number;
  field: string;
  expected: string;
  actual: string;
  source: string; // root cause category
  detail: string; // specific explanation
}

function diagnoseGap(field: string, expected: string, actual: string, context: Record<string, unknown>): { source: string; detail: string } {
  if (field === 'trade_count') {
    const exp = parseInt(expected);
    const act = parseInt(actual);
    const diff = act - exp;
    if (context.missingBars && (context.missingBars as number) > 0) {
      return { source: 'missing_data', detail: `חסרים ${context.missingBars} ברים בנתוני השוק — ייתכן שגרם לדילוג על עסקאות` };
    }
    if (Math.abs(diff) <= 3) {
      return { source: 'boundary_condition', detail: `הפרש קטן (${diff}) — כנראה בגלל תנאי שוליים בתחילת/סוף הטווח` };
    }
    return { source: 'logic_divergence', detail: `הפרש גדול (${diff}) — ייתכן הבדל בלוגיקת כניסה/יציאה` };
  }

  if (field === 'win_rate') {
    return { source: 'cumulative_drift', detail: 'הפרש ב-Win Rate נובע מהבדלים בעסקאות בודדות שמצטברים' };
  }

  if (field === 'entry_price_outside_bar' || field === 'exit_price_outside_bar') {
    const prices = actual.split('-').map(Number);
    if (prices.some(isNaN)) {
      return { source: 'precision', detail: `מחיר ${field === 'entry_price_outside_bar' ? 'כניסה' : 'יציאה'} מחוץ לטווח הבר — ייתכן בעיית עיגול` };
    }
    return { source: 'price_mismatch', detail: `מחיר מחוץ לטווח [${expected}], נתון: ${actual}. ייתכן שימוש ב-close במקום limit/stop` };
  }

  if (field === 'pnl_calculation') {
    const expPnl = parseFloat(expected);
    const actPnl = parseFloat(actual);
    if (Math.abs(expPnl - actPnl) < 1) {
      return { source: 'precision', detail: 'הפרש קטן ב-P&L — סביר שמקורו בעיגול float' };
    }
    return { source: 'calculation_error', detail: `פער משמעותי ב-P&L (${expected} vs ${actual}) — ייתכן שגיאה בנוסחת חישוב` };
  }

  if (field === 'indicator_rsi' || field === 'indicator_atr' || field === 'indicator_ema') {
    return { source: 'indicator_divergence', detail: `הבדל בחישוב ${field.replace('indicator_', '').toUpperCase()} — ייתכן הפרש בגלל חלון נתונים שונה` };
  }

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
    const params = result.parameters as Record<string, unknown>;

    // 3. Load market data
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
        stats: null,
        message: `לא נמצא מספיק נתוני שוק ל-${result.symbol} (${marketData?.length || 0} ברים). צריך לפחות 50 ברים לאימות.`,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Compute indicators for cross-reference
    const closes = marketData.map((b: any) => b.close);
    const highs = marketData.map((b: any) => b.high);
    const lows = marketData.map((b: any) => b.low);

    const rsiPeriod = (params.rsi_period as number) || 14;
    const atrPeriod = (params.atr_period as number) || 14;
    const emaPeriod = (params.ema_period as number) || 20;

    const rsiValues = calcRSI(closes, rsiPeriod);
    const atrValues = calcATR(highs, lows, closes, atrPeriod);
    const emaValues = calcEMA(closes, emaPeriod);

    // Check for missing bars (gaps in timestamps)
    let missingBars = 0;
    for (let i = 1; i < marketData.length; i++) {
      const diff = new Date(marketData[i].timestamp).getTime() - new Date(marketData[i - 1].timestamp).getTime();
      // More than 2 hours gap during trading hours suggests missing bars
      if (diff > 2 * 60 * 60 * 1000) {
        missingBars++;
      }
    }

    // 5. Detailed verification
    const discrepancies: GapDiagnosis[] = [];

    const storedTotalPnl = trades.reduce((sum: number, t: any) => sum + (t.pnl_pct || 0), 0);
    const storedWins = trades.filter((t: any) => t.pnl_pct > 0).length;
    const storedLosses = trades.filter((t: any) => t.pnl_pct < 0).length;
    const storedWinRate = trades.length > 0 ? (storedWins / trades.length * 100) : 0;

    const expectedReturn = result.test_return || result.train_return || 0;
    const expectedTrades = result.total_trades || 0;
    const expectedWinRate = result.win_rate || 0;

    // Check trade count match
    if (expectedTrades > 0 && Math.abs(trades.length - expectedTrades) > 1) {
      const diag = diagnoseGap('trade_count', `${expectedTrades}`, `${trades.length}`, { missingBars });
      discrepancies.push({
        trade_index: -1, field: 'trade_count',
        expected: `${expectedTrades}`, actual: `${trades.length}`,
        ...diag,
      });
    }

    // Check win rate match
    if (expectedWinRate > 0 && Math.abs(storedWinRate - expectedWinRate) > 2) {
      const diag = diagnoseGap('win_rate', `${expectedWinRate.toFixed(1)}%`, `${storedWinRate.toFixed(1)}%`, {});
      discrepancies.push({
        trade_index: -1, field: 'win_rate',
        expected: `${expectedWinRate.toFixed(1)}%`, actual: `${storedWinRate.toFixed(1)}%`,
        ...diag,
      });
    }

    // 6. Per-trade verification with indicator cross-reference
    for (let i = 0; i < Math.min(trades.length, 100); i++) {
      const trade = trades[i] as any;

      // Find matching bar for entry
      const entryBarIdx = marketData.findIndex((bar: any) => {
        const barTime = new Date(bar.timestamp).getTime();
        const tradeTime = new Date(trade.entry_time).getTime();
        return Math.abs(barTime - tradeTime) < 60 * 15 * 1000;
      });

      if (entryBarIdx >= 0) {
        const entryBar = marketData[entryBarIdx] as any;
        // Price within bar range check
        if (trade.entry_price < entryBar.low * 0.999 || trade.entry_price > entryBar.high * 1.001) {
          const diag = diagnoseGap('entry_price_outside_bar',
            `${entryBar.low.toFixed(2)}-${entryBar.high.toFixed(2)}`,
            `${trade.entry_price.toFixed(2)}`, {});
          discrepancies.push({ trade_index: i + 1, field: 'entry_price_outside_bar', expected: `${entryBar.low.toFixed(2)}-${entryBar.high.toFixed(2)}`, actual: `${trade.entry_price.toFixed(2)}`, ...diag });
        }

        // Cross-reference indicators at entry point
        if (entryBarIdx < rsiValues.length) {
          const rsiAtEntry = rsiValues[entryBarIdx];
          const atrAtEntry = atrValues[entryBarIdx];
          const emaAtEntry = emaValues[entryBarIdx];

          // Sanity check: for long entries, RSI should generally not be overbought
          if (trade.direction === 'long' && rsiAtEntry > 85) {
            discrepancies.push({
              trade_index: i + 1, field: 'indicator_rsi',
              expected: `RSI < 85 ל-long`, actual: `RSI=${rsiAtEntry.toFixed(1)}`,
              source: 'indicator_anomaly',
              detail: `כניסה long כש-RSI=${rsiAtEntry.toFixed(1)} — חריג, ייתכן שהאסטרטגיה משתמשת בלוגיקה שונה`
            });
          }
          if (trade.direction === 'short' && rsiAtEntry < 15) {
            discrepancies.push({
              trade_index: i + 1, field: 'indicator_rsi',
              expected: `RSI > 15 ל-short`, actual: `RSI=${rsiAtEntry.toFixed(1)}`,
              source: 'indicator_anomaly',
              detail: `כניסה short כש-RSI=${rsiAtEntry.toFixed(1)} — חריג`
            });
          }
        }
      }

      // Exit verification
      if (trade.exit_time && trade.exit_price) {
        const exitBarIdx = marketData.findIndex((bar: any) => {
          const barTime = new Date(bar.timestamp).getTime();
          const tradeTime = new Date(trade.exit_time).getTime();
          return Math.abs(barTime - tradeTime) < 60 * 15 * 1000;
        });

        if (exitBarIdx >= 0) {
          const exitBar = marketData[exitBarIdx] as any;
          if (trade.exit_price < exitBar.low * 0.999 || trade.exit_price > exitBar.high * 1.001) {
            const diag = diagnoseGap('exit_price_outside_bar',
              `${exitBar.low.toFixed(2)}-${exitBar.high.toFixed(2)}`,
              `${trade.exit_price.toFixed(2)}`, {});
            discrepancies.push({ trade_index: i + 1, field: 'exit_price_outside_bar', expected: `${exitBar.low.toFixed(2)}-${exitBar.high.toFixed(2)}`, actual: `${trade.exit_price.toFixed(2)}`, ...diag });
          }
        }

        // Verify P&L calculation
        const expectedPnl = trade.direction === 'long'
          ? ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100
          : ((trade.entry_price - trade.exit_price) / trade.entry_price) * 100;

        if (Math.abs(expectedPnl - trade.pnl_pct) > 0.5) {
          const diag = diagnoseGap('pnl_calculation', `${expectedPnl.toFixed(2)}%`, `${trade.pnl_pct.toFixed(2)}%`, {});
          discrepancies.push({ trade_index: i + 1, field: 'pnl_calculation', expected: `${expectedPnl.toFixed(2)}%`, actual: `${trade.pnl_pct.toFixed(2)}%`, ...diag });
        }
      }
    }

    // 7. Compute extended stats
    const pnlValues = trades.map((t: any) => t.pnl_pct || 0);
    const avgWin = storedWins > 0 ? pnlValues.filter(p => p > 0).reduce((a, b) => a + b, 0) / storedWins : 0;
    const avgLoss = storedLosses > 0 ? pnlValues.filter(p => p < 0).reduce((a, b) => a + b, 0) / storedLosses : 0;

    // Max consecutive wins/losses
    let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
    for (const p of pnlValues) {
      if (p > 0) { curWin++; curLoss = 0; maxWinStreak = Math.max(maxWinStreak, curWin); }
      else if (p < 0) { curLoss++; curWin = 0; maxLossStreak = Math.max(maxLossStreak, curLoss); }
      else { curWin = 0; curLoss = 0; }
    }

    // Max drawdown
    let peak = 0, maxDD = 0, equity = 0;
    for (const p of pnlValues) {
      equity += p;
      if (equity > peak) peak = equity;
      const dd = peak - equity;
      if (dd > maxDD) maxDD = dd;
    }

    // Profit factor
    const grossProfit = pnlValues.filter(p => p > 0).reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(pnlValues.filter(p => p < 0).reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Sharpe (simplified — daily-ish)
    const mean = pnlValues.length > 0 ? pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length : 0;
    const variance = pnlValues.length > 1 ? pnlValues.reduce((a, p) => a + (p - mean) ** 2, 0) / (pnlValues.length - 1) : 0;
    const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;

    // Gap summary by source
    const gapSummary: Record<string, number> = {};
    for (const d of discrepancies) {
      gapSummary[d.source] = (gapSummary[d.source] || 0) + 1;
    }

    const isMatch = discrepancies.length === 0;
    const message = isMatch
      ? `✅ ${trades.length} עסקאות נבדקו — כולן תואמות. תשואה: ${storedTotalPnl.toFixed(1)}%, WR: ${storedWinRate.toFixed(0)}%, Sharpe: ${sharpe.toFixed(2)}`
      : `⚠️ ${discrepancies.length} פערים ב-${trades.length} עסקאות. תשואה: ${storedTotalPnl.toFixed(1)}%, WR: ${storedWinRate.toFixed(0)}%`;

    return new Response(JSON.stringify({
      match: isMatch,
      expected_trades: expectedTrades,
      actual_trades: trades.length,
      expected_return: expectedReturn,
      actual_return: storedTotalPnl,
      discrepancies,
      gap_summary: gapSummary,
      stats: {
        total_pnl: storedTotalPnl,
        win_rate: storedWinRate,
        avg_win: avgWin,
        avg_loss: avgLoss,
        max_win_streak: maxWinStreak,
        max_loss_streak: maxLossStreak,
        max_drawdown: maxDD,
        profit_factor: profitFactor,
        sharpe,
        total_trades: trades.length,
        wins: storedWins,
        losses: storedLosses,
        missing_bars: missingBars,
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
