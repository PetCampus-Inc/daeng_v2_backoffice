import { http } from 'msw';
import type { Idea } from '@/routes/ideas/type/idea';
import { errorResponse, mockUrl, okResponse, pageResponse } from '../util/response';
import { getMockTeamMembers } from './team-members';

const HONG: Idea['user'] = { type: 'guardian', name: '홍길동', email: 'hong@example.com' };
const LEE: Idea['user'] = { type: 'director', name: '이원장', email: 'Director.Lee@example.com' };
const firstLine = '산책 코스 추천 기능이 있으면 좋겠어요';
const secondLine = '반려견과 함께 걸을 수 있는 길과 주변 편의시설을 확인하고 싶어요. '.repeat(8);
const thirdLine = '다른 보호자들의 후기와 추천을 함께 볼 수 있으면 도움이 될 것 같아요. '.repeat(8);
const longContent = `${firstLine}\n${secondLine}\n${thirdLine}`.slice(0, 500);

/** TC fixtures.md 제안-기본. 개발자 도구에서 저장값을 바꿔 빈 목록·여러 페이지도 확인할 수 있다. */
const DEFAULT_IDEAS: Idea[] = [
  { id: 350, content: longContent, user: HONG, submittedAt: '2026-10-07T09:00:00+09:00' },
  { id: 349, content: 'Daily report 기능을 원해요', user: LEE, submittedAt: '2026-10-06T12:00:00+09:00' },
  {
    id: 348,
    content: '알림 소리를 바꾸고 싶어요',
    user: { type: 'guardian', name: '최보호', email: 'choi@example.com' },
    submittedAt: '2026-10-06T12:00:00+09:00',
  },
  { id: 347, content: '출결 통계가 있으면 좋겠어요', user: LEE, submittedAt: '2026-10-05T10:00:00+09:00' },
  { id: 346, content: '다크 모드 지원', user: HONG, submittedAt: '2026-10-04T10:00:00+09:00' },
];

const getMockIdeas = (): Idea[] => {
  try {
    const stored = JSON.parse(localStorage.getItem('daeng-bo-mock-ideas') ?? 'null');
    if (Array.isArray(stored)) return stored;
  } catch {
    /* 잘못된 개발 데이터는 기본값으로 복구한다. */
  }
  return DEFAULT_IDEAS;
};

/** 조회자는 제안을 읽을 수 있다. 비활성 계정은 요청을 거부한다. */
const authorize = (request: Request) => {
  const member = getMockTeamMembers().find((item) => item.email === request.headers.get('X-Dev-Email'));
  return !member || member.status !== 'active'
    ? errorResponse(401, {
        code: 'UNAUTHORIZED',
        message: '로그인이 필요합니다.',
        errorMessage: '로그인이 필요합니다.',
      })
    : null;
};

export const IDEA_HANDLERS = [
  http.get(mockUrl('/ideas'), ({ request }) => {
    const denied = authorize(request);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const keyword = (params.get('keyword') ?? '').toLowerCase();
    const userType = params.get('userType');
    const items = getMockIdeas()
      .filter(
        (idea) =>
          (!userType || idea.user.type === userType) &&
          [idea.content, idea.user.name].some((value) => value.toLowerCase().includes(keyword))
      )
      .sort((left, right) => {
        const gap = Date.parse(left.submittedAt) - Date.parse(right.submittedAt);
        return (params.get('sort') === 'oldest' ? gap : -gap) || right.id - left.id;
      });
    const rawPage = Number(params.get('page') ?? 0);
    const rawSize = Number(params.get('size') ?? 20);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
    const size = Number.isSafeInteger(rawSize) && rawSize > 0 && rawSize <= 100 ? rawSize : 20;
    return pageResponse(items, page, size);
  }),
  http.get(mockUrl('/ideas/:id'), ({ request, params }) => {
    const denied = authorize(request);
    if (denied) return denied;
    const idea =
      typeof params.id === 'string' && /^\d+$/.test(params.id)
        ? getMockIdeas().find((item) => item.id === Number(params.id))
        : undefined;
    return idea
      ? okResponse(idea)
      : errorResponse(404, {
          code: 'IDEA_NOT_FOUND',
          message: '페이지를 찾을 수 없습니다.',
          errorMessage: '페이지를 찾을 수 없습니다.',
        });
  }),
];
