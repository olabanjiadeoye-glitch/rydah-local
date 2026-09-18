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

async function providerForUser(userId: string) {
  const response = await supabaseRequest(
    `providers?user_id=eq.${encodeURIComponent(userId)}&select=id,business_name,service_category,location,is_verified&limit=1`,
  );
  const rows = await response.json();
  const provider = rows[0];
  if (!provider) throw new Error("Provider profile not found");
  if (!provider.is_verified) throw new Error("Provider verification is required before payout setup");
  return provider as { id: string; business_name: string; service_category: string; location: string; is_verified: boolean };
}

async function requireAdmin(userId: string) {
  const response = await supabaseRequest(`admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`);
  const rows = await response.json();
  if (!rows[0]) throw new Error("Admin access is required");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await getSignedInUser(req);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || "");

    if (action === "list_banks") {
      await providerForUser(user.id);
      const payload = await paystack("bank?country=nigeria&currency=NGN&perPage=100");
      const banks = ((payload.data || []) as Array<{ active?: boolean; code?: string | number; name?: string }>)
        .filter((bank) => bank.active !== false && bank.code)
        .map((bank) => ({ name: bank.name || "Bank", code: String(bank.code) }));
      return json({ banks });
    }

    if (action === "save_account") {
      const provider = await providerForUser(user.id);
      const bankCode = String(body.bank_code || "").trim();
      const accountNumber = String(body.account_number || "").replace(/\D/g, "");
      if (!bankCode) return json({ error: "Choose a bank" }, 400);
      if (accountNumber.length !== 10) return json({ error: "Enter a valid 10-digit Nigerian account number" }, 400);

      const secretKey = required("PAYSTACK_SECRET_KEY");
      const isTest = secretKey.startsWith("sk_test_");
      const splitSettingKey = isTest ? "paystack_test_split_enabled" : "paystack_split_enabled";
      const splitResponse = await supabaseRequest(
        `platform_settings?key=eq.${splitSettingKey}&select=value_numeric&limit=1`,
      );
      const splitRows = await splitResponse.json() as Array<{ value_numeric: number | string }>;
      if (Number(splitRows[0]?.value_numeric ?? 0) !== 1) {
        return json({
          error: isTest
            ? "Paystack test split settlement is currently disabled by Rydah."
            : "Live Paystack split settlement is not enabled yet.",
        }, 503);
      }

      const created = await paystack("subaccount", {
        method: "POST",
        body: JSON.stringify({
          business_name: provider.business_name,
          settlement_bank: bankCode,
          account_number: accountNumber,
          percentage_charge: 15,
          description: `Rydah provider settlement - ${provider.business_name}`,
          primary_contact_email: user.email || undefined,
          metadata: JSON.stringify({ rydah_provider_id: provider.id }),
        }),
      });
      const data = created.data || {};
      const subaccountCode = String(data.subaccount_code || "");
      if (!subaccountCode) throw new Error("Paystack did not return a subaccount code");

      const accountName = String(data.account_name || provider.business_name);
      const bankName = String(data.settlement_bank || "Paystack bank");

      const savedResponse = await supabaseRequest("provider_payout_accounts?on_conflict=provider_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          provider_id: provider.id,
          user_id: user.id,
          bank_name: bankName,
          account_name: accountName,
          account_last4: accountNumber.slice(-4),
          gateway_provider: "paystack",
          gateway_subaccount_code: subaccountCode,
          status: "verified",
          is_test: isTest,
          bank_code: bankCode,
          gateway_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      const saved = await savedResponse.json();
      return json({ ok: true, account: saved[0] || null, mode: isTest ? "test" : "live" });
    }

    if (action === "request_payout") {
      await providerForUser(user.id);
      const amount = Math.floor(Number(body.amount));
      if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Enter a valid payout amount" }, 400);
      const response = await supabaseRequest("rpc/create_live_payout_request", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ p_user_id: user.id, p_amount: amount }),
      });
      const payout = await response.json();
      return json({ ok: true, payout });
    }

    if (action === "admin_mark_paid" || action === "admin_reject") {
      await requireAdmin(user.id);
      const payoutId = String(body.payout_id || "");
      if (!payoutId) return json({ error: "payout_id is required" }, 400);
      const payoutResponse = await supabaseRequest(
        `payout_requests?id=eq.${encodeURIComponent(payoutId)}&select=*&limit=1`,
      );
      const payouts = await payoutResponse.json();
      const payout = payouts[0];
      if (!payout) return json({ error: "Payout request not found" }, 404);
      if (payout.status !== "pending") return json({ error: "This payout request is no longer pending" }, 409);

      if (action === "admin_mark_paid") {
        const reference = String(body.paid_reference || "").trim();
        if (reference.length < 6) return json({ error: "Enter the bank transfer/reference used to pay the provider" }, 400);
        await supabaseRequest(`payout_requests?id=eq.${encodeURIComponent(payoutId)}&status=eq.pending`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            status: "paid",
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
            admin_note: "Live provider payout confirmed by Rydah admin.",
            paid_reference: reference,
            updated_at: new Date().toISOString(),
          }),
        });
        return json({ ok: true, status: "paid" });
      }

      await supabaseRequest(`payout_requests?id=eq.${encodeURIComponent(payoutId)}&status=eq.pending`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          admin_note: String(body.admin_note || "Payout request rejected by Rydah admin."),
          updated_at: new Date().toISOString(),
        }),
      });
      return json({ ok: true, status: "rejected" });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected provider payout error" }, 500);
  }
});
