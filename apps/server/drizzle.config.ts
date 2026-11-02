import { defineConfig } from 'drizzle-kit';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

// 실행: infisical run --env=dev -- pnpm --filter @daeng/server db:migrate
export default defineConfig({
  dialect: 'mysql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    host: required('DB_HOST'),
    port: Number(required('DB_PORT')),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
  },
});
