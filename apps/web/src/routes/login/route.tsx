import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';

import { Button } from '@/ui/atoms/button';
import { Card } from '@/ui/atoms/card';
import { Field, FieldLabel } from '@/ui/atoms/field';
import { Logo } from '@/ui/atoms/logo';
import { RadioGroup, RadioGroupItem } from '@/ui/atoms/radio-group';
import { useAuthStore } from '@/store/auth';
import { ROLE_LABELS, ROLES, type Role } from '@/type/role';
import { documentTitle, PAGES } from '@/util/page';

/**
 * 개발용 로그인 화면. 구글 로그인(7.1, OQ-D4)을 붙이기 전까지 역할을 골라 들어간다.
 * 사이드바·상단바 없이 가운데 한 덩어리. 로그인하면 원래 가려던 주소(없으면 홈)로 간다.
 */
export default function LoginRoute() {
  const user = useAuthStore((state) => state.user);
  const devLogin = useAuthStore((state) => state.devLogin);
  const location = useLocation();
  const [role, setRole] = useState<Role>('superAdmin');

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? PAGES.home.path} replace />;
  }

  /** 고른 역할로 로그인한다. 로그인 상태가 바뀌면 위에서 다음 화면으로 보낸다. */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    devLogin(role);
  };

  return (
    <main className='flex min-h-svh items-center justify-center bg-kd-surface p-4'>
      <title>{documentTitle('로그인')}</title>
      <Card className='w-full max-w-[400px]'>
        <form className='flex flex-col gap-6 p-6' onSubmit={handleSubmit}>
          {/* 로고 높이 32 → 8 → 'BO'(16, 진한 글자색). 시안 그대로 */}
          <h1 aria-label='똑독 BO' className='flex items-center gap-2'>
            <Logo className='h-8' />
            <span className='text-kd-title-3 tracking-normal'>BO</span>
          </h1>
          <Field>
            <FieldLabel>역할(개발용)</FieldLabel>
            <RadioGroup value={role} onValueChange={(value) => setRole(value as Role)}>
              {ROLES.map((item) => (
                <RadioGroupItem key={item} value={item}>
                  {ROLE_LABELS[item]}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </Field>
          <Button type='submit'>로그인</Button>
          <p className='text-kd-caption text-kd-foreground-muted'>
            구글 로그인을 붙이기 전까지 쓰는 개발용 로그인이에요.
          </p>
        </form>
      </Card>
    </main>
  );
}
