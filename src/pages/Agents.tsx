import { useAgentLogs, useAgentMemory, useAgentFeedback } from "@/hooks/use-trading-data";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PnlBadge, StatusDot } from "@/components/trading/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Agent IDs as they appear in the DB (snake_case)
const AGENT_IDS = [
  "vix", "health", "memory", "ceo", "psychology", "self_improve",
  "correlation", "liquidity", "anomaly", "sector_rotation", "universe_scanner",
  "timeframe_optimizer", "knowledge", "devils_advocate", "backtest_validator",
  "news", "feedback_loop", "coordinator", "learning_adapter", "brain", "news_research"
];

const AGENT_LABELS: Record<string, string> = {
  vix: "VIX", health: "בריאות", memory: "זיכרון", ceo: "מנכ״ל", psychology: "פסיכולוגיה",
  self_improve: "שיפור עצמי", correlation: "קורלציה", liquidity: "נזילות", anomaly: "אנומליה",
  sector_rotation: "רוטציית סקטורים", universe_scanner: "סורק יקום", timeframe_optimizer: "אופטימיזר טיימפריים",
  knowledge: "ידע", devils_advocate: "פרקליט שטן", backtest_validator: "מאמת בקטסט",
  news: "חדשות", feedback_loop: "לולאת משוב", coordinator: "מתאם", learning_adapter: "מתאם למידה",
  brain: "מוח", news_research: "מחקר חדשות"
};

export default function AgentsPage() {
  const { data: agentMemory = [] } = useAgentMemory();
  const { data: logs = [] } = useAgentLogs(50);
  const { data: feedback = [] } = useAgentFeedback(30);

  const memoryMap = new Map(agentMemory.map((m: any) => [m.agent_id, m]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">סוכנים</h1>
      <p className="text-sm text-muted-foreground">21 סוכני AI מנטרים ומנתחים כל עסקה</p>

      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status">סטטוס סוכנים</TabsTrigger>
          <TabsTrigger value="logs">לוג החלטות</TabsTrigger>
          <TabsTrigger value="feedback">משוב עסקאות</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {AGENT_IDS.map((name) => {
              const mem = memoryMap.get(name) as any;
              const state = mem?.state || {};
              return (
                <Card key={name}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <StatusDot status={mem ? "online" : "offline"} />
                        <span className="text-sm font-medium">{AGENT_LABELS[name] || name}</span>
                      </div>
                      {mem && <Badge variant="outline" className="text-xs">v{mem.version}</Badge>}
                    </div>
                    {state.accuracy !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        דיוק: <span className="font-mono text-foreground">{(state.accuracy * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    {state.weight !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        משקל: <span className="font-mono text-foreground">{state.weight.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      עודכן: {mem?.updated_at ? new Date(mem.updated_at).toLocaleDateString("he-IL") : "אף פעם"}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardContent className="pt-6">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">אין לוגים של סוכנים עדיין</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>סימול</TableHead>
                      <TableHead>אסטרטגיה</TableHead>
                      <TableHead>כיוון</TableHead>
                      <TableHead>מרפי</TableHead>
                      <TableHead>רווח/הפסד</TableHead>
                      <TableHead>החלטה</TableHead>
                      <TableHead>זמן</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono font-medium">{l.symbol}</TableCell>
                        <TableCell className="text-xs">{l.strategy}</TableCell>
                        <TableCell>
                          <Badge variant={l.direction === "long" ? "default" : "destructive"} className="text-xs">
                            {l.direction === "long" ? "לונג" : "שורט"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{l.murphy_score ?? "—"}</TableCell>
                        <TableCell>{l.pnl_pct != null ? <PnlBadge value={l.pnl_pct} /> : "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{l.claude_decision || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.timestamp ? new Date(l.timestamp).toLocaleDateString("he-IL", { month: "short", day: "numeric" }) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback">
          <Card>
            <CardContent className="pt-6">
              {feedback.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">אין נתוני משוב עדיין</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>סימול</TableHead>
                      <TableHead>אסטרטגיה</TableHead>
                      <TableHead>רווח/הפסד</TableHead>
                      <TableHead>משטר VIX</TableHead>
                      <TableHead>סיכון חדשות</TableHead>
                      <TableHead>פסיקה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedback.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono font-medium">{f.symbol}</TableCell>
                        <TableCell className="text-xs">{f.strategy}</TableCell>
                        <TableCell><PnlBadge value={Number(f.pnl_pct) || 0} /></TableCell>
                        <TableCell className="text-xs">{f.vix_regime || "—"}</TableCell>
                        <TableCell className="text-xs">{f.news_risk || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{f.final_verdict}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
