import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "shared/**/*.test.ts", "server/**/*.test.ts"],
    globals: true,
    environment: "node",
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: false,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
});
