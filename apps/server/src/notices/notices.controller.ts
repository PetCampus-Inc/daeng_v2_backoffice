import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common';
import type { z } from 'zod';
import { CurrentMember, Roles } from '../auth/decorators.js';
import { ApiException } from '../common/api-error.js';
import { idPipe } from '../common/id-pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { MemberRow } from '../database/schema.js';
import {
  createNoticeSchema,
  listNoticesSchema,
  updateNoticeSchema,
  uploadImagesSchema,
  versionSchema,
} from './notices.schemas.js';
import { NoticesService } from './notices.service.js';

@Controller('notices')
export class NoticesController {
  constructor(@Inject(NoticesService) private readonly notices: NoticesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'OPERATOR', 'VIEWER')
  list(@Query(new ZodValidationPipe(listNoticesSchema)) query: z.infer<typeof listNoticesSchema>) {
    return this.notices.list(query);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'OPERATOR')
  create(@Body(new ZodValidationPipe(createNoticeSchema)) body: z.infer<typeof createNoticeSchema>) {
    return this.notices.create(body);
  }

  // `:id`보다 먼저 선언해야 "images"가 공지 번호로 읽히지 않는다.
  @Post('images/upload-urls')
  @HttpCode(200)
  @Roles('SUPER_ADMIN', 'OPERATOR')
  uploadImages(@Body() body: unknown) {
    // 명세의 전용 오류 코드로 알리려고 일반 검증 파이프를 쓰지 않는다.
    const parsed = uploadImagesSchema.safeParse(body);
    if (!parsed.success) throw new ApiException(400, 'NOTICE_IMAGE_INVALID', '이미지 업로드 요청이 올바르지 않습니다.');
    return this.notices.uploadImages(parsed.data);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'OPERATOR', 'VIEWER')
  get(@Param('id', idPipe) id: number) {
    return this.notices.get(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OPERATOR')
  update(
    @CurrentMember() actor: MemberRow,
    @Param('id', idPipe) id: number,
    @Body(new ZodValidationPipe(updateNoticeSchema)) body: z.infer<typeof updateNoticeSchema>
  ) {
    return this.notices.update(actor, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('SUPER_ADMIN', 'OPERATOR')
  delete(@Param('id', idPipe) id: number) {
    return this.notices.delete(id);
  }

  @Put(':id/publication')
  @Roles('SUPER_ADMIN', 'OPERATOR')
  publish(
    @CurrentMember() actor: MemberRow,
    @Param('id', idPipe) id: number,
    @Body(new ZodValidationPipe(versionSchema)) body: z.infer<typeof versionSchema>
  ) {
    return this.notices.publish(actor, id, body.version);
  }

  @Delete(':id/publication')
  @Roles('SUPER_ADMIN', 'OPERATOR')
  unpublish(@CurrentMember() actor: MemberRow, @Param('id', idPipe) id: number) {
    return this.notices.unpublish(actor, id);
  }
}
