const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const TWELVE_DATA_KEY = Deno.env.get('TWELVE_DATA_API_KEY') || ''
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

    const symbols = [
      { query: 'SPY', name: 'SPY' },
      { query: 'VIX', name: 'VIX' },
      { query: 'CBOE:VIX', name: 'VIX' },
    ]
    const results: Record<string, any> = {}

    for (const { query, name } of symbols) {
      if (results[name] && !results[name].error) continue
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(query)}&interval=1min&outputsize=2&apikey=${TWELVE_DATA_KEY}`
      const resp = await fetch(url)
      const data = await resp.json()

      if (data.status === 'error') {
        console.error(`Twelve Data error for ${name}:`, data.message)
        results[name] = { error: data.message }
        continue
      }

      const values = data.values || []
      if (values.length === 0) {
        results[name] = { error: 'No data returned' }
        continue
      }

      const latest = values[0]
      const prev = values[1] || latest

      results[name] = {
        symbol: name,
        open: parseFloat(latest.open),
        high: parseFloat(latest.high),
        low: parseFloat(latest.low),
        close: parseFloat(latest.close),
        volume: parseInt(latest.volume || '0'),
        timestamp: latest.datetime,
        prev_close: parseFloat(prev.close),
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
