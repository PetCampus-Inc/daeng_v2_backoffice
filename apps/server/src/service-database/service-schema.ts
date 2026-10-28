import { bigint, datetime, int, mysqlTable, text, varchar } from 'drizzle-orm/mysql-core';

// 서비스(Java) DB 테이블 중 BO가 읽는 열만 옮긴 읽기 전용 정의다. 이 테이블들은 Java가 소유하므로 BO에서 마이그레이션하지 않는다.
// 시각은 KST로 저장돼 있다. drizzle은 DATETIME 문자열을 UTC로 읽으므로 `mode: 'string'`으로 받아 직접 변환한다.

export const serviceUsers = mysqlTable('user', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  userId: varchar('user_id', { length: 8 }),
  nickname: varchar('nickname', { length: 100 }),
});

export const socialUsers = mysqlTable('social_user', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }),
});

export const SERVICE_INQUIRY_STATUSES = ['WAITING', 'CHECKING', 'ANSWERED', 'RESOLVED'] as const;
export type ServiceInquiryStatus = (typeof SERVICE_INQUIRY_STATUSES)[number];

export const serviceInquiries = mysqlTable('inquiry', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  inquirerType: varchar('inquirer_type', { length: 20 }).notNull(),
  title: varchar('title', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().$type<ServiceInquiryStatus>(),
  assigneeMemberId: bigint('assignee_member_id', { mode: 'number' }),
  lastActivityAt: datetime('last_activity_at', { fsp: 6, mode: 'string' }).notNull(),
  createdAt: datetime('created_at', { fsp: 6, mode: 'string' }).notNull(),
});

export const serviceInquiryMessages = mysqlTable('inquiry_message', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  inquiryId: bigint('inquiry_id', { mode: 'number' }).notNull(),
  sender: varchar('sender', { length: 20 }).notNull().$type<'USER' | 'OPERATOR'>(),
  authorMemberId: bigint('author_member_id', { mode: 'number' }),
  body: text('body').notNull(),
  createdAt: datetime('created_at', { fsp: 6, mode: 'string' }).notNull(),
});

export const serviceInquiryImages = mysqlTable('inquiry_image', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  messageId: bigint('message_id', { mode: 'number' }).notNull(),
  s3Key: varchar('s3_key', { length: 255 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }),
  displayOrder: int('display_order').notNull(),
});
