import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo, /api y /sanctum se derivan al stack Docker (Nginx en :8080),
// así el navegador ve un solo origen y la cookie de sesión de Sanctum funciona.
const apiTarget = process.env.VITE_API_PROXY ?? 'http://localhost:8080'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Puerto fijo: 5173 suele estar ocupado por otros proyectos (p. ej. Laravel Sail).
    // strictPort hace que falle con un mensaje claro en vez de cambiar de puerto en silencio.
    port: 5180,
    strictPort: true,
    // Escucha en todas las interfaces: localhost, 127.0.0.1 y la IP de la PC (para probar desde el celular).
    host: true,
    proxy: {
      '/api': { target: apiTarget },
      '/sanctum': { target: apiTarget },
    },
  },
})
