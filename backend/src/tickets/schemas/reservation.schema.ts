import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReservationDocument = Reservation & Document;

export enum ReservationStatus {
  HELD = 'HELD',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

/**
 * A 5-minute hold on N units of a TicketType.
 * status transitions: HELD -> CONFIRMED | EXPIRED | CANCELLED (one-way only).
 * The transition itself is done with an atomic, status-guarded update so a
 * confirm-payment request racing against the expiry cron can never both win.
 */
@Schema({ timestamps: true })
export class Reservation {
  @Prop({ type: Types.ObjectId, ref: 'TicketType', required: true })
  ticketTypeId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, enum: ReservationStatus, default: ReservationStatus.HELD })
  status: ReservationStatus;

  // Anonymous client/session id (stored client-side) so a user can recover
  // their own pending reservation across page refreshes.
  @Prop({ required: true })
  clientId: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  customerName?: string;

  @Prop()
  customerEmail?: string;

  @Prop()
  customerPhone?: string;

  @Prop()
  totalAmount?: number;
}

export const ReservationSchema = SchemaFactory.createForClass(Reservation);
ReservationSchema.index({ expiresAt: 1 });
ReservationSchema.index({ status: 1 });
