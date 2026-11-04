import { http, HttpResponse } from 'msw';
import type { Idea, IdeaPage } from '@/routes/ideas/type';
import { SortParameter } from '@/type/sort-parameter';
import { UserType } from '@/type/user-type';
import { ValidationFailedErrorCode } from '@/type/validation-failed-error-code';
import { KEYWORD_MAX_LENGTH } from '@/util/keyword-max-length';
import { getIdeaList } from '../util/idea-list';
import { mockUrl, okResponse } from '../util/response';
import { authenticateMockRequest } from '../util/session';
import { recordMockNotification } from '../util/notification-event';
import { getMockTeamMembers } from './team-members';

const HONG: Idea['user'] = { type: UserType.GUARDIAN, name: '홍길동', email: 'hong@example.com' };
const LEE: Idea['user'] = { type: UserType.DIRECTOR, name: '이원장', email: 'Director.Lee@example.com' };
const firstLine = '산책 코스 추천 기능이 있으면 좋겠어요';
const secondLine = '반려견과 함께 걸을 수 있는 길과 주변 편의시설을 확인하고 싶어요. '.repeat(8);
const thirdLine = '다른 보호자들의 후기와 추천을 함께 볼 수 있으면 도움이 될 것 같아요. '.repeat(8);
const longContent = `${firstLine}\n${secondLine}\n${thirdLine}`.slice(0, 500);

/** TC fixtures.md 제안-기본. 개발자 도구에서 저장값을 바꿔 빈 목록·여러 페이지도 확인할 수 있다. */
export const DEFAULT_IDEAS: Idea[] = [
  { id: 350, content: longContent, user: HONG, submittedAt: '2026-10-07T09:00:00+09:00' },
  { id: 349, content: 'Daily report 기능을 원해요', user: LEE, submittedAt: '2026-10-06T12:00:00+09:00' },
  {
    id: 348,
    content: '알림 소리를 바꾸고 싶어요',
    user: { type: UserType.GUARDIAN, name: '최보호', email: 'choi@example.com' },
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

/** 조회자는 제안을 읽을 수 있다. 세션이 없거나 만료·비활성이면 요청을 거부한다. */
const authorize = () => authenticateMockRequest().denied ?? null;

/** 서버 기본 한 페이지 건수. */
const DEFAULT_PAGE_SIZE = 20;

/** 입력 검증 실패 응답(400). 서버처럼 어느 값이 왜 잘못됐는지 `details`에 담는다. */
const rejectInvalidInput = (field: string, reason: string) =>
  HttpResponse.json(
    {
      code: ValidationFailedErrorCode.VALIDATION_FAILED,
      message: '입력값을 확인해 주세요.',
      details: [{ field, reason }],
    },
    { status: 400 }
  );

/**
 * 제안 가짜 API(`GET /ideas`, `GET /ideas/:id`). 세션이 없거나 만료·비활성이면 요청을 거부한다.
 * 명세대로 응답을 `data`로 감싸지 않고 페이지는 1부터 센다. 서버처럼 100자를 넘는 검색어와
 * 1 이상의 정수가 아닌 번호는 400으로 돌려준다. 화면은 늘 올바른 `page`·`size`를 보내므로 그 둘은 기본값으로 둔다.
 */
export const IDEA_HANDLERS = [
  // 앱의 새 제안 접수를 흉내 내는 개발용 주소. BO 화면은 호출하지 않는다.
  http.post(mockUrl('/dev/ideas'), async ({ request }) => {
    const { content } = (await request.json()) as { content: string };
    const ideas = getMockIdeas();
    const idea: Idea = {
      id: Math.max(350, ...ideas.map((item) => item.id)) + 1,
      content,
      user: HONG,
      submittedAt: new Date().toISOString(),
    };
    localStorage.setItem('daeng-bo-mock-ideas', JSON.stringify([...ideas, idea]));
    recordMockNotification(getMockTeamMembers(), { type: 'newIdea', targetId: idea.id });
    return okResponse(idea, 201);
  }),
  http.get(mockUrl('/ideas'), ({ request }) => {
    const denied = authorize();
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const keyword = params.get('keyword') ?? '';
    if (keyword.trim().length > KEYWORD_MAX_LENGTH) {
      return rejectInvalidInput('keyword', `${KEYWORD_MAX_LENGTH}자 이하로 입력해 주세요.`);
    }
    const userType = Object.values(UserType).find((value) => value === params.get('userType'));
    const sort = Object.values(SortParameter).find((value) => value === params.get('sort'));
    const items = getIdeaList(getMockIdeas(), { keyword, userType, sort });
    const rawPage = Number(params.get('page') ?? 1);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
    const rawSize = Number(params.get('size') ?? DEFAULT_PAGE_SIZE);
    const size = Number.isSafeInteger(rawSize) && rawSize >= 1 && rawSize <= 100 ? rawSize : DEFAULT_PAGE_SIZE;
    const body: IdeaPage = {
      items: items.slice((page - 1) * size, page * size),
      page,
      size,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / size),
    };
    return HttpResponse.json(body);
  }),
  http.get(mockUrl('/ideas/:id'), ({ params }) => {
    const denied = authorize();
    if (denied) return denied;
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id < 1) return rejectInvalidInput('id', '1 이상의 정수여야 합니다.');
    const idea = getMockIdeas().find((item) => item.id === id);
    return idea
      ? HttpResponse.json(idea)
      : HttpResponse.json({ code: 'IDEA_NOT_FOUND', message: '페이지를 찾을 수 없습니다.' }, { status: 404 });
  }),
];
