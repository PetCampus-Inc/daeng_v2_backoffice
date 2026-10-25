import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ApiModule } from './api.module.js';
import { AppController } from './app.controller.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { DatabaseModule } from './database/database.module.js';

// 접두어는 전역(setGlobalPrefix)이 아니라 모듈에 붙인다(ApiModule). 전역 접두어를 쓰면 접두어 밖의 없는 주소가
// 공통 에러 형식이 아닌 Express 기본 404로 응답한다.
@Module({
  imports: [DatabaseModule, ApiModule],
  controllers: [AppController],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
