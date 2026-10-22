import { ROLE_LABELS } from '@/type/role';
import { formatProfileName } from '@/util/profile';
import { TERMS_TYPE_LABELS, type HistoryChange, type HistoryTarget } from '../../type/history';

/** 미배정 담당자 글자(TC R-이력기록-03·06). */
const UNASSIGNED_LABEL = '미배정';

/** 대상 칸 글자(PRD 7.12, TC R-이력대상표시). 공지는 기록 당시 제목까지 붙인다. */
export function formatHistoryTarget(target: HistoryTarget) {
  switch (target.type) {
    case 'inquiry':
      return `문의 #${target.inquiryId}`;
    case 'notice':
      return `공지 #${target.noticeId} · ${target.title}`;
    case 'terms':
      return `${TERMS_TYPE_LABELS[target.termsType]} 버전 #${target.version}`;
    case 'teamMember':
      return target.email;
  }
}

/** 변경 내용의 회색 `전 → 후` 글자(PRD 6.6). 담당자가 없으면 '미배정'. */
export function formatHistoryChange(change: HistoryChange) {
  if (change.kind === 'role') return `${ROLE_LABELS[change.before]} → ${ROLE_LABELS[change.after]}`;
  const formatAssignee = (assignee: typeof change.before) =>
    assignee ? formatProfileName(assignee) : UNASSIGNED_LABEL;
  return `${formatAssignee(change.before)} → ${formatAssignee(change.after)}`;
}
