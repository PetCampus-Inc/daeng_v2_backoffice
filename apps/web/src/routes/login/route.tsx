import axios from 'axios';
import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useGoogleLogin } from '@/api/auth';
import { useAuthStore, type LoginNotice } from '@/store/auth';
import { Logo } from '@/ui/atoms/logo';
import { showErrorToast } from '@/ui/atoms/sonner';
import { cn } from '@/util/cn';
import { formatDocumentTitle, PAGES } from '@/util/page-config';
import { GoogleSignInButton } from '@/routes/login/ui/google-sign-in-button';

/**
 * 개발 서버(가짜 API)에서만 구글 버튼 대신 쓰는 개발용 계정 고르기.
 * main.tsx의 MSW처럼 `import.meta.env.DEV`로 막은 동적 import라 배포 build에는 코드가 들어가지 않는다.
 */
const DevAccountPicker = import.meta.env.DEV ? lazy(() => import('@/routes/login/ui/dev-account-picker')) : null;

/** 안내 박스 문구와 색(PRD 7.1). 빨간 박스는 바로 알리고, 파란 박스는 상태로 알린다. */
const LOGIN_NOTICES: Record<LoginNotice, { message: string; role: 'alert' | 'status'; className: string }> = {
  denied: {
    message: '접근 권한이 없는 계정입니다. 관리자에게 문의해 주세요.',
    role: 'alert',
    className: 'border-kd-error-border bg-kd-error-background text-kd-error-foreground',
  },
  expired: {
    message: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
    role: 'status',
    className: 'border-kd-info-border bg-kd-info-background text-kd-info-foreground',
  },
};

/**
 * 로그인 화면(PRD 7.1). 사이드바·상단바 없이 가운데 한 덩어리:
 * 로고 + 'BO' → (있을 때) 안내 박스 → [Google 계정으로 로그인] → 회색 안내 한 줄.
 * 로그인하면 원래 가려던 주소(없으면 홈)로 간다. 첫 로그인이면 AppLayout이 프로필 설정으로 보낸다.
 */
export default function LoginRoute() {
  const user = useAuthStore((state) => state.user);
  const loginNotice = useAuthStore((state) => state.loginNotice);
  const showLoginNotice = useAuthStore((state) => state.showLoginNotice);
  const location = useLocation();
  const googleLoginMutation = useGoogleLogin();

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? PAGES.home.path} replace />;
  }

  /** 구글(개발 서버에서는 개발용 계정 고르기)이 준 ID 토큰으로 로그인한다. 로그인 중 다시 누른 것은 무시한다. */
  const handleCredential = (credential: string) => {
    if (googleLoginMutation.isPending) return;
    googleLoginMutation.mutate(credential, {
      onError: (error) => {
        // 미등록·비활성·등록 취소는 모두 같은 빨간 박스다(R-로그인판정-04~06).
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          showLoginNotice('denied');
          return;
        }
        showErrorToast('일시적 오류로 요청을 완료하지 못했습니다.');
      },
    });
  };

  const notice = loginNotice ? LOGIN_NOTICES[loginNotice] : null;

  return (
    <main className='flex min-h-svh items-center justify-center bg-kd-surface px-4 py-8'>
      <title>{formatDocumentTitle('로그인')}</title>
      <div className='flex w-full max-w-[360px] flex-col gap-5'>
        {/* 로고 높이 32 → 8 → 'BO'(16, 진한 글자색). 시안 그대로 */}
        <h1 aria-label='똑독 BO' className='flex items-center gap-2'>
          <Logo className='h-8' />
          <span className='text-kd-title-3 tracking-normal'>BO</span>
        </h1>
        {notice && (
          <div role={notice.role} className={cn('rounded-kd-3 border px-3.5 py-3 text-kd-body', notice.className)}>
            {notice.message}
          </div>
        )}
        {DevAccountPicker ? (
          <Suspense>
            <DevAccountPicker disabled={googleLoginMutation.isPending} onCredential={handleCredential} />
          </Suspense>
        ) : (
          <GoogleSignInButton onCredential={handleCredential} />
        )}
        <p className='text-kd-caption text-kd-foreground-muted'>등록된 팀원 계정만 로그인할 수 있습니다.</p>
      </div>
    </main>
  );
}
