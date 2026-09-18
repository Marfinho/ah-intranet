import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { AbsenceType } from "@prisma/client";
import type { AppRole, Presence } from "@ah-intranet/shared";
import { PeopleService } from "./people.service";
import { AbsencesService } from "./absences.service";
import { OnboardingService } from "./onboarding.service";
import { NotificationsService } from "../../core/notifications.service";
import { CurrentUser, Feature, Roles } from "../../core/decorators";
import type { RequestUser } from "../../core/request-user";

/* ------------------------------------------------------------------ DTOs */

class ProfileDto {
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() mobile?: string | null;
  @IsOptional() @IsIn(["vor Ort", "mobil", "abwesend"]) presence?: Presence;
  @IsOptional() @IsArray() @IsString({ each: true }) responsibilities?: string[];
}

class UserBodyDto {
  @IsString() @MinLength(3) username!: string;
  @IsString() @MinLength(2) firstName!: string;
  @IsString() @MinLength(2) lastName!: string;
  @IsOptional() @IsEmail({}, { message: "Bitte eine gültige E-Mail-Adresse angeben" }) email?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() specialtyAreaId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(["mitarbeiter", "fuehrungskraft", "fachbereichsadmin", "admin"], { each: true })
  roles!: AppRole[];
  @IsOptional() @IsArray() @IsString({ each: true }) responsibilities?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) annualLeaveDays?: number;
  @IsOptional() @IsIn(["active", "inactive"]) status?: "active" | "inactive";
}

class UserPatchDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() specialtyAreaId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional()
  @IsArray()
  @IsIn(["mitarbeiter", "fuehrungskraft", "fachbereichsadmin", "admin"], { each: true })
  roles?: AppRole[];
  @IsOptional() @IsArray() @IsString({ each: true }) responsibilities?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) annualLeaveDays?: number;
  @IsOptional() @IsIn(["active", "inactive"]) status?: "active" | "inactive";
}

class RolePermissionsDto {
  @IsArray() @IsString({ each: true }) permissions!: string[];
}

class AbsenceDto {
  @IsIn(["urlaub", "krank", "gleitzeit", "sonderurlaub", "fortbildung"]) type!: AbsenceType;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
  @IsOptional() @IsString() note?: string;
}

class DecisionDto {
  @IsBoolean() approve!: boolean;
  @IsOptional() @IsString() note?: string;
}

class OnboardingStepDto {
  @IsString() @MinLength(2) title!: string;
  @IsString() ownerRole!: string;
  @IsBoolean() isRequired!: boolean;
}

class OnboardingTemplateDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(2) name!: string;
  @IsString() targetRole!: string;
  @IsString() durationLabel!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OnboardingStepDto) steps!: OnboardingStepDto[];
}

class AssignDto {
  @IsString() templateId!: string;
  @IsString() userId!: string;
  @IsString() startDate!: string;
}

class ToggleDto {
  @IsBoolean() done!: boolean;
}

/* ------------------------------------------------------------ Controller */

@Controller("directory")
@Feature("directory")
export class DirectoryController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  list(
    @Query("search") search?: string,
    @Query("location") location?: string,
    @Query("department") department?: string,
  ) {
    return this.people.directory({ search, location, department });
  }
}

@Controller("profile")
export class ProfileController {
  constructor(private readonly people: PeopleService) {}

  @Patch()
  update(@CurrentUser() user: RequestUser, @Body() dto: ProfileDto) {
    return this.people.updateOwnProfile(user, dto);
  }
}

@Controller("users")
export class UsersController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  @Roles("admin", "fachbereichsadmin")
  list(@Query("search") search?: string, @Query("status") status?: string) {
    return this.people.listUsers({ search, status });
  }

  @Get("organisation")
  @Roles("admin", "fachbereichsadmin")
  organisation() {
    return this.people.organisation();
  }

  @Post()
  @Roles("admin")
  create(@CurrentUser() user: RequestUser, @Body() dto: UserBodyDto) {
    return this.people.createUser(user, dto);
  }

  @Patch(":id")
  @Roles("admin")
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UserPatchDto) {
    return this.people.updateUser(user, id, dto);
  }

  @Post(":id/reset-password")
  @Roles("admin")
  resetPassword(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.people.resetPassword(user, id);
  }
}

@Controller("roles")
export class RolesController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  @Roles("admin", "fachbereichsadmin")
  list() {
    return this.people.roles();
  }

  @Get("permissions")
  @Roles("admin")
  permissions() {
    return this.people.permissions();
  }

  @Patch(":id/permissions")
  @Roles("admin")
  setPermissions(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: RolePermissionsDto) {
    return this.people.setRolePermissions(user, id, dto.permissions);
  }
}

@Controller("absences")
@Feature("absences")
export class AbsencesController {
  constructor(private readonly absences: AbsencesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("scope") scope?: "mine" | "team", @Query("status") status?: string) {
    return this.absences.list(user, { scope, status });
  }

  @Get("balance")
  balance(@CurrentUser() user: RequestUser) {
    return this.absences.balance(user);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: AbsenceDto) {
    return this.absences.create(user, dto);
  }

  @Post(":id/decision")
  decide(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: DecisionDto) {
    return this.absences.decide(user, id, dto.approve, dto.note);
  }

  @Post(":id/cancel")
  cancel(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.absences.cancel(user, id);
  }
}

@Controller("onboarding")
@Feature("onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  overview(@CurrentUser() user: RequestUser) {
    return this.onboarding.overview(user);
  }

  @Post("templates")
  @Roles("admin", "fachbereichsadmin")
  upsertTemplate(@CurrentUser() user: RequestUser, @Body() dto: OnboardingTemplateDto) {
    return this.onboarding.upsertTemplate(user, dto);
  }

  @Post("assignments")
  @Roles("admin", "fachbereichsadmin")
  assign(@CurrentUser() user: RequestUser, @Body() dto: AssignDto) {
    return this.onboarding.assign(user, dto.templateId, dto.userId, dto.startDate);
  }

  @Patch("items/:id")
  toggleItem(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: ToggleDto) {
    return this.onboarding.toggleItem(user, id, dto.done);
  }
}

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query("unread") unread?: string) {
    return this.notifications.list(user, unread === "true");
  }

  @Get("count")
  count(@CurrentUser() user: RequestUser) {
    return this.notifications.unreadCount(user).then((unread) => ({ unread }));
  }

  @Post(":id/read")
  @HttpCode(200)
  markRead(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.notifications.markRead(user, id);
  }

  @Post("read-all")
  @HttpCode(200)
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notifications.markAllRead(user).then((count) => ({ count }));
  }
}
