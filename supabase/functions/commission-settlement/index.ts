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

async function paystack(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.paystack.co/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${required("PAYSTACK_SECRET_KEY")}`,
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

function idsFilter(ids: string[]) {
  return ids.map((id) => `"${id.replaceAll('"', '')}"`).join(",");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await getSignedInUser(req);
    const body = await req.json().catch(() => ({})) as { action?: string; reference?: string };
    const secretKey = required("PAYSTACK_SECRET_KEY");
    const isTest = secretKey.startsWith("sk_test_");

    const providerResponse = await supabaseRequest(
      `providers?user_id=eq.${encodeURIComponent(user.id)}&select=id,business_name&limit=1`,
    );
    const provider = (await providerResponse.json())[0] as { id: string; business_name: string } | undefined;
    if (!provider) return json({ error: "Provider profile not found" }, 404);

    if (body.action === "initialize") {
      const checkoutSettingKey = isTest ? "paystack_test_checkout_enabled" : "payment_gateway_live_enabled";
      const modeResponse = await supabaseRequest(
        `platform_settings?key=eq.${checkoutSettingKey}&select=value_numeric&limit=1`,
      );
      const modeRows = await modeResponse.json() as Array<{ value_numeric: number | string }>;
      if (Number(modeRows[0]?.value_numeric ?? 0) !== 1) {
        return json({
          error: isTest
            ? "Paystack test checkout is currently disabled by Rydah."
            : "Live Paystack checkout is not enabled yet.",
        }, 503);
      }

      if (!user.email) return json({ error: "Your provider account needs an email address before commission can be settled." }, 409);

      const pendingResponse = await supabaseRequest(
        `commission_settlements?provider_id=eq.${encodeURIComponent(provider.id)}&status=eq.pending&is_test=eq.${isTest ? "true" : "false"}&select=id,reference,created_at&order=created_at.desc&limit=1`,
      );
      const pending = (await pendingResponse.json())[0] as { id: string; reference: string; created_at: string } | undefined;
      if (pending && Date.now() - new Date(pending.created_at).getTime() < 30 * 60 * 1000) {
        return json({ error: "A commission settlement was already started recently. Finish or verify that payment before starting another." }, 409);
      }

      const owedResponse = await supabaseRequest(
        `payments?provider_id=eq.${encodeURIComponent(provider.id)}&status=eq.cash_due&commission_status=eq.owed_by_provider&is_test=eq.${isTest ? "true" : "false"}&select=id,commission_amount_naira&order=created_at.asc`,
      );
      const owed = await owedResponse.json() as Array<{ id: string; commission_amount_naira: number }>;
      const amount = owed.reduce((sum, payment) => sum + Number(payment.commission_amount_naira || 0), 0);
      if (amount <= 0 || owed.length === 0) {
        return json({ error: isTest ? "No test cash commission is outstanding." : "No live cash commission is outstanding." }, 409);
      }

      const reference = `RYD-COM-${Date.now()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
      const publicOrigin = (Deno.env.get("RYDAH_PUBLIC_ORIGIN") || "https://rydahlocal.online").replace(/\/+$/, "");
      let callbackUrl: string;
      try {
        callbackUrl = new URL("/earnings", publicOrigin).toString();
      } catch {
        return json({ error: "Rydah public origin configuration is invalid" }, 500);
      }
      const paymentIds = owed.map((payment) => payment.id);

      const initialized = await paystack("transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: user.email,
          amount: String(amount * 100),
          currency: "NGN",
          reference,
          channels: ["card", "bank", "bank_transfer", "ussd"],
          callback_url: callbackUrl,
          metadata: JSON.stringify({
            purpose: "rydah_provider_cash_commission_settlement",
            provider_id: provider.id,
            provider_name: provider.business_name,
            payment_ids: paymentIds,
          }),
        }),
      });

      await supabaseRequest("commission_settlements", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          provider_id: provider.id,
          user_id: user.id,
          amount_naira: amount,
          payment_ids: paymentIds,
          reference,
          status: "pending",
          is_test: isTest,
          gateway: "paystack",
        }),
      });

      return json({
        authorization_url: initialized.data.authorization_url,
        reference,
        amount_naira: amount,
        is_test: isTest,
      });
    }

    if (body.action === "verify") {
      if (!body.reference) return json({ error: "reference is required" }, 400);

      const settlementResponse = await supabaseRequest(
        `commission_settlements?reference=eq.${encodeURIComponent(body.reference)}&user_id=eq.${encodeURIComponent(user.id)}&provider_id=eq.${encodeURIComponent(provider.id)}&select=*&limit=1`,
      );
      const settlement = (await settlementResponse.json())[0] as any;
      if (!settlement) return json({ error: "Commission settlement not found" }, 404);
      if (settlement.status === "paid") return json({ ok: true, status: "paid", settlement });

      const verified = await paystack(`transaction/verify/${encodeURIComponent(body.reference)}`);
      const data = verified.data;
      const expectedKobo = Number(settlement.amount_naira) * 100;
      const success = data.status === "success" && data.reference === body.reference && Number(data.amount) === expectedKobo && data.currency === "NGN";

      if (!success) {
        if (["failed", "abandoned", "reversed"].includes(String(data.status))) {
          await supabaseRequest(`commission_settlements?reference=eq.${encodeURIComponent(body.reference)}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ status: "failed", updated_at: new Date().toISOString() }),
          });
        }
        return json({ ok: false, status: data.status || "pending" }, 409);
      }

      const paymentIds = Array.isArray(settlement.payment_ids)
        ? settlement.payment_ids.filter((value: unknown) => typeof value === "string") as string[]
        : [];
      if (paymentIds.length === 0) return json({ error: "Settlement has no commission items to apply." }, 500);

      await supabaseRequest(
        `payments?id=in.(${idsFilter(paymentIds)})&provider_id=eq.${encodeURIComponent(provider.id)}&commission_status=eq.owed_by_provider&is_test=eq.${settlement.is_test ? "true" : "false"}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ commission_status: "settled_by_provider", updated_at: new Date().toISOString() }),
        },
      );

      const now = new Date().toISOString();
      await supabaseRequest(`commission_settlements?reference=eq.${encodeURIComponent(body.reference)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "paid",
          is_test: data.domain !== "live",
          gateway_domain: data.domain ?? null,
          gateway_transaction_id: data.id ?? null,
          gateway_fee_naira: Math.round(Number(data.fees || 0) / 100),
          gateway_channel: data.channel ?? null,
          verified_at: now,
          updated_at: now,
        }),
      });

      await supabaseRequest("notifications", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          user_id: user.id,
          title: "Rydah commission settled",
          body: `Your cash-job commission payment of ₦${Number(settlement.amount_naira).toLocaleString("en-NG")} was confirmed.`,
          kind: "payment",
          link: "/earnings",
        }),
      });

      return json({ ok: true, status: "paid", amount_naira: settlement.amount_naira, reference: body.reference });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected commission settlement error" }, 500);
  }
});
