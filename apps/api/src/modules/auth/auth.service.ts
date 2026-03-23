import { Injectable, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { currentUser, users } from "@ah-intranet/shared";
import { AuditService } from "../audit/audit.service";

const demoUsers = [
  { username: "admin", password: "Start123!", role: "admin", name: "Markus Becker" },
  { username: currentUser.username, password: "Start123!", role: currentUser.role, name: currentUser.displayName },
  { username: "fachbereich", password: "Start123!", role: "fachbereichsadmin", name: "Timo Neumann" },
];

@Injectable()
export class AuthService {
  constructor(private readonly auditService: AuditService) {}

  async login(username: string, password: string) {
    const demoUser = demoUsers.find((user) => user.username === username);
    if (!demoUser) {
      throw new UnauthorizedException("Ungültige Zugangsdaten");
    }

    const matches = await bcrypt.compare(password, await bcrypt.hash(demoUser.password, 10));
    if (!matches) {
      throw new UnauthorizedException("Ungültige Zugangsdaten");
    }

    const profile = users.find((user) => user.username === demoUser.username);

    this.auditService.log({
      actor: username,
      action: "auth.login",
      entityType: "user",
      entityId: username,
      detail: `Login erfolgreich für ${demoUser.name}`,
    });

    return {
      token: `demo-token-${username}`,
      user: {
        username: demoUser.username,
        displayName: demoUser.name,
        role: demoUser.role,
        profile,
      },
    };
  }
}
