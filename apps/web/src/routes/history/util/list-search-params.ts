import {
  createParser,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
  type inferParserType,
  type Nullable,
} from 'nuqs';
import { HISTORY_PERIODS, HISTORY_TARGET_TYPES, type HistoryListParams } from '../type/history';

/** 주소의 날짜는 실제로 있는 `YYYY-MM-DD`만 받는다. 그 밖의 값은 비운 것으로 본다. */
const parseAsDateText = createParser({
  parse: (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : null;
  },
  serialize: (value: string) => value,
});

const HISTORY_LIST_SEARCH_PARAMS = {
  period: parseAsStringLiteral(HISTORY_PERIODS).withDefault('all'),
  from: parseAsDateText.withDefault(''),
  to: parseAsDateText.withDefault(''),
  actor: parseAsString.withDefault('all'),
  targetType: parseAsStringLiteral(['all', ...HISTORY_TARGET_TYPES]).withDefault('all'),
  page: parseAsInteger.withDefault(1),
};

/** 주소에 쓸 목록 조건. null이면 처음 값으로 지운다. */
export type HistorySearchCondition = Partial<
  Nullable<Omit<inferParserType<typeof HISTORY_LIST_SEARCH_PARAMS>, 'page'>>
>;

/**
 * 변경 이력 목록 조건·페이지를 주소에서 읽고 바꾼다. 바꿀 때는 기록을 늘리지 않는다.
 * 기간 전체면 주소에 남은 날짜는 쓰지 않는다.
 */
export function useHistoryListSearchParams() {
  const [searchParams, setSearchParams] = useQueryStates(HISTORY_LIST_SEARCH_PARAMS, { history: 'replace' });
  const { page, period, from, to, ...rest } = searchParams;
  const isCustom = period === 'custom';
  const listParams: HistoryListParams = {
    ...rest,
    period,
    from: isCustom ? from : '',
    to: isCustom ? to : '',
  };
  return { listParams, page: Math.max(page, 1), setSearchParams };
}
