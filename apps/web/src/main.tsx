import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import './index.css';
import { handleApiError } from './api/handle-api-error';
import { Toaster } from './ui/atoms/sonner';
import { NetworkStatusToasts } from './ui/organisms/network-status-toasts';
import { initSentry } from './util/sentry.ts';

// 라우터와 첫 요청보다 먼저 켜야 시작 단계의 에러도 잡힌다.
initSentry();

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: Record<string, unknown> & {
      errorToast?: { id: string; message: string; ignore?: (error: unknown) => boolean };
    };
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const toast = query.meta?.errorToast;
      if (!toast || !query.isActive() || toast.ignore?.(error)) return;
      void handleApiError(error, { message: toast.message, toastOptions: { id: toast.id } });
    },
  }),
  defaultOptions: {
    // 브라우저 연결 상태와 별개로 실제 요청 결과를 기다린다.
    queries: { networkMode: 'always', refetchOnReconnect: true },
    mutations: { networkMode: 'always' },
  },
});

// 라우터는 만들자마자 첫 loader(세션 확인 `GET /me`)를 부르므로 initSentry() 뒤에 불러온다.
const { router } = await import('./router.tsx');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
      <NetworkStatusToasts />
      <ReactQueryDevtools />
    </QueryClientProvider>
  </StrictMode>
);
