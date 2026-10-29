import { Module } from '@nestjs/common';
import { JAVA_API_CONFIG, JavaApiClient } from '../java-api/java-api.client.js';
import { readJavaApiConfig } from '../java-api/java-api.config.js';
import { INQUIRY_IMAGE_BASE_URL, readInquiryImageBaseUrl } from './inquiries.config.js';
import { InquiriesController } from './inquiries.controller.js';
import { InquiriesService } from './inquiries.service.js';
import { InquiryReader } from './inquiry-reader.js';

@Module({
  controllers: [InquiriesController],
  providers: [
    { provide: JAVA_API_CONFIG, useFactory: () => readJavaApiConfig(process.env) },
    { provide: INQUIRY_IMAGE_BASE_URL, useFactory: () => readInquiryImageBaseUrl(process.env.INQUIRY_IMAGE_BASE_URL) },
    JavaApiClient,
    InquiryReader,
    InquiriesService,
  ],
})
export class InquiriesModule {}
