# @daeng/server

NestJS 12 기반 백오피스 API 서버다. 현재는 `GET /health`만 제공한다.

## 준비

- Node.js 22.18 이상, pnpm 10.33.0
- 저장소 루트에서 `pnpm install`
- `nest generate`는 Node.js 22.22.3 이상, 24.15 이상 또는 26 이상이 필요하다.

## 실행

```bash
# 저장소 루트
pnpm turbo run dev --filter=@daeng/server

# 빌드 결과 실행
pnpm turbo run build --filter=@daeng/server
pnpm --filter @daeng/server start
```

- 기본 포트는 `3000`이다. `PORT`로 바꾸고, 1~65535의 정수가 아니면 시작하지 않는다.
- 설정은 `apps/server/.env`에 적는다(`cp apps/server/.env.example apps/server/.env`). 파일이 없으면 넘어가고, 커밋되지
  않는다.
- 셸에서 준 값(`PORT=3001 pnpm ...`)이 `.env`보다 우선한다. 운영은 `.env` 대신 배포 환경의 환경 변수를 쓴다.
- 셸 값이 `pnpm turbo run dev`로 전달되려면 루트 `turbo.json`의 `dev.passThroughEnv`에 변수 이름이 있어야 한다. 새 환경
  변수를 추가하면 거기에도 넣는다(빠지면 단위 테스트가 실패한다).

`GET /health`는 `{"status":"ok"}`를 반환한다. `SIGINT`·`SIGTERM`을 받으면 종료 훅을 실행하고 닫는다.

## API 문서(`/docs`)

`API_DOCS_ENABLED=true`로 켜면 [OpenAPI 명세](../../packages/api-spec/openapi.yaml)를 `http://localhost:3000/docs`에서
Swagger UI로 볼 수 있다.

```bash
# apps/server/.env 에 API_DOCS_ENABLED=true 를 적거나, 한 번만 켜기
API_DOCS_ENABLED=true pnpm turbo run dev --filter=@daeng/server
```

- 기본은 꺼짐이다. 꺼져 있으면 `/docs`·`/docs-json`은 404이고, 값은 `true`·`false`만 받는다.
- YAML을 그대로 읽는다([ADR 0003](../../docs/adr/0003-api-spec-first.md)). 명세를 고치면 서버를 다시 켠다.
- `/docs-json`은 열고 `/docs-yaml`은 열지 않는다. 파일이 없거나 OpenAPI 3 문서가 아니면 시작하지 않는다.
- `Try it out`은 꺼져 있다. 구현된 API는 `GET /health`뿐이다.
- 운영·스테이징 공개 여부는 정하지 않았으니 켜지 않는다.
- `@scarf/scarf`(사용 통계 설치 스크립트)는 pnpm 10이 막고 있다. `pnpm approve-builds`로 허용하지 않는다.

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
  `infisical run --env=dev -- pnpm --filter @daeng/server test:integration`

## 로그인

[ADR 0014](../../docs/adr/0014-auth-details.md)를 따른다. 웹이 구글 로그인으로 받은 ID 토큰을
`POST /api/v0/admin/auth/login`에 보내면, 서버가 토큰을 검증하고 등록된 팀원이면 세션 쿠키(`session`)를 내려 준다.
`POST /api/v0/admin/auth/logout`은 세션을 지운다.

- 모든 API는 기본이 로그인 필수다. 로그인하지 않아도 되는 곳에는 `@Public()`을 붙인다(현재 `/health`, 로그인). 첫 로그인
  프로필을 완료하기 전에도 부를 수 있어야 하는 곳에는 `@AllowIncompleteProfile()`을 붙인다(현재 로그아웃).
- API는 `/api/v0/admin` 아래에 있고 `/health`와 `/docs`는 접두어 밖이다. 새 기능 모듈은 `src/api.module.ts`의
  `FEATURE_MODULES`에 추가한다. 전역 접두어(`setGlobalPrefix`)를 쓰면 접두어 밖의 없는 주소가 공통 에러 형식이 아닌 기본
  404로 응답해서 모듈에 접두어를 붙인다.
- 선택 환경변수(`PORT`, `API_DOCS_ENABLED`, `COOKIE_SECURE`)는 값을 비워 두면 설정하지 않은 것과 같다.
- 쓰기 요청(POST·PUT·PATCH·DELETE)은 `Origin`이 `ALLOWED_ORIGINS`에 없거나 없으면 403이다. http·https와 상관없이 항상
  적용된다.
- 계정은 자동으로 만들어지지 않는다. 등록된 이메일만 로그인할 수 있고, 처음 로그인하면 구글 계정 고유 ID를 저장해서 이후
  다른 구글 계정이 같은 이메일로 들어오는 것을 막는다. 세션은 마지막 사용에서 24시간이 지나면 만료되고 요청마다
  연장된다.
- 로그인 성공·실패, 로그아웃, 세션 만료는 `access_log` 테이블에 남는다(추가만 한다).

| 환경변수           | 설명                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `GOOGLE_CLIENT_ID` | 구글 OAuth 웹 클라이언트 ID(`...apps.googleusercontent.com`). 보안 비밀이 아니다.                |
| `ALLOWED_ORIGINS`  | 쓰기 요청을 허용할 웹 주소. 쉼표로 구분하고 경로·끝 슬래시 없이(`http://localhost:5173`) 적는다. |
| `COOKIE_SECURE`    | 쿠키 `Secure` 여부. HTTPS가 아닌 로컬은 `false`, 운영은 `true`. 비우면 `true`다.                 |

## 명세 일치 검사

새 API를 만들 때는 응답이 `packages/api-spec/openapi.yaml`과 맞는지 테스트로
확인한다([ADR 0015](../../docs/adr/0015-spec-contract-tests.md)).

```ts
const contract = await OpenApiContract.load();
const response = await fetch(`${baseUrl}/api/v0/admin/auth/login`, { ... });
await expectMatchesSpec(contract, response, { method: 'post', path: '/auth/login' }); // 경로는 명세의 템플릿
```

- 명세에 없는 상태 코드, 필드 누락·타입·enum 값 오류, 최상위의 정의에 없는 필드가 있으면 이유와 함께 실패한다. 쓰기 요청
  API는 `Origin` 검사 때문에 403이 나올 수 있으니 명세에 403을 적는다.
- 공통 오류처럼 개별 API 응답으로 적히지 않은 본문은 `contract.checkSchema('Error', body)`로 공통 형식만 확인한다.
- DB가 필요 없는 응답은 `test/integration/auth-contract.test.ts`처럼 `test/support/auth-app.ts`로 앱을 띄워 기본
  테스트에서 확인하고, DB가 필요한 응답은 `auth-flow.test.ts`처럼 실제 DB로 확인한다. 후자는 CI의 `server-db-test`
  작업(MySQL 서비스 컨테이너)에서 돈다.
- CI의 DB 작업은 `REQUIRE_DATABASE=true`를 켜서, DB 값이 빠지면 DB 테스트가 조용히 건너뛰어지지 않고 실패한다.
- 로컬에서 DB 테스트를 돌리려면 `infisical run --env=dev -- pnpm --filter @daeng/server test:integration`.

## 검증

```bash
pnpm build && pnpm lint && pnpm test && pnpm format:check
```

- `test:unit`: `src`를 직접 import하는 단위 테스트. DB도 Nest 앱도 없이 순수 로직만 확인하고 빌드가 필요 없다.
- `test:integration`: Nest 앱을 띄우거나 실제 DB를 쓰는 테스트(로그인 흐름, 명세 일치, 최초 관리자 등록). DB
  값(`DB_*`)이 없으면 DB가 필요한 것만 건너뛴다.
- `test:smoke`: 빌드 결과(`dist`)를 실행해 헬스, 잘못된 `PORT`, `SIGTERM` 종료, `/docs`를 검사한다.
