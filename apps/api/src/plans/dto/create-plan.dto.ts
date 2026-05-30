import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  /** Цена в рублях, целое число. */
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  priceRub!: number;

  /** Длительность в днях. */
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays!: number;

  /** Лимит трафика в GB. null/undefined = без лимита. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  trafficLimitGb?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}
