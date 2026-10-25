import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { readInitialSuperAdminEmail, readPort } from './config.js';
import { DatabaseService } from './database/database.service.js';
import { ensureInitialSuperAdmin } from './database/initial-super-admin.js';

async function bootstrap(): Promise<void> {
  const port = readPort(process.env.PORT);
  const initialSuperAdminEmail = readInitialSuperAdminEmail(process.env.INITIAL_SUPER_ADMIN_EMAIL);
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  if (initialSuperAdminEmail) {
    try {
      const created = await ensureInitialSuperAdmin(app.get(DatabaseService).db, initialSuperAdminEmail);
      if (created) new Logger('Bootstrap').log('Registered the initial super admin.');
    } catch (error) {
      // 연결이 열린 채로 남아 프로세스가 끝나지 않는 것을 막는다.
      await app.close();
      throw error;
    }
  }
  await app.listen(port);
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
