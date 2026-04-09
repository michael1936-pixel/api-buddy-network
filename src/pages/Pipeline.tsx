import { useAgentLogs, useAgentFeedback, useAIInsights } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";

function computeAgentTable(feedback: any[]) {
  const agents: Record<string, { approveRight: number; approveWrong: number; blockRight: number; blockWrong: number; pnlImpact: number }> = {};
  feedback.forEach((f) => {
    const snapshots = f.agent_snapshots;
    if (!Array.isArray(snapshots)) return;
    snapshots.forEach((s: any) => {
      const id = s.agentId || s.agent || "unknown";
      if (!agents[id]) agents[id] = { approveRight: 0, approveWrong: 0, blockRight: 0, blockWrong: 0, pnlImpact: 0 };
      const approved = s.verdict === "approve" || s.score >= 70;
      const blocked = s.verdict === "block" || s.score < 30;
      if (approved && f.is_win) { agents[id].approveRight++; agents[id].pnlImpact += f.pnl_pct || 0; }
      else if (approved && !f.is_win) { agents[id].approveWrong++; agents[id].pnlImpact += f.pnl_pct || 0; }
      else if (blocked && !f.is_win) { agents[id].blockRight++; }
      else if (blocked && f.is_win) { agents[id].blockWrong++; agents[id].pnlImpact -= f.pnl_pct || 0; }
    });
  });
  return Object.entries(agents).map(([id, v]) => {
    const total = v.approveRight + v.approveWrong + v.blockRight + v.blockWrong;
    const acc = total > 0 ? Math.round(((v.approveRight + v.blockRight) / total) * 100) : 0;
    const weight = Math.min(1, Math.max(0.3, acc / 100));
    return { id, ...v, total, acc, weight: Math.round(weight * 100), pnlImpact: v.pnlImpact };
  }).sort((a, b) => b.acc - a.acc);
}

export default function PipelinePage() {
  const { data: logs = [] } = useAgentLogs(50);
  const { data: feedback = [] } = useAgentFeedback(200);
  const { data: insights = [] } = useAIInsights(30);

  const agentTable = computeAgentTable(feedback);
  const shadowTrades = feedback.filter((f: any) => f.final_verdict === "BLOCKED");
  const learningInsights = insights.filter((i: any) => i.type === "trade_analysis" || i.type === "shadow_analysis");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <span className="text-[22px]">🔬</span>
          <div>
            <div className="text-base font-extrabold">זרימת סוכנים — דיאלוג + למידה + shadow trades</div>
            <div className="text-[11px] text-muted-foreground">כל החלטה נבדקת — גם עסקאות שנחסמו נעקבות</div>
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground">{shadowTrades.length} shadow trades</span>
      </div>

      {/* Agent dialogue */}
      {logs.length === 0 ? (
        <div className="surface-card">
          <div className="empty-state">
            <div className="empty-state-icon">🤖</div>
            <div className="empty-state-text">אין דיאלוגים עדיין</div>
            <div className="empty-state-sub">כשהשוק ייפתח וייווצר סיגנל, תראה כאן את כל זרימת הסוכנים בזמן אמת</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => {
            const verdict = log.claude_decision || "?";
            const vc = verdict === "ENTER" ? "hsl(var(--trading-profit))" : verdict === "BLOCKED" ? "hsl(var(--trading-loss))" : "hsl(var(--trading-warning))";
            return (
              <div key={log.id} className="surface-card">
                <div className="p-3.5 px-[18px] flex items-center gap-3">
                  <div className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: vc + "12" }}>
                    {verdict === "ENTER" ? "✅" : verdict === "BLOCKED" ? "❌" : "⚠️"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{log.symbol}</span>
                      <span className={log.direction === "long" ? "text-trading-profit text-[11px] font-semibold" : "text-trading-loss text-[11px] font-semibold"}>
                        {log.direction === "long" ? "לונג" : "שורט"}
                      </span>
                      <span className="badge-pill" style={{ background: vc + "18", color: vc }}>{verdict}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {(log.timestamp || "").substring(11, 19)} | {log.strategy} | Murphy: {log.murphy_score ?? "--"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Continuous Learning Table */}
      {agentTable.length > 0 && (
        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">📊 למידה מתמשכת — דיוק סוכנים</span>
            <span className="text-[10px] text-muted-foreground">{feedback.length} עסקאות נותחו</span>
          </div>
          <div className="row-item text-[10px] text-muted-foreground font-semibold sticky top-0 z-10" style={{ background: 'hsl(var(--surface))' }}>
            <span className="w-[100px]">סוכן</span>
            <span className="w-[50px] text-center">✅→✅</span>
            <span className="w-[50px] text-center">✅→❌</span>
            <span className="w-[50px] text-center">🚫→✅</span>
            <span className="w-[50px] text-center">🚫→❌</span>
            <span className="w-[50px] text-center">דיוק</span>
            <span className="w-[60px] text-center">PnL השפעה</span>
            <span className="w-[45px] text-center">משקל</span>
          </div>
          {agentTable.map((a) => {
            const accColor = a.acc >= 70 ? "hsl(var(--trading-profit))" : a.acc >= 50 ? "hsl(var(--trading-warning))" : "hsl(var(--trading-loss))";
            return (
              <div key={a.id} className="row-item text-xs">
                <span className="w-[100px] font-semibold truncate">{a.id}</span>
                <span className="w-[50px] text-center text-trading-profit font-mono">{a.approveRight}</span>
                <span className="w-[50px] text-center text-trading-loss font-mono">{a.approveWrong}</span>
                <span className="w-[50px] text-center text-trading-profit font-mono">{a.blockRight}</span>
                <span className="w-[50px] text-center text-trading-loss font-mono">{a.blockWrong}</span>
                <span className="w-[50px] text-center font-mono font-bold" style={{ color: accColor }}>{a.acc}%</span>
                <span className={cn("w-[60px] text-center font-mono", a.pnlImpact >= 0 ? "text-trading-profit" : "text-trading-loss")}>
                  {a.pnlImpact >= 0 ? "+" : ""}{a.pnlImpact.toFixed(1)}%
                </span>
                <span className="w-[45px] text-center font-mono text-muted-foreground">{a.weight}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Shadow Trades */}
      {shadowTrades.length > 0 && (
        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">👻 Shadow Trades — עסקאות שנחסמו</span>
            <span className="text-[10px] text-muted-foreground">{shadowTrades.length} עסקאות</span>
          </div>
          {shadowTrades.slice(0, 15).map((f: any) => {
            const wouldWin = f.pnl_pct > 0;
            const blockCorrect = !wouldWin;
            return (
              <div key={f.id} className="row-item text-xs">
                <span className="font-bold w-12">{f.symbol}</span>
                <span className={cn("w-10", f.direction === "long" ? "text-trading-profit" : "text-trading-loss")}>
                  {f.direction === "long" ? "לונג" : "שורט"}
                </span>
                <span className={cn("font-mono w-16", f.pnl_pct >= 0 ? "text-trading-profit" : "text-trading-loss")}>
                  {f.pnl_pct >= 0 ? "+" : ""}{f.pnl_pct.toFixed(2)}%
                </span>
                <span className="flex-1 text-muted-foreground truncate">{f.strategy}</span>
                <span className="badge-pill" style={{
                  background: blockCorrect ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                  color: blockCorrect ? "hsl(var(--trading-profit))" : "hsl(var(--trading-loss))"
                }}>
                  {blockCorrect ? "חסימה נכונה ✅" : "חסימה שגויה ❌"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Learning Journal */}
      {learningInsights.length > 0 && (
        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">📝 יומן למידה — שיעורים מעסקאות</span>
          </div>
          {learningInsights.slice(0, 10).map((ins: any) => {
            const typeIcon = ins.type === "trade_analysis" ? "💰" : "👻";
            return (
              <div key={ins.id} className="row-item items-start py-2.5 px-[18px]">
                <span className="text-base mt-0.5">{typeIcon}</span>
                <div className="flex-1">
                  <div className="text-xs font-semibold">{ins.summary}</div>
                  {ins.reasoning && <div className="text-[11px] text-muted-foreground mt-0.5">{ins.reasoning}</div>}
                  {ins.agent_lessons && Array.isArray(ins.agent_lessons) && ins.agent_lessons.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(ins.agent_lessons as any[]).map((l: any, i: number) => (
                        <span key={i} className="badge-pill" style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}>
                          {l.agent || l}: {l.lesson || l.message || ""}
                        </span>
                      ))}
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
