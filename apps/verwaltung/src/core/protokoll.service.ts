import { Injectable } from "@nestjs/common";
import type { Sitzung } from "./decorators";
import { DatenbankService } from "./datenbank";

@Injectable()
export class ProtokollService {
  constructor(private readonly db: DatenbankService) {}

  async schreibe(
    wer: Pick<Sitzung, "id" | "username"> | null,
    aktion: string,
    objektTyp: string,
    objektId: string,
    detail: string,
  ): Promise<void> {
    await this.db.protokoll.create({
      data: {
        betreiberId: wer?.id ?? null,
        betreiberName: wer?.username ?? "system",
        aktion,
        objektTyp,
        objektId,
        detail,
      },
    });
  }
}
