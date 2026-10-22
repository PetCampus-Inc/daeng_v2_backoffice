/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Identity Services의 OAuth 클라이언트 ID. 배포 build에서 구글 로그인 버튼을 띄울 때 쓴다. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
