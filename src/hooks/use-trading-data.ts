import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Generic hook to query any table
function useSupabaseQuery<T>(
  key: string[],
  tableName: string,
  options?: {
    select?: string;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
    filters?: Array<{ column: string; op: string; value: any }>;
    eq?: Record<string, any>;
  },
  refetchInterval?: number
) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      let query = supabase.from(tableName).select(options?.select || "*");

      if (options?.eq) {
        for (const [col, val] of Object.entries(options.eq)) {
          query = query.eq(col, val);
        }
      }

      if (options?.filters) {
        for (const f of options.filters) {
          if (f.op === "gte") query = query.gte(f.column, f.value);
          else if (f.op === "lte") query = query.lte(f.column, f.value);
          else if (f.op === "neq") query = query.neq(f.column, f.value);
          else if (f.op === "in") query = query.in(f.column, f.value);
        }
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? false,
        });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as T[];
    },
    refetchInterval,
  });
}

// ═══ Specific hooks ═══

export function usePositions(status?: string) {
  return useSupabaseQuery(
    ["positions", status || "all"],
    "positions",
    {
      ...(status ? { eq: { status } } : {}),
      orderBy: { column: "entry_time", ascending: false },
      limit: 200,
    },
    30000
  );
}

export function useSignals(limit = 50) {
  return useSupabaseQuery(
    ["signals", String(limit)],
    "signals",
    {
      orderBy: { column: "timestamp", ascending: false },
      limit,
    },
    15000
  );
}

export function useOptimizationResults() {
  return useSupabaseQuery(
    ["optimization_results"],
    "optimization_results",
    {
      eq: { is_active: true },
      orderBy: { column: "test_return", ascending: false },
    },
    60000
  );
}

export function useAgentLogs(limit = 100) {
  return useSupabaseQuery(
    ["agent_logs", String(limit)],
    "agent_logs",
    {
      orderBy: { column: "timestamp", ascending: false },
      limit,
    },
    30000
  );
}

export function useAgentMemory() {
  return useSupabaseQuery(["agent_memory"], "agent_memory", {}, 60000);
}

export function useNewsEvents(limit = 50) {
  return useSupabaseQuery(
    ["news_events", String(limit)],
    "news_events",
    {
      orderBy: { column: "timestamp", ascending: false },
      limit,
    },
    30000
  );
}

export function useAIInsights(limit = 30) {
  return useSupabaseQuery(
    ["ai_insights", String(limit)],
    "ai_insights",
    {
      orderBy: { column: "created_at", ascending: false },
      limit,
    },
    60000
  );
}

export function useTrackedSymbols() {
  return useSupabaseQuery(
    ["tracked_symbols"],
    "tracked_symbols",
    { eq: { is_active: true } },
    60000
  );
}

export function useAgentFeedback(limit = 50) {
  return useSupabaseQuery(
    ["agent_feedback", String(limit)],
    "agent_feedback",
    {
      orderBy: { column: "close_time", ascending: false },
      limit,
    },
    30000
  );
}

export function useTradeSummaries() {
  return useSupabaseQuery(
    ["trade_summaries"],
    "trade_summaries",
    {
      orderBy: { column: "period", ascending: false },
      limit: 12,
    },
    300000
  );
}

export function useTimeframeProfiles() {
  return useSupabaseQuery(
    ["timeframe_profiles"],
    "timeframe_profiles",
    {},
    120000
  );
}

export function useSP500Symbols() {
  return useSupabaseQuery(
    ["sp500_symbols"],
    "sp500_symbols",
    { eq: { is_active: true } },
    300000
  );
}
