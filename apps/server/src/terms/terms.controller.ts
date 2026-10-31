import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import type { z } from 'zod';
import { Roles } from '../auth/decorators.js';
import { createTermsSchema, kindPipe, TermsBodyPipe } from './terms.schemas.js';
import { TermsService } from './terms.service.js';
import type { TermsKind } from './terms.types.js';

/** 약관 종류(`/terms`) 아래의 경로. 버전 하나를 다루는 경로는 TermVersionsController에 있다. */
@Controller('terms')
export class TermsController {
  constructor(@Inject(TermsService) private readonly terms: TermsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'OPERATOR', 'VIEWER')
  list() {
    return this.terms.listKinds();
  }

  @Get(':kind/versions')
  @Roles('SUPER_ADMIN', 'OPERATOR', 'VIEWER')
  versions(@Param('kind', kindPipe) kind: TermsKind) {
    return this.terms.listVersions(kind);
  }

  @Get(':kind/draft-template')
  @Roles('SUPER_ADMIN')
  draftTemplate(@Param('kind', kindPipe) kind: TermsKind) {
    return this.terms.draftTemplate(kind);
  }

  @Post(':kind/versions')
  @Roles('SUPER_ADMIN')
  createVersion(
    @Param('kind', kindPipe) kind: TermsKind,
    @Body(new TermsBodyPipe(createTermsSchema)) body: z.infer<typeof createTermsSchema>
  ) {
    return this.terms.create(kind, body);
  }
}
