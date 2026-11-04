import { http, HttpResponse } from 'msw';
import { SchoolStatus, type ServiceSchoolPage } from '@/routes/kindergartens/type';
import { getKindergartenList, type MockKindergarten } from '../util/kindergarten-list/index';
import { mockUrl } from '../util/response';
import { authenticateMockRequest } from '../util/session';

/** TC fixtures.md 유치원-기본. localStorage로 빈 목록·25건 시나리오도 확인한다. */
/** 서버 기본 한 페이지 건수. */
const DEFAULT_PAGE_SIZE = 20;

export const DEFAULT_KINDERGARTENS: MockKindergarten[] = [
  {
    id: 104,
    name: '햇살유치원',
    guardianName: '이원장',
    nickname: null,
    ownerUserId: 'U002',
    address: '서울 마포구 망원동 1',
    status: SchoolStatus.ACTIVE,
    activeMembers: 12,
    pendingMembers: 2,
    businessVerified: true,
    createdAt: '2026-10-01T00:00:00+09:00',
  },
  {
    id: 103,
    name: '달빛유치원',
    guardianName: '박원장',
    nickname: null,
    ownerUserId: 'U003',
    address: '경기 성남시 분당구 정자동 2',
    status: SchoolStatus.ACTIVE,
    activeMembers: 5,
    pendingMembers: 0,
    businessVerified: false,
    createdAt: '2026-09-15T00:00:00+09:00',
  },
  {
    id: 102,
    name: '별빛유치원',
    guardianName: null,
    nickname: null,
    ownerUserId: null,
    address: '서울 성동구 성수동 3',
    status: SchoolStatus.ACTIVE,
    activeMembers: 0,
    pendingMembers: 0,
    businessVerified: false,
    createdAt: '2026-09-01T00:00:00+09:00',
  },
  {
    id: 101,
    name: '도담유치원',
    guardianName: null,
    nickname: null,
    ownerUserId: null,
    address: '인천 연수구 송도동 4',
    status: SchoolStatus.CLOSED,
    activeMembers: 0,
    pendingMembers: 0,
    businessVerified: true,
    createdAt: '2026-08-01T00:00:00+09:00',
  },
];

function getMockKindergartens(): MockKindergarten[] {
  try {
    const stored = JSON.parse(localStorage.getItem('daeng-bo-mock-kindergartens') ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    // 잘못된 개발 데이터는 기본값으로 복구한다.
  }
  return DEFAULT_KINDERGARTENS;
}

/**
 * 유치원 목록 가짜 API(`GET /service-admin/schools`). 세션이 없거나 만료·비활성이면 요청을 거부한다.
 * 명세대로 응답을 `data`로 감싸지 않고 페이지는 1부터 센다. 화면은 늘 올바른 값만 보내므로
 * 잘못된 `page`·`size`는 서버처럼 오류로 돌려주지 않고 기본값으로 둔다.
 */
export const KINDERGARTEN_HANDLERS = [
  http.get(mockUrl('/service-admin/schools'), ({ request }) => {
    const denied = authenticateMockRequest().denied;
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const status = Object.values(SchoolStatus).find((value) => value === params.get('status'));
    const items = getKindergartenList(getMockKindergartens(), { status, keyword: params.get('keyword') ?? '' });
    const rawPage = Number(params.get('page') ?? 1);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Number(params.get('size') ?? DEFAULT_PAGE_SIZE);
    const size = Number.isSafeInteger(rawSize) && rawSize >= 1 && rawSize <= 100 ? rawSize : DEFAULT_PAGE_SIZE;
    const body: ServiceSchoolPage = {
      items: items.slice((page - 1) * size, page * size),
      page,
      size,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / size),
    };
    return HttpResponse.json(body);
  }),
];
