import { describe, expect, it } from 'vitest';
import type { ServiceVerification } from '@/routes/owner-verifications/type';
import { getOwnerVerificationList, type OwnerVerificationListQuery } from './index';

/** fixtures.md `인증-기본`에서 규칙에 필요한 값만 둔다. */
const createItem = (
  id: number,
  userName: string,
  kindergartenName: string,
  status: ServiceVerification['status'],
  submittedAt: string | null,
  userId = `U${id}`
): ServiceVerification => ({
  id,
  userId,
  userName,
  kindergartenName,
  schoolId: null,
  kindergartenPlaceId: null,
  kindergartenType: null,
  kindergartenAddress: '',
  kindergartenAddressDetail: null,
  kindergartenPhone: null,
  status,
  submittedAt,
  ownerGrantedAt: null,
  businessRegistrationNumber: null,
  representativeName: userName,
  representativePhone: null,
  revokedAt: null,
  ownerRevokedAt: null,
  ownerRevokeReason: null,
});

const ITEMS = [
  createItem(201, '정입력', '포레스트독', 'KINDERGARTEN_INFO_COMPLETED', null),
  createItem(202, '최해지', '도담유치원', 'REVOKED', '2026-09-01T01:00:00Z', 'U004'),
  createItem(203, '박원장', '달빛유치원', 'SUBMITTED', '2026-09-15T01:00:00Z', 'U003'),
  createItem(204, '이원장', '햇살유치원', 'SUBMITTED', '2026-10-01T01:00:00Z', 'U002'),
  createItem(205, '김신청', '멍멍스쿨', 'BUSINESS_REGISTRATION_PENDING', '2026-10-06T01:00:00Z'),
];

const names = (query: Partial<OwnerVerificationListQuery>) =>
  getOwnerVerificationList(ITEMS, { keyword: null, status: null, ...query }).map((item) => item.representativeName);

describe('원장 인증 단계 탭(R-인증탭)', () => {
  it.each([
    [null, ['정입력', '김신청', '이원장', '박원장', '최해지']],
    ['BUSINESS_REGISTRATION_PENDING', ['김신청']],
    ['SUBMITTED', ['이원장', '박원장']],
    ['REVOKED', ['최해지']],
  ])('탭 %s → %j', (status, expected) => {
    expect(names({ status })).toEqual(expected);
  });
});

describe('원장 인증 목록 순서(서버 순서, R-인증탭)', () => {
  it('제출일 없는 건이 맨 앞, 그 뒤는 제출일 최신 순이다', () => {
    expect(names({})).toEqual(['정입력', '김신청', '이원장', '박원장', '최해지']);
  });

  it('제출일 없는 건·같은 제출일끼리는 번호 큰 것 먼저다', () => {
    const items = [
      createItem(1, '없음1', 'a', 'KINDERGARTEN_INFO_COMPLETED', null),
      createItem(2, '없음2', 'a', 'KINDERGARTEN_INFO_COMPLETED', null),
      createItem(3, '같음3', 'a', 'SUBMITTED', '2026-10-01T01:00:00Z'),
      createItem(4, '같음4', 'a', 'SUBMITTED', '2026-10-01T01:00:00Z'),
      createItem(5, '읽을수없음5', 'a', 'SUBMITTED', 'not-a-date'),
    ];
    expect(
      getOwnerVerificationList(items, { keyword: null, status: null }).map((item) => item.representativeName)
    ).toEqual(['읽을수없음5', '없음2', '없음1', '같음4', '같음3']);
  });
});

describe('원장 인증 검색(S-인증-009)', () => {
  it.each([
    [{ keyword: '햇살' }, ['이원장']],
    [{ keyword: '  김신청  ' }, ['김신청']],
    [{ keyword: '원장', status: 'SUBMITTED' }, ['이원장', '박원장']],
    [{ keyword: '햇살', status: 'REVOKED' }, []],
    [{ keyword: 'u003' }, ['박원장']],
    [{ keyword: '   ' }, ['정입력', '김신청', '이원장', '박원장', '최해지']],
  ])('%j → %j', (query, expected) => {
    expect(names(query)).toEqual(expected);
  });

  it('주소는 검색 대상이 아니다', () => {
    const items = [{ ...ITEMS[4], kindergartenAddress: '서울 마포구 합정동 5' }];
    expect(getOwnerVerificationList(items, { keyword: '마포', status: null })).toEqual([]);
  });
});
