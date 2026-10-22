import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { myAccountQueryOptions, useUpdateMyAccount } from '@/api/account';
import { useAuthStore } from '@/store/auth';
import type { ApiError } from '@/type/api';
import { Button } from '@/ui/atoms/button';
import { Card, CardContent } from '@/ui/atoms/card';
import { showErrorToast } from '@/ui/atoms/sonner';
import { ProfileFields } from '@/ui/organisms/profile-fields';
import { DISPLAY_NAME_ERROR, profileFormSchema, type ProfileFormInput, type ProfileFormValues } from '@/util/profile';
import { formatDocumentTitle } from '@/util/page-config';

/** 첫 로그인 프로필 설정. 완료할 때까지 AppLayout이 모든 다른 주소를 이 화면으로 돌려보낸다. */
export default function ProfileSetupRoute() {
  // 이 라우트는 AppLayout의 로그인 검사 안에서만 그려진다.
  const user = useAuthStore((state) => state.user)!;
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const accountQuery = useQuery(myAccountQueryOptions(user.email));
  const updateAccountMutation = useUpdateMyAccount(user.email);
  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { displayName: '', jobRole: '' },
  });

  useEffect(() => {
    if (!accountQuery.data || form.formState.isDirty) return;
    form.reset({
      displayName: accountQuery.data.displayName ?? accountQuery.data.suggestedDisplayName ?? '',
      jobRole: accountQuery.data.jobRole ?? '',
    });
  }, [accountQuery.data, form, form.formState.isDirty]);

  useEffect(() => {
    if (accountQuery.isError) showErrorToast('일시적 오류로 요청을 완료하지 못했습니다.');
  }, [accountQuery.isError]);

  /** 프로필을 저장하고 세션을 활성 계정으로 바꾼다. */
  const handleSubmitProfile = form.handleSubmit(async (values) => {
    try {
      const account = await updateAccountMutation.mutateAsync({
        displayName: values.displayName,
        jobRole: values.jobRole,
      });
      updateProfile(account);
    } catch (error) {
      if (axios.isAxiosError<ApiError>(error) && error.response?.data.code === 'PROFILE_DISPLAY_NAME_DUPLICATE') {
        form.setError('displayName', { message: DISPLAY_NAME_ERROR }, { shouldFocus: true });
        return;
      }
      showErrorToast('일시적 오류로 요청을 완료하지 못했습니다.');
    }
  });

  const email = accountQuery.data?.email ?? user.email;

  return (
    <div className='mx-auto w-full max-w-[520px]'>
      <title>{formatDocumentTitle('프로필 설정')}</title>
      <h1 className='text-kd-title-1'>프로필 설정</h1>
      <p className='mt-3 text-kd-body text-kd-foreground-muted'>
        처음 로그인하면 표시명과 직무를 정해야 BO를 쓸 수 있어요.
      </p>
      <Card className='mt-6'>
        <CardContent>
          <form className='flex flex-col gap-6' onSubmit={handleSubmitProfile}>
            <ProfileFields email={email} form={form} />
            <Button type='submit' className='self-end' disabled={updateAccountMutation.isPending}>
              설정 완료
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
