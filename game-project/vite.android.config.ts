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
    // Three.js is loaded only after the player enters the game. Keep its
    // modules in bounded local chunks so low-memory Android WebViews do not
    // need to parse one oversized engine file at startup.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "three-engine",
              test: /node_modules[\\/]three[\\/]/,
              maxSize: 280 * 1024,
              minSize: 40 * 1024,
              priority: 20,
            },
          ],
        },
      },
    },
    rollupOptions: {
      input: resolve(root, "android.html"),
    },
  },
});
