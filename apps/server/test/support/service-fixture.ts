import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import type { DatabaseConfig } from '../../src/database/database.config.js';

export type FixtureSender = 'USER' | 'OPERATOR';

export interface FixtureUser {
  pk: number;
  name: string;
  email: string;
}

export interface FixtureMessage {
  sender: FixtureSender;
  body: string;
  createdAt: Date;
  authorMemberId?: number;
  images?: Array<{ s3Key: string; fileName: string }>;
}

export interface FixtureInquiryInput {
  user: FixtureUser;
  type?: 'GUARDIAN' | 'OWNER';
  title: string;
  status?: 'WAITING' | 'CHECKING' | 'ANSWERED' | 'RESOLVED';
  assigneeMemberId?: number | null;
  lastActivityAt: Date;
  createdAt?: Date;
  messages?: FixtureMessage[];
}

const TABLES = [
  `CREATE TABLE IF NOT EXISTS \`user\` (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id VARCHAR(8) NULL,
    status VARCHAR(20) NOT NULL,
    nickname VARCHAR(100) NULL,
    guardian_name VARCHAR(20) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_user_id (user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS social_user (
    id BIGINT NOT NULL AUTO_INCREMENT,
    provider_id VARCHAR(255) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_social_user_email (email)
  )`,
  `CREATE TABLE IF NOT EXISTS inquiry (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    inquirer_type VARCHAR(20) NOT NULL,
    title VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL,
    assignee_member_id BIGINT NULL,
    last_activity_at DATETIME(6) NOT NULL,
    resolved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS inquiry_message (
    id BIGINT NOT NULL AUTO_INCREMENT,
    inquiry_id BIGINT NOT NULL,
    sender VARCHAR(20) NOT NULL,
    author_member_id BIGINT NULL,
    body TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS inquiry_image (
    id BIGINT NOT NULL AUTO_INCREMENT,
    message_id BIGINT NOT NULL,
    s3_key VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NULL,
    content_type VARCHAR(50) NULL,
    file_size BIGINT NOT NULL,
    display_order INT NOT NULL,
    PRIMARY KEY (id)
  )`,
];

/**
 * 서비스(Java) DB의 문의 관련 테이블을 시험용으로 만든다. 실제 서비스 DB와 같은 이름·열을 쓰고, 시각은 KST로 저장한다.
 * 테스트 DB 하나에 BO 테이블과 함께 만들어 쓰므로 이 인스턴스가 만든 행만 추적해서 지운다.
 */
export class ServiceFixture {
  private readonly userPks: number[] = [];
  private readonly inquiryIds: number[] = [];
  private seq = 0;

  private constructor(
    readonly pool: Pool,
    private readonly run: string
  ) {}

  static async create(config: DatabaseConfig, run: string): Promise<ServiceFixture> {
    const pool = createPool({ ...config, charset: 'utf8mb4', timezone: '+09:00', connectionLimit: 4 });
    for (const ddl of TABLES) await pool.query(ddl);
    return new ServiceFixture(pool, run);
  }

  async addUser(name: string): Promise<FixtureUser> {
    const now = new Date();
    const email = `${this.run}-${name}@example.com`;
    const displayName = `사용자-${name}`;
    const userId = `t${Math.random().toString(36).slice(2, 9)}`.slice(0, 8);
    const [user] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO `user` (user_id, status, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [userId, 'ACTIVE', `닉네임-${name}`, now, now]
    );
    await this.pool.query(
      'INSERT INTO social_user (provider_id, provider, email, name, user_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [`${this.run}-${name}`, 'GOOGLE', email, displayName, userId, 'ACTIVE', now]
    );
    this.userPks.push(user.insertId);
    return { pk: user.insertId, name: displayName, email };
  }

  async addInquiry(input: FixtureInquiryInput): Promise<number> {
    const [inquiry] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO inquiry (user_id, inquirer_type, title, status, assignee_member_id, last_activity_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.user.pk,
        input.type ?? 'GUARDIAN',
        input.title,
        input.status ?? 'WAITING',
        input.assigneeMemberId ?? null,
        input.lastActivityAt,
        input.createdAt ?? input.lastActivityAt,
      ]
    );
    this.inquiryIds.push(inquiry.insertId);
    const messages = input.messages ?? [
      { sender: 'USER', body: `본문 ${++this.seq}`, createdAt: input.createdAt ?? input.lastActivityAt },
    ];
    for (const message of messages) {
      const [saved] = await this.pool.query<ResultSetHeader>(
        'INSERT INTO inquiry_message (inquiry_id, sender, author_member_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
        [inquiry.insertId, message.sender, message.authorMemberId ?? null, message.body, message.createdAt]
      );
      for (const [order, image] of (message.images ?? []).entries()) {
        await this.pool.query(
          `INSERT INTO inquiry_image (message_id, s3_key, original_filename, content_type, file_size, display_order)
           VALUES (?, ?, ?, 'image/jpeg', 1024, ?)`,
          [saved.insertId, image.s3Key, image.fileName, order]
        );
      }
    }
    return inquiry.insertId;
  }

  async inquiry(id: number): Promise<RowDataPacket> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM inquiry WHERE id = ?', [id]);
    return rows[0]!;
  }

  async messages(inquiryId: number): Promise<RowDataPacket[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM inquiry_message WHERE inquiry_id = ? ORDER BY id',
      [inquiryId]
    );
    return rows;
  }

  /** 이 인스턴스가 만든 행만 지우고 연결을 닫는다. */
  async close(): Promise<void> {
    if (this.inquiryIds.length > 0) {
      const marks = this.inquiryIds.map(() => '?').join(',');
      await this.pool.query(
        `DELETE FROM inquiry_image WHERE message_id IN (SELECT id FROM inquiry_message WHERE inquiry_id IN (${marks}))`,
        this.inquiryIds
      );
      await this.pool.query(`DELETE FROM inquiry_message WHERE inquiry_id IN (${marks})`, this.inquiryIds);
      await this.pool.query(`DELETE FROM inquiry WHERE id IN (${marks})`, this.inquiryIds);
    }
    await this.pool.query('DELETE FROM social_user WHERE provider_id LIKE ?', [`${this.run}-%`]);
    if (this.userPks.length > 0) {
      await this.pool.query(
        `DELETE FROM \`user\` WHERE id IN (${this.userPks.map(() => '?').join(',')})`,
        this.userPks
      );
    }
    await this.pool.end();
  }
}
