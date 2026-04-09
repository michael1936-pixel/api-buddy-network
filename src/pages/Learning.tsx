import { useAIInsights, useTradeSummaries } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";

export default function LearningPage() {
  const { data: insights = [] } = useAIInsights(50);
  const { data: summaries = [] } = useTradeSummaries();

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3.5">
        {/* Principle rankings placeholder */}
        <div className="surface-card p-[18px]">
          <div className="text-sm font-semibold mb-3.5">דירוג עקרונות</div>
          <div className="empty-state">
            <div className="empty-state-text">העקרונות ילמדו מעסקאות</div>
          </div>
        </div>

        <div>
          {/* Knowledge base */}
          <div className="surface-card p-[18px] mb-3.5">
            <div className="text-sm font-semibold mb-3.5">בסיס ידע</div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { v: "51", l: "ספרים", c: "#a78bfa" },
                { v: "149", l: "עקרונות", c: "hsl(var(--primary))" },
                { v: "0", l: "עסקאות", c: "hsl(var(--trading-profit))" },
                { v: "30", l: "סוכנים", c: "hsl(var(--trading-warning))" },
              ].map((d) => (
                <div
                  key={d.l}
                  className="text-center p-3.5 rounded-lg border"
                  style={{ background: d.c + "08", borderColor: d.c + "15" }}
                >
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
              {summaries.map((m: any) => {
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

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">🧠 AI Brain — ניתוחי Claude</span>
          </div>
          {insights.slice(0, 10).map((ins: any) => {
            const typeIcon = ins.type === "trade_analysis" ? "💰" : ins.type === "shadow_analysis" ? "👻" : "📊";
            return (
              <div key={ins.id} className="row-item items-start py-2.5 px-[18px]">
                <span className="text-base mt-0.5">{typeIcon}</span>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-foreground">{ins.summary || ""}</div>
                  {ins.reasoning && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{ins.reasoning}</div>
                  )}
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
