import type { MetadataRoute } from "next";

const APP_NAME = "FyneStudy";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Coaching OS`,
    short_name: APP_NAME,
    description:
      "FyneStudy: classes, attendance, quizzes, exams, library and live sessions for students and teachers.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#2563EB",
    categories: ["education", "productivity"],
    lang: "en",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
