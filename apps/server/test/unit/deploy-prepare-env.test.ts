import { expect, test } from 'vitest';
// @ts-expect-error 배포 러너에서 쓰는 순수 JS 스크립트라 타입 선언이 없다.
import { REQUIRED_NAMES, findProblems, formatEnv, parseEnv } from '../../deploy/prepare-env.mjs';

const validValues: Record<string, string> = {
  DB_HOST: 'mysql',
  SERVICE_DB_HOST: 'mysql',
  ALLOWED_ORIGINS: 'https://bo.example.com',
};
const requiredLines = REQUIRED_NAMES.map((name: string) => `${name}=${validValues[name] ?? 'secret-x'}`).join('\n');
const withLine = (name: string, line: string) => requiredLines.replace(new RegExp(`^${name}=.*$`, 'm'), line);

test('parseEnv strips wrapping quotes and skips comments and blank lines', () => {
  const { entries, invalidLines } = parseEnv(`# comment\nA='x y'\nB="q"\nC=plain\n\nD=\nE='unterminated\n`);
  expect(invalidLines).toEqual([]);
  expect(entries).toEqual([
    ['A', 'x y'],
    ['B', 'q'],
    ['C', 'plain'],
    ['D', ''],
    ['E', "'unterminated"],
  ]);
});

test('parseEnv reports the line number of malformed lines without their content', () => {
  const { invalidLines } = parseEnv('A=1\nBAD LINE\n=novalue\n');
  expect(invalidLines).toEqual([2, 3]);
});

test('formatEnv writes plain KEY=VALUE lines with a trailing newline', () => {
  expect(
    formatEnv([
      ['A', 'x y'],
      ['B', ''],
    ])
  ).toBe('A=x y\nB=\n');
});

test('findProblems passes when every required name has a value', () => {
  expect(findProblems(parseEnv(requiredLines))).toEqual([]);
});

test('findProblems names missing and empty required values but never prints values', () => {
  const text = withLine('DB_HOST', 'DB_HOST=').replace('JAVA_API_KEY=secret-x\n', '');
  const problems = findProblems(parseEnv(text));
  expect(problems).toHaveLength(2);
  expect(problems.join('\n')).toMatch(/DB_HOST/);
  expect(problems.join('\n')).toMatch(/JAVA_API_KEY/);
  expect(problems.join('\n')).not.toContain('secret-x');
});

test('findProblems rejects DEV_LOGIN_ENABLED=true but allows false', () => {
  expect(findProblems(parseEnv(`${requiredLines}\nDEV_LOGIN_ENABLED=true`))).toHaveLength(1);
  expect(findProblems(parseEnv(`${requiredLines}\nDEV_LOGIN_ENABLED="true"`))).toHaveLength(1);
  expect(findProblems(parseEnv(`${requiredLines}\nDEV_LOGIN_ENABLED=false`))).toEqual([]);
});

test('findProblems rejects values wrapped in literal quotes without printing them', () => {
  const problems = findProblems(parseEnv(withLine('ALLOWED_ORIGINS', `ALLOWED_ORIGINS='"https://bo.example.com"'`)));
  expect(problems.join('\n')).toMatch(/ALLOWED_ORIGINS/);
  expect(problems.join('\n')).not.toContain('bo.example.com');
});

test('findProblems accepts passwords that start or end with a quote', () => {
  expect(findProblems(parseEnv(withLine('DB_PASSWORD', `DB_PASSWORD='"pw"'`)))).toEqual([]);
});

test('findProblems rejects database hosts that point to the container itself', () => {
  for (const host of ['127.0.0.1', 'localhost', '::1']) {
    expect(findProblems(parseEnv(withLine('DB_HOST', `DB_HOST=${host}`)))).toHaveLength(1);
    expect(findProblems(parseEnv(withLine('SERVICE_DB_HOST', `SERVICE_DB_HOST=${host}`)))).toHaveLength(1);
  }
});

test('findProblems checks the ALLOWED_ORIGINS format the server requires', () => {
  const origins = (value: string) => findProblems(parseEnv(withLine('ALLOWED_ORIGINS', `ALLOWED_ORIGINS=${value}`)));
  expect(origins('https://a.example.com, http://localhost:5173')).toEqual([]);
  expect(origins('https://a.example.com/')).toHaveLength(1);
  expect(origins('https://a.example.com/path')).toHaveLength(1);
  expect(origins('a.example.com')).toHaveLength(1);
});
