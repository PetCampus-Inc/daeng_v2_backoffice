import { TERM_KINDS, type TermKind } from '../type/term';
export function readTermKind(value: string | null | undefined): TermKind | null {
  return TERM_KINDS.includes(value as TermKind) ? (value as TermKind) : null;
}
export function termListPath(kind: TermKind) {
  return `/terms?kind=${kind}`;
}
export function termPath(kind: TermKind, version: number | 'new') {
  return `/terms/${kind}/${version}`;
}
