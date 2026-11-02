import { fileURLToPath } from 'node:url';

/** 명세 파일. 경로를 세지 않고 `@daeng/api-spec` 패키지로 찾는다(서버 소스(`src/docs.ts`)와 같은 방식). */
export const SPEC_PATH = fileURLToPath(import.meta.resolve('@daeng/api-spec/openapi.yaml'));

/** 저장소 루트의 `turbo.json`. 루트에는 패키지가 없어서 위치로 찾는다. */
export const TURBO_JSON_PATH = fileURLToPath(new URL('../../../../turbo.json', import.meta.url));
