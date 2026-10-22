import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useBeforeUnload, useBlocker } from 'react-router';

import { myAccountQueryOptions, useUpdateMyAccount } from '@/api/account';
import { useAuthStore, type CompletedSessionUser } from '@/store/auth';
import type { ApiError } from '@/type/api';
import { ROLE_LABELS } from '@/type/role';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/atoms/alert-dialog';
import { Button } from '@/ui/atoms/button';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/ui/atoms/popover';
import { showErrorToast, showSuccessToast } from '@/ui/atoms/sonner';
import { ProfileFields } from '@/ui/organisms/profile-fields';
import { DISPLAY_NAME_ERROR, profileFormSchema, type ProfileFormInput, type ProfileFormValues } from '@/util/profile';

/** 상단바의 프로필 버튼과 내 계정 패널. 저장하지 않은 변경은 닫기·이동 전에 확인한다. */
export function ProfilePanel({ user }: { user: CompletedSessionUser }) {
  const logout = useAuthStore((state) => state.logout);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const accountQuery = useQuery(myAccountQueryOptions(user.email));
  const updateAccountMutation = useUpdateMyAccount(user.email);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isClosePending, setIsClosePending] = useState(false);
  const [isLogoutPending, setIsLogoutPending] = useState(false);
  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { displayName: user.displayName, jobRole: user.jobRole },
  });
  const isDirty = form.formState.isDirty;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isProfileOpen &&
      isDirty &&
      `${currentLocation.pathname}${currentLocation.search}` !== `${nextLocation.pathname}${nextLocation.search}`
  );

  useBeforeUnload(
    (event) => {
      if (!isProfileOpen || !isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    },
    { capture: true }
  );

  useEffect(() => {
    if (!isProfileOpen || isDirty) return;
    const account = accountQuery.data;
    form.reset({
      displayName: account?.displayName ?? user.displayName,
      jobRole: account?.jobRole ?? user.jobRole,
    });
  }, [accountQuery.data, form, isDirty, isProfileOpen, user.displayName, user.jobRole]);

  /** 바깥 클릭·Esc로 닫을 때 변경이 있으면 이탈 확인창을 먼저 연다. */
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty) {
      setIsClosePending(true);
      return;
    }
    setIsProfileOpen(nextOpen);
    if (!nextOpen) form.reset({ displayName: user.displayName, jobRole: user.jobRole });
  };

  /** 저장 성공 뒤 상단바와 폼 기준값을 함께 갱신한다. */
  const handleSubmitProfile = form.handleSubmit(async (values) => {
    try {
      const account = await updateAccountMutation.mutateAsync({
        displayName: values.displayName,
        jobRole: values.jobRole,
      });
      updateProfile(account);
      form.reset({ displayName: account.displayName!, jobRole: account.jobRole! });
      showSuccessToast('프로필을 저장했습니다.');
    } catch (error) {
      if (axios.isAxiosError<ApiError>(error) && error.response?.data.code === 'PROFILE_DISPLAY_NAME_DUPLICATE') {
        form.setError('displayName', { message: DISPLAY_NAME_ERROR }, { shouldFocus: true });
        return;
      }
      showErrorToast('일시적 오류로 요청을 완료하지 못했습니다.');
    }
  });

  /** 로그아웃도 저장하지 않은 변경을 버릴지 확인한 뒤 실행한다. */
  const handleClickLogout = () => {
    if (isDirty) {
      setIsLogoutPending(true);
      return;
    }
    logout();
  };

  /** 이탈 확인창에서 변경을 버리고 원래 닫기·이동·로그아웃 동작을 계속한다. */
  const handleDiscardChanges = () => {
    form.reset({ displayName: user.displayName, jobRole: user.jobRole });
    setIsProfileOpen(false);
    setIsClosePending(false);
    if (isLogoutPending) {
      setIsLogoutPending(false);
      logout();
      return;
    }
    if (blocker.state === 'blocked') blocker.proceed();
  };

  /** 이탈을 취소하고 입력 중인 프로필 패널에 머문다. */
  const handleCancelDiscard = () => {
    setIsClosePending(false);
    setIsLogoutPending(false);
    if (blocker.state === 'blocked') blocker.reset();
  };

  const isDiscardDialogOpen = isClosePending || isLogoutPending || blocker.state === 'blocked';

  return (
    <>
      <Popover open={isProfileOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant='ghost' className='gap-1.5 px-3'>
            <span>{user.displayName}</span>
            <span className='font-normal text-kd-foreground-muted max-[1199px]:hidden'>{user.jobRole}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle>내 계정</PopoverTitle>
          </PopoverHeader>
          <form onSubmit={handleSubmitProfile}>
            <div className='px-6 py-5'>
              <ProfileFields email={user.email} form={form} />
              <p className='mt-5 text-kd-caption text-kd-foreground-muted'>
                역할: {ROLE_LABELS[user.role]} · 역할은 최고 관리자가 바꿀 수 있습니다.
              </p>
            </div>
            <div className='flex items-center justify-between border-t border-kd-border px-6 py-4'>
              <Button type='button' variant='destructive-ghost' size='sm' onClick={handleClickLogout}>
                로그아웃
              </Button>
              <Button type='submit' size='sm' disabled={updateAccountMutation.isPending}>
                저장
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
      <AlertDialog open={isDiscardDialogOpen} onOpenChange={(nextOpen) => !nextOpen && handleCancelDiscard()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작성 중인 내용이 사라집니다. 나갈까요?</AlertDialogTitle>
            <AlertDialogDescription>저장하지 않은 표시명과 직무 변경을 버립니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDiscard}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardChanges}>나가기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
