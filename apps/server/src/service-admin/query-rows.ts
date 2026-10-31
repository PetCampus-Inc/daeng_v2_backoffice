import type { SQL } from 'drizzle-orm';
import type { ServiceDatabaseService } from '../service-database/service-database.service.js';

/** 서비스 DB(읽기 전용)에서 원시 SQL을 실행해 행을 돌려준다. */
export async function queryRows<T>(service: ServiceDatabaseService, query: SQL): Promise<T[]> {
  const [rows] = (await service.db.execute(query)) as unknown as [T[]];
  return rows;
}
