import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDevAccountHeaders } from '@/api/account';
import { apiClient } from '@/api/client';
import type { ApiResponse } from '@/type/api';
import type { Term, TermKind, TermInput, TermAction } from '../../type/term';
import { compareTerms } from '../../util/term-policy';
export const termsQueryOptions = (email: string, kind: TermKind) =>
  queryOptions({
    queryKey: ['terms', email, 'list', kind],
    retry: false,
    queryFn: async ({ signal }) =>
      (await apiClient.get<ApiResponse<Term[]>>(`/terms/${kind}`, { signal, headers: getDevAccountHeaders(email) }))
        .data.data,
  });
export const termQueryOptions = (email: string, kind: TermKind, version: number) =>
  queryOptions({
    queryKey: ['terms', email, 'detail', kind, version],
    retry: false,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiResponse<Term>>(`/terms/${kind}/${version}`, {
          signal,
          headers: getDevAccountHeaders(email),
        })
      ).data.data,
  });
export type TermMutationInput = {
  kind: TermKind;
  version?: number;
  revision?: number;
  action: TermAction;
  input?: TermInput;
};
async function postTerm(email: string, { kind, action, input }: TermMutationInput) {
  return (
    await apiClient.post<ApiResponse<Term>>(
      `/terms/${kind}`,
      { ...input, action },
      { headers: getDevAccountHeaders(email) }
    )
  ).data.data;
}
async function patchTerm(email: string, { kind, version, revision, action, input }: TermMutationInput) {
  return (
    await apiClient.patch<ApiResponse<Term>>(
      `/terms/${kind}/${version}`,
      { ...input, action, revision },
      { headers: getDevAccountHeaders(email) }
    )
  ).data.data;
}
async function deleteTerm(email: string, { kind, version, revision }: TermMutationInput) {
  await apiClient.delete(`/terms/${kind}/${version}`, { headers: getDevAccountHeaders(email), data: { revision } });
  return null;
}
function changeTerm(email: string, input: TermMutationInput) {
  if (input.action === 'delete') return deleteTerm(email, input);
  return input.version === undefined ? postTerm(email, input) : patchTerm(email, input);
}
export function useChangeTerm(email: string) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['terms', email, 'change'],
    mutationFn: (input: TermMutationInput) => changeTerm(email, input),
    onSuccess: (term, variables) => {
      if (term) client.setQueryData(termQueryOptions(email, term.kind, term.version).queryKey, term);
      else client.removeQueries({ queryKey: termQueryOptions(email, variables.kind, variables.version!).queryKey });
      client.setQueryData(termsQueryOptions(email, variables.kind).queryKey, (previous) => {
        if (!previous) return previous;
        const remaining = previous.filter((item) => item.version !== (term?.version ?? variables.version));
        return (term ? [...remaining, term] : remaining).sort(compareTerms);
      });
      void client.invalidateQueries({ queryKey: ['terms', email, 'list'] });
    },
  });
}
