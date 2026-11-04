/** 서버가 이름을 찾지 못하면 채워 주는 글자. 화면에서는 '—'로 바꿔 보여 준다. */
const UNREGISTERED_USER_NAME = '이름 미등록';

/**
 * 화면에 보여 줄 사용자 이름. 서버가 `이름 미등록`을 주거나 비어 있으면 '—'로 바꾼다.
 * 원장 인증(목록·상세 패널·이름 첫 글자 동그라미)과 아이디어 제안(목록·상세)이 함께 쓴다.
 */
export const getDisplayUserName = (userName: string): string =>
  !userName || userName === UNREGISTERED_USER_NAME ? '—' : userName;
