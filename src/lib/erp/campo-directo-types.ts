export interface CampoDirectoItemCotizacion {
  productoId: string;
  nombre: string;
  categoria: "HERBICIDAS" | "FUNGICIDAS" | "INSECTICIDAS" | "COADYUVANTES" | "SEMILLAS" | "FERTILIZANTES";
  dosis: string;
  cantidad: number;
  unidad: string;
  precioUnitarioUsd: number;
  subtotalUsd: number;
}

export type CampoDirectoEstadoCotizacion =
  | "PENDIENTE"
  | "EN_COTIZACION"
  | "APROBADA"
  | "RECHAZADA"
  | "FACTURADA";

export interface CampoDirectoCotizacionRecord {
  id: string;
  numero: string;
  fecha: string;
  tipo: "RECIBIDA" | "ENVIADA";
  cuit: string;
  razonSocial: string;
  productorNombre: string;
  productorEmail: string;
  productorWhatsapp: string;
  establecimientoNombre: string;
  establecimientoLocalidad: string;
  items: CampoDirectoItemCotizacion[];
  totalUsd: number;
  formaPago: string;
  plazoDias: number;
  estado: CampoDirectoEstadoCotizacion;
  observaciones?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampoDirectoProductoRecord {
  id: string;
  nombre: string;
  categoria: "HERBICIDAS" | "FUNGICIDAS" | "INSECTICIDAS" | "COADYUVANTES" | "SEMILLAS" | "FERTILIZANTES";
  principioActivo: string;
  formulacion: string;
  empresaId: string;
  empresaNombre: string;
  presentacion: string;
  precioDolar: number;
  activo: boolean;
  dosisRecomendada?: string;
  cultivosDestino?: string;
}

export interface CampoDirectoEmpresaRecord {
  id: string;
  nombre: string;
  cuit: string;
  contacto: string;
  telefono: string;
  email: string;
  activo: boolean;
  productosCount?: number;
  logoUrl?: string;
}

export interface CampoDirectoEstablecimientoRecord {
  id: string;
  nombre: string;
  provincia: string;
  localidad: string;
  hectareas: number;
  cultivoPrincipal: string;
  coordenadas?: string;
}

export interface CampoDirectoProductorRecord {
  id: string;
  cuit: string;
  razonSocial: string;
  apellidos: string;
  nombres: string;
  dni: string;
  email: string;
  whatsapp: string;
  provincia: string;
  localidad: string;
  codigoPostal: string;
  validadoAfip: boolean;
  observaciones?: string;
  establecimientos: CampoDirectoEstablecimientoRecord[];
  createdAt: string;
}

export interface CampoDirectoCondicionPagoRecord {
  id: string;
  tipo: "CANJE_CEREAL" | "PLAZO_DIAS" | "TARJETA_AGRO" | "TRANSFERENCIA" | "ECHEQ";
  titulo: string;
  descripcion: string;
  recargoDescPct: number;
  activo: boolean;
}

export interface CampoDirectoConfigRecord {
  appUrl: string;
  telefonoSoporte: string;
  emailSoporte: string;
  diasValidezCotizacion: number;
  autoValidarCuitAfip: boolean;
  notificarWhatsapp: boolean;
  notificarEmail: boolean;
  monedaPredeterminada: "USD" | "ARS";
}

export interface CampoDirectoDbDoc {
  cotizaciones: CampoDirectoCotizacionRecord[];
  productos: CampoDirectoProductoRecord[];
  empresas: CampoDirectoEmpresaRecord[];
  productores: CampoDirectoProductorRecord[];
  condicionesPago: CampoDirectoCondicionPagoRecord[];
  config: CampoDirectoConfigRecord;
  updatedAt: string;
}
