/**
 * Global Optimization Store — Zustand
 * Server-side optimization: dispatches jobs to Railway via Edge Function,
 * polls optimization_runs table for progress updates.
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

  // Actions
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

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
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

  toggleStage: (index, enabled) => {
    set(state => {
      const next = [...state.enabledStages];
      next[index] = enabled;
      return { enabledStages: next };
    });
  },

  resetState: () => {
    stopPolling();
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
    });
    lastComboCount = 0;
    lastComboTime = 0;
    lastServerUpdatedAt = '';
  },

  stopOptimization: () => {
    stopPolling();
    const { activeRunId } = get();
    if (activeRunId) {
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

    // If last run is still running/pending, resume polling
    if (lastRun.status === 'running' || lastRun.status === 'pending') {
      set({
        isRunning: true,
        currentSymbol: lastRun.symbol,
        activeRunId: lastRun.id,
        overallCombinations: { current: lastRun.current_combo || 0, total: Math.min(lastRun.total_combos || 0, 2_000_000) },
        bestTrainReturn: lastRun.best_train,
        bestTestReturn: lastRun.best_test,
      });
      startPolling(set, get);
    } else {
      set({
        currentSymbol: lastRun.symbol,
        overallCombinations: { current: lastRun.current_combo || 0, total: Math.min(lastRun.total_combos || 0, 2_000_000) },
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

    try {
      // Dispatch to server via Edge Function
      const enabledStages = get().enabledStages;
      const { data, error } = await supabase.functions.invoke('start-optimization', {
        body: { symbols: [symbol], enabled_stages: enabledStages },
      });

      if (error) throw new Error(`שגיאה בשליחת job: ${error.message}`);

      const runId = data?.run_ids?.[0];
      if (!runId) throw new Error('לא התקבל run ID מהשרת');

      set({ activeRunId: runId });

      // Start polling for progress
      startTime = Date.now();
      startPolling(set, get);

    } catch (err: any) {
      set({ isRunning: false, error: err.message });
      console.error('[Optimization] Error:', err.message);
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

    try {
      // Send all symbols at once to the server
      const enabledStages = get().enabledStages;
      const { data, error } = await supabase.functions.invoke('start-optimization', {
        body: { symbols, enabled_stages: enabledStages },
      });

      if (error) throw new Error(`שגיאה בשליחת job: ${error.message}`);

      const runIds = data?.run_ids || [];
      if (runIds.length === 0) throw new Error('לא התקבלו run IDs מהשרת');

      // Set first run as active
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
    const { activeRunId, isRunning } = get();
    if (!activeRunId || !isRunning) { stopPolling(); return; }

    // Fetch run status + latest logs in parallel
    const [runRes, logsRes] = await Promise.all([
      supabase.from('optimization_runs').select('*').eq('id', activeRunId).single(),
      supabase.from('optimization_run_logs' as any).select('*').eq('run_id', activeRunId).order('created_at', { ascending: false }).limit(50),
    ]);

    if (runRes.error || !runRes.data) return;
    const run = runRes.data as any;

    // Update logs (reverse to show oldest first)
    if (logsRes.data) {
      set({ runLogs: ([...(logsRes.data as any[])].reverse()) as RunLogEntry[] });
    }

    // Update progress
    const currentCombo = run.current_combo || 0;
    const totalCombos = Math.min(run.total_combos || 0, 2_000_000);
    const currentStage = run.current_stage || 0;

    set({
      overallCombinations: { current: Math.min(currentCombo, totalCombos), total: totalCombos },
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
        // No new combos — decay speed toward 0
        set({ combinationsPerSecond: 0 });
        speedHistory = [];
      }
      lastComboCount = currentCombo;
      lastComboTime = now;
    }

    // Stall detection — generous thresholds since Railway may batch updates
    const secsSinceUpdate = serverUpdatedAt ? (now - new Date(serverUpdatedAt).getTime()) / 1000 : 0;
    let serverStatus: 'active' | 'slow' | 'stalled' | 'idle' = 'active';
    if (secsSinceUpdate > 300) serverStatus = 'stalled';
    else if (secsSinceUpdate > 60) serverStatus = 'slow';
    set({ lastServerUpdateAt: serverUpdatedAt, secondsSinceLastUpdate: secsSinceUpdate, serverStatus });

    // Auto-trigger watchdog when stalled to mark crashed runs
    if (serverStatus === 'stalled') {
      supabase.functions.invoke('check-stalled-runs').catch(() => {});
    }

    // Check if done
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
    const { isRunning } = get();
    if (!isRunning) { stopPolling(); return; }

    // Poll all runs at once
    const { data: runs, error } = await supabase
      .from('optimization_runs')
      .select('*')
      .in('id', runIds)
      .order('id');

    if (error || !runs) return;

    // Find first running/pending run
    const activeRun = runs.find((r: any) => r.status === 'running' || r.status === 'pending');
    const activeIdx = activeRun ? symbols.indexOf(activeRun.symbol) : -1;

    // Update queue results
    const queueResults: Record<string, 'pending' | 'running' | 'done' | 'failed'> = {};
    for (const run of runs as any[]) {
      const status = run.status === 'completed' ? 'done' : run.status === 'failed' ? 'failed' : run.status === 'running' ? 'running' : 'pending';
      queueResults[run.symbol] = status;
    }

    if (activeRun) {
      const run = activeRun as any;
      const currentCombo = run.current_combo || 0;
      const totalCombos = Math.min(run.total_combos || 0, 2_000_000);
      const currentStage = run.current_stage || 0;

      set({
        activeRunId: run.id,
        currentSymbol: run.symbol,
        queueIndex: activeIdx >= 0 ? activeIdx : currentIdx,
        queueResults,
        overallCombinations: { current: currentCombo, total: totalCombos },
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

      // Update stage statuses for active run
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

      // Auto-trigger watchdog when stalled
      if (serverStatus === 'stalled') {
        supabase.functions.invoke('check-stalled-runs').catch(() => {});
      }
    } else {
      // All done
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
