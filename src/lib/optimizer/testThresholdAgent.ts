/**
 * Test Threshold Agent (Client-side)
 * Evaluates optimization results with scoring system (0-100).
 * Pass threshold: 70+ points.
 * Loads learned criteria from agent_memory.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ThresholdCriteria {
  minTestReturn: number;
  maxOverfitRatio: number;
  minWinRate: number;
  maxDrawdown: number;
  minSharpe: number;
  minTotalTrades: number;
  minProfitFactor: number;
  confidence: number;
  samplesAnalyzed: number;
  lastUpdated: string;
}

export interface EvaluationResult {
  passed: boolean;
  score: number;
  reasons: string[];
}

export class TestThresholdAgent {
  private criteria: ThresholdCriteria = {
    minTestReturn: 5,
    maxOverfitRatio: 0.5,
    minWinRate: 45,
    maxDrawdown: 25,
    minSharpe: 0.8,
    minTotalTrades: 20,
    minProfitFactor: 1.3,
    confidence: 10,
    samplesAnalyzed: 0,
    lastUpdated: new Date().toISOString(),
  };

  evaluate(result: {
    trainReturn: number;
    testReturn: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
    profitFactor?: number;
  }): EvaluationResult {
    const reasons: string[] = [];
    let score = 0;

    // Test Return: 30 pts
    if (result.testReturn >= this.criteria.minTestReturn) {
      score += 30;
    } else {
      reasons.push(`Test return ${result.testReturn.toFixed(1)}% < ${this.criteria.minTestReturn}%`);
    }

    // Overfit Ratio: 20 pts
    const overfitRatio = result.trainReturn > 0
      ? (result.trainReturn - result.testReturn) / result.trainReturn
      : 1;
    if (overfitRatio <= this.criteria.maxOverfitRatio) {
      score += 20;
    } else {
      reasons.push(`Overfit ratio ${(overfitRatio * 100).toFixed(0)}% > ${(this.criteria.maxOverfitRatio * 100).toFixed(0)}%`);
    }

    // Win Rate: 15 pts
    if (result.winRate >= this.criteria.minWinRate) {
      score += 15;
    } else {
      reasons.push(`Win rate ${result.winRate.toFixed(0)}% < ${this.criteria.minWinRate}%`);
    }

    // Max Drawdown: 15 pts
    if (result.maxDrawdown <= this.criteria.maxDrawdown) {
      score += 15;
    } else {
      reasons.push(`Drawdown ${result.maxDrawdown.toFixed(1)}% > ${this.criteria.maxDrawdown}%`);
    }

    // Trade Count: 10 pts
    if (result.totalTrades >= this.criteria.minTotalTrades) {
      score += 10;
    } else {
      reasons.push(`Only ${result.totalTrades} trades (need ${this.criteria.minTotalTrades}+)`);
    }

    // Profit Factor: 10 pts
    const pf = result.profitFactor ?? 0;
    if (pf >= this.criteria.minProfitFactor) {
      score += 10;
    } else {
      reasons.push(`Profit factor ${pf.toFixed(2)} < ${this.criteria.minProfitFactor}`);
    }

    const passed = score >= 70;
    return { passed, score, reasons };
  }

  getCriteria(): ThresholdCriteria {
    return { ...this.criteria };
  }

  async load(): Promise<void> {
    try {
      const { data } = await supabase
        .from('agent_memory')
        .select('state')
        .eq('agent_id', 'test_threshold')
        .maybeSingle();

      if (data?.state && typeof data.state === 'object') {
        const state = data.state as Record<string, unknown>;
        this.criteria = {
          minTestReturn: (state.minTestReturn as number) ?? this.criteria.minTestReturn,
          maxOverfitRatio: (state.maxOverfitRatio as number) ?? this.criteria.maxOverfitRatio,
          minWinRate: (state.minWinRate as number) ?? this.criteria.minWinRate,
          maxDrawdown: (state.maxDrawdown as number) ?? this.criteria.maxDrawdown,
          minSharpe: (state.minSharpe as number) ?? this.criteria.minSharpe,
          minTotalTrades: (state.minTotalTrades as number) ?? this.criteria.minTotalTrades,
          minProfitFactor: (state.minProfitFactor as number) ?? this.criteria.minProfitFactor,
          confidence: (state.confidence as number) ?? this.criteria.confidence,
          samplesAnalyzed: (state.samplesAnalyzed as number) ?? 0,
          lastUpdated: (state.lastUpdated as string) ?? this.criteria.lastUpdated,
        };
        console.log(`[ThresholdAgent] Loaded: minTest=${this.criteria.minTestReturn}%, confidence=${this.criteria.confidence}%`);
      } else {
        console.log('[ThresholdAgent] No saved state, using defaults');
      }
    } catch (e) {
      console.warn('[ThresholdAgent] Load failed, using defaults:', e);
    }
  }
}
