import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite en el 5173 con proxy de /api hacia el servidor Node en el 8000.
// Build: genera dist/ (lo sirve el servidor Node en producción).
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } },
  },
});
