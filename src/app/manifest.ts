import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Rydah Local",
    short_name: "Rydah",
    description: "Find trusted, biometric-verified local professionals and manage jobs, quotes, safety checks and payments across Lagos, Abuja and Ibadan.",
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
