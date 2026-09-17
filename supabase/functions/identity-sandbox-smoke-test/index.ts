const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SANDBOX_NIN = "11111111111";
const SANDBOX_FACE = "https://cdn.youverify.co/1655466566309-lLSfNTlhElMTtbXW-QE-q.jpg";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    await getSignedInUser(req);

    const environment = (Deno.env.get("YOUVERIFY_ENVIRONMENT") || "sandbox").toLowerCase();
    if (environment !== "sandbox") {
      return json({ error: "Sandbox smoke test is disabled outside sandbox mode." }, 409);
    }

    const token = required("YOUVERIFY_SECRET_TOKEN");
    const baseUrl = (Deno.env.get("YOUVERIFY_BASE_URL") || "https://api.sandbox.youverify.co").replace(/\/+$/, "");

    const response = await fetch(`${baseUrl}/v2/api/identity/ng/nin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify({
        id: SANDBOX_NIN,
        isSubjectConsent: true,
        validations: {
          selfie: {
            image: SANDBOX_FACE,
          },
        },
        metadata: {
          source: "rydah-local-sandbox-smoke-test",
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      return json({
        ok: false,
        error: payload?.message || payload?.error || `Youverify sandbox request failed (${response.status})`,
        status_code: response.status,
      }, response.status || 502);
    }

    const data = payload?.data || {};
    const selfieVerification = data?.validations?.selfie?.selfieVerification || {};
    const providerStatus = String(data?.status || "unknown");
    const match = selfieVerification?.match === true;
    const confidence = Number(selfieVerification?.confidenceLevel ?? 0);
    const validationMessage = String(data?.validations?.validationMessages || data?.reason || "").trim();

    return json({
      ok: true,
      environment: "sandbox",
      provider_status: providerStatus,
      face_match: match,
      confidence: Number.isFinite(confidence) ? confidence : null,
      message: validationMessage || (match ? "Sandbox face matched." : "Sandbox request completed; sample face did not match."),
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected sandbox verification error" }, 500);
  }
});
