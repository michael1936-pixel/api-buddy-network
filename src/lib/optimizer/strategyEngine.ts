import type { Candle, ExtendedStocksStrategyParameters } from './types';
import { highest, lowest } from './indicators';
import {
  StrategyIndicators, S2DebugInfo,
  strategy1_EMATrend, strategy2_BollingerMeanReversion,
  strategy3_RangeBreakout, strategy4_InsideBarBreakout, strategy5_ATRSqueezeBreakout,
} from './strategies';

export interface EngineState {
  position: number;
  lastEntryBarIndex: number | null;
  barIndex: number;
  currentATR: number;
  currentEmaTrend: number;
}

export interface EngineLookbacks {
  s1MinLookback: number;
  s2MinLookback: number;
  s3MinLookback: number;
  s4MinLookback: number;
  s5MinLookback: number;
}

export interface EngineResult {
  buyS1: boolean; sellS1: boolean;
  buyS2: boolean; sellS2: boolean;
  buyS3: boolean; sellS3: boolean;
  buyS4: boolean; sellS4: boolean;
  buyS5: boolean; sellS5: boolean;
  s5RawBuy: boolean; s5RawSell: boolean;
  buyFinal: boolean;
  sellFinal: boolean;
  entryStrategyId: number;
  barOk: boolean;
  distFromEmaOk: boolean;
  s2Debug?: S2DebugInfo;
  s2Layers?: { shortBase: boolean; longBase: boolean; canEnterShort: boolean; canEnterLong: boolean; };
  layer3: {
    position: number; isFlat: boolean; spacingOk: boolean;
    canFlipToLong: boolean; canFlipToShort: boolean;
    tradeTimeOk: boolean; vixFreezeLeft: number; vixAboveRange: boolean;
    barOk: boolean; distFromEmaOk: boolean; simOk: boolean;
    barsSinceLastEntry: number; minBarsSpacing: number;
  };
}

/**
 * Pre-compute Jerusalem-time session minutes for all candles (call once per candle set).
 * Replaces the expensive toLocaleString call that was in the hot loop.
 */
export function precomputeSessionMinutes(candles: Candle[]): Int16Array {
  const result = new Int16Array(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const tsMs = candles[i].timestamp;
    // Use manual UTC offset for Asia/Jerusalem (UTC+2 or UTC+3)
    // Determine DST: Israel DST is roughly last Friday before April 2 → last Sunday before October 31
    const d = new Date(tsMs);
    const month = d.getUTCMonth(); // 0-based
    // Simplified: March-October = UTC+3 (summer), Nov-Feb = UTC+2 (winter)
    const offsetHours = (month >= 2 && month <= 9) ? 3 : 2;
    const localMs = tsMs + offsetHours * 3600000;
    const localDate = new Date(localMs);
    result[i] = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();
  }
  return result;
}

export function evaluateAllSignals(
  candles: Candle[], i: number, indicators: StrategyIndicators,
  params: ExtendedStocksStrategyParameters, state: EngineState, lookbacks: EngineLookbacks,
  sessionMinutes?: Int16Array
): EngineResult {
  const { position, lastEntryBarIndex, currentATR, currentEmaTrend } = state;
  const currentCandle = candles[i];
  const currentClose = candles[i].close;
  const currentHigh = candles[i].high;
  const currentLow = candles[i].low;

  const barsSinceLastEntry = lastEntryBarIndex === null ? Infinity : i - lastEntryBarIndex;
  const minBarsSpacing = params.bars_between_trades;
  const spacingOk = barsSinceLastEntry >= minBarsSpacing;
  const isFlat = position === 0;
  const canFlipToLong = params.allow_flip_S2L && position === -1;
  const canFlipToShort = params.allow_flip_L2S && position === 1;

  let barOk = true;
  if (currentATR > 0 && params.use_big_bar_filter) {
    const barRange = currentHigh - currentLow;
    barOk = !(barRange > currentATR * params.big_bar_atr_mult);
  }

  let distFromEmaOk = true;
  if (params.use_dist_filter && currentEmaTrend > 0 && !isNaN(currentEmaTrend)) {
    const distFromEmaPct = Math.abs((currentClose - currentEmaTrend) / currentEmaTrend) * 100;
    if (distFromEmaPct > params.max_dist_from_ema50_pc) distFromEmaOk = false;
  }

  const simulationStartTimestamp = params.simulationStartDate?.getTime() ?? 0;
  const simOk = currentCandle.timestamp >= simulationStartTimestamp;
  const active = true;
  const vixFreezeLeft = 0;
  const vixAboveRange = false;

  let totalMinJerusalem: number;
  if (sessionMinutes) {
    totalMinJerusalem = sessionMinutes[i];
  } else {
    // Fallback for non-optimized calls
    const tsMs = currentCandle.timestamp;
    const dateObj = new Date(tsMs);
    const jerusalemStr = dateObj.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', hour12: false });
    const timeParts = jerusalemStr.split(', ')[1]?.split(':') ?? [];
    const jHour = parseInt(timeParts[0] ?? '0', 10);
    const jMin = parseInt(timeParts[1] ?? '0', 10);
    totalMinJerusalem = jHour * 60 + jMin;
  }
  const SESSION_START_MIN = 15 * 60 + 30;
  const SESSION_END_MIN = 23 * 60;
  const inSession = totalMinJerusalem >= SESSION_START_MIN && totalMinJerusalem < SESSION_END_MIN;
  const sessionHalfHourIndex = inSession ? Math.floor((totalMinJerusalem - SESSION_START_MIN) / 30) : -1;
  const isOpenBar = sessionHalfHourIndex === 0;
  const tradeTimeOk = inSession && (!params.avoid_opening_bar || !isOpenBar);

  let buyS1 = false, sellS1 = false;
  let buyS2 = false, sellS2 = false;
  let buyS3 = false, sellS3 = false;
  let buyS4 = false, sellS4 = false;
  let buyS5 = false, sellS5 = false;

  const canRunS1 = params.enable_strat1 && i >= lookbacks.s1MinLookback;
  if (canRunS1) {
    const s1 = strategy1_EMATrend(candles, i, indicators, params);
    buyS1 = simOk && active && s1.buySignal && barOk && distFromEmaOk &&
      vixFreezeLeft === 0 && !vixAboveRange && position !== 1 && tradeTimeOk &&
      ((isFlat && spacingOk) || canFlipToLong);
    sellS1 = simOk && active && s1.sellSignal && barOk && distFromEmaOk &&
      vixFreezeLeft === 0 && !vixAboveRange && position !== -1 && tradeTimeOk &&
      ((isFlat && spacingOk) || canFlipToShort);
  }

  const canRunS2 = params.enable_strat2 && i >= lookbacks.s2MinLookback;
  let s2: ReturnType<typeof strategy2_BollingerMeanReversion> = { buySignal: false, sellSignal: false, bb2ShortBase: false, bb2LongBase: false, bb2CanEnterShort: false, bb2CanEnterLong: false };
  if (canRunS2) {
    s2 = strategy2_BollingerMeanReversion(candles, i, indicators, params);
    buyS2 = simOk && active && s2.buySignal && barOk && distFromEmaOk &&
      vixFreezeLeft === 0 && !vixAboveRange && position !== 1 && tradeTimeOk &&
      ((isFlat && spacingOk) || canFlipToLong);
    sellS2 = simOk && active && s2.sellSignal && barOk && distFromEmaOk &&
      vixFreezeLeft === 0 && !vixAboveRange && position !== -1 && tradeTimeOk &&
      ((isFlat && spacingOk) || canFlipToShort);
  }

  const canRunS3 = params.enable_strat3 && i >= lookbacks.s3MinLookback;
  if (canRunS3) {
    const s3 = strategy3_RangeBreakout(candles, i, indicators, params);
    buyS3 = simOk && active && s3.buySignal && vixFreezeLeft === 0 && !vixAboveRange &&
      position !== 1 && tradeTimeOk && ((isFlat && spacingOk) || canFlipToLong);
    sellS3 = simOk && active && s3.sellSignal && vixFreezeLeft === 0 && !vixAboveRange &&
      position !== -1 && tradeTimeOk && ((isFlat && spacingOk) || canFlipToShort);
  }

  const canRunS4 = params.enable_strat4 && i >= lookbacks.s4MinLookback;
  if (canRunS4) {
    const s4 = strategy4_InsideBarBreakout(candles, i, indicators, params);
    buyS4 = simOk && active && s4.buySignal && vixFreezeLeft === 0 && !vixAboveRange &&
      position !== 1 && tradeTimeOk && ((isFlat && spacingOk) || canFlipToLong);
    sellS4 = simOk && active && s4.sellSignal && vixFreezeLeft === 0 && !vixAboveRange &&
      position !== -1 && tradeTimeOk && ((isFlat && spacingOk) || canFlipToShort);
  }

  let s5RawBuy = false, s5RawSell = false;
  const canRunS5 = params.enable_strat5 && i >= lookbacks.s5MinLookback;
  if (canRunS5) {
    const s5 = strategy5_ATRSqueezeBreakout(candles, i, indicators, params);
    s5RawBuy = s5.buySignal;
    s5RawSell = s5.sellSignal;
    buyS5 = simOk && active && s5.buySignal && vixFreezeLeft === 0 && !vixAboveRange &&
      position !== 1 && tradeTimeOk && ((isFlat && spacingOk) || canFlipToLong);
    sellS5 = simOk && active && s5.sellSignal && vixFreezeLeft === 0 && !vixAboveRange &&
      position !== -1 && tradeTimeOk && ((isFlat && spacingOk) || canFlipToShort);
  }

  if (!barOk || !distFromEmaOk) {
    buyS1 = buyS2 = buyS3 = buyS4 = buyS5 = false;
    sellS1 = sellS2 = sellS3 = sellS4 = sellS5 = false;
  }

  let buyFinal = buyS1 || buyS2 || buyS3 || buyS4 || buyS5;
  let sellFinal = sellS1 || sellS2 || sellS3 || sellS4 || sellS5;
  if (buyFinal && sellFinal) sellFinal = false;

  let entryStrategyId = 0;
  if (buyFinal) entryStrategyId = buyS1 ? 1 : (buyS2 ? 2 : (buyS3 ? 3 : (buyS4 ? 4 : (buyS5 ? 5 : 0))));
  else if (sellFinal) entryStrategyId = sellS1 ? 1 : (sellS2 ? 2 : (sellS3 ? 3 : (sellS4 ? 4 : (sellS5 ? 5 : 0))));

  return {
    buyS1, sellS1, buyS2, sellS2, buyS3, sellS3, buyS4, sellS4, buyS5, sellS5,
    s5RawBuy, s5RawSell, buyFinal, sellFinal, entryStrategyId,
    barOk, distFromEmaOk,
    s2Debug: s2.debug,
    s2Layers: canRunS2 ? { shortBase: s2.bb2ShortBase, longBase: s2.bb2LongBase, canEnterShort: s2.bb2CanEnterShort, canEnterLong: s2.bb2CanEnterLong } : undefined,
    layer3: { position, isFlat, spacingOk, canFlipToLong, canFlipToShort, tradeTimeOk, vixFreezeLeft, vixAboveRange, barOk, distFromEmaOk, simOk, barsSinceLastEntry, minBarsSpacing },
  };
}
