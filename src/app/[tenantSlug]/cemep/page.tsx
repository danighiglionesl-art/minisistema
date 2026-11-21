import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CemepPublicPortal } from "@/components/cemep/CemepPublicPortal";
import { loadGestionWebDb } from "@/lib/erp/handlers/consultorios-handler";
import { getTenantBySlug, isReservedAppSlug } from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CEMEP · Centro Médico Paulucci & CEMEP Plus",
  description:
    "Portal institucional, Turnero Web, Historia Clínica, Portal de Pacientes y CEMEP Plus.",
  icons: {
    icon: [{ url: "/cemep/cemep-favicon.png?v=2", type: "image/png" }],
    shortcut: ["/cemep/cemep-favicon.png?v=2"],
    apple: [{ url: "/cemep/cemep-favicon.png?v=2", type: "image/png" }],
  },
};

export default async function TenantCemepPage(props: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tenantSlug } = await props.params;
  const clean = tenantSlug.trim().toLowerCase();
  if (isReservedAppSlug(clean)) notFound();

  const tenant = await getTenantBySlug(clean);
  if (!tenant) notFound();

  const sp = await props.searchParams;
  const initialTab =
    String(sp?.tab || "").toLowerCase() === "plus" ||
    String(sp?.tab || "").toLowerCase() === "cemep_plus"
      ? "cemep_plus"
      : "cemep";

  const webDb = await loadGestionWebDb(tenant);

  return (
    <CemepPublicPortal
      tenantSlug={tenant.slug}
      initialContent={webDb.publishedContent}
      googleClientId={webDb.googleClientId || ""}
      initialTab={initialTab}
    />
  );
}
