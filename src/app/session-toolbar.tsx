"use client";

import { useEffect, useState } from "react";
import { clearSession, getStoredSession, restGet, type AuthSession } from "@/lib/supabase";

export default function SessionToolbar() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hasProviderProfile, setHasProviderProfile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const currentSession = getStoredSession();
    setSession(currentSession);

    if (!currentSession) return;

    const detectAccess = async () => {
      try {
        const [providerRows, adminRows] = await Promise.all([
          restGet<{ id: string }[]>(
            `providers?user_id=eq.${currentSession.user.id}&select=id&limit=1`,
            currentSession.access_token,
          ),
          restGet<{ user_id: string }[]>(
            `admin_users?user_id=eq.${currentSession.user.id}&select=user_id&limit=1`,
            currentSession.access_token,
          ),
        ]);
        setHasProviderProfile(providerRows.length > 0);
        setIsAdmin(adminRows.length > 0);
      } catch {
        setHasProviderProfile(false);
        setIsAdmin(false);
      }
    };

    void detectAccess();
  }, []);

  if (!session) return null;

  const role = String(session.user.user_metadata?.role ?? "customer");
  const showProviderDashboard = role === "provider" || hasProviderProfile;

  const signOut = () => {
    clearSession();
    try {
      window.localStorage.removeItem("rydah-local-favourites");
    } catch {}
    window.location.assign("/sign-in");
  };

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex max-w-[calc(100vw-2.5rem)] flex-wrap items-center justify-end gap-2 rounded-2xl border border-white/10 bg-[#111]/95 p-2 shadow-2xl backdrop-blur">
      <a
        href="/my-jobs"
        className="rounded-xl bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black"
      >
        My Jobs
      </a>
      {showProviderDashboard && (
        <>
          <a
            href="/provider-onboarding"
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white"
          >
            Verify Profile
          </a>
          <a
            href="/provider-dashboard"
            className="rounded-xl border border-[#D4AF37]/50 px-4 py-2 text-sm font-bold text-[#D4AF37]"
          >
            Provider Dashboard
          </a>
        </>
      )}
      {isAdmin && (
        <a
          href="/admin/providers"
          className="rounded-xl border border-emerald-500/30 px-4 py-2 text-sm font-bold text-emerald-300"
        >
          Admin
        </a>
      )}
      <button
        type="button"
        onClick={signOut}
        className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white"
      >
        Sign Out
      </button>
    </div>
  );
}
