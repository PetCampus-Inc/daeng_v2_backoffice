import { Inject, Injectable } from '@nestjs/common';
import { JavaApiClient } from '../java-api/java-api.client.js';
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

/** Java 공지. 시각은 KST 문자열로 정규화돼 있고 상태는 Java 값(`HIDDEN`)이다. */
export interface JavaNotice {
  id: number;
  title: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
  body: unknown;
  images?: { imageId: number; previewUrl: string | null }[];
}

type RawNotice = Omit<JavaNotice, 'publishedAt' | 'createdAt' | 'updatedAt'> & {
  publishedAt: JavaTemporal | null;
  createdAt: JavaTemporal;
  updatedAt: JavaTemporal;
};

const normalize = (raw: RawNotice): JavaNotice => ({
  ...raw,
  publishedAt: javaDateTime(raw.publishedAt),
  createdAt: javaDateTime(raw.createdAt)!,
  updatedAt: javaDateTime(raw.updatedAt)!,
});

export interface NoticeListQuery {
  /** BO의 1부터 시작하는 페이지 번호. */
  page: number;
  size: number;
  keyword?: string;
  /** BO 상태 값. `UNPUBLISHED`는 Java의 `HIDDEN`으로 바꿔 보낸다. */
  status?: string;
}

/** Java 공지 관리 API의 경로·요청·오류 계약을 감싼다. 서비스는 Java 주소와 오류 코드를 모른다. */
@Injectable()
export class NoticeJavaClient {
  constructor(@Inject(JavaApiClient) private readonly java: JavaApiClient) {}

  async list(query: NoticeListQuery): Promise<JavaPage<JavaNotice>> {
    const params = new URLSearchParams({ page: String(query.page - 1), size: String(query.size) });
    if (query.keyword) params.set('query', query.keyword);
    if (query.status) params.set('status', query.status === 'UNPUBLISHED' ? 'HIDDEN' : query.status);
    const page = await requestData<JavaPage<RawNotice>>(
      this.java,
      'GET',
      `${NOTICE}?${params}`,
      undefined,
      NOTICE_ERRORS
    );
    return { ...page, items: page.items.map(normalize) };
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
