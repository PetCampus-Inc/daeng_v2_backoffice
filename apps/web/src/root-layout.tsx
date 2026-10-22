import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';
import { Outlet } from 'react-router';

import { Toaster } from '@/ui/atoms/sonner';

/** 모든 화면을 감싸는 최상위 레이아웃. nuqs는 라우터 훅을 쓰므로 라우터 안에 둔다. 토스트는 여기 한 번만 둔다. */
function RootLayout() {
  return (
    <NuqsAdapter>
      <Outlet />
      <Toaster />
    </NuqsAdapter>
  );
}

export default RootLayout;
