import { expect, test } from 'vitest';
// @ts-expect-error 배포 러너에서 쓰는 순수 JS 스크립트라 타입 선언이 없다.
import { REQUIRED_NAMES, findProblems, formatEnv, parseEnv } from '../../deploy/prepare-env.mjs';

const requiredLines = REQUIRED_NAMES.map((name: string) => `${name}=value`).join('\n');

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
  const text = requiredLines.replace('DB_HOST=value', 'DB_HOST=').replace('JAVA_API_KEY=value\n', '');
  const problems = findProblems(parseEnv(text));
  expect(problems).toHaveLength(2);
  expect(problems.join('\n')).toMatch(/DB_HOST/);
  expect(problems.join('\n')).toMatch(/JAVA_API_KEY/);
  expect(problems.join('\n')).not.toContain('value');
});

test('findProblems rejects DEV_LOGIN_ENABLED=true but allows false', () => {
  expect(findProblems(parseEnv(`${requiredLines}\nDEV_LOGIN_ENABLED=true`))).toHaveLength(1);
  expect(findProblems(parseEnv(`${requiredLines}\nDEV_LOGIN_ENABLED="true"`))).toHaveLength(1);
  expect(findProblems(parseEnv(`${requiredLines}\nDEV_LOGIN_ENABLED=false`))).toEqual([]);
});
