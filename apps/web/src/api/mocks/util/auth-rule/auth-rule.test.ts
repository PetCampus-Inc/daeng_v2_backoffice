import { describe, expect, test } from 'vitest';

import { DEFAULT_MEMBERS } from '@/api/mocks/handlers/team-members';
import { isSessionExpired, judgeLogin } from '.';

const MINUTE_MS = 60 * 1000;

/** 판정 결과를 TC 표의 로그인 결과·화면·접속 기록 실패 사유 칸으로 바꾼다. */
function toTableRow(googleEmail: string) {
  const judgement = judgeLogin(googleEmail, DEFAULT_MEMBERS);
  if (judgement.result === 'allowed') {
    return {
      result: '성공',
      screen: judgement.isFirstLogin ? '첫 로그인 프로필 설정' : '역할에 허용된 메뉴',
      reason: '—',
    };
  }
  return { result: '실패', screen: '빨간 박스', reason: judgement.reason === 'unregistered' ? '미등록' : '비활성' };
}

// TC 09 R-로그인판정. R-로그인판정-07(구글 창에서 취소)은 서버에 요청이 가지 않아 판정 대상이 아니다.
describe('R-로그인판정. 로그인 결과', () => {
  test.each([
    ['R-로그인판정-01', 'ops@knockdog.test', '성공', '역할에 허용된 메뉴', '—'],
    ['R-로그인판정-02', 'OPS@knockdog.test', '성공', '역할에 허용된 메뉴', '—'],
    ['R-로그인판정-03', 'new@knockdog.test', '성공', '첫 로그인 프로필 설정', '—'],
    ['R-로그인판정-04', 'stranger@gmail.com', '실패', '빨간 박스', '미등록'],
    ['R-로그인판정-05', 'inactive@knockdog.test', '실패', '빨간 박스', '비활성'],
    ['R-로그인판정-06', 'canceled@knockdog.test', '실패', '빨간 박스', '비활성'],
  ])('%s: %s → %s', (_id, googleEmail, result, screen, reason) => {
    expect(toTableRow(googleEmail)).toEqual({ result, screen, reason });
  });
});

// TC 09 R-세션
describe('R-세션. 로그인 유지', () => {
  test.each([
    ['R-세션-01', 23 * 60 + 59, false],
    ['R-세션-02', 24 * 60, true],
    ['R-세션-03', 24 * 60 + 1, true],
  ])('%s: 마지막 요청 뒤 %i분 → 만료 %s', (_id, elapsedMinutes, expected) => {
    const lastRequestAt = Date.UTC(2026, 9, 7, 1, 0);
    expect(isSessionExpired(lastRequestAt, lastRequestAt + elapsedMinutes * MINUTE_MS)).toBe(expected);
  });
});
