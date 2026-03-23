import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_ROLES_KEY } from "./roles.decorator";

@Injectable()
export class DemoRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role = request.headers["x-demo-role"] ?? request.body?.role ?? "mitarbeiter";

    if (requiredRoles.includes(role)) {
      return true;
    }

    throw new ForbiddenException("Für diese Aktion fehlen die erforderlichen Rechte");
  }
}
