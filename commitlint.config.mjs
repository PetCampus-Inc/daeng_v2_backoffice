// front(daeng_v2_front)와 같은 규칙: Conventional Commits 기본 규칙에서 두 가지만 끈다
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 한글 메시지라 대소문자 검사는 의미가 없다
    'subject-case': [0],
    'body-max-line-length': [0],
  },
};
