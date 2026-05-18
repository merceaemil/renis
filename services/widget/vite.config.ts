import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  /** React dev bundles reference `process.env.NODE_ENV`; IIFE runs in the browser. */
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  server: {
    port: 3001,
  },
  build: {
    minify: "esbuild",
    lib: {
      entry: resolve(__dirname, "src/embed.tsx"),
      name: "RenisVerify",
      fileName: "renis-verify",
      formats: ["iife"],
    },
    rollupOptions: {
      external: [],
      output: {
        extend: true,
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false,
  },
});
