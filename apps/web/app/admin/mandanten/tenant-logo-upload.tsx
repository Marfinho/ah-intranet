"use client";

import { useRef, useTransition } from "react";
import type { TenantSummary } from "@ah-intranet/shared";
import { TENANT_LOGO_MAX_LENGTH } from "@ah-intranet/shared";
import { setTenantLogoAction } from "@/lib/actions";
import { Logo } from "@/components/logo";

/**
 * Logo je Mandant. Wandelt die Datei im Browser in eine Data-URL um - es gibt
 * heute keine eigene Dateiablage (siehe `Document.url`), und für die
 * Größenordnung eines Logos reicht das.
 */
export function TenantLogoUpload({ tenant }: { tenant: TenantSummary }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function hochladen(datei: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (dataUrl.length > TENANT_LOGO_MAX_LENGTH) {
        window.alert("Das Logo ist zu groß (maximal rund 200 KB). Bitte kleiner speichern und erneut versuchen.");
        return;
      }
      startTransition(async () => {
        const result = await setTenantLogoAction(tenant.id, dataUrl);
        if (!result.ok && result.message) {
          window.alert(result.message);
        }
      });
    };
    reader.readAsDataURL(datei);
  }

  function entfernen() {
    startTransition(async () => {
      const result = await setTenantLogoAction(tenant.id, null);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
        <Logo logoUrl={tenant.logoUrl} hausName={tenant.name} signetClass="h-4 w-4" className="h-6" />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        hidden
        onChange={(event) => {
          const datei = event.target.files?.[0];
          if (datei) hochladen(datei);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="text-xs font-semibold text-brand-700 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {tenant.logoUrl ? "Ändern" : "Hochladen"}
      </button>
      {tenant.logoUrl ? (
        <button
          type="button"
          disabled={pending}
          onClick={entfernen}
          className="text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Entfernen
        </button>
      ) : null}
    </div>
  );
}
