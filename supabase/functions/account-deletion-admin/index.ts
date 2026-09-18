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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = await getSignedInUser(req);
    await requireAdmin(admin.id);

    const body = await req.json().catch(() => ({})) as { request_id?: string };
    const requestId = String(body.request_id || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
      return json({ error: "A valid deletion request is required" }, 400);
    }

    const requestResponse = await serviceRequest(
      `account_deletion_requests?id=eq.${encodeURIComponent(requestId)}&status=eq.pending&select=id,user_id,status&limit=1`,
    );
    const requests = await requestResponse.json() as Array<{ id: string; user_id: string | null; status: string }>;
    const deletionRequest = requests[0];

    if (!deletionRequest) return json({ error: "Pending deletion request not found" }, 404);
    if (!deletionRequest.user_id) return json({ error: "Deletion request no longer has an active account" }, 409);
    if (deletionRequest.user_id === admin.id) {
      return json({ error: "An administrator cannot delete their own account from this workflow" }, 409);
    }

    const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");

    const prepareResponse = await fetch(`${required("SUPABASE_URL")}/rest/v1/rpc/prepare_account_deletion`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_user_id: deletionRequest.user_id }),
    });

    const preparePayload = await prepareResponse.json().catch(() => ({}));
    if (!prepareResponse.ok) {
      return json({
        error: typeof preparePayload?.message === "string"
          ? preparePayload.message
          : "Unable to prepare the account for deletion",
      }, 409);
    }

    const deleteResponse = await fetch(
      `${required("SUPABASE_URL")}/auth/v1/admin/users/${encodeURIComponent(deletionRequest.user_id)}`,
      {
        method: "DELETE",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );

    if (!deleteResponse.ok) {
      return json({
        error: `The account was anonymised but the Auth account could not be deleted yet (${deleteResponse.status}). Retry this request before marking it complete.`,
      }, 502);
    }

    await serviceRequest(
      `account_deletion_requests?id=eq.${encodeURIComponent(deletionRequest.id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          user_id: null,
          reason: null,
          status: "completed",
          completed_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          reviewed_by: admin.id,
        }),
      },
    );

    return json({
      ok: true,
      request_id: deletionRequest.id,
      anonymisation: preparePayload,
      message: "The user account was deleted and retained records were anonymised.",
    });
  } catch (caught) {
    return json({ error: caught instanceof Error ? caught.message : "Unable to complete account deletion" }, 500);
  }
});
