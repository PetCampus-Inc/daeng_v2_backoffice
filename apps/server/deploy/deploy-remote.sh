#!/usr/bin/env bash
# 운영 서버에서 SSM Run Command로 실행되는 BO 서버 배포 스크립트다. (GitHub Actions가 호출)
#
# 사용: deploy-remote.sh <S3 버킷> <S3 prefix> <리전> <서버 이미지> <마이그레이션 이미지> <도커 네트워크> <호스트 포트>
#
# 하는 일
#   1. S3 스테이징에서 .env를 받고 즉시 삭제
#   2. ECR에 로그인(서버의 IAM 역할 사용)하고 이미지를 받음
#   3. 마이그레이션 실행
#   4. 컨테이너 교체. 응답이 없으면 이전 이미지로 되돌림
set -euo pipefail
export PATH="$PATH:/usr/local/bin"

BUCKET="$1"
PREFIX="$2"
REGION="$3"
IMAGE="$4"
MIGRATE_IMAGE="$5"
NETWORK="$6"
HOST_PORT="$7"

REGISTRY="${IMAGE%%/*}"
NAME="daeng_bo_server"
APP_HOME="${APP_HOME:-/home/ec2-user/daeng-backoffice}"
ENV_FILE="$APP_HOME/.env"
WORK="$(mktemp -d /tmp/deploy-bo.XXXXXX)"
REPO="${IMAGE%:*}"

mkdir -p "$APP_HOME"
exec > >(tee -a "$APP_HOME/deploy.log") 2>&1

log() { echo "[deploy-bo $(date '+%H:%M:%S')] $*"; }

# 마이그레이션 이미지는 커서(1GB 이상) 쓰고 나면 바로 지운다. 서버 디스크 여유가 적어서 실패해 끝날 때도 지운다.
remove_migrate_images() {
  docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^${REPO}:.*-migrate$" | xargs -r docker rmi >/dev/null || true
}
trap 'rm -rf "$WORK"; remove_migrate_images' EXIT

# 1) .env 받기. 시크릿이 들어 있으므로 받자마자 S3에서 삭제한다.
log "환경 변수 파일 내려받기"
aws s3 cp "s3://$BUCKET/$PREFIX/env" "$WORK/env" --region "$REGION" --only-show-errors
aws s3 rm "s3://$BUCKET/$PREFIX/env" --region "$REGION" --only-show-errors || log "경고: S3 파일 삭제 실패(1일 후 수명 주기로 삭제됨)"
[ -s "$WORK/env" ] || { log "오류: 환경 변수 파일이 비어 있습니다"; exit 1; }

OWN=()
id ec2-user >/dev/null 2>&1 && OWN=(-o ec2-user -g ec2-user)
install ${OWN[@]+"${OWN[@]}"} -m 600 "$WORK/env" "$ENV_FILE"

# 2) 이미지 받기
log "ECR 로그인과 이미지 받기"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
docker pull "$IMAGE"
docker pull "$MIGRATE_IMAGE"

# 3) 마이그레이션. 새 컨테이너를 띄우기 전에 적용한다.
log "마이그레이션 실행"
docker run --rm --network "$NETWORK" --env-file "$ENV_FILE" --memory 400m "$MIGRATE_IMAGE"

remove_migrate_images

# 4) 컨테이너 교체
PREV_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$NAME" 2>/dev/null || true)"

start_container() {
  docker run -d --name "$NAME" --restart unless-stopped \
    --network "$NETWORK" --env-file "$ENV_FILE" -e PORT=3000 \
    -p "127.0.0.1:${HOST_PORT}:3000" --memory 300m \
    --log-opt max-size=10m --log-opt max-file=3 \
    "$1" >/dev/null
}

wait_healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS -m 3 "http://127.0.0.1:${HOST_PORT}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

log "컨테이너 교체"
docker rm -f "$NAME" >/dev/null 2>&1 || true
start_container "$IMAGE"

if wait_healthy; then
  log "배포 완료: $IMAGE"
  # 현재 이미지와 되돌리기용 직전 이미지만 남기고 이 저장소의 옛 이미지를 지운다.
  docker images --format '{{.Repository}}:{{.Tag}}' | grep "^${REPO}:" \
    | grep -v -x -e "$IMAGE" -e "${PREV_IMAGE:-none}" | xargs -r docker rmi >/dev/null || true
  docker image prune -f >/dev/null || true
  exit 0
fi

log "오류: 60초 안에 /health가 응답하지 않았습니다. 최근 로그:"
docker logs --tail 40 "$NAME" 2>&1 || true
docker rm -f "$NAME" >/dev/null 2>&1 || true

if [ -n "$PREV_IMAGE" ]; then
  log "이전 이미지로 되돌립니다: $PREV_IMAGE"
  start_container "$PREV_IMAGE"
  wait_healthy && log "되돌리기 완료" || log "경고: 이전 이미지도 응답하지 않습니다"
fi
exit 1
