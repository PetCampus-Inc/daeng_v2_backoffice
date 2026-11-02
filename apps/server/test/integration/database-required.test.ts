import { expect, test } from 'vitest';

// DB가 필요한 테스트는 DB 값이 없으면 건너뛴다. CI의 DB 작업에서는 그게 "성공처럼 보이는 실패"가 되므로,
// 그 작업이 켜는 REQUIRE_DATABASE가 있는데 DB 값이 하나라도 빠지면 여기서 실패시킨다.
test.runIf(process.env.REQUIRE_DATABASE === 'true')(
  'database settings are present when the database is required',
  () => {
    for (const name of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
      expect(process.env[name], `${name}이(가) 없어서 DB 테스트가 건너뛰어집니다`).toBeTruthy();
    }
  }
);
