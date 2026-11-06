import { useQueryClient, type Query, type UseQueryOptions } from '@tanstack/react-query';
import {
  getGetTermsVersionQueryKey,
  getListTermsVersionsQueryKey,
  type GetTermsVersionQueryError,
  type ListTermsVersionsQueryError,
} from '../use-terms';
import type {
  CreateTermsVersionRequest,
  TermsVersion as ServerTerm,
  TermsVersionSummary as ServerTermSummary,
  UpdateTermsVersionRequest,
} from '../../type';
import {
  TERM_KIND_FROM_SERVER,
  TERM_KIND_REQUEST_VALUES,
  TERM_STATUS_FROM_SERVER,
  type Term,
  type TermKind,
  type TermSummary,
} from '../../type/term-ui';
import { fromContentBody } from '@/util/rich-content';

/** 약관 변경 요청(저장·공개·삭제·철회)이 진행 중인지 화면 여러 곳에서 함께 보는 키. 계정마다 따로다. */
export const getTermChangeMutationKey = (email: string) => ['terms', email, 'change'] as const;

/** 화면 종류(소문자)를 생성 훅에 넘기는 서버 종류(대문자)로 바꾼다. */
export const toServerTermKind = (kind: TermKind) => TERM_KIND_REQUEST_VALUES[kind];

/**
 * 서버 약관 목록 한 행을 화면 값으로 바꾼다. 이름이 겹치는 두 값이 여기서만 바뀐다:
 * 서버 `id`가 화면의 버전 번호(`version`)가 된다. 상태·종류는 소문자가 되고, 비어 있는 시행일은 빈 문자열이 된다.
 * 서버 `effectiveStatus`는 쓰지 않는다(화면이 `getTermStatus`로 판정).
 */
export const toTermSummary = (term: ServerTermSummary): TermSummary => ({
  kind: TERM_KIND_FROM_SERVER[term.kind],
  version: term.id,
  status: TERM_STATUS_FROM_SERVER[term.publishStatus],
  effectiveDate: term.effectiveDate ?? '',
  publishedAt: term.publishedAt,
  updatedAt: term.updatedAt,
});

/** 서버 약관 상세를 화면 값으로 바꾼다. 서버 `version`(동시 수정 값)이 화면의 `revision`이 되고, 본문은 블록 값이 된다. */
export const toTerm = (term: ServerTerm): Term => ({
  ...toTermSummary(term),
  body: fromContentBody(term.content),
  revision: term.version,
});

/** 초안 생성 요청 본문(`POST`). 시행일이 비어 있으면 필드를 보내지 않는다. 본문은 블록 값 그대로 보낸다. */
export const toTermCreateRequest = (effectiveDate: string | null, body: Term['body']): CreateTermsVersionRequest => ({
  ...(effectiveDate ? { effectiveDate } : {}),
  content: body,
});

/** 초안 수정 요청 본문(`PATCH`). 시행일이 비어 있으면 `null`을 보내 서버의 시행일도 비운다(보내지 않으면 유지). */
export const toTermUpdateRequest = (
  effectiveDate: string | null,
  body: Term['body']
): Omit<UpdateTermsVersionRequest, 'version'> => ({
  effectiveDate,
  content: body,
});

/** 약관 목록 조회 키인지 본다. 목록 키는 `/terms/{kind}/versions`, 상세 키는 `/term-versions/{id}`다. */
const isTermListQuery = (query: Query) => String(query.queryKey[0]).startsWith('/terms/');
/** 약관 목록 또는 상세 조회 키인지 본다. */
const isTermQuery = (query: Query) => isTermListQuery(query) || String(query.queryKey[0]).startsWith('/term-versions/');

/**
 * 생성 훅 `useListTermsVersions`에 넘기는 조회 옵션. 생성 키는 `/terms/{kind}/versions`뿐이라 로그인 계정을 키 끝에 붙이고,
 * 계정이 바뀌면 이전 계정의 결과를 쓰지 않는다. 서버 순서(초안이 맨 위에 최근 생성순, 나머지는 시행일 내림차순·같으면 번호가 큰 것 먼저)를 그대로 쓰고 화면에서 다시 정렬하지 않는다.
 */
export const termListQueryOptions = (
  email: string,
  kind: TermKind
): Partial<UseQueryOptions<ServerTermSummary[], ListTermsVersionsQueryError, TermSummary[]>> => ({
  queryKey: [...getListTermsVersionsQueryKey(toServerTermKind(kind)), email],
  select: (items) => items.map(toTermSummary),
  retry: false,
});

/** 생성 훅 `useGetTermsVersion`에 넘기는 조회 옵션. 계정이 바뀌면 이전 계정의 상세를 쓰지 않도록 키 끝에 이메일을 붙이고, 없는 버전(404)은 다시 시도하지 않는다. */
export const termDetailQueryOptions = (
  email: string,
  id: number
): Partial<UseQueryOptions<ServerTerm, GetTermsVersionQueryError, Term>> => ({
  queryKey: [...getGetTermsVersionQueryKey(id), email],
  select: toTerm,
  retry: false,
});

/** 약관 목록·상세를 모두 다시 읽게 한다. 다른 팀원이 먼저 바꾼 것이 드러났을 때 쓴다. */
export const useInvalidateTerms = () => {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ predicate: isTermQuery });
};

/**
 * 저장·공개·철회 생성 훅에 넘기는 공통 옵션.
 * 성공 응답으로 상세를 바꾸고, 목록을 다시 읽게 한다.
 */
export const useTermChangeOptions = (email: string) => {
  const queryClient = useQueryClient();
  return {
    mutation: {
      mutationKey: getTermChangeMutationKey(email),
      onSuccess: (term: ServerTerm) => {
        queryClient.setQueryData([...getGetTermsVersionQueryKey(term.id), email], term);
        void queryClient.invalidateQueries({ predicate: isTermListQuery });
      },
    },
  };
};

/** 초안 삭제 생성 훅에 넘기는 옵션. 성공하면 상세를 지우고 목록을 다시 읽게 한다. */
export const useTermDeleteOptions = (email: string) => {
  const queryClient = useQueryClient();
  return {
    mutation: {
      mutationKey: getTermChangeMutationKey(email),
      onSuccess: (_data: void, variables: { id: number }) => {
        queryClient.removeQueries({ queryKey: [...getGetTermsVersionQueryKey(variables.id), email] });
        void queryClient.invalidateQueries({ predicate: isTermListQuery });
      },
    },
  };
};
