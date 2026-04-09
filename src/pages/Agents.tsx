import { useAgentMemory } from "@/hooks/use-trading-data";
import { cn } from "@/lib/utils";

const AGENTS = [
  { id: "murphy", name: "כללי מרפי", cat: "ניתוח", color: "#4d8df7", acc: 78, icon: "📐" },
  { id: "claude", name: "אנליסט Claude", cat: "ניתוח", color: "#4d8df7", acc: 82, icon: "🧠" },
  { id: "knowledge", name: "מנוע ידע", cat: "ניתוח", color: "#4d8df7", acc: 71, icon: "📚" },
  { id: "router", name: "נתב ידע", cat: "ניתוח", color: "#4d8df7", acc: null, icon: "🗺️" },
  { id: "deception", name: "גלאי שקרים", cat: "ניתוח", color: "#4d8df7", acc: 65, icon: "🔍" },
  { id: "psychology", name: "סוכן פסיכולוגי", cat: "הגנה", color: "#f87171", acc: 88, icon: "🧘" },
  { id: "devils", name: "מבקר (Devil)", cat: "הגנה", color: "#f87171", acc: 73, icon: "😈" },
  { id: "correlation", name: "סוכן מתאם", cat: "הגנה", color: "#f87171", acc: 91, icon: "🔗" },
  { id: "liquidity", name: "שומר נזילות", cat: "הגנה", color: "#f87171", acc: 95, icon: "💧" },
  { id: "news", name: "מודיעין חדשות", cat: "מודיעין", color: "#a78bfa", acc: 62, icon: "📰" },
  { id: "vix", name: "מוניטור VIX", cat: "מודיעין", color: "#a78bfa", acc: null, icon: "📊" },
  { id: "market", name: "הקשר שוק", cat: "מודיעין", color: "#a78bfa", acc: null, icon: "🌍" },
  { id: "sector", name: "רוטציית סקטורים", cat: "מודיעין", color: "#a78bfa", acc: 68, icon: "🔄" },
  { id: "scanner", name: "סורק יקום", cat: "אופטימיזציה", color: "#22d3ee", acc: null, icon: "🔭" },
  { id: "timeframe", name: "אופטימייזר TF", cat: "אופטימיזציה", color: "#22d3ee", acc: null, icon: "⏱️" },
  { id: "backtest", name: "מדע בקטסט", cat: "אופטימיזציה", color: "#22d3ee", acc: null, icon: "🔬" },
  { id: "ceo", name: 'סוכן מנכ"ל', cat: "ניהול", color: "#fbbf24", acc: null, icon: "👔" },
  { id: "supervisor", name: "מפקח", cat: "ניהול", color: "#fbbf24", acc: null, icon: "🎯" },
  { id: "improve", name: "שיפור עצמי", cat: "ניהול", color: "#fbbf24", acc: null, icon: "📈" },
  { id: "health", name: "מוניטור בריאות", cat: "תפעול", color: "#34d399", acc: null, icon: "💚" },
  { id: "anomaly", name: "גלאי חריגות", cat: "תפעול", color: "#34d399", acc: 84, icon: "⚠️" },
  { id: "validator", name: "מאמת בקטסט", cat: "תפעול", color: "#34d399", acc: 77, icon: "✅" },
  { id: "memory", name: "מנהל זיכרון", cat: "תפעול", color: "#34d399", acc: null, icon: "💾" },
];

const CATEGORIES = ["ניתוח", "הגנה", "מודיעין", "אופטימיזציה", "ניהול", "תפעול"];

export default function AgentsPage() {
  const { data: agentMemory = [] } = useAgentMemory();
  const memoryMap = new Map(agentMemory.map((m: any) => [m.agent_id, m]));

  return (
    <div className="space-y-4">
      {/* Agent cards by category */}
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
                return (
                  <div key={a.id} className="agent-card-item">
                    <span className="text-xl">{a.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{a.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {a.acc !== null ? `${a.acc}% דיוק` : "פעיל"}
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

      {/* Performance chart */}
      <div className="surface-card p-[18px]">
        <div className="text-sm font-semibold mb-3.5">ביצועי סוכנים</div>
        {AGENTS.filter((a) => a.acc !== null)
          .sort((a, b) => (b.acc || 0) - (a.acc || 0))
          .map((a) => {
            const c = (a.acc || 0) >= 70 ? "hsl(var(--trading-profit))" : (a.acc || 0) >= 50 ? "hsl(var(--trading-warning))" : "hsl(var(--trading-loss))";
            return (
              <div key={a.id} className="flex items-center gap-2 mb-2 text-xs">
                <span className="w-[22px]">{a.icon}</span>
                <span className="w-[110px]">{a.name}</span>
                <div className="progress-bar flex-1 min-w-[40px]">
                  <div className="progress-bar-fill" style={{ width: `${a.acc}%`, background: c }} />
                </div>
                <span className="font-mono font-semibold w-9 text-left" style={{ color: c }}>
                  {a.acc}%
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
