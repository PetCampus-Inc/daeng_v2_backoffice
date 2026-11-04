import type { ServiceMember, ServiceMemberType, ServiceUserStatus } from '@/routes/members/type';

/** 원문은 모의 서버 내부 검색에만 사용하고 응답에는 포함하지 않는다. */
export type MockMember = {
  id: number;
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: ServiceUserStatus;
  petCount: number;
  ownerRole: 'active' | 'revoked' | null;
  schoolId: number | null;
  schoolName: string | null;
  createdAt: string;
};

/** 모의 서버의 회원 목록 조건. 서버처럼 구분은 대문자로 받는다. */
export type MockMemberListParams = { type?: ServiceMemberType; keyword: string };

/** 이메일을 `@` 앞 2글자만 남기고 가린다. `@`가 없거나 값이 없으면 `null`(R-가림). */
export function maskMemberEmail(email: string | null): string | null {
  if (!email?.includes('@')) return null;
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

/**
 * 전화번호를 지역번호(서울 `02`는 2자리, 그 밖은 3자리)·뒤 4자리만 남기고 가린다.
 * 값이 없으면 `null`(R-가림, 서버 `masking.ts`와 같은 규칙).
 */
export function maskMemberPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '***';
  const areaLength = digits.startsWith('02') ? 2 : 3;
  return `${digits.slice(0, areaLength)}-****-${digits.slice(-4)}`;
}

/** 화면에 보일 이름. 이름이 없으면 `이름 미등록`으로 대신한다(서버 `members-reader.ts`와 같은 규칙). */
function getDisplayName(item: MockMember): string {
  return item.name || '이름 미등록';
}

/**
 * 검색어가 회원에 맞는지 본다(서버 `members-reader.ts`와 같은 규칙).
 * 아이디·이름(이름이 없으면 `이름 미등록`)은 부분 일치, 이메일·전화번호는 가린 값을 짐작하지 못하게 전체가 같을 때만 찾는다.
 */
function isKeywordMatched(item: MockMember, keyword: string): boolean {
  if (!keyword) return true;
  const lowerKeyword = keyword.toLowerCase();
  const digits = keyword.replace(/\D/g, '');
  return (
    item.userId.toLowerCase().includes(lowerKeyword) ||
    getDisplayName(item).toLowerCase().includes(lowerKeyword) ||
    item.email?.toLowerCase() === lowerKeyword ||
    (digits !== '' && item.phone?.replace(/[- ]/g, '') === digits)
  );
}

/** 회원 구분 조건에 맞는지 본다. 견주는 반려견 1마리 이상(탈퇴 포함), 원장은 해지되지 않은 원장 역할. */
function isTypeMatched(item: MockMember, type: ServiceMemberType | undefined): boolean {
  if (type === 'GUARDIAN') return item.petCount > 0;
  if (type === 'OWNER') return item.ownerRole === 'active';
  if (type === 'WITHDRAWN') return item.status === 'WITHDRAWN';
  return true;
}

/** 조건에 맞는 회원을 가입일 최신순으로 골라 서버 응답 모양(연락처는 가린 값)으로 만든다. */
export function getMemberList(items: MockMember[], params: MockMemberListParams): ServiceMember[] {
  const keyword = params.keyword.trim();
  return items
    .filter((item) => isTypeMatched(item, params.type) && isKeywordMatched(item, keyword))
    .sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.userId.localeCompare(left.userId)
    )
    .map((item) => {
      const isOwner = item.ownerRole === 'active';
      return {
        id: item.id,
        userId: item.userId,
        name: getDisplayName(item),
        status: item.status,
        phone: maskMemberPhone(item.phone),
        email: maskMemberEmail(item.email),
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
        petCount: item.petCount,
        isGuardian: item.petCount > 0,
        isOwner,
        // 서버는 해지되지 않은 원장 역할만 붙여 주므로 해지 정보는 늘 비어 있다. 역할 생성일은 가입일로 흉내 낸다.
        ownerGrantedAt: isOwner ? item.createdAt : null,
        ownerRevokedAt: null,
        ownerRevokeReason: null,
        schoolId: isOwner ? item.schoolId : null,
        schoolName: isOwner ? item.schoolName : null,
        schoolStatus: isOwner && item.schoolId !== null ? 'ACTIVE' : null,
      };
    });
}
