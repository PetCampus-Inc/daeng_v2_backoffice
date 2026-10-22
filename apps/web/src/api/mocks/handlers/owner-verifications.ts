import { http } from 'msw';
import type { OwnerVerification } from '@/routes/owner-verifications/type/owner-verification';
import { getOwnerVerificationList } from '../util/owner-verification-list';
import { errorResponse, mockUrl, pageResponse } from '../util/response';
import { getMockTeamMembers } from './team-members';

/**
 * TC fixtures.md `인증-기본`. 연락처·사업자번호는 서버가 R-가림(11-회원.md)대로 가린 응답 값으로 둔다.
 * 회원 ID는 홈 mock(`overview.ts`)의 최근 원장 인증과 같다. localStorage로 빈 목록·25건 시나리오도 확인한다.
 */
const DEFAULT_OWNER_VERIFICATIONS: OwnerVerification[] = [
  {
    id: 205,
    userId: 'U205',
    userName: '김신청',
    kindergartenName: '멍멍스쿨',
    kindergartenAddress: '서울 마포구 합정동 5',
    status: 'BUSINESS_REGISTRATION_PENDING',
    submittedAt: '2026-10-06T01:00:00Z',
    ownerGrantedAt: null,
    businessRegistrationNumber: null,
    representativeName: '김신청',
    representativePhone: '010-****-2222',
  },
  {
    id: 204,
    userId: 'U002',
    userName: '이원장',
    kindergartenName: '햇살유치원',
    kindergartenAddress: '서울 마포구 망원동 1',
    status: 'SUBMITTED',
    submittedAt: '2026-10-01T01:00:00Z',
    ownerGrantedAt: '2026-10-01T02:00:00Z',
    businessRegistrationNumber: '123-**-67890',
    representativeName: '이원장',
    representativePhone: '010-****-3333',
  },
  {
    id: 203,
    userId: 'U003',
    userName: '박원장',
    kindergartenName: '달빛유치원',
    kindergartenAddress: '경기 성남시 분당구 정자동 2',
    status: 'SUBMITTED',
    submittedAt: '2026-09-15T01:00:00Z',
    ownerGrantedAt: '2026-09-15T02:00:00Z',
    businessRegistrationNumber: '***',
    representativeName: '박원장',
    representativePhone: null,
  },
  {
    id: 202,
    userId: 'U004',
    userName: '최해지',
    kindergartenName: '도담유치원',
    kindergartenAddress: '인천 연수구 송도동 4',
    status: 'REVOKED',
    submittedAt: '2026-09-01T01:00:00Z',
    ownerGrantedAt: '2026-09-02T01:00:00Z',
    businessRegistrationNumber: '987-**-43210',
    representativeName: '최해지',
    representativePhone: '010-****-6666',
  },
  {
    id: 201,
    userId: 'U201',
    userName: '정입력',
    kindergartenName: '포레스트독',
    kindergartenAddress: '서울 성동구 성수동 7',
    status: 'KINDERGARTEN_INFO_COMPLETED',
    submittedAt: null,
    ownerGrantedAt: null,
    businessRegistrationNumber: null,
    representativeName: '정입력',
    representativePhone: null,
  },
];

/** 개발 데이터가 있으면 그것을, 없거나 잘못됐으면 `인증-기본`을 쓴다. */
function getMockOwnerVerifications(): OwnerVerification[] {
  try {
    const stored = JSON.parse(localStorage.getItem('daeng-bo-mock-owner-verifications') ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    // 잘못된 개발 데이터는 기본값으로 복구한다.
  }
  return DEFAULT_OWNER_VERIFICATIONS;
}

export const OWNER_VERIFICATION_HANDLERS = [
  http.get(mockUrl('/owner-verifications'), ({ request }) => {
    const member = getMockTeamMembers().find((item) => item.email === request.headers.get('X-Dev-Email'));
    if (!member || member.status !== 'active') {
      return errorResponse(401, {
        code: 'UNAUTHORIZED',
        message: '로그인이 필요합니다.',
        errorMessage: '로그인이 필요합니다.',
      });
    }
    const params = new URL(request.url).searchParams;
    const items = getOwnerVerificationList(getMockOwnerVerifications(), {
      keyword: params.get('keyword'),
      status: params.get('status'),
      sort: params.get('sort'),
    });
    const rawPage = Number(params.get('page') ?? 0);
    const rawSize = Number(params.get('size') ?? 20);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
    const size = Number.isSafeInteger(rawSize) && rawSize > 0 && rawSize <= 100 ? rawSize : 20;
    return pageResponse(items, page, size);
  }),
];
