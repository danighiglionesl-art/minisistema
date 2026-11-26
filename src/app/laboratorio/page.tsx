import type { Metadata } from "next";
import { headers } from "next/headers";
import PublicLaboratorioPortal from "@/components/laboratorio/PublicLaboratorioPortal";
import {
  enforceOptionBranding,
  ensureBaseMiniSistemaTenant,
  getTenantByHost,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portal de Resultados Bioquímicos | Laboratorio",
  description:
    "Consultá y descargá tus resultados de análisis clínicos firmados digitalmente escaneando tu tarjeta QR.",
};

export default async function PublicLaboratorioPage(props: {
  searchParams: Promise<{ qr?: string }>;
}) {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
  const tenant =
    (await getTenantByHost(host)) || (await ensureBaseMiniSistemaTenant());
  const sp = await props.searchParams;
  const initialQr = String(sp?.qr || "").trim();

  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );

  return (
    <div className="min-h-screen bg-[#f3f8fa] text-[#112D3A]">
      <header
        className="no-print border-b-4"
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
              className="h-11 w-auto rounded-lg bg-white/95 px-2.5 py-1 object-contain"
            />
          </a>
          <div className="text-right text-white">
            <div
              className="text-xs font-extrabold uppercase tracking-wider"
              style={{ color: brand.accentHex }}
            >
              Laboratorio de Análisis Clínicos · Portal QR
            </div>
            <div className="text-base font-extrabold text-white">
              {tenant.fantasy_name}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <PublicLaboratorioPortal
          tenantSlug={tenant.slug}
          fantasyName={tenant.fantasy_name}
          primaryHex={brand.primaryHex}
          accentHex={brand.accentHex}
          initialQr={initialQr}
        />
      </main>
    </div>
  );
}
