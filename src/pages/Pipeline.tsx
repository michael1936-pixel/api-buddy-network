import { useAgentLogs } from "@/hooks/use-trading-data";

export default function PipelinePage() {
  const { data: logs = [] } = useAgentLogs(50);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <span className="text-[22px]">🔬</span>
          <div>
            <div className="text-base font-extrabold">זרימת סוכנים — דיאלוג + למידה + shadow trades</div>
            <div className="text-[11px] text-muted-foreground">כל החלטה נבדקת — גם עסקאות שנחסמו נעקבות כדי ללמוד אם החסימה הייתה נכונה</div>
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground">0 shadow trades פעילים</span>
      </div>

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
                  <div
                    className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: vc + "12" }}
                  >
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
    </div>
  );
}
