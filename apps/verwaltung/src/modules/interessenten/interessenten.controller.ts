import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { IsIn, IsOptional, IsString } from "class-validator";
import { LEAD_STATUS } from "@ah-intranet/shared";
import { Aktuell, Schreibend, type Sitzung } from "../../core/decorators";
import { InteressentenService } from "./interessenten.service";

class StatusDto {
  @IsIn([...LEAD_STATUS]) status!: string;
}
class NotizDto {
  @IsOptional() @IsString() notiz?: string | null;
}

@Controller("interessenten")
export class InteressentenController {
  constructor(private readonly interessenten: InteressentenService) {}

  @Get() async liste() {
    const [liste, auswertung] = await Promise.all([this.interessenten.liste(), this.interessenten.auswertung()]);
    return { liste, auswertung };
  }
  @Get(":id") detail(@Param("id") id: string) {
    return this.interessenten.detail(id);
  }

  @Patch(":id/status")
  @Schreibend()
  async status(@Aktuell() wer: Sitzung, @Param("id") id: string, @Body() dto: StatusDto) {
    await this.interessenten.setzeStatus(wer, id, dto.status);
    return { ok: true };
  }
  @Patch(":id/notiz")
  @Schreibend()
  async notiz(@Aktuell() wer: Sitzung, @Param("id") id: string, @Body() dto: NotizDto) {
    await this.interessenten.setzeNotiz(wer, id, dto.notiz ?? null);
    return { ok: true };
  }
  @Post(":id/link-widerrufen")
  @Schreibend()
  async widerrufen(@Aktuell() wer: Sitzung, @Param("id") id: string) {
    await this.interessenten.widerrufeLink(wer, id);
    return { ok: true };
  }
}
