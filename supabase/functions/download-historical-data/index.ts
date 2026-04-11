const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const TWELVE_DATA_KEY = Deno.env.get('TWELVE_DATA_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

function toISOWithTZ(datetime: string): string {
  try {
    const d = new Date(datetime + ' EDT')
    if (!isNaN(d.getTime())) return d.toISOString()
  } catch { /* fallback */ }
  return datetime.replace(' ', 'T') + '-04:00'
}

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

    const { symbol } = await req.json()
    if (!symbol || typeof symbol !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing symbol' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const sym = symbol.toUpperCase().trim()

    // Create download job
    const { data: job } = await sb.from('data_download_jobs').insert({
      symbol: sym, status: 'running', started_at: new Date().toISOString(),
    }).select('id').single()
    const jobId = job?.id

    let totalBars = 0
    const now = new Date()
    const fiveYearsAgo = new Date(now)
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)

    // Twelve Data: max 5000 bars per request for 15min
    // 5 years ≈ 252 trading days × 5 × 26 bars/day ≈ 32,760 bars → ~7 requests
    // We paginate backwards from now using end_date
    let currentEnd = new Date(now)
    const MAX_REQUESTS = 8
    const BATCH_SIZE = 5000

    for (let reqNum = 0; reqNum < MAX_REQUESTS; reqNum++) {
      if (currentEnd <= fiveYearsAgo) break

      const params = new URLSearchParams({
        symbol: sym,
        interval: '15min',
        outputsize: String(BATCH_SIZE),
        apikey: TWELVE_DATA_KEY,
        end_date: currentEnd.toISOString().split('T')[0],
        start_date: fiveYearsAgo.toISOString().split('T')[0],
        order: 'ASC',
      })

      const url = `https://api.twelvedata.com/time_series?${params}`
      console.log(`[download] Request ${reqNum + 1}: ${sym} ending ${currentEnd.toISOString().split('T')[0]}`)

      const resp = await fetch(url)
      const data = await resp.json()

      if (data.status === 'error') {
        console.error(`[download] API error: ${data.message}`)
        // If symbol not found, break
        if (data.message?.includes('not found') || data.code === 404) {
          throw new Error(`Symbol ${sym} not found on Twelve Data`)
        }
        break
      }

      const values = data.values
      if (!values || values.length === 0) break

      // Convert and batch upsert
      const rows = values.map((v: any) => ({
        symbol: sym,
        interval: '15min',
        timestamp: toISOWithTZ(v.datetime),
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: parseInt(v.volume || '0'),
      }))

      // Upsert in chunks of 500
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500)
        const { error } = await sb.from('market_data').upsert(chunk, {
          onConflict: 'symbol,interval,timestamp',
          ignoreDuplicates: true,
        })
        if (error) console.error(`[download] Upsert error: ${error.message}`)
      }

      totalBars += rows.length
      console.log(`[download] Batch ${reqNum + 1}: ${rows.length} bars (total: ${totalBars})`)

      // Update job progress
      if (jobId) {
        await sb.from('data_download_jobs').update({
          bars_downloaded: totalBars,
        }).eq('id', jobId)
      }

      // Move end_date to before earliest bar in this batch
      const earliestDatetime = values[0].datetime // ASC order, first is earliest
      const earliestDate = new Date(toISOWithTZ(earliestDatetime))
      earliestDate.setDate(earliestDate.getDate() - 1)
      
      if (earliestDate <= fiveYearsAgo || values.length < BATCH_SIZE) break
      currentEnd = earliestDate

      // Rate limit: wait 8 seconds between requests (Twelve Data free tier)
      if (reqNum < MAX_REQUESTS - 1) {
        await new Promise(r => setTimeout(r, 8000))
      }
    }

    // Upsert tracked_symbols
    await sb.from('tracked_symbols').upsert({
      symbol: sym,
      is_active: true,
      total_bars: totalBars,
      last_download: new Date().toISOString(),
    }, { onConflict: 'symbol' })

    // Complete job
    if (jobId) {
      await sb.from('data_download_jobs').update({
        status: 'completed',
        bars_downloaded: totalBars,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId)
    }

    console.log(`[download] ✅ ${sym}: ${totalBars} bars downloaded`)

    return new Response(JSON.stringify({
      symbol: sym,
      bars_downloaded: totalBars,
      status: 'completed',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('[download] Error:', err.message)

    // Try to update job as failed
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      const body = await req.clone().json().catch(() => ({}))
      if (body.symbol) {
        await sb.from('data_download_jobs').update({
          status: 'failed',
          error_message: err.message,
          completed_at: new Date().toISOString(),
        }).eq('symbol', body.symbol).eq('status', 'running')
      }
    } catch {}

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
