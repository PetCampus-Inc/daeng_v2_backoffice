---
title: 웹이 API 주소를 직접 호출
status: 확정
date: 2026-11-26
---

# 0020. 웹이 API 주소를 직접 호출

## 맥락

지금까지 웹과 API는 같은 주소로 묶었다. CloudFront가 `{웹 주소}/api/*`를 서버로 넘기고, 서버는 CORS를 열지 않았다
([ADR 0018](0018-bo-server-deploy.md)). 쿠키는 `SameSite=Lax`로 고정했다([ADR 0014](0014-auth-details.md)).

이 방식에서는 로컬(`localhost`)에서 띄운 웹이 개발 서버 API를 부를 수 없다. 프론트가 로컬에서 개발 서버 API로 시험할 수
있도록 웹이 서버 주소를 직접 부르는 방식으로 바꾸자고 요청했다.

## 결정

- **호출 방식**: 웹이 서버 주소(`https://bo.knockdog.net`, 개발 `https://dev-bo.knockdog.net`)의 `/api/v0/admin`을 직접
  부른다. ADR 0018의 "웹과 API를 같은 주소로 묶는다"와 "CORS를 열지 않는다", ADR 0019의 "개발 웹은 CloudFront `/api/*`로
  묶는다"를 대체한다.
- **CORS**: 서버가 `ALLOWED_ORIGINS`에 있는 주소만 허용한다. 쓰기 요청 `Origin` 검사와 같은 목록이다. `credentials`를
  켜서 쿠키를 보낼 수 있게 하고, 메서드는 `GET POST PUT PATCH DELETE`, 헤더는 `Content-Type`만 허용한다. 사전
  요청(OPTIONS) 결과는 10분 동안 다시 쓴다.
- **SameSite**: `COOKIE_SAME_SITE`(`lax` 기본, `none`)로 정한다. `none`은 `COOKIE_SECURE=true`일 때만 서버가 시작한다.
  ADR 0014의 "`SameSite=Lax` 고정"을 대체한다.
- **환경별 값**

  | 환경             | `ALLOWED_ORIGINS`                                           | `COOKIE_SAME_SITE` |
  | ---------------- | ----------------------------------------------------------- | ------------------ |
  | 운영 (`prod`)    | `https://backoffice.knockdog.net`                           | `lax`(기본)        |
  | 개발 (`staging`) | `https://dev.backoffice.knockdog.net,http://localhost:8080` | `none`             |

- **배포 전 검사**: 배포 서버에서는 `COOKIE_SECURE=false`와 `lax`·`none` 밖의 `COOKIE_SAME_SITE`를 막는다.

## 근거

- `backoffice.knockdog.net`과 `bo.knockdog.net`은 둘 다 `knockdog.net`이라 브라우저가 같은 사이트로 본다. 운영은
  `SameSite=Lax`로도 쿠키가 붙는다.
- `localhost`와 `dev-bo.knockdog.net`은 다른 사이트다. 쿠키가 붙으려면 `SameSite=None; Secure`가 필요하다.
- CSRF 방어는 쓰기 요청 `Origin` 검사가 그대로 맡는다. 다른 사이트에서 보낸 쓰기 요청은 쿠키가 붙어도 `Origin`이 목록에
  없어 403이다. 읽기 요청은 상태를 바꾸지 않고, 목록에 없는 주소는 CORS 때문에 응답을 읽지 못한다.
- 허용 목록을 하나로 두면 CORS와 `Origin` 검사가 어긋나지 않는다.

## 검토한 대안

- 같은 주소 유지 + 로컬은 Vite 프록시로 개발 서버에 연결: 서버 변경이 없지만 프론트가 택하지 않았다.
- 개발 서버도 `SameSite=Lax`: `localhost`에서 부를 때 쿠키가 붙지 않아 목적을 이루지 못한다.

## 결과와 후속

- 운영 쿠키의 주인이 `backoffice.knockdog.net`에서 `bo.knockdog.net`으로 바뀌어, 웹 변경을 배포하면 모두 한 번 다시
  로그인한다. CloudFront의 `/api/*` 분기는 웹 변경이 운영에 반영된 뒤 지운다.
- 개발 서버의 `SameSite=None` 쿠키는 다른 사이트의 쿠키(서드파티 쿠키)로 취급된다. 이를 막는 브라우저(Safari 기본 설정
  등)에서는 `localhost`에서 로그인이 유지되지 않을 수 있다. 브라우저별 동작은 직접 시험하지 않았다.
- 개발 서버에서는 개발자 PC의 `localhost:8080`에 뜬 어떤 페이지든 개발 서버 세션으로 요청할 수 있다. 개발 서버라
  받아들인다.
- 웹이 요청에 다른 헤더(예: Sentry `sentry-trace`, `baggage`)를 붙이게 되면 허용 헤더에 추가해야 한다.
