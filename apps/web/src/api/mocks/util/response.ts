import { HttpResponse } from 'msw/http';

import type { ApiError, ApiResponse, PageResponse } from '@/type/api';

/** 가짜 API 기본 주소. 실제 관리자 API와 같다. */
export const MOCK_API_BASE = '/api/v0/platform-admin';

/** 성공 응답의 `code`. 실제 값이 문서에 없어 비워 둔다. 서버 확인 필요. */
const SUCCESS_CODE = '';
/** 성공 응답의 `message`. 실제 값이 문서에 없어 비워 둔다. 서버 확인 필요. */
const SUCCESS_MESSAGE = '';

/** 주소 접두어를 붙인 가짜 API 주소. 예: `mockUrl('/notices')` */
export function mockUrl(path: string) {
  return `${MOCK_API_BASE}${path}`;
}

/** 데이터를 성공 응답(`{ data, status, code, message, responseTime }`)으로 감싼다. */
export function okResponse<TData>(data: TData, status = 200) {
  const body: ApiResponse<TData> = {
    data,
    status,
    code: SUCCESS_CODE,
    message: SUCCESS_MESSAGE,
    // 오프셋 표기(`Z`/`+09:00`/없음)는 서버 확인 필요. 지금은 UTC(`Z`)로 둔다.
    responseTime: new Date().toISOString(),
  };
  return HttpResponse.json(body, { status });
}

/** 전체 목록에서 `page`(0부터)·`size`만큼 잘라 관리자 목록 성공 응답으로 감싼다. */
export function pageResponse<TItem>(allItems: TItem[], page: number, size: number) {
  const totalElements = allItems.length;
  // 문서상 size는 1~100이다. 0 이하가 들어와도 나눗셈이 Infinity가 되지 않게 막는다.
  const totalPages = size > 0 ? Math.ceil(totalElements / size) : 0;
  const data: PageResponse<TItem> = {
    items: allItems.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements,
    totalPages,
    hasNext: page + 1 < totalPages,
  };
  return okResponse(data);
}

/** 오류 응답(`{ status, code, message, errorMessage }`)을 같은 HTTP 상태 코드로 만든다. */
export function errorResponse(status: number, error: Omit<ApiError, 'status'>) {
  const body: ApiError = { status, ...error };
  return HttpResponse.json(body, { status });
}
