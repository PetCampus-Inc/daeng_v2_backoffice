import { JOB_ROLES } from '@daeng/shared';
import { Controller, type UseFormReturn } from 'react-hook-form';

import { Field, FieldCounter, FieldError, FieldGroup, FieldLabel } from '@/ui/atoms/field';
import { Input } from '@/ui/atoms/input';
import { RadioGroup, RadioGroupItem } from '@/ui/atoms/radio-group';
import { countCharacters, type ProfileFormInput, type ProfileFormValues } from '@/util/profile';

/** 구글 계정·표시명·직무 입력 묶음. 첫 로그인 화면과 프로필 패널이 같은 규칙으로 쓴다. */
export function ProfileFields({
  email,
  form,
}: {
  email: string;
  form: UseFormReturn<ProfileFormInput, unknown, ProfileFormValues>;
}) {
  const displayName = form.watch('displayName');

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>구글 계정</FieldLabel>
        <Input value={email} readOnly />
      </Field>
      <Controller
        control={form.control}
        name='displayName'
        render={({ field, fieldState }) => (
          <Field required invalid={fieldState.invalid}>
            <FieldLabel>표시명</FieldLabel>
            <Input {...field} autoComplete='nickname' />
            <FieldCounter current={countCharacters(displayName)} max={10} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name='jobRole'
        render={({ field, fieldState }) => (
          <Field required invalid={fieldState.invalid}>
            <FieldLabel>직무</FieldLabel>
            <RadioGroup value={field.value} onValueChange={field.onChange}>
              {JOB_ROLES.map((jobRole) => (
                <RadioGroupItem key={jobRole} value={jobRole}>
                  {jobRole}
                </RadioGroupItem>
              ))}
            </RadioGroup>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    </FieldGroup>
  );
}
