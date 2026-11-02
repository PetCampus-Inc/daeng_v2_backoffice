import { Global, Module } from '@nestjs/common';
import { readServiceDatabaseConfig } from './service-database.config.js';
import { SERVICE_DATABASE_CONFIG, ServiceDatabaseService } from './service-database.service.js';

@Global()
@Module({
  providers: [
    { provide: SERVICE_DATABASE_CONFIG, useFactory: () => readServiceDatabaseConfig(process.env) },
    ServiceDatabaseService,
  ],
  exports: [ServiceDatabaseService],
})
export class ServiceDatabaseModule {}
