import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDevAccountHeaders } from '@/api/account';
import { apiClient } from '@/api/client';
import type { ApiResponse, PageResponse } from '@/type/api';
import type {
  AssignInquiryInput,
  InquiryAdjacent,
  InquiryAssignee,
  InquiryDetail,
  InquiryListParams,
  InquirySummary,
} from '../../type/inquiry';

/** 문의 목록 한 페이지 크기(PRD 4.4). */
export const INQUIRY_PAGE_SIZE = 20;

/** 목록 조건을 서버 쿼리로 바꾼다. 처음 값은 보내지 않는다. */
const toListQuery = (params: InquiryListParams) => ({
  keyword: params.keyword || undefined,
  status: params.status === 'all' ? undefined : params.status,
  userType: params.userType === 'all' ? undefined : params.userType,
  assignee: params.assignee === 'all' ? undefined : params.assignee,
  sort: params.sort,
});

/** 문의 목록 한 페이지를 조회한다. page는 0부터. */
const getInquiries = async (email: string, params: InquiryListParams, page: number) => {
  const response = await apiClient.get<ApiResponse<PageResponse<InquirySummary>>>('/inquiries', {
    headers: getDevAccountHeaders(email),
    params: { ...toListQuery(params), page, size: INQUIRY_PAGE_SIZE },
  });
  return response.data.data;
};

/** 로그인 계정·조건별 문의 목록 조회 옵션. 조건을 바꾸는 동안 이전 결과를 남겨 깜빡이지 않게 한다. */
export const inquiriesQueryOptions = (email: string, params: InquiryListParams, page: number) =>
  queryOptions({
    queryKey: ['inquiries', email, 'list', params, page],
    queryFn: () => getInquiries(email, params, page),
    placeholderData: (previousData, previousQuery) => (previousQuery?.queryKey[1] === email ? previousData : undefined),
  });

/** 담당자 필터에 쓰는 팀원 목록(표시명이 있는 활성·비활성 팀원)을 조회한다. */
const getInquiryAssignees = async (email: string) => {
  const response = await apiClient.get<ApiResponse<InquiryAssignee[]>>('/inquiries/assignees', {
    headers: getDevAccountHeaders(email),
  });
  return response.data.data;
};

/** 담당자 필터 선택지 조회 옵션. */
export const inquiryAssigneesQueryOptions = (email: string) =>
  queryOptions({ queryKey: ['inquiries', email, 'assignees'], queryFn: () => getInquiryAssignees(email) });

/** 문의 상세를 조회한다. */
const getInquiry = async (email: string, id: number) => {
  const response = await apiClient.get<ApiResponse<InquiryDetail>>(`/inquiries/${id}`, {
    headers: getDevAccountHeaders(email),
  });
  return response.data.data;
};

/** 문의 상세 조회 옵션. */
export const inquiryQueryOptions = (email: string, id: number) =>
  queryOptions({ queryKey: ['inquiries', email, 'detail', id], queryFn: () => getInquiry(email, id), retry: false });

/** 목록 조건 기준 앞뒤 문의 번호를 조회한다. */
const getInquiryAdjacent = async (email: string, id: number, params: InquiryListParams) => {
  const response = await apiClient.get<ApiResponse<InquiryAdjacent>>(`/inquiries/${id}/adjacent`, {
    headers: getDevAccountHeaders(email),
    params: toListQuery(params),
  });
  return response.data.data;
};

/** 이전·다음 문의 조회 옵션. */
export const inquiryAdjacentQueryOptions = (email: string, id: number, params: InquiryListParams) =>
  queryOptions({
    queryKey: ['inquiries', email, 'adjacent', id, params],
    queryFn: () => getInquiryAdjacent(email, id, params),
  });

/** 화면에서 본 담당자를 함께 보내 문의를 맡는다. */
const postInquiryAssignee = async (email: string, input: AssignInquiryInput) => {
  const response = await apiClient.post<ApiResponse<InquiryDetail>>(
    `/inquiries/${input.id}/assignee`,
    { expectedAssigneeEmail: input.expectedAssigneeEmail },
    { headers: getDevAccountHeaders(email) }
  );
  return response.data.data;
};

/** 내 담당을 해제한다. */
const deleteInquiryAssignee = async (email: string, id: number) => {
  const response = await apiClient.delete<ApiResponse<InquiryDetail>>(`/inquiries/${id}/assignee`, {
    headers: getDevAccountHeaders(email),
  });
  return response.data.data;
};

/** 담당 해제를 실행 취소한다. 그 사이 다른 사람이 맡았으면 서버가 거부한다. */
const postInquiryAssigneeRestore = async (email: string, id: number) => {
  const response = await apiClient.post<ApiResponse<InquiryDetail>>(`/inquiries/${id}/assignee/restore`, null, {
    headers: getDevAccountHeaders(email),
  });
  return response.data.data;
};

/** 답변을 저장한다. */
const postInquiryReply = async (email: string, id: number, body: string) => {
  const response = await apiClient.post<ApiResponse<InquiryDetail>>(
    `/inquiries/${id}/replies`,
    { body },
    { headers: getDevAccountHeaders(email) }
  );
  return response.data.data;
};

/** 변경 성공 응답으로 상세를 바꾸고 목록·앞뒤 문의를 다시 읽게 한다. */
const useApplyInquiryChange = (email: string) => {
  const queryClient = useQueryClient();
  return (inquiry: InquiryDetail) => {
    queryClient.setQueryData(inquiryQueryOptions(email, inquiry.id).queryKey, inquiry);
    void queryClient.invalidateQueries({ queryKey: ['inquiries', email, 'list'] });
    void queryClient.invalidateQueries({ queryKey: ['inquiries', email, 'adjacent'] });
  };
};

/** 문의를 맡는다(미배정 맡기·담당자 변경). */
export const useAssignInquiry = (email: string) => {
  const applyInquiryChange = useApplyInquiryChange(email);
  return useMutation({
    mutationFn: (input: AssignInquiryInput) => postInquiryAssignee(email, input),
    onSuccess: applyInquiryChange,
  });
};

/** 내 담당을 해제한다. */
export const useReleaseInquiry = (email: string) => {
  const applyInquiryChange = useApplyInquiryChange(email);
  return useMutation({
    mutationFn: (id: number) => deleteInquiryAssignee(email, id),
    onSuccess: applyInquiryChange,
  });
};

/** 담당 해제를 실행 취소한다. */
export const useRestoreInquiryAssignee = (email: string) => {
  const applyInquiryChange = useApplyInquiryChange(email);
  return useMutation({
    mutationFn: (id: number) => postInquiryAssigneeRestore(email, id),
    onSuccess: applyInquiryChange,
  });
};

/** 답변을 저장한다. */
export const useReplyInquiry = (email: string) => {
  const applyInquiryChange = useApplyInquiryChange(email);
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => postInquiryReply(email, id, body),
    onSuccess: applyInquiryChange,
  });
};
