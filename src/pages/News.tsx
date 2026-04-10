import { useState } from "react";
import { useNewsAnalysis } from "@/hooks/use-trading-data";
import { useMarketData } from "@/contexts/MarketDataContext";

const impactLabels: Record<string, string> = { critical: "קריטי", high: "גבוה", medium: "בינוני", low: "נמוך", noise: "רעש", major: "משמעותי", moderate: "בינוני", minor: "קטן", none: "אפסי" };
const sentimentIcons: Record<string, string> = { very_negative: "🔴", negative: "🟠", neutral: "⚪", positive: "🟢", very_positive: "💚", bullish: "🟢", bearish: "🔴" };

const regimeLabels: Record<string, string> = { complacency: "שאננות", normal: "רגיל", elevated: "מוגבר", fear: "פחד", panic: "פניקה" };
const regimeColors: Record<string, string> = { complacency: "hsl(var(--trading-warning))", normal: "hsl(var(--trading-profit))", elevated: "hsl(var(--trading-warning))", fear: "#ff6b35", panic: "hsl(var(--trading-loss))" };

const regimeBands = [
  { label: "שאננות", range: "<12", width: 15 },
  { label: "רגיל", range: "12-18", width: 25 },
  { label: "מוגבר", range: "18-25", width: 25 },
  { label: "פחד", range: "25-35", width: 20 },
  { label: "פניקה", range: "35+", width: 15 },
];
const bandColors = ["hsl(var(--trading-warning))", "hsl(var(--trading-profit))", "hsl(var(--trading-warning))", "#ff6b35", "hsl(var(--trading-loss))"];

const spyImpactLabels: Record<string, string> = {
  strong_bullish: "שורי חזק 🟢🟢", bullish: "שורי 🟢", neutral: "ניטרלי ⚪",
  bearish: "דובי 🔴", strong_bearish: "דובי חזק 🔴🔴",
};
const vixImpactLabels: Record<string, string> = {
  spike: "זינוק 📈📈", rise: "עלייה 📈", stable: "יציב ➡️",
  drop: "ירידה 📉", crash: "צניחה 📉📉",
};

function getVixPct(v: number) {
  if (v < 12) return (v / 12) * 15;
  if (v < 18) return 15 + ((v - 12) / 6) * 25;
  if (v < 25) return 40 + ((v - 18) / 7) * 25;
  if (v < 35) return 65 + ((v - 25) / 10) * 20;
  return 85 + Math.min(((v - 35) / 15) * 15, 15);
}

function getVixRegime(v: number): string {
  if (v < 12) return "complacency";
  if (v < 18) return "normal";
  if (v < 25) return "elevated";
  if (v < 35) return "fear";
  return "panic";
}

function getSentimentColor(score: number | null): string {
  if (score == null) return "hsl(var(--muted-foreground))";
  if (score >= 50) return "hsl(var(--trading-profit))";
  if (score >= 10) return "hsl(142, 71%, 45%)";
  if (score >= -10) return "hsl(var(--muted-foreground))";
  if (score >= -50) return "hsl(var(--trading-warning))";
  return "hsl(var(--trading-loss))";
}

export default function NewsPage() {
  const { data: analysisData } = useNewsAnalysis(100);
  const { data: liveMarket = {}, wsStatus, isRealtime } = useMarketData();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const news = (analysisData?.news || []) as any[];
  const agentStats = analysisData?.agentStats as any;
  const analyzedNow = analysisData?.analyzedNow || 0;

  const vixLive = (liveMarket as any)?.VIX;
  const spyLive = (liveMarket as any)?.SPY;

  const vixCurrent = vixLive?.close || 0;
  const vixPrev = vixLive?.prev_close || vixCurrent;
  const vixChangePct = vixPrev > 0 ? ((vixCurrent - vixPrev) / vixPrev) * 100 : 0;
  const vixRegime = getVixRegime(vixCurrent);
  const vixTrend = vixChangePct > 1 ? "rising" : vixChangePct < -1 ? "falling" : "stable";
  const trendIcons: Record<string, string> = { rising: "📈", falling: "📉", stable: "➡️" };
  const trendLabels: Record<string, string> = { rising: "עולה", falling: "יורד", stable: "יציב" };
  const vrc = regimeColors[vixRegime] || "hsl(var(--muted-foreground))";
  const vixTimestamp = vixLive?.timestamp;

  const spyCurrent = spyLive?.close || 0;
  const spyPrev = spyLive?.prev_close || spyCurrent;
  const spyChangePct = spyPrev > 0 ? ((spyCurrent - spyPrev) / spyPrev) * 100 : 0;
  const spyHigh = spyLive?.high || 0;
  const spyLow = spyLive?.low || 0;
  const spyVolume = spyLive?.volume || 0;
  const spyTimestamp = spyLive?.timestamp;

  // Agent stats
  const totalAnalyzed = agentStats?.total_analyzed || 0;
  const patterns = agentStats?.patterns || [];
  const keyLearnings = agentStats?.key_learnings || [];
  const lastAnalysis = agentStats?.last_analysis;

  const analyzedNews = news.filter((n: any) => n.analyzed_at);
  const withReactions = news.filter((n: any) => n.actual_spy_1h != null);

  const formatVol = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v);

  return (
    <div className="space-y-4">
      {/* News Agent Header */}
      <div className="surface-card" style={{ borderColor: "hsl(var(--primary) / 0.3)" }}>
        <div className="p-[18px]">
          <div className="flex justify-between items-center mb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[14px] flex items-center justify-center text-2xl" style={{ background: "hsl(var(--primary) / 0.12)" }}>🧠</div>
              <div>
                <div className="text-lg font-extrabold">סוכן חדשות AI</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {totalAnalyzed > 0
                    ? `${totalAnalyzed} חדשות נותחו | ${patterns.length} דפוסים זוהו`
                    : "ממתין לניתוח ראשון..."}
                  {analyzedNow > 0 && <span className="text-primary mr-1"> • נותחו {analyzedNow} חדשות עכשיו</span>}
                </div>
              </div>
            </div>
            <div className="text-left">
              <span className="badge-pill text-xs py-1 px-3.5" style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}>
                {analyzedNews.length}/{news.length} נותחו
              </span>
              {lastAnalysis && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  ניתוח אחרון: {new Date(lastAnalysis).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>

          {/* Agent Learning Stats */}
          {totalAnalyzed > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="text-center p-2 rounded-lg" style={{ background: 'hsl(var(--surface2))' }}>
                <div className="font-mono text-sm font-bold text-foreground">{totalAnalyzed}</div>
                <div className="text-[9px] text-muted-foreground">חדשות נותחו</div>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: 'hsl(var(--surface2))' }}>
                <div className="font-mono text-sm font-bold text-foreground">{patterns.length}</div>
                <div className="text-[9px] text-muted-foreground">דפוסים</div>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: 'hsl(var(--surface2))' }}>
                <div className="font-mono text-sm font-bold text-foreground">{withReactions.length}</div>
                <div className="text-[9px] text-muted-foreground">תגובות שוק</div>
              </div>
            </div>
          )}

          {/* Recent Patterns */}
          {patterns.length > 0 && (
            <div className="mt-3 p-2.5 rounded-lg" style={{ background: 'hsl(var(--surface2))' }}>
              <div className="text-[10px] font-bold text-muted-foreground mb-1.5">🔍 דפוסים אחרונים:</div>
              <div className="space-y-1">
                {patterns.slice(-3).map((p: string, i: number) => (
                  <div key={i} className="text-[11px] text-foreground">• {p}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VIX + SPY Cards */}
      <div className="grid md:grid-cols-2 gap-3.5">
        {/* VIX Card */}
        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">📊 VIX — מדד הפחד</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{
                background: isRealtime ? "hsl(var(--trading-profit) / 0.15)" : "hsl(var(--trading-warning) / 0.15)",
                color: isRealtime ? "hsl(var(--trading-profit))" : "hsl(var(--trading-warning))"
              }}>
                {isRealtime ? "⚡ WS" : "🔄 REST"}
              </span>
              {vixCurrent > 0 && (
                <span className="badge-pill" style={{ background: vrc + "18", color: vrc }}>
                  {regimeLabels[vixRegime] || "--"}
                </span>
              )}
            </div>
          </div>
          <div className="p-[18px]">
            <div className="flex items-baseline gap-2.5 mb-3">
              <span className="font-mono text-[28px] font-extrabold" style={{ color: vrc }}>
                {vixCurrent > 0 ? vixCurrent.toFixed(1) : "--"}
              </span>
              {vixCurrent > 0 && vixPrev !== vixCurrent && (
                <>
                  <span className="font-mono text-sm font-semibold" style={{ color: vixChangePct >= 0 ? "hsl(var(--trading-loss))" : "hsl(var(--trading-profit))" }}>
                    {vixChangePct >= 0 ? "+" : ""}{vixChangePct.toFixed(1)}%
                  </span>
                  <span className="text-sm">{trendIcons[vixTrend] || "➡️"} {trendLabels[vixTrend] || "--"}</span>
                </>
              )}
            </div>
              {vixTimestamp && (
              <div className="text-[10px] text-muted-foreground">
                עדכון: {new Date(vixTimestamp).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                {" "}({isRealtime ? "⚡ WS" : "REST"})
              </div>
            )}
          </div>
        </div>

        {/* SPY Card */}
        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">📊 SPY — S&P 500</span>
          </div>
          <div className="p-[18px]">
            <div className="flex items-baseline gap-2.5 mb-3">
              <span className="font-mono text-[28px] font-extrabold" style={{ color: spyCurrent > 0 ? (spyChangePct >= 0 ? "hsl(var(--trading-profit))" : "hsl(var(--trading-loss))") : "hsl(var(--muted-foreground))" }}>
                {spyCurrent > 0 ? `$${spyCurrent.toFixed(2)}` : "--"}
              </span>
              {spyCurrent > 0 && spyPrev !== spyCurrent && (
                <span className="font-mono text-sm font-semibold" style={{ color: spyChangePct >= 0 ? "hsl(var(--trading-profit))" : "hsl(var(--trading-loss))" }}>
                  {spyChangePct >= 0 ? "+" : ""}{spyChangePct.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg" style={{ background: 'hsl(var(--surface2))' }}>
                <div className="font-mono text-xs text-foreground">{spyVolume > 0 ? formatVol(spyVolume) : "--"}</div>
                <div className="text-[9px] text-muted-foreground">נפח</div>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: 'hsl(var(--surface2))' }}>
                <div className="font-mono text-xs text-foreground">{spyHigh > 0 ? `$${spyHigh.toFixed(2)}` : "--"}</div>
                <div className="text-[9px] text-muted-foreground">גבוה</div>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ background: 'hsl(var(--surface2))' }}>
                <div className="font-mono text-xs text-foreground">{spyLow > 0 ? `$${spyLow.toFixed(2)}` : "--"}</div>
                <div className="text-[9px] text-muted-foreground">נמוך</div>
              </div>
            </div>
            {spyTimestamp && (
              <div className="text-[10px] text-muted-foreground mt-2">
                עדכון: {new Date(spyTimestamp).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                {" "}({isRealtime ? "⚡ WS" : "REST"})
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIX Scale */}
      <div className="surface-card">
        <div className="p-4 px-[18px]">
          <div className="text-[13px] font-bold mb-3">🌡️ סולם VIX — השפעה על מסחר</div>
          <div className="flex h-8 rounded-lg overflow-hidden mb-2 relative">
            {regimeBands.map((b, i) => (
              <div
                key={b.label}
                className="flex items-center justify-center border-l border-background first:border-l-0"
                style={{ width: `${b.width}%`, background: bandColors[i] + "25" }}
              >
                <span className="text-[9px] font-semibold" style={{ color: bandColors[i] }}>{b.label}</span>
              </div>
            ))}
          </div>
          {vixCurrent > 0 && (
            <div className="relative h-2.5 mb-2">
              <div
                className="absolute w-0 h-0 transition-all duration-500"
                style={{
                  right: `${100 - getVixPct(vixCurrent)}%`,
                  transform: "translateX(50%)",
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderBottom: "8px solid hsl(var(--foreground))",
                }}
              />
            </div>
          )}
          <div className="flex justify-between text-[9px] text-muted-foreground">
            {regimeBands.map((b) => <span key={b.range}>{b.range}</span>)}
          </div>
        </div>
      </div>

      {/* Recent News Events with AI Analysis */}
      <div className="surface-card">
        <div className="surface-card-head">
          <span className="text-sm font-semibold">📰 אירועי חדשות + ניתוח AI ({news.length})</span>
        </div>
        {news.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📰</div>
            <div className="empty-state-text">אין אירועי חדשות</div>
            <div className="empty-state-sub">הסוכן יתחיל לאסוף ולנתח חדשות בקרוב</div>
          </div>
        ) : (
          news.map((e: any) => {
            const ic = e.impact_level === "critical" || e.impact_level === "high" ? "hsl(var(--trading-loss))"
              : e.impact_level === "medium" ? "hsl(var(--trading-warning))" : "hsl(var(--muted-foreground))";
            const ts = e.timestamp ? new Date(e.timestamp).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
            const isExpanded = expandedId === (e.id || e.event_id);
            const hasAnalysis = !!e.ai_analysis;
            const sentColor = getSentimentColor(e.ai_sentiment_score);

            return (
              <div
                key={e.id || e.event_id}
                className="py-3 px-[18px] border-b border-border/30 last:border-b-0 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : (e.id || e.event_id))}
              >
                <div className="flex gap-2.5 items-start">
                  <span className="text-base mt-0.5">{sentimentIcons[e.sentiment] || "⚪"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold leading-relaxed">{e.headline || e.summary || "--"}</div>
                    <div className="flex gap-1.5 flex-wrap mt-1 items-center">
                      <span className="badge-pill" style={{ background: ic + "18", color: ic }}>
                        {impactLabels[e.impact_level] || e.impact_level}
                      </span>
                      <span className="badge-pill" style={{ background: 'hsl(var(--surface2))', color: 'hsl(var(--muted-foreground))' }}>
                        {e.category}
                      </span>
                      {hasAnalysis && (
                        <span className="badge-pill" style={{ background: sentColor + "18", color: sentColor }}>
                          🧠 {e.ai_sentiment_score > 0 ? "+" : ""}{e.ai_sentiment_score}
                        </span>
                      )}
                      {e.source && <span className="text-[9px] text-muted-foreground">{e.source}</span>}
                      <span className="text-[9px] text-muted-foreground">{ts}</span>
                      {hasAnalysis && !isExpanded && (
                        <span className="text-[9px] text-primary cursor-pointer">▼ מחשבות הסוכן</span>
                      )}
                    </div>

                    {e.affected_symbols?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {e.affected_symbols.slice(0, 8).map((s: string) => (
                          <span key={s} className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'hsla(217,91%,60%,0.12)', color: 'hsl(var(--primary))' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Expanded: AI Agent Thoughts */}
                    {isExpanded && hasAnalysis && (
                      <div className="mt-2.5 p-3 rounded-lg space-y-2" style={{ background: 'hsl(var(--surface2))' }}>
                        <div className="text-[11px] font-bold text-primary">🧠 מחשבות הסוכן:</div>
                        <div className="text-[11px] text-foreground leading-relaxed">{e.ai_analysis}</div>

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="p-2 rounded" style={{ background: 'hsl(var(--background))' }}>
                            <div className="text-[9px] text-muted-foreground">תחזית SPY</div>
                            <div className="text-[11px] font-semibold">{spyImpactLabels[e.predicted_spy_impact] || e.predicted_spy_impact || "--"}</div>
                          </div>
                          <div className="p-2 rounded" style={{ background: 'hsl(var(--background))' }}>
                            <div className="text-[9px] text-muted-foreground">תחזית VIX</div>
                            <div className="text-[11px] font-semibold">{vixImpactLabels[e.predicted_vix_impact] || e.predicted_vix_impact || "--"}</div>
                          </div>
                        </div>

                        {/* Actual vs Predicted */}
                        {e.actual_spy_1h != null && (
                          <div className="p-2 rounded border" style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
                            <div className="text-[9px] font-bold text-muted-foreground mb-1">📊 תחזית מול מציאות:</div>
                            <div className="flex gap-3">
                              <div>
                                <span className="text-[9px] text-muted-foreground">SPY בפועל: </span>
                                <span className="font-mono text-[11px] font-bold" style={{ color: e.actual_spy_1h >= 0 ? "hsl(var(--trading-profit))" : "hsl(var(--trading-loss))" }}>
                                  {e.actual_spy_1h >= 0 ? "+" : ""}{e.actual_spy_1h.toFixed(2)}%
                                </span>
                              </div>
                              {e.actual_vix_change != null && (
                                <div>
                                  <span className="text-[9px] text-muted-foreground">VIX: </span>
                                  <span className="font-mono text-[11px] font-bold" style={{ color: e.actual_vix_change >= 0 ? "hsl(var(--trading-loss))" : "hsl(var(--trading-profit))" }}>
                                    {e.actual_vix_change >= 0 ? "+" : ""}{e.actual_vix_change.toFixed(1)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="text-[9px] text-muted-foreground">
                          נותח ב: {e.analyzed_at ? new Date(e.analyzed_at).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                        </div>
                      </div>
                    )}

                    {/* Show market reaction even when collapsed */}
                    {!isExpanded && e.actual_spy_1h != null && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        תגובה בפועל: SPY {e.actual_spy_1h >= 0 ? "+" : ""}{e.actual_spy_1h.toFixed(2)}%
                        {e.actual_vix_change != null && ` | VIX ${e.actual_vix_change >= 0 ? "+" : ""}${e.actual_vix_change.toFixed(1)}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
