---
title: BO 서버 배포
status: 확정
date: 2026-11-03
---

# 0018. BO 서버 배포

## 맥락

BO 서버(NestJS)를 운영에 올려야 한다. 서비스 EC2(t3.small, 메모리 약 1.9GB)에는 이미 v1 Spring 서버, MySQL, Redis가 도커
컨테이너로 떠 있다. v1은 GitHub Actions로 이미지를 ECR에 올리고, Infisical의 운영 값으로 `.env`를 만들어 S3 스테이징을
거쳐 SSM으로 서버에 전달해 배포한다. BO 웹은 S3와 CloudFront로 배포한다.

## 결정

- **서버**: 기존 서비스 EC2에 BO 컨테이너(`daeng_bo_server`)를 함께 올린다. 메모리 한도는 300MB, 호스트에는
  `127.0.0.1:3000`으로만 연다.
- **이미지**: 저장소 루트를 빌드 컨텍스트로 `apps/server/Dockerfile`(다단계)에서 두 이미지를 만든다. `runtime`은 서버를
  실행하고, `migrate`는 DB 마이그레이션을 한 번 실행한다. ECR 저장소 `knockdog-backoffice-server`에 커밋 SHA와
  `SHA-migrate` 태그로 올린다.
- **AWS 인증**: GitHub OIDC로 배포 역할 `knockdog-backoffice-production-deploy`를 받는다. 이 역할은 이 저장소의 `main`
  브랜치에서 실행된 워크플로만 쓸 수 있다.
- **환경 변수**: BO 전용 Infisical 프로젝트의 `prod` 값을 러너가 받아 `.env`를 만들고, 필수 값이 모두 있는지 검증한 뒤
  S3 스테이징(`releases/knockdog-backoffice-production-deploy/<SHA>-<시도>`)에 올린다. 서버가 받자마자 S3에서 지운다.
- **서버에서 하는 일**: 이미지를 받고, `migrate`를 실행하고, 컨테이너를 교체한 뒤 `/health`가 응답하는지 본다. 응답이
  없으면 이전 이미지로 되돌린다. 컨테이너는 `docker run`으로 띄운다.
- **DB 연결**: MySQL 컨테이너가 있는 도커 네트워크(`ec2-user_default`)에 붙여 `mysql`이라는 이름으로 접속한다. BO DB
  `knockdog_backoffice`에는 전용 계정을, 서비스 DB에는 `SELECT`만 있는 읽기 전용 계정을 쓴다.
- **외부 연결**: 웹과 API를 같은 주소로 묶는다. CloudFront의 `/api/*`를 원본 `bo.knockdog.net`(HTTPS)으로 보내고, 서버의
  nginx가 이 이름을 받아 `127.0.0.1:3000`으로 전달한다. 인증서는 v1과 같이 acme.sh(webroot)로 발급·갱신한다.
- **실행**: `main`에 서버 이미지에 영향을 주는 파일(`apps/server`, `packages`, 의존성·빌드 설정, 이 워크플로)이 머지되면
  자동 실행하고, 수동 실행(`workflow_dispatch`)도 남긴다. 테스트는 PR의 CI가 머지 전에 확인한다.

## 근거

- v1과 같은 방식이라 장기 AWS 키와 SSH 포트가 필요 없고, 시크릿이 로그에 남지 않는다.
- 평상시 서버 여유(사용 가능 메모리 약 659MB, 14일 평균 CPU 1.4%)를 측정해 서버를 새로 만들지 않고 함께 쓰기로 했다.
- `docker run`으로 띄우면 v1의 `docker-compose` 배포 흐름과 파일이 분리된다.
- `.env`는 Infisical을 단일 출처로 두면 배포 전에 누락을 검증할 수 있다.

## 검토한 대안

- 서버에서 직접 빌드: 서버 메모리와 디스크(여유 6.6GB)가 부족하다.
- 서버의 `.env`를 직접 관리: 값의 출처가 둘이 되고 배포 전 누락 검증이 어렵다.
- 별도 서버 신설: 비용이 늘고, 측정상 평상시에는 필요하지 않았다.
- v1 `docker-compose.yml`에 BO 추가: v1 배포가 컨테이너를 내렸다 올릴 때 BO도 영향을 받는다.
- 이미지 하나로 합치기: 마이그레이션 도구(drizzle-kit)가 개발용 의존성이라 실행 이미지가 약 1.2GB로 커진다.

## 결과와 후속

- 한 서버를 함께 쓰므로 피크 시간대의 메모리·CPU는 아직 측정하지 못했다. 300MB는 추정이라 첫 배포 뒤 `docker stats`로
  조정한다.
- 마이그레이션은 이미지를 되돌려도 되돌려지지 않는다. 새 마이그레이션은 이전 코드와 함께 동작하게 쓴다.
- v1 배포의 `docker-compose down`은 BO 컨테이너가 같은 네트워크에 붙어 있으면 네트워크를 지우지 못하고 경고할 수 있다.
  v1을 배포해 보고 확인한다.
- 배포 역할이 `main`에서만 쓰이므로 자동 배포도 `main` 푸시에서만 실행한다.
- 세션 쿠키 때문에 웹과 API는 같은 주소에 있어야 한다([ADR 0008](0008-session-cookie-auth.md)). 그래서 서버에 CORS를
  열지 않고 CloudFront 경로 분기로 묶었다.
- 첫 배포에서 운영 값 문제가 두 번 났다(DB 호스트가 `127.0.0.1`, `ALLOWED_ORIGINS` 값에 따옴표). 이제 배포 전 검증이
  이런 값을 먼저 걸러낸다.
- 인증서 갱신이 `/var/www/html` 권한 문제로 조용히 실패하고 있었다. 갱신 크론이 출력을 버리므로 만료 알림을 두는 것을
  검토한다.
