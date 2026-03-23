import { IsArray, IsInt, IsString, Min } from "class-validator";

class WorkwearItemDto {
  @IsString()
  catalogItemId!: string;

  @IsString()
  size!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateWorkwearOrderDto {
  @IsString()
  username!: string;

  @IsArray()
  items!: WorkwearItemDto[];
}
