import { Module } from "@nestjs/common";
import { CustodyController, MealsController, ShiftSwapsController, ShiftsController } from "./alltag.controller";
import { ShiftsService } from "./shifts.service";
import { CustodyService } from "./custody.service";
import { MealsService } from "./meals.service";

/**
 * Drei Module des Betriebsalltags, die nichts miteinander zu tun haben, aber
 * dieselbe Form: Schichtplan, Verwahrung, Essensbestellung. Getrennte Dienste,
 * gemeinsamer Nest-Modulrahmen - drei Rahmen für je einen Dienst wären Zeremonie.
 */
@Module({
  controllers: [ShiftsController, ShiftSwapsController, CustodyController, MealsController],
  providers: [ShiftsService, CustodyService, MealsService],
  exports: [ShiftsService, CustodyService, MealsService],
})
export class AlltagModule {}
