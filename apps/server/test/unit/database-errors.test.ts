import { describe, expect, test } from 'vitest';
import { isTransientDatabaseError } from '../../src/database/errors.js';

const withCode = (code: string, message = code) => Object.assign(new Error(message), { code });
/** drizzle은 mysql2 에러를 한 겹 감싸고 원인을 `cause`에 둔다. */
const wrapped = (cause: Error) => new Error('Failed query', { cause });

describe('isTransientDatabaseError', () => {
  test.each([
    'PROTOCOL_CONNECTION_LOST',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'ER_LOCK_DEADLOCK',
    'ER_LOCK_WAIT_TIMEOUT',
  ])('treats %s as worth retrying', (code) => {
    expect(isTransientDatabaseError(withCode(code))).toBe(true);
  });

  test('finds the code on the wrapped cause', () => {
    expect(isTransientDatabaseError(wrapped(withCode('PROTOCOL_CONNECTION_LOST')))).toBe(true);
    expect(isTransientDatabaseError(wrapped(wrapped(withCode('ER_LOCK_DEADLOCK'))))).toBe(true);
  });

  test('does not retry errors that would fail the same way again', () => {
    expect(isTransientDatabaseError(withCode('ER_DUP_ENTRY'))).toBe(false);
    expect(isTransientDatabaseError(withCode('ER_BAD_FIELD_ERROR'))).toBe(false);
    expect(isTransientDatabaseError(wrapped(withCode('ER_NO_SUCH_TABLE')))).toBe(false);
    expect(isTransientDatabaseError(new Error('Change log actor must have a completed profile'))).toBe(false);
    expect(isTransientDatabaseError('connection lost')).toBe(false);
    expect(isTransientDatabaseError(undefined)).toBe(false);
  });
});
