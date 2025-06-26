import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  root: '..',
  server: {
    port: 3000
  },
  resolve: {
    alias: {
      // Map module resolution to the server's node_modules
      '@google/genai': path.resolve(__dirname, 'node_modules/@google/genai'),
      'mermaid': path.resolve(__dirname, 'node_modules/mermaid'),
      'marked': path.resolve(__dirname, 'node_modules/marked'),
      'jszip': path.resolve(__dirname, 'node_modules/jszip'),
      '@google/generative-ai': path.resolve(__dirname, 'node_modules/@google/generative-ai')
    }
  }
})