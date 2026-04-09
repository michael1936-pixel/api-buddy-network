import { useTrackedSymbols } from "@/hooks/use-trading-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Database, Server, Shield } from "lucide-react";

export default function SettingsPage() {
  const { data: symbols = [] } = useTrackedSymbols();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* System Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" />
            System Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Timeframe</span>
                <span className="font-mono">15min</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Max Positions</span>
                <span className="font-mono">10</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Stock Data</span>
                <span className="font-mono">5 years</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Reference Data</span>
                <span className="font-mono">15 years (SPY, VIX)</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Max Daily Loss</span>
                <span className="font-mono text-trading-loss">-3%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Optimization Staleness</span>
                <span className="font-mono">14 days</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Weekly Optimization</span>
                <span className="font-mono">Sunday</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Active Agents</span>
                <span className="font-mono">21</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tracked Symbols */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Tracked Symbols ({symbols.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {symbols.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracked symbols</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {symbols.map((s: any) => (
                <Badge key={s.symbol} variant="outline" className="font-mono text-sm px-3 py-1">
                  {s.symbol}
                  {s.total_bars > 0 && (
                    <span className="ml-2 text-[10px] text-muted-foreground">{s.total_bars.toLocaleString()} bars</span>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Architecture */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Architecture
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• <strong className="text-foreground">Trading Server</strong> — Node.js/Express running on external host (Railway/VPS). Executes signals every 15min cycle.</p>
          <p>• <strong className="text-foreground">Database</strong> — Lovable Cloud (Supabase) with 17 tables. Shared between server and dashboard.</p>
          <p>• <strong className="text-foreground">Dashboard</strong> — This React app. Reads directly from the database in real-time.</p>
          <p>• <strong className="text-foreground">Execution</strong> — TradersPost webhook for order routing to broker.</p>
          <p>• <strong className="text-foreground">Data Sources</strong> — Twelve Data (OHLCV), Finnhub (news), Claude API (AI analysis).</p>
        </CardContent>
      </Card>
    </div>
  );
}
