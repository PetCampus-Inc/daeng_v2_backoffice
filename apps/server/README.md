# @daeng/server

NestJS 12 기반 백오피스 API 서버다. 현재는 실행 환경과 `GET /health`만 제공한다.

## 준비

- Node.js 22.18 이상 또는 지원되는 최신 LTS, pnpm 10.33.0
- 저장소 루트에서 `pnpm install`

NestJS CLI의 코드 생성 명령(`nest generate`)은 Node.js 22.22.3 이상, 24.15 이상 또는 26 이상이 필요하다. 서버 실행과
빌드는 22.18 이상에서 가능하다(shared 빌드 도구 tsdown의 요구 버전).

## 실행

```bash
# 저장소 루트
pnpm turbo run dev --filter=@daeng/server

# 개발 서버와 별개로 빌드 결과 실행
pnpm turbo run build --filter=@daeng/server
pnpm --filter @daeng/server start
```

기본 포트는 `3000`이다. 다른 포트가 필요하면 `PORT=3001 pnpm turbo run dev --filter=@daeng/server`처럼 지정한다.
`PORT`는 1부터 65535까지의 정수여야 하며, 시작할 때 Zod 스키마로 검사한다. 잘못된 값이면 시작하지 않는다.
`.env.example`은 설정값 예시이며 자동으로 읽지 않는다.

서버가 시작되면 `GET http://localhost:3000/health`는 `{"status":"ok"}`를 반환한다. `SIGINT`나 `SIGTERM`을 받으면 NestJS
종료 훅을 실행하고 서버를 닫는다.

## 검증

```bash
pnpm turbo run build --filter=@daeng/server
pnpm --filter @daeng/server lint
pnpm --filter @daeng/server test
pnpm build
pnpm lint
pnpm test
pnpm format:check
```

서버 테스트는 Vitest로 두 가지로 나눈다.

- `pnpm --filter @daeng/server test:unit`: `src`를 직접 import하는 단위 테스트(포트 설정 검증). 빌드가 필요 없다.
- `pnpm --filter @daeng/server test:smoke`: shared와 서버를 빌드한 뒤 빌드 결과(`dist`)로 헬스 요청, 잘못된 `PORT`의
  시작 실패, `@daeng/shared` import, `SIGTERM` 종료를 검사한다.

`test`는 둘을 차례로 실행한다. `@daeng/shared`는 ESM·CommonJS 출력물을 빌드하며, 루트 빌드에서는 Turbo가 shared를 의존
앱보다 먼저 빌드한다.
