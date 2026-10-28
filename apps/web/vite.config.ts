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
  build: {
    rolldownOptions: {
      preserveEntrySignatures: false,
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          // 편집기 그룹이 React 등 공통 의존성까지 가져가 초기 로딩에 섞이지 않도록 한다.
          includeDependenciesRecursively: false,
          groups: [
            {
              name: 'editor-slate',
              test: /node_modules[/\\](?:slate(?:-[^/]+)?|@platejs[/\\]slate)[/\\]/,
              priority: 30,
            },
            {
              name: 'editor-plate',
              test: /node_modules[/\\](?:platejs|@platejs|@udecode)[/\\]/,
              priority: 20,
              maxSize: 300_000,
            },
            { name: 'react-vendor', test: /node_modules[/\\](?:react|react-dom|scheduler)[/\\]/, priority: 10 },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
});
