import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    root: "mobile",
    publicDir: "../public",
    plugins: [react()],
    resolve: {
      alias: {
        "next/image": fileURLToPath(
          new URL("./mobile/NextImage.tsx", import.meta.url),
        ),
      },
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      ),
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      ),
    },
    build: {
      outDir: "../mobile-dist",
      emptyOutDir: true,
    },
  };
});
