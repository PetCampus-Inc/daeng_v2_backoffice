import { beforeAll, describe, expect, test } from 'vitest';
import { OpenApiContract } from '../support/openapi-contract.js';

const LOGIN = { method: 'post', path: '/auth/login' };
const account = {
  id: 1,
  email: 'a@example.com',
  googleName: '구글',
  displayName: null,
  jobRole: null,
  role: 'OPERATOR',
  isProfileCompleted: false,
};

describe('OpenAPI contract checker', () => {
  let contract: OpenApiContract;
  beforeAll(async () => {
    contract = await OpenApiContract.load();
  });

  test('every response schema in the spec can be checked', () => {
    expect(contract.compileAll()).toEqual([]);
    expect(contract.responses().length).toBeGreaterThan(100);
  });

  test('accepts a response that matches the spec, including null for nullable fields', () => {
    expect(contract.check(LOGIN, 200, account)).toEqual([]);
    expect(
      contract.check(LOGIN, 200, { ...account, displayName: '홍길동', jobRole: 'FULL_STACK', isProfileCompleted: true })
    ).toEqual([]);
    expect(contract.check({ method: 'post', path: '/auth/logout' }, 204, undefined)).toEqual([]);
  });

  test('rejects missing, mistyped, unknown and invalid-enum fields', () => {
    const { email: _email, ...withoutEmail } = account;
    expect(contract.check(LOGIN, 200, withoutEmail).join('\n')).toMatch(/email/);
    expect(contract.check(LOGIN, 200, { ...account, id: '1' }).join('\n')).toMatch(/\/id/);
    expect(contract.check(LOGIN, 200, { ...account, displayName: undefined })).not.toEqual([]);
    expect(contract.check(LOGIN, 200, { ...account, role: 'ADMIN' }).join('\n')).toMatch(/role/);
    expect(contract.check(LOGIN, 200, { ...account, jobRole: 'UX/UI' }).join('\n')).toMatch(/jobRole/);
    expect(contract.check(LOGIN, 200, { ...account, extra: true }).join('\n')).toMatch(/extra|additional|unevaluated/i);
  });

  test('rejects undocumented operations, status codes and bodies', () => {
    expect(contract.check({ method: 'get', path: '/nope' }, 200, {}).join('\n')).toMatch(/명세에 없는 API/);
    expect(contract.check(LOGIN, 418, {}).join('\n')).toMatch(/명세에 없는 상태 코드/);
    expect(contract.check({ method: 'post', path: '/auth/logout' }, 204, { a: 1 }).join('\n')).toMatch(/본문이 없는데/);
    expect(contract.check(LOGIN, 200, undefined).join('\n')).toMatch(/비어 있습니다/);
  });

  test('checks error bodies against the error schemas, including their code lists', () => {
    expect(contract.check(LOGIN, 401, { code: 'INVALID_ID_TOKEN', message: 'x' })).toEqual([]);
    expect(contract.check(LOGIN, 401, { code: 'SOMETHING_ELSE', message: 'x' })).not.toEqual([]);
    expect(contract.checkSchema('Error', { code: 'NOT_FOUND', message: 'x' })).toEqual([]);
    expect(contract.checkSchema('Error', { code: 'NOT_FOUND' })).not.toEqual([]);
  });
});
