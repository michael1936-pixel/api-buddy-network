export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_feedback: {
        Row: {
          agent_snapshots: Json
          close_time: string
          created_at: string
          direction: string
          entry_price: number
          entry_time: string
          exit_price: number
          exit_reason: string | null
          final_verdict: string
          id: number
          is_win: boolean
          news_risk: string | null
          pnl_pct: number
          strategy: string
          symbol: string
          vix_at_entry: number | null
          vix_regime: string | null
        }
        Insert: {
          agent_snapshots?: Json
          close_time?: string
          created_at?: string
          direction: string
          entry_price: number
          entry_time: string
          exit_price: number
          exit_reason?: string | null
          final_verdict: string
          id?: number
          is_win: boolean
          news_risk?: string | null
          pnl_pct: number
          strategy: string
          symbol: string
          vix_at_entry?: number | null
          vix_regime?: string | null
        }
        Update: {
          agent_snapshots?: Json
          close_time?: string
          created_at?: string
          direction?: string
          entry_price?: number
          entry_time?: string
          exit_price?: number
          exit_reason?: string | null
          final_verdict?: string
          id?: number
          is_win?: boolean
          news_risk?: string | null
          pnl_pct?: number
          strategy?: string
          symbol?: string
          vix_at_entry?: number | null
          vix_regime?: string | null
        }
        Relationships: []
      }
      agent_logs: {
        Row: {
          agent_weights: Json | null
          claude_decision: string | null
          direction: string
          id: number
          is_win: boolean | null
          murphy_score: number | null
          pnl_pct: number | null
          rules_failed: string[] | null
          rules_passed: string[] | null
          strategy: string
          symbol: string
          timestamp: string | null
        }
        Insert: {
          agent_weights?: Json | null
          claude_decision?: string | null
          direction: string
          id?: number
          is_win?: boolean | null
          murphy_score?: number | null
          pnl_pct?: number | null
          rules_failed?: string[] | null
          rules_passed?: string[] | null
          strategy: string
          symbol: string
          timestamp?: string | null
        }
        Update: {
          agent_weights?: Json | null
          claude_decision?: string | null
          direction?: string
          id?: number
          is_win?: boolean | null
          murphy_score?: number | null
          pnl_pct?: number | null
          rules_failed?: string[] | null
          rules_passed?: string[] | null
          strategy?: string
          symbol?: string
          timestamp?: string | null
        }
        Relationships: []
      }
      agent_memory: {
        Row: {
          agent_id: string
          state: Json
          updated_at: string | null
          version: number | null
        }
        Insert: {
          agent_id: string
          state: Json
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          agent_id?: string
          state?: Json
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          agent_lessons: Json | null
          created_at: string
          id: number
          insight_id: string
          market_insight: string | null
          pattern: Json | null
          reasoning: string | null
          summary: string
          type: string
        }
        Insert: {
          agent_lessons?: Json | null
          created_at?: string
          id?: number
          insight_id: string
          market_insight?: string | null
          pattern?: Json | null
          reasoning?: string | null
          summary: string
          type: string
        }
        Update: {
          agent_lessons?: Json | null
          created_at?: string
          id?: number
          insight_id?: string
          market_insight?: string | null
          pattern?: Json | null
          reasoning?: string | null
          summary?: string
          type?: string
        }
        Relationships: []
      }
      data_download_jobs: {
        Row: {
          bars_downloaded: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: number
          started_at: string | null
          status: string
          symbol: string
        }
        Insert: {
          bars_downloaded?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: number
          started_at?: string | null
          status?: string
          symbol: string
        }
        Update: {
          bars_downloaded?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: number
          started_at?: string | null
          status?: string
          symbol?: string
        }
        Relationships: []
      }
      knowledge_learning: {
        Row: {
          direction: string
          exit_reason: string | null
          id: number
          is_win: boolean | null
          pnl_pct: number | null
          principles_applied: string[] | null
          principles_violated: string[] | null
          strategy: string
          symbol: string
          timestamp: string | null
        }
        Insert: {
          direction: string
          exit_reason?: string | null
          id?: number
          is_win?: boolean | null
          pnl_pct?: number | null
          principles_applied?: string[] | null
          principles_violated?: string[] | null
          strategy: string
          symbol: string
          timestamp?: string | null
        }
        Update: {
          direction?: string
          exit_reason?: string | null
          id?: number
          is_win?: boolean | null
          pnl_pct?: number | null
          principles_applied?: string[] | null
          principles_violated?: string[] | null
          strategy?: string
          symbol?: string
          timestamp?: string | null
        }
        Relationships: []
      }
      learning_snapshots: {
        Row: {
          created_at: string | null
          id: number
          snapshot: Json
        }
        Insert: {
          created_at?: string | null
          id?: number
          snapshot: Json
        }
        Update: {
          created_at?: string | null
          id?: number
          snapshot?: Json
        }
        Relationships: []
      }
      market_data: {
        Row: {
          close: number
          created_at: string | null
          high: number
          id: number
          interval: string
          low: number
          open: number
          symbol: string
          timestamp: string
          volume: number
        }
        Insert: {
          close: number
          created_at?: string | null
          high: number
          id?: number
          interval?: string
          low: number
          open: number
          symbol: string
          timestamp: string
          volume?: number
        }
        Update: {
          close?: number
          created_at?: string | null
          high?: number
          id?: number
          interval?: string
          low?: number
          open?: number
          symbol?: string
          timestamp?: string
          volume?: number
        }
        Relationships: []
      }
      news_events: {
        Row: {
          actual_spy_1d: number | null
          actual_spy_1h: number | null
          actual_vix_change: number | null
          affected_sectors: string[] | null
          affected_symbols: string[] | null
          ai_analysis: string | null
          ai_sentiment_score: number | null
          analyzed_at: string | null
          category: string
          confidence: number | null
          created_at: string | null
          event_id: string
          headline: string
          id: number
          impact_level: string
          predicted_spy_impact: string | null
          predicted_vix_impact: string | null
          reaction_recorded: boolean | null
          sentiment: string | null
          source: string | null
          subcategory: string | null
          summary: string | null
          symbol_reactions: Json | null
          timestamp: string
        }
        Insert: {
          actual_spy_1d?: number | null
          actual_spy_1h?: number | null
          actual_vix_change?: number | null
          affected_sectors?: string[] | null
          affected_symbols?: string[] | null
          ai_analysis?: string | null
          ai_sentiment_score?: number | null
          analyzed_at?: string | null
          category: string
          confidence?: number | null
          created_at?: string | null
          event_id: string
          headline: string
          id?: number
          impact_level: string
          predicted_spy_impact?: string | null
          predicted_vix_impact?: string | null
          reaction_recorded?: boolean | null
          sentiment?: string | null
          source?: string | null
          subcategory?: string | null
          summary?: string | null
          symbol_reactions?: Json | null
          timestamp: string
        }
        Update: {
          actual_spy_1d?: number | null
          actual_spy_1h?: number | null
          actual_vix_change?: number | null
          affected_sectors?: string[] | null
          affected_symbols?: string[] | null
          ai_analysis?: string | null
          ai_sentiment_score?: number | null
          analyzed_at?: string | null
          category?: string
          confidence?: number | null
          created_at?: string | null
          event_id?: string
          headline?: string
          id?: number
          impact_level?: string
          predicted_spy_impact?: string | null
          predicted_vix_impact?: string | null
          reaction_recorded?: boolean | null
          sentiment?: string | null
          source?: string | null
          subcategory?: string | null
          summary?: string | null
          symbol_reactions?: Json | null
          timestamp?: string
        }
        Relationships: []
      }
      optimization_results: {
        Row: {
          agent_confidence: number | null
          agent_decision: string | null
          created_at: string | null
          id: number
          is_active: boolean | null
          max_drawdown: number | null
          optimized_at: string | null
          overfit_risk: string | null
          parameters: Json
          sharpe_ratio: number | null
          symbol: string
          test_return: number | null
          total_trades: number | null
          train_return: number | null
          win_rate: number | null
        }
        Insert: {
          agent_confidence?: number | null
          agent_decision?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          max_drawdown?: number | null
          optimized_at?: string | null
          overfit_risk?: string | null
          parameters: Json
          sharpe_ratio?: number | null
          symbol: string
          test_return?: number | null
          total_trades?: number | null
          train_return?: number | null
          win_rate?: number | null
        }
        Update: {
          agent_confidence?: number | null
          agent_decision?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          max_drawdown?: number | null
          optimized_at?: string | null
          overfit_risk?: string | null
          parameters?: Json
          sharpe_ratio?: number | null
          symbol?: string
          test_return?: number | null
          total_trades?: number | null
          train_return?: number | null
          win_rate?: number | null
        }
        Relationships: []
      }
      optimization_runs: {
        Row: {
          best_test: number | null
          best_train: number | null
          created_at: string
          current_combo: number
          current_stage: number
          error_message: string | null
          id: number
          status: string
          symbol: string
          total_combos: number
          total_stages: number
          updated_at: string
        }
        Insert: {
          best_test?: number | null
          best_train?: number | null
          created_at?: string
          current_combo?: number
          current_stage?: number
          error_message?: string | null
          id?: never
          status?: string
          symbol: string
          total_combos?: number
          total_stages?: number
          updated_at?: string
        }
        Update: {
          best_test?: number | null
          best_train?: number | null
          created_at?: string
          current_combo?: number
          current_stage?: number
          error_message?: string | null
          id?: never
          status?: string
          symbol?: string
          total_combos?: number
          total_stages?: number
          updated_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          be_triggered: boolean | null
          created_at: string | null
          direction: string
          entry_price: number
          entry_time: string | null
          exit_price: number | null
          exit_time: string | null
          id: number
          pnl_pct: number | null
          status: string
          stop_price: number | null
          strategy: string
          symbol: string
          tp_price: number | null
          trail_price: number | null
        }
        Insert: {
          be_triggered?: boolean | null
          created_at?: string | null
          direction: string
          entry_price: number
          entry_time?: string | null
          exit_price?: number | null
          exit_time?: string | null
          id?: number
          pnl_pct?: number | null
          status?: string
          stop_price?: number | null
          strategy: string
          symbol: string
          tp_price?: number | null
          trail_price?: number | null
        }
        Update: {
          be_triggered?: boolean | null
          created_at?: string | null
          direction?: string
          entry_price?: number
          entry_time?: string | null
          exit_price?: number | null
          exit_time?: string | null
          id?: number
          pnl_pct?: number | null
          status?: string
          stop_price?: number | null
          strategy?: string
          symbol?: string
          tp_price?: number | null
          trail_price?: number | null
        }
        Relationships: []
      }
      signals: {
        Row: {
          action: string
          atr: number | null
          created_at: string | null
          direction: string
          id: number
          price: number
          reason: string | null
          rsi: number | null
          strategy: string
          symbol: string
          timestamp: string | null
          webhook_sent: boolean | null
        }
        Insert: {
          action: string
          atr?: number | null
          created_at?: string | null
          direction: string
          id?: number
          price: number
          reason?: string | null
          rsi?: number | null
          strategy: string
          symbol: string
          timestamp?: string | null
          webhook_sent?: boolean | null
        }
        Update: {
          action?: string
          atr?: number | null
          created_at?: string | null
          direction?: string
          id?: number
          price?: number
          reason?: string | null
          rsi?: number | null
          strategy?: string
          symbol?: string
          timestamp?: string | null
          webhook_sent?: boolean | null
        }
        Relationships: []
      }
      sp500_symbols: {
        Row: {
          added_at: string | null
          is_active: boolean | null
          removed_at: string | null
          sector: string | null
          symbol: string
        }
        Insert: {
          added_at?: string | null
          is_active?: boolean | null
          removed_at?: string | null
          sector?: string | null
          symbol: string
        }
        Update: {
          added_at?: string | null
          is_active?: boolean | null
          removed_at?: string | null
          sector?: string | null
          symbol?: string
        }
        Relationships: []
      }
      timeframe_profiles: {
        Row: {
          all_results: Json | null
          best_timeframe: string
          reason: string | null
          selected_at: string | null
          symbol: string
          volatility_profile: string | null
        }
        Insert: {
          all_results?: Json | null
          best_timeframe: string
          reason?: string | null
          selected_at?: string | null
          symbol: string
          volatility_profile?: string | null
        }
        Update: {
          all_results?: Json | null
          best_timeframe?: string
          reason?: string | null
          selected_at?: string | null
          symbol?: string
          volatility_profile?: string | null
        }
        Relationships: []
      }
      tracked_symbols: {
        Row: {
          created_at: string | null
          is_active: boolean | null
          last_download: string | null
          symbol: string
          total_bars: number | null
        }
        Insert: {
          created_at?: string | null
          is_active?: boolean | null
          last_download?: string | null
          symbol: string
          total_bars?: number | null
        }
        Update: {
          created_at?: string | null
          is_active?: boolean | null
          last_download?: string | null
          symbol?: string
          total_bars?: number | null
        }
        Relationships: []
      }
      trade_summaries: {
        Row: {
          created_at: string | null
          period: string
          summary: Json
          trade_count: number | null
        }
        Insert: {
          created_at?: string | null
          period: string
          summary: Json
          trade_count?: number | null
        }
        Update: {
          created_at?: string | null
          period?: string
          summary?: Json
          trade_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
