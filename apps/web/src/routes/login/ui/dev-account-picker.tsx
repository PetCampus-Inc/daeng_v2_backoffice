import { useState, type FormEvent } from 'react';

import { createDevCredential } from '@/api/mocks/util/dev-credential';
import { Button } from '@/ui/atoms/button';
import { Field, FieldLabel } from '@/ui/atoms/field';
import { RadioGroup, RadioGroupItem } from '@/ui/atoms/radio-group';

/**
 * fixtures.md `로그인 계정`. 이름·구글이 확인한 이메일·구글 이름이다.
 * 대문자 이메일(R-로그인판정-02)도 확인할 수 있게 따로 둔다.
 */
const DEV_ACCOUNTS = [
  { label: '최고관리자', email: 'admin@knockdog.test', name: '김관리' },
  { label: '운영자', email: 'ops@knockdog.test', name: '김운영' },
  { label: '운영자(대문자 이메일)', email: 'OPS@knockdog.test', name: '김운영' },
  { label: '운영자2', email: 'ops2@knockdog.test', name: '이담당' },
  { label: '조회자', email: 'viewer@knockdog.test', name: '박조회' },
  { label: '등록됨팀원(첫 로그인)', email: 'new@knockdog.test', name: '한새봄' },
  { label: '비활성팀원', email: 'inactive@knockdog.test', name: '정비활' },
  { label: '등록취소팀원', email: 'canceled@knockdog.test', name: '오취소' },
  { label: '미등록', email: 'stranger@gmail.com', name: '낯선이' },
] as const;

/**
 * 개발용 계정 고르기. 개발 서버(가짜 API)에서 구글 버튼 자리에 보인다. 배포 build에는 들어가지 않는다.
 * 고른 계정으로 가짜 ID 토큰을 만들어 실제 구글 버튼과 같은 onCredential로 넘긴다.
 */
export default function DevAccountPicker({
  disabled,
  onCredential,
}: {
  disabled: boolean;
  onCredential: (credential: string) => void;
}) {
  const [email, setEmail] = useState<string>(DEV_ACCOUNTS[1].email);

  /** 고른 계정으로 가짜 구글 로그인을 보낸다. */
  const handleSubmitDevAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const account = DEV_ACCOUNTS.find((item) => item.email === email);
    if (account) onCredential(createDevCredential({ email: account.email, name: account.name }));
  };

  return (
    <form
      className='flex flex-col gap-4 rounded-kd-3 border border-dashed border-kd-neutral-300 bg-kd-background p-4'
      onSubmit={handleSubmitDevAccount}
    >
      <Field>
        <FieldLabel>개발용 계정 고르기</FieldLabel>
        <RadioGroup value={email} onValueChange={setEmail} disabled={disabled}>
          {DEV_ACCOUNTS.map((account) => (
            <RadioGroupItem key={account.email} value={account.email}>
              {account.label}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </Field>
      <Button type='submit' disabled={disabled}>
        개발용 계정으로 로그인
      </Button>
    </form>
  );
}
