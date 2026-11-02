---
title: 서버는 ESM으로, shared는 ESM·CommonJS로 빌드
status: 확정
date: 2026-10-23
---

# 0010. 서버는 ESM으로, shared는 ESM·CommonJS로 빌드

## 맥락

[ADR 0001](0001-server-framework-nestjs.md)은 서버를 NestJS로 정하고, 당시 기본 CommonJS 구성을 전제로 `@daeng/shared`의
ESM·CommonJS 출력을 후속 작업으로 남겼다. 이번 서버 세팅에서는 NestJS 12를 사용한다. NestJS 12는 핵심 패키지가 ESM이고
새 프로젝트에서 ESM 구성을 선택할 수 있다. 웹은 ESM으로 `@daeng/shared`를 사용한다.

## 결정

- `apps/server`는 ESM(`type: module`, TypeScript `NodeNext`)으로 빌드한다.
- `packages/shared`는 tsdown으로 ESM·CommonJS와 각각의 타입 선언을 빌드하고, 조건부 export로 노출한다.
- 서버와 웹의 패키지 의존성은 `workspace:*`로 연결한다. Turbo의 `^build`로 shared를 먼저 빌드한다.
- 런타임 최소 Node.js 버전은 NestJS 12와 shared 빌드 도구(tsdown) 요구사항에 맞춰 22.18로 올린다. CLI 코드 생성에는 더
  높은 버전이 필요하다.

## 근거

- 서버를 ESM으로 두면 NestJS 12와 웹의 모듈 형식에 맞고, CommonJS에서 ESM 패키지를 불러오는 호환 경로에 의존하지 않는다.
- shared는 두 출력 형식을 제공해 다른 Node.js 소비자가 CommonJS를 사용해도 패키지 경계를 유지할 수 있다.
- 빌드 결과의 실제 파일명(`.mjs`, `.cjs`, `.d.mts`, `.d.cts`)을 export에 명시하면 Node.js와 TypeScript가 같은 형식을
  선택한다.

## 검토한 대안

- 서버를 CommonJS로 빌드: NestJS 12에서 가능하지만 ESM 패키지를 `require(esm)` 호환 경로로 읽어야 한다.
- shared를 ESM으로만 빌드: 현재 두 앱에는 충분하지만 ADR 0001의 후속 요구와 맞지 않아 채택하지 않았다.
- TypeScript 컴파일러를 두 번 실행: 가능하지만 출력 확장자와 타입 선언의 모듈 형식을 별도로 관리해야 한다.

## 결과와 후속

- 서버 실행과 검증 명령은 [서버 실행 안내](../../apps/server/README.md)에 기록한다.
- 새 Node.js 소비자가 shared를 추가할 때 ESM·CommonJS import가 모두 동작하는지 확인한다.

참고: [NestJS 12 마이그레이션 가이드](https://docs.nestjs.com/migration-guide),
[tsdown 다중 출력 문서](https://tsdown.dev/options/output-format).
