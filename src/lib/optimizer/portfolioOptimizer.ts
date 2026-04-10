import type {
  SymbolData,
  PeriodSplit,
  ExtendedStocksOptimizationConfig,
  ExtendedStocksStrategyParameters,
  MultiObjectiveResult,
  ObjectiveType,
} from './types';
import { createEmptyMultiObjectiveResult } from './multiObjectiveMetrics';

export interface OptimizationProgressInfo {
  current: number;
  total: number;
  percent: number;
  bestTrainReturn?: number;
  bestTestReturn?: number;
}

export async function optimizePortfolioWithWorker(
  _symbolsData: SymbolData[],
  _config: ExtendedStocksOptimizationConfig,
  _periodSplit: PeriodSplit,
  _mode: string,
  _simulationConfig: any,
  _onProgress?: (info: OptimizationProgressInfo) => void,
  _abortSignal?: AbortSignal,
  _bestParamsSoFar?: Partial<ExtendedStocksStrategyParameters>,
  _objective?: ObjectiveType,
  _currentStage?: number,
  _totalStages?: number
): Promise<MultiObjectiveResult> {
  console.warn('optimizePortfolioWithWorker: Web Worker not yet implemented — running placeholder');
  return createEmptyMultiObjectiveResult(_objective || 'profit');
}
