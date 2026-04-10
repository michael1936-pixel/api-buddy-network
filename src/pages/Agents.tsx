import { useState } from "react";
import { useAgentMemory, useAgentFeedback } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";

const AGENTS = [
  // ניתוח (Analysis)
  { id: "murphy", name: "כללי מרפי", cat: "ניתוח", color: "#4d8df7", icon: "📐", desc: "מיישם חוקי Murphy של ניתוח טכני — trend, volume, momentum" },
  { id: "deception", name: "גלאי שקרים", cat: "ניתוח", color: "#4d8df7", icon: "🔍", desc: "מזהה מלכודות שוק: false breakouts, bull/bear traps" },
  { id: "news", name: "מודיעין חדשות", cat: "ניתוח", color: "#4d8df7", icon: "📰", desc: "מסווג חדשות לפי impact ומחליט אם לעצור מסחר" },
  { id: "newsResearch", name: "מנוע מחקר חדשות", cat: "ניתוח", color: "#4d8df7", icon: "🔬", desc: "חוקר חדשות היסטוריות ובונה מאגר דפוסים" },

  // הגנה (Protection)
  { id: "vix", name: "מוניטור VIX", cat: "הגנה", color: "#f87171", icon: "📊", desc: "מעקב VIX בזמן אמת — 5 משטרי שוק" },
  { id: "liquidity", name: "שומר נזילות", cat: "הגנה", color: "#f87171", icon: "💧", desc: "בודק נפח מסחר מינימלי לפני כניסה" },
  { id: "anomaly", name: "גלאי חריגות", cat: "הגנה", color: "#f87171", icon: "⚠️", desc: "מזהה gaps, volume spikes, trading halts" },
  { id: "psychology", name: "סוכן פסיכולוגי", cat: "הגנה", color: "#f87171", icon: "🧘", desc: "מנהל cooldown אחרי הפסדים, מונע revenge trading" },
  { id: "correlation", name: "סוכן מתאם", cat: "הגנה", color: "#f87171", icon: "🔗", desc: "מונע over-exposure לסקטור אחד" },
  { id: "sector", name: "רוטציית סקטורים", cat: "הגנה", color: "#f87171", icon: "🔄", desc: "עוקב אחרי זרימת כסף בין סקטורים" },

  // מודיעין (Intelligence)
  { id: "aiBrain", name: "AI Brain (Claude)", cat: "מודיעין", color: "#a78bfa", icon: "🧠", desc: "המוח — ניתוח עמוק, סקירה שבועית, גילוי דפוסים" },
  { id: "strategyResearch", name: "חוקר אסטרטגיות", cat: "מודיעין", color: "#a78bfa", icon: "📚", desc: "חוקר אסטרטגיות חדשות מספרות ומחקרים" },
  { id: "knowledgeRouter", name: "נתב ידע", cat: "מודיעין", color: "#a78bfa", icon: "🗺️", desc: "מנתב שאלות בין סוכנים לפי תחום" },
  { id: "devilsAdvocate", name: "מבקר (Devil)", cat: "מודיעין", color: "#a78bfa", icon: "😈", desc: "מתנגד לכל החלטה — 8 סוגי התנגדויות" },
  { id: "newsImpact", name: "סוכן השפעת חדשות", cat: "מודיעין", color: "#a78bfa", icon: "💥", desc: "מודד תגובת שוק לאירועים ומעדכן impact weights" },

  // אופטימיזציה (Optimization)
  { id: "autoOptimizer", name: "אופטימייזר אוטומטי", cat: "אופטימיזציה", color: "#22d3ee", icon: "🔧", desc: "סורק S&P 500 ומריץ אופטימיזציה אוטומטית" },
  { id: "smartOptimizer", name: "אופטימייזר חכם", cat: "אופטימיזציה", color: "#22d3ee", icon: "⚡", desc: "מנוע 3-שלבי: discovery → refinement → final tuning" },
  { id: "splitAgent", name: "Train/Test Split", cat: "אופטימיזציה", color: "#22d3ee", icon: "✂️", desc: "מחליט על חלוקת train/test למניעת overfitting" },
  { id: "thresholdAgent", name: "ספי מעבר", cat: "אופטימיזציה", color: "#22d3ee", icon: "📏", desc: "קובע ספי מינימום לתוצאות אופטימיזציה" },
  { id: "backtestValidator", name: "מאמת בקטסט", cat: "אופטימיזציה", color: "#22d3ee", icon: "✅", desc: "Walk-forward validation + Monte Carlo + stability" },
  { id: "optIntel", name: "מודיעין אופטימיזציה", cat: "אופטימיזציה", color: "#22d3ee", icon: "🎯", desc: "AI review + Walk-Forward + Monte Carlo + Regime Analysis" },

  // ניהול (Management)
  { id: "ceo", name: 'סוכן מנכ"ל', cat: "ניהול", color: "#fbbf24", icon: "👔", desc: "מחליט על risk appetite ומספר פוזיציות לפי תנאי שוק" },
  { id: "supervisor", name: "מפקח", cat: "ניהול", color: "#fbbf24", icon: "🎯", desc: "מקבל החלטה סופית לפי מאזן קולות סוכנים" },
  { id: "portfolioOptimizer", name: "מאפטם תיק", cat: "ניהול", color: "#fbbf24", icon: "💼", desc: "מאפטם הקצאת תיק — equal-risk weighting" },
  { id: "tradeCoordinator", name: "מתאם עסקאות", cat: "ניהול", color: "#fbbf24", icon: "🎬", desc: "מנהל את כל מחזור חיי העסקה — כניסה עד יציאה" },

  // תפעול (Operations)
  { id: "learningAdapter", name: "אדפטר למידה", cat: "תפעול", color: "#34d399", icon: "📈", desc: "מנגנון למידה מרכזי — accuracy, calibration, thresholds" },
  { id: "health", name: "מוניטור בריאות", cat: "תפעול", color: "#34d399", icon: "💚", desc: "בודק APIs, DB, services ושולח התראות" },
  { id: "memory", name: "מנהל זיכרון", cat: "תפעול", color: "#34d399", icon: "💾", desc: "שומר ומשחזר state של כל הסוכנים" },
  { id: "selfImprove", name: "שיפור עצמי", cat: "תפעול", color: "#34d399", icon: "🔄", desc: "מזהה הזדמנויות שיפור ומציע fixes" },
  { id: "feedbackLoop", name: "לולאת משוב", cat: "תפעול", color: "#34d399", icon: "🔁", desc: "אוסף feedback מעסקאות ומעדכן סוכנים" },
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

// Agent-specific state renderers for richer display
function renderAgentState(agentId: string, state: Record<string, any>) {
  switch (agentId) {
    case "newsResearch":
    case "news_research":
      return (
        <div className="space-y-2">
          {state.totalPatterns != null && (
            <div className="flex gap-2 items-center">
              <span className="font-mono text-primary">דפוסים:</span>
              <span className="font-mono font-bold text-lg">{state.totalPatterns}</span>
            </div>
          )}
          {state.lastResearch && (
            <div className="text-[11px] text-muted-foreground">
              מחקר אחרון: {new Date(state.lastResearch).toLocaleString("he-IL")}
            </div>
          )}
          {state.conclusions && typeof state.conclusions === "object" && Object.keys(state.conclusions).length > 0 && (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">מסקנות:</span>
              {Object.entries(state.conclusions).map(([k, v]) => (
                <div key={k} className="text-[11px] flex gap-2 pr-2">
                  <span className="font-mono text-primary">{k}:</span>
                  <span className="text-muted-foreground">{formatStateValue(v)}</span>
                </div>
              ))}
            </div>
          )}
          {state.patterns && Array.isArray(state.patterns) && state.patterns.length > 0 && (
            <div className="text-[11px] text-muted-foreground">{state.patterns.length} דפוסים שמורים</div>
          )}
        </div>
      );

    case "strategyResearch":
    case "strategy_researcher":
      return (
        <div className="space-y-2">
          {state.researchIdeas && Array.isArray(state.researchIdeas) && (
            <div className="flex gap-2 items-center">
              <span className="font-mono text-primary">רעיונות:</span>
              <span className="font-mono font-bold">{state.researchIdeas.length}</span>
            </div>
          )}
          {state.researchFocus && typeof state.researchFocus === "object" && (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">מיקוד מחקר:</span>
              {Object.entries(state.researchFocus).map(([k, v]) => (
                <div key={k} className="text-[11px] flex gap-2 pr-2">
                  <span className="font-mono text-primary">{k}:</span>
                  <span className="text-muted-foreground">{formatStateValue(v)}</span>
                </div>
              ))}
            </div>
          )}
          {/* Fallback to generic */}
          {!state.researchIdeas && !state.researchFocus && renderGenericState(state)}
        </div>
      );

    default:
      return renderGenericState(state);
  }
}

function renderGenericState(state: Record<string, any>) {
  return (
    <div className="space-y-1.5">
      {Object.entries(state).slice(0, 20).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="font-mono text-primary shrink-0">{k}:</span>
          <span className="text-muted-foreground break-all">{formatStateValue(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AgentsPage() {
  const { data: agentMemory = [] } = useAgentMemory();
  const { data: feedback = [] } = useAgentFeedback(200);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Map both exact IDs and snake_case variants (server may write news_research or newsResearch)
  const memoryMap = new Map<string, any>();
  agentMemory.forEach((m: any) => {
    memoryMap.set(m.agent_id, m);
    // Also map camelCase variant if agent_id uses underscores
    const camel = m.agent_id.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
    if (camel !== m.agent_id) memoryMap.set(camel, m);
    // And map underscore variant if agent_id uses camelCase
    const snake = m.agent_id.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (snake !== m.agent_id) memoryMap.set(snake, m);
  });

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
              <div className="text-[11px] text-muted-foreground mt-0.5">{selected.desc}</div>
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
              <div className="rounded-lg p-3 text-xs" style={{ background: "hsl(var(--surface2))" }}>
                {renderAgentState(selected.id, selectedMem.state as Record<string, any>)}
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
