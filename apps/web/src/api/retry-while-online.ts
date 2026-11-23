/**
 * 조회 재시도 규칙. 인터넷이 끊겨 있으면 다시 보내도 같으므로 재시도하지 않고 바로 실패를 보여 준다.
 * 연결이 있을 때는 기본값처럼 3번까지 다시 시도한다.
 */
export const retryWhileOnline = (failureCount: number) => navigator.onLine && failureCount < 3;
