import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { DatabaseModule } from './database/database.module.js';

@Module({ imports: [DatabaseModule], controllers: [AppController] })
export class AppModule {}
