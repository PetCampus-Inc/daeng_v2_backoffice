export type Rule = {
  path?: string;
  method?: string;
  keyword?: string;
  delay?: number;
  fail?: boolean;
  status?: number;
  code?: string;
};
export type RequestEntry = {
  path: string;
  method: string;
  keyword: string | null;
  page: string | null;
  finished: boolean;
  body?: string;
};
export type ScenarioOptions = {
  width?: number;
  initialDelay?: number;
  delay?: number;
  role?: string;
  fixtures?: readonly unknown[];
  rules?: Rule[];
};
type ListState = {
  delay: number;
  delays: Record<string, number>;
  fail: boolean;
  started: string[];
  completed: string[];
};
type Frame = { busy: boolean; table: boolean; loading: boolean; inputTop?: number; height?: number; scroll: number };
declare global {
  interface Window {
    __schoolQA: ListState;
    __memberQA: ListState;
    __schoolFrames: Frame[];
    __memberFrames: Frame[];
    __schoolWatching: boolean;
    __memberWatching: boolean;
    __supportQA: { listDelay: number; rules: Rule[]; requests: RequestEntry[] };
    __termsQA: {
      delay: number;
      delays: Record<string, number>;
      failGet: boolean;
      mutationDelay: number;
      mutationStatus: number;
      requests: { method: string; url: string }[];
    };
    __historyQA: { fail: boolean; delay: number };
    __recover: boolean;
    __continuity: { lost: boolean; skeleton: boolean };
    __observer: MutationObserver;
    __noticeMode: { delay: number; fail: boolean };
    __noticeRequests: { keyword: string; finished: boolean }[];
    __noticeContinuity: { tableLost: boolean; skeletonShown: boolean };
    __noticeObservation: MutationObserver;
    __noticeWrite: { fail: boolean; requests: number };
    __noticeConflict: number;
  }
}

export type SupportOptions = Omit<ScenarioOptions, 'fixtures'> & {
  fixtures?: { key: string; items: readonly unknown[] };
};
