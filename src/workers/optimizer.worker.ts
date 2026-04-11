/**
 * Web Worker for portfolio optimization
 * Now delegates to optimizePortfolio which uses the full server engine
 */
import type {
  SymbolData, PeriodSplit, ExtendedStocksOptimizationConfig,
  ExtendedStocksStrategyParameters, Candle,
} from '../lib/optimizer/types';
import {
  optimizePortfolio, ProgressInfo, CombinationCache,
} from '../lib/optimizer/portfolioOptimizer';
import { preFilterSymbols } from '../lib/optimizer/portfolioSimulator';
import { IndicatorCacheManager } from '../lib/optimizer/indicatorCache';
import { createEmptyMultiObjectiveResult, updateMultiObjectiveResult } from '../lib/optimizer/multiObjectiveMetrics';

// ---- Stored state ----
let storedConfig: ExtendedStocksOptimizationConfig | null = null;
let storedSymbolsData: SymbolData[] = [];
let storedPeriodSplit: PeriodSplit | null = null;
let storedMode: string = 'single';
let storedSimulationConfig: any = {};
let storedBestParamsSoFar: Partial<ExtendedStocksStrategyParameters> = {};

// ---- Message handler ----
self.onmessage = async (e: MessageEvent) => {
  try {
    const msg = e.data;

    if (msg.type === 'init') {
      storedSymbolsData = msg.symbolsData;
      storedPeriodSplit = {
        trainStartDate: new Date(msg.periodSplit.trainStartDate),
        trainEndDate: new Date(msg.periodSplit.trainEndDate),
        testStartDate: new Date(msg.periodSplit.testStartDate),
        testEndDate: new Date(msg.periodSplit.testEndDate),
        trainPercent: msg.periodSplit.trainPercent,
      };
      storedMode = msg.mode || 'single';
      storedConfig = msg.config;
      storedSimulationConfig = msg.simulationConfig || {};
      storedBestParamsSoFar = msg.bestParamsSoFar || {};

      self.postMessage({ type: 'init_complete', totalCombinations: 0 });
      return;
    }

    if (msg.type === 'process') {
      if (!storedConfig || !storedPeriodSplit) {
        throw new Error('Worker not initialized');
      }

      const indicatorCache = new IndicatorCacheManager();
      const preFiltered = preFilterSymbols(storedSymbolsData, storedPeriodSplit);
      const cache: CombinationCache = new Map();

      let bestTrainReturn = -Infinity;
      let bestTestReturn = -Infinity;

      const result = await optimizePortfolio(
        storedSymbolsData,
        storedConfig,
        storedPeriodSplit,
        storedMode,
        storedSimulationConfig,
        (info: ProgressInfo) => {
          if (info.bestReturn !== undefined && info.bestReturn > bestTrainReturn) {
            bestTrainReturn = info.bestReturn;
            bestTestReturn = info.bestTestReturn ?? bestTestReturn;
          }
          self.postMessage({
            type: 'progress',
            current: info.current,
            total: info.total,
            percent: Math.round((info.current / info.total) * 100),
            bestTrainReturn: info.bestReturn,
            bestTestReturn: info.bestTestReturn,
          });
        },
        undefined, // no abort signal in worker (handled by terminate)
        undefined,
        false,
        'profit',
        cache,
        0, 0,
        preFiltered,
        indicatorCache,
      );

      // Send result
      if (result.bestForProfit) {
        self.postMessage({
          type: 'results_batch',
          results: [result.bestForProfit],
        });
      }

      self.postMessage({
        type: 'complete',
        bestTrainReturn,
        bestTestReturn,
        total: cache.size,
      });
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
