import { readFile } from 'node:fs/promises';
import { Ajv2019, type ValidateFunction } from 'ajv/dist/2019.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { expect } from 'vitest';
import { SPEC_PATH } from './paths.js';

const JSON_MEDIA = 'application/json';
const METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;

type Node = Record<string, unknown>;

/**
 * OpenAPI 3.0의 `nullable`을 JSON Schema로 옮긴다.
 * - `type`이 있으면 `type: [type, 'null']`
 * - `$ref`·`allOf`·`oneOf`·`anyOf`만 있으면 `anyOf: [원래 스키마, null]`
 */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value !== 'object' || value === null) return value;
  const node: Node = {};
  for (const [key, child] of Object.entries(value)) node[key] = normalize(child);
  if (node.nullable !== true) {
    delete node.nullable;
    return node;
  }
  const { nullable: _nullable, ...rest } = node;
  if (typeof rest.type === 'string') return { ...rest, type: [rest.type, 'null'] };
  if (rest.$ref || rest.allOf || rest.oneOf || rest.anyOf) return { anyOf: [rest, { type: 'null' }] };
  return rest;
}

const escapePointer = (segment: string) => segment.replaceAll('~', '~0').replaceAll('/', '~1');

export interface Operation {
  method: string;
  /** 명세에 적힌 경로 템플릿(예: `/auth/login`). 접두어(`/api/v0/admin`)는 뺀다. */
  path: string;
}

/** `packages/api-spec/openapi.yaml`의 응답 스키마로 실제 응답을 검사한다. */
export class OpenApiContract {
  private readonly cache = new Map<string, ValidateFunction>();

  private constructor(
    private readonly document: Node,
    private readonly ajv: Ajv2019
  ) {}

  static async load(): Promise<OpenApiContract> {
    const document = parse(await readFile(SPEC_PATH, 'utf8')) as Node;
    const ajv = new Ajv2019({ allErrors: true, strict: false, validateSchema: false });
    addFormats(ajv);
    ajv.addSchema(normalize(document) as object, 'spec');
    return new OpenApiContract(document, ajv);
  }

  responses(): Array<Operation & { status: string }> {
    const found: Array<Operation & { status: string }> = [];
    for (const [path, item] of Object.entries(this.document.paths as Record<string, Node>)) {
      for (const method of METHODS) {
        const responses = (item[method] as Node | undefined)?.responses as Record<string, Node> | undefined;
        for (const status of Object.keys(responses ?? {})) found.push({ method, path, status });
      }
    }
    return found;
  }

  /** 응답 본문을 검사해서 어긋난 내용을 사람이 읽을 수 있는 문장으로 돌려준다. 비어 있으면 일치한다. */
  check(operation: Operation, status: number, body: unknown): string[] {
    const located = this.locate(operation, String(status));
    if ('error' in located) return [located.error];
    if (located.pointer === undefined) {
      return body === undefined ? [] : [`${label(operation)} ${status}: 명세에는 응답 본문이 없는데 본문이 있습니다`];
    }
    if (body === undefined) return [`${label(operation)} ${status}: 명세에는 본문이 있는데 비어 있습니다`];
    const validate = this.compile(located.pointer);
    return validate(body)
      ? []
      : (validate.errors ?? []).map((e) => `${label(operation)} ${status}: ${e.instancePath || '(본문)'} ${e.message}`);
  }

  /** 컴포넌트 스키마 하나(예: `Error`)로 본문을 검사한다. 명세에 개별 API 응답으로는 적히지 않은 공통 오류용이다. */
  checkSchema(name: string, body: unknown): string[] {
    const validate = this.compile(`#/components/schemas/${escapePointer(name)}`);
    return validate(body)
      ? []
      : (validate.errors ?? []).map((e) => `${name}: ${e.instancePath || '(본문)'} ${e.message}`);
  }

  compileAll(): string[] {
    const problems: string[] = [];
    for (const { method, path, status } of this.responses()) {
      const located = this.locate({ method, path }, status);
      if ('error' in located) {
        problems.push(located.error);
        continue;
      }
      if (located.pointer === undefined) continue;
      try {
        this.compile(located.pointer);
      } catch (error) {
        problems.push(
          `${label({ method, path })} ${status}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    return problems;
  }

  private compile(pointer: string): ValidateFunction {
    let validate = this.cache.get(pointer);
    if (!validate) {
      // 최상위에서 명세에 없는 필드를 막는다(중첩 객체는 검사하지 않는다).
      validate = this.ajv.compile({ allOf: [{ $ref: `spec${pointer}` }], unevaluatedProperties: false });
      this.cache.set(pointer, validate);
    }
    return validate;
  }

  /** 응답 정의 위치(JSON 포인터)를 찾는다. 본문이 없는 응답은 `pointer`가 undefined다. */
  private locate(operation: Operation, status: string): { pointer: string | undefined } | { error: string } {
    const path = (this.document.paths as Record<string, Node>)[operation.path];
    const op = path?.[operation.method.toLowerCase()] as Node | undefined;
    if (!op) return { error: `${label(operation)}: 명세에 없는 API입니다` };

    const responses = op.responses as Record<string, Node>;
    const key = status in responses ? status : 'default' in responses ? 'default' : undefined;
    if (key === undefined) {
      return {
        error: `${label(operation)} ${status}: 명세에 없는 상태 코드입니다(정의된 것: ${Object.keys(responses).join(', ')})`,
      };
    }

    let base = `#/paths/${escapePointer(operation.path)}/${operation.method.toLowerCase()}/responses/${key}`;
    let response = responses[key];
    while (typeof response.$ref === 'string') {
      base = response.$ref;
      response = base
        .slice(2)
        .split('/')
        .reduce<unknown>(
          (current, part) => (current as Node)[part.replaceAll('~1', '/').replaceAll('~0', '~')],
          this.document
        ) as Node;
    }
    const content = response.content as Record<string, Node> | undefined;
    if (!content?.[JSON_MEDIA]) return { pointer: undefined };
    return { pointer: `${base}/content/${escapePointer(JSON_MEDIA)}/schema` };
  }
}

const label = (operation: Operation) => `${operation.method.toUpperCase()} ${operation.path}`;

export async function expectMatchesSpec(
  contract: OpenApiContract,
  response: Response,
  operation: Operation
): Promise<void> {
  const text = await response.clone().text();
  const body = text === '' ? undefined : (JSON.parse(text) as unknown);
  expect(contract.check(operation, response.status, body), `명세와 다른 응답:\n${text}`).toEqual([]);
}
