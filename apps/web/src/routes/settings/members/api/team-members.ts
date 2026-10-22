import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ApiResponse } from '@/type/api';
import type { RegisterMemberInput, TeamMember, UpdateMemberInput } from '../type/team-member';

/** 개발용 가짜 서버에만 현재 계정을 전달한다. */
const getMemberHeaders = (email: string) => (import.meta.env.DEV ? { 'X-Dev-Email': email } : undefined);

/** 팀원 전체 목록을 조회한다. */
const getTeamMembers = async (email: string) => {
  const response = await apiClient.get<ApiResponse<TeamMember[]>>('/team-members', {
    headers: getMemberHeaders(email),
  });
  return response.data.data;
};

/** 로그인 계정별 팀원 목록 조회 옵션. */
export const teamMembersQueryOptions = (email: string) =>
  queryOptions({
    queryKey: ['team-members', email],
    queryFn: () => getTeamMembers(email),
  });

/** 이메일과 역할로 팀원을 등록한다. */
const postTeamMember = async (email: string, input: RegisterMemberInput) => {
  const response = await apiClient.post<ApiResponse<TeamMember>>('/team-members', input, {
    headers: getMemberHeaders(email),
  });
  return response.data.data;
};

/** 역할 또는 계정 상태를 변경한다. */
const patchTeamMember = async (email: string, input: UpdateMemberInput) => {
  const response = await apiClient.patch<ApiResponse<TeamMember>>(
    `/team-members/${encodeURIComponent(input.email)}`,
    input,
    { headers: getMemberHeaders(email) }
  );
  return response.data.data;
};

/** 등록 성공 뒤 팀원 목록을 새로 읽는다. */
export const useRegisterTeamMember = (email: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterMemberInput) => postTeamMember(email, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamMembersQueryOptions(email).queryKey }),
  });
};

/** 변경 성공 뒤 팀원 목록을 새로 읽는다. */
export const useUpdateTeamMember = (email: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMemberInput) => patchTeamMember(email, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamMembersQueryOptions(email).queryKey }),
  });
};
