---
title: API 공통 규약
version: 0.1.1
created: 2026-10-22
updated: 2026-10-26
---

# API 공통 규약

OpenAPI 명세를 쓰기 전에 프론트와 서버가 합의하는 공통 규칙이다. 서버 담당자가 정한 안이고, 프론트 담당자와의 합의
전이다. 각 규칙의 근거는 [ADR](adr/README.md)에 있다.

## 현재 웹 구현과의 차이

`apps/web`의 가짜 API(MSW)와 타입(`src/type/api.ts`)은 기존 앱 API(`/api/v0/platform-admin`)의 OpenAPI 문서를 기준으로
만들어져 있다. 이 규약을 채택하면 아래를 고쳐야 한다.

| 항목      | 현재 웹이 가정한 것                                    | 이 규약                                    |
| --------- | ------------------------------------------------------ | ------------------------------------------ |
| 성공 응답 | `{ data, status, code, message, responseTime }`로 감쌈 | 감싸지 않음                                |
| 에러      | `{ status, code, message, errorMessage }`              | `{ code, message, details? }`              |
| 페이지    | `page` 0부터, `totalElements`, `hasNext`               | `page` 1부터, `totalItems`, `hasNext` 없음 |
| 시각      | 오프셋 미확정(가짜 API에 `Z`와 `+09:00`이 섞여 있음)   | ISO 8601 UTC                               |

영향받는 파일은 `src/type/api.ts`, `src/api/mocks/util/response.ts`, 가짜 API 핸들러, `.data.data`로 응답을 읽는 요청
함수와 라우트 파일(약 16개)이다. 아직 구현되지 않은 화면에는 영향이 없다.

## 1. 성공 응답

응답을 `{ data: ... }` 같은 래퍼로 감싸지 않고 그대로 반환한다. 성공과 실패는 HTTP 상태 코드로 구분한다.

```json
{ "id": "1", "name": "홍길동", "jobRole": "PM", "nickname": null }
```

근거: [ADR 0004](adr/0004-response-and-error-format.md)

## 2. 에러 응답

HTTP 상태 코드로 실패를 알리고, 본문은 아래 형식으로 통일한다.

```json
{ "code": "USER_NOT_FOUND", "message": "사용자를 찾을 수 없습니다." }
```

입력 검증 실패에서만 `details`를 채운다. 다른 에러에는 `details`가 없다.

```json
{
  "code": "VALIDATION_FAILED",
  "message": "입력값이 올바르지 않습니다.",
  "details": [{ "field": "email", "reason": "잘못된 이메일 주소" }]
}
```

- `code`는 대문자 스네이크 케이스다(`USER_NOT_FOUND`). 프론트는 `message` 문구가 아니라 `code`로 분기한다.
- 사용하는 HTTP 상태 코드: 400(입력 오류), 401(미인증), 403(권한 없음), 404(없음), 409(상태 충돌), 500(서버 오류)

근거: [ADR 0004](adr/0004-response-and-error-format.md)

## 3. 페이지네이션

목록은 page/size 방식이다.

- 요청: `GET /users?page=2&size=20`
- `page`는 1부터 시작한다. `size`의 기본값은 20, 최대값은 100이다.
- 응답:

```json
{ "items": [], "page": 2, "size": 20, "totalItems": 153, "totalPages": 8 }
```

정렬과 검색 조건은 현재 웹이 쓰는 파라미터를 따른다(`keyword`, `status`, `userType`, `sort=latest|oldest` 등). 새 화면도
같은 방식으로 맞춘다.

근거: [ADR 0005](adr/0005-pagination.md)

## 4. 날짜와 시간

| 구분                        | 형식           | 예시                                        |
| --------------------------- | -------------- | ------------------------------------------- |
| 시각                        | ISO 8601 UTC   | `2026-10-22T05:30:00Z`(밀리초 `.000Z` 허용) |
| 날짜만 있는 값(생년월일 등) | `YYYY-MM-DD`   | `2026-10-22`                                |
| 요청(쿼리 파라미터 포함)    | 위와 같은 형식 |                                             |

- 화면에 보여 줄 한국 시간 변환은 프론트가 한다.
- 날짜로 검색하거나 집계할 때는 `Asia/Seoul` 기준이다. 날짜 필터는 `YYYY-MM-DD`로 보내고 종료일을 포함한다. 예를 들어
  `createdTo=2026-10-22`는 10/22 하루 전체를 포함한다. 서버는 시작일 00:00 KST 이상, 종료일 다음 날 00:00 KST 미만으로
  처리한다.
- 일별 통계도 한국 시간 하루 기준이다.

근거: [ADR 0006](adr/0006-date-and-time.md)

## 5. 필드 이름

- 필드 이름은 camelCase다.
- 약어는 첫 글자만 대문자로 쓴다: `userId`, `apiKey`(`userID` 아님)
- 불리언은 `is`나 `has`로 시작한다: `isActive`, `hasPermission`
- enum 값은 영어 UPPER_SNAKE_CASE다: `ACTIVE`, `WAITING_REPLY`. 화면 문구는 프론트가 매핑한다.

근거: [ADR 0007](adr/0007-field-naming-and-null.md), [ADR 0012](adr/0012-enum-value-upper-snake-case.md)

## 6. null과 필드 생략

- 응답: 필드를 생략하지 않는다. 값이 없으면 `null`이다. 빈 문자열(`""`)과 `null`을 같은 뜻으로 쓰지 않는다.
- 요청(PATCH): 보내지 않은 필드는 변경하지 않고, `null`을 보낸 필드는 값을 삭제한다.

```text
PATCH /users/1
{ "nickname": "새닉네임" }   // phone은 그대로 둔다
{ "phone": null }            // phone을 삭제한다
```

근거: [ADR 0007](adr/0007-field-naming-and-null.md)

## 7. 인증

- 구글 로그인 후 서버 세션과 HttpOnly 쿠키로 인증 상태를 유지한다.
- 프론트는 axios에 `withCredentials: true`를 설정한다. 토큰을 직접 저장하거나 헤더에 붙이지 않는다.
- 세션이 만료되거나 계정이 비활성화되면 서버가 세션을 바로 무효화한다.
- 서버 API는 `/api/v0/admin` 아래에 있다. 프론트와 서버의 주소는 `/api` 프록시로 같은 출처처럼 맞춘다(설정은 프론트와
  배포 작업에서 한다).
- 로그인은 웹이 구글 로그인으로 받은 ID 토큰을 `POST /auth/login`에 보내는 방식이다.
- 세션은 요청이 없는 채로 24시간이 지나면 만료되고, 요청할 때마다 연장된다.
- 쓰기 요청(POST·PUT·PATCH·DELETE)은 `Origin`이 허용된 웹 주소가 아니면 403이다.
- 첫 로그인 프로필(표시명·직무)을 설정하기 전에는 `/me`, 프로필 저장, 로그아웃 외의 API가 403 `PROFILE_INCOMPLETE`다.

근거: [ADR 0008](adr/0008-session-cookie-auth.md), [ADR 0014](adr/0014-auth-details.md)

## 8. API 계약 방식

- OpenAPI(YAML) 명세를 먼저 작성하고, 프론트와 서버가 각자 구현한다.
- 프론트는 orval로 요청 함수, 타입, TanStack Query 훅, mock을 생성할 수 있다.
- 명세 변경은 명세 PR을 먼저 머지한 뒤 각자 구현한다.
- API 요청·응답 타입의 원천은 명세다. 같은 타입을 `packages/shared`에 따로 정의하지 않는다.
- 상태를 바꾸는 동작은 현재 웹이 쓰는 방식을 따라 하위 리소스로 호출한다(예: 맡기 `POST /inquiries/:id/assignee`, 담당
  해제 `DELETE /inquiries/:id/assignee`). 새 화면도 같은 방식으로 맞춘다.
- 프론트는 BO 서버만 호출한다. 기존 Java 기능은 BO 서버가 호출해 이 규약의 형식으로 변환한다.
- 서버 응답이 명세와 같은지는 서버 테스트가 확인한다. 새 API는 성공·오류 응답을 명세와 대조하는 테스트를 같이 쓴다.

근거: [ADR 0003](adr/0003-api-spec-first.md), [ADR 0009](adr/0009-bff-keep-java-features.md),
[ADR 0015](adr/0015-spec-contract-tests.md)

## 9. 아직 정하지 않은 것

- 없음.
