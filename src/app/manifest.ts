import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Rydah Local",
    short_name: "Rydah",
    description: "Explore local services and manage service requests, quotes and safety steps. Provider availability depends on verification and billing. Lagos, Abuja, Ibadan, Warri and Port Harcourt are planned markets.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#080808",
    theme_color: "#080808",
    categories: ["business", "lifestyle", "productivity"],
    icons: [
      {
        src: "/rydah-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/rydah-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
