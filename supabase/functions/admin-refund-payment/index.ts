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

async function serviceRequest(path: string, init: RequestInit = {}) {
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

  if (!response.ok) {
    throw new Error(`Database request failed (${response.status}): ${await response.text()}`);
  }
  return response;
}

async function requireAdmin(userId: string) {
  const response = await serviceRequest(
    `admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`,
  );
  const rows = await response.json() as Array<{ user_id: string }>;
  if (!rows[0]) throw new Error("Admin access is required");
}

async function settingEnabled(key: string) {
  const response = await serviceRequest(
    `platform_settings?key=eq.${encodeURIComponent(key)}&select=value_numeric&limit=1`,
  );
  const rows = await response.json() as Array<{ value_numeric: number | string }>;
  return Number(rows[0]?.value_numeric ?? 0) === 1;
}

function normaliseRefundStatus(status: string) {
  if (status === "processed") return "processed";
  if (status === "failed") return "failed";
  if (status === "needs-attention") return "needs_attention";
  return "pending";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = await getSignedInUser(req);
    await requireAdmin(admin.id);

    const body = await req.json().catch(() => ({})) as { dispute_id?: string };
    const disputeId = String(body.dispute_id || "").trim();

    if (!/^[0-9a-f-]{36}$/i.test(disputeId)) {
      return json({ error: "A valid dispute is required" }, 400);
    }

    const disputeResponse = await serviceRequest(
      `payment_disputes?id=eq.${encodeURIComponent(disputeId)}&select=id,payment_id,status,requested_refund_amount_naira&limit=1`,
    );
    const disputes = await disputeResponse.json() as Array<{
      id: string;
      payment_id: string | null;
      status: string;
      requested_refund_amount_naira: number | null;
    }>;
    const dispute = disputes[0];

    if (!dispute) return json({ error: "Dispute not found" }, 404);
    if (!dispute.payment_id) return json({ error: "This dispute is not linked to a Paystack payment" }, 409);
    if (!["open", "in_review"].includes(dispute.status)) {
      return json({ error: "This dispute is not eligible for a new refund action" }, 409);
    }

    const paymentResponse = await serviceRequest(
      `payments?id=eq.${encodeURIComponent(dispute.payment_id)}&select=id,job_id,amount_naira,status,reference,is_test,gateway,refund_status&limit=1`,
    );
    const payments = await paymentResponse.json() as Array<{
      id: string;
      job_id: string;
      amount_naira: number;
      status: string;
      reference: string;
      is_test: boolean;
      gateway: string;
      refund_status: string;
    }>;
    const payment = payments[0];

    if (!payment) return json({ error: "Payment not found" }, 404);
    if (payment.gateway !== "paystack") return json({ error: "Only Paystack payments can use automated refunds" }, 409);
    if (payment.status !== "paid") return json({ error: "Only successfully paid transactions can be refunded" }, 409);
    if (payment.refund_status !== "none") return json({ error: "A refund has already been initiated for this payment" }, 409);

    if (
      dispute.requested_refund_amount_naira !== null &&
      Number(dispute.requested_refund_amount_naira) !== Number(payment.amount_naira)
    ) {
      return json({
        error: "Automated Rydah refunds currently require a full refund. Review partial-refund requests manually.",
      }, 409);
    }

    const secretKey = required("PAYSTACK_SECRET_KEY");
    const keyIsTest = secretKey.startsWith("sk_test_");
    if (keyIsTest !== Boolean(payment.is_test)) {
      return json({ error: "Paystack environment does not match the original payment" }, 503);
    }

    const refundSetting = payment.is_test ? "paystack_test_refunds_enabled" : "paystack_live_refunds_enabled";
    if (!(await settingEnabled(refundSetting))) {
      return json({
        error: payment.is_test
          ? "Test refunds are disabled by Rydah."
          : "Live refunds are not enabled yet.",
      }, 503);
    }

    const refundResponse = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: payment.reference,
        amount: Number(payment.amount_naira) * 100,
        currency: "NGN",
        customer_note: "Rydah Local approved refund",
        merchant_note: `Rydah dispute ${dispute.id}`,
      }),
    });

    const refundPayload = await refundResponse.json().catch(() => ({}));
    if (!refundResponse.ok || refundPayload?.status === false) {
      return json({
        error: refundPayload?.message || `Paystack refund request failed (${refundResponse.status})`,
      }, 502);
    }

    const refundData = refundPayload?.data ?? {};
    const gatewayStatus = String(refundData?.status || "pending");
    const refundStatus = normaliseRefundStatus(gatewayStatus);
    const now = new Date().toISOString();

    const paymentUpdate: Record<string, unknown> = {
      refund_status: refundStatus,
      refund_amount_naira: Number(payment.amount_naira),
      refund_gateway_id: refundData?.id ? String(refundData.id) : null,
      refund_requested_at: now,
      updated_at: now,
    };

    const disputeUpdate: Record<string, unknown> = {
      status: refundStatus === "processed" ? "refunded" : "refund_pending",
      resolution_message: refundStatus === "processed"
        ? "Your full refund has been processed by Paystack."
        : "Rydah approved a full refund. Paystack is processing it.",
      reviewed_at: now,
      reviewed_by: admin.id,
    };

    if (refundStatus === "processed") {
      paymentUpdate.status = "refunded";
      paymentUpdate.commission_status = "refunded";
      paymentUpdate.refunded_at = now;
    }

    await serviceRequest(`payments?id=eq.${encodeURIComponent(payment.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(paymentUpdate),
    });

    await serviceRequest(`payment_disputes?id=eq.${encodeURIComponent(dispute.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(disputeUpdate),
    });

    if (refundStatus === "processed") {
      await serviceRequest(`jobs?id=eq.${encodeURIComponent(payment.job_id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ payment_status: "refunded", updated_at: now }),
      });
    }

    return json({
      ok: true,
      status: refundStatus,
      message: refundStatus === "processed"
        ? "Refund processed."
        : "Refund initiated and awaiting Paystack processing.",
    });
  } catch (caught) {
    return json({ error: caught instanceof Error ? caught.message : "Unable to initiate refund" }, 500);
  }
});
