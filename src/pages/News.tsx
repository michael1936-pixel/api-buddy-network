import { useNewsEvents, useAgentMemory, useMarketData } from "@/hooks/use-trading-data";

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

export default function NewsPage() {
  const { data: news = [] } = useNewsEvents(100);
  const { data: agentMemory = [] } = useAgentMemory();
  const { data: vixData = [] } = useMarketData("VIX");
  const { data: spyData = [] } = useMarketData("SPY");

  // News agent from agent_memory — map to actual fields
  const newsAgent = agentMemory.find((m: any) => m.agent_id === "news_research" || m.agent_id === "newsResearch" || m.agent_id === "news");
  const newsState = newsAgent?.state as any || {};
  const totalPatterns = newsState.totalPatterns || 0;
  const lastResearch = newsState.lastResearch;
  const newsConclusions = newsState.conclusions || {};
  const newsReasoning = totalPatterns > 0
    ? `${totalPatterns} דפוסים נלמדו`
    : lastResearch
      ? `סריקה אחרונה: ${new Date(lastResearch).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
      : "ממתין לסריקת חדשות ראשונה";

  // VIX from market_data
  const vixRow = vixData[0] as any;
  const vixPrevRow = vixData[1] as any;
  const vixCurrent = vixRow?.close || 0;
  const vixPrev = vixPrevRow?.close || vixCurrent;
  const vixChangePct = vixPrev > 0 ? ((vixCurrent - vixPrev) / vixPrev) * 100 : 0;
  const vixRegime = getVixRegime(vixCurrent);
  const vixTrend = vixChangePct > 1 ? "rising" : vixChangePct < -1 ? "falling" : "stable";
  const trendIcons: Record<string, string> = { rising: "📈", falling: "📉", stable: "➡️" };
  const trendLabels: Record<string, string> = { rising: "עולה", falling: "יורד", stable: "יציב" };
  const vrc = regimeColors[vixRegime] || "hsl(var(--muted-foreground))";

  // SPY from market_data
  const spyRow = spyData[0] as any;
  const spyPrevRow = spyData[1] as any;
  const spyCurrent = spyRow?.close || 0;
  const spyPrev = spyPrevRow?.close || spyCurrent;
  const spyChangePct = spyPrev > 0 ? ((spyCurrent - spyPrev) / spyPrev) * 100 : 0;
  const spyHigh = spyRow?.high || 0;
  const spyLow = spyRow?.low || 0;
  const spyVolume = spyRow?.volume || 0;

  // Risk level derived from news conclusions or patterns
  const riskLevel = newsConclusions.riskLevel || (totalPatterns > 5 ? "medium" : "none");
  const riskLabels: Record<string, string> = { extreme: "קריטי", high: "גבוה", medium: "בינוני", low: "נמוך", none: "אין" };
  const riskColor = riskLevel === "none" ? "hsl(var(--muted-foreground))" : riskLevel === "low" ? "hsl(var(--trading-profit))" : riskLevel === "high" || riskLevel === "extreme" ? "hsl(var(--trading-loss))" : "hsl(var(--trading-warning))";

  const formatVol = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v);

  return (
    <div className="space-y-4">
      {/* News Agent Header */}
      <div className="surface-card" style={{ borderColor: riskColor + "40" }}>
        <div className="p-[18px]">
          <div className="flex justify-between items-center mb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[14px] flex items-center justify-center text-2xl" style={{ background: riskColor + "15" }}>📰</div>
              <div>
                <div className="text-lg font-extrabold">סוכן מודיעין חדשות</div>
                <div className="text-xs text-muted-foreground mt-0.5">{newsReasoning}</div>
              </div>
            </div>
            <div className="text-left">
              <span className="badge-pill text-xs py-1 px-3.5" style={{ background: riskColor + "18", color: riskColor }}>
                סיכון: {riskLabels[riskLevel] || "--"}
              </span>
              {news.length > 0 && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  {news.length} אירועים
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* VIX + SPY Cards */}
      <div className="grid md:grid-cols-2 gap-3.5">
        {/* VIX Card */}
        <div className="surface-card">
          <div className="surface-card-head">
            <span className="text-sm font-semibold">📊 VIX — מדד הפחד</span>
            {vixCurrent > 0 && (
              <span className="badge-pill" style={{ background: vrc + "18", color: vrc }}>
                {regimeLabels[vixRegime] || "--"}
              </span>
            )}
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
            {vixRow && (
              <div className="text-[10px] text-muted-foreground">
                עדכון: {new Date(vixRow.timestamp).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
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
            {spyRow && (
              <div className="text-[10px] text-muted-foreground mt-2">
                עדכון: {new Date(spyRow.timestamp).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
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

      {/* Recent News Events */}
      <div className="surface-card">
        <div className="surface-card-head">
          <span className="text-sm font-semibold">📰 אירועי חדשות אחרונים ({news.length})</span>
        </div>
        {news.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📰</div>
            <div className="empty-state-text">אין אירועי חדשות</div>
            <div className="empty-state-sub">הסוכן יתחיל לאסוף חדשות כשהשוק ייפתח</div>
          </div>
        ) : (
          news.map((e: any) => {
            const ic = e.impact_level === "critical" || e.impact_level === "high" ? "hsl(var(--trading-loss))"
              : e.impact_level === "medium" ? "hsl(var(--trading-warning))" : "hsl(var(--muted-foreground))";
            const ts = e.timestamp ? new Date(e.timestamp).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
            return (
              <div key={e.id} className="row-item items-start py-3 px-[18px]">
                <span className="text-base mt-0.5">{sentimentIcons[e.sentiment] || "⚪"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold leading-relaxed">{e.headline || e.summary || "--"}</div>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    <span className="badge-pill" style={{ background: ic + "18", color: ic }}>
                      {impactLabels[e.impact_level] || e.impact_level}
                    </span>
                    <span className="badge-pill" style={{ background: 'hsl(var(--surface2))', color: 'hsl(var(--muted-foreground))' }}>
                      {e.category}
                    </span>
                    {e.source && <span className="text-[9px] text-muted-foreground">{e.source}</span>}
                    <span className="text-[9px] text-muted-foreground">{ts}</span>
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
                  {e.actual_spy_1h != null && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      תגובה בפועל: SPY {e.actual_spy_1h >= 0 ? "+" : ""}{e.actual_spy_1h.toFixed(2)}%
                      {e.actual_vix_change != null && ` | VIX ${e.actual_vix_change >= 0 ? "+" : ""}${e.actual_vix_change.toFixed(1)}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
