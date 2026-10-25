import 'reflect-metadata';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { afterAll, beforeAll, test } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { JOB_ROLES } from '@daeng/shared';
import { AppModule } from '../../dist/app.module.js';

// 서버는 시작할 때 DB 설정을 요구한다. 연결은 처음 쿼리할 때 하므로 가짜 값이면 충분하다.
Object.assign(process.env, {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_NAME: 'smoke',
  DB_USER: 'smoke',
  DB_PASSWORD: 'smoke',
  INITIAL_SUPER_ADMIN_EMAIL: '',
});

let app;
let baseUrl;

beforeAll(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await app?.close();
});

test('health endpoint responds', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('unknown route returns the common error shape', async () => {
  const response = await fetch(`${baseUrl}/no-such-path`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { code: 'NOT_FOUND', message: '요청한 대상을 찾을 수 없습니다.' });
});

test('oversized request body is a client error, not a server error', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'x'.repeat(200_000) }),
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, 'BAD_REQUEST');
});

test('invalid PORT prevents the server from starting', () => {
  const result = spawnSync(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: 'invalid' },
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /PORT must be an integer/);
});

test('server can import the shared package', () => {
  assert.ok(JOB_ROLES.includes('BE'));
});

test('server starts and stops on SIGTERM', async () => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));

  const child = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });

  try {
    let response;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/health`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    assert.equal(response?.status, 200);
    child.kill('SIGTERM');
    const [code, signal] = await once(child, 'exit');
    assert.equal(signal, 'SIGTERM');
    assert.equal(code, null);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
});
