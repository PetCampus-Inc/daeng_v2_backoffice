# server

Node.js API 서버 자리. 프레임워크는 서버 담당자가 정한 뒤 이 폴더에서 설정한다.

- package.json의 `name`은 `@daeng/server`로 두고 `dev`·`build`·`lint` 스크립트를 넣으면 루트 `pnpm dev`·`pnpm build`에 함께 실행된다.
- 공유 타입·상수는 `"@daeng/shared": "workspace:*"` 의존성으로 가져다 쓴다.
