import { describe, expect, it } from 'vitest';

import { getVerificationSummary } from './index';

describe('getVerificationSummary', () => {
  it.each([
    // [ID, 유치원 정보 입력, 사업자번호 대기, 인증 완료, 해지됨, 인증 진행 중, 전체 인증 기록]
    ['R-홈인증수-01', 3, 9, 150, 4, 12, 166],
    ['R-홈인증수-02', 0, 0, 0, 0, 0, 0],
    ['R-홈인증수-03', 5, 0, 0, 0, 5, 5],
    ['R-홈인증수-04', 0, 0, 10, 2, 0, 12],
  ])(
    '%s 인증 진행 중과 전체 인증 기록을 센다',
    (_id, infoCount, pendingCount, submittedCount, revokedCount, inProgress, total) => {
      const summary = getVerificationSummary(
        {
          KINDERGARTEN_INFO_COMPLETED: infoCount,
          BUSINESS_REGISTRATION_PENDING: pendingCount,
          SUBMITTED: submittedCount,
          REVOKED: revokedCount,
        },
        0
      );
      expect(summary.inProgress).toBe(inProgress);
      expect(summary.total).toBe(total);
    }
  );

  it('R-홈인증수-05 건이 없는 단계는 0으로 센다', () => {
    const summary = getVerificationSummary({ BUSINESS_REGISTRATION_PENDING: 2, SUBMITTED: 1, REVOKED: 0 }, 0);
    expect(summary.inProgress).toBe(2);
    expect(summary.total).toBe(3);
  });

  it('해지된 원장은 해지됨 건수를 쓴다', () => {
    expect(getVerificationSummary({ REVOKED: 4 }, 7).revoked).toBe(4);
  });

  it('해지됨이 0건이거나 없으면 원장 역할이 해지된 회원 수를 쓴다', () => {
    expect(getVerificationSummary({ REVOKED: 0, SUBMITTED: 3 }, 7).revoked).toBe(7);
    expect(getVerificationSummary({ SUBMITTED: 3 }, 7).revoked).toBe(7);
  });
});
