import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export interface OptimizationStatus {
  isRunning: boolean;
  symbol: string;
  stageName: string;
  stageDescription: string;
  currentStage: number;
  totalStages: number;
  percent: number;
  barsLoaded?: number;
  targetBars?: number;
  combosCompleted?: number;
  combosTotal?: number;
  bestTrainReturn?: number;
  bestTestReturn?: number;
  error?: string;
  completed?: boolean;
}

interface Props {
  status: OptimizationStatus;
  onCancel: () => void;
  onClose: () => void;
}

export default function OptimizationProgress({ status, onCancel, onClose }: Props) {
  const isOpen = status.isRunning || !!status.completed || !!status.error;

  return (
    <Dialog open={isOpen} onOpenChange={() => { if (!status.isRunning) onClose(); }}>
      <DialogContent className="sm:max-w-md" style={{ background: 'hsl(var(--surface))' }}>
        <DialogHeader>
          <DialogTitle className="text-base">
            🔬 אופטימיזציה — {status.symbol}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {status.error ? '❌ שגיאה' : status.completed ? '✅ הושלם' : status.stageDescription}
          </DialogDescription>
        </DialogHeader>

        {status.error ? (
          <div className="text-sm text-trading-loss">{status.error}</div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>שלב {status.currentStage}/{status.totalStages}: {status.stageName}</span>
              <span>{status.percent}%</span>
            </div>
            <Progress value={status.percent} className="h-2" />

            {(status.barsLoaded !== undefined || status.combosTotal) && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {status.barsLoaded !== undefined && (
                  <div className="flex justify-between">
                    <span>Bars</span>
                    <span>
                      {status.barsLoaded.toLocaleString()}
                      {status.targetBars ? ` / ~${status.targetBars.toLocaleString()}` : ''}
                    </span>
                  </div>
                )}
                {!!status.combosTotal && (
                  <div className="flex justify-between">
                    <span>קומבינציות</span>
                    <span>{(status.combosCompleted || 0).toLocaleString()} / {status.combosTotal.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            {(status.bestTrainReturn !== undefined) && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md p-2" style={{ background: 'hsl(var(--muted))' }}>
                  <div className="text-muted-foreground">אימון</div>
                  <div className={`font-mono font-bold ${(status.bestTrainReturn || 0) >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                    {(status.bestTrainReturn || 0) >= 0 ? '+' : ''}{(status.bestTrainReturn || 0).toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-md p-2" style={{ background: 'hsl(var(--muted))' }}>
                  <div className="text-muted-foreground">מבחן</div>
                  <div className={`font-mono font-bold ${(status.bestTestReturn || 0) >= 0 ? 'text-primary' : 'text-trading-loss'}`}>
                    {(status.bestTestReturn || 0) >= 0 ? '+' : ''}{(status.bestTestReturn || 0).toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          {status.isRunning ? (
            <Button variant="destructive" size="sm" onClick={onCancel}>ביטול</Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={onClose}>סגור</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
