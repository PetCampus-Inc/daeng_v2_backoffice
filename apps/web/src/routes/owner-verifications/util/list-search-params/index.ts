import { createParser, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useEffect, useState } from 'react';
import { OWNER_VERIFICATION_SORTS, OWNER_VERIFICATION_TABS } from '../../type/owner-verification';

/**
 * 주소 값을 1 이상의 정수로 읽는다. `205`처럼 10진수 숫자만 받고,
 * `1e3`·`0x10`·`007`·`-1`·앞뒤 공백·너무 큰 수는 읽지 않는다(null, S-인증-017).
 */
export function parsePositiveInteger(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

const parseAsPositiveInteger = createParser({ parse: parsePositiveInteger, serialize: String });

const LIST_SEARCH_PARAMS = {
  keyword: parseAsString.withDefault(''),
  status: parseAsStringLiteral(['all', ...OWNER_VERIFICATION_TABS]).withDefault('all'),
  sort: parseAsStringLiteral(OWNER_VERIFICATION_SORTS).withDefault('latest'),
  page: parseAsPositiveInteger.withDefault(1),
  /** 상세 패널에 연 인증 번호 */
  selected: parseAsPositiveInteger,
};

/**
 * 탭·검색어·정렬·페이지·고른 건을 주소에 두고 기록은 교체한다(PRD 4.3, S-인증-017).
 * 검색 입력은 즉시 반영하고 서버 요청은 250ms debounce한다. 탭·정렬·페이지 변경은 즉시 조회한다.
 */
export function useOwnerVerificationListParams() {
  const [params, setSearchParams] = useQueryStates(LIST_SEARCH_PARAMS, { history: 'replace' });
  const { page, selected, ...listParams } = params;
  const [keyword, setKeyword] = useState(listParams.keyword);
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(listParams.keyword), 250);
    return () => clearTimeout(timer);
  }, [listParams.keyword]);
  return { listParams, queryParams: { ...listParams, keyword }, page, selected, setSearchParams };
}
