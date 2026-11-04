import type { Role } from '@/type/role';
import { ROLE_LABELS } from '@/type/role-ui';
import { ChangeLogAction, type ChangeLog, type ChangeLogChange } from '../../type';

/** 미배정 담당자 글자(TC R-이력기록-01·03). */
const UNASSIGNED_LABEL = '미배정';

/** 대상 칸 글자(PRD 7.12, TC R-이력대상표시). 공지만 서버 `label`(제목) 앞에 `공지 #번호`를 붙이고, 나머지는 서버 `label` 그대로다. */
export function formatHistoryTarget({ targetType, target }: Pick<ChangeLog, 'targetType' | 'target'>) {
  return targetType === 'NOTICE' ? `공지 #${target.id} · ${target.label}` : target.label;
}

/** 역할 값을 화면 이름으로 바꾼다. 모르는 값은 서버 글자 그대로 둔다. */
const formatRole = (value: string | null) =>
  value && value in ROLE_LABELS ? ROLE_LABELS[value as Role] : (value ?? '');

/** 담당자 이름을 보여 준다. 비어 있으면 '미배정'. 서버가 직무를 붙여 주면 문자열만 바뀐다(OQ-D28). */
const formatAssignee = (value: string | null) => value ?? UNASSIGNED_LABEL;

/** 변경 내용의 회색 `전 → 후` 글자(PRD 6.6). 역할 변경은 역할 이름으로, 문의 담당 쪽은 이름(없으면 '미배정')으로 보인다. */
export function formatHistoryChange(action: ChangeLogAction, change: ChangeLogChange) {
  const format = action === ChangeLogAction.ACCOUNT_ROLE_CHANGED ? formatRole : formatAssignee;
  return `${format(change.from)} → ${format(change.to)}`;
}
