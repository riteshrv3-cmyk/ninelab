import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      // Students get the new build on next launch with no prompt. An update
      // toast would be the alternative, but the product deliberately has no
      // install/update banners.
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.png",
        "apple-touch-icon.png",
        "toko/toko-head.png",
        "toko/toko-hero.png",
        "toko/toko-shrug.png",
        "toko/toko-think.png",
        "toko/toko-cheer.png",
      ],
      manifest: {
        name: "ninelab",
        short_name: "ninelab",
        description:
          "India's AI career companion for engineering students — find work, prepare for it, and apply.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        // Matches the TopBar surface (bg-paper/90), not the brand indigo —
        // the status bar should blend into the app's top edge rather than
        // sit as a coloured band above a white header.
        theme_color: "#ffffff",
        background_color: "#f4f5f7",
        categories: ["education", "productivity"],
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // First-load budget: the precache was 8.6MB, and 5.6MB of it was the
        // Toko mascot art (~3.9MB of PNGs) plus pdf.js worker/renderer chunks
        // that only matter when a user uploads or downloads a resume. Exclude
        // them from install-time precache — they load on demand (mascot gets a
        // runtime CacheFirst rule below), cutting install weight to ~3MB on a
        // budget Android.
        globIgnores: [
          "**/toko/*.png",
          "**/assets/pdfWorker-*.js",
          "**/assets/pdf-*.js",
          "**/assets/html2canvas*.js",
        ],
        navigateFallback: "/index.html",
        // Without this an offline navigation to /api/* would be answered with
        // the app shell instead of failing, so fetches would parse HTML as JSON.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Mascot art: cached after first sight instead of forced into the
            // install precache (it was 45% of the precache by weight).
            urlPattern: /\/toko\/.*\.png$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "toko-art",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          // Deliberately no /api rule. Workbox defaults unmatched requests to
          // NetworkOnly, which is what we want: a cached opportunity feed or
          // profile would show stale listings, and caching authenticated
          // responses risks serving one student's data to the next person on
          // a shared phone.
        ],
      },
      // A service worker in dev caches stale modules and makes HMR lie.
      devOptions: { enabled: false },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "wouter"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
          "charts-vendor": ["recharts"],
          "motion-vendor": ["framer-motion"],
          "query-vendor": ["@tanstack/react-query"],
          "icons-vendor": ["lucide-react"],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
