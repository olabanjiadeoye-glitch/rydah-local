import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/admin-dashboard/",
        "/provider-dashboard/",
        "/my-jobs/",
        "/notifications/",
        "/payments/",
        "/payouts/",
        "/payout-admin/",
        "/provider-onboarding/",
        "/verification-status/",
        "/reset-password/",
        "/sign-in/",
        "/sign-up/",
      ],
    },
    sitemap: "https://rydahlocal.online/sitemap.xml",
    host: "https://rydahlocal.online",
  };
}
