import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode (development, production, etc.)
  // The third argument "" ensures that all environment variables are loaded without a specific prefix.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || "/",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "process.env.MAPBOX_TOKEN": JSON.stringify(
        process.env.REACT_APP_MAPBOX_TOKEN,
      ),
      "process.env.REACT_APP_MAPBOX_TOKEN": JSON.stringify(
        process.env.REACT_APP_MAPBOX_TOKEN,
      ),
    },
    optimizeDeps: {
      include: ["ag-grid-community", "ag-grid-react"],
    },
    server: {
      port: 3000,
      cors: true,
      https: {
        key: fs.readFileSync("./server.key"),
        cert: fs.readFileSync("./server.pem"),
      },
      proxy: {
        "/api": {
          target: env.VITE_PORTAL_URL,
          changeOrigin: true,
          secure: false,
        },
        "/oauth2": {
          target: env.VITE_PORTAL_URL,
          changeOrigin: true,
          secure: false,
        },
        "/portal/command": {
          target: env.VITE_PORTAL_URL,
          changeOrigin: true,
          secure: false,
        },
        "/portal/query": {
          target: env.VITE_PORTAL_URL,
          changeOrigin: true,
          secure: false,
        },
        "/r/data": {
          target: env.VITE_PORTAL_URL,
          changeOrigin: true,
          secure: false,
        },
        "/authorization": {
          target: env.VITE_PORTAL_URL,
          changeOrigin: true,
          secure: false,
        },
        "/logout": {
          target: env.VITE_PORTAL_URL,
          changeOrigin: true,
          secure: false,
        },
        "/config-server": {
          target: env.VITE_PORTAL_URL,
          changeOrigin: true,
          secure: false,
        },
        "/services": {
          target: env.VITE_PORTAL_URL,
          changeOrigin: true,
          secure: false,
        },
        "/schedules": {
          target: env.VITE_PORTAL_URL,
          changeOrigin: true,
          secure: false,
        },
        "/chat": {
          target: env.VITE_PORTAL_URL,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
      minify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom"],
            "mui-vendor": ["@mui/material", "@mui/icons-material"],
          },
        },
      },
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
    },
  };
});
