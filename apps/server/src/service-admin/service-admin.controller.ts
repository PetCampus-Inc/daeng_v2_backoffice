import { Controller, Get, Inject, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  membersQuerySchema,
  overviewQuerySchema,
  schoolsQuerySchema,
  verificationsQuerySchema,
  type MembersQuery,
  type OverviewQuery,
  type SchoolsQuery,
  type VerificationsQuery,
} from './service-admin.schemas.js';
import { ServiceAdminService } from './service-admin.service.js';

/** 서비스 DB 읽기 전용 조회 화면(홈·고객 관리). 세 역할 모두 볼 수 있다. */
@Roles('SUPER_ADMIN', 'OPERATOR', 'VIEWER')
@Controller('service-admin')
export class ServiceAdminController {
  constructor(@Inject(ServiceAdminService) private readonly serviceAdmin: ServiceAdminService) {}

  @Get('overview')
  overview(@Query(new ZodValidationPipe(overviewQuerySchema)) query: OverviewQuery) {
    return this.serviceAdmin.overview(query);
  }

  @Get('members')
  members(@Query(new ZodValidationPipe(membersQuerySchema)) query: MembersQuery) {
    return this.serviceAdmin.members(query);
  }

  @Get('schools')
  schools(@Query(new ZodValidationPipe(schoolsQuerySchema)) query: SchoolsQuery) {
    return this.serviceAdmin.schools(query);
  }

  @Get('verifications')
  verifications(@Query(new ZodValidationPipe(verificationsQuerySchema)) query: VerificationsQuery) {
    return this.serviceAdmin.verifications(query);
  }
}
