import { NextRequest, NextResponse } from "next/server";
import { handleErpAuth } from "@/lib/erp/handlers/auth-handler";
import { handleErpCatalog } from "@/lib/erp/handlers/catalog-handler";
import { handleErpClientes } from "@/lib/erp/handlers/clientes-handler";
import { handleErpConsultorios } from "@/lib/erp/handlers/consultorios-handler";
import { handleErpCurriculum } from "@/lib/erp/handlers/cv-handler";
import { handleErpInmobiliaria } from "@/lib/erp/handlers/inmobiliaria-handler";
import {
  handleErpArcaComprobantes,
  handleErpBanners,
  handleErpDbStatus,
  handleErpManualAi,
  handleErpMercadoPagoPoint,
  handleErpOfertas,
  handleErpPadronArca,
  handleErpPedidosProveedores,
  handleErpWhatsappCloud,
} from "@/lib/erp/handlers/misc-handlers";
import { handleErpMiContador } from "@/lib/erp/handlers/mi-contador-handler";
import { handleErpSuperAdmin } from "@/lib/erp/handlers/superadmin-handler";
import { handleErpTurnos } from "@/lib/erp/handlers/turnos-handler";
import { handleErpVentas } from "@/lib/erp/handlers/ventas-handler";
import {
  getTenantBySlug,
  resolveActiveTenantFromRequest,
} from "@/lib/erp/tenant-service";

export async function dispatchErpEndpoint(
  req: NextRequest,
  endpointRaw: string,
  forcedTenantSlug?: string
): Promise<NextResponse> {
  try {
    const tenant = forcedTenantSlug
      ? (await getTenantBySlug(forcedTenantSlug)) ||
        (await resolveActiveTenantFromRequest(req))
      : await resolveActiveTenantFromRequest(req);

    const endpoint = endpointRaw.trim().toLowerCase().replace(/\.php$/i, "");

    let res: NextResponse;
    switch (endpoint) {
      case "auth":
        res = await handleErpAuth(req, tenant);
        break;
      case "catalog":
        res = await handleErpCatalog(req, tenant);
        break;
      case "clientes":
        res = await handleErpClientes(req, tenant);
        break;
      case "ventas":
        res = await handleErpVentas(req, tenant);
        break;
      case "db_status":
        res = await handleErpDbStatus(req, tenant);
        break;
      case "ofertas":
        res = await handleErpOfertas(req, tenant);
        break;
      case "pedidos_proveedores":
        res = await handleErpPedidosProveedores(req, tenant);
        break;
      case "banners":
        res = await handleErpBanners(req, tenant);
        break;
      case "arca_comprobantes":
        res = await handleErpArcaComprobantes(req, tenant);
        break;
      case "padron_arca":
        res = await handleErpPadronArca(req, tenant);
        break;
      case "mercadopago_point":
        res = await handleErpMercadoPagoPoint(req, tenant);
        break;
      case "whatsapp_cloud":
        res = await handleErpWhatsappCloud(req, tenant);
        break;
      case "manual_ai":
        res = await handleErpManualAi(req, tenant);
        break;
      case "superadmin":
        res = await handleErpSuperAdmin(req, tenant);
        break;
      case "curriculum":
      case "cv":
        res = await handleErpCurriculum(req, tenant);
        break;
      case "turnos":
        res = await handleErpTurnos(req, tenant);
        break;
      case "consultorios":
      case "historia_clinica":
      case "gestion_web":
        res = await handleErpConsultorios(req, tenant);
        break;
      case "inmobiliaria":
        res = await handleErpInmobiliaria(req, tenant);
        break;
      case "mi_contador":
      case "micontador":
        res = await handleErpMiContador(req, tenant);
        break;
      default:
        res = NextResponse.json(
          { ok: false, message: `Endpoint ERP no encontrado: ${endpointRaw}` },
          { status: 404 }
        );
    }

    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    return res;
  } catch (err) {
    console.error("[ERP API Error]", endpointRaw, err);
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error ? err.message : "Error interno del servidor ERP",
      },
      { status: 500 }
    );
  }
}
