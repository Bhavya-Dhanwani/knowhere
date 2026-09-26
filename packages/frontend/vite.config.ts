import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router'],
          tanstack: ['@tanstack/react-query'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          motion: ['motion']
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api/chat': {
        target: process.env.VITE_CHAT_SERVICE_URL || 'http://localhost:5007',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: process.env.VITE_CHAT_SERVICE_URL || 'http://localhost:5007',
        ws: true,
        changeOrigin: true,
        secure: false
      },
      '/api/review': {
        target: process.env.VITE_REVIEW_SERVICE_URL || 'http://localhost:5006',
        changeOrigin: true,
        secure: false
      },
      '/api/coding': {
        target: process.env.VITE_CODING_SERVICE_URL || 'http://localhost:5005',
        changeOrigin: true,
        secure: false
      },
      '/api/questions': {
        target: process.env.VITE_MCQ_SERVICE_URL || 'http://localhost:5004',
        changeOrigin: true,
        secure: false
      },
      '/api/resources': {
        target: process.env.VITE_MEDIA_SERVICE_URL || 'http://localhost:5003',
        changeOrigin: true,
        secure: false
      },
      // covers both /api/course/* (authoring & content) and /api/courses/*
      '/api/course': {
        target: process.env.VITE_COURSE_SERVICE_URL || 'http://localhost:5002',
        changeOrigin: true,
        secure: false
      },
      '/api/profile': {
        target: process.env.VITE_USER_SERVICE_URL || 'http://localhost:5001',
        changeOrigin: true,
        secure: false
      },
      '/api/memberships': {
        target: process.env.VITE_USER_SERVICE_URL || 'http://localhost:5001',
        changeOrigin: true,
        secure: false
      },
      '/api/competencies': {
        target: process.env.VITE_USER_SERVICE_URL || 'http://localhost:5001',
        changeOrigin: true,
        secure: false
      },
      '/api/auth': {
        target: process.env.VITE_AUTH_SERVICE_URL || 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:80',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
