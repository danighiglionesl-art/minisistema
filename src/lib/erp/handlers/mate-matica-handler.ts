import { NextRequest, NextResponse } from "next/server";
import { extractErpSessionFromRequest } from "../erp-session";
import {
  type ErpTenantRecord,
  GENERAL_ADMIN_USERNAME,
  normalizeErpRole,
} from "../types";

const MATEMATICA_API_URL =
  process.env.MATEMATICA_API_URL || "https://www.mate-matica.com.ar/api/sync";
const MATEMATICA_ADMIN_USER =
  process.env.MATEMATICA_ADMIN_USER || "mate-matica";
const MATEMATICA_ADMIN_PASS =
  process.env.MATEMATICA_ADMIN_PASS || "Nehuen2026";

function isGeneralAdmin(
  session: { username: string; role: string } | null
): boolean {
  if (!session) return false;
  const user = String(session.username || "").trim().toLowerCase();
  if (user === GENERAL_ADMIN_USERNAME) return true;
  return normalizeErpRole(session.role, user) === "Administrador General";
}

export async function handleErpMateMatica(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const session =
    extractErpSessionFromRequest(req, tenant.slug) ||
    extractErpSessionFromRequest(req, "minisistema");
  if (!isGeneralAdmin(session)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Acceso exclusivo del Administrador General de MiniSistema para gestionar Mate-Mática.",
      },
      { status: 403 }
    );
  }

  if (req.method === "GET") {
    try {
      const upstream = await fetch(
        `${MATEMATICA_API_URL}?action=load&t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        }
      );
      const data = await upstream.json();
      return NextResponse.json({
        ok: Boolean(data?.ok),
        catalog: data?.catalog || null,
        orders: Array.isArray(data?.orders) ? data.orders : [],
        source: "https://www.mate-matica.com.ar",
      });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          message:
            err instanceof Error
              ? `Error conectando con Mate-Mática: ${err.message}`
              : "No se pudo sincronizar con Mate-Mática.",
        },
        { status: 502 }
      );
    }
  }

  if (req.method === "POST") {
    try {
      const body = (await req.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const action = String(body.action || "save_all");

      if (action === "save_order") {
        const upstream = await fetch(
          `${MATEMATICA_API_URL}?action=save_order`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order: body.order,
              catalog: body.catalog,
            }),
          }
        );
        const data = await upstream.json();
        return NextResponse.json(data, { status: upstream.status });
      }

      // Acción por defecto: save_all (catálogo, precios, stock, condiciones, pedidos, eliminaciones)
      const upstream = await fetch(`${MATEMATICA_API_URL}?action=save_all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authUser: MATEMATICA_ADMIN_USER,
          authPass: MATEMATICA_ADMIN_PASS,
          catalog: body.catalog,
          orders: body.orders,
          deletedOrderId: body.deletedOrderId,
          restoredStockMap: body.restoredStockMap,
          stockRestoredByClient: body.stockRestoredByClient,
          forceReplaceOrders: body.forceReplaceOrders,
        }),
      });
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          message:
            err instanceof Error
              ? `Error guardando en Mate-Mática: ${err.message}`
              : "No se pudo guardar en Mate-Mática.",
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(
    { ok: false, message: "Método no permitido." },
    { status: 405 }
  );
}
