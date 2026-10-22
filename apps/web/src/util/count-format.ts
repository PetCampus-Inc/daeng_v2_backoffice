const COUNT_FORMAT = new Intl.NumberFormat('ko-KR');

/** 서버 숫자를 건수로 읽는다. 10진수 문자열(`"12"`)은 숫자로, 빈 값·음수·`"0x10"` 같은 값은 0으로 본다. */
export const toCount = (value: unknown) => {
  const count = typeof value === 'string' ? (/^\d+$/.test(value.trim()) ? Number(value) : 0) : Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

/** 건수를 천 단위 쉼표로 표시한다. */
export const formatCount = (value: unknown) => COUNT_FORMAT.format(toCount(value));
