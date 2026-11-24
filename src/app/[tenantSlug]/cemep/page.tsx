import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CemepPublicPortal } from "@/components/cemep/CemepPublicPortal";
import {
  buildDefaultCemepWebContent,
  DEFAULT_CEMEP_GOOGLE_CLIENT_ID,
} from "@/lib/erp/consultorios-types";
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

export default async function TenantCemepPage(props: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tenantSlug } = await props.params;
  const clean = tenantSlug.trim().toLowerCase();
  if (isReservedAppSlug(clean)) notFound();

  const sp = await props.searchParams;
  const initialTab =
    String(sp?.tab || "").toLowerCase() === "plus" ||
    String(sp?.tab || "").toLowerCase() === "cemep_plus"
      ? "cemep_plus"
      : "cemep";

  let resolvedSlug = clean;
  let initialContent = buildDefaultCemepWebContent();
  let googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    DEFAULT_CEMEP_GOOGLE_CLIENT_ID;

  try {
    const tenant = await withSoftTimeout(getTenantBySlug(clean), 4_000);
    if (!tenant) notFound();
    resolvedSlug = tenant.slug;
    const webDb = await withSoftTimeout(loadGestionWebDb(tenant), 4_500);
    if (webDb?.publishedContent) initialContent = webDb.publishedContent;
    if (webDb?.googleClientId) googleClientId = webDb.googleClientId;
  } catch (err) {
    if ((err as { digest?: string })?.digest === "NEXT_NOT_FOUND") {
      throw err;
    }
    console.warn(
      "[Tenant CEMEP Page] Fallback resiliente ante demora de Supabase:",
      err instanceof Error ? err.message : err
    );
  }

  return (
    <CemepPublicPortal
      tenantSlug={resolvedSlug}
      initialContent={initialContent}
      googleClientId={googleClientId}
      initialTab={initialTab}
    />
  );
}
