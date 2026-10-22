import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ApiResponse } from '@/type/api';
import type { Overview } from '../type/overview';
import { fillSignupTrend } from '../util/signup-trend';

/** 홈 지표·가입 추이·최근 원장 인증을 한 번에 조회한다. 가입 추이는 받은 시각 기준 30일로 채워 둔다. */
const getOverview = async (): Promise<Overview> => {
  const response = await apiClient.get<ApiResponse<Overview>>('/overview');
  const overview = response.data.data;
  return { ...overview, signupTrend: fillSignupTrend(overview?.signupTrend, new Date()) };
};

/** 홈 데이터 조회 옵션. 홈은 이 요청 하나만 보내고, 실패하면 홈 전체가 실패로 보인다(S-홈-012·013). */
export const overviewQueryOptions = () =>
  queryOptions({
    queryKey: ['overview'],
    queryFn: getOverview,
  });
