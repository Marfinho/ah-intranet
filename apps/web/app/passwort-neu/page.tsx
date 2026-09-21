import type { Metadata } from "next";
import Link from "next/link";
import { Signet } from "@/components/logo";
import { PasswortNeuForm } from "./form";

export const metadata: Metadata = { title: "Neues Passwort" };

export default function PasswortNeuPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center text-white">
          <Signet className="h-11 w-11" />
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-[0.1em]">AHOI</h1>
          <p className="mt-3 text-sm text-slate-300">Neues Passwort setzen</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-card sm:p-8">
          {token ? (
            <>
              <p className="mb-5 text-sm text-slate-600">
                Mindestens zehn Zeichen. Nach dem Setzen werden alle offenen Sitzungen Ihres Kontos beendet.
              </p>
              <PasswortNeuForm token={token} />
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Dieser Aufruf enthält keinen gültigen Link.{" "}
              <Link href="/passwort-vergessen" className="font-semibold text-brand-700 hover:underline">
                Fordern Sie einen neuen an.
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
