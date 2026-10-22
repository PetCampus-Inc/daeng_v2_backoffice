import { createSerializer, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { INQUIRY_SORTS, INQUIRY_STATUSES, INQUIRY_USER_TYPES, type InquiryListParams } from '../type/inquiry';

/**
 * 목록 검색·필터·정렬·페이지는 주소에 둔다. 상세에서 뒤로 오면 그대로 복원되고(PRD 4.3),
 * 상세도 같은 값으로 이전·다음 문의를 정한다.
 */
const INQUIRY_LIST_SEARCH_PARAMS = {
  keyword: parseAsString.withDefault(''),
  status: parseAsStringLiteral(['all', ...INQUIRY_STATUSES]).withDefault('all'),
  userType: parseAsStringLiteral(['all', ...INQUIRY_USER_TYPES]).withDefault('all'),
  assignee: parseAsString.withDefault('all'),
  sort: parseAsStringLiteral(INQUIRY_SORTS).withDefault('latest'),
  page: parseAsInteger.withDefault(1),
};

const serializeListSearchParams = createSerializer(INQUIRY_LIST_SEARCH_PARAMS);

/**
 * 주소의 목록 조건을 읽고 바꾼다. 바꿀 때는 기록을 늘리지 않는다.
 * nuqs는 주소를 조금 늦게 바꾸므로, 상세로 넘길 조건은 라우터 주소 대신 `listSearch`(지금 값으로 만든 `?…`)를 쓴다.
 */
export function useInquiryListSearchParams() {
  const [searchParams, setSearchParams] = useQueryStates(INQUIRY_LIST_SEARCH_PARAMS, { history: 'replace' });
  const { page, ...listParams } = searchParams;
  return {
    listParams: listParams satisfies InquiryListParams,
    page: Math.max(page, 1),
    listSearch: serializeListSearchParams(searchParams),
    setSearchParams,
  };
}
