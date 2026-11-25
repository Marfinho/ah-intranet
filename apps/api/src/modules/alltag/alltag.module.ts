import { Module } from "@nestjs/common";
import { CustodyController, MealsController, ShiftSwapsController, ShiftsController } from "./alltag.controller";
import { PlanungController } from "./planung.controller";
import { PlanungService } from "./planung.service";
import { SchichtartenService } from "./schichtarten.service";
import { ShiftsService } from "./shifts.service";
import { CustodyService } from "./custody.service";
import { MealsService } from "./meals.service";

/**
 * Drei Module des Betriebsalltags, die nichts miteinander zu tun haben, aber
 * dieselbe Form: Schichtplan, Verwahrung, Essensbestellung. Getrennte Dienste,
 * gemeinsamer Nest-Modulrahmen - drei Rahmen für je einen Dienst wären Zeremonie.
 */
@Module({
  controllers: [ShiftsController, ShiftSwapsController, PlanungController, CustodyController, MealsController],
  providers: [ShiftsService, PlanungService, SchichtartenService, CustodyService, MealsService],
  exports: [ShiftsService, PlanungService, SchichtartenService, CustodyService, MealsService],
})
export class AlltagModule {}
