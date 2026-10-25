# @daeng/server

NestJS 12 기반 백오피스 API 서버다.

## 준비

- Node.js 22.18 이상, pnpm 10.33.0
- 저장소 루트에서 `pnpm install`
- 환경변수는 Infisical에서 받는다. 설치와 로그인은 [루트 README](../../README.md#환경변수와-infisical)를 본다.

## 실행

```bash
pnpm dev:server   # 저장소 루트에서. Infisical로 환경변수를 받아 시작한다
```

- 기본 포트는 `3000`(`PORT`)이다. 필수 환경변수가 없으면 변수 이름을 알리고 시작하지 않는다.
- 환경변수 목록과 설명은 [.env.example](.env.example)에 있다. 선택 변수는 값을 비우면 설정하지 않은 것과 같다.
- Infisical 없이는 `apps/server/.env`에 직접 적는다. 셸이나 Infisical이 준 값이 `.env`보다 우선한다.
- 새 환경변수를 읽으면 루트 `turbo.json`의 `dev.passThroughEnv`에도 넣는다(빠지면 단위 테스트가 실패한다).

## API 문서(`/docs`)

`API_DOCS_ENABLED=true`이면 `http://localhost:3000/docs`에서 [OpenAPI 명세](../../packages/api-spec/openapi.yaml)를
Swagger UI로 본다. 기본은 꺼짐이고 Infisical `dev`에는 켜져 있다. 운영·스테이징에서는 켜지
않는다([ADR 0013](../../docs/adr/0013-api-docs-served-from-yaml.md)).

- 로그인이 필요한 API는 `개발용` 태그의 `POST /auth/dev-login`에 팀원 이메일을 넣어 먼저 실행한다. 이후 `Try it out`에
  쿠키가 자동으로 붙는다. `ALLOWED_ORIGINS`에 `http://localhost:3000`이 있어야 한다.
- `@scarf/scarf`(사용 통계 설치 스크립트)는 pnpm 10이 막고 있다. `pnpm approve-builds`로 허용하지 않는다.

## BO 전용 DB

서비스 DB와 같은 MySQL 서버의 별도 database와 전용 계정을
쓴다([ADR 0009](../../docs/adr/0009-bff-keep-java-features.md)). ORM은 Drizzle이고 테이블 정의는
`src/database/schema.ts`, 마이그레이션 SQL은 `drizzle/`에 있다.

```bash
pnpm db:generate   # 테이블 정의를 바꾼 뒤: SQL 파일 만들기. 파일을 커밋한다
pnpm db:migrate    # 새 SQL 파일이 있을 때: DB에 적용하기
```

- 적용한 마이그레이션 파일은 고치지 않고 새 파일을 만든다. 서버가 자동으로 마이그레이션하지 않는다(운영은 배포 단계에서
  실행).
- `INITIAL_SUPER_ADMIN_EMAIL`이 있으면 시작할 때 그 이메일을 최고 관리자로 한 번 등록한다.

## 로그인

[ADR 0014](../../docs/adr/0014-auth-details.md), 개발용 로그인은 [ADR 0016](../../docs/adr/0016-dev-login.md)을 따른다.

- API는 `/api/v0/admin` 아래에 있다(`/health`, `/docs` 제외). 새 기능 모듈은 `src/api.module.ts`의 `FEATURE_MODULES`에
  추가한다.
- 모든 API는 로그인이 기본이다. 예외는 `@Public()`, 프로필 설정 전에도 허용할 곳은 `@AllowIncompleteProfile()`을 붙인다.
- 쓰기 요청은 `Origin`이 `ALLOWED_ORIGINS`에 있어야 한다.
- 개발용 로그인(`POST /auth/dev-login`)은 `DEV_LOGIN_ENABLED=true`이고 `COOKIE_SECURE=false`일 때만 켜지며, 같은
  컴퓨터에서 온 요청만 받는다.

## 명세 일치 검사

새 API는 응답이 명세와 맞는지 테스트로 확인한다([ADR 0015](../../docs/adr/0015-spec-contract-tests.md)).

```ts
const contract = await OpenApiContract.load();
const response = await fetch(`${baseUrl}/api/v0/admin/auth/login`, { ... });
await expectMatchesSpec(contract, response, { method: 'post', path: '/auth/login' }); // 경로는 명세의 템플릿
```

- 명세에 없는 상태 코드, 필드 누락·타입·enum 오류, 최상위의 정의에 없는 필드가 있으면 실패한다. 쓰기 API는 `Origin`
  검사로 403이 나올 수 있어 명세에 403을 적는다.
- 개별 API 응답이 아닌 공통 오류는 `contract.checkSchema('Error', body)`로 확인한다.
- 앱·DB를 쓰는 테스트는 `test/integration/`에 둔다(예: `auth-contract.test.ts`, `auth-flow.test.ts`). CI의
  `server-db-test` 작업이 MySQL로 돌린다.

## 검증

```bash
pnpm build && pnpm lint && pnpm test && pnpm format:check
```

- `test:unit`: 순수 로직만. `test:integration`: Nest 앱·실제 DB 사용(DB 값이 없으면 DB 필요한 것만 건너뜀, 로컬은
  `infisical run --env=dev --` 뒤에 실행). `test:smoke`: 빌드 결과(`dist`)를 실행해 확인.
