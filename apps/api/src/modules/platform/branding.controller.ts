import { Controller, Delete, Get, NotFoundException, Post, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { BrandingService } from "./branding.service";
import { CurrentUser, Permission, Public } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

@Controller("branding")
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  /**
   * Ohne Anmeldung erreichbar: die Anmeldeseite selbst zeigt das Logo schon,
   * bevor irgendjemand ein Konto hat. Das Haus steht trotzdem fest - über die
   * Subdomain, genau wie der Rest der Auflösung.
   */
  @Get("logo")
  @Public()
  async logo(@Res({ passthrough: true }) response: Response) {
    const logo = await this.branding.logo();
    if (!logo) {
      throw new NotFoundException();
    }
    response.setHeader("Content-Type", logo.mime);
    response.setHeader("Cache-Control", "no-store");
    return logo.data;
  }

  @Post("logo")
  @Permission("branding.manage")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  upload(@CurrentUser() user: RequestUser, @UploadedFile() file?: Express.Multer.File) {
    return this.branding.upload(user, file);
  }

  @Delete("logo")
  @Permission("branding.manage")
  remove(@CurrentUser() user: RequestUser) {
    return this.branding.remove(user);
  }
}
