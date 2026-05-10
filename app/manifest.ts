import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kali — Agentic context layer for nonprofits",
    short_name: "Kali",
    description:
      "Kali is the agentic context layer for nonprofits. Cited answers across every tool you run on, with human-approved writes.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFDF6",
    theme_color: "#FFFDF6",
    icons: [
      {
        src: "/kawaii/app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/kawaii/app-icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["productivity", "business", "utilities"],
    lang: "en-US",
    orientation: "portrait",
  };
}
