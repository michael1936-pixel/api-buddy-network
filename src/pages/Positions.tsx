import { usePositions } from "@/hooks/use-trading-data";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PnlBadge } from "@/components/trading/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PositionsPage() {
  const { data: openPositions = [], isLoading: loadingOpen } = usePositions("open");
  const { data: allPositions = [] } = usePositions();
  
  const closedPositions = allPositions.filter((p: any) => p.status === "closed");

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("he-IL", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">פוזיציות</h1>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">פתוחות ({openPositions.length})</TabsTrigger>
          <TabsTrigger value="closed">סגורות ({closedPositions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <Card>
            <CardContent className="pt-6">
              {openPositions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">אין פוזיציות פתוחות</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>סימול</TableHead>
                      <TableHead>כיוון</TableHead>
                      <TableHead>מחיר כניסה</TableHead>
                      <TableHead>סטופ לוס</TableHead>
                      <TableHead>טייק פרופיט</TableHead>
                      <TableHead>אסטרטגיה</TableHead>
                      <TableHead>זמן כניסה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openPositions.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono font-medium">{p.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={p.direction === "long" ? "default" : "destructive"}>
                            {p.direction === "long" ? "לונג" : "שורט"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">${p.entry_price?.toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-trading-loss">{p.stop_price ? `$${p.stop_price.toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="font-mono text-trading-profit">{p.tp_price ? `$${p.tp_price.toFixed(2)}` : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.strategy}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(p.entry_time)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="closed">
          <Card>
            <CardContent className="pt-6">
              {closedPositions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">אין עסקאות סגורות עדיין</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>סימול</TableHead>
                      <TableHead>כיוון</TableHead>
                      <TableHead>כניסה</TableHead>
                      <TableHead>יציאה</TableHead>
                      <TableHead>רווח/הפסד</TableHead>
                      <TableHead>אסטרטגיה</TableHead>
                      <TableHead>זמן יציאה</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closedPositions.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono font-medium">{p.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={p.direction === "long" ? "default" : "destructive"}>
                            {p.direction === "long" ? "לונג" : "שורט"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">${p.entry_price?.toFixed(2)}</TableCell>
                        <TableCell className="font-mono">${p.exit_price?.toFixed(2)}</TableCell>
                        <TableCell><PnlBadge value={p.pnl_pct || 0} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.strategy}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(p.exit_time)}</TableCell>
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
