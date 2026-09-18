import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.use(cookieParser());

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
