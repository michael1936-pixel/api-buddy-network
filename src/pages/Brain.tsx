import { useAIInsights } from "@/hooks/use-trading-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Lightbulb, Eye, Calendar } from "lucide-react";

const typeConfig: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  trade_analysis: { label: "Trade Analysis", icon: Eye, color: "bg-primary/15 text-primary" },
  shadow_analysis: { label: "Shadow Trade", icon: Lightbulb, color: "bg-trading-warning/15 text-trading-warning" },
  weekly_review: { label: "Weekly Review", icon: Calendar, color: "bg-trading-profit/15 text-trading-profit" },
};

export default function BrainPage() {
  const { data: insights = [] } = useAIInsights(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">AI Brain</h1>
          <p className="text-sm text-muted-foreground">Claude's deep analysis — trade reasoning, shadow trades, and weekly reviews</p>
        </div>
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No AI insights yet. The AI Brain generates insights after trades close and during weekly reviews.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {insights.map((insight: any) => {
            const config = typeConfig[insight.type] || typeConfig.trade_analysis;
            const Icon = config.icon;
            return (
              <Card key={insight.id} className="hover:bg-accent/20 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-md ${config.color} shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{config.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(insight.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{insight.summary}</p>
                      {insight.reasoning && (
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap">{insight.reasoning}</p>
                      )}
                      {insight.market_insight && (
                        <div className="mt-2 px-3 py-2 rounded bg-secondary/50 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Market Insight: </span>
                          {insight.market_insight}
                        </div>
                      )}
                      {insight.agent_lessons && Array.isArray(insight.agent_lessons) && insight.agent_lessons.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {insight.agent_lessons.map((lesson: any, i: number) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">
                              {lesson.agent}: {lesson.action || lesson.lesson || "adjusted"}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
