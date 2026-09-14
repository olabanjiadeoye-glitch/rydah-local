"use client";

import { useEffect, useState } from "react";
import { clearSession, getStoredSession, restGet, type AuthSession } from "@/lib/supabase";

export default function SessionToolbar() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hasProviderProfile, setHasProviderProfile] = useState(false);

  useEffect(() => {
    const currentSession = getStoredSession();
    setSession(currentSession);

    if (!currentSession) return;

    const detectProviderProfile = async () => {
      try {
        const rows = await restGet<{ id: string }[]>(
          `providers?user_id=eq.${currentSession.user.id}&select=id&limit=1`,
          currentSession.access_token,
        );
        setHasProviderProfile(rows.length > 0);
      } catch {
        setHasProviderProfile(false);
      }
    };

    void detectProviderProfile();
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
    <div className="fixed bottom-5 right-5 z-[100] flex items-center gap-2 rounded-2xl border border-white/10 bg-[#111]/95 p-2 shadow-2xl backdrop-blur">
      {showProviderDashboard && (
        <a
          href="/provider-dashboard"
          className="rounded-xl bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black"
        >
          Provider Dashboard
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
