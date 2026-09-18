import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmeldung · Autohaus Intranet" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-100">Autohaus</p>
          <h1 className="mt-1 text-3xl font-bold">Intranet</h1>
          <p className="mt-2 text-sm text-brand-50">
            Interner Arbeitsbereich für News, Bestellungen, Freigaben und Services.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-card sm:p-8">
          <LoginForm next={searchParams.next ?? "/"} />
        </div>

        <p className="mt-6 text-center text-xs text-brand-100">
          Probleme bei der Anmeldung? Bitte wenden Sie sich an die IT.
        </p>
      </div>
    </div>
  );
}
