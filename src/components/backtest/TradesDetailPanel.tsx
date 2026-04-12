import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Trade {
  id: number;
  symbol: string;
  direction: string;
  entry_time: string;
  entry_price: number;
  exit_time: string | null;
  exit_price: number | null;
  pnl_pct: number;
  exit_reason: string | null;
  strategy: string | null;
  bars_held: number;
}

interface VerificationResult {
  match: boolean;
  expected_trades: number;
  actual_trades: number;
  expected_return: number;
  actual_return: number;
  discrepancies: Array<{
    trade_index: number;
    field: string;
    expected: string;
    actual: string;
  }>;
  message: string;
}

interface TradesDetailPanelProps {
  optimizationResultId: number;
  symbol: string;
  onClose: () => void;
}

export default function TradesDetailPanel({ optimizationResultId, symbol, onClose }: TradesDetailPanelProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<VerificationResult | null>(null);

  useEffect(() => {
    loadTrades();
  }, [optimizationResultId]);

  async function loadTrades() {
    setLoading(true);
    const { data, error } = await supabase
      .from('optimization_trades')
      .select('*')
      .eq('optimization_result_id', optimizationResultId)
      .order('entry_time', { ascending: true });

    if (error) {
      console.error('Failed to load trades:', error);
      setTrades([]);
    } else {
      setTrades((data as any[]) || []);
    }
    setLoading(false);
  }

  async function handleVerify() {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-optimization', {
        body: { optimization_result_id: optimizationResultId },
      });
      if (error) throw error;
      setVerification(data as VerificationResult);
    } catch (err: any) {
      toast({ title: '❌ שגיאת אימות', description: err.message, variant: 'destructive' });
    }
    setVerifying(false);
  }

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl_pct || 0), 0);
  const wins = trades.filter(t => t.pnl_pct > 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length * 100) : 0;

  return (
    <div className="border-2 border-primary/20 rounded-xl bg-slate-900/80 overflow-hidden">
      <div className="px-4 py-2 border-b border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-6 px-2">✕</Button>
          <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifying || trades.length === 0} className="text-xs h-6">
            {verifying ? '🔄 מאמת...' : '🔍 אמת עסקאות'}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">
            WR: <span className="text-primary font-mono">{winRate.toFixed(0)}%</span>
          </span>
          <span className={cn("text-[10px] font-mono", totalPnl >= 0 ? "text-trading-profit" : "text-trading-loss")}>
            סה"כ: {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(1)}%
          </span>
          <Badge variant="secondary" className="text-[10px]">{trades.length} עסקאות</Badge>
          <span className="text-sm font-semibold">📊 {symbol} — פירוט עסקאות</span>
        </div>
      </div>

      {/* Verification result */}
      {verification && (
        <div className={cn(
          "mx-3 mt-2 p-3 rounded-lg text-xs",
          verification.match ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-red-500/10 border border-red-500/30"
        )}>
          <div className="font-semibold mb-1">
            {verification.match ? '✅ אימות עבר — התוצאות תואמות' : '⚠️ נמצאו פערים'}
          </div>
          <div className="text-muted-foreground">{verification.message}</div>
          <div className="flex gap-4 mt-1">
            <span>עסקאות: {verification.expected_trades} צפוי / {verification.actual_trades} בפועל</span>
            <span>תשואה: {verification.expected_return?.toFixed(1)}% צפוי / {verification.actual_return?.toFixed(1)}% בפועל</span>
          </div>
          {verification.discrepancies?.length > 0 && (
            <div className="mt-2 space-y-0.5">
              <div className="font-semibold text-amber-400">פערים:</div>
              {verification.discrepancies.slice(0, 10).map((d, i) => (
                <div key={i} className="text-amber-400/80">
                  עסקה #{d.trade_index}: {d.field} — צפוי: {d.expected}, בפועל: {d.actual}
                </div>
              ))}
              {verification.discrepancies.length > 10 && (
                <div className="text-muted-foreground">...ועוד {verification.discrepancies.length - 10} פערים</div>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-8">טוען עסקאות...</div>
      ) : trades.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          אין עסקאות שמורות — צריך לעדכן את שרת Railway לשמור trades
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          {/* Header */}
          <div className="sticky top-0 z-10 px-2 py-1 grid grid-cols-[40px_55px_70px_65px_70px_65px_55px_45px_1fr] gap-1 text-[9px] text-muted-foreground font-semibold border-b border-primary/10" style={{ background: 'hsl(var(--surface))' }} dir="ltr">
            <span>#</span>
            <span>Dir</span>
            <span>Entry</span>
            <span>Price</span>
            <span>Exit</span>
            <span>Price</span>
            <span>P&L</span>
            <span>Bars</span>
            <span>Reason</span>
          </div>
          <div className="p-1 space-y-0" dir="ltr">
            {trades.map((t, i) => (
              <div
                key={t.id}
                className={cn(
                  "px-2 py-0.5 grid grid-cols-[40px_55px_70px_65px_70px_65px_55px_45px_1fr] gap-1 text-[10px] font-mono rounded hover:bg-primary/5",
                  t.pnl_pct > 0 ? 'text-trading-profit/90' : t.pnl_pct < 0 ? 'text-trading-loss/90' : 'text-muted-foreground'
                )}
              >
                <span className="text-muted-foreground">{i + 1}</span>
                <span>
                  <Badge variant={t.direction === 'long' ? 'default' : 'destructive'} className="text-[8px] px-1 py-0 h-4">
                    {t.direction === 'long' ? '🟢 L' : '🔴 S'}
                  </Badge>
                </span>
                <span>{t.entry_time ? new Date(t.entry_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</span>
                <span>{t.entry_price?.toFixed(2)}</span>
                <span>{t.exit_time ? new Date(t.exit_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</span>
                <span>{t.exit_price?.toFixed(2) || '-'}</span>
                <span className="font-bold">
                  {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">{t.bars_held || '-'}</span>
                <span className="text-muted-foreground truncate">{t.exit_reason || '-'}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
