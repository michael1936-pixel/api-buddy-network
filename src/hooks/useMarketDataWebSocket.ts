import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMarketDataLive } from "@/hooks/use-trading-data";

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

const WS_SYMBOLS = "SPY,VIX,VIXY";
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useMarketDataWebSocket() {
  const [data, setData] = useState<MarketDataMap>({});
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const apiKeyRef = useRef<string | null>(null);
  // Track first prices per symbol to use as prev_close
  const firstPriceRef = useRef<Record<string, number>>({});

  // REST fallback
  const { data: restData } = useMarketDataLive();

  const connect = useCallback(async () => {
    // Get API key if we don't have it
    if (!apiKeyRef.current) {
      try {
        const { data: tokenData, error } = await supabase.functions.invoke("get-ws-token");
        if (error || !tokenData?.token) {
          console.warn("Failed to get WS token:", error);
          setWsStatus("error");
          return;
        }
        apiKeyRef.current = tokenData.token;
      } catch (e) {
        console.warn("get-ws-token error:", e);
        setWsStatus("error");
        return;
      }
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    setWsStatus("connecting");
    const ws = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${apiKeyRef.current}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected to Twelve Data");
      setWsStatus("connected");
      reconnectCount.current = 0;

      // Subscribe to symbols
      ws.send(JSON.stringify({
        action: "subscribe",
        params: { symbols: WS_SYMBOLS },
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Handle subscribe status
        if (msg.event === "subscribe-status") {
          console.log("[WS] Subscribe status:", msg.status);
          return;
        }

        // Handle heartbeat
        if (msg.event === "heartbeat") return;

        // Handle price event
        if (msg.event === "price" && msg.symbol) {
          const price = parseFloat(msg.price);
          if (isNaN(price)) return;

          const sym = msg.symbol;

          // Store first price as prev_close reference
          if (!firstPriceRef.current[sym]) {
            firstPriceRef.current[sym] = price;
          }

          setData((prev) => {
            const existing = prev[sym];
            const prevClose = existing?.prev_close || firstPriceRef.current[sym] || price;

            return {
              ...prev,
              [sym]: {
                symbol: sym,
                close: price,
                open: existing?.open || price,
                high: Math.max(existing?.high || 0, price),
                low: existing?.low ? Math.min(existing.low, price) : price,
                volume: parseInt(msg.day_volume || "0") || existing?.volume || 0,
                prev_close: prevClose,
                timestamp: msg.timestamp ? new Date(msg.timestamp * 1000).toISOString() : new Date().toISOString(),
                source: "ws",
              },
            };
          });
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = (e) => {
      console.warn("[WS] Error:", e);
      setWsStatus("error");
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      setWsStatus("disconnected");
      wsRef.current = null;

      // Auto-reconnect
      if (reconnectCount.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectCount.current++;
        const delay = RECONNECT_DELAY_MS * reconnectCount.current;
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectCount.current})`);
        reconnectTimer.current = setTimeout(connect, delay);
      } else {
        console.warn("[WS] Max reconnect attempts reached, using REST fallback");
        setWsStatus("error");
      }
    };
  }, []);

  // Initialize on mount
  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Seed prev_close from REST data when it arrives
  useEffect(() => {
    if (restData) {
      setData((prev) => {
        const updated = { ...prev };
        for (const [sym, rd] of Object.entries(restData as Record<string, any>)) {
          if (rd && !rd.error && !updated[sym]?.source) {
            // Only seed if WS hasn't provided data yet
            updated[sym] = {
              symbol: sym,
              close: rd.close,
              open: rd.open || rd.close,
              high: rd.high || rd.close,
              low: rd.low || rd.close,
              volume: rd.volume || 0,
              prev_close: rd.prev_close || rd.close,
              timestamp: rd.timestamp || new Date().toISOString(),
              source: "rest",
            };
            // Also set firstPrice for prev_close tracking
            if (!firstPriceRef.current[sym]) {
              firstPriceRef.current[sym] = rd.prev_close || rd.close;
            }
          }
          // Update prev_close from REST even if WS is active
          if (rd?.prev_close && updated[sym]) {
            updated[sym] = { ...updated[sym], prev_close: rd.prev_close };
          }
        }
        return updated;
      });
    }
  }, [restData]);

  // Merge: prefer WS data, fall back to REST
  const mergedData = { ...((restData as MarketDataMap) || {}), ...data };

  return {
    data: mergedData,
    wsStatus,
    isRealtime: wsStatus === "connected",
  };
}
