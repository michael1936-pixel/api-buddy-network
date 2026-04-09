import { useOptimizationResults, useTimeframeProfiles } from "@/hooks/use-trading-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PnlBadge } from "@/components/trading/StatCard";

export default function OptimizationPage() {
  const { data: optimizations = [] } = useOptimizationResults();
  const { data: profiles = [] } = useTimeframeProfiles();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Optimization</h1>
      <p className="text-sm text-muted-foreground">Strategy optimization results and timeframe analysis</p>

      {/* Optimization Results */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Optimizations ({optimizations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {optimizations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No optimization results yet. The server needs to run optimization cycles.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Train Return</TableHead>
                  <TableHead>Test Return</TableHead>
                  <TableHead>Trades</TableHead>
                  <TableHead>Win Rate</TableHead>
                  <TableHead>Max DD</TableHead>
                  <TableHead>Sharpe</TableHead>
                  <TableHead>Overfit Risk</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Optimized</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {optimizations.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono font-medium">{o.symbol}</TableCell>
                    <TableCell><PnlBadge value={o.train_return || 0} /></TableCell>
                    <TableCell><PnlBadge value={o.test_return || 0} /></TableCell>
                    <TableCell className="font-mono text-sm">{o.total_trades || 0}</TableCell>
                    <TableCell className="font-mono text-sm">{((o.win_rate || 0) * 100).toFixed(1)}%</TableCell>
                    <TableCell className="font-mono text-sm text-trading-loss">{((o.max_drawdown || 0) * 100).toFixed(1)}%</TableCell>
                    <TableCell className="font-mono text-sm">{(o.sharpe_ratio || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={o.overfit_risk === "low" ? "outline" : "destructive"}
                        className="text-xs"
                      >
                        {o.overfit_risk || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{o.agent_confidence ? `${(o.agent_confidence * 100).toFixed(0)}%` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.optimized_at ? new Date(o.optimized_at).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Timeframe Profiles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Timeframe Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No timeframe profiles yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Best Timeframe</TableHead>
                  <TableHead>Volatility Profile</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Selected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p: any) => (
                  <TableRow key={p.symbol}>
                    <TableCell className="font-mono font-medium">{p.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{p.best_timeframe}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{p.volatility_profile || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{p.reason || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.selected_at ? new Date(p.selected_at).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
