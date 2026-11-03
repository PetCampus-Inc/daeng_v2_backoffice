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

// 비밀번호·키는 따옴표로 시작하거나 끝나는 값이 있을 수 있어 따옴표 검사에서 뺀다.
const PLAIN_NAMES = REQUIRED_NAMES.filter((name) => !/PASSWORD|KEY$/.test(name));
// 컨테이너 안에서는 자기 자신을 가리키는 주소라 DB에 닿지 않는다. 도커 네트워크의 이름(mysql)을 써야 한다.
const SELF_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

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

// 서버(src/auth/auth.config.ts)가 시작할 때 요구하는 형식과 같다. 경로나 끝의 /가 없는 scheme://host[:port] 목록이어야 한다.
function isValidOriginList(value) {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
  if (items.length === 0) return false;
  return items.every((item) => {
    try {
      const url = new URL(item);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === item;
    } catch {
      return false;
    }
  });
}

export function findProblems({ entries, invalidLines }) {
  const problems = invalidLines.map((line) => `${line}번째 줄이 KEY=VALUE 형식이 아닙니다`);
  const values = new Map(entries);
  for (const name of REQUIRED_NAMES) {
    if (!values.get(name)) problems.push(`Infisical prod에 ${name}이 없거나 비어 있습니다`);
  }
  for (const name of PLAIN_NAMES) {
    const value = values.get(name);
    if (value && /^['"]|['"]$/.test(value)) {
      problems.push(`${name} 값 앞뒤에 따옴표가 들어 있습니다. Infisical에는 따옴표 없이 값만 입력하세요`);
    }
  }
  for (const name of ['DB_HOST', 'SERVICE_DB_HOST']) {
    const value = values.get(name);
    if (value && SELF_HOSTS.has(value.toLowerCase())) {
      problems.push(`${name}이 컨테이너 자기 자신을 가리킵니다. 운영에서는 도커 네트워크의 이름 mysql을 사용하세요`);
    }
  }
  const origins = values.get('ALLOWED_ORIGINS');
  if (origins && !isValidOriginList(origins)) {
    problems.push(
      'ALLOWED_ORIGINS는 https://도메인 형태를 쉼표로 구분해야 합니다. 경로, 끝의 /, 따옴표는 넣을 수 없습니다'
    );
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
