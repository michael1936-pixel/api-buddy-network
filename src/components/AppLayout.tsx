import { ReactNode, useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useMarketData } from "@/contexts/MarketDataContext";
import { useOptimizationStore } from "@/stores/optimizationStore";

const navItems = [
  { to: "/", label: "סקירה" },
  { to: "/agents", label: "סוכנים" },
  { to: "/pipeline", label: "זרימה" },
  { to: "/decisions", label: "החלטות" },
  { to: "/news", label: "חדשות" },
  { to: "/backtest", label: "בקטסט" },
  { to: "/learning", label: "למידה" },
  { to: "/settings", label: "הגדרות" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: marketData, isRealtime } = useMarketData();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("he-IL")), 1000);
    return () => clearInterval(t);
  }, []);

  const vix = marketData?.VIX?.last;
  const spy = marketData?.SPY?.last;
  const spyPrev = marketData?.SPY?.prev_close;
  const spyChange = spy && spyPrev ? ((spy - spyPrev) / spyPrev * 100) : null;
  const spyUp = spyChange !== null ? spyChange >= 0 : null;

  const isMarketOpen = useMemo(() => {
    const now = new Date();
    const utcH = now.getUTCHours();
    const utcM = now.getUTCMinutes();
    const mins = utcH * 60 + utcM;
    const day = now.getUTCDay();
    return day >= 1 && day <= 5 && mins >= 14 * 60 + 30 && mins < 21 * 60;
  }, [clock]);

  return (
    <div className="min-h-screen">
      {/* ═══ Top Bar ═══ */}
      <div className="topbar">
        <div className="flex items-center h-14 px-5 gap-3 max-w-[1400px] mx-auto w-full">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-trading-profit shadow-[0_0_12px_hsl(var(--trading-profit))] animate-pulse-glow" />
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-br from-white to-muted-foreground bg-clip-text text-transparent">
              AlgoMaykl
            </span>
            <span className="text-[9px] text-muted-foreground bg-surface2 px-1.5 py-0.5 rounded font-medium" style={{ background: 'hsl(var(--surface2))' }}>
              v3.0
            </span>
          </div>

          {/* Desktop Tabs */}
          <nav className="hidden md:flex gap-0.5 mr-4">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "tab-btn",
                  location.pathname === item.to && "active"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Status info (desktop) */}
          <div className="hidden md:flex items-center gap-3.5 text-xs mr-auto">
            <span className={cn("font-mono", vix != null && vix < 20 ? "text-trading-profit" : vix != null && vix > 25 ? "text-trading-loss" : "text-yellow-400")}>
              VIX {vix != null ? vix.toFixed(2) : "--"}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className={cn("font-mono", spyUp === true ? "text-trading-profit" : spyUp === false ? "text-trading-loss" : "text-muted-foreground")}>
              SPY {spy != null ? spy.toFixed(2) : "--"}{spyChange !== null ? ` ${spyUp ? "↑" : "↓"}${Math.abs(spyChange).toFixed(2)}%` : ""}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className={isMarketOpen ? "text-trading-profit" : "text-muted-foreground"}>
              שוק: {isMarketOpen ? "פתוח" : "סגור"}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className={isRealtime ? "text-trading-profit" : "text-trading-warning"}>{isRealtime ? "⚡ זמן אמת" : "🔄 REST"}</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono text-muted-foreground/70">{clock}</span>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 z-50 border-t border-border flex justify-around items-center px-2"
        style={{ background: 'rgba(19,24,37,0.97)', backdropFilter: 'blur(20px)' }}>
        {navItems.slice(0, 7).map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-0.5 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors",
              location.pathname === item.to ? "text-primary" : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Main content */}
      <main className="pb-20 md:pb-0">
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto">{children}</div>
      </main>

      {/* Footer */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        <div className="mt-6 py-3.5 border-t border-border flex justify-between text-[10px] text-muted-foreground flex-wrap gap-2">
          <span>AlgoMaykl v3.0 — S&P 500 | 30 סוכנים | 5 שנים דאתה | SPY+VIX 15 שנים</span>
          <span>מסחר נייר — Interactive Brokers</span>
        </div>
      </div>
    </div>
  );
}
