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

    const results: Record<string, any> = {}

    // SPY + VIXY + VIX from Twelve Data in one call
    const symbols = ['SPY', 'VIXY', 'VIX']
    const url = `https://api.twelvedata.com/time_series?symbol=${symbols.join(',')}&interval=1min&outputsize=2&apikey=${TWELVE_DATA_KEY}`
    const resp = await fetch(url)
    const rawData = await resp.json()

    for (const sym of symbols) {
      const data = symbols.length > 1 ? rawData[sym] : rawData
      if (!data || data.status === 'error' || !data.values?.length) {
        results[sym] = { error: data?.message || 'No data' }
        continue
      }
      const latest = data.values[0]
      const prev = data.values[1] || latest
      results[sym] = {
        symbol: sym, open: parseFloat(latest.open), high: parseFloat(latest.high),
        low: parseFloat(latest.low), close: parseFloat(latest.close),
        volume: parseInt(latest.volume || '0'), timestamp: latest.datetime,
        prev_close: parseFloat(prev.close),
      }
    }

    // Fallback: if VIX failed from Twelve Data, try DB
    if (results.VIX?.error && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      const { data: vixRows } = await sb.from('market_data')
        .select('*').eq('symbol', 'VIX')
        .order('timestamp', { ascending: false }).limit(2)
      if (vixRows && vixRows.length > 0) {
        const latest = vixRows[0]
        const prev = vixRows[1] || latest
        results.VIX = {
          symbol: 'VIX', open: latest.open, high: latest.high,
          low: latest.low, close: latest.close, volume: latest.volume,
          timestamp: latest.timestamp, prev_close: prev.close,
        }
      }
    }

    // Save SPY + VIX to DB
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      for (const sym of ['SPY', 'VIX']) {
        const r = results[sym]
        if (r && !r.error) {
          await sb.from('market_data').insert({
            symbol: sym, open: r.open, high: r.high,
            low: r.low, close: r.close, volume: r.volume,
            timestamp: new Date(r.timestamp).toISOString(), interval: '1min',
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
