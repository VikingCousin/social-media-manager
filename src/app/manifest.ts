import type { MetadataRoute } from "next";
import { color } from "@/lib/design-tokens";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Social Media Manager",
    short_name: "Social Media",
    description: "Persönlicher KI-Assistent für LinkedIn, Instagram und TikTok: Strategie, Ideen, Content, Planung und Analyse.",
    lang: "de",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: color("color.bg.canvas"),
    theme_color: color("color.bg.canvas"),
    icons: [
      { src: "/app-icon/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Neue Idee", short_name: "Idee", url: "/neu" },
      { name: "Redaktionsplan", short_name: "Plan", url: "/entwuerfe#plan" },
    ],
  };
}
