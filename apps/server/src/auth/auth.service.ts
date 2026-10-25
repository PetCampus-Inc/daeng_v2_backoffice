import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { ApiException } from '../common/api-error.js';
import { DatabaseService } from '../database/database.service.js';
import { members, sessions, type AccessResult, type MemberRow } from '../database/schema.js';
import { AccessLogService } from './access-log.service.js';
import { ID_TOKEN_VERIFIER, SESSION_IDLE_MS, SESSION_TOUCH_INTERVAL_MS } from './auth.constants.js';
import type { GoogleIdentity, IdTokenVerifier } from './google-id-token-verifier.js';
import { generateSessionId, hashSessionId } from './session-id.js';

export interface AuthenticatedSession {
  member: MemberRow;
  /** 마지막 사용 시각을 이번 요청에서 갱신했는지. 갱신했으면 쿠키 만료도 함께 연장한다. */
  extended: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccessLogService) private readonly accessLog: AccessLogService,
    @Inject(ID_TOKEN_VERIFIER) private readonly verifier: IdTokenVerifier
  ) {}

  /** 등록된 팀원만 로그인할 수 있다. 계정을 자동으로 만들지 않는다. */
  async login(idToken: string): Promise<{ member: MemberRow; sessionId: string }> {
    let identity: GoogleIdentity;
    try {
      identity = await this.verifier.verify(idToken);
    } catch (error) {
      if (error instanceof ApiException) {
        await this.accessLog.record({ event: 'LOGIN_FAILURE', result: 'INVALID_TOKEN', email: null });
      }
      throw error;
    }

    const member = await this.findAllowedMember(identity.email);
    // 이메일이 같아도 구글 계정이 다르면(이메일 재사용 등) 거부한다.
    if (member.googleSubject !== null && member.googleSubject !== identity.subject) {
      throw await this.deny(identity.email, 'SUBJECT_MISMATCH');
    }
    return this.startSession(member, { googleSubject: identity.subject, googleName: identity.name ?? identity.email });
  }

  /** 세션을 확인하고 사용 시각을 연장한다. 만료됐거나 비활성 계정이면 세션을 지우고 401이다. */
  async authenticate(sessionId: string): Promise<AuthenticatedSession> {
    const { db } = this.database;
    const idHash = hashSessionId(sessionId);
    const [row] = await db
      .select({ session: sessions, member: members })
      .from(sessions)
      .innerJoin(members, eq(sessions.memberId, members.id))
      .where(eq(sessions.idHash, idHash))
      .limit(1);
    if (!row) throw new ApiException(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');

    const now = Date.now();
    const idleMs = now - row.session.lastUsedAt.getTime();
    if (idleMs >= SESSION_IDLE_MS) {
      await db.delete(sessions).where(eq(sessions.idHash, idHash));
      await this.accessLog.record({ event: 'SESSION_EXPIRED', result: 'SUCCESS', email: row.member.email });
      throw new ApiException(401, 'SESSION_EXPIRED', '로그인이 만료되었습니다. 다시 로그인해 주세요.');
    }
    if (row.member.status !== 'ACTIVE') {
      await db.delete(sessions).where(eq(sessions.idHash, idHash));
      throw new ApiException(401, 'ACCOUNT_DEACTIVATED', '비활성화된 계정입니다.');
    }

    const extended = idleMs >= SESSION_TOUCH_INTERVAL_MS;
    if (extended) {
      await db
        .update(sessions)
        .set({ lastUsedAt: new Date(now) })
        .where(eq(sessions.idHash, idHash));
    }
    return { member: row.member, extended };
  }

  async logout(sessionId: string, member: MemberRow): Promise<void> {
    await this.database.db.delete(sessions).where(eq(sessions.idHash, hashSessionId(sessionId)));
    await this.accessLog.record({ event: 'LOGOUT', result: 'SUCCESS', email: member.email });
  }

  private async findAllowedMember(email: string): Promise<MemberRow> {
    const [member] = await this.database.db.select().from(members).where(eq(members.email, email)).limit(1);
    if (!member) throw await this.deny(email, 'UNREGISTERED');
    if (member.status === 'INACTIVE') throw await this.deny(email, 'INACTIVE');
    if (member.status === 'CANCELLED') throw await this.deny(email, 'CANCELLED');
    return member;
  }

  private async startSession(
    member: MemberRow,
    changes: Partial<typeof members.$inferInsert>
  ): Promise<{ member: MemberRow; sessionId: string }> {
    const now = new Date();
    const sessionId = generateSessionId();
    const loggedIn = await this.database.db.transaction(async (tx) => {
      // 허용 여부를 확인한 뒤 이 사이에 관리자가 비활성화했다면 되살리지 않도록, 아직 허용 상태일 때만 갱신한다.
      const [updated] = await tx
        .update(members)
        .set({ ...changes, status: 'ACTIVE', lastLoginAt: now })
        .where(and(eq(members.id, member.id), inArray(members.status, ['REGISTERED', 'ACTIVE'])));
      if (updated.affectedRows === 0) return undefined;
      // 쓰이지 않고 만료된 이 팀원의 옛 세션을 정리한다. 안 지우면 로그인마다 쌓인다.
      await tx
        .delete(sessions)
        .where(
          and(eq(sessions.memberId, member.id), lt(sessions.lastUsedAt, new Date(now.getTime() - SESSION_IDLE_MS)))
        );
      await tx
        .insert(sessions)
        .values({ idHash: hashSessionId(sessionId), memberId: member.id, createdAt: now, lastUsedAt: now });
      const [row] = await tx.select().from(members).where(eq(members.id, member.id)).limit(1);
      return row;
    });
    if (!loggedIn) {
      const [current] = await this.database.db
        .select({ status: members.status })
        .from(members)
        .where(eq(members.id, member.id))
        .limit(1);
      throw await this.deny(member.email, current?.status === 'CANCELLED' ? 'CANCELLED' : 'INACTIVE');
    }
    await this.accessLog.record({ event: 'LOGIN_SUCCESS', result: 'SUCCESS', email: member.email });
    return { member: loggedIn, sessionId };
  }

  private async deny(email: string, result: AccessResult): Promise<ApiException> {
    await this.accessLog.record({ event: 'LOGIN_FAILURE', result, email });
    return new ApiException(403, 'LOGIN_NOT_ALLOWED', '접근 권한이 없는 계정입니다. 관리자에게 문의해 주세요.');
  }
}
