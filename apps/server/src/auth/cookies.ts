import { SESSION_COOKIE, SESSION_IDLE_MS, type AuthConfig } from './auth.constants.js';
import type { AuthRequest, CookieOptions, CookieResponse } from './request.js';

export function readCookie(header: string | string[] | undefined, name: string): string | undefined {
  const raw = Array.isArray(header) ? header.join(';') : header;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim();
      return value === '' ? undefined : value;
    }
  }
  return undefined;
}

export function readSessionId(request: AuthRequest): string | undefined {
  return readCookie(request.headers.cookie, SESSION_COOKIE);
}

function cookieOptions(config: AuthConfig): CookieOptions {
  return { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/' };
}

export function setSessionCookie(response: CookieResponse, config: AuthConfig, sessionId: string): void {
  response.cookie(SESSION_COOKIE, sessionId, { ...cookieOptions(config), maxAge: SESSION_IDLE_MS });
}

export function clearSessionCookie(response: CookieResponse, config: AuthConfig): void {
  response.clearCookie(SESSION_COOKIE, cookieOptions(config));
}
