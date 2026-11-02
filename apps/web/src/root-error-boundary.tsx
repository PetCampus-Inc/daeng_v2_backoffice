import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';

import { ListState } from '@/ui/molecules/list-state';

/**
 * 렌더링·loader 에러가 났을 때 보여 주는 최상위 에러 화면. 하얀 화면 대신 [다시 시도]를 준다.
 * 라우터가 에러를 삼키므로 여기서 Sentry로 직접 보낸다. 응답 형태 에러(404 등)는 정상 흐름이라 보내지 않는다.
 */
function RootErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    if (!isRouteErrorResponse(error)) Sentry.captureException(error);
  }, [error]);

  return (
    <main className='flex min-h-screen items-center justify-center'>
      <ListState kind='error' onAction={() => window.location.reload()} />
    </main>
  );
}

export default RootErrorBoundary;
