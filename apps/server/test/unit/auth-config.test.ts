import { expect, test } from 'vitest';
import {
  readAllowedOrigins,
  readCookieSameSite,
  readCookieSecure,
  readDevLoginEnabled,
  readGoogleClientId,
} from '../../src/auth/auth.config.js';

test('GOOGLE_CLIENT_ID is required', () => {
  expect(readGoogleClientId(' abc.apps.googleusercontent.com ')).toBe('abc.apps.googleusercontent.com');
  for (const value of [undefined, '', '   ']) {
    expect(() => readGoogleClientId(value)).toThrow(/GOOGLE_CLIENT_ID/);
  }
});

test('ALLOWED_ORIGINS accepts comma-separated origins and rejects anything else', () => {
  expect(readAllowedOrigins('http://localhost:5173')).toEqual(['http://localhost:5173']);
  expect(readAllowedOrigins(' http://localhost:5173 , https://bo.example.com ')).toEqual([
    'http://localhost:5173',
    'https://bo.example.com',
  ]);
  for (const value of [
    undefined,
    '',
    ',',
    'localhost:5173',
    'http://localhost:5173/',
    'http://localhost:5173/path',
    'ftp://x.com',
  ]) {
    expect(() => readAllowedOrigins(value)).toThrow(/ALLOWED_ORIGINS/);
  }
});

test('COOKIE_SECURE defaults to the safe value', () => {
  expect(readCookieSecure(undefined)).toBe(true);
  expect(readCookieSecure('')).toBe(true);
  expect(readCookieSecure('true')).toBe(true);
  expect(readCookieSecure('false')).toBe(false);
  for (const value of ['1', 'TRUE', 'yes']) {
    expect(() => readCookieSecure(value)).toThrow(/COOKIE_SECURE/);
  }
});

test('dev login is off by default and only allowed without Secure cookies (local development)', () => {
  expect(readDevLoginEnabled(undefined, true)).toBe(false);
  expect(readDevLoginEnabled('', true)).toBe(false);
  expect(readDevLoginEnabled('false', true)).toBe(false);
  expect(readDevLoginEnabled('true', false)).toBe(true);
  expect(() => readDevLoginEnabled('true', true)).toThrow(/COOKIE_SECURE=false/);
  for (const value of ['1', 'TRUE', 'yes']) {
    expect(() => readDevLoginEnabled(value, false)).toThrow(/DEV_LOGIN_ENABLED/);
  }
});

test('COOKIE_SAME_SITE defaults to lax and allows none only with Secure cookies', () => {
  expect(readCookieSameSite(undefined, true)).toBe('lax');
  expect(readCookieSameSite('', false)).toBe('lax');
  expect(readCookieSameSite('lax', false)).toBe('lax');
  expect(readCookieSameSite('none', true)).toBe('none');
  expect(() => readCookieSameSite('none', false)).toThrow(/COOKIE_SECURE=true/);
  for (const value of ['Lax', 'NONE', 'strict', 'None; Secure']) {
    expect(() => readCookieSameSite(value, true)).toThrow(/COOKIE_SAME_SITE/);
  }
});
