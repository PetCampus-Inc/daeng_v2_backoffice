import { http } from 'msw';
import type { Kindergarten } from '@/routes/kindergartens/type/kindergarten';
import { errorResponse, mockUrl, pageResponse } from '../util/response';
import { getMockTeamMembers } from './team-members';

/** TC fixtures.md 유치원-기본. localStorage로 빈 목록·25건 시나리오도 확인한다. */
const DEFAULT_KINDERGARTENS: Kindergarten[] = [
  {
    id: 104,
    name: '햇살유치원',
    ownerName: '이원장',
    address: '서울 마포구 망원동 1',
    status: 'ACTIVE',
    activeMembers: 12,
    pendingMembers: 2,
    businessVerified: true,
    createdAt: '2026-10-01T00:00:00+09:00',
  },
  {
    id: 103,
    name: '달빛유치원',
    ownerName: '박원장',
    address: '경기 성남시 분당구 정자동 2',
    status: 'ACTIVE',
    activeMembers: 5,
    pendingMembers: 0,
    businessVerified: false,
    createdAt: '2026-09-15T00:00:00+09:00',
  },
  {
    id: 102,
    name: '별빛유치원',
    ownerName: null,
    address: '서울 성동구 성수동 3',
    status: 'ACTIVE',
    activeMembers: 0,
    pendingMembers: 0,
    businessVerified: false,
    createdAt: '2026-09-01T00:00:00+09:00',
  },
  {
    id: 101,
    name: '도담유치원',
    ownerName: null,
    address: '인천 연수구 송도동 4',
    status: 'CLOSED',
    activeMembers: 0,
    pendingMembers: 0,
    businessVerified: true,
    createdAt: '2026-08-01T00:00:00+09:00',
  },
];

function getMockKindergartens(): Kindergarten[] {
  try {
    const stored = JSON.parse(localStorage.getItem('daeng-bo-mock-kindergartens') ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    // 잘못된 개발 데이터는 기본값으로 복구한다.
  }
  return DEFAULT_KINDERGARTENS;
}

export const KINDERGARTEN_HANDLERS = [
  http.get(mockUrl('/kindergartens'), ({ request }) => {
    const member = getMockTeamMembers().find((item) => item.email === request.headers.get('X-Dev-Email'));
    if (!member || member.status !== 'active') {
      return errorResponse(401, {
        code: 'UNAUTHORIZED',
        message: '로그인이 필요합니다.',
        errorMessage: '로그인이 필요합니다.',
      });
    }
    const params = new URL(request.url).searchParams;
    const keyword = (params.get('keyword') ?? '').trim().toLowerCase();
    const status = params.get('status');
    const items = getMockKindergartens()
      .filter(
        (item) =>
          (!status || item.status === status) &&
          [item.name, item.ownerName ?? '', item.address].some((value) => value.toLowerCase().includes(keyword))
      )
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id - left.id);
    const rawPage = Number(params.get('page') ?? 0);
    const rawSize = Number(params.get('size') ?? 20);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
    const size = Number.isSafeInteger(rawSize) && rawSize > 0 && rawSize <= 100 ? rawSize : 20;
    return pageResponse(items, page, size);
  }),
];
