import { z } from 'zod';

/** 문의 이미지를 화면에 보여 줄 주소의 앞부분. 뒤에 서비스 DB에 저장된 S3 키를 붙인다. */
export const INQUIRY_IMAGE_BASE_URL = Symbol('INQUIRY_IMAGE_BASE_URL');

const imageBaseUrlSchema = z
  .url()
  .max(2048)
  .transform((value) => value.replace(/\/+$/, ''));

export function readInquiryImageBaseUrl(value: string | undefined): string {
  const result = imageBaseUrlSchema.safeParse(value);
  if (!result.success) throw new Error('INQUIRY_IMAGE_BASE_URL must be a URL');
  return result.data;
}
