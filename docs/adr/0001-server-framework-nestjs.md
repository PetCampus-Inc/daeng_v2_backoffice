---
title: 서버 프레임워크는 NestJS
status: 확정
date: 2026-10-22
---

# 0001. 서버 프레임워크는 NestJS

## 맥락

백오피스에는 구글 로그인·세션, 팀원 계정과 역할, 변경 이력, 알림과 디스코드 연동처럼 서비스 플랫폼(Java)과 무관한 기능이
있다. 서비스 API를 호출할 때 쓸 비밀키도 브라우저에 둘 수 없어서 서버가 필요하다. 서버 담당자는 Node.js 백엔드가
처음이다.

## 결정

Node.js(TypeScript)와 NestJS로 `apps/server`(`@daeng/server`)를 만든다.

## 근거

- 모듈·컨트롤러·서비스 구조가 정해져 있어 담당자가 바뀌어도 코드 구조가 비슷하게 유지된다.
- `@nestjs/swagger`로 OpenAPI 명세를 연동하기 쉽다.
- 프론트와 같은 TypeScript라서 `@daeng/shared`를 같이 쓸 수 있다.
- 인증 가드, 인터셉터(변경 이력 기록), 예외 필터(에러 형식 통일) 같은 필요한 장치가 프레임워크에 있다.

## 검토한 대안

- Fastify 또는 Hono: 가볍고 빠르게 시작하지만 폴더 규칙, 검증, 인증을 직접 설계해야 해서 팀이 커지면 방식이 갈린다.
- Express 단독: 타입 지원과 성능이 아쉽다. NestJS가 기본 엔진으로 Express를 쓰므로 따로 고를 필요가 없다.
- Spring Boot: 서비스 플랫폼은 Java지만, 백오피스는 모노레포에서 TypeScript 타입을 공유하는 이점이 커서 제외했다.

## 결과와 후속

- NestJS의 기본 설정은 CommonJS라서 ESM 소스를 그대로 내보내는 `packages/shared`를 가져다 쓸 수 없다. 서버 세팅 때
  `shared`에 빌드(ESM과 CJS 출력)를 추가한다.
- NestJS 스캐폴딩이 만드는 `.prettierrc`와 Prettier는 쓰지 않는다([ADR 0002](0002-single-formatter.md)).
- 서버 린트 도구는 서버 세팅 때 정한다. oxlint로 시작해 부족하면 서버만 ESLint를 쓴다.
