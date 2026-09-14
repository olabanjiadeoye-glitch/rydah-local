"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, restPatch, type AuthSession } from "@/lib/supabase";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function timeLabel(value: string) {
  const date = new Date(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      window.location.assign("/sign-in");
      return;
    }
    setSession(current);
    void load(current);
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

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Notifications</h1>
          </div>
          <a href="/" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Home</a>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">YOUR UPDATES</p>
            <h2 className="mt-1 text-3xl font-black">Stay up to date</h2>
            <p className="mt-2 text-zinc-400">Job progress, provider activity and verification updates appear here.</p>
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

        {error && <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-8 text-zinc-400">Loading notifications...</div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">No notifications yet. New activity will appear here.</div>
        ) : (
          <div className="mt-8 grid gap-3">
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
