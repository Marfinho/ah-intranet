import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { AuthProviderKind } from "@ah-intranet/shared";
import { AUTH_PROVIDER_DEFINITIONS } from "@ah-intranet/shared";
import { AuthProvidersService } from "./auth-providers.service";
import { CurrentUser, Permission } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

const ARTEN = AUTH_PROVIDER_DEFINITIONS.map((eintrag) => eintrag.kind);

class ProviderDto {
  @IsIn(ARTEN) kind!: AuthProviderKind;
  @IsString() @MinLength(2) label!: string;
  @IsString() @MinLength(2) directory!: string;
  @IsString() @MinLength(2) clientId!: string;
  @IsOptional() @IsString() clientSecret?: string;
}

class ActiveDto {
  @IsBoolean() isActive!: boolean;
}

/**
 * Anmeldeverfahren eines Hauses.
 *
 * Das Passwort steht nicht zur Disposition - es ist der Grundweg und taucht
 * hier nur in der Beschreibung auf.
 */
@Controller("anmeldeverfahren")
export class AuthProvidersController {
  constructor(private readonly providers: AuthProvidersService) {}

  @Get()
  @Permission("auth.manage")
  async list() {
    return { arten: AUTH_PROVIDER_DEFINITIONS, hinterlegt: await this.providers.list() };
  }

  @Post()
  @Permission("auth.manage")
  upsert(@CurrentUser() user: RequestUser, @Body() dto: ProviderDto) {
    return this.providers.upsert(user, dto);
  }

  @Patch(":kind/aktiv")
  @Permission("auth.manage")
  setActive(@CurrentUser() user: RequestUser, @Param("kind") kind: AuthProviderKind, @Body() dto: ActiveDto) {
    return this.providers.setActive(user, kind, dto.isActive);
  }

  @Delete(":kind")
  @Permission("auth.manage")
  remove(@CurrentUser() user: RequestUser, @Param("kind") kind: AuthProviderKind) {
    return this.providers.remove(user, kind);
  }
}
