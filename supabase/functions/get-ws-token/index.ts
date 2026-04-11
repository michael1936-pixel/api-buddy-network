/**
 * Returns the Finnhub API key for WS connections.
 * In Railway mode, this could return a Railway auth token instead.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Prefer Finnhub for WS (supports real-time trades on free tier for US stocks)
  const finnhubKey = Deno.env.get('FINNHUB_API_KEY')
  if (finnhubKey) {
    return new Response(JSON.stringify({ token: finnhubKey, provider: 'finnhub' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fallback to Twelve Data
  const twelveKey = Deno.env.get('TWELVE_DATA_API_KEY')
  if (twelveKey) {
    return new Response(JSON.stringify({ token: twelveKey, provider: 'twelvedata' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'No API key configured' }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
