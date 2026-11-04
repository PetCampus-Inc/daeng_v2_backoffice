import { describe, expect, it } from 'vitest';
import { DEFAULT_MEMBERS } from '../../handlers/members';
import type { ServiceMemberType } from '@/routes/members/type';
import { getMemberList, maskMemberEmail, maskMemberPhone } from './index';

describe('회원 목록 TC R-회원목록 및 서버 응답 가림', () => {
  it.each<[ServiceMemberType | undefined, string, string[]]>([
    [undefined, '', ['U001', 'U002', 'U003', 'U004', 'U005', 'U006']],
    ['GUARDIAN', '', ['U001', 'U002', 'U005']],
    ['OWNER', '', ['U002', 'U003']],
    ['WITHDRAWN', '', ['U005']],
    [undefined, '김견주', ['U001']],
    [undefined, '원장', ['U002', 'U003']],
    [undefined, 'director@example.com', ['U002']],
    [undefined, 'DIRECTOR@EXAMPLE.COM', ['U002']],
    [undefined, 'u003', ['U003']],
    [undefined, '5432', []],
    [undefined, 'example.com', []],
    [undefined, '  김견주  ', ['U001']],
    ['OWNER', '이', ['U002']],
    ['WITHDRAWN', '김', []],
    [undefined, '없는말', []],
    [undefined, '01098765432', ['U003']],
    [undefined, '010-9876-5432', ['U003']],
    [undefined, '미등록', ['U006']],
  ])('%s / %s 는 %j를 반환한다', (type, keyword, ids) => {
    expect(getMemberList(DEFAULT_MEMBERS, { type, keyword }).map((item) => item.userId)).toEqual(ids);
  });
  it('검색 원문과 해지 역할 정보를 조회 응답에 내보내지 않는다', () => {
    const items = getMemberList(DEFAULT_MEMBERS, { keyword: '' });
    expect(items[0]).toMatchObject({
      email: 'do*******@example.com',
      phone: '010-****-5678',
      isGuardian: true,
      isOwner: false,
    });
    expect(items[1]).toMatchObject({ email: 'di******@example.com', isGuardian: true, isOwner: true });
    expect(items[2]).toMatchObject({ phone: '010-****-5432', isGuardian: false, isOwner: true });
    expect(items[3]).toMatchObject({ isOwner: false, schoolId: null, schoolName: null, schoolStatus: null });
    expect(items[5]).toMatchObject({ name: '이름 미등록', email: null, phone: null });
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
    ['noatsign', null],
    [null, null],
  ])('이메일 %s → %s', (raw, masked) => expect(maskMemberEmail(raw)).toBe(masked));
  it.each([
    ['01098765432', '010-****-5432'],
    ['010-9876-5432', '010-****-5432'],
    ['1234567', '123-****-4567'],
    ['0212345678', '02-****-5678'],
    ['02-123-4567', '02-****-4567'],
    ['0311234567', '031-****-4567'],
    ['123456', '***'],
    [null, null],
  ])('전화 %s → %s', (raw, masked) => expect(maskMemberPhone(raw)).toBe(masked));
});
