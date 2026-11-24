import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Frontier AI App Factory",
    short_name: "Frontier",
    description: "Plan, build, preview, and export your next app.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f5",
    theme_color: "#f6f7f5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
