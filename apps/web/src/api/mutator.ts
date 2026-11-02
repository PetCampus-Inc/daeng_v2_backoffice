import type { AxiosError, AxiosRequestConfig } from 'axios';

import { apiClient } from '@/api/client';

/**
 * orval이 만든 요청 함수가 쓰는 전송 함수. 공용 axios 인스턴스(`apiClient`)로 보내서
 * 서버 주소와 401 처리(세션 종료)가 기존 요청과 같게 적용된다. 응답은 `data`만 돌려준다.
 */
export const customInstance = <TData>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<TData> =>
  apiClient<TData>({ ...config, ...options }).then(({ data }) => data);

/** 생성된 훅의 오류 타입. */
export type ErrorType<TError> = AxiosError<TError>;

/** 생성된 훅의 요청 본문 타입. */
export type BodyType<TBody> = TBody;
