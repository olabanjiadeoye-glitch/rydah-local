"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getStoredSession, restGet, type AuthSession } from "@/lib/supabase";
import {
  canAccessPath,
  destinationForAccess,
  resolveUserAccess,
  type UserAccess,
} from "@/lib/access";

const baseLink = "shrink-0 rounded-lg border px-3 py-2 text-xs font-bold";
const neutralLink = `${baseLink} border-white/15 text-white`;
const goldLink = `${baseLink} border-[#D4AF37]/40 text-[#D4AF37]`;
const adminLink = `${baseLink} border-emerald-500/30 text-emerald-300`;
const authOnlyPaths = new Set(["/sign-in", "/reset-password"]);

export default function SessionToolbar() {
  const router = useRouter();
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
        router.replace(destinationForAccess(resolvedAccess));
      }
    };

    void detectAccess();

    return () => {
      window.removeEventListener("rydah:immersive-verification", handleImmersiveVerification);
    };
  }, [router]);

  if (!session || !access || immersiveVerification) return null;

  const signOut = () => {
    clearSession();
    try {
      window.localStorage.removeItem("rydah-local-favourites");
    } catch {}
    router.push("/sign-in");
  };

  const notifications = (
    <Link href="/notifications" className={`relative ${neutralLink}`}>
      Notifications
      {unreadCount > 0 && (
        <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#D4AF37] px-1.5 py-0.5 text-[11px] font-black text-black">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );

  return (
    <div className="fixed bottom-2 left-2 right-2 z-[100] flex flex-nowrap items-center gap-1.5 overflow-x-auto rounded-xl border border-white/10 bg-[#111]/95 p-1.5 shadow-xl backdrop-blur md:bottom-4 md:left-auto md:right-4 md:max-w-[calc(100vw-2rem)]">
      <span className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
        <Image src="/rydah-icon.svg" alt="" aria-hidden="true" width={20} height={20} unoptimized className="h-5 w-5 rounded-md" />
        {access.role}
      </span>

      {access.role === "customer" && (
        <>
          {notifications}
          <Link href="/providers" className={goldLink}>Marketplace</Link>
          <Link href="/arrival-check" className={neutralLink}>Arrival Check</Link>
          <Link href="/safety" className={`${baseLink} border-red-500/30 text-red-300`}>Safety Center</Link>
          <Link href="/disputes" className={neutralLink}>Resolution Centre</Link>
          <Link href="/my-jobs" className="shrink-0 rounded-xl bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black">My Jobs</Link>
        </>
      )}

      {access.role === "provider" && (
        <>
          {notifications}
          <Link href="/provider-work" className={goldLink}>Dashboard</Link>
          <Link href="/provider-onboarding" className={neutralLink}>Verify Profile</Link>
          <Link href="/provider-interest" className={neutralLink}>Add Profession</Link>
          <Link href="/earnings" className={goldLink}>Earnings</Link>
          <Link href="/payouts" className={goldLink}>Payouts</Link>
          <Link href="/providers" className={neutralLink}>Marketplace</Link>
          <Link href="/safety" className={`${baseLink} border-red-500/30 text-red-300`}>Safety Center</Link>
          <Link href="/disputes" className={neutralLink}>Resolution Centre</Link>
        </>
      )}

      {access.role === "admin" && (
        <>
          {notifications}
          <Link href="/admin-dashboard" className={adminLink}>Admin Dashboard</Link>
          <Link href="/admin/providers" className={adminLink}>Verification</Link>
          <Link href="/admin/service-interests" className={adminLink}>New Professions</Link>
          <Link href="/admin/finance" className={adminLink}>Finance</Link>
          <Link href="/payout-admin" className={adminLink}>Payout Admin</Link>
          <Link href="/admin/safety" className={`${baseLink} border-red-500/40 text-red-300`}>Safety Review</Link>
          <Link href="/admin/disputes" className={adminLink}>Disputes</Link>
          <Link href="/admin/account-deletions" className={adminLink}>Deletions</Link>
          <Link href="/providers" className={neutralLink}>Marketplace</Link>
        </>
      )}

      {access.role !== "admin" && (
        <Link href="/delete-account" className={`${baseLink} border-red-500/30 text-red-300`}>Delete Account</Link>
      )}

      <button type="button" onClick={signOut} className={neutralLink}>Sign Out</button>
    </div>
  );
}
