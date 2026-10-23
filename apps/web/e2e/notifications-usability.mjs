import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { before, after, test } from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const BASE = process.env.BO_QA_BASE_URL || 'http://127.0.0.1:5193';
const OUTPUT = path.resolve(process.env.BO_QA_OUTPUT_DIR || '.local/test-results/notifications');
let browser;
before(async () => {
  await mkdir(OUTPUT, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});
after(async () => browser?.close());
async function scenario(id, run, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(15000);
  try {
    await page.clock.setFixedTime(new Date('2026-10-07T10:00:00+09:00'));
    await run(page);
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

async function login(page, role = '운영자', route = '/home') {
  await page.goto(`${BASE}${route}`);
  await page.getByRole('radio', { name: role, exact: true }).check();
  await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).click();
  await page.getByRole('button', { name: '알림 3건 안 읽음', exact: true }).waitFor();
}
const trigger = (page) => page.getByRole('button', { name: /^알림(?: \d+건 안 읽음| 상태 확인 중)?$/ });
const list = (page) => page.getByRole('list', { name: '알림 목록' });
const item = (page, text) => list(page).getByRole('button', { name: new RegExp(text) });
async function open(page) {
  await trigger(page).click();
  await list(page).waitFor();
}
async function switchAccount(page, fromName, role) {
  await page.getByRole('button', { name: new RegExp(fromName) }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByRole('radio', { name: role, exact: true }).check();
  await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).click();
}
async function post(page, endpoint, body) {
  return page.evaluate(
    async ({ endpoint, body }) => {
      const response = await fetch(`/api/v0/platform-admin${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`개발용 이벤트 실패: ${response.status}`);
      return (await response.json()).data;
    },
    { endpoint, body }
  );
}
async function intercept(page, method, endpoint, { delay = 0, fail = false } = {}) {
  await page.evaluate(
    async ({ method, endpoint, delay, fail }) => {
      const { network } = await import('/@id/__x00__virtual:msw');
      const { http } = await import('/node_modules/.vite/deps/msw.js');
      window.__notificationQA = { fail, calls: 0 };
      network.use(
        http[method](`/api/v0/platform-admin${endpoint}`, async () => {
          window.__notificationQA.calls++;
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (window.__notificationQA.fail) {
            return new Response(JSON.stringify({ status: 500, code: 'QA_ERROR', message: '실패' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        })
      );
    },
    { method, endpoint, delay, fail }
  );
}

test('기본 목록·KST·읽음 이동·재개방·모두 읽음', async () =>
  scenario('basic', async (page) => {
    await login(page);
    await open(page);
    await page.screenshot({ path: path.join(OUTPUT, 'popover-default.png') });
    assert.equal(await list(page).getByRole('button').count(), 4);
    assert.match(await list(page).locator('time').first().innerText(), /2026\. 10\. 07\. 09:30/);
    assert.equal(
      await page
        .getByRole('dialog', { name: '알림 센터' })
        .evaluate((e) => Math.round(e.getBoundingClientRect().width)),
      380
    );
    await item(page, '새 1:1 문의').click();
    await page.waitForURL('**/inquiries/1041');
    await page.getByRole('button', { name: '알림 2건 안 읽음' }).waitFor();
    await open(page);
    await item(page, '^읽음: 새 1:1 문의').waitFor();
    await page.getByRole('button', { name: '모두 읽음', exact: true }).click();
    await page.getByRole('button', { name: '알림', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '모두 읽음', exact: true }).count(), 0);
    assert.equal(await list(page).evaluate((e) => e === document.activeElement), true);
    assert.equal(await page.locator('[data-sonner-toast]').count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await trigger(page).evaluate((e) => e === document.activeElement), true);
    await page.reload();
    await page.getByRole('button', { name: '알림', exact: true }).waitFor();
    await open(page);
    assert.equal(
      await list(page)
        .getByRole('button', { name: /^읽음:/ })
        .count(),
      4
    );
  }));

for (const [message, target] of [
  ['담당 중인 문의', '/inquiries/1050'],
  ['새 아이디어', '/ideas/350'],
  ['이담당', '/inquiries/1045'],
]) {
  test(`대상 이동 ${target}`, async () =>
    scenario(`target-${target.split('/').pop()}`, async (page) => {
      await login(page);
      await open(page);
      await item(page, message).click();
      await page.waitForURL(`**${target}`);
      await page
        .getByRole('button', { name: message === '이담당' ? '알림 3건 안 읽음' : '알림 2건 안 읽음' })
        .waitFor();
    }));
}

for (const action of ['one', 'all']) {
  test(`읽음 ${action} 지연·중복·실패·재시도`, async () =>
    scenario(`read-${action}`, async (page) => {
      await login(page);
      await open(page);
      await intercept(page, 'patch', action === 'all' ? '/notifications/read-all' : '/notifications/fixture-1/read', {
        delay: 1500,
        fail: true,
      });
      const target =
        action === 'all' ? page.getByRole('button', { name: /^(모두 읽음|처리 중…)$/ }) : item(page, '새 1:1 문의');
      const rowBounds = await list(page).locator('li').last().boundingBox();
      await target.click();
      await page.getByText('처리 중…', { exact: true }).waitFor();
      assert.equal(await target.isDisabled(), true);
      assert.deepEqual(await list(page).locator('li').last().boundingBox(), rowBounds);
      await target.evaluate((element) => {
        element.click();
        element.click();
      });
      await page.screenshot({ path: path.join(OUTPUT, `read-${action}-pending.png`) });
      await page.getByRole('button', { name: '알림 3건 안 읽음' }).waitFor();
      await page.getByRole('alert').getByText('알림을 처리하지 못했습니다. 같은 항목을 다시 눌러 주세요.').waitFor();
      assert.equal(await page.evaluate(() => window.__notificationQA.calls), 1);
      await page.evaluate(() => {
        window.__notificationQA.fail = false;
      });
      await target.click();
      if (action === 'one') await page.waitForURL('**/inquiries/1041');
      await page.getByRole('button', { name: action === 'all' ? '알림' : '알림 2건 안 읽음', exact: true }).waitFor();
    }));
}

test('조회 실패·재시도·빈 상태·계정별 읽음 분리', async () =>
  scenario('query-account', async (page) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole('radio', { name: '운영자', exact: true }).check();
    await intercept(page, 'get', '/notifications', { delay: 1500, fail: true });
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).click();
    await trigger(page).click();
    await page.getByText('알림을 불러오는 중…', { exact: true }).waitFor();
    assert.equal(await list(page).count(), 0);
    await page.getByRole('button', { name: '다시 시도', exact: true }).waitFor();
    await page.evaluate(() => {
      window.__notificationQA.fail = false;
    });
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await page.getByRole('button', { name: '알림 3건 안 읽음', exact: true }).waitFor();
    await page.getByRole('button', { name: '모두 읽음', exact: true }).click();
    await page.getByRole('button', { name: '알림', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /김운영/ }).click();
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await page.getByRole('radio', { name: '운영자2', exact: true }).check();
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).click();
    await page.getByRole('button', { name: '알림 3건 안 읽음', exact: true }).waitFor();
    await page.evaluate(() => localStorage.setItem('daeng-bo-mock-notifications', '[]'));
    await page.reload();
    await open(page);
    await page.getByText('새로운 알림이 없습니다.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '모두 읽음', exact: true }).count(), 0);
  }));

for (const denied of ['role', 'missing']) {
  test(`접근 불가 ${denied} 안내 후 읽음`, async () =>
    scenario(`denied-${denied}`, async (page) => {
      await login(page, denied === 'role' ? '조회자' : '운영자');
      if (denied === 'missing') {
        await page.evaluate(() => localStorage.setItem('daeng-bo-mock-inquiries-v2', '[]'));
      }
      await open(page);
      await item(page, '새 1:1 문의').click();
      await page.getByText('처리가 완료되었거나 볼 수 없는 항목입니다.', { exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/home');
      await page.getByRole('button', { name: '알림 2건 안 읽음' }).waitFor();
    }));
}

test('작성 중 취소·확인: 초안·읽음·포커스 보존', async () =>
  scenario('leave', async (page) => {
    await login(page, '운영자', '/inquiries/1043');
    const input = page.getByRole('textbox', { name: /답변/ });
    await input.fill('확인해 보겠습니다');
    await input.evaluate((e) => e.setSelectionRange(3, 3));
    await open(page);
    await item(page, '새 아이디어').focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor();
    assert.equal(await dialog.count(), 1);
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
    await page.getByRole('dialog', { name: '알림 센터' }).waitFor({ state: 'hidden' });
    assert.equal(await input.inputValue(), '확인해 보겠습니다');
    assert.equal(await input.evaluate((e) => e === document.activeElement), true);
    assert.equal(await input.evaluate((e) => e.selectionStart), 3);
    await page.getByRole('button', { name: '알림 3건 안 읽음' }).waitFor();
    await open(page);
    await item(page, '새 아이디어').click();
    await dialog.getByRole('button', { name: '나가기', exact: true }).click();
    await page.waitForURL('**/ideas/350');
    await page.getByRole('button', { name: '알림 2건 안 읽음' }).waitFor();
  }));

for (const width of [1440, 390]) {
  test(`키보드·긴 문구·스크롤·재개방 ${width}px`, async () =>
    scenario(
      `keyboard-${width}`,
      async (page) => {
        await login(page);
        await page.evaluate(() =>
          localStorage.setItem(
            'daeng-bo-mock-notifications',
            JSON.stringify(
              Array.from({ length: 18 }, (_, index) => ({
                id: `long-${index}`,
                recipientEmail: 'ops@knockdog.test',
                inquiryId: 1041,
                message: `새 문의 ${index} ` + '아주 긴 알림 문구입니다. '.repeat(20),
                createdAt: '2026-10-07T09:30:00+09:00',
              }))
            )
          )
        );
        await page.reload();
        await page.getByRole('button', { name: '알림 18건 안 읽음' }).waitFor();
        await trigger(page).focus();
        await page.keyboard.press('Enter');
        await list(page).waitFor();
        await page.keyboard.press('Tab');
        assert.equal(
          await list(page)
            .getByRole('button')
            .first()
            .evaluate((e) => e === document.activeElement),
          true
        );
        await list(page).evaluate((e) => {
          e.scrollTop = 180;
        });
        const scroll = await list(page).evaluate((e) => e.scrollTop);
        assert.ok(scroll > 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        const bounds = await page.getByRole('dialog', { name: '알림 센터' }).boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
        await page.screenshot({ path: path.join(OUTPUT, `popover-${width}.png`) });
        await page.keyboard.press('Escape');
        assert.equal(await trigger(page).evaluate((e) => e === document.activeElement), true);
        const before = await trigger(page).boundingBox();
        await open(page);
        assert.deepEqual(await trigger(page).boundingBox(), before);
        assert.equal(await list(page).evaluate((e) => e.scrollTop), scroll);
        await page.mouse.click(width - 8, 900);
        await list(page).waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: '알림 18건 안 읽음' }).waitFor();
      },
      width
    ));
}

test('새 문의 수신→맡기→추가 문의→해제 후 추가 문의는 수신 안 함', async () =>
  scenario('flow-new-follow-up', async (page) => {
    await login(page);
    await page.evaluate(() => localStorage.setItem('daeng-bo-mock-notifications', '[]'));
    const inquiry = await post(page, '/dev/inquiries', { title: '새 문의 흐름', body: '문의합니다' });
    assert.equal(inquiry.id, 1051);
    await page.reload();
    await page.getByRole('button', { name: '알림 1건 안 읽음' }).waitFor();
    await open(page);
    await item(page, '문의 #1051').click();
    await page.waitForURL('**/inquiries/1051');
    await page.getByRole('button', { name: '내가 맡기', exact: true }).click();
    await page.getByRole('button', { name: '담당 해제', exact: true }).waitFor();
    await post(page, '/dev/inquiries/1051/user-messages', { body: '추가 질문입니다' });
    await page.reload();
    await page.getByRole('button', { name: '알림 1건 안 읽음' }).waitFor();
    await open(page);
    await item(page, '^안 읽음: 담당 중인 문의에 추가 문의').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '담당 해제', exact: true }).click();
    await page.getByRole('button', { name: '내가 맡기', exact: true }).waitFor();
    await post(page, '/dev/inquiries/1051/user-messages', { body: '담당 없는 추가 질문' });
    await page.reload();
    await page.getByRole('button', { name: '알림 1건 안 읽음' }).waitFor();
    await open(page);
    assert.equal(await list(page).getByRole('button').count(), 2);
    await page.keyboard.press('Escape');
    await switchAccount(page, '김운영', '운영자2');
    await page.getByRole('button', { name: '알림 1건 안 읽음' }).waitFor();
    await open(page);
    assert.equal(await list(page).getByRole('button').count(), 1);
  }));

test('담당자 변경 기록 연결·새 제안은 조회자도 수신', async () =>
  scenario('events', async (page) => {
    await login(page, '운영자');
    await post(page, '/inquiries/1045/assignee', { expectedAssigneeEmail: 'ops2@knockdog.test' });
    await switchAccount(page, '김운영', '운영자2');
    await page.getByRole('button', { name: '알림 4건 안 읽음' }).waitFor();
    await open(page);
    assert.match(
      await list(page).getByRole('button').first().innerText(),
      /김운영 · PM님이 문의의 담당자를 변경했습니다\./
    );
    assert.equal(await list(page).getByRole('button').count(), 5);
    await list(page).getByRole('button').first().click();
    await page.waitForURL('**/inquiries/1045');
    await post(page, '/dev/ideas', { content: '새 제안 흐름' });
    await switchAccount(page, '이담당', '조회자');
    await page.getByRole('button', { name: '알림 4건 안 읽음' }).waitFor();
    await open(page);
    await item(page, '새 아이디어 제안이 등록되었습니다. 제안 #351').click();
    await page.waitForURL('**/ideas/351');
  }));

test('캐시 재조회 지연 중 기존 목록·스크롤·상단바 유지', async () =>
  scenario('continuity', async (page) => {
    await login(page);
    await open(page);
    const baseline = await list(page).boundingBox();
    await page.keyboard.press('Escape');
    await intercept(page, 'get', '/notifications', { delay: 1500 });
    await page.clock.setFixedTime(new Date('2026-10-07T10:01:00+09:00'));
    await open(page);
    assert.equal(await list(page).getByRole('button').count(), 4);
    assert.equal(await page.getByText('알림을 불러오는 중…', { exact: true }).count(), 0);
    assert.deepEqual(await list(page).boundingBox(), baseline);
    await page.screenshot({ path: path.join(OUTPUT, 'refetch-pending.png') });
    await page.waitForFunction(() => window.__notificationQA.calls === 1);
    await page.waitForTimeout(1700);
    assert.deepEqual(await list(page).boundingBox(), baseline);
  }));

test('알림 API의 비로그인·다른 수신자 읽음 거부', async () =>
  scenario('authorization', async (page) => {
    await page.goto(`${BASE}/login`);
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).waitFor();
    assert.equal(await page.evaluate(async () => (await fetch('/api/v0/platform-admin/notifications')).status), 401);
    await page.getByRole('radio', { name: '운영자', exact: true }).check();
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).click();
    await page.getByRole('button', { name: '알림 3건 안 읽음' }).waitFor();
    await page.evaluate(() =>
      localStorage.setItem(
        'daeng-bo-mock-notifications',
        JSON.stringify([
          {
            id: 'foreign',
            recipientEmail: 'ops2@knockdog.test',
            inquiryId: 1041,
            message: '다른 수신자',
            createdAt: '2026-10-07T09:30:00+09:00',
          },
        ])
      )
    );
    assert.equal(
      await page.evaluate(
        async () => (await fetch('/api/v0/platform-admin/notifications/foreign/read', { method: 'PATCH' })).status
      ),
      404
    );
  }));

for (const [id, title, question, answer] of [
  [1048, '비밀번호 변경', '비밀번호를 바꾸고 싶어요', '설정 메뉴에서 바꿀 수 있습니다'],
  [1049, '앱 오류', '앱이 자꾸 꺼져요', '최신 버전으로 업데이트해 주세요'],
]) {
  test(`해결 완료 문의 #${id} 알림은 읽음 후 읽기 전용 상세로 이동`, async () =>
    scenario(`resolved-${id}`, async (page) => {
      await login(page);
      await page.evaluate((id) => {
        const key = 'daeng-bo-mock-notifications';
        const notifications = JSON.parse(localStorage.getItem(key));
        const notification = notifications.find(
          (item) => item.id === 'fixture-1' && item.recipientEmail === 'ops@knockdog.test'
        );
        notification.targetId = id;
        notification.message = `새 1:1 문의가 등록되었습니다. 문의 #${id}`;
        localStorage.setItem(key, JSON.stringify(notifications));
      }, id);
      await page.reload();
      await page.getByRole('button', { name: '알림 3건 안 읽음' }).waitFor();
      await open(page);
      await item(page, `문의 #${id}`).click();
      await page.waitForURL(`**/inquiries/${id}`);
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      await page.getByText('해결 완료', { exact: true }).waitFor();
      await page.getByText(question, { exact: true }).waitFor();
      await page.getByText(answer, { exact: true }).waitFor();
      await page.getByText('해결 완료된 문의라 답변과 담당 변경을 할 수 없습니다.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('textbox', { name: /답변/ }).count(), 0);
      for (const name of ['답변 저장', '내가 맡기', '담당자 변경', '담당 해제']) {
        assert.equal(await page.getByRole('button', { name, exact: true }).count(), 0);
      }
      await page.getByRole('button', { name: '알림 2건 안 읽음' }).waitFor();
      await open(page);
      await item(page, `^읽음: 새 1:1 문의가 등록되었습니다. 문의 #${id}`).waitFor();
      await page.keyboard.press('Escape');
      await page.reload();
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      await page.getByRole('button', { name: '알림 2건 안 읽음' }).waitFor();
      assert.equal(await page.getByRole('textbox', { name: /답변/ }).count(), 0);
    }));
}
