// @refresh reset
import { createContext, useContext, ReactNode } from "react";
import { useMarketDataWebSocket } from "@/hooks/useMarketDataWebSocket";

interface TickData {
  symbol: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  prev_close: number;
  timestamp: string;
  source: "ws" | "rest";
}

type MarketDataMap = Record<string, TickData>;

interface MarketDataContextValue {
  data: MarketDataMap;
  wsStatus: "connecting" | "connected" | "disconnected" | "error";
  isRealtime: boolean;
}

const MarketDataContext = createContext<MarketDataContextValue | null>(null);

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const value = useMarketDataWebSocket();
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
