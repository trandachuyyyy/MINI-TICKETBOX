import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TicketType, TicketTypeDocument } from './schemas/ticket-type.schema';
import {
  Reservation,
  ReservationDocument,
  ReservationStatus,
} from './schemas/reservation.schema';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { EventsGateway } from '../events/events.gateway';
import { MailService } from '../common/services/mail.service';

export const HOLD_DURATION_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectModel(TicketType.name) private ticketTypeModel: Model<TicketTypeDocument>,
    @InjectModel(Reservation.name) private reservationModel: Model<ReservationDocument>,
    private readonly events: EventsGateway,
    private readonly mailService: MailService,
  ) {}

  async create(dto: CreateTicketTypeDto) {
    const created = await this.ticketTypeModel.create({
      ...dto,
      availableQuantity: dto.totalQuantity,
      heldQuantity: 0,
      soldQuantity: 0,
    });
    await this.broadcastInventory();
    return created;
  }

  async findAll() {
    return this.ticketTypeModel.find().sort({ price: -1 }).lean();
  }

  async findOne(id: string) {
    const ticketType = await this.ticketTypeModel.findById(id).lean();
    if (!ticketType) throw new NotFoundException('Ticket type not found');
    return ticketType;
  }

  /**
   * ===== THE CRITICAL SECTION =====
   * Thousands of requests can hit this in the same millisecond. We never
   * read-then-write in app code (that pattern is what causes oversold
   * tickets under load). Instead we issue ONE atomic Mongo command that
   * both checks and decrements availableQuantity in a single document
   * operation. MongoDB guarantees document-level writes are atomic, so the
   * `availableQuantity: { $gte: quantity }` guard and the `$inc` always see
   * a consistent value, with no two requests able to "double-spend" the
   * last ticket. If the guard fails, findOneAndUpdate returns null and we
   * tell the user the pool is full — no lock, no transaction, no race.
   */
  async holdTicket(ticketTypeId: string, quantity: number, clientId: string) {
    if (!Types.ObjectId.isValid(ticketTypeId)) {
      throw new NotFoundException('Ticket type not found');
    }

    const existing = await this.reservationModel
      .findOne({
        clientId,
        status: ReservationStatus.HELD,
        ticketTypeId: new Types.ObjectId(ticketTypeId),
      })
      .lean();

    if (existing) {
      return existing;
    }

    const updated = await this.ticketTypeModel.findOneAndUpdate(
      {
        _id: ticketTypeId,
        availableQuantity: { $gte: quantity }, // atomic check
      },
      {
        $inc: { availableQuantity: -quantity, heldQuantity: quantity }, // atomic mutation
      },
      { new: true },
    );

    if (!updated) {
      const exists = await this.ticketTypeModel.exists({ _id: ticketTypeId });
      if (!exists) throw new NotFoundException('Ticket type not found');
      throw new ConflictException({
        message: 'Không đủ vé trong kho. Vé có thể vừa được người khác giữ.',
        code: 'OUT_OF_STOCK',
      });
    }

    const expiresAt = new Date(Date.now() + HOLD_DURATION_MS);
    const reservation = await this.reservationModel.create({
      ticketTypeId: updated._id,
      quantity,
      clientId,
      status: ReservationStatus.HELD,
      expiresAt,
      totalAmount: updated.price * quantity,
    });

    await this.broadcastInventory();
    return reservation;
  }

  async getReservation(id: string, clientId: string) {
    const reservation = await this.reservationModel.findById(id).lean();
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.clientId !== clientId) {
      throw new ForbiddenException('This reservation does not belong to you');
    }
    return reservation;
  }

  /**
   * Confirms payment. Guarded the same way as the hold: the update only
   * succeeds if status is still HELD *and* not yet expired at the DB level.
   * This closes the race between "user clicks pay at 4:59.9" and "cleanup
   * cron expires it at 5:00.0" — only one of the two competing updates can
   * match the filter and flip the status, the loser gets a clear error.
   */
  async confirmPayment(
    reservationId: string,
    clientId: string,
    customer: { customerName: string; customerEmail: string; customerPhone: string },
  ) {
    const reservation = await this.reservationModel.findOneAndUpdate(
      {
        _id: reservationId,
        clientId,
        status: ReservationStatus.HELD,
        expiresAt: { $gt: new Date() },
      },
      { $set: { status: ReservationStatus.CONFIRMED, ...customer } },
      { new: true },
    );

    if (!reservation) {
      const raw = await this.reservationModel.findById(reservationId).lean();
      if (!raw) throw new NotFoundException('Reservation not found');
      if (raw.status === ReservationStatus.CONFIRMED) {
        throw new ConflictException({ message: 'Reservation already paid', code: 'ALREADY_PAID' });
      }
      throw new GoneException({
        message: 'Hết thời gian giữ vé (5 phút). Vé đã được trả lại kho, vui lòng chọn lại.',
        code: 'HOLD_EXPIRED',
      });
    }

    // Move quantity from "held" to "sold" in the pool — atomic increment again.
    await this.ticketTypeModel.updateOne(
      { _id: reservation.ticketTypeId },
      { $inc: { heldQuantity: -reservation.quantity, soldQuantity: reservation.quantity } },
    );

    await this.broadcastInventory();

    const recipientEmail = customer.customerEmail || reservation.customerEmail;
    if (recipientEmail) {
      this.logger.log(`Attempting to send payment confirmation email to ${recipientEmail}`);
      await this.mailService.sendPaymentSuccessEmail(
        recipientEmail,
        reservation._id.toString(),
        customer.customerName || reservation.customerName || 'khách hàng',
      );
    } else {
      this.logger.warn('No customer email found for payment confirmation email.');
    }

    return reservation;
  }

  /** User-initiated cancel: release the hold early, same atomic guard pattern. */
  async cancelReservation(reservationId: string, clientId: string) {
    return this.releaseOne(reservationId, clientId);
  }

  private async releaseOne(reservationId: string, clientId?: string) {
    const filter: any = { _id: reservationId, status: ReservationStatus.HELD };
    if (clientId) filter.clientId = clientId;

    const reservation = await this.reservationModel.findOneAndUpdate(
      filter,
      { $set: { status: ReservationStatus.CANCELLED } },
      { new: true },
    );
    if (!reservation) {
      throw new NotFoundException('Active hold not found (already confirmed/expired)');
    }

    await this.ticketTypeModel.updateOne(
      { _id: reservation.ticketTypeId },
      { $inc: { heldQuantity: -reservation.quantity, availableQuantity: reservation.quantity } },
    );
    await this.broadcastInventory();
    return reservation;
  }

  /**
   * Called by the cron cleanup job. Releases every hold whose expiresAt has
   * passed. Uses the same status-guarded atomic update so it can never
   * double-release a reservation that a concurrent confirm just claimed.
   */
  async releaseExpiredHolds(): Promise<number> {
    const expired = await this.reservationModel.find({
      status: ReservationStatus.HELD,
      expiresAt: { $lte: new Date() },
    });

    let releasedCount = 0;
    for (const r of expired) {
      const updated = await this.reservationModel.findOneAndUpdate(
        { _id: r._id, status: ReservationStatus.HELD },
        { $set: { status: ReservationStatus.EXPIRED } },
        { new: true },
      );
      if (!updated) continue; // lost the race to a confirm, skip

      await this.ticketTypeModel.updateOne(
        { _id: updated.ticketTypeId },
        { $inc: { heldQuantity: -updated.quantity, availableQuantity: updated.quantity } },
      );
      releasedCount++;
    }

    if (releasedCount > 0) await this.broadcastInventory();
    return releasedCount;
  }

  async getActiveHolds() {
    return this.reservationModel
      .find({ status: ReservationStatus.HELD })
      .populate('ticketTypeId', 'name price')
      .sort({ expiresAt: 1 })
      .lean();
  }

  async getStats() {
    const types = await this.ticketTypeModel.find().lean();
    const totalSold = types.reduce((s, t) => s + t.soldQuantity, 0);
    const totalHeld = types.reduce((s, t) => s + t.heldQuantity, 0);
    const totalAvailable = types.reduce((s, t) => s + t.availableQuantity, 0);
    const revenue = types.reduce((s, t) => s + t.soldQuantity * t.price, 0);

    return {
      totalSold,
      totalHeld,
      totalAvailable,
      revenue,
      byType: types.map((t) => ({
        id: t._id,
        name: t.name,
        price: t.price,
        totalQuantity: t.totalQuantity,
        soldQuantity: t.soldQuantity,
        heldQuantity: t.heldQuantity,
        availableQuantity: t.availableQuantity,
      })),
    };
  }

  private async broadcastInventory() {
    const types = await this.ticketTypeModel
      .find()
      .select('name price totalQuantity availableQuantity heldQuantity soldQuantity')
      .lean();
    const stats = await this.getStats();
    const holds = await this.getActiveHolds();

    this.events.broadcastInventory(types, { stats, holds });
  }
}
