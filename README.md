# daeng_v2_backoffice

댕v2 백오피스. React 프론트와 Node.js 서버를 한 저장소에서 관리하는 pnpm workspace 모노레포다.

## 구조

```
.
├── apps/
│   ├── web/        # @daeng/web — 백오피스 프론트 (Vite + React + TypeScript)
│   └── server/     # @daeng/server — NestJS API 서버
├── packages/
│   ├── shared/     # @daeng/shared — web·server가 함께 쓰는 타입·상수
│   └── api-spec/   # @daeng/api-spec — OpenAPI 명세(openapi.yaml)
├── package.json          # 루트 스크립트 (전체 dev·build·lint)
└── pnpm-workspace.yaml   # 워크스페이스 범위 (apps/*, packages/*)
```

- `packages/shared`는 ESM·CommonJS로 빌드한 뒤 web·server가 가져다 쓴다.
- 다른 패키지를 의존성으로 쓸 때는 `"@daeng/shared": "workspace:*"`처럼 `workspace:` 프로토콜로 적는다.
- 서버 설정 방법은 [apps/server/README.md](apps/server/README.md)를 본다.
- 공통 규칙은 [모노레포 기여 가이드](CONTRIBUTING.md), 웹 전용 규칙은 [웹 기여 가이드](apps/web/CONTRIBUTING.md)를
  따른다. 프론트 파일 배치는 [폴더 구조 규칙](apps/web/docs/folder-structure.md)을 따른다.

## 요구 사항

- Node.js 22.18 이상
- pnpm 10 (`corepack enable`을 실행하면 `package.json`의 `packageManager` 버전이 자동으로 쓰인다)

## 실행 방법

```bash
pnpm install     # 모든 패키지의 의존성 설치 (루트에서 한 번)
pnpm dev         # shared를 빌드한 뒤 모든 앱 개발 서버 동시 실행 — web: http://localhost:5173, server: http://localhost:3000
pnpm dev:server  # 서버만 실행 (web 없이)
pnpm build       # 모든 패키지 빌드
pnpm lint        # 모든 패키지 린트 (oxlint)
```

`pnpm dev`와 `pnpm dev:server`는 서버가 쓰는 환경변수를 [Infisical](#환경변수와-infisical)에서 받아 실행한다.
Infisical을 쓸 수 없으면 웹만 실행한다.

```bash
pnpm turbo run dev --filter=@daeng/web
```

의존성은 쓰는 패키지에 추가한다.

```bash
pnpm --filter @daeng/web add <패키지명>
```

## 환경변수와 Infisical

서버의 환경변수(DB 접속 정보, 구글 클라이언트 ID 등)는 [Infisical](https://infisical.com)에서 받는다. `pnpm dev`와
`pnpm dev:server`가 `infisical run`으로 값을 넣어 실행하고, 파일은 만들어지지 않는다.

처음 한 번 준비한다.

1. Infisical CLI를 설치하고 로그인한다: `brew install infisical/get-cli/infisical`, `infisical login`. BO 프로젝트 접근
   권한은 서버 담당자에게 받는다(`.infisical.json`은 이미 있다).
2. 로컬 MySQL 8에 BO 전용 database와 계정을 만든다. 이름과 비밀번호는 Infisical `dev`의 `DB_NAME`, `DB_USER`,
   `DB_PASSWORD`와 같게 하고, 그 database에만 권한을 준다.
3. 테이블을 만든다: `pnpm db:migrate`

- 환경변수 목록은 [apps/server/.env.example](apps/server/.env.example)과 [서버 README](apps/server/README.md)에 있다.
- Infisical을 쓸 수 없으면 `apps/server/.env`에 값을 직접 넣어도 된다.
- `infisical secrets`처럼 값을 화면에 출력하는 명령은 쓰지 않는다.

## 브랜치 전략

- `main`: 배포 브랜치. `dev` 또는 `hotfix/*`에서 merge commit으로만 들어온다.
- `dev`: 개발 통합 브랜치. 작업 브랜치를 squash merge한다.
- 작업 브랜치: `dev`에서 `feat/*`, `fix/*`, `chore/*`, `docs/*` 등으로 만들어 PR을 연다.
