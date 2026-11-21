import type { Metadata } from "next";
import { headers } from "next/headers";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import PublicCvForm from "@/components/cv/PublicCvForm";
import { getTenantCvFormConfig } from "@/lib/erp/handlers/cv-handler";
import referenceCatalogs from "@/lib/erp/reference-catalogs.json";
import {
  enforceOptionBranding,
  ensureBaseMiniSistemaTenant,
  getTenantByHost,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enviar Curriculum Vitae | MiniSistema",
  description:
    "Completá tu Curriculum Vitae en línea, adjuntá tu foto y archivo PDF para postularte en nuestro equipo.",
};

export default async function PublicCvPage() {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
  const tenant =
    (await getTenantByHost(host)) || (await ensureBaseMiniSistemaTenant());

  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );
  const formConfig = await getTenantCvFormConfig(tenant);

  const cats = referenceCatalogs.catalogs as {
    paises?: Array<{ id: number; nombre: string; abreviatura?: string }>;
    provincias?: string[];
    localidadesPorProvincia?: Record<
      string,
      Array<{ nombre: string; cp?: string }>
    >;
  };

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
              Selección de Personal · RR.HH.
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
            Portal Oficial de Postulaciones
          </span>
          <h1
            className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-3xl font-black leading-tight text-[#FFFFFF] sm:text-4xl lg:text-[2.65rem]"
            style={{ color: "#FFFFFF" }}
          >
            <span>Cargá tu Curriculum Vitae en</span>
            {isMiniSistemaBrand ? (
              <BrandWordmark className="h-[0.95em]" />
            ) : (
              <img
                src={brand.logoHorizontalUrl}
                alt={tenant.fantasy_name}
                className="inline-block h-[1.05em] w-auto rounded-lg bg-[#FFFFFF] px-2.5 py-1 object-contain align-middle"
              />
            )}
          </h1>
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
          formConfig={formConfig}
        />
      </main>
    </div>
  );
}
