import type { ServiceVerification } from '@/routes/owner-verifications/type';

/** 원장 인증 목록 조건. 서버가 받는 값 그대로라 빈 값·모르는 값이 올 수 있다. */
export type OwnerVerificationListQuery = {
  keyword: string | null;
  status: string | null;
};

/**
 * 서버 순서(`ORDER BY (submitted_at IS NULL) DESC, submitted_at DESC, id DESC`)로 비교한다.
 * 제출일 없는 건이 맨 앞, 그 뒤는 제출일 최신 순, 같으면 번호 큰 것 먼저다(R-인증탭).
 */
const compareOwnerVerifications = (left: ServiceVerification, right: ServiceVerification) => {
  const leftTime = left.submittedAt ? Date.parse(left.submittedAt) : Number.NaN;
  const rightTime = right.submittedAt ? Date.parse(right.submittedAt) : Number.NaN;
  const leftMissing = Number.isNaN(leftTime);
  const rightMissing = Number.isNaN(rightTime);
  if (leftMissing !== rightMissing) return leftMissing ? -1 : 1;
  const timeDiff = leftMissing ? 0 : rightTime - leftTime;
  return timeDiff || right.id - left.id;
};

/**
 * 가짜 서버의 원장 인증 목록 규칙. 단계 탭으로 거르고, 유치원명·대표자 이름·회원 ID를 앞뒤 공백 없이 부분 일치로
 * 찾는다(서버 `verifications-reader`, S-인증-009). 순서는 서버를 따른다.
 */
export function getOwnerVerificationList(items: ServiceVerification[], query: OwnerVerificationListQuery) {
  const keyword = (query.keyword ?? '').trim().toLowerCase();
  return items
    .filter(
      (item) =>
        (!query.status || item.status === query.status) &&
        [item.kindergartenName, item.representativeName, item.userId].some((value) =>
          (value ?? '').toLowerCase().includes(keyword)
        )
    )
    .sort(compareOwnerVerifications);
}
