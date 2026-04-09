import { useState } from "react";
import { useAgentMemory, useAgentFeedback } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";

const AGENTS = [
  { id: "murphy", name: "כללי מרפי", cat: "ניתוח", color: "#4d8df7", icon: "📐" },
  { id: "claude", name: "אנליסט Claude", cat: "ניתוח", color: "#4d8df7", icon: "🧠" },
  { id: "knowledge", name: "מנוע ידע", cat: "ניתוח", color: "#4d8df7", icon: "📚" },
  { id: "router", name: "נתב ידע", cat: "ניתוח", color: "#4d8df7", icon: "🗺️" },
  { id: "deception", name: "גלאי שקרים", cat: "ניתוח", color: "#4d8df7", icon: "🔍" },
  { id: "psychology", name: "סוכן פסיכולוגי", cat: "הגנה", color: "#f87171", icon: "🧘" },
  { id: "devils", name: "מבקר (Devil)", cat: "הגנה", color: "#f87171", icon: "😈" },
  { id: "correlation", name: "סוכן מתאם", cat: "הגנה", color: "#f87171", icon: "🔗" },
  { id: "liquidity", name: "שומר נזילות", cat: "הגנה", color: "#f87171", icon: "💧" },
  { id: "news", name: "מודיעין חדשות", cat: "מודיעין", color: "#a78bfa", icon: "📰" },
  { id: "vix", name: "מוניטור VIX", cat: "מודיעין", color: "#a78bfa", icon: "📊" },
  { id: "market", name: "הקשר שוק", cat: "מודיעין", color: "#a78bfa", icon: "🌍" },
  { id: "sector", name: "רוטציית סקטורים", cat: "מודיעין", color: "#a78bfa", icon: "🔄" },
  { id: "scanner", name: "סורק יקום", cat: "אופטימיזציה", color: "#22d3ee", icon: "🔭" },
  { id: "timeframe", name: "אופטימייזר TF", cat: "אופטימיזציה", color: "#22d3ee", icon: "⏱️" },
  { id: "backtest", name: "מדע בקטסט", cat: "אופטימיזציה", color: "#22d3ee", icon: "🔬" },
  { id: "ceo", name: 'סוכן מנכ"ל', cat: "ניהול", color: "#fbbf24", icon: "👔" },
  { id: "supervisor", name: "מפקח", cat: "ניהול", color: "#fbbf24", icon: "🎯" },
  { id: "improve", name: "שיפור עצמי", cat: "ניהול", color: "#fbbf24", icon: "📈" },
  { id: "health", name: "מוניטור בריאות", cat: "תפעול", color: "#34d399", icon: "💚" },
  { id: "anomaly", name: "גלאי חריגות", cat: "תפעול", color: "#34d399", icon: "⚠️" },
  { id: "validator", name: "מאמת בקטסט", cat: "תפעול", color: "#34d399", icon: "✅" },
  { id: "memory", name: "מנהל זיכרון", cat: "תפעול", color: "#34d399", icon: "💾" },
];

const CATEGORIES = ["ניתוח", "הגנה", "מודיעין", "אופטימיזציה", "ניהול", "תפעול"];

function computeAgentAccuracy(feedback: any[], agentId: string) {
  let approveRight = 0, approveWrong = 0, blockRight = 0, blockWrong = 0;
  feedback.forEach((f) => {
    const snapshots = f.agent_snapshots;
    if (!Array.isArray(snapshots)) return;
    const snap = snapshots.find((s: any) => s.agentId === agentId || s.agent === agentId);
    if (!snap) return;
    const approved = snap.verdict === "approve" || snap.score >= 70;
    const blocked = snap.verdict === "block" || snap.score < 30;
    if (approved && f.is_win) approveRight++;
    else if (approved && !f.is_win) approveWrong++;
    else if (blocked && f.is_win) blockWrong++;
    else if (blocked && !f.is_win) blockRight++;
  });
  const total = approveRight + approveWrong + blockRight + blockWrong;
  const acc = total > 0 ? Math.round(((approveRight + blockRight) / total) * 100) : null;
  return { approveRight, approveWrong, blockRight, blockWrong, total, acc };
}

function formatStateValue(val: any): string {
  if (val === null || val === undefined) return "--";
  if (typeof val === "boolean") return val ? "כן" : "לא";
  if (typeof val === "number") return val.toFixed ? val.toFixed(2) : String(val);
  if (typeof val === "string") return val.length > 80 ? val.slice(0, 80) + "…" : val;
  if (Array.isArray(val)) return val.length + " פריטים";
  if (typeof val === "object") return Object.keys(val).length + " שדות";
  return String(val);
}

export default function AgentsPage() {
  const { data: agentMemory = [] } = useAgentMemory();
  const { data: feedback = [] } = useAgentFeedback(200);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const memoryMap = new Map(agentMemory.map((m: any) => [m.agent_id, m]));

  const selected = AGENTS.find((a) => a.id === selectedAgent);
  const selectedMem = selectedAgent ? memoryMap.get(selectedAgent) : null;
  const selectedAcc = selectedAgent ? computeAgentAccuracy(feedback, selectedAgent) : null;

  return (
    <div className="space-y-4">
      {CATEGORIES.map((cat) => {
        const agents = AGENTS.filter((a) => a.cat === cat);
        const color = agents[0]?.color || "#8892a6";
        return (
          <div key={cat}>
            <div className="text-[13px] font-semibold tracking-wide mb-2 flex items-center gap-2" style={{ color }}>
              <div className="w-1 h-4 rounded-sm" style={{ background: color }} />
              {cat} ({agents.length})
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {agents.map((a) => {
                const mem = memoryMap.get(a.id);
                const acc = computeAgentAccuracy(feedback, a.id);
                const isSelected = selectedAgent === a.id;
                return (
                  <div
                    key={a.id}
                    className={cn("agent-card-item", isSelected && "ring-1 ring-primary")}
                    onClick={() => setSelectedAgent(isSelected ? null : a.id)}
                  >
                    <span className="text-xl">{a.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{a.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {acc.acc !== null ? `${acc.acc}% דיוק` : "פעיל"}
                      </div>
                    </div>
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background: mem ? "hsl(var(--trading-profit))" : "hsl(var(--muted-foreground))",
                        boxShadow: mem ? "0 0 6px hsl(var(--trading-profit))" : "none",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Agent detail panel */}
      {selected && (
        <div className="surface-card p-[18px] animate-in fade-in duration-200">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{selected.icon}</span>
            <div>
              <div className="text-base font-bold">{selected.name}</div>
              <div className="text-[11px] text-muted-foreground">{selected.cat} | ID: {selected.id}</div>
            </div>
            <button className="mr-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedAgent(null)}>✕ סגור</button>
          </div>

          {/* Accuracy stats */}
          {selectedAcc && selectedAcc.total > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2.5 rounded-lg" style={{ background: "rgba(52,211,153,0.08)" }}>
                <div className="font-mono text-lg font-bold text-trading-profit">{selectedAcc.approveRight}</div>
                <div className="text-[10px] text-muted-foreground">approve ✅</div>
              </div>
              <div className="text-center p-2.5 rounded-lg" style={{ background: "rgba(248,113,113,0.08)" }}>
                <div className="font-mono text-lg font-bold text-trading-loss">{selectedAcc.approveWrong}</div>
                <div className="text-[10px] text-muted-foreground">approve ❌</div>
              </div>
              <div className="text-center p-2.5 rounded-lg" style={{ background: "rgba(52,211,153,0.08)" }}>
                <div className="font-mono text-lg font-bold text-trading-profit">{selectedAcc.blockRight}</div>
                <div className="text-[10px] text-muted-foreground">block ✅</div>
              </div>
              <div className="text-center p-2.5 rounded-lg" style={{ background: "rgba(248,113,113,0.08)" }}>
                <div className="font-mono text-lg font-bold text-trading-loss">{selectedAcc.blockWrong}</div>
                <div className="text-[10px] text-muted-foreground">block ❌</div>
              </div>
            </div>
          )}

          {/* Agent memory state */}
          {selectedMem ? (
            <div>
              <div className="text-xs font-semibold mb-2 text-muted-foreground">
                🧠 State (v{selectedMem.version || 1}) — עדכון: {selectedMem.updated_at ? new Date(selectedMem.updated_at).toLocaleString("he-IL") : "--"}
              </div>
              <div className="rounded-lg p-3 text-xs space-y-1.5" style={{ background: "hsl(var(--surface2))" }}>
                {Object.entries(selectedMem.state as Record<string, any>).slice(0, 20).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="font-mono text-primary shrink-0">{k}:</span>
                    <span className="text-muted-foreground break-all">{formatStateValue(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-xs">
              ⏳ ממתין לנתונים — הסוכן טרם כתב state
            </div>
          )}
        </div>
      )}

      {/* Performance chart */}
      <div className="surface-card p-[18px]">
        <div className="text-sm font-semibold mb-3.5">ביצועי סוכנים (מ-feedback)</div>
        {AGENTS.map((a) => {
          const acc = computeAgentAccuracy(feedback, a.id);
          if (acc.acc === null) return null;
          const c = acc.acc >= 70 ? "hsl(var(--trading-profit))" : acc.acc >= 50 ? "hsl(var(--trading-warning))" : "hsl(var(--trading-loss))";
          return (
            <div key={a.id} className="flex items-center gap-2 mb-2 text-xs">
              <span className="w-[22px]">{a.icon}</span>
              <span className="w-[110px]">{a.name}</span>
              <div className="progress-bar flex-1 min-w-[40px]">
                <div className="progress-bar-fill" style={{ width: `${acc.acc}%`, background: c }} />
              </div>
              <span className="font-mono font-semibold w-9 text-left" style={{ color: c }}>
                {acc.acc}%
              </span>
              <span className="text-[10px] text-muted-foreground w-8">{acc.total}t</span>
            </div>
          );
        }).filter(Boolean)}
        {feedback.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">אין נתוני feedback עדיין — דיוק יחושב אוטומטית אחרי עסקאות</div>
        )}
      </div>
    </div>
  );
}
