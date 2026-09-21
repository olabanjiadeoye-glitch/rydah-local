"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, type AuthSession } from "@/lib/supabase";

type PromoMarket = {
  market_key: string;
  city_name: string;
  region_name: string;
  slot_limit: number;
  sort_order: number;
  enabled: boolean;
};

type PromoClaim = {
  id: string;
  user_id: string | null;
  market_key: string;
  slot_number: number;
  claimed_at: string;
  free_until: string;
  claim_state: "active" | "expired";
  reminder_30d_sent_at: string | null;
  reminder_7d_sent_at: string | null;
  reminder_1d_sent_at: string | null;
  expired_alert_sent_at: string | null;
};

function date(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminFoundingProvidersPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [markets, setMarkets] = useState<PromoMarket[]>([]);
  const [claims, setClaims] = useState<PromoClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      window.location.assign("/sign-in?next=%2Fadmin%2Ffounding-providers");
      return;
    }
    setSession(current);
    void load(current);
  }, []);

  async function load(current: AuthSession) {
    setLoading(true);
    setError("");

    try {
      const admins = await restGet<{ user_id: string }[]>(
        `admin_users?user_id=eq.${current.user.id}&select=user_id&limit=1`,
        current.access_token,
      );
      if (!admins[0]) throw new Error("Admin access is required.");

      const [marketRows, claimRows] = await Promise.all([
        restGet<PromoMarket[]>(
          "provider_launch_promo_markets?select=market_key,city_name,region_name,slot_limit,sort_order,enabled&order=sort_order.asc",
          current.access_token,
        ),
        restGet<PromoClaim[]>(
          "provider_launch_promo_claims?select=id,user_id,market_key,slot_number,claimed_at,free_until,claim_state,reminder_30d_sent_at,reminder_7d_sent_at,reminder_1d_sent_at,expired_alert_sent_at&order=claimed_at.desc",
          current.access_token,
        ),
      ]);

      setMarkets(marketRows);
      setClaims(claimRows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Founding 100 status.");
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    const total = markets.reduce((sum, market) => sum + market.slot_limit, 0);
    return {
      total,
      claimed: claims.length,
      remaining: Math.max(0, total - claims.length),
      active: claims.filter((claim) => claim.claim_state === "active" && new Date(claim.free_until).getTime() > Date.now()).length,
      expired: claims.filter((claim) => claim.claim_state === "expired" || new Date(claim.free_until).getTime() <= Date.now()).length,
    };
  }, [markets, claims]);

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-8 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.2em] text-[#D4AF37]">RYDAH ADMIN</p>
            <h1 className="mt-2 text-4xl font-black">Founding 100 Providers</h1>
          </div>
          <Link href="/admin-dashboard" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300">
            Admin Dashboard
          </Link>
        </div>

        {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-7 rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">Loading Founding 100 allocation…</div>
        ) : (
          <>
            <div className="mt-7 grid gap-3 sm:grid-cols-4">
              <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-5">
                <p className="text-xs font-black text-zinc-500">TOTAL PLACES</p>
                <p className="mt-2 text-4xl font-black text-[#E5C65A]">{totals.total}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-5">
                <p className="text-xs font-black text-zinc-500">CLAIMED</p>
                <p className="mt-2 text-4xl font-black">{totals.claimed}</p>
              </div>
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <p className="text-xs font-black text-zinc-500">REMAINING</p>
                <p className="mt-2 text-4xl font-black text-emerald-300">{totals.remaining}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-5">
                <p className="text-xs font-black text-zinc-500">FREE PERIOD ACTIVE</p>
                <p className="mt-2 text-4xl font-black">{totals.active}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-5">
              {markets.map((market) => {
                const marketClaims = claims.filter((claim) => claim.market_key === market.market_key);
                const remaining = Math.max(0, market.slot_limit - marketClaims.length);
                const percent = market.slot_limit > 0 ? Math.min(100, (marketClaims.length / market.slot_limit) * 100) : 0;
                return (
                  <article key={market.market_key} className="rounded-3xl border border-white/10 bg-[#121212] p-5">
                    <p className="text-lg font-black">{market.city_name}</p>
                    <p className="mt-1 text-xs text-zinc-500">{market.region_name}</p>
                    <p className="mt-4 text-3xl font-black text-[#D4AF37]">{remaining}</p>
                    <p className="text-xs font-bold text-zinc-500">of {market.slot_limit} places left</p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">{marketClaims.length} claimed</p>
                  </article>
                );
              })}
            </div>

            <section className="mt-7 rounded-3xl border border-white/10 bg-[#121212] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">Claim history</h2>
                  <p className="mt-1 text-sm text-zinc-500">Slot claims remain counted even if an account is later deleted, preserving the first-100 order.</p>
                </div>
                <button
                  type="button"
                  onClick={() => session && void load(session)}
                  className="rounded-xl border border-[#D4AF37]/35 px-4 py-2 text-sm font-black text-[#E5C65A]"
                >
                  Refresh
                </button>
              </div>

              {claims.length === 0 ? (
                <p className="mt-5 text-sm text-zinc-400">No Founding 100 place has been claimed yet.</p>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-3">Market</th>
                        <th className="px-3 py-3">Slot</th>
                        <th className="px-3 py-3">Claimed</th>
                        <th className="px-3 py-3">Free until</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Provider ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {claims.map((claim) => {
                        const market = markets.find((item) => item.market_key === claim.market_key);
                        const active = claim.claim_state === "active" && new Date(claim.free_until).getTime() > Date.now();
                        return (
                          <tr key={claim.id} className="border-t border-white/10">
                            <td className="px-3 py-4 font-bold">{market?.city_name ?? claim.market_key}</td>
                            <td className="px-3 py-4">#{claim.slot_number}</td>
                            <td className="px-3 py-4 text-zinc-400">{date(claim.claimed_at)}</td>
                            <td className="px-3 py-4 text-zinc-400">{date(claim.free_until)}</td>
                            <td className="px-3 py-4">
                              <span className={`rounded-full px-3 py-1 text-xs font-black ${active ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-300"}`}>
                                {active ? "FREE PERIOD" : "EXPIRED"}
                              </span>
                            </td>
                            <td className="px-3 py-4 font-mono text-xs text-zinc-500">{claim.user_id?.slice(0, 8) ?? "deleted"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
