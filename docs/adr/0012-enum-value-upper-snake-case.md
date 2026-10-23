---
title: enum 값은 UPPER_SNAKE_CASE 영어
status: 확정
date: 2026-10-23
---

# 0012. enum 값은 UPPER_SNAKE_CASE 영어

## 맥락

[ADR 0007](0007-field-naming-and-null.md)이 enum 값 표기(`ACTIVE` 또는 `active`)를 첫 명세 작성 전에 정하기로 남겼다.
역할, 문의 상태, 공지 상태, 약관 상태, 계정 상태처럼 enum이 많은 명세를 쓰기 전에 정해야 한다. 프론트 담당자는 API 명세
검토에서 대문자를 선호하고, 값은 영어로 두고 화면 문구는 프론트가 한국어로 매핑하는 방식을 제안했다.

## 결정

- enum 값은 영어 UPPER_SNAKE_CASE다(`ACTIVE`, `WAITING_REPLY`).
- 화면에 보이는 한국어 문구는 프론트가 값에서 매핑한다. API 값에는 표시 문구를 넣지 않는다.
- API enum은 OpenAPI 명세가 원천이다. `@daeng/shared`에 같은 enum을 따로 정의하지 않는다.

## 근거

- 서버 코드의 상수 표기와 같아서 변환 없이 쓴다. 필드 이름(camelCase)과 값이 시각적으로 구분된다.
- 값이 표시 문구에 의존하지 않으면 문구를 바꿔도 API가 깨지지 않는다. 에러 `code`를 문구와 분리한 이유
  ([ADR 0004](0004-response-and-error-format.md))와 같다.
- 프론트와 서버가 합의한 방향이다.

## 검토한 대안

소문자(`active`) 값: 업계에 단일 표준이 없고 일관성이 중요한데, 서버 상수와 표기가 달라져 변환이 필요하다.

## 결과와 후속

- `packages/shared`의 `JOB_ROLES`(`'PM'`, `'UX/UI'`, `'FE'`, `'BE'`, `'풀스택'`)는 화면 표시용 문구다. API에 직무 enum이
  생기면 API 값을 UPPER_SNAKE_CASE로 따로 정하고 두 개념을 합치지 않는다.
- 에러 `code`를 명세에서 enum이나 리터럴 타입으로 표현할지는 명세 작성 때 정한다. 이 ADR의 범위가 아니다.
