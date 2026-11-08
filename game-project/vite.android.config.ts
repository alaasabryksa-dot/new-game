import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  configFile: false,
  root,
  base: "./",
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: { "@": resolve(root, "src") },
  },
  build: {
    outDir: resolve(root, "android/app/src/main/assets/public"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(root, "android.html"),
    },
  },
});
