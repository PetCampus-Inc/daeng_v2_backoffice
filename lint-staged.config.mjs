/**
 * 커밋 전 검사. 커밋하는 파일만 oxfmt로 정리하고, web 파일은 oxlint로 검사한다.
 * @type {import('lint-staged').Configuration}
 */
export default {
  '*': 'oxfmt --no-error-on-unmatched-pattern',
  'apps/web/**/*.{ts,tsx,js,jsx}': (files) =>
    `pnpm --filter @daeng/web exec oxlint --fix ${files.map((file) => JSON.stringify(file)).join(' ')}`,
};
