import { createSerializer, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { NOTICE_STATUSES } from '../type/notice';

const NOTICE_LIST_SEARCH_PARAMS = {
  keyword: parseAsString.withDefault(''),
  status: parseAsStringLiteral(['all', ...NOTICE_STATUSES]).withDefault('all'),
  page: parseAsInteger.withDefault(1),
};
const SERIALIZE = createSerializer(NOTICE_LIST_SEARCH_PARAMS);

export function useNoticeListSearchParams() {
  const [params, setSearchParams] = useQueryStates(NOTICE_LIST_SEARCH_PARAMS, { history: 'replace' });
  const { page, ...listParams } = params;
  return { listParams, page: Math.max(1, page), listSearch: SERIALIZE(params), setSearchParams };
}
