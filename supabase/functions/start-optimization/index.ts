import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { symbols, enabled_stages } = await req.json();

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return new Response(
        JSON.stringify({ error: "symbols array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const railwayUrl = Deno.env.get("RAILWAY_API_URL");
    const railwayToken = Deno.env.get("RAILWAY_API_TOKEN");

    if (!railwayUrl) {
      return new Response(
        JSON.stringify({ error: "RAILWAY_API_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create optimization_runs rows in DB for each symbol
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const runIds: number[] = [];
    for (const symbol of symbols) {
      const { data, error } = await supabase
        .from("optimization_runs")
        .insert({
          symbol,
          status: "pending",
          total_stages: 30,
          current_stage: 0,
          current_combo: 0,
          total_combos: 0,
        })
        .select("id")
        .single();

      if (error) {
        console.error(`Failed to create run for ${symbol}:`, error.message);
        continue;
      }
      runIds.push(data.id);
    }

    if (runIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to create optimization runs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send job to Railway server
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (railwayToken) {
      headers["Authorization"] = `Bearer ${railwayToken}`;
    }

    // Ensure URL has protocol
    const baseUrl = railwayUrl.startsWith('http') ? railwayUrl : `https://${railwayUrl}`;
    const railwayResponse = await fetch(`${baseUrl}/api/optimize`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        symbols,
        run_ids: runIds,
        enabled_stages: enabled_stages || null,
      }),
    });

    if (!railwayResponse.ok) {
      const errText = await railwayResponse.text();
      console.error("Railway error:", errText);
      // Mark runs as failed
      for (const id of runIds) {
        await supabase
          .from("optimization_runs")
          .update({ status: "failed", error_message: `Railway error: ${errText}` })
          .eq("id", id);
      }
      return new Response(
        JSON.stringify({ error: `Railway server error: ${railwayResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const railwayData = await railwayResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        run_ids: runIds,
        symbols,
        railway_response: railwayData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("start-optimization error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
