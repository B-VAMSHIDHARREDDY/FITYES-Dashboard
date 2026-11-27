import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: {
      port: 5173,
      proxy: { "/api": { target: env.API_PROXY_TARGET ?? "http://127.0.0.1:8010", changeOrigin: true } },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: { react: ["react", "react-dom", "react-router-dom"], charts: ["recharts"], motion: ["framer-motion"] },
        },
      },
    },
  };
});
