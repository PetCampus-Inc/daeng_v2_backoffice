---
title: 1:1 문의 API (읽기·쓰기)
status: 구현 완료, 리뷰 대기
created: 2026-10-28
updated: 2026-10-28
---

# 1:1 문의 API (읽기·쓰기)

## 목표와 범위 (범위 밖 포함)

- 목표: 명세(`packages/api-spec/openapi.yaml`)의 `/inquiries/**`를 BO 서버에 구현한다. 읽기는 서비스 DB를 읽기 전용으로
  직접 조회하고, 쓰기(맡기·해제·해제 취소·답변)는 Java 문의 운영 API를
  호출한다([ADR 0009](../adr/0009-bff-keep-java-features.md)). 쓰기가 성공하면 변경 이력을 남긴다.
- Java 쪽 API는 `daeng_v1_back`의 `KD3-648-inquiry-assignee-reply-api` 브랜치에 있다(`/api/v0/platform-admin/inquiries`,
  `X-Backoffice-Api-Key` 헤더).
- 범위 밖: BO 알림·디스코드(KD3-649), 사용자 앱 알림, 아이디어 제안(KD3-653), 이미지 원본
  다운로드(`/inquiries/{id}/images/{imageId}/original`)와 HEIC·HEIF 변환본(서버 변환 여부 미확정).

## 단계 (체크리스트 + 완료 기준)

- [x] 명세에 입력 오류(400) 응답 보정 — `pnpm api:lint`가 통과한다.
- [x] 계약 테스트 작성 — `test/integration/inquiries.test.ts`가 구현 전에 모듈을 찾지 못해 실패한다(red).
- [x] 서비스 DB 읽기 연결과 시험용 테이블 — `SERVICE_DB_*` 설정을 읽고 읽기 전용 풀을 만든다.
- [x] 읽기 API(목록·담당자 후보·상세·이전다음) — 해당 계약 테스트가 통과한다.
- [x] Java 호출 클라이언트와 쓰기 API(맡기·해제·해제 취소·답변), 변경 이력 — 해당 계약 테스트가 통과한다.
- [x] 전체 검사 — `pnpm build && pnpm lint && pnpm test && pnpm format:check`, DB 환경에서
      `pnpm --filter @daeng/server test:integration`.

## 검증 기록 (항목 / 실행 명령 / 결과)

| 항목                        | 실행 명령                                                        | 결과                                    |
| --------------------------- | ---------------------------------------------------------------- | --------------------------------------- |
| 명세 문법                   | `pnpm api:lint`                                                  | 통과                                    |
| 기존 DB 통합 테스트(기준선) | `pnpm --filter @daeng/server test:integration` (임시 MySQL 8.0)  | 44 통과, 1 건너뜀                       |
| 문의 계약 테스트(읽기·쓰기) | `vitest run test/integration/inquiries.test.ts` (임시 MySQL 8.0) | 24개 통과                               |
| 서버 통합 테스트 전체       | `vitest run test/integration` (임시 MySQL 8.0)                   | 68 통과, 1 건너뜀(DB 없을 때 도는 가드) |
| 빌드·린트·단위·스모크       | `nest build`, `oxlint src test`, `test:unit`, `test:smoke`       | 통과(62개, 17개)                        |
| 명세·서식                   | `redocly lint`, `oxfmt --check`                                  | 통과                                    |

## 남은 결정·후속 작업

- Java 호출과 변경 이력 기록은 서로 다른 DB라 한 트랜잭션이 아니다. 이력 기록이 실패하면 100ms, 300ms 간격으로 2번 더
  시도하고, 그래도 실패하면 요청은 성공으로 응답하고 서버 로그(error)에 문의 ID·행위자 ID·행동·전후 값을 남긴다. 이
  로그를 보고 `change_logs`를 손으로 채운다. 실패로 응답하지 않는 이유는 운영자가 다시 눌러 답변이 중복되는 것을 막기
  위해서다. 로그를 모아 알려 주는 알림은 아직 없다(로그를 보는 사람이 있어야 의미가 있다).
- 맡기의 이력 종류(최초 맡기 / 담당자 변경)는 호출 전에 읽은 담당자로 정한다. 그 사이 담당자가 바뀐 경쟁 상황에서는 이력
  종류가 실제와 다를 수 있다. 본인이 이미 담당자인 문의를 다시 맡으면 이력을 남기지 않는다.
- 답변은 Java 쪽에 중복 방지가 없다. 더블 클릭 방지는 화면(BO 웹)이 맡는다.
- 사용자 이름의 출처: 서비스 DB에 문의자 이름이 한 곳에 없다. 임시로 `social_user.name`을 쓰고, 없으면
  `user.nickname`이다. 원장 이름 기준이 따로 있는지 확인한다.
- 운영자 답변의 작성자: Java가 운영자 답변을 저장할 때 `inquiry_message.author_member_id`를 채우도록 했다(Java 커밋
  `4b456884`). 이 열이 만들어지기 전 답변이나 팀원이 사라진 답변은 `authorName`이 '운영자'로 나온다.
- 해제 취소를 변경 이력에 남기는 방식: PRD에 없다. 임시로 `INQUIRY_ASSIGNED`로 기록한다.
- Java 호출 실패(5xx·연결 실패)는 공통 500으로 응답한다. 별도 오류 코드가 필요한지 정한다.
- 이미지 URL은 `INQUIRY_IMAGE_BASE_URL` + S3 키로 만든다. 원본 다운로드(임시 주소)와 HEIC 변환은 후속이다.
- 서비스 DB 읽기 전용 계정 발급과 배포 환경 변수(`SERVICE_DB_*`, `JAVA_API_BASE_URL`, `JAVA_API_KEY`,
  `INQUIRY_IMAGE_BASE_URL`) 등록.

## 변경 기록 (날짜 — 무엇을 → 무엇으로, 이유)

- 2026-10-28 — 변경 이력 기록 실패 시 재시도(2회)와 실패 로그를 추가 → Java 쓰기를 되돌릴 수 없어 이력만 빠지는 경우를
  줄이고, 남은 경우는 로그로 보완한다. 실패해도 요청은 성공으로 응답한다(접속 기록과 같은 방식).

- 2026-10-28 — 쓰기 API 구현: 답변 검증 실패는 일반 검증 오류(`VALIDATION_FAILED`)가 아니라 명세의 전용 코드
  `INQUIRY_REPLY_INVALID`로 응답 → 컨트롤러에서 본문을 직접 검증한다.
- 2026-10-28 — 서버 시작 때 `SERVICE_DB_*`, `JAVA_API_*`, `INQUIRY_IMAGE_BASE_URL`을 요구하도록 함 → 스모크 테스트
  환경과 `.env.example`, turbo 통과 목록에 추가. DB 설정과 같은 방식(시작 때 검증)이다.
- 2026-10-28 — 오래된순 정렬의 계약 테스트 기대값을 수정 → 명세가 "같으면 ID 내림차순"이라 같은 시각이면 ID가 큰 문의가
  먼저다.
- 2026-10-28 — 문의 API의 400 응답을 명세에 추가 — 계약 테스트가 정의되지 않은 상태 코드를 오류로 보기 때문이다.
