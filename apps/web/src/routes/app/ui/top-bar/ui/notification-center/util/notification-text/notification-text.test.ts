import { describe, expect, test } from 'vitest';
import { NotificationTargetType } from '../../type';
import { getNotificationPath, getNotificationText, isNotificationRead } from './index';

describe('R-알림문구: 서버 문구 뒤에 대상 번호를 붙인다', () => {
  test.each([
    [
      '01',
      '새 1:1 문의가 접수되었습니다.',
      NotificationTargetType.INQUIRY,
      1042,
      '새 1:1 문의가 접수되었습니다. 문의 #1042',
    ],
    [
      '02',
      '문의에 사용자가 추가 문의를 남겼습니다.',
      NotificationTargetType.INQUIRY,
      1041,
      '문의에 사용자가 추가 문의를 남겼습니다. 문의 #1041',
    ],
    [
      '03',
      '김운영 · PM님이 문의의 담당자를 변경했습니다.',
      NotificationTargetType.INQUIRY,
      1045,
      '김운영 · PM님이 문의의 담당자를 변경했습니다. 문의 #1045',
    ],
    [
      '04',
      '새 아이디어 제안이 접수되었습니다.',
      NotificationTargetType.IDEA,
      350,
      '새 아이디어 제안이 접수되었습니다. 제안 #350',
    ],
  ])('R-알림문구-%s', (_id, message, targetType, targetId, expected) => {
    expect(getNotificationText({ message, targetType, targetId })).toBe(expected);
  });
});

test('대상 종류에 맞는 상세 화면으로 이동한다', () => {
  expect(getNotificationPath({ targetType: NotificationTargetType.INQUIRY, targetId: 1041 })).toBe('/inquiries/1041');
  expect(getNotificationPath({ targetType: NotificationTargetType.IDEA, targetId: 350 })).toBe('/ideas/350');
});

test('읽은 시각이 있으면 읽음이다', () => {
  expect(isNotificationRead({ readAt: null })).toBe(false);
  expect(isNotificationRead({ readAt: '2026-10-07T00:30:00.000Z' })).toBe(true);
});
