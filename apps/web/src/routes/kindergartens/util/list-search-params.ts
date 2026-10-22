import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useEffect, useState } from 'react';
import { KINDERGARTEN_STATUSES } from '../type/kindergarten';

const SCHOOL_LIST_SEARCH_PARAMS = {
  keyword: parseAsString.withDefault(''),
  status: parseAsStringLiteral(['all', ...KINDERGARTEN_STATUSES]).withDefault('all'),
  page: parseAsInteger.withDefault(1),
};

/** 검색 입력은 즉시 반영하고 서버 요청은 250ms debounce한다. 탭·페이지 변경은 즉시 조회한다. */
export function useKindergartenListParams() {
  const [params, setSearchParams] = useQueryStates(SCHOOL_LIST_SEARCH_PARAMS, { history: 'replace' });
  const { page, ...listParams } = params;
  const [keyword, setKeyword] = useState(listParams.keyword);
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(listParams.keyword), 250);
    return () => clearTimeout(timer);
  }, [listParams.keyword]);
  return { listParams, queryParams: { ...listParams, keyword }, page: Math.max(page, 1), setSearchParams };
}
