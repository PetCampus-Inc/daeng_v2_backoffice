import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { NoticeImageFileContentType, NoticeImageUploadUrl } from '../../type';
import { getNoticeImageErrorMessage, NOTICE_IMAGE_FAILED_MESSAGE, readNoticeError } from '../../util/notice-error';
import { checkNoticeImageFiles } from '../../util/notice-policy';
import { useCreateNoticeImageUploadUrls } from '../use-notices';

/** 올리기에 성공한 이미지. 본문에 이미지 블록으로 넣고, 공지를 저장하면 서버가 확정한다. */
export type UploadedNoticeImage = {
  /** 업로드 주소 발급 응답의 `tempKey`. 저장할 때 이미지 블록에 넣는다. */
  tempKey: string;
  originalFilename: string;
  /** 내 컴퓨터의 파일로 만든 미리보기 주소. 저장 본문에는 넣지 않는다. */
  previewUrl: string;
};

/**
 * 발급받은 주소로 파일을 올린다. 인증 정보(쿠키·헤더)가 외부 주소로 새지 않도록 공용 `apiClient`를 쓰지 않고
 * 쿠키를 보내지 않는 별도 `fetch`로 보낸다.
 */
export async function putNoticeImageFile(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw new Error(`이미지 올리기 실패: ${response.status}`);
}

/**
 * 공지 본문 이미지 업로드. 형식·용량·장수는 서버에 묻기 전에 막고, 통과하면 업로드 주소를 받아 파일을 올린다.
 * 올리기에 성공한 이미지만 돌려주므로 실패한 이미지는 본문에 들어가지 않는다. 실패 안내는 토스트로 띄운다.
 * `noticeId`는 이미 저장된 공지에 추가할 때만 서버에 보낸다.
 */
export function useNoticeImageUpload(noticeId?: number) {
  const issueMutation = useCreateNoticeImageUploadUrls();
  const [uploadingCount, setUploadingCount] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const isBusy = useRef(false);
  const createdUrls = useRef<string[]>([]);

  // 화면을 떠나면 만들어 둔 미리보기 주소를 정리한다.
  useEffect(() => {
    const urls = createdUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  /** 고른 파일을 올린다. `currentImageCount`는 지금 본문에 든 이미지 수다. */
  const upload = async (files: File[], currentImageCount: number): Promise<UploadedNoticeImage[]> => {
    if (files.length === 0 || isBusy.current) return [];
    const message = checkNoticeImageFiles(files, currentImageCount);
    if (message) {
      toast.error(message);
      return [];
    }
    isBusy.current = true;
    setUploadingCount(files.length);
    try {
      let issued: NoticeImageUploadUrl[];
      try {
        issued = await issueMutation.mutateAsync({
          data: {
            ...(noticeId !== undefined && { noticeId }),
            files: files.map((file) => ({
              fileName: file.name,
              contentType: file.type as NoticeImageFileContentType,
              size: file.size,
            })),
          },
        });
        if (issued.length !== files.length) throw new Error('업로드 주소 수가 파일 수와 다릅니다.');
      } catch (error) {
        const { status, code } = readNoticeError(error);
        toast.error(getNoticeImageErrorMessage(status, code));
        return [];
      }
      const results = await Promise.allSettled(
        files.map((file, index) => putNoticeImageFile(issued[index].uploadUrl, file))
      );
      const uploaded: UploadedNoticeImage[] = [];
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const previewUrl = URL.createObjectURL(files[index]);
        createdUrls.current.push(previewUrl);
        uploaded.push({ tempKey: issued[index].tempKey, originalFilename: files[index].name, previewUrl });
      });
      if (uploaded.length < files.length) toast.error(NOTICE_IMAGE_FAILED_MESSAGE);
      if (uploaded.length > 0) {
        setPreviewUrls((prev) => ({
          ...prev,
          ...Object.fromEntries(uploaded.map((item) => [item.tempKey, item.previewUrl])),
        }));
      }
      return uploaded;
    } finally {
      isBusy.current = false;
      setUploadingCount(0);
    }
  };

  return { upload, isUploading: uploadingCount > 0, previewUrls };
}
