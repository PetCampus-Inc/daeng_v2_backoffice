import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentMember, Roles } from '../auth/decorators.js';
import { ApiException } from '../common/api-error.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { MemberRow } from '../database/schema.js';
import { SERVICE_INQUIRY_STATUSES } from '../service-database/service-schema.js';
import {
  InquiriesService,
  type InquiryAssignee,
  type InquiryDetail,
  type InquiryPage,
  type InquiryQuery,
} from './inquiries.service.js';

const inquiryIdPipe = new ZodValidationPipe(z.coerce.number().int().positive(), 'id');

const filterShape = {
  keyword: z
    .string()
    .trim()
    .max(100)
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  status: z.enum(SERVICE_INQUIRY_STATUSES).optional(),
  userType: z.enum(['GUARDIAN', 'DIRECTOR']).optional(),
  assignee: z
    .union([
      z.enum(['ME', 'UNASSIGNED']),
      z
        .string()
        .regex(/^[1-9][0-9]*$/)
        .transform(Number),
    ])
    .optional(),
  sort: z.enum(['LATEST', 'OLDEST']).default('LATEST'),
};
const adjacentQuerySchema = z.object(filterShape);
const listQuerySchema = z.object({
  ...filterShape,
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

const assignSchema = z.object({ expectedAssigneeId: z.number().int().positive().nullable() });
const replySchema = z.object({
  body: z
    .string()
    .max(500)
    .refine((value) => value.trim() !== ''),
});

@Roles('SUPER_ADMIN', 'OPERATOR')
@Controller('inquiries')
export class InquiriesController {
  constructor(@Inject(InquiriesService) private readonly inquiries: InquiriesService) {}

  @Get()
  async list(
    @CurrentMember() actor: MemberRow,
    @Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>
  ): Promise<InquiryPage> {
    const { page, size, ...filter } = query;
    return this.inquiries.list(actor, toQuery(filter), page, size);
  }

  // `:id`보다 먼저 선언해야 "assignees"가 문의 번호로 읽히지 않는다.
  @Get('assignees')
  async assignees(): Promise<InquiryAssignee[]> {
    return this.inquiries.listAssignees();
  }

  @Get(':id')
  async detail(@Param('id', inquiryIdPipe) id: number): Promise<InquiryDetail> {
    return this.inquiries.detail(id);
  }

  @Get(':id/adjacent')
  async adjacent(
    @CurrentMember() actor: MemberRow,
    @Param('id', inquiryIdPipe) id: number,
    @Query(new ZodValidationPipe(adjacentQuerySchema)) query: z.infer<typeof adjacentQuerySchema>
  ): Promise<{ prevId: number | null; nextId: number | null }> {
    return this.inquiries.adjacent(actor, id, toQuery(query));
  }

  @Post(':id/assignee')
  @HttpCode(200)
  async assign(
    @CurrentMember() actor: MemberRow,
    @Param('id', inquiryIdPipe) id: number,
    @Body(new ZodValidationPipe(assignSchema)) body: z.infer<typeof assignSchema>
  ): Promise<InquiryDetail> {
    return this.inquiries.assign(actor, id, body.expectedAssigneeId);
  }

  @Delete(':id/assignee')
  async release(@CurrentMember() actor: MemberRow, @Param('id', inquiryIdPipe) id: number): Promise<InquiryDetail> {
    return this.inquiries.release(actor, id);
  }

  @Post(':id/assignee/restore')
  @HttpCode(200)
  async restore(@CurrentMember() actor: MemberRow, @Param('id', inquiryIdPipe) id: number): Promise<InquiryDetail> {
    return this.inquiries.restore(actor, id);
  }

  @Post(':id/replies')
  @HttpCode(200)
  async reply(
    @CurrentMember() actor: MemberRow,
    @Param('id', inquiryIdPipe) id: number,
    @Body() raw: unknown
  ): Promise<InquiryDetail> {
    // 답변 검증 실패는 일반 검증 오류가 아니라 명세의 전용 코드로 알린다.
    const parsed = replySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiException(400, 'INQUIRY_REPLY_INVALID', '답변은 1자 이상 500자 이하로 입력해 주세요.');
    }
    return this.inquiries.reply(actor, id, parsed.data.body);
  }
}

function toQuery(filter: z.infer<typeof adjacentQuerySchema>): InquiryQuery {
  const { keyword, status, userType, assignee, sort } = filter;
  return {
    sort,
    ...(keyword === undefined ? {} : { keyword }),
    ...(status === undefined ? {} : { status }),
    ...(userType === undefined ? {} : { userType }),
    ...(assignee === undefined ? {} : { assignee }),
  };
}
