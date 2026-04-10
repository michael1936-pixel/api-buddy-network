import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Generic hook to query any table with raw query builder
function useTableQuery<T = any>(
  key: string[],
  queryFn: () => Promise<T[]>,
  refetchInterval?: number
) {
  return useQuery({
    queryKey: key,
    queryFn,
    refetchInterval,
  });
}

// ═══ Specific hooks ═══

export function usePositions(status?: string) {
  return useTableQuery(
    ["positions", status || "all"],
    async () => {
      let q = supabase.from("positions").select("*").order("entry_time", { ascending: false }).limit(200);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    30000
  );
}

export function useSignals(limit = 50) {
  return useTableQuery(
    ["signals", String(limit)],
    async () => {
      const { data, error } = await supabase.from("signals").select("*").order("timestamp", { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },
    15000
  );
}

export function useOptimizationResults() {
  return useTableQuery(
    ["optimization_results"],
    async () => {
      const { data, error } = await supabase.from("optimization_results").select("*").eq("is_active", true).order("test_return", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    60000
  );
}

export function useAgentLogs(limit = 100) {
  return useTableQuery(
    ["agent_logs", String(limit)],
    async () => {
      const { data, error } = await supabase.from("agent_logs").select("*").order("timestamp", { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },
    30000
  );
}

export function useAgentMemory() {
  return useTableQuery(
    ["agent_memory"],
    async () => {
      const { data, error } = await supabase.from("agent_memory").select("*");
      if (error) throw error;
      return data || [];
    },
    60000
  );
}

export function useNewsEventsLive(limit = 50) {
  return useQuery({
    queryKey: ["news_events_live", String(limit)],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("fetch-news");
        if (error) throw error;
        return (data?.news || []).slice(0, limit);
      } catch (e) {
        console.warn("News edge function failed, falling back to DB:", e);
        const { data, error } = await supabase.from("news_events").select("*").order("timestamp", { ascending: false }).limit(limit);
        if (error) throw error;
        return data || [];
      }
    },
    refetchInterval: 60000,
  });
}

export function useNewsAnalysis(limit = 100) {
  return useQuery({
    queryKey: ["news_analysis", String(limit)],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("analyze-news");
        if (error) throw error;
        return {
          news: (data?.news || []).slice(0, limit),
          analyzedNow: data?.analyzed_now || 0,
          agentStats: data?.agent_stats || null,
        };
      } catch (e) {
        console.warn("analyze-news failed, falling back to DB:", e);
        const { data, error } = await supabase.from("news_events").select("*").order("timestamp", { ascending: false }).limit(limit);
        if (error) throw error;
        return { news: data || [], analyzedNow: 0, agentStats: null };
      }
    },
    refetchInterval: 60000,
  });
}

export function useNewsEvents(limit = 50) {
  return useTableQuery(
    ["news_events", String(limit)],
    async () => {
      const { data, error } = await supabase.from("news_events").select("*").order("timestamp", { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },
    30000
  );
}

export function useAIInsights(limit = 30) {
  return useTableQuery(
    ["ai_insights", String(limit)],
    async () => {
      const { data, error } = await supabase.from("ai_insights").select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },
    60000
  );
}

export function useTrackedSymbols() {
  return useTableQuery(
    ["tracked_symbols"],
    async () => {
      const { data, error } = await supabase.from("tracked_symbols").select("*").eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    60000
  );
}

export function useAgentFeedback(limit = 50) {
  return useTableQuery(
    ["agent_feedback", String(limit)],
    async () => {
      const { data, error } = await supabase.from("agent_feedback").select("*").order("close_time", { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },
    30000
  );
}

export function useTradeSummaries() {
  return useTableQuery(
    ["trade_summaries"],
    async () => {
      const { data, error } = await supabase.from("trade_summaries").select("*").order("period", { ascending: false }).limit(12);
      if (error) throw error;
      return data || [];
    },
    300000
  );
}

export function useKnowledgeLearning(limit = 200) {
  return useTableQuery(
    ["knowledge_learning", String(limit)],
    async () => {
      const { data, error } = await supabase.from("knowledge_learning").select("*").order("timestamp", { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },
    60000
  );
}

export function useLearningSnapshots() {
  return useTableQuery(
    ["learning_snapshots"],
    async () => {
      const { data, error } = await supabase.from("learning_snapshots").select("*").order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data || [];
    },
    120000
  );
}

export function useWeeklyReviews() {
  return useTableQuery(
    ["weekly_reviews"],
    async () => {
      const { data, error } = await supabase.from("ai_insights").select("*").eq("type", "weekly_review").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data || [];
    },
    300000
  );
}

export function useMarketDataLive() {
  return useQuery({
    queryKey: ["market_data_live"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("fetch-market-data");
        if (error) throw error;
        return data as Record<string, any>;
      } catch (e) {
        console.warn("Edge function failed, falling back to DB:", e);
        const { data, error } = await supabase
          .from("market_data")
          .select("*")
          .in("symbol", ["SPY", "VIX"])
          .order("timestamp", { ascending: false })
          .limit(4);
        if (error) throw error;
        const result: Record<string, any> = {};
        for (const row of data || []) {
          if (!result[row.symbol]) result[row.symbol] = row;
        }
        return result;
      }
    },
    refetchInterval: 30000,
  });
}

export function useMarketData(symbol: string) {
  return useQuery({
    queryKey: ["market_data", symbol],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_data")
        .select("*")
        .eq("symbol", symbol)
        .order("timestamp", { ascending: false })
        .limit(2);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });
}

export function useTimeframeProfiles() {
  return useTableQuery(
    ["timeframe_profiles"],
    async () => {
      const { data, error } = await supabase.from("timeframe_profiles").select("*");
      if (error) throw error;
      return data || [];
    },
    120000
  );
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ["system_health"],
    queryFn: async () => {
      const tables = [
        { name: "signals", timeCol: "timestamp" },
        { name: "positions", timeCol: "entry_time" },
        { name: "agent_logs", timeCol: "timestamp" },
        { name: "agent_memory", timeCol: "updated_at" },
        { name: "news_events", timeCol: "timestamp" },
        { name: "market_data", timeCol: "timestamp" },
        { name: "optimization_results", timeCol: "optimized_at" },
        { name: "ai_insights", timeCol: "created_at" },
        { name: "tracked_symbols", timeCol: "created_at" },
        { name: "agent_feedback", timeCol: "close_time" },
        { name: "trade_summaries", timeCol: "created_at" },
      ] as const;

      const results = await Promise.all(
        tables.map(async (t) => {
          const { count } = await supabase.from(t.name).select("*", { count: "exact", head: true });
          const { data } = await supabase.from(t.name).select(t.timeCol).order(t.timeCol, { ascending: false }).limit(1);
          const lastUpdate = data?.[0]?.[t.timeCol] || null;
          return { table: t.name, count: count || 0, lastUpdate };
        })
      );
      return results;
    },
    refetchInterval: 30000,
  });
}
