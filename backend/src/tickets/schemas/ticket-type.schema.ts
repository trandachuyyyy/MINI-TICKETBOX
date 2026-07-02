import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TicketTypeDocument = TicketType & Document;

/**
 * Represents one "kho vé" (ticket pool), e.g. VIP / Standard.
 *
 * availableQuantity is the SOURCE OF TRUTH for concurrency control.
 * totalQuantity = availableQuantity + heldQuantity + soldQuantity (always).
 * We never let availableQuantity go negative: every mutation goes through
 * an atomic findOneAndUpdate with a quantity guard (see TicketsService).
 */
@Schema({ timestamps: true })
export class TicketType {
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  totalQuantity: number;

  @Prop({ required: true, min: 0 })
  availableQuantity: number;

  @Prop({ required: true, min: 0, default: 0 })
  heldQuantity: number;

  @Prop({ required: true, min: 0, default: 0 })
  soldQuantity: number;
}

export const TicketTypeSchema = SchemaFactory.createForClass(TicketType);
