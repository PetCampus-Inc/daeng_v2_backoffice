import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { readPort } from './config.js';

async function bootstrap(): Promise<void> {
  const port = readPort(process.env.PORT);
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(port);
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
