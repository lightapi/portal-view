import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    "process.env.MAPBOX_TOKEN": JSON.stringify(
      process.env.REACT_APP_MAPBOX_TOKEN,
    ),
  },
  optimizeDeps: {
    include: ["ag-grid-community", "ag-grid-react"],
  },
  server: {
    port: 3000,
    https: {
      key: fs.readFileSync("./server.key"),
      cert: fs.readFileSync("./server.pem"),
    },
    proxy: {
      "/api": {
        target: "https://local.lightapi.net",
        changeOrigin: true,
        secure: false,
      },
      "/oauth2": {
        target: "https://local.lightapi.net",
        changeOrigin: true,
        secure: false,
      },
      "/portal/command": {
        target: "https://local.lightapi.net",
        changeOrigin: true,
        secure: false,
      },
      "/portal/query": {
        target: "https://local.lightapi.net",
        changeOrigin: true,
        secure: false,
      },
      "/r/data": {
        target: "https://local.lightapi.net",
        changeOrigin: true,
        secure: false,
      },
      "/authorization": {
        target: "https://local.lightapi.net",
        changeOrigin: true,
        secure: false,
      },
      "/logout": {
        target: "https://local.lightapi.net",
        changeOrigin: true,
        secure: false,
      },
      "/config-server": {
        target: "https://local.lightapi.net",
        changeOrigin: true,
        secure: false,
      },
      "/services": {
        target: "https://local.lightapi.net",
        changeOrigin: true,
        secure: false,
      },
      "/schedules": {
        target: "https://local.lightapi.net",
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
});
