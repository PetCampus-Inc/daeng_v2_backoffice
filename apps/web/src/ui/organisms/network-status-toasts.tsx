import { useEffect } from 'react';
import { toast } from 'sonner';

const OFFLINE_TOAST_ID = 'network-offline';
const ONLINE_TOAST_ID = 'network-online';

export function NetworkStatusToasts() {
  useEffect(() => {
    let wasOnline = navigator.onLine;
    const showOffline = () => {
      toast.dismiss(ONLINE_TOAST_ID);
      toast.error('인터넷 연결이 끊겼습니다. 연결을 확인해 주세요.', {
        id: OFFLINE_TOAST_ID,
        duration: Infinity,
      });
    };
    const handleConnectionChange = () => {
      const isOnline = navigator.onLine;
      if (isOnline === wasOnline) return;
      wasOnline = isOnline;
      if (isOnline) {
        toast.dismiss(OFFLINE_TOAST_ID);
        toast.success('인터넷 연결이 복구되었습니다.', { id: ONLINE_TOAST_ID, duration: 4000 });
      } else {
        showOffline();
      }
    };

    window.addEventListener('offline', handleConnectionChange);
    window.addEventListener('online', handleConnectionChange);
    if (!wasOnline) showOffline();
    return () => {
      window.removeEventListener('offline', handleConnectionChange);
      window.removeEventListener('online', handleConnectionChange);
    };
  }, []);
  return null;
}
