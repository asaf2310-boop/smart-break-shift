import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  logLevel: "error",
  plugins: [react()],
  assetsInclude: ["**/*.bcmap", "**/*.pfb"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // שליחת מייל אמיתית: /api/send-email (Resend) רץ ב-Vercel או ב-vercel dev.
  // npm run dev בלבד — אין API; השתמשו ב-mailto או הריצו: npx vercel dev
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
});