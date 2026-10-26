---
title: 서버 린트·테스트·설정 검증 도구
status: 확정
date: 2026-10-23
---

# 0011. 서버 린트·테스트·설정 검증 도구

## 맥락

[ADR 0001](0001-server-framework-nestjs.md)은 서버 린트 도구를 서버 세팅 때 정하기로 했다(oxlint로 시작, 부족하면 서버만
ESLint). 서버 세팅에서 테스트 도구와 환경변수 검증 방식도 함께 정해야 했다. NestJS 12 패키지는 ESM 전용이고, Jest가 이를
`require()`로 불러오려면 Node.js 24.9 이상이 필요하다는 안내가 릴리스 노트에
있다([ADR 0010](0010-server-module-and-shared-build.md)의 최소 버전은 22.18이다).

## 결정

- 린트: 서버도 oxlint를 쓴다. 기본 규칙에 더해 `no-unused-vars`·`no-debugger`는 에러, `no-console`은 경고(`warn`·`error`
  호출 허용)로 둔다. 웹의 설정은 복사하지 않고 서버에 필요한 규칙만 고른다.
- 테스트: Vitest를 쓴다. 단위 테스트(`test:unit`)는 `src`를 직접 import하고, 통합 테스트(`test:integration`)는 Nest
  앱이나 실제 DB를 쓰며([ADR 0015](0015-spec-contract-tests.md)), 스모크 테스트(`test:smoke`)는 shared와 서버를 빌드한
  뒤 빌드 결과(`dist`)의 시작·종료·헬스를 검사한다.
- 설정 검증: Zod 스키마로 환경변수를 시작 시 검사하고, 잘못된 값이면 서버를 띄우지 않는다. 읽기 함수는 기능 폴더마다
  둔다(`src/config.ts`, `database/database.config.ts`, `auth/auth.config.ts`).

## 근거

- oxlint는 이미 웹이 쓰고 있어 도구가 늘지 않는다. 기본값에서는 `no-unused-vars`와 `no-debugger`가 경고라서 CI가 막지
  못하므로 에러로 올린다.
- Jest는 ESM 전용 NestJS 12를 읽으려면 Node 24.9 이상을 요구해 최소 버전 22.18과 맞지 않는다. Vitest는 웹과 같은
  도구이고 Node 22.12 이상을 지원한다. NestJS 12 릴리스 노트도 ESM 프로젝트의 기본 테스트 러너로 Vitest를 안내한다.
- 순수 로직은 빌드 없이 빠르게, 시작 실패·종료·헬스는 실제 빌드 결과로 확인하면 각 테스트가 검증할 대상이 분명하다.
- 환경변수 검증은 값 범위와 오류 메시지를 스키마 한 곳에서 관리할 수 있다.

## 검토한 대안

- Jest: 위 Node 버전 조건 때문에 제외했다. 최소 버전을 24.9로 올리면 웹 개발자 전원의 환경에 영향을 준다.
- Node 내장 테스트 러너: 의존성이 없지만 TypeScript 소스를 바로 테스트하지 못하고 웹과 도구가 달라진다.
- 서버만 ESLint: 지금은 부족하다는 근거가 없어 도입하지 않았다.
- 웹 린트 규칙 복사: `react/*`처럼 서버에 맞지 않는 규칙이 딸려 오고 스타일 규칙(`curly`, `id-length`)은 팀 합의가
  필요해 제외했다.

## 결과와 후속

- 소스를 직접 테스트하는 Nest 모듈 테스트는 생성자 주입 정보(`emitDecoratorMetadata`)를 Vitest가 처리하지 못하므로,
  주입이 필요한 서비스가 생길 때 SWC 도입과 함께 판단한다.
- 타입 정보 기반 린트(`no-floating-promises` 등)는 서버에 비동기 로직이 생기면 oxlint `--type-aware`가 이 저장소에서
  동작하는지 확인한 뒤 도입 여부를 정한다. 부족하면 ADR 0001대로 서버만 ESLint를 쓴다.
- 환경변수가 늘면 기능 폴더마다 `<기능>.config.ts`에 읽기 함수를 둔다(예: `auth/auth.config.ts`). 앱 전체 설정(포트,
  문서)만 `src/config.ts`에 남긴다. 시작할 때 오류를 하나씩만 발견하는 점이 불편해지면 전체를 한꺼번에 검증하는 단계를
  둔다.
- 테스트 파일이 `.ts`가 되면 타입 검사가 필요한지(테스트용 `tsconfig` 또는 `tsc --noEmit`) 판단한다.

참고: [NestJS 12 릴리스 노트](https://newreleases.io/project/github/nestjs/nest/release/v12.0.0)(공식 마이그레이션
가이드는 확인하지 못했다).
