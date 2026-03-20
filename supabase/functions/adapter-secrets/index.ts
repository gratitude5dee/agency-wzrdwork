import {
  corsHeaders,
  createAdminClient,
  decodeEncryptionKey,
  encryptSecretValue,
} from "../_shared/control-plane.ts";

interface SecretWriteBody {
  companyId: string;
  name: string;
  value?: string;
  description?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createAdminClient();

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const companyId =
        url.searchParams.get("companyId") ??
        req.headers.get("x-company-id");
      if (!companyId) {
        return new Response(JSON.stringify({ error: "companyId is required" }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("company_secrets")
        .select("id, company_id, name, description, latest_version, created_at, updated_at")
        .eq("company_id", companyId)
        .order("name", { ascending: true });

      if (error) {
        throw new Error(`Failed to list secrets: ${error.message}`);
      }

      return new Response(JSON.stringify({ secrets: data ?? [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = (await req.json()) as SecretWriteBody;
      if (!body.companyId || !body.name || !body.value) {
        return new Response(
          JSON.stringify({ error: "companyId, name, and value are required" }),
          {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const encryptionKey = decodeEncryptionKey(
        Deno.env.get("CONTROL_PLANE_ENCRYPTION_KEY"),
      );
      const encrypted = await encryptSecretValue(body.value, encryptionKey);

      const { data, error } = await supabase.rpc("rotate_company_secret", {
        p_company_id: body.companyId,
        p_name: body.name.trim(),
        p_description: body.description?.trim() ?? "",
        p_algorithm: encrypted.algorithm,
        p_key_id: "control-plane-env",
        p_iv: encrypted.iv,
        p_auth_tag: encrypted.authTag,
        p_ciphertext: encrypted.ciphertext,
        p_value_sha256: encrypted.valueSha256,
      });

      if (error) {
        throw new Error(`Failed to rotate secret: ${error.message}`);
      }

      const row = Array.isArray(data) ? data[0] : data;
      return new Response(
        JSON.stringify({
          secretId: row?.secret_id ?? null,
          version: row?.version ?? null,
          secretRef: {
            kind: "secret_ref",
            secretName: body.name.trim(),
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (req.method === "DELETE") {
      const body = (await req.json()) as SecretWriteBody;
      if (!body.companyId || !body.name) {
        return new Response(
          JSON.stringify({ error: "companyId and name are required" }),
          {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { error } = await supabase
        .from("company_secrets")
        .delete()
        .eq("company_id", body.companyId)
        .eq("name", body.name.trim());

      if (error) {
        throw new Error(`Failed to delete secret: ${error.message}`);
      }

      return new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
