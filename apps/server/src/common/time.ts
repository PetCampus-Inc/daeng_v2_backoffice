/** 서비스 DB·Java의 KST 시각 문자열(`YYYY-MM-DD HH:mm:ss.ffffff`)을 UTC ISO 문자열로 바꾼다. */
export function kstToIso(value: string): string {
  return new Date(`${value.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1')}+09:00`).toISOString();
}
