import { defineConfig, type InputTransformerFn } from 'orval';

/**
 * 서버 OpenAPI 명세(`packages/api-spec/openapi.yaml`)로 요청 함수·타입·TanStack Query 훅을 만든다.
 * 작업의 태그를 쓰는 라우트 이름으로 바꾼 뒤 한 번에 만든다. orval은 훅을 `src/api/<라우트>.ts`에,
 * 라우트 전용 타입을 `src/type/<라우트>/`에 쓰고 여러 라우트가 쓰는 타입은 `src/type/` 바로 아래에 쓴다.
 * 끝나면 `scripts/place-generated-files.mjs`가 훅과 전용 타입을 각 라우트의 `api/`, `type/` 폴더로 옮기고
 * 생성 파일의 포맷을 커밋 때 적용되는 모양으로 맞춘다.
 * 요청은 공용 axios 인스턴스(`src/api/mutator.ts`)로 보낸다.
 */

const SPEC_PATH = '../../packages/api-spec/openapi.yaml';

/** 작업이 어느 라우트의 것인지 가려내는 조건. 경로와 작업의 원래 태그를 받는다. */
type OperationMatcher = (path: string, tags: string[]) => boolean;

/** 원래 태그가 `tags` 중 하나인 작업. 스펙의 태그가 라우트와 맞을 때 쓴다. */
const byTags =
  (tags: string[]): OperationMatcher =>
  (_path, operationTags) =>
    operationTags.some((tag) => tags.includes(tag));

/** 경로가 `pathPrefix`로 시작하는 작업. 한 태그를 여러 라우트가 나눠 쓸 때 쓴다. */
const byPathPrefix =
  (pathPrefix: string): OperationMatcher =>
  (path) =>
    path.startsWith(pathPrefix);

/** 라우트의 작업을 가려내는 조건과, 훅 파일을 옮겨 둘 그 라우트의 `api/` 폴더. */
interface Route {
  isTarget: OperationMatcher;
  apiDir: string;
}

/** `src/routes/<이름>/api` */
const routeApiDir = (name: string) => `src/routes/${name}/api`;

/**
 * 라우트 이름 → 라우트 정보. 이 이름이 orval이 처음 쓰는 훅 파일명과 타입 폴더명이 되므로,
 * `src/api/`에 직접 쓴 파일(`account.ts`, `auth.ts` 등)과 겹치지 않게 짓는다.
 */
const ROUTES: Record<string, Route> = {
  // 로그인, 내 계정(사이드바·상단바·프로필 설정·홈)을 여러 라우트가 함께 쓴다. 훅은 `src/api/`에, 타입은 `src/type/`에 둔다.
  'my-account': { isTarget: byTags(['개발용', '인증', '내 계정']), apiDir: 'src/api' },
  'team-members': { isTarget: byTags(['팀원·권한']), apiDir: routeApiDir('settings/members') },
  inquiries: { isTarget: byTags(['1:1 문의']), apiDir: routeApiDir('inquiries') },
  ideas: { isTarget: byTags(['아이디어 제안']), apiDir: routeApiDir('ideas') },
  history: { isTarget: byTags(['변경 이력']), apiDir: routeApiDir('history') },
  notices: { isTarget: byTags(['앱 공지']), apiDir: routeApiDir('notices') },
  terms: { isTarget: byTags(['이용약관']), apiDir: routeApiDir('terms') },
  notifications: {
    isTarget: byTags(['알림 센터']),
    apiDir: 'src/routes/app/ui/top-bar/ui/notification-center/api',
  },
  // `홈·고객 관리` 태그는 4개 라우트가 나눠 쓰므로 경로로 나눈다.
  home: { isTarget: byPathPrefix('/service-admin/overview'), apiDir: routeApiDir('home') },
  members: { isTarget: byPathPrefix('/service-admin/members'), apiDir: routeApiDir('members') },
  kindergartens: { isTarget: byPathPrefix('/service-admin/schools'), apiDir: routeApiDir('kindergartens') },
  'owner-verifications': {
    isTarget: byPathPrefix('/service-admin/verifications'),
    apiDir: routeApiDir('owner-verifications'),
  },
};

/** 생성이 끝나면 훅과 라우트 전용 타입을 각 라우트 폴더로 옮기는 명령. */
const PLACE_FILES_COMMAND = `node scripts/place-generated-files.mjs ${Object.entries(ROUTES)
  .map(([name, { apiDir }]) => `${name}=${apiDir}`)
  .join(' ')}`;

/** 경로 항목 값이 작업인지 가린다. 경로 항목에는 작업 말고 `parameters` 같은 값도 들어 있다. */
const isOperation = (value: unknown): value is { operationId: string; tags?: string[] } =>
  typeof value === 'object' && value !== null && 'operationId' in value && typeof value.operationId === 'string';

/** 라우트에 속한 작업의 태그를 라우트 이름으로 바꾼다. 어느 라우트에도 없는 작업은 그대로 둔다. */
const tagOperationsByRoute: InputTransformerFn = (spec) => {
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (!isOperation(operation)) {
        continue;
      }
      const route = Object.keys(ROUTES).find((name) => ROUTES[name].isTarget(path, operation.tags ?? []));
      if (route) {
        operation.tags = [route];
      }
    }
  }
  return spec;
};

export default defineConfig({
  api: {
    input: {
      target: SPEC_PATH,
      filters: { tags: Object.keys(ROUTES) },
      override: { transformer: tagOperationsByRoute },
    },
    output: {
      mode: 'tags',
      target: 'src/api',
      schemas: { path: 'src/type', splitByTags: true },
      namingConvention: 'kebab-case',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        query: { version: 5 },
        mutator: {
          path: 'src/api/mutator.ts',
          name: 'customInstance',
        },
      },
    },
    hooks: { afterAllFilesWrite: PLACE_FILES_COMMAND },
  },
});
