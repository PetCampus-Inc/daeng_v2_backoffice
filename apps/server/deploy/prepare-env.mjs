// 배포 러너에서 Infisical이 만든 .env를 docker run --env-file이 읽는 형태로 정리하고 검증한다.
//   node apps/server/deploy/prepare-env.mjs [.env 경로]
// 오류 메시지에는 값을 넣지 않는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_NAMES = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'SERVICE_DB_HOST',
  'SERVICE_DB_PORT',
  'SERVICE_DB_NAME',
  'SERVICE_DB_USER',
  'SERVICE_DB_PASSWORD',
  'JAVA_API_BASE_URL',
  'JAVA_API_KEY',
  'INQUIRY_IMAGE_BASE_URL',
  'GOOGLE_CLIENT_ID',
  'ALLOWED_ORIGINS',
];

const LINE_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

// docker run --env-file은 값을 감싼 따옴표를 벗기지 않으므로 KEY=VALUE 형태로 정리한다.
export function parseEnv(text) {
  const entries = [];
  const invalidLines = [];
  text.split('\n').forEach((raw, index) => {
    const line = raw.replace(/\r$/, '');
    if (line.trim() === '' || line.trimStart().startsWith('#')) return;
    const match = LINE_PATTERN.exec(line);
    if (!match) {
      invalidLines.push(index + 1);
      return;
    }
    let [, key, value] = match;
    if (value.length >= 2 && value[0] === value.at(-1) && (value[0] === "'" || value[0] === '"')) {
      value = value.slice(1, -1);
    }
    entries.push([key, value]);
  });
  return { entries, invalidLines };
}

export function findProblems({ entries, invalidLines }) {
  const problems = invalidLines.map((line) => `${line}번째 줄이 KEY=VALUE 형식이 아닙니다`);
  const values = new Map(entries);
  for (const name of REQUIRED_NAMES) {
    if (!values.get(name)) problems.push(`Infisical prod에 ${name}이 없거나 비어 있습니다`);
  }
  // 운영에서는 개발용 로그인을 켜지 않는다.
  if (values.get('DEV_LOGIN_ENABLED') === 'true') {
    problems.push('운영 환경에서 DEV_LOGIN_ENABLED=true는 사용할 수 없습니다');
  }
  return problems;
}

export function formatEnv(entries) {
  return entries.map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
}

function main(path) {
  const parsed = parseEnv(readFileSync(path, 'utf8'));
  const problems = findProblems(parsed);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`::error::${problem}`);
    process.exitCode = 1;
    return;
  }
  writeFileSync(path, formatEnv(parsed.entries), 'utf8');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2] ?? '.env');
}
