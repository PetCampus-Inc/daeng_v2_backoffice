# 문의·제안 사용성 회귀 검사

`support-usability.mjs`는 개인 브라우저에 연결하지 않고 headless Chromium과 시나리오별 독립 컨텍스트를 만든다. 개발용
로그인과 기존 MSW 핸들러를 사용하며, 응답 지연·오류만 덧씌운다. 25건 데이터와 경합 상태는 컨텍스트 안에서만 만든다.

저장소 루트에서 별도 터미널에 개발 서버를 실행한다.

```sh
rtk proxy pnpm --filter @daeng/web dev --host 127.0.0.1 --port 5174 --strictPort
```

이미 설치된 Playwright를 사용할 수 있는 환경에서 다음 명령을 실행한다. 기본 모듈 이름은 `playwright`다. 다른 위치에
설치되어 있다면 `PLAYWRIGHT_MODULE_PATH`에 모듈 디렉터리를, 기본 Chromium 대신 기존 실행 파일을 쓸 때는
`PLAYWRIGHT_EXECUTABLE_PATH`에 해당 파일을 지정한다. 새 도구를 자동 설치하지 않는다.

```sh
rtk proxy node --test apps/web/e2e/support-usability.mjs
```

- 서버 주소: `BO_QA_BASE_URL`(기본 `http://127.0.0.1:5174`). 이 검사는 Vite 개발 서버의 MSW 모듈을 사용한다.
- 결과 위치: `BO_QA_OUTPUT_DIR`(기본 `.local/test-results/support`). 다른 위치도 Git 제외된 로컬 폴더를 사용한다.
- 산출물: `results.json`, 시나리오별 스크린샷·trace, 목록 조건 전환 전·진행 중 스크린샷.
- 일부 검사 재실행: `node --test --test-name-pattern='검사 이름' apps/web/e2e/support-usability.mjs`. 전체 결과를
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
