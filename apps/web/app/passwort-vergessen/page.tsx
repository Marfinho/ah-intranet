import type { Metadata } from "next";
import Link from "next/link";
import { Signet } from "@/components/logo";
import { PasswortVergessenForm } from "./form";

export const metadata: Metadata = { title: "Passwort vergessen" };

export default function PasswortVergessenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center text-white">
          <Signet className="h-11 w-11" />
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-[0.1em]">AHOI</h1>
          <p className="mt-3 text-sm text-slate-300">Passwort zurücksetzen</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-card sm:p-8">
          <p className="mb-5 text-sm text-slate-600">
            Geben Sie Ihren Benutzernamen ein. Ist eine E-Mail-Adresse hinterlegt, schicken wir einen Link zum Setzen
            eines neuen Passworts.
          </p>
          <PasswortVergessenForm />
          <p className="mt-5 text-sm text-slate-600">
            <Link href="/login" className="font-semibold text-brand-700 hover:underline">
              Zurück zur Anmeldung
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Ohne hinterlegte E-Mail-Adresse hilft nur die Administration Ihres Hauses weiter.
        </p>
      </div>
    </div>
  );
}
