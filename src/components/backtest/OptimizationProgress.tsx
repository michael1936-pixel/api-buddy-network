import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Brain, Clock, CheckCircle2, Circle, Loader2, SkipForward, Square,
  TrendingUp, TrendingDown, Zap, ChevronDown, ChevronUp, Target, 
  Flame, BarChart3, Play
} from 'lucide-react';
import type { StageStatus, StageResult, SmartOptimizationProgress as ProgressInfo } from '@/lib/optimizer/smartOptimizer';

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

interface SmartOptimizationProgressProps {
  stages: StageStatus[];
  currentStage: number;
  totalStages: number;
  progress: ProgressInfo | null;
  stageResults: StageResult[];
  onSkipStage: () => void;
  onStop: () => void;
  elapsedTime: number;
  isRunning: boolean;
  enabledStages: boolean[];
  onStageToggle: (stageIndex: number, enabled: boolean) => void;
  stageProgress?: { [stageNumber: number]: { current: number; total: number } };
  preRunMode?: boolean;
  onRoundToggle?: (round: number, enabled: boolean) => void;
  overallCombinations?: { current: number; total: number };
  combinationsPerSecond?: number;
  symbol?: string;
  bestTrainReturn?: number | null;
  bestTestReturn?: number | null;
  stageEstimates?: Record<number, number>;
  serverStatus?: 'active' | 'slow' | 'stalled' | 'idle';
  secondsSinceLastUpdate?: number;
  lastServerUpdateAt?: string | null;
}

const STAGES_PER_ROUND = 7;

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatNumber = (num: number): string => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return num.toLocaleString();
  return num.toString();
};

interface RoundInfo {
  round: 1 | 2 | 3;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  progressColor: string;
}

const getRoundInfo = (roundNumber: 1 | 2 | 3): RoundInfo => {
  switch (roundNumber) {
    case 1:
      return { round: 1, label: 'אסטרטגיות בודדות', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', progressColor: 'bg-blue-500' };
    case 2:
      return { round: 2, label: 'דיוק ראשוני', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30', progressColor: 'bg-amber-500' };
    case 3:
      return { round: 3, label: 'מיקרו דיוק', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30', progressColor: 'bg-emerald-500' };
  }
};

const getRoundLabel = (stageNumber: number): { round: 1 | 2 | 3; badgeColor: string } => {
  if (stageNumber <= STAGES_PER_ROUND) return { round: 1, badgeColor: 'bg-blue-500' };
  if (stageNumber <= STAGES_PER_ROUND * 2) return { round: 2, badgeColor: 'bg-amber-500' };
  return { round: 3, badgeColor: 'bg-emerald-500' };
};

const StageRow: React.FC<{
  stage: StageStatus;
  result?: StageResult;
  isCurrent: boolean;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  stageProgress?: { current: number; total: number };
  displayNumber: number;
  combinationsEstimate?: number;
}> = ({ stage, result, isCurrent, enabled, onToggle, stageProgress, displayNumber, combinationsEstimate }) => {
  const canToggle = stage.status === 'pending';

  const StatusIcon = () => {
    if (!enabled && stage.status === 'pending') return <SkipForward className="w-4 h-4 text-muted-foreground/50" />;
    switch (stage.status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'running': return <Play className="w-4 h-4 text-primary animate-pulse" />;
      case 'skipped': return <SkipForward className="w-4 h-4 text-muted-foreground" />;
      default: return <Circle className="w-4 h-4 text-muted-foreground/30" />;
    }
  };

  return (
    <div className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-all text-sm
      ${isCurrent ? 'bg-primary/20 border border-primary/40' : 'hover:bg-white/5'}
      ${stage.status === 'completed' ? 'opacity-70' : ''}
      ${!enabled && stage.status === 'pending' ? 'opacity-40' : ''}
    `}>
      <Checkbox
        checked={enabled}
        onCheckedChange={(checked) => onToggle(checked === true)}
        disabled={!canToggle}
        className="flex-shrink-0 h-4 w-4"
      />
      <StatusIcon />
      <span className={`flex-1 text-right ${!enabled ? 'line-through text-muted-foreground' : isCurrent ? 'text-primary font-medium' : 'text-foreground'}`}>
        שלב {displayNumber} - {stage.stageName}
      </span>
      {stageProgress ? (
        <span className="text-xs text-muted-foreground font-mono">
          {formatNumber(stageProgress.current)} / {formatNumber(stageProgress.total)}
        </span>
      ) : combinationsEstimate ? (
        <span className="text-xs text-muted-foreground font-mono">
          {formatNumber(combinationsEstimate)} קומבינציות
        </span>
      ) : null}
      {result && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-400 font-medium">
            {result.bestReturn > 0 ? '+' : ''}{result.bestReturn.toFixed(1)}%
          </span>
          <span className="text-blue-400 font-medium">
            {result.bestTestReturn > 0 ? '+' : ''}{result.bestTestReturn.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
};

interface RoundSectionProps {
  roundNumber: 1 | 2 | 3;
  stages: StageStatus[];
  stageResults: StageResult[];
  enabledStages: boolean[];
  onStageToggle: (stageIndex: number, enabled: boolean) => void;
  currentStage: number;
  stageProgressMap?: { [stageNumber: number]: { current: number; total: number } };
  startIndex: number;
  stageEstimates?: Record<number, number>;
}

const RoundSection: React.FC<RoundSectionProps> = ({
  roundNumber, stages, stageResults, enabledStages, onStageToggle, currentStage, stageProgressMap, startIndex, stageEstimates
}) => {
  const roundInfo = getRoundInfo(roundNumber);
  const [isExpanded, setIsExpanded] = React.useState(roundNumber === 1);
  const roundStages = stages.slice(startIndex, startIndex + STAGES_PER_ROUND);
  const roundEnabledStages = enabledStages.slice(startIndex, startIndex + STAGES_PER_ROUND);
  const allEnabled = roundEnabledStages.every(Boolean);
  const enabledCount = roundEnabledStages.filter(Boolean).length;
  const hasRunningStage = roundStages.some(s => s.status === 'running');
  const hasCompletedStage = roundStages.some(s => s.status === 'completed');

  const handleRoundToggle = () => {
    const newValue = !allEnabled;
    for (let i = 0; i < STAGES_PER_ROUND; i++) {
      if (roundStages[i]?.status === 'pending') {
        onStageToggle(startIndex + i, newValue);
      }
    }
  };

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${roundInfo.borderColor} ${roundInfo.bgColor}`}>
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          <Badge variant="outline" className="text-xs">{enabledCount}/{STAGES_PER_ROUND} שלבים</Badge>
          {hasRunningStage && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
          {hasCompletedStage && !hasRunningStage && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        </div>
        <div className="flex items-center gap-3">
          <div className={`font-bold ${roundInfo.color}`}>
            <Target className="w-4 h-4 inline-block ml-2" />
            סיבוב {roundNumber} - {roundInfo.label}
          </div>
          <Checkbox
            checked={allEnabled}
            onCheckedChange={() => handleRoundToggle()}
            className="flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-1">
          {roundStages.map((stage, idx) => {
            const globalIndex = startIndex + idx;
            const result = stageResults.find(r => r.stageNumber === stage.stageNumber);
            const stageProgressData = stageProgressMap?.[stage.stageNumber];
            const isEnabled = enabledStages[globalIndex] ?? true;
            return (
              <StageRow
                key={stage.stageNumber}
                stage={stage}
                result={result}
                isCurrent={stage.stageNumber === currentStage}
                enabled={isEnabled}
                onToggle={(enabled) => onStageToggle(globalIndex, enabled)}
                stageProgress={stageProgressData}
                displayNumber={idx + 1}
                combinationsEstimate={stageEstimates?.[stage.stageNumber]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export const SmartOptimizationProgressCard: React.FC<SmartOptimizationProgressProps> = ({
  stages, currentStage, totalStages, progress, stageResults,
  onSkipStage, onStop, elapsedTime, isRunning, enabledStages, onStageToggle,
  stageProgress: stageProgressMap, preRunMode = false, overallCombinations, 
  combinationsPerSecond, symbol, bestTrainReturn, bestTestReturn, stageEstimates,
  serverStatus = 'idle', secondsSinceLastUpdate = 0, lastServerUpdateAt
}) => {
  const overallProgress = useMemo(() => {
    const enabledCount = enabledStages.filter(Boolean).length;
    if (enabledCount === 0) return 0;
    const completedStages = stages.filter((s, idx) => enabledStages[idx] && (s.status === 'completed' || s.status === 'skipped')).length;
    const currentStageProgress = progress ? (progress.current / Math.max(1, progress.total)) : 0;
    return ((completedStages + currentStageProgress) / enabledCount) * 100;
  }, [stages, enabledStages, progress]);

  const stageProgressPct = useMemo(() => {
    if (!progress) return 0;
    return (progress.current / Math.max(1, progress.total)) * 100;
  }, [progress]);

  const bestOverallResult = useMemo(() => {
    if (stageResults.length === 0) return null;
    return stageResults.reduce((best, current) => current.bestReturn > best.bestReturn ? current : best, stageResults[0]);
  }, [stageResults]);

  const currentStageResult = useMemo(() => {
    return stageResults.find(r => r.stageNumber === currentStage);
  }, [stageResults, currentStage]);

  const currentRoundInfo = useMemo(() => {
    const { round } = getRoundLabel(currentStage);
    return getRoundInfo(round);
  }, [currentStage]);

  const enabledStagesCount = useMemo(() => {
    if (enabledStages.length === 0) return stages.length;
    return enabledStages.filter(Boolean).length;
  }, [enabledStages, stages.length]);

  const currentStageName = useMemo(() => {
    const stage = stages.find((_, idx) => idx + 1 === currentStage);
    return stage?.stageName || '';
  }, [stages, currentStage]);

  const stageInRound = useMemo(() => {
    if (currentStage <= 7) return currentStage;
    if (currentStage <= 14) return currentStage - 7;
    return currentStage - 14;
  }, [currentStage]);

  const estimatedTimeRemaining = useMemo(() => {
    if (!progress || !combinationsPerSecond || combinationsPerSecond === 0) return null;
    return (progress.total - progress.current) / combinationsPerSecond;
  }, [progress, combinationsPerSecond]);

  const speed = useMemo(() => {
    if (combinationsPerSecond) return combinationsPerSecond;
    if (elapsedTime > 0 && progress) return progress.current / elapsedTime;
    return 0;
  }, [combinationsPerSecond, elapsedTime, progress]);

  return (
    <Card className="border-2 border-primary/40 bg-gradient-to-br from-slate-900/80 to-slate-800/80 overflow-hidden">
      {/* Stop Button */}
      {isRunning && !preRunMode && (
        <div className="p-4 border-b border-primary/20">
          <Button
            variant="destructive"
            size="lg"
            onClick={onStop}
            className="w-full h-12 text-lg font-bold gap-2 bg-red-600 hover:bg-red-700"
          >
            <Square className="w-5 h-5" />
            עצור אופטימיזציה
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-mono">{formatTime(elapsedTime)}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className={`font-bold text-lg ${currentRoundInfo.color}`}>
              {symbol ? `${symbol} — ` : ''}אופטימיזציה חכמה - סיבוב {currentRoundInfo.round} | שלב {stageInRound} מתוך 7
            </span>
            <Brain className="w-6 h-6 text-primary" />
          </div>
        </div>
        {!preRunMode && progress && (
          <p className="text-muted-foreground text-sm text-right mt-2">
            {currentStageName} - {progress.stageDescription}
          </p>
        )}
      </div>

      {/* Statistics Boxes */}
      {!preRunMode && (
        <div className="p-4 grid grid-cols-3 gap-3 border-b border-primary/20">
          <div className="bg-slate-800/70 rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-2 justify-end">
              <h4 className="font-semibold text-white text-sm">התקדמות כללית</h4>
              <BarChart3 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-right space-y-1">
              <p className="text-xl font-bold text-emerald-400 font-mono">
                {overallCombinations ? (
                  <>{formatNumber(overallCombinations.current)} / {formatNumber(overallCombinations.total)}</>
                ) : (
                  <>{stageResults.length} / {enabledStagesCount}</>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {overallProgress.toFixed(1)}% | {formatTime(elapsedTime)}
              </p>
            </div>
          </div>
          <div className="bg-slate-800/70 rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-2 justify-end">
              <h4 className="font-semibold text-white text-sm">שלב נוכחי</h4>
              <Flame className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-right space-y-1">
              <p className="text-xl font-bold text-purple-400 font-mono">
                {progress ? (
                  <>{formatNumber(progress.current)} / {formatNumber(progress.total)}</>
                ) : '0 / 0'}
              </p>
              <p className="text-xs text-muted-foreground">
                {stageProgressPct.toFixed(1)}%
                {estimatedTimeRemaining ? ` | ~${formatTime(estimatedTimeRemaining)}` : ''}
              </p>
            </div>
          </div>
          <div className="bg-slate-800/70 rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-2 mb-2 justify-end">
              <h4 className="font-semibold text-white text-sm">תוצאה טובה ביותר</h4>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-right space-y-1">
              <p className={cn("text-xl font-bold font-mono", (bestTrainReturn ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                Train: {bestTrainReturn != null ? `${bestTrainReturn > 0 ? '+' : ''}${bestTrainReturn.toFixed(1)}%` : '--'}
              </p>
              <p className={cn("text-sm font-bold font-mono", (bestTestReturn ?? 0) >= 0 ? "text-blue-400" : "text-red-400")}>
                Test: {bestTestReturn != null ? `${bestTestReturn > 0 ? '+' : ''}${bestTestReturn.toFixed(1)}%` : '--'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rounds */}
      <div className="p-4 space-y-3 max-h-[350px] overflow-y-auto">
        {stages.length >= STAGES_PER_ROUND && (
          <RoundSection roundNumber={1} stages={stages} stageResults={stageResults} enabledStages={enabledStages} onStageToggle={onStageToggle} currentStage={currentStage} stageProgressMap={stageProgressMap} startIndex={0} stageEstimates={stageEstimates} />
        )}
        {stages.length >= STAGES_PER_ROUND * 2 && (
          <RoundSection roundNumber={2} stages={stages} stageResults={stageResults} enabledStages={enabledStages} onStageToggle={onStageToggle} currentStage={currentStage} stageProgressMap={stageProgressMap} startIndex={STAGES_PER_ROUND} stageEstimates={stageEstimates} />
        )}
        {stages.length >= STAGES_PER_ROUND * 3 && (
          <RoundSection roundNumber={3} stages={stages} stageResults={stageResults} enabledStages={enabledStages} onStageToggle={onStageToggle} currentStage={currentStage} stageProgressMap={stageProgressMap} startIndex={STAGES_PER_ROUND * 2} stageEstimates={stageEstimates} />
        )}
      </div>

      {/* Progress Bars */}
      {!preRunMode && (
        <div className="p-4 space-y-4 border-t border-primary/20">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {overallCombinations ? formatNumber(overallCombinations.current) : stageResults.length} / {overallCombinations ? formatNumber(overallCombinations.total) : enabledStagesCount} קומבינציות ({overallProgress.toFixed(1)}%)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-emerald-400">התקדמות כללית</span>
                <BarChart3 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-700">
              <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {progress ? formatNumber(progress.current) : 0} / {progress ? formatNumber(progress.total) : 0} ({stageProgressPct.toFixed(1)}%)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-purple-400">שלב נוכחי</span>
                <Flame className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-700">
              <div className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-300" style={{ width: `${stageProgressPct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>מהירות: {speed > 0 ? `${speed.toFixed(0)} קומבינציות/שניה` : 'ממתין...'}</span>
              {estimatedTimeRemaining && speed > 0 && (
                <span>זמן משוער: {formatTime(estimatedTimeRemaining)}</span>
              )}
            </div>
            {isRunning && !preRunMode && serverStatus !== 'active' && serverStatus !== 'idle' && (
              <div className={cn(
                "mt-2 text-xs font-medium text-right px-3 py-2 rounded-lg border",
                serverStatus === 'stalled' 
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              )}>
                {serverStatus === 'stalled' 
                  ? `⚠️ אין עדכון מהשרת כבר ${formatTime(secondsSinceLastUpdate)} — בדוק אם השרת פעיל`
                  : `⏳ השרת מחשב... עדכון אחרון לפני ${formatTime(secondsSinceLastUpdate)}`
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* Best Results */}
      {!preRunMode && (bestOverallResult || currentStageResult) && (
        <div className="p-4 border-t border-primary/20">
          <div className="bg-slate-800/70 rounded-xl p-4 border border-white/10 space-y-4">
            {currentStageResult && (
              <div>
                <div className="flex items-center gap-2 mb-2 justify-end">
                  <h4 className="text-sm font-medium text-white">שלב נוכחי:</h4>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-emerald-400 font-bold">
                      Train: {currentStageResult.bestReturn > 0 ? '+' : ''}{currentStageResult.bestReturn.toFixed(2)}%
                    </span>
                    <span className="text-blue-400 font-bold">
                      Test: {currentStageResult.bestTestReturn > 0 ? '+' : ''}{currentStageResult.bestTestReturn.toFixed(2)}%
                    </span>
                  </div>
                  <span className="text-muted-foreground text-sm">התרכובת הטובה ביותר:</span>
                </div>
              </div>
            )}
            {currentStageResult && bestOverallResult && (
              <div className="border-t border-white/10" />
            )}
            {bestOverallResult && (
              <div>
                <div className="flex items-center gap-2 mb-2 justify-end">
                  <h4 className="text-sm font-medium text-white">הטוב ביותר כללי:</h4>
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-bold text-lg">
                      {bestOverallResult.bestReturn > 0 ? '+' : ''}{bestOverallResult.bestReturn.toFixed(2)}%
                    </span>
                    <span className="text-muted-foreground text-sm">התרכובת הטובה ביותר (Train):</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-400 font-bold text-lg">
                      {bestOverallResult.bestTestReturn > 0 ? '+' : ''}{bestOverallResult.bestTestReturn.toFixed(2)}%
                    </span>
                    <span className="text-muted-foreground text-sm">הבדיקה הטובה ביותר (Test):</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      {preRunMode && (
        <div className="p-4 border-t border-primary/20 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span>Train</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-blue-400" />
            <span>Test</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>הושלם</span>
          </div>
          <div className="flex items-center gap-1">
            <SkipForward className="w-3 h-3 text-muted-foreground" />
            <span>הושבת</span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default SmartOptimizationProgressCard;
