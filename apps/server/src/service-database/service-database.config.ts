import { readDatabaseConfig, type DatabaseConfig } from '../database/database.config.js';

const SERVICE_DATABASE_ENV_NAMES = {
  host: 'SERVICE_DB_HOST',
  port: 'SERVICE_DB_PORT',
  database: 'SERVICE_DB_NAME',
  user: 'SERVICE_DB_USER',
  password: 'SERVICE_DB_PASSWORD',
} as const;

/** 서비스(Java) DB를 읽기 전용 계정으로 연결하는 설정. 값은 오류 메시지에 싣지 않고 문제가 있는 변수 이름만 알린다. */
export function readServiceDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  try {
    return readDatabaseConfig({
      host: env[SERVICE_DATABASE_ENV_NAMES.host],
      port: env[SERVICE_DATABASE_ENV_NAMES.port],
      database: env[SERVICE_DATABASE_ENV_NAMES.database],
      user: env[SERVICE_DATABASE_ENV_NAMES.user],
      password: env[SERVICE_DATABASE_ENV_NAMES.password],
    });
  } catch (error) {
    // BO DB 설정 오류 메시지의 변수 이름(DB_*)을 서비스 DB 변수 이름으로 바꿔 알린다.
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.replace('Database settings', 'Service database settings').replaceAll('DB_', 'SERVICE_DB_'));
  }
}
