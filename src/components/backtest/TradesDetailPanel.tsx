import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Trade {
  id?: number;
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
  strategy_id?: number;
  _source?: 'stored' | 'replay';
}

interface GapDiagnosis {
  trade_index: number;
  field: string;
  expected: string;
  actual: string;
  source: string;
  detail: string;
}

interface VerificationStats {
  total_pnl: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  max_win_streak: number;
  max_loss_streak: number;
  max_drawdown: number;
  profit_factor: number;
  sharpe: number;
  total_trades: number;
  wins: number;
  losses: number;
  missing_bars: number;
  stored_total_pnl?: number;
  stored_win_rate?: number;
  stored_count?: number;
}

interface VerificationResult {
  match: boolean;
  has_stored_trades: boolean;
  expected_trades: number;
  actual_trades: number;
  expected_return: number;
  actual_return: number;
  replay_trades?: Array<{
    direction: string;
    entry_time: string;
    entry_price: number;
    exit_time: string | null;
    exit_price: number | null;
    pnl_pct: number;
    exit_reason: string;
    bars_held: number;
    strategy_id: number;
  }>;
  discrepancies: GapDiagnosis[];
  gap_summary?: Record<string, number>;
  stats?: VerificationStats;
  message: string;
}

interface TradesDetailPanelProps {
  optimizationResultId: number;
  symbol: string;
  onClose: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  missing_data: '📉 נתונים חסרים',
  boundary_condition: '🔄 תנאי שוליים',
  logic_divergence: '⚙️ הבדל בלוגיקה',
  cumulative_drift: '📊 סטייה מצטברת',
  precision: '🔢 עיגול/precision',
  price_mismatch: '💰 אי-התאמת מחיר',
  calculation_error: '🧮 שגיאת חישוב',
  indicator_divergence: '📐 הבדל באינדיקטור',
  indicator_anomaly: '⚡ אינדיקטור חריג',
  unknown: '❓ לא מזוהה',
};

const STRATEGY_NAMES: Record<number, string> = {
  1: 'EMA Trend',
  2: 'BB Reversion',
  3: 'Range Breakout',
  4: 'Inside Bar',
  5: 'ATR Squeeze',
};

export default function TradesDetailPanel({ optimizationResultId, symbol, onClose }: TradesDetailPanelProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null);
  const [showReplayTrades, setShowReplayTrades] = useState(false);

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
      setTrades((data as any[])?.map(t => ({ ...t, _source: 'stored' as const })) || []);
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
      const vResult = data as VerificationResult;
      setVerification(vResult);

      // If no stored trades but we got replay trades, show those
      if (trades.length === 0 && vResult.replay_trades && vResult.replay_trades.length > 0) {
        setTrades(vResult.replay_trades.map((rt, i) => ({
          id: -(i + 1),
          symbol,
          direction: rt.direction,
          entry_time: rt.entry_time,
          entry_price: rt.entry_price,
          exit_time: rt.exit_time,
          exit_price: rt.exit_price,
          pnl_pct: rt.pnl_pct,
          exit_reason: rt.exit_reason,
          strategy: STRATEGY_NAMES[rt.strategy_id] || `S${rt.strategy_id}`,
          bars_held: rt.bars_held,
          strategy_id: rt.strategy_id,
          _source: 'replay' as const,
        })));
        setShowReplayTrades(true);
      }
    } catch (err: any) {
      toast({ title: '❌ שגיאת אימות', description: err.message, variant: 'destructive' });
    }
    setVerifying(false);
  }

  const displayTrades = trades;
  const totalPnl = displayTrades.reduce((sum, t) => sum + (t.pnl_pct || 0), 0);
  const wins = displayTrades.filter(t => t.pnl_pct > 0).length;
  const winRate = displayTrades.length > 0 ? (wins / displayTrades.length * 100) : 0;

  // Build gap map
  const tradeGaps = new Map<number, GapDiagnosis[]>();
  if (verification?.discrepancies) {
    for (const d of verification.discrepancies) {
      if (d.trade_index > 0) {
        const list = tradeGaps.get(d.trade_index) || [];
        list.push(d);
        tradeGaps.set(d.trade_index, list);
      }
    }
  }

  const stats = verification?.stats;

  return (
    <div className="border-2 border-primary/20 rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-6 px-2">✕</Button>
          <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifying} className="text-xs h-6">
            {verifying ? '🔄 מאמת...' : '🔍 אמת + Replay'}
          </Button>
          {showReplayTrades && (
            <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400 animate-pulse">
              📡 מציג עסקאות מ-Replay
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">
            WR: <span className="text-primary font-mono">{winRate.toFixed(0)}%</span>
          </span>
          <span className={cn("text-[10px] font-mono", totalPnl >= 0 ? "text-trading-profit" : "text-trading-loss")}>
            סה"כ: {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(1)}%
          </span>
          <Badge variant="secondary" className="text-[10px]">{displayTrades.length} עסקאות</Badge>
          <span className="text-sm font-semibold">📊 {symbol} — פירוט עסקאות</span>
        </div>
      </div>

      {/* Extended Stats */}
      {stats && (
        <div className="mx-3 mt-2 p-3 rounded-lg bg-muted/30 border border-border grid grid-cols-4 sm:grid-cols-6 gap-2 text-[10px]" dir="ltr">
          <StatBox label="Replay P&L" value={`${stats.total_pnl >= 0 ? '+' : ''}${stats.total_pnl.toFixed(1)}%`} color={stats.total_pnl >= 0 ? 'text-trading-profit' : 'text-trading-loss'} />
          <StatBox label="Win Rate" value={`${stats.win_rate.toFixed(0)}%`} />
          <StatBox label="Avg Win" value={`+${stats.avg_win.toFixed(2)}%`} color="text-trading-profit" />
          <StatBox label="Avg Loss" value={`${stats.avg_loss.toFixed(2)}%`} color="text-trading-loss" />
          <StatBox label="Profit Factor" value={stats.profit_factor === Infinity ? '∞' : stats.profit_factor.toFixed(2)} />
          <StatBox label="Sharpe" value={stats.sharpe.toFixed(2)} />
          <StatBox label="Max DD" value={`-${stats.max_drawdown.toFixed(1)}%`} color="text-trading-loss" />
          <StatBox label="Win Streak" value={`${stats.max_win_streak}`} color="text-trading-profit" />
          <StatBox label="Loss Streak" value={`${stats.max_loss_streak}`} color="text-trading-loss" />
          <StatBox label="W/L" value={`${stats.wins}/${stats.losses}`} />
          {stats.stored_count !== undefined && stats.stored_count > 0 && (
            <StatBox label="Stored" value={`${stats.stored_count} trades`} color="text-muted-foreground" />
          )}
          {stats.missing_bars > 0 && (
            <StatBox label="Missing Bars" value={`${stats.missing_bars}`} color="text-amber-400" />
          )}
        </div>
      )}

      {/* Verification result */}
      {verification && (
        <div className={cn(
          "mx-3 mt-2 p-3 rounded-lg text-xs",
          verification.match ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-amber-500/10 border border-amber-500/30"
        )}>
          <div className="font-semibold mb-1">
            {verification.match ? '✅ אימות עבר — התוצאות תואמות' : verification.has_stored_trades ? '⚠️ נמצאו פערים בין שמור ל-Replay' : '🔄 Replay בלבד — אין עסקאות שמורות'}
          </div>
          <div className="text-muted-foreground">{verification.message}</div>

          {verification.has_stored_trades && (
            <div className="flex gap-4 mt-1">
              <span>שמור: {verification.expected_trades} עסקאות / {verification.expected_return?.toFixed(1)}%</span>
              <span>Replay: {verification.actual_trades} עסקאות / {verification.actual_return?.toFixed(1)}%</span>
            </div>
          )}

          {/* Gap summary */}
          {verification.gap_summary && Object.keys(verification.gap_summary).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(verification.gap_summary).map(([source, count]) => (
                <Badge key={source} variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">
                  {SOURCE_LABELS[source] || source}: {count}
                </Badge>
              ))}
            </div>
          )}

          {/* Detailed discrepancies */}
          {verification.discrepancies?.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="font-semibold text-amber-400">פערים מפורטים:</div>
              {verification.discrepancies.slice(0, 15).map((d, i) => (
                <div key={i} className="text-amber-400/80 flex flex-col">
                  <span>
                    {d.trade_index > 0 ? `עסקה #${d.trade_index}` : 'כללי'}: {d.field} — צפוי: {d.expected}, בפועל: {d.actual}
                  </span>
                  <span className="text-[9px] text-muted-foreground mr-4">
                    🔎 {SOURCE_LABELS[d.source] || d.source}: {d.detail}
                  </span>
                </div>
              ))}
              {verification.discrepancies.length > 15 && (
                <div className="text-muted-foreground">...ועוד {verification.discrepancies.length - 15} פערים</div>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-8">טוען עסקאות...</div>
      ) : displayTrades.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 space-y-2">
          <div className="text-lg">📭</div>
          <div className="text-sm font-medium">אין עסקאות שמורות עדיין</div>
          <div className="text-xs text-muted-foreground/70 max-w-md mx-auto">
            שרת Railway צריך לשמור עסקאות ל-optimization_trades בסוף כל אופטימיזציה.
            <br />
            בינתיים, לחץ <strong>"🔍 אמת + Replay"</strong> כדי להריץ את האסטרטגיה מחדש על נתוני השוק ולראות עסקאות.
          </div>
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          {/* Table header */}
          <div className="sticky top-0 z-10 px-2 py-1 grid grid-cols-[24px_40px_55px_70px_65px_70px_65px_55px_45px_1fr] gap-1 text-[9px] text-muted-foreground font-semibold border-b border-primary/10 bg-card" dir="ltr">
            <span></span>
            <span>#</span>
            <span>Dir</span>
            <span>Entry</span>
            <span>Price</span>
            <span>Exit</span>
            <span>Price</span>
            <span>P&L</span>
            <span>Bars</span>
            <span>Strategy / Reason</span>
          </div>
          <div className="p-1 space-y-0" dir="ltr">
            {displayTrades.map((t, i) => {
              const hasGap = tradeGaps.has(i + 1);
              const gaps = tradeGaps.get(i + 1) || [];
              const isExpanded = expandedTrade === i;
              const isReplay = t._source === 'replay';

              return (
                <Collapsible key={t.id || i} open={isExpanded} onOpenChange={() => setExpandedTrade(isExpanded ? null : i)}>
                  <CollapsibleTrigger asChild>
                    <div
                      className={cn(
                        "px-2 py-0.5 grid grid-cols-[24px_40px_55px_70px_65px_70px_65px_55px_45px_1fr] gap-1 text-[10px] font-mono rounded cursor-pointer hover:bg-primary/5",
                        hasGap && 'bg-red-500/5 border-l-2 border-red-500/50',
                        isReplay && !hasGap && 'bg-blue-500/5 border-l-2 border-blue-500/30',
                        t.pnl_pct > 0 ? 'text-trading-profit/90' : t.pnl_pct < 0 ? 'text-trading-loss/90' : 'text-muted-foreground'
                      )}
                    >
                      <span className="flex items-center">
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      </span>
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
                      <span className="text-muted-foreground truncate flex items-center gap-1">
                        {t.strategy && <span className="text-primary/60">{t.strategy}</span>}
                        {t.exit_reason || '-'}
                        {hasGap && <span className="text-red-400 text-[8px]">⚠️{gaps.length}</span>}
                        {isReplay && <span className="text-blue-400 text-[8px]">🔄</span>}
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mx-8 my-1 p-2 rounded bg-muted/20 border border-border text-[9px] space-y-1">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <span>Strategy: <strong>{t.strategy || '-'}</strong></span>
                        <span>Symbol: <strong>{t.symbol}</strong></span>
                        <span>Entry: <strong>{t.entry_time ? new Date(t.entry_time).toLocaleString() : '-'}</strong></span>
                        <span>Exit: <strong>{t.exit_time ? new Date(t.exit_time).toLocaleString() : '-'}</strong></span>
                        <span>Entry Price: <strong>{t.entry_price?.toFixed(4)}</strong></span>
                        <span>Exit Price: <strong>{t.exit_price?.toFixed(4) || '-'}</strong></span>
                        <span>Bars Held: <strong>{t.bars_held || '-'}</strong></span>
                        <span>Direction: <strong>{t.direction}</strong></span>
                        <span>Source: <strong>{isReplay ? '🔄 Replay' : '💾 DB'}</strong></span>
                      </div>
                      {gaps.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-red-500/20 space-y-0.5">
                          <div className="text-red-400 font-semibold">🔍 פערים שזוהו:</div>
                          {gaps.map((g, gi) => (
                            <div key={gi} className="text-red-400/80">
                              <span className="font-medium">{g.field}</span>: צפוי {g.expected}, בפועל {g.actual}
                              <div className="text-muted-foreground mr-2">
                                {SOURCE_LABELS[g.source] || g.source}: {g.detail}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-muted-foreground text-[8px]">{label}</div>
      <div className={cn("font-mono font-semibold text-[11px]", color || "text-foreground")}>{value}</div>
    </div>
  );
}
