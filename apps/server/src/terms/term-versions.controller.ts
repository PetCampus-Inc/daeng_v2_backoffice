import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Put } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentMember, Roles } from '../auth/decorators.js';
import { idPipe } from '../common/id-pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { MemberRow } from '../database/schema.js';
import { TermsBodyPipe, termsVersionSchema, updateTermsSchema } from './terms.schemas.js';
import { TermsService } from './terms.service.js';

/** 약관 버전 하나(`/term-versions/:id`)를 다루는 경로. */
@Controller('term-versions')
export class TermVersionsController {
  constructor(@Inject(TermsService) private readonly terms: TermsService) {}

  @Get(':id')
  @Roles('SUPER_ADMIN', 'OPERATOR', 'VIEWER')
  get(@Param('id', idPipe) id: number) {
    return this.terms.get(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(
    @Param('id', idPipe) id: number,
    @Body(new TermsBodyPipe(updateTermsSchema)) body: z.infer<typeof updateTermsSchema>
  ) {
    return this.terms.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('SUPER_ADMIN')
  delete(@Param('id', idPipe) id: number) {
    return this.terms.delete(id);
  }

  @Put(':id/publication')
  @Roles('SUPER_ADMIN')
  publish(
    @CurrentMember() actor: MemberRow,
    @Param('id', idPipe) id: number,
    @Body(new ZodValidationPipe(termsVersionSchema)) body: z.infer<typeof termsVersionSchema>
  ) {
    return this.terms.publish(actor, id, body.version);
  }

  @Delete(':id/publication')
  @Roles('SUPER_ADMIN')
  withdraw(@CurrentMember() actor: MemberRow, @Param('id', idPipe) id: number) {
    return this.terms.withdraw(actor, id);
  }
}
