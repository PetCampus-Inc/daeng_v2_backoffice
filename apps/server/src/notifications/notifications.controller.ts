import { Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentMember } from '../auth/decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { MemberRow } from '../database/schema.js';
import { NotificationsService } from './notifications.service.js';

const listPipe = new ZodValidationPipe(
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    size: z.coerce.number().int().min(1).max(100).default(20),
  })
);
const idPipe = new ZodValidationPipe(z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER), 'id');
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}
  @Get()
  list(@CurrentMember() member: MemberRow, @Query(listPipe) query: { page: number; size: number }) {
    return this.notifications.list(member.id, query.page, query.size);
  }
  @Get('unread-count')
  unreadCount(@CurrentMember() member: MemberRow) {
    return this.notifications.unreadCount(member.id);
  }
  @Post('read-all')
  @HttpCode(204)
  readAll(@CurrentMember() member: MemberRow) {
    return this.notifications.readAll(member.id);
  }
  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentMember() member: MemberRow, @Param('id', idPipe) id: number) {
    return this.notifications.read(member.id, id);
  }
}
