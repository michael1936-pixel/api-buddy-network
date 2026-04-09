import { useTrackedSymbols, useSystemHealth } from "@/hooks/use-trading-data";

export default function SettingsPage() {
  const { data: symbols = [] } = useTrackedSymbols();
  const { data: health = [] } = useSystemHealth();

  const formatAgo = (ts: string | null) => {
    if (!ts) return "אף פעם";
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "עכשיו";
    if (mins < 60) return `לפני ${mins} דק׳`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `לפני ${hrs} שע׳`;
    return `לפני ${Math.floor(hrs / 24)} ימים`;
  };

  const TABLE_LABELS: Record<string, string> = {
    signals: "סיגנלים", positions: "פוזיציות", agent_logs: "לוגי סוכנים",
    agent_memory: "זיכרון סוכנים", news_events: "אירועי חדשות", market_data: "נתוני שוק",
    optimization_results: "אופטימיזציה", ai_insights: "תובנות AI", tracked_symbols: "מניות במעקב",
    agent_feedback: "משוב סוכנים", trade_summaries: "סיכומי עסקאות",
  };

  return (
    <div className="space-y-4">
      {/* System config */}
      <div className="surface-card p-[18px]">
        <div className="text-sm font-semibold mb-3.5 flex items-center gap-2">⚙️ תצורת מערכת</div>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            {[
              ["טיימפריים", "15min"],
              ["מקסימום פוזיציות", "10"],
              ["נתוני מניות", "5 שנים"],
              ["נתוני ייחוס", "15 שנים (SPY, VIX)"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono">{v}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[
              ["הפסד יומי מקסימלי", "-3%", true],
              ["התיישנות אופטימיזציה", "14 ימים", false],
              ["אופטימיזציה שבועית", "יום ראשון", false],
              ["סוכנים פעילים", "21", false],
            ].map(([k, v, isLoss]) => (
              <div key={k as string} className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">{k as string}</span>
                <span className={`font-mono ${isLoss ? "text-trading-loss" : ""}`}>{v as string}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tracked symbols */}
      <div className="surface-card p-[18px]">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2">📊 מניות במעקב ({symbols.length})</div>
        {symbols.length === 0 ? (
          <div className="text-sm text-muted-foreground">אין מניות במעקב</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {symbols.map((s: any) => (
              <span key={s.symbol} className="font-mono text-sm px-3 py-1 rounded-lg border border-border" style={{ background: 'hsl(var(--surface2))' }}>
                {s.symbol}
                {s.total_bars > 0 && (
                  <span className="mr-2 text-[10px] text-muted-foreground">{s.total_bars.toLocaleString()} נרות</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* System health */}
      <div className="surface-card p-[18px]">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2">💚 בריאות מערכת</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {health.map((h: any) => (
            <div key={h.table} className="flex items-center justify-between py-1.5 px-3 rounded-md text-sm" style={{ background: 'hsl(var(--surface2))' }}>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: h.count > 0 ? "hsl(var(--trading-profit))" : "hsl(var(--muted-foreground))",
                    boxShadow: h.count > 0 ? "0 0 4px hsl(var(--trading-profit))" : "none",
                  }}
                />
                <span>{TABLE_LABELS[h.table] || h.table}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs">{h.count.toLocaleString()} שורות</span>
                <span className="text-[10px] text-muted-foreground w-24 text-left">{formatAgo(h.lastUpdate)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="surface-card p-[18px]">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2">🏗️ ארכיטקטורה</div>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>• <strong className="text-foreground">שרת מסחר</strong> — Node.js/Express רץ על Railway. מריץ סיגנלים כל 15 דקות.</p>
          <p>• <strong className="text-foreground">בסיס נתונים</strong> — Lovable Cloud עם 17 טבלאות. משותף לשרת ולדשבורד.</p>
          <p>• <strong className="text-foreground">דשבורד</strong> — אפליקציית React זו. קוראת ישירות מבסיס הנתונים בזמן אמת.</p>
          <p>• <strong className="text-foreground">ביצוע</strong> — TradersPost webhook לניתוב פקודות לברוקר.</p>
          <p>• <strong className="text-foreground">מקורות מידע</strong> — Twelve Data (OHLCV), Finnhub (חדשות), Claude API (ניתוח AI).</p>
        </div>
      </div>
    </div>
  );
}
