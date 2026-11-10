import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({ compiler: true }),
    tailwindcss(),
    nitro({
      serverDir: "./server",
      preset: "bun",
      experimental: { tasks: true },
      scheduledTasks: { "0 * * * *": ["visited:refresh"] },
      kv: { data: { driver: "fs", base: "./data" } },
    }),
  ],
});
