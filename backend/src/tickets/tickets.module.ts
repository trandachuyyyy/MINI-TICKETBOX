import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { TicketType, TicketTypeSchema } from './schemas/ticket-type.schema';
import { Reservation, ReservationSchema } from './schemas/reservation.schema';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TicketType.name, schema: TicketTypeSchema },
      { name: Reservation.name, schema: ReservationSchema },
    ]),
    EventsModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
