// @refresh reset
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

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;
const HEARTBEAT_INTERVAL_MS = 10000;

export function useMarketDataWebSocket() {
  const [data, setData] = useState<MarketDataMap>({});
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const heartbeatTimer = useRef<ReturnType<typeof setInterval>>();
  const apiKeyRef = useRef<string | null>(null);
  const firstPriceRef = useRef<Record<string, number>>({});
  const mountedRef = useRef(true);
  const subscribeFailed = useRef(false);

  // REST fallback — always runs as baseline
  const { data: restData } = useMarketDataLive();

  const stopHeartbeat = () => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = undefined;
    }
  };

  const startHeartbeat = (ws: WebSocket) => {
    stopHeartbeat();
    heartbeatTimer.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "heartbeat" }));
      }
    }, HEARTBEAT_INTERVAL_MS);
  };

  const connectRef = useRef<() => void>();
  connectRef.current = async () => {
    if (!mountedRef.current || subscribeFailed.current) return;

    if (!apiKeyRef.current) {
      try {
        const { data: tokenData, error } = await supabase.functions.invoke("get-ws-token");
        if (!mountedRef.current) return;
        if (error || !tokenData?.token) {
          console.warn("[WS] Failed to get token:", error);
          setWsStatus("error");
          return;
        }
        apiKeyRef.current = tokenData.token;
      } catch (e) {
        console.warn("[WS] get-ws-token error:", e);
        if (mountedRef.current) setWsStatus("error");
        return;
      }
    }

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    stopHeartbeat();

    if (!mountedRef.current) return;
    setWsStatus("connecting");

    const ws = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${apiKeyRef.current}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      console.log("[WS] Connected to Twelve Data");
      // Don't set "connected" yet — wait for successful subscribe

      // Simple format without exchange qualifiers
      ws.send(JSON.stringify({
        action: "subscribe",
        params: { symbols: "SPY,VIX,VIXY" },
      }));

      startHeartbeat(ws);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);

        if (msg.event === "subscribe-status") {
          console.log("[WS] Subscribe status:", msg.status, "success:", msg.success, "fails:", msg.fails, "full:", JSON.stringify(msg));
          
          if (msg.success?.length > 0) {
            // At least some symbols succeeded
            reconnectCount.current = 0;
            setSubscribeSuccess(true);
            setWsStatus("connected");
          }
          
          if (msg.status === "error" && (!msg.success || msg.success.length === 0)) {
            console.warn("[WS] All symbols failed to subscribe — stopping WS, using REST only");
            subscribeFailed.current = true;
            setSubscribeSuccess(false);
            setWsStatus("error");
            ws.close();
            // Don't reconnect — the API doesn't support these symbols on this plan
            return;
          }
          return;
        }
        if (msg.event === "heartbeat") return;

        if (msg.event === "price" && msg.symbol) {
          const price = parseFloat(msg.price);
          if (isNaN(price)) return;
          const sym = msg.symbol;

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
      if (mountedRef.current) setWsStatus("error");
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      if (!mountedRef.current) return;
      setWsStatus("disconnected");
      setSubscribeSuccess(false);
      wsRef.current = null;
      stopHeartbeat();

      // Don't reconnect if subscribe permanently failed
      if (subscribeFailed.current) return;

      if (reconnectCount.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectCount.current++;
        const delay = Math.min(RECONNECT_DELAY_MS * Math.pow(2, reconnectCount.current - 1), 60000);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectCount.current})`);
        reconnectTimer.current = setTimeout(() => connectRef.current?.(), delay);
      } else {
        console.warn("[WS] Max reconnect attempts reached, using REST fallback");
        setWsStatus("error");
      }
    };
  };

  useEffect(() => {
    mountedRef.current = true;
    connectRef.current?.();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      stopHeartbeat();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  // Seed prev_close from REST
  useEffect(() => {
    if (restData) {
      setData((prev) => {
        const updated = { ...prev };
        for (const [sym, rd] of Object.entries(restData as Record<string, any>)) {
          if (rd && !rd.error && !updated[sym]?.source) {
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
            if (!firstPriceRef.current[sym]) {
              firstPriceRef.current[sym] = rd.prev_close || rd.close;
            }
          }
          if (rd?.prev_close && updated[sym]) {
            updated[sym] = { ...updated[sym], prev_close: rd.prev_close };
          }
        }
        return updated;
      });
    }
  }, [restData]);

  const mergedData = { ...((restData as MarketDataMap) || {}), ...data };

  return {
    data: mergedData,
    wsStatus,
    isRealtime: subscribeSuccess && wsStatus === "connected",
  };
}
