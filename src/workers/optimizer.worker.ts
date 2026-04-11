/**
 * Web Worker for portfolio optimization
 * Runs backtests in a separate thread to keep UI responsive
 */
import type {
  SymbolData, PeriodSplit, ExtendedStocksOptimizationConfig,
  ExtendedStocksStrategyParameters, ParameterRange,
} from '../lib/optimizer/types';
import { runPortfolioBacktest } from '../lib/optimizer/portfolioSimulator';

// Stored state after init
let storedSymbolsData: SymbolData[] = [];
let storedPeriodSplit: PeriodSplit | null = null;
let storedMode: string = 'single';
let storedSimulationConfig: any = {};
let storedConfig: ExtendedStocksOptimizationConfig | null = null;
let storedBestParamsSoFar: Partial<ExtendedStocksStrategyParameters> = {};
let storedFixedParams: Partial<ExtendedStocksStrategyParameters> = {};
let storedDefaultParams: ExtendedStocksStrategyParameters | null = null;

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

self.onmessage = (e: MessageEvent) => {
  try {
    const msg = e.data;

    if (msg.type === 'init') {
      storedSymbolsData = msg.symbolsData;
      storedPeriodSplit = msg.periodSplit;
      storedMode = msg.mode || 'single';
      storedSimulationConfig = msg.simulationConfig || {};
      storedConfig = msg.config;
      storedBestParamsSoFar = msg.bestParamsSoFar || {};
      storedDefaultParams = msg.defaultParams;

      const total = storedConfig ? countTotalCombinations(storedConfig) : 0;
      self.postMessage({ type: 'init_complete', totalCombinations: total });
      return;
    }

    if (msg.type === 'process') {
      if (!storedConfig || !storedPeriodSplit || !storedDefaultParams) {
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

      // Accumulate results in batches
      const BATCH_SIZE = 50;
      let batch: any[] = [];

      for (const combo of generateCombinations(ranges)) {
        const params = { ...storedDefaultParams, ...fixed, ...storedBestParamsSoFar, ...combo } as ExtendedStocksStrategyParameters;

        const result = runPortfolioBacktest(storedSymbolsData, params, storedPeriodSplit, storedMode, storedSimulationConfig);

        const portfolioResult = {
          mode: storedSymbolsData.length === 1 ? 'single' : 'portfolio',
          trainPeriod: storedPeriodSplit,
          trainResults: result.trainResults,
          testResults: result.testResults,
          totalTrainReturn: result.totalTrainReturn,
          totalTestReturn: result.totalTestReturn,
          overfit: result.totalTrainReturn > 0 ? Math.abs(result.totalTrainReturn - result.totalTestReturn) / result.totalTrainReturn : 0,
          parameters: params,
          monthlyPerformance: result.monthlyPerformance,
          initialCapital: 100_000,
        };

        batch.push(portfolioResult);
        completed++;

        if (result.totalTrainReturn > bestTrainReturn) {
          bestTrainReturn = result.totalTrainReturn;
          bestTestReturn = result.totalTestReturn;
        }

        // Send batch
        if (batch.length >= BATCH_SIZE) {
          self.postMessage({ type: 'results_batch', results: batch });
          batch = [];
        }

        // Send progress
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

      // Flush remaining
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
