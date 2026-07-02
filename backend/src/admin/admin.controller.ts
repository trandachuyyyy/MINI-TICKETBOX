import { Controller, Get } from '@nestjs/common';
import { TicketsService } from '../tickets/tickets.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('stats')
  getStats() {
    return this.ticketsService.getStats();
  }

  @Get('holds')
  getActiveHolds() {
    return this.ticketsService.getActiveHolds();
  }
}
