import type { UseQueryOptions } from '@tanstack/react-query';
import axios from 'axios';
import type { TeamMember } from '@/routes/settings/members/type/team-member';
import { formatProfileName } from '@/util/profile';
import { getListChangeLogsQueryKey, type ListChangeLogsQueryError } from '../use-history';
import type { ChangeLogPage, ListChangeLogsParams } from '../../type';
import { HISTORY_TARGET_TYPE_REQUEST_VALUES, type HistoryListParams } from '../../type/history-ui';

/** 변경 이력 한 페이지 건수(PRD 7.12). */
const HISTORY_PAGE_SIZE = 20;

/** 역할 때문에 거부된 요청(403)인지. 다시 보내도 같으므로 재시도하지 않고 바로 권한 없음 화면을 보여 준다. */
export const isForbiddenError = (error: unknown) => axios.isAxiosError(error) && error.response?.status === 403;

/** 403은 재시도하지 않고, 그 밖의 실패는 기본값처럼 3번까지 다시 시도한다. */
export const retryUnlessForbidden = (failureCount: number, error: unknown) =>
  !isForbiddenError(error) && failureCount < 3;

/** 행위자 칸 선택지 한 건. 주소에는 이메일을 남기고 서버에는 팀원 ID를 보낸다. */
export type HistoryActorOption = { id: number; email: string; label: string };

/**
 * 팀원 목록에서 행위자 선택지를 만든다. 표시명과 직무가 있는 팀원만 나열한다(첫 로그인 전 '등록됨' 팀원은 둘 다 없다).
 * 직무는 이름 옆에 붙여 보인다.
 */
export const toHistoryActorOptions = (
  members: readonly Pick<TeamMember, 'id' | 'email' | 'displayName' | 'jobRole'>[]
): HistoryActorOption[] =>
  members.flatMap(({ id, email, displayName, jobRole }) =>
    displayName && jobRole ? [{ id, email, label: formatProfileName({ displayName, jobRole }) }] : []
  );

/**
 * 화면 조건을 `GET /change-logs` 요청 값으로 바꾼다. 기간 전체·'전체' 선택은 보내지 않는다.
 * 행위자는 주소의 이메일 대신 팀원 ID(`actorId`)를 보내고, 페이지는 1부터 센다.
 */
export const toHistoryListRequest = (
  params: HistoryListParams,
  page: number,
  actorId: number | undefined
): ListChangeLogsParams => ({
  from: params.period === 'custom' && params.from ? params.from : undefined,
  to: params.period === 'custom' && params.to ? params.to : undefined,
  actorId,
  targetType: params.targetType === 'all' ? undefined : HISTORY_TARGET_TYPE_REQUEST_VALUES[params.targetType],
  page,
  size: HISTORY_PAGE_SIZE,
});

/**
 * 생성 훅 `useListChangeLogs`에 넘기는 조회 옵션.
 * 로그인 계정을 조회 키 끝에 붙여, 조건이 바뀌는 동안 같은 계정의 이전 결과만 자리 표시로 유지한다.
 * 계정이 바뀌면 이전 계정의 결과를 보여 주지 않는다. `enabled`가 거짓이면 요청을 보내지 않는다.
 */
export const historyListQueryOptions = (
  email: string,
  request: ListChangeLogsParams,
  enabled: boolean
): Partial<UseQueryOptions<ChangeLogPage, ListChangeLogsQueryError>> => ({
  queryKey: [...getListChangeLogsQueryKey(request), email],
  placeholderData: (previousData, previousQuery) =>
    previousQuery?.queryKey.at(-1) === email ? previousData : undefined,
  retry: retryUnlessForbidden,
  enabled,
});
