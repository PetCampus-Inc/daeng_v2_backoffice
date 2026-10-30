import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentMember, Roles } from '../auth/decorators.js';
import { ApiException } from '../common/api-error.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { MemberRow } from '../database/schema.js';
import { PlatformContentService } from './platform-content.service.js';

const idPipe = new ZodValidationPipe(z.coerce.number().int().positive(), 'id');
const kindPipe = new ZodValidationPipe(z.enum(['SERVICE_TERMS', 'PRIVACY_POLICY', 'LOCATION_TERMS']), 'kind');
const versionSchema = z.object({ version: z.number().int().nonnegative() });
const image = z.object({ clientImageId: z.uuid(), tempKey: z.string(), originalFilename: z.string() });
const noticeFields = {
  title: z.string().max(50),
  body: z.string().max(5000),
  pendingImages: z.array(image).max(10).optional(),
};
const createNoticeSchema = z.object(noticeFields);
const createNotice = new ZodValidationPipe(createNoticeSchema);
const updateNoticeSchema = z.object({
  title: noticeFields.title.optional(),
  body: noticeFields.body.optional(),
  pendingImages: noticeFields.pendingImages,
  version: versionSchema.shape.version,
});
const updateNotice = new ZodValidationPipe(updateNoticeSchema);
const listNoticesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().max(50).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED']).optional(),
});
const listNotices = new ZodValidationPipe(listNoticesSchema);
const uploadSchema = z.object({
  noticeId: z.number().int().positive().optional(),
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        contentType: z.enum(['image/jpeg', 'image/png']),
        size: z.number().int().min(1).max(20971520),
      })
    )
    .min(1)
    .max(10),
});
const versionPipe = new ZodValidationPipe(versionSchema);
const date = z.iso.date();
const createTerms = z.object({ effectiveDate: date, content: z.string() });
const updateTerms = z.object({
  effectiveDate: date.optional(),
  content: z.string().optional(),
  version: versionSchema.shape.version,
});
function termsBody<T>(schema: z.ZodType<T>, raw: unknown): T {
  if (typeof raw === 'object' && raw !== null && 'effectiveDate' in raw && !date.safeParse(raw.effectiveDate).success)
    throw new ApiException(400, 'TERMS_EFFECTIVE_DATE_INVALID_FORMAT', '시행일 형식이 올바르지 않습니다.');
  return new ZodValidationPipe(schema).transform(raw);
}

type Kind = 'SERVICE_TERMS' | 'PRIVACY_POLICY' | 'LOCATION_TERMS';

@Controller()
export class PlatformContentController {
  constructor(@Inject(PlatformContentService) private readonly service: PlatformContentService) {}
  @Get('notices')
  @Roles('SUPER_ADMIN', 'OPERATOR', 'VIEWER')
  list(@Query(listNotices) query: z.infer<typeof listNoticesSchema>) {
    return this.service.listNotices(query);
  }
  @Post('notices')
  @Roles('SUPER_ADMIN', 'OPERATOR')
  create(@Body(createNotice) body: z.infer<typeof createNoticeSchema>) {
    return this.service.createNotice(body);
  }
  @Post('notices/images/upload-urls')
  @HttpCode(200)
  @Roles('SUPER_ADMIN', 'OPERATOR')
  upload(@Body() body: unknown) {
    const parsed = uploadSchema.safeParse(body);
    if (!parsed.success) throw new ApiException(400, 'NOTICE_IMAGE_INVALID', '이미지 업로드 요청이 올바르지 않습니다.');
    return this.service.uploadImages(parsed.data);
  }
  @Get('notices/:id')
  @Roles('SUPER_ADMIN', 'OPERATOR', 'VIEWER')
  notice(@Param('id', idPipe) id: number) {
    return this.service.getNotice(id);
  }
  @Patch('notices/:id')
  @Roles('SUPER_ADMIN', 'OPERATOR')
  edit(
    @CurrentMember() actor: MemberRow,
    @Param('id', idPipe) id: number,
    @Body(updateNotice) body: z.infer<typeof updateNoticeSchema>
  ) {
    return this.service.updateNotice(actor, id, body);
  }
  @Delete('notices/:id')
  @HttpCode(204)
  @Roles('SUPER_ADMIN', 'OPERATOR')
  deleteNotice(@Param('id', idPipe) id: number) {
    return this.service.deleteNotice(id);
  }
  @Put('notices/:id/publication')
  @Roles('SUPER_ADMIN', 'OPERATOR')
  publishNotice(
    @CurrentMember() actor: MemberRow,
    @Param('id', idPipe) id: number,
    @Body(versionPipe) body: z.infer<typeof versionSchema>
  ) {
    return this.service.publishNotice(actor, id, body.version);
  }
  @Delete('notices/:id/publication')
  @Roles('SUPER_ADMIN', 'OPERATOR')
  unpublishNotice(@CurrentMember() actor: MemberRow, @Param('id', idPipe) id: number) {
    return this.service.unpublishNotice(actor, id);
  }
  @Get('terms')
  @Roles('SUPER_ADMIN', 'OPERATOR', 'VIEWER')
  terms() {
    return this.service.listTerms();
  }
  @Get('terms/:kind/versions')
  @Roles('SUPER_ADMIN', 'OPERATOR', 'VIEWER')
  versions(@Param('kind', kindPipe) kind: Kind) {
    return this.service.listTermsVersions(kind);
  }
  @Get('terms/:kind/draft-template')
  @Roles('SUPER_ADMIN')
  template(@Param('kind', kindPipe) kind: Kind) {
    return this.service.draftTemplate(kind);
  }
  @Post('terms/:kind/versions')
  @Roles('SUPER_ADMIN')
  createVersion(@Param('kind', kindPipe) kind: Kind, @Body() body: unknown) {
    return this.service.createTerms(kind, termsBody(createTerms, body));
  }
  @Get('term-versions/:id')
  @Roles('SUPER_ADMIN', 'OPERATOR', 'VIEWER')
  version(@Param('id', idPipe) id: number) {
    return this.service.getTerms(id);
  }
  @Patch('term-versions/:id')
  @Roles('SUPER_ADMIN')
  editVersion(@Param('id', idPipe) id: number, @Body() body: unknown) {
    return this.service.updateTerms(id, termsBody(updateTerms, body));
  }
  @Delete('term-versions/:id')
  @HttpCode(204)
  @Roles('SUPER_ADMIN')
  deleteVersion(@Param('id', idPipe) id: number) {
    return this.service.deleteTerms(id);
  }
  @Put('term-versions/:id/publication')
  @Roles('SUPER_ADMIN')
  publishVersion(
    @CurrentMember() actor: MemberRow,
    @Param('id', idPipe) id: number,
    @Body(versionPipe) body: z.infer<typeof versionSchema>
  ) {
    return this.service.publishTerms(actor, id, body.version);
  }
  @Delete('term-versions/:id/publication')
  @Roles('SUPER_ADMIN')
  withdrawVersion(@CurrentMember() actor: MemberRow, @Param('id', idPipe) id: number) {
    return this.service.withdrawTerms(actor, id);
  }
}
