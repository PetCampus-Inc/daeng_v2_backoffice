import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import type { DatabaseConfig } from '../../src/database/database.config.js';

// 홈·고객 관리 조회가 읽는 서비스(Java) DB 테이블을 시험용으로 만든다. 실제 서비스 DB와 같은 이름·열을 쓰고 시각은 KST 문자열로 넣는다.
// 문의 픽스처가 같은 DB에 `user`·`social_user`를 먼저 만들 수 있어서, 없는 열은 information_schema로 확인해 덧붙인다.

const TABLES = [
  `CREATE TABLE IF NOT EXISTS \`user\` (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id VARCHAR(8) NULL,
    status VARCHAR(20) NOT NULL,
    nickname VARCHAR(100) NULL,
    guardian_name VARCHAR(20) NULL,
    phone_number VARCHAR(30) NULL,
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
  `CREATE TABLE IF NOT EXISTS pet (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    removed_at DATETIME(6) NULL,
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS tb_school (
    school_id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    address_detail VARCHAR(255) NULL,
    phone_number VARCHAR(30) NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    kindergarten_place_id VARCHAR(100) NULL,
    PRIMARY KEY (school_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tb_user_school_role (
    user_school_role_id BIGINT NOT NULL AUTO_INCREMENT,
    user_id_fk BIGINT NOT NULL,
    school_id_fk BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    revoke_reason VARCHAR(255) NULL,
    PRIMARY KEY (user_school_role_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tb_owner_verification (
    owner_verification_id BIGINT NOT NULL AUTO_INCREMENT,
    user_id_fk BIGINT NOT NULL,
    school_id_fk BIGINT NULL,
    kindergarten_place_id VARCHAR(100) NULL,
    kindergarten_type VARCHAR(20) NULL,
    status VARCHAR(40) NOT NULL,
    kindergarten_name VARCHAR(100) NULL,
    kindergarten_address VARCHAR(255) NULL,
    kindergarten_address_detail VARCHAR(255) NULL,
    kindergarten_phone_number VARCHAR(30) NULL,
    representative_name VARCHAR(50) NULL,
    representative_phone_number VARCHAR(30) NULL,
    business_registration_number VARCHAR(20) NULL,
    submitted_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    PRIMARY KEY (owner_verification_id)
  )`,
  `CREATE TABLE IF NOT EXISTS school_pet_membership (
    id BIGINT NOT NULL AUTO_INCREMENT,
    school_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    PRIMARY KEY (id)
  )`,
  `CREATE TABLE IF NOT EXISTS tb_school_business_registration (
    school_business_registration_id BIGINT NOT NULL AUTO_INCREMENT,
    school_id_fk BIGINT NOT NULL,
    revoked_at DATETIME(6) NULL,
    PRIMARY KEY (school_business_registration_id)
  )`,
];

export interface FixtureUser {
  pk: number;
  userId: string;
}

export class ServiceAdminFixture {
  private readonly ids = {
    users: [] as number[],
    socialUsers: [] as number[],
    pets: [] as number[],
    schools: [] as number[],
    roles: [] as number[],
    verifications: [] as number[],
    memberships: [] as number[],
    registrations: [] as number[],
  };

  private constructor(readonly pool: Pool) {}

  static async create(config: DatabaseConfig): Promise<ServiceAdminFixture> {
    const pool = createPool({ ...config, charset: 'utf8mb4', timezone: '+09:00', connectionLimit: 4 });
    for (const ddl of TABLES) await pool.query(ddl);
    const [columns] = await pool.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'user'"
    );
    const have = new Set(columns.map((column) => String(column.name)));
    if (!have.has('phone_number')) await pool.query('ALTER TABLE `user` ADD COLUMN phone_number VARCHAR(30) NULL');
    if (!have.has('guardian_name')) await pool.query('ALTER TABLE `user` ADD COLUMN guardian_name VARCHAR(20) NULL');
    return new ServiceAdminFixture(pool);
  }

  private async insert(sqlText: string, values: unknown[], bucket: number[]): Promise<number> {
    const [result] = await this.pool.query<ResultSetHeader>(sqlText, values);
    bucket.push(result.insertId);
    return result.insertId;
  }

  async addUser(input: {
    label: string;
    status?: 'ACTIVE' | 'WITHDRAWN';
    guardianName?: string | null;
    nickname?: string | null;
    phone?: string | null;
    email?: string | null;
    socialName?: string | null;
    createdAt: string;
  }): Promise<FixtureUser> {
    const userId = Math.random().toString(36).slice(2, 10).padEnd(8, 'x');
    const pk = await this.insert(
      'INSERT INTO `user` (user_id, status, nickname, guardian_name, phone_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        input.status ?? 'ACTIVE',
        input.nickname === undefined ? `닉네임-${input.label}` : input.nickname,
        input.guardianName ?? null,
        input.phone ?? null,
        input.createdAt,
        input.createdAt,
      ],
      this.ids.users
    );
    if (input.email) {
      await this.insert(
        'INSERT INTO social_user (provider_id, provider, email, name, user_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          `${userId}-p`,
          'GOOGLE',
          input.email,
          input.socialName ?? `소셜-${input.label}`,
          userId,
          'LINKED',
          input.createdAt,
        ],
        this.ids.socialUsers
      );
    }
    return { pk, userId };
  }

  addPet(userPk: number, removedAt: string | null = null): Promise<number> {
    return this.insert('INSERT INTO pet (user_id, removed_at) VALUES (?, ?)', [userPk, removedAt], this.ids.pets);
  }

  addSchool(input: {
    name: string;
    status?: 'ACTIVE' | 'CLOSED';
    address?: string;
    phone?: string | null;
    createdAt: string;
  }): Promise<number> {
    return this.insert(
      'INSERT INTO tb_school (name, address, address_detail, phone_number, status, created_at, kindergarten_place_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        input.name,
        input.address ?? '서울시 테스트구',
        null,
        input.phone ?? null,
        input.status ?? 'ACTIVE',
        input.createdAt,
        null,
      ],
      this.ids.schools
    );
  }

  addRole(
    userPk: number,
    schoolId: number,
    input: { createdAt: string; revokedAt?: string | null; reason?: string | null }
  ) {
    return this.insert(
      'INSERT INTO tb_user_school_role (user_id_fk, school_id_fk, role, created_at, revoked_at, revoke_reason) VALUES (?, ?, ?, ?, ?, ?)',
      [userPk, schoolId, 'ROLE_OWNER', input.createdAt, input.revokedAt ?? null, input.reason ?? null],
      this.ids.roles
    );
  }

  addVerification(input: {
    userPk: number;
    schoolId?: number | null;
    status: string;
    kindergartenName: string;
    representativeName?: string;
    submittedAt?: string | null;
    businessNumber?: string | null;
    phone?: string | null;
  }) {
    return this.insert(
      `INSERT INTO tb_owner_verification (user_id_fk, school_id_fk, kindergarten_type, status, kindergarten_name,
         representative_name, representative_phone_number, kindergarten_phone_number, business_registration_number, submitted_at)
       VALUES (?, ?, 'SELECTED', ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.userPk,
        input.schoolId ?? null,
        input.status,
        input.kindergartenName,
        input.representativeName ?? '대표자',
        input.phone ?? null,
        input.phone ?? null,
        input.businessNumber ?? null,
        input.submittedAt ?? null,
      ],
      this.ids.verifications
    );
  }

  addMembership(schoolId: number, status: 'ACTIVE' | 'PENDING') {
    return this.insert(
      'INSERT INTO school_pet_membership (school_id, status) VALUES (?, ?)',
      [schoolId, status],
      this.ids.memberships
    );
  }

  addBusinessRegistration(schoolId: number, revokedAt: string | null = null) {
    return this.insert(
      'INSERT INTO tb_school_business_registration (school_id_fk, revoked_at) VALUES (?, ?)',
      [schoolId, revokedAt],
      this.ids.registrations
    );
  }

  async cleanup(): Promise<void> {
    const del = async (table: string, column: string, ids: number[]) => {
      if (ids.length > 0) await this.pool.query(`DELETE FROM \`${table}\` WHERE ${column} IN (?)`, [ids]);
    };
    await del('tb_owner_verification', 'owner_verification_id', this.ids.verifications);
    await del('tb_user_school_role', 'user_school_role_id', this.ids.roles);
    await del('school_pet_membership', 'id', this.ids.memberships);
    await del('tb_school_business_registration', 'school_business_registration_id', this.ids.registrations);
    await del('tb_school', 'school_id', this.ids.schools);
    await del('pet', 'id', this.ids.pets);
    await del('social_user', 'id', this.ids.socialUsers);
    await del('user', 'id', this.ids.users);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
