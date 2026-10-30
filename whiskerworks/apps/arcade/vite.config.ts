import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
    rollupOptions: { output: { manualChunks: { three: ["three"] } } },
  },
  server: { port: 5175, fs: { allow: ["../.."] } },
  preview: { port: 4175 },
});
