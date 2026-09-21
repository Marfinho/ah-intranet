import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EntraController } from "./entra.controller";
import { EntraService } from "./entra.service";
import { PasswortService } from "./passwort.service";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("JWT_SECRET");
        if (!secret) {
          throw new Error("JWT_SECRET ist nicht gesetzt - die API startet ohne Sitzungsschlüssel nicht.");
        }
        return {
          secret,
          signOptions: { expiresIn: config.get<string>("JWT_EXPIRES_IN") ?? "12h" },
        };
      },
    }),
  ],
  controllers: [AuthController, EntraController],
  providers: [AuthService, PasswortService, EntraService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
