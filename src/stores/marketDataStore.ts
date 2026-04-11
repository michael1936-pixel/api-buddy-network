/**
 * High-performance market data store using Zustand.
 * Designed for broker-like tick-by-tick updates without triggering
 * full React tree re-renders on every tick.
 *
 * Architecture:
 *   External feed → Railway WS → this store → subscribers (per-symbol)
 */
import { create } from "zustand";

export interface TickData {
  symbol: string;
  last: number;         // latest trade price
  bid?: number;
  ask?: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  prev_close: number;
  exchange_ts: string;  // timestamp from exchange/provider
  received_at: string;  // when our client received it
  source: "ws" | "rest" | "db";
  provider?: string;    // "finnhub" | "twelvedata" | "railway" | "ibkr" etc.
  sequence?: number;
}

export type MarketDataMap = Record<string, TickData>;

export type StreamStatus = "connecting" | "connected" | "disconnected" | "error" | "stale";

interface MarketDataState {
  ticks: MarketDataMap;
  streamStatus: StreamStatus;
  isRealtime: boolean;
  subscribedSymbols: Set<string>;

  // Actions
  updateTick: (symbol: string, tick: Partial<TickData>) => void;
  updateTicks: (updates: Record<string, Partial<TickData>>) => void;
  setStreamStatus: (status: StreamStatus) => void;
  setIsRealtime: (v: boolean) => void;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
  setRestSnapshot: (data: Record<string, any>) => void;
}

/**
 * Merge incoming partial tick with existing data, keeping highs/lows/prev_close.
 */
function mergeTick(existing: TickData | undefined, incoming: Partial<TickData>, symbol: string): TickData {
  const now = new Date().toISOString();
  const price = incoming.last ?? incoming.bid ?? existing?.last ?? 0;

  if (!existing) {
    return {
      symbol,
      last: price,
      bid: incoming.bid,
      ask: incoming.ask,
      open: incoming.open ?? price,
      high: incoming.high ?? price,
      low: incoming.low ?? price,
      volume: incoming.volume ?? 0,
      prev_close: incoming.prev_close ?? price,
      exchange_ts: incoming.exchange_ts ?? now,
      received_at: now,
      source: incoming.source ?? "ws",
      provider: incoming.provider,
      sequence: incoming.sequence,
    };
  }

  return {
    ...existing,
    last: price,
    bid: incoming.bid ?? existing.bid,
    ask: incoming.ask ?? existing.ask,
    open: incoming.open ?? existing.open,
    high: Math.max(existing.high, incoming.high ?? price),
    low: existing.low > 0 ? Math.min(existing.low, incoming.low ?? price) : (incoming.low ?? price),
    volume: incoming.volume ?? existing.volume,
    prev_close: incoming.prev_close ?? existing.prev_close,
    exchange_ts: incoming.exchange_ts ?? existing.exchange_ts,
    received_at: now,
    source: incoming.source ?? existing.source,
    provider: incoming.provider ?? existing.provider,
    sequence: incoming.sequence ?? existing.sequence,
  };
}

export const useMarketDataStore = create<MarketDataState>((set, get) => ({
  ticks: {},
  streamStatus: "disconnected",
  isRealtime: false,
  subscribedSymbols: new Set(["SPY", "VIX"]),

  updateTick: (symbol, tick) => {
    set((state) => ({
      ticks: {
        ...state.ticks,
        [symbol]: mergeTick(state.ticks[symbol], tick, symbol),
      },
    }));
  },

  updateTicks: (updates) => {
    set((state) => {
      const newTicks = { ...state.ticks };
      for (const [sym, tick] of Object.entries(updates)) {
        newTicks[sym] = mergeTick(state.ticks[sym], tick, sym);
      }
      return { ticks: newTicks };
    });
  },

  setStreamStatus: (status) => set({ streamStatus: status }),
  setIsRealtime: (v) => set({ isRealtime: v }),

  subscribe: (symbols) => {
    set((state) => {
      const next = new Set(state.subscribedSymbols);
      symbols.forEach((s) => next.add(s));
      return { subscribedSymbols: next };
    });
  },

  unsubscribe: (symbols) => {
    set((state) => {
      const next = new Set(state.subscribedSymbols);
      symbols.forEach((s) => next.delete(s));
      return { subscribedSymbols: next };
    });
  },

  setRestSnapshot: (data) => {
    set((state) => {
      const newTicks = { ...state.ticks };
      for (const [sym, raw] of Object.entries(data)) {
        if (!raw || (raw as any).error) continue;
        const r = raw as any;
        // Only overwrite if we don't have a WS tick or if WS tick is stale
        const existing = newTicks[sym];
        if (existing?.source === "ws") {
          // WS is fresher — only update prev_close from REST
          newTicks[sym] = { ...existing, prev_close: r.prev_close ?? existing.prev_close };
        } else {
          newTicks[sym] = mergeTick(existing, {
            last: r.close ?? r.last ?? r.price,
            open: r.open,
            high: r.high,
            low: r.low,
            volume: r.volume,
            prev_close: r.prev_close,
            exchange_ts: r.timestamp,
            source: "rest",
            provider: r.source || "rest",
          }, sym);
        }
      }
      return { ticks: newTicks };
    });
  },
}));
