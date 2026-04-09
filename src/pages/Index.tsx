import { usePositions, useSignals, useOptimizationResults, useTrackedSymbols } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  const { data: positions = [] } = usePositions("open");
  const { data: allPositions = [] } = usePositions();
  const { data: signals = [] } = useSignals(20);
  const { data: optimizations = [] } = useOptimizationResults();
  const { data: symbols = [] } = useTrackedSymbols();

  const closedPositions = allPositions.filter((p: any) => p.status === "closed");
  const totalPnl = closedPositions.reduce((s: number, p: any) => s + (p.pnl_pct || 0), 0);

  const today = new Date().toISOString().split("T")[0];
  const todaySignals = signals.filter((s: any) => s.timestamp?.startsWith(today));

  return (
    <div className="space-y-5">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <div className="stat-box">
          <div className="text-[11px] text-muted-foreground font-medium mb-1.5">פוזיציות פתוחות</div>
          <div className="text-2xl font-bold font-mono text-primary">{positions.length}</div>
          <div className="text-[10px] text-muted-foreground mt-1">מקסימום: 10</div>
        </div>
        <div className="stat-box">
          <div className="text-[11px] text-muted-foreground font-medium mb-1.5">סיגנלים היום</div>
          <div className="text-2xl font-bold font-mono text-trading-warning">{todaySignals.length}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{closedPositions.length} עסקאות</div>
        </div>
        <div className="stat-box">
          <div className="text-[11px] text-muted-foreground font-medium mb-1.5">נסחרות</div>
          <div className="text-2xl font-bold font-mono text-trading-profit">{symbols.length}</div>
          <div className="text-[10px] text-muted-foreground mt-1">מתוך {optimizations.length} שעברו</div>
        </div>
        <div className="stat-box">
          <div className="text-[11px] text-muted-foreground font-medium mb-1.5">WebSocket</div>
          <div className="text-2xl font-bold" style={{ color: 'hsl(var(--trading-warning))' }}>●</div>
          <div className="text-[10px] text-muted-foreground mt-1">API</div>
        </div>
        <div className="stat-box">
          <div className="text-[11px] text-muted-foreground font-medium mb-1.5">Uptime</div>
          <div className="text-2xl font-bold font-mono text-foreground">--</div>
          <div className="text-[10px] text-muted-foreground mt-1">Railway</div>
        </div>
      </div>

      {/* Tracked symbols */}
      {symbols.length > 0 && (
        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">🏆 Top 8 — נסחרות עכשיו</span>
            <span className="text-[10px] text-muted-foreground">{symbols.length} פעילות</span>
          </div>
          {symbols.slice(0, 8).map((s: any) => {
            const hasPos = positions.find((p: any) => p.symbol === s.symbol);
            return (
              <div key={s.symbol} className="row-item cursor-pointer">
                <span className="font-bold w-14">{s.symbol}</span>
                <span className="font-mono text-muted-foreground w-[75px]">--</span>
                <span className="flex-1" />
                {hasPos && (
                  <span className="badge-pill" style={{ background: 'hsla(217,91%,60%,0.12)', color: 'hsl(var(--primary))' }}>
                    פוזיציה
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Positions + Decisions */}
      <div className="grid md:grid-cols-2 gap-3.5">
        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">פוזיציות ({positions.length})</span>
          </div>
          {positions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-text">אין פוזיציות פתוחות</div>
            </div>
          ) : (
            positions.slice(0, 10).map((p: any) => (
              <div key={p.id} className="row-item">
                <span className="font-bold w-12">{p.symbol || "--"}</span>
                <span className={cn("text-[10px] font-semibold w-9", p.direction === "long" ? "text-trading-profit" : "text-trading-loss")}>
                  {p.direction === "long" ? "לונג" : "שורט"}
                </span>
                <span className="font-mono text-muted-foreground w-[60px]">${(p.entry_price || 0).toFixed(2)}</span>
                <span className={cn("font-mono font-bold flex-1 text-left", (p.pnl_pct || 0) >= 0 ? "text-trading-profit" : "text-trading-loss")}>
                  {(p.pnl_pct || 0) >= 0 ? "+" : ""}{(p.pnl_pct || 0).toFixed(2)}%
                </span>
              </div>
            ))
          )}
        </div>

        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">סיגנלים אחרונים</span>
          </div>
          {signals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🤖</div>
              <div className="empty-state-text">ממתין לסיגנלים</div>
              <div className="empty-state-sub">כשהשוק ייפתח, תראה כאן את הסיגנלים</div>
            </div>
          ) : (
            signals.slice(0, 6).map((s: any) => {
              const verdict = s.action || "?";
              const vc = verdict.includes("ENTER") ? "hsl(var(--trading-profit))" : verdict.includes("BLOCK") ? "hsl(var(--trading-loss))" : "hsl(var(--trading-warning))";
              return (
                <div key={s.id} className="row-item">
                  <span className="font-mono text-muted-foreground w-[50px] text-[10px]">
                    {(s.timestamp || "").substring(11, 19)}
                  </span>
                  <span className="font-bold w-11">{s.symbol || "--"}</span>
                  <span className="flex-1" />
                  <span className="badge-pill" style={{ background: vc + "18", color: vc }}>{verdict}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
