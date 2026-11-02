import { ApiException, ValidationFailedException } from '../common/api-error.js';
import { JavaApiClient } from './java-api.client.js';

/** Java가 직렬화한 날짜·시각. `[2026,10,17]`·`[2026,10,17,1,29,48,365885000]` 배열이거나 문자열이다. */
export type JavaTemporal = string | number[];

export interface JavaPage<T> {
  items: T[];
  /** 0부터 시작한다. */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type JavaErrors = Record<string, () => ApiException>;

const pad = (value: number | undefined, width = 2) => String(value ?? 0).padStart(width, '0');

/** `YYYY-MM-DD`. */
export const javaDate = (value: JavaTemporal | null | undefined): string | null =>
  value == null ? null : Array.isArray(value) ? `${value[0]}-${pad(value[1])}-${pad(value[2])}` : value;

/** `kstToIso`가 읽는 `YYYY-MM-DD HH:mm:ss.nnnnnnnnn`. 배열에서 0인 초·나노초는 빠져 있을 수 있다. */
export const javaDateTime = (value: JavaTemporal | null | undefined): string | null =>
  value == null
    ? null
    : Array.isArray(value)
      ? `${javaDate(value)} ${pad(value[3])}:${pad(value[4])}:${pad(value[5])}.${pad(value[6], 9)}`
      : value;

/** Java 오류 코드에 대응하는 BO 오류. 메시지는 Java 내용을 싣지 않고 고정 문구를 쓴다. */
export const boError = (status: number, code: string) => () =>
  new ApiException(status, code, '요청을 처리할 수 없습니다.');

/** Java가 본문(마크다운 또는 이미지 참조)을 거부한 경우의 입력 검증 오류. */
export const invalidBodyError = () =>
  new ValidationFailedException([{ field: 'body', reason: '본문 또는 이미지 참조가 올바르지 않습니다.' }]);

/** Java 응답의 `data`를 꺼낸다. */
export async function requestData<T>(
  java: JavaApiClient,
  method: string,
  path: string,
  body?: unknown,
  errors: JavaErrors = {}
): Promise<T> {
  const result = (await java.requestJava(method, path, body, errors)) as { data?: T } | undefined;
  return result?.data as T;
}

/** BO 명세는 본문이 마크다운 문자열이다. 이전하지 않은 기존 JSON 본문은 변환하지 않고 막는다. */
export function requireMarkdownBody(label: 'Notice' | 'Terms', id: number, body: unknown): string {
  if (typeof body !== 'string') throw new Error(`${label} ${id} has legacy JSON body; migration required`);
  return body;
}
