import { useOptimizationResults, useTrackedSymbols } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";

export default function BacktestPage() {
  const { data: optimizations = [] } = useOptimizationResults();
  const { data: tracked = [] } = useTrackedSymbols();

  return (
    <div className="space-y-4">
      {/* SP500 Grid Header */}
      <div className="flex justify-between items-center">
        <span className="text-base font-semibold">S&P 500 — {tracked.length || "~420"} מניות</span>
        <span className="text-[11px] text-muted-foreground">✅ {tracked.filter((s: any) => s.is_active).length} פעילות | 🔬 {optimizations.length} נסרקו</span>
      </div>

      {/* Tracked symbols grid */}
      {tracked.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-1">
          {tracked.map((s: any) => {
            const opt = optimizations.find((o: any) => o.symbol === s.symbol);
            const isActive = opt?.is_active;
            const bg = isActive ? "rgba(52,211,153,0.08)" : opt ? "rgba(248,113,113,0.06)" : "hsl(var(--surface))";
            const border = isActive ? "hsl(var(--trading-profit))" : opt ? "hsl(var(--trading-loss))" : "hsl(var(--border))";
            const color = isActive ? "hsl(var(--trading-profit))" : opt ? "hsl(var(--trading-loss))" : "hsl(var(--muted-foreground))";
            const icon = isActive ? "✅" : opt ? "❌" : "";
            return (
              <div
                key={s.symbol}
                className="rounded-lg p-1.5 text-center cursor-pointer transition-all text-xs hover:scale-105"
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

      {/* Results table */}
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
            <div className="empty-state-sub">השרת צריך להריץ מחזורי אופטימיזציה</div>
          </div>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground">
        💡 לחץ על מניה כדי להוריד נתונים ולהריץ אופטימיזציה | <span className="text-trading-profit">✅ פעיל</span> · <span className="text-trading-loss">❌ נכשל</span> · ⬜ ממתין
      </div>
    </div>
  );
}
