import { Controller, Get } from "@nestjs/common";
import { onboardingTemplates } from "@ah-intranet/shared";

@Controller("onboarding")
export class OnboardingController {
  @Get()
  findAll() {
    return onboardingTemplates;
  }
}
