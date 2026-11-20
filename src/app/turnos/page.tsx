import type { Metadata } from "next";
import { headers } from "next/headers";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import PublicTurnosPortal from "@/components/turnos/PublicTurnosPortal";
import {
  enforceOptionBranding,
  ensureBaseMiniSistemaTenant,
  getTenantByHost,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Turnero Web Online | MiniSistema",
  description:
    "Reservá tu turno médico online las 24 hs, presencial o por videollamada, con obra social o pago particular con Mercado Pago.",
};

export default async function PublicTurnosPage(props: {
  searchParams: Promise<{ sala?: string; rol?: string }>;
}) {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
  const tenant =
    (await getTenantByHost(host)) || (await ensureBaseMiniSistemaTenant());

  const sp = await props.searchParams;
  const initialSalaCode = String(sp?.sala || "").trim();
  const initialSalaRole =
    String(sp?.rol || "").toLowerCase() === "profesional"
      ? "Profesional"
      : "Paciente";

  if (
    !tenant.is_base &&
    Array.isArray(tenant.enabled_modules) &&
    !tenant.enabled_modules.includes("turnos")
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#112D3A] p-8 text-center text-[#FFFFFF]">
        <div>
          <h1 className="text-2xl font-extrabold text-[#56D7A1]">
            Turnero Web no habilitado
          </h1>
          <p className="mt-2 text-sm text-[#FFFFFF]/80">
            Esta institución no tiene activo el módulo Turnero Web en su plan actual.
          </p>
        </div>
      </div>
    );
  }

  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );

  const isMiniSistemaBrand =
    tenant.is_base ||
    tenant.option_type !== 1 ||
    /^minisistema\.?$/i.test((tenant.fantasy_name || "").trim());

  return (
    <div className="min-h-screen bg-[#f3f8fa] text-[#112D3A]">
      <header
        className="border-b-4"
        style={{
          backgroundColor: brand.primaryHex,
          borderColor: brand.accentHex,
        }}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a href="/" className="flex items-center gap-3">
            <img
              src={brand.logoHorizontalUrl}
              alt={tenant.fantasy_name}
              className={
                isMiniSistemaBrand
                  ? "h-11 w-auto object-contain"
                  : "h-12 w-auto rounded-lg bg-[#FFFFFF] px-3 py-1.5 object-contain"
              }
            />
          </a>
          <div className="text-right text-[#FFFFFF]" style={{ color: "#FFFFFF" }}>
            <div
              className="text-xs font-extrabold uppercase tracking-wider sm:text-sm"
              style={{ color: brand.accentHex }}
            >
              Turnero Web · Salud & Telemedicina
            </div>
            <div className="mt-0.5 flex items-center justify-end text-base font-extrabold text-[#FFFFFF]">
              {isMiniSistemaBrand ? (
                <BrandWordmark className="h-5" />
              ) : (
                tenant.fantasy_name
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div
          className="mb-8 rounded-3xl bg-[#112D3A] p-7 text-[#FFFFFF] shadow-xl sm:p-10"
          style={{ backgroundColor: brand.primaryHex, color: "#FFFFFF" }}
        >
          <span
            className="inline-block rounded-full bg-[#56D7A1] px-4 py-1.5 text-xs font-black uppercase tracking-wider text-[#112D3A] sm:text-sm"
            style={{ backgroundColor: brand.accentHex, color: "#112D3A" }}
          >
            Turnos Online 24 hs
          </span>
          <h1
            className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-3xl font-black leading-tight text-[#FFFFFF] sm:text-4xl lg:text-[2.5rem]"
            style={{ color: "#FFFFFF" }}
          >
            <span>Reservá tu Turno Web en</span>
            {isMiniSistemaBrand ? (
              <BrandWordmark className="h-[0.95em]" />
            ) : (
              <span style={{ color: brand.accentHex }}>{tenant.fantasy_name}</span>
            )}
          </h1>
          <p
            className="mt-3 max-w-4xl text-base font-medium leading-relaxed text-[#FFFFFF]/90 sm:text-lg"
            style={{ color: "rgba(255, 255, 255, 0.9)" }}
          >
            Elegí especialidad, profesional, día y horario disponible en tiempo real. Atendete
            presencialmente o por videollamada, con Obra Social / Prepaga o modalidad Particular con
            pago online.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-extrabold sm:text-sm">
            <span className="rounded-xl border border-[#56D7A1]/40 bg-[#FFFFFF]/10 px-3.5 py-2 text-[#FFFFFF]">
              🪪 Registro Rápido por DNI
            </span>
            <span className="rounded-xl border border-[#56D7A1]/40 bg-[#FFFFFF]/10 px-3.5 py-2 text-[#FFFFFF]">
              📹 Sala de Videollamada Integrada
            </span>
            <span className="rounded-xl border border-[#56D7A1]/40 bg-[#FFFFFF]/10 px-3.5 py-2 text-[#FFFFFF]">
              💳 Pago Particular Mercado Pago
            </span>
          </div>
        </div>

        <PublicTurnosPortal
          tenantSlug={tenant.slug}
          fantasyName={tenant.fantasy_name}
          primaryHex={brand.primaryHex}
          accentHex={brand.accentHex}
          logoHorizontalUrl={brand.logoHorizontalUrl}
          logoSymbolUrl={brand.logoSymbolUrl}
          initialSalaCode={initialSalaCode}
          initialSalaRole={initialSalaRole}
        />
      </main>
    </div>
  );
}
