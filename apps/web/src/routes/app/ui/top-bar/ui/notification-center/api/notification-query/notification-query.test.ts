import { describe, expect, test } from 'vitest';
import type { NotificationPage } from '../../type';
import { getNextNotificationPage, notificationListQueryKey, unreadCountQueryKey } from './index';

const page = (current: number, totalPages: number): NotificationPage => ({
  items: [],
  page: current,
  size: 20,
  totalItems: 45,
  totalPages,
});

describe('알림 목록 이어 붙이기', () => {
  test('마지막 페이지가 아니면 다음 페이지를 받는다', () => {
    expect(getNextNotificationPage(page(1, 3))).toBe(2);
    expect(getNextNotificationPage(page(2, 3))).toBe(3);
  });

  test('마지막 페이지이거나 알림이 없으면 멈춘다', () => {
    expect(getNextNotificationPage(page(3, 3))).toBeUndefined();
    expect(getNextNotificationPage(page(1, 0))).toBeUndefined();
  });
});

describe('조회 키는 계정별로 나뉜다', () => {
  test('계정이 바뀌면 이전 계정의 목록·안 읽은 수를 같은 캐시로 쓰지 않는다', () => {
    expect(notificationListQueryKey('first@test.com')).not.toEqual(notificationListQueryKey('second@test.com'));
    expect(unreadCountQueryKey('first@test.com')).not.toEqual(unreadCountQueryKey('second@test.com'));
    expect(notificationListQueryKey('first@test.com').at(-1)).toBe('first@test.com');
    expect(unreadCountQueryKey('first@test.com').at(-1)).toBe('first@test.com');
  });

  test('목록과 안 읽은 수는 서로 다른 캐시를 쓴다', () => {
    expect(notificationListQueryKey('a@test.com')[0]).not.toBe(unreadCountQueryKey('a@test.com')[0]);
  });
});
