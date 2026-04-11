import { useState, useRef, useCallback, useEffect } from "react";
import { useOptimizationResults, useTrackedSymbols } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { SmartOptimizationProgressCard } from "@/components/backtest/OptimizationProgress";
import SymbolSearch from "@/components/backtest/SymbolSearch";
import {
  runSmartOptimization,
  getOptimizationStages,
  type SmartOptimizationProgress,
  type StageStatus,
  type StageResult,
} from "@/lib/optimizer/smartOptimizer";
import { NNE_PRESET_CONFIG } from "@/lib/optimizer/presetConfigs";
import { TrainTestSplitAgent } from "@/lib/optimizer/trainTestSplitAgent";
import { TestThresholdAgent } from "@/lib/optimizer/testThresholdAgent";
import type { SymbolData, Candle, PeriodSplit } from "@/lib/optimizer/types";

const HISTORY_TARGET_YEARS = 5;
const HISTORY_TARGET_BARS = 35000;
const MARKET_DATA_INTERVAL = "15min";
const MARKET_DATA_PAGE_SIZE = 1000;

interface MarketDataSummary {
  barCount: number;
  oldestTimestamp: string | null;
}

function getHistoryTargetDate(): Date {
  const targetDate = new Date();
  targetDate.setFullYear(targetDate.getFullYear() - HISTORY_TARGET_YEARS);
  return targetDate;
}

async function getMarketDataSummary(symbol: string): Promise<MarketDataSummary> {
  const [{ count, error: countError }, { data: oldestRows, error: oldestError }] = await Promise.all([
    supabase
      .from('market_data')
      .select('id', { count: 'exact', head: true })
      .eq('symbol', symbol)
      .eq('interval', MARKET_DATA_INTERVAL),
    supabase
      .from('market_data')
      .select('timestamp')
      .eq('symbol', symbol)
      .eq('interval', MARKET_DATA_INTERVAL)
      .order('timestamp', { ascending: true })
      .limit(1),
  ]);

  if (countError) throw new Error(`שגיאה בבדיקת כמות נתונים: ${countError.message}`);
  if (oldestError) throw new Error(`שגיאה בבדיקת ההיסטוריה: ${oldestError.message}`);

  return {
    barCount: count || 0,
    oldestTimestamp: oldestRows?.[0]?.timestamp ?? null,
  };
}

function needsHistoricalTopUp(summary: MarketDataSummary): boolean {
  if (summary.barCount < HISTORY_TARGET_BARS) return true;
  if (!summary.oldestTimestamp) return true;
  return new Date(summary.oldestTimestamp) > getHistoryTargetDate();
}

export default function BacktestPage() {
  const { data: optimizations = [] } = useOptimizationResults();
  const { data: tracked = [] } = useTrackedSymbols();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  // Smart optimization UI state
  const allStages = getOptimizationStages();
  const [isRunning, setIsRunning] = useState(false);
  const [currentSymbol, setCurrentSymbol] = useState('');
  const [enabledStages, setEnabledStages] = useState<boolean[]>(() => allStages.map(() => true));
  const [stageStatuses, setStageStatuses] = useState<StageStatus[]>(() =>
    allStages.map(s => ({ stageNumber: s.stageNumber, stageName: s.name, status: 'pending' as const }))
  );
  const [stageResults, setStageResults] = useState<StageResult[]>([]);
  const [smartProgress, setSmartProgress] = useState<SmartOptimizationProgress | null>(null);
  const [stageProgressMap, setStageProgressMap] = useState<{ [stageNumber: number]: { current: number; total: number } }>({});
  const [overallCombinations, setOverallCombinations] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [combinationsPerSecond, setCombinationsPerSecond] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastComboCountRef = useRef<number>(0);
  const lastComboTimeRef = useRef<number>(0);

  // Elapsed timer
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime((Date.now() - startTimeRef.current) / 1000);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  const handleStageToggle = useCallback((stageIndex: number, enabled: boolean) => {
    setEnabledStages(prev => {
      const next = [...prev];
      next[stageIndex] = enabled;
      return next;
    });
  }, []);

  const handleSkipStage = useCallback(() => {
    // The skip is handled via abort + re-run logic; for now just log
    console.log('[Backtest] Skip stage requested');
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const resetState = useCallback(() => {
    setStageStatuses(allStages.map(s => ({ stageNumber: s.stageNumber, stageName: s.name, status: 'pending' as const })));
    setStageResults([]);
    setSmartProgress(null);
    setStageProgressMap({});
    setOverallCombinations({ current: 0, total: 0 });
    setElapsedTime(0);
    setCombinationsPerSecond(0);
    lastComboCountRef.current = 0;
    lastComboTimeRef.current = 0;
  }, [allStages]);

  const runOptimization = useCallback(async (symbol: string) => {
    if (isRunning) return;

    const controller = new AbortController();
    abortRef.current = controller;

    resetState();
    setIsRunning(true);
    setCurrentSymbol(symbol);

    try {
      const summary = await getMarketDataSummary(symbol);

      if (needsHistoricalTopUp(summary)) {
        const { data: dlResult, error: dlError } = await supabase.functions.invoke('download-historical-data', {
          body: { symbol, target_years: HISTORY_TARGET_YEARS, target_bars: HISTORY_TARGET_BARS },
        });
        if (dlError) throw new Error(`שגיאה בהורדת נתונים: ${dlError.message}`);
        const syncedBars = dlResult?.total_bars ?? dlResult?.bars_downloaded ?? summary.barCount;
        if (syncedBars < 200) throw new Error(`לא מספיק נתונים: ${syncedBars || 0} bars`);
        queryClient.invalidateQueries({ queryKey: ['tracked_symbols'] });
        toast({ title: `📊 ${symbol}`, description: `${syncedBars.toLocaleString()} bars (${(dlResult?.bars_added || 0).toLocaleString()} חדשים)` });
      }

      // Load all bars with pagination
      let allBars: any[] = [];
      let offset = 0;
      while (true) {
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const { data: page, error: pageErr } = await supabase
          .from('market_data')
          .select('timestamp, open, high, low, close, volume')
          .eq('symbol', symbol)
          .eq('interval', MARKET_DATA_INTERVAL)
          .order('timestamp', { ascending: true })
          .range(offset, offset + MARKET_DATA_PAGE_SIZE - 1);
        if (pageErr) throw new Error(`שגיאה בטעינת נתונים: ${pageErr.message}`);
        if (!page || page.length === 0) break;
        allBars.push(...page);
        offset += page.length;
        if (page.length < MARKET_DATA_PAGE_SIZE) break;
      }

      if (allBars.length < 200) throw new Error(`לא מספיק נתונים ל-${symbol}: ${allBars.length} bars`);
      console.log(`[Backtest] Loaded ${allBars.length.toLocaleString()} bars for ${symbol}`);

      const candles: Candle[] = allBars.map(bar => ({
        timestamp: new Date(bar.timestamp).getTime(),
        open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        volume: bar.volume || 0,
      }));

      // Train/Test split
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

      // Run optimizer
      const result = await runSmartOptimization(
        symbolData, NNE_PRESET_CONFIG, periodSplit, 'single', {},
        (progress) => {
          setSmartProgress(progress);
          
          // Update stage statuses
          setStageStatuses(prev => {
            const next = [...prev];
            for (let i = 0; i < next.length; i++) {
              if (i + 1 < progress.currentStage) {
                if (next[i].status !== 'completed' && next[i].status !== 'skipped') next[i].status = 'completed';
              } else if (i + 1 === progress.currentStage) {
                next[i].status = 'running';
              }
            }
            return next;
          });

          // Update stage progress map
          setStageProgressMap(prev => ({
            ...prev,
            [progress.currentStage]: { current: progress.current, total: progress.total },
          }));

          // Overall combos
          setOverallCombinations({ current: progress.current, total: progress.total });

          // Speed calc
          const now = Date.now();
          if (now - lastComboTimeRef.current > 2000) {
            const dt = (now - lastComboTimeRef.current) / 1000;
            const dc = progress.current - lastComboCountRef.current;
            if (dt > 0 && dc > 0) setCombinationsPerSecond(dc / dt);
            lastComboCountRef.current = progress.current;
            lastComboTimeRef.current = now;
          }
        },
        controller.signal,
        false, 'profit', true, true,
        enabledStages,
      );

      if (controller.signal.aborted) {
        setIsRunning(false);
        return;
      }

      // Evaluate with TestThresholdAgent
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

        await supabase.from('optimization_results').insert({
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

        queryClient.invalidateQueries({ queryKey: ['optimization_results'] });

        toast({
          title: `${evaluation.passed ? '✅' : '❌'} ${symbol} — ציון ${evaluation.score.toFixed(0)}/100`,
          description: `Train: ${trainReturn.toFixed(1)}% | Test: ${testReturn.toFixed(1)}%`,
        });
      }

      // Update stage results from optimizer result
      if (result.stageResults) setStageResults(result.stageResults);

      // Mark all stages completed
      setStageStatuses(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'completed' as const } : s));
      setIsRunning(false);
    } catch (err: any) {
      if (err.name === 'AbortError' || abortRef.current?.signal.aborted) {
        setIsRunning(false);
        return;
      }
      setIsRunning(false);
      toast({ title: '❌ שגיאה', description: err.message, variant: 'destructive' });
    }
  }, [isRunning, queryClient, enabledStages, resetState]);

  const showProgress = isRunning || stageResults.length > 0;

  return (
    <div className="space-y-4">
      <SymbolSearch onSelect={runOptimization} disabled={isRunning} />

      <div className="flex justify-between items-center">
        <span className="text-base font-semibold">S&P 500 — {tracked.length || "~420"} מניות</span>
        <span className="text-[11px] text-muted-foreground">✅ {tracked.filter((s: any) => s.is_active).length} פעילות | 🔬 {optimizations.length} נסרקו</span>
      </div>

      <div className="text-[10px] text-muted-foreground">
        💡 חפש מניה למעלה או לחץ בגריד להרצת אופטימיזציה אוטומטית | <span className="text-trading-profit">✅ עבר</span> · <span className="text-trading-loss">❌ נכשל</span> · ⬜ ממתין
      </div>

      {/* Inline progress card — no modal */}
      {showProgress && (
        <SmartOptimizationProgressCard
          stages={stageStatuses}
          currentStage={smartProgress?.currentStage || 0}
          totalStages={smartProgress?.totalStages || allStages.length}
          progress={smartProgress}
          stageResults={stageResults}
          onSkipStage={handleSkipStage}
          onStop={handleStop}
          elapsedTime={elapsedTime}
          isRunning={isRunning}
          enabledStages={enabledStages}
          onStageToggle={handleStageToggle}
          stageProgress={stageProgressMap}
          overallCombinations={overallCombinations}
          combinationsPerSecond={combinationsPerSecond}
          symbol={currentSymbol}
        />
      )}

      {tracked.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-1">
          {tracked.map((s: any) => {
            const opt = optimizations.find((o: any) => o.symbol === s.symbol);
            const isActive = opt?.is_active;
            const bg = isActive ? "rgba(52,211,153,0.08)" : opt ? "rgba(248,113,113,0.06)" : "hsl(var(--surface))";
            const border = isActive ? "hsl(var(--trading-profit))" : opt ? "hsl(var(--trading-loss))" : "hsl(var(--border))";
            const color = isActive ? "hsl(var(--trading-profit))" : opt ? "hsl(var(--trading-loss))" : "hsl(var(--muted-foreground))";
            const icon = isActive ? "✅" : opt ? "❌" : "";
            const isOptimizing = isRunning && currentSymbol === s.symbol;
            return (
              <div
                key={s.symbol}
                onClick={() => runOptimization(s.symbol)}
                className={cn(
                  "rounded-lg p-1.5 text-center cursor-pointer transition-all text-xs hover:scale-105",
                  isOptimizing && "animate-pulse ring-2 ring-primary"
                )}
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <div className="font-bold" style={{ color }}>{icon} {s.symbol}</div>
                {opt?.test_return != null && (
                  <div className="font-mono text-[9px] text-muted-foreground">
                    {opt.test_return >= 0 ? "+" : ""}{opt.test_return.toFixed(0)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {optimizations.length > 0 ? (
        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">תוצאות ({optimizations.length})</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <div className="row-item text-[10px] text-muted-foreground font-semibold sticky top-0 z-10" style={{ background: 'hsl(var(--surface))' }}>
              <span className="w-[60px]">סימול</span>
              <span className="w-[65px]">אימון</span>
              <span className="w-[65px]">מבחן</span>
              <span className="w-[45px]">WR</span>
              <span className="w-[50px]">DD</span>
              <span className="w-[50px]">ציון</span>
              <span className="flex-1 text-left">סטטוס</span>
            </div>
            {optimizations
              .sort((a: any, b: any) => (b.test_return || 0) - (a.test_return || 0))
              .map((o: any) => {
                const rc = o.overfit_risk === "low" ? "hsl(var(--trading-profit))" : o.overfit_risk === "medium" ? "hsl(var(--trading-warning))" : "hsl(var(--trading-loss))";
                return (
                  <div key={o.id} className="row-item cursor-pointer">
                    <span className="font-bold w-[60px]">{o.symbol}</span>
                    <span className={cn("font-mono w-[65px]", (o.train_return || 0) >= 0 ? "text-trading-profit" : "text-trading-loss")}>
                      {(o.train_return || 0) >= 0 ? "+" : ""}{(o.train_return || 0).toFixed(1)}%
                    </span>
                    <span className={cn("font-mono w-[65px]", (o.test_return || 0) >= 0 ? "text-primary" : "text-trading-loss")}>
                      {(o.test_return || 0) >= 0 ? "+" : ""}{(o.test_return || 0).toFixed(1)}%
                    </span>
                    <span className="font-mono w-[45px]">{o.win_rate || 0}%</span>
                    <span className="font-mono text-trading-loss w-[50px]">{(o.max_drawdown || 0).toFixed(1)}%</span>
                    <span className="font-mono w-[50px]">{(o.agent_confidence || 0).toFixed(0)}</span>
                    <span className="badge-pill" style={{ background: rc + "18", color: rc }}>
                      {o.is_active ? "✅ עבר" : "❌ נכשל"}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        <div className="surface-card">
          <div className="empty-state">
            <div className="empty-state-icon">🔬</div>
            <div className="empty-state-text">אין תוצאות אופטימיזציה עדיין</div>
            <div className="empty-state-sub">חפש מניה למעלה או לחץ על מניה בגריד</div>
          </div>
        </div>
      )}
    </div>
  );
}
