import { useState, useRef, useCallback } from "react";
import { useOptimizationResults, useTrackedSymbols } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import OptimizationProgress, { OptimizationStatus } from "@/components/backtest/OptimizationProgress";
import { runSmartOptimization } from "@/lib/optimizer/smartOptimizer";
import { NNE_PRESET_CONFIG } from "@/lib/optimizer/presetConfigs";
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

  const handleSymbolClick = useCallback(async (symbol: string) => {
    if (optStatus.isRunning) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setOptStatus({
      isRunning: true, symbol, stageName: 'טוען נתונים...', stageDescription: `טוען נתוני ${symbol} מהDB`,
      currentStage: 0, totalStages: 21, percent: 0,
    });

    try {
      // 1. Fetch market data for symbol
      const { data: marketData, error } = await supabase
        .from('market_data')
        .select('*')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: true });

      if (error) throw new Error(`שגיאה בטעינת נתונים: ${error.message}`);
      if (!marketData || marketData.length < 200) {
        throw new Error(`לא מספיק נתונים ל-${symbol}: ${marketData?.length || 0} bars (צריך לפחות 200)`);
      }

      // 2. Convert to Candle format
      const candles: Candle[] = marketData.map(bar => ({
        timestamp: new Date(bar.timestamp).getTime(),
        open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        volume: bar.volume || 0,
      }));

      // 3. Auto split 70/30
      const splitIdx = Math.floor(candles.length * 0.7);
      const periodSplit: PeriodSplit = {
        trainStartDate: new Date(candles[0].timestamp),
        trainEndDate: new Date(candles[splitIdx - 1].timestamp),
        testStartDate: new Date(candles[splitIdx].timestamp),
        testEndDate: new Date(candles[candles.length - 1].timestamp),
        trainPercent: 70,
      };

      const symbolData: SymbolData[] = [{
        symbol,
        candles,
        startDate: new Date(candles[0].timestamp),
        endDate: new Date(candles[candles.length - 1].timestamp),
      }];

      // 4. Run smart optimization
      const result = await runSmartOptimization(
        symbolData, NNE_PRESET_CONFIG, periodSplit, 'single', {},
        (progress) => {
          setOptStatus(prev => ({
            ...prev,
            stageName: progress.stageName,
            stageDescription: progress.stageDescription,
            currentStage: progress.currentStage,
            totalStages: progress.totalStages,
            percent: Math.round((progress.currentStage / progress.totalStages) * 100),
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

      // 5. Save results to DB
      const best = result.finalResult.bestForProfit;
      if (best) {
        const trainReturn = best.totalTrainReturn;
        const testReturn = best.totalTestReturn;
        const overfit = trainReturn > 0 ? Math.abs(trainReturn - testReturn) / trainReturn : 0;
        const overfitRisk = overfit < 0.3 ? 'low' : overfit < 0.6 ? 'medium' : 'high';
        const isActive = testReturn > 0 && overfitRisk !== 'high';

        const trainResult = best.trainResults[0]?.result;
        const testResult = best.testResults[0]?.result;

        await supabase.from('optimization_results').insert({
          symbol,
          parameters: best.parameters as any,
          train_return: trainReturn,
          test_return: testReturn,
          is_active: isActive,
          overfit_risk: overfitRisk,
          win_rate: testResult?.winRate || trainResult?.winRate || 0,
          max_drawdown: testResult?.maxDrawdown || trainResult?.maxDrawdown || 0,
          sharpe_ratio: testResult?.sharpeRatio || trainResult?.sharpeRatio || 0,
          total_trades: (trainResult?.totalTrades || 0) + (testResult?.totalTrades || 0),
          agent_decision: isActive ? 'approved' : 'rejected',
          agent_confidence: Math.max(0, Math.min(100, (1 - overfit) * 100)),
        });

        queryClient.invalidateQueries({ queryKey: ['optimization_results'] });
        toast({ title: `✅ ${symbol} — אופטימיזציה הושלמה`, description: `אימון: ${trainReturn.toFixed(1)}% | מבחן: ${testReturn.toFixed(1)}%` });
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
      <div className="flex justify-between items-center">
        <span className="text-base font-semibold">S&P 500 — {tracked.length || "~420"} מניות</span>
        <span className="text-[11px] text-muted-foreground">✅ {tracked.filter((s: any) => s.is_active).length} פעילות | 🔬 {optimizations.length} נסרקו</span>
      </div>

      <div className="text-[10px] text-muted-foreground">
        💡 לחץ על מניה כדי להריץ אופטימיזציה אוטומטית | <span className="text-trading-profit">✅ פעיל</span> · <span className="text-trading-loss">❌ נכשל</span> · ⬜ ממתין
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
                onClick={() => handleSymbolClick(s.symbol)}
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
                    <span className="badge-pill" style={{ background: rc + "18", color: rc }}>
                      {o.is_active ? "✅ פעיל" : "❌ לא פעיל"}
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
            <div className="empty-state-sub">לחץ על מניה כדי להריץ אופטימיזציה</div>
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
