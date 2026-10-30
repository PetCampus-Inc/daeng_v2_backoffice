import { Module } from '@nestjs/common';
import { JAVA_API_CONFIG, JavaApiClient } from '../java-api/java-api.client.js';
import { readJavaApiConfig } from '../java-api/java-api.config.js';
import { PlatformContentController } from './platform-content.controller.js';
import { PlatformContentService } from './platform-content.service.js';

@Module({
  controllers: [PlatformContentController],
  providers: [
    { provide: JAVA_API_CONFIG, useFactory: () => readJavaApiConfig(process.env) },
    JavaApiClient,
    PlatformContentService,
  ],
})
export class PlatformContentModule {}
