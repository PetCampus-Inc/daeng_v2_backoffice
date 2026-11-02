import { Inject, Injectable } from '@nestjs/common';
import { JavaApiClient } from '../java-api/java-api.client.js';
import {
  boError,
  invalidBodyError,
  javaDate,
  javaDateTime,
  requestData,
  type JavaErrors,
  type JavaPage,
  type JavaTemporal,
} from '../java-api/java-content.js';
import type { TermsKind } from './terms.types.js';

const TERMS = '/api/v0/platform-admin/legal-documents';
const PAGE_SIZE = 100;

type JavaKind = 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY' | 'LOCATION_SERVICE_TERMS';
const TO_JAVA_KIND: Record<TermsKind, JavaKind> = {
  SERVICE_TERMS: 'TERMS_OF_SERVICE',
  PRIVACY_POLICY: 'PRIVACY_POLICY',
  LOCATION_TERMS: 'LOCATION_SERVICE_TERMS',
};
const FROM_JAVA_KIND: Record<JavaKind, TermsKind> = {
  TERMS_OF_SERVICE: 'SERVICE_TERMS',
  PRIVACY_POLICY: 'PRIVACY_POLICY',
  LOCATION_SERVICE_TERMS: 'LOCATION_TERMS',
};

const TERMS_ERRORS: JavaErrors = {
  'PLATFORM-400-1': invalidBodyError,
  'PLATFORM_LEGAL_DOCUMENT-404-1': boError(404, 'TERMS_VERSION_NOT_FOUND'),
  'PLATFORM-409-1': boError(409, 'TERMS_VERSION_CONFLICT'),
  'PLATFORM-409-2': boError(409, 'TERMS_VERSION_CONFLICT'),
  'PLATFORM-409-5': boError(409, 'TERMS_VERSION_NOT_DRAFT'),
  'PLATFORM-409-6': boError(409, 'TERMS_VERSION_NOT_DRAFT'),
  'PLATFORM-409-9': boError(409, 'TERMS_WITHDRAW_NOT_ALLOWED'),
  'PLATFORM-409-11': boError(400, 'TERMS_EFFECTIVE_DATE_NOT_AFTER_LATEST'),
  'PLATFORM-409-14': boError(400, 'TERMS_EFFECTIVE_DATE_IN_PAST'),
  'PLATFORM-409-15': boError(400, 'TERMS_EFFECTIVE_DATE_TOO_SOON'),
  'PLATFORM-409-16': boError(400, 'TERMS_EFFECTIVE_DATE_NOT_AFTER_LATEST'),
};

/** Java 약관 버전. 종류는 BO 값으로, 날짜·시각은 문자열로 정규화돼 있고 상태는 Java 값(`CANCELLED`)이다. */
export interface JavaTerms {
  id: number;
  title: string;
  status: string;
  kind: TermsKind;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
  body: unknown;
  effectiveDate: string | null;
  announcedDate: string | null;
}

type RawTerms = Omit<
  JavaTerms,
  'kind' | 'publishedAt' | 'createdAt' | 'updatedAt' | 'effectiveDate' | 'announcedDate'
> & {
  type: JavaKind;
  publishedAt: JavaTemporal | null;
  createdAt: JavaTemporal;
  updatedAt: JavaTemporal;
  effectiveDate?: JavaTemporal | null;
  announcedDate?: JavaTemporal | null;
};

const normalize = ({ type, ...raw }: RawTerms): JavaTerms => ({
  ...raw,
  kind: FROM_JAVA_KIND[type],
  publishedAt: javaDateTime(raw.publishedAt),
  createdAt: javaDateTime(raw.createdAt)!,
  updatedAt: javaDateTime(raw.updatedAt)!,
  effectiveDate: javaDate(raw.effectiveDate),
  announcedDate: javaDate(raw.announcedDate),
});

/** Java 약관 관리 API의 경로·요청·오류 계약을 감싼다. 서비스는 Java 주소와 오류 코드를 모른다. */
@Injectable()
export class TermsJavaClient {
  constructor(@Inject(JavaApiClient) private readonly java: JavaApiClient) {}

  /** Java는 생성일 역순으로 페이지를 나눠 주므로 한 종류의 모든 버전을 끝까지 읽는다. */
  async allVersions(kind: TermsKind): Promise<JavaTerms[]> {
    const items: JavaTerms[] = [];
    let page = 0;
    let totalPages: number;
    do {
      const result = await requestData<JavaPage<RawTerms>>(
        this.java,
        'GET',
        `${TERMS}/types/${TO_JAVA_KIND[kind]}/versions?page=${page}&size=${PAGE_SIZE}`,
        undefined,
        TERMS_ERRORS
      );
      items.push(...result.items.map(normalize));
      totalPages = result.totalPages;
      page++;
    } while (page < totalPages);
    return items;
  }

  get(id: number): Promise<JavaTerms> {
    return this.item('GET', `${TERMS}/${id}`);
  }

  /** 공개된 버전이 없으면 빈 문자열이다. */
  async draftTemplate(kind: TermsKind): Promise<string> {
    const result = await requestData<{ content: string }>(
      this.java,
      'GET',
      `${TERMS}/types/${TO_JAVA_KIND[kind]}/draft-template`,
      undefined,
      TERMS_ERRORS
    );
    return result.content;
  }

  create(kind: TermsKind, body: { content: string; effectiveDate: string }): Promise<JavaTerms> {
    return this.item('POST', `${TERMS}/types/${TO_JAVA_KIND[kind]}/versions`, {
      body: body.content,
      effectiveDate: body.effectiveDate,
    });
  }

  update(id: number, data: { content?: string; effectiveDate?: string }, rowVersion: number): Promise<JavaTerms> {
    const { content, ...rest } = data;
    return this.item('PATCH', `${TERMS}/${id}`, {
      ...rest,
      ...(content === undefined ? {} : { body: content }),
      rowVersion,
    });
  }

  publish(id: number, rowVersion: number): Promise<JavaTerms> {
    return this.item('PUT', `${TERMS}/${id}/publication`, { rowVersion });
  }

  withdraw(id: number, rowVersion: number): Promise<JavaTerms> {
    return this.item('DELETE', `${TERMS}/${id}/publication?rowVersion=${rowVersion}`);
  }

  async delete(id: number, rowVersion: number): Promise<void> {
    await requestData(this.java, 'DELETE', `${TERMS}/${id}?rowVersion=${rowVersion}`, undefined, TERMS_ERRORS);
  }

  private async item(method: string, path: string, body?: unknown): Promise<JavaTerms> {
    return normalize(await requestData<RawTerms>(this.java, method, path, body, TERMS_ERRORS));
  }
}
