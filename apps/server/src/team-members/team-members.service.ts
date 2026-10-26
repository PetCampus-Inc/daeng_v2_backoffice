import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { ApiException } from '../common/api-error.js';
import { DatabaseService } from '../database/database.service.js';
import { isDuplicateEntry } from '../database/errors.js';
import { changeLogs, members, sessions, type MemberRole, type MemberRow } from '../database/schema.js';

type ChangeAction =
  | 'MEMBER_REGISTERED'
  | 'MEMBER_ROLE_CHANGED'
  | 'MEMBER_DEACTIVATED'
  | 'MEMBER_CANCELLED'
  | 'MEMBER_REACTIVATED';

const notFound = () => new ApiException(404, 'TEAM_MEMBER_NOT_FOUND', '계정을 찾을 수 없습니다.');
const protectedMember = () =>
  new ApiException(409, 'TEAM_MEMBER_PROTECTED', '마지막 최고 관리자와 본인 계정은 변경할 수 없습니다.');
const stateChanged = () =>
  new ApiException(409, 'TEAM_MEMBER_STATE_CHANGED', '계정 상태가 변경됐습니다. 다시 확인해 주세요.');

function logEntry(
  actor: MemberRow,
  targetEmail: string,
  action: ChangeAction,
  beforeValue: string | null = null,
  afterValue: string | null = null
): typeof changeLogs.$inferInsert {
  if (actor.displayName === null || actor.jobRole === null) {
    throw new ApiException(403, 'PROFILE_INCOMPLETE', '프로필을 먼저 설정해 주세요.');
  }
  return {
    actorMemberId: actor.id,
    actorEmail: actor.email,
    actorDisplayName: actor.displayName,
    actorJobRole: actor.jobRole,
    targetType: 'MEMBER',
    targetIdentifier: targetEmail,
    action,
    beforeValue,
    afterValue,
  };
}

@Injectable()
export class TeamMembersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async list(): Promise<MemberRow[]> {
    return this.database.db.select().from(members).orderBy(asc(members.id));
  }

  async register(actor: MemberRow, input: { email: string; role: MemberRole }): Promise<MemberRow> {
    const { db } = this.database;
    try {
      return await db.transaction(async (tx) => {
        await tx.insert(members).values({ email: input.email, role: input.role, status: 'REGISTERED' });
        await tx.insert(changeLogs).values(logEntry(actor, input.email, 'MEMBER_REGISTERED'));
        const [created] = await tx.select().from(members).where(eq(members.email, input.email)).limit(1);
        return created!;
      });
    } catch (error) {
      if (isDuplicateEntry(error, 'uq_member_email')) {
        const [existing] = await db
          .select({ status: members.status })
          .from(members)
          .where(eq(members.email, input.email))
          .limit(1);
        if (existing?.status === 'INACTIVE' || existing?.status === 'CANCELLED') {
          throw new ApiException(
            409,
            'TEAM_MEMBER_EMAIL_INACTIVE',
            '비활성 또는 등록 취소된 계정입니다. 재활성화해 주세요.'
          );
        }
        throw new ApiException(409, 'TEAM_MEMBER_EMAIL_DUPLICATE', '이미 등록된 이메일입니다.');
      }
      throw error;
    }
  }

  async changeRole(actor: MemberRow, memberId: number, role: MemberRole): Promise<MemberRow> {
    return this.database.db.transaction(async (tx) => {
      // 모든 최고 관리자 행을 같은 순서로 잠가 두 관리자에 대한 동시 권한 변경도 직렬화한다.
      const admins = await tx
        .select({ id: members.id, status: members.status })
        .from(members)
        .where(eq(members.role, 'SUPER_ADMIN'))
        .orderBy(asc(members.id))
        .for('update');
      const [target] = await tx.select().from(members).where(eq(members.id, memberId)).for('update');
      if (!target) throw notFound();
      if (target.id === actor.id) throw protectedMember();
      if (target.status !== 'REGISTERED' && target.status !== 'ACTIVE') throw stateChanged();
      if (target.role === role) return target;
      if (
        target.role === 'SUPER_ADMIN' &&
        target.status === 'ACTIVE' &&
        admins.filter((a) => a.status === 'ACTIVE').length <= 1
      ) {
        throw protectedMember();
      }
      const [result] = await tx
        .update(members)
        .set({ role })
        .where(
          and(
            eq(members.id, memberId),
            eq(members.role, target.role),
            inArray(members.status, ['REGISTERED', 'ACTIVE'])
          )
        );
      if (result.affectedRows === 0) throw stateChanged();
      await tx.insert(changeLogs).values(logEntry(actor, target.email, 'MEMBER_ROLE_CHANGED', target.role, role));
      const [updated] = await tx.select().from(members).where(eq(members.id, memberId)).limit(1);
      return updated!;
    });
  }

  async deactivate(actor: MemberRow, memberId: number): Promise<MemberRow> {
    return this.database.db.transaction(async (tx) => {
      const admins = await tx
        .select({ id: members.id, status: members.status })
        .from(members)
        .where(eq(members.role, 'SUPER_ADMIN'))
        .orderBy(asc(members.id))
        .for('update');
      const [target] = await tx.select().from(members).where(eq(members.id, memberId)).for('update');
      if (!target) throw notFound();
      if (target.id === actor.id) throw protectedMember();
      if (target.status !== 'ACTIVE') throw stateChanged();
      if (target.role === 'SUPER_ADMIN' && admins.filter((a) => a.status === 'ACTIVE').length <= 1) {
        throw protectedMember();
      }
      const [result] = await tx
        .update(members)
        .set({ status: 'INACTIVE' })
        .where(and(eq(members.id, memberId), eq(members.status, 'ACTIVE')));
      if (result.affectedRows === 0) throw stateChanged();
      await tx.delete(sessions).where(eq(sessions.memberId, memberId));
      await tx.insert(changeLogs).values(logEntry(actor, target.email, 'MEMBER_DEACTIVATED'));
      const [updated] = await tx.select().from(members).where(eq(members.id, memberId)).limit(1);
      return updated!;
    });
  }

  async cancel(actor: MemberRow, memberId: number): Promise<MemberRow> {
    return this.database.db.transaction(async (tx) => {
      const [target] = await tx.select().from(members).where(eq(members.id, memberId)).for('update');
      if (!target) throw notFound();
      if (target.status !== 'REGISTERED') throw stateChanged();
      const [result] = await tx
        .update(members)
        .set({ status: 'CANCELLED' })
        .where(and(eq(members.id, memberId), eq(members.status, 'REGISTERED')));
      if (result.affectedRows === 0) throw stateChanged();
      await tx.insert(changeLogs).values(logEntry(actor, target.email, 'MEMBER_CANCELLED'));
      const [updated] = await tx.select().from(members).where(eq(members.id, memberId)).limit(1);
      return updated!;
    });
  }

  async reactivate(actor: MemberRow, memberId: number): Promise<MemberRow> {
    return this.database.db.transaction(async (tx) => {
      const [target] = await tx.select().from(members).where(eq(members.id, memberId)).for('update');
      if (!target) throw notFound();
      if (target.status !== 'INACTIVE' && target.status !== 'CANCELLED') throw stateChanged();
      const status = target.lastLoginAt === null ? 'REGISTERED' : 'ACTIVE';
      const [result] = await tx
        .update(members)
        .set({ status })
        .where(and(eq(members.id, memberId), inArray(members.status, ['INACTIVE', 'CANCELLED'])));
      if (result.affectedRows === 0) throw stateChanged();
      await tx.insert(changeLogs).values(logEntry(actor, target.email, 'MEMBER_REACTIVATED'));
      const [updated] = await tx.select().from(members).where(eq(members.id, memberId)).limit(1);
      return updated!;
    });
  }
}
