import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsEmail()
  customerEmail: string;

  @IsString()
  @Matches(/^[0-9+\s]{8,15}$/, { message: 'customerPhone must be a valid phone number' })
  customerPhone: string;
}
