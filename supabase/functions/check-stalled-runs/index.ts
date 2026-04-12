import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Watchdog: marks optimization_runs as "failed" if they've been
 * stuck in "running"/"pending" status with no updated_at change
 * for more than STALL_THRESHOLD_SECONDS (default 10 minutes).
 *
 * Call periodically (e.g. every 5 minutes via cron or from client).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const STALL_THRESHOLD_SECONDS = 600; // 10 minutes

    // Find runs that are running/pending but haven't been updated recently
    const cutoff = new Date(Date.now() - STALL_THRESHOLD_SECONDS * 1000).toISOString();

    const { data: stalledRuns, error: fetchError } = await supabase
      .from("optimization_runs")
      .select("id, symbol, status, updated_at")
      .in("status", ["running", "pending"])
      .lt("updated_at", cutoff);

    if (fetchError) {
      console.error("Error fetching stalled runs:", fetchError.message);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const markedIds: number[] = [];

    if (stalledRuns && stalledRuns.length > 0) {
      for (const run of stalledRuns) {
        const { error: updateError } = await supabase
          .from("optimization_runs")
          .update({
            status: "failed",
            error_message: `Watchdog: no heartbeat for ${STALL_THRESHOLD_SECONDS}s — server likely crashed (OOM)`,
          })
          .eq("id", run.id);

        if (!updateError) {
          markedIds.push(run.id);
          console.log(`Marked run ${run.id} (${run.symbol}) as failed — last update: ${run.updated_at}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        checked_at: new Date().toISOString(),
        stalled_found: stalledRuns?.length || 0,
        marked_failed: markedIds,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-stalled-runs error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
