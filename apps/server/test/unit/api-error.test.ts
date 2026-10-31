import { BadRequestException, NotFoundException } from '@nestjs/common';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { ApiException, ValidationFailedException } from '../../src/common/api-error.js';
import { causeChain, toErrorResponse } from '../../src/common/api-exception.filter.js';
import { ZodValidationPipe } from '../../src/common/zod-validation.pipe.js';

test('domain exception keeps its status and code', () => {
  expect(toErrorResponse(new ApiException(404, 'INQUIRY_NOT_FOUND', '문의를 찾을 수 없습니다.'))).toEqual({
    status: 404,
    body: { code: 'INQUIRY_NOT_FOUND', message: '문의를 찾을 수 없습니다.' },
  });
});

test('validation failure carries details', () => {
  const { status, body } = toErrorResponse(new ValidationFailedException([{ field: 'email', reason: '형식 오류' }]));
  expect(status).toBe(400);
  expect(body).toEqual({
    code: 'VALIDATION_FAILED',
    message: '입력값이 올바르지 않습니다.',
    details: [{ field: 'email', reason: '형식 오류' }],
  });
});

test('Nest built-in exceptions use the same shape', () => {
  expect(toErrorResponse(new NotFoundException()).body.code).toBe('NOT_FOUND');
  expect(toErrorResponse(new BadRequestException()).body.code).toBe('BAD_REQUEST');
});

test('unknown errors become INTERNAL_ERROR without leaking internals', () => {
  const { status, body } = toErrorResponse(new Error('db password is hunter2'));
  expect(status).toBe(500);
  expect(body).toEqual({ code: 'INTERNAL_ERROR', message: '서버에 문제가 생겼습니다.' });
});

test('zod pipe passes valid input and reports field reasons otherwise', () => {
  const pipe = new ZodValidationPipe(z.object({ name: z.string().min(1), age: z.number() }));
  expect(pipe.transform({ name: 'a', age: 1 })).toEqual({ name: 'a', age: 1 });
  try {
    pipe.transform({ name: '', age: 'x' });
    expect.unreachable();
  } catch (error) {
    const { body } = toErrorResponse(error);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details?.map((d) => d.field)).toEqual(['name', 'age']);
  }
});

test('zod pipe reports validation reasons in Korean', () => {
  const pipe = new ZodValidationPipe(z.object({ email: z.email() }));
  try {
    pipe.transform({ email: 'bad' });
    expect.unreachable();
  } catch (error) {
    expect(toErrorResponse(error).body.details).toEqual([{ field: 'email', reason: '잘못된 이메일 주소' }]);
  }
});

test('client errors from outside Nest keep their 4xx status', () => {
  const tooLarge = Object.assign(new Error('request entity too large'), { status: 413 });
  expect(toErrorResponse(tooLarge)).toEqual({
    status: 413,
    body: { code: 'BAD_REQUEST', message: '잘못된 요청입니다.' },
  });
});

test('causeChain lists wrapped causes with their codes', () => {
  const db = Object.assign(new Error("Table 'bo.notification' doesn't exist"), { code: 'ER_NO_SUCH_TABLE' });
  const query = new Error('Failed query', { cause: db });
  expect(causeChain(query)).toEqual(["Table 'bo.notification' doesn't exist (ER_NO_SUCH_TABLE)"]);
});
test('causeChain is empty without a cause and tolerates non-error causes', () => {
  expect(causeChain(new Error('x'))).toEqual([]);
  expect(causeChain('text')).toEqual([]);
  expect(causeChain(new Error('x', { cause: 'plain' }))).toEqual(['plain']);
});
