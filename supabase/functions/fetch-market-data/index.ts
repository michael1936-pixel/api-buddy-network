const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const TWELVE_DATA_KEY = Deno.env.get('TWELVE_DATA_API_KEY') || ''
const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!TWELVE_DATA_KEY) {
      return new Response(JSON.stringify({ error: 'TWELVE_DATA_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const results: Record<string, any> = {}

    // SPY from Twelve Data
    {
      const url = `https://api.twelvedata.com/time_series?symbol=SPY&interval=1min&outputsize=2&apikey=${TWELVE_DATA_KEY}`
      const resp = await fetch(url)
      const data = await resp.json()
      if (data.status === 'error' || !data.values?.length) {
        results.SPY = { error: data.message || 'No data' }
      } else {
        const latest = data.values[0]
        const prev = data.values[1] || latest
        results.SPY = {
          symbol: 'SPY', open: parseFloat(latest.open), high: parseFloat(latest.high),
          low: parseFloat(latest.low), close: parseFloat(latest.close),
          volume: parseInt(latest.volume || '0'), timestamp: latest.datetime,
          prev_close: parseFloat(prev.close),
        }
      }
    }

    // VIX from Finnhub quote endpoint
    if (FINNHUB_KEY) {
      const url = `https://finnhub.io/api/v1/quote?symbol=^VIX&token=${FINNHUB_KEY}`
      const resp = await fetch(url)
      const q = await resp.json()
      if (q && q.c > 0) {
        results.VIX = {
          symbol: 'VIX', open: q.o, high: q.h, low: q.l, close: q.c,
          volume: 0, timestamp: new Date(q.t * 1000).toISOString(),
          prev_close: q.pc,
        }
      } else {
        // Fallback: try ^GSPC index or just report error
        results.VIX = { error: 'VIX quote unavailable' }
      }
    }
    }

    // Write to market_data in background (don't block response)
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      for (const sym of ['SPY', 'VIX']) {
        const r = results[sym]
        if (r && !r.error) {
          await sb.from('market_data').insert({
            symbol: r.symbol,
            open: r.open,
            high: r.high,
            low: r.low,
            close: r.close,
            volume: r.volume,
            timestamp: new Date(r.timestamp).toISOString(),
            interval: '1min',
          }).then(({ error }) => {
            if (error) console.error(`DB insert error for ${sym}:`, error.message)
          })
        }
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('fetch-market-data error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
