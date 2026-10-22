import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useRef, useState, type SubmitEvent } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';
import { useAuthStore } from '@/store/auth';
import { ROLE_LABELS, type Role } from '@/type/role';
import type { ApiError } from '@/type/api';
import { Badge } from '@/ui/atoms/badge';
import { Button } from '@/ui/atoms/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/atoms/dropdown-menu';
import { Field, FieldLabel, FieldError, FieldGroup } from '@/ui/atoms/field';
import { Input } from '@/ui/atoms/input';
import { RadioGroup, RadioGroupItem } from '@/ui/atoms/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/atoms/table';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/ui/atoms/alert-dialog';
import { showErrorToast, showSuccessToast } from '@/ui/atoms/sonner';
import { ListState } from '@/ui/molecules/list-state';
import { formatDocumentTitle } from '@/util/page-config';
import { teamMembersQueryOptions, useRegisterTeamMember, useUpdateTeamMember } from './api/team-members';
import { MEMBER_STATUS_LABELS, type TeamMember, type UpdateMemberInput } from './type/team-member';
import { isMemberProtected, memberEmailSchema, MEMBER_PROTECTION_MESSAGE } from './util/member-policy';
import { MemberDialog } from './ui/member-dialog';

const ROLE_OPTIONS: Role[] = ['viewer', 'operator', 'superAdmin'];
const ACTION_MESSAGES = {
  changeRole: '역할을 변경했습니다.',
  deactivate: '계정을 비활성화했습니다.',
  cancel: '등록을 취소했습니다.',
  reactivate: '계정을 다시 활성화했습니다.',
};

/** 서버 날짜를 한국 시간으로 표시한다. */
const formatMemberDate = (value: string | null, hasTime = false) =>
  value
    ? new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...(hasTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
      }).format(new Date(value))
    : '—';

/** 서버가 전달한 요청 거부 사유를 읽는다. */
const getMemberErrorMessage = (error: unknown) =>
  axios.isAxiosError<ApiError>(error)
    ? (error.response?.data.errorMessage ?? '일시적 오류로 요청을 완료하지 못했습니다.')
    : '일시적 오류로 요청을 완료하지 못했습니다.';

/** 역할을 버튼형 단일 선택으로 표시한다. */
const MemberRoleField = ({
  role,
  onChange,
  disabled,
}: {
  role: Role;
  onChange: (role: Role) => void;
  disabled: boolean;
}) => (
  <Field>
    <FieldLabel>역할</FieldLabel>
    <RadioGroup value={role} onValueChange={(value) => onChange(value as Role)} disabled={disabled}>
      {ROLE_OPTIONS.map((value) => (
        <RadioGroupItem key={value} value={value}>
          {ROLE_LABELS[value]}
        </RadioGroupItem>
      ))}
    </RadioGroup>
  </Field>
);

/** 팀원·권한 목록. 등록과 역할 변경은 창으로, 상태 변경은 즉시 적용한다. */
export default function TeamMembersRoute() {
  const currentEmail = useAuthStore((state) => state.user?.email) ?? '';
  const membersQuery = useQuery(teamMembersQueryOptions(currentEmail));
  const registerMemberMutation = useRegisterTeamMember(currentEmail);
  const updateMemberMutation = useUpdateTeamMember(currentEmail);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('viewer');
  const [emailError, setEmailError] = useState('');
  const [roleMember, setRoleMember] = useState<TeamMember | null>(null);
  const [isClosePending, setIsClosePending] = useState(false);
  const registerButtonRef = useRef<HTMLButtonElement>(null);
  const memberButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const members = membersQuery.data ?? [];
  const isDirty = isRegisterOpen && memberEmail.length > 0;
  const isPending = registerMemberMutation.isPending || updateMemberMutation.isPending;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => isDirty && currentLocation.key !== nextLocation.key
  );
  useBeforeUnload((event) => {
    if (isDirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  /** 등록 창의 입력을 비우고 닫는다. */
  const closeRegisterDialog = () => {
    setIsRegisterOpen(false);
    setMemberEmail('');
    setEmailError('');
    setSelectedRole('viewer');
  };
  /** 이메일을 입력했다면 버릴지 먼저 묻는다. */
  const handleCloseRegister = () => {
    if (isDirty) setIsClosePending(true);
    else closeRegisterDialog();
  };
  /** 등록 성공 때만 창을 닫는다. */
  const handleSubmitMember = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedEmail = memberEmailSchema.safeParse(memberEmail);
    if (!parsedEmail.success) {
      setEmailError('올바른 이메일 주소를 입력해 주세요.');
      return;
    }
    try {
      const member = await registerMemberMutation.mutateAsync({ email: parsedEmail.data, role: selectedRole });
      closeRegisterDialog();
      showSuccessToast(`${member.email} 계정을 등록했습니다.`);
    } catch (error) {
      setEmailError(getMemberErrorMessage(error));
    }
  };
  /** 계정 변경 후 목록을 갱신하고 결과를 알린다. */
  const handleUpdateMember = async (input: UpdateMemberInput) => {
    try {
      await updateMemberMutation.mutateAsync(input);
      setRoleMember(null);
      showSuccessToast(ACTION_MESSAGES[input.action]);
    } catch (error) {
      showErrorToast(getMemberErrorMessage(error));
      void membersQuery.refetch();
    }
  };
  /** 이탈을 취소하면 입력을 유지한다. */
  const handleCancelDiscard = () => {
    setIsClosePending(false);
    if (blocker.state === 'blocked') blocker.reset();
  };
  /** 입력을 버리고 원래 동작을 계속한다. */
  const handleDiscardChanges = () => {
    closeRegisterDialog();
    setIsClosePending(false);
    if (blocker.state === 'blocked') blocker.proceed();
  };

  return (
    <>
      <title>{formatDocumentTitle('팀원·권한')}</title>
      <div className='flex items-center justify-between gap-4'>
        <h1 className='text-kd-title-1'>팀원·권한</h1>
        <Button
          ref={registerButtonRef}
          onClick={() => {
            setSelectedRole('viewer');
            setIsRegisterOpen(true);
          }}
        >
          팀원 등록
        </Button>
      </div>
      <section
        aria-label='팀원 목록'
        className='mt-6 overflow-hidden rounded-kd-4 border border-kd-border bg-kd-background'
      >
        {membersQuery.isPending ? (
          <ListState kind='loading' />
        ) : membersQuery.isError ? (
          <ListState kind='error' onAction={() => void membersQuery.refetch()} />
        ) : members.length === 0 ? (
          <ListState kind='empty' />
        ) : (
          <Table scrollLabel='팀원 목록 가로 스크롤'>
            <caption className='sr-only'>팀원 목록</caption>
            <TableHeader>
              <TableRow>
                {['팀원', '상태', '역할', '직무', '마지막 로그인', '등록일'].map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
                <TableHead>
                  <span className='sr-only'>행 동작</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isProtected = isMemberProtected(member, members, currentEmail);
                const isEnabled = member.status === 'active' || member.status === 'registered';
                return (
                  <TableRow key={member.email}>
                    <TableCell>
                      <div className='font-bold'>
                        {member.displayName ?? <span className='text-kd-foreground-muted'>이름 없음</span>}
                        {member.email === currentEmail && (
                          <span className='font-normal text-kd-foreground-muted'> (나)</span>
                        )}
                      </div>
                      <div className='text-kd-caption text-kd-foreground-muted'>{member.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          member.status === 'active' ? 'success' : member.status === 'registered' ? 'info' : 'default'
                        }
                      >
                        {MEMBER_STATUS_LABELS[member.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{ROLE_LABELS[member.role]}</TableCell>
                    <TableCell>{member.jobRole ?? '—'}</TableCell>
                    <TableCell className='tabular-nums'>{formatMemberDate(member.lastLoginAt, true)}</TableCell>
                    <TableCell className='tabular-nums'>{formatMemberDate(member.registeredAt)}</TableCell>
                    <TableCell>
                      {member.email !== currentEmail && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            ref={(element) => {
                              if (element) memberButtonRefs.current.set(member.email, element);
                              else memberButtonRefs.current.delete(member.email);
                            }}
                            aria-label={`${member.email} 동작`}
                            disabled={isPending}
                          />
                          <DropdownMenuContent>
                            {isEnabled ? (
                              <>
                                <DropdownMenuItem
                                  disabled={isProtected}
                                  onSelect={() => {
                                    setRoleMember(member);
                                    setSelectedRole(member.role);
                                  }}
                                >
                                  역할 변경
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant='destructive'
                                  disabled={isProtected}
                                  onSelect={() =>
                                    void handleUpdateMember({
                                      email: member.email,
                                      action: member.status === 'active' ? 'deactivate' : 'cancel',
                                    })
                                  }
                                >
                                  {member.status === 'active' ? '비활성화' : '등록 취소'}
                                </DropdownMenuItem>
                                {isProtected && (
                                  <p className='max-w-64 px-3 py-2 text-kd-caption text-kd-foreground-muted'>
                                    {MEMBER_PROTECTION_MESSAGE}
                                  </p>
                                )}
                              </>
                            ) : (
                              <DropdownMenuItem
                                onSelect={() => void handleUpdateMember({ email: member.email, action: 'reactivate' })}
                              >
                                재활성화
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
      {isRegisterOpen && (
        <MemberDialog
          title='팀원 등록'
          onClose={handleCloseRegister}
          isPending={isPending}
          onRestoreFocus={() => registerButtonRef.current?.focus()}
        >
          <form onSubmit={handleSubmitMember} noValidate>
            <FieldGroup>
              <Field invalid={!!emailError}>
                <FieldLabel>구글 이메일</FieldLabel>
                <Input
                  type='email'
                  autoComplete='off'
                  placeholder='name@example.com'
                  value={memberEmail}
                  disabled={isPending}
                  onChange={(event) => {
                    setMemberEmail(event.target.value);
                    setEmailError('');
                  }}
                />
                <FieldError>{emailError}</FieldError>
              </Field>
              <MemberRoleField role={selectedRole} onChange={setSelectedRole} disabled={isPending} />
            </FieldGroup>
            <p className='mt-5 text-kd-caption text-kd-foreground-muted'>
              안내 메일은 보내지 않습니다. 등록한 분께 직접 알려 주세요.
            </p>
            <div className='mt-6 flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={handleCloseRegister} disabled={isPending}>
                취소
              </Button>
              <Button type='submit' disabled={isPending}>
                등록
              </Button>
            </div>
          </form>
        </MemberDialog>
      )}
      {roleMember && (
        <MemberDialog
          title='역할을 변경할까요?'
          onClose={() => setRoleMember(null)}
          isPending={isPending}
          onRestoreFocus={() => memberButtonRefs.current.get(roleMember.email)?.focus()}
        >
          <p className='mb-5 text-kd-body text-kd-foreground-muted'>
            {roleMember.email} · 지금 역할: {ROLE_LABELS[roleMember.role]}
          </p>
          <MemberRoleField role={selectedRole} onChange={setSelectedRole} disabled={isPending} />
          <p className='mt-5 text-kd-body'>다음 요청부터 바로 적용됩니다.</p>
          <div className='mt-6 flex justify-end gap-2'>
            <Button variant='outline' disabled={isPending} onClick={() => setRoleMember(null)}>
              취소
            </Button>
            <Button
              disabled={isPending || selectedRole === roleMember.role}
              onClick={() =>
                void handleUpdateMember({ email: roleMember.email, action: 'changeRole', role: selectedRole })
              }
            >
              역할 변경
            </Button>
          </div>
        </MemberDialog>
      )}
      <AlertDialog
        open={isClosePending || blocker.state === 'blocked'}
        onOpenChange={(isOpen) => !isOpen && handleCancelDiscard()}
      >
        <AlertDialogContent>
          <AlertDialogTitle>작성 중인 내용이 사라집니다. 나갈까요?</AlertDialogTitle>
          <AlertDialogDescription>입력한 이메일과 역할을 버립니다.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDiscard}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardChanges}>나가기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
