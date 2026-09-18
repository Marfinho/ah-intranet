import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix("api");

  // Sicherheitsheader. Die Content-Security-Policy bleibt aus: die API liefert
  // ausschließlich JSON, die Richtlinie gehört vor das Frontend.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(cookieParser());

  // Hinter einem Reverse Proxy ist die echte Client-Adresse nur über
  // X-Forwarded-For zu haben - ohne das drosselt der Throttler alle gemeinsam.
  app.set("trust proxy", 1);

  // Nur das Frontend darf mit Cookies sprechen - `origin: true` würde jede
  // beliebige Seite die Session mitschicken lassen.
  app.enableCors({
    origin: (process.env.FRONTEND_URL ?? "http://localhost:3000").split(",").map((entry) => entry.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
