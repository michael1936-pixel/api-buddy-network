import { useState, useRef, useCallback } from "react";
import { useOptimizationResults, useTrackedSymbols } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import OptimizationProgress, { OptimizationStatus } from "@/components/backtest/OptimizationProgress";
import SymbolSearch from "@/components/backtest/SymbolSearch";
import { runSmartOptimization } from "@/lib/optimizer/smartOptimizer";
import { NNE_PRESET_CONFIG } from "@/lib/optimizer/presetConfigs";
import { TrainTestSplitAgent } from "@/lib/optimizer/trainTestSplitAgent";
import { TestThresholdAgent } from "@/lib/optimizer/testThresholdAgent";
import type { SymbolData, Candle, PeriodSplit } from "@/lib/optimizer/types";

export default function BacktestPage() {
  const { data: optimizations = [] } = useOptimizationResults();
  const { data: tracked = [] } = useTrackedSymbols();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const [optStatus, setOptStatus] = useState<OptimizationStatus>({
    isRunning: false, symbol: '', stageName: '', stageDescription: '',
    currentStage: 0, totalStages: 0, percent: 0,
  });

  const runOptimization = useCallback(async (symbol: string) => {
    if (optStatus.isRunning) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setOptStatus({
      isRunning: true, symbol, stageName: 'בודק נתונים...', stageDescription: `בודק כמות נתונים עבור ${symbol}`,
      currentStage: 0, totalStages: 21, percent: 0,
    });

    try {
      // 1. Check how many bars we have
      const { count } = await supabase
        .from('market_data')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', symbol);

      const barCount = count || 0;

      // 2. If not enough bars, download from Twelve Data
      if (barCount < 200) {
        setOptStatus(prev => ({
          ...prev, stageName: 'מוריד נתונים...', stageDescription: `מוריד נתוני ${symbol} מ-Twelve Data (5 שנים)`,
          percent: 2,
        }));

        const { data: dlResult, error: dlError } = await supabase.functions.invoke('download-historical-data', {
          body: { symbol },
        });

        if (dlError) throw new Error(`שגיאה בהורדת נתונים: ${dlError.message}`);
        if (!dlResult?.bars_downloaded || dlResult.bars_downloaded < 200) {
          throw new Error(`לא הצלחתי להוריד מספיק נתונים: ${dlResult?.bars_downloaded || 0} bars`);
        }

        // Refresh tracked symbols
        queryClient.invalidateQueries({ queryKey: ['tracked_symbols'] });

        toast({ title: `📊 ${symbol}`, description: `הורדו ${dlResult.bars_downloaded.toLocaleString()} bars` });
      }

      // 3. Load data from DB
      setOptStatus(prev => ({
        ...prev, stageName: 'טוען נתונים...', stageDescription: `טוען נתוני ${symbol} מה-DB`,
        percent: 5,
      }));

      // Paginated fetch — get ALL bars (Supabase default limit is 1000)
      let allBars: any[] = [];
      const PAGE_SIZE = 1000;
      let offset = 0;
      let keepFetching = true;

      while (keepFetching) {
        const { data: page, error: pageErr } = await supabase
          .from('market_data')
          .select('*')
          .eq('symbol', symbol)
          .order('timestamp', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (pageErr) throw new Error(`שגיאה בטעינת נתונים: ${pageErr.message}`);
        if (!page || page.length === 0) { keepFetching = false; break; }

        allBars = allBars.concat(page);
        offset += PAGE_SIZE;

        setOptStatus(prev => ({
          ...prev, stageDescription: `טוען נתוני ${symbol}... ${allBars.length.toLocaleString()} bars`,
        }));

        if (page.length < PAGE_SIZE) keepFetching = false;
      }

      const marketData = allBars;
      if (marketData.length < 200) {
        throw new Error(`לא מספיק נתונים ל-${symbol}: ${marketData.length} bars (צריך לפחות 200)`);
      }

      console.log(`[Backtest] Loaded ${marketData.length.toLocaleString()} bars for ${symbol}`);

      // 4. Convert to Candle format
      const candles: Candle[] = marketData.map(bar => ({
        timestamp: new Date(bar.timestamp).getTime(),
        open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        volume: bar.volume || 0,
      }));

      // 5. Load TrainTestSplitAgent for dynamic split
      setOptStatus(prev => ({
        ...prev, stageName: 'טוען סוכנים...', stageDescription: 'טוען סוכן Train/Test Split',
        percent: 8,
      }));

      const splitAgent = new TrainTestSplitAgent();
      await splitAgent.load();
      const trainPercent = splitAgent.getRecommendedSplit('15min');
      const splitRec = splitAgent.getRecommendation();

      console.log(`[Backtest] Using train/test split: ${trainPercent}/${100 - trainPercent} (confidence: ${splitRec.confidence}%)`);

      // 6. Build period split
      const splitIdx = Math.floor(candles.length * (trainPercent / 100));
      const periodSplit: PeriodSplit = {
        trainStartDate: new Date(candles[0].timestamp),
        trainEndDate: new Date(candles[splitIdx - 1].timestamp),
        testStartDate: new Date(candles[splitIdx].timestamp),
        testEndDate: new Date(candles[candles.length - 1].timestamp),
        trainPercent,
      };

      const symbolData: SymbolData[] = [{
        symbol,
        candles,
        startDate: new Date(candles[0].timestamp),
        endDate: new Date(candles[candles.length - 1].timestamp),
      }];

      // 7. Run smart optimization
      const result = await runSmartOptimization(
        symbolData, NNE_PRESET_CONFIG, periodSplit, 'single', {},
        (progress) => {
          setOptStatus(prev => ({
            ...prev,
            stageName: progress.stageName,
            stageDescription: progress.stageDescription,
            currentStage: progress.currentStage,
            totalStages: progress.totalStages,
            percent: Math.round(10 + (progress.currentStage / progress.totalStages) * 85),
            bestTrainReturn: progress.bestTrainReturn,
            bestTestReturn: progress.bestTestReturn,
          }));
        },
        controller.signal,
        false, 'profit', true, true,
      );

      if (controller.signal.aborted) {
        setOptStatus(prev => ({ ...prev, isRunning: false, completed: false }));
        return;
      }

      // 8. Evaluate with TestThresholdAgent
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

        setOptStatus(prev => ({
          ...prev, stageName: 'מעריך תוצאות...', stageDescription: 'סוכן Test Threshold מעריך',
          percent: 97,
        }));

        const thresholdAgent = new TestThresholdAgent();
        await thresholdAgent.load();
        const evaluation = thresholdAgent.evaluate({
          trainReturn, testReturn, winRate, maxDrawdown, sharpeRatio, totalTrades,
        });

        console.log(`[Backtest] Evaluation: score=${evaluation.score}, passed=${evaluation.passed}`, evaluation.reasons);

        const overfit = trainReturn > 0 ? Math.abs(trainReturn - testReturn) / trainReturn : 0;
        const overfitRisk = overfit < 0.3 ? 'low' : overfit < 0.6 ? 'medium' : 'high';

        // 9. Save results to DB
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

        const emoji = evaluation.passed ? '✅' : '❌';
        toast({
          title: `${emoji} ${symbol} — ציון ${evaluation.score.toFixed(0)}/100`,
          description: `Train: ${trainReturn.toFixed(1)}% | Test: ${testReturn.toFixed(1)}% | Split: ${trainPercent}/${100 - trainPercent}${evaluation.reasons.length > 0 ? '\n' + evaluation.reasons[0] : ''}`,
        });
      }

      setOptStatus(prev => ({ ...prev, isRunning: false, completed: true }));
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        setOptStatus(prev => ({ ...prev, isRunning: false }));
        return;
      }
      setOptStatus(prev => ({ ...prev, isRunning: false, error: err.message }));
      toast({ title: '❌ שגיאה', description: err.message, variant: 'destructive' });
    }
  }, [optStatus.isRunning, queryClient]);

  const handleCancel = () => {
    abortRef.current?.abort();
    setOptStatus(prev => ({ ...prev, isRunning: false }));
  };

  const handleClose = () => {
    setOptStatus({ isRunning: false, symbol: '', stageName: '', stageDescription: '', currentStage: 0, totalStages: 0, percent: 0 });
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <SymbolSearch onSelect={runOptimization} disabled={optStatus.isRunning} />

      <div className="flex justify-between items-center">
        <span className="text-base font-semibold">S&P 500 — {tracked.length || "~420"} מניות</span>
        <span className="text-[11px] text-muted-foreground">✅ {tracked.filter((s: any) => s.is_active).length} פעילות | 🔬 {optimizations.length} נסרקו</span>
      </div>

      <div className="text-[10px] text-muted-foreground">
        💡 חפש מניה למעלה או לחץ בגריד להרצת אופטימיזציה אוטומטית | <span className="text-trading-profit">✅ עבר</span> · <span className="text-trading-loss">❌ נכשל</span> · ⬜ ממתין
      </div>

      {tracked.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-1">
          {tracked.map((s: any) => {
            const opt = optimizations.find((o: any) => o.symbol === s.symbol);
            const isActive = opt?.is_active;
            const bg = isActive ? "rgba(52,211,153,0.08)" : opt ? "rgba(248,113,113,0.06)" : "hsl(var(--surface))";
            const border = isActive ? "hsl(var(--trading-profit))" : opt ? "hsl(var(--trading-loss))" : "hsl(var(--border))";
            const color = isActive ? "hsl(var(--trading-profit))" : opt ? "hsl(var(--trading-loss))" : "hsl(var(--muted-foreground))";
            const icon = isActive ? "✅" : opt ? "❌" : "";
            const isOptimizing = optStatus.isRunning && optStatus.symbol === s.symbol;
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

      <OptimizationProgress
        status={optStatus}
        onCancel={handleCancel}
        onClose={handleClose}
      />
    </div>
  );
}
