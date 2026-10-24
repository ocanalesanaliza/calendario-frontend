import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    // Mayor que el asyncUtilTimeout de Testing Library (5 s, en src/test/setup.js).
    testTimeout: 15000,
  },
})
