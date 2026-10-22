// 저장소 루트에서 node --test apps/web/e2e/support-usability.mjs 로 실행한다.
// 설치된 Playwright/Chromium은 환경변수로 지정하며 개인 브라우저 세션에 연결하지 않는다.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { before, after, test } from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const BASE_URL = process.env.BO_QA_BASE_URL || 'http://127.0.0.1:5174';
const OUTPUT_DIR = process.env.BO_QA_OUTPUT_DIR || path.resolve('.local/test-results/support');
const RESULTS = [];
let browser;
before(async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});
after(async () => {
  await browser?.close();
  await writeFile(path.join(OUTPUT_DIR, 'results.json'), JSON.stringify(RESULTS, null, 2));
});
async function scenario(
  id,
  pathname,
  run,
  { width = 1440, delay = 0, fixtures, rules = [], role = pathname.startsWith('/ideas') ? '조회자' : '운영자' } = {}
) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  page.setDefaultTimeout(18000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`${BASE_URL}${pathname}`);
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).waitFor();
    await page.evaluate(
      async ({ delay, fixtures, rules }) => {
        if (fixtures) localStorage.setItem(fixtures.key, JSON.stringify(fixtures.items));
        const { network } = await import('/@id/__x00__virtual:msw');
        const { http } = await import('/node_modules/.vite/deps/msw.js');
        window.__supportQA = { listDelay: delay, rules, requests: [] };
        network.use(
          http.all(/\/api\/v0\/platform-admin\/(inquiries|ideas)(?:[/?]|$)/, async ({ request }) => {
            const url = new URL(request.url);
            const key = url.pathname.replace('/api/v0/platform-admin', '');
            const state = window.__supportQA;
            const entry = {
              path: key,
              method: request.method,
              keyword: url.searchParams.get('keyword'),
              page: url.searchParams.get('page'),
              finished: false,
            };
            if (request.method !== 'GET') entry.body = await request.clone().text();
            state.requests.push(entry);
            const rule = state.rules.find(
              (rule) =>
                (!rule.path || rule.path === key) &&
                (!rule.method || rule.method === request.method) &&
                (!rule.keyword || rule.keyword === entry.keyword)
            );
            const wait = rule?.delay ?? (key === '/inquiries' || key === '/ideas' ? state.listDelay : 0);
            if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
            entry.finished = true;
            if (rule?.fail) {
              return new Response(
                JSON.stringify({
                  status: rule.status || 500,
                  code: rule.code || 'QA_ERROR',
                  message: '검증용 오류',
                  errorMessage: '검증용 오류',
                }),
                { status: rule.status || 500, headers: { 'Content-Type': 'application/json' } }
              );
            }
          })
        );
      },
      { delay, fixtures, rules }
    );
    await page.getByRole('radio', { name: role, exact: true }).click();
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).click();
    const evidence = await run(page, context);
    assert.deepEqual(errors, []);
    RESULTS.push({ id, result: '통과', evidence });
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${id}.png`), fullPage: true });
  } catch (error) {
    RESULTS.push({ id, result: '실패', error: error.message });
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${id}-failed.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.tracing.stop({ path: path.join(OUTPUT_DIR, `${id}.zip`) });
    await context.close();
  }
}
async function configure(page, config) {
  await page.evaluate((config) => Object.assign(window.__supportQA, config), config);
}
async function ids(page, expected) {
  await page.waitForFunction(
    (expected) =>
      JSON.stringify([...document.querySelectorAll('tbody tr td:first-child')].map((el) => el.textContent)) ===
      JSON.stringify(expected),
    expected
  );
}
async function select(page, label, value) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
}
async function observe(page) {
  await page.evaluate(() => {
    window.__continuity = { lost: false, skeleton: false };
    window.__observer = new MutationObserver(() => {
      if (!document.querySelector('table')) window.__continuity.lost = true;
      if (document.querySelector('[data-slot=list-state][role=status]')) window.__continuity.skeleton = true;
    });
    window.__observer.observe(document.querySelector('main'), { subtree: true, childList: true });
  });
}
for (const [resource, first, filtered, total] of [
  [
    'inquiries',
    ['#1041', '#1042', '#1044', '#1043', '#1045', '#1050', '#1046', '#1047', '#1048', '#1049'],
    ['#1042', '#1045', '#1050', '#1049'],
    10,
  ],
  ['ideas', ['#350', '#349', '#348', '#347', '#346'], ['#349', '#347'], 5],
]) {
  test(`${resource}: initial and delayed list continuity`, () =>
    scenario(
      `${resource}-continuity`,
      `/${resource}`,
      async (page) => {
        await page.locator('[data-slot=list-state][role=status]').waitFor();
        assert.equal(await page.getByText(/^총 \d+건$/).count(), 0);
        await ids(page, first);
        if (resource === 'ideas') {
          assert.equal(
            await page
              .locator('tbody tr')
              .evaluateAll((rows) =>
                rows.every((row) =>
                  [0, 2, 3].every((index) => row.cells[index].scrollWidth <= row.cells[index].clientWidth)
                )
              ),
            true,
            '내용 길이 때문에 번호·사용자·제출일시 열이 겹치면 안 된다'
          );
        }
        await observe(page);
        const before = await page.locator('table').boundingBox();
        await page.screenshot({ path: path.join(OUTPUT_DIR, `${resource}-before.png`) });
        await select(page, '사용자 유형', '원장');
        await page.getByText('조회 중…', { exact: true }).waitFor();
        const during = await page.locator('table').boundingBox();
        await page.screenshot({ path: path.join(OUTPUT_DIR, `${resource}-during.png`) });
        assert.equal(during.y, before.y);
        assert.equal(during.height, before.height);
        assert.equal(await page.getByText(/^총 \d+건$/).count(), 0);
        await ids(page, filtered);
        await page.getByText(`총 ${filtered.length}건`, { exact: true }).waitFor();
        assert.deepEqual(await page.evaluate(() => window.__continuity), { lost: false, skeleton: false });
        await select(page, '사용자 유형', '전체');
        await ids(page, first);
        await page.getByText(`총 ${total}건`, { exact: true }).waitFor();
        return { before, during, continuity: await page.evaluate(() => window.__continuity) };
      },
      { delay: 1500 }
    ));
}
test('inquiry reply pending input is preserved', () =>
  scenario('inquiry-reply-pending', '/inquiries/1043', async (page) => {
    const reply = page.getByRole('textbox', { name: '답변', exact: true });
    await reply.fill('먼저 보낸 답변');
    await configure(page, { rules: [{ path: '/inquiries/1043/replies', method: 'POST', delay: 1500 }] });
    await page.getByRole('button', { name: '답변 저장', exact: true }).evaluate((button) => {
      button.click();
      button.click();
    });
    await page.waitForFunction(() => window.__supportQA.requests.some((x) => x.method === 'POST'));
    const editable = await reply.isEditable();
    if (editable) await reply.fill('대기 중 새로 쓴 답변');
    await page.getByText('답변을 저장했습니다. 사용자에게 알림이 전달됩니다.', { exact: true }).waitFor();
    assert.equal(await reply.inputValue(), editable ? '대기 중 새로 쓴 답변' : '');
    assert.equal(
      await page.evaluate(
        () =>
          window.__supportQA.requests.filter(
            (request) => request.method === 'POST' && request.path.endsWith('/replies')
          ).length
      ),
      1
    );
    assert.equal(
      await page.getByRole('list', { name: '대화', exact: true }).getByText('먼저 보낸 답변', { exact: true }).count(),
      1
    );
    return { editable, duplicateRequests: false };
  }));
test('inquiry modal cancel restores focus', () =>
  scenario('inquiry-modal-focus', '/inquiries/1043', async (page) => {
    const reply = page.getByRole('textbox', { name: '답변', exact: true });
    await reply.fill('확인해 보겠습니다');
    const release = page.getByRole('button', { name: '담당 해제', exact: true });
    await release.click();
    await page.getByRole('alertdialog').waitFor();
    await page.getByRole('button', { name: '취소', exact: true }).click();
    assert.equal(await release.evaluate((el) => el === document.activeElement), true);
    assert.equal(await reply.inputValue(), '확인해 보겠습니다');
  }));

for (const [resource, firstTerm, lastTerm, lastIds, total] of [
  ['inquiries', '산책', '정산', ['#1042'], 10],
  ['ideas', '산책', 'Daily', ['#349'], 5],
]) {
  test(`${resource}: IME, cursor and out of order search`, () =>
    scenario(`${resource}-search`, `/${resource}`, async (page, context) => {
      await page.getByText(`총 ${total}건`, { exact: true }).waitFor();
      const search = page.getByRole('searchbox', { name: '검색', exact: true });
      await search.focus();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.imeSetComposition', { text: '산책', selectionStart: 2, selectionEnd: 2 });
      assert.equal(await search.inputValue(), '산책');
      assert.equal(await search.evaluate((el) => el === document.activeElement), true);
      await cdp.send('Input.insertText', { text: '산책' });
      await configure(page, {
        rules: [
          { path: `/${resource}`, keyword: firstTerm, delay: 2000 },
          { path: `/${resource}`, keyword: lastTerm, delay: 1000 },
        ],
      });
      // 완료된 캐시가 아닌 새 요청에서 역순 응답을 만든다.
      await search.fill('');
      await page.getByText(`총 ${total}건`, { exact: true }).waitFor();
      await search.fill(firstTerm);
      await page.waitForFunction(
        (term) => window.__supportQA.requests.some((request) => request.keyword === term && !request.finished),
        firstTerm
      );
      await search.fill(lastTerm);
      await ids(page, lastIds);
      await page.waitForFunction(
        (term) =>
          window.__supportQA.requests
            .filter((request) => request.keyword === term)
            .every((request) => request.finished),
        firstTerm
      );
      await ids(page, lastIds);
      assert.equal(await search.inputValue(), lastTerm);
      assert.equal(await search.evaluate((el) => el === document.activeElement), true);
      await search.evaluate((el) => el.setSelectionRange(1, 1));
      await page.keyboard.insertText('x');
      assert.equal(await search.inputValue(), lastTerm.slice(0, 1) + 'x' + lastTerm.slice(1));
      assert.equal(await search.evaluate((el) => el.selectionStart), 2);
      return { imeComposition: 'CDP', finalIds: lastIds, lateResponseDidNotOverwrite: true };
    }));
  test(`${resource}: list failure and empty recovery focus`, () =>
    scenario(`${resource}-recovery`, `/${resource}`, async (page) => {
      await page.getByText(`총 ${total}건`, { exact: true }).waitFor();
      await configure(page, { rules: [{ path: `/${resource}`, fail: true }] });
      const search = page.getByRole('searchbox', { name: '검색', exact: true });
      await search.fill(lastTerm);
      await page.getByRole('button', { name: '다시 시도', exact: true }).waitFor();
      assert.equal(await search.inputValue(), lastTerm);
      await configure(page, { rules: [], listDelay: 1000 });
      await page.getByRole('button', { name: '다시 시도', exact: true }).focus();
      await page.keyboard.press('Enter');
      await ids(page, lastIds);
      assert.equal(await search.evaluate((el) => el === document.activeElement), true);
      await search.fill('없는말');
      await page.getByText('검색 결과가 없습니다.', { exact: true }).waitFor();
      await page.locator('[data-slot=list-state]').getByRole('button', { name: '필터 초기화', exact: true }).focus();
      await page.keyboard.press('Enter');
      await page.getByText(`총 ${total}건`, { exact: true }).waitFor();
      assert.equal(await search.inputValue(), '');
      assert.equal(await search.evaluate((el) => el === document.activeElement), true);
      return { retryPreservedTerm: true, resetFocusedSearch: true };
    }));
}
const INQUIRIES_25 = Array.from({ length: 25 }, (_, i) => ({
  id: 1001 + i,
  status: 'waiting',
  title: `문의 ${String(i + 1).padStart(2, '0')}`,
  user: { type: 'guardian', name: '홍길동', email: 'hong@example.com' },
  assigneeEmail: null,
  createdAt: new Date(Date.UTC(2026, 9, 7, 0, i + 1)).toISOString(),
  lastActivityAt: new Date(Date.UTC(2026, 9, 7, 0, i + 1)).toISOString(),
  messages: [
    {
      id: `message-${i}`,
      author: 'user',
      authorName: '홍길동',
      body: '문의 본문',
      images: [],
      createdAt: new Date(Date.UTC(2026, 9, 7, 0, i + 1)).toISOString(),
    },
  ],
}));
const IDEAS_25 = Array.from({ length: 25 }, (_, i) => ({
  id: 301 + i,
  content: `제안 ${String(i + 1).padStart(2, '0')}`,
  user: { type: 'guardian', name: '홍길동', email: 'hong@example.com' },
  submittedAt: new Date(Date.UTC(2026, 9, 7, 0, i + 1)).toISOString(),
}));
for (const [resource, fixtures, firstId, secondId, label, title] of [
  ['inquiries', { key: 'daeng-bo-mock-inquiries-v2', items: INQUIRIES_25 }, '#1025', '#1005', '1:1 문의', '문의 15'],
  ['ideas', { key: 'daeng-bo-mock-ideas', items: IDEAS_25 }, '#325', '#305', '아이디어 제안', '제안 15'],
]) {
  test(`${resource}: pagination progress and return focus/scroll`, () =>
    scenario(
      `${resource}-navigation`,
      `/${resource}`,
      async (page) => {
        await page.getByText('총 25건', { exact: true }).waitFor();
        await configure(page, { listDelay: 1500 });
        const next = page.getByRole('button', { name: '2', exact: true });
        await next.focus();
        await page.keyboard.press('Enter');
        await page.getByText('조회 중…', { exact: true }).waitFor();
        assert.equal(await next.getAttribute('aria-disabled'), 'true');
        await page.keyboard.press('Enter');
        await page.getByRole('cell', { name: secondId, exact: true }).waitFor();
        assert.equal(await next.evaluate((el) => el === document.activeElement), true);
        assert.equal(await page.getByRole('button', { name: '2', exact: true }).getAttribute('aria-current'), 'page');
        await page.getByRole('button', { name: '1', exact: true }).click();
        await page.getByRole('cell', { name: firstId, exact: true }).waitFor();
        const row = page.getByRole('button', { name: title, exact: true });
        await row.focus();
        await page.evaluate(() => window.scrollTo(0, 500));
        const y = await page.evaluate(() => window.scrollY);
        await page.keyboard.press('Enter');
        await page.getByRole('heading', { level: 1 }).waitFor();
        await page.getByRole('link', { name: label, exact: true }).last().waitFor();
        if (resource === 'inquiries') {
          await page.getByRole('button', { name: '다음 문의 ›', exact: true }).waitFor({ state: 'visible' });
          await page.waitForFunction(
            () =>
              !document.querySelector('button[data-slot=button][disabled]') ||
              [...document.querySelectorAll('button')].some(
                (el) => el.textContent.includes('다음 문의') && !el.disabled
              )
          );
          await page.getByRole('button', { name: '다음 문의 ›', exact: true }).click();
          await page.getByRole('heading', { name: '문의 14', exact: true }).waitFor();
          await page.goBack();
        } else await page.getByRole('link', { name: label, exact: true }).last().click();
        await row.waitFor();
        await page.waitForFunction(
          ({ title, y }) => document.activeElement?.textContent === title && Math.abs(window.scrollY - y) < 2,
          { title, y }
        );
        return { scrollY: y, restoredFocus: title };
      },
      { fixtures }
    ));
}
test('assignee options failure and retry', () =>
  scenario(
    'inquiry-assignees',
    '/inquiries',
    async (page) => {
      await page.getByText('담당자를 불러오지 못했습니다.', { exact: true }).waitFor();
      await configure(page, { rules: [] });
      await page.getByRole('button', { name: '담당자 다시 시도', exact: true }).click();
      await page.getByText('담당자를 불러오지 못했습니다.', { exact: true }).waitFor({ state: 'hidden' });
      await select(page, '담당자', '내 담당');
      await ids(page, ['#1044', '#1043', '#1050', '#1048']);
    },
    { rules: [{ path: '/inquiries/assignees', fail: true }] }
  ));
test('inquiry reply failure and release failure preserve draft', () =>
  scenario('inquiry-failures', '/inquiries/1043', async (page) => {
    const reply = page.getByRole('textbox', { name: '답변', exact: true });
    await reply.fill('보존할 답변');
    await configure(page, { rules: [{ path: '/inquiries/1043/replies', method: 'POST', delay: 1500, fail: true }] });
    await page.getByRole('button', { name: '답변 저장', exact: true }).click();
    await page.getByText('문의 처리 중…', { exact: true }).waitFor();
    await page.getByText('일시적 오류로 요청을 완료하지 못했습니다.', { exact: true }).waitFor();
    assert.equal(await reply.inputValue(), '보존할 답변');
    assert.equal(await reply.isEditable(), true);
    await configure(page, { rules: [{ path: '/inquiries/1043/assignee', method: 'DELETE', delay: 1500, fail: true }] });
    await page.getByRole('button', { name: '담당 해제', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: '담당 해제', exact: true }).click();
    await page.getByText('문의 처리 중…', { exact: true }).waitFor();
    await page.getByText('문의 처리 중…', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await reply.inputValue(), '보존할 답변');
    await page.getByRole('button', { name: '다음 문의 ›', exact: true }).click();
    await page.getByRole('alertdialog').waitFor();
    await page.getByRole('button', { name: '취소', exact: true }).click();
    assert.equal(await reply.inputValue(), '보존할 답변');
  }));
for (const width of [1440, 1200, 1199, 390]) {
  for (const resource of ['inquiries', 'ideas']) {
    test(`${resource}: keyboard and width ${width}`, () =>
      scenario(
        `${resource}-width-${width}`,
        `/${resource}`,
        async (page) => {
          const search = page.getByRole('searchbox', { name: '검색', exact: true });
          await search.waitFor();
          await search.focus();
          await page.keyboard.press('Tab');
          assert.equal(
            await page
              .getByRole('combobox')
              .first()
              .evaluate((el) => el === document.activeElement),
            true
          );
          await page.keyboard.press('Enter');
          await page.keyboard.press('Escape');
          const region = page.getByRole('region', {
            name: resource === 'inquiries' ? '문의 목록 가로 스크롤' : '제안 목록 가로 스크롤',
          });
          await region.focus();
          await page.keyboard.press('ArrowRight');
          assert.equal(await region.evaluate((el) => el === document.activeElement), true);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          const row = page.locator('tbody button').first();
          await row.focus();
          await page.keyboard.press('Enter');
          if (resource === 'inquiries') {
            await page.getByRole('heading', { name: '산책 예약이 안 돼요', exact: true }).waitFor();
            await page.getByRole('button', { name: '내가 맡기', exact: true }).click();
            const reply = page.getByRole('textbox', { name: '답변', exact: true });
            await reply.fill('가'.repeat(501));
            assert.equal(await page.getByRole('button', { name: '답변 저장', exact: true }).isDisabled(), true);
            await reply.fill('가'.repeat(500));
            assert.equal(await page.getByRole('button', { name: '답변 저장', exact: true }).isEnabled(), true);
          } else await page.getByRole('heading', { name: '제안 #350', exact: true }).waitFor();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          return { width, keyboard: true, noOverflow: true };
        },
        { width }
      ));
  }
}

for (const resource of ['inquiries', 'ideas']) {
  test(`${resource}: detail failure recovery and missing target`, () =>
    scenario(
      `${resource}-detail-recovery`,
      `/${resource}/${resource === 'inquiries' ? 1043 : 350}`,
      async (page) => {
        await page.getByRole('button', { name: '다시 시도', exact: true }).waitFor();
        await configure(page, { rules: [] });
        await page.getByRole('button', { name: '다시 시도', exact: true }).focus();
        await page.keyboard.press('Enter');
        const heading = page.getByRole('heading', { level: 1 });
        await heading.waitFor();
        await page.waitForFunction(() => document.activeElement?.tagName === 'H1');
        if (resource === 'ideas') assert.equal(await heading.textContent(), '제안 #350');
        else assert.equal(await heading.textContent(), '알림이 안 와요');
      },
      {
        rules: [
          { path: `/${resource}/${resource === 'inquiries' ? 1043 : 350}`, method: 'GET', fail: true, delay: 1500 },
        ],
      }
    ));
  test(`${resource}: missing target returns to list`, () =>
    scenario(`${resource}-missing`, `/${resource}/999`, async (page) => {
      await page.getByText('페이지를 찾을 수 없습니다.', { exact: true }).waitFor();
      const link = page.getByRole('link', { name: '목록으로', exact: true });
      await link.focus();
      await page.keyboard.press('Enter');
      await page.locator('table').waitFor();
      assert.equal(new URL(page.url()).pathname, `/${resource}`);
    }));
}
async function changeStoredInquiry(page, id, change) {
  await page.evaluate(
    ({ id, change }) => {
      const items = JSON.parse(localStorage.getItem('daeng-bo-mock-inquiries-v2'));
      Object.assign(
        items.find((item) => item.id === id),
        change
      );
      localStorage.setItem('daeng-bo-mock-inquiries-v2', JSON.stringify(items));
    },
    { id, change }
  );
}
test('inquiry assignment release undo and pending duplicates', () =>
  scenario('inquiry-assignment-undo', '/inquiries/1041', async (page) => {
    await configure(page, {
      rules: [
        { path: '/inquiries/1041/assignee', delay: 1500 },
        { path: '/inquiries/1041/assignee/restore', delay: 1500 },
      ],
    });
    const assign = page.getByRole('button', { name: '내가 맡기', exact: true });
    await assign.waitFor();
    await assign.click();
    await page.getByText('문의 처리 중…', { exact: true }).waitFor();
    assert.equal(await assign.isDisabled(), true);
    await page.getByRole('textbox', { name: '답변', exact: true }).waitFor();
    await page.getByText('문의 처리 중…', { exact: true }).waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: '담당 해제', exact: true }).click();
    await page.getByRole('button', { name: '실행 취소', exact: true }).waitFor();
    const undo = page.getByRole('button', { name: '실행 취소', exact: true });
    await undo.focus();
    await page.keyboard.press('Enter');
    await page.getByText('문의 처리 중…', { exact: true }).waitFor();
    await page.getByRole('textbox', { name: '답변', exact: true }).waitFor();
    await page.getByText('담당 해제를 취소했습니다.', { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(
        () =>
          window.__supportQA.requests.filter((request) => request.path === '/inquiries/1041/assignee/restore').length
      ),
      1
    );
    return { assignment: true, release: true, undo: true };
  }));
for (const mode of ['assignee', 'resolved']) {
  test(`inquiry reply race ${mode}`, () =>
    scenario(`inquiry-race-${mode}`, '/inquiries/1043', async (page) => {
      const reply = page.getByRole('textbox', { name: '답변', exact: true });
      await reply.fill('경합 중 보존할 답변');
      // mock은 첫 변경 때 기본 데이터를 저장하므로 기본 응답을 저장 형태로 먼저 복제한다.
      await page.evaluate(async () => {
        const response = await fetch('/api/v0/platform-admin/inquiries/1043');
        const { data } = await response.json();
        localStorage.setItem(
          'daeng-bo-mock-inquiries-v2',
          JSON.stringify([{ ...data, assigneeEmail: data.assignee.email }])
        );
      });
      await changeStoredInquiry(
        page,
        1043,
        mode === 'assignee' ? { assigneeEmail: 'ops2@knockdog.test' } : { status: 'resolved' }
      );
      await configure(page, { rules: [{ path: '/inquiries/1043/replies', delay: 1500 }] });
      await page.getByRole('button', { name: '답변 저장', exact: true }).click();
      if (mode === 'assignee') {
        await page.getByText('담당자가 변경되었습니다.', { exact: true }).waitFor();
        assert.equal(await reply.inputValue(), '경합 중 보존할 답변');
        assert.equal(await reply.isEditable(), false);
        assert.equal(await page.getByRole('button', { name: '답변 저장', exact: true }).isDisabled(), true);
      } else {
        await page.getByText('해결 완료된 문의라 답변과 담당 변경을 할 수 없습니다.', { exact: true }).waitFor();
        assert.equal(await reply.count(), 0);
      }
    }));
}
test('inquiry attachment loading and failure do not shift reply', () =>
  scenario('inquiry-images', '/inquiries', async (page) => {
    await page.locator('table').waitFor();
    await page.evaluate(async () => {
      const response = await fetch('/api/v0/platform-admin/inquiries/1041');
      const { data } = await response.json();
      data.messages[0].images = [
        { id: 'good', url: '/qa-images/good.svg', fileName: 'good.svg', originalUrl: null },
        { id: 'bad', url: '/qa-images/bad.svg', fileName: 'bad.heic', originalUrl: '/qa-original.heic' },
      ];
      localStorage.setItem(
        'daeng-bo-mock-inquiries-v2',
        JSON.stringify([{ ...data, assigneeEmail: 'ops@knockdog.test' }])
      );
    });
    await page.evaluate(async () => {
      const { network } = await import('/@id/__x00__virtual:msw');
      const { http } = await import('/node_modules/.vite/deps/msw.js');
      network.use(
        http.get('/qa-images/:file', async ({ params }) => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          if (params.file === 'bad.svg') return new Response('missing', { status: 404 });
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="144"><rect width="192" height="144" fill="orange"/></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        })
      );
    });
    await page.getByRole('button', { name: '산책 예약이 안 돼요', exact: true }).click();
    const reply = page.getByRole('textbox', { name: '답변', exact: true });
    await reply.waitFor();
    const before = await reply.boundingBox();
    await page.getByRole('img', { name: '이미지를 불러오지 못했습니다', exact: true }).first().waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('img')].filter((img) => img.alt === 'good.svg').every((img) => img.complete)
    );
    const goodImage = page.getByRole('img', { name: 'good.svg', exact: true });
    assert.equal(await goodImage.evaluate((image) => image.complete && image.naturalWidth > 0), true);
    assert.equal(await page.getByRole('img', { name: '이미지를 불러오지 못했습니다', exact: true }).count(), 1);
    const after = await reply.boundingBox();
    assert.equal(after.y, before.y);
    const original = page.getByRole('link', { name: '원본 다운로드', exact: true });
    await original.focus();
    assert.equal(await original.evaluate((el) => el === document.activeElement), true);
    return { before, after };
  }));

test('inquiry leave and assignment dialog keyboard cancellation', () =>
  scenario('inquiry-dialogs', '/inquiries/1043', async (page) => {
    const reply = page.getByRole('textbox', { name: '답변', exact: true });
    await reply.fill('확인해 보겠습니다');
    await reply.evaluate((el) => el.setSelectionRange(3, 3));
    const next = page.getByRole('button', { name: '다음 문의 ›', exact: true });
    await next.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('alertdialog').waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('[role=alertdialog]')), true);
    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    assert.equal(await reply.inputValue(), '확인해 보겠습니다');
    await page.waitForFunction(() => document.activeElement?.textContent === '다음 문의 ›');
    await reply.fill('');
    await next.click();
    await page.getByRole('heading', { name: '원생 등록 오류', exact: true }).waitFor();
    const assign = page.getByRole('button', { name: '내가 맡기', exact: true });
    await assign.click();
    await page.getByRole('alertdialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.textContent === '내가 맡기');
    assert.equal(await page.getByRole('textbox', { name: '답변', exact: true }).count(), 0);
  }));

test('inquiry takeover conflict refreshes confirmation before change', () =>
  scenario('inquiry-takeover-conflict', '/inquiries/1045', async (page) => {
    const assign = page.getByRole('button', { name: '내가 맡기', exact: true });
    await assign.waitFor();
    await page.evaluate(async () => {
      const response = await fetch('/api/v0/platform-admin/inquiries/1045');
      const { data } = await response.json();
      localStorage.setItem(
        'daeng-bo-mock-inquiries-v2',
        JSON.stringify([{ ...data, assigneeEmail: 'inactive@knockdog.test' }])
      );
    });
    await assign.click();
    await configure(page, { rules: [{ path: '/inquiries/1045/assignee', method: 'POST', delay: 1500 }] });
    await page.getByRole('alertdialog').getByRole('button', { name: '담당자 변경', exact: true }).click();
    await page.getByRole('alertdialog').getByText('정비활 · BE님이 담당 중인 문의입니다.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: '답변', exact: true }).count(), 0);
    await page.getByRole('alertdialog').getByRole('button', { name: '담당자 변경', exact: true }).click();
    await page.getByRole('textbox', { name: '답변', exact: true }).waitFor();
    await page.getByText('담당자를 변경했습니다.', { exact: true }).waitFor();
  }));

test('inquiry undo conflict keeps latest assignee', () =>
  scenario('inquiry-undo-conflict', '/inquiries/1043', async (page) => {
    await page.getByRole('button', { name: '담당 해제', exact: true }).click();
    const undo = page.getByRole('button', { name: '실행 취소', exact: true });
    await undo.waitFor();
    await changeStoredInquiry(page, 1043, { assigneeEmail: 'ops2@knockdog.test' });
    await configure(page, { rules: [{ path: '/inquiries/1043/assignee/restore', delay: 1500 }] });
    await undo.focus();
    await page.keyboard.press('Enter');
    await page.getByText('담당자가 변경되어 실행 취소할 수 없습니다.', { exact: true }).waitFor();
    await page.getByRole('button', { name: '내가 맡기', exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: '답변', exact: true }).count(), 0);
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('daeng-bo-mock-inquiries-v2')).find((item) => item.id === 1043).assigneeEmail
      ),
      'ops2@knockdog.test'
    );
  }));
