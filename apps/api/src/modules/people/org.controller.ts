import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ArrayUnique, IsArray, IsOptional, IsString, MinLength } from "class-validator";
import { OrgService } from "./org.service";
import { CurrentUser, Permission } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

class LocationBodyDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(2) code!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) brandIds?: string[];
}

class LocationPatchDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @MinLength(2) code?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) brandIds?: string[];
}

class BrandBodyDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(2) code!: string;
}

class BrandPatchDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @MinLength(2) code?: string;
}

@Controller("standorte")
@Permission("org.manage")
export class LocationsController {
  constructor(private readonly org: OrgService) {}

  @Get()
  list() {
    return this.org.listLocations();
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: LocationBodyDto) {
    return this.org.createLocation(user, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: LocationPatchDto) {
    return this.org.updateLocation(user, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.org.deleteLocation(user, id);
  }
}

@Controller("marken")
@Permission("org.manage")
export class BrandsController {
  constructor(private readonly org: OrgService) {}

  @Get()
  list() {
    return this.org.listBrands();
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: BrandBodyDto) {
    return this.org.createBrand(user, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: BrandPatchDto) {
    return this.org.updateBrand(user, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.org.deleteBrand(user, id);
  }
}
