import { Module } from '@nestjs/common';
import { ReservationCleanupService } from './reservation-cleanup.service';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [TicketsModule],
  providers: [ReservationCleanupService],
})
export class ReservationsModule {}
