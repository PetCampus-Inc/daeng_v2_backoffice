---
title: 폴더 구조 규칙

version: 0.1.0

created: 2026-10-21

updated: 2026-10-21

author: 윤정
---

# 폴더 구조 규칙 (프랙탈 패턴)

이 문서의 `src/`는 `apps/web/src/`다.

`src/` 최상위든, 라우트 폴더든, 컴포넌트 폴더든 — 스코프 크기와 무관하게 같은 분류 규칙이 재귀적으로 반복된다.

**중요: 이 문서는 규칙일 뿐, 스캐폴딩 가이드가 아니다.** 파일이 없는데 규칙에 맞춰 빈 폴더를 미리 만들지 않는다. 실제로
그 목적의 파일이 생기는 시점에, 그 파일에 맞는 폴더를 그때 만든다.

## 분류 폴더 (목적 기준)

같은 스코프에서 파일이 늘어나면 아래 목적별로 분류한다. 이름이 아니라 **목적**이 기준이므로, 훅(`use*`)이든 일반 함수든
형태와 무관하게 목적에 맞는 폴더에 둔다. 폴더명은 모두 단수형으로 통일한다. 단, 라우트를 모아 두는 `src/routes/`는 React
Router 관례를 따라 복수형으로 둔다.

| 폴더     | 목적                               | 비고                                                                 |
| -------- | ---------------------------------- | -------------------------------------------------------------------- |
| `api/`   | 서버와 통신하는 코드 (조회 + 변경) | axios 요청 함수와 TanStack Query 코드(`queryOptions`, `useMutation`) |
| `ui/`    | 화면 렌더링                        | 컴포넌트 트리. 재귀의 기준점                                         |
| `util/`  | 순수 로직/계산                     | 서버 통신이 없는 검증, 변환 등                                       |
| `type/`  | 타입 정의                          |                                                                      |
| `store/` | 클라이언트 상태                    | Zustand store 등. 화면이 공유하는 서버 데이터가 아닌 상태            |

라우트 진입 파일 `route.tsx`는 이 분류 대상이 아니며 라우트 폴더 루트에 둔다. `src/router.tsx`가 이 파일을 가져와 라우트
객체(`createBrowserRouter`)에 연결한다.

단위 테스트가 생기면 해당 로직 이름의 폴더로 구현과 테스트를 함께 묶는다. 예를 들어 `src/util/profile/` 안에
`index.ts`와 `profile.test.ts`를 둔다. 테스트가 없는 단일 파일까지 미리 폴더로 감싸지는 않는다.

## 스코프 3계층

같은 5분류(`api/ui/util/type/store`)가 스코프만 바꿔가며 반복된다. 상위로 갈수록 "더 많은 곳이 공유한다"는 뜻일 뿐, 별도
이름(`lib` 등)을 쓰지 않는다.

```
src/
  api/     ← 앱 전체가 공유하는 서버 통신 (예: client.ts의 axios 인스턴스)
    mocks/ ← 개발 때만 쓰는 가짜 서버(MSW): handlers/, util/
  ui/      ← 앱 전체가 공유하는 컴포넌트. atomic design 적용 (atoms/molecules/organisms/templates)
  util/    ← 앱 전체가 공유하는 순수 로직 (예: cn())
  type/    ← 앱 전체가 공유하는 타입
  store/   ← 앱 전체가 공유하는 클라이언트 상태
  router.tsx   ← 라우트 객체 정의. 각 라우트의 route.tsx를 연결
  routes/
    <route>/
      route.tsx           ← 라우트 진입 파일, 분류 대상 아님
      api/
        queries.ts        (조회: axios 요청 함수 + queryOptions)
        mutations.ts      (생성/수정/삭제: axios 요청 함수 + useMutation)
      util/
        validation/
          index.ts
          validation.test.ts
      type/
        <type>.ts
      ui/
        <component>/
          index.tsx
          api/             ← 재귀: 이 컴포넌트 전용 통신
          ui/               ← 재귀: 이 컴포넌트 전용 하위 컴포넌트
          util/             ← 재귀: 이 컴포넌트 전용 로직/훅
          type/             ← 재귀: 이 컴포넌트 전용 타입
        <component>/
```

`ui/` 하위의 각 컴포넌트 폴더는 필요한 경우에만 자체 `api/ui/util/type/store/`를 갖는다. 하위 구분이 필요 없으면 그냥
단일 파일로 둔다.

`src/api/`, `src/util/`, `src/type/`, `src/store/`처럼 최상위로 승격된 코드는 이미 "앱 전체가 쓰는 것"이 된 상태이므로,
그 안에서 도메인별 하위 폴더로 다시 나누지 않는다. 도메인 구분이 필요한 동안은 아직 그 도메인의 라우트 폴더 하위에
있어야 한다는 뜻이다. 단, 개별 로직의 구현과 테스트를 함께 묶는 폴더는 허용한다.

## 공유 승격 규칙

파일/로직이 실제로 더 넓은 스코프에서 필요해지는 시점에만 상위로 승격한다. 미리 승격시키지 않는다.

- **한 컴포넌트 안 하위끼리만 공유** → 그 컴포넌트 폴더의 `util/` 등에 유지
- **한 라우트 안 형제 `ui/` 컴포넌트가 공유** → 그 라우트의 `api/` / `util/` 등으로 승격
- **여러 라우트가 공유** → `src/api/` / `src/ui/` / `src/util/` / `src/type/` / `src/store/`로 승격

## `src/ui/`의 atomic design

- `src/ui/`에만 atomic 4단계(`atoms/molecules/organisms/templates`)를 적용한다. `pages`는 각 라우트의 `route.tsx`가
  대신하므로 두지 않는다.
- 라우트 전용 `ui/`(각 `routes/**/ui/`)와 컴포넌트 내부 재귀 `ui/`에는 atomic 구분을 적용하지 않는다. 이름 기반 재귀
  구조만 사용한다.
- `components.json`의 shadcn `"ui"` 별칭은 `"@/ui/atoms"`를 가리키도록 한다 (shadcn CLI가 이 위치에 설치).
