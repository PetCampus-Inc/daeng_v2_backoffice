import { ImageOffIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/util/cn';
import { formatDate } from '@/util/date-format';
import { getDisplayUserName } from '@/util/display-user-name';
import type { InquiryImage } from '../../../type';
import type { InquiryMessage } from '../../../type/inquiry-ui';
import { ImageViewerDialog } from './ui/image-viewer-dialog';

/** 썸네일 하나(96×72). 누르면 크게 보기(갤러리) 창이 열린다. 못 불러오면 그 자리에 회색 칸 + 깨진 이미지 아이콘을 둔다. */
function InquiryImageThumbnail({
  images,
  index,
}: {
  /** 같은 메시지의 첨부 사진 전체. 크게 보기 창에서 이어서 넘겨 본다. */
  images: InquiryImage[];
  /** 이 썸네일이 가리키는 사진의 순서. */
  index: number;
}) {
  const image = images[index];
  const [hasError, setHasError] = useState(false);
  return (
    <li className='flex flex-col gap-1'>
      {hasError ? (
        <div
          role='img'
          aria-label='이미지를 불러오지 못했습니다'
          className='flex h-18 w-24 items-center justify-center rounded-kd-2 border border-kd-neutral-200 bg-kd-surface text-kd-neutral-400'
        >
          <ImageOffIcon aria-hidden className='size-5' />
        </div>
      ) : (
        <ImageViewerDialog images={images} index={index}>
          <button
            type='button'
            aria-label={`${image.fileName} 크게 보기`}
            className='cursor-zoom-in rounded-kd-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kd-primary focus-visible:outline-solid'
          >
            <img
              src={image.url}
              alt={image.fileName}
              className='h-18 w-24 rounded-kd-2 border border-kd-border object-cover'
              onError={() => setHasError(true)}
            />
          </button>
        </ImageViewerDialog>
      )}
    </li>
  );
}

/**
 * 문의 대화(design.md 3.11). 시간순, 사용자 메시지는 왼쪽(`--kd-surface`), 운영자 메시지는 오른쪽(`--kd-surface-accent`).
 * 말풍선 위에 `이름 · 시각`, 최대 폭 78%(1199px 이하 92%).
 */
export function Conversation({ messages }: { messages: InquiryMessage[] }) {
  return (
    <ol aria-label='대화' className='flex flex-col gap-5 p-6'>
      {messages.map((message) => {
        const isOperator = message.author === 'operator';
        return (
          <li
            key={message.id}
            className={cn(
              'flex max-w-[78%] flex-col gap-1 max-[1199px]:max-w-[92%]',
              isOperator ? 'items-end self-end' : 'items-start self-start'
            )}
          >
            <p className='text-kd-caption text-kd-foreground-muted tabular-nums'>
              {getDisplayUserName(message.authorName)} · {formatDate(message.createdAt, true)}
            </p>
            <div
              className={cn(
                'rounded-kd-3 px-4 py-3 text-kd-body leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]',
                isOperator ? 'bg-kd-surface-accent' : 'bg-kd-surface'
              )}
            >
              {message.body}
            </div>
            {message.images.length > 0 && (
              <ul aria-label='첨부 이미지' className='mt-1 flex flex-wrap gap-2'>
                {message.images.map((image, index) => (
                  <InquiryImageThumbnail key={image.id} images={message.images} index={index} />
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
