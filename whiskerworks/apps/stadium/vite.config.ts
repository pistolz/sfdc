import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  server: { port: 5174, fs: { allow: ["../.."] } },
  preview: { port: 4174 },
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
    rollupOptions: { output: { manualChunks: { three: ["three"] } } },
  },
});
