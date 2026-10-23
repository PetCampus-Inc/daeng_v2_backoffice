---
title: 응답은 감싸지 않고 에러는 통일
status: 확정
date: 2026-10-22
---

# 0004. 응답은 감싸지 않고 에러는 통일

## 맥락

성공 응답을 감쌀지, 에러 본문을 어떤 모양으로 줄지 정해야 프론트가 공통 처리 코드(axios, 에러 처리)를 만들 수 있다.
`apps/web`은 기존 앱 API의 OpenAPI 문서를 기준으로 `{ data, status, code, message, responseTime }` 래퍼와
`{ status, code, message, errorMessage }` 에러를 가정하고 만들어져 있다.

## 결정

- 성공 응답은 감싸지 않고 그대로 반환한다. 성공과 실패는 HTTP 상태 코드로 구분한다.
- 에러 본문은 `{ code, message, details? }`다. `details`는 입력 검증 실패에서만 `[{ field, reason }]`로 채운다.
- `code`는 대문자 스네이크 케이스다(`USER_NOT_FOUND`).
- 사용하는 HTTP 상태 코드는 400, 401, 403, 404, 409, 500이다.

## 근거

- 성공 응답: 상태 코드가 이미 성공과 실패를 말하므로 래퍼는 중복이다. TanStack Query는 4xx와 5xx를 자동으로 에러로
  다루고, NestJS는 기본 동작이 비래핑이라 추가 코드가 없다. orval이 만드는 타입이 도메인 타입 그대로다.
- 에러: 프론트에 `react-hook-form`과 `zod` 기반 폼이 많아서 필드별 에러를 서버에서 받을 수 있으면 편하다. `code`로
  분기하면 메시지 문구가 서버에 묶이지 않는다. 에러 스키마 하나를 명세에서 재사용할 수 있다.

## 검토한 대안

- 항상 `{ success, data }`로 감싸기: 상태 코드와 중복되고, HTTP 200에 `success: false`를 주는 안티패턴으로 흐르기 쉽다.
  NestJS에 인터셉터를 직접 만들어 관리해야 한다.
- NestJS 기본 에러 형태(`statusCode`, `message`, `error`): `message`가 문자열일 때와 배열일 때가 있어 프론트가 매번
  분기해야 한다.
- RFC 9457(Problem Details): 표준이지만 이 규모에는 과하다.

## 결과와 후속

- NestJS 예외 필터 하나로 모든 예외를 이 형식으로 변환한다.
- `apps/web`의 `src/type/api.ts`, 가짜 API 응답 생성기, `.data.data`로 응답을 읽는 요청 함수를 고쳐야 한다
  ([api-conventions.md](../api-conventions.md)의 "현재 웹 구현과의 차이" 참고). 프론트 담당자와 합의가 필요하다.
