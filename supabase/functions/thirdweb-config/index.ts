const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientId = Deno.env.get("VITE_THIRDWEB_CLIENT_ID");

  if (!clientId) {
    return new Response(
      JSON.stringify({ error: "VITE_THIRDWEB_CLIENT_ID not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ clientId }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
