import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { MfaService } from "./mfa.service";
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
          // Algorithmus fest vorgeben, statt ihn dem Token zu überlassen: so
          // bleibt ausgeschlossen, dass ein Token mit `alg: none` oder einem
          // anderen Verfahren als gültig durchgeht.
          signOptions: {
            algorithm: "HS256" as const,
            expiresIn: (config.get<string>("JWT_EXPIRES_IN") ?? "12h") as JwtSignOptions["expiresIn"],
          },
          verifyOptions: { algorithms: ["HS256" as const] },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswortService, MfaService],
  exports: [JwtModule, AuthService, MfaService],
})
export class AuthModule {}
