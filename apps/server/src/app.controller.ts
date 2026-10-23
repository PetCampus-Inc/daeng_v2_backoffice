import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
