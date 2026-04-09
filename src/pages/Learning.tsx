import { useAIInsights, useTradeSummaries, useKnowledgeLearning, useWeeklyReviews } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";

function computePrincipleRankings(kl: any[]) {
  const map: Record<string, { applied: number; wins: number; violated: number; losses: number }> = {};
  kl.forEach((k) => {
    (k.principles_applied || []).forEach((p: string) => {
      if (!map[p]) map[p] = { applied: 0, wins: 0, violated: 0, losses: 0 };
      map[p].applied++;
      if (k.is_win) map[p].wins++;
    });
    (k.principles_violated || []).forEach((p: string) => {
      if (!map[p]) map[p] = { applied: 0, wins: 0, violated: 0, losses: 0 };
      map[p].violated++;
      if (!k.is_win) map[p].losses++;
    });
  });
  return Object.entries(map)
    .map(([name, v]) => {
      const total = v.applied + v.violated;
      const acc = total > 0 ? Math.round((v.wins / Math.max(1, v.applied)) * 100) : 0;
      return { name, ...v, total, acc };
    })
    .sort((a, b) => b.total - a.total);
}

export default function LearningPage() {
  const { data: insights = [] } = useAIInsights(50);
  const { data: summaries = [] } = useTradeSummaries();
  const { data: kl = [] } = useKnowledgeLearning(500);
  const { data: weeklyReviews = [] } = useWeeklyReviews();

  const principles = computePrincipleRankings(kl);
  const weeklySummaries = summaries.filter((s: any) => s.period?.startsWith("week"));

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3.5">
        {/* Principle Rankings */}
        <div className="surface-card p-[18px]">
          <div className="text-sm font-semibold mb-3.5">📏 דירוג עקרונות ({principles.length})</div>
          {principles.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {principles.slice(0, 25).map((p) => {
                const c = p.acc >= 70 ? "hsl(var(--trading-profit))" : p.acc >= 50 ? "hsl(var(--trading-warning))" : "hsl(var(--trading-loss))";
                return (
                  <div key={p.name}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="truncate flex-1 font-medium">{p.name}</span>
                      <span className="font-mono font-semibold mr-2" style={{ color: c }}>{p.acc}%</span>
                      <span className="text-[10px] text-muted-foreground">{p.applied} יישומים | {p.violated} הפרות</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${p.acc}%`, background: c }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-text">העקרונות ילמדו מעסקאות</div>
              <div className="empty-state-sub">אחרי שהמערכת תסחור, תראה כאן דירוג עקרונות לפי דיוק</div>
            </div>
          )}
        </div>

        <div>
          {/* Knowledge base stats */}
          <div className="surface-card p-[18px] mb-3.5">
            <div className="text-sm font-semibold mb-3.5">בסיס ידע</div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { v: "51", l: "ספרים", c: "#a78bfa" },
                { v: "149", l: "עקרונות", c: "hsl(var(--primary))" },
                { v: String(kl.length), l: "עסקאות מנותחות", c: "hsl(var(--trading-profit))" },
                { v: String(principles.length), l: "כללים פעילים", c: "hsl(var(--trading-warning))" },
              ].map((d) => (
                <div key={d.l} className="text-center p-3.5 rounded-lg border" style={{ background: d.c + "08", borderColor: d.c + "15" }}>
                  <div className="font-mono text-2xl font-bold" style={{ color: d.c }}>{d.v}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{d.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly summaries */}
          {summaries.length > 0 && (
            <div className="surface-card p-[18px]">
              <div className="text-sm font-semibold mb-3">סיכומים חודשיים</div>
              {summaries.filter((s: any) => !s.period?.startsWith("week")).map((m: any) => {
                const s = m.summary || {};
                return (
                  <div key={m.period} className="row-item">
                    <span className="font-semibold w-[60px]">{m.period}</span>
                    <span className="text-muted-foreground">{s.totalTrades || m.trade_count || 0} עסקאות</span>
                    <span className={cn("font-mono", (s.winRate || 0) >= 50 ? "text-trading-profit" : "text-trading-loss")}>
                      {(s.winRate || 0).toFixed(0)}%
                    </span>
                    <span className={cn("font-mono font-bold", (s.totalPnl || 0) >= 0 ? "text-trading-profit" : "text-trading-loss")}>
                      {(s.totalPnl || 0) >= 0 ? "+" : ""}{(s.totalPnl || 0).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Weekly AI Reviews */}
      {(weeklyReviews.length > 0 || weeklySummaries.length > 0) && (
        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">📅 סקירות שבועיות — AI</span>
            <span className="text-[10px] text-muted-foreground">{weeklyReviews.length + weeklySummaries.length} סקירות</span>
          </div>
          {weeklyReviews.map((r: any) => {
            const lessons = r.agent_lessons || [];
            return (
              <div key={r.id} className="p-3.5 px-[18px] border-b border-border">
                <div className="text-xs font-bold mb-1">{r.summary}</div>
                {r.reasoning && <div className="text-[11px] text-muted-foreground mb-2">{r.reasoning}</div>}
                {r.market_insight && (
                  <div className="text-[11px] p-2 rounded-lg mb-2" style={{ background: "rgba(59,130,246,0.06)" }}>
                    <span className="text-primary font-semibold">תובנת שוק: </span>{r.market_insight}
                  </div>
                )}
                {Array.isArray(lessons) && lessons.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-muted-foreground">שיעורי סוכנים:</div>
                    {lessons.map((l: any, i: number) => (
                      <div key={i} className="text-[11px] flex gap-2">
                        <span className="font-semibold text-primary">{l.agent || l.name}:</span>
                        <span className="text-muted-foreground">{l.lesson || l.message || String(l)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-[9px] text-muted-foreground mt-1.5">
                  {r.created_at ? new Date(r.created_at).toLocaleString("he-IL") : ""}
                </div>
              </div>
            );
          })}
          {weeklySummaries.map((ws: any) => {
            const s = ws.summary || {};
            return (
              <div key={ws.period} className="row-item">
                <span className="font-semibold w-[80px]">{ws.period}</span>
                <span className="text-muted-foreground">{s.totalTrades || ws.trade_count || 0} עסקאות</span>
                <span className={cn("font-mono", (s.winRate || 0) >= 50 ? "text-trading-profit" : "text-trading-loss")}>
                  WR: {(s.winRate || 0).toFixed(0)}%
                </span>
                <span className={cn("font-mono font-bold", (s.totalPnl || 0) >= 0 ? "text-trading-profit" : "text-trading-loss")}>
                  {(s.totalPnl || 0) >= 0 ? "+" : ""}{(s.totalPnl || 0).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Brain insights */}
      {insights.length > 0 && (
        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">🧠 AI Brain — ניתוחי Claude</span>
          </div>
          {insights.slice(0, 10).map((ins: any) => {
            const typeIcon = ins.type === "trade_analysis" ? "💰" : ins.type === "shadow_analysis" ? "👻" : ins.type === "weekly_review" ? "📅" : "📊";
            return (
              <div key={ins.id} className="row-item items-start py-2.5 px-[18px]">
                <span className="text-base mt-0.5">{typeIcon}</span>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-foreground">{ins.summary || ""}</div>
                  {ins.reasoning && <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{ins.reasoning}</div>}
                  {ins.pattern && (
                    <div className="mt-1 p-1.5 px-2.5 rounded-md text-[10px]" style={{ background: 'rgba(167,139,250,0.08)' }}>
                      <span className="text-purple-400 font-semibold">דפוס: </span>
                      {typeof ins.pattern === "object" ? `${ins.pattern.name || ""} — ${ins.pattern.description || ""}` : String(ins.pattern)}
                    </div>
                  )}
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    {ins.created_at ? new Date(ins.created_at).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
