/**
 * Global Optimization Store — Zustand
 * Server-side optimization: dispatches jobs to Railway via Edge Function,
 * polls optimization_runs table for progress updates.
 * Local optimization: runs directly in browser via Web Worker.
 */
import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import {
  getOptimizationStages,
  type SmartOptimizationProgress,
  type StageStatus,
  type StageResult,
} from '@/lib/optimizer/smartOptimizer';


const POLL_INTERVAL = 2000; // poll DB every 2s

export interface RunLogEntry {
  id: number;
  run_id: number;
  symbol: string | null;
  stage_number: number | null;
  stage_name: string | null;
  round_number: number | null;
  current_combo: number | null;
  total_combos: number | null;
  heap_used_mb: number | null;
  heap_total_mb: number | null;
  combination_cache_size: number | null;
  indicator_cache_size: number | null;
  message: string;
  created_at: string;
}

export type OptimizationMode = 'server' | 'local';

export interface OptimizationState {
  // UI state
  isRunning: boolean;
  currentSymbol: string;
  enabledStages: boolean[];
  stageStatuses: StageStatus[];
  stageResults: StageResult[];
  smartProgress: SmartOptimizationProgress | null;
  stageProgressMap: Record<number, { current: number; total: number }>;
  overallCombinations: { current: number; total: number };
  elapsedTime: number;
  combinationsPerSecond: number;
  error: string | null;
  activeRunId: number | null;
  bestTrainReturn: number | null;
  bestTestReturn: number | null;
  // Stall detection
  lastServerUpdateAt: string | null;
  secondsSinceLastUpdate: number;
  serverStatus: 'active' | 'slow' | 'stalled' | 'idle';
  // Queue
  symbolQueue: string[];
  queueIndex: number;
  queueResults: Record<string, 'pending' | 'running' | 'done' | 'failed'>;
  // Stage estimates
  stageEstimates: Record<number, number>;
  // Live logs
  runLogs: RunLogEntry[];
  // Mode
  optimizationMode: OptimizationMode;
  // Build version
  optimizerBuild: string | null;

  // Actions
  setOptimizationMode: (mode: OptimizationMode) => void;
  runOptimization: (symbol: string, queryClient: any) => Promise<void>;
  runOptimizationQueue: (symbols: string[], queryClient: any) => Promise<void>;
  addToQueue: (symbols: string[]) => void;
  stopOptimization: () => void;
  toggleStage: (index: number, enabled: boolean) => void;
  resetState: () => void;
  rehydrate: () => Promise<void>;
}

export const allStages = getOptimizationStages();
const initialStageStatuses: StageStatus[] = allStages.map(s => ({
  stageNumber: s.stageNumber, stageName: s.name, status: 'pending' as const,
}));

// Internal refs
let pollTimer: ReturnType<typeof setInterval> | null = null;
let elapsedTimer: ReturnType<typeof setInterval> | null = null;
let startTime = 0;
let lastComboCount = 0;
let lastComboTime = 0;
let lastServerUpdatedAt = '';
let speedHistory: number[] = [];
let activeWorker: Worker | null = null;

// Helper: compute cumulative overall progress from stageEstimates
function computeOverallProgress(
  stageEstimates: Record<number, number>,
  currentStage: number,
  currentCombo: number,
  totalCombos: number
): { current: number; total: number } {
  let completedCombos = 0;
  let overallTotal = 0;
  for (const [stageStr, combos] of Object.entries(stageEstimates)) {
    const stageNum = Number(stageStr);
    overallTotal += combos;
    if (stageNum < currentStage) {
      completedCombos += combos;
    }
  }
  if (overallTotal === 0) {
    overallTotal = totalCombos;
  }
  return {
    current: completedCombos + currentCombo,
    total: Math.max(overallTotal, completedCombos + totalCombos),
  };
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
}

function terminateWorker() {
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }
}

export const useOptimizationStore = create<OptimizationState>((set, get) => ({
  isRunning: false,
  currentSymbol: '',
  enabledStages: allStages.map(() => true),
  stageStatuses: [...initialStageStatuses],
  stageResults: [],
  smartProgress: null,
  stageProgressMap: {},
  overallCombinations: { current: 0, total: 0 },
  elapsedTime: 0,
  combinationsPerSecond: 0,
  error: null,
  activeRunId: null,
  bestTrainReturn: null,
  bestTestReturn: null,
  lastServerUpdateAt: null,
  secondsSinceLastUpdate: 0,
  serverStatus: 'idle',
  symbolQueue: [],
  queueIndex: 0,
  queueResults: {},
  stageEstimates: {},
  runLogs: [],
  optimizationMode: 'server',
  optimizerBuild: null,

  setOptimizationMode: (mode) => set({ optimizationMode: mode }),

  toggleStage: (index, enabled) => {
    set(state => {
      const next = [...state.enabledStages];
      next[index] = enabled;
      return { enabledStages: next };
    });
  },

  resetState: () => {
    stopPolling();
    terminateWorker();
    set({
      stageStatuses: allStages.map(s => ({ stageNumber: s.stageNumber, stageName: s.name, status: 'pending' as const })),
      stageResults: [],
      smartProgress: null,
      stageProgressMap: {},
      overallCombinations: { current: 0, total: 0 },
      elapsedTime: 0,
      combinationsPerSecond: 0,
      error: null,
      activeRunId: null,
      bestTrainReturn: null,
      bestTestReturn: null,
      lastServerUpdateAt: null,
      secondsSinceLastUpdate: 0,
      serverStatus: 'idle',
      stageEstimates: {},
      runLogs: [],
      optimizerBuild: null,
    });
    lastComboCount = 0;
    lastComboTime = 0;
    lastServerUpdatedAt = '';
  },

  stopOptimization: () => {
    const { activeRunId, optimizationMode } = get();
    stopPolling();
    terminateWorker();
    if (optimizationMode === 'server' && activeRunId) {
      supabase.from('optimization_runs').update({ status: 'aborted', updated_at: new Date().toISOString() } as any).eq('id', activeRunId).then(() => {});
    }
    set({ isRunning: false });
  },

  rehydrate: async () => {
    if (get().isRunning) return;
    const { data, error } = await supabase
      .from('optimization_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return;
    const lastRun = data[0] as any;

    if (lastRun.status === 'running' || lastRun.status === 'pending') {
      set({
        isRunning: true,
        currentSymbol: lastRun.symbol,
        activeRunId: lastRun.id,
        overallCombinations: { current: lastRun.current_combo || 0, total: lastRun.total_combos || 0 },
        bestTrainReturn: lastRun.best_train,
        bestTestReturn: lastRun.best_test,
        optimizationMode: 'server',
      });
      startPolling(set, get);
    } else {
      set({
        currentSymbol: lastRun.symbol,
        overallCombinations: { current: lastRun.current_combo || 0, total: lastRun.total_combos || 0 },
        bestTrainReturn: lastRun.best_train,
        bestTestReturn: lastRun.best_test,
      });
    }
  },

  runOptimization: async (symbol, queryClient) => {
    const state = get();
    if (state.isRunning) return;

    state.resetState();
    set({ isRunning: true, currentSymbol: symbol });

    if (state.optimizationMode === 'local') {
      await runLocalOptimization(symbol, set, get, queryClient);
    } else {
      await runServerOptimization(symbol, set, get);
    }
  },

  addToQueue: (symbols) => {
    const { symbolQueue, queueResults } = get();
    const newSymbols = symbols.filter(s => !symbolQueue.includes(s));
    if (newSymbols.length === 0) return;
    set({
      symbolQueue: [...symbolQueue, ...newSymbols],
      queueResults: { ...queueResults, ...Object.fromEntries(newSymbols.map(s => [s, 'pending' as const])) },
    });
  },

  runOptimizationQueue: async (symbols, queryClient) => {
    const state = get();
    if (state.isRunning) return;

    state.resetState();

    set({
      isRunning: true,
      symbolQueue: symbols,
      queueIndex: 0,
      queueResults: Object.fromEntries(symbols.map(s => [s, 'pending' as const])),
    });

    if (state.optimizationMode === 'local') {
      // Run queue locally one at a time
      for (let i = 0; i < symbols.length; i++) {
        if (!get().isRunning) break;
        set({
          currentSymbol: symbols[i],
          queueIndex: i,
          queueResults: { ...get().queueResults, [symbols[i]]: 'running' },
        });
        await runLocalOptimization(symbols[i], set, get, queryClient);
        set(s => ({
          queueResults: { ...s.queueResults, [symbols[i]]: 'done' },
        }));
      }
      set({ isRunning: false });
      queryClient?.invalidateQueries({ queryKey: ['optimization_results'] });
      return;
    }

    try {
      const enabledStages = get().enabledStages;
      const { data, error } = await supabase.functions.invoke('start-optimization', {
        body: { symbols, enabled_stages: enabledStages },
      });

      if (error) throw new Error(`שגיאה בשליחת job: ${error.message}`);

      const runIds = data?.run_ids || [];
      if (runIds.length === 0) throw new Error('לא התקבלו run IDs מהשרת');

      set({
        activeRunId: runIds[0],
        currentSymbol: symbols[0],
        queueResults: Object.fromEntries(symbols.map((s, i) => [s, i === 0 ? 'running' as const : 'pending' as const])),
      });

      startTime = Date.now();
      startPollingQueue(set, get, symbols, runIds, queryClient);

    } catch (err: any) {
      set({ isRunning: false, error: err.message });
      console.error('[Optimization] Queue error:', err.message);
    }
  },
}));

// ═══ LOCAL OPTIMIZATION ═══

async function runLocalOptimization(
  symbol: string,
  set: (state: Partial<OptimizationState> | ((state: OptimizationState) => Partial<OptimizationState>)) => void,
  get: () => OptimizationState,
  queryClient: any,
) {
  try {
    // 1. Fetch market data from DB
    let allBars: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const { data: bars, error } = await supabase
        .from('market_data')
        .select('timestamp, open, high, low, close, volume')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: true })
        .range(offset, offset + batchSize - 1);
      if (error || !bars || bars.length === 0) break;
      allBars = allBars.concat(bars);
      if (bars.length < batchSize) break;
      offset += batchSize;
    }

    if (allBars.length === 0) {
      set({ isRunning: false, error: `אין נתונים עבור ${symbol}` });
      return;
    }

    const candles = allBars.map(bar => ({
      timestamp: new Date(bar.timestamp).getTime(),
      open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume,
    }));

    const trainPercent = 70;
    const splitIndex = Math.floor(candles.length * (trainPercent / 100));
    const periodSplit = {
      trainStartDate: new Date(candles[0].timestamp).toISOString(),
      trainEndDate: new Date(candles[splitIndex - 1].timestamp).toISOString(),
      testStartDate: new Date(candles[splitIndex].timestamp).toISOString(),
      testEndDate: new Date(candles[candles.length - 1].timestamp).toISOString(),
      trainPercent,
    };

    const symbolsData = [{ symbol, candles }];

    // 2. Start worker
    terminateWorker();
    const worker = new Worker(
      new URL('../workers/optimizer.worker.ts', import.meta.url),
      { type: 'module' }
    );
    activeWorker = worker;

    startTime = Date.now();
    lastComboCount = 0;
    lastComboTime = Date.now();
    speedHistory = [];

    // Elapsed timer
    elapsedTimer = setInterval(() => {
      if (startTime > 0) {
        set({ elapsedTime: (Date.now() - startTime) / 1000 });
      }
    }, 1000);

    await new Promise<void>((resolve, reject) => {
      worker.onmessage = async (e: MessageEvent) => {
        const msg = e.data;

        if (msg.type === 'progress') {
          const currentStage = msg.currentStage || 0;
          const overall = computeOverallProgress(get().stageEstimates, currentStage, msg.current, msg.total);

          set({
            overallCombinations: overall,
            bestTrainReturn: msg.bestReturn ?? get().bestTrainReturn,
            bestTestReturn: msg.bestTestReturn ?? get().bestTestReturn,
            serverStatus: 'active',
            smartProgress: {
              currentStage,
              totalStages: msg.totalStages || allStages.length,
              current: msg.current,
              total: msg.total,
              stageDescription: msg.stageName || `שלב ${currentStage}`,
              bestReturn: msg.bestReturn,
              bestTestReturn: msg.bestTestReturn,
            } as SmartOptimizationProgress,
          });

          // Update stage statuses
          set(state => {
            const next = [...state.stageStatuses];
            for (let i = 0; i < next.length; i++) {
              if (i + 1 < currentStage) {
                if (next[i].status !== 'completed' && next[i].status !== 'skipped') next[i].status = 'completed';
              } else if (i + 1 === currentStage) {
                next[i].status = 'running';
              }
            }
            return { stageStatuses: next };
          });

          // Speed calc
          const now = Date.now();
          const currentCombo = overall.current;
          if (now - lastComboTime > 1000) {
            const dc = currentCombo - lastComboCount;
            const dt = (now - lastComboTime) / 1000;
            if (dt > 0 && dc > 0) {
              const instantSpeed = dc / dt;
              speedHistory.push(instantSpeed);
              if (speedHistory.length > 5) speedHistory.shift();
              const avgSpeed = speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length;
              set({ combinationsPerSecond: avgSpeed });
            }
            lastComboCount = currentCombo;
            lastComboTime = now;
          }
        }

        if (msg.type === 'complete') {
          stopPolling();
          set(state => ({
            isRunning: false,
            stageStatuses: state.stageStatuses.map(s => s.status === 'running' ? { ...s, status: 'completed' as const } : s),
            stageResults: msg.stageResults || [],
          }));

          // Save results to DB
          if (msg.finalResult?.bestForProfit) {
            const bp = msg.finalResult.bestForProfit;
            try {
              await supabase.from('optimization_results').insert({
                symbol,
                parameters: bp.parameters,
                train_return: bp.totalTrainReturn,
                test_return: bp.totalTestReturn,
                total_trades: bp.trainResults?.reduce((s: number, r: any) => s + (r.result?.totalTrades || 0), 0) || 0,
                win_rate: (() => {
                  const totalTr = bp.trainResults?.reduce((s: number, r: any) => s + (r.result?.totalTrades || 0), 0) || 0;
                  const wins = bp.trainResults?.reduce((s: number, r: any) => s + (r.result?.wins || 0), 0) || 0;
                  return totalTr > 0 ? (wins / totalTr) * 100 : 0;
                })(),
                max_drawdown: bp.trainResults?.[0]?.result?.maxDrawdown || 0,
                sharpe_ratio: bp.trainResults?.[0]?.result?.sharpeRatio || 0,
                is_active: true,
                agent_decision: 'pending',
              });
              queryClient?.invalidateQueries({ queryKey: ['optimization_results'] });
            } catch (saveErr) {
              console.error('[Local] Failed to save results:', saveErr);
            }
          }

          terminateWorker();
          resolve();
        }

        if (msg.type === 'error') {
          stopPolling();
          set({ isRunning: false, error: msg.error });
          terminateWorker();
          reject(new Error(msg.error));
        }
      };

      worker.onerror = (err) => {
        stopPolling();
        set({ isRunning: false, error: err.message });
        terminateWorker();
        reject(err);
      };

      // Send data to worker
      worker.postMessage({
        type: 'run_smart',
        symbolsData,
        periodSplit,
        enabledStages: get().enabledStages,
      });
    });

  } catch (err: any) {
    stopPolling();
    terminateWorker();
    if (get().isRunning) {
      set({ isRunning: false, error: err.message });
    }
    console.error('[Local Optimization] Error:', err.message);
  }
}

// ═══ SERVER OPTIMIZATION ═══

async function runServerOptimization(
  symbol: string,
  set: (state: Partial<OptimizationState> | ((state: OptimizationState) => Partial<OptimizationState>)) => void,
  get: () => OptimizationState,
) {
  try {
    const enabledStages = get().enabledStages;
    const { data, error } = await supabase.functions.invoke('start-optimization', {
      body: { symbols: [symbol], enabled_stages: enabledStages },
    });

    if (error) throw new Error(`שגיאה בשליחת job: ${error.message}`);

    const runId = data?.run_ids?.[0];
    if (!runId) throw new Error('לא התקבל run ID מהשרת');

    set({ activeRunId: runId });

    startTime = Date.now();
    startPolling(set, get);

  } catch (err: any) {
    set({ isRunning: false, error: err.message });
    console.error('[Optimization] Error:', err.message);
  }
}

// ═══ SERVER POLLING ═══

function startPolling(
  set: (state: Partial<OptimizationState> | ((state: OptimizationState) => Partial<OptimizationState>)) => void,
  get: () => OptimizationState
) {
  stopPolling();

  elapsedTimer = setInterval(() => {
    if (startTime > 0) {
      set({ elapsedTime: (Date.now() - startTime) / 1000 });
    }
  }, 1000);

  pollTimer = setInterval(async () => {
    const state = get();
    if (!state) { stopPolling(); return; }
    const { activeRunId, isRunning } = state;
    if (!activeRunId || !isRunning) { stopPolling(); return; }

    const [runRes, logsRes] = await Promise.all([
      supabase.from('optimization_runs').select('*').eq('id', activeRunId).single(),
      supabase.from('optimization_run_logs' as any).select('*').eq('run_id', activeRunId).order('created_at', { ascending: false }).limit(50),
    ]);

    if (runRes.error || !runRes.data) return;
    const run = runRes.data as any;

    if (logsRes.data) {
      set({ runLogs: ([...(logsRes.data as any[])].reverse()) as RunLogEntry[] });
    }

    const currentCombo = run.current_combo || 0;
    const totalCombos = run.total_combos || 0;
    const currentStage = run.current_stage || 0;

    const overall = computeOverallProgress(get().stageEstimates, currentStage, currentCombo, totalCombos);

    set({
      overallCombinations: overall,
      bestTrainReturn: run.best_train,
      bestTestReturn: run.best_test,
      smartProgress: {
        currentStage,
        totalStages: run.total_stages || allStages.length,
        current: currentCombo,
        total: totalCombos,
        stageDescription: `שלב ${currentStage}`,
        bestReturn: run.best_train,
        bestTestReturn: run.best_test,
      } as SmartOptimizationProgress,
    });

    set(state => {
      const next = [...state.stageStatuses];
      for (let i = 0; i < next.length; i++) {
        if (i + 1 < currentStage) {
          if (next[i].status !== 'completed' && next[i].status !== 'skipped') next[i].status = 'completed';
        } else if (i + 1 === currentStage) {
          next[i].status = 'running';
        }
      }
      return { stageStatuses: next };
    });

    // Speed calc + stall detection
    const now = Date.now();
    const serverUpdatedAt = run.updated_at || '';
    const serverChanged = serverUpdatedAt !== lastServerUpdatedAt;
    const dc = currentCombo - lastComboCount;

    if (serverChanged) {
      lastServerUpdatedAt = serverUpdatedAt;
    }

    if (now - lastComboTime > 2000) {
      const dt = (now - lastComboTime) / 1000;
      if (dt > 0 && dc > 0) {
        const instantSpeed = dc / dt;
        speedHistory.push(instantSpeed);
        if (speedHistory.length > 5) speedHistory.shift();
        const avgSpeed = speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length;
        set({ combinationsPerSecond: avgSpeed });
      } else {
        set({ combinationsPerSecond: 0 });
        speedHistory = [];
      }
      lastComboCount = currentCombo;
      lastComboTime = now;
    }

    const secsSinceUpdate = serverUpdatedAt ? (now - new Date(serverUpdatedAt).getTime()) / 1000 : 0;
    let serverStatus: 'active' | 'slow' | 'stalled' | 'idle' = 'active';
    if (secsSinceUpdate > 300) serverStatus = 'stalled';
    else if (secsSinceUpdate > 60) serverStatus = 'slow';
    set({ lastServerUpdateAt: serverUpdatedAt, secondsSinceLastUpdate: secsSinceUpdate, serverStatus });

    if (serverStatus === 'stalled') {
      supabase.functions.invoke('check-stalled-runs').catch(() => {});
    }

    if (run.status === 'completed') {
      stopPolling();
      set(state => ({
        isRunning: false,
        stageStatuses: state.stageStatuses.map(s => s.status === 'running' ? { ...s, status: 'completed' as const } : s),
      }));
    } else if (run.status === 'failed') {
      stopPolling();
      set({ isRunning: false, error: run.error_message || 'הריצה נכשלה בשרת' });
    } else if (run.status === 'aborted') {
      stopPolling();
      set({ isRunning: false });
    }
  }, POLL_INTERVAL);
}

function startPollingQueue(
  set: (state: Partial<OptimizationState> | ((state: OptimizationState) => Partial<OptimizationState>)) => void,
  get: () => OptimizationState,
  symbols: string[],
  runIds: number[],
  queryClient: any
) {
  stopPolling();
  let currentIdx = 0;

  elapsedTimer = setInterval(() => {
    if (startTime > 0) {
      set({ elapsedTime: (Date.now() - startTime) / 1000 });
    }
  }, 1000);

  pollTimer = setInterval(async () => {
    const state = get();
    if (!state) { stopPolling(); return; }
    const { isRunning } = state;
    if (!isRunning) { stopPolling(); return; }

    const { data: runs, error } = await supabase
      .from('optimization_runs')
      .select('*')
      .in('id', runIds)
      .order('id');

    if (error || !runs) return;

    const activeRun = runs.find((r: any) => r.status === 'running' || r.status === 'pending');
    const activeIdx = activeRun ? symbols.indexOf(activeRun.symbol) : -1;

    const queueResults: Record<string, 'pending' | 'running' | 'done' | 'failed'> = {};
    for (const run of runs as any[]) {
      const status = run.status === 'completed' ? 'done' : run.status === 'failed' ? 'failed' : run.status === 'running' ? 'running' : 'pending';
      queueResults[run.symbol] = status;
    }

    if (activeRun) {
      const run = activeRun as any;
      const currentCombo = run.current_combo || 0;
      const totalCombos = run.total_combos || 0;
      const currentStage = run.current_stage || 0;

      const overall = computeOverallProgress(get().stageEstimates, currentStage, currentCombo, totalCombos);

      set({
        activeRunId: run.id,
        currentSymbol: run.symbol,
        queueIndex: activeIdx >= 0 ? activeIdx : currentIdx,
        queueResults,
        overallCombinations: overall,
        bestTrainReturn: run.best_train,
        bestTestReturn: run.best_test,
        smartProgress: {
          currentStage,
          totalStages: run.total_stages || allStages.length,
          current: currentCombo,
          total: totalCombos,
          stageDescription: `${run.symbol} — שלב ${currentStage}`,
          bestReturn: run.best_train,
          bestTestReturn: run.best_test,
        } as SmartOptimizationProgress,
      });

      set(state => {
        const next = [...state.stageStatuses];
        for (let i = 0; i < next.length; i++) {
          if (i + 1 < currentStage) {
            if (next[i].status !== 'completed' && next[i].status !== 'skipped') next[i].status = 'completed';
          } else if (i + 1 === currentStage) {
            next[i].status = 'running';
          } else {
            next[i].status = 'pending';
          }
        }
        return { stageStatuses: next };
      });

      // Speed calc + stall detection
      const now = Date.now();
      const serverUpdatedAt = run.updated_at || '';
      const serverChanged = serverUpdatedAt !== lastServerUpdatedAt;
      const dc = (run.current_combo || 0) - lastComboCount;

      if (serverChanged) {
        lastServerUpdatedAt = serverUpdatedAt;
      }

      if (now - lastComboTime > 2000) {
        const dt = (now - lastComboTime) / 1000;
        if (dt > 0 && dc > 0) {
          const instantSpeed = dc / dt;
          speedHistory.push(instantSpeed);
          if (speedHistory.length > 5) speedHistory.shift();
          const avgSpeed = speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length;
          set({ combinationsPerSecond: avgSpeed });
        } else {
          set({ combinationsPerSecond: 0 });
          speedHistory = [];
        }
        lastComboCount = run.current_combo || 0;
        lastComboTime = now;
      }

      const secsSinceUpdate = serverUpdatedAt ? (now - new Date(serverUpdatedAt).getTime()) / 1000 : 0;
      let serverStatus: 'active' | 'slow' | 'stalled' | 'idle' = 'active';
      if (secsSinceUpdate > 300) serverStatus = 'stalled';
      else if (secsSinceUpdate > 60) serverStatus = 'slow';
      set({ lastServerUpdateAt: serverUpdatedAt, secondsSinceLastUpdate: secsSinceUpdate, serverStatus });

      if (serverStatus === 'stalled') {
        supabase.functions.invoke('check-stalled-runs').catch(() => {});
      }
    } else {
      set({ queueResults });
      const allDone = (runs as any[]).every(r => ['completed', 'failed', 'aborted'].includes(r.status));
      if (allDone) {
        stopPolling();
        set({
          isRunning: false,
          stageStatuses: allStages.map(s => ({ stageNumber: s.stageNumber, stageName: s.name, status: 'completed' as const })),
        });
        queryClient?.invalidateQueries({ queryKey: ['optimization_results'] });
      }
    }
  }, POLL_INTERVAL);
}
