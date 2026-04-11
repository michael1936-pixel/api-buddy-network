/**
 * MarketDataProvider: thin wrapper that starts WS stream + REST fallback.
 * Components consume data directly from the Zustand store for performance.
 * This context exists only for backward compatibility of useMarketData() hook.
 */
import { createContext, useContext, ReactNode, useMemo } from "react";
import { useMarketStream } from "@/hooks/useMarketDataWebSocket";
import { useMarketRestFallback } from "@/hooks/useMarketRestFallback";
import { useMarketDataStore, MarketDataMap, StreamStatus } from "@/stores/marketDataStore";

interface MarketDataContextValue {
  data: MarketDataMap;
  wsStatus: StreamStatus;
  isRealtime: boolean;
}

const MarketDataContext = createContext<MarketDataContextValue | null>(null);

export function MarketDataProvider({ children }: { children: ReactNode }) {
  // Start WS stream & REST fallback
  useMarketStream();
  useMarketRestFallback();

  // Subscribe to store — this is the "slow path" for components that use useMarketData()
  // For high-frequency components, use useMarketDataStore directly with selectors.
  const ticks = useMarketDataStore((s) => s.ticks);
  const streamStatus = useMarketDataStore((s) => s.streamStatus);
  const isRealtime = useMarketDataStore((s) => s.isRealtime);

  const value = useMemo<MarketDataContextValue>(() => ({
    data: ticks,
    wsStatus: streamStatus,
    isRealtime,
  }), [ticks, streamStatus, isRealtime]);

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData(): MarketDataContextValue {
  const ctx = useContext(MarketDataContext);
  if (!ctx) throw new Error("useMarketData must be used within MarketDataProvider");
  return ctx;
}
