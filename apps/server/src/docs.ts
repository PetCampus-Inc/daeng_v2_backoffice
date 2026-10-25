import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const DOCS_PATH = 'docs';

function resolveApiSpecPath(): string {
  return fileURLToPath(import.meta.resolve('@daeng/api-spec/openapi.yaml'));
}

function isOpenApiDocument(value: unknown): value is OpenAPIObject {
  if (typeof value !== 'object' || value === null) return false;
  const { openapi, paths } = value as { openapi?: unknown; paths?: unknown };
  return typeof openapi === 'string' && openapi.startsWith('3.') && typeof paths === 'object' && paths !== null;
}

export async function loadOpenApiDocument(filePath: string = resolveApiSpecPath()): Promise<OpenAPIObject> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (cause) {
    throw new Error(`OpenAPI file could not be read: ${filePath}`, { cause });
  }

  let document: unknown;
  try {
    document = parse(text);
  } catch (cause) {
    throw new Error(`OpenAPI file could not be parsed: ${filePath}`, { cause });
  }

  if (!isOpenApiDocument(document)) throw new Error(`Not an OpenAPI 3 document: ${filePath}`);
  return document;
}

export async function setupApiDocs(app: INestApplication, document: OpenAPIObject): Promise<void> {
  const { SwaggerModule } = await import('@nestjs/swagger');
  SwaggerModule.setup(DOCS_PATH, app, document, {
    customSiteTitle: 'BO API 명세',
    raw: ['json'],
    // Try it out 끔
    swaggerOptions: { supportedSubmitMethods: [], validatorUrl: null },
  });
}
