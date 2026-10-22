import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import './index.css';

const queryClient = new QueryClient();

/**
 * 개발 서버에서만 가짜 API(MSW)를 켠다.
 * 동적 import라서 배포 build에는 msw 코드도 worker 파일도 들어가지 않는다.
 * `virtual:msw`는 vite.config.ts의 msw() 플러그인이 만들어 주는 모듈이다.
 */
async function enableMocking() {
  if (!import.meta.env.DEV) return;
  const { network } = await import('virtual:msw');
  const { handlers } = await import('./api/mocks/handlers');
  // 핸들러가 없는 요청(실제 서버, 정적 파일 등)은 그대로 통과시킨다. MSW 3에서 onUnhandledRequest가 이 이름으로 바뀌었다.
  network.configure({ handlers, onUnhandledFrame: 'bypass' });
  await network.enable();
}

// 가짜 API가 준비된 뒤에 그려야 첫 요청부터 가짜 응답을 받는다.
await enableMocking();
// 라우터는 만들자마자 첫 loader(세션 확인 `GET /me`)를 부르므로 가짜 API를 켠 뒤에 불러온다.
const { router } = await import('./router.tsx');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools />
    </QueryClientProvider>
  </StrictMode>
);
