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

## 검증

```bash
pnpm build && pnpm lint && pnpm test && pnpm format:check
```

- `test:unit`: `src`를 직접 import하는 단위 테스트. 빌드가 필요 없다.
- `test:smoke`: 빌드 결과(`dist`)를 실행해 헬스, 잘못된 `PORT`, `SIGTERM` 종료, `/docs`를 검사한다.
