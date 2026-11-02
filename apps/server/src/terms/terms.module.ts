import { Module } from '@nestjs/common';
import { JavaApiModule } from '../java-api/java-api.module.js';
import { TermVersionsController } from './term-versions.controller.js';
import { TermsController } from './terms.controller.js';
import { TermsJavaClient } from './terms-java.client.js';
import { TermsService } from './terms.service.js';

@Module({
  imports: [JavaApiModule],
  controllers: [TermsController, TermVersionsController],
  providers: [TermsJavaClient, TermsService],
})
export class TermsModule {}
