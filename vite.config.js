import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ChatBot Creator corre dentro de Docker: hay que escuchar en 0.0.0.0 para que el
// puerto sea visible desde el host. `usePolling` para que el hot-reload detecte
// cambios de archivos montados por volumen en macOS/Windows.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: { usePolling: true },
  },
});
