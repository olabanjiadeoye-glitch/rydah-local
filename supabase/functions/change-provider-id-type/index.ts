const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function getSignedInUser(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) throw new Error("Authentication required");

  const response = await fetch(`${required("SUPABASE_URL")}/auth/v1/user`, {
    headers: {
      apikey: required("SUPABASE_ANON_KEY"),
      Authorization: authHeader,
    },
  });
  if (!response.ok) throw new Error("Authentication required");
  return await response.json() as { id: string };
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${required("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Database request failed (${response.status}): ${await response.text()}`);
  return response;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await getSignedInUser(req);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const idType = String(body.id_type || "");
    const idLast4 = String(body.id_last4 || "").trim().toUpperCase();

    if (!['NIN', 'International Passport'].includes(idType)) {
      return json({ error: "Choose NIN or International Passport for automated face matching." }, 400);
    }
    if (!/^[A-Z0-9]{4}$/.test(idLast4)) {
      return json({ error: "Enter exactly the last 4 characters of the selected ID." }, 400);
    }

    const providerResponse = await supabaseRequest(
      `providers?user_id=eq.${encodeURIComponent(user.id)}&select=id,business_name&limit=1`,
    );
    const provider = (await providerResponse.json())[0];
    if (!provider) return json({ error: "Provider profile not found" }, 404);

    const verificationResponse = await supabaseRequest(
      `provider_verifications?provider_id=eq.${encodeURIComponent(provider.id)}&select=id&limit=1`,
    );
    const verification = (await verificationResponse.json())[0];
    if (!verification) return json({ error: "Verification record not found" }, 404);

    const now = new Date().toISOString();
    await supabaseRequest(`provider_verifications?id=eq.${encodeURIComponent(verification.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id_type: idType,
        id_last4: idLast4,
        biometric_status: "not_started",
        biometric_provider: null,
        biometric_job_id: null,
        biometric_result_code: null,
        biometric_result_text: null,
        biometric_consent_at: null,
        biometric_verified_at: null,
        biometric_updated_at: null,
        updated_at: now,
      }),
    });

    return json({
      ok: true,
      id_type: idType,
      id_last4: idLast4,
      message: `${idType} selected for Face & ID verification.`,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unable to change verification ID type" }, 500);
  }
});