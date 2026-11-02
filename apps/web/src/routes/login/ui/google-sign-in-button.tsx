import { useEffect, useRef } from 'react';

import { showErrorToast } from '@/ui/atoms/sonner';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/** Google Identity Services에서 이 화면이 쓰는 부분만 적은 타입. 전체 타입 패키지는 설치하지 않았다. */
type GoogleCredentialResponse = { credential: string };
type GoogleAccountsId = {
  initialize: (config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: 'outline';
      size: 'large';
      text: 'signin_with';
      shape: 'rectangular';
      logo_alignment: 'left';
      locale: string;
    }
  ) => void;
};
type GoogleWindow = Window & { google?: { accounts: { id: GoogleAccountsId } } };

let gisScriptPromise: Promise<GoogleAccountsId> | null = null;

/** 구글 로그인 스크립트를 한 번만 불러온다. 실패하면 다음 화면 진입 때 다시 시도한다. */
function loadGoogleIdentity() {
  gisScriptPromise ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const accountsId = (window as GoogleWindow).google?.accounts.id;
      if (accountsId) resolve(accountsId);
      else reject(new Error('Google Identity Services를 불러오지 못했습니다.'));
    };
    script.onerror = () => reject(new Error('Google Identity Services를 불러오지 못했습니다.'));
    document.head.append(script);
  }).catch((error: unknown) => {
    gisScriptPromise = null;
    throw error;
  });
  return gisScriptPromise;
}

/**
 * 구글이 그리는 [Google 계정으로 로그인] 버튼(OQ-D4 B안, S-로그인-001).
 * 흰 배경 `outline`, 나머지는 구글 기본값(large·signin_with·rectangular·로고 왼쪽), 한국어.
 * 계정을 고르면 구글이 준 ID 토큰을 onCredential로 넘긴다. 구글 창에서 취소하면 아무 일도 없다(R-로그인판정-07).
 * 클라이언트 ID는 `VITE_GOOGLE_CLIENT_ID`로 받는다. 없으면 버튼을 그리지 않는다.
 */
export function GoogleSignInButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);

  useEffect(() => {
    onCredentialRef.current = onCredential;
  });

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    let isActive = true;
    loadGoogleIdentity()
      .then((accountsId) => {
        if (!isActive || !containerRef.current) return;
        accountsId.initialize({
          client_id: clientId,
          callback: (response) => onCredentialRef.current(response.credential),
        });
        accountsId.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          locale: 'ko',
        });
      })
      .catch(() => {
        if (isActive) showErrorToast('일시적 오류로 요청을 완료하지 못했습니다.');
      });
    return () => {
      isActive = false;
    };
  }, []);

  // 구글 large 버튼 높이(40)만큼 자리를 먼저 잡아 버튼이 그려질 때 아래 글이 밀리지 않게 한다.
  return <div ref={containerRef} className='flex min-h-10 justify-center' />;
}
