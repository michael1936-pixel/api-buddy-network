const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') || ''
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Fetch unanalyzed news (analyzed_at IS NULL)
    const { data: unanalyzed, error: fetchErr } = await sb
      .from('news_events')
      .select('*')
      .is('analyzed_at', null)
      .order('timestamp', { ascending: false })
      .limit(10)

    if (fetchErr) throw fetchErr

    // 2. Correlate old news with market reactions (news older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { data: uncorrelated } = await sb
      .from('news_events')
      .select('id, timestamp')
      .is('actual_spy_1h', null)
      .lt('timestamp', oneHourAgo)
      .limit(20)

    if (uncorrelated && uncorrelated.length > 0) {
      for (const item of uncorrelated) {
        const newsTime = new Date(item.timestamp)
        const afterTime = new Date(newsTime.getTime() + 3600000)

        // Get SPY at news time and 1h after
        const { data: spyAtNews } = await sb
          .from('market_data')
          .select('close')
          .eq('symbol', 'SPY')
          .lte('timestamp', newsTime.toISOString())
          .order('timestamp', { ascending: false })
          .limit(1)

        const { data: spyAfter } = await sb
          .from('market_data')
          .select('close')
          .eq('symbol', 'SPY')
          .lte('timestamp', afterTime.toISOString())
          .order('timestamp', { ascending: false })
          .limit(1)

        // Get VIX at news time and 1h after
        const { data: vixAtNews } = await sb
          .from('market_data')
          .select('close')
          .eq('symbol', 'VIX')
          .lte('timestamp', newsTime.toISOString())
          .order('timestamp', { ascending: false })
          .limit(1)

        const { data: vixAfter } = await sb
          .from('market_data')
          .select('close')
          .eq('symbol', 'VIX')
          .lte('timestamp', afterTime.toISOString())
          .order('timestamp', { ascending: false })
          .limit(1)

        if (spyAtNews?.[0] && spyAfter?.[0]) {
          const spyChange = ((spyAfter[0].close - spyAtNews[0].close) / spyAtNews[0].close) * 100
          const vixChange = (vixAtNews?.[0] && vixAfter?.[0])
            ? vixAfter[0].close - vixAtNews[0].close
            : null

          await sb.from('news_events').update({
            actual_spy_1h: Math.round(spyChange * 100) / 100,
            actual_vix_change: vixChange != null ? Math.round(vixChange * 100) / 100 : null,
            reaction_recorded: true,
          }).eq('id', item.id)
        }
      }
    }

    // 3. AI Analysis on unanalyzed news
    let analyzedCount = 0
    if (unanalyzed && unanalyzed.length > 0 && LOVABLE_API_KEY) {
      // Get agent memory for cumulative learning
      const { data: memoryRow } = await sb
        .from('agent_memory')
        .select('state')
        .eq('agent_id', 'news_ai_agent')
        .limit(1)

      const agentState = (memoryRow?.[0]?.state as any) || {
        total_analyzed: 0,
        patterns: [],
        key_learnings: [],
        accuracy_stats: { correct: 0, wrong: 0, total: 0 },
      }

      // Get recent analyzed news with market reactions for context
      const { data: recentWithReactions } = await sb
        .from('news_events')
        .select('headline, ai_sentiment_score, predicted_spy_impact, actual_spy_1h, actual_vix_change')
        .not('analyzed_at', 'is', null)
        .not('actual_spy_1h', 'is', null)
        .order('timestamp', { ascending: false })
        .limit(10)

      const learningContext = recentWithReactions?.map((r: any) =>
        `"${r.headline}" → Predicted: ${r.predicted_spy_impact}, Actual SPY: ${r.actual_spy_1h}%`
      ).join('\n') || 'אין היסטוריה עדיין'

      // Get current market data
      const { data: spyNow } = await sb.from('market_data').select('close').eq('symbol', 'SPY').order('timestamp', { ascending: false }).limit(1)
      const { data: vixNow } = await sb.from('market_data').select('close').eq('symbol', 'VIX').order('timestamp', { ascending: false }).limit(1)

      for (const newsItem of unanalyzed) {
        try {
          const prompt = `אתה סוכן מודיעין פיננסי מנוסה. נתח את החדשה הבאה והחזר JSON בלבד.

חדשה: "${newsItem.headline}"
${newsItem.summary ? `תקציר: "${newsItem.summary}"` : ''}
קטגוריה: ${newsItem.category}
מקור: ${newsItem.source || 'unknown'}
זמן: ${newsItem.timestamp}

מצב שוק נוכחי:
- SPY: $${spyNow?.[0]?.close || '?'}
- VIX: ${vixNow?.[0]?.close || '?'}

היסטוריית למידה (תחזיות קודמות מול תוצאות):
${learningContext}

דפוסים שזיהית עד כה: ${agentState.patterns?.length || 0}
מסקנות מרכזיות: ${JSON.stringify(agentState.key_learnings?.slice(-3) || [])}

החזר JSON בפורמט הבא בלבד, בלי markdown:
{
  "analysis": "מסקנה של 2-3 משפטים בעברית — מה החדשה אומרת, למה זה משנה, ומה הסוכן לומד מזה",
  "sentiment_score": <מספר בין -100 ל-100>,
  "predicted_spy_impact": "<תחזית: strong_bullish/bullish/neutral/bearish/strong_bearish>",
  "predicted_vix_impact": "<תחזית: spike/rise/stable/drop/crash>",
  "reasoning": "הסבר קצר למה הגעת לתחזית הזאת, תוך התייחסות ללקחים מהעבר",
  "new_pattern": "<דפוס חדש שזיהית, או null אם אין>"
}`

          const aiResp = await fetch(AI_GATEWAY, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                { role: 'system', content: 'אתה סוכן AI לניתוח חדשות פיננסיות. תמיד תחזיר JSON תקין בלבד, בלי markdown, בלי backticks.' },
                { role: 'user', content: prompt },
              ],
            }),
          })

          if (!aiResp.ok) {
            console.error(`AI error ${aiResp.status}:`, await aiResp.text())
            continue
          }

          const aiData = await aiResp.json()
          const content = aiData.choices?.[0]?.message?.content || ''

          // Parse JSON from response (strip markdown if present)
          let parsed: any
          try {
            const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
            parsed = JSON.parse(jsonStr)
          } catch {
            console.error('Failed to parse AI response:', content)
            continue
          }

          // Update news item with AI analysis
          await sb.from('news_events').update({
            ai_analysis: parsed.analysis || '',
            ai_sentiment_score: parsed.sentiment_score || 0,
            predicted_spy_impact: parsed.predicted_spy_impact || 'neutral',
            predicted_vix_impact: parsed.predicted_vix_impact || 'stable',
            analyzed_at: new Date().toISOString(),
          }).eq('id', newsItem.id)

          analyzedCount++

          // Update agent memory with new patterns
          agentState.total_analyzed = (agentState.total_analyzed || 0) + 1
          if (parsed.new_pattern && parsed.new_pattern !== 'null') {
            agentState.patterns = [...(agentState.patterns || []).slice(-20), parsed.new_pattern]
          }
          if (parsed.reasoning) {
            agentState.key_learnings = [...(agentState.key_learnings || []).slice(-10), {
              headline: newsItem.headline?.slice(0, 80),
              prediction: parsed.predicted_spy_impact,
              reasoning: parsed.reasoning?.slice(0, 200),
              timestamp: new Date().toISOString(),
            }]
          }
        } catch (aiErr) {
          console.error('AI analysis error for news:', newsItem.id, aiErr)
        }
      }

      // Save updated agent memory
      if (analyzedCount > 0) {
        agentState.last_analysis = new Date().toISOString()
        await sb.from('agent_memory').upsert({
          agent_id: 'news_ai_agent',
          state: agentState,
          updated_at: new Date().toISOString(),
          version: (agentState.total_analyzed || 0),
        }, { onConflict: 'agent_id' })
      }
    }

    // 4. Return analyzed news for frontend
    const { data: allNews } = await sb
      .from('news_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100)

    // Get agent memory stats
    const { data: agentMem } = await sb
      .from('agent_memory')
      .select('state')
      .eq('agent_id', 'news_ai_agent')
      .limit(1)

    return new Response(JSON.stringify({
      news: allNews || [],
      analyzed_now: analyzedCount,
      agent_stats: agentMem?.[0]?.state || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('analyze-news error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
