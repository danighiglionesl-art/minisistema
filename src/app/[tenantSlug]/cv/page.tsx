import { notFound } from "next/navigation";
import PublicCvForm from "@/components/cv/PublicCvForm";
import referenceCatalogs from "@/lib/erp/reference-catalogs.json";
import {
  enforceOptionBranding,
  getTenantBySlug,
  isReservedAppSlug,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export default async function TenantPublicCvPage(context: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await context.params;
  const clean = tenantSlug.trim().toLowerCase();
  if (isReservedAppSlug(clean)) notFound();

  const tenant = await getTenantBySlug(clean);
  if (!tenant) notFound();

  if (
    !tenant.is_base &&
    Array.isArray(tenant.enabled_modules) &&
    !tenant.enabled_modules.includes("cv")
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#112D3A] p-8 text-center text-[#FFFFFF]">
        <div>
          <h1 className="text-2xl font-extrabold text-[#56D7A1]">
            Portal de CV no habilitado
          </h1>
          <p className="mt-2 text-sm text-[#FFFFFF]/80">
            Este comercio no tiene activo el módulo de Curriculum Vitae.
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

  const cats = referenceCatalogs.catalogs as {
    paises?: Array<{ id: number; nombre: string; abreviatura?: string }>;
    provincias?: string[];
    localidadesPorProvincia?: Record<
      string,
      Array<{ nombre: string; cp?: string }>
    >;
  };

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
          <div className="flex items-center gap-3">
            <img
              src={brand.logoHorizontalUrl}
              alt={tenant.fantasy_name}
              className="h-12 w-auto rounded-lg bg-[#FFFFFF] px-3 py-1.5 object-contain"
            />
          </div>
          <div className="text-right text-[#FFFFFF]" style={{ color: "#FFFFFF" }}>
            <div
              className="text-xs font-extrabold uppercase tracking-wider sm:text-sm"
              style={{ color: brand.accentHex }}
            >
              Selección de Personal · RR.HH.
            </div>
            <div className="text-base font-extrabold text-[#FFFFFF]">{tenant.fantasy_name}</div>
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
            Portal Oficial de Postulaciones
          </span>
          <h1
            className="mt-4 text-3xl font-black leading-tight text-[#FFFFFF] sm:text-4xl lg:text-[2.65rem]"
            style={{ color: "#FFFFFF" }}
          >
            Cargá tu Curriculum Vitae en{" "}
            <span style={{ color: brand.accentHex }}>{tenant.fantasy_name}</span>
          </h1>
          <p
            className="mt-3 max-w-4xl text-base font-medium leading-relaxed text-[#FFFFFF]/90 sm:text-lg"
            style={{ color: "rgba(255, 255, 255, 0.9)" }}
          >
            Completá tus datos personales, ubicación, disponibilidad horaria, formación,
            fotografía y adjuntá tu CV en PDF.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-extrabold sm:text-sm">
            <span className="rounded-xl border border-[#56D7A1]/40 bg-[#FFFFFF]/10 px-3.5 py-2 text-[#FFFFFF]">
              📷 Fotografía de Perfil
            </span>
            <span className="rounded-xl border border-[#56D7A1]/40 bg-[#FFFFFF]/10 px-3.5 py-2 text-[#FFFFFF]">
              📄 Adjunto de CV en PDF
            </span>
            <span className="rounded-xl border border-[#56D7A1]/40 bg-[#FFFFFF]/10 px-3.5 py-2 text-[#FFFFFF]">
              ✅ Confirmación Inmediata de Recepción
            </span>
          </div>
        </div>

        <PublicCvForm
          tenantSlug={tenant.slug}
          fantasyName={tenant.fantasy_name}
          businessName={tenant.business_name}
          primaryHex={brand.primaryHex}
          accentHex={brand.accentHex}
          logoHorizontalUrl={brand.logoHorizontalUrl}
          defaultProvincia={brand.provincia || "CÓRDOBA"}
          defaultLocalidad={brand.localidad || "RÍO CUARTO"}
          defaultCp={brand.cp || "5800"}
          paises={cats.paises || []}
          provincias={cats.provincias || []}
          localidadesPorProvincia={cats.localidadesPorProvincia || {}}
        />
      </main>
    </div>
  );
}
