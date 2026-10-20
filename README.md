# daeng_v2_backoffice

댕v2 백오피스. React 프론트와 Node.js 서버를 한 저장소에서 관리하는 pnpm workspace 모노레포다.

## 구조

```
.
├── apps/
│   ├── web/        # @daeng/web — 백오피스 프론트 (Vite + React + TypeScript)
│   └── server/     # @daeng/server — Node.js API 서버 (프레임워크 선정 전)
├── packages/
│   └── shared/     # @daeng/shared — web·server가 함께 쓰는 타입·상수
├── package.json          # 루트 스크립트 (전체 dev·build·lint)
└── pnpm-workspace.yaml   # 워크스페이스 범위 (apps/*, packages/*)
```

- `packages/shared`는 빌드 없이 `src/index.ts`를 바로 가져다 쓴다.
- 다른 패키지를 의존성으로 쓸 때는 `"@daeng/shared": "workspace:*"`처럼 `workspace:` 프로토콜로 적는다.
- 서버 설정 방법은 [apps/server/README.md](apps/server/README.md)를 본다.

## 요구 사항

- Node.js 22 이상
- pnpm 10 (`corepack enable`을 실행하면 `package.json`의 `packageManager` 버전이 자동으로 쓰인다)

## 실행 방법

```bash
pnpm install   # 모든 패키지의 의존성 설치 (루트에서 한 번)
pnpm dev       # 모든 앱 개발 서버 동시 실행 — web: http://localhost:5173
pnpm build     # 모든 패키지 빌드
pnpm lint      # 모든 패키지 린트 (oxlint)
```

앱 하나만 실행하려면 `--filter`로 패키지를 지정한다.

```bash
pnpm --filter @daeng/web dev
```

의존성은 쓰는 패키지에 추가한다.

```bash
pnpm --filter @daeng/web add <패키지명>
```

## 브랜치 전략

- `main`: 배포 브랜치. `dev` 또는 `hotfix/*`에서 merge commit으로만 들어온다.
- `dev`: 개발 통합 브랜치. 작업 브랜치를 squash merge한다.
- 작업 브랜치: `dev`에서 `feat/*`, `fix/*`, `chore/*` 등으로 만들어 PR을 연다.
