import type { Idea } from '@/routes/ideas/type';
import type { SortParameter } from '@/type/sort-parameter';
import type { UserType } from '@/type/user-type';

/** 가짜 서버의 제안 목록 조건. 서버가 받는 값 그대로라 빈 값이 올 수 있다. */
export type MockIdeaListParams = { keyword: string; userType?: UserType; sort?: SortParameter };

/** 제출 시각순으로 비교하고, 같으면 번호가 큰 것이 먼저다(서버 `idea-reader.ts`의 정렬). */
const compareIdeas = (left: Idea, right: Idea, sort: SortParameter | undefined) => {
  const gap = Date.parse(left.submittedAt) - Date.parse(right.submittedAt);
  return (sort === 'OLDEST' ? gap : -gap) || right.id - left.id;
};

/**
 * 가짜 서버의 제안 목록 규칙(서버 `idea-reader.ts`와 같다). 사용자 유형으로 거르고, 내용·사용자 이름·사용자 이메일을
 * 앞뒤 공백 없이 대소문자 구분 없는 부분 일치로 찾는다. 일부만 맞아도 찾는다.
 */
export function getIdeaList(items: Idea[], params: MockIdeaListParams): Idea[] {
  const keyword = params.keyword.trim().toLowerCase();
  return items
    .filter(
      (item) =>
        (!params.userType || item.user.type === params.userType) &&
        [item.content, item.user.name, item.user.email].some((value) => value.toLowerCase().includes(keyword))
    )
    .sort((left, right) => compareIdeas(left, right, params.sort));
}
