import { notFound } from "next/navigation";
import PublicLaboratorioPortal from "@/components/laboratorio/PublicLaboratorioPortal";
import {
  enforceOptionBranding,
  getTenantBySlug,
  isReservedAppSlug,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export default async function TenantPublicLaboratorioPage(context: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ qr?: string }>;
}) {
  const { tenantSlug } = await context.params;
  const sp = await context.searchParams;
  const clean = tenantSlug.trim().toLowerCase();
  if (isReservedAppSlug(clean)) notFound();

  const tenant = await getTenantBySlug(clean);
  if (!tenant) notFound();

  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );
  const initialQr = String(sp?.qr || "").trim();

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
          <div className="flex items-center gap-3">
            <img
              src={brand.logoHorizontalUrl}
              alt={tenant.fantasy_name}
              className="h-11 w-auto rounded-lg bg-white/95 px-2.5 py-1 object-contain"
            />
          </div>
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
