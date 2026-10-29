import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiException } from '../../src/common/api-error.js';
import { JavaApiClient } from '../../src/java-api/java-api.client.js';

const client = new JavaApiClient({ baseUrl: 'http://java.test', apiKey: 'k' });

const respond = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(typeof body === 'string' ? body : JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        })
    )
  );

afterEach(() => vi.unstubAllGlobals());

describe('JavaApiClient success responses', () => {
  test('returns the assignee before the request when Java sends it', async () => {
    respond(200, { data: { id: 7, status: 'CHECKING', assigneeMemberId: 2, previousAssigneeId: 5 } });

    expect(await client.assign(7, 2, 5)).toEqual({ previousAssigneeId: 5 });
  });

  test('treats a missing or null previous assignee as nobody', async () => {
    respond(200, { data: { id: 7, assigneeMemberId: 2 } });
    expect(await client.assign(7, 2, null)).toEqual({ previousAssigneeId: null });

    respond(200, { data: { id: 7, previousAssigneeId: null } });
    expect(await client.release(7, 2)).toEqual({ previousAssigneeId: null });
  });

  // 쓰기가 이미 끝난 뒤라 응답 모양이 달라졌다는 이유로 실패로 바꾸면 안 된다(BO는 화면용 값을 다시 읽는다).
  test.each([
    ['an unknown status value', { data: { id: 7, status: 'SOMETHING_NEW', assigneeMemberId: 2 } }],
    ['extra fields', { data: { id: 7, extra: { nested: true } }, other: 1 }],
    ['no data at all', { status: 200 }],
    ['a body that is not JSON', 'ok'],
    ['an empty body', ''],
  ])('does not fail a 2xx response with %s', async (_name, body) => {
    respond(200, body);

    expect(await client.reply(7, 2, '답변')).toEqual({ previousAssigneeId: null });
  });
});

describe('JavaApiClient failures', () => {
  test.each([
    ['INQUIRY-404-1', 404, 'INQUIRY_NOT_FOUND'],
    ['INQUIRY-409-1', 409, 'INQUIRY_RESOLVED'],
    ['INQUIRY-409-2', 409, 'INQUIRY_ASSIGNEE_CHANGED'],
  ])('maps Java error %s to the BO error', async (javaCode, status, boCode) => {
    respond(status, { status, code: javaCode, message: '내부 메시지' });

    const error = await client.assign(7, 2, null).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(status);
    expect((error as ApiException).getResponse()).toMatchObject({ code: boCode });
  });

  test('anything else, including a rejected key, becomes a plain error without the Java message', async () => {
    respond(401, { status: 401, code: 'BACKOFFICE-401-1', message: '내부 비밀 메시지' });

    const error = await client.assign(7, 2, null).catch((caught: unknown) => caught);

    expect(error).not.toBeInstanceOf(ApiException);
    expect((error as Error).message).toContain('401');
    expect((error as Error).message).not.toContain('내부 비밀 메시지');
  });

  test('a network failure is thrown as it is', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      })
    );

    await expect(client.release(7, 2)).rejects.toThrow('fetch failed');
  });
});
