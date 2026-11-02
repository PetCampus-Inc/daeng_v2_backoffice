import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../auth/decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { IdeasService, type Idea, type IdeaPage } from './ideas.service.js';

const ideaIdPipe = new ZodValidationPipe(z.coerce.number().int().positive(), 'id');

const listQuerySchema = z.object({
  keyword: z
    .string()
    .trim()
    .max(100)
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  userType: z.enum(['GUARDIAN', 'DIRECTOR']).optional(),
  sort: z.enum(['LATEST', 'OLDEST']).default('LATEST'),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

// 조회 전용이라 조회자도 볼 수 있다(PRD 권한표).
@Roles('SUPER_ADMIN', 'OPERATOR', 'VIEWER')
@Controller('ideas')
export class IdeasController {
  constructor(@Inject(IdeasService) private readonly ideas: IdeasService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>): Promise<IdeaPage> {
    const { page, size, keyword, userType, sort } = query;
    return this.ideas.list(
      { sort, ...(keyword === undefined ? {} : { keyword }), ...(userType === undefined ? {} : { userType }) },
      page,
      size
    );
  }

  @Get(':id')
  async detail(@Param('id', ideaIdPipe) id: number): Promise<Idea> {
    return this.ideas.detail(id);
  }
}
