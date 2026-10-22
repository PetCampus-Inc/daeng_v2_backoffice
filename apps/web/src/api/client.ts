import axios from 'axios';

/**
 * 관리자 API(`/api/v0/platform-admin`) 공용 axios 인스턴스.
 * 인증·인터셉터는 로그인 방식을 정한 뒤 붙인다.
 */
export const apiClient = axios.create({
  baseURL: '/api/v0/platform-admin',
});
