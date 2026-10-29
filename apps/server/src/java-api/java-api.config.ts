import { z } from 'zod';
import type { JavaApiConfig } from './java-api.client.js';

const javaApiSchema = z.object({
  baseUrl: z
    .url()
    .max(2048)
    .transform((value) => value.replace(/\/+$/, '')),
  apiKey: z.string().min(1),
});

/** 값은 오류 메시지에 싣지 않고 문제가 있는 변수 이름만 알린다. */
export function readJavaApiConfig(env: NodeJS.ProcessEnv): JavaApiConfig {
  const result = javaApiSchema.safeParse({ baseUrl: env.JAVA_API_BASE_URL, apiKey: env.JAVA_API_KEY });
  if (!result.success) {
    const names = new Set(
      result.error.issues.map((issue) => (issue.path[0] === 'baseUrl' ? 'JAVA_API_BASE_URL' : 'JAVA_API_KEY'))
    );
    throw new Error(`Java API settings are missing or invalid: ${[...names].join(', ')}`);
  }
  return result.data;
}
