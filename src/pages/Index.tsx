import { usePositions, useSignals, useOptimizationResults, useTrackedSymbols, useWeeklyReviews } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  const { data: positions = [] } = usePositions("open");
  const { data: allPositions = [] } = usePositions();
  const { data: signals = [] } = useSignals(20);
  const { data: optimizations = [] } = useOptimizationResults();
  const { data: symbols = [] } = useTrackedSymbols();
  const { data: weeklyReviews = [] } = useWeeklyReviews();

  const closedPositions = allPositions.filter((p: any) => p.status === "closed");
  const totalPnl = closedPositions.reduce((s: number, p: any) => s + (p.pnl_pct || 0), 0);
  const today = new Date().toISOString().split("T")[0];
  const todaySignals = signals.filter((s: any) => s.timestamp?.startsWith(today));
  const latestReview = weeklyReviews[0];

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
          <div className="text-[11px] text-muted-foreground font-medium mb-1.5">PnL מצטבר</div>
          <div className={cn("text-2xl font-bold font-mono", totalPnl >= 0 ? "text-trading-profit" : "text-trading-loss")}>
            {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">{closedPositions.length} עסקאות</div>
        </div>
        <div className="stat-box">
          <div className="text-[11px] text-muted-foreground font-medium mb-1.5">Uptime</div>
          <div className="text-2xl font-bold font-mono text-foreground">--</div>
          <div className="text-[10px] text-muted-foreground mt-1">Railway</div>
        </div>
      </div>

      {/* Weekly AI Review */}
      {latestReview && (
        <div className="surface-card p-[18px]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">📅</span>
            <span className="text-sm font-semibold">סקירה שבועית אחרונה</span>
            <span className="text-[10px] text-muted-foreground mr-auto">
              {latestReview.created_at ? new Date(latestReview.created_at).toLocaleDateString("he-IL") : ""}
            </span>
          </div>
          <div className="text-xs font-semibold mb-1">{latestReview.summary}</div>
          {latestReview.reasoning && <div className="text-[11px] text-muted-foreground mb-2">{latestReview.reasoning}</div>}
          {latestReview.market_insight && (
            <div className="text-[11px] p-2 rounded-lg" style={{ background: "rgba(59,130,246,0.06)" }}>
              <span className="text-primary font-semibold">תובנת שוק: </span>{latestReview.market_insight}
            </div>
          )}
          {Array.isArray(latestReview.agent_lessons) && latestReview.agent_lessons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(latestReview.agent_lessons as any[]).slice(0, 5).map((l: any, i: number) => (
                <span key={i} className="badge-pill" style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}>
                  {l.agent}: {l.lesson || l.message}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Positions + Signals */}
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
