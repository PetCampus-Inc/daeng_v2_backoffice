import { Global, Module } from '@nestjs/common';
import { readDatabaseConfig } from './database.config.js';
import { DATABASE_CONFIG, DatabaseService } from './database.service.js';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONFIG,
      useFactory: () =>
        readDatabaseConfig({
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          database: process.env.DB_NAME,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
        }),
    },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
