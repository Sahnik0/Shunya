import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
// Use current working directory instead of __dirname to keep config ESM-friendly

export default defineConfig(({ mode }: { mode?: string } = {}) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve("./src"),
    },
  },
}));
