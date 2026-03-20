const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("UNISWAP_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "UNISWAP_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Extract the endpoint path from the request URL
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint") ?? "/quote";

    const body = await req.json();

    const response = await fetch(
      `https://trade-api.gateway.uniswap.org/v1${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "x-universal-router-version": "2.0",
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
