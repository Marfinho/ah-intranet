import { Module } from "@nestjs/common";
import {
  AbsencesController,
  DirectoryController,
  NotificationsController,
  OnboardingController,
  ProfileController,
  RolesController,
  UsersController,
} from "./people.controller";
import { BrandsController, LocationsController } from "./org.controller";
import { PeopleService } from "./people.service";
import { AbsencesService } from "./absences.service";
import { OnboardingService } from "./onboarding.service";
import { OrgService } from "./org.service";
import { BetriebskalenderController } from "./betriebskalender.controller";
import { BetriebskalenderService } from "./betriebskalender.service";

@Module({
  controllers: [
    DirectoryController,
    ProfileController,
    UsersController,
    RolesController,
    AbsencesController,
    OnboardingController,
    NotificationsController,
    LocationsController,
    BrandsController,
    BetriebskalenderController,
  ],
  providers: [PeopleService, AbsencesService, OnboardingService, OrgService, BetriebskalenderService],
  exports: [PeopleService, AbsencesService, OnboardingService, OrgService, BetriebskalenderService],
})
export class PeopleModule {}
