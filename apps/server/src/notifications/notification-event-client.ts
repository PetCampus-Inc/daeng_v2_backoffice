import { Inject, Injectable } from '@nestjs/common';
import { JavaApiClient } from '../java-api/java-api.client.js';
import { eventPageSchema } from './notification-events.js';

const PATH = '/api/v0/platform-admin/bo-notification-events';
const PAGE_SIZE = 50;

/** Java 알림 이벤트 API(조회·완료)의 경로와 요청 형식을 감싼다. 전송과 오류 처리는 `JavaApiClient`가 한다. */
@Injectable()
export class NotificationEventClient {
  constructor(@Inject(JavaApiClient) private readonly java: JavaApiClient) {}

  async list(afterId?: string) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), ...(afterId ? { afterId } : {}) });
    return eventPageSchema.parse(await this.java.requestJava('GET', `${PATH}?${params}`)).data;
  }

  /** 처리한 이벤트를 Java에 알린다. Java의 이벤트 ID는 숫자라 숫자 배열로 보낸다. */
  async complete(eventId: string) {
    await this.java.requestJava('POST', `${PATH}/complete`, { eventIds: [Number(eventId)] });
  }
}
