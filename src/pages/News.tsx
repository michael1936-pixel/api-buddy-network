import { useNewsEvents } from "@/hooks/use-trading-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const impactColors: Record<string, string> = {
  high: "bg-trading-loss/15 text-trading-loss",
  medium: "bg-trading-warning/15 text-trading-warning",
  low: "bg-muted text-muted-foreground",
};

const sentimentColors: Record<string, string> = {
  bullish: "text-trading-profit",
  bearish: "text-trading-loss",
  neutral: "text-muted-foreground",
};

export default function NewsPage() {
  const { data: news = [] } = useNewsEvents(100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">News & Research</h1>
      <p className="text-sm text-muted-foreground">Market news intelligence and impact analysis</p>

      {news.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-sm text-muted-foreground text-center">No news events captured yet. The news agent will populate this once the server is running.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {news.map((n: any) => (
            <Card key={n.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium leading-snug">{n.headline}</h3>
                    {n.summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.summary}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">{n.category}</Badge>
                      {n.subcategory && <Badge variant="outline" className="text-xs">{n.subcategory}</Badge>}
                      <span className={cn("text-xs px-2 py-0.5 rounded", impactColors[n.impact_level] || impactColors.low)}>
                        {n.impact_level} impact
                      </span>
                      {n.sentiment && (
                        <span className={cn("text-xs", sentimentColors[n.sentiment] || "text-muted-foreground")}>
                          {n.sentiment}
                        </span>
                      )}
                    </div>
                    {n.affected_symbols?.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {n.affected_symbols.slice(0, 8).map((s: string) => (
                          <Badge key={s} variant="secondary" className="text-[10px] font-mono">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">
                      {new Date(n.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    {n.reaction_recorded && (
                      <div className="mt-1 space-y-0.5">
                        {n.actual_spy_1d != null && (
                          <div className="text-[10px] font-mono">
                            SPY 1d: <span className={n.actual_spy_1d >= 0 ? "text-trading-profit" : "text-trading-loss"}>
                              {n.actual_spy_1d >= 0 ? "+" : ""}{n.actual_spy_1d.toFixed(2)}%
                            </span>
                          </div>
                        )}
                        {n.actual_vix_change != null && (
                          <div className="text-[10px] font-mono">
                            VIX: <span className={n.actual_vix_change >= 0 ? "text-trading-loss" : "text-trading-profit"}>
                              {n.actual_vix_change >= 0 ? "+" : ""}{n.actual_vix_change.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {n.source && <div className="text-[10px] text-muted-foreground mt-1">{n.source}</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
