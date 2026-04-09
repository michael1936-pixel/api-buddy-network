import { useTrackedSymbols, useSystemHealth } from "@/hooks/use-trading-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Database, Server, Shield, HeartPulse } from "lucide-react";
import { StatusDot } from "@/components/trading/StatCard";

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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">הגדרות</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" />
            תצורת מערכת
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">טיימפריים</span>
                <span className="font-mono">15min</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">מקסימום פוזיציות</span>
                <span className="font-mono">10</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">נתוני מניות</span>
                <span className="font-mono">5 שנים</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">נתוני ייחוס</span>
                <span className="font-mono">15 שנים (SPY, VIX)</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">הפסד יומי מקסימלי</span>
                <span className="font-mono text-trading-loss">-3%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">התיישנות אופטימיזציה</span>
                <span className="font-mono">14 ימים</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">אופטימיזציה שבועית</span>
                <span className="font-mono">יום ראשון</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">סוכנים פעילים</span>
                <span className="font-mono">21</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            מניות במעקב ({symbols.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {symbols.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין מניות במעקב</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {symbols.map((s: any) => (
                <Badge key={s.symbol} variant="outline" className="font-mono text-sm px-3 py-1">
                  {s.symbol}
                  {s.total_bars > 0 && (
                    <span className="mr-2 text-[10px] text-muted-foreground">{s.total_bars.toLocaleString()} נרות</span>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HeartPulse className="h-4 w-4" />
            בריאות מערכת
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {health.map((h: any) => (
              <div key={h.table} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-secondary/50 text-sm">
                <div className="flex items-center gap-2">
                  <StatusDot status={h.count > 0 ? "online" : "offline"} />
                  <span>{TABLE_LABELS[h.table] || h.table}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs">{h.count.toLocaleString()} שורות</span>
                  <span className="text-[10px] text-muted-foreground w-24 text-left">{formatAgo(h.lastUpdate)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            ארכיטקטורה
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• <strong className="text-foreground">שרת מסחר</strong> — Node.js/Express רץ על Railway. מריץ סיגנלים כל 15 דקות.</p>
          <p>• <strong className="text-foreground">בסיס נתונים</strong> — Lovable Cloud עם 17 טבלאות. משותף לשרת ולדשבורד.</p>
          <p>• <strong className="text-foreground">דשבורד</strong> — אפליקציית React זו. קוראת ישירות מבסיס הנתונים בזמן אמת.</p>
          <p>• <strong className="text-foreground">ביצוע</strong> — TradersPost webhook לניתוב פקודות לברוקר.</p>
          <p>• <strong className="text-foreground">מקורות מידע</strong> — Twelve Data (OHLCV), Finnhub (חדשות), Claude API (ניתוח AI).</p>
        </CardContent>
      </Card>
    </div>
  );
}
