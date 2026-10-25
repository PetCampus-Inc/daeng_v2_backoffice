import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { readApiDocsEnabled, readPort } from './config.js';
import { loadOpenApiDocument, setupApiDocs } from './docs.js';
import { loadEnvFile } from './env.js';

async function bootstrap(): Promise<void> {
  loadEnvFile();
  const port = readPort(process.env.PORT);
  const apiDocument = readApiDocsEnabled(process.env.API_DOCS_ENABLED) ? await loadOpenApiDocument() : undefined;
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  if (apiDocument) await setupApiDocs(app, apiDocument);
  await app.listen(port);
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
