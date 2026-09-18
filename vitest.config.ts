import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // The logic tests never touch CSS; don't load the app's Tailwind PostCSS setup.
  css: { postcss: { plugins: [] } },
  test: { include: ["src/**/*.test.ts"] },
});
