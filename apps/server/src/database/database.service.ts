import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/mysql2';
import { createPool } from 'mysql2/promise';
import type { DatabaseConfig } from '../config.js';
import * as schema from './schema.js';

export const DATABASE_CONFIG = Symbol('DATABASE_CONFIG');

/** BO 전용 DB 연결. 풀은 처음 쿼리할 때 연결한다. */
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool;
  readonly db;

  constructor(@Inject(DATABASE_CONFIG) config: DatabaseConfig) {
    this.pool = createPool({ ...config, charset: 'utf8mb4', timezone: 'Z', connectionLimit: 10 });
    this.db = drizzle(this.pool, { schema, mode: 'default' });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

export type Database = DatabaseService['db'];
