import { Module } from '@nestjs/common';
import { AccountService } from './account.service.js';
import { MeController } from './me.controller.js';

@Module({ controllers: [MeController], providers: [AccountService] })
export class AccountModule {}
