import webpush from "npm:web-push@3.6.7";

function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

async function rpc<T>(name: string, payload: Record<string, unknown>): Promise<T> {
  const response = await serviceRequest(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

async function getSecret(name: string) {
  return await rpc<string | null>("get_push_runtime_secret", { p_name: name });
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function ensureVapidConfig() {
  const [storedPublic, storedPrivate] = await Promise.all([
    getSecret("RYDAH_WEB_PUSH_VAPID_PUBLIC_KEY"),
    getSecret("RYDAH_WEB_PUSH_VAPID_PRIVATE_KEY"),
  ]);

  if (storedPublic && storedPrivate) {
    return { publicKey: storedPublic, privateKey: storedPrivate };
  }

  const generated = webpush.generateVAPIDKeys();
  await rpc<void>("set_push_runtime_config", {
    p_public_key: generated.publicKey,
    p_private_key: generated.privateKey,
  });

  return { publicKey: generated.publicKey, privateKey: generated.privateKey };
}

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

async function deleteSubscription(id: string) {
  await serviceRequest(`push_subscriptions?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const expectedToken = await getSecret("RYDAH_WEB_PUSH_DISPATCH_TOKEN");
    const suppliedToken = req.headers.get("x-rydah-push-token") || "";

    if (!expectedToken || !suppliedToken || !constantTimeEqual(expectedToken, suppliedToken)) {
      return json({ error: "Unauthorised" }, 401);
    }

    const body = await req.json().catch(() => ({})) as {
      action?: string;
      user_id?: string;
      title?: string;
      body?: string;
      link?: string;
      kind?: string;
      notification_id?: string;
    };

    const vapid = await ensureVapidConfig();
    webpush.setVapidDetails(
      "mailto:admin@rydahlocal.online",
      vapid.publicKey,
      vapid.privateKey,
    );

    if (body.action === "initialize") {
      return json({ ok: true, initialized: true });
    }

    const userId = String(body.user_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "Invalid user" }, 400);

    const subscriptionResponse = await serviceRequest(
      `push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&enabled=eq.true&select=id,endpoint,p256dh,auth_key`,
    );
    const subscriptions = await subscriptionResponse.json() as PushSubscriptionRow[];

    if (subscriptions.length === 0) {
      return json({ ok: true, sent: 0 });
    }

    const payload = JSON.stringify({
      title: String(body.title || "Rydah Local"),
      body: String(body.body || "You have a new Rydah update."),
      url: String(body.link || "/notifications"),
      kind: String(body.kind || "general"),
      notification_id: String(body.notification_id || ""),
      icon: "/rydah-icon.svg",
      badge: "/rydah-icon.svg",
    });

    let sent = 0;
    let removed = 0;

    await Promise.all(subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.p256dh,
              auth: row.auth_key,
            },
          },
          payload,
          { TTL: 60 * 60 },
        );
        sent += 1;
      } catch (caught) {
        const statusCode = Number(
          typeof caught === "object" && caught !== null && "statusCode" in caught
            ? (caught as { statusCode?: number }).statusCode
            : 0,
        );

        if (statusCode === 404 || statusCode === 410) {
          await deleteSubscription(row.id);
          removed += 1;
          return;
        }

        console.error("Push delivery failed", caught);
      }
    }));

    return json({ ok: true, sent, removed });
  } catch (caught) {
    console.error(caught);
    return json({ error: caught instanceof Error ? caught.message : "Push dispatch failed" }, 500);
  }
});
