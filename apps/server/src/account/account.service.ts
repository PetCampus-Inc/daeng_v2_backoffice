import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ApiException } from '../common/api-error.js';
import { isDuplicateEntry } from '../database/errors.js';
import { DatabaseService } from '../database/database.service.js';
import { members, type MemberJobRole, type MemberRow } from '../database/schema.js';

@Injectable()
export class AccountService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /** 표시명이 다른 팀원과 겹치는지는 먼저 조회하지 않고 유니크 인덱스에 맡긴다(동시에 저장해도 한 명만 성공한다). */
  async updateProfile(memberId: number, profile: { displayName: string; jobRole: MemberJobRole }): Promise<MemberRow> {
    const { db } = this.database;
    try {
      await db.update(members).set(profile).where(eq(members.id, memberId));
    } catch (error) {
      if (isDuplicateEntry(error, 'uq_member_display_name'))
        throw new ApiException(409, 'PROFILE_DISPLAY_NAME_DUPLICATE', '이미 사용 중인 표시명입니다.');
      throw error;
    }
    const [updated] = await db.select().from(members).where(eq(members.id, memberId)).limit(1);
    return updated;
  }
}
