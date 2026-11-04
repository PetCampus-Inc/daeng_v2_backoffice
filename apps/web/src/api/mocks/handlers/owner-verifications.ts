import { http, HttpResponse } from 'msw';
import type { ServiceVerification, ServiceVerificationPage } from '@/routes/owner-verifications/type';
import { getOwnerVerificationList } from '../util/owner-verification-list';
import { mockUrl } from '../util/response';
import { authenticateMockRequest } from '../util/session';

/**
 * TC fixtures.md `인증-기본`. 연락처·사업자번호는 서버가 R-가림(11-회원.md)대로 가린 응답 값으로 둔다.
 * 회원 ID는 홈 mock(`overview.ts`)의 최근 원장 인증과 같다. localStorage로 빈 목록·25건 시나리오도 확인한다.
 */
/** 서버 기본 한 페이지 건수. */
const DEFAULT_PAGE_SIZE = 20;

/** 가짜 인증 건의 기본 값. 화면이 쓰지 않는 칸은 비워 둔다. */
const BASE_VERIFICATION: Pick<
  ServiceVerification,
  | 'schoolId'
  | 'kindergartenPlaceId'
  | 'kindergartenType'
  | 'kindergartenAddressDetail'
  | 'kindergartenPhone'
  | 'revokedAt'
  | 'ownerRevokedAt'
  | 'ownerRevokeReason'
> = {
  schoolId: null,
  kindergartenPlaceId: null,
  kindergartenType: null,
  kindergartenAddressDetail: null,
  kindergartenPhone: null,
  revokedAt: null,
  ownerRevokedAt: null,
  ownerRevokeReason: null,
};

const DEFAULT_OWNER_VERIFICATIONS: ServiceVerification[] = [
  {
    ...BASE_VERIFICATION,
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
    ...BASE_VERIFICATION,
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
    ...BASE_VERIFICATION,
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
    ...BASE_VERIFICATION,
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
    ...BASE_VERIFICATION,
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
function getMockOwnerVerifications(): ServiceVerification[] {
  try {
    const stored = JSON.parse(localStorage.getItem('daeng-bo-mock-owner-verifications') ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    // 잘못된 개발 데이터는 기본값으로 복구한다.
  }
  return DEFAULT_OWNER_VERIFICATIONS;
}

/**
 * 원장 인증 목록 가짜 API(`GET /service-admin/verifications`). 세션이 없거나 만료·비활성이면 요청을 거부한다.
 * 명세대로 응답을 `data`로 감싸지 않고 페이지는 1부터 센다. 화면은 늘 올바른 값만 보내므로
 * 잘못된 `page`·`size`는 서버처럼 오류로 돌려주지 않고 기본값으로 둔다.
 */
export const OWNER_VERIFICATION_HANDLERS = [
  http.get(mockUrl('/service-admin/verifications'), ({ request }) => {
    const denied = authenticateMockRequest().denied;
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const items = getOwnerVerificationList(getMockOwnerVerifications(), {
      keyword: params.get('keyword'),
      status: params.get('status'),
    });
    const rawPage = Number(params.get('page') ?? 1);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Number(params.get('size') ?? DEFAULT_PAGE_SIZE);
    const size = Number.isSafeInteger(rawSize) && rawSize >= 1 && rawSize <= 100 ? rawSize : DEFAULT_PAGE_SIZE;
    const body: ServiceVerificationPage = {
      items: items.slice((page - 1) * size, page * size),
      page,
      size,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / size),
    };
    return HttpResponse.json(body);
  }),
];
