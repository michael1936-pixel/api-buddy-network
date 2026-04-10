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

    // SPY + VIXY from Twelve Data
    const symbols = ['SPY', 'VIXY']
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

    // Try to get real VIX from DB (written by Railway server)
    let vixFromDb = false
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      const { data: vixRows } = await sb.from('market_data')
        .select('*').eq('symbol', 'VIX')
        .order('timestamp', { ascending: false }).limit(2)
      if (vixRows && vixRows.length > 0) {
        const latest = vixRows[0]
        const prev = vixRows[1] || latest
        const ageMs = Date.now() - new Date(latest.timestamp).getTime()
        // Use DB VIX if it's less than 10 minutes old
        if (ageMs < 10 * 60 * 1000) {
          results.VIX = {
            symbol: 'VIX', open: latest.open, high: latest.high,
            low: latest.low, close: latest.close, volume: latest.volume,
            timestamp: latest.timestamp, prev_close: prev.close,
            source: 'db',
          }
          vixFromDb = true
        }
      }

      // Save SPY to DB
      const spyR = results.SPY
      if (spyR && !spyR.error) {
        await sb.from('market_data').upsert({
          symbol: 'SPY', open: spyR.open, high: spyR.high,
          low: spyR.low, close: spyR.close, volume: spyR.volume,
          timestamp: new Date(spyR.timestamp).toISOString(), interval: '1min',
        }, { onConflict: 'symbol,interval,timestamp', ignoreDuplicates: true })
          .then(({ error }) => {
            if (error) console.error('DB upsert error for SPY:', error.message)
          })
      }
    }

    // Fallback: use VIXY as VIX proxy if no DB data
    if (!vixFromDb && results.VIXY && !results.VIXY.error) {
      results.VIX = {
        ...results.VIXY,
        symbol: 'VIX',
        source: 'vixy_proxy',
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
