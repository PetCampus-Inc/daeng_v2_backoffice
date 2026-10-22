import type { OverviewStats } from '@/type/overview';
import { toCount } from '@/util/count-format';

/** 인증 단계별 건수로 홈 카드 숫자를 계산한다(10-홈.md R-홈인증수). */
export const getVerificationSummary = (
  verificationCounts: OverviewStats['verificationCounts'] | null | undefined,
  revokedOwners: unknown
) => {
  const counts = verificationCounts ?? {};
  const revokedCount = toCount(counts.REVOKED);
  return {
    // '사업자 인증 완료 전' = 유치원 정보 입력 + 사업자번호 대기. 건이 없는 단계는 0으로 센다
    inProgress: toCount(counts.KINDERGARTEN_INFO_COMPLETED) + toCount(counts.BUSINESS_REGISTRATION_PENDING),
    // 기존과 같게 서버가 준 단계를 모두 더한다
    total: Object.values(counts).reduce<number>((sum, count) => sum + toCount(count), 0),
    // 해지됨이 0건이면 원장 역할이 해지된 회원 수로 바꿔 보여 준다(기존과 같게, 2026-10-22 결정)
    revoked: revokedCount > 0 ? revokedCount : toCount(revokedOwners),
  };
};
