import { Body, Controller, Get, Post } from '@nestjs/common';
import { PublicService } from './public.service';

// All routes here are intentionally unguarded — they're consumed by the
// kiosk and other public terminals. Rate limiter (global) protects them.
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('branches')
  branches() {
    return this.publicService.listBranches();
  }

  @Get('hosts')
  hosts() {
    return this.publicService.listHosts();
  }

  @Post('walk-in')
  walkIn(@Body() body: any) {
    return this.publicService.walkIn(body);
  }
}
