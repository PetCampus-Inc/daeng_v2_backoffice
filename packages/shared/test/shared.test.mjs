import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createRequire } from 'node:module';
import { JOB_ROLES as esmJobRoles } from '@daeng/shared';

const require = createRequire(import.meta.url);
const { JOB_ROLES: cjsJobRoles } = require('@daeng/shared');

test('ESM and CommonJS expose the same shared values', () => {
  assert.deepEqual(esmJobRoles, cjsJobRoles);
});
