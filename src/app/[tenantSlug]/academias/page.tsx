import { notFound } from "next/navigation";
import PublicAcademiasPortal from "@/components/academias/PublicAcademiasPortal";
import { getTenantBySlug, isReservedAppSlug } from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export default async function TenantPublicAcademiasPage(context: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ cert?: string }>;
}) {
  const { tenantSlug } = await context.params;
  const sp = await context.searchParams;
  const clean = tenantSlug.trim().toLowerCase();
  if (isReservedAppSlug(clean)) notFound();

  const tenant = await getTenantBySlug(clean);
  if (!tenant) notFound();

  const hasAcademias =
    tenant.is_base ||
    !Array.isArray(tenant.enabled_modules) ||
    tenant.enabled_modules.some(
      (k) => k === "academias" || String(k).startsWith("academias:")
    );

  if (!hasAcademias) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#112D3A] p-8 text-center text-white">
        <div>
          <h1 className="text-2xl font-extrabold text-[#56D7A1]">
            Portal de Academias no habilitado
          </h1>
          <p className="mt-2 text-sm text-white/80">
            Esta institución no tiene activo el módulo de Gestión de Academias.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PublicAcademiasPortal
      apiEndpoint={`/${encodeURIComponent(tenant.slug)}/api/academias`}
      initialCertCode={sp?.cert || ""}
    />
  );
}
