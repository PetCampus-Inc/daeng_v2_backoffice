import { char, datetime, index, int, mysqlEnum, mysqlTable, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

export const MEMBER_ROLES = ['SUPER_ADMIN', 'OPERATOR', 'VIEWER'] as const;
export const MEMBER_JOB_ROLES = ['PM', 'UX_UI', 'FE', 'BE', 'FULL_STACK'] as const;
export const MEMBER_STATUSES = ['REGISTERED', 'ACTIVE', 'INACTIVE', 'CANCELLED'] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];
export type MemberJobRole = (typeof MEMBER_JOB_ROLES)[number];
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

// 시각은 모두 UTC로 저장한다(연결 설정 timezone: 'Z').
export const members = mysqlTable(
  'member',
  {
    id: int('id').autoincrement().primaryKey(),
    /** 소문자로 저장한다. */
    email: varchar('email', { length: 320 }).notNull(),
    /** 구글 계정 고유 ID(sub). 첫 로그인 때 채운다. */
    googleSubject: varchar('google_subject', { length: 255 }),
    googleName: varchar('google_name', { length: 255 }),
    displayName: varchar('display_name', { length: 10 }),
    jobRole: mysqlEnum('job_role', MEMBER_JOB_ROLES),
    role: mysqlEnum('role', MEMBER_ROLES).notNull(),
    status: mysqlEnum('status', MEMBER_STATUSES).notNull().default('REGISTERED'),
    lastLoginAt: datetime('last_login_at', { fsp: 3 }),
    registeredAt: datetime('registered_at', { fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at', { fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('uq_member_email').on(table.email),
    uniqueIndex('uq_member_google_subject').on(table.googleSubject),
  ]
);

// 세션 ID는 해시(SHA-256 16진수)로만 저장한다. 마지막 사용 시각에서 24시간이 지나면 만료다.
export const sessions = mysqlTable(
  'session',
  {
    idHash: char('id_hash', { length: 64 }).primaryKey(),
    memberId: int('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    createdAt: datetime('created_at', { fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
    lastUsedAt: datetime('last_used_at', { fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('idx_session_member').on(table.memberId), index('idx_session_last_used').on(table.lastUsedAt)]
);
