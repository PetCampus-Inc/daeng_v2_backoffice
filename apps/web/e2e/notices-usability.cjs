// Use an isolated Playwright browser; never connect to an existing browser profile.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE_URL = process.env.NOTICE_TEST_BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = process.env.NOTICE_TEST_OUTPUT_DIR || path.resolve('.local/test-results/notices');
const RESULTS = [];

async function check(name, run) {
  const evidence = await run();
  RESULTS.push({ name, result: '통과', evidence: evidence ?? null });
  process.stdout.write(`PASS: ${name}\n`);
}

async function installListDelay(page) {
  await page.evaluate(async () => {
    const { network } = await import('/@id/__x00__virtual:msw');
    const { http } = await import('/node_modules/.vite/deps/msw.js');
    window.__noticeMode = { delay: 1200, fail: false };
    window.__noticeRequests = [];
    network.use(
      http.get('/api/v0/platform-admin/notices', async ({ request }) => {
        const keyword = new URL(request.url).searchParams.get('keyword') ?? '';
        const entry = { keyword, finished: false };
        window.__noticeRequests.push(entry);
        const delay = keyword === '점' ? 1800 : keyword === 'TEST' ? 600 : window.__noticeMode.delay;
        await new Promise((resolve) => setTimeout(resolve, delay));
        entry.finished = true;
        if (window.__noticeMode.fail) {
          return new Response(
            JSON.stringify({ status: 500, code: 'TEST_ERROR', message: '검증용 오류', errorMessage: '검증용 오류' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      })
    );
  });
}

async function observeTable(page) {
  await page.evaluate(() => {
    window.__noticeObservation?.disconnect();
    window.__noticeContinuity = { tableLost: false, skeletonShown: false };
    window.__noticeObservation = new MutationObserver(() => {
      if (!document.querySelector('table')) window.__noticeContinuity.tableLost = true;
      if (document.querySelector('[data-slot=list-state][role=status]')) window.__noticeContinuity.skeletonShown = true;
    });
    window.__noticeObservation.observe(document.querySelector('[data-slot=card]'), { childList: true, subtree: true });
  });
}

async function assertContinuity(page) {
  assert.deepEqual(await page.evaluate(() => window.__noticeContinuity), { tableLost: false, skeletonShown: false });
}

async function waitIds(page, ids) {
  await page.waitForFunction(
    (expected) =>
      JSON.stringify([...document.querySelectorAll('tbody tr td:first-child')].map((el) => el.textContent)) ===
      JSON.stringify(expected),
    ids
  );
}

async function login(page, role = '운영자', pathname = '/notices') {
  await page.goto(`${BASE_URL}${pathname}`);
  await page.getByRole('radio', { name: role, exact: true }).click();
  await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).click();
}

async function selectStatus(page, name) {
  await page.getByRole('combobox', { name: '상태', exact: true }).click();
  await page.getByRole('option', { name, exact: true }).click();
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await check('S-공지-065 최초 진입의 로딩과 완료', async () => {
      await page.goto(`${BASE_URL}/notices`);
      await page.getByRole('radio', { name: '운영자', exact: true }).waitFor();
      await installListDelay(page);
      await page.getByRole('radio', { name: '운영자', exact: true }).click();
      await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).click();
      await page.locator('[data-slot=list-state][role=status]').waitFor();
      assert.equal(await page.getByText(/^총 \d+건$/).count(), 0);
      assert.equal(await page.locator('[data-slot=pagination]').count(), 0);
      await page.getByText('총 5건', { exact: true }).waitFor();
      await waitIds(page, ['#14', '#13', '#12', '#11', '#10']);
      return { delayMs: 1200, initialSkeleton: true, finalCount: 5 };
    });

    await check('S-공지-065 미방문 상태·재방문 전환의 시각적 연속성', async () => {
      await observeTable(page);
      for (const [status, ids] of [
        ['초안', ['#14', '#13']],
        ['게시', ['#12', '#10']],
        ['게시 해제', ['#11']],
      ]) {
        const before = await page.locator('table').boundingBox();
        await selectStatus(page, status);
        await page.getByText('조회 중…', { exact: true }).waitFor();
        const during = await page.locator('table').boundingBox();
        assert.equal(during.y, before.y);
        assert.equal(during.height, before.height);
        assert.equal(await page.locator('[data-slot=card][aria-busy=true]').count(), 1);
        assert.equal(await page.getByText(/^총 \d+건$/).count(), 0);
        await waitIds(page, ids);
        await page.getByText(`총 ${ids.length}건`, { exact: true }).waitFor();
        await assertContinuity(page);
      }
      await selectStatus(page, '전체');
      await waitIds(page, ['#14', '#13', '#12', '#11', '#10']);
      await assertContinuity(page);
      return await page.evaluate(() => window.__noticeContinuity);
    });

    await check('S-공지-066/067 검색 초점·커서와 빠른 전환의 마지막 의도', async () => {
      const search = page.getByRole('searchbox', { name: '검색', exact: true });
      await search.fill('점');
      await page.waitForFunction(() => window.__noticeRequests.some((item) => item.keyword === '점'));
      await search.fill('TEST');
      await page.getByText('조회 중…', { exact: true }).waitFor();
      assert.deepEqual(
        await search.evaluate((el) => ({
          focused: el === document.activeElement,
          value: el.value,
          cursor: el.selectionStart,
        })),
        { focused: true, value: 'TEST', cursor: 4 }
      );
      await waitIds(page, ['#10']);
      await page.waitForFunction(() => window.__noticeRequests.some((item) => item.keyword === '점' && item.finished));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await waitIds(page, ['#10']);
      await page.getByText('총 1건', { exact: true }).waitFor();
      assert.equal(await search.evaluate((el) => document.activeElement === el), true);
      await assertContinuity(page);
      await page.evaluate(() => window.__noticeObservation.disconnect());
      return { firstDelayMs: 1800, lastDelayMs: 600, finalId: 10, focusPreserved: true, cursor: 4 };
    });

    await check('S-공지-067 조회 실패·재시도·빈 결과 복구', async () => {
      await page.evaluate(() => {
        window.__noticeMode = { delay: 50, fail: true };
      });
      const search = page.getByRole('searchbox', { name: '검색', exact: true });
      await search.fill('점검');
      await page.getByText('데이터를 불러오지 못했습니다.', { exact: true }).waitFor();
      assert.equal(await search.inputValue(), '점검');
      assert.equal(await page.getByText(/^총 \d+건$/).count(), 0);
      await page.evaluate(() => {
        window.__noticeMode.fail = false;
      });
      await page.getByRole('button', { name: '다시 시도', exact: true }).click();
      assert.equal(await search.evaluate((el) => document.activeElement === el), true);
      await waitIds(page, ['#12']);
      await search.fill('없는말');
      await page.getByText('검색 결과가 없습니다.', { exact: true }).waitFor();
      await page.getByText('총 0건', { exact: true }).waitFor();
      await page.evaluate(() => {
        window.__noticeMode.delay = 1200;
      });
      await search.fill('이벤트');
      await page.getByText('조건에 맞는 공지를 조회하고 있습니다.', { exact: true }).waitFor();
      assert.equal(await page.getByText('검색 결과가 없습니다.', { exact: true }).count(), 0);
      assert.equal(await search.evaluate((el) => document.activeElement === el), true);
      await waitIds(page, ['#14']);
      await page.getByRole('button', { name: '필터 초기화', exact: true }).first().click();
      assert.equal(await search.evaluate((el) => document.activeElement === el), true);
      await waitIds(page, ['#14', '#13', '#12', '#11', '#10']);
      return {
        failureStatus: 500,
        preservedKeyword: '점검',
        recoveredId: 12,
        noResultsCount: 0,
        retryAndResetFocus: '검색',
        emptyToPendingMessage: true,
      };
    });

    await check('S-공지-065/066 미방문 페이지의 위치·스크롤·키보드 복귀', async () => {
      await page.evaluate(() =>
        localStorage.setItem(
          'daeng-bo-mock-notices',
          JSON.stringify(
            Array.from({ length: 25 }, (_, index) => ({
              id: 101 + index,
              status: 'published',
              title: `공지 ${String(index + 1).padStart(2, '0')}`,
              body: { schemaVersion: 1, blocks: [{ type: 'paragraph', children: [{ text: '페이지 검증 본문' }] }] },
              createdAt: new Date(Date.UTC(2026, 8, index + 1)).toISOString(),
              publishedAt: new Date(Date.UTC(2026, 8, index + 1)).toISOString(),
              updatedAt: new Date(Date.UTC(2026, 8, index + 1)).toISOString(),
              revision: 1,
            }))
          )
        )
      );
      await page.goto(`${BASE_URL}/notices`);
      await page.getByText('총 25건', { exact: true }).waitFor();
      await installListDelay(page);
      await observeTable(page);
      const button = page.getByRole('button', { name: '2', exact: true });
      await button.focus();
      const before = await page.locator('table').boundingBox();
      const scroll = await page.evaluate(() => scrollY);
      await page.keyboard.press('Enter');
      await page.getByText('조회 중…', { exact: true }).waitFor();
      assert.equal(await page.locator('tbody tr').count(), 20);
      assert.equal(await button.evaluate((el) => document.activeElement === el), true);
      assert.equal(await page.locator('[data-slot=pagination] button:not([aria-disabled=true])').count(), 0);
      await page.keyboard.press('Enter');
      assert.equal(new URL(page.url()).searchParams.get('page'), '2');
      assert.equal(await page.evaluate(() => scrollY), scroll);
      const during = await page.locator('table').boundingBox();
      assert.equal(during.y, before.y);
      assert.equal(during.height, before.height);
      await waitIds(page, ['#105', '#104', '#103', '#102', '#101']);
      assert.equal(await button.evaluate((el) => document.activeElement === el), true);
      await assertContinuity(page);
      await page.evaluate(() => window.__noticeObservation.disconnect());
      await page.getByRole('button', { name: '공지 03', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('heading', { name: '공지 03', exact: true }).waitFor();
      await page.goBack();
      await waitIds(page, ['#105', '#104', '#103', '#102', '#101']);
      assert.equal(new URL(page.url()).searchParams.get('page'), '2');
      await selectStatus(page, '게시');
      await page.waitForFunction(() => !new URL(location.href).searchParams.has('page'));
      await page.getByText('총 25건', { exact: true }).waitFor();
      assert.equal(await page.locator('tbody tr').count(), 20);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'list.png'), fullPage: true });
      return { oldRows: 20, nextRows: 5, pendingScrollY: scroll, sameTablePosition: true, keyboardOpenAndBack: true };
    });

    await check('S-공지-068 게시 확인창 취소·Esc의 초점 복귀와 오류 요약', async () => {
      await page.goto(`${BASE_URL}/notices/new`);
      await page.getByLabel('제목 *', { exact: true }).fill('사용성 확인');
      await page.getByLabel('본문 *', { exact: true }).fill('<b>HTML은 글자</b>\n둘째 문단');
      await page.locator('#notice-preview-panel').getByText('<b>HTML은 글자</b>', { exact: false }).waitFor();
      const publish = page.getByRole('button', { name: '공지 게시', exact: true });
      for (const method of ['cancel', 'escape']) {
        await publish.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('alertdialog');
        await dialog.waitFor();
        assert.equal(
          await dialog
            .getByRole('button', { name: '취소', exact: true })
            .evaluate((el) => document.activeElement === el),
          true
        );
        if (method === 'cancel') await page.keyboard.press('Enter');
        else await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.activeElement?.textContent === '공지 게시');
      }
      await page.getByLabel('제목 *', { exact: true }).fill('가'.repeat(51));
      const error = page.getByRole('alert').getByRole('button', { name: /제목은 50자까지/ });
      await error.focus();
      await page.keyboard.press('Enter');
      assert.equal(
        await page.getByLabel('제목 *', { exact: true }).evaluate((el) => document.activeElement === el),
        true
      );
      await page.getByLabel('제목 *', { exact: true }).fill('사용성 확인');
      return { cancelFocus: '공지 게시', escapeFocus: '공지 게시', errorFocus: 'notice-title', htmlAsText: true };
    });

    await check('S-공지-068 좁은 화면·경계 폭·탭 키보드·입력 연속성', async () => {
      await page.setViewportSize({ width: 1200, height: 900 });
      assert.equal(await page.getByRole('tablist').isVisible(), false);
      assert.equal(await page.locator('#notice-write-panel').isVisible(), true);
      assert.equal(await page.locator('#notice-preview-panel').isVisible(), true);
      await page.setViewportSize({ width: 1199, height: 900 });
      await page.getByRole('tab', { name: '작성', exact: true }).focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(
        () =>
          document.activeElement?.id === 'notice-preview-tab' &&
          document.activeElement?.getAttribute('aria-selected') === 'true'
      );
      assert.equal(await page.locator('#notice-write-panel').isVisible(), false);
      await page.keyboard.press('Home');
      await page.waitForFunction(() => document.activeElement?.id === 'notice-write-tab');
      await page.keyboard.press('End');
      await page.waitForFunction(() => document.activeElement?.id === 'notice-preview-tab');
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => document.activeElement?.id === 'notice-write-tab');
      assert.equal(await page.getByLabel('제목 *', { exact: true }).inputValue(), '사용성 확인');
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.getByRole('button', { name: '초안 저장', exact: true }).scrollIntoViewIfNeeded();
        assert.equal(await page.getByRole('button', { name: '초안 저장', exact: true }).isVisible(), true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'mobile-write.png'), fullPage: true });
      await page.getByRole('tab', { name: '미리보기', exact: true }).click();
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'mobile-preview.png'), fullPage: true });
      await page.getByRole('tab', { name: '작성', exact: true }).click();
      return { widths: [1200, 1199, 390, 320], arrowAndHomeKeys: true, inputPreserved: true, documentOverflow: false };
    });

    await check('S-공지-069 저장 실패 복구·게시 대기·중복 요청 방지', async () => {
      await page.evaluate(async () => {
        const { network } = await import('/@id/__x00__virtual:msw');
        const { http } = await import('/node_modules/.vite/deps/msw.js');
        window.__noticeWrite = { fail: true, requests: 0 };
        network.use(
          http.post('/api/v0/platform-admin/notices', async () => {
            window.__noticeWrite.requests++;
            await new Promise((resolve) => setTimeout(resolve, 1200));
            if (window.__noticeWrite.fail) {
              return new Response(
                JSON.stringify({ status: 500, code: 'TEST_ERROR', message: '오류', errorMessage: '오류' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
              );
            }
          })
        );
      });
      await page.getByRole('button', { name: '초안 저장', exact: true }).click();
      await page.getByText('처리 중…', { exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('#notice-title')?.disabled === true);
      await page.getByText('일시적 오류로 요청을 완료하지 못했습니다.', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('제목 *', { exact: true }).inputValue(), '사용성 확인');
      assert.equal(await page.getByLabel('본문 *', { exact: true }).inputValue(), '<b>HTML은 글자</b>\n둘째 문단');
      await page.evaluate(() => {
        window.__noticeWrite = { fail: false, requests: 0 };
      });
      await page.getByRole('button', { name: '공지 게시', exact: true }).click();
      const confirm = page.getByRole('alertdialog').getByRole('button', { name: '공지 게시', exact: true });
      // Two same-tick activations exercise the synchronous duplicate-request guard.
      await confirm.evaluate((el) => {
        el.click();
        el.click();
      });
      await page.getByText('처리 중…', { exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('[data-slot=alert-dialog-action]')?.disabled === true);
      await page.getByText('공지를 게시했습니다.', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__noticeWrite.requests), 1);
      assert.equal(await page.getByRole('alertdialog').count(), 0);
      await page.getByRole('button', { name: '공지 보기', exact: true }).click();
      await page.getByRole('heading', { name: '사용성 확인', exact: true }).waitFor();
      return {
        delayMs: 1200,
        failureStatus: 500,
        inputPreserved: true,
        successfulPublishRequests: 1,
        successLeaveWarning: false,
      };
    });

    await check('S-공지-070 수정 취소의 단일 확인과 게시 상태 일관성', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const publication = await page.locator('dd').nth(1).textContent();
      await page.getByRole('link', { name: '수정', exact: true }).click();
      await page.getByLabel('제목 *', { exact: true }).fill('버릴 변경');
      await page.getByRole('button', { name: '수정 취소', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: '나가기', exact: true }).click();
      await page.getByRole('heading', { name: '사용성 확인', exact: true }).waitFor();
      assert.equal(await page.getByRole('alertdialog').count(), 0);
      await page.getByRole('button', { name: '게시 해제', exact: true }).click();
      await page.getByRole('button', { name: '공지 재게시', exact: true }).waitFor();
      await page.getByRole('button', { name: '실행 취소', exact: true }).click();
      await page.getByRole('button', { name: '게시 해제', exact: true }).waitFor();
      assert.equal(await page.locator('dd').nth(1).textContent(), publication);
      await page.getByRole('button', { name: '게시 해제', exact: true }).click();
      const republish = page.getByRole('button', { name: '공지 재게시', exact: true });
      await republish.click();
      await page.getByRole('alertdialog').getByRole('button', { name: '취소', exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.textContent === '공지 재게시');
      await republish.click();
      await page.getByRole('alertdialog').getByRole('button', { name: '공지 재게시', exact: true }).click();
      await page.getByRole('button', { name: '게시 해제', exact: true }).waitFor();
      assert.equal(await page.locator('dd').nth(1).textContent(), publication);
      return {
        cancelDialogs: 1,
        publicationDatePreserved: publication,
        republishCancelFocus: true,
        undoRestoresPublished: true,
      };
    });

    await check('S-공지-070 조회자 읽기·작성 주소·변경 API 권한', async () => {
      const viewer = await browser.newContext({ viewport: { width: 390, height: 844 } });
      try {
        const target = await viewer.newPage();
        await login(target, '조회자');
        await target.getByText('총 5건', { exact: true }).waitFor();
        await target.setViewportSize({ width: 320, height: 844 });
        assert.equal(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(
          await target.locator('[data-slot=table-container]').evaluate((el) => el.scrollWidth > el.clientWidth),
          true
        );
        await target.screenshot({ path: path.join(OUTPUT_DIR, 'mobile-list.png'), fullPage: true });
        assert.equal(await target.getByRole('link', { name: '새 공지 작성', exact: true }).count(), 0);
        assert.equal(await target.locator('thead th').count(), 5);
        await target.getByRole('button', { name: '11월 이벤트 안내', exact: true }).focus();
        await target.keyboard.press('Enter');
        await target.getByRole('heading', { name: '11월 이벤트 안내', exact: true }).waitFor();
        assert.equal(await target.getByLabel('제목 *', { exact: true }).count(), 0);
        const status = await target.evaluate(
          async () =>
            (
              await fetch('/api/v0/platform-admin/notices/14', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ revision: 1 }),
              })
            ).status
        );
        assert.equal(status, 403);
        await target.goto(`${BASE_URL}/notices/new`);
        await target.getByText('접근 권한이 없습니다.', { exact: true }).waitFor();
        return { hiddenWriteActions: true, draftReadOnly: true, writeApiStatus: 403, writeRouteForbidden: true };
      } finally {
        await viewer.close();
      }
    });

    await check('S-공지-069/070 초안 삭제 취소·409/404 입력 보존·이탈', async () => {
      const isolated = await browser.newContext({ viewport: { width: 390, height: 844 } });
      try {
        const target = await isolated.newPage();
        await login(target, '운영자');
        await target.getByText('총 5건', { exact: true }).waitFor();
        await target.getByRole('button', { name: '11월 이벤트 안내', exact: true }).click();
        await target.getByRole('heading', { name: '초안 수정', exact: true }).waitFor();
        await target.getByLabel('제목 *', { exact: true }).fill('입력 보존');
        const remove = target.getByRole('button', { name: '초안 삭제', exact: true });
        await remove.focus();
        await target.keyboard.press('Enter');
        await target.getByRole('alertdialog').getByRole('button', { name: '취소', exact: true }).waitFor();
        await target.keyboard.press('Escape');
        await target.waitForFunction(() => document.activeElement?.textContent === '초안 삭제');
        assert.equal(await target.getByLabel('제목 *', { exact: true }).inputValue(), '입력 보존');
        await target.evaluate(async () => {
          const { network } = await import('/@id/__x00__virtual:msw');
          const { http } = await import('/node_modules/.vite/deps/msw.js');
          window.__noticeConflict = 409;
          network.use(
            http.patch('/api/v0/platform-admin/notices/14', () => {
              const status = window.__noticeConflict;
              return new Response(
                JSON.stringify({
                  status,
                  code: status === 409 ? 'NOTICE_CONFLICT' : 'NOTICE_NOT_FOUND',
                  message: '검증용 오류',
                  errorMessage: '검증용 오류',
                }),
                { status, headers: { 'Content-Type': 'application/json' } }
              );
            })
          );
        });
        await target.getByRole('button', { name: '초안 저장', exact: true }).click();
        await target.getByRole('alert').getByText('저장하지 못했습니다.', { exact: true }).waitFor();
        await target
          .getByRole('alert')
          .getByText(/다른 팀원이 먼저 저장한 내용/)
          .waitFor();
        assert.equal(await target.getByLabel('제목 *', { exact: true }).inputValue(), '입력 보존');
        await target.evaluate(() => {
          window.__noticeConflict = 404;
        });
        await target.getByRole('button', { name: '초안 저장', exact: true }).click();
        await target
          .getByRole('alert')
          .getByText(/다른 팀원이 삭제한 초안/)
          .waitFor();
        assert.equal(await target.getByLabel('제목 *', { exact: true }).inputValue(), '입력 보존');
        await target.getByRole('button', { name: '목록으로', exact: true }).click();
        await target.getByRole('alertdialog').getByRole('button', { name: '취소', exact: true }).waitFor();
        await target.keyboard.press('Enter');
        await target.getByRole('alertdialog').waitFor({ state: 'hidden' });
        assert.equal(await target.getByLabel('제목 *', { exact: true }).inputValue(), '입력 보존');
        return {
          deleteCancelFocus: '초안 삭제',
          conflictStatuses: [409, 404],
          inputPreserved: true,
          leaveWarning: true,
        };
      } finally {
        await isolated.close();
      }
    });
    assert.deepEqual(errors, []);
  } catch (error) {
    RESULTS.push({ result: '실패', error: error.stack });
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'report.json'),
      JSON.stringify(
        { checkedAt: new Date().toISOString(), baseUrl: BASE_URL, results: RESULTS, runtimeErrors: errors },
        null,
        2
      )
    );
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
