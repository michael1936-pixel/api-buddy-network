import type { Candle, ExtendedStocksStrategyParameters } from './types';
import { highest, lowest } from './indicators';
import {
  ENABLE_S2_DEBUG, S2_DEBUG_BARS, S2_FULL_DEBUG_BARS, ENABLE_S2_FULL_DEBUG,
  ENABLE_S2_TRADE_DEBUG, ENABLE_S1_INTERNAL_DEBUG, S1_INTERNAL_DEBUG_BARS,
  ENABLE_S2_BB_RANGE_DEBUG, S2_BB_DEBUG_TARGET_BARS, S2_BB_DEBUG_RANGE
} from './debugConfig';

const ATR_EPSILON = 0.05;

export interface StrategyIndicators {
  rsi: number[];
  ema9: number[];
  ema21: number[];
  ema50: number[];
  ema100: number[];
  atr: number[];
  atrAvg: number[];
  adx: number[];
  bbBasis: number[];
  bbUpper: number[];
  bbLower: number[];
  volumeAvg: number[];
  highs: number[];
  lows: number[];
  s2Adx?: number[];
  s2BbBasis?: number[];
  s2BbUpper?: number[];
  s2BbLower?: number[];
  s2Ema100?: number[];
}

export interface StrategySignal {
  buySignal: boolean;
  sellSignal: boolean;
}

export interface S2StrategySignal extends StrategySignal {
  bb2ShortBase: boolean;
  bb2LongBase: boolean;
  bb2CanEnterShort: boolean;
  bb2CanEnterLong: boolean;
  debug?: S2DebugInfo;
}

export interface S2DebugInfo {
  rsi: number;
  adx: number;
  bbUpper: number;
  bbLower: number;
  ema100: number;
  prevClose: number;
  prevBbUpper: number;
  prevBbLower: number;
  crossoverLower: boolean;
  crossunderUpper: boolean;
  rangeEnv: boolean;
  uptrend: boolean;
  downtrend: boolean;
  lowBelowBB: boolean;
  highAboveBB: boolean;
  rsiOkLong: boolean;
  rsiOkShort: boolean;
  bb2LongBase: boolean;
  bb2ShortBase: boolean;
  bb2CanEnterLong: boolean;
  bb2CanEnterShort: boolean;
}

export interface S4DebugInfo {
  isInsideBar: boolean;
  insideRangePc: number;
  rangeOk: boolean;
  trendOkLong: boolean;
  trendOkShort: boolean;
  breakoutUp: boolean;
  breakoutDown: boolean;
  s4LongBase: boolean;
  s4ShortBase: boolean;
  canEnterLong: boolean;
  canEnterShort: boolean;
  prevHigh: number;
  prevLow: number;
  motherHigh: number;
  motherLow: number;
  rsi: number;
  ema50: number;
}

// ================= Pine Script 1:1 Helper Functions =================

function crossunder(seriesA: number[], seriesB: number[], i: number): boolean {
  if (i < 1) return false;
  return seriesA[i - 1] >= seriesB[i - 1] && seriesA[i] < seriesB[i];
}

function crossover(seriesA: number[], seriesB: number[], i: number): boolean {
  if (i < 1) return false;
  return seriesA[i - 1] <= seriesB[i - 1] && seriesA[i] > seriesB[i];
}

// ================= Strategy 1 – EMA Trend =================

export function strategy1_EMATrend(
  candles: Candle[], index: number, indicators: StrategyIndicators, params: ExtendedStocksStrategyParameters
): StrategySignal {
  const rsiIdx   = index - (candles.length - indicators.rsi.length);
  const ema9Idx  = index - (candles.length - indicators.ema9.length);
  const ema21Idx = index - (candles.length - indicators.ema21.length);
  const ema50Idx = index - (candles.length - indicators.ema50.length);
  const atrIdx   = index - (candles.length - indicators.atr.length);
  const adxIdx   = index - (candles.length - indicators.adx.length);
  const bbIdx    = index - (candles.length - indicators.bbBasis.length);
  const volIdx   = index - (candles.length - indicators.volumeAvg.length);

  if (rsiIdx < 0 || ema9Idx < 1 || ema21Idx < 1 || ema50Idx < 1 || atrIdx < 0 || adxIdx < 0 || bbIdx < 0 || volIdx < 0) {
    return { buySignal: false, sellSignal: false };
  }

  const currentRSI   = indicators.rsi[rsiIdx];
  const currentEMA9  = indicators.ema9[ema9Idx];
  const prevEMA9     = indicators.ema9[ema9Idx - 1];
  const currentEMA21 = indicators.ema21[ema21Idx];
  const prevEMA21    = indicators.ema21[ema21Idx - 1];
  const currentEMA50 = indicators.ema50[ema50Idx];
  const prevEMA50    = indicators.ema50[ema50Idx - 1];
  const currentATR   = indicators.atr[atrIdx];
  const avgATR       = indicators.atrAvg[atrIdx];
  const currentADX   = indicators.adx[adxIdx];
  const bbUpper      = indicators.bbUpper[bbIdx];
  const bbLower      = indicators.bbLower[bbIdx];
  const bbBasis      = indicators.bbBasis[bbIdx];
  const currentVolume = candles[index].volume;
  const avgVolume     = indicators.volumeAvg[volIdx];
  const close         = candles[index].close;

  const crossoverEMA21  = prevEMA9 <= prevEMA21 && currentEMA9 > currentEMA21;
  const crossoverEMA50  = prevEMA9 <= prevEMA50 && currentEMA9 > currentEMA50;
  const crossunderEMA21 = prevEMA9 >= prevEMA21 && currentEMA9 < currentEMA21;
  const crossunderEMA50 = prevEMA9 >= prevEMA50 && currentEMA9 < currentEMA50;

  let cnt = 0;
  if (currentVolume > avgVolume * params.s1_hi_vol_mult) cnt++;
  if (currentADX > params.s1_adx_strong) cnt++;
  if (currentATR > avgATR * params.s1_atr_hi_mult) cnt++;
  const s1FarThr = params.s1_far_from_bb_pc / 100;
  const condFarFromBBands = close > bbBasis
    ? (bbUpper - close) / close > s1FarThr
    : (close - bbLower) / close > s1FarThr;
  if (condFarFromBBands) cnt++;

  const swingFilter = cnt >= params.s1_min_conds;
  const baseBuy  = (crossoverEMA21 || crossoverEMA50) && currentRSI > 50;
  const baseSell = (crossunderEMA21 || crossunderEMA50) && currentRSI < 50;
  const buySignal  = baseBuy && swingFilter && currentRSI > params.rsi_long_entry_min;
  const sellSignal = baseSell && swingFilter && currentRSI < params.rsi_short_entry_max;

  return { buySignal, sellSignal };
}

// ================= Strategy 2 – Bollinger Mean Reversion =================

export function strategy2_BollingerMeanReversion(
  candles: Candle[], index: number, indicators: StrategyIndicators, params: ExtendedStocksStrategyParameters
): S2StrategySignal {
  const adxArr = indicators.s2Adx ?? indicators.adx;
  const bbUpperArr = indicators.s2BbUpper ?? indicators.bbUpper;
  const bbLowerArr = indicators.s2BbLower ?? indicators.bbLower;
  const ema100Arr = indicators.s2Ema100 ?? indicators.ema100;
  
  if (index < 1) return { buySignal: false, sellSignal: false, bb2ShortBase: false, bb2LongBase: false, bb2CanEnterShort: false, bb2CanEnterLong: false };
  
  if (index >= candles.length || index >= indicators.rsi.length ||
      index >= adxArr.length || index >= bbUpperArr.length || 
      index >= bbLowerArr.length) {
    return { buySignal: false, sellSignal: false, bb2ShortBase: false, bb2LongBase: false, bb2CanEnterShort: false, bb2CanEnterLong: false };
  }
  
  const currentRSI = indicators.rsi[index];
  const bb2_ma = ema100Arr[index];
  const currentADX = adxArr[index];
  const bbUpper = bbUpperArr[index];
  const bbLower = bbLowerArr[index];
  const prevBbUpper = bbUpperArr[index - 1];
  const prevBbLower = bbLowerArr[index - 1];
  
  const close = candles[index].close;
  const prevClose = candles[index - 1].close;
  const low = candles[index].low;
  const high = candles[index].high;

  if (isNaN(currentRSI) || isNaN(currentADX) || isNaN(bbUpper) || isNaN(bbLower)) {
    return { buySignal: false, sellSignal: false, bb2ShortBase: false, bb2LongBase: false, bb2CanEnterShort: false, bb2CanEnterLong: false };
  }
  if (isNaN(prevBbUpper) || isNaN(prevBbLower)) {
    return { buySignal: false, sellSignal: false, bb2ShortBase: false, bb2LongBase: false, bb2CanEnterShort: false, bb2CanEnterLong: false };
  }
  if (params.bb2_use_trend_filter && isNaN(bb2_ma)) {
    return { buySignal: false, sellSignal: false, bb2ShortBase: false, bb2LongBase: false, bb2CanEnterShort: false, bb2CanEnterLong: false };
  }

  const bb2RangeEnv = currentADX < params.bb2_adx_max;
  const bb2Uptrend = !params.bb2_use_trend_filter || close > bb2_ma;
  const bb2Downtrend = !params.bb2_use_trend_filter || close < bb2_ma;
  const lowBelowBB = low < bbLower;
  const highAboveBB = high > bbUpper;
  const closeCrossoverLower = prevClose <= prevBbLower && close > bbLower;
  const closeCrossunderUpper = prevClose >= prevBbUpper && close < bbUpper;

  const bb2LongBase = bb2RangeEnv && bb2Uptrend && lowBelowBB && closeCrossoverLower;
  const bb2ShortBase = bb2RangeEnv && bb2Downtrend && highAboveBB && closeCrossunderUpper;

  const rsiOkLong = currentRSI <= params.bb2_rsi_long_max;
  const rsiOkShort = currentRSI >= params.bb2_rsi_short_min;

  const bb2CanEnterLong = bb2LongBase && rsiOkLong;
  const bb2CanEnterShort = bb2ShortBase && rsiOkShort;

  const buySignal = bb2CanEnterLong;
  const sellSignal = bb2CanEnterShort;

  return {
    buySignal, sellSignal,
    bb2ShortBase, bb2LongBase, bb2CanEnterShort, bb2CanEnterLong,
    debug: (ENABLE_S2_TRADE_DEBUG || ENABLE_S2_FULL_DEBUG) ? {
      rsi: currentRSI, adx: currentADX,
      bbUpper, bbLower, ema100: bb2_ma,
      prevClose, prevBbUpper, prevBbLower,
      crossoverLower: closeCrossoverLower,
      crossunderUpper: closeCrossunderUpper,
      rangeEnv: bb2RangeEnv,
      uptrend: bb2Uptrend, downtrend: bb2Downtrend,
      lowBelowBB, highAboveBB,
      rsiOkLong, rsiOkShort,
      bb2LongBase, bb2ShortBase,
      bb2CanEnterLong, bb2CanEnterShort,
    } : undefined,
  };
}

// ================= Strategy 3 – Range Breakout =================

export function strategy3_RangeBreakout(
  candles: Candle[], index: number, indicators: StrategyIndicators, params: ExtendedStocksStrategyParameters
): StrategySignal {
  const rsiIdx = index - (candles.length - indicators.rsi.length);
  const adxIdx = index - (candles.length - indicators.adx.length);
  const volIdx = index - (candles.length - indicators.volumeAvg.length);

  if (rsiIdx < 0 || adxIdx < 0 || volIdx < 0 || index < params.s3_breakout_len + 1) {
    return { buySignal: false, sellSignal: false };
  }

  const currentRSI = indicators.rsi[rsiIdx];
  const currentADX = indicators.adx[adxIdx];
  const currentVolume = candles[index].volume;
  const avgVolume = indicators.volumeAvg[volIdx];
  const close = candles[index].close;
  const prevClose = candles[index - 1].close;

  const highs = indicators.highs;
  const lows  = indicators.lows;

  const rangeHigh = highest(highs, params.s3_breakout_len, index - 1);
  const rangeLow  = lowest(lows,  params.s3_breakout_len, index - 1);

  const adxOk = currentADX >= params.s3_adx_min;
  let volOk = true;
  if (params.s3_use_vol_filter) {
    volOk = currentVolume > avgVolume * params.s3_vol_mult;
  }

  const buySignal = close > rangeHigh && prevClose <= rangeHigh &&
    currentRSI >= params.s3_rsi_long_min && adxOk && volOk;
  const sellSignal = close < rangeLow && prevClose >= rangeLow &&
    currentRSI <= params.s3_rsi_short_max && adxOk && volOk;

  return { buySignal, sellSignal };
}

// ================= Strategy 4 – Inside Bar Breakout =================

export function strategy4_InsideBarBreakout(
  candles: Candle[], index: number, indicators: StrategyIndicators, params: ExtendedStocksStrategyParameters,
  includeDebug: boolean = false
): StrategySignal & { debug?: S4DebugInfo } {
  const rsiIdx = index - (candles.length - indicators.rsi.length);
  const emaIdx = index - (candles.length - indicators.ema50.length);

  if (rsiIdx < 0 || emaIdx < 0 || index < 2) {
    return { buySignal: false, sellSignal: false };
  }

  const currentRSI = indicators.rsi[rsiIdx];
  const currentEMA = indicators.ema50[emaIdx];

  if (isNaN(currentRSI) || (params.s4_use_trend_filter && isNaN(currentEMA))) {
    return { buySignal: false, sellSignal: false };
  }

  const currentClose = candles[index].close;
  const prevClose    = candles[index - 1].close;
  const prevHigh   = candles[index - 1].high;
  const prevLow    = candles[index - 1].low;
  const motherHigh = candles[index - 2].high;
  const motherLow  = candles[index - 2].low;

  const isInsideBar = prevHigh <= motherHigh && prevLow >= motherLow;
  const insideRangePc = isInsideBar ? ((prevHigh - prevLow) / currentClose) * 100 : 0;
  const rangeOk = insideRangePc >= params.s4_min_inside_range_pc;

  let trendOkLong = true;
  let trendOkShort = true;
  if (params.s4_use_trend_filter) {
    trendOkLong  = currentClose > currentEMA;
    trendOkShort = currentClose < currentEMA;
  }

  const breakoutUp   = currentClose > prevHigh && prevClose <= prevHigh;
  const breakoutDown = currentClose < prevLow  && prevClose >= prevLow;

  const buySignal = isInsideBar && rangeOk && breakoutUp && currentRSI >= params.s4_rsi_long_min && trendOkLong;
  const sellSignal = isInsideBar && rangeOk && breakoutDown && currentRSI <= params.s4_rsi_short_max && trendOkShort;

  if (includeDebug) {
    return {
      buySignal, sellSignal,
      debug: {
        isInsideBar, insideRangePc, rangeOk, trendOkLong, trendOkShort,
        breakoutUp, breakoutDown,
        s4LongBase: isInsideBar && rangeOk && breakoutUp && trendOkLong,
        s4ShortBase: isInsideBar && rangeOk && breakoutDown && trendOkShort,
        canEnterLong: buySignal, canEnterShort: sellSignal,
        prevHigh, prevLow, motherHigh, motherLow,
        rsi: currentRSI, ema50: currentEMA,
      }
    };
  }

  return { buySignal, sellSignal };
}

// ================= Strategy 5 – ATR Squeeze Breakout =================

let s5DebugCounter = 0;

export function resetS5DebugCounter() {
  s5DebugCounter = 0;
}

export function strategy5_ATRSqueezeBreakout(
  candles: Candle[], index: number, indicators: StrategyIndicators, params: ExtendedStocksStrategyParameters,
  enableDebugLog: boolean = false
): StrategySignal {
  const rsiIdx = index - (candles.length - indicators.rsi.length);
  const atrIdx = index - (candles.length - indicators.atr.length);
  const volIdx = index - (candles.length - indicators.volumeAvg.length);

  if (rsiIdx < 0 || atrIdx < 0 || volIdx < 0 || index < params.s5_range_len + 1) {
    return { buySignal: false, sellSignal: false };
  }

  const currentRSI    = indicators.rsi[rsiIdx];
  const currentATR    = indicators.atr[atrIdx];
  const avgATR        = indicators.atrAvg[atrIdx];
  const currentVolume = candles[index].volume;
  const avgVolume     = indicators.volumeAvg[volIdx];
  const close         = candles[index].close;
  const prevClose     = candles[index - 1].close;

  const highs = indicators.highs;
  const lows  = indicators.lows;
  const atrs  = indicators.atr;

  const s5AtrMa = atrs.slice(Math.max(0, atrIdx - params.s5_squeeze_len + 1), atrIdx + 1)
    .reduce((a, b) => a + b, 0) / Math.min(params.s5_squeeze_len, atrIdx + 1);

  const threshold = avgATR * params.s5_atr_mult_low;
  const isSqueeze = currentATR < threshold + ATR_EPSILON && s5AtrMa < threshold + ATR_EPSILON;

  const rangeHigh = highest(highs, params.s5_range_len, index - 1);
  const rangeLow  = lowest(lows,  params.s5_range_len, index - 1);

  let volOk = true;
  if (params.s5_use_vol_filter) {
    if (currentVolume === 0 || !avgVolume || avgVolume === 0) volOk = true;
    else volOk = currentVolume > avgVolume * params.s5_vol_mult;
  }

  const breakoutUp = close > rangeHigh && prevClose <= rangeHigh;
  const breakoutDown = close < rangeLow && prevClose >= rangeLow;
  const rsiOkLong = currentRSI >= params.s5_rsi_long_min;
  const rsiOkShort = currentRSI <= params.s5_rsi_short_max;

  const buySignal = isSqueeze && breakoutUp && rsiOkLong && volOk;
  const sellSignal = isSqueeze && breakoutDown && rsiOkShort && volOk;

  return { buySignal, sellSignal };
}
