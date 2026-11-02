import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { loadEnvFile } from '../../src/env.js';

const NAMES = ['DAENG_ENV_TEST_A', 'DAENG_ENV_TEST_B'];
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'daeng-env-'));
});

afterEach(() => {
  for (const name of NAMES) delete process.env[name];
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

test('reads variables from the env file', async () => {
  const file = join(dir, 'a.env');
  await writeFile(file, 'DAENG_ENV_TEST_A=from-file\n');
  expect(loadEnvFile(file)).toBe(true);
  expect(process.env.DAENG_ENV_TEST_A).toBe('from-file');
});

test('does not overwrite variables that are already set', async () => {
  const file = join(dir, 'b.env');
  await writeFile(file, 'DAENG_ENV_TEST_A=from-file\nDAENG_ENV_TEST_B=from-file\n');
  process.env.DAENG_ENV_TEST_A = 'from-shell';
  expect(loadEnvFile(file)).toBe(true);
  expect(process.env.DAENG_ENV_TEST_A).toBe('from-shell');
  expect(process.env.DAENG_ENV_TEST_B).toBe('from-file');
});

test('does nothing when the env file does not exist', () => {
  expect(loadEnvFile(join(dir, 'missing.env'))).toBe(false);
  expect(process.env.DAENG_ENV_TEST_A).toBeUndefined();
});
