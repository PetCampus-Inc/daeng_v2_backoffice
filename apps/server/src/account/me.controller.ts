import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import { z } from 'zod';
import { AllowIncompleteProfile, CurrentMember } from '../auth/decorators.js';
import { toMyAccount, type MyAccount } from '../auth/my-account.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { MEMBER_JOB_ROLES, type MemberRow } from '../database/schema.js';
import { AccountService } from './account.service.js';

const updateMyAccountSchema = z.object({
  displayName: z.string().trim().min(1).max(10),
  jobRole: z.enum(MEMBER_JOB_ROLES),
});

/** 프로필을 완료하기 전에도 부를 수 있어야 한다(첫 로그인 때 여기서 프로필을 저장한다). */
@AllowIncompleteProfile()
@Controller('me')
export class MeController {
  constructor(@Inject(AccountService) private readonly account: AccountService) {}

  @Get()
  get(@CurrentMember() member: MemberRow): MyAccount {
    return toMyAccount(member);
  }

  @Patch()
  async update(
    @CurrentMember() member: MemberRow,
    @Body(new ZodValidationPipe(updateMyAccountSchema)) body: z.infer<typeof updateMyAccountSchema>
  ): Promise<MyAccount> {
    return toMyAccount(await this.account.updateProfile(member.id, body));
  }
}
