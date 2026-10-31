import { Module } from '@nestjs/common';
import { JavaApiModule } from '../java-api/java-api.module.js';
import { INQUIRY_IMAGE_BASE_URL, readInquiryImageBaseUrl } from './inquiries.config.js';
import { InquiriesController } from './inquiries.controller.js';
import { InquiriesService } from './inquiries.service.js';
import { InquiryReader } from './inquiry-reader.js';

@Module({
  imports: [JavaApiModule],
  controllers: [InquiriesController],
  providers: [
    { provide: INQUIRY_IMAGE_BASE_URL, useFactory: () => readInquiryImageBaseUrl(process.env.INQUIRY_IMAGE_BASE_URL) },
    InquiryReader,
    InquiriesService,
  ],
})
export class InquiriesModule {}
