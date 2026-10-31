import { Module } from '@nestjs/common';
import { JAVA_API_CONFIG, JavaApiClient } from './java-api.client.js';
import { readJavaApiConfig } from './java-api.config.js';

/** Java 호출 설정과 전송 클라이언트를 한 곳에서 만들어 기능 모듈이 공유한다. */
@Module({
  providers: [{ provide: JAVA_API_CONFIG, useFactory: () => readJavaApiConfig(process.env) }, JavaApiClient],
  exports: [JavaApiClient],
})
export class JavaApiModule {}
