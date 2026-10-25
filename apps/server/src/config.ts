import { z } from 'zod';

const DEFAULT_PORT = 3000;
const portSchema = z
  .string()
  .regex(/^[0-9]+$/)
  .transform(Number)
  .pipe(z.int().min(1).max(65535));

export function readPort(value: string | undefined): number {
  if (value === undefined) return DEFAULT_PORT;
  const result = portSchema.safeParse(value);
  if (!result.success) throw new Error('PORT must be an integer from 1 to 65535');
  return result.data;
}

const apiDocsEnabledSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

export function readApiDocsEnabled(value: string | undefined): boolean {
  if (value === undefined) return false;
  const result = apiDocsEnabledSchema.safeParse(value);
  if (!result.success) throw new Error('API_DOCS_ENABLED must be "true" or "false"');
  return result.data;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

const databaseSchema = z.object({
  host: z.string().min(1),
  port: portSchema,
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
});

const DATABASE_ENV_NAMES = {
  host: 'DB_HOST',
  port: 'DB_PORT',
  database: 'DB_NAME',
  user: 'DB_USER',
  password: 'DB_PASSWORD',
} as const;

/** 값은 오류 메시지에 싣지 않고 문제가 있는 변수 이름만 알린다. */
export function readDatabaseConfig(values: Partial<Record<keyof DatabaseConfig, string | undefined>>): DatabaseConfig {
  const result = databaseSchema.safeParse(values);
  if (!result.success) {
    const names = new Set(
      result.error.issues.map((issue) => DATABASE_ENV_NAMES[issue.path[0] as keyof DatabaseConfig])
    );
    throw new Error(`Database settings are missing or invalid: ${[...names].join(', ')}`);
  }
  return result.data;
}

const emailSchema = z.email().transform((value) => value.toLowerCase());

/** 비어 있으면 최초 관리자를 등록하지 않는다. */
export function readInitialSuperAdminEmail(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  const result = emailSchema.safeParse(value);
  if (!result.success) throw new Error('INITIAL_SUPER_ADMIN_EMAIL must be an email address');
  return result.data;
}
