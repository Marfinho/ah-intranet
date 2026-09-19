import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { OnboardingAssignment, OnboardingTemplate } from "@ah-intranet/shared";
import { PrismaService } from "../../core/prisma.service";
import { requireTenantId } from "../../core/tenant-context";
import { AuditService } from "../../core/audit.service";
import { NotificationsService } from "../../core/notifications.service";
import { displayName, toIso } from "../../core/mappers";
import { can, type RequestUser } from "../../core/request-user";

const templateInclude = {
  steps: { orderBy: { sortOrder: "asc" } },
  _count: { select: { assignments: true } },
} as const;

const assignmentInclude = {
  template: { select: { id: true, name: true } },
  user: { select: { username: true, firstName: true, lastName: true } },
  items: { include: { step: true }, orderBy: { step: { sortOrder: "asc" } } },
} as const;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async overview(user: RequestUser) {
    const [templates, assignments] = await Promise.all([
      this.prisma.onboardingTemplate.findMany({
        where: can(user, "onboarding.manage") ? {} : { isActive: true },
        include: templateInclude,
        orderBy: { name: "asc" },
      }),
      this.prisma.onboardingAssignment.findMany({
        where: can(user, "onboarding.manage") ? {} : { userId: user.id },
        include: assignmentInclude,
        orderBy: { startDate: "desc" },
      }),
    ]);

    return {
      templates: templates.map((template) => this.toTemplate(template)),
      assignments: assignments.map((assignment) => this.toAssignment(assignment)),
      canManage: can(user, "onboarding.manage"),
    };
  }

  async upsertTemplate(
    user: RequestUser,
    input: {
      id?: string;
      name: string;
      targetRole: string;
      durationLabel: string;
      isActive?: boolean;
      steps: { title: string; ownerRole: string; isRequired: boolean }[];
    },
  ): Promise<OnboardingTemplate[]> {
    const data = {
      name: input.name,
      targetRole: input.targetRole,
      durationLabel: input.durationLabel,
      isActive: input.isActive ?? true,
    };

    const template = input.id
      ? await this.prisma.onboardingTemplate.update({ where: { id: input.id }, data })
      : await this.prisma.onboardingTemplate.create({ data });

    if (input.steps?.length) {
      // Schritte vollständig ersetzen; bestehende Zuweisungen behalten ihre
      // Positionen über die Kaskade beim Löschen nicht - deshalb nur bei Neuanlage
      // oder ausdrücklicher Neudefinition.
      await this.prisma.$transaction([
        this.prisma.onboardingStep.deleteMany({ where: { templateId: template.id } }),
        this.prisma.onboardingStep.createMany({
          data: input.steps.map((step, index) => ({
            templateId: template.id,
            title: step.title,
            ownerRole: step.ownerRole,
            isRequired: step.isRequired,
            sortOrder: index,
          })),
        }),
      ]);
    }

    await this.audit.log({
      actor: user,
      action: input.id ? "onboarding.template_update" : "onboarding.template_create",
      entityType: "onboarding_template",
      entityId: template.id,
      detail: `Onboarding-Vorlage "${template.name}" gespeichert`,
    });

    const templates = await this.prisma.onboardingTemplate.findMany({
      include: templateInclude,
      orderBy: { name: "asc" },
    });
    return templates.map((entry) => this.toTemplate(entry));
  }

  /** Weist einer Person eine Vorlage zu und legt die Checkliste an. */
  async assign(
    user: RequestUser,
    templateId: string,
    userId: string,
    startDate: string,
  ): Promise<OnboardingAssignment> {
    const template = await this.prisma.onboardingTemplate.findUnique({
      where: { id: templateId },
      include: { steps: true },
    });
    if (!template) {
      throw new NotFoundException("Onboarding-Vorlage nicht gefunden");
    }

    const assignment = await this.prisma.onboardingAssignment.upsert({
      where: { tenantId_templateId_userId: { tenantId: requireTenantId(), templateId, userId } },
      update: { startDate: new Date(startDate) },
      create: {
        templateId,
        userId,
        startDate: new Date(startDate),
        items: { create: template.steps.map((step) => ({ stepId: step.id })) },
      },
      include: assignmentInclude,
    });

    await this.audit.log({
      actor: user,
      action: "onboarding.assign",
      entityType: "onboarding_assignment",
      entityId: assignment.id,
      detail: `${template.name} an ${displayName(assignment.user)} zugewiesen`,
    });

    await this.notifications.notify({
      userIds: [userId],
      title: "Onboarding-Plan zugewiesen",
      detail: `Ihr Einarbeitungsplan "${template.name}" steht bereit.`,
      link: "/onboarding",
    });

    return this.toAssignment(assignment);
  }

  async toggleItem(user: RequestUser, itemId: string, done: boolean): Promise<OnboardingAssignment> {
    const item = await this.prisma.onboardingItem.findUnique({
      where: { id: itemId },
      include: { assignment: { select: { userId: true } } },
    });
    if (!item) {
      throw new NotFoundException("Checklistenpunkt nicht gefunden");
    }
    if (item.assignment.userId !== user.id && !can(user, "onboarding.manage")) {
      throw new ForbiddenException("Dieser Einarbeitungsplan gehört zu einer anderen Person.");
    }

    await this.prisma.onboardingItem.update({
      where: { id: itemId },
      data: { done, doneAt: done ? new Date() : null },
    });

    const assignment = await this.prisma.onboardingAssignment.findUniqueOrThrow({
      where: { id: item.assignmentId },
      include: assignmentInclude,
    });
    return this.toAssignment(assignment);
  }

  private toTemplate(
    template: Prisma.OnboardingTemplateGetPayload<{ include: typeof templateInclude }>,
  ): OnboardingTemplate {
    return {
      id: template.id,
      name: template.name,
      targetRole: template.targetRole,
      durationLabel: template.durationLabel,
      steps: template.steps.map((step) => ({
        id: step.id,
        title: step.title,
        ownerRole: step.ownerRole,
        required: step.isRequired,
        sortOrder: step.sortOrder,
      })),
      assignmentCount: template._count.assignments,
    };
  }

  private toAssignment(
    assignment: Prisma.OnboardingAssignmentGetPayload<{ include: typeof assignmentInclude }>,
  ): OnboardingAssignment {
    const items = assignment.items.map((item) => ({
      id: item.id,
      title: item.step.title,
      ownerRole: item.step.ownerRole,
      required: item.step.isRequired,
      done: item.done,
      doneAt: toIso(item.doneAt),
    }));

    return {
      id: assignment.id,
      templateId: assignment.template.id,
      templateName: assignment.template.name,
      employee: displayName(assignment.user),
      employeeUsername: assignment.user.username,
      startDate: assignment.startDate.toISOString(),
      doneCount: items.filter((item) => item.done).length,
      totalCount: items.length,
      items,
    };
  }
}
