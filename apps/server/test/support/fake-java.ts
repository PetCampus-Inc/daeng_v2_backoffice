import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { ServiceFixture } from './service-fixture.js';

export const FAKE_JAVA_KEY = 'fake-java-key';

export interface JavaCall {
  method: string;
  path: string;
  key: string | undefined;
  body: unknown;
}

export interface FakeJava {
  baseUrl: string;
  calls: JavaCall[];
  /** 다음 요청 하나를 이 상태 코드로 실패시킨다(서버 오류 상황 시험용). */
  failNextWith(status: number): void;
  close(): Promise<void>;
}

const ROUTE = /^\/api\/v0\/platform-admin\/inquiries\/(\d+)\/(assignee|assignee\/restore|replies)$/;

const ERRORS = {
  notFound: { status: 404, code: 'INQUIRY-404-1', message: '문의를 찾을 수 없어요.' },
  resolved: { status: 409, code: 'INQUIRY-409-1', message: '이미 해결된 문의예요.' },
  assigneeChanged: { status: 409, code: 'INQUIRY-409-2', message: '담당자가 변경되었습니다.' },
} as const;

/**
 * Java 문의 운영 API(`/api/v0/platform-admin/inquiries`)의 계약을 흉내 내는 가짜 서버.
 * 요청·응답 모양(헤더 키, 경로, 본문, `{ data }` 래퍼, 오류 코드)은 Java 구현과 맞추고, 규칙은 시험 DB 행에 직접 적용한다.
 */
export async function startFakeJava(fixture: ServiceFixture): Promise<FakeJava> {
  const calls: JavaCall[] = [];
  let forcedFailure: number | undefined;

  const send = (response: ServerResponse, status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', 'http://fake-java');
    const raw = await new Promise<string>((resolve) => {
      let text = '';
      request.on('data', (chunk) => (text += chunk));
      request.on('end', () => resolve(text));
    });
    const body: unknown = raw === '' ? undefined : JSON.parse(raw);
    const key = request.headers['x-backoffice-api-key'] as string | undefined;
    calls.push({ method: request.method ?? '', path: `${url.pathname}${url.search}`, key, body });

    if (key !== FAKE_JAVA_KEY) {
      return send(response, 401, {
        status: 401,
        code: 'BACKOFFICE-401-1',
        message: '백오피스 서버 인증에 실패했습니다.',
      });
    }
    if (forcedFailure !== undefined) {
      const status = forcedFailure;
      forcedFailure = undefined;
      return send(response, status, { status, code: 'COMMON-500-1', message: '일시적인 서버 오류 입니다' });
    }
    const match = ROUTE.exec(url.pathname);
    if (!match) return send(response, 404, { status: 404, code: 'COMMON-404-1', message: '해당 정보가 없습니다.' });

    const id = Number(match[1]);
    const action = match[2];
    const input = (body ?? {}) as { memberId?: number; expectedAssigneeId?: number | null; body?: string };
    const memberId = Number(input.memberId ?? url.searchParams.get('memberId'));

    const [rows] = await fixture.pool.query<RowDataPacket[]>('SELECT * FROM inquiry WHERE id = ?', [id]);
    const row = rows[0];
    const fail = (error: (typeof ERRORS)[keyof typeof ERRORS]) => send(response, error.status, error);
    if (!row) return fail(ERRORS.notFound);
    if (row.status === 'RESOLVED') return fail(ERRORS.resolved);

    const current: number | null = row.assignee_member_id === null ? null : Number(row.assignee_member_id);
    if (action === 'assignee' && request.method === 'POST') {
      if (current !== null && current !== (input.expectedAssigneeId ?? null)) return fail(ERRORS.assigneeChanged);
      await fixture.pool.query(
        `UPDATE inquiry SET assignee_member_id = ?, status = IF(status = 'WAITING', 'CHECKING', status) WHERE id = ?`,
        [memberId, id]
      );
    } else if (action === 'assignee' && request.method === 'DELETE') {
      if (current !== memberId) return fail(ERRORS.assigneeChanged);
      await fixture.pool.query('UPDATE inquiry SET assignee_member_id = NULL WHERE id = ?', [id]);
    } else if (action === 'assignee/restore') {
      if (current !== null && current !== memberId) return fail(ERRORS.assigneeChanged);
      await fixture.pool.query('UPDATE inquiry SET assignee_member_id = ? WHERE id = ?', [memberId, id]);
    } else if (action === 'replies') {
      if (current !== memberId) return fail(ERRORS.assigneeChanged);
      const now = new Date();
      await fixture.pool.query<ResultSetHeader>(
        `INSERT INTO inquiry_message (inquiry_id, sender, author_member_id, body, created_at) VALUES (?, 'OPERATOR', ?, ?, ?)`,
        [id, memberId, input.body ?? '', now]
      );
      await fixture.pool.query(`UPDATE inquiry SET status = 'ANSWERED', last_activity_at = ? WHERE id = ?`, [now, id]);
    } else {
      return send(response, 405, { status: 405, code: 'COMMON-405-1', message: '허용되지 않은 메소드 입니다' });
    }

    const updated = await fixture.inquiry(id);
    return send(response, 200, {
      data: {
        id,
        status: updated.status,
        assigneeMemberId: updated.assignee_member_id === null ? null : Number(updated.assignee_member_id),
        // Java의 LocalDateTime처럼 오프셋 없는 KST 시각 문자열이다.
        lastActivityAt: new Date((updated.last_activity_at as Date).getTime() + 9 * 3_600_000)
          .toISOString()
          .slice(0, -1),
      },
      status: 200,
      code: 'SUCCESS',
      message: '정상 처리되었습니다.',
    });
  };

  const server: Server = createServer((request, response) => {
    handle(request, response).catch((error) => {
      send(response, 500, { status: 500, code: 'COMMON-500-1', message: String(error) });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    calls,
    failNextWith: (status) => {
      forcedFailure = status;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
