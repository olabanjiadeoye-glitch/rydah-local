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
    headers: { apikey: required("SUPABASE_ANON_KEY"), Authorization: authHeader },
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

async function paystackRaw(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.paystack.co/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${required("PAYSTACK_SECRET_KEY")}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function currentMode() {
  return required("PAYSTACK_SECRET_KEY").startsWith("sk_test_") ? "test" : "live";
}

async function requireProviderRole(userId: string) {
  const response = await supabaseRequest(
    `profiles?id=eq.${encodeURIComponent(userId)}&select=id,role&limit=1`,
  );
  const rows = await response.json() as Array<{ id: string; role: string }>;
  if (rows[0]?.role !== "provider") throw new Error("A provider account is required");
}

async function providerForUser(userId: string) {
  const response = await supabaseRequest(
    `providers?user_id=eq.${encodeURIComponent(userId)}&select=id,business_name,is_available&limit=1`,
  );
  const rows = await response.json() as Array<{ id: string; business_name: string; is_available: boolean }>;
  return rows[0] ?? null;
}

async function configForMode(mode: string) {
  const response = await supabaseRequest(
    `provider_billing_config?mode=eq.${encodeURIComponent(mode)}&select=*&limit=1`,
  );
  const rows = await response.json() as Array<Record<string, any>>;
  if (!rows[0]) throw new Error("Provider billing configuration is missing");
  return rows[0];
}

async function promoForUser(userId: string) {
  const response = await supabaseRequest(
    `provider_launch_promo_claims?user_id=eq.${encodeURIComponent(userId)}&select=id,market_key,slot_number,campaign_code,claimed_at,free_until,claim_state&limit=1`,
  );
  const rows = await response.json() as Array<Record<string, any>>;
  return rows[0] ?? null;
}

async function promoAvailability() {
  const [marketResponse, claimsResponse] = await Promise.all([
    supabaseRequest(
      "provider_launch_promo_markets?enabled=eq.true&select=market_key,city_name,region_name,slot_limit,sort_order&order=sort_order.asc",
    ),
    supabaseRequest("provider_launch_promo_claims?select=market_key"),
  ]);

  const markets = await marketResponse.json() as Array<Record<string, any>>;
  const claims = await claimsResponse.json() as Array<{ market_key: string }>;
  const counts = new Map<string, number>();

  for (const claim of claims) {
    counts.set(claim.market_key, (counts.get(claim.market_key) || 0) + 1);
  }

  return markets.map((market) => {
    const claimed = counts.get(String(market.market_key)) || 0;
    const limit = Number(market.slot_limit || 0);
    return {
      market_key: String(market.market_key),
      city_name: String(market.city_name),
      region_name: String(market.region_name),
      slot_limit: limit,
      claimed_count: claimed,
      remaining: Math.max(0, limit - claimed),
    };
  });
}

function promoIsActive(promo: Record<string, any> | null) {
  if (!promo?.free_until) return false;
  return new Date(String(promo.free_until)).getTime() > Date.now();
}

async function ensureBilling(userId: string) {
  const mode = currentMode();
  const provider = await providerForUser(userId);
  const config = await configForMode(mode);
  const response = await supabaseRequest("provider_billing?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: userId,
      provider_id: provider?.id ?? null,
      registration_fee_naira: Number(config.registration_fee_naira || 500),
      monthly_fee_naira: Number(config.monthly_fee_naira || 500),
      billing_mode: mode,
      updated_at: new Date().toISOString(),
    }),
  });
  const rows = await response.json() as Array<Record<string, any>>;
  const promo = await promoForUser(userId);
  return { billing: rows[0], provider, config, mode, promo };
}

async function updateBilling(userId: string, patch: Record<string, unknown>) {
  const response = await supabaseRequest(
    `provider_billing?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    },
  );
  const rows = await response.json();
  return rows[0] ?? null;
}

function safeStatus(
  billing: Record<string, any>,
  provider: Record<string, any> | null,
  mode: string,
  promo: Record<string, any> | null = null,
) {
  const promoActive = promoIsActive(promo);
  const freeUntil = promo?.free_until ? String(promo.free_until) : null;
  const daysRemaining = freeUntil && promoActive
    ? Math.max(1, Math.ceil((new Date(freeUntil).getTime() - Date.now()) / 86400000))
    : 0;
  const billingReady = ["paid", "waived"].includes(String(billing.registration_status))
    && (String(billing.subscription_status) === "active" || promoActive);

  return {
    mode,
    provider_id: provider?.id ?? billing.provider_id ?? null,
    registration_fee_naira: Number(billing.registration_fee_naira || 500),
    monthly_fee_naira: Number(billing.monthly_fee_naira || 500),
    registration_status: billing.registration_status,
    registration_paid_at: billing.registration_paid_at,
    mandate_status: billing.mandate_status,
    subscription_status: billing.subscription_status,
    subscription_started_at: billing.subscription_started_at,
    last_subscription_paid_at: billing.last_subscription_paid_at,
    next_payment_at: promoActive ? freeUntil : billing.next_payment_at,
    billing_ready: billingReady,
    promo_code: promo?.campaign_code ?? null,
    promo_market_key: promo?.market_key ?? null,
    promo_slot_number: promo?.slot_number ? Number(promo.slot_number) : null,
    promo_claimed_at: promo?.claimed_at ?? null,
    promo_free_until: freeUntil,
    promo_active: promoActive,
    promo_days_remaining: daysRemaining,
    subscription_due_now: Boolean(promo && !promoActive && String(billing.subscription_status) !== "active"),
  };
}

async function ensureLiveBillingAllowed(mode: string) {
  if (mode !== "live") return;
  const response = await supabaseRequest(
    "platform_settings?key=eq.payment_gateway_live_enabled&select=value_numeric&limit=1",
  );
  const rows = await response.json() as Array<{ value_numeric: number | string }>;
  if (Number(rows[0]?.value_numeric || 0) !== 1) {
    throw new Error("Live Paystack billing is not enabled yet. Rydah is still in payment test mode.");
  }
}

async function ensureMonthlyPlan(mode: string, config: Record<string, any>) {
  if (config.monthly_plan_code) return String(config.monthly_plan_code);
  const amountNaira = Number(config.monthly_fee_naira || 500);
  const created = await paystack("plan", {
    method: "POST",
    body: JSON.stringify({
      name: `Rydah Provider Monthly Subscription - ${mode === "test" ? "Test" : "Live"}`,
      amount: amountNaira * 100,
      interval: "monthly",
      currency: "NGN",
    }),
  });
  const planCode = String(created?.data?.plan_code || "");
  if (!planCode) throw new Error("Paystack did not return a monthly plan code");

  await supabaseRequest(
    `provider_billing_config?mode=eq.${encodeURIComponent(mode)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ monthly_plan_code: planCode, updated_at: new Date().toISOString() }),
    },
  );
  return planCode;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await getSignedInUser(req);
    await requireProviderRole(user.id);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || "status");
    const state = await ensureBilling(user.id);
    let { billing, provider, config, mode, promo } = state;

    if (action === "status") {
      const promo_markets = await promoAvailability();
      return json({ ok: true, billing: safeStatus(billing, provider, mode, promo), promo_markets });
    }

    if (action === "claim_promo") {
      if (promo) {
        const promo_markets = await promoAvailability();
        return json({
          ok: true,
          already_claimed: true,
          billing: safeStatus(billing, provider, mode, promo),
          promo_markets,
        });
      }

      const city = String(body.city || "").trim();
      if (!city) return json({ error: "Choose your main launch city before claiming a Founding 100 place." }, 400);

      const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
      const claimResponse = await fetch(
        `${required("SUPABASE_URL")}/rest/v1/rpc/claim_provider_launch_promo`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_user_id: user.id, p_city: city }),
        },
      );
      const claim = await claimResponse.json().catch(() => ({}));

      if (!claimResponse.ok) {
        return json({ error: claim?.message || "Unable to claim a Founding 100 place." }, 409);
      }
      if (claim?.claimed !== true) {
        const reason = String(claim?.reason || "");
        const error = reason === "market_full"
          ? `The Founding 100 allocation for ${city} is full. Normal provider registration and monthly billing now apply in this market.`
          : reason === "registration_payment_pending"
            ? "A registration payment is already pending. Finish or verify that payment before changing billing."
            : reason === "registration_already_paid"
              ? "Your registration fee is already paid, so a Founding 100 waiver cannot be applied retroactively."
              : "This launch market is not eligible for the Founding 100 promotion.";
        const promo_markets = await promoAvailability();
        return json({ ok: false, error, claim, promo_markets }, 409);
      }

      const refreshed = await ensureBilling(user.id);
      billing = refreshed.billing;
      provider = refreshed.provider;
      config = refreshed.config;
      mode = refreshed.mode;
      promo = refreshed.promo;
      const promo_markets = await promoAvailability();

      return json({
        ok: true,
        status: "promo_claimed",
        message: `Founding 100 place confirmed for ${claim.city_name}. Registration is free and your first 3 months are free.`,
        claim,
        billing: safeStatus(billing, provider, mode, promo),
        promo_markets,
      });
    }

    await ensureLiveBillingAllowed(mode);

    if (action === "initialize_registration") {
      if (["paid", "waived"].includes(String(billing.registration_status))) {
        return json({ ok: true, already_paid: true, billing: safeStatus(billing, provider, mode, promo) });
      }
      if (!user.email) return json({ error: "A verified provider email is required for Paystack billing" }, 409);

      const reference = `RYD-PREG-${Date.now()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
      const publicOrigin = (Deno.env.get("RYDAH_PUBLIC_ORIGIN") || "https://rydahlocal.online").replace(/\/+$/, "");
      const callbackUrl = new URL("/provider-onboarding?billing=registration", publicOrigin).toString();
      const amountNaira = Number(config.registration_fee_naira || 500);

      const initialized = await paystack("transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: user.email,
          amount: String(amountNaira * 100),
          currency: "NGN",
          reference,
          channels: ["card", "bank", "bank_transfer", "ussd"],
          callback_url: callbackUrl,
          metadata: JSON.stringify({
            rydah_purpose: "provider_registration",
            rydah_user_id: user.id,
            registration_fee_naira: amountNaira,
          }),
        }),
      });

      billing = await updateBilling(user.id, {
        registration_status: "pending",
        registration_reference: reference,
        registration_fee_naira: amountNaira,
        billing_mode: mode,
      });

      return json({
        ok: true,
        authorization_url: initialized.data.authorization_url,
        reference,
        billing: safeStatus(billing, provider, mode, promo),
      });
    }

    if (action === "verify_registration") {
      const reference = String(billing.registration_reference || "");
      if (!reference) return json({ error: "No registration payment is awaiting verification" }, 409);
      const verified = await paystack(`transaction/verify/${encodeURIComponent(reference)}`);
      const data = verified.data || {};
      const expectedKobo = Number(billing.registration_fee_naira || 500) * 100;
      const valid = data.status === "success"
        && String(data.reference) === reference
        && String(data.currency) === "NGN"
        && Number(data.amount) === expectedKobo;

      if (!valid) {
        if (["failed", "abandoned", "reversed"].includes(String(data.status))) {
          billing = await updateBilling(user.id, { registration_status: "failed" });
        }
        return json({ ok: false, status: data.status || "pending", billing: safeStatus(billing, provider, mode, promo) }, 409);
      }

      billing = await updateBilling(user.id, {
        registration_status: "paid",
        registration_paid_at: new Date().toISOString(),
      });
      return json({ ok: true, status: "paid", billing: safeStatus(billing, provider, mode, promo) });
    }

    if (action === "initialize_mandate") {
      if (promoIsActive(promo)) {
        return json({
          error: `Your Founding 100 free period is active until ${new Date(String(promo.free_until)).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos" })}. Monthly billing starts after the free period ends.`,
          billing: safeStatus(billing, provider, mode, promo),
        }, 409);
      }

      if (!["paid", "waived"].includes(String(billing.registration_status))) {
        return json({ error: `Pay the ₦${Number(config.registration_fee_naira || 500).toLocaleString()} provider registration fee before setting up monthly billing` }, 409);
      }
      if (!provider) return json({ error: "Create your provider profile before setting up the monthly subscription" }, 409);
      if (String(billing.subscription_status) === "active") {
        return json({ ok: true, already_active: true, billing: safeStatus(billing, provider, mode, promo) });
      }
      if (!user.email) return json({ error: "A verified provider email is required for Direct Debit" }, 409);

      const publicOrigin = (Deno.env.get("RYDAH_PUBLIC_ORIGIN") || "https://rydahlocal.online").replace(/\/+$/, "");
      const callbackUrl = new URL("/provider-onboarding?billing=mandate", publicOrigin).toString();

      let initialized;
      try {
        initialized = await paystack("customer/authorization/initialize", {
          method: "POST",
          body: JSON.stringify({
            email: user.email,
            channel: "direct_debit",
            callback_url: callbackUrl,
          }),
        });
      } catch (firstError) {
        initialized = await paystack("customer/authorization/initialize", {
          method: "POST",
          body: JSON.stringify({
            email: user.email,
            channel: "direct-debit",
            callback_url: callbackUrl,
          }),
        }).catch(() => { throw firstError; });
      }

      const reference = String(initialized?.data?.reference || "");
      const redirectUrl = String(initialized?.data?.redirect_url || "");
      if (!reference || !redirectUrl) throw new Error("Paystack did not return a Direct Debit mandate link");

      billing = await updateBilling(user.id, {
        provider_id: provider.id,
        mandate_status: "pending",
        mandate_reference: reference,
        subscription_status: "pending",
        billing_mode: mode,
      });

      return json({
        ok: true,
        redirect_url: redirectUrl,
        reference,
        billing: safeStatus(billing, provider, mode, promo),
      });
    }

    if (action === "verify_mandate") {
      if (!provider) return json({ error: "Provider profile not found" }, 409);
      const reference = String(billing.mandate_reference || "");
      if (!reference) return json({ error: "No Direct Debit mandate is awaiting verification" }, 409);

      const checked = await paystackRaw(`customer/authorization/verify/${encodeURIComponent(reference)}`);
      if (checked.response.status === 404) {
        return json({
          ok: false,
          status: "pending",
          message: "Direct Debit approval is still pending with the bank.",
          billing: safeStatus(billing, provider, mode, promo),
        }, 202);
      }
      if (!checked.response.ok || checked.payload?.status === false) {
        throw new Error(checked.payload?.message || `Paystack mandate verification failed (${checked.response.status})`);
      }

      const data = checked.payload.data || {};
      const channel = String(data.channel || "").replace("-", "_");
      if (!data.active || channel !== "direct_debit") {
        billing = await updateBilling(user.id, {
          mandate_status: data.active ? "failed" : "pending",
          subscription_status: "pending",
        });
        return json({
          ok: false,
          status: data.active ? "unsupported" : "pending",
          message: data.active
            ? "Rydah requires a Nigerian bank Direct Debit mandate for the monthly provider subscription."
            : "Direct Debit approval is still pending with the bank.",
          billing: safeStatus(billing, provider, mode, promo),
        }, data.active ? 409 : 202);
      }

      const authorizationCode = String(data.authorization_code || "");
      const customerCode = String(data.customer?.code || data.customer?.customer_code || "");
      if (!authorizationCode || !customerCode) throw new Error("Paystack did not return an active reusable Direct Debit authorization");

      const planCode = await ensureMonthlyPlan(mode, config);
      if (String(billing.paystack_subscription_code || "") && String(billing.subscription_status) === "active") {
        return json({ ok: true, already_active: true, billing: safeStatus(billing, provider, mode, promo) });
      }

      // Persist the verified bank mandate before creating the subscription so
      // any immediate Paystack subscription webhook can resolve this provider.
      billing = await updateBilling(user.id, {
        provider_id: provider.id,
        mandate_status: "active",
        paystack_customer_code: customerCode,
        subscription_status: "pending",
        billing_mode: mode,
      });

      const subscription = await paystack("subscription", {
        method: "POST",
        body: JSON.stringify({
          customer: customerCode,
          plan: planCode,
          authorization: authorizationCode,
        }),
      });

      const subscriptionData = subscription.data || {};
      const subscriptionCode = String(subscriptionData.subscription_code || "");
      if (!subscriptionCode) throw new Error("Paystack did not return a subscription code");

      billing = await updateBilling(user.id, {
        provider_id: provider.id,
        mandate_status: "active",
        paystack_customer_code: customerCode,
        paystack_subscription_code: subscriptionCode,
        paystack_subscription_email_token: subscriptionData.email_token || null,
        subscription_status: "active",
        subscription_started_at: new Date().toISOString(),
        next_payment_at: subscriptionData.next_payment_date || null,
        billing_mode: mode,
      });

      return json({
        ok: true,
        status: "active",
        message: `Direct Debit is active. Paystack will collect the ₦${Number(config.monthly_fee_naira || 500).toLocaleString()} Rydah provider subscription monthly.`,
        billing: safeStatus(billing, provider, mode, promo),
      });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected provider billing error" }, 500);
  }
});