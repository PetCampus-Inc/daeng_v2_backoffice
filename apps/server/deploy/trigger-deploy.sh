#!/usr/bin/env bash
# 배포 러너에서 실행한다. .env와 서버 스크립트를 S3 스테이징에 올리고, SSM으로 서버가 deploy-remote.sh를 실행하게 한 뒤 끝날 때까지 기다린다.
#
# 필요한 환경 변수: AWS_REGION, DEPLOY_BUCKET, INSTANCE_ID, ECR_REPOSITORY, DOCKER_NETWORK, HOST_PORT, GITHUB_SHA, GITHUB_RUN_ATTEMPT
# 작업 디렉터리에 .env가 있어야 한다. 시크릿이 들어 있어 올린 뒤 바로 지운다.
set -euo pipefail

: "${AWS_REGION:?}" "${DEPLOY_BUCKET:?}" "${INSTANCE_ID:?}" "${ECR_REPOSITORY:?}"
: "${DOCKER_NETWORK:?}" "${HOST_PORT:?}"
: "${GITHUB_SHA:?}" "${GITHUB_RUN_ATTEMPT:?}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFIX="releases/knockdog-backoffice-production-deploy/${GITHUB_SHA}-${GITHUB_RUN_ATTEMPT}"
IMAGE="${ECR_REPOSITORY}:${GITHUB_SHA}"
MIGRATE_IMAGE="${ECR_REPOSITORY}:${GITHUB_SHA}-migrate"

# .env는 서버가 받자마자 S3에서 삭제하고, 버킷 수명 주기로도 1일 후 삭제된다.
aws s3 cp .env "s3://${DEPLOY_BUCKET}/${PREFIX}/env" --only-show-errors
rm -f .env
aws s3 cp "${SCRIPT_DIR}/deploy-remote.sh" "s3://${DEPLOY_BUCKET}/${PREFIX}/deploy-remote.sh" --only-show-errors

jq -n --arg b "$DEPLOY_BUCKET" --arg p "$PREFIX" --arg r "$AWS_REGION" \
  --arg i "$IMAGE" --arg m "$MIGRATE_IMAGE" --arg n "$DOCKER_NETWORK" --arg h "$HOST_PORT" '{commands: [
  "set -e",
  "export PATH=$PATH:/usr/local/bin",
  ("aws s3 cp s3://" + $b + "/" + $p + "/deploy-remote.sh /tmp/deploy-bo-remote.sh --region " + $r + " --only-show-errors"),
  ("aws s3 rm s3://" + $b + "/" + $p + "/deploy-remote.sh --region " + $r + " --only-show-errors || true"),
  ("bash /tmp/deploy-bo-remote.sh " + $b + " " + $p + " " + $r + " " + $i + " " + $m + " " + $n + " " + $h)
]}' > params.json

CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --comment "deploy bo-server ${GITHUB_SHA}" \
  --parameters file://params.json \
  --query Command.CommandId --output text)
echo "SSM command id: $CMD_ID"

STATUS=Pending
for _ in $(seq 1 180); do # 5초 간격, 최대 15분
  STATUS=$(aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --query Status --output text 2>/dev/null || echo Pending)
  case "$STATUS" in
    Pending | InProgress | Delayed) sleep 5 ;;
    *) break ;;
  esac
done

echo "===== 서버 배포 로그 ====="
aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --query StandardOutputContent --output text
echo "===== 서버 오류 출력 ====="
aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --query StandardErrorContent --output text | tail -40
echo "최종 상태: $STATUS"
[ "$STATUS" = "Success" ]
