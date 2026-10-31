import { z } from 'zod';

const keyword = z
  .string()
  .trim()
  .max(100)
  .transform((value) => (value === '' ? undefined : value))
  .optional();
const page = {
  keyword,
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
};

export const overviewQuerySchema = z.object({ days: z.coerce.number().int().min(7).max(90).default(30) });
export const membersQuerySchema = z.object({ ...page, type: z.enum(['GUARDIAN', 'OWNER', 'WITHDRAWN']).optional() });
export const schoolsQuerySchema = z.object({ ...page, status: z.enum(['ACTIVE', 'CLOSED']).optional() });
export const verificationsQuerySchema = z.object({
  ...page,
  status: z.enum(['KINDERGARTEN_INFO_COMPLETED', 'BUSINESS_REGISTRATION_PENDING', 'SUBMITTED', 'REVOKED']).optional(),
});

export type OverviewQuery = z.infer<typeof overviewQuerySchema>;
export type MembersQuery = z.infer<typeof membersQuerySchema>;
export type SchoolsQuery = z.infer<typeof schoolsQuerySchema>;
export type VerificationsQuery = z.infer<typeof verificationsQuerySchema>;
