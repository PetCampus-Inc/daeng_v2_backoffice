#!/usr/bin/env bash
# Claude Code PostToolUse hook: 방금 수정한 파일을 oxfmt로 정리하고 oxlint --fix로 고친다.
# 자동으로 못 고친 린트 오류는 exit 2로 Claude에 전달해 바로 고치게 한다.
set -u

root="$(cd "$(dirname "$0")/../.." && pwd)"
file="$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')"

[ -n "$file" ] && [ -f "$file" ] || exit 0
case "$file" in
  "$root"/*) ;;
  *) exit 0 ;;
esac
case "$file" in
  */node_modules/* | */dist/* | "$root"/.local/*) exit 0 ;;
esac

# 모양 정리 (oxfmt가 다루지 않는 파일 형식은 건너뛴다)
(cd "$root" && node_modules/.bin/oxfmt --no-error-on-unmatched-pattern "$file" >/dev/null 2>&1)

# 린트는 JS/TS 파일만, 가장 가까운 .oxlintrc.json이 있는 패키지에서 실행한다
case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs) ;;
  *) exit 0 ;;
esac

dir="$(dirname "$file")"
while [ "$dir" != "$root" ] && [ ! -f "$dir/.oxlintrc.json" ]; do
  dir="$(dirname "$dir")"
done
[ -f "$dir/.oxlintrc.json" ] || exit 0

oxlint="$dir/node_modules/.bin/oxlint"
[ -x "$oxlint" ] || oxlint="$root/node_modules/.bin/oxlint"
[ -x "$oxlint" ] || exit 0

if ! out="$(cd "$dir" && "$oxlint" --fix --deny-warnings "$file" 2>&1)"; then
  echo "oxlint가 자동으로 고치지 못한 문제가 있습니다. 수정하세요: $file" >&2
  echo "$out" >&2
  exit 2
fi
exit 0
