import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { readApiDocsEnabled, readInitialSuperAdminEmail, readPort } from './config.js';
import { DatabaseService } from './database/database.service.js';
import { ensureInitialSuperAdmin } from './database/initial-super-admin.js';
import { loadOpenApiDocument, setupApiDocs } from './docs.js';
import { loadEnvFile } from './env.js';

async function bootstrap(): Promise<void> {
  loadEnvFile();
  const port = readPort(process.env.PORT);
  const initialSuperAdminEmail = readInitialSuperAdminEmail(process.env.INITIAL_SUPER_ADMIN_EMAIL);
  const apiDocument = readApiDocsEnabled(process.env.API_DOCS_ENABLED) ? await loadOpenApiDocument() : undefined;
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
  if (apiDocument) await setupApiDocs(app, apiDocument);
  await app.listen(port);
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
