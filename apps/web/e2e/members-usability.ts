import type { Browser, BrowserContext, Page } from 'playwright';
import type { ScenarioOptions } from './type/browser-state.ts';
// 저장소 루트에서 node --test로 실행. 기존 Playwright·Chromium 경로는 아래 환경변수로 지정한다.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, test } from 'node:test';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright') as typeof import('playwright');
const BASE_URL = process.env.BO_QA_BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = process.env.BO_QA_OUTPUT_DIR || path.resolve('.local/test-results/members');
const FIXTURES_25 = Array.from({ length: 25 }, (_, index) => ({
  userId: `U${101 + index}`,
  name: `회원 ${String(index + 1).padStart(2, '0')}`,
  email: `user${String(index + 1).padStart(2, '0')}@example.com`,
  phone: null,
  status: 'ACTIVE',
  petCount: 1,
  ownerRole: null,
  schoolName: null,
  createdAt: new Date(Date.UTC(2026, 8, 13 + index)).toISOString(),
}));
const RESULTS: Record<string, unknown>[] = [];
let browser: Browser;

before(async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
  });
});
after(async () => {
  if (!browser) return;
  await writeFile(path.join(OUTPUT_DIR, 'results.json'), JSON.stringify(RESULTS, null, 2));
  await browser?.close();
});

async function scenario(
  id: string,
  run: (page: Page, context: BrowserContext) => Promise<unknown>,
  { fixtures, width = 1440, initialDelay = 0, role = '조회자' }: ScenarioOptions = {}
) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(15000);
  try {
    await page.clock.setFixedTime(new Date('2026-10-07T10:00:00+09:00'));
    await page.goto(`${BASE_URL}/members`);
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).waitFor();
    if (fixtures) {
      await page.evaluate((items) => localStorage.setItem('daeng-bo-mock-members', JSON.stringify(items)), fixtures);
    }
    await page.evaluate(async (delay) => {
      const { network } = await import('/@id/__x00__virtual:msw');
      const { http } = await import('/node_modules/.vite/deps/msw.js');
      window.__memberQA = { delay, delays: {}, fail: false, started: [], completed: [] };
      network.use(
        http.get('/api/v0/platform-admin/members', async ({ request }) => {
          const params = new URL(request.url).searchParams;
          const key =
            params.get('joinedWithin') || params.get('type') || params.get('keyword') || `page:${params.get('page')}`;
          const { delay: fallback, delays, fail } = window.__memberQA;
          window.__memberQA.started.push(key);
          await new Promise((resolve) => setTimeout(resolve, delays[key] ?? fallback));
          window.__memberQA.completed.push(key);
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
    await page.getByRole('radio', { name: role, exact: true }).click();
    await page.getByRole('button', { name: '개발용 계정으로 로그인', exact: true }).click();
    await page.getByRole('heading', { name: '회원 관리', exact: true }).waitFor();
    if (!initialDelay) await total(page, fixtures?.length ?? 6);
    await run(page, context);
    RESULTS.push({ id, result: '통과', runtimeErrors: errors });
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
const PERIOD_LABELS: Record<string, string> = { all: '가입일 전체', '7d': '최근 7일', '30d': '최근 30일' };
async function choosePeriod(page: Page, value: string) {
  await page.getByRole('combobox', { name: '가입일' }).click();
  await page.getByRole('option', { name: PERIOD_LABELS[value], exact: true }).click();
}
async function selectedPeriod(page: Page) {
  const label = await page.getByRole('combobox', { name: '가입일' }).innerText();
  return Object.keys(PERIOD_LABELS).find((value) => PERIOD_LABELS[value] === label);
}

const search = (page: Page) => page.getByRole('searchbox', { name: '회원 검색' });
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const names = (page: Page) => page.locator('tbody tr td:first-child p:first-child').allTextContents();
async function configure(page: Page, config: Partial<Window['__memberQA']>) {
  await page.evaluate((next) => Object.assign(window.__memberQA, next), config);
}
async function watchTransition(page: Page) {
  await page.evaluate(() => {
    window.__memberFrames = [];
    window.__memberWatching = true;
    function sample() {
      const table = document.querySelector('table');
      const input = document.querySelector<HTMLInputElement>('input[type=search]');
      window.__memberFrames.push({
        busy: document.querySelector('[data-slot=card]')?.getAttribute('aria-busy') === 'true',
        table: Boolean(table),
        loading: Boolean(document.querySelector('[data-slot=list-state][role=status]')),
        inputTop: input?.getBoundingClientRect().top,
        height: table?.getBoundingClientRect().height,
        scroll: window.scrollY,
      });
      if (window.__memberWatching) requestAnimationFrame(sample);
    }
    sample();
  });
}
async function assertStable(page: Page) {
  const frames = await page.evaluate(() => {
    window.__memberWatching = false;
    return window.__memberFrames;
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

test('S001 회원 목록의 기본 칸과 값을 표시한다', async () => {
  await scenario('render-columns', async (page) => {
    assert.deepEqual(await names(page), ['김견주', '이원장', '박원장', '최해지', '정탈퇴', '이름 미등록']);
    const text = await page.locator('tbody').innerText();
    for (const value of ['원장 · 견주', '2026. 10. 06.', '1마리 · 햇살유치원'] as const) {
      assert.ok(text.includes(value), value);
    }
    assert.equal(await page.locator('thead th').count(), 6);
  });
});

test('S002 회원 개인정보를 가려 표시한다', async () => {
  await scenario('render-masking', async (page) => {
    const text = await page.locator('tbody').innerText();
    for (const value of ['do*******@example.com · U001', '010-****-5432 · U003', '연락처 미등록 · U006'] as const) {
      assert.ok(text.includes(value), value);
    }
    for (const raw of ['dog.owner@example.com', 'director@example.com', '01098765432'] as const) {
      assert.ok(!text.includes(raw));
    }
  });
});

test('S009 회원 목록은 조회 전용으로 동작한다', async () => {
  await scenario('render-readonly', async (page) => {
    await page.getByText('운영 DB · 읽기 전용', { exact: true }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: '가입일' }).isDisabled(), false);
    assert.equal(await page.getByRole('button', { name: /추가 메뉴/ }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /내보내기/ }).count(), 0);
    const url = page.url();
    await page.locator('tbody tr').nth(1).locator('td').nth(4).click();
    assert.equal(page.url(), url);
    assert.equal(await page.title(), '회원 관리 · 똑독 BO');
  });
});

test('S010 회원 API 응답에서 개인정보를 가린다', async () => {
  await scenario('render-api-masking', async (page) => {
    // 가림은 DOM 치환이 아니라 응답 계약에서 수행되어야 한다.
    const payload = await page.evaluate(async () => {
      const response = await fetch('/api/v0/platform-admin/members');
      if (!response.ok) throw new Error(`회원 조회 ${response.status}`);
      return response.json();
    });
    assert.equal(payload.data.items.length, 6);
    const serialized = JSON.stringify(payload);
    for (const raw of ['dog.owner@example.com', 'director@example.com', '01098765432'] as const) {
      assert.ok(!serialized.includes(raw));
    }
  });
});

test('S004 회원 유형 탭의 결과와 건수를 표시한다', async () => {
  await scenario('filters', async (page) => {
    for (const [label, expected] of [
      ['견주', ['김견주', '이원장', '정탈퇴']],
      ['원장', ['이원장', '박원장']],
      ['탈퇴', ['정탈퇴']],
    ] as const) {
      await tab(page, label).click();
      await total(page, expected.length);
      assert.deepEqual(await names(page), expected);
      assert.equal(await tab(page, label).getAttribute('aria-pressed'), 'true');
    }
    await tab(page, '전체').click();
    await total(page, 6);
  });
});

test('S005 회원 검색 결과와 건수를 표시한다', async () => {
  await scenario('search', async (page) => {
    for (const [term, expected] of [
      ['DIRECTOR', '이원장'],
      ['5432', '박원장'],
      ['u003', '박원장'],
    ] as const) {
      await search(page).fill(term);
      await total(page, 1);
      await page.getByText(expected, { exact: true }).waitFor();
    }
  });
});

test('S014 첫 조회 대기 상태와 완료', async () => {
  await scenario(
    'initial-loading',
    async (page) => {
      await page.locator('[data-slot=list-state][role=status]').waitFor();
      assert.equal(await page.getByText('등록된 항목이 없습니다.', { exact: true }).count(), 0);
      assert.equal(await page.getByText(/총 \d+건/).count(), 0);
      await total(page, 6);
    },
    { initialDelay: 1500 }
  );
});

for (const label of ['견주', '원장', '탈퇴'] as const) {
  test(`S019 첫 ${label} 전환의 중간 프레임`, async () => {
    await scenario(`continuity-${label}`, async (page) => {
      await configure(page, { delay: 1200 });
      await watchTransition(page);
      await tab(page, label).click();
      await page.getByText('조회 중…', { exact: true }).waitFor();
      assert.equal(await tab(page, label).getAttribute('aria-pressed'), 'true');
      await total(page, label === '견주' ? 3 : label === '원장' ? 2 : 1);
      await assertStable(page);
    });
  });
}

test('S020 빠른 탭 전환에서 마지막 선택을 유지한다', async () => {
  await scenario('rapid-tab', async (page) => {
    await configure(page, { delays: { owner: 2000, guardian: 1000 } });
    await tab(page, '원장').click();
    await page.waitForTimeout(100);
    await tab(page, '견주').click();
    await total(page, 3);
    await page.waitForTimeout(1100);
    assert.deepEqual(await names(page), ['김견주', '이원장', '정탈퇴']);
  });
});

test('S020 검색 중 편집한 값과 커서를 유지한다', async () => {
  await scenario('search-cursor', async (page) => {
    await configure(page, { delay: 1200 });
    await search(page).fill('이x원장');
    await search(page).press('ArrowLeft');
    await search(page).press('ArrowLeft');
    await search(page).press('Backspace');
    assert.equal(await search(page).inputValue(), '이원장');
    await total(page, 1);
    assert.equal(await search(page).evaluate((el) => document.activeElement === el), true);
    assert.deepEqual(await names(page), ['이원장']);
  });
});

test('S020 한글 조합 입력을 검색 결과에 반영한다', async () => {
  await scenario('search-ime', async (page) => {
    // CDP 조합 상태만 검사한다. 실제 OS IME 체감은 별도 미확인.
    await tab(page, '견주').click();
    await total(page, 3);
    await search(page).focus();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition', { text: '원', selectionStart: 1, selectionEnd: 1 });
    await page.waitForTimeout(400);
    assert.equal(await search(page).inputValue(), '원');
    await cdp.send('Input.insertText', { text: '원장' });
    await total(page, 1);
    assert.equal(await search(page).inputValue(), '원장');
    await cdp.detach();
  });
});

test('S021 조회 실패 후 조건과 초점을 유지해 재시도한다', async () => {
  await scenario('failure-retry', async (page) => {
    await configure(page, { fail: true });
    await tab(page, '원장').click();
    await search(page).fill('이');
    await page.getByRole('button', { name: '다시 시도', exact: true }).waitFor();
    assert.equal(await search(page).inputValue(), '이');
    assert.equal(await page.getByText('총 0건', { exact: true }).count(), 0);
    await configure(page, { fail: false, delay: 1200 });
    const retry = page.getByRole('button', { name: '다시 시도', exact: true });
    await retry.focus();
    await retry.press('Enter');
    await total(page, 1);
    assert.deepEqual(await names(page), ['이원장']);
    assert.equal(await search(page).evaluate((el) => document.activeElement === el), true);
  });
});

test('S021 빈 결과에서 조건을 초기화하고 검색 초점을 돌려준다', async () => {
  await scenario('empty-reset', async (page) => {
    await configure(page, { delay: 0 });
    await search(page).fill('없는말');
    await total(page, 0);
    await configure(page, { delay: 1200 });
    const reset = page.getByRole('button', { name: '필터 초기화', exact: true });
    await reset.focus();
    await reset.press('Enter');
    await total(page, 6);
    assert.equal(await search(page).inputValue(), '');
    assert.equal(await search(page).evaluate((el) => document.activeElement === el), true);
  });
});

test('S011 등록 회원 없음', async () => {
  await scenario(
    'empty',
    async (page) => {
      await page.getByText('등록된 항목이 없습니다.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '필터 초기화', exact: true }).count(), 0);
    },
    { fixtures: [] }
  );
});

test('S015/018 페이지 이동 중 중복 실행을 막고 초점을 유지한다', async () => {
  await scenario(
    'pagination-pending',
    async (page) => {
      assert.equal((await names(page))[0], '회원 25');
      assert.equal((await names(page)).length, 20);
      await configure(page, { delay: 1200 });
      const next = page.getByRole('button', { name: '다음', exact: true });
      await next.focus();
      await watchTransition(page);
      await next.press('Enter');
      await page.getByText('조회 중…', { exact: true }).waitFor();
      assert.equal(await next.getAttribute('aria-disabled'), 'true');
      await next.press('Enter');
      await page.waitForTimeout(600);
      await assertStable(page);
      await total(page, 25);
      await page.getByRole('button', { name: '2', exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('tbody tr td p')?.textContent === '회원 05');
      assert.equal(await next.evaluate((el) => document.activeElement === el), true);
      assert.equal((await names(page)).length, 5);
    },
    { fixtures: FIXTURES_25 }
  );
});

test('S019 조건 변경과 새로고침에서 1페이지 조건을 유지한다', async () => {
  await scenario(
    'pagination-conditions',
    async (page) => {
      await page.getByRole('button', { name: '2', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('tbody tr td p')?.textContent === '회원 05');
      await configure(page, { delay: 0 });
      await search(page).fill('회원');
      await total(page, 25);
      await page.waitForFunction(() => document.querySelector('tbody tr td p')?.textContent === '회원 25');
      assert.equal(await page.getByRole('button', { name: '1', exact: true }).getAttribute('aria-current'), 'page');
      await page.getByRole('button', { name: '2', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('tbody tr td p')?.textContent === '회원 05');
      await tab(page, '견주').click();
      await page.waitForFunction(() => document.querySelector('tbody tr td p')?.textContent === '회원 25');
      await page.reload();
      await total(page, 25);
      assert.equal(await search(page).inputValue(), '회원');
      assert.equal(await tab(page, '견주').getAttribute('aria-pressed'), 'true');
    },
    { fixtures: FIXTURES_25 }
  );
});

for (const width of [390, 768, 1440] as const) {
  test(`S022 ${width}px 키보드·가로 스크롤`, async () => {
    await scenario(
      `width-${width}`,
      async (page) => {
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        for (const label of ['전체', '견주', '원장', '탈퇴'] as const) {
          const button = tab(page, label);
          await button.focus();
          assert.ok(
            await button.evaluate(
              (el) => document.activeElement === el && el.getBoundingClientRect().right <= innerWidth
            )
          );
        }
        await tab(page, '견주').press('Space');
        await total(page, 25);
        const table = page.getByRole('region', { name: '회원 목록 가로 스크롤' });
        await table.focus();
        await table.press('End');
        await table.evaluate((el) => {
          el.scrollLeft = el.scrollWidth;
        });
        // 조회 전용 열도 좁은 화면에서 0폭으로 찌그러지지 않아야 한다.
        const activityWidth = await page
          .locator('thead th')
          .nth(5)
          .evaluate((el) => el.getBoundingClientRect().width);
        assert.ok(activityWidth >= 160, `최근 활동 열 폭 ${activityWidth}`);
        const scroll = await table.evaluate((el) => el.scrollLeft);
        await configure(page, { delay: 1000 });
        await search(page).fill('회원');
        await page.waitForTimeout(400);
        assert.equal(await table.evaluate((el) => el.scrollLeft), scroll);
        await total(page, 25);
        assert.equal(await table.evaluate((el) => el.scrollLeft), scroll);
        await page.getByRole('button', { name: '다음', exact: true }).focus();
        await page.getByRole('button', { name: '다음', exact: true }).press('Enter');
        await page.waitForFunction(() => document.querySelector('tbody tr td p')?.textContent === '회원 05');
      },
      { fixtures: FIXTURES_25, width }
    );
  });
}

for (const role of ['최고관리자', '운영자'] as const) {
  test(`S016 ${role} 접근`, async () => {
    await scenario(
      `role-${role}`,
      async (page) => {
        await total(page, 6);
      },
      { role }
    );
  });
}

test('S019 다른 메뉴에서 뒤로 복귀할 때 조건·읽던 스크롤 유지', async () => {
  await scenario(
    'return-navigation',
    async (page) => {
      await tab(page, '견주').click();
      await search(page).fill('회원');
      await total(page, 25);
      await page.waitForTimeout(350);
      await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
      await page.waitForTimeout(100);
      const before = await page.evaluate(() => window.scrollY);
      assert.equal(before, 500);
      await page.getByRole('link', { name: '홈', exact: true }).click();
      await page.goBack();
      await total(page, 25);
      assert.equal(await search(page).inputValue(), '회원');
      assert.equal(await tab(page, '견주').getAttribute('aria-pressed'), 'true');
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.scrollY), before);
    },
    { fixtures: FIXTURES_25 }
  );
});

test('가입일 7일 전환의 중간 상태와 초점을 유지한다', async () => {
  await scenario('joined-period-transition', async (page) => {
    const period = page.getByRole('combobox', { name: '가입일' });
    await configure(page, { delay: 1200 });
    await period.focus();
    await watchTransition(page);
    await period.press('Space');
    await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'option');
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.textContent === '최근 7일');
    await page.keyboard.press('Enter');
    await page.getByText('조회 중…', { exact: true }).waitFor();
    assert.equal(await selectedPeriod(page), '7d');
    await total(page, 2);
    await assertStable(page);
    assert.deepEqual(await names(page), ['김견주', '이원장']);
    assert.equal(await period.evaluate((el) => document.activeElement === el), true);
  });
});

test('가입일을 다른 조건과 결합하고 새로고침해도 유지한다', async () => {
  await scenario('joined-period-combined', async (page) => {
    await configure(page, { delay: 0 });
    await choosePeriod(page, '30d');
    await total(page, 4);
    await tab(page, '원장').click();
    await total(page, 2);
    await search(page).fill('이');
    await total(page, 1);
    await choosePeriod(page, '7d');
    await total(page, 1);
    await page.reload();
    await total(page, 1);
    assert.equal(await selectedPeriod(page), '7d');
    assert.equal(await search(page).inputValue(), '이');
  });
});

test('가입일 조건의 빈 결과를 초기화한다', async () => {
  await scenario('joined-period-empty-reset', async (page) => {
    await choosePeriod(page, '7d');
    await tab(page, '탈퇴').click();
    await total(page, 0);
    await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
    await total(page, 6);
    assert.equal(await selectedPeriod(page), 'all');
    assert.equal(await search(page).inputValue(), '');
  });
});

test('가입일을 빠르게 전환하면 마지막 선택을 유지한다', async () => {
  await scenario('joined-race', async (page) => {
    await configure(page, { delays: { '7d': 2000, '30d': 1000 } });
    await choosePeriod(page, '7d');
    await page.waitForTimeout(100);
    await choosePeriod(page, '30d');
    await total(page, 4);
    await page.waitForTimeout(1100);
    assert.equal(await selectedPeriod(page), '30d');
    assert.equal((await names(page)).length, 4);
  });
});

test('가입일 조회 실패 후 마지막 선택으로 복구한다', async () => {
  await scenario('joined-recovery', async (page) => {
    await configure(page, { fail: true, delays: {} });
    await choosePeriod(page, '7d');
    await page.getByRole('button', { name: '다시 시도', exact: true }).waitFor();
    assert.equal(await selectedPeriod(page), '7d');
    await configure(page, { fail: false, delay: 1000 });
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await total(page, 2);
    assert.equal(await selectedPeriod(page), '7d');
  });
});

test('가입일 변경은 1페이지로 이동하고 메뉴 복귀 조건 유지', async () => {
  await scenario(
    'joined-page-reset',
    async (page) => {
      await page.getByRole('button', { name: '2', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('tbody tr td p')?.textContent === '회원 05');
      await choosePeriod(page, '7d');
      await total(page, 7);
      assert.equal((await names(page))[0], '회원 25');
      assert.equal(new URL(page.url()).searchParams.get('page'), null);
      await page.getByRole('link', { name: '홈', exact: true }).click();
      await page.goBack();
      await total(page, 7);
      assert.equal(await selectedPeriod(page), '7d');
    },
    { fixtures: FIXTURES_25 }
  );
});
