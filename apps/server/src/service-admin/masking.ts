// 기존 어드민(daeng-admin)의 마스킹 규칙을 그대로 옮겼다. 값이 없으면 null이다.

export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null;
  const at = email.indexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const shown = local.slice(0, Math.min(2, local.length));
  return `${shown}${'*'.repeat(Math.max(1, local.length - shown.length))}@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 7) return '***';
  // 서울(02)은 지역번호가 2자리라서 3자리를 자르면 다른 번호처럼 보인다.
  const areaLength = digits.startsWith('02') ? 2 : 3;
  return `${digits.slice(0, areaLength)}-****-${digits.slice(-4)}`;
}

export function maskBusinessNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 10) return '***';
  return `${digits.slice(0, 3)}-**-${digits.slice(-5)}`;
}
