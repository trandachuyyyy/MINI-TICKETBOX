import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class HoldTicketDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsInt()
  @Min(1)
  @Max(8)
  quantity: number;
}
