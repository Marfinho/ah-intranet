import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

export class CreateNewsDto {
  @IsString()
  slug!: string;

  @IsString()
  title!: string;

  @IsString()
  teaser!: string;

  @IsString()
  content!: string;

  @IsIn(["niedrig", "normal", "hoch", "kritisch"])
  priority!: "niedrig" | "normal" | "hoch" | "kritisch";

  @IsIn(["draft", "published", "archived"])
  status!: "draft" | "published" | "archived";

  @IsArray()
  audience!: string[];

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
