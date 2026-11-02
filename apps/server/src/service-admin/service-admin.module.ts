import { Module } from '@nestjs/common';
import { ServiceAdminController } from './service-admin.controller.js';
import { ServiceAdminService } from './service-admin.service.js';
import { ServiceMembersReader } from './members-reader.js';
import { ServiceOverviewReader } from './overview-reader.js';
import { ServiceSchoolsReader } from './schools-reader.js';
import { ServiceVerificationsReader } from './verifications-reader.js';

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
