import { Module } from '@nestjs/common';
import { ServiceAdminController } from './service-admin.controller.js';
import { ServiceAdminService } from './service-admin.service.js';
import { ServiceMembersReader } from './service-members-reader.js';
import { ServiceOverviewReader } from './service-overview-reader.js';
import { ServiceSchoolsReader } from './service-schools-reader.js';
import { ServiceVerificationsReader } from './service-verifications-reader.js';

@Module({
  controllers: [ServiceAdminController],
  providers: [
    ServiceOverviewReader,
    ServiceMembersReader,
    ServiceSchoolsReader,
    ServiceVerificationsReader,
    ServiceAdminService,
  ],
})
export class ServiceAdminModule {}
