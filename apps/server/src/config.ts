import { z } from 'zod';

const DEFAULT_PORT = 3000;
const portSchema = z
  .string()
  .regex(/^[0-9]+$/)
  .transform(Number)
  .pipe(z.int().min(1).max(65535));

export function readPort(value: string | undefined): number {
  if (value === undefined) return DEFAULT_PORT;
  const result = portSchema.safeParse(value);
  if (!result.success) throw new Error('PORT must be an integer from 1 to 65535');
  return result.data;
}

const apiDocsEnabledSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

export function readApiDocsEnabled(value: string | undefined): boolean {
  if (value === undefined) return false;
  const result = apiDocsEnabledSchema.safeParse(value);
  if (!result.success) throw new Error('API_DOCS_ENABLED must be "true" or "false"');
  return result.data;
}
