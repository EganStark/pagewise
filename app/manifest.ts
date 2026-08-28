import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pagewise",
    short_name: "Pagewise",
    description: "Your private reading library, journal, and progress tracker.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#14161A",
    theme_color: "#14161A",
    orientation: "any",
    id: "/",
    categories: ["books", "lifestyle", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Add book", short_name: "Add book", url: "/?action=add-book" },
      { name: "Quick log", short_name: "Quick log", url: "/?action=quick-log" },
    ],
  };
}
