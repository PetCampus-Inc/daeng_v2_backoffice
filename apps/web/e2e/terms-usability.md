# 이용약관 회귀 검사

`terms-usability.mjs`는 기존 Playwright 설치를 사용한다. 개인 브라우저에 연결하지 않고 headless Chromium과 시나리오별
격리 컨텍스트를 만든다.

개발 서버:

```sh
rtk proxy pnpm --filter @daeng/web dev --host 127.0.0.1 --port 5186 --strictPort
```

별도 터미널에서 검사한다. 기본 경로로 찾을 수 없으면 기존 설치 경로를 지정한다.

```sh
rtk proxy env PLAYWRIGHT_MODULE_PATH=/absolute/path/to/playwright PLAYWRIGHT_EXECUTABLE_PATH=/absolute/path/to/chromium node --test apps/web/e2e/terms-usability.mjs
```

- `BO_QA_BASE_URL`: 기본 `http://127.0.0.1:5186`.
- `BO_QA_OUTPUT_DIR`: 기본 `.local/test-results/terms`. 스크린샷과 중간 프레임을 포함한 trace를 시나리오별로 저장한다.
- 20개 시나리오: 목록·종류·역순 응답·재시도·초안/공개/삭제/철회·권한·경합·전송 오류·KST
  경계·이탈·beforeunload·1440/1200/1199/390px·키보드·CDP 조합 입력.
- CDP 조합 검사는 실제 OS IME·모바일 키보드 검증을 대신하지 않는다.
- 종류별 버전 번호와 일반 텍스트 본문은 개발용 계약이다. S-약관-008, S-약관-032(OQ-P4), S-약관-038 실제 앱 반영은 이
  검사로 확정하지 않는다.

규칙 검사는 `rtk proxy pnpm --filter @daeng/web test`로 실행한다.
