import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  server: { port: 5177, fs: { allow: ["../.."] } },
  preview: { port: 4177 },
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
    rollupOptions: { output: { manualChunks: { three: ["three"] } } },
  },
});
