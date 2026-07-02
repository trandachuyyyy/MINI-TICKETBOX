import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { TicketType, TicketTypeSchema } from './schemas/ticket-type.schema';
import { Reservation, ReservationSchema } from './schemas/reservation.schema';
import { EventsModule } from '../events/events.module';
import { MailService } from '../common/services/mail.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TicketType.name, schema: TicketTypeSchema },
      { name: Reservation.name, schema: ReservationSchema },
    ]),
    EventsModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService, MailService],
  exports: [TicketsService],
})
export class TicketsModule {}
