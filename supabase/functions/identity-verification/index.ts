const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const YOUVERIFY_SANDBOX_SAMPLE_IMAGE =
  "https://cdn.youverify.co/1655466566309-lLSfNTlhElMTtbXW-QE-q.jpg";

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

async function providerAndVerificationForUser(userId: string) {
  const providerResponse = await supabaseRequest(
    `providers?user_id=eq.${encodeURIComponent(userId)}&select=id,business_name,is_verified&limit=1`,
  );
  const providers = await providerResponse.json();
  const provider = providers[0];
  if (!provider) throw new Error("Provider profile not found");

  const verificationResponse = await supabaseRequest(
    `provider_verifications?provider_id=eq.${encodeURIComponent(provider.id)}&select=*&limit=1`,
  );
  const verifications = await verificationResponse.json();
  const verification = verifications[0];
  if (!verification) throw new Error("Submit your provider identity details before face verification");

  return { provider, verification };
}

function youverifyConfig() {
  const token = Deno.env.get("YOUVERIFY_SECRET_TOKEN") || "";
  const publicMerchantID = Deno.env.get("YOUVERIFY_PUBLIC_MERCHANT_ID") || "";
  const environment = (Deno.env.get("YOUVERIFY_ENVIRONMENT") || "sandbox").toLowerCase();
  const baseUrl = Deno.env.get("YOUVERIFY_BASE_URL") || (environment === "live"
    ? "https://api.youverify.co"
    : "https://api.sandbox.youverify.co");
  return { token, publicMerchantID, environment, baseUrl };
}

function resolveYouverifyUrl(baseUrl: string, path: string) {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  if (cleanBase.endsWith("/v2/api") && path.startsWith("/v2/api/")) {
    return `${cleanBase}${path.slice("/v2/api".length)}`;
  }
  return `${cleanBase}${path}`;
}

async function youverify(path: string, token: string, baseUrl: string, body: Record<string, unknown>) {
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

async function youverifyGet(path: string, token: string, baseUrl: string) {
  const response = await fetch(resolveYouverifyUrl(baseUrl, path), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      token,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = String(payload?.message || payload?.error || "");
    if (response.status === 403 && providerMessage.toLowerCase().includes("permission denied")) {
      throw new Error("Youverify API key does not have permission to read liveness history. Update the sandbox API key permissions, then try Check Latest Verification Result again.");
    }
    throw new Error(providerMessage || `Identity provider request failed (${response.status})`);
  }
  return payload;
}

async function generateLivenessSession(config: ReturnType<typeof youverifyConfig>, providerId: string, userId: string) {
  let sessionPayload: any;
  try {
    sessionPayload = await youverify(
      "/v2/api/identity/sdk/session/generate",
      config.token,
      config.baseUrl,
      {
        publicMerchantID: config.publicMerchantID,
        ttlSeconds: 300,
        metadata: { source: "rydah-local", providerId, userId },
      },
    );
  } catch {
    sessionPayload = await youverify(
      "/v2/api/identity/sdk/liveness/session/generate",
      config.token,
      config.baseUrl,
      {
        ttlSeconds: 300,
        metadata: { source: "rydah-local", providerId, userId },
      },
    );
  }

  const sessionId = String(sessionPayload?.data?.sessionId || sessionPayload?.sessionId || "");
  if (!sessionId) throw new Error("Identity provider did not return a liveness session ID");

  const deviceCorrelationId = crypto.randomUUID();
  const tokenPayload = await youverify(
    "/v2/api/identity/sdk/liveness/token",
    config.token,
    config.baseUrl,
    {
      publicMerchantID: config.publicMerchantID,
      deviceCorrelationId,
    },
  );
  const sessionToken = String(tokenPayload?.data?.authToken || tokenPayload?.authToken || "");
  if (!sessionToken) throw new Error("Identity provider did not return a liveness session token");

  return { sessionId, sessionToken };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await getSignedInUser(req);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    let action = String(body.action || "");
    const { provider, verification } = await providerAndVerificationForUser(user.id);
    const config = youverifyConfig();

    if (action === "status") {
      return json({
        ok: true,
        configured: Boolean(config.token),
        liveness_configured: Boolean(config.token && config.publicMerchantID),
        public_merchant_id_configured: Boolean(config.publicMerchantID),
        environment: config.environment,
        biometric_status: verification.biometric_status || "not_started",
        biometric_provider: verification.biometric_provider || null,
        biometric_result_text: verification.biometric_result_text || null,
        biometric_verified_at: verification.biometric_verified_at || null,
      });
    }

    if (action === "liveness_session") {
      if (!config.token || !config.publicMerchantID) {
        return json({
          error: "Live face verification needs the Youverify public merchant ID configured on the Rydah backend.",
          setup_required: true,
          required_secret: "YOUVERIFY_PUBLIC_MERCHANT_ID",
        }, 503);
      }

      const { sessionId, sessionToken } = await generateLivenessSession(config, provider.id, user.id);
      const startedAt = new Date().toISOString();
      await supabaseRequest(`provider_verifications?id=eq.${encodeURIComponent(verification.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          biometric_status: "pending",
          biometric_provider: "youverify",
          biometric_liveness_session_id: sessionId,
          biometric_liveness_verified_at: null,
          biometric_liveness_result: "pending",
          biometric_result_code: "liveness_pending",
          biometric_result_text: "Live camera verification started.",
          biometric_updated_at: startedAt,
          updated_at: startedAt,
        }),
      });
      return json({
        ok: true,
        environment: config.environment,
        session_id: sessionId,
        session_token: sessionToken,
      });
    }

    if (action === "complete_live_verification") {
      if (body.consent !== true) return json({ error: "Consent is required before live face verification" }, 400);
      if (!config.token) return json({ error: "Rydah face verification provider is not connected yet." }, 503);

      const livenessSessionId = String(body.session_id || verification.biometric_liveness_session_id || "").trim();
      if (!livenessSessionId) return json({ error: "Liveness session is missing. Start the live camera check again." }, 400);

      const history = await youverifyGet(
        `/v2/api/identity/liveness?sessionId=${encodeURIComponent(livenessSessionId)}&limit=10`,
        config.token,
        config.baseUrl,
      );
      const docs = Array.isArray(history?.data?.docs) ? history.data.docs : [];
      const liveResult = docs.find((item: any) =>
        String(item?.sessionId || "") === livenessSessionId && item?.passed === true
      );

      if (!liveResult) {
        const sessionResults = docs.filter((item: any) => String(item?.sessionId || "") === livenessSessionId);
        const explicitFailure = sessionResults.some((item: any) => item?.passed === false);
        const checkedAt = new Date().toISOString();

        await supabaseRequest(`provider_verifications?id=eq.${encodeURIComponent(verification.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            biometric_status: explicitFailure ? "failed" : "pending",
            biometric_result_code: explicitFailure ? "liveness_failed" : "liveness_processing",
            biometric_result_text: explicitFailure
              ? "Live face check did not pass. Please retry using the camera."
              : "Live face result is still being finalized. Please check again in a moment.",
            biometric_liveness_session_id: livenessSessionId,
            biometric_liveness_verified_at: null,
            biometric_liveness_result: explicitFailure ? "failed" : "processing",
            biometric_updated_at: checkedAt,
            updated_at: checkedAt,
          }),
        });

        return json(
          { error: explicitFailure
              ? "Live face check did not pass. Please retry using the camera."
              : "Live face result is still being finalized. Please check again in a moment." },
          explicitFailure ? 422 : 409,
        );
      }

      const liveFaceImage = String(liveResult?.faceImage || "").trim();
      if (!/^https:\/\//i.test(liveFaceImage)) {
        return json({ error: "The liveness provider did not return a trusted live face image." }, 502);
      }

      body.selfie = liveFaceImage;
      body.liveness_verified = true;
      body.liveness_session_id = livenessSessionId;
      body.use_sandbox_sample = false;
      action = "verify_face_id";
    }

    if (action === "verify_face_id") {
      if (body.consent !== true) return json({ error: "Consent is required before face and ID verification" }, 400);
      if (config.environment === "live" && body.liveness_verified !== true) {
        return json({ error: "A passed live camera and liveness check is required before identity matching." }, 409);
      }
      if (!config.token) {
        return json({
          error: "Rydah face verification provider is not connected yet.",
          setup_required: true,
          required_secret: "YOUVERIFY_SECRET_TOKEN",
        }, 503);
      }

      const idNumber = String(body.id_number || "").replace(/\s+/g, "").trim();
      const useSandboxSample = body.use_sandbox_sample === true;
      let selfie = String(body.selfie_url || body.selfie || "").trim();

      if (idNumber.length < 5) return json({ error: "Enter the full ID number for this verification only" }, 400);

      const isSandboxTestNin = config.environment === "sandbox" && idNumber === "11111111111" && body.liveness_verified !== true;
      if (useSandboxSample || isSandboxTestNin) {
        if (config.environment !== "sandbox") {
          return json({ error: "The built-in test image is available only while Youverify is in sandbox mode" }, 400);
        }
        selfie = YOUVERIFY_SANDBOX_SAMPLE_IMAGE;
      }

      const isImageUrl = /^https:\/\//i.test(selfie);
      const isImageData = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(selfie);
      if (!isImageUrl && !isImageData) {
        return json({ error: "Take or upload a clear selfie image" }, 400);
      }
      if (isImageData && selfie.length > 8_000_000) {
        return json({ error: "Selfie image is too large. Please use a smaller image." }, 413);
      }

      const idType = String(verification.id_type || "");
      let endpoint = "";
      let resultCodePrefix = "";
      const requestBody: Record<string, unknown> = {
        id: idNumber,
        isSubjectConsent: true,
        validations: {
          selfie: {
            image: selfie,
          },
        },
        metadata: {
          source: "rydah-local",
          providerId: provider.id,
        },
      };

      if (idType === "NIN") {
        endpoint = "/v2/api/identity/ng/nin";
        resultCodePrefix = "nin_facial";
      } else if (idType === "International Passport") {
        endpoint = "/v2/api/identity/ng/passport";
        resultCodePrefix = "passport_facial";
        const nameParts = String(verification.legal_name || "").trim().split(/\s+/).filter(Boolean);
        const lastName = nameParts.at(-1) || "";
        if (lastName) requestBody.lastName = lastName;
      } else {
        return json({
          error: "Automatic face-to-ID matching currently requires NIN or International Passport. Change the selected ID type and resubmit your identity details.",
        }, 409);
      }

      const now = new Date().toISOString();
      await supabaseRequest(`provider_verifications?id=eq.${encodeURIComponent(verification.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          biometric_status: "pending",
          biometric_provider: "youverify",
          biometric_consent_at: now,
          biometric_liveness_session_id: body.liveness_verified === true ? String(body.liveness_session_id || "") : verification.biometric_liveness_session_id || null,
          biometric_liveness_verified_at: body.liveness_verified === true ? now : verification.biometric_liveness_verified_at || null,
          biometric_liveness_result: body.liveness_verified === true ? "passed" : verification.biometric_liveness_result || null,
          biometric_updated_at: now,
          updated_at: now,
          id_last4: idNumber.slice(-4).toUpperCase(),
        }),
      });

      let payload: any;
      try {
        payload = await youverify(endpoint, config.token, config.baseUrl, requestBody);
      } catch (error) {
        const failedAt = new Date().toISOString();
        await supabaseRequest(`provider_verifications?id=eq.${encodeURIComponent(verification.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            biometric_status: "failed",
            biometric_result_code: "provider_error",
            biometric_result_text: error instanceof Error ? error.message : "Identity provider error",
            biometric_updated_at: failedAt,
            updated_at: failedAt,
          }),
        });
        throw error;
      }

      const data = payload?.data || {};
      const providerStatus = String(data?.status || "").toLowerCase();
      const selfieVerification = data?.validations?.selfie?.selfieVerification || {};
      const faceMatched = providerStatus === "found" && selfieVerification?.match === true;
      const confidence = Number(selfieVerification?.confidenceLevel ?? 0);
      const validationMessage = String(data?.validations?.validationMessages || "").trim();

      if (providerStatus === "pending") {
        const pendingAt = new Date().toISOString();
        const pendingReason = String(data?.reason || validationMessage || "Youverify verification is pending.").slice(0, 500);
        await supabaseRequest(`provider_verifications?id=eq.${encodeURIComponent(verification.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            biometric_status: "pending",
            biometric_provider: "youverify",
            biometric_job_id: data?.id ? String(data.id) : null,
            biometric_result_code: `${resultCodePrefix}:pending`,
            biometric_result_text: pendingReason,
            biometric_updated_at: pendingAt,
            updated_at: pendingAt,
          }),
        });
        return json({
          ok: true,
          status: "pending",
          result_text: pendingReason,
          provider_id: provider.id,
          sandbox_sample_used: useSandboxSample || isSandboxTestNin,
        }, 202);
      }

      const reason = faceMatched
        ? `Face matched the ${idType} record${Number.isFinite(confidence) ? ` (${confidence}% confidence)` : ""}.`
        : String(data?.reason || validationMessage || `Face match failed${Number.isFinite(confidence) ? ` (${confidence}% confidence)` : ""}.`);

      const completedAt = new Date().toISOString();
      await supabaseRequest(`provider_verifications?id=eq.${encodeURIComponent(verification.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          biometric_status: faceMatched ? "verified" : "failed",
          biometric_provider: "youverify",
          biometric_job_id: data?.id ? String(data.id) : null,
          biometric_result_code: `${resultCodePrefix}:${providerStatus || "unknown"}`,
          biometric_result_text: reason.slice(0, 500),
          biometric_verified_at: faceMatched ? completedAt : null,
          biometric_updated_at: completedAt,
          updated_at: completedAt,
        }),
      });

      return json({
        ok: faceMatched,
        status: faceMatched ? "verified" : "failed",
        result_text: reason.slice(0, 500),
        provider_id: provider.id,
        sandbox_sample_used: useSandboxSample || isSandboxTestNin,
      }, faceMatched ? 200 : 422);
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected identity verification error" }, 500);
  }
});