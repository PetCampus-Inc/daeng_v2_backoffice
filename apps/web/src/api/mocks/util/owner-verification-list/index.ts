import type { OwnerVerification, OwnerVerificationSort } from '@/routes/owner-verifications/type/owner-verification';

/** 원장 인증 목록 조건. 서버가 받는 값 그대로라 빈 값·모르는 값이 올 수 있다. */
export type OwnerVerificationListQuery = {
  keyword: string | null;
  status: string | null;
  sort: string | null;
};

/** 제출일 순서로 비교한다. 제출일 없는 건은 정렬과 관계없이 맨 뒤, 동률은 번호 큰 것 먼저(R-인증탭, 4.4). */
const compareOwnerVerifications =
  (sort: OwnerVerificationSort) => (left: OwnerVerification, right: OwnerVerification) => {
    const leftTime = left.submittedAt ? Date.parse(left.submittedAt) : Number.NaN;
    const rightTime = right.submittedAt ? Date.parse(right.submittedAt) : Number.NaN;
    const leftMissing = Number.isNaN(leftTime);
    const rightMissing = Number.isNaN(rightTime);
    if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
    const timeDiff = leftMissing ? 0 : sort === 'oldest' ? leftTime - rightTime : rightTime - leftTime;
    return timeDiff || right.id - left.id;
  };

/**
 * 가짜 서버의 원장 인증 목록 규칙. 단계 탭으로 거르고, 유치원명·대표자 이름·회원 ID를 앞뒤 공백 없이 부분 일치로
 * 찾는다(기존 API, S-인증-009). 정렬은 `oldest`가 아니면 최신 순이다.
 */
export function getOwnerVerificationList(items: OwnerVerification[], query: OwnerVerificationListQuery) {
  const keyword = (query.keyword ?? '').trim().toLowerCase();
  const sort: OwnerVerificationSort = query.sort === 'oldest' ? 'oldest' : 'latest';
  return items
    .filter(
      (item) =>
        (!query.status || item.status === query.status) &&
        [item.kindergartenName, item.representativeName, item.userId].some((value) =>
          (value ?? '').toLowerCase().includes(keyword)
        )
    )
    .sort(compareOwnerVerifications(sort));
}
