import type {
  SymbolData, PeriodSplit, ExtendedStocksOptimizationConfig,
  ExtendedStocksStrategyParameters, MultiObjectiveResult, ObjectiveType,
  ParameterRange, PortfolioOptimizationResult,
} from './types';
import { runPortfolioBacktest } from './portfolioSimulator';
import { createEmptyMultiObjectiveResult, updateMultiObjectiveResult } from './multiObjectiveMetrics';

export interface OptimizationProgressInfo {
  current: number;
  total: number;
  percent: number;
  bestTrainReturn?: number;
  bestTestReturn?: number;
}

const COMBINATION_PRECISION = 1000;
const YIELD_EVERY_N = 20;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const yieldToUI = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function getParameterRanges(config: ExtendedStocksOptimizationConfig): { name: string; range: ParameterRange }[] {
  const ranges: { name: string; range: ParameterRange }[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (value && typeof value === 'object' && 'min' in value && 'max' in value && 'step' in value) {
      const r = value as ParameterRange;
      if (r.min !== r.max) {
        ranges.push({ name: key, range: r });
      }
    }
  }
  return ranges;
}

function getFixedValues(config: ExtendedStocksOptimizationConfig): Partial<ExtendedStocksStrategyParameters> {
  const fixed: any = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'boolean') {
      fixed[key] = value;
    } else if (value && typeof value === 'object' && 'min' in value && 'max' in value) {
      const r = value as ParameterRange;
      if (r.min === r.max) {
        fixed[key] = r.min;
      }
    }
  }
  return fixed;
}

function countRangeValues(range: ParameterRange): number {
  const total = Math.floor((range.max - range.min) / range.step) + 1;
  return Math.max(1, total);
}

export function estimateCombinationCountForConfig(config: ExtendedStocksOptimizationConfig): number {
  const ranges = getParameterRanges(config);
  if (ranges.length === 0) return 1;
  return ranges.reduce((total, { range }) => total * countRangeValues(range), 1);
}

export const DEFAULT_EXTENDED_STOCKS_PARAMETERS: ExtendedStocksStrategyParameters = {
  ma_len: 50, signals_on_close: true,
  stop_distance_percent_long: 14, be_trigger_pct_long: 8, trail_rsi_pct_input_long: 16,
  tp_percent_long: 6, tp_trail_distance_long: 1, rsi_long_entry_min: 47, rsi_trail_long: 66,
  stop_distance_percent_short: 9, be_trigger_pct_short: 27, trail_rsi_pct_input_short: 16,
  tp_percent_short: 1, tp_trail_distance_short: 1, rsi_short_entry_max: 45, rsi_trail_short: 30,
  non_regress_stop: false, prefer_tp_priority: false, close_only_trail: false,
  allow_flip_L2S: true, allow_flip_S2L: true, bars_between_trades: 0,
  avoid_opening_bar: false, block_close_bar: true,
  use_big_bar_filter: true, big_bar_atr_mult: 2, use_dist_filter: true, max_dist_from_ema50_pc: 15,
  cooldown_after_loss_bars: 0,
  use_post_trail_tighten: false, post_trail_tighten_pct: 4,
  use_min_bars_post_trail: false, min_bars_post_trail: 12,
  exit_all_now: false, block_new_entries: false,
  use_vix_range_filter: false, vix_normal_min: 10, vix_normal_max: 30,
  use_vix_exit_long: false, use_vix_exit_short: false,
  use_vix_freeze: true, vix_lookback_bars: 1, vix_spike_pct: 8, vix_freeze_bars: 1,
  use_atr_sl: true, atr_mult_long: 2.8, atr_mult_short: 4,
  enable_strat1: true, enable_rsi_exit: true,
  rsi_exit_long: 65, rsi_exit_short: 48, min_bars_in_trade_exit: 2,
  s1_ema_fast_len: 9, s1_ema_mid_len: 21, s1_ema_trend_len: 50,
  s1_rsi_len: 14, s1_atr_len: 16, s1_atr_ma_len: 12, s1_atr_hi_mult: 0.85,
  s1_adx_len: 11, s1_adx_strong: 18, s1_bb_len: 20, s1_bb_mult: 2.2,
  s1_far_from_bb_pc: 2, s1_vol_len: 16, s1_hi_vol_mult: 1, s1_min_conds: 3,
  enable_strat2: true, bb2_use_trend_filter: true,
  bb2_ma_len: 61, bb2_adx_max: 57, bb2_adx_len: 11,
  bb2_rsi_long_max: 37, bb2_rsi_short_min: 17, bb2_bb_len: 20, bb2_bb_mult: 2.2,
  enable_strat3: true, s3_breakout_len: 14, s3_adx_min: 21,
  s3_use_vol_filter: true, s3_vol_mult: 3, s3_rsi_long_min: 58, s3_rsi_short_max: 42,
  enable_strat4: true, s4_use_trend_filter: false,
  s4_min_inside_range_pc: 0, s4_rsi_long_min: 52, s4_rsi_short_max: 0,
  enable_strat5: true, s5_squeeze_len: 1, s5_atr_mult_low: 1.35,
  s5_range_len: 22, s5_use_vol_filter: true, s5_vol_mult: 1.6,
  s5_rsi_long_min: 56, s5_rsi_short_max: 41,
};

/**
 * Run optimization using a Web Worker (off main thread).
 * Returns a MultiObjectiveResult just like the old function.
 */
export function optimizePortfolioWithWorker(
  symbolsData: SymbolData[],
  config: ExtendedStocksOptimizationConfig,
  periodSplit: PeriodSplit,
  mode: string,
  simulationConfig: any,
  onProgress?: (info: OptimizationProgressInfo) => void,
  abortSignal?: AbortSignal,
  bestParamsSoFar?: Partial<ExtendedStocksStrategyParameters>,
  objective?: ObjectiveType,
  _currentStage?: number,
  _totalStages?: number
): Promise<MultiObjectiveResult> {
  const obj = objective || 'profit';

  return new Promise((resolve, reject) => {
    let multiResult = createEmptyMultiObjectiveResult(obj);

    const worker = new Worker(
      new URL('../../workers/optimizer.worker.ts', import.meta.url),
      { type: 'module' }
    );

    const cleanup = () => {
      worker.terminate();
    };

    // Handle abort
    if (abortSignal) {
      if (abortSignal.aborted) {
        cleanup();
        resolve(multiResult);
        return;
      }
      abortSignal.addEventListener('abort', () => {
        cleanup();
        resolve(multiResult);
      }, { once: true });
    }

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;

      if (msg.type === 'init_complete') {
        // Start processing
        worker.postMessage({ type: 'process' });
        return;
      }

      if (msg.type === 'progress') {
        onProgress?.({
          current: msg.current,
          total: msg.total,
          percent: msg.percent,
          bestTrainReturn: msg.bestTrainReturn,
          bestTestReturn: msg.bestTestReturn,
        });
        return;
      }

      if (msg.type === 'results_batch') {
        // Update multi-objective result with each portfolio result
        for (const result of msg.results) {
          multiResult = updateMultiObjectiveResult(multiResult, result);
        }
        return;
      }

      if (msg.type === 'complete') {
        onProgress?.({
          current: msg.total || 0,
          total: msg.total || 0,
          percent: 100,
          bestTrainReturn: msg.bestTrainReturn,
          bestTestReturn: msg.bestTestReturn,
        });
        cleanup();
        resolve(multiResult);
        return;
      }

      if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.error));
        return;
      }
    };

    worker.onerror = (err) => {
      cleanup();
      reject(new Error(`Worker error: ${err.message}`));
    };

    // Initialize worker
    worker.postMessage({
      type: 'init',
      symbolsData,
      periodSplit,
      mode,
      simulationConfig,
      config,
      bestParamsSoFar: bestParamsSoFar || {},
      defaultParams: DEFAULT_EXTENDED_STOCKS_PARAMETERS,
    });
  });
}
