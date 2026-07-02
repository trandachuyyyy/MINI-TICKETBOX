import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [TicketsModule],
  controllers: [AdminController],
})
export class AdminModule {}
