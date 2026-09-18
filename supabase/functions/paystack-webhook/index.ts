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

type PaymentRow = {
  id: string;
  job_id: string;
  amount_naira: number;
  status: string;
  reference: string;
  refund_status: string;
};

async function paymentForReference(reference: string) {
  const response = await supabaseRequest(
    `payments?reference=eq.${encodeURIComponent(reference)}&select=id,job_id,amount_naira,status,reference,refund_status&limit=1`,
  );
  const rows = await response.json() as PaymentRow[];
  return rows[0] ?? null;
}

async function updateDisputesForRefund(
  paymentId: string,
  status: "refund_pending" | "refunded" | "in_review",
  resolutionMessage: string,
) {
  await supabaseRequest(
    `payment_disputes?payment_id=eq.${encodeURIComponent(paymentId)}&status=in.(open,in_review,refund_pending)`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status,
        resolution_message: resolutionMessage,
        updated_at: new Date().toISOString(),
      }),
    },
  );
}

async function handleRefundEvent(eventName: string, data: Record<string, unknown>) {
  const nestedTransaction = (data.transaction && typeof data.transaction === "object")
    ? data.transaction as Record<string, unknown>
    : null;
  const reference = String(
    data.transaction_reference
      || nestedTransaction?.reference
      || data.reference
      || "",
  );
  if (!reference) return;

  const payment = await paymentForReference(reference);
  if (!payment) return;

  const amountKobo = Number(data.amount || 0);
  if (amountKobo > 0 && amountKobo !== Number(payment.amount_naira) * 100) {
    // Rydah's automated workflow currently supports full refunds only.
    return;
  }

  const now = new Date().toISOString();
  const refundGatewayId = data.refund_reference || data.id || null;
  const baseUpdate: Record<string, unknown> = {
    refund_amount_naira: Number(payment.amount_naira),
    refund_gateway_id: refundGatewayId ? String(refundGatewayId) : null,
    updated_at: now,
  };

  if (eventName === "refund.processed") {
    await supabaseRequest(`payments?id=eq.${encodeURIComponent(payment.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        ...baseUpdate,
        status: "refunded",
        commission_status: "refunded",
        refund_status: "processed",
        refunded_at: now,
      }),
    });

    await supabaseRequest(`jobs?id=eq.${encodeURIComponent(payment.job_id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ payment_status: "refunded", updated_at: now }),
    });

    await updateDisputesForRefund(
      payment.id,
      "refunded",
      "Your full refund has been processed by Paystack.",
    );
    return;
  }

  if (eventName === "refund.failed") {
    await supabaseRequest(`payments?id=eq.${encodeURIComponent(payment.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        ...baseUpdate,
        refund_status: "failed",
      }),
    });

    await updateDisputesForRefund(
      payment.id,
      "in_review",
      "The automatic refund did not complete. Rydah is reviewing the next step.",
    );
    return;
  }

  if (eventName === "refund.needs-attention") {
    await supabaseRequest(`payments?id=eq.${encodeURIComponent(payment.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        ...baseUpdate,
        refund_status: "needs_attention",
      }),
    });

    await updateDisputesForRefund(
      payment.id,
      "in_review",
      "Paystack needs additional information before this refund can continue. Rydah is reviewing it.",
    );
    return;
  }

  if (eventName === "refund.pending" || eventName === "refund.processing") {
    await supabaseRequest(`payments?id=eq.${encodeURIComponent(payment.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        ...baseUpdate,
        refund_status: "pending",
        refund_requested_at: now,
      }),
    });

    await updateDisputesForRefund(
      payment.id,
      "refund_pending",
      "Rydah approved your full refund and Paystack is processing it.",
    );
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const rawBody = await req.text();
    const suppliedSignature = (req.headers.get("x-paystack-signature") || "").toLowerCase();
    const expectedSignature = await hmacHex(required("PAYSTACK_SECRET_KEY"), rawBody);
    if (!suppliedSignature || suppliedSignature !== expectedSignature) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody) as { event?: string; data?: Record<string, unknown> };
    const eventName = String(event?.event || "");
    const eventData = event?.data ?? {};

    if (
      eventName === "refund.pending"
      || eventName === "refund.processing"
      || eventName === "refund.processed"
      || eventName === "refund.failed"
      || eventName === "refund.needs-attention"
    ) {
      await handleRefundEvent(eventName, eventData);
      return new Response("ok", { status: 200 });
    }

    if (eventName !== "charge.success") return new Response("ok", { status: 200 });

    const reference = String(eventData.reference || "");
    if (!reference) return new Response("ok", { status: 200 });

    const paymentResponse = await supabaseRequest(
      `payments?reference=eq.${encodeURIComponent(reference)}&select=*&limit=1`,
    );
    const payments = await paymentResponse.json() as Array<Record<string, unknown>>;
    const payment = payments[0] as Record<string, unknown> | undefined;
    if (!payment || payment.status === "paid") return new Response("ok", { status: 200 });

    const data = await verifyPaystack(reference);
    const valid = data.status === "success"
      && data.reference === reference
      && data.currency === "NGN"
      && Number(data.amount) === Number(payment.amount_naira) * 100;
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
