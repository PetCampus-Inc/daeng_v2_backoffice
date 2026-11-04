import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';

const BASE = process.env.BO_QA_BASE_URL || 'http://127.0.0.1:5196';
const OUTPUT = process.env.BO_QA_OUTPUT_DIR || path.resolve('.local/test-results/rich-content-editor');
let browser: Browser;
before(async () => {
  await mkdir(OUTPUT, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});
after(async () => browser?.close());
async function scenario(name: string, route: string, run: (page: Page) => Promise<void>, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(12000);
  try {
    await page.clock.setFixedTime(new Date('2026-10-07T10:00:00+09:00'));
    await page.goto(BASE + route);
    await page.getByRole('radio', { name: '최고관리자', exact: true }).click();
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).click();
    await page.getByLabel('본문 *', { exact: true }).waitFor();
    await run(page);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(OUTPUT, name + '.png'), fullPage: true });
  } catch (error) {
    await page.screenshot({ path: path.join(OUTPUT, name + '-failure.png'), fullPage: true });
    throw error;
  } finally {
    await context.tracing.stop({ path: path.join(OUTPUT, name + '.zip') });
    await context.close();
  }
}
async function formatAll(page: Page, label: string) {
  await page.getByLabel('본문 *', { exact: true }).press('ControlOrMeta+a');
  await page.getByRole('button', { name: label, exact: true }).click();
}
async function confirm(page: Page, name: string) {
  await page.getByRole('alertdialog').getByRole('button', { name, exact: true }).click();
}

test('공지: 서식만 변경한 초안의 이탈·저장·재열기·게시·읽기', async () =>
  scenario('notice-publish', '/notices/14', async (page) => {
    const body = page.getByLabel('본문 *', { exact: true });
    const save = page.getByRole('button', { name: '초안 저장', exact: true });
    assert.equal(await save.isDisabled(), true);
    await formatAll(page, '굵게');
    await body.locator('strong').waitFor();
    await page.locator('#notice-preview-panel strong').waitFor();
    assert.equal(await save.isEnabled(), true);
    await page.getByRole('link', { name: '앱 공지', exact: true }).last().click();
    await confirm(page, '취소');
    await body.locator('strong').waitFor();
    await save.click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button')].some((button) => button.textContent === '초안 저장' && button.disabled)
    );
    await page.reload();
    await body.locator('strong').waitFor();
    assert.equal(await save.isDisabled(), true);
    await formatAll(page, '소제목');
    await body.locator('h2 strong').waitFor();
    await page.getByRole('button', { name: '공지 게시', exact: true }).click();
    await confirm(page, '공지 게시');
    await page.getByRole('button', { name: '공지 보기', exact: true }).click();
    await page.locator('main .slate-editor h2 strong').waitFor();
    assert.equal(await page.getByRole('textbox', { name: '본문 *', exact: true }).count(), 0);
    await page.getByRole('link', { name: '수정', exact: true }).click();
    await body.locator('h2 strong').waitFor();
    assert.equal(await page.getByRole('button', { name: '변경 저장', exact: true }).isDisabled(), true);
  }));

test('공지: 링크 주소 검증·선택 보존·해제·단축키·실행 취소', async () =>
  scenario('notice-link', '/notices/new', async (page) => {
    const body = page.getByLabel('본문 *', { exact: true });
    await body.fill('링크 안내');
    await formatAll(page, '링크');
    const dialog = page.getByRole('dialog', { name: '링크 설정' });
    await dialog.getByLabel('링크 주소', { exact: true }).fill('javascript:alert(1)');
    await dialog.getByRole('button', { name: '적용', exact: true }).click();
    await dialog.getByRole('alert').waitFor();
    assert.equal(await page.locator('#notice-preview-panel a').count(), 0);
    await dialog.getByLabel('링크 주소', { exact: true }).fill('https://knockdog.net/help');
    await dialog.getByRole('button', { name: '적용', exact: true }).click();
    await body.locator('a').waitFor();
    assert.equal(await body.locator('a').innerText(), '링크 안내');
    assert.equal(await page.locator('#notice-preview-panel a').getAttribute('href'), 'https://knockdog.net/help');
    await formatAll(page, '링크 해제');
    await page.waitForFunction(() => document.querySelector('#notice-body a') === null);
    await body.press('ControlOrMeta+b');
    await body.locator('strong').waitFor();
    await page.getByRole('button', { name: '실행 취소', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#notice-body strong') === null);
    await page.getByRole('button', { name: '다시 실행', exact: true }).click();
    await body.locator('strong').waitFor();
    await page.getByLabel('제목 *', { exact: true }).fill('링크 공지');
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await page.getByRole('heading', { name: '초안 수정', exact: true }).waitFor();
    await body.locator('strong').waitFor();
  }));

test('공지: 목록·표 삽입·행/열 조작·미리보기·블록 저장', async () =>
  scenario('notice-table', '/notices/new', async (page) => {
    const body = page.getByLabel('본문 *', { exact: true });
    await body.fill('첫 항목');
    await formatAll(page, '글머리 목록');
    await body.locator('ul li').waitFor();
    await page.locator('#notice-preview-panel ul li').waitFor();
    await formatAll(page, '번호 목록');
    await body.locator('ol li').waitFor();
    await page.locator('#notice-preview-panel ol li').waitFor();
    await formatAll(page, '번호 목록');
    await body.press('ArrowRight');
    await body.press('End');
    await body.press('Enter');
    await page.getByRole('button', { name: '표 삽입', exact: true }).click();
    await body.locator('td').first().click();
    await page.keyboard.insertText('항목');
    await page.getByRole('button', { name: '행 추가', exact: true }).click();
    await page.getByRole('button', { name: '열 추가', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('#notice-preview-panel td').length === 9);
    await page.getByLabel('제목 *', { exact: true }).fill('표 공지');
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await page.getByRole('heading', { name: '초안 수정', exact: true }).waitFor();
    assert.equal(await body.locator('td').count(), 9);
    await body.locator('td').filter({ hasText: '항목' }).click();
    await page.getByRole('button', { name: '표 삭제', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#notice-body table') === null);
    await body.press('ControlOrMeta+End');
    await page.getByRole('button', { name: '구분선', exact: true }).click();
    await page.locator('#notice-preview-panel hr').waitFor();
  }));

test('약관: 서식 보존·날짜 채움·공개 읽기·새 버전 복제', async () =>
  scenario('term-publish', '/terms/service/new', async (page) => {
    const body = page.getByLabel('본문 *', { exact: true });
    await body.fill('고지 {{공고일}} · 시행 {{시행일}}');
    await formatAll(page, '굵게');
    await body.locator('strong').waitFor();
    await page.getByLabel('시행일 *', { exact: true }).fill('2026. 11. 10.');
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await page.getByRole('heading', { name: '서비스 이용약관 버전 #7 초안 수정', exact: true }).waitFor();
    await body.locator('strong').waitFor();
    assert.equal(await page.getByRole('button', { name: '초안 저장', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: '공개하기', exact: true }).click();
    await confirm(page, '공개하기');
    await page.getByRole('button', { name: '#7', exact: true }).click();
    await page.locator('main .slate-editor strong').waitFor();
    assert.equal(
      await page.locator('main .slate-editor strong').innerText(),
      '고지 2026년 10월 7일 · 시행 2026년 11월 10일'
    );
    await page.getByRole('link', { name: '이용약관', exact: true }).last().click();
    await page.getByRole('link', { name: '새 버전 작성', exact: true }).click();
    await body.locator('strong').waitFor();
    assert.equal(await body.innerText(), '고지 {{공고일}} · 시행 {{시행일}}');
    assert.equal(await page.getByText('저장하지 않은 변경', { exact: true }).count(), 0);
    await page.getByRole('link', { name: '이용약관', exact: true }).last().click();
    await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
    assert.equal(await page.getByRole('alertdialog').count(), 0);
  }));

test('390px: 탭 전환·빠른 서식 조작·표 스크롤·키보드 접근', async () =>
  scenario(
    'mobile',
    '/notices/new',
    async (page) => {
      const body = page.getByLabel('본문 *', { exact: true });
      await body.fill('모바일 안내');
      await formatAll(page, '굵게');
      await body.locator('strong').waitFor();
      await page.getByRole('tab', { name: '미리보기', exact: true }).click();
      await page.locator('#notice-preview-panel strong').waitFor();
      await page.getByRole('tab', { name: '작성', exact: true }).click();
      await body.locator('strong').waitFor();
      const bold = page.getByRole('button', { name: '굵게', exact: true });
      await bold.focus();
      await bold.press('Enter');
      await page.waitForFunction(() => document.querySelector('#notice-body strong') === null);
      await page.getByRole('button', { name: '표 삽입', exact: true }).click();
      await body.locator('td').first().click();
      await page.getByRole('button', { name: '열 추가', exact: true }).click();
      await page.getByRole('button', { name: '열 추가', exact: true }).click();
      await page.getByRole('tab', { name: '미리보기', exact: true }).click();
      await page.locator('#notice-preview-panel table').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const table = page.locator('#notice-preview-panel table');
      assert.equal(
        await table.evaluate((table) => table.parentElement!.scrollWidth > table.parentElement!.clientWidth),
        true
      );
    },
    390
  ));
