import { ChevronLeftIcon, ChevronRightIcon, ImageOffIcon } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/ui/atoms/button';
import type { InquiryImage } from '../../../../../type';

/** 크게 보기 창 안의 사진 한 장. 못 불러오면 그 자리에 회색 칸 + 깨진 이미지 아이콘을 둔다. */
function ViewerImage({ image }: { image: InquiryImage }) {
  const [hasError, setHasError] = useState(false);
  if (hasError) {
    return (
      <div
        role='img'
        aria-label='이미지를 불러오지 못했습니다'
        className='flex h-48 w-64 items-center justify-center rounded-kd-3 bg-kd-surface text-kd-neutral-400'
      >
        <ImageOffIcon aria-hidden className='size-8' />
      </div>
    );
  }
  return (
    <img
      src={image.url}
      alt={image.fileName}
      className='block max-h-[calc(100svh-96px)] max-w-[calc(100vw-32px)] rounded-kd-3 bg-kd-background object-contain shadow-kd-float'
      onError={() => setHasError(true)}
    />
  );
}

/**
 * 첨부 사진 크게 보기(갤러리) 창. `children`(썸네일 버튼)을 누르면 `index`번째 사진으로 열린다.
 * 같은 메시지의 `images` 안에서 ‹ › 버튼과 ← → 키로 넘기고, Esc·바깥 클릭으로 닫는다.
 * 닫히면 초점이 눌렀던 썸네일로 돌아간다(Radix 기본 동작).
 */
export function ImageViewerDialog({
  images,
  index,
  children,
}: {
  images: InquiryImage[];
  index: number;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(index);
  const total = images.length;
  const image = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < total - 1;

  /** 열 때마다 눌렀던 썸네일의 사진부터 시작한다. */
  const handleOpenChange = (nextIsOpen: boolean) => {
    if (nextIsOpen) setCurrentIndex(index);
    setIsOpen(nextIsOpen);
  };

  // 버튼이 비활성화되며 초점을 잃어도 키보드로 계속 넘길 수 있도록 문서 단위로 듣는다.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setCurrentIndex((prev) => Math.max(prev - 1, 0));
      if (event.key === 'ArrowRight') setCurrentIndex((prev) => Math.min(prev + 1, total - 1));
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, total]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className='fixed inset-0 z-40 bg-kd-overlay data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none' />
        {/* 화면 전체를 덮는 본체. 사진·버튼이 아닌 빈 곳을 누르면 닫힌다. */}
        <Dialog.Content
          aria-describedby={undefined}
          className='fixed inset-0 z-50 grid place-items-center p-4 outline-none'
          onClick={(event) => {
            if (event.target === event.currentTarget) handleOpenChange(false);
          }}
        >
          <Dialog.Title className='sr-only'>{image.fileName}</Dialog.Title>
          <ViewerImage key={image.id} image={image} />
          {total > 1 && (
            <>
              <Button
                variant='outline'
                size='icon'
                aria-label='이전 사진'
                disabled={!hasPrev}
                onClick={() => setCurrentIndex((prev) => prev - 1)}
                className='absolute top-1/2 left-4 -translate-y-1/2 rounded-full shadow-kd-float'
              >
                <ChevronLeftIcon aria-hidden />
              </Button>
              <Button
                variant='outline'
                size='icon'
                aria-label='다음 사진'
                disabled={!hasNext}
                onClick={() => setCurrentIndex((prev) => prev + 1)}
                className='absolute top-1/2 right-4 -translate-y-1/2 rounded-full shadow-kd-float'
              >
                <ChevronRightIcon aria-hidden />
              </Button>
              <p
                aria-live='polite'
                className='absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-kd-background px-3 py-1 text-kd-caption text-kd-foreground tabular-nums shadow-kd-float'
              >
                {currentIndex + 1} / {total}
              </p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
