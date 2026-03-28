import { corsHeaders, createAdminClient } from "../_shared/control-plane.ts";

const EXECUTABLE_ADAPTERS = new Set(["process", "http", "codex_local"]);

interface WakeupRequestBody {
  agentId: string;
  companyId?: string;
  reason?: string;
  payload?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as WakeupRequestBody;
    if (!body.agentId) {
      return new Response(JSON.stringify({ error: "agentId is required" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createAdminClient();
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, company_id, name, adapter_type")
      .eq("id", body.agentId)
      .maybeSingle();

    if (agentError) {
      throw new Error(`Failed to load agent: ${agentError.message}`);
    }
    if (!agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.companyId && body.companyId !== agent.company_id) {
      return new Response(
        JSON.stringify({ error: "companyId does not match the agent's company" }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!EXECUTABLE_ADAPTERS.has(agent.adapter_type)) {
      return new Response(
        JSON.stringify({
          error: `Adapter ${agent.adapter_type} is configuration-only in M1`,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const reason =
      body.reason?.trim() || `Manual wakeup for ${agent.name}`;
    const payload = {
      ...(body.payload ?? {}),
      task:
        typeof body.payload?.task === "string" && body.payload.task.trim()
          ? body.payload.task.trim()
          : reason,
    };

    const { data: enqueued, error: enqueueError } = await supabase.rpc(
      "enqueue_agent_wakeup",
      {
        p_agent_id: agent.id,
        p_company_id: agent.company_id,
        p_reason: reason,
        p_trigger_type: "manual",
        p_payload: payload,
      },
    );

    if (enqueueError) {
      throw new Error(`Failed to enqueue wakeup: ${enqueueError.message}`);
    }

    const row = Array.isArray(enqueued) ? enqueued[0] : enqueued;
    return new Response(
      JSON.stringify({
        wakeupRequestId: row?.wakeup_request_id ?? null,
        heartbeatRunId: row?.heartbeat_run_id ?? null,
        status: "accepted",
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
