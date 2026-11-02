import {
  bigint,
  char,
  datetime,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

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
    /** 대소문자 구분 없이 유일하다. 정렬 규칙(utf8mb4_unicode_ci)은 Drizzle이 표현하지 못해 마이그레이션 SQL에서 직접 지정했다. */
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
    // 표시명은 팀원끼리 겹치지 않는다. 아직 정하지 않은 팀원(NULL)은 여러 명이어도 된다.
    uniqueIndex('uq_member_display_name').on(table.displayName),
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

export const ACCESS_EVENTS = ['LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'SESSION_EXPIRED', 'ACCESS_DENIED'] as const;
export const ACCESS_RESULTS = [
  'SUCCESS',
  'UNREGISTERED',
  'INACTIVE',
  'CANCELLED',
  'SUBJECT_MISMATCH',
  'INVALID_TOKEN',
  'FORBIDDEN',
] as const;

export type AccessEvent = (typeof ACCESS_EVENTS)[number];
export type AccessResult = (typeof ACCESS_RESULTS)[number];

// 접속 기록(FR-BO-042). 추가만 하고 고치거나 지우지 않는다. 이메일을 얻지 못한 실패는 email이 null이다.
export const accessLogs = mysqlTable(
  'access_log',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    occurredAt: datetime('occurred_at', { fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
    email: varchar('email', { length: 320 }),
    event: mysqlEnum('event', ACCESS_EVENTS).notNull(),
    result: mysqlEnum('result', ACCESS_RESULTS).notNull(),
  },
  (table) => [index('idx_access_log_occurred_at').on(table.occurredAt)]
);

/** 성공한 관리 작업의 당시 값을 보존한다. 행동·대상 종류는 새 기능에서도 확장할 수 있도록 문자열로 저장한다. */
export const changeLogs = mysqlTable(
  'change_log',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    occurredAt: datetime('occurred_at', { fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
    actorMemberId: int('actor_member_id').notNull(),
    actorEmail: varchar('actor_email', { length: 320 }).notNull(),
    actorDisplayName: varchar('actor_display_name', { length: 10 }).notNull(),
    actorJobRole: mysqlEnum('actor_job_role', MEMBER_JOB_ROLES).notNull(),
    targetType: varchar('target_type', { length: 32 }).notNull(),
    targetId: int('target_id').notNull(),
    targetLabel: varchar('target_label', { length: 320 }).notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    beforeValue: varchar('before_value', { length: 255 }),
    afterValue: varchar('after_value', { length: 255 }),
  },
  (table) => [
    index('idx_change_log_occurred_at').on(table.occurredAt),
    index('idx_change_log_actor').on(table.actorMemberId),
  ]
);

export type MemberRow = typeof members.$inferSelect;

export const processedNotificationEvents = mysqlTable('processed_notification_event', {
  eventId: varchar('event_id', { length: 20 }).primaryKey(),
  processedAt: datetime('processed_at', { fsp: 3 })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const notifications = mysqlTable(
  'notification',
  {
    id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
    recipientId: int('recipient_id')
      .notNull()
      .references(() => members.id),
    eventId: varchar('event_id', { length: 20 })
      .notNull()
      .references(() => processedNotificationEvents.eventId),
    kind: varchar('kind', { length: 32 }).notNull(),
    message: varchar('message', { length: 255 }).notNull(),
    targetType: varchar('target_type', { length: 16 }).notNull(),
    targetId: bigint('target_id', { mode: 'number' }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
    readAt: datetime('read_at', { fsp: 3 }),
  },
  (table) => [
    uniqueIndex('uq_notification_event_recipient').on(table.eventId, table.recipientId),
    index('idx_notification_recipient_created').on(table.recipientId, table.createdAt, table.id),
    index('idx_notification_recipient_read').on(table.recipientId, table.readAt),
  ]
);
