import { expect, test } from 'vitest';
import { readDatabaseConfig, readInitialSuperAdminEmail, readPort } from '../../src/config.js';

test('PORT validation rejects invalid values', () => {
  for (const value of ['', '0', '65536', '-1', '1.5', 'abc']) {
    expect(() => readPort(value)).toThrow(/PORT must be an integer/);
  }
});

test('PORT defaults to 3000 and accepts valid values', () => {
  expect(readPort(undefined)).toBe(3000);
  expect(readPort('8080')).toBe(8080);
});

const VALID_DATABASE = { host: '127.0.0.1', port: '3308', database: 'daeng_bo', user: 'bo', password: 'secret-value' };

test('database settings are parsed', () => {
  expect(readDatabaseConfig(VALID_DATABASE)).toEqual({ ...VALID_DATABASE, port: 3308 });
});

test('database settings name every missing or invalid variable without echoing values', () => {
  expect(() => readDatabaseConfig({ ...VALID_DATABASE, host: undefined, password: '' })).toThrow(
    /DB_HOST, DB_PASSWORD/
  );
  expect(() => readDatabaseConfig({ ...VALID_DATABASE, port: 'abc' })).toThrow(/DB_PORT/);
  expect(() => readDatabaseConfig({ ...VALID_DATABASE, port: 'abc', password: '' })).not.toThrow(/secret-value/);
});

test('initial super admin email is optional, normalized and validated', () => {
  expect(readInitialSuperAdminEmail(undefined)).toBeUndefined();
  expect(readInitialSuperAdminEmail('')).toBeUndefined();
  expect(readInitialSuperAdminEmail('Admin@Example.COM')).toBe('admin@example.com');
  expect(() => readInitialSuperAdminEmail('not-an-email')).toThrow(/INITIAL_SUPER_ADMIN_EMAIL/);
});
