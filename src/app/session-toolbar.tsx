"use client";

import { useEffect, useState } from "react";
import { clearSession, getStoredSession, restGet, type AuthSession } from "@/lib/supabase";
import {
  canAccessPath,
  destinationForAccess,
  resolveUserAccess,
  type UserAccess,
} from "@/lib/access";

const baseLink = "shrink-0 rounded-xl border px-4 py-2 text-sm font-bold";
const neutralLink = `${baseLink} border-white/15 text-white`;
const goldLink = `${baseLink} border-[#D4AF37]/40 text-[#D4AF37]`;
const adminLink = `${baseLink} border-emerald-500/30 text-emerald-300`;
const authOnlyPaths = new Set(["/sign-in", "/reset-password"]);

export default function SessionToolbar() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [access, setAccess] = useState<UserAccess | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [immersiveVerification, setImmersiveVerification] = useState(false);

  useEffect(() => {
    const handleImmersiveVerification = (event: Event) => {
      const custom = event as CustomEvent<{ active?: boolean }>;
      setImmersiveVerification(Boolean(custom.detail?.active));
    };
    window.addEventListener("rydah:immersive-verification", handleImmersiveVerification);

    const pathname = window.location.pathname;
    if (authOnlyPaths.has(pathname)) {
      setSession(null);
      setAccess(null);
      return;
    }

    const currentSession = getStoredSession();
    setSession(currentSession);

    if (!currentSession) return;

    const detectAccess = async () => {
      const [resolvedAccess, unreadRows] = await Promise.all([
        resolveUserAccess(currentSession),
        restGet<{ id: string }[]>(
          "notifications?read_at=is.null&select=id&limit=99",
          currentSession.access_token,
        ).catch(() => []),
      ]);

      setAccess(resolvedAccess);
      setUnreadCount(unreadRows.length);

      if (!canAccessPath(resolvedAccess.role, pathname)) {
        window.location.replace(destinationForAccess(resolvedAccess));
      }
    };

    void detectAccess();

    return () => {
      window.removeEventListener("rydah:immersive-verification", handleImmersiveVerification);
    };
  }, []);

  if (!session || !access || immersiveVerification) return null;

  const signOut = () => {
    clearSession();
    try {
      window.localStorage.removeItem("rydah-local-favourites");
    } catch {}
    window.location.assign("/sign-in");
  };

  const notifications = (
    <a href="/notifications" className={`relative ${neutralLink}`}>
      Notifications
      {unreadCount > 0 && (
        <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#D4AF37] px-1.5 py-0.5 text-[11px] font-black text-black">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </a>
  );

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[100] flex flex-nowrap items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#111]/95 p-2 shadow-2xl backdrop-blur md:bottom-5 md:left-auto md:right-5 md:max-w-[calc(100vw-2.5rem)]">
      <span className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
        <img src="/rydah-icon.svg" alt="" aria-hidden="true" className="h-5 w-5 rounded-md" />
        {access.role}
      </span>

      {access.role === "customer" && (
        <>
          {notifications}
          <a href="/providers" className={goldLink}>Marketplace</a>
          <a href="/arrival-check" className={neutralLink}>Arrival Check</a>
          <a href="/safety" className={`${baseLink} border-red-500/30 text-red-300`}>Safety Center</a>
          <a href="/my-jobs" className="shrink-0 rounded-xl bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black">My Jobs</a>
        </>
      )}

      {access.role === "provider" && (
        <>
          {notifications}
          <a href="/provider-work" className={goldLink}>Dashboard</a>
          <a href="/provider-onboarding" className={neutralLink}>Verify Profile</a>
          <a href="/provider-interest" className={neutralLink}>Add Profession</a>
          <a href="/earnings" className={goldLink}>Earnings</a>
          <a href="/payouts" className={goldLink}>Payouts</a>
          <a href="/providers" className={neutralLink}>Marketplace</a>
          <a href="/safety" className={`${baseLink} border-red-500/30 text-red-300`}>Safety Center</a>
        </>
      )}

      {access.role === "admin" && (
        <>
          {notifications}
          <a href="/admin-dashboard" className={adminLink}>Admin Dashboard</a>
          <a href="/admin/providers" className={adminLink}>Verification</a>
          <a href="/admin/service-interests" className={adminLink}>New Professions</a>
          <a href="/admin/finance" className={adminLink}>Finance</a>
          <a href="/payout-admin" className={adminLink}>Payout Admin</a>
          <a href="/admin/safety" className={`${baseLink} border-red-500/40 text-red-300`}>Safety Review</a>
          <a href="/providers" className={neutralLink}>Marketplace</a>
        </>
      )}

      {access.role !== "admin" && (
        <a href="/delete-account" className={`${baseLink} border-red-500/30 text-red-300`}>Delete Account</a>
      )}

      <button type="button" onClick={signOut} className={neutralLink}>Sign Out</button>
    </div>
  );
}
