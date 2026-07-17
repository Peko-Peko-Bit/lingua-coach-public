import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "LinguaCoach",
    short_name:       "LinguaCoach",
    description:      "AI language coach – conversation practice chat app",
    start_url:        "/",
    display:          "standalone",
    background_color: "#0f172a",
    theme_color:      "#0f172a",
    orientation:      "portrait",
    icons: [
      {
        src:     "/linguacoach_icon.svg",
        sizes:   "any",
        type:    "image/svg+xml",
        purpose: "any",
      },
      {
        src:     "/icons/icon-192.png",
        sizes:   "192x192",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icons/icon-512.png",
        sizes:   "512x512",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icons/icon-512.png",
        sizes:   "512x512",
        type:    "image/png",
        purpose: "maskable",
      },
    ],
  };
}
