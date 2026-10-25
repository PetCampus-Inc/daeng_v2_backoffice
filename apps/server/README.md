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

## BO 전용 DB

BO가 직접 관리하는 데이터(팀원, 세션 등)는 서비스 DB와 같은 MySQL 서버의 별도 database와 전용 계정에 둔다
([ADR 0009](../../docs/adr/0009-bff-keep-java-features.md)). ORM은 Drizzle, 드라이버는 `mysql2`다.

- 접속 값은 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`이고 모두 필수다. 빠졌거나 형식이 틀리면 변수
  이름을 알리고 시작하지 않는다. 계정·비밀번호가 틀린 것은 처음 쿼리할 때 드러난다(최초 관리자 등록이 켜져 있으면 시작할
  때 드러난다). 값은 Infisical에서 받는다(`infisical run --env=dev -- pnpm dev`).
- `INITIAL_SUPER_ADMIN_EMAIL`이 있으면 시작할 때 같은 이메일의 팀원이 없을 때만 최고 관리자로 등록한다(등록됨 상태, 첫
  로그인 때 활성화). 이미 있으면 바꾸지 않는다.
- 테이블 정의는 `src/database/schema.ts`, 마이그레이션 SQL은 `drizzle/`에 있다.

```bash
# 테이블 정의를 바꾼 뒤: SQL 파일 만들기(DB에는 접속하지 않지만 DB_* 변수는 있어야 한다. 파일을 커밋한다)
infisical run --env=dev -- pnpm --filter @daeng/server db:generate
# 새 SQL 파일이 있을 때: DB에 적용하기(이미 적용한 파일은 건너뛴다)
infisical run --env=dev -- pnpm --filter @daeng/server db:migrate
```

- 이미 적용한 마이그레이션 파일은 고치지 않는다. 바꿀 일이 있으면 새 파일을 만든다.
- 서버를 켤 때 자동으로 마이그레이션하지 않는다. 운영은 배포 단계에서 `db:migrate`를 실행한다.
- DB 연결 테스트(`initial-super-admin.test.ts`)는 DB 값이 있을 때만 돈다:
  `infisical run --env=dev -- pnpm --filter @daeng/server test:unit`

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
