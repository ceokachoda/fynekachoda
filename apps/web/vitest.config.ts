import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  // Stop Vite from auto-discovering apps/web/postcss.config.mjs — its plugin
  // is a Tailwind 4 string identifier (`@tailwindcss/postcss`) that crashes
  // Vite's runtime PostCSS loader. We don't render styled CSS in unit tests.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["**/*.test.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      ".next/**",
      "e2e/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
