function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
  if (!response.ok) throw new Error(`Database request failed (${response.status}): ${await response.text()}`);
  return response;
}

async function verifyPaystack(reference: string) {
  const secret = required("PAYSTACK_SECRET_KEY");
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status === false) throw new Error(payload?.message || "Paystack verification failed");
  return payload.data;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const rawBody = await req.text();
    const suppliedSignature = (req.headers.get("x-paystack-signature") || "").toLowerCase();
    const expectedSignature = await hmacHex(required("PAYSTACK_SECRET_KEY"), rawBody);
    if (!suppliedSignature || suppliedSignature !== expectedSignature) return new Response("Invalid signature", { status: 401 });

    const event = JSON.parse(rawBody);
    if (event?.event !== "charge.success") return new Response("ok", { status: 200 });

    const reference = String(event?.data?.reference || "");
    if (!reference) return new Response("ok", { status: 200 });

    const paymentResponse = await supabaseRequest(`payments?reference=eq.${encodeURIComponent(reference)}&select=*&limit=1`);
    const payments = await paymentResponse.json() as Array<Record<string, unknown>>;
    const payment = payments[0] as any;
    if (!payment || payment.status === "paid") return new Response("ok", { status: 200 });

    const data = await verifyPaystack(reference);
    const valid = data.status === "success" && data.reference === reference && data.currency === "NGN" && Number(data.amount) === Number(payment.amount_naira) * 100;
    if (!valid) return new Response("ok", { status: 200 });

    await supabaseRequest(`payments?reference=eq.${encodeURIComponent(reference)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
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

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Webhook error", { status: 500 });
  }
});
