const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

function estimateImpact(headline: string): string {
  const h = headline.toLowerCase()
  if (h.includes('fed') || h.includes('rate') || h.includes('inflation') || h.includes('crash') || h.includes('recession')) return 'high'
  if (h.includes('earnings') || h.includes('gdp') || h.includes('jobs') || h.includes('unemployment')) return 'medium'
  return 'low'
}

function estimateSentiment(headline: string): string {
  const h = headline.toLowerCase()
  const neg = ['crash', 'fall', 'drop', 'loss', 'fear', 'recession', 'decline', 'sell', 'warning', 'risk', 'cut']
  const pos = ['surge', 'rise', 'gain', 'rally', 'bull', 'growth', 'profit', 'record', 'boost', 'buy']
  const negScore = neg.filter(w => h.includes(w)).length
  const posScore = pos.filter(w => h.includes(w)).length
  if (negScore > posScore) return negScore >= 2 ? 'very_negative' : 'negative'
  if (posScore > negScore) return posScore >= 2 ? 'very_positive' : 'positive'
  return 'neutral'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!FINNHUB_KEY) {
      return new Response(JSON.stringify({ error: 'FINNHUB_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const url = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`
    const resp = await fetch(url)
    const articles = await resp.json()

    if (!Array.isArray(articles)) {
      return new Response(JSON.stringify({ error: 'Invalid response from Finnhub', raw: articles }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Map to our format
    const newsItems = articles.slice(0, 50).map((a: any) => ({
      event_id: `finnhub_${a.id}`,
      headline: a.headline || '',
      summary: a.summary || '',
      source: a.source || '',
      category: a.category || 'general',
      timestamp: new Date(a.datetime * 1000).toISOString(),
      impact_level: estimateImpact(a.headline || ''),
      sentiment: estimateSentiment(a.headline || ''),
      affected_symbols: a.related ? a.related.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
    }))

    // Save to DB (deduplicate by event_id)
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && newsItems.length > 0) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      
      // Get existing event_ids to avoid duplicates
      const eventIds = newsItems.map((n: any) => n.event_id)
      const { data: existing } = await sb.from('news_events').select('event_id').in('event_id', eventIds)
      const existingIds = new Set((existing || []).map((e: any) => e.event_id))
      
      const newItems = newsItems.filter((n: any) => !existingIds.has(n.event_id))
      if (newItems.length > 0) {
        const { error } = await sb.from('news_events').insert(newItems)
        if (error) console.error('DB insert error:', error.message)
        else console.log(`Inserted ${newItems.length} new news items`)
      }
    }

    return new Response(JSON.stringify({ news: newsItems, count: newsItems.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('fetch-news error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
