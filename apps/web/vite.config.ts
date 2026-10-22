/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { msw } from 'msw/vite';
import path from 'node:path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  // msw(): 개발 서버에서만 MSW worker 파일을 건네준다. build에는 virtual:msw를 쓰는 코드가 남을 때만 넣는다.
  plugins: [react(), tailwindcss(), msw()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
  },
});
