import type { Browser, BrowserContext, Page } from 'playwright';

import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { before, after, test } from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright') as typeof import('playwright');
const BASE = process.env.BO_QA_BASE_URL || 'http://127.0.0.1:5190';
const OUTPUT = path.resolve(process.env.BO_QA_OUTPUT_DIR || '.local/test-results/session-integration');
let browser: Browser;
before(async () => {
  await mkdir(OUTPUT, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});
after(async () => browser?.close());
async function scenario(id: string, run: (page: Page, context: BrowserContext) => Promise<unknown>, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(15000);
  try {
    await page.clock.setFixedTime(new Date('2026-10-07T10:00:00+09:00'));
    await run(page, context);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(OUTPUT, `${id}.png`), fullPage: true });
  } catch (e) {
    await page.screenshot({ path: path.join(OUTPUT, `${id}-failure.png`), fullPage: true }).catch(() => {});
    throw e;
  } finally {
    await context.tracing.stop({ path: path.join(OUTPUT, `${id}.zip`) });
    await context.close();
  }
}
const loginButton = (page: Page) => page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true });
async function login(page: Page, role = '최고관리자') {
  await page.getByRole('radio', { name: role, exact: true }).check();
  await loginButton(page).click();
}
async function request(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const response = await fetch(`/api/v0/admin${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Dev-Email': 'admin@knockdog.test' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    },
    { method, url, body }
  );
}
async function select(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('세션 없는 요청은 개발용 관리자 헤더로 우회하지 못한다', async () =>
  scenario('guest-api', async (page) => {
    await page.goto(`${BASE}/history`);
    await loginButton(page).waitFor();
    for (const url of ['/terms/SERVICE_TERMS/versions', '/service-admin/members', '/change-logs'] as const) {
      assert.equal((await request(page, 'GET', url)).status, 401);
    }
  }));

test('로그인 세션을 새로고침 뒤 복원한다', async () =>
  scenario('session-reload', async (page) => {
    await page.goto(`${BASE}/history`);
    await loginButton(page).waitFor();
    await login(page);
    await page.getByRole('heading', { name: '변경 이력', exact: true }).waitFor();
    await page.locator('tbody tr').first().waitFor();
    await page.reload();
    await page.getByRole('heading', { name: '변경 이력', exact: true }).waitFor();
    await page.locator('tbody tr').first().waitFor();
  }));

test('변경 이력 필터의 지연 전환과 주소를 보존한다', async () =>
  scenario('history-filter', async (page) => {
    await page.goto(`${BASE}/history`);
    await loginButton(page).waitFor();
    await login(page);
    await page.locator('tbody tr').first().waitFor();
    const beforeCount = await page.locator('tbody tr').count();
    assert.ok(beforeCount > 3);
    await page.evaluate(async () => {
      const { network } = await import('/@id/__x00__virtual:msw');
      const { http } = await import('/node_modules/.vite/deps/msw.js');
      window.__historyQA = { fail: false, delay: 1200 };
      network.use(
        http.get('/api/v0/admin/change-logs', async () => {
          await new Promise((resolve) => setTimeout(resolve, window.__historyQA.delay));
          if (window.__historyQA.fail) {
            return new Response(JSON.stringify({ status: 500, code: 'QA_ERROR', message: '조회 실패' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        })
      );
    });
    await select(page, '대상 종류', '1:1 문의');
    await page.getByText('조회 중…', { exact: true }).waitFor();
    assert.equal(await page.locator('tbody tr').count(), beforeCount);
    await page.getByText('총 3건', { exact: true }).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 3);
    await select(page, '기간', '직접 입력');
    await page.getByLabel('시작일', { exact: true }).fill('2026-10-05');
    await page.getByText('총 2건', { exact: true }).waitFor();
    await page.reload();
    await page.getByLabel('시작일', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('시작일', { exact: true }).inputValue(), '2026-10-05');
    await page.getByText('총 2건', { exact: true }).waitFor();
    await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
    await page
      .locator('tbody tr')
      .nth(beforeCount - 1)
      .waitFor();
    assert.equal(
      await page.getByRole('combobox', { name: '기간', exact: true }).evaluate((e) => e === document.activeElement),
      true
    );
  }));

test('변경 이력 조회 실패 후 다시 시도한다', async () =>
  scenario('history-retry', async (page) => {
    await page.goto(`${BASE}/history`);
    await loginButton(page).waitFor();
    await login(page);
    const rows = page.locator('tbody tr[data-history-id]');
    await rows.first().waitFor();
    const previousRows = await rows.allTextContents();
    await page.evaluate(async () => {
      const { network } = await import('/@id/__x00__virtual:msw');
      const { http } = await import('/node_modules/.vite/deps/msw.js');
      window.__recover = false;
      network.use(
        http.get('/api/v0/admin/change-logs', async () => {
          if (!window.__recover) {
            return new Response(JSON.stringify({ status: 500, code: 'QA_ERROR', message: '조회 실패' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        })
      );
    });
    await select(page, '대상 종류', '이용약관');
    await page.getByRole('button', { name: '다시 시도', exact: true }).waitFor();
    await page.getByText('변경 이력을 조회하지 못했습니다.', { exact: true }).waitFor();
    await page.evaluate(() => {
      window.__recover = true;
    });
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await page.getByText('조회 중…', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '다시 시도', exact: true }).count(), 0);
    assert.deepEqual(await rows.allTextContents(), previousRows);
    await page.getByText('총 2건', { exact: true }).waitFor();
  }));

test('변경 이력 오프라인 필터 실패 시 이전 목록을 유지한다', async () =>
  scenario('history-offline-filter', async (page, context) => {
    await page.goto(`${BASE}/history`);
    await loginButton(page).waitFor();
    await login(page);
    const rows = page.locator('tbody tr[data-history-id]');
    await rows.first().waitFor();
    const previousRows = await rows.allTextContents();

    await context.setOffline(true);
    await page.getByText('인터넷 연결이 끊겼습니다. 연결을 확인해 주세요.', { exact: true }).waitFor();
    await select(page, '대상 종류', '1:1 문의');
    await page.getByText('변경 이력을 조회하지 못했습니다.', { exact: true }).waitFor({ timeout: 3000 });
    await page.getByText('조회 실패 · 이전 조회 결과를 표시합니다.', { exact: true }).waitFor();
    assert.equal(await page.getByText('조회 중…', { exact: true }).count(), 0);
    assert.deepEqual(await rows.allTextContents(), previousRows);
    assert.equal(await page.getByRole('combobox', { name: '대상 종류', exact: true }).textContent(), '1:1 문의');

    await context.setOffline(false);
    await page.getByText('인터넷 연결이 복구되었습니다.', { exact: true }).waitFor();
    await page.getByText('총 3건', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '다시 시도', exact: true }).count(), 0);
    assert.equal(await rows.count(), 3);
  }));

const retainedListCases = [
  { path: 'members', searchLabel: '회원 검색' },
  { path: 'kindergartens', searchLabel: '유치원 검색' },
  { path: 'owner-verifications', searchLabel: '원장 인증 검색' },
  { path: 'inquiries', searchLabel: '검색' },
  { path: 'ideas', searchLabel: '검색' },
  { path: 'notices', searchLabel: '검색' },
  { path: 'terms', searchLabel: null },
];

for (const { path, searchLabel } of retainedListCases) {
  test(`목록 실패 보존 - ${path}`, async () =>
    scenario(`retained-list-${path}`, async (page, context) => {
      await page.goto(`${BASE}/${path}`);
      await loginButton(page).waitFor();
      await login(page);
      const rows = page.locator('tbody tr');
      await rows.first().waitFor();
      const previousRows = await rows.allTextContents();

      await context.setOffline(true);
      await page.getByText('인터넷 연결이 끊겼습니다. 연결을 확인해 주세요.', { exact: true }).waitFor();
      if (searchLabel) {
        await page.getByLabel(searchLabel, { exact: true }).fill('QA-없는-검색어');
      } else {
        await page.getByRole('tab', { name: '개인정보 처리방침', exact: true }).click();
      }

      await page.getByText('목록 조회에 실패했습니다.', { exact: true }).waitFor();
      const previousNotice = page.getByText('조회 실패 · 이전 조회 결과를 표시합니다.', { exact: true });
      await previousNotice.waitFor();
      assert.deepEqual(await rows.allTextContents(), previousRows);
      assert.equal(await page.getByText('조회 중…', { exact: true }).count(), 0);

      await context.setOffline(false);
      await previousNotice.waitFor({ state: 'hidden' });
      if (searchLabel) {
        await page.getByText('검색 결과가 없습니다.', { exact: true }).waitFor();
      } else {
        await page.getByRole('table', { name: '개인정보 처리방침 버전 목록' }).waitFor();
      }
    }));
}

test('운영자 세션은 관리자 헤더가 있어도 변경 API를 거부한다', async () =>
  scenario('role-api', async (page) => {
    await page.goto(`${BASE}/terms`);
    await loginButton(page).waitFor();
    await login(page, '운영자');
    await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
    assert.equal((await request(page, 'GET', '/change-logs')).status, 403);
    assert.equal(
      (await request(page, 'POST', '/terms/SERVICE_TERMS/versions', { content: 'x', effectiveDate: '2026-11-10' }))
        .status,
      403
    );
    assert.equal((await request(page, 'GET', '/service-admin/members')).status, 200);
  }));

test('운영자 세션은 변경 이력 화면 접근을 거부한다', async () =>
  scenario('role-route', async (page) => {
    await page.goto(`${BASE}/terms`);
    await loginButton(page).waitFor();
    await login(page, '운영자');
    await page.goto(`${BASE}/history`);
    await page.getByText('접근 권한이 없습니다.', { exact: true }).waitFor();
  }));

test('약관 작성 중 세션 만료는 이탈 확인 없이 로그인으로 이동한다', async () =>
  scenario('expiry', async (page) => {
    await page.goto(`${BASE}/terms/service/4`);
    await loginButton(page).waitFor();
    await login(page);
    const body = page.getByLabel('본문 *', { exact: true });
    await body.waitFor();
    await body.fill('세션 만료 시 폐기할 초안');
    await page.getByLabel('시행일 *', { exact: true }).fill('2026. 11. 10.');
    await page.evaluate(() => {
      const key = 'daeng-bo-mock-session';
      const session = JSON.parse(localStorage.getItem(key)!);
      session.lastRequestAt = Date.now() - 25 * 60 * 60 * 1000;
      localStorage.setItem(key, JSON.stringify(session));
    });
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await loginButton(page).waitFor();
    await page.getByText('로그인이 만료되었습니다. 다시 로그인해 주세요.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('alertdialog').count(), 0);
    await login(page, '조회자');
    await page.getByRole('heading', { name: '서비스 대시보드', exact: true }).waitFor();
    assert.equal(await page.getByLabel('본문 *', { exact: true }).count(), 0);
  }));

for (const width of [1440, 390] as const) {
  test(`로그인 실패 복구·키보드 ${width}px`, async () =>
    scenario(
      `login-${width}`,
      async (page) => {
        await page.goto(`${BASE}/login`);
        await loginButton(page).waitFor();
        await login(page, '비활성팀원');
        await page
          .getByRole('alert')
          .getByText('접근 권한이 없는 계정입니다. 관리자에게 문의해 주세요.', { exact: true })
          .waitFor();
        assert.equal(await loginButton(page).isEnabled(), true);
        await page.getByRole('radio', { name: '조회자', exact: true }).focus();
        await page.keyboard.press('Space');
        await loginButton(page).focus();
        await page.keyboard.press('Enter');
        await page.getByRole('heading', { name: '서비스 대시보드', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      },
      width
    ));
}
