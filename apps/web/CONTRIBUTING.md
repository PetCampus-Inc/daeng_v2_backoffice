---
title: 웹 기여 가이드
version: 0.2.0
created: 2026-10-22
updated: 2026-10-22
author: 윤정
---

# 웹 기여 가이드

이 문서는 `apps/web/`의 개발 규칙이다. 모노레포 공통 규칙에 추가되는 웹 전용 규칙만 관리한다.

## 네이밍

### 파일과 폴더

- 폴더 진입 파일은 `index.ts` 또는 `index.tsx`로 둘 수 있다. 역할은 상위 폴더명으로 드러낸다.
- 현재 앱은 `src/router.tsx`에서 라우트를 직접 연결한다. `root-layout.tsx`와 `route.tsx`는 자동 탐색되는 예약 파일이
  아니다. `route.tsx`는 프로젝트의 라우트 진입 파일 관례다.

### 컴포넌트·훅·이벤트

- 컴포넌트는 명사형 PascalCase로 짓는다. 예: `RootLayout`, `ProfilePanel`.
- 사용자 정의 훅은 `use`로 시작한다. 예: `useUpdateMyAccount`. Zod 스키마는 `profileFormSchema`처럼 역할을 드러낸다.
- 이벤트 핸들러는 `handle` + 동작 + 대상, 이벤트 props는 `on`으로 시작한다. 예: `handleSubmitProfile`, `onSubmit`.
- 라이브러리가 정의한 props·메서드 이름은 변경하지 않는다. 예: `open`, `form.handleSubmit`.

### 서버 통신 함수

- 실제 HTTP 요청 함수는 HTTP 메서드 + 자원으로 짓는다. 예: `getMyAccount`, `postTeamMember`, `putTeamMember`,
  `patchMyAccount`, `deleteTeamMember`. Zustand 상태 변경 함수에는 HTTP 메서드를 붙이지 않는다.
- TanStack Query 조회 옵션은 `myAccountQueryOptions`처럼 자원 + `QueryOptions`, 변경 훅은 `useUpdateMyAccount`처럼
  `use` + 동작 + 자원으로 구분한다.

## 공통 동작 변경

- 공통 동작을 변경할 때는 병렬 작업 세션과 담당 파일을 먼저 공유하고 기존 공통 컴포넌트·조회 방식을 확인한다.

## 작업과 브랜치

- 독립적인 화면 작업은 다른 브랜치의 미커밋 변경 정리를 선행 조건으로 삼지 않는다. 요청한 기준 브랜치에서 별도 작업
  공간을 만들어 진행하고 기존 변경을 보존한다.
- 작업 브랜치는 `dev`에서 만들고 `feat/*`, `fix/*`, `chore/*`, `docs/*`처럼 작업 목적을 드러내는 이름을 사용한다. 도구가
  자동으로 붙인 사용자명 접두사도 생성 후 확인하고 규칙과 다르면 바로잡는다.
