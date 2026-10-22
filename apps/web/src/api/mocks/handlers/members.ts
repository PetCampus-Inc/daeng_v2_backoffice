import { http } from 'msw';
import { MEMBER_FILTERS, MEMBER_JOINED_PERIODS } from '@/routes/members/type/member';
import { getMemberList, type MockMember } from '../util/member-list/index';
import { mockUrl, pageResponse } from '../util/response';
import { authenticateMockRequest } from '../util/session';

export const DEFAULT_MEMBERS: MockMember[] = [
  {
    userId: 'U001',
    name: '김견주',
    email: 'dog.owner@example.com',
    phone: '01012345678',
    status: 'ACTIVE',
    petCount: 2,
    ownerRole: null,
    schoolName: null,
    createdAt: '2026-10-06T00:00:00+09:00',
  },
  {
    userId: 'U002',
    name: '이원장',
    email: 'director@example.com',
    phone: '01022223333',
    status: 'ACTIVE',
    petCount: 1,
    ownerRole: 'active',
    schoolName: '햇살유치원',
    createdAt: '2026-10-03T00:00:00+09:00',
  },
  {
    userId: 'U003',
    name: '박원장',
    email: null,
    phone: '01098765432',
    status: 'ACTIVE',
    petCount: 0,
    ownerRole: 'active',
    schoolName: '달빛유치원',
    createdAt: '2026-09-20T00:00:00+09:00',
  },
  {
    userId: 'U004',
    name: '최해지',
    email: 'a@example.com',
    phone: null,
    status: 'ACTIVE',
    petCount: 0,
    ownerRole: 'revoked',
    schoolName: '도담유치원',
    createdAt: '2026-09-10T00:00:00+09:00',
  },
  {
    userId: 'U005',
    name: '정탈퇴',
    email: 'bye@example.com',
    phone: null,
    status: 'WITHDRAWN',
    petCount: 1,
    ownerRole: null,
    schoolName: null,
    createdAt: '2026-08-01T00:00:00+09:00',
  },
  {
    userId: 'U006',
    name: null,
    email: null,
    phone: null,
    status: 'ACTIVE',
    petCount: 0,
    ownerRole: null,
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

export const MEMBER_HANDLERS = [
  http.get(mockUrl('/members'), ({ request }) => {
    const auth = authenticateMockRequest();
    if (auth.denied) return auth.denied;
    const params = new URL(request.url).searchParams;
    const type = MEMBER_FILTERS.find((value) => value === params.get('type')) ?? 'all';
    const joinedWithin = MEMBER_JOINED_PERIODS.find((value) => value === params.get('joinedWithin')) ?? 'all';
    const items = getMemberList(getMockMembers(), { type, joinedWithin, keyword: params.get('keyword') ?? '' });
    const rawPage = Number(params.get('page') ?? 0);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
    return pageResponse(items, page, 20);
  }),
];
