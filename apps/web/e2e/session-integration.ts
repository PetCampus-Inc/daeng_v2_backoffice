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
      const response = await fetch(`/api/v0/platform-admin${url}`, {
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
  scenario('guest', async (page) => {
    await page.goto(`${BASE}/history`);
    await loginButton(page).waitFor();
    for (const url of ['/terms/service', '/members', '/change-histories'] as const) {
      assert.equal((await request(page, 'GET', url)).status, 401);
    }
    await login(page);
    await page.getByRole('heading', { name: '변경 이력', exact: true }).waitFor();
    await page.locator('tbody tr').first().waitFor();
    await page.reload();
    await page.getByRole('heading', { name: '변경 이력', exact: true }).waitFor();
    await page.locator('tbody tr').first().waitFor();
  }));

test('변경 이력 필터·지연 전환·실패 복구와 주소 보존', async () =>
  scenario('history', async (page) => {
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
        http.get('/api/v0/platform-admin/change-histories', async () => {
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
    await page.evaluate(async () => {
      const { network } = await import('/@id/__x00__virtual:msw');
      const { http } = await import('/node_modules/.vite/deps/msw.js');
      window.__recover = false;
      network.use(
        http.get('/api/v0/platform-admin/change-histories', () => {
          if (!window.__recover) {
            return new Response(JSON.stringify({ status: 500, code: 'QA_ERROR', message: '조회 실패' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        })
      );
    });
    await select(page, '대상 종류', '이용약관');
    await page.getByRole('button', { name: '다시 시도', exact: true }).waitFor();
    await page.evaluate(() => {
      window.__recover = true;
    });
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await page.getByText('총 2건', { exact: true }).waitFor();
  }));

test('운영자 세션은 관리자 헤더가 있어도 이력 조회·약관 수정을 거부한다', async () =>
  scenario('role', async (page) => {
    await page.goto(`${BASE}/terms`);
    await loginButton(page).waitFor();
    await login(page, '운영자');
    await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
    assert.equal((await request(page, 'GET', '/change-histories')).status, 403);
    assert.equal(
      (await request(page, 'POST', '/terms/service', { action: 'save', body: 'x', effectiveDate: '' })).status,
      403
    );
    assert.equal((await request(page, 'GET', '/members')).status, 200);
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
