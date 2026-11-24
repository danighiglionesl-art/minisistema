import type { Metadata } from "next";
import { headers } from "next/headers";
import { CemepPublicPortal } from "@/components/cemep/CemepPublicPortal";
import {
  buildDefaultCemepWebContent,
  DEFAULT_CEMEP_GOOGLE_CLIENT_ID,
} from "@/lib/erp/consultorios-types";
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

function withSoftTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export default async function CemepPublicPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await props.searchParams;
  const initialTab =
    String(sp?.tab || "").toLowerCase() === "plus" ||
    String(sp?.tab || "").toLowerCase() === "cemep_plus"
      ? "cemep_plus"
      : "cemep";

  let tenantSlug = "minisistema";
  let initialContent = buildDefaultCemepWebContent();
  let googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    DEFAULT_CEMEP_GOOGLE_CLIENT_ID;

  try {
    const hdrs = await headers();
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
    const tenant = await withSoftTimeout(
      (async () => (await getTenantByHost(host)) || (await ensureBaseMiniSistemaTenant()))(),
      4_000
    );
    tenantSlug = tenant.slug;
    const webDb = await withSoftTimeout(loadGestionWebDb(tenant), 4_500);
    if (webDb?.publishedContent) initialContent = webDb.publishedContent;
    if (webDb?.googleClientId) googleClientId = webDb.googleClientId;
  } catch (err) {
    console.warn(
      "[CEMEP Page] Fallback resiliente ante demora de Supabase:",
      err instanceof Error ? err.message : err
    );
  }

  return (
    <CemepPublicPortal
      tenantSlug={tenantSlug}
      initialContent={initialContent}
      googleClientId={googleClientId}
      initialTab={initialTab}
    />
  );
}
