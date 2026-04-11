import type {
  Candle, SymbolData, PeriodSplit, ExtendedStocksStrategyParameters,
  BacktestResult, Trade, PortfolioBacktestResult, MonthlyPerformance
} from './types';
import { evaluateAllSignals, EngineState, EngineLookbacks } from './strategyEngine';
import { StrategyIndicators } from './strategies';
import {
  calculateRSI, calculateEMA, calculateATR, calculateADX,
  calculateBBPine, calculateADXPine, calculateEMAPine, calculateVolumeAverage
} from './indicators';

const INITIAL_CAPITAL = 100_000;
const COMMISSION_PER_SIDE = 0.001; // 0.1%

function buildIndicators(candles: Candle[], params: ExtendedStocksStrategyParameters): StrategyIndicators {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const rsi = calculateRSI(closes, params.s1_rsi_len);
  const ema9 = calculateEMA(closes, params.s1_ema_fast_len);
  const ema21 = calculateEMA(closes, params.s1_ema_mid_len);
  const ema50 = calculateEMA(closes, params.s1_ema_trend_len);
  const ema100 = calculateEMA(closes, 100);
  const atr = calculateATR(highs, lows, closes, params.s1_atr_len);
  const atrAvg = calculateEMA(atr, params.s1_atr_ma_len);
  const adx = calculateADX(highs, lows, closes, params.s1_adx_len);
  const bb = calculateBBPine(closes, params.s1_bb_len, params.s1_bb_mult);
  const volumeAvg = calculateVolumeAverage(volumes, params.s1_vol_len);

  // S2 specific indicators
  const s2Adx = calculateADXPine(highs, lows, closes, params.bb2_adx_len);
  const s2Bb = calculateBBPine(closes, params.bb2_bb_len, params.bb2_bb_mult);
  const s2Ema100 = calculateEMAPine(closes, params.bb2_ma_len);

  return {
    rsi, ema9, ema21, ema50, ema100, atr, atrAvg, adx,
    bbBasis: bb.basis, bbUpper: bb.upper, bbLower: bb.lower,
    volumeAvg,
    s2Adx, s2BbBasis: s2Bb.basis, s2BbUpper: s2Bb.upper, s2BbLower: s2Bb.lower, s2Ema100
  };
}

function computeLookbacks(params: ExtendedStocksStrategyParameters): EngineLookbacks {
  return {
    s1MinLookback: Math.max(params.s1_ema_trend_len, params.s1_rsi_len, params.s1_atr_len, params.s1_adx_len, params.s1_bb_len) + 5,
    s2MinLookback: Math.max(params.bb2_bb_len, params.bb2_adx_len, params.bb2_ma_len) + 5,
    s3MinLookback: params.s3_breakout_len + 5,
    s4MinLookback: 5,
    s5MinLookback: Math.max(params.s5_squeeze_len, params.s5_range_len) + 5,
  };
}

export function runSingleBacktest(
  candles: Candle[],
  params: ExtendedStocksStrategyParameters
): BacktestResult {
  if (candles.length < 100) {
    return emptyResult(params);
  }

  const indicators = buildIndicators(candles, params);
  const lookbacks = computeLookbacks(params);
  const trades: Trade[] = [];

  let capital = INITIAL_CAPITAL;
  let peakCapital = INITIAL_CAPITAL;
  let maxDrawdown = 0;
  let position = 0; // 0=flat, 1=long, -1=short
  let entryPrice = 0;
  let entryBarIndex: number | null = null;
  let entryTime = 0;
  let stopPrice = 0;
  let tpPrice = 0;
  let breakevenTriggered = false;
  let highestSinceEntry = 0;
  let lowestSinceEntry = Infinity;
  let lastEntryBarIndex: number | null = null;
  let entryStrategyId = 0;
  let cooldownBarsLeft = 0;

  const state: EngineState = {
    position: 0,
    lastEntryBarIndex: null,
    barIndex: 0,
    currentATR: 0,
    currentEmaTrend: 0,
  };

  const minLookback = Math.max(lookbacks.s1MinLookback, lookbacks.s2MinLookback, lookbacks.s3MinLookback, lookbacks.s4MinLookback, lookbacks.s5MinLookback);

  for (let i = minLookback; i < candles.length; i++) {
    const candle = candles[i];
    const close = candle.close;

    // Update ATR/EMA for state
    const atrIdx = i - (candles.length - indicators.atr.length);
    const emaIdx = i - (candles.length - indicators.ema50.length);
    state.barIndex = i;
    state.position = position;
    state.lastEntryBarIndex = lastEntryBarIndex;
    state.currentATR = atrIdx >= 0 && atrIdx < indicators.atr.length ? indicators.atr[atrIdx] : 0;
    state.currentEmaTrend = emaIdx >= 0 && emaIdx < indicators.ema50.length ? indicators.ema50[emaIdx] : 0;

    // Track trade extremes
    if (position !== 0) {
      if (candle.high > highestSinceEntry) highestSinceEntry = candle.high;
      if (candle.low < lowestSinceEntry) lowestSinceEntry = candle.low;
    }

    // === EXIT LOGIC ===
    if (position === 1) {
      // Stop loss
      if (candle.low <= stopPrice) {
        const exitPrice = stopPrice;
        const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;
        const commission = capital * COMMISSION_PER_SIDE * 2;
        capital += capital * (pnlPct / 100) - commission;
        trades.push({
          entryTime, entryPrice, exitTime: candle.timestamp, exitPrice,
          type: 'long', pnl: capital - (capital - capital * (pnlPct / 100) + commission),
          pnlPct, exitReason: 'stop_loss', stopPrice, tpPrice,
          breakevenTriggered, entryBarIndex: entryBarIndex!, exitBarIndex: i,
          entryStrategyId,
        });
        position = 0; cooldownBarsLeft = params.cooldown_after_loss_bars;
        if (capital > peakCapital) peakCapital = capital;
        const dd = ((peakCapital - capital) / peakCapital) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
        continue;
      }
      // Take profit
      if (tpPrice > 0 && candle.high >= tpPrice) {
        const exitPrice = tpPrice;
        const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;
        const commission = capital * COMMISSION_PER_SIDE * 2;
        capital += capital * (pnlPct / 100) - commission;
        trades.push({
          entryTime, entryPrice, exitTime: candle.timestamp, exitPrice,
          type: 'long', pnlPct, exitReason: 'take_profit',
          entryBarIndex: entryBarIndex!, exitBarIndex: i, entryStrategyId,
        });
        position = 0;
        if (capital > peakCapital) peakCapital = capital;
        continue;
      }
      // Breakeven trigger
      if (!breakevenTriggered && params.be_trigger_pct_long > 0) {
        const beTriggerPrice = entryPrice * (1 + params.be_trigger_pct_long / 100);
        if (candle.high >= beTriggerPrice) {
          breakevenTriggered = true;
          stopPrice = entryPrice;
        }
      }
      // RSI trailing exit
      if (params.enable_rsi_exit) {
        const rsiIdx = i - (candles.length - indicators.rsi.length);
        if (rsiIdx >= 0 && rsiIdx < indicators.rsi.length) {
          const rsi = indicators.rsi[rsiIdx];
          const barsInTrade = i - (entryBarIndex || 0);
          if (rsi >= params.rsi_exit_long && barsInTrade >= params.min_bars_in_trade_exit) {
            const pnlPct = ((close - entryPrice) / entryPrice) * 100;
            const commission = capital * COMMISSION_PER_SIDE * 2;
            capital += capital * (pnlPct / 100) - commission;
            trades.push({
              entryTime, entryPrice, exitTime: candle.timestamp, exitPrice: close,
              type: 'long', pnlPct, exitReason: 'trailing_stop',
              entryBarIndex: entryBarIndex!, exitBarIndex: i, entryStrategyId,
            });
            position = 0;
            if (capital > peakCapital) peakCapital = capital;
            const dd = ((peakCapital - capital) / peakCapital) * 100;
            if (dd > maxDrawdown) maxDrawdown = dd;
            continue;
          }
        }
      }
    } else if (position === -1) {
      // Stop loss for short
      if (candle.high >= stopPrice) {
        const exitPrice = stopPrice;
        const pnlPct = ((entryPrice - exitPrice) / entryPrice) * 100;
        const commission = capital * COMMISSION_PER_SIDE * 2;
        capital += capital * (pnlPct / 100) - commission;
        trades.push({
          entryTime, entryPrice, exitTime: candle.timestamp, exitPrice,
          type: 'short', pnlPct, exitReason: 'stop_loss',
          entryBarIndex: entryBarIndex!, exitBarIndex: i, entryStrategyId,
        });
        position = 0; cooldownBarsLeft = params.cooldown_after_loss_bars;
        if (capital > peakCapital) peakCapital = capital;
        const dd = ((peakCapital - capital) / peakCapital) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
        continue;
      }
      // Take profit for short
      if (tpPrice > 0 && candle.low <= tpPrice) {
        const exitPrice = tpPrice;
        const pnlPct = ((entryPrice - exitPrice) / entryPrice) * 100;
        const commission = capital * COMMISSION_PER_SIDE * 2;
        capital += capital * (pnlPct / 100) - commission;
        trades.push({
          entryTime, entryPrice, exitTime: candle.timestamp, exitPrice,
          type: 'short', pnlPct, exitReason: 'take_profit',
          entryBarIndex: entryBarIndex!, exitBarIndex: i, entryStrategyId,
        });
        position = 0;
        if (capital > peakCapital) peakCapital = capital;
        continue;
      }
      // Breakeven trigger for short
      if (!breakevenTriggered && params.be_trigger_pct_short > 0) {
        const beTriggerPrice = entryPrice * (1 - params.be_trigger_pct_short / 100);
        if (candle.low <= beTriggerPrice) {
          breakevenTriggered = true;
          stopPrice = entryPrice;
        }
      }
      // RSI trailing exit for short
      if (params.enable_rsi_exit) {
        const rsiIdx = i - (candles.length - indicators.rsi.length);
        if (rsiIdx >= 0 && rsiIdx < indicators.rsi.length) {
          const rsi = indicators.rsi[rsiIdx];
          const barsInTrade = i - (entryBarIndex || 0);
          if (rsi <= params.rsi_exit_short && barsInTrade >= params.min_bars_in_trade_exit) {
            const pnlPct = ((entryPrice - close) / entryPrice) * 100;
            const commission = capital * COMMISSION_PER_SIDE * 2;
            capital += capital * (pnlPct / 100) - commission;
            trades.push({
              entryTime, entryPrice, exitTime: candle.timestamp, exitPrice: close,
              type: 'short', pnlPct, exitReason: 'trailing_stop',
              entryBarIndex: entryBarIndex!, exitBarIndex: i, entryStrategyId,
            });
            position = 0;
            if (capital > peakCapital) peakCapital = capital;
            const dd = ((peakCapital - capital) / peakCapital) * 100;
            if (dd > maxDrawdown) maxDrawdown = dd;
            continue;
          }
        }
      }
    }

    // === ENTRY LOGIC ===
    if (cooldownBarsLeft > 0) { cooldownBarsLeft--; continue; }

    const signals = evaluateAllSignals(candles, i, indicators, params, state, lookbacks);

    if (signals.buyFinal && position <= 0) {
      // Close short if flipping
      if (position === -1) {
        const pnlPct = ((entryPrice - close) / entryPrice) * 100;
        const commission = capital * COMMISSION_PER_SIDE * 2;
        capital += capital * (pnlPct / 100) - commission;
        trades.push({
          entryTime, entryPrice, exitTime: candle.timestamp, exitPrice: close,
          type: 'short', pnlPct, exitReason: 'flip',
          entryBarIndex: entryBarIndex!, exitBarIndex: i, entryStrategyId,
        });
        if (capital > peakCapital) peakCapital = capital;
      }
      // Enter long
      position = 1;
      entryPrice = close;
      entryBarIndex = i;
      entryTime = candle.timestamp;
      lastEntryBarIndex = i;
      entryStrategyId = signals.entryStrategyId;
      breakevenTriggered = false;
      highestSinceEntry = candle.high;
      lowestSinceEntry = candle.low;

      if (params.use_atr_sl && state.currentATR > 0) {
        stopPrice = close - state.currentATR * params.atr_mult_long;
      } else {
        stopPrice = close * (1 - params.stop_distance_percent_long / 100);
      }
      tpPrice = params.tp_percent_long > 0 ? close * (1 + params.tp_percent_long / 100) : 0;
    } else if (signals.sellFinal && position >= 0) {
      // Close long if flipping
      if (position === 1) {
        const pnlPct = ((close - entryPrice) / entryPrice) * 100;
        const commission = capital * COMMISSION_PER_SIDE * 2;
        capital += capital * (pnlPct / 100) - commission;
        trades.push({
          entryTime, entryPrice, exitTime: candle.timestamp, exitPrice: close,
          type: 'long', pnlPct, exitReason: 'flip',
          entryBarIndex: entryBarIndex!, exitBarIndex: i, entryStrategyId,
        });
        if (capital > peakCapital) peakCapital = capital;
      }
      // Enter short
      position = -1;
      entryPrice = close;
      entryBarIndex = i;
      entryTime = candle.timestamp;
      lastEntryBarIndex = i;
      entryStrategyId = signals.entryStrategyId;
      breakevenTriggered = false;
      highestSinceEntry = candle.high;
      lowestSinceEntry = candle.low;

      if (params.use_atr_sl && state.currentATR > 0) {
        stopPrice = close + state.currentATR * params.atr_mult_short;
      } else {
        stopPrice = close * (1 + params.stop_distance_percent_short / 100);
      }
      tpPrice = params.tp_percent_short > 0 ? close * (1 - params.tp_percent_short / 100) : 0;
    }

    // Update drawdown
    if (capital > peakCapital) peakCapital = capital;
    const dd = ((peakCapital - capital) / peakCapital) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Close open position at end
  if (position !== 0 && candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    const close = lastCandle.close;
    const pnlPct = position === 1
      ? ((close - entryPrice) / entryPrice) * 100
      : ((entryPrice - close) / entryPrice) * 100;
    const commission = capital * COMMISSION_PER_SIDE * 2;
    capital += capital * (pnlPct / 100) - commission;
    trades.push({
      entryTime, entryPrice, exitTime: lastCandle.timestamp, exitPrice: close,
      type: position === 1 ? 'long' : 'short', pnlPct, exitReason: 'end_of_data',
      entryBarIndex: entryBarIndex!, exitBarIndex: candles.length - 1, entryStrategyId,
    });
  }

  const winningTrades = trades.filter(t => (t.pnlPct || 0) > 0);
  const losingTrades = trades.filter(t => (t.pnlPct || 0) <= 0);
  const longTrades = trades.filter(t => t.type === 'long');
  const shortTrades = trades.filter(t => t.type === 'short');
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + (t.pnlPct || 0), 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((s, t) => s + Math.abs(t.pnlPct || 0), 0) / losingTrades.length : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) : winningTrades.length > 0 ? Infinity : 0;

  // Simple Sharpe ratio
  const returns = trades.map(t => t.pnlPct || 0);
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = returns.length > 1
    ? Math.sqrt(returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (returns.length - 1))
    : 0;
  const sharpeRatio = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    parameters: params,
    totalReturn: ((capital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100,
    finalCapital: capital,
    winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    totalTrades: trades.length,
    longTrades: longTrades.length,
    shortTrades: shortTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    sharpeRatio,
    maxDrawdown,
    profitFactor,
    avgWin,
    avgLoss,
    totalFeesUsd: trades.length * INITIAL_CAPITAL * COMMISSION_PER_SIDE * 2,
    trades,
  };
}

function emptyResult(params: ExtendedStocksStrategyParameters): BacktestResult {
  return {
    parameters: params, totalReturn: 0, finalCapital: INITIAL_CAPITAL,
    winRate: 0, totalTrades: 0, longTrades: 0, shortTrades: 0,
    winningTrades: 0, losingTrades: 0, sharpeRatio: 0, maxDrawdown: 0,
    profitFactor: 0, avgWin: 0, avgLoss: 0, totalFeesUsd: 0, trades: [],
  };
}

export function runPortfolioBacktest(
  symbolsData: SymbolData[],
  params: ExtendedStocksStrategyParameters,
  periodSplit: PeriodSplit,
  _mode: string,
  _simulationConfig: any
): { totalTrainReturn: number; totalTestReturn: number; trainResults: PortfolioBacktestResult[]; testResults: PortfolioBacktestResult[]; monthlyPerformance: MonthlyPerformance[] } {
  const trainResults: PortfolioBacktestResult[] = [];
  const testResults: PortfolioBacktestResult[] = [];

  for (const sd of symbolsData) {
    const trainCandles = sd.candles.filter(c => {
      const t = typeof c.timestamp === 'number' ? c.timestamp : new Date(c.timestamp).getTime();
      return t >= periodSplit.trainStartDate.getTime() && t <= periodSplit.trainEndDate.getTime();
    });
    const testCandles = sd.candles.filter(c => {
      const t = typeof c.timestamp === 'number' ? c.timestamp : new Date(c.timestamp).getTime();
      return t >= periodSplit.testStartDate.getTime() && t <= periodSplit.testEndDate.getTime();
    });

    const trainResult = runSingleBacktest(trainCandles, params);
    const testResult = runSingleBacktest(testCandles, params);

    trainResults.push({ symbol: sd.symbol, result: trainResult, capitalAllocated: INITIAL_CAPITAL, contributionToTotal: trainResult.totalReturn });
    testResults.push({ symbol: sd.symbol, result: testResult, capitalAllocated: INITIAL_CAPITAL, contributionToTotal: testResult.totalReturn });
  }

  const totalTrainReturn = trainResults.length > 0
    ? trainResults.reduce((s, r) => s + r.result.totalReturn, 0) / trainResults.length : 0;
  const totalTestReturn = testResults.length > 0
    ? testResults.reduce((s, r) => s + r.result.totalReturn, 0) / testResults.length : 0;

  const monthlyPerformance = [
    ...calculateMonthlyPerformance(trainResults, 'train'),
    ...calculateMonthlyPerformance(testResults, 'test'),
  ];

  return { totalTrainReturn, totalTestReturn, trainResults, testResults, monthlyPerformance };
}

export function calculateMonthlyPerformance(
  results: PortfolioBacktestResult[],
  phase: 'train' | 'test'
): MonthlyPerformance[] {
  const monthly: MonthlyPerformance[] = [];

  for (const pr of results) {
    const monthMap = new Map<string, { pnl: number; count: number }>();
    for (const trade of pr.result.trades) {
      if (!trade.exitTime) continue;
      const d = new Date(trade.exitTime);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const existing = monthMap.get(key) || { pnl: 0, count: 0 };
      existing.pnl += trade.pnlPct || 0;
      existing.count++;
      monthMap.set(key, existing);
    }

    for (const [key, val] of monthMap) {
      const [year, month] = key.split('-').map(Number);
      monthly.push({
        symbol: pr.symbol, year, month,
        returnPct: val.pnl, endingCapital: 0, tradesCount: val.count, phase,
      });
    }
  }

  return monthly;
}
