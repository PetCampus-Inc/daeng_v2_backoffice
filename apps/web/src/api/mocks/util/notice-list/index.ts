import { NoticeStatus, type Notice } from '@/routes/notices/type';

/** 가짜 서버에 저장하는 공지. 서버 응답(상세)과 같은 모양이며 시각은 UTC다. */
export type MockNotice = Notice;

/** 가짜 서버가 읽은 공지 목록 조건. 서버가 받는 값 그대로다. */
export type MockNoticeFilter = { keyword: string; status?: NoticeStatus };

/** 입력 검증 실패. 서버의 400 `details` 한 줄이다. */
export type MockNoticeQueryIssue = { field: string; reason: string };

/** 서버 검증 한도: 제목·검색어 50자, 본문 5,000자(UTF-16 길이). */
export const MOCK_NOTICE_TITLE_MAX = 50;
export const MOCK_NOTICE_BODY_MAX = 5000;
export const MOCK_NOTICE_KEYWORD_MAX = 50;

/** 공지 번호 규칙: 1 이상의 안전한 정수만(서버 id 파이프). 아니면 undefined. */
export function parseNoticeId(rawId: unknown): number | undefined {
  if (typeof rawId !== 'string' || !/^[1-9]\d*$/.test(rawId)) return undefined;
  const id = Number(rawId);
  return Number.isSafeInteger(id) ? id : undefined;
}

/**
 * 서버의 목록 쿼리 검증을 따라 한다. 검색어는 50자 이하(앞뒤 공백을 떼지 않은 값 그대로), 상태는 `DRAFT`·`PUBLISHED`·
 * `UNPUBLISHED`, 페이지는 1 이상의 정수(기본 1), 크기는 1~100의 정수(기본 20)다. 잘못된 값이 하나라도 있으면 issues에 담는다.
 */
export function parseNoticeListQuery(
  searchParams: URLSearchParams
): { filter: MockNoticeFilter; page: number; size: number; issues?: undefined } | { issues: MockNoticeQueryIssue[] } {
  const issues: MockNoticeQueryIssue[] = [];
  const keyword = searchParams.get('keyword') ?? '';
  if (keyword.length > MOCK_NOTICE_KEYWORD_MAX) {
    issues.push({ field: 'keyword', reason: `${MOCK_NOTICE_KEYWORD_MAX}자 이하로 입력해 주세요.` });
  }
  const status = Object.values(NoticeStatus).find((value) => value === searchParams.get('status'));
  if (searchParams.has('status') && !status) issues.push({ field: 'status', reason: '올바른 상태가 아닙니다.' });

  const readInteger = (field: string, fallback: number, min: number, max: number) => {
    const raw = searchParams.get(field);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (raw.trim() !== '' && Number.isInteger(value) && value >= min && value <= max) return value;
    issues.push({ field, reason: `${min} 이상${max === Infinity ? '' : ` ${max} 이하`}의 정수여야 합니다.` });
    return fallback;
  };
  const page = readInteger('page', 1, 1, Infinity);
  const size = readInteger('size', 20, 1, 100);
  if (issues.length > 0) return { issues };
  return { filter: { keyword, status }, page, size };
}

/**
 * 서버 정렬: 초안이 먼저(생성일 최신순), 그다음 게시·게시 해제 공지(최초 게시일 내림차순). 같으면 번호가 큰 것이 먼저다.
 * 게시 해제·재게시·수정은 순서를 바꾸지 않는다.
 */
export function compareNotices(left: MockNotice, right: MockNotice) {
  const isLeftDraft = left.status === NoticeStatus.DRAFT;
  if (isLeftDraft !== (right.status === NoticeStatus.DRAFT)) return isLeftDraft ? -1 : 1;
  const dateOf = (notice: MockNotice) =>
    Date.parse((notice.status === NoticeStatus.DRAFT ? notice.createdAt : notice.publishedAt) ?? notice.createdAt);
  return dateOf(right) - dateOf(left) || right.id - left.id;
}

/** 상태로 거르고, 제목에서 검색어(대소문자 구분 없는 부분 일치)를 찾아 서버 정렬로 돌려준다. */
export function getNoticeList(items: MockNotice[], filter: MockNoticeFilter): MockNotice[] {
  const keyword = filter.keyword.toLowerCase();
  return items
    .filter(
      (notice) => (!filter.status || notice.status === filter.status) && notice.title.toLowerCase().includes(keyword)
    )
    .sort(compareNotices);
}
