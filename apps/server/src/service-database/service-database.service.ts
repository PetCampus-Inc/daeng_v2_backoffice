import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/mysql2';
import { createPool } from 'mysql2/promise';
import type { DatabaseConfig } from '../database/database.config.js';
import * as schema from './service-schema.js';

export const SERVICE_DATABASE_CONFIG = Symbol('SERVICE_DATABASE_CONFIG');

/**
 * 서비스(Java) DB 연결. 읽기 전용 계정으로 연결하고 BO는 여기에 쓰지 않는다(쓰기는 Java API, ADR 0009).
 * 서비스 DB의 시각은 KST로 저장돼 있어 연결 시간대를 +09:00으로 맞춘다. 풀은 처음 쿼리할 때 연결한다.
 */
@Injectable()
export class ServiceDatabaseService implements OnApplicationShutdown {
  private readonly pool;
  readonly db;

  constructor(@Inject(SERVICE_DATABASE_CONFIG) config: DatabaseConfig) {
    this.pool = createPool({ ...config, charset: 'utf8mb4', timezone: '+09:00', connectionLimit: 5 });
    this.db = drizzle(this.pool, { schema, mode: 'default' });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
