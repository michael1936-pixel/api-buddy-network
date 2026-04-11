/**
 * Train/Test Split Agent (Client-side)
 * Loads recommendation from agent_memory, applies to optimization.
 * Default: 30% Train / 70% Test
 */

import { supabase } from "@/integrations/supabase/client";

export interface SplitRecommendation {
  trainPercent: number;
  confidence: number;
  reasoning: string;
  samplesAnalyzed: number;
  byTimeframe: Record<string, number>;
  lastUpdated: string;
}

export class TrainTestSplitAgent {
  private recommendation: SplitRecommendation = {
    trainPercent: 30,
    confidence: 10,
    reasoning: 'Default 30/70 — train on small period, validate on large unseen period',
    samplesAnalyzed: 0,
    byTimeframe: {},
    lastUpdated: new Date().toISOString(),
  };

  getRecommendedSplit(timeframe?: string): number {
    if (timeframe && this.recommendation.byTimeframe[timeframe]) {
      return this.recommendation.byTimeframe[timeframe];
    }
    return this.recommendation.trainPercent;
  }

  getRecommendation(): SplitRecommendation {
    return { ...this.recommendation };
  }

  async load(): Promise<void> {
    try {
      const { data } = await supabase
        .from('agent_memory')
        .select('state')
        .eq('agent_id', 'train_test_split')
        .maybeSingle();

      if (data?.state && typeof data.state === 'object') {
        const state = data.state as Record<string, unknown>;
        this.recommendation = {
          ...this.recommendation,
          trainPercent: (state.trainPercent as number) || this.recommendation.trainPercent,
          confidence: (state.confidence as number) || this.recommendation.confidence,
          reasoning: (state.reasoning as string) || this.recommendation.reasoning,
          samplesAnalyzed: (state.samplesAnalyzed as number) || 0,
          byTimeframe: (state.byTimeframe as Record<string, number>) || {},
          lastUpdated: (state.lastUpdated as string) || this.recommendation.lastUpdated,
        };
        console.log(`[SplitAgent] Loaded: ${this.recommendation.trainPercent}/${100 - this.recommendation.trainPercent}, confidence ${this.recommendation.confidence}%`);
      } else {
        console.log('[SplitAgent] No saved state, using defaults (30/70)');
      }
    } catch (e) {
      console.warn('[SplitAgent] Load failed, using defaults:', e);
    }
  }
}
