import type { Browser, BrowserContext, Page } from 'playwright';
import type { ScenarioOptions } from './type/browser-state.ts';
// 저장소 루트에서 node --test로 실행. 기존 Playwright·Chromium 경로는 아래 환경변수로 지정한다.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, test } from 'node:test';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright') as typeof import('playwright');
const BASE_URL = process.env.BO_QA_BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = process.env.BO_QA_OUTPUT_DIR || path.resolve('.local/test-results/kindergartens');
const FIXTURES_25 = Array.from({ length: 25 }, (_, index) => ({
  id: 301 + index,
  name: `유치원 ${String(index + 1).padStart(2, '0')}`,
  ownerName: null,
  address: '서울 성동구 성수동 1',
  status: 'ACTIVE',
  activeMembers: 0,
  pendingMembers: 0,
  businessVerified: false,
  createdAt: new Date(Date.UTC(2026, 8, index + 1)).toISOString(),
}));
let browser: Browser;

before(async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});
after(async () => browser?.close());

async function scenario(
  id: string,
  run: (page: Page, context: BrowserContext) => Promise<unknown>,
  { fixtures, width = 1440, initialDelay = 0 }: ScenarioOptions = {}
) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(15000);
  try {
    await page.goto(`${BASE_URL}/kindergartens`);
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).waitFor();
    if (fixtures) {
      await page.evaluate(
        (items) => localStorage.setItem('daeng-bo-mock-kindergartens', JSON.stringify(items)),
        fixtures
      );
    }
    await page.evaluate(async (delay) => {
      const { network } = await import('/@id/__x00__virtual:msw');
      const { http } = await import('/node_modules/.vite/deps/msw.js');
      window.__schoolQA = { delay, delays: {}, fail: false, started: [], completed: [] };
      network.use(
        http.get('/api/v0/platform-admin/kindergartens', async ({ request }) => {
          const params = new URL(request.url).searchParams;
          const key = params.get('status') || params.get('keyword') || `page:${params.get('page')}`;
          const { delay: fallback, delays, fail } = window.__schoolQA;
          window.__schoolQA.started.push(key);
          await new Promise((resolve) => setTimeout(resolve, delays[key] ?? fallback));
          window.__schoolQA.completed.push(key);
          if (fail) {
            return new Response(
              JSON.stringify({ status: 500, code: 'QA_ERROR', message: '조회 실패', errorMessage: '조회 실패' }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
          // 기본 mock 핸들러로 넘겨 실제 필터·페이지 로직을 그대로 검증한다.
        })
      );
    }, initialDelay);
    await page.getByRole('radio', { name: '조회자', exact: true }).click();
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).click();
    await page.getByRole('heading', { name: '유치원 관리', exact: true }).waitFor();
    if (!initialDelay) await total(page, fixtures?.length ?? 4);
    await run(page, context);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${id}.png`), fullPage: true });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (errors.length) error.message += `\n브라우저 오류: ${errors.join('\n')}`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${id}-failure.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.tracing.stop({ path: path.join(OUTPUT_DIR, `${id}.zip`) });
    await context.close();
  }
}

const total = (page: Page, count: number) => page.getByText(`총 ${count}건`, { exact: true }).waitFor();
const search = (page: Page) => page.getByRole('searchbox', { name: '유치원 검색' });
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const names = (page: Page) => page.locator('tbody tr td:first-child p:first-child').allTextContents();
async function configure(page: Page, config: Partial<Window['__schoolQA']>) {
  await page.evaluate((next) => Object.assign(window.__schoolQA, next), config);
}
async function watchTransition(page: Page) {
  await page.evaluate(() => {
    window.__schoolFrames = [];
    window.__schoolWatching = true;
    function sample() {
      const table = document.querySelector('table');
      const input = document.querySelector<HTMLInputElement>('input[type=search]');
      window.__schoolFrames.push({
        busy: document.querySelector('[data-slot=card]')?.getAttribute('aria-busy') === 'true',
        table: Boolean(table),
        loading: Boolean(document.querySelector('[data-slot=list-state][role=status]')),
        inputTop: input?.getBoundingClientRect().top,
        height: table?.getBoundingClientRect().height,
        scroll: window.scrollY,
      });
      if (window.__schoolWatching) requestAnimationFrame(sample);
    }
    sample();
  });
}
async function assertStable(page: Page) {
  const frames = await page.evaluate(() => {
    window.__schoolWatching = false;
    return window.__schoolFrames;
  });
  assert.ok(frames.length > 10, '중간 프레임을 충분히 관찰해야 한다');
  assert.ok(
    frames.every((frame) => frame.table && !frame.loading),
    '전환 중 빈 화면·로딩 화면 점멸'
  );
  assert.ok(
    frames.every((frame) => Math.abs((frame.inputTop ?? NaN) - (frames[0].inputTop ?? NaN)) < 1),
    '검색창 위치 이동'
  );
  assert.ok(
    frames.every((frame) => Math.abs(frame.scroll - frames[0].scroll) < 1),
    '조회 중 스크롤 유실'
  );
  assert.ok(
    frames.filter((frame) => frame.busy).every((frame) => frame.height === frames[0].height),
    '응답 대기 중 표 높이 변화'
  );
}

test('S-012 최초 진입: 진행 표시 후 목록 표시', async () => {
  await scenario(
    '012',
    async (page) => {
      await page.getByText('불러오는 중입니다', { exact: true }).waitFor();
      assert.equal(await page.getByText(/^총 \d+건$/).count(), 0);
      assert.equal(await search(page).isEnabled(), true);
      await total(page, 4);
    },
    { initialDelay: 1200 }
  );
});

for (const [label, count, expected] of [
  ['운영 중', 3, ['햇살유치원', '달빛유치원', '별빛유치원']],
  ['폐업', 1, ['도담유치원']],
] as const) {
  test(`S-017 ${label} 첫 전환: 중간 프레임·위치·반응 확인`, async () => {
    await scenario(`017-${count}`, async (page) => {
      await configure(page, { delay: 1200 });
      await watchTransition(page);
      const before = await page.locator('table').boundingBox();
      assert.ok(before, '검사 대상 요소가 표시되어야 한다');
      await tab(page, label).click();
      assert.equal(await tab(page, label).getAttribute('aria-pressed'), 'true');
      await page.getByText('조회 중…', { exact: true }).waitFor();
      assert.equal((await page.locator('table').boundingBox())!.height, before.height);
      await total(page, count);
      await assertStable(page);
      assert.deepEqual(await names(page), expected);
      await tab(page, '전체').click();
      await total(page, 4);
    });
  });
}

test('S-018 빠른 전환: 역순 응답에도 마지막 선택 유지', async () => {
  await scenario('018', async (page) => {
    await configure(page, { delays: { ACTIVE: 2000, CLOSED: 1000 } });
    await watchTransition(page);
    await tab(page, '운영 중').click();
    await page.waitForFunction(() => window.__schoolQA.started.includes('ACTIVE'));
    await tab(page, '폐업').click();
    await total(page, 1);
    await page.waitForFunction(() => window.__schoolQA.completed.includes('ACTIVE'));
    await assertStable(page);
    assert.deepEqual(await names(page), ['도담유치원']);
    assert.equal(await tab(page, '폐업').getAttribute('aria-pressed'), 'true');
  });
});

test('S-019 검색: 입력 반응·중간 편집·커서·초점 유지', async () => {
  await scenario('019', async (page) => {
    await configure(page, { delay: 1200 });
    await watchTransition(page);
    await search(page).pressSequentially('서x울', { delay: 40 });
    await search(page).press('Home');
    await search(page).press('ArrowRight');
    await search(page).press('Delete');
    assert.equal(await search(page).inputValue(), '서울');
    await page.getByText('조회 중…', { exact: true }).waitFor();
    assert.equal(
      await search(page).evaluate(
        (element) => element === document.activeElement && (element as HTMLInputElement).selectionStart === 1
      ),
      true
    );
    await total(page, 2);
    await assertStable(page);
    assert.equal(
      await search(page).evaluate(
        (element) => element === document.activeElement && (element as HTMLInputElement).selectionStart === 1
      ),
      true
    );
    assert.deepEqual(await names(page), ['햇살유치원', '별빛유치원']);
  });
});

test('S-020 빈 결과 초기화: 키보드로 즉시 새 검색', async () => {
  await scenario('020', async (page) => {
    await search(page).fill('없는말');
    await page.getByText('검색 결과가 없습니다.', { exact: true }).waitFor();
    await configure(page, { delay: 1200 });
    await search(page).fill('여전히없음');
    await page.getByText('조건에 맞는 유치원을 조회하고 있습니다.', { exact: true }).waitFor();
    assert.equal(await page.getByText('검색 결과가 없습니다.', { exact: true }).count(), 0);
    await total(page, 0);
    await search(page).press('Tab');
    assert.equal(await tab(page, '필터 초기화').evaluate((element) => element === document.activeElement), true);
    await configure(page, { delay: 1200 });
    await page.keyboard.press('Enter');
    await total(page, 4);
    assert.equal(await search(page).evaluate((element) => element === document.activeElement), true);
    await page.keyboard.type('서울');
    await total(page, 2);
  });
});

test('S-021 실패·재시도: 조건과 초점 유지', async () => {
  await scenario('021', async (page) => {
    await configure(page, { fail: true });
    await search(page).fill('서울');
    await page.getByText('데이터를 불러오지 못했습니다.', { exact: true }).waitFor({ timeout: 20000 });
    assert.equal(await search(page).inputValue(), '서울');
    assert.equal(await page.locator('[data-sonner-toast]').count(), 0);
    await configure(page, { fail: false, delay: 1200 });
    await tab(page, '다시 시도').focus();
    await page.keyboard.press('Enter');
    await total(page, 2);
    assert.equal(await search(page).inputValue(), '서울');
    assert.equal(await search(page).evaluate((element) => element === document.activeElement), true);
  });
});

test('S-017 필터와 목록의 키보드 이동 순서를 제공한다', async () => {
  await scenario(
    '017-keyboard-order',
    async (page) => {
      await tab(page, '전체').focus();
      for (const label of ['운영 중', '폐업'] as const) {
        await page.keyboard.press('Tab');
        assert.equal(await tab(page, label).evaluate((element) => element === document.activeElement), true);
        assert.equal(
          await tab(page, label).evaluate((element) => {
            const style = getComputedStyle(element);
            return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
          }),
          true
        );
      }
      await page.keyboard.press('Space');
      await total(page, 0);
      await tab(page, '전체').focus();
      await page.keyboard.press('Enter');
      await total(page, 25);
      await tab(page, '폐업').focus();
      await page.keyboard.press('Tab');
      assert.equal(await search(page).evaluate((element) => element === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(
        await page
          .getByRole('region', { name: '유치원 목록 가로 스크롤' })
          .evaluate((element) => element === document.activeElement),
        true
      );
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      assert.equal(await tab(page, '2').evaluate((element) => element === document.activeElement), true);
    },
    { fixtures: FIXTURES_25 }
  );
});

test('S-022 페이지 이동 중 중복 실행을 막고 초점을 유지한다', async () => {
  await scenario(
    '022-pagination-pending',
    async (page) => {
      const pageTwo = tab(page, '2');
      await pageTwo.focus();
      await configure(page, { delay: 1200 });
      await watchTransition(page);
      await page.keyboard.press('Enter');
      await page.getByText('조회 중…', { exact: true }).waitFor();
      assert.equal(await pageTwo.isDisabled(), true);
      await page.waitForFunction(() => window.__schoolFrames.length >= 15);
      await assertStable(page);
      await page.getByText('유치원 05', { exact: true }).waitFor();
      assert.equal(await page.locator('[data-slot=pagination-button][aria-current=page]').textContent(), '2');
      assert.equal(await pageTwo.evaluate((element) => element === document.activeElement), true);
      assert.deepEqual(await names(page), ['유치원 05', '유치원 04', '유치원 03', '유치원 02', '유치원 01']);
      // 갱신 중 사용자가 검색창으로 이동했다면 완료 시 초점을 빼앗지 않는다.
      await tab(page, '1').click();
      await search(page).focus();
      await page.getByText('유치원 25', { exact: true }).waitFor();
      assert.equal(await search(page).evaluate((element) => element === document.activeElement), true);
    },
    { fixtures: FIXTURES_25 }
  );
});

for (const width of [390, 768, 1440] as const) {
  test(`S-023 ${width}px: 가림·가로 스크롤·조회 중 위치`, async () => {
    await scenario(
      `023-${width}`,
      async (page) => {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        for (const control of [search(page), tab(page, '운영 중'), tab(page, '폐업')] as const) {
          const box = await control.boundingBox();
          assert.ok(box, '검사 대상 요소가 표시되어야 한다');
          assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
        }
        const region = page.getByRole('region', { name: '유치원 목록 가로 스크롤' });
        if (width < 1000) {
          await region.focus();
          await page.keyboard.press('ArrowRight');
          await page.waitForFunction(() => document.querySelector('[data-slot=table-container]')!.scrollLeft > 0);
          // 키보드 가로 스크롤의 애니메이션이 끝난 위치를 기준으로 비교한다.
          await region.evaluate(
            (element) =>
              new Promise<void>((resolve) => {
                let previous = element.scrollLeft;
                let stable = 0;
                function sample() {
                  stable = element.scrollLeft === previous ? stable + 1 : 0;
                  previous = element.scrollLeft;
                  if (stable >= 6) resolve();
                  else requestAnimationFrame(sample);
                }
                requestAnimationFrame(sample);
              })
          );
        }
        const scroll = await region.evaluate((element) => element.scrollLeft);
        await configure(page, { delay: 1200 });
        await tab(page, '운영 중').click();
        await total(page, 3);
        assert.equal(await region.evaluate((element) => element.scrollLeft), scroll);
        await search(page).fill('서울');
        await total(page, 2);
      },
      { width }
    );
  });
}

test('S-024 새로고침 후 조건과 결과가 일치한다', async () => {
  await scenario('024-reload', async (page) => {
    await tab(page, '운영 중').click();
    await search(page).fill('서울');
    await total(page, 2);
    await page.reload();
    await total(page, 2);
    assert.equal(await search(page).inputValue(), '서울');
    assert.equal(await tab(page, '운영 중').getAttribute('aria-pressed'), 'true');
  });
});

test('S-024 다른 화면에서 뒤로 오면 조건과 결과가 일치한다', async () => {
  await scenario('024-back', async (page) => {
    await tab(page, '운영 중').click();
    await search(page).fill('서울');
    await total(page, 2);
    await page.getByRole('link', { name: '홈', exact: true }).click();
    await page.goBack();
    await total(page, 2);
    assert.equal(await search(page).inputValue(), '서울');
    assert.equal(await tab(page, '운영 중').getAttribute('aria-pressed'), 'true');
  });
});
