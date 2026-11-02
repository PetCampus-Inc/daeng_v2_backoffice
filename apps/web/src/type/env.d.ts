/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Identity Services의 OAuth 클라이언트 ID. 배포 build에서 구글 로그인 버튼을 띄울 때 쓴다. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Sentry 프로젝트의 DSN. 배포 build에서만 쓰며, 비어 있으면 Sentry를 켜지 않는다. */
  readonly VITE_SENTRY_DSN?: string;
}
