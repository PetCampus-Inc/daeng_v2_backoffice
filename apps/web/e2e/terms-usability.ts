import type { Browser, BrowserContext, Page } from 'playwright';
import type { ScenarioOptions } from './type/browser-state.ts';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { before, after, test } from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright') as typeof import('playwright');
const BASE = process.env.BO_QA_BASE_URL || 'http://127.0.0.1:5186';
const OUTPUT = process.env.BO_QA_OUTPUT_DIR || path.resolve('.local/test-results/terms');
let browser: Browser;
before(async () => {
  await mkdir(OUTPUT, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});
after(async () => browser?.close());
async function scenario(
  id: string,
  run: (page: Page, context: BrowserContext) => Promise<unknown>,
  { role = '최고관리자', width = 1440, initialDelay = 0 }: ScenarioOptions = {}
) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(12000);
  try {
    await page.clock.setFixedTime(new Date('2026-10-07T10:00:00+09:00'));
    await page.goto(`${BASE}/terms`);
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).waitFor();
    await page.evaluate(async (delay) => {
      const { network } = await import('/@id/__x00__virtual:msw');
      const { http } = await import('/node_modules/.vite/deps/msw.js');
      window.__termsQA = { delay, delays: {}, failGet: false, mutationDelay: 0, mutationStatus: 0, requests: [] };
      network.use(
        http.all('/api/v0/platform-admin/terms/*', async ({ request }) => {
          const qa = window.__termsQA;
          const method = request.method;
          qa.requests.push({ method, url: request.url });
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              method === 'GET'
                ? (qa.delays[new URL(request.url).pathname.split('/').at(-1)!] ?? qa.delay)
                : qa.mutationDelay
            )
          );
          const status = method === 'GET' ? (qa.failGet ? 500 : 0) : qa.mutationStatus;
          if (status === -1) return Response.error();
          if (status) {
            return new Response(
              JSON.stringify({ status, code: 'QA_ERROR', errorMessage: '검증 오류', message: '검증 오류' }),
              { status, headers: { 'Content-Type': 'application/json' } }
            );
          }
        })
      );
    }, initialDelay);
    await page.getByRole('radio', { name: role, exact: true }).click();
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).click();
    await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
    if (!initialDelay) await page.getByRole('button', { name: '#4', exact: true }).waitFor();
    await run(page, context);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(OUTPUT, `${id}.png`), fullPage: true });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    await page.screenshot({ path: path.join(OUTPUT, `${id}-failure.png`), fullPage: true }).catch(() => {});
    error.message += `\npage errors: ${errors.join('; ')}`;
    throw error;
  } finally {
    await context.tracing.stop({ path: path.join(OUTPUT, `${id}.zip`) });
    await context.close();
  }
}
async function qa(page: Page, values: Partial<Window['__termsQA']>) {
  await page.evaluate((values) => Object.assign(window.__termsQA, values), values);
}
async function openDraft(page: Page) {
  await page.getByRole('button', { name: '#4', exact: true }).click();
  await page.getByLabel('시행일 *', { exact: true }).waitFor();
}
async function validDate(page: Page) {
  await page.getByLabel('시행일 *', { exact: true }).fill('2026. 11. 10.');
}
async function openSavedPrivacyDraft(page: Page) {
  await page.getByRole('tab', { name: '개인정보 처리방침', exact: true }).click();
  await text(page, '철회');
  await page.getByRole('link', { name: '새 버전 작성', exact: true }).click();
  await page.getByLabel('시행일 *', { exact: true }).fill('2026. 10. 01.');
  await page.getByRole('button', { name: '초안 저장', exact: true }).click();
  await page.getByRole('heading', { name: '개인정보 처리방침 버전 #3 초안 수정', exact: true }).waitFor();
  await page.goBack();
  await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
  await page.getByRole('button', { name: '#3', exact: true }).click();
  await page.getByLabel('시행일 *', { exact: true }).waitFor();
}
async function confirm(page: Page, label: string) {
  await page.getByRole('alertdialog').getByRole('button', { name: label, exact: true }).click();
}
async function text(page: Page, value: string) {
  await page.getByText(value, { exact: true }).first().waitFor();
}
async function api(page: Page, method: string, url: string, body?: unknown) {
  return page.evaluate(
    async ({ method, url, body }) => {
      const response = await fetch(`/api/v0/platform-admin${url}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    },
    { method, url, body }
  );
}

test('최초 로딩 뒤 서비스 약관 목록과 상태를 표시한다', async () =>
  scenario(
    'list',
    async (page) => {
      await page.getByRole('status').filter({ hasText: '불러오는 중입니다' }).waitFor();
      await page.getByRole('button', { name: '#4', exact: true }).waitFor();
      assert.deepEqual(await page.locator('tbody tr').allTextContents(), [
        '#4초안',
        '#3예정2026. 10. 20.2026. 10. 01.',
        '#2현행2026. 09. 01.2026. 08. 20.',
        '#1과거2026. 03. 01.2026. 02. 20.',
      ]);
    },
    { initialDelay: 1500 }
  ));

test('약관 종류별 상태와 빈 목록을 표시한다', async () =>
  scenario('kind-lists', async (page) => {
    await page.getByRole('tab', { name: '개인정보 처리방침', exact: true }).click();
    await text(page, '철회');
    await page.getByRole('tab', { name: '위치기반서비스 이용약관', exact: true }).click();
    await text(page, '등록된 항목이 없습니다.');
    assert.equal(await page.getByRole('button', { name: '새 버전 작성', exact: true }).count(), 0);
  }));

test('약관 종류 전환의 역순 응답에서 마지막 선택을 유지한다', async () =>
  scenario('kind-race', async (page) => {
    const tab = page.getByRole('tab', { name: '개인정보 처리방침', exact: true });
    const before = await tab.boundingBox();
    assert.ok(before, '검사 대상 요소가 표시되어야 한다');
    await qa(page, { delays: { privacy: 2000, location: 1000 } });
    await tab.click();
    await page.getByRole('tab', { name: '위치기반서비스 이용약관', exact: true }).click();
    await text(page, '버전을 불러오는 중…');
    await page.getByRole('button', { name: '#4', exact: true }).waitFor({ state: 'hidden' });
    await text(page, '등록된 항목이 없습니다.');
    await page.waitForTimeout(1200);
    await text(page, '등록된 항목이 없습니다.');
    const after = await tab.boundingBox();
    assert.ok(after, '검사 대상 요소가 표시되어야 한다');
    assert.deepEqual(after, before);
  }));

test('약관 종류 조회 실패 후 초점을 유지해 다시 시도한다', async () =>
  scenario('kind-retry', async (page) => {
    const tab = page.getByRole('tab', { name: '개인정보 처리방침', exact: true });
    await qa(page, { failGet: true, delays: {} });
    await tab.click();
    await text(page, '데이터를 불러오지 못했습니다.');
    await qa(page, { failGet: false });
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await text(page, '철회');
    assert.equal(await tab.evaluate((el) => el === document.activeElement), true);
  }));

test('약관 상세에서 목록으로 돌아오면 종류와 초점을 유지한다', async () =>
  scenario('kind-return', async (page) => {
    await page.getByRole('tab', { name: '개인정보 처리방침', exact: true }).click();
    await text(page, '철회');
    await page.getByRole('button', { name: '#1', exact: true }).click();
    await page.getByRole('heading', { name: '개인정보 처리방침 버전 #1', exact: true }).waitFor();
    await page.getByRole('link', { name: '이용약관', exact: true }).last().click();
    await page.getByRole('button', { name: '#1', exact: true }).waitFor();
    assert.match(page.url(), /kind=privacy/);
    assert.equal(
      await page.getByRole('button', { name: '#1', exact: true }).evaluate((el) => el === document.activeElement),
      true
    );
  }));

test('새 버전을 초안 저장하고 생성된 주소로 교체한다', async () =>
  scenario('draft-create', async (page) => {
    await page.getByRole('link', { name: '새 버전 작성', exact: true }).click();
    assert.match(await page.getByLabel('본문 *', { exact: true }).inputValue(), /공고일자: \{\{공고일\}\}/);
    await page
      .getByLabel('본문 *', { exact: true })
      .fill('제1조 목적\n' + (await page.getByLabel('본문 *', { exact: true }).inputValue()));
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await page.getByRole('heading', { name: '서비스 이용약관 버전 #5 초안 수정', exact: true }).waitFor();
    assert.match(page.url(), /service\/5$/);
    assert.equal(await page.getByRole('button', { name: '초안 저장', exact: true }).isDisabled(), true);
  }));

test('새 버전 공개에서 날짜를 검증하고 치환된 본문을 표시한다', async () =>
  scenario('publish-flow', async (page) => {
    await page.getByRole('link', { name: '새 버전 작성', exact: true }).click();
    await page.getByLabel('시행일 *', { exact: true }).fill('2026. 10. 15.');
    await page.getByRole('button', { name: '공개하기', exact: true }).click();
    await text(page, '시행일은 같은 약관의 가장 최근 시행일보다 이후여야 합니다.');
    assert.equal(
      await page.getByLabel('시행일 *', { exact: true }).evaluate((el) => el === document.activeElement),
      true
    );
    await validDate(page);
    await page.getByRole('button', { name: '공개하기', exact: true }).click();
    await confirm(page, '공개하기');
    await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
    await page.getByRole('button', { name: '#5', exact: true }).click();
    await page.getByRole('heading', { name: '서비스 이용약관 버전 #5', exact: true }).waitFor();
    await text(page, '공개 철회');
    assert.equal(await page.getByRole('button', { name: '초안 저장', exact: true }).count(), 0);
    assert.match(await page.locator('main').innerText(), /2026년 11월 10일/);
    assert.doesNotMatch(await page.locator('main').innerText(), /\{\{/);
  }));

test('빈 약관 종류에서 새 버전 작성을 시작한다', async () =>
  scenario('empty-kind-create', async (page) => {
    await page.getByRole('tab', { name: '위치기반서비스 이용약관', exact: true }).click();
    await text(page, '등록된 항목이 없습니다.');
    await page.getByRole('link', { name: '새 버전 작성', exact: true }).click();
    await page.getByLabel('본문 *', { exact: true }).waitFor();
  }));

test('빈 본문은 직접 공개하지 못한다', async () =>
  scenario('empty-body-validation', async (page) => {
    await page.getByRole('tab', { name: '위치기반서비스 이용약관', exact: true }).click();
    await page.getByRole('link', { name: '새 버전 작성', exact: true }).click();
    await page.getByLabel('본문 *', { exact: true }).fill('');
    await page.getByLabel('시행일 *', { exact: true }).fill('2026. 10. 14.');
    await page.getByRole('button', { name: '공개하기', exact: true }).click();
    await text(page, '본문을 입력해 주세요.');
  }));

test('새 버전을 초안 저장 없이 직접 공개한다', async () =>
  scenario('direct-publish', async (page) => {
    await page.getByRole('tab', { name: '위치기반서비스 이용약관', exact: true }).click();
    await page.getByRole('link', { name: '새 버전 작성', exact: true }).click();
    await page.getByLabel('본문 *', { exact: true }).fill('공고일자: {{공고일}}\n시행일자: {{시행일}}');
    await page.getByLabel('시행일 *', { exact: true }).fill('2026. 10. 14.');
    await page.getByRole('button', { name: '공개하기', exact: true }).click();
    await confirm(page, '공개하기');
    await page.getByRole('button', { name: '#1', exact: true }).waitFor();
    await text(page, '예정');
    assert.match(page.url(), /kind=location/);
  }));

test('공개와 삭제 확인창을 Esc와 취소로 닫으면 초점을 복원한다', async () =>
  scenario('dialog-cancel-focus', async (page) => {
    await openDraft(page);
    await validDate(page);
    for (const label of ['공개하기', '초안 삭제'] as const) {
      const trigger = page.getByRole('button', { name: label, exact: true });
      await trigger.click();
      await page.getByRole('alertdialog').waitFor();
      await page.keyboard.press('Tab');
      assert.equal(await page.getByRole('alertdialog').evaluate((el) => el.contains(document.activeElement)), true);
      await page.keyboard.press('Escape');
      await trigger.waitFor();
      await page.waitForFunction((label) => document.activeElement?.textContent === label, await trigger.textContent());
      await trigger.click();
      await confirm(page, '취소');
      await page.waitForFunction((label) => document.activeElement?.textContent === label, await trigger.textContent());
    }
  }));

test('수정 중 목록 이동을 취소하면 입력을 보존한다', async () =>
  scenario('leave-cancel', async (page) => {
    await openDraft(page);
    await validDate(page);
    await page.getByRole('link', { name: '이용약관', exact: true }).last().click();
    await page.getByRole('alertdialog').waitFor();
    await confirm(page, '취소');
    assert.equal(await page.getByLabel('시행일 *', { exact: true }).inputValue(), '2026. 11. 10.');
  }));

test('초안 삭제 확인 뒤 목록에서 삭제된 버전을 제거한다', async () =>
  scenario('draft-delete', async (page) => {
    await openDraft(page);
    await page.getByRole('button', { name: '초안 삭제', exact: true }).click();
    await confirm(page, '초안 삭제');
    await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
    await page.getByRole('button', { name: '#4', exact: true }).waitFor({ state: 'hidden' });
  }));

test('초안 저장 지연 중 중복 실행을 막고 500 오류에서 입력을 보존한다', async () =>
  scenario('save-pending-500', async (page) => {
    await openDraft(page);
    await validDate(page);
    await qa(page, { mutationDelay: 1500, mutationStatus: 500 });
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await text(page, '처리 중… 입력은 처리 후 수정할 수 있습니다.');
    assert.equal(await page.getByLabel('본문 *', { exact: true }).getAttribute('readonly'), '');
    assert.equal(await page.getByRole('button', { name: '초안 삭제', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '공개하기', exact: true }).isDisabled(), true);
    await text(page, '일시적 오류로 요청을 완료하지 못했습니다.');
    assert.equal(await page.getByLabel('시행일 *', { exact: true }).inputValue(), '2026. 11. 10.');
  }));

test('초안 저장 경합에서 입력을 보존한다', async () =>
  scenario('save-conflict', async (page) => {
    await openDraft(page);
    await validDate(page);
    await qa(page, { mutationStatus: 409 });
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await text(page, '저장하지 못했습니다.');
    assert.equal(await page.getByLabel('시행일 *', { exact: true }).inputValue(), '2026. 11. 10.');
  }));

test('삭제된 초안 저장 실패 뒤 목록 이동을 취소할 수 있다', async () =>
  scenario('save-missing', async (page) => {
    await openDraft(page);
    await validDate(page);
    await qa(page, { mutationStatus: 404 });
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await page.getByRole('button', { name: '목록으로', exact: true }).click();
    await page.getByRole('alertdialog').waitFor();
    await confirm(page, '취소');
  }));

for (const status of [500, 409, 404, 400] as const) {
  test(`공개 실패 ${status}에서 입력을 보존한다`, async () =>
    scenario(`publish-error-${status}`, async (page) => {
      await openDraft(page);
      await validDate(page);
      await qa(page, { mutationStatus: status, mutationDelay: 100 });
      await page.getByRole('button', { name: '공개하기', exact: true }).click();
      await confirm(page, '공개하기');
      await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
      if (status === 500) await text(page, '일시적 오류로 요청을 완료하지 못했습니다.');
      else await text(page, '약관을 공개하지 못했습니다.');
      assert.equal(await page.getByLabel('시행일 *', { exact: true }).inputValue(), '2026. 11. 10.');
    }));
}

test('공개 실패를 수정한 뒤 다시 공개한다', async () =>
  scenario('publish-recovery', async (page) => {
    await openDraft(page);
    await validDate(page);
    await qa(page, { mutationStatus: 0 });
    await page.getByRole('button', { name: '공개하기', exact: true }).click();
    await confirm(page, '공개하기');
    await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
  }));

test('예정 버전 철회 취소와 실패 뒤 다시 철회한다', async () =>
  scenario('withdraw-recovery', async (page) => {
    await page.getByRole('button', { name: '#3', exact: true }).click();
    const trigger = page.getByRole('button', { name: '공개 철회', exact: true });
    await trigger.click();
    await confirm(page, '취소');
    await page.waitForFunction((label) => document.activeElement?.textContent === label, await trigger.textContent());
    await qa(page, { mutationStatus: 500, mutationDelay: 1500 });
    await trigger.click();
    await confirm(page, '공개 철회');
    await page.waitForFunction(
      (element) => (element as HTMLButtonElement).disabled,
      await page.getByRole('alertdialog').getByRole('button', { name: '공개 철회', exact: true }).elementHandle()
    );
    await text(page, '일시적 오류로 요청을 완료하지 못했습니다.');
    await qa(page, { mutationStatus: 0, mutationDelay: 0 });
    await trigger.click();
    await confirm(page, '공개 철회');
    await text(page, '앱에 보이지 않는 버전입니다.');
    assert.equal(await trigger.count(), 0);
  }));

test('새 버전 작성은 최근 공개 버전을 복제한다', async () =>
  scenario('clone-source', async (page) => {
    await page.getByRole('button', { name: '#3', exact: true }).click();
    await page.getByRole('button', { name: '공개 철회', exact: true }).click();
    await confirm(page, '공개 철회');
    await text(page, '앱에 보이지 않는 버전입니다.');
    await page.getByRole('link', { name: '이용약관', exact: true }).last().click();
    await page.getByRole('link', { name: '새 버전 작성', exact: true }).click();
    assert.match(await page.getByLabel('본문 *', { exact: true }).inputValue(), /서비스 이용약관 2판/);
  }));

test('입력을 원래 값으로 되돌리면 확인 없이 목록으로 이동한다', async () =>
  scenario('unchanged-leave', async (page) => {
    await page.getByRole('tab', { name: '개인정보 처리방침', exact: true }).click();
    await text(page, '철회');
    await page.getByRole('link', { name: '새 버전 작성', exact: true }).click();
    const body = page.getByLabel('본문 *', { exact: true });
    const initial = await body.inputValue();
    await body.fill('바뀜');
    await body.fill(initial);
    await page.getByRole('link', { name: '이용약관', exact: true }).last().click();
    await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
  }));

test('초안 저장 뒤 교체된 주소에서 뒤로 이동한다', async () =>
  scenario('saved-history', async (page) => {
    await page.getByRole('tab', { name: '개인정보 처리방침', exact: true }).click();
    await text(page, '철회');
    await page.getByRole('link', { name: '새 버전 작성', exact: true }).click();
    await page.getByLabel('시행일 *', { exact: true }).fill('2026. 10. 01.');
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await page.getByRole('heading', { name: '개인정보 처리방침 버전 #3 초안 수정', exact: true }).waitFor();
    await page.goBack();
    await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
  }));

test('수정 중 새로고침에 beforeunload 경고를 표시한다', async () =>
  scenario('beforeunload', async (page) => {
    await openSavedPrivacyDraft(page);
    await validDate(page);
    const dialog = page.waitForEvent('dialog');
    const reload = page.reload();
    const warning = await dialog;
    assert.equal(warning.type(), 'beforeunload');
    await warning.dismiss();
    await reload.catch(() => {});
  }));

test('수정 중 목록 이동 확인 뒤 나간다', async () =>
  scenario('leave-confirm', async (page) => {
    await openSavedPrivacyDraft(page);
    await validDate(page);
    await page.getByLabel('시행일 *', { exact: true }).fill('2026. 12. 10.');
    await page.getByRole('link', { name: '이용약관', exact: true }).last().click();
    await confirm(page, '나가기');
    await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
  }));

for (const role of ['운영자', '조회자'] as const) {
  test(`${role}는 약관을 읽기 전용으로 조회한다`, async () =>
    scenario(
      `role-read-${role}`,
      async (page) => {
        assert.equal(await page.getByRole('link', { name: '새 버전 작성', exact: true }).count(), 0);
        await page.getByRole('button', { name: '#4', exact: true }).click();
        await page.getByRole('heading', { name: '서비스 이용약관 버전 #4', exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: '초안 삭제', exact: true }).count(), 0);
      },
      { role }
    ));
  test(`${role}의 약관 변경 API와 작성 주소 접근을 거부한다`, async () =>
    scenario(
      `role-write-denied-${role}`,
      async (page) => {
        for (const [method, url, body] of [
          ['POST', '/terms/service', { action: 'save', body: 'a', effectiveDate: '' }],
          ['PATCH', '/terms/service/4', { action: 'publish', revision: 1, body: 'a', effectiveDate: '2026-11-10' }],
          ['DELETE', '/terms/service/4', { revision: 1 }],
        ] as const) {
          assert.equal((await api(page, method, url, body)).status, 403);
        }
        for (const url of ['/terms/service/new', '/terms/service/4/edit'] as const) {
          await page.goto(BASE + url);
          await text(page, '접근 권한이 없습니다.');
        }
      },
      { role }
    ));
}

for (const [name, method, url, body, status] of [
  ['현행 버전 철회', 'PATCH', '/terms/service/2', { action: 'withdraw', revision: 1 }, 409],
  [
    '예정 버전이 있는 종류의 공개',
    'PATCH',
    '/terms/privacy/2',
    { action: 'publish', revision: 1, body: 'x', effectiveDate: '2026-12-10' },
    409,
  ],
  [
    '낡은 revision 저장',
    'PATCH',
    '/terms/service/4',
    { action: 'save', revision: 0, body: 'x', effectiveDate: '' },
    409,
  ],
  ['공개 버전 삭제', 'DELETE', '/terms/service/2', { revision: 1 }, 409],
  [
    '과거 시행일 직접 공개',
    'POST',
    '/terms/privacy',
    { action: 'publish', body: 'x', effectiveDate: '2026-10-13' },
    400,
  ],
] as const) {
  test(`약관 API는 ${name} 요청을 거부한다`, async () =>
    scenario(`api-rule-${status}-${url.replaceAll('/', '-')}-${name}`, async (page) => {
      assert.equal((await api(page, method, url, body)).status, status);
    }));
}

test('삭제한 초안 번호를 다음 버전에서 재사용하지 않는다', async () =>
  scenario('api-version-sequence', async (page) => {
    const saved = await api(page, 'POST', '/terms/location', { action: 'save', body: '', effectiveDate: 'abc' });
    assert.equal(saved.status, 201);
    assert.equal((await api(page, 'DELETE', '/terms/location/1', { revision: 1 })).status, 200);
    assert.equal(
      (await api(page, 'POST', '/terms/location', { action: 'save', body: '', effectiveDate: '' })).body.data.version,
      2
    );
  }));

test('KST 날짜 경계의 철회 경합에서 최신 현행 상태를 표시한다', async () =>
  scenario('boundary-conflict', async (page) => {
    await page.getByRole('button', { name: '#3', exact: true }).click();
    await page.getByRole('button', { name: '공개 철회', exact: true }).click();
    await page.clock.setFixedTime(new Date('2026-10-20T00:00:00+09:00'));
    // 날짜 경합만 검사한다. 장기 무활동 만료는 session-integration.ts에서 별도로 검증한다.
    await page.evaluate(() => {
      const key = 'daeng-bo-mock-session';
      const session = JSON.parse(localStorage.getItem(key)!);
      session.lastRequestAt = Date.now();
      localStorage.setItem(key, JSON.stringify(session));
    });
    await confirm(page, '공개 철회');
    await text(page, '약관 상태가 변경되어 요청을 완료하지 못했습니다. 최신 상태를 확인해 주세요.');
    await text(page, '현행');
    assert.equal(await page.getByRole('button', { name: '공개 철회', exact: true }).count(), 0);
  }));

test('없는 약관에서 목록으로 돌아간다', async () =>
  scenario('missing-return', async (page) => {
    await page.goto(BASE + '/terms/service/99');
    await text(page, '페이지를 찾을 수 없습니다.');
    await page.getByRole('link', { name: '목록으로', exact: true }).click();
    await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
  }));

for (const width of [1440, 1200, 1199, 390] as const) {
  test(`${width}px 미리보기 전환에서 입력 위치를 유지한다`, async () =>
    scenario(
      `width-${width}`,
      async (page) => {
        await openDraft(page);
        await validDate(page);
        const body = page.getByLabel('본문 *', { exact: true });
        await body.fill('긴본문'.repeat(500) + '\n{{공고일}} {{시행일}}');
        await body.evaluate((el) => {
          el.focus();
          (el as HTMLInputElement).setSelectionRange(20, 25);
          el.scrollTop = 50;
        });
        if (width < 1200) {
          const preview = page.getByRole('tab', { name: '미리보기', exact: true });
          await preview.click();
          await text(page, '시행일 2026. 11. 10.');
          await preview.press('ArrowLeft');
          await page.waitForFunction(
            () =>
              document.querySelector('[role=tablist][aria-label="약관 작성 보기"] [data-state=active]')?.textContent ===
              '작성'
          );
          assert.deepEqual(
            await body.evaluate((el) => [
              (el as HTMLInputElement).selectionStart,
              (el as HTMLInputElement).selectionEnd,
              el.scrollTop,
            ]),
            [20, 25, 50]
          );
        } else {
          await page.getByRole('complementary', { name: '약관 앱 미리보기' }).waitFor();
          assert.equal(await page.getByRole('tab', { name: '작성', exact: true }).isVisible(), false);
        }
      },
      { width }
    ));
  test(`${width}px 날짜 오류 초점과 화면 너비를 유지한다`, async () =>
    scenario(
      `width-validation-${width}`,
      async (page) => {
        await openDraft(page);
        await page.getByLabel('시행일 *', { exact: true }).fill('abc');
        await page.getByRole('button', { name: '공개하기', exact: true }).click();
        await text(page, '날짜 형식을 확인해 주세요. 예: 2026. 10. 20.');
        assert.equal(
          await page.getByLabel('시행일 *', { exact: true }).evaluate((el) => el === document.activeElement),
          true
        );
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.locator('summary').click();
        await text(page, '초안 저장 시에는 시행일을 검증하지 않습니다.');
      },
      { width }
    ));
}

for (const status of [500, 409, 404] as const) {
  test(`초안 삭제 실패 ${status}에서 입력을 보존한다`, async () =>
    scenario(`delete-error-${status}`, async (page) => {
      await openDraft(page);
      await validDate(page);
      const body = page.getByLabel('본문 *', { exact: true });
      await body.fill('복사할 미저장 내용');
      await qa(page, { mutationDelay: 1500, mutationStatus: status });
      await page.getByRole('button', { name: '초안 삭제', exact: true }).click();
      await confirm(page, '초안 삭제');
      await text(page, '초안 삭제 중…');
      assert.equal(await page.getByLabel('본문 *', { exact: true }).getAttribute('readonly'), '');
      await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
      if (status === 500) await text(page, '일시적 오류로 요청을 완료하지 못했습니다.');
      else await text(page, '삭제하지 못했습니다.');
      assert.equal(await body.inputValue(), '복사할 미저장 내용');
    }));
}

test('초안 삭제 실패 뒤 이탈을 취소하고 다시 삭제한다', async () =>
  scenario('delete-recovery', async (page) => {
    await openDraft(page);
    await validDate(page);
    await page.getByLabel('본문 *', { exact: true }).fill('복사할 미저장 내용');
    await qa(page, { mutationStatus: 404 });
    await page.getByRole('button', { name: '초안 삭제', exact: true }).click();
    await confirm(page, '초안 삭제');
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    await text(page, '삭제하지 못했습니다.');
    await page.getByRole('button', { name: '목록으로', exact: true }).click();
    await page.getByRole('alertdialog').waitFor();
    await confirm(page, '취소');
    await qa(page, { mutationDelay: 0, mutationStatus: 0 });
    await page.getByRole('button', { name: '초안 삭제', exact: true }).click();
    await confirm(page, '초안 삭제');
    await page.getByRole('heading', { name: '이용약관', exact: true }).waitFor();
    await page.getByRole('button', { name: '#4', exact: true }).waitFor({ state: 'hidden' });
  }));

test('CDP 한글 조합 입력을 본문에 반영한다', async () =>
  scenario('ime-input', async (page) => {
    await openDraft(page);
    await validDate(page);
    const body = page.getByLabel('본문 *', { exact: true });
    await body.fill('');
    await body.focus();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
    await cdp.send('Input.insertText', { text: '한' });
    await cdp.detach();
    assert.equal(await body.inputValue(), '한');
  }));

test('네트워크 전송 실패 뒤 입력을 보존해 다시 저장한다', async () =>
  scenario('network-recovery', async (page) => {
    await openDraft(page);
    await validDate(page);
    const body = page.getByLabel('본문 *', { exact: true });
    await body.fill('한');
    await qa(page, { mutationStatus: -1 });
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await text(page, '일시적 오류로 요청을 완료하지 못했습니다.');
    assert.equal(await body.inputValue(), '한');
    await qa(page, { mutationStatus: 0 });
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await text(page, '초안을 저장했습니다.');
  }));

test('다른 화면 이동과 뒤로 가기의 이탈을 취소한다', async () =>
  scenario('leave-navigation', async (page) => {
    await openDraft(page);
    await validDate(page);
    await page.getByRole('link', { name: '앱 공지', exact: true }).click();
    await page.getByRole('alertdialog').waitFor();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.getByRole('alertdialog').evaluate((el) => el.contains(document.activeElement)), true);
    await confirm(page, '취소');
    await page.goBack();
    await page.getByRole('alertdialog').waitFor();
    await confirm(page, '취소');
  }));

test('알림과 메뉴와 프로필 조작에는 이탈 확인을 표시하지 않는다', async () =>
  scenario('leave-shell-controls', async (page) => {
    await openDraft(page);
    await validDate(page);
    await page.getByRole('button', { name: /^알림/ }).click();
    await page.getByRole('dialog', { name: '알림 센터' }).waitFor();
    assert.equal(await page.getByRole('alertdialog').count(), 0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '메뉴 닫기', exact: true }).click();
    assert.equal(await page.getByRole('alertdialog').count(), 0);
    await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
    await page.getByRole('button', { name: /김관리/ }).click();
    await page.getByRole('button', { name: '로그아웃', exact: true }).waitFor();
    assert.equal(await page.getByRole('alertdialog').count(), 0);
  }));

test('수정 중 로그아웃을 취소하거나 확인할 수 있다', async () =>
  scenario('leave-logout', async (page) => {
    await openDraft(page);
    await validDate(page);
    await page.getByRole('button', { name: /김관리/ }).click();
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await page.getByRole('alertdialog').waitFor();
    await confirm(page, '취소');
    assert.equal(await page.getByLabel('시행일 *', { exact: true }).inputValue(), '2026. 11. 10.');
    if (!(await page.getByRole('button', { name: '로그아웃', exact: true }).isVisible())) {
      await page.getByRole('button', { name: /김관리/ }).click();
    }
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await confirm(page, '나가기');
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).waitFor();
  }));
