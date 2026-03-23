import { IsArray, IsString } from "class-validator";

export class CreateBusinessCardOrderDto {
  @IsString()
  username!: string;

  @IsArray()
  fields!: Array<{ key: string; value: string }>;
}
