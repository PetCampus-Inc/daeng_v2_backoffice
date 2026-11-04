import { InquiryStatus, type InquiryDetail } from '@/routes/inquiries/type';
import { SortParameter } from '@/type/sort-parameter';
import { UserType } from '@/type/user-type';
import { KEYWORD_MAX_LENGTH } from '@/util/keyword-max-length';

/** 가짜 서버에 저장하는 문의. 담당자는 팀원 번호로 두고 응답할 때 팀원 정보로 바꾼다. */
export type MockInquiry = Omit<InquiryDetail, 'assignee'> & { assigneeId: number | null };

/** 가짜 서버가 읽은 문의 목록 조건. 서버가 받는 값 그대로이며 `ME`는 요청한 팀원 번호로 바뀐 상태다. */
export type MockInquiryFilter = {
  keyword: string;
  status?: InquiryStatus;
  userType?: UserType;
  assignee?: 'UNASSIGNED' | number;
  sort: SortParameter;
};

/** 입력 검증 실패. 서버의 400 `details` 한 줄이다. */
export type MockInquiryQueryIssue = { field: string; reason: string };

/** 문의 번호 규칙: 1 이상의 안전한 정수만(서버 id 파이프). 아니면 undefined. */
export function parseInquiryId(rawId: unknown): number | undefined {
  const id = typeof rawId === 'string' ? Number(rawId) : Number.NaN;
  return Number.isSafeInteger(id) && id >= 1 ? id : undefined;
}

/**
 * 서버의 목록·이전다음 쿼리 검증을 따라 한다. 검색어는 앞뒤 공백을 뗀 뒤 100자 이하, 담당자는 `ME`·`UNASSIGNED`·팀원 번호
 * (`1`로 시작하지 않는 `0`, `1e3` 같은 값은 거절), 정렬은 `LATEST`(기본)·`OLDEST`다. `page`·`size`를 읽으면 서버처럼
 * 정수 범위(1 이상 / 1~100)를 검사한다. 잘못된 값이 하나라도 있으면 issues에 담아 돌려준다.
 */
export function parseInquiryListQuery(
  searchParams: URLSearchParams,
  actorId: number,
  options: { hasPage: boolean }
): { filter: MockInquiryFilter; page: number; size: number; issues?: undefined } | { issues: MockInquiryQueryIssue[] } {
  const issues: MockInquiryQueryIssue[] = [];
  const keyword = (searchParams.get('keyword') ?? '').trim();
  if (keyword.length > KEYWORD_MAX_LENGTH) {
    issues.push({ field: 'keyword', reason: `${KEYWORD_MAX_LENGTH}자 이하로 입력해 주세요.` });
  }
  const status = Object.values(InquiryStatus).find((value) => value === searchParams.get('status'));
  if (searchParams.has('status') && !status) issues.push({ field: 'status', reason: '올바른 상태가 아닙니다.' });
  const userType = Object.values(UserType).find((value) => value === searchParams.get('userType'));
  if (searchParams.has('userType') && !userType) {
    issues.push({ field: 'userType', reason: '올바른 사용자 유형이 아닙니다.' });
  }
  const rawAssignee = searchParams.get('assignee');
  let assignee: MockInquiryFilter['assignee'];
  if (rawAssignee === 'ME') assignee = actorId;
  else if (rawAssignee === 'UNASSIGNED') assignee = 'UNASSIGNED';
  else if (rawAssignee !== null) {
    if (/^[1-9][0-9]*$/.test(rawAssignee)) assignee = Number(rawAssignee);
    else issues.push({ field: 'assignee', reason: '`ME`, `UNASSIGNED` 또는 팀원 번호여야 합니다.' });
  }
  const rawSort = searchParams.get('sort');
  const sort = Object.values(SortParameter).find((value) => value === rawSort) ?? SortParameter.LATEST;
  if (rawSort !== null && rawSort !== sort) issues.push({ field: 'sort', reason: '올바른 정렬이 아닙니다.' });

  const readInteger = (field: string, fallback: number, min: number, max: number) => {
    const raw = searchParams.get(field);
    if (raw === null || !options.hasPage) return fallback;
    const value = Number(raw);
    if (Number.isInteger(value) && value >= min && value <= max) return value;
    issues.push({ field, reason: `${min} 이상${max === Infinity ? '' : ` ${max} 이하`}의 정수여야 합니다.` });
    return fallback;
  };
  const page = readInteger('page', 1, 1, Infinity);
  const size = readInteger('size', 20, 1, 100);
  if (issues.length > 0) return { issues };
  return {
    filter: { keyword, status, userType, assignee, sort },
    page,
    size,
  };
}

/** 최근 활동순으로 비교하고, 같으면 번호가 큰 것이 먼저다(서버 `inquiry-reader.ts`의 정렬). */
const compareInquiries = (left: MockInquiry, right: MockInquiry, sort: SortParameter) => {
  const gap = Date.parse(left.lastActivityAt) - Date.parse(right.lastActivityAt);
  return (sort === SortParameter.OLDEST ? gap : -gap) || right.id - left.id;
};

/**
 * 가짜 서버의 문의 목록 규칙(서버 `inquiry-reader.ts`와 같다). 상태·사용자 유형·담당자로 거르고, 제목·사용자 이름·사용자 이메일·
 * 문의 번호·대화 내용에서 검색어를 앞뒤 공백 없이 대소문자 구분 없는 부분 일치로 찾는다.
 */
export function getInquiryList(items: MockInquiry[], filter: MockInquiryFilter): MockInquiry[] {
  const keyword = filter.keyword.trim().toLowerCase();
  return items
    .filter((inquiry) => {
      if (filter.status && inquiry.status !== filter.status) return false;
      if (filter.userType && inquiry.user.type !== filter.userType) return false;
      if (filter.assignee === 'UNASSIGNED' && inquiry.assigneeId !== null) return false;
      if (typeof filter.assignee === 'number' && inquiry.assigneeId !== filter.assignee) return false;
      if (!keyword) return true;
      return [
        inquiry.title,
        inquiry.user.name,
        inquiry.user.email,
        String(inquiry.id),
        ...inquiry.messages.map((message) => message.body),
      ].some((value) => value.toLowerCase().includes(keyword));
    })
    .sort((left, right) => compareInquiries(left, right, filter.sort));
}

/** 같은 조건에서 이 문의의 앞뒤 번호. 조건에 맞는 목록에 이 문의가 없으면 둘 다 null이다. */
export function getAdjacentInquiryIds(items: MockInquiry[], id: number, filter: MockInquiryFilter) {
  const list = getInquiryList(items, filter);
  const index = list.findIndex((inquiry) => inquiry.id === id);
  if (index === -1) return { prevId: null, nextId: null };
  return { prevId: list[index - 1]?.id ?? null, nextId: list[index + 1]?.id ?? null };
}
