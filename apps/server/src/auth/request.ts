import type { MemberRow } from '../database/schema.js';

// express 타입을 따로 설치하지 않아서 쓰는 부분만 적는다.
export interface AuthRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  member?: MemberRow;
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge?: number;
}

export interface CookieResponse {
  cookie(name: string, value: string, options: CookieOptions): void;
  clearCookie(name: string, options: CookieOptions): void;
}
