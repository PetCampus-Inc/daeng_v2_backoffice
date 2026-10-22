import * as React from 'react';

import { Label } from '@/ui/atoms/label';
import { cn } from '@/util/cn';

type FieldContextValue = {
  controlId: string;
  labelId: string;
  invalid: boolean;
  required: boolean;
  describedBy: string | undefined;
  register: (id: string) => () => void;
};

const FieldContext = React.createContext<FieldContextValue | null>(null);

/**
 * Field 안의 입력 컨트롤(Input·Textarea·SelectTrigger·RadioGroup)이 쓰는 접근성 속성.
 * id·aria-invalid·aria-required·aria-describedby(도움말·오류 문장)를 채운다. 직접 넘긴 값이 먼저다.
 * label로 이름을 받을 수 없는 컨트롤(RadioGroup)은 labelledBy로 칸 이름과 잇는다.
 */
function useFieldControl<Props extends object>(props: Props, { labelledBy = false }: { labelledBy?: boolean } = {}) {
  const field = React.useContext(FieldContext);
  if (!field) return props;
  return {
    id: field.controlId,
    'aria-labelledby': labelledBy ? field.labelId : undefined,
    'aria-invalid': field.invalid || undefined,
    'aria-required': field.required || undefined,
    'aria-describedby': field.describedBy,
    ...props,
  };
}

/** 도움말·오류 문장이 화면에 있는 동안 컨트롤의 aria-describedby에 자기 id를 올린다. */
function useFieldDescription(suffix: string, id: string | undefined) {
  const field = React.useContext(FieldContext);
  const ownId = id ?? (field ? `${field.controlId}-${suffix}` : undefined);
  const register = field?.register;
  React.useEffect(() => {
    if (!register || !ownId) return;
    return register(ownId);
  }, [register, ownId]);
  return ownId;
}

/**
 * design.md 3.2 입력 칸 하나(칸 이름 → 컨트롤 → 도움말·오류 문장·글자 수).
 * react-hook-form은 Controller의 render 안에서 `<Field invalid={fieldState.invalid}>`로 쓴다.
 * 안의 컨트롤에 id·aria-invalid·aria-describedby가 자동으로 붙는다.
 */
function Field({
  className,
  invalid = false,
  required = false,
  ...props
}: React.ComponentProps<'div'> & { invalid?: boolean; required?: boolean }) {
  const controlId = React.useId();
  const [descriptionIds, setDescriptionIds] = React.useState<string[]>([]);
  const register = React.useCallback((id: string) => {
    setDescriptionIds((ids) => [...ids, id]);
    return () => setDescriptionIds((ids) => ids.filter((item) => item !== id));
  }, []);
  const value = React.useMemo<FieldContextValue>(
    () => ({
      controlId,
      labelId: `${controlId}-label`,
      invalid,
      required,
      describedBy: descriptionIds.length ? descriptionIds.join(' ') : undefined,
      register,
    }),
    [controlId, invalid, required, descriptionIds, register]
  );

  return (
    <FieldContext.Provider value={value}>
      <div
        data-slot='field'
        data-invalid={invalid || undefined}
        className={cn('flex w-full flex-col gap-2', className)}
        {...props}
      />
    </FieldContext.Provider>
  );
}

/** 여러 칸을 세로로 묶는다. 칸 사이 22. */
function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='field-group' className={cn('flex w-full flex-col gap-kd-field-gap', className)} {...props} />;
}

/** 칸 이름. 본문 700, Field가 required면 뒤에 빨간 `*`. */
function FieldLabel({ children, ...props }: React.ComponentProps<typeof Label>) {
  const field = React.useContext(FieldContext);
  return (
    <Label data-slot='field-label' id={field?.labelId} htmlFor={field?.controlId} {...props}>
      {children}
      {field?.required && (
        <span aria-hidden className='text-kd-error-foreground'>
          *
        </span>
      )}
    </Label>
  );
}

/** 칸 아래 도움말 한 줄. 캡션 회색, 해요체. */
function FieldDescription({ className, id, ...props }: React.ComponentProps<'p'>) {
  const ownId = useFieldDescription('description', id);
  return (
    <p
      id={ownId}
      data-slot='field-description'
      className={cn('text-kd-caption text-kd-foreground-muted', className)}
      {...props}
    />
  );
}

/**
 * 칸 아래 오류 문장. 캡션 빨강. children 또는 react-hook-form의 `errors={[fieldState.error]}`를 받는다.
 * 같은 문장은 한 번만 보이고, 문장이 없으면 그리지 않는다.
 */
function FieldError({
  className,
  children,
  errors,
  id,
  ...props
}: React.ComponentProps<'p'> & { errors?: Array<{ message?: string } | undefined> }) {
  const messages = [...new Set(errors?.map((error) => error?.message).filter(Boolean))];
  const content = children ?? (messages.length ? messages.join(' ') : null);
  if (!content) return null;
  return (
    <FieldErrorText id={id} className={className} {...props}>
      {content}
    </FieldErrorText>
  );
}

/** 오류 문장이 실제로 있을 때만 aria-describedby에 오르도록 FieldError에서 나눈 부분. */
function FieldErrorText({ className, id, ...props }: React.ComponentProps<'p'>) {
  const ownId = useFieldDescription('error', id);
  return (
    <p
      id={ownId}
      data-slot='field-error'
      className={cn('text-kd-caption text-kd-error-foreground', className)}
      {...props}
    />
  );
}

/** 글자 수 제한이 있는 칸의 `현재 / 최대`. 칸 오른쪽 아래, 캡션 회색, 고정폭 숫자. */
function FieldCounter({
  className,
  current,
  max,
  ...props
}: Omit<React.ComponentProps<'p'>, 'children'> & { current: number; max: number }) {
  return (
    <p
      data-slot='field-counter'
      className={cn('self-end text-kd-caption text-kd-foreground-muted tabular-nums', className)}
      {...props}
    >
      {current} / {max}
    </p>
  );
}

export { Field, FieldCounter, FieldDescription, FieldError, FieldGroup, FieldLabel, useFieldControl };
