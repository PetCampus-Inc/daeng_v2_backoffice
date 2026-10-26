# @daeng/server

백오피스 API 서버(NestJS). 로컬 실행에 필요한 설정과 명령만 적는다. API 동작은
[OpenAPI 명세](../../packages/api-spec/openapi.yaml)를 본다.

## 시작

저장소 루트에서 `pnpm install` 후 Infisical을 설정한다([루트 README](../../README.md#환경변수와-infisical)). 필요한
환경변수와 기본값은 [.env.example](.env.example)에 있다.

```bash
pnpm dev:server
```

기본 포트는 `3000`이다. Infisical 없이 실행할 때는 `apps/server/.env`에 환경변수를 넣고
`pnpm --filter @daeng/server dev`를 실행한다.

## API 문서

`API_DOCS_ENABLED=true`이면 `http://localhost:3000/docs`에서 Swagger UI를 볼 수 있다. 개발 환경에서는
`POST /auth/dev-login`으로 로그인한 뒤 다른 API를 시험한다.

## DB 변경

테이블 정의는 `src/database/schema.ts`, 마이그레이션은 `drizzle/`에 있다. 서버 시작 시 마이그레이션이 자동으로 실행되지
않는다.

```bash
pnpm db:generate # 스키마 변경 후 SQL 생성
pnpm db:migrate  # 대상 DB에 새 마이그레이션 적용
```

이미 적용한 마이그레이션은 수정하지 않고 후속 파일을 만든다. `INITIAL_SUPER_ADMIN_EMAIL`은 없는 이메일을 최고 관리자
계정으로 최초 등록할 때만 사용한다.

## 검사

저장소 루트에서 `pnpm build && pnpm lint && pnpm test && pnpm format:check`를 실행한다.
