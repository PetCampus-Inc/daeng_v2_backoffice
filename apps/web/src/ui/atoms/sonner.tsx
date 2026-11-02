import { XIcon } from 'lucide-react';
import { Toaster as Sonner, toast, type ToasterProps } from 'sonner';

/**
 * design.md 3.7 토스트. 화면 아래 가운데, `--kd-foreground` 바탕 흰 글자, 한 문장 + 오른쪽 × 닫기.
 * 앱 루트(RootLayout)에 한 번만 둔다. 띄울 때는 아래 showToast* 함수를 쓴다.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme='light'
      position='bottom-center'
      expand
      closeButton
      containerAriaLabel='알림'
      icons={{ close: <XIcon className='size-4' /> }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: '닫기',
        classNames: {
          toast:
            'flex w-full items-center gap-3 rounded-kd-3 bg-kd-foreground px-4 py-3 text-kd-body text-kd-background shadow-kd-float',
          icon: 'hidden',
          content: 'min-w-0 flex-1',
          title: 'font-normal',
          actionButton:
            'shrink-0 cursor-pointer rounded-kd-2 text-kd-sub font-bold text-kd-toast-action outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-toast-action focus-visible:outline-solid',
          closeButton:
            'order-last flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-kd-2 text-kd-background outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid',
        },
      }}
      {...props}
    />
  );
}

/** 성공 토스트. 4초 뒤 닫힌다(PRD 4.5). */
function showSuccessToast(message: string) {
  return toast.success(message, { duration: 4000 });
}

/** '실행 취소'가 있는 성공 토스트. 8초 뒤 닫힌다(PRD 4.5, 담당 해제·게시 해제). */
function showUndoToast(message: string, onUndo: () => void) {
  return toast.success(message, { duration: 8000, action: { label: '실행 취소', onClick: onUndo } });
}

/** 오류 토스트. 닫을 때까지 남는다(PRD 4.5). */
function showErrorToast(message: string) {
  return toast.error(message, { duration: Infinity });
}

export { showErrorToast, showSuccessToast, showUndoToast, Toaster };
