import { createCn } from 'cn/config';

/**
 * 프로젝트 전용 클래스 병합 함수.
 * text-kd-* 크기 토큰을 글자색으로 오인하지 않도록 font-size 그룹에 등록한다.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [{ text: ['kd-title-1', 'kd-title-2', 'kd-title-3', 'kd-body', 'kd-sub', 'kd-caption', 'kd-tiny'] }],
    },
  },
});
