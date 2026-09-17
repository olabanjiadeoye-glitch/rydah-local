import { restGet, type AuthSession } from "@/lib/supabase";

export type RydahRole = "customer" | "provider" | "admin";

export type UserAccess = {
  role: RydahRole;
  isAdmin: boolean;
  hasProviderProfile: boolean;
};

function metadataRole(session: AuthSession): "customer" | "provider" {
  return String(session.user.user_metadata?.role ?? "customer") === "provider"
    ? "provider"
    : "customer";
}

export async function resolveUserAccess(session: AuthSession): Promise<UserAccess> {
  const fallbackRole = metadataRole(session);

  try {
    const [providerRows, adminRows] = await Promise.all([
      restGet<{ id: string }[]>(
        `providers?user_id=eq.${session.user.id}&select=id&limit=1`,
        session.access_token,
      ),
      restGet<{ user_id: string }[]>(
        `admin_users?user_id=eq.${session.user.id}&select=user_id&limit=1`,
        session.access_token,
      ),
    ]);

    const isAdmin = adminRows.length > 0;
    const hasProviderProfile = providerRows.length > 0;

    return {
      role: isAdmin ? "admin" : hasProviderProfile || fallbackRole === "provider" ? "provider" : "customer",
      isAdmin,
      hasProviderProfile,
    };
  } catch {
    return {
      role: fallbackRole,
      isAdmin: false,
      hasProviderProfile: false,
    };
  }
}

export function destinationForAccess(access: UserAccess) {
  if (access.role === "admin") return "/admin-dashboard";
  if (access.role === "provider") return "/provider-dashboard";
  return "/providers";
}

export function canAccessPath(role: RydahRole, pathname: string) {
  const adminOnly =
    pathname === "/admin-dashboard" ||
    pathname === "/payout-admin" ||
    pathname.startsWith("/admin/");

  const providerOnly =
    pathname === "/provider-dashboard" ||
    pathname === "/provider-onboarding" ||
    pathname === "/earnings" ||
    pathname === "/payouts";

  if (role === "admin") return true;
  if (adminOnly) return false;
  if (role === "customer" && providerOnly) return false;
  return true;
}

export function fallbackPathForRole(role: RydahRole) {
  if (role === "admin") return "/admin-dashboard";
  if (role === "provider") return "/provider-dashboard";
  return "/providers";
}
