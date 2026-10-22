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

## 화면 작업의 사용성 검증과 완료 기준

화면을 만들거나 상호작용을 수정하면 기능 결과와 사용성을 함께 검증한다. 특정 구현 방식(예: 표 유지, 스켈레톤 사용)을
모든 화면에 강제하지 않는다. 사용자가 조작을 시작한 순간부터 완료·실패·복구까지 겪는 흐름을 기준으로 판단한다.

구현 전에 변경 화면의 진입·탭·검색·페이지·저장·모달·뒤로 가기 등 해당되는 상호작용을 나열하고, 아래 항목별로 위험이 있는
지점을 찾아 화면별 TC에 구체화한다. 적용하지 않는 항목은 이유를 적는다.

| 점검 관점        | 사용자 입장에서 확인할 것                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------- |
| 시각적 연속성    | 깜빡임, 빈 화면 노출, 로딩 표시의 순간 점멸, 콘텐츠·버튼 위치의 불필요한 이동이 없는가      |
| 반응과 진행 상태 | 클릭·입력이 즉시 반영되고, 기다리는 이유와 완료·실패 여부를 알 수 있는가                    |
| 조작의 연속성    | 입력값·커서·포커스·스크롤이 예기치 않게 초기화되거나 다른 위치로 이동하지 않는가            |
| 상태의 일관성    | 선택된 조건·표시 데이터·건수·버튼 상태가 서로 모순되지 않고 마지막 조작의 의도를 반영하는가 |
| 실패와 복구      | 오류를 이해하고 재시도·취소할 수 있으며 입력한 내용이나 작업 맥락을 불필요하게 잃지 않는가  |
| 조작 가능성      | 키보드·좁은 화면에서도 필요한 동작에 접근할 수 있고 가림·잘림·중복 실행 문제가 없는가       |

격리된 headless Playwright로 정상 속도와 지연 응답(1~3초), 첫 방문과 재방문, 빠른 연속 조작, 실패·복구를 해당되는
범위에서 확인한다. 완료 후 정적 스크린샷만 확인하지 않고 전환 중 DOM·위치·포커스 등의 관찰이나 영상·연속 프레임으로 중간
상태도 확인한다. 도구로 판정하기 어려운 지각적 품질은 브라우저 확인 결과로 별도 남긴다.

사용성 검증은 개발 완료를 보고하기 전에 마친다. CI는 이후 변경의 회귀를 자동 감지하는 보조 수단이며 개발 중 검증을
대신하지 않는다. 실행 결과와 스크린샷·trace 등 관찰 자료는 Git에서 제외되는 `.local/test-results/`에 보관한다. 공유
문서에는 TC·검증 기준을, 공유 코드에는 재실행 가능한 검사를 남긴다.

다음을 완료 조건으로 한다.

- 화면별 TC에 해당 상호작용의 준비 조건, 조작, 진행 중·완료 후 기대 결과를 기록한다.
- 자동 판정 가능한 회귀 항목은 재실행 가능한 테스트로 남기고, 브라우저 확인이 필요한 항목은 관찰 근거를 남긴다.
- 결과에는 `항목 / 통과·실패·미확인·해당 없음 / 근거 또는 사유`를 기록한다. 실패를 수정하고, 미확인을 통과로 보고하지
  않는다. 테스트 도구가 없거나 실행이 막혔으면 제한과 남은 검증을 명시한다.
- 타입 검사·단위 테스트 통과를 사용성 검증의 근거로 대신하지 않는다.

세부 작성 방식은 [TC 가이드](apps/web/docs/tc/README.md)를 따른다. 공통 동작을 변경할 때는 병렬 작업 세션과 담당 파일을
먼저 공유하고 기존 공통 컴포넌트·조회 방식을 확인한다.
