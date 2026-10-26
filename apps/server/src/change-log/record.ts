import type { Database } from '../database/database.service.js';
import { changeLogs, type MemberRow } from '../database/schema.js';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export const CHANGE_ACTIONS = {
  INQUIRY: ['INQUIRY_ASSIGNED', 'INQUIRY_ASSIGNEE_CHANGED', 'INQUIRY_ASSIGNEE_RELEASED', 'INQUIRY_REPLIED'],
  NOTICE: ['NOTICE_CREATED', 'NOTICE_EDITED', 'NOTICE_UNPUBLISHED', 'NOTICE_REPUBLISHED'],
  TERMS_VERSION: ['TERMS_VERSION_CREATED', 'TERMS_VERSION_PUBLISHED', 'TERMS_VERSION_WITHDRAWN'],
  ACCOUNT: [
    'ACCOUNT_REGISTERED',
    'ACCOUNT_ROLE_CHANGED',
    'ACCOUNT_DEACTIVATED',
    'ACCOUNT_REGISTRATION_CANCELLED',
    'ACCOUNT_REACTIVATED',
  ],
} as const;

type ChangeTargetType = keyof typeof CHANGE_ACTIONS;

export type ChangeLogInput = {
  [T in ChangeTargetType]: {
    actor: MemberRow;
    target: { type: T; id: number; label: string };
    action: (typeof CHANGE_ACTIONS)[T][number];
    change?: { from: string | null; to: string | null };
  };
}[ChangeTargetType];

/** 호출자의 트랜잭션에서 기록해 실제 변경과 이력의 성공 여부를 일치시킨다. */
export async function recordChange(tx: Transaction, input: ChangeLogInput): Promise<void> {
  const { actor, target, action, change } = input;
  if (actor.displayName === null || actor.jobRole === null) {
    throw new Error('Change log actor must have a completed profile');
  }
  await tx.insert(changeLogs).values({
    actorMemberId: actor.id,
    actorEmail: actor.email,
    actorDisplayName: actor.displayName,
    actorJobRole: actor.jobRole,
    targetType: target.type,
    targetId: target.id,
    targetLabel: target.label,
    action,
    beforeValue: change?.from ?? null,
    afterValue: change?.to ?? null,
  });
}
