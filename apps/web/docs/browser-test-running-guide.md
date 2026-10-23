# 브라우저 검사 실행 안내

E2E 스크립트는 TypeScript이며 Node.js 22.18 이상에서 `node --test`로 실행한다. Node의 TypeScript 실행은 타입 검사를
수행하지 않으므로, 선택한 시나리오 실행 전에 아래 전용 검사를 사용한다. Vitest 검사와 실행기가 다르다.

```sh
rtk proxy pnpm --filter @daeng/web test:e2e:typecheck
```

웹 패키지의 Playwright 개발 의존성을 사용한다. Chromium은 기존 설치를 사용하고, 필요하면 아래 실행 파일 환경변수로
지정한다. 개인 브라우저 프로필에 연결하지 않는다. 아래 명령은 저장소 루트 기준이다.

검증할 파일과 테스트 이름을 선택해 실행한다. `pnpm --filter @daeng/web test:e2e`는 타입 검사 후 전체 E2E를 실행하므로,
전체 검증이 필요한 작업에서만 사용한다.

## 문의·제안 사용성 회귀 검사

`support-usability.ts`는 개인 브라우저에 연결하지 않고 headless Chromium과 시나리오별 독립 컨텍스트를 만든다. 개발용
로그인과 기존 MSW 핸들러를 사용하며, 응답 지연·오류만 덧씌운다. 25건 데이터와 경합 상태는 컨텍스트 안에서만 만든다.

저장소 루트에서 별도 터미널에 개발 서버를 실행한다.

```sh
rtk proxy pnpm --filter @daeng/web dev --host 127.0.0.1 --port 5174 --strictPort
```

기본적으로 웹 패키지에 설치된 Playwright를 사용한다. 기존 외부 설치는 `PLAYWRIGHT_MODULE_PATH`로 지정할 수 있다. 기본
Chromium 대신 기존 실행 파일을 쓸 때는 `PLAYWRIGHT_EXECUTABLE_PATH`를 지정한다. 새 브라우저를 자동 설치하지 않는다.

```sh
rtk proxy node --test apps/web/e2e/support-usability.ts
```

- 서버 주소: `BO_QA_BASE_URL`(기본 `http://127.0.0.1:5174`). 이 검사는 Vite 개발 서버의 MSW 모듈을 사용한다.
- 결과 위치: `BO_QA_OUTPUT_DIR`(기본 `.local/test-results/support`). 다른 위치도 Git 제외된 로컬 폴더를 사용한다.
- 산출물: `results.json`, 시나리오별 스크린샷·trace, 목록 조건 전환 전·진행 중 스크린샷.
- 일부 검사 재실행: `node --test --test-name-pattern='검사 이름' apps/web/e2e/support-usability.ts`. 전체 결과를
  보존하려면 이때 별도 `BO_QA_OUTPUT_DIR`를 지정한다.

검사 범위는 S-문의-069~076, S-제안-018~023의 목록 전환·입력·실패 복구·목록 복귀·확인창·저장·경합·키보드/화면 폭이다.
1440·1200·1199·390px, 정상·1~2초 지연·500·404·담당 변경/해결 완료 거부를 사용한다.

CDP IME 이벤트는 조합 상태의 회귀를 검사한다. 실제 OS 입력기 체감, 운영 API·앱 알림 전달은 별도 확인해야 한다. 정적
스크린샷만으로 깜빡임 통과를 판정하지 않는다. 전환 중 DOM·요소 위치 검사와 trace 프레임을 함께 확인하고, 화면별 세부
판정·관찰 근거·미확인 조건은 `.local/test-results/`에 남긴다.

계정 전환 중 이전 목록 노출 방지는 각 화면 API 폴더의 Vitest 검사로 확인한다.

```sh
rtk proxy pnpm --filter @daeng/web test
```

## 알림센터

`notifications-usability.mjs`는 개인 브라우저에 연결하지 않는 headless 검사다. 서버 기본 주소는 `http://127.0.0.1:5193`,
결과 기본 경로는 `.local/test-results/notifications/`다. 위와 같은 Playwright 모듈·실행 파일 환경변수를 사용하며 새
브라우저를 설치하지 않는다.

```sh
rtk proxy pnpm --filter @daeng/web dev --host 127.0.0.1 --port 5193 --strictPort
rtk proxy node --test apps/web/e2e/notifications-usability.mjs
```

목록·읽음·모두 읽음·대상 이동·권한/삭제·개인별 읽음·작성 중 이탈 취소/확인·지연/실패 복구·1440/390px·키보드·캐시
재조회를 검사한다. 개발용 앱 이벤트를 통해 새 문의 수신→맡기→추가 문의와 담당 해제 후 알림 미생성, 새 제안·담당자 변경
연결도 검사한다. 수신자·문구 단위 검사는 모의 서버 기준이며 실제 서버·디스코드 전달은 OQ-D12 연동 대기, 해결 완료 문의
클릭은 OQ-P13 확정에 따라 읽음 처리 후 기존 읽기 전용 상세로 이동하는지 검사한다.

## 로그인·세션 통합 회귀

`session-integration.ts`는 `feat/login`·`feat/history`·`feat/terms` 통합으로 연결된 인증을 검사한다. 위와 같은
Playwright 경로 변수를 사용하고 `BO_QA_BASE_URL`에 개발 서버 주소를 지정한다(기본 127.0.0.1:5190).

```sh
rtk proxy node --test apps/web/e2e/session-integration.ts
```

세션 없는 요청·다른 역할의 관리자 헤더 우회 거부, 세션 복구, 변경 이력 필터·지연·실패 복구, 약관 작성 중 세션 만료,
로그인 실패 후 키보드 재로그인(1440/390px)을 검사한다. PNG·trace는 `.local/test-results/session-integration/`에 둔다.
구글 토큰은 개발용 인증으로 대체하므로 실제 구글·쿠키·서버 연동이나 화면별 전체 TC 완료를 뜻하지 않는다.

## 공지 검사

```sh
rtk proxy node --test apps/web/e2e/notices-usability.ts
```

공지 스크립트의 기존 환경변수 `NOTICE_TEST_BASE_URL`, `NOTICE_TEST_OUTPUT_DIR`, `PLAYWRIGHT_MODULE`,
`PLAYWRIGHT_CHROMIUM_PATH`는 유지한다. 결과 기본 위치는 `.local/test-results/notices`다.
