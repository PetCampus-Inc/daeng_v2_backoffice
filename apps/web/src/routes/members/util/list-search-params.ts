import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useEffect, useState } from 'react';
import { MEMBER_FILTERS, MEMBER_JOINED_PERIODS } from '../type/member';

const MEMBER_SEARCH_PARAMS = {
  keyword: parseAsString.withDefault(''),
  type: parseAsStringLiteral(MEMBER_FILTERS).withDefault('all'),
  joinedWithin: parseAsStringLiteral(MEMBER_JOINED_PERIODS).withDefault('all'),
  page: parseAsInteger.withDefault(1),
};

export function useMemberListParams() {
  const [params, setSearchParams] = useQueryStates(MEMBER_SEARCH_PARAMS, { history: 'replace' });
  const { page, ...listParams } = params;
  const [keyword, setKeyword] = useState(listParams.keyword);
  const [isComposing, setIsComposing] = useState(false);
  useEffect(() => {
    if (isComposing) return;
    const timer = setTimeout(() => setKeyword(listParams.keyword), 250);
    return () => clearTimeout(timer);
  }, [listParams.keyword, isComposing]);
  return {
    listParams,
    queryParams: { ...listParams, keyword },
    page: Math.max(page, 1),
    setSearchParams,
    setIsComposing,
  };
}
