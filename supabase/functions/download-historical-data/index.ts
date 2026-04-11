const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const TWELVE_DATA_KEY = Deno.env.get('TWELVE_DATA_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const DEFAULT_TARGET_YEARS = 5
const DEFAULT_TARGET_BARS = 35000
const MARKET_INTERVAL = '15min'
const MAX_REQUESTS = 8
const BATCH_SIZE = 5000

function toISOWithTZ(datetime: string): string {
  try {
    const d = new Date(datetime + ' EDT')
    if (!isNaN(d.getTime())) return d.toISOString()
  } catch { /* fallback */ }
  return datetime.replace(' ', 'T') + '-04:00'
}

async function getMarketDataSummary(sb: ReturnType<typeof createClient>, symbol: string) {
  const [{ count, error: countError }, { data: oldestRows, error: oldestError }] = await Promise.all([
    sb.from('market_data').select('id', { count: 'exact', head: true }).eq('symbol', symbol).eq('interval', MARKET_INTERVAL),
    sb.from('market_data').select('timestamp').eq('symbol', symbol).eq('interval', MARKET_INTERVAL).order('timestamp', { ascending: true }).limit(1),
  ])

  if (countError) throw countError
  if (oldestError) throw oldestError

  return {
    totalBars: count || 0,
    oldestTimestamp: oldestRows?.[0]?.timestamp ?? null,
  }
}

Deno.serve(async (req) => {
  let requestBody: Record<string, unknown> = {}

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!TWELVE_DATA_KEY) {
      return new Response(JSON.stringify({ error: 'TWELVE_DATA_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    requestBody = await req.json().catch(() => ({}))
    const symbol = typeof requestBody.symbol === 'string' ? requestBody.symbol : ''
    const requestedYears = Number(requestBody.target_years)
    const requestedBars = Number(requestBody.target_bars)
    const targetYears = Number.isFinite(requestedYears) && requestedYears > 0 ? Math.min(requestedYears, 10) : DEFAULT_TARGET_YEARS
    const targetBars = Number.isFinite(requestedBars) && requestedBars > 0 ? requestedBars : DEFAULT_TARGET_BARS

    if (!symbol || typeof symbol !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing symbol' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const sym = symbol.toUpperCase().trim()
    const now = new Date()
    const targetStartDate = new Date(now)
    targetStartDate.setFullYear(targetStartDate.getFullYear() - targetYears)
    const existingSummary = await getMarketDataSummary(sb, sym)

    // Create download job
    const { data: job } = await sb.from('data_download_jobs').insert({
      symbol: sym, status: 'running', started_at: new Date().toISOString(),
    }).select('id').single()
    const jobId = job?.id

    const alreadyCovered = existingSummary.oldestTimestamp
      ? new Date(existingSummary.oldestTimestamp) <= targetStartDate && existingSummary.totalBars >= targetBars
      : false

    if (alreadyCovered) {
      await sb.from('tracked_symbols').upsert({
        symbol: sym,
        is_active: true,
        total_bars: existingSummary.totalBars,
        last_download: new Date().toISOString(),
      }, { onConflict: 'symbol' })

      if (jobId) {
        await sb.from('data_download_jobs').update({
          status: 'completed',
          bars_downloaded: existingSummary.totalBars,
          completed_at: new Date().toISOString(),
        }).eq('id', jobId)
      }

      return new Response(JSON.stringify({
        symbol: sym,
        bars_downloaded: existingSummary.totalBars,
        bars_added: 0,
        total_bars: existingSummary.totalBars,
        oldest_timestamp: existingSummary.oldestTimestamp,
        status: 'completed',
        already_synced: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let fetchedBars = 0
    let currentEnd = existingSummary.oldestTimestamp ? new Date(existingSummary.oldestTimestamp) : new Date(now)
    if (existingSummary.oldestTimestamp) {
      currentEnd.setDate(currentEnd.getDate() - 1)
    }

    for (let reqNum = 0; reqNum < MAX_REQUESTS; reqNum++) {
      if (currentEnd <= targetStartDate) break

      const params = new URLSearchParams({
        symbol: sym,
        interval: MARKET_INTERVAL,
        outputsize: String(BATCH_SIZE),
        apikey: TWELVE_DATA_KEY,
        end_date: currentEnd.toISOString().split('T')[0],
        start_date: targetStartDate.toISOString().split('T')[0],
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
        interval: MARKET_INTERVAL,
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

      fetchedBars += rows.length
      console.log(`[download] Batch ${reqNum + 1}: ${rows.length} bars fetched (total fetched: ${fetchedBars})`)

      // Update job progress
      if (jobId) {
        await sb.from('data_download_jobs').update({
          bars_downloaded: existingSummary.totalBars + fetchedBars,
        }).eq('id', jobId)
      }

      // Move end_date to before earliest bar in this batch
      const earliestDatetime = values[0].datetime // ASC order, first is earliest
      const earliestDate = new Date(toISOWithTZ(earliestDatetime))
      earliestDate.setDate(earliestDate.getDate() - 1)
      
      if (earliestDate <= targetStartDate || values.length < BATCH_SIZE) break
      currentEnd = earliestDate

      // Rate limit: wait 8 seconds between requests (Twelve Data free tier)
      if (reqNum < MAX_REQUESTS - 1) {
        await new Promise(r => setTimeout(r, 8000))
      }
    }

    const syncedSummary = await getMarketDataSummary(sb, sym)
    const barsAdded = Math.max(0, syncedSummary.totalBars - existingSummary.totalBars)

    // Upsert tracked_symbols
    await sb.from('tracked_symbols').upsert({
      symbol: sym,
      is_active: true,
      total_bars: syncedSummary.totalBars,
      last_download: new Date().toISOString(),
    }, { onConflict: 'symbol' })

    // Complete job
    if (jobId) {
      await sb.from('data_download_jobs').update({
        status: 'completed',
        bars_downloaded: syncedSummary.totalBars,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId)
    }

    console.log(`[download] ✅ ${sym}: ${syncedSummary.totalBars} total bars (${barsAdded} new)`)

    return new Response(JSON.stringify({
      symbol: sym,
      bars_downloaded: syncedSummary.totalBars,
      bars_added: barsAdded,
      total_bars: syncedSummary.totalBars,
      oldest_timestamp: syncedSummary.oldestTimestamp,
      status: 'completed',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('[download] Error:', err.message)

    // Try to update job as failed
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      const failedSymbol = typeof requestBody.symbol === 'string' ? requestBody.symbol.toUpperCase().trim() : ''
      if (failedSymbol) {
        await sb.from('data_download_jobs').update({
          status: 'failed',
          error_message: err.message,
          completed_at: new Date().toISOString(),
        }).eq('symbol', failedSymbol).eq('status', 'running')
      }
    } catch {}

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
