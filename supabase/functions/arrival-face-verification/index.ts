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
  return await response.json() as { id: string; email?: string };
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

function youverifyConfig() {
  const token = Deno.env.get("YOUVERIFY_SECRET_TOKEN") || "";
  const environment = (Deno.env.get("YOUVERIFY_ENVIRONMENT") || "sandbox").toLowerCase();
  const baseUrl = Deno.env.get("YOUVERIFY_BASE_URL") || (environment === "live"
    ? "https://api.youverify.co"
    : "https://api.sandbox.youverify.co");
  return { token, environment, baseUrl };
}

function resolveYouverifyUrl(baseUrl: string, path: string) {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  if (cleanBase.endsWith("/v2/api") && path.startsWith("/v2/api/")) {
    return `${cleanBase}${path.slice("/v2/api".length)}`;
  }
  return `${cleanBase}${path}`;
}

async function youverifyGet(path: string, token: string, baseUrl: string) {
  const response = await fetch(resolveYouverifyUrl(baseUrl, path), {
    method: "GET",
    headers: { token },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Identity provider request failed (${response.status})`);
  }
  return payload;
}

async function youverifyPost(path: string, token: string, baseUrl: string, body: Record<string, unknown>) {
  const response = await fetch(resolveYouverifyUrl(baseUrl, path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Identity provider request failed (${response.status})`);
  }
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await getSignedInUser(req);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (String(body.action || "") !== "verify_arrival_face") {
      return json({ error: "Unsupported action" }, 400);
    }
    if (body.consent !== true) {
      return json({ error: "Consent is required before the provider camera face match" }, 400);
    }

    const jobId = String(body.job_id || "").trim();
    const faceImage = String(body.face_image || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: "Invalid job reference" }, 400);

    const isImageUrl = /^https:\/\//i.test(faceImage);
    const isImageData = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(faceImage);
    if (!isImageUrl && !isImageData) return json({ error: "Take a clear camera photo of the provider" }, 400);
    if (isImageData && faceImage.length > 8_000_000) return json({ error: "Camera image is too large. Please retake it." }, 413);

    const jobResponse = await supabaseRequest(
      `jobs?id=eq.${encodeURIComponent(jobId)}&select=id,customer_id,provider_id,status,quote_status,arrival_verified_at,arrival_face_verified_at,arrival_face_attempts&limit=1`,
    );
    const job = (await jobResponse.json())[0];
    if (!job) return json({ error: "Job not found" }, 404);
    if (job.customer_id !== user.id) return json({ error: "Only the customer for this job can run the arrival face match" }, 403);
    if (!job.provider_id) return json({ error: "No provider is assigned to this job" }, 409);
    if (job.status !== "accepted" || job.quote_status !== "accepted") {
      return json({ error: "Face matching is available after the provider accepts the job and the customer accepts the quote" }, 409);
    }
    if (!job.arrival_verified_at) {
      return json({ error: "Verify the one-time Arrival PIN first" }, 409);
    }
    if (job.arrival_face_verified_at) {
      return json({ ok: true, status: "verified", result_text: "Provider camera face match already completed." });
    }

    const providerResponse = await supabaseRequest(
      `providers?id=eq.${encodeURIComponent(job.provider_id)}&select=id,business_name,is_verified&limit=1`,
    );
    const provider = (await providerResponse.json())[0];
    if (!provider?.is_verified) return json({ error: "The assigned provider is not Rydah verified" }, 409);

    const verificationResponse = await supabaseRequest(
      `provider_verifications?provider_id=eq.${encodeURIComponent(job.provider_id)}&select=id,biometric_status,biometric_job_id&limit=1`,
    );
    const verification = (await verificationResponse.json())[0];
    if (!verification || verification.biometric_status !== "verified" || !verification.biometric_job_id) {
      return json({
        error: "This provider has not completed biometric Face & ID enrolment yet. Use the Arrival PIN for this job.",
        code: "provider_biometric_not_ready",
      }, 409);
    }

    const config = youverifyConfig();
    if (!config.token) return json({ error: "Rydah camera verification provider is not connected" }, 503);

    const identityPayload = await youverifyGet(
      `/v2/api/identity/${encodeURIComponent(String(verification.biometric_job_id))}`,
      config.token,
      config.baseUrl,
    );
    const identityData = identityPayload?.data || {};
    const referenceImage = String(
      identityData?.validations?.selfie?.selfieVerification?.image || identityData?.image || "",
    ).trim();
    if (!referenceImage) {
      return json({ error: "The provider's verified reference face is unavailable. Ask Rydah support to refresh the provider verification." }, 409);
    }

    const comparisonPayload = await youverifyPost(
      "/v2/api/identity/compare-image",
      config.token,
      config.baseUrl,
      {
        image1: referenceImage,
        image2: faceImage,
        isSubjectConsent: true,
      },
    );

    const comparison = comparisonPayload?.data?.imageComparison || {};
    const confidence = Number(comparison?.confidenceLevel ?? 0);
    const threshold = Number(comparison?.threshold ?? 0);
    const matched = comparison?.match === true && (!Number.isFinite(threshold) || threshold <= 0 || confidence >= threshold);
    const attempts = Number(job.arrival_face_attempts || 0) + 1;
    const now = new Date().toISOString();
    const resultText = matched
      ? `Camera face matched the verified provider${Number.isFinite(confidence) ? ` (${confidence}% confidence)` : ""}.`
      : `Camera face did not match the verified provider${Number.isFinite(confidence) ? ` (${confidence}% confidence)` : ""}.`;

    await supabaseRequest(`jobs?id=eq.${encodeURIComponent(job.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        arrival_face_attempts: attempts,
        arrival_face_provider: "youverify",
        arrival_face_confidence: Number.isFinite(confidence) ? confidence : null,
        arrival_face_result: resultText,
        arrival_face_checked_by: user.id,
        arrival_face_verified_at: matched ? now : null,
      }),
    });

    return json({
      ok: matched,
      status: matched ? "verified" : "failed",
      confidence: Number.isFinite(confidence) ? confidence : null,
      result_text: resultText,
      provider_name: provider.business_name,
    }, matched ? 200 : 422);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected arrival face verification error" }, 500);
  }
});