import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { MailService } from '../common/services/mail.service';
import { Throttle } from '@nestjs/throttler';
import { TicketsService } from './tickets.service';
import { HoldTicketDto } from './dto/hold-ticket.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly mailService: MailService,
  ) {}

  @Post()
  create(@Body() dto: CreateTicketTypeDto) {
    return this.ticketsService.create(dto);
  }

  @Get()
  findAll() {
    return this.ticketsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  // Tight per-IP throttle on the hot path itself, on top of the global one,
  // since this is exactly the endpoint 5,000 people will hammer at once.
  @Throttle({ default: { limit: 5, ttl: 1000 } })
  @Post(':id/hold')
  hold(@Param('id') id: string, @Body() dto: HoldTicketDto) {
    return this.ticketsService.holdTicket(id, dto.quantity, dto.clientId);
  }

  @Get('reservations/:id')
  getReservation(@Param('id') id: string, @Query('clientId') clientId: string) {
    return this.ticketsService.getReservation(id, clientId);
  }

  @Get('mail/test')
  async testMail(@Query('to') to: string) {
    if (!to) {
      return this.mailService.testConnection();
    }
    return this.mailService.sendPaymentSuccessEmail(to, 'TEST-RESERVATION', 'Test User');
  }

  @Post('reservations/:id/confirm')
  confirm(@Param('id') id: string, @Body() dto: ConfirmPaymentDto) {
    const { clientId, ...customer } = dto;
    return this.ticketsService.confirmPayment(id, clientId, customer);
  }

  @Delete('reservations/:id')
  cancel(@Param('id') id: string, @Query('clientId') clientId: string) {
    return this.ticketsService.cancelReservation(id, clientId);
  }
}
