import { usePositions, useSignals, useOptimizationResults, useTrackedSymbols } from "@/hooks/use-trading-data";
import { StatCard, PnlBadge } from "@/components/trading/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity, BarChart3, Target, Zap } from "lucide-react";

export default function DashboardPage() {
  const { data: openPositions = [] } = usePositions("open");
  const { data: allPositions = [] } = usePositions();
  const { data: signals = [] } = useSignals(20);
  const { data: optimizations = [] } = useOptimizationResults();
  const { data: symbols = [] } = useTrackedSymbols();

  const closedPositions = allPositions.filter((p: any) => p.status === "closed");
  const totalPnl = closedPositions.reduce((sum: number, p: any) => sum + (p.pnl_pct || 0), 0);
  const wins = closedPositions.filter((p: any) => (p.pnl_pct || 0) > 0).length;
  const winRate = closedPositions.length > 0 ? (wins / closedPositions.length * 100) : 0;
  const avgReturn = closedPositions.length > 0 ? totalPnl / closedPositions.length : 0;

  const today = new Date().toISOString().split("T")[0];
  const todaySignals = signals.filter((s: any) => s.timestamp?.startsWith(today));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">סקירה כללית</h1>
        <p className="text-sm text-muted-foreground">AlgoMaykl — מערכת מסחר אלגוריתמית בזמן אמת</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="פוזיציות פתוחות" value={openPositions.length} icon={Activity} subValue={`/ ${symbols.length} מניות`} />
        <StatCard label="סה״כ עסקאות" value={closedPositions.length} icon={BarChart3} />
        <StatCard label="אחוז הצלחה" value={`${winRate.toFixed(1)}%`} icon={Target} trend={winRate >= 50 ? "up" : winRate > 0 ? "down" : "neutral"} />
        <StatCard label="רווח/הפסד כולל" value={`${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}%`} trend={totalPnl >= 0 ? "up" : "down"} icon={totalPnl >= 0 ? TrendingUp : TrendingDown} />
        <StatCard label="תשואה ממוצעת" value={`${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(2)}%`} trend={avgReturn >= 0 ? "up" : "down"} />
        <StatCard label="סיגנלים היום" value={todaySignals.length} icon={Zap} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">פוזיציות פתוחות</CardTitle>
          </CardHeader>
          <CardContent>
            {openPositions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">אין פוזיציות פתוחות</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>סימול</TableHead>
                    <TableHead>כיוון</TableHead>
                    <TableHead>מחיר כניסה</TableHead>
                    <TableHead>אסטרטגיה</TableHead>
                    <TableHead>סטופ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openPositions.slice(0, 10).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-medium">{p.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={p.direction === "long" ? "default" : "destructive"} className="text-xs">
                          {p.direction === "long" ? "לונג" : "שורט"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">${p.entry_price?.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.strategy}</TableCell>
                      <TableCell className="font-mono text-sm text-trading-loss">
                        {p.stop_price ? `$${p.stop_price.toFixed(2)}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">סיגנלים אחרונים</CardTitle>
          </CardHeader>
          <CardContent>
            {signals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">ממתין לסיגנלים...</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {signals.slice(0, 15).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <Badge variant={s.direction === "long" ? "default" : "destructive"} className="text-xs">
                        {s.direction === "long" ? "לונג" : "שורט"}
                      </Badge>
                      <span className="font-mono text-sm font-medium">{s.symbol}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{s.strategy}</span>
                      <span className="font-mono text-sm">${s.price?.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">אופטימיזציות פעילות (מובילים)</CardTitle>
        </CardHeader>
        <CardContent>
          {optimizations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">אין תוצאות אופטימיזציה עדיין</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>סימול</TableHead>
                  <TableHead>תשואת אימון</TableHead>
                  <TableHead>תשואת מבחן</TableHead>
                  <TableHead>אחוז הצלחה</TableHead>
                  <TableHead>ירידה מקסימלית</TableHead>
                  <TableHead>שארפ</TableHead>
                  <TableHead>סיכון</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {optimizations.slice(0, 10).map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono font-medium">{o.symbol}</TableCell>
                    <TableCell><PnlBadge value={o.train_return || 0} /></TableCell>
                    <TableCell><PnlBadge value={o.test_return || 0} /></TableCell>
                    <TableCell className="font-mono text-sm">{((o.win_rate || 0) * 100).toFixed(1)}%</TableCell>
                    <TableCell className="font-mono text-sm text-trading-loss">{((o.max_drawdown || 0) * 100).toFixed(1)}%</TableCell>
                    <TableCell className="font-mono text-sm">{(o.sharpe_ratio || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={o.overfit_risk === "low" ? "default" : "destructive"} className="text-xs">
                        {o.overfit_risk === "low" ? "נמוך" : o.overfit_risk === "medium" ? "בינוני" : o.overfit_risk === "high" ? "גבוה" : "—"}
                      </Badge>
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
