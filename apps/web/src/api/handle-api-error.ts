import { toast, type ExternalToast } from 'sonner';

type ApiErrorOptions = {
  onError?: (error: unknown) => boolean | Promise<boolean>;
  message?: string;
  toastOptions?: ExternalToast;
};

/** 화면별 콜백은 오류를 처리한 경우 true를 반환한다. */
export async function handleApiError(error: unknown, options: ApiErrorOptions = {}) {
  if (options.onError && (await options.onError(error))) return;
  toast.error(options.message ?? '일시적 오류로 요청을 완료하지 못했습니다.', options.toastOptions);
}
