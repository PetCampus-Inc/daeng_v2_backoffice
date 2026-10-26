import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { loadOpenApiDocument } from '../../src/docs.js';
import { SPEC_PATH as REAL_SPEC } from '../support/paths.js';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'daeng-docs-'));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

test('loads the real API spec', async () => {
  const document = await loadOpenApiDocument(REAL_SPEC);
  expect(document.openapi).toMatch(/^3\./);
  expect(Object.keys(document.paths).length).toBeGreaterThan(0);
});

test('fails when the file does not exist', async () => {
  await expect(loadOpenApiDocument(join(dir, 'missing.yaml'))).rejects.toThrow(/could not be read/);
});

test('fails when the file is not valid YAML', async () => {
  const file = join(dir, 'broken.yaml');
  await writeFile(file, 'openapi: [unclosed\n  - x: : :');
  await expect(loadOpenApiDocument(file)).rejects.toThrow(/could not be parsed/);
});

test('fails when the file is not an OpenAPI 3 document', async () => {
  const notOpenApi = join(dir, 'plain.yaml');
  await writeFile(notOpenApi, 'name: not-an-api\n');
  await expect(loadOpenApiDocument(notOpenApi)).rejects.toThrow(/Not an OpenAPI 3 document/);

  const swagger2 = join(dir, 'swagger2.yaml');
  await writeFile(swagger2, "openapi: '2.0'\npaths: {}\n");
  await expect(loadOpenApiDocument(swagger2)).rejects.toThrow(/Not an OpenAPI 3 document/);
});
