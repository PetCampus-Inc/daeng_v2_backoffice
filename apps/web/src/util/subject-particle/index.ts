const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const FINAL_CONSONANT_CYCLE = 28;
/** 철자를 읽는 소리가 받침으로 끝나는 영문자: L(엘)·M(엠)·N(엔)·R(알). 나머지 알파벳은 받침이 없다. */
const ENGLISH_LETTERS_WITH_FINAL = new Set(['L', 'M', 'N', 'R']);
/** 읽는 소리가 받침으로 끝나는 숫자: 0(영)·1(일)·3(삼)·6(육)·7(칠)·8(팔). 2·4·5·9는 받침이 없다. */
const DIGITS_WITH_FINAL = new Set(['0', '1', '3', '6', '7', '8']);

/**
 * 말의 읽는 소리가 받침으로 끝나는지 본다. 뒤쪽의 `·`, 공백, 괄호 같은 기호는 건너뛰고 마지막 글자·숫자를 기준으로 하며,
 * 글자가 하나도 없으면 받침이 없다고 본다. 한글은 종성, 영문 약어는 철자 소리, 숫자는 읽는 소리 기준이다.
 */
function hasFinalConsonant(word: string): boolean {
  for (const char of Array.from(word).reverse()) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= HANGUL_START && code <= HANGUL_END) return (code - HANGUL_START) % FINAL_CONSONANT_CYCLE !== 0;
    if (/[A-Za-z]/.test(char)) return ENGLISH_LETTERS_WITH_FINAL.has(char.toUpperCase());
    if (/[0-9]/.test(char)) return DIGITS_WITH_FINAL.has(char);
  }
  return false;
}

/**
 * 말 뒤에 붙일 주격 조사(`이`/`가`)를 고른다. 받침이 있으면 `이`, 없으면 `가`다.
 * 예: `JPG·PNG` → `가`, `사진` → `이`, `DOCM` → `이`
 */
export function getSubjectParticle(word: string): '이' | '가' {
  return hasFinalConsonant(word) ? '이' : '가';
}
