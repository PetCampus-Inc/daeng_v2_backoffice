import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const SRC = new URL('../../src/', import.meta.url);
const TURBO = new URL('../../../../turbo.json', import.meta.url);

function readEnvNames(): string[] {
  const names = new Set<string>();
  for (const file of readdirSync(SRC, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.ts')) continue;
    for (const match of readFileSync(new URL(file, SRC), 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
}

// Turbo는 선언하지 않은 환경 변수를 서버에 넘기지 않아서, 빠지면 설정을 줘도 기본값으로 시작한다.
test('every environment variable the server reads is passed through the turbo dev task', () => {
  const turbo = JSON.parse(readFileSync(TURBO, 'utf8')) as { tasks: { dev: { passThroughEnv?: string[] } } };
  const passed = turbo.tasks.dev.passThroughEnv ?? [];
  const names = readEnvNames();
  expect(names).toContain('PORT');
  expect(names).toContain('API_DOCS_ENABLED');
  expect(names).toContain('DB_PASSWORD');
  expect(names).toContain('INITIAL_SUPER_ADMIN_EMAIL');
  expect(names.filter((name) => !passed.includes(name))).toEqual([]);
});
