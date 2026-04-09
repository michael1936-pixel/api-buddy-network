import { useState } from "react";
import { useAgentLogs } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";

export default function DecisionsPage() {
  const { data: logs = [] } = useAgentLogs(50);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <span className="text-base font-semibold">דיאלוג סוכנים</span>
        <span className="text-[11px] text-muted-foreground">מתעדכן כל 30 שניות | {logs.length} החלטות</span>
      </div>

      {logs.length === 0 ? (
        <div className="surface-card">
          <div className="empty-state">
            <div className="empty-state-icon">🤖</div>
            <div className="empty-state-text">ממתין לסיגנלים...</div>
            <div className="empty-state-sub">כשהשוק ייפתח, תראה את הדיאלוג בין הסוכנים</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => {
            const verdict = log.claude_decision || log.direction || "?";
            const vc = verdict.includes("ENTER") ? "hsl(var(--trading-profit))" : verdict.includes("BLOCK") ? "hsl(var(--trading-loss))" : "hsl(var(--trading-warning))";
            const isExpanded = expandedId === log.id;
            const messages: any[] = log.agent_weights?.messages || [];
            const weights = log.agent_weights || {};

            return (
              <div key={log.id} className="surface-card">
                <div
                  className="p-3.5 px-[18px] flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <div
                    className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: vc + "12" }}
                  >
                    {verdict.includes("ENTER") ? "✅" : verdict.includes("BLOCK") ? "❌" : "⚠️"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{log.symbol}</span>
                      <span className={log.direction === "long" ? "text-trading-profit text-[11px] font-semibold" : "text-trading-loss text-[11px] font-semibold"}>
                        {log.direction === "long" ? "לונג" : "שורט"}
                      </span>
                      <span className="badge-pill" style={{ background: vc + "18", color: vc }}>{verdict}</span>
                      {log.strategy && <span className="badge-pill" style={{ background: 'hsl(var(--surface2))', color: 'hsl(var(--muted-foreground))' }}>{log.strategy}</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {(log.timestamp || "").substring(11, 19)} | Murphy: {log.murphy_score ?? "--"} | {log.pnl_pct != null ? `PnL: ${log.pnl_pct >= 0 ? "+" : ""}${log.pnl_pct.toFixed(2)}%` : ""}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
                </div>

                {/* Expanded agent messages */}
                {isExpanded && (
                  <div className="border-t border-border p-3.5 px-[18px] space-y-2 animate-in fade-in duration-200" style={{ background: "hsl(var(--surface2))" }}>
                    {messages.length > 0 ? (
                      messages.map((msg: any, i: number) => {
                        const msgVerdict = msg.verdict || msg.action || "info";
                        const mc = msgVerdict === "approve" ? "hsl(var(--trading-profit))" : msgVerdict === "block" ? "hsl(var(--trading-loss))" : "hsl(var(--trading-warning))";
                        return (
                          <div key={i} className="flex items-start gap-2.5 text-xs">
                            <span className="text-base">{msg.icon || "🤖"}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{msg.agent || msg.name || `סוכן ${i + 1}`}</span>
                                <span className="badge-pill" style={{ background: mc + "18", color: mc }}>{msgVerdict}</span>
                                {msg.score != null && <span className="font-mono text-[10px] text-muted-foreground">{msg.score}/100</span>}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">{msg.message || msg.reason || msg.text || "--"}</div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="font-semibold mb-1.5">נתוני הצבעה:</div>
                        {log.rules_passed && log.rules_passed.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-trading-profit">עברו:</span>
                            {log.rules_passed.map((r: string, i: number) => (
                              <span key={i} className="badge-pill" style={{ background: "rgba(52,211,153,0.1)", color: "hsl(var(--trading-profit))" }}>{r}</span>
                            ))}
                          </div>
                        )}
                        {log.rules_failed && log.rules_failed.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-trading-loss">נכשלו:</span>
                            {log.rules_failed.map((r: string, i: number) => (
                              <span key={i} className="badge-pill" style={{ background: "rgba(248,113,113,0.1)", color: "hsl(var(--trading-loss))" }}>{r}</span>
                            ))}
                          </div>
                        )}
                        {/* Show raw agent_weights keys */}
                        {Object.keys(weights).filter(k => k !== "messages").length > 0 && (
                          <div className="mt-2 grid grid-cols-3 gap-1.5">
                            {Object.entries(weights).filter(([k]) => k !== "messages").map(([k, v]: [string, any]) => (
                              <div key={k} className="text-[10px] p-1.5 rounded" style={{ background: "hsl(var(--surface))" }}>
                                <span className="font-mono text-primary">{k}:</span> <span>{typeof v === "number" ? v.toFixed(1) : String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {!log.rules_passed?.length && !log.rules_failed?.length && Object.keys(weights).filter(k => k !== "messages").length === 0 && (
                          <div className="text-center py-2 text-muted-foreground">אין פירוט הודעות סוכנים לעסקה זו</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
