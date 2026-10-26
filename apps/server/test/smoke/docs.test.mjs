import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { afterAll, afterEach, beforeAll, test } from 'vitest';

// 서버는 시작할 때 DB 설정을 요구한다. 연결은 처음 쿼리할 때 하므로 가짜 값이면 충분하다.
Object.assign(process.env, {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_NAME: 'smoke',
  DB_USER: 'smoke',
  DB_PASSWORD: 'smoke',
  INITIAL_SUPER_ADMIN_EMAIL: '',
  GOOGLE_CLIENT_ID: 'smoke.apps.googleusercontent.com',
  ALLOWED_ORIGINS: 'http://localhost:5173',
  COOKIE_SECURE: 'false',
});

const MAIN = resolve(fileURLToPath(new URL('../../dist/main.js', import.meta.url)));
const SPEC = fileURLToPath(import.meta.resolve('@daeng/api-spec/openapi.yaml'));
const children = new Set();
let emptyDir;

beforeAll(async () => {
  emptyDir = await mkdtemp(resolve(tmpdir(), 'daeng-docs-smoke-'));
});

afterAll(async () => {
  await rm(emptyDir, { recursive: true, force: true });
});

afterEach(async () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
  }
  children.clear();
});

async function freePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((done, fail) => probe.close((error) => (error ? fail(error) : done())));
  return port;
}

async function startServer(env = {}, cwd = emptyDir) {
  const port = await freePort();
  const child = spawn(process.execPath, [MAIN], {
    cwd,
    env: { ...process.env, API_DOCS_ENABLED: undefined, PORT: String(port), ...env },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  children.add(child);
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`server exited early: ${stderr}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return { baseUrl: `http://127.0.0.1:${port}`, child };
    } catch {
      await new Promise((done) => setTimeout(done, 100));
    }
  }
  throw new Error(`server did not start: ${stderr}`);
}

test('API docs are not served by default', async () => {
  const { baseUrl } = await startServer();
  for (const path of ['/docs', '/docs-json', '/docs-yaml']) {
    assert.equal((await fetch(baseUrl + path)).status, 404, path);
  }
});

test('API docs are served from the spec YAML when enabled', async () => {
  const { baseUrl } = await startServer({ API_DOCS_ENABLED: 'true' });
  const page = await fetch(`${baseUrl}/docs`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') ?? '', /text\/html/);

  const served = await (await fetch(`${baseUrl}/docs-json`)).json();
  const original = parse(await readFile(SPEC, 'utf8'));
  assert.deepEqual(Object.keys(served.paths), Object.keys(original.paths));
  assert.equal(served.info.title, original.info.title);
  assert.equal((await fetch(`${baseUrl}/docs-yaml`)).status, 404);
});

test('API docs allow "Try it out" and do not call external addresses', async () => {
  const { baseUrl } = await startServer({ API_DOCS_ENABLED: 'true' });
  const init = await (await fetch(`${baseUrl}/docs/swagger-ui-init.js`)).text();
  assert.doesNotMatch(init, /supportedSubmitMethods[^[]*\[\s*\]/);
  assert.deepEqual(init.match(/https?:\/\/[^"'\s)]+/g) ?? [], []);
});

test('API docs open when the server starts outside the repository root', async () => {
  const { baseUrl } = await startServer({ API_DOCS_ENABLED: 'true' }, tmpdir());
  assert.equal((await fetch(`${baseUrl}/docs`)).status, 200);
  const served = await (await fetch(`${baseUrl}/docs-json`)).json();
  assert.ok(Object.keys(served.paths).length > 0);
});

test('an invalid API_DOCS_ENABLED value prevents the server from starting', async () => {
  const child = spawn(process.execPath, [MAIN], {
    env: { ...process.env, API_DOCS_ENABLED: 'maybe', PORT: String(await freePort()) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  children.add(child);
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(stderr, /API_DOCS_ENABLED must be/);
});

test('API docs can be enabled from a .env file in the working directory', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'daeng-docs-env-'));
  try {
    await writeFile(resolve(dir, '.env'), 'API_DOCS_ENABLED=true\n');
    const { baseUrl } = await startServer({}, dir);
    assert.equal((await fetch(`${baseUrl}/docs`)).status, 200);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a shell environment variable wins over the .env file', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'daeng-docs-env-'));
  try {
    await writeFile(resolve(dir, '.env'), 'API_DOCS_ENABLED=true\n');
    const { baseUrl } = await startServer({ API_DOCS_ENABLED: 'false' }, dir);
    assert.equal((await fetch(`${baseUrl}/docs`)).status, 404);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
