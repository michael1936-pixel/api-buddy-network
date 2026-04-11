import {
  SymbolData,
  PeriodSplit,
  ExtendedStocksOptimizationConfig,
  ExtendedStocksStrategyParameters,
  MultiObjectiveResult,
  ObjectiveType,
  ParameterRange
} from './types';
import {
  optimizePortfolioWithWorker,
  OptimizationProgressInfo,
  DEFAULT_EXTENDED_STOCKS_PARAMETERS,
  estimateCombinationCountForConfig,
} from './portfolioOptimizer';
import { createEmptyMultiObjectiveResult, updateMultiObjectiveResult } from './multiObjectiveMetrics';

export interface OptimizationStage {
  name: string;
  description: string;
  parameters: string[];
  round: number;
  stageNumber: number;
}

export interface StageResult {
  stageNumber: number;
  stageName: string;
  bestParameters: Partial<ExtendedStocksStrategyParameters>;
  bestReturn: number;
  bestTestReturn: number;
  elapsedTime: number;
  combinationsCount: number;
  trainResults?: any[];
  testResults?: any[];
}

export interface StageStatus {
  stageNumber: number;
  stageName: string;
  status: 'pending' | 'running' | 'completed' | 'skipped';
  startTime?: number;
  endTime?: number;
  elapsedTime?: number;
  skipReason?: string;
}

export interface SmartOptimizationProgress extends OptimizationProgressInfo {
  stageName: string;
  stageDescription: string;
  currentStage: number;
  totalStages: number;
}

export interface SmartOptimizationResult {
  finalResult: MultiObjectiveResult;
  stageResults: StageResult[];
  wasStopped?: boolean;
  wasPartiallySkipped?: boolean;
}

export interface SavedState {
  currentStage: number;
  totalStages: number;
  bestParametersSoFar: Partial<ExtendedStocksStrategyParameters>;
  stageResults: StageResult[];
  globalBestTrainReturn: number;
  globalBestTestReturn: number;
  completedCombinations: number;
  totalCombinations: number;
  stageStatuses: StageStatus[];
  skippedStages: number[];
  timeSavedBySkips: number;
}

const STAGE_TEMPLATES = [
  {
    name: 'ניהול עסקת לונג',
    description: 'אופטימיזציה של סטופ, Break-Even ו-Trailing לפוזיציות לונג',
    parameters: ['stop_distance_percent_long', 'be_trigger_pct_long', 'trail_rsi_pct_input_long', 'tp_percent_long', 'tp_trail_distance_long']
  },
  {
    name: 'ניהול עסקת שורט',
    description: 'אופטימיזציה של סטופ, Break-Even ו-Trailing לפוזיציות שורט',
    parameters: ['stop_distance_percent_short', 'be_trigger_pct_short', 'trail_rsi_pct_input_short', 'tp_percent_short', 'tp_trail_distance_short']
  },
  {
    name: 'אסטרטגיה 1 - EMA Trend',
    description: 'אופטימיזציה של פרמטרי EMA Trend',
    parameters: ['s1_ema_fast_len', 's1_ema_mid_len', 's1_rsi_len', 's1_atr_len', 's1_adx_len', 's1_min_conds']
  },
  {
    name: 'אסטרטגיה 2 - בולינגר',
    description: 'אופטימיזציה של פרמטרי Bollinger Mean Reversion',
    parameters: ['bb2_ma_len', 'bb2_adx_max', 'bb2_rsi_long_max', 'bb2_rsi_short_min']
  },
  {
    name: 'אסטרטגיה 3 - פריצה',
    description: 'אופטימיזציה של פרמטרי Range Breakout',
    parameters: ['s3_breakout_len', 's3_adx_min', 's3_vol_mult', 's3_rsi_long_min', 's3_rsi_short_max']
  },
  {
    name: 'אסטרטגיה 4 - Inside Bar',
    description: 'אופטימיזציה של פרמטרי Inside Bar Breakout',
    parameters: ['s4_min_inside_range_pc', 's4_rsi_long_min', 's4_rsi_short_max']
  },
  {
    name: 'אסטרטגיה 5 - ATR Squeeze',
    description: 'אופטימיזציה של פרמטרי ATR Squeeze Breakout',
    parameters: ['s5_squeeze_len', 's5_atr_mult_low', 's5_range_len', 's5_vol_mult', 's5_rsi_long_min', 's5_rsi_short_max']
  }
];

function generateOptimizationStages(): OptimizationStage[] {
  const stages: OptimizationStage[] = [];
  
  STAGE_TEMPLATES.forEach((template, idx) => {
    stages.push({ ...template, round: 1, stageNumber: idx + 1 });
  });
  
  STAGE_TEMPLATES.forEach((template, idx) => {
    stages.push({ ...template, description: `דיוק: ${template.description}`, round: 2, stageNumber: 7 + idx + 1 });
  });
  
  STAGE_TEMPLATES.forEach((template, idx) => {
    stages.push({ ...template, description: `מיקרו: ${template.description}`, round: 3, stageNumber: 14 + idx + 1 });
  });
  
  return stages;
}

const OPTIMIZATION_STAGES: OptimizationStage[] = generateOptimizationStages();

function isParameterRange(value: unknown): value is ParameterRange {
  return !!value && typeof value === 'object' && 'min' in value && 'max' in value && 'step' in value;
}

function clampToRange(value: number, range: ParameterRange): number {
  return Math.min(range.max, Math.max(range.min, Math.round(value * 1000) / 1000));
}

function getAnchorParameterValue(
  param: keyof ExtendedStocksStrategyParameters,
  range: ParameterRange,
  bestParams: Partial<ExtendedStocksStrategyParameters>
): number {
  const bestValue = bestParams[param];
  if (typeof bestValue === 'number') {
    return clampToRange(bestValue, range);
  }

  const defaultValue = DEFAULT_EXTENDED_STOCKS_PARAMETERS[param];
  if (typeof defaultValue === 'number') {
    return clampToRange(defaultValue, range);
  }

  return clampToRange(range.min, range);
}

function createFocusedRange(anchor: number, range: ParameterRange, radiusInSteps: number): ParameterRange {
  const min = Math.max(range.min, anchor - radiusInSteps * range.step);
  const max = Math.min(range.max, anchor + radiusInSteps * range.step);
  return {
    min: clampToRange(min, range),
    max: clampToRange(max, range),
    step: range.step,
  };
}

function createStageConfig(
  baseConfig: ExtendedStocksOptimizationConfig,
  stage: OptimizationStage,
  bestParams: Partial<ExtendedStocksStrategyParameters>,
  round: number,
  stepMultiplier: number = 1,
  round2Range: number = 1
): ExtendedStocksOptimizationConfig {
  const stageConfig = { ...baseConfig } as ExtendedStocksOptimizationConfig;
  const activeStageParameters = new Set(stage.parameters);

  Object.entries(baseConfig).forEach(([key, value]) => {
    if (!isParameterRange(value)) return;

    const fixedValue = getAnchorParameterValue(
      key as keyof ExtendedStocksStrategyParameters,
      value,
      bestParams,
    );

    (stageConfig as any)[key] = {
      min: fixedValue,
      max: fixedValue,
      step: value.step,
    };
  });

  stage.parameters.forEach(param => {
    const originalRange = baseConfig[param as keyof ExtendedStocksOptimizationConfig];
    if (!activeStageParameters.has(param) || !isParameterRange(originalRange)) return;

    const range = originalRange as ParameterRange;
    const anchorValue = getAnchorParameterValue(
      param as keyof ExtendedStocksStrategyParameters,
      range,
      bestParams,
    );

    if (round === 1) {
      const effectiveStep = stepMultiplier > 1 ? range.step * stepMultiplier : range.step;
      (stageConfig as any)[param] = { min: range.min, max: range.max, step: effectiveStep };
    } else if (round === 2) {
      (stageConfig as any)[param] = createFocusedRange(anchorValue, range, round2Range);
    } else if (round === 3) {
      (stageConfig as any)[param] = createFocusedRange(anchorValue, range, 1);
    }
  });

  return stageConfig;
}

export type SkipStageCallback = () => void;

export async function runSmartOptimization(
  symbolsData: SymbolData[],
  config: ExtendedStocksOptimizationConfig,
  periodSplit: PeriodSplit,
  mode: string,
  simulationConfig: any,
  onProgress?: (info: SmartOptimizationProgress) => void,
  abortSignal?: AbortSignal,
  useMemory: boolean = false,
  objective: ObjectiveType = 'profit',
  enableRound2: boolean = true,
  enableRound3: boolean = true,
  enabledStages?: boolean[],
  onSkipStageCallback?: (callback: SkipStageCallback) => void,
  onSaveState?: (state: SavedState) => Promise<void>,
  savedState?: SavedState,
  stepMultiplier: number = 1,
  round2Range: number = 1
): Promise<SmartOptimizationResult> {
  console.log('🚀 [SmartOptimizer] Starting smart optimization...');

  let dynamicStages = OPTIMIZATION_STAGES.filter(stage => {
    if (stage.round === 1) return true;
    if (stage.round === 2) return enableRound2;
    if (stage.round === 3) return enableRound3;
    return false;
  });

  let bestParametersSoFar: Partial<ExtendedStocksStrategyParameters> = savedState?.bestParametersSoFar || {};
  let stageResults: StageResult[] = savedState?.stageResults || [];
  let globalBestTrainReturn = savedState?.globalBestTrainReturn || -Infinity;
  let globalBestTestReturn = savedState?.globalBestTestReturn || -Infinity;
  let globalMultiObjectiveResult = createEmptyMultiObjectiveResult(objective);
  let completedCombinations = savedState?.completedCombinations || 0;
  let totalCombinations = savedState?.totalCombinations || 0;

  let stageStatuses: StageStatus[] = savedState?.stageStatuses || dynamicStages.map((stage) => ({
    stageNumber: stage.stageNumber,
    stageName: stage.name,
    status: 'pending' as const
  }));

  let skippedStages: number[] = savedState?.skippedStages || [];
  let timeSavedBySkips = savedState?.timeSavedBySkips || 0;
  let hasSkippedAnyStage = skippedStages.length > 0;

  const startStageIndex = savedState?.currentStage || 0;

  for (let stageIndex = startStageIndex; stageIndex < dynamicStages.length; stageIndex++) {
    if (enabledStages && enabledStages.length > stageIndex && !enabledStages[stageIndex]) {
      stageStatuses[stageIndex].status = 'skipped';
      stageStatuses[stageIndex].skipReason = 'הושבת על ידי המשתמש';
      skippedStages.push(stageIndex);
      hasSkippedAnyStage = true;
      continue;
    }

    if (abortSignal?.aborted) {
      return { finalResult: globalMultiObjectiveResult, stageResults, wasStopped: true, wasPartiallySkipped: hasSkippedAnyStage };
    }

    const stage = dynamicStages[stageIndex];
    const stageStartTime = Date.now();

    console.log(`🔵 [SmartOptimizer] Stage ${stageIndex + 1}/${dynamicStages.length}: ${stage.name}`);

    stageStatuses[stageIndex].status = 'running';
    stageStatuses[stageIndex].startTime = stageStartTime;

    const stageConfig = createStageConfig(config, stage, bestParametersSoFar, stage.round, stepMultiplier, round2Range);
    const stageCombinationCount = estimateCombinationCountForConfig(stageConfig);
    let latestStageProgress: OptimizationProgressInfo = {
      current: 0,
      total: stageCombinationCount,
      percent: 0,
      bestTrainReturn: Number.isFinite(globalBestTrainReturn) ? globalBestTrainReturn : undefined,
      bestTestReturn: Number.isFinite(globalBestTestReturn) ? globalBestTestReturn : undefined,
    };

    totalCombinations = Math.max(totalCombinations, completedCombinations + stageCombinationCount);

    try {
      const stageResult = await optimizePortfolioWithWorker(
        symbolsData, stageConfig, periodSplit, mode, simulationConfig,
        (info) => {
          latestStageProgress = info;

          if (onProgress) {
            onProgress({
              ...info,
              stageName: stage.name,
              stageDescription: stage.description,
              currentStage: stageIndex + 1,
              totalStages: dynamicStages.length
            });
          }
        },
        abortSignal, bestParametersSoFar, objective, stageIndex + 1, dynamicStages.length
      );

      if (stageResult.bestForProfit) {
        const bestResult = stageResult.bestForProfit;
        
        if (bestResult.parameters) {
          stage.parameters.forEach(param => {
            const value = bestResult.parameters[param as keyof ExtendedStocksStrategyParameters];
            if (value !== undefined) {
              (bestParametersSoFar as any)[param] = value;
            }
          });
        }

        if (bestResult.totalTrainReturn > globalBestTrainReturn) {
          globalBestTrainReturn = bestResult.totalTrainReturn;
          globalBestTestReturn = bestResult.totalTestReturn;
        }

        globalMultiObjectiveResult = updateMultiObjectiveResult(globalMultiObjectiveResult, bestResult);

        const stageElapsed = (Date.now() - stageStartTime) / 1000;
        completedCombinations += latestStageProgress.total;
        totalCombinations = Math.max(totalCombinations, completedCombinations);

        stageResults.push({
          stageNumber: stageIndex + 1,
          stageName: stage.name,
          bestParameters: { ...bestParametersSoFar },
          bestReturn: bestResult.totalTrainReturn,
          bestTestReturn: bestResult.totalTestReturn,
          elapsedTime: stageElapsed,
          combinationsCount: latestStageProgress.total,
          trainResults: bestResult.trainResults,
          testResults: bestResult.testResults
        });

        stageStatuses[stageIndex].status = 'completed';
        stageStatuses[stageIndex].endTime = Date.now();
        stageStatuses[stageIndex].elapsedTime = stageElapsed * 1000;

        if (onSaveState) {
          await onSaveState({
            currentStage: stageIndex + 1,
            totalStages: dynamicStages.length,
            bestParametersSoFar, stageResults,
            globalBestTrainReturn, globalBestTestReturn,
            completedCombinations,
            totalCombinations,
            stageStatuses, skippedStages, timeSavedBySkips
          });
        }
      }
    } catch (error: any) {
      const isAbortError = error.message?.toLowerCase().includes('abort') || error.message?.toLowerCase().includes('cancel') || abortSignal?.aborted;

      if (isAbortError) {
        stageStatuses[stageIndex].status = 'skipped';
        return { finalResult: globalMultiObjectiveResult, stageResults, wasStopped: true, wasPartiallySkipped: hasSkippedAnyStage };
      }

      stageStatuses[stageIndex].status = 'skipped';
      stageStatuses[stageIndex].skipReason = `שגיאה: ${error.message}`;
    }
  }

  return { finalResult: globalMultiObjectiveResult, stageResults, wasPartiallySkipped: hasSkippedAnyStage };
}

export function getOptimizationStages(): OptimizationStage[] {
  return OPTIMIZATION_STAGES;
}

export function estimateTotalCombinations(
  config: ExtendedStocksOptimizationConfig,
  enableRound2: boolean = true,
  enableRound3: boolean = true
): number {
  let total = 0;
  
  const stages = OPTIMIZATION_STAGES.filter(stage => {
    if (stage.round === 1) return true;
    if (stage.round === 2) return enableRound2;
    if (stage.round === 3) return enableRound3;
    return false;
  });

  stages.forEach(stage => {
    const stageConfig = createStageConfig(config, stage, {}, stage.round);
    total += estimateCombinationCountForConfig(stageConfig);
  });

  return total;
}
