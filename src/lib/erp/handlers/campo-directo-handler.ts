import { NextRequest, NextResponse } from "next/server";
import { buildInitialCampoDirectoDb } from "../campo-directo-seed";
import {
  CampoDirectoDbDoc,
  CampoDirectoCotizacionRecord,
  CampoDirectoProductoRecord,
  CampoDirectoEmpresaRecord,
  CampoDirectoProductorRecord,
  CampoDirectoCondicionPagoRecord,
  CampoDirectoConfigRecord,
} from "../campo-directo-types";
import { getTenantDoc, putTenantDoc } from "../supabase-server";
import { ErpTenantRecord } from "../types";

export const CAMPO_DIRECTO_DOC_KEY = "campo_directo_db";

export async function getCampoDirectoDb(tenant: ErpTenantRecord | null): Promise<CampoDirectoDbDoc> {
  const fallback = buildInitialCampoDirectoDb();
  if (!tenant) return fallback;

  try {
    const { payload } = await getTenantDoc<CampoDirectoDbDoc>(
      tenant,
      CAMPO_DIRECTO_DOC_KEY,
      fallback
    );
    if (!payload || !Array.isArray(payload.cotizaciones)) {
      return fallback;
    }
    return payload;
  } catch (err) {
    console.warn("[campo-directo-handler] Error cargando DB:", err);
    return fallback;
  }
}

export async function saveCampoDirectoDb(
  tenant: ErpTenantRecord | null,
  db: CampoDirectoDbDoc,
  actor = "admin"
): Promise<boolean> {
  if (!tenant) return false;
  try {
    db.updatedAt = new Date().toISOString();
    await putTenantDoc(tenant, CAMPO_DIRECTO_DOC_KEY, db, actor, "update");
    return true;
  } catch (err) {
    console.error("[campo-directo-handler] Error guardando DB:", err);
    return false;
  }
}

export async function handleCampoDirectoGet(req: NextRequest, tenant: ErpTenantRecord | null) {
  const db = await getCampoDirectoDb(tenant);
  return NextResponse.json({
    success: true,
    data: db,
    tenantSlug: tenant?.slug || "general",
  });
}

export async function handleCampoDirectoPost(req: NextRequest, tenant: ErpTenantRecord | null) {
  try {
    const body = await req.json();
    const action = body.action;
    const db = await getCampoDirectoDb(tenant);

    switch (action) {
      // 1. Guardar o actualizar cotización
      case "save_cotizacion": {
        const item: CampoDirectoCotizacionRecord = body.cotizacion;
        if (!item || !item.cuit) {
          return NextResponse.json({ success: false, error: "Datos de cotización inválidos." }, { status: 400 });
        }
        const existingIdx = db.cotizaciones.findIndex((c) => c.id === item.id);
        if (existingIdx >= 0) {
          db.cotizaciones[existingIdx] = { ...item, updatedAt: new Date().toISOString() };
        } else {
          db.cotizaciones.unshift({
            ...item,
            id: item.id || `cd-cot-${Date.now()}`,
            numero: item.numero || `COT-${new Date().getFullYear()}-${String(db.cotizaciones.length + 1).padStart(4, "0")}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        await saveCampoDirectoDb(tenant, db);
        return NextResponse.json({ success: true, cotizaciones: db.cotizaciones });
      }

      // 2. Cambiar estado de cotización
      case "update_cotizacion_status": {
        const { id, estado } = body;
        const target = db.cotizaciones.find((c) => c.id === id);
        if (!target) {
          return NextResponse.json({ success: false, error: "Cotización no encontrada." }, { status: 404 });
        }
        target.estado = estado;
        target.updatedAt = new Date().toISOString();
        await saveCampoDirectoDb(tenant, db);
        return NextResponse.json({ success: true, cotizacion: target });
      }

      // 3. Eliminar cotización
      case "delete_cotizacion": {
        const { id } = body;
        db.cotizaciones = db.cotizaciones.filter((c) => c.id !== id);
        await saveCampoDirectoDb(tenant, db);
        return NextResponse.json({ success: true, cotizaciones: db.cotizaciones });
      }

      // 4. Guardar o actualizar producto del catálogo
      case "save_producto": {
        const prod: CampoDirectoProductoRecord = body.producto;
        if (!prod || !prod.nombre) {
          return NextResponse.json({ success: false, error: "Nombre de producto obligatorio." }, { status: 400 });
        }
        const existingIdx = db.productos.findIndex((p) => p.id === prod.id);
        if (existingIdx >= 0) {
          db.productos[existingIdx] = prod;
        } else {
          db.productos.unshift({
            ...prod,
            id: prod.id || `prod-${Date.now()}`,
            activo: prod.activo ?? true,
          });
        }
        await saveCampoDirectoDb(tenant, db);
        return NextResponse.json({ success: true, productos: db.productos });
      }

      // 5. Eliminar producto
      case "delete_producto": {
        const { id } = body;
        db.productos = db.productos.filter((p) => p.id !== id);
        await saveCampoDirectoDb(tenant, db);
        return NextResponse.json({ success: true, productos: db.productos });
      }

      // 6. Guardar o actualizar empresa / fábrica
      case "save_empresa": {
        const emp: CampoDirectoEmpresaRecord = body.empresa;
        if (!emp || !emp.nombre) {
          return NextResponse.json({ success: false, error: "Nombre de fábrica obligatorio." }, { status: 400 });
        }
        const existingIdx = db.empresas.findIndex((e) => e.id === emp.id);
        if (existingIdx >= 0) {
          db.empresas[existingIdx] = emp;
        } else {
          db.empresas.push({
            ...emp,
            id: emp.id || `emp-${Date.now()}`,
            activo: emp.activo ?? true,
          });
        }
        await saveCampoDirectoDb(tenant, db);
        return NextResponse.json({ success: true, empresas: db.empresas });
      }

      // 7. Guardar o actualizar productor / cliente
      case "save_productor": {
        const prod: CampoDirectoProductorRecord = body.productor;
        if (!prod || !prod.cuit || !prod.razonSocial) {
          return NextResponse.json({ success: false, error: "CUIT y Razón Social obligatorios." }, { status: 400 });
        }
        const existingIdx = db.productores.findIndex((p) => p.id === prod.id || p.cuit === prod.cuit);
        if (existingIdx >= 0) {
          db.productores[existingIdx] = { ...prod, id: db.productores[existingIdx].id };
        } else {
          db.productores.unshift({
            ...prod,
            id: prod.id || `prod-cl-${Date.now()}`,
            createdAt: new Date().toISOString(),
          });
        }
        await saveCampoDirectoDb(tenant, db);
        return NextResponse.json({ success: true, productores: db.productores });
      }

      // 8. Eliminar productor
      case "delete_productor": {
        const { id } = body;
        db.productores = db.productores.filter((p) => p.id !== id);
        await saveCampoDirectoDb(tenant, db);
        return NextResponse.json({ success: true, productores: db.productores });
      }

      // 9. Guardar condición de pago
      case "save_condicion_pago": {
        const cond: CampoDirectoCondicionPagoRecord = body.condicion;
        if (!cond || !cond.titulo) {
          return NextResponse.json({ success: false, error: "Título de condición obligatorio." }, { status: 400 });
        }
        const existingIdx = db.condicionesPago.findIndex((c) => c.id === cond.id);
        if (existingIdx >= 0) {
          db.condicionesPago[existingIdx] = cond;
        } else {
          db.condicionesPago.push({
            ...cond,
            id: cond.id || `pago-${Date.now()}`,
            activo: cond.activo ?? true,
          });
        }
        await saveCampoDirectoDb(tenant, db);
        return NextResponse.json({ success: true, condicionesPago: db.condicionesPago });
      }

      // 10. Guardar configuración
      case "save_config": {
        const config: Partial<CampoDirectoConfigRecord> = body.config;
        db.config = { ...db.config, ...config };
        await saveCampoDirectoDb(tenant, db);
        return NextResponse.json({ success: true, config: db.config });
      }

      // 11. Restablecer con datos iniciales
      case "reset_db": {
        const fresh = buildInitialCampoDirectoDb();
        await saveCampoDirectoDb(tenant, fresh);
        return NextResponse.json({ success: true, data: fresh });
      }

      default:
        return NextResponse.json({ success: false, error: "Acción no reconocida." }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[campo-directo-handler] Error en POST:", error);
    return NextResponse.json({ success: false, error: error?.message || "Error interno." }, { status: 500 });
  }
}
