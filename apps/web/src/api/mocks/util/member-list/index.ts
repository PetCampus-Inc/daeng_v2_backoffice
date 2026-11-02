import type { Member, MemberListParams } from '@/routes/members/type/member';

/** 원문은 모의 서버 내부 검색에만 사용하고 응답에는 포함하지 않는다. */
export type MockMember = {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: Member['status'];
  petCount: number;
  ownerRole: 'active' | 'revoked' | null;
  schoolName: string | null;
  createdAt: string;
};

export function maskMemberEmail(email: string | null): string {
  if (!email?.includes('@')) return '';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export function maskMemberPhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length < 7 ? '***' : `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export function getMemberList(items: MockMember[], params: MemberListParams, now = new Date()): Member[] {
  const keyword = params.keyword.trim().toLowerCase();
  // KST 달력 기준 오늘 포함 최근 N일. UTC에 9시간을 더해 자정 경계를 구한다.
  const kstOffset = 9 * 60 * 60 * 1000;
  const day = 24 * 60 * 60 * 1000;
  const days = params.joinedWithin === '7d' ? 7 : params.joinedWithin === '30d' ? 30 : null;
  const start = days ? Math.floor((now.getTime() + kstOffset) / day) * day - kstOffset - (days - 1) * day : null;
  return items
    .filter(
      (item) => start === null || (Date.parse(item.createdAt) >= start && Date.parse(item.createdAt) <= now.getTime())
    )
    .filter(
      (item) =>
        (params.type === 'all' ||
          (params.type === 'guardian' && item.petCount > 0) ||
          (params.type === 'owner' && item.ownerRole === 'active') ||
          (params.type === 'withdrawn' && item.status === 'WITHDRAWN')) &&
        [item.userId, item.name ?? '', item.email ?? '', item.phone ?? ''].some((value) =>
          value.toLowerCase().includes(keyword)
        )
    )
    .sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.userId.localeCompare(left.userId)
    )
    .map((item) => ({
      userId: item.userId,
      name: item.name || '이름 미등록',
      email: maskMemberEmail(item.email),
      phone: maskMemberPhone(item.phone),
      status: item.status,
      petCount: item.petCount,
      isGuardian: item.petCount > 0,
      isOwner: item.ownerRole === 'active',
      schoolName: item.ownerRole === 'active' ? item.schoolName : null,
      createdAt: item.createdAt,
    }));
}
