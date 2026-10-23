---
title: 결정 기록(ADR)
version: 0.2.0
created: 2026-10-22
updated: 2026-10-23
---

# 결정 기록(ADR)

기술 결정을 한 건에 한 파일로 남긴다. 파일 이름, 양식, 쓰는 방법은 [ADR 작성 규칙](../rules/adr.md)을 따른다.

## 목록

| 번호                                           | 제목                                         | 상태 |
| ---------------------------------------------- | -------------------------------------------- | ---- |
| [0001](0001-server-framework-nestjs.md)        | 서버 프레임워크는 NestJS                     | 확정 |
| [0002](0002-single-formatter.md)               | 포맷터는 루트 oxfmt 하나                     | 확정 |
| [0003](0003-api-spec-first.md)                 | API는 명세를 먼저 쓴다                       | 확정 |
| [0004](0004-response-and-error-format.md)      | 응답은 감싸지 않고 에러는 통일               | 확정 |
| [0005](0005-pagination.md)                     | 페이지네이션은 page/size                     | 확정 |
| [0006](0006-date-and-time.md)                  | 날짜와 시간은 UTC, 검색은 KST                | 확정 |
| [0007](0007-field-naming-and-null.md)          | 필드 이름과 null 처리                        | 확정 |
| [0008](0008-session-cookie-auth.md)            | 인증은 세션 쿠키                             | 확정 |
| [0009](0009-bff-keep-java-features.md)         | 기존 Java 기능은 이전하지 않고 호출          | 제안 |
| [0010](0010-server-module-and-shared-build.md) | 서버는 ESM으로, shared는 ESM·CommonJS로 빌드 | 확정 |
| [0011](0011-server-lint-test-config-tools.md)  | 서버 린트·테스트·설정 검증 도구              | 확정 |
