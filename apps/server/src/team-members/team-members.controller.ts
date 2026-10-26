import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentMember, Roles } from '../auth/decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { MEMBER_ROLES, type MemberRow } from '../database/schema.js';
import { toTeamMember, type TeamMember } from './team-member.js';
import { TeamMembersService } from './team-members.service.js';

const memberIdSchema = z.coerce.number().int().positive();
const registerSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
  role: z.enum(MEMBER_ROLES),
});
const changeRoleSchema = z.object({ role: z.enum(MEMBER_ROLES) });

@Roles('SUPER_ADMIN')
@Controller('team-members')
export class TeamMembersController {
  constructor(@Inject(TeamMembersService) private readonly teamMembers: TeamMembersService) {}

  @Get()
  async list(): Promise<TeamMember[]> {
    return (await this.teamMembers.list()).map(toTeamMember);
  }

  @Post()
  async register(
    @CurrentMember() actor: MemberRow,
    @Body(new ZodValidationPipe(registerSchema)) body: z.infer<typeof registerSchema>
  ): Promise<TeamMember> {
    return toTeamMember(await this.teamMembers.register(actor, body));
  }

  @Patch(':memberId')
  async changeRole(
    @CurrentMember() actor: MemberRow,
    @Param('memberId', new ZodValidationPipe(memberIdSchema)) memberId: number,
    @Body(new ZodValidationPipe(changeRoleSchema)) body: z.infer<typeof changeRoleSchema>
  ): Promise<TeamMember> {
    return toTeamMember(await this.teamMembers.changeRole(actor, memberId, body.role));
  }

  @Post(':memberId/deactivate')
  @HttpCode(200)
  async deactivate(
    @CurrentMember() actor: MemberRow,
    @Param('memberId', new ZodValidationPipe(memberIdSchema)) memberId: number
  ): Promise<TeamMember> {
    return toTeamMember(await this.teamMembers.deactivate(actor, memberId));
  }

  @Post(':memberId/cancel')
  @HttpCode(200)
  async cancel(
    @CurrentMember() actor: MemberRow,
    @Param('memberId', new ZodValidationPipe(memberIdSchema)) memberId: number
  ): Promise<TeamMember> {
    return toTeamMember(await this.teamMembers.cancel(actor, memberId));
  }

  @Post(':memberId/reactivate')
  @HttpCode(200)
  async reactivate(
    @CurrentMember() actor: MemberRow,
    @Param('memberId', new ZodValidationPipe(memberIdSchema)) memberId: number
  ): Promise<TeamMember> {
    return toTeamMember(await this.teamMembers.reactivate(actor, memberId));
  }
}
