import { Module } from '@nestjs/common';
import { IdeaReader } from './idea-reader.js';
import { IdeasController } from './ideas.controller.js';
import { IdeasService } from './ideas.service.js';

@Module({
  controllers: [IdeasController],
  providers: [IdeaReader, IdeasService],
})
export class IdeasModule {}
