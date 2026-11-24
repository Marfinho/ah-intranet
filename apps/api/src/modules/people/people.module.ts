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
  ],
  providers: [PeopleService, AbsencesService, OnboardingService, OrgService],
  exports: [PeopleService, AbsencesService, OnboardingService, OrgService],
})
export class PeopleModule {}
