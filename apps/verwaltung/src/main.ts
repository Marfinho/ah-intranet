import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { dirname, join } from "node:path";
import { AppModule } from "./app.module";
import { pruefeGeheimnisse } from "./core/geheimnis-pruefung";

async function bootstrap() {
  if (!process.env.VERWALTUNG_JWT_SECRET) {
    console.error("Start abgebrochen: VERWALTUNG_JWT_SECRET fehlt. Zufallswerte erzeugt man mit: openssl rand -hex 32");
    process.exit(1);
  }
  // Dieselbe Prüfung wie beim Kundendienst, nur auf den eigenen Schlüsselnamen.
  const probleme = pruefeGeheimnisse({ ...process.env, JWT_SECRET: process.env.VERWALTUNG_JWT_SECRET });
  if (probleme.length > 0) {
    console.error(`Start abgebrochen:\n- ${probleme.join("\n- ")}`);
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix("api");

  // Die Oberfläche kommt aus demselben Prozess und bindet nur eigene Dateien ein:
  // keine Inline-Skripte, keine fremden Quellen.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'"],
          "img-src": ["'self'", "data:"],
          "connect-src": ["'self'"],
          "object-src": ["'none'"],
          "base-uri": ["'self'"],
          "form-action": ["'self'"],
          "frame-ancestors": ["'none'"],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.set("trust proxy", 1);

  // Eine Änderung verlangt dieses Kopffeld: ein Formular auf einer fremden Seite kann es nicht setzen.
  app.use(
    (
      anfrage: { method: string; headers: Record<string, string | undefined> },
      antwort: { status: (n: number) => { json: (v: unknown) => void } },
      weiter: () => void,
    ) => {
      const aendernd = !["GET", "HEAD", "OPTIONS"].includes(anfrage.method);
      if (aendernd && anfrage.headers["x-verwaltung"] !== "1") {
        antwort.status(403).json({ message: "Anfrage nicht aus der Verwaltung" });
        return;
      }
      weiter();
    },
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  // Schriften aus den Paketen, keine Anfrage an fremde Server.
  for (const familie of ["archivo", "source-sans-3"]) {
    app.useStaticAssets(dirname(require.resolve(`@fontsource/${familie}/package.json`)), {
      prefix: `/schriften/${familie}/`,
    });
  }
  app.useStaticAssets(join(__dirname, "..", "public"), { index: "index.html", maxAge: 0 });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3002);
}

void bootstrap();
