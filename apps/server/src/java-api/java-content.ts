import { ApiException, ValidationFailedException } from '../common/api-error.js';
import { JavaApiClient } from './java-api.client.js';

/** 배열(`[2026,10,17,1,29]`) 또는 문자열. */
export type JavaTemporal = string | number[];

export interface JavaPage<T> {
  items: T[];
  /** 0부터 시작 */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type JavaErrors = Record<string, () => ApiException>;

const pad = (value: number | undefined, width = 2) => String(value ?? 0).padStart(width, '0');

export const javaDate = (value: JavaTemporal | null | undefined): string | null =>
  value == null ? null : Array.isArray(value) ? `${value[0]}-${pad(value[1])}-${pad(value[2])}` : value;

/** `kstToIso`가 읽는 `YYYY-MM-DD HH:mm:ss.nnnnnnnnn`. 배열에서 빠진 초·나노초는 0으로 채운다. */
export const javaDateTime = (value: JavaTemporal | null | undefined): string | null =>
  value == null
    ? null
    : Array.isArray(value)
      ? `${javaDate(value)} ${pad(value[3])}:${pad(value[4])}:${pad(value[5])}.${pad(value[6], 9)}`
      : value;

export const boError = (status: number, code: string) => () =>
  new ApiException(status, code, '요청을 처리할 수 없습니다.');

export const invalidBodyError = () =>
  new ValidationFailedException([{ field: 'body', reason: '본문 형식 또는 이미지 참조가 올바르지 않습니다.' }]);

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
