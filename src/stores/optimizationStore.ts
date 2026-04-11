/**
 * Global Optimization Store — Zustand
 * Keeps the optimization running even when navigating away from Backtest page.
 * Persists progress to optimization_runs table for rehydration.
 */
import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import {
  runSmartOptimization,
  getOptimizationStages,
  type SmartOptimizationProgress,
  type StageStatus,
  type StageResult,
} from '@/lib/optimizer/smartOptimizer';
import { NNE_PRESET_CONFIG } from '@/lib/optimizer/presetConfigs';
import { TrainTestSplitAgent } from '@/lib/optimizer/trainTestSplitAgent';
import { TestThresholdAgent } from '@/lib/optimizer/testThresholdAgent';
import type { SymbolData, Candle, PeriodSplit } from '@/lib/optimizer/types';

const HISTORY_TARGET_YEARS = 5;
const HISTORY_TARGET_BARS = 35000;
const MARKET_DATA_INTERVAL = '15min';
const MARKET_DATA_PAGE_SIZE = 1000;
const PROGRESS_PERSIST_INTERVAL = 5000; // persist every 5s

interface MarketDataSummary {
  barCount: number;
  oldestTimestamp: string | null;
}

function getHistoryTargetDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - HISTORY_TARGET_YEARS);
  return d;
}

async function getMarketDataSummary(symbol: string): Promise<MarketDataSummary> {
  const [{ count, error: cErr }, { data: oldest, error: oErr }] = await Promise.all([
    supabase.from('market_data').select('id', { count: 'exact', head: true }).eq('symbol', symbol).eq('interval', MARKET_DATA_INTERVAL),
    supabase.from('market_data').select('timestamp').eq('symbol', symbol).eq('interval', MARKET_DATA_INTERVAL).order('timestamp', { ascending: true }).limit(1),
  ]);
  if (cErr) throw new Error(`שגיאה בבדיקת כמות נתונים: ${cErr.message}`);
  if (oErr) throw new Error(`שגיאה בבדיקת ההיסטוריה: ${oErr.message}`);
  return { barCount: count || 0, oldestTimestamp: oldest?.[0]?.timestamp ?? null };
}

function needsHistoricalTopUp(s: MarketDataSummary): boolean {
  if (s.barCount < HISTORY_TARGET_BARS) return true;
  if (!s.oldestTimestamp) return true;
  return new Date(s.oldestTimestamp) > getHistoryTargetDate();
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
  // Queue
  symbolQueue: string[];
  queueIndex: number;
  queueResults: Record<string, 'pending' | 'running' | 'done' | 'failed'>;
  // Stage estimates
  stageEstimates: Record<number, number>;

  // Actions
  runOptimization: (symbol: string, queryClient: any) => Promise<void>;
  runOptimizationQueue: (symbols: string[], queryClient: any) => Promise<void>;
  stopOptimization: () => void;
  toggleStage: (index: number, enabled: boolean) => void;
  resetState: () => void;
  rehydrate: () => Promise<void>;
}

const allStages = getOptimizationStages();
const initialStageStatuses: StageStatus[] = allStages.map(s => ({
  stageNumber: s.stageNumber, stageName: s.name, status: 'pending' as const,
}));

// Internal refs (not in Zustand state to avoid re-renders)
let abortController: AbortController | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let progressPersistInterval: ReturnType<typeof setInterval> | null = null;
let startTime = 0;
let lastComboCount = 0;
let lastComboTime = 0;

async function createRun(symbol: string): Promise<number | null> {
  const { data, error } = await supabase.from('optimization_runs').insert({
    symbol, status: 'running', total_stages: allStages.length,
  } as any).select('id').single();
  if (error) { console.error('[OptStore] Failed to create run:', error.message); return null; }
  return data?.id ?? null;
}

async function updateRun(id: number | null, updates: Record<string, any>) {
  if (!id) return;
  const { error } = await supabase.from('optimization_runs').update({ ...updates, updated_at: new Date().toISOString() } as any).eq('id', id);
  if (error) console.error('[OptStore] Failed to update run:', error.message);
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
  symbolQueue: [],
  queueIndex: 0,
  queueResults: {},
  stageEstimates: {},

  toggleStage: (index, enabled) => {
    set(state => {
      const next = [...state.enabledStages];
      next[index] = enabled;
      return { enabledStages: next };
    });
  },

  resetState: () => {
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
      stageEstimates: {},
    });
    lastComboCount = 0;
    lastComboTime = 0;
  },

  stopOptimization: () => {
    const { activeRunId } = get();
    abortController?.abort();
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (progressPersistInterval) { clearInterval(progressPersistInterval); progressPersistInterval = null; }
    updateRun(activeRunId, { status: 'aborted' });
    set({ isRunning: false });
  },

  rehydrate: async () => {
    // Check if there's already a run in progress in memory
    if (get().isRunning) return;
    // Load last run from DB to show previous results
    const { data, error } = await supabase
      .from('optimization_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return;
    const lastRun = data[0] as any;
    // If last run was "running" but we're not running, mark as aborted (browser was closed)
    if (lastRun.status === 'running') {
      await updateRun(lastRun.id, { status: 'aborted' });
    }
    // Restore last run info for display
    if (lastRun.status === 'completed' || lastRun.status === 'aborted' || lastRun.status === 'failed') {
      set({
        currentSymbol: lastRun.symbol,
        overallCombinations: { current: lastRun.current_combo || 0, total: lastRun.total_combos || 0 },
      });
    }
  },

  runOptimization: async (symbol, queryClient) => {
    const state = get();
    if (state.isRunning) return;

    abortController = new AbortController();
    state.resetState();

    const runId = await createRun(symbol);
    set({ isRunning: true, currentSymbol: symbol, activeRunId: runId });

    // Start elapsed timer
    startTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      set({ elapsedTime: (Date.now() - startTime) / 1000 });
    }, 1000);

    // Start progress persistence
    if (progressPersistInterval) clearInterval(progressPersistInterval);
    progressPersistInterval = setInterval(() => {
      const s = get();
      if (s.activeRunId && s.isRunning) {
        updateRun(s.activeRunId, {
          current_stage: s.smartProgress?.currentStage || 0,
          current_combo: s.overallCombinations.current,
          total_combos: s.overallCombinations.total,
        best_train: s.smartProgress?.bestReturn,
        best_test: s.smartProgress?.bestTestReturn,
        });
      }
    }, PROGRESS_PERSIST_INTERVAL);

    try {
      // 1. Check & download historical data
      const summary = await getMarketDataSummary(symbol);
      if (needsHistoricalTopUp(summary)) {
        const { data: dlResult, error: dlError } = await supabase.functions.invoke('download-historical-data', {
          body: { symbol, target_years: HISTORY_TARGET_YEARS, target_bars: HISTORY_TARGET_BARS },
        });
        if (dlError) throw new Error(`שגיאה בהורדת נתונים: ${dlError.message}`);
        const syncedBars = dlResult?.total_bars ?? dlResult?.bars_downloaded ?? summary.barCount;
        if (syncedBars < 200) throw new Error(`לא מספיק נתונים: ${syncedBars || 0} bars`);
        queryClient?.invalidateQueries({ queryKey: ['tracked_symbols'] });
        console.log(`[Optimization] Downloaded ${syncedBars} bars for ${symbol}`);
      }

      // 2. Load all bars with pagination
      let allBars: any[] = [];
      let offset = 0;
      while (true) {
        if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const { data: page, error: pageErr } = await supabase
          .from('market_data')
          .select('timestamp, open, high, low, close, volume')
          .eq('symbol', symbol).eq('interval', MARKET_DATA_INTERVAL)
          .order('timestamp', { ascending: true })
          .range(offset, offset + MARKET_DATA_PAGE_SIZE - 1);
        if (pageErr) throw new Error(`שגיאה בטעינת נתונים: ${pageErr.message}`);
        if (!page || page.length === 0) break;
        allBars.push(...page);
        offset += page.length;
        if (page.length < MARKET_DATA_PAGE_SIZE) break;
      }
      if (allBars.length < 200) throw new Error(`לא מספיק נתונים ל-${symbol}: ${allBars.length} bars`);
      console.log(`[Optimization] Loaded ${allBars.length.toLocaleString()} bars for ${symbol}`);

      const candles: Candle[] = allBars.map(bar => ({
        timestamp: new Date(bar.timestamp).getTime(),
        open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        volume: bar.volume || 0,
      }));

      // 3. Train/Test split
      const splitAgent = new TrainTestSplitAgent();
      await splitAgent.load();
      const trainPercent = splitAgent.getRecommendedSplit('15min');
      const splitIdx = Math.min(candles.length - 1, Math.max(1, Math.floor(candles.length * (trainPercent / 100))));
      const periodSplit: PeriodSplit = {
        trainStartDate: new Date(candles[0].timestamp),
        trainEndDate: new Date(candles[splitIdx - 1].timestamp),
        testStartDate: new Date(candles[splitIdx].timestamp),
        testEndDate: new Date(candles[candles.length - 1].timestamp),
        trainPercent,
      };

      const symbolData: SymbolData[] = [{ symbol, candles, startDate: new Date(candles[0].timestamp), endDate: new Date(candles[candles.length - 1].timestamp) }];

      // 4. Run optimizer
      const enabledStages = get().enabledStages;
      const result = await runSmartOptimization(
        symbolData, NNE_PRESET_CONFIG, periodSplit, 'single', {},
        (progress) => {
          set({ smartProgress: progress });

          // Track best returns in real-time
          const cur = get();
          const newBestTrain = progress.bestReturn !== undefined && (cur.bestTrainReturn === null || progress.bestReturn > cur.bestTrainReturn) ? progress.bestReturn : cur.bestTrainReturn;
          const newBestTest = progress.bestTestReturn !== undefined && (cur.bestTestReturn === null || progress.bestTestReturn > cur.bestTestReturn) ? progress.bestTestReturn : cur.bestTestReturn;
          if (newBestTrain !== cur.bestTrainReturn || newBestTest !== cur.bestTestReturn) {
            set({ bestTrainReturn: newBestTrain, bestTestReturn: newBestTest });
          }

          // Update stage statuses
          set(state => {
            const next = [...state.stageStatuses];
            for (let i = 0; i < next.length; i++) {
              if (i + 1 < progress.currentStage) {
                if (next[i].status !== 'completed' && next[i].status !== 'skipped') next[i].status = 'completed';
              } else if (i + 1 === progress.currentStage) {
                next[i].status = 'running';
              }
            }
            return { stageStatuses: next };
          });

          set(state => ({
            stageProgressMap: { ...state.stageProgressMap, [progress.currentStage]: { current: progress.current, total: progress.total } },
            overallCombinations: { current: progress.current, total: progress.total },
          }));

          // Speed calc
          const now = Date.now();
          if (now - lastComboTime > 2000) {
            const dt = (now - lastComboTime) / 1000;
            const dc = progress.current - lastComboCount;
            if (dt > 0 && dc > 0) set({ combinationsPerSecond: dc / dt });
            lastComboCount = progress.current;
            lastComboTime = now;
          }
        },
        abortController.signal,
        false, 'profit', true, true,
        enabledStages,
      );

      if (abortController.signal.aborted) {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if (progressPersistInterval) { clearInterval(progressPersistInterval); progressPersistInterval = null; }
        set({ isRunning: false });
        return;
      }

      // 5. Evaluate & save result
      const best = result.finalResult.bestForProfit;
      if (best) {
        const trainReturn = best.totalTrainReturn;
        const testReturn = best.totalTestReturn;
        const trainResult = best.trainResults[0]?.result;
        const testResult = best.testResults[0]?.result;
        const winRate = testResult?.winRate || trainResult?.winRate || 0;
        const maxDrawdown = testResult?.maxDrawdown || trainResult?.maxDrawdown || 0;
        const sharpeRatio = testResult?.sharpeRatio || trainResult?.sharpeRatio || 0;
        const totalTrades = (trainResult?.totalTrades || 0) + (testResult?.totalTrades || 0);

        const thresholdAgent = new TestThresholdAgent();
        await thresholdAgent.load();
        const evaluation = thresholdAgent.evaluate({ trainReturn, testReturn, winRate, maxDrawdown, sharpeRatio, totalTrades });

        const overfit = trainReturn > 0 ? Math.abs(trainReturn - testReturn) / trainReturn : 0;
        const overfitRisk = overfit < 0.3 ? 'low' : overfit < 0.6 ? 'medium' : 'high';

        const { error: insertErr } = await supabase.from('optimization_results').insert({
          symbol,
          parameters: best.parameters as any,
          train_return: trainReturn,
          test_return: testReturn,
          is_active: evaluation.passed,
          overfit_risk: overfitRisk,
          win_rate: winRate,
          max_drawdown: maxDrawdown,
          sharpe_ratio: sharpeRatio,
          total_trades: totalTrades,
          agent_decision: evaluation.passed ? 'approved' : 'rejected',
          agent_confidence: evaluation.score,
        });

        if (insertErr) {
          console.error('[Optimization] Failed to save result:', insertErr.message);
          set({ error: `שגיאה בשמירת תוצאה: ${insertErr.message}` });
        }

        queryClient?.invalidateQueries({ queryKey: ['optimization_results'] });
        console.log(`[Optimization] ${symbol} — ${evaluation.passed ? 'APPROVED' : 'REJECTED'} — Score: ${evaluation.score.toFixed(0)}/100 — Train: ${trainReturn.toFixed(1)}% Test: ${testReturn.toFixed(1)}%`);
      }

      // Update stage results
      if (result.stageResults) set({ stageResults: result.stageResults });

      // Mark run completed
      await updateRun(get().activeRunId, { status: 'completed', best_train: best?.totalTrainReturn, best_test: best?.totalTestReturn });

      // Mark all completed
      set(state => ({
        stageStatuses: state.stageStatuses.map(s => s.status === 'running' ? { ...s, status: 'completed' as const } : s),
        isRunning: false,
      }));
    } catch (err: any) {
      if (err.name === 'AbortError' || abortController?.signal.aborted) {
        set({ isRunning: false });
      } else {
        await updateRun(get().activeRunId, { status: 'failed', error_message: err.message });
        set({ isRunning: false, error: err.message });
        console.error('[Optimization] Error:', err.message);
      }
    } finally {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      if (progressPersistInterval) { clearInterval(progressPersistInterval); progressPersistInterval = null; }
    }
  },

  runOptimizationQueue: async (symbols, queryClient) => {
    set({ symbolQueue: symbols, queueIndex: 0, queueResults: Object.fromEntries(symbols.map(s => [s, 'pending' as const])) });
    for (let i = 0; i < symbols.length; i++) {
      if (abortController?.signal.aborted) break;
      set({ queueIndex: i, queueResults: { ...get().queueResults, [symbols[i]]: 'running' } });
      try {
        await get().runOptimization(symbols[i], queryClient);
        set({ queueResults: { ...get().queueResults, [symbols[i]]: 'done' } });
      } catch {
        set({ queueResults: { ...get().queueResults, [symbols[i]]: 'failed' } });
      }
    }
    set({ symbolQueue: [], queueIndex: 0 });
  },
}));

export { allStages };
