import { Inject, Injectable } from '@nestjs/common';
import { JavaApiClient } from '../java-api/java-api.client.js';
import type { ContentBody } from '../java-api/content-body.js';
import {
  boError,
  invalidBodyError,
  javaDateTime,
  requestData,
  type JavaErrors,
  type JavaPage,
  type JavaTemporal,
} from '../java-api/java-content.js';

const NOTICE = '/api/v0/platform-admin/notices';

const NOTICE_ERRORS: JavaErrors = {
  'PLATFORM-400-1': invalidBodyError,
  'PLATFORM-400-2': invalidBodyError,
  'PLATFORM_NOTICE-404-1': boError(404, 'NOTICE_NOT_FOUND'),
  'PLATFORM-409-1': boError(409, 'NOTICE_VERSION_CONFLICT'),
  'PLATFORM-409-2': boError(409, 'NOTICE_VERSION_CONFLICT'),
  'PLATFORM-409-3': boError(409, 'NOTICE_ALREADY_PUBLISHED'),
  'PLATFORM-409-4': boError(409, 'NOTICE_NOT_PUBLISHED'),
  'PLATFORM-409-13': boError(409, 'NOTICE_NOT_DRAFT'),
  'PLATFORM-400-3': boError(400, 'NOTICE_CONTENT_REQUIRED'),
};

/** Java 공지 목록 항목. 상태는 Java 값(`HIDDEN`)이다. */
export interface JavaNoticeSummary {
  id: number;
  title: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

export interface JavaNotice extends JavaNoticeSummary {
  /** 다시 저장할 원본(이미지는 `imageId`) */
  body: ContentBody;
  /** 표시용(이미지에 임시 URL) */
  previewBody: ContentBody;
}

type RawNoticeSummary = Omit<JavaNoticeSummary, 'publishedAt' | 'createdAt' | 'updatedAt'> & {
  publishedAt: JavaTemporal | null;
  createdAt: JavaTemporal;
  updatedAt: JavaTemporal;
};
type RawNotice = RawNoticeSummary & Pick<JavaNotice, 'body' | 'previewBody'>;

const normalizeSummary = (raw: RawNoticeSummary): JavaNoticeSummary => ({
  ...raw,
  publishedAt: javaDateTime(raw.publishedAt),
  createdAt: javaDateTime(raw.createdAt)!,
  updatedAt: javaDateTime(raw.updatedAt)!,
});

const normalize = (raw: RawNotice): JavaNotice => ({
  ...normalizeSummary(raw),
  body: raw.body,
  previewBody: raw.previewBody,
});

export interface NoticeListQuery {
  /** 1부터 시작 */
  page: number;
  size: number;
  keyword?: string;
  /** `UNPUBLISHED`는 Java `HIDDEN`으로 바꿔 보낸다. */
  status?: string;
}

/** Java 공지 관리 API 호출과 오류 변환 */
@Injectable()
export class NoticeJavaClient {
  constructor(@Inject(JavaApiClient) private readonly java: JavaApiClient) {}

  async list(query: NoticeListQuery): Promise<JavaPage<JavaNoticeSummary>> {
    const params = new URLSearchParams({ page: String(query.page - 1), size: String(query.size) });
    if (query.keyword) params.set('query', query.keyword);
    if (query.status) params.set('status', query.status === 'UNPUBLISHED' ? 'HIDDEN' : query.status);
    const page = await requestData<JavaPage<RawNoticeSummary>>(
      this.java,
      'GET',
      `${NOTICE}?${params}`,
      undefined,
      NOTICE_ERRORS
    );
    return { ...page, items: page.items.map(normalizeSummary) };
  }

  get(id: number): Promise<JavaNotice> {
    return this.item('GET', `${NOTICE}/${id}`);
  }

  create(body: unknown): Promise<JavaNotice> {
    return this.item('POST', NOTICE, body);
  }

  update(id: number, data: object, rowVersion: number): Promise<JavaNotice> {
    return this.item('PATCH', `${NOTICE}/${id}`, { ...data, rowVersion });
  }

  publish(id: number, rowVersion: number): Promise<JavaNotice> {
    return this.item('PUT', `${NOTICE}/${id}/publication`, { rowVersion });
  }

  unpublish(id: number, rowVersion: number): Promise<JavaNotice> {
    return this.item('DELETE', `${NOTICE}/${id}/publication?rowVersion=${rowVersion}`);
  }

  async delete(id: number, rowVersion: number): Promise<void> {
    await requestData(this.java, 'DELETE', `${NOTICE}/${id}?rowVersion=${rowVersion}`, undefined, NOTICE_ERRORS);
  }

  uploadUrls(body: { noticeId?: number; files: { fileName: string; contentType: string; size: number }[] }) {
    return requestData(
      this.java,
      'POST',
      `${NOTICE}/images/upload-urls`,
      { ...body, files: body.files.map(({ fileName, ...file }) => ({ filename: fileName, ...file })) },
      { ...NOTICE_ERRORS, 'PLATFORM-400-2': boError(400, 'NOTICE_IMAGE_INVALID') }
    );
  }

  private async item(method: string, path: string, body?: unknown): Promise<JavaNotice> {
    return normalize(await requestData<RawNotice>(this.java, method, path, body, NOTICE_ERRORS));
  }
}
