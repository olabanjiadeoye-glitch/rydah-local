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

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const url = required("SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Database request failed (${response.status}): ${text}`);
  }
  return response;
}

async function getSignedInUser(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) throw new Error("Authentication required");
  const url = required("SUPABASE_URL");
  const anonKey = required("SUPABASE_ANON_KEY");
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authHeader },
  });
  if (!response.ok) throw new Error("Authentication required");
  return await response.json() as { id: string; email?: string };
}

async function paystack(path: string, init: RequestInit = {}) {
  const secretKey = required("PAYSTACK_SECRET_KEY");
  const response = await fetch(`https://api.paystack.co/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status === false) {
    throw new Error(payload?.message || `Paystack request failed (${response.status})`);
  }
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await getSignedInUser(req);
    const body = await req.json() as { action?: string; job_id?: string; reference?: string; callback_url?: string };

    if (body.action === "initialize") {
      if (!body.job_id) return json({ error: "job_id is required" }, 400);

      const jobResponse = await supabaseRequest(
        `jobs?id=eq.${encodeURIComponent(body.job_id)}&select=id,customer_id,provider_id,status,quote_status,quoted_amount,payment_status,contact_email&limit=1`,
      );
      const jobs = await jobResponse.json() as Array<{
        id: string; customer_id: string | null; provider_id: string | null; status: string;
        quote_status: string; quoted_amount: number | null; payment_status: string; contact_email: string | null;
      }>;
      const job = jobs[0];
      if (!job || job.customer_id !== user.id) return json({ error: "Job not found" }, 404);
      if (job.status !== "completed") return json({ error: "Payment is available after the job is completed" }, 409);
      if (job.quote_status !== "accepted") return json({ error: "Accept the provider quote before payment" }, 409);
      if (job.payment_status === "paid" || job.payment_status === "cash_due") return json({ error: "This job is already paid" }, 409);
      if (!job.provider_id || !job.quoted_amount || job.quoted_amount <= 0) return json({ error: "This job has no valid payable quote" }, 409);

      const email = user.email || job.contact_email;
      if (!email) return json({ error: "A customer email is required for Paystack" }, 409);

      const reference = `RYD-${Date.now()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
      const callbackUrl = body.callback_url && /^https?:\/\//i.test(body.callback_url) ? body.callback_url : undefined;
      const secretKey = required("PAYSTACK_SECRET_KEY");
      const isTest = secretKey.startsWith("sk_test_");

      const [accountResponse, settingResponse] = await Promise.all([
        supabaseRequest(
          `provider_payout_accounts?provider_id=eq.${encodeURIComponent(job.provider_id)}&status=eq.verified&is_test=eq.${isTest ? "true" : "false"}&select=gateway_subaccount_code&limit=1`,
        ),
        supabaseRequest("platform_settings?key=eq.commission_rate_percent&select=value_numeric&limit=1"),
      ]);
      const payoutAccounts = await accountResponse.json() as Array<{ gateway_subaccount_code: string | null }>;
      const settings = await settingResponse.json() as Array<{ value_numeric: number | string }>;
      const subaccountCode = payoutAccounts[0]?.gateway_subaccount_code || null;
      const commissionRate = Number(settings[0]?.value_numeric ?? 15);

      if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate >= 100) {
        return json({ error: "Rydah commission configuration is invalid" }, 500);
      }

      // Fail closed in live mode. We never want a new real payment to silently fall back
      // to manual provider payout once automatic settlement is expected.
      if (!isTest && !subaccountCode) {
        return json({
          error: "Automatic provider settlement is not ready for this provider. The provider must connect and verify a live bank account before the customer can pay with Paystack.",
        }, 409);
      }

      const commissionNaira = Math.round(Number(job.quoted_amount) * commissionRate / 100);
      const settlementMode = subaccountCode ? "split" : "manual";

      const initializePayload: Record<string, unknown> = {
        email,
        amount: String(job.quoted_amount * 100),
        currency: "NGN",
        reference,
        channels: ["card", "bank", "bank_transfer", "ussd"],
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        metadata: JSON.stringify({
          job_id: job.id,
          customer_id: user.id,
          provider_id: job.provider_id,
          provider_settlement_mode: settlementMode,
          rydah_commission_rate_percent: commissionRate,
          rydah_commission_naira: commissionNaira,
        }),
      };

      if (subaccountCode) {
        // Paystack sends the remainder to the provider subaccount. transaction_charge
        // guarantees Rydah's gross commission is exactly the configured amount.
        // The main Rydah account bears Paystack's processing fee.
        initializePayload.subaccount = subaccountCode;
        initializePayload.transaction_charge = commissionNaira * 100;
        initializePayload.bearer = "account";
      }

      const initialized = await paystack("transaction/initialize", {
        method: "POST",
        body: JSON.stringify(initializePayload),
      });

      await supabaseRequest("payments", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          job_id: job.id,
          method: "paystack",
          reference,
          is_test: isTest,
          provider_settlement_mode: settlementMode,
          provider_subaccount_code: subaccountCode,
        }),
      });

      return json({
        authorization_url: initialized.data.authorization_url,
        access_code: initialized.data.access_code,
        reference,
        provider_settlement_mode: settlementMode,
        commission_rate_percent: commissionRate,
        commission_amount_naira: commissionNaira,
      });
    }

    if (body.action === "verify") {
      if (!body.reference) return json({ error: "reference is required" }, 400);

      const paymentResponse = await supabaseRequest(
        `payments?reference=eq.${encodeURIComponent(body.reference)}&customer_id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`,
      );
      const payments = await paymentResponse.json() as Array<Record<string, unknown>>;
      const payment = payments[0] as any;
      if (!payment) return json({ error: "Payment not found" }, 404);
      if (payment.status === "paid") return json({ ok: true, status: "paid", payment });

      const verified = await paystack(`transaction/verify/${encodeURIComponent(body.reference)}`);
      const data = verified.data;
      const expectedKobo = Number(payment.amount_naira) * 100;
      const isSuccess = data.status === "success" && data.reference === body.reference && Number(data.amount) === expectedKobo && data.currency === "NGN";

      if (!isSuccess) {
        if (["failed", "abandoned", "reversed"].includes(String(data.status))) {
          await supabaseRequest(`payments?reference=eq.${encodeURIComponent(body.reference)}`, {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ status: "failed", updated_at: new Date().toISOString() }),
          });
        }
        return json({ ok: false, status: data.status || "pending" }, 409);
      }

      const updateResponse = await supabaseRequest(`payments?reference=eq.${encodeURIComponent(body.reference)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: "paid",
          commission_status: "withheld",
          is_test: data.domain !== "live",
          gateway: "paystack",
          gateway_domain: data.domain ?? null,
          gateway_transaction_id: data.id ?? null,
          gateway_fee_naira: Math.round(Number(data.fees || 0) / 100),
          gateway_channel: data.channel ?? null,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      const updated = await updateResponse.json();
      return json({ ok: true, status: "paid", payment: updated[0] ?? null });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected payment error" }, 500);
  }
});
