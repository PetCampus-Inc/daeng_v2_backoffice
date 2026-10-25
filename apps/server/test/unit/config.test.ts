import { expect, test } from 'vitest';
import { readApiDocsEnabled, readPort } from '../../src/config.js';

test('PORT validation rejects invalid values', () => {
  for (const value of ['', '0', '65536', '-1', '1.5', 'abc']) {
    expect(() => readPort(value)).toThrow(/PORT must be an integer/);
  }
});

test('PORT defaults to 3000 and accepts valid values', () => {
  expect(readPort(undefined)).toBe(3000);
  expect(readPort('8080')).toBe(8080);
});

test('API docs are disabled by default and only accept "true" or "false"', () => {
  expect(readApiDocsEnabled(undefined)).toBe(false);
  expect(readApiDocsEnabled('false')).toBe(false);
  expect(readApiDocsEnabled('true')).toBe(true);
  for (const value of ['', '1', '0', 'TRUE', 'yes', 'maybe']) {
    expect(() => readApiDocsEnabled(value)).toThrow(/API_DOCS_ENABLED must be/);
  }
});
