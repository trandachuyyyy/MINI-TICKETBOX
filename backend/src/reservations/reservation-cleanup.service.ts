import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketsService } from '../tickets/tickets.service';

/**
 * Safety net for releasing expired holds.
 * Even if a user just closes the tab mid-payment, this sweep guarantees the
 * ticket comes back into the pool within ~10s of the 5-minute mark — the
 * "expiresAt" guard in TicketsService is the real correctness guarantee,
 * this job is just what triggers the release in the background.
 */
@Injectable()
export class ReservationCleanupService {
  private readonly logger = new Logger('ReservationCleanup');

  constructor(private readonly ticketsService: TicketsService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    const released = await this.ticketsService.releaseExpiredHolds();
    if (released > 0) {
      this.logger.log(`Released ${released} expired hold(s) back to inventory`);
    }
  }
}
