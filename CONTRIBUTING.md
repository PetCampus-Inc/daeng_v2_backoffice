---
title: 기여 가이드
version: 0.1.0
created: 2026-10-22
updated: 2026-10-22
author: 윤정
---

# 기여 가이드

네이밍은 Claude `new-project` 스킬의 `templates/CONTRIBUTING.md`를 기준으로 한다. 이 문서에는 해당 규칙과 이
프로젝트에서 합의한 파일명·배치 규칙을 함께 기록한다. 폴더별 책임과 공유 범위는
[폴더 구조 규칙](apps/web/docs/folder-structure.md)을 따른다.

## 네이밍

### 파일과 폴더

- 파일과 폴더는 kebab-case로 짓는다. 예: `root-layout.tsx`, `page-config.ts`, `profile-panel/`.
- 파일명에는 역할이 드러나게 한다. 예: 화면 설정은 `page.ts`보다 `page-config.ts`로 짓는다.
- 폴더 진입 파일은 `index.ts` 또는 `index.tsx`로 둘 수 있다. 역할은 상위 폴더명으로 드러낸다.
- 프레임워크·도구가 요구하는 파일명은 일반 규칙보다 우선한다. 예: `package.json`, `vite.config.ts`.
- `README.md`, `CONTRIBUTING.md`, `AGENTS.md` 같은 문서명은 해당 관례를 유지한다.
- 현재 앱은 `src/router.tsx`에서 라우트를 직접 연결한다. `root-layout.tsx`는 예약 파일이 아니며, `RootLayout`은 컴포넌트
  이름이다. `route.tsx`도 자동 탐색되는 예약 파일이 아니라 프로젝트의 라우트 진입 파일 관례다.
- 구현과 테스트는 해당 로직 이름의 폴더로 함께 묶는다. 예: `util/profile/index.ts`, `util/profile/profile.test.ts`.
  테스트가 없는 단일 파일은 미리 폴더로 감싸지 않는다.

### 변수와 타입

- 일반 변수와 파라미터는 camelCase로 짓는다. 예: `displayName`, `accountQuery`, `updateAccountMutation`.
- 컴포넌트·타입·인터페이스·클래스는 PascalCase로 짓는다. 예: `RootLayout`, `ProfilePanel`, `MyAccount`.
- 모듈 최상위의 재할당하지 않는 상수 값은 UPPER_SNAKE_CASE로 짓는다. 예: `PAGES`, `DEFAULT_DEV_PROFILES`. 함수 안의
  `const`는 camelCase를 쓴다.
- 함수·훅과 Zod 스키마는 각 역할의 이름을 따른다. 예: `getMyAccount`, `useAuthStore`, `profileFormSchema`. 이는 원본
  템플릿의 함수·훅·스키마 예시를 따른다.
- 상태는 무엇의 상태인지 드러내고, 불리언은 `is`·`has`·`can` 등으로 판정 의미를 표현한다. 예: `isProfileOpen`,
  `isLogoutPending`, `isDisplayNameDuplicate`.

### 함수와 이벤트

- 컴포넌트는 명사형으로 짓는다. 예: `ProfilePanel`, `ProfileFields`.
- 일반 함수는 동작과 대상을 드러낸다. 예: `formatDocumentTitle`, `createPageHandle`, `countCharacters`.
- 판정 함수는 질문 형태로 짓는다. 예: `canAccessPage`, `isValidDisplayName`.
- 사용자 정의 훅은 `use`로 시작한다. 예: `useUpdateMyAccount`.
- 이벤트 핸들러는 `handle` + 동작 + 대상으로 짓는다. 예: `handleSubmitProfile`, `handleClickLogout`.
- 이벤트 핸들러 props는 `on`으로 시작한다. 예: `onSubmit`, `onOpenChange`.
- 라이브러리가 정의한 props·메서드 이름은 변경하지 않는다. 예: `open`, `form.handleSubmit`.

### 서버 통신 함수

실제 HTTP 요청 함수는 HTTP 메서드 + 자원으로 짓는다. Zustand의 상태 변경 함수 등에는 HTTP 메서드를 붙이지 않는다.

| 동작      | 예시               |
| --------- | ------------------ |
| 조회      | `getMyAccount`     |
| 생성      | `postTeamMember`   |
| 전체 수정 | `putTeamMember`    |
| 부분 수정 | `patchMyAccount`   |
| 삭제      | `deleteTeamMember` |

TanStack Query 조회 옵션은 `myAccountQueryOptions`처럼 자원 + `QueryOptions`, 변경 훅은 `useUpdateMyAccount`처럼 `use` +
동작 + 자원으로 구분한다.

## 적용 범위

새 코드와 수정하는 코드에 이 규칙을 적용한다. 이름을 바꿀 때는 import와 사용처도 함께 수정하고, 타입 검사·관련 테스트를
실행한다. 네이밍 정리를 이유로 관계없는 기능이나 동작을 변경하지 않는다.
