import { useAgentLogs, useAgentMemory, useAgentFeedback } from "@/hooks/use-trading-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PnlBadge, StatusDot } from "@/components/trading/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AGENT_NAMES = [
  "vix", "health", "memory", "ceo", "psychology", "selfImprove",
  "correlation", "liquidity", "anomaly", "sectorRotation", "universeScanner",
  "timeframeOptimizer", "knowledge", "devilsAdvocate", "backtestValidator",
  "news", "feedbackLoop", "coordinator", "learningAdapter", "brain", "newsResearch"
];

export default function AgentsPage() {
  const { data: agentMemory = [] } = useAgentMemory();
  const { data: logs = [] } = useAgentLogs(50);
  const { data: feedback = [] } = useAgentFeedback(30);

  const memoryMap = new Map(agentMemory.map((m: any) => [m.agent_id, m]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Agents</h1>
      <p className="text-sm text-muted-foreground">21 AI agents monitoring and analyzing every trade</p>

      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status">Agent Status</TabsTrigger>
          <TabsTrigger value="logs">Decision Logs</TabsTrigger>
          <TabsTrigger value="feedback">Trade Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {AGENT_NAMES.map((name) => {
              const mem = memoryMap.get(name) as any;
              const state = mem?.state || {};
              return (
                <Card key={name}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <StatusDot status={mem ? "online" : "offline"} />
                        <span className="text-sm font-medium capitalize">{name.replace(/([A-Z])/g, " $1").trim()}</span>
                      </div>
                      {mem && <Badge variant="outline" className="text-xs">v{mem.version}</Badge>}
                    </div>
                    {state.accuracy !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        Accuracy: <span className="font-mono text-foreground">{(state.accuracy * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    {state.weight !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        Weight: <span className="font-mono text-foreground">{state.weight.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Updated: {mem?.updated_at ? new Date(mem.updated_at).toLocaleDateString() : "Never"}
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
                <p className="text-sm text-muted-foreground text-center py-12">No agent logs yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Murphy</TableHead>
                      <TableHead>P&L</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono font-medium">{l.symbol}</TableCell>
                        <TableCell className="text-xs">{l.strategy}</TableCell>
                        <TableCell>
                          <Badge variant={l.direction === "long" ? "default" : "destructive"} className="text-xs">
                            {l.direction?.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{l.murphy_score ?? "—"}</TableCell>
                        <TableCell>{l.pnl_pct != null ? <PnlBadge value={l.pnl_pct} /> : "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{l.claude_decision || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.timestamp ? new Date(l.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
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
                <p className="text-sm text-muted-foreground text-center py-12">No feedback data yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Strategy</TableHead>
                      <TableHead>P&L</TableHead>
                      <TableHead>VIX Regime</TableHead>
                      <TableHead>News Risk</TableHead>
                      <TableHead>Verdict</TableHead>
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
