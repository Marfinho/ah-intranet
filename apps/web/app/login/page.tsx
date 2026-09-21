import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Signet } from "@/components/logo";

export const metadata: Metadata = { title: "Anmeldung" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string; fehler?: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center text-white">
          <Signet className="h-11 w-11" />
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-[0.1em]">AHOI</h1>
          <p className="mt-3 text-sm text-slate-300">Autohaus Organisation &amp; Information</p>
        </div>

        {searchParams.fehler ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {searchParams.fehler}
          </div>
        ) : null}

        <div className="rounded-3xl bg-white p-6 shadow-card sm:p-8">
          <LoginForm next={searchParams.next ?? "/"} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Probleme bei der Anmeldung? Bitte wenden Sie sich an die IT.
        </p>
      </div>
    </div>
  );
}
