import { useOptimizationResults, useTrackedSymbols } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { SmartOptimizationProgressCard } from "@/components/backtest/OptimizationProgress";
import SymbolSearch from "@/components/backtest/SymbolSearch";
import { useOptimizationStore, allStages } from "@/stores/optimizationStore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { estimateAllStageCombinations } from "@/lib/optimizer/smartOptimizer";
import { NNE_PRESET_CONFIG } from "@/lib/optimizer/presetConfigs";
import { Badge } from "@/components/ui/badge";

type ResultFilter = 'all' | 'approved' | 'rejected';

export default function BacktestPage() {
  const [filter, setFilter] = useState<ResultFilter>('all');
  const { data: optimizations = [] } = useOptimizationResults(filter);
  const { data: tracked = [] } = useTrackedSymbols();
  const queryClient = useQueryClient();
  const lastToastRef = useRef<string>('');

  const {
    isRunning, currentSymbol, enabledStages, stageStatuses, stageResults,
    smartProgress, stageProgressMap, overallCombinations, elapsedTime,
    combinationsPerSecond, error, bestTrainReturn, bestTestReturn,
    symbolQueue, queueIndex, queueResults, stageEstimates,
    serverStatus, secondsSinceLastUpdate, lastServerUpdateAt,
    runOptimization, runOptimizationQueue, addToQueue, stopOptimization, toggleStage, rehydrate,
  } = useOptimizationStore();

  // Compute stage estimates once
  const computedEstimates = useMemo(() => {
    if (Object.keys(stageEstimates).length > 0) return stageEstimates;
    return estimateAllStageCombinations(NNE_PRESET_CONFIG);
  }, [stageEstimates]);

  useEffect(() => { rehydrate(); }, []);

  useEffect(() => {
    if (error && error !== lastToastRef.current) {
      lastToastRef.current = error;
      toast({ title: '❌ שגיאה', description: error, variant: 'destructive' });
    }
  }, [error]);

  const handleRunOptimization = useCallback((symbol: string) => {
    runOptimization(symbol, queryClient);
  }, [runOptimization, queryClient]);

  const handleRunQueue = useCallback((symbols: string[]) => {
    runOptimizationQueue(symbols, queryClient);
  }, [runOptimizationQueue, queryClient]);

  const handleAddToQueue = useCallback((symbols: string[]) => {
    addToQueue(symbols);
  }, [addToQueue]);

  const handleSkipStage = useCallback(() => {
    // Skip stage not yet implemented on server side
  }, []);

  const showProgress = isRunning || stageResults.length > 0;

  return (
    <div className="space-y-4">
      <SymbolSearch onSelect={handleRunOptimization} onRunQueue={handleRunQueue} onAddToQueue={handleAddToQueue} isRunning={isRunning} />

      {/* Queue status */}
      {symbolQueue.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">תור:</span>
          {symbolQueue.map((s, i) => {
            const status = queueResults[s] || 'pending';
            const icon = status === 'done' ? '✅' : status === 'running' ? '🔄' : status === 'failed' ? '❌' : '⬜';
            return (
              <Badge key={s} variant={status === 'running' ? 'default' : 'secondary'} className={cn("text-xs font-mono gap-1", status === 'running' && "animate-pulse")}>
                {icon} {s}
              </Badge>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-base font-semibold">S&P 500 — {tracked.length || "~420"} מניות</span>
        <span className="text-[11px] text-muted-foreground">✅ {tracked.filter((s: any) => s.is_active).length} פעילות | 🔬 {optimizations.length} נסרקו</span>
      </div>

      <div className="text-[10px] text-muted-foreground">
        💡 חפש מניה למעלה או לחץ בגריד להרצת אופטימיזציה אוטומטית | <span className="text-trading-profit">✅ עבר</span> · <span className="text-trading-loss">❌ נכשל</span> · ⬜ ממתין
      </div>

      {showProgress && (
        <SmartOptimizationProgressCard
          stages={stageStatuses}
          currentStage={smartProgress?.currentStage || 0}
          totalStages={smartProgress?.totalStages || allStages.length}
          progress={smartProgress}
          stageResults={stageResults}
          onSkipStage={handleSkipStage}
          onStop={stopOptimization}
          elapsedTime={elapsedTime}
          isRunning={isRunning}
          enabledStages={enabledStages}
          onStageToggle={toggleStage}
          stageProgress={stageProgressMap}
          overallCombinations={overallCombinations}
          combinationsPerSecond={combinationsPerSecond}
          symbol={currentSymbol}
          bestTrainReturn={bestTrainReturn}
          bestTestReturn={bestTestReturn}
          stageEstimates={computedEstimates}
          serverStatus={serverStatus}
          secondsSinceLastUpdate={secondsSinceLastUpdate}
          lastServerUpdateAt={lastServerUpdateAt}
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
                onClick={() => handleRunOptimization(s.symbol)}
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

      {/* Results with filter tabs */}
      <div className="surface-card">
        <div className="surface-card-head flex items-center justify-between">
          <span className="text-sm font-semibold">תוצאות ({optimizations.length})</span>
          <div className="flex gap-1">
            {([['all', 'הכל'], ['approved', '✅ מאושרות'], ['rejected', '❌ נדחו']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded transition-colors",
                  filter === key ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {optimizations.length > 0 ? (
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
                    <span className="font-mono w-[50px]" style={{ color: rc }}>
                      {(o.max_drawdown || 0).toFixed(0)}%
                    </span>
                    <span className="font-mono w-[50px]">{o.agent_confidence?.toFixed(0) || '-'}</span>
                    <span className="flex-1 text-left">
                      <span className={cn("text-[10px] px-1 rounded", o.is_active ? "bg-trading-profit/20 text-trading-profit" : "bg-trading-loss/20 text-trading-loss")}>
                        {o.agent_decision === 'approved' ? '✅ מאושר' : '❌ נדחה'}
                      </span>
                    </span>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-10">
            אין תוצאות אופטימיזציה — בחר מניה להתחלה
          </div>
        )}
      </div>
    </div>
  );
}
