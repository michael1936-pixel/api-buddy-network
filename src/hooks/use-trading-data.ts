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
