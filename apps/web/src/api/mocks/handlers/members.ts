import { http, HttpResponse } from 'msw';
import { ServiceMemberType, type ServiceMemberPage } from '@/routes/members/type';
import { getMemberList, type MockMember } from '../util/member-list/index';
import { mockUrl } from '../util/response';
import { authenticateMockRequest } from '../util/session';

/** 서버 기본 한 페이지 건수. */
const DEFAULT_PAGE_SIZE = 20;

export const DEFAULT_MEMBERS: MockMember[] = [
  {
    id: 1,
    userId: 'U001',
    name: '김견주',
    email: 'dog.owner@example.com',
    phone: '01012345678',
    status: 'ACTIVE',
    petCount: 2,
    ownerRole: null,
    schoolId: null,
    schoolName: null,
    createdAt: '2026-10-06T00:00:00+09:00',
  },
  {
    id: 2,
    userId: 'U002',
    name: '이원장',
    email: 'director@example.com',
    phone: '01022223333',
    status: 'ACTIVE',
    petCount: 1,
    ownerRole: 'active',
    schoolId: 104,
    schoolName: '햇살유치원',
    createdAt: '2026-10-03T00:00:00+09:00',
  },
  {
    id: 3,
    userId: 'U003',
    name: '박원장',
    email: null,
    phone: '01098765432',
    status: 'ACTIVE',
    petCount: 0,
    ownerRole: 'active',
    schoolId: 103,
    schoolName: '달빛유치원',
    createdAt: '2026-09-20T00:00:00+09:00',
  },
  {
    id: 4,
    userId: 'U004',
    name: '최해지',
    email: 'a@example.com',
    phone: null,
    status: 'ACTIVE',
    petCount: 0,
    ownerRole: 'revoked',
    schoolId: 101,
    schoolName: '도담유치원',
    createdAt: '2026-09-10T00:00:00+09:00',
  },
  {
    id: 5,
    userId: 'U005',
    name: '정탈퇴',
    email: 'bye@example.com',
    phone: null,
    status: 'WITHDRAWN',
    petCount: 1,
    ownerRole: null,
    schoolId: null,
    schoolName: null,
    createdAt: '2026-08-01T00:00:00+09:00',
  },
  {
    id: 6,
    userId: 'U006',
    name: null,
    email: null,
    phone: null,
    status: 'ACTIVE',
    petCount: 0,
    ownerRole: null,
    schoolId: null,
    schoolName: null,
    createdAt: '2026-07-01T00:00:00+09:00',
  },
];

function getMockMembers(): MockMember[] {
  try {
    const stored = JSON.parse(localStorage.getItem('daeng-bo-mock-members') ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    /* 잘못된 개발 fixture는 기본값으로 복구한다. */
  }
  return DEFAULT_MEMBERS;
}

/**
 * 회원 목록 가짜 API(`GET /service-admin/members`). 세션이 없거나 만료·비활성이면 요청을 거부한다.
 * 명세대로 응답을 `data`로 감싸지 않고 페이지는 1부터 센다. 화면은 늘 올바른 값만 보내므로
 * 잘못된 `page`·`size`는 서버처럼 오류로 돌려주지 않고 기본값으로 둔다.
 */
export const MEMBER_HANDLERS = [
  http.get(mockUrl('/service-admin/members'), ({ request }) => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;
    const params = new URL(request.url).searchParams;
    const type = Object.values(ServiceMemberType).find((value) => value === params.get('type'));
    const items = getMemberList(getMockMembers(), { type, keyword: params.get('keyword') ?? '' });
    const rawPage = Number(params.get('page') ?? 1);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Number(params.get('size') ?? DEFAULT_PAGE_SIZE);
    const size = Number.isSafeInteger(rawSize) && rawSize >= 1 && rawSize <= 100 ? rawSize : DEFAULT_PAGE_SIZE;
    const body: ServiceMemberPage = {
      items: items.slice((page - 1) * size, page * size),
      page,
      size,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / size),
    };
    return HttpResponse.json(body);
  }),
];
