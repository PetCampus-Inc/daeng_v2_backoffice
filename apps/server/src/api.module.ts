import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { AccountModule } from './account/account.module.js';
import { AuthModule } from './auth/auth.module.js';

/** 명세의 `servers`(/api/v0/admin). */
export const API_PREFIX = 'api/v0/admin';

/** 이 접두어 아래에 놓이는 기능 모듈. 새 기능 모듈은 여기에만 추가한다. */
const FEATURE_MODULES = [AuthModule, AccountModule];

@Module({
  imports: [...FEATURE_MODULES, RouterModule.register([{ path: API_PREFIX, children: FEATURE_MODULES }])],
})
export class ApiModule {}
