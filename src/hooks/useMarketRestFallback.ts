/**
 * REST fallback: polls fetch-market-data edge function for snapshot data.
 * Only used as baseline / fallback when WS is not connected.
 * Updates the Zustand store directly.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMarketDataStore } from "@/stores/marketDataStore";

const POLL_INTERVAL_MS = 15_000;

export function useMarketRestFallback() {
  const setRestSnapshot = useMarketDataStore((s) => s.setRestSnapshot);
  const isRealtime = useMarketDataStore((s) => s.isRealtime);

  const { data } = useQuery({
    queryKey: ["market_data_snapshot"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("fetch-market-data");
        if (error) throw error;
        return data as Record<string, any>;
      } catch (e) {
        console.warn("REST snapshot failed:", e);
        return null;
      }
    },
    // Poll slower when WS is connected (just for prev_close updates)
    refetchInterval: isRealtime ? 60_000 : POLL_INTERVAL_MS,
  });

  useEffect(() => {
    if (data) {
      setRestSnapshot(data);
    }
  }, [data, setRestSnapshot]);
}
