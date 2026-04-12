/**
 * Web Worker for local portfolio optimization
 * Runs runSmartOptimization directly in the browser
 */
import type {
  SymbolData, PeriodSplit, ExtendedStocksOptimizationConfig,
} from '../lib/optimizer/types';
import { runSmartOptimization, type SmartProgressInfo, OPTIMIZER_BUILD } from '../lib/optimizer/smartOptimizer';
import { NNE_PRESET_CONFIG } from '../lib/optimizer/presetConfigs';

self.onmessage = async (e: MessageEvent) => {
  try {
    const msg = e.data;

    if (msg.type === 'run_smart') {
      const {
        symbolsData,
        periodSplit: rawSplit,
        enabledStages,
      } = msg;

      // Deserialize dates
      const periodSplit: PeriodSplit = {
        trainStartDate: new Date(rawSplit.trainStartDate),
        trainEndDate: new Date(rawSplit.trainEndDate),
        testStartDate: new Date(rawSplit.testStartDate),
        testEndDate: new Date(rawSplit.testEndDate),
        trainPercent: rawSplit.trainPercent,
      };

      const config = NNE_PRESET_CONFIG as ExtendedStocksOptimizationConfig;

      let lastProgressTime = 0;
      const PROGRESS_THROTTLE_MS = 200; // Send progress max 5 times/sec

      const result = await runSmartOptimization(
        symbolsData,
        config,
        periodSplit,
        'single',
        {},
        (info: SmartProgressInfo) => {
          const now = Date.now();
          if (now - lastProgressTime < PROGRESS_THROTTLE_MS && info.current < info.total) return;
          lastProgressTime = now;

          self.postMessage({
            type: 'progress',
            currentStage: info.currentStage,
            totalStages: info.totalStages,
            current: info.current,
            total: info.total,
            stageName: info.stageName,
            stageDescription: info.stageDescription,
            bestReturn: info.bestReturn,
            bestTestReturn: info.bestTestReturn,
          });
        },
        undefined, // abortSignal — not supported in worker, terminate instead
        false,
        'profit',
        true, // enableRound2
        true, // enableRound3
        enabledStages,
      );

      // Send final result
      self.postMessage({
        type: 'complete',
        finalResult: result.finalResult,
        stageResults: result.stageResults,
        wasStopped: result.wasStopped,
        optimizerBuild: OPTIMIZER_BUILD,
      });
    }
  } catch (error) {
    console.error('🔴 [Worker] Error:', error);
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
