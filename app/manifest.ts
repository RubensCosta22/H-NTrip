import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "H&NTrip — Planejamento de viagens",
    short_name: "H&NTrip",
    description: "Planejamento privado e colaborativo de viagens.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#071525",
    theme_color: "#071525",
    lang: "pt-BR",
    categories: ["travel", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Visão geral", short_name: "Dashboard", url: "/dashboard" },
      { name: "Viagens", short_name: "Viagens", url: "/trips" },
    ],
  };
}
