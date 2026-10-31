import { Inject, Injectable } from '@nestjs/common';
import { JAVA_API_CONFIG, type JavaApiConfig } from '../java-api/java-api.client.js';
import { eventPageSchema } from './notification-events.js';
const PATH = '/api/v0/platform-admin/bo-notification-events';
@Injectable()
export class NotificationEventClient {
  constructor(@Inject(JAVA_API_CONFIG) private readonly config: JavaApiConfig) {}
  private async request(path: string, init: RequestInit) {
    const result = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        'X-Backoffice-Api-Key': this.config.apiKey,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!result.ok) throw new Error(`Java notification event API failed: ${result.status}`);
    return result;
  }
  async list(afterId?: string) {
    const params = new URLSearchParams({ limit: '50', ...(afterId ? { afterId } : {}) });
    const response = await this.request(`${PATH}?${params}`, { method: 'GET' });
    return eventPageSchema.parse(await response.json()).data;
  }
  async complete(eventId: string) {
    const response = await this.request(`${PATH}/complete`, {
      method: 'POST',
      // Java는 숫자 배열을 받는다.
      body: JSON.stringify({ eventIds: [Number(eventId)] }),
    });
    if (response.status !== 204) throw new Error(`Java notification event completion returned ${response.status}`);
  }
}
