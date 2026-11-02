/**
 * 서버 응답 모양. 기존 앱 API(`/api/v0/...`) OpenAPI 문서를 따른다.
 * 가짜 API(`src/api/mocks/`)도 이 타입으로 응답을 만든다.
 */

/** 성공 응답. 실제 값은 `data`에 들어 있다. */
export type ApiResponse<TData> = {
  data: TData;
  status: number;
  /** 어떤 값이 오는지 문서에 없다. 서버 확인 필요. */
  code: string;
  /** 어떤 값이 오는지 문서에 없다. 서버 확인 필요. */
  message: string;
  /** ISO 날짜·시간 문자열. 오프셋(`Z`/`+09:00`/없음)은 서버 확인 필요. */
  responseTime: string;
};

/** 관리자 목록(페이지 번호 방식)의 `data`. `page`는 0부터 센다. */
export type PageResponse<TItem> = {
  items: TItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};

/** 오류 응답. 성공 응답과 달리 `data`·`responseTime`이 없고 `errorMessage`가 있다. */
export type ApiError = {
  status: number;
  /** 값 목록(예: 어떤 이름의 오류 코드가 있는지)은 문서에 없다. 서버 확인 필요. */
  code: string;
  message: string;
  errorMessage: string;
};
