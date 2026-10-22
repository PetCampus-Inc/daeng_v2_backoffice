import { createSerializer, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { IDEA_SORTS, IDEA_USER_TYPES } from '../type/idea';

const IDEA_LIST_SEARCH_PARAMS = {
  keyword: parseAsString.withDefault(''),
  userType: parseAsStringLiteral(['all', ...IDEA_USER_TYPES]).withDefault('all'),
  sort: parseAsStringLiteral(IDEA_SORTS).withDefault('latest'),
  page: parseAsInteger.withDefault(1),
};
const serialize = createSerializer(IDEA_LIST_SEARCH_PARAMS);

/** 목록 조건을 주소에 저장해 상세에서 돌아올 때 복원한다. */
export function useIdeaListSearchParams() {
  const [params, setSearchParams] = useQueryStates(IDEA_LIST_SEARCH_PARAMS, { history: 'replace' });
  const { page, ...listParams } = params;
  return { listParams, page: Math.max(page, 1), listSearch: serialize(params), setSearchParams };
}
