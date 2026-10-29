import { Inject, Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';

export const JAVA_API_CONFIG = Symbol('JAVA_API_CONFIG');

export interface JavaApiConfig {
  baseUrl: string;
  apiKey: string;
}

const API_KEY_HEADER = 'X-Backoffice-Api-Key';
const TIMEOUT_MS = 10_000;

/**
 * 쓰기가 끝난 뒤 BO가 Java 응답에서 쓰는 값. 화면용 상세는 서비스 DB에서 다시 읽으므로 나머지 필드는 읽지 않는다.
 * 쓰기는 이미 반영된 뒤라 응답 모양이 달라졌다는 이유로 실패로 바꾸지 않는다.
 */
export interface InquiryOperation {
  /** 이 요청을 처리하기 직전의 담당자 팀원 ID. Java가 행 잠금 안에서 읽은 값이다. 없으면 null. */
  previousAssigneeId: number | null;
}

/** Java가 돌려주는 오류 코드를 명세의 BO 오류로 옮긴다. 그 밖의 오류는 예상하지 못한 실패로 던진다. */
const KNOWN_ERRORS: Record<string, () => ApiException> = {
  'INQUIRY-404-1': () => new ApiException(404, 'INQUIRY_NOT_FOUND', '문의를 찾을 수 없습니다.'),
  'INQUIRY-409-1': () => new ApiException(409, 'INQUIRY_RESOLVED', '해결 완료된 문의라 변경할 수 없습니다.'),
  'INQUIRY-409-2': () =>
    new ApiException(409, 'INQUIRY_ASSIGNEE_CHANGED', '담당자가 바뀌었습니다. 최신 내용을 확인해 주세요.'),
};

@Injectable()
export class JavaApiClient {
  constructor(@Inject(JAVA_API_CONFIG) private readonly config: JavaApiConfig) {}

  assign(inquiryId: number, memberId: number, expectedAssigneeId: number | null): Promise<InquiryOperation> {
    return this.request('POST', `/${inquiryId}/assignee`, { memberId, expectedAssigneeId });
  }

  release(inquiryId: number, memberId: number): Promise<InquiryOperation> {
    return this.request('DELETE', `/${inquiryId}/assignee?memberId=${memberId}`);
  }

  restore(inquiryId: number, memberId: number): Promise<InquiryOperation> {
    return this.request('POST', `/${inquiryId}/assignee/restore`, { memberId });
  }

  reply(inquiryId: number, memberId: number, body: string): Promise<InquiryOperation> {
    return this.request('POST', `/${inquiryId}/replies`, { memberId, body });
  }

  private async request(method: string, path: string, body?: unknown): Promise<InquiryOperation> {
    const response = await fetch(`${this.config.baseUrl}/api/v0/platform-admin/inquiries${path}`, {
      method,
      headers: {
        [API_KEY_HEADER]: this.config.apiKey,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const code = (payload as { code?: unknown } | undefined)?.code;
      const known = typeof code === 'string' ? KNOWN_ERRORS[code] : undefined;
      if (known) throw known();
      // 응답 본문(Java 내부 메시지)은 오류에 싣지 않는다.
      throw new Error(`Java inquiry API failed: ${method} ${path.split('?')[0]} -> ${response.status} ${String(code)}`);
    }
    const previous = (payload as { data?: { previousAssigneeId?: unknown } } | undefined)?.data?.previousAssigneeId;
    return { previousAssigneeId: typeof previous === 'number' ? previous : null };
  }
}
