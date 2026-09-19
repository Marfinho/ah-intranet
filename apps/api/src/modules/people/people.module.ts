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
import { PeopleService } from "./people.service";
import { AbsencesService } from "./absences.service";
import { OnboardingService } from "./onboarding.service";

@Module({
  controllers: [
    DirectoryController,
    ProfileController,
    UsersController,
    RolesController,
    AbsencesController,
    OnboardingController,
    NotificationsController,
  ],
  providers: [PeopleService, AbsencesService, OnboardingService],
  exports: [PeopleService, AbsencesService, OnboardingService],
})
export class PeopleModule {}
