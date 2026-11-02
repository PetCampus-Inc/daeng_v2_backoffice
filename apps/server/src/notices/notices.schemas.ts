import { z } from 'zod';

export const versionSchema = z.object({ version: z.number().int().nonnegative() });

const pendingImage = z.object({ clientImageId: z.uuid(), tempKey: z.string(), originalFilename: z.string() });
const noticeFields = {
  title: z.string().max(50),
  body: z.string().max(5000),
  pendingImages: z.array(pendingImage).max(10).optional(),
};

export const createNoticeSchema = z.object(noticeFields);
export const updateNoticeSchema = z.object({
  title: noticeFields.title.optional(),
  body: noticeFields.body.optional(),
  pendingImages: noticeFields.pendingImages,
  version: versionSchema.shape.version,
});
export const listNoticesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().max(50).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED']).optional(),
});
export const uploadImagesSchema = z.object({
  noticeId: z.number().int().positive().optional(),
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        contentType: z.enum(['image/jpeg', 'image/png']),
        size: z.number().int().min(1).max(20971520),
      })
    )
    .min(1)
    .max(10),
});
