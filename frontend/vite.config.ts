import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo, /api y /sanctum se derivan al stack Docker (Nginx en :8080),
// así el navegador ve un solo origen y la cookie de sesión de Sanctum funciona.
const apiTarget = process.env.VITE_API_PROXY ?? 'http://localhost:8080'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: apiTarget },
      '/sanctum': { target: apiTarget },
    },
  },
})
