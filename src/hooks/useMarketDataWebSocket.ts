/**
 * WebSocket hook that connects to the Railway internal market stream.
 *
 * Architecture:
 *   Broker/Feed → Railway market-stream service → this WS → Zustand store
 *
 * The Railway server should expose a WS endpoint that:
 *   1. Accepts connections at wss://<railway-host>/ws/market
 *   2. Accepts subscribe/unsubscribe messages
 *   3. Sends normalized tick messages
 *
 * Expected message format FROM server:
 *   { type: "tick", symbol: "SPY", last: 550.25, bid: 550.24, ask: 550.26,
 *     volume: 123456, exchange_ts: "2026-04-11T15:30:00.123Z", provider: "ibkr" }
 *   { type: "status", status: "connected" | "subscribed" | "error", symbols?: [...] }
 *   { type: "heartbeat" }
 *
 * Subscribe message TO server:
 *   { action: "subscribe", symbols: ["SPY", "VIX"] }
 *   { action: "unsubscribe", symbols: ["AAPL"] }
 *
 * Fallback: If RAILWAY_WS_URL is not configured, falls back to Finnhub direct WS.
 */
import { useEffect, useRef, useCallback } from "react";
import { useMarketDataStore } from "@/stores/marketDataStore";
import { supabase } from "@/integrations/supabase/client";

// Railway WS URL — set this to your Railway market stream endpoint
const RAILWAY_WS_URL = import.meta.env.VITE_RAILWAY_WS_URL || "";
// Fallback: Finnhub direct (limited but works for SPY)
const FINNHUB_FALLBACK = true;

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL_MS = 15000;

// RAF-based tick batching: accumulate ticks within one animation frame
let pendingTicks: Record<string, any> = {};
let rafId: number | null = null;

function flushTicks() {
  const batch = pendingTicks;
  pendingTicks = {};
  rafId = null;
  if (Object.keys(batch).length > 0) {
    useMarketDataStore.getState().updateTicks(batch);
  }
}

function enqueueTick(symbol: string, tick: any) {
  pendingTicks[symbol] = tick;
  if (rafId === null) {
    rafId = requestAnimationFrame(flushTicks);
  }
}

export function useMarketStream() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const heartbeatTimer = useRef<ReturnType<typeof setInterval>>();
  const mountedRef = useRef(true);
  const apiKeyRef = useRef<string | null>(null);

  const { setStreamStatus, setIsRealtime, subscribedSymbols } = useMarketDataStore();

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = undefined;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    stopHeartbeat();
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [stopHeartbeat]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectCount.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn("[WS] Max reconnect attempts reached");
      setStreamStatus("error");
      return;
    }
    reconnectCount.current++;
    const delay = Math.min(RECONNECT_DELAY_MS * Math.pow(2, reconnectCount.current - 1), 60000);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectCount.current})`);
    reconnectTimer.current = setTimeout(() => connectRef.current?.(), delay);
  }, [setStreamStatus]);

  const connectRef = useRef<() => void>();

  // ═══ Railway mode ═══
  const connectRailway = useCallback(() => {
    if (!mountedRef.current) return;
    cleanup();
    setStreamStatus("connecting");

    const ws = new WebSocket(RAILWAY_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      console.log("[WS] Connected to Railway stream");
      // Subscribe to desired symbols
      const symbols = Array.from(subscribedSymbols);
      ws.send(JSON.stringify({ action: "subscribe", symbols }));

      heartbeatTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: "heartbeat" }));
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "tick" && msg.symbol) {
          enqueueTick(msg.symbol, {
            last: msg.last ?? msg.price,
            bid: msg.bid,
            ask: msg.ask,
            open: msg.open,
            high: msg.high,
            low: msg.low,
            volume: msg.volume,
            exchange_ts: msg.exchange_ts ?? msg.timestamp,
            source: "ws" as const,
            provider: msg.provider || "railway",
            sequence: msg.sequence,
          });
        } else if (msg.type === "status") {
          if (msg.status === "subscribed" || msg.status === "connected") {
            reconnectCount.current = 0;
            setStreamStatus("connected");
            setIsRealtime(true);
          } else if (msg.status === "error") {
            console.warn("[WS] Server error:", msg.message);
          }
        }
        // heartbeat — ignore
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => {
      if (mountedRef.current) setStreamStatus("error");
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStreamStatus("disconnected");
      setIsRealtime(false);
      wsRef.current = null;
      stopHeartbeat();
      scheduleReconnect();
    };
  }, [cleanup, setStreamStatus, setIsRealtime, subscribedSymbols, stopHeartbeat, scheduleReconnect]);

  // ═══ Finnhub fallback mode ═══
  const connectFinnhub = useCallback(async () => {
    if (!mountedRef.current) return;
    cleanup();
    setStreamStatus("connecting");

    // Get API key from edge function
    if (!apiKeyRef.current) {
      try {
        const { data: tokenData, error } = await supabase.functions.invoke("get-ws-token");
        if (!mountedRef.current) return;
        if (error || !tokenData?.token) {
          console.warn("[WS] Failed to get Finnhub token:", error);
          setStreamStatus("error");
          return;
        }
        apiKeyRef.current = tokenData.token;
      } catch (e) {
        console.warn("[WS] get-ws-token error:", e);
        if (mountedRef.current) setStreamStatus("error");
        return;
      }
    }

    const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKeyRef.current}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      console.log("[WS] Connected to Finnhub");

      // Subscribe to US equities (VIX not available on Finnhub free tier)
      const symbols = Array.from(subscribedSymbols).filter(s => s !== "VIX");
      symbols.forEach(sym => {
        ws.send(JSON.stringify({ type: "subscribe", symbol: sym }));
      });

      reconnectCount.current = 0;
      setStreamStatus("connected");
      setIsRealtime(true);

      heartbeatTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "trade" && msg.data?.length > 0) {
          // Finnhub sends array of trades
          for (const trade of msg.data) {
            const sym = trade.s;
            if (!sym) continue;
            enqueueTick(sym, {
              last: trade.p,
              volume: trade.v,
              exchange_ts: new Date(trade.t).toISOString(),
              source: "ws" as const,
              provider: "finnhub",
            });
          }
        }
        // ping response — ignore
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      if (mountedRef.current) setStreamStatus("error");
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStreamStatus("disconnected");
      setIsRealtime(false);
      wsRef.current = null;
      stopHeartbeat();
      scheduleReconnect();
    };
  }, [cleanup, setStreamStatus, setIsRealtime, subscribedSymbols, stopHeartbeat, scheduleReconnect]);

  // Decide which mode to use
  connectRef.current = RAILWAY_WS_URL ? connectRailway : (FINNHUB_FALLBACK ? connectFinnhub : undefined);

  useEffect(() => {
    mountedRef.current = true;
    connectRef.current?.();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
