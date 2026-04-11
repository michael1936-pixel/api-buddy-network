/**
 * Web Worker for portfolio optimization
 * Runs backtests in a separate thread to keep UI responsive
 * Uses indicator caching and pre-filtered candles for performance
 */
import type {
  SymbolData, PeriodSplit, ExtendedStocksOptimizationConfig,
  ExtendedStocksStrategyParameters, ParameterRange, Candle,
  PortfolioBacktestResult, MonthlyPerformance,
} from '../lib/optimizer/types';
import { StrategyIndicators } from '../lib/optimizer/strategies';
import { buildIndicators, runSingleBacktestWithIndicators, calculateMonthlyPerformance } from '../lib/optimizer/portfolioSimulator';
import { precomputeSessionMinutes } from '../lib/optimizer/strategyEngine';

const INITIAL_CAPITAL = 100_000;

// ---- Indicator param keys that affect buildIndicators ----
const INDICATOR_PARAM_KEYS = [
  's1_rsi_len', 's1_ema_fast_len', 's1_ema_mid_len', 's1_ema_trend_len',
  's1_atr_len', 's1_atr_ma_len', 's1_adx_len', 's1_bb_len', 's1_bb_mult', 's1_vol_len',
  'bb2_adx_len', 'bb2_bb_len', 'bb2_bb_mult', 'bb2_ma_len',
] as const;

function indicatorHash(params: ExtendedStocksStrategyParameters): string {
  return INDICATOR_PARAM_KEYS.map(k => (params as any)[k]).join(',');
}

// ---- Stored state after init ----
let storedConfig: ExtendedStocksOptimizationConfig | null = null;
let storedBestParamsSoFar: Partial<ExtendedStocksStrategyParameters> = {};
let storedDefaultParams: ExtendedStocksStrategyParameters | null = null;
let storedMode: string = 'single';

// Pre-filtered candles per symbol (computed once in init)
interface PreFilteredSymbol {
  symbol: string;
  trainCandles: Candle[];
  testCandles: Candle[];
  trainSessionMinutes: Int16Array;
  testSessionMinutes: Int16Array;
}
let prefilteredSymbols: PreFilteredSymbol[] = [];

// Indicator cache: hash -> { trainIndicators, testIndicators } per symbol
const indicatorCache = new Map<string, { train: StrategyIndicators; test: StrategyIndicators }[]>();

// ---- Parameter range helpers ----
function getParameterRanges(config: ExtendedStocksOptimizationConfig): { name: string; range: ParameterRange }[] {
  const ranges: { name: string; range: ParameterRange }[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (value && typeof value === 'object' && 'min' in value && 'max' in value && 'step' in value) {
      const r = value as ParameterRange;
      if (r.min !== r.max) ranges.push({ name: key, range: r });
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
      if (r.min === r.max) fixed[key] = r.min;
    }
  }
  return fixed;
}

function countRangeValues(range: ParameterRange): number {
  return Math.max(1, Math.floor((range.max - range.min) / range.step) + 1);
}

function countTotalCombinations(config: ExtendedStocksOptimizationConfig): number {
  const ranges = getParameterRanges(config);
  if (ranges.length === 0) return 1;
  return ranges.reduce((total, { range }) => total * countRangeValues(range), 1);
}

function* generateCombinations(
  ranges: { name: string; range: ParameterRange }[]
): Generator<Record<string, number>> {
  if (ranges.length === 0) { yield {}; return; }
  const indices = new Array(ranges.length).fill(0);
  const sizes = ranges.map(r => countRangeValues(r.range));
  while (true) {
    const combo: Record<string, number> = {};
    for (let i = 0; i < ranges.length; i++) {
      combo[ranges[i].name] = Math.round((ranges[i].range.min + indices[i] * ranges[i].range.step) * 1000) / 1000;
    }
    yield combo;
    let pos = ranges.length - 1;
    while (pos >= 0) {
      indices[pos]++;
      if (indices[pos] < sizes[pos]) break;
      indices[pos] = 0;
      pos--;
    }
    if (pos < 0) break;
  }
}

// ---- Cached backtest: reuses indicators when indicator params unchanged ----
function runCachedPortfolioBacktest(
  params: ExtendedStocksStrategyParameters
): { totalTrainReturn: number; totalTestReturn: number; trainResults: PortfolioBacktestResult[]; testResults: PortfolioBacktestResult[]; monthlyPerformance: MonthlyPerformance[] } {
  const hash = indicatorHash(params);
  let cachedIndicators = indicatorCache.get(hash);

  if (!cachedIndicators) {
    // Compute indicators for all symbols
    cachedIndicators = prefilteredSymbols.map(pf => ({
      train: buildIndicators(pf.trainCandles, params),
      test: buildIndicators(pf.testCandles, params),
    }));
    indicatorCache.set(hash, cachedIndicators);
  }

  const trainResults: PortfolioBacktestResult[] = [];
  const testResults: PortfolioBacktestResult[] = [];

  for (let i = 0; i < prefilteredSymbols.length; i++) {
    const pf = prefilteredSymbols[i];
    const ci = cachedIndicators[i];

    const trainResult = runSingleBacktestWithIndicators(pf.trainCandles, params, ci.train, pf.trainSessionMinutes);
    const testResult = runSingleBacktestWithIndicators(pf.testCandles, params, ci.test, pf.testSessionMinutes);

    trainResults.push({ symbol: pf.symbol, result: trainResult, capitalAllocated: INITIAL_CAPITAL, contributionToTotal: trainResult.totalReturn });
    testResults.push({ symbol: pf.symbol, result: testResult, capitalAllocated: INITIAL_CAPITAL, contributionToTotal: testResult.totalReturn });
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

// ---- Message handler ----
self.onmessage = (e: MessageEvent) => {
  try {
    const msg = e.data;

    if (msg.type === 'init') {
      const symbolsData: SymbolData[] = msg.symbolsData;
      const periodSplit: PeriodSplit = msg.periodSplit;
      storedMode = msg.mode || 'single';
      storedConfig = msg.config;
      storedBestParamsSoFar = msg.bestParamsSoFar || {};
      storedDefaultParams = msg.defaultParams;

      // Pre-filter candles once (the big optimization #1)
      const trainStart = new Date(periodSplit.trainStartDate).getTime();
      const trainEnd = new Date(periodSplit.trainEndDate).getTime();
      const testStart = new Date(periodSplit.testStartDate).getTime();
      const testEnd = new Date(periodSplit.testEndDate).getTime();

      prefilteredSymbols = symbolsData.map(sd => {
        const trainCandles: Candle[] = [];
        const testCandles: Candle[] = [];
        for (const c of sd.candles) {
          const t = typeof c.timestamp === 'number' ? c.timestamp : new Date(c.timestamp).getTime();
          if (t >= trainStart && t <= trainEnd) trainCandles.push(c);
          if (t >= testStart && t <= testEnd) testCandles.push(c);
        }
        const trainSessionMinutes = precomputeSessionMinutes(trainCandles);
        const testSessionMinutes = precomputeSessionMinutes(testCandles);
        return { symbol: sd.symbol, trainCandles, testCandles, trainSessionMinutes, testSessionMinutes };
      });

      // Clear indicator cache for new run
      indicatorCache.clear();

      const total = storedConfig ? countTotalCombinations(storedConfig) : 0;
      self.postMessage({ type: 'init_complete', totalCombinations: total });
      return;
    }

    if (msg.type === 'process') {
      if (!storedConfig || !storedDefaultParams) {
        throw new Error('Worker not initialized');
      }

      const ranges = getParameterRanges(storedConfig);
      const fixed = getFixedValues(storedConfig);
      const total = countTotalCombinations(storedConfig);
      const PROGRESS_INTERVAL = Math.max(5, Math.floor(total / 120));

      let completed = 0;
      let lastProgressSent = 0;
      let lastProgressTime = Date.now();
      let bestTrainReturn = -Infinity;
      let bestTestReturn = -Infinity;

      const BATCH_SIZE = 50;
      let batch: any[] = [];

      for (const combo of generateCombinations(ranges)) {
        const params = { ...storedDefaultParams, ...fixed, ...storedBestParamsSoFar, ...combo } as ExtendedStocksStrategyParameters;

        const result = runCachedPortfolioBacktest(params);

        // Strip heavy data (trades, monthly) to reduce postMessage serialization
        const slimTrainResults = result.trainResults.map(r => ({
          symbol: r.symbol, capitalAllocated: r.capitalAllocated, contributionToTotal: r.contributionToTotal,
          result: { ...r.result, trades: [] },
        }));
        const slimTestResults = result.testResults.map(r => ({
          symbol: r.symbol, capitalAllocated: r.capitalAllocated, contributionToTotal: r.contributionToTotal,
          result: { ...r.result, trades: [] },
        }));

        const portfolioResult = {
          mode: prefilteredSymbols.length === 1 ? 'single' : 'portfolio',
          trainResults: slimTrainResults,
          testResults: slimTestResults,
          totalTrainReturn: result.totalTrainReturn,
          totalTestReturn: result.totalTestReturn,
          overfit: result.totalTrainReturn > 0 ? Math.abs(result.totalTrainReturn - result.totalTestReturn) / result.totalTrainReturn : 0,
          parameters: params,
          monthlyPerformance: [],
          initialCapital: INITIAL_CAPITAL,
        };

        batch.push(portfolioResult);
        completed++;

        if (result.totalTrainReturn > bestTrainReturn) {
          bestTrainReturn = result.totalTrainReturn;
          bestTestReturn = result.totalTestReturn;
        }

        if (batch.length >= BATCH_SIZE) {
          self.postMessage({ type: 'results_batch', results: batch });
          batch = [];
        }

        const now = Date.now();
        if (completed - lastProgressSent >= PROGRESS_INTERVAL || now - lastProgressTime >= 500 || completed === total) {
          self.postMessage({
            type: 'progress',
            current: completed,
            total,
            percent: Math.round((completed / total) * 100),
            bestTrainReturn,
            bestTestReturn,
          });
          lastProgressSent = completed;
          lastProgressTime = now;
        }
      }

      if (batch.length > 0) {
        self.postMessage({ type: 'results_batch', results: batch });
      }

      self.postMessage({ type: 'complete', bestTrainReturn, bestTestReturn });
      return;
    }
  } catch (error) {
    console.error('🔴 [Worker] Error:', error);
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
