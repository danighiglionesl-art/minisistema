import type { Metadata } from "next";
import { headers } from "next/headers";
import { CemepPublicPortal } from "@/components/cemep/CemepPublicPortal";
import { loadGestionWebDb } from "@/lib/erp/handlers/consultorios-handler";
import {
  ensureBaseMiniSistemaTenant,
  getTenantByHost,
} from "@/lib/erp/tenant-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CEMEP · Centro Médico Paulucci & CEMEP Plus | Alcira Gigena",
  description:
    "Salud y bienestar para toda la familia. Turnos online 24 hs, Portal de Pacientes con estudios y recetas digitales, Portal de Profesionales y cobertura CEMEP Plus en Alcira Gigena, Córdoba.",
  icons: {
    icon: [{ url: "/cemep/cemep-favicon.png?v=2", type: "image/png" }],
    shortcut: ["/cemep/cemep-favicon.png?v=2"],
    apple: [{ url: "/cemep/cemep-favicon.png?v=2", type: "image/png" }],
  },
};

export default async function CemepPublicPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
  const tenant =
    (await getTenantByHost(host)) || (await ensureBaseMiniSistemaTenant());

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
