"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getStoredSession,
  restGet,
  restPatch,
  restRpc,
  type AuthSession,
} from "@/lib/supabase";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

type PushConfig = {
  public_key: string | null;
  enabled: boolean;
};

type PushState = "checking" | "enabled" | "disabled" | "blocked" | "unsupported";

function timeLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function subscriptionKeys(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh || "";
  const auth = json.keys?.auth || "";
  if (!p256dh || !auth) throw new Error("The browser did not return valid push encryption keys.");
  return { p256dh, auth };
}

export default function NotificationsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushState, setPushState] = useState<PushState>("checking");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      window.location.assign("/sign-in");
      return;
    }
    setSession(current);
    void load(current);
    void detectPushState(current);
  }, []);

  async function load(current: AuthSession) {
    setLoading(true);
    setError("");
    try {
      const rows = await restGet<NotificationRow[]>(
        "notifications?select=*&order=created_at.desc&limit=100",
        current.access_token,
      );
      setItems(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  async function detectPushState(current: AuthSession) {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setPushState("blocked");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setPushState("disabled");
        return;
      }

      const keys = subscriptionKeys(subscription);
      await restRpc<string>(
        "save_push_subscription",
        {
          p_endpoint: subscription.endpoint,
          p_p256dh: keys.p256dh,
          p_auth: keys.auth,
          p_user_agent: navigator.userAgent,
        },
        current.access_token,
      );
      setPushState("enabled");
    } catch {
      setPushState("disabled");
    }
  }

  async function enablePush() {
    if (!session) return;
    setPushBusy(true);
    setError("");
    setMessage("");

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPushState("unsupported");
        throw new Error("Push notifications are not supported on this browser or device.");
      }

      const configRows = await restGet<PushConfig[]>(
        "push_config?select=public_key,enabled&id=eq.true&limit=1",
        session.access_token,
      );
      const config = configRows[0];
      if (!config?.enabled || !config.public_key) {
        throw new Error("Rydah device notifications are not ready yet.");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "blocked" : "disabled");
        throw new Error(
          permission === "denied"
            ? "Notifications are blocked for Rydah in your browser settings."
            : "Notification permission was not granted.",
        );
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.public_key),
        });
      }

      const keys = subscriptionKeys(subscription);
      await restRpc<string>(
        "save_push_subscription",
        {
          p_endpoint: subscription.endpoint,
          p_p256dh: keys.p256dh,
          p_auth: keys.auth,
          p_user_agent: navigator.userAgent,
        },
        session.access_token,
      );

      setPushState("enabled");
      setMessage("Device notifications are enabled for this browser.");
      await registration.showNotification("Rydah notifications enabled", {
        body: "Important job, safety, payment and verification updates can now appear on this device.",
        icon: "/rydah-icon.svg",
        badge: "/rydah-icon.svg",
        data: { url: "/notifications" },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to enable device notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    if (!session) return;
    setPushBusy(true);
    setError("");
    setMessage("");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await restRpc<void>(
          "remove_push_subscription",
          { p_endpoint: subscription.endpoint },
          session.access_token,
        );
        await subscription.unsubscribe();
      }

      setPushState("disabled");
      setMessage("Device notifications are disabled for this browser.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to disable device notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  async function markRead(item: NotificationRow) {
    if (!session || item.read_at) {
      if (item.link) window.location.assign(item.link);
      return;
    }

    try {
      const updated = await restPatch<NotificationRow[]>(
        "notifications",
        `id=eq.${item.id}`,
        { read_at: new Date().toISOString() },
        session.access_token,
      );
      if (updated[0]) {
        setItems((current) => current.map((row) => (row.id === item.id ? updated[0] : row)));
      }
      if (item.link) window.location.assign(item.link);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update notification.");
    }
  }

  async function markAllRead() {
    if (!session || unreadCount === 0) return;
    setSaving(true);
    setError("");
    try {
      await restPatch<NotificationRow[]>(
        "notifications",
        "read_at=is.null",
        { read_at: new Date().toISOString() },
        session.access_token,
      );
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to mark notifications as read.");
    } finally {
      setSaving(false);
    }
  }

  const pushLabel = pushState === "enabled"
    ? "Device notifications enabled"
    : pushState === "blocked"
      ? "Notifications blocked in browser"
      : pushState === "unsupported"
        ? "Notifications unsupported on this device"
        : "Enable device notifications";

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Notifications</h1>
          </div>
          <Link href="/" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Home</Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-7 sm:py-6">
        <div className="rounded-3xl border border-[#D4AF37]/20 bg-[#121212] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-[#E5C65A]">DEVICE NOTIFICATIONS</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-400">
                Opt in to receive job, safety, dispute, payment and verification updates even when the Rydah page is not open.
              </p>
            </div>
            {pushState === "enabled" ? (
              <button
                type="button"
                disabled={pushBusy}
                onClick={() => void disablePush()}
                className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-zinc-300 disabled:opacity-40"
              >
                {pushBusy ? "Updating…" : "Disable on this device"}
              </button>
            ) : (
              <button
                type="button"
                disabled={pushBusy || pushState === "blocked" || pushState === "unsupported" || pushState === "checking"}
                onClick={() => void enablePush()}
                className="rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-black text-black disabled:opacity-40"
              >
                {pushBusy ? "Enabling…" : pushLabel}
              </button>
            )}
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">YOUR UPDATES</p>
            <h2 className="mt-1 text-3xl font-black">Stay up to date</h2>
            <p className="mt-2 text-zinc-400">Job progress, provider activity, safety and verification updates appear here.</p>
          </div>
          <button
            type="button"
            disabled={saving || unreadCount === 0}
            onClick={markAllRead}
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-200 disabled:opacity-40"
          >
            {saving ? "Updating..." : `Mark all read${unreadCount ? ` (${unreadCount})` : ""}`}
          </button>
        </div>

        {message && <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{message}</div>}
        {error && <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-6 text-zinc-400">Loading notifications...</div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">No notifications yet. New activity will appear here.</div>
        ) : (
          <div className="mt-6 grid gap-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void markRead(item)}
                className={`w-full rounded-3xl border p-5 text-left transition ${item.read_at ? "border-white/10 bg-[#111]" : "border-[#D4AF37]/35 bg-[#D4AF37]/10"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {!item.read_at && <span className="h-2.5 w-2.5 rounded-full bg-[#D4AF37]" />}
                      <h3 className="font-black">{item.title}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-zinc-500">{timeLabel(item.created_at)}</span>
                </div>
                {item.link && <p className="mt-3 text-sm font-bold text-[#D4AF37]">Open update →</p>}
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
