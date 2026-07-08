import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Helper to sanitize Set-Cookie headers
function sanitizeSetCookieHeader(setCookieArr) {
  if (!Array.isArray(setCookieArr)) return setCookieArr;
  return setCookieArr.map((c) => {
    let v = c;
    v = v.replace(/;\s*Domain=[^;]+/i, "");
    // Downgrade SameSite=None -> Lax when running on http (dev)
    v = v.replace(/SameSite=None/gi, "SameSite=Lax");
    // Also ensure we do not leave a dangling Secure requirement that would be ignored on http
    // (Chrome ignores Secure on http anyway, but we don't add it if missing)
    return v;
  });
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode (development, production, etc.)
  // The third argument "" ensures that all environment variables are loaded without a specific prefix.
  const env = loadEnv(mode, process.cwd(), "");
  const isHttpsEnabled = String(env.VITE_HTTPS_ENABLED || "false") === "true";
  const httpsKeyPath = env.VITE_HTTPS_KEY_PATH;
  const httpsCertPath = env.VITE_HTTPS_CERT_PATH;
  const parsedPort = Number(env.VITE_PORT);
  const port = Number.isFinite(parsedPort) ? parsedPort : 3000;
  const apiBaseUrl = env.VITE_API_BASE_URL || "https://localhost";
  // Optional comma-separated list of additional CORS-allowed origins for the dev server.
  // Example: VITE_CORS_ALLOWED_ORIGINS="https://example.localhost,http://localhost:5174"
  const extraCorsAllowedOrigins = (env.VITE_CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const httpsConfig =
    isHttpsEnabled && httpsKeyPath && httpsCertPath
      ? {
          key: fs.readFileSync(path.resolve(process.cwd(), httpsKeyPath)),
          cert: fs.readFileSync(path.resolve(process.cwd(), httpsCertPath)),
        }
      : undefined;
  const devServerProtocol = httpsConfig ? "https" : "http";
  const corsAllowedOrigins = [
    `${devServerProtocol}://localhost:${port}`,
    "https://signin.localhost",
    "https://local.localhost",
    "https://oauth.localhost",
    "http://localhost:5173",
    "http://0.0.0.0:6274",
    ...extraCorsAllowedOrigins,
  ];

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
      port,
      cors: {
        origin: corsAllowedOrigins,
        credentials: true,
      },
      https: httpsConfig,
      proxy: {
        "/api": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
        "/oauth2": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
        "/portal/command": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
        "/portal/query": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
        "/r/data": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
        "/authorization": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
        "/logout": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
        "/config-server": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
        "/services": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
        "/schedules": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
        "/chat": {
          target: apiBaseUrl,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        "/ctrl/mcp": {
          target: apiBaseUrl,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        "/auth/ms": {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              if (proxyRes.headers["set-cookie"]) {
                // Sanitize cookie headers before sending them to the browser
                proxyRes.headers["set-cookie"] = sanitizeSetCookieHeader(
                  proxyRes.headers["set-cookie"],
                );
              }
            });
          },
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
      minify: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/@mui/material/') || id.includes('node_modules/@mui/icons-material/')) {
              return 'mui-vendor';
            }
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
