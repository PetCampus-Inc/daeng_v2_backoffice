import { describe, expect, it } from 'vitest';
import { DEFAULT_MEMBERS } from '../../handlers/members';
import type { MemberFilter } from '@/routes/members/type/member';
import { getMemberList, maskMemberEmail, maskMemberPhone } from './index';

describe('회원 목록 TC R-회원목록 및 서버 응답 가림', () => {
  it.each<[MemberFilter, string, string[]]>([
    ['all', '', ['U001', 'U002', 'U003', 'U004', 'U005', 'U006']],
    ['guardian', '', ['U001', 'U002', 'U005']],
    ['owner', '', ['U002', 'U003']],
    ['withdrawn', '', ['U005']],
    ['all', '김견주', ['U001']],
    ['all', '원장', ['U002', 'U003']],
    ['all', 'director', ['U002']],
    ['all', 'DIRECTOR', ['U002']],
    ['all', 'u003', ['U003']],
    ['all', '5432', ['U003']],
    ['all', 'example.com', ['U001', 'U002', 'U004', 'U005']],
    ['all', '  김견주  ', ['U001']],
    ['owner', '이', ['U002']],
    ['withdrawn', '김', []],
    ['all', '없는말', []],
  ])('%s / %s 는 %j를 반환한다', (type, keyword, ids) => {
    expect(getMemberList(DEFAULT_MEMBERS, { type, keyword }).map((item) => item.userId)).toEqual(ids);
  });
  it('검색 원문과 해지 역할 정보를 조회 응답에 내보내지 않는다', () => {
    const items = getMemberList(DEFAULT_MEMBERS, { type: 'all', keyword: '' });
    expect(items[0]).toMatchObject({
      email: 'do*******@example.com',
      phone: '010-****-5678',
      isGuardian: true,
      isOwner: false,
    });
    expect(items[1]).toMatchObject({ email: 'di******@example.com', isGuardian: true, isOwner: true });
    expect(items[2]).toMatchObject({ phone: '010-****-5432', isGuardian: false, isOwner: true });
    expect(items[3]).toMatchObject({ isOwner: false, schoolName: null });
    expect(items[5]).toMatchObject({ name: '이름 미등록', email: '', phone: '' });
    for (const item of items) expect(item).not.toHaveProperty('ownerRole');
    const payload = JSON.stringify(items);
    for (const raw of ['dog.owner@example.com', 'director@example.com', '01098765432', '01012345678']) {
      expect(payload).not.toContain(raw);
    }
  });
});

describe('TC R-가림 이메일·전화', () => {
  it.each([
    ['dog.owner@example.com', 'do*******@example.com'],
    ['ab@example.com', 'ab*@example.com'],
    ['a@example.com', 'a*@example.com'],
    ['noatsign', ''],
    [null, ''],
  ])('이메일 %s → %s', (raw, masked) => expect(maskMemberEmail(raw)).toBe(masked));
  it.each([
    ['01098765432', '010-****-5432'],
    ['010-9876-5432', '010-****-5432'],
    ['1234567', '123-****-4567'],
    ['123456', '***'],
    [null, ''],
  ])('전화 %s → %s', (raw, masked) => expect(maskMemberPhone(raw)).toBe(masked));
});

describe('회원 가입일 필터 (OQ-F5 확정)', () => {
  const now = new Date('2026-10-07T10:00:00+09:00');
  it.each([
    ['7d', ['U001', 'U002']],
    ['30d', ['U001', 'U002', 'U003', 'U004']],
  ] as const)('%s는 KST 달력 범위로 조회한다', (joinedWithin, ids) => {
    expect(
      getMemberList(DEFAULT_MEMBERS, { type: 'all', keyword: '', joinedWithin }, now).map((item) => item.userId)
    ).toEqual(ids);
  });
  it('가입일·유형·검색을 함께 적용한다', () => {
    expect(
      getMemberList(DEFAULT_MEMBERS, { type: 'owner', keyword: '이', joinedWithin: '7d' }, now).map(
        (item) => item.userId
      )
    ).toEqual(['U002']);
    expect(getMemberList(DEFAULT_MEMBERS, { type: 'withdrawn', keyword: '', joinedWithin: '7d' }, now)).toEqual([]);
  });
  it('KST 시작일 자정은 포함하고 1ms 전과 미래는 제외한다', () => {
    const items = [
      '2026-09-30T14:59:59.999Z',
      '2026-09-30T15:00:00Z',
      '2026-10-07T01:00:00Z',
      '2026-10-07T01:00:00.001Z',
    ].map((createdAt, index) => ({ ...DEFAULT_MEMBERS[0], userId: String(index), createdAt }));
    expect(
      getMemberList(items, { type: 'all', keyword: '', joinedWithin: '7d' }, now).map((item) => item.userId)
    ).toEqual(['2', '1']);
  });
});
