export type GlobalUserStatus = "active" | "suspended_nonpayment" | "disabled";

export type DefinedUserType =
  | "Admin. Gral."
  | "Administrador"
  | "Usuario"
  | "Usuario Fábrica"
  | "Profesional / Especialista"
  | "Socio / Cliente";

export interface GlobalManagedUserRecord {
  id: string;
  source: "erp_tenant" | "project_vault";
  tenantSlug: string | null;
  project: string;
  projectUrl: string;
  name: string;
  username: string;
  email: string;
  password: string;
  altPasswordNote?: string;
  userType: DefinedUserType;
  status: GlobalUserStatus;
  suspendedReason: string;
  whatsapp?: string;
  notes?: string;
  deleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFINED_USER_TYPES: Array<{
  key: DefinedUserType;
  label: string;
  description: string;
}> = [
  {
    key: "Admin. Gral.",
    label: "Admin. Gral.",
    description: "Superadministrador general multi-sistema con jerarquía máxima",
  },
  {
    key: "Administrador",
    label: "Administrador",
    description: "Administrador titular de comercio, tienda o panel backoffice",
  },
  {
    key: "Usuario",
    label: "Usuario",
    description: "Operador, cajero, vendedor o colaborador interno del sistema",
  },
  {
    key: "Usuario Fábrica",
    label: "Usuario Fábrica",
    description: "Proveedor / fábrica mayorista con panel de cotizaciones y stock",
  },
  {
    key: "Profesional / Especialista",
    label: "Profesional / Especialista",
    description: "Médico, especialista de consultorio o terapeuta habilitado",
  },
  {
    key: "Socio / Cliente",
    label: "Socio / Cliente",
    description: "Socio, paciente o cliente final registrado en portal público",
  },
];

const SEED_ISO = "2026-11-20T14:00:00.000Z";

function makeVaultUser(input: {
  id: string;
  project: string;
  projectUrl: string;
  name: string;
  username: string;
  email?: string;
  password: string;
  altPasswordNote?: string;
  userType: DefinedUserType;
  whatsapp?: string;
  notes?: string;
  tenantSlug?: string | null;
  source?: "erp_tenant" | "project_vault";
}): GlobalManagedUserRecord {
  return {
    id: input.id,
    source: input.source || "project_vault",
    tenantSlug: input.tenantSlug ?? null,
    project: input.project,
    projectUrl: input.projectUrl,
    name: input.name,
    username: input.username,
    email: input.email || "",
    password: input.password,
    altPasswordNote: input.altPasswordNote || "",
    userType: input.userType,
    status: "active",
    suspendedReason: "",
    whatsapp: input.whatsapp || "",
    notes: input.notes || "",
    deleted: false,
    createdAt: SEED_ISO,
    updatedAt: SEED_ISO,
  };
}

const CAMPO_DIRECTO_FACTORIES: Array<[string, string, string, string]> = [
  ["ADAMA", "fab.adama", "adama.2026", "Insumos"],
  ["AGM", "fab.agm", "agm.2026", "Insumos"],
  ["AGREFERT", "fab.agrefert", "agrefert.2026", "Insumos"],
  ["AGROSUMA", "fab.agrosuma", "agrosuma.2026", "Insumos"],
  ["ALZ-AGRO", "fab.alzagro", "alzagro.2026", "Insumos"],
  ["AMAUTA", "fab.amauta", "amauta.2026", "Insumos"],
  ["BUNGE", "fab.bunge", "bunge.2026", "Insumos"],
  ["CERES DEMETER", "fab.ceresdemeter", "ceresdemeter.2026", "Insumos"],
  ["CHEMOTÉCNICA", "fab.chemotecnica", "chemotecnica.2026", "Insumos"],
  ["DAASONS", "fab.daasons", "daasons.2026", "Insumos"],
  ["EUROCHEM", "fab.eurochem", "eurochem.2026", "Insumos"],
  ["FACYT", "fab.facyt", "facyt.2026", "Insumos"],
  ["FARMCHEM", "fab.farmchem", "farmchem.2026", "Insumos"],
  ["FUGRAN", "fab.fugran", "fugran.2026", "Insumos"],
  ["GLEBA", "fab.gleba", "gleba.2026", "Insumos"],
  ["GRANER", "fab.graner", "graner.2026", "Insumos"],
  ["INSUAGRO", "fab.insuagro", "insuagro.2026", "Insumos"],
  ["IPESASILO", "fab.ipesasilo", "ipesasilo.2026", "Insumos"],
  ["KOPPERT", "fab.koppert", "koppert.2026", "Insumos"],
  ["LANTHER", "fab.lanther", "lanther.2026", "Insumos"],
  ["NUTRITERRA", "fab.nutriterra", "nutriterra.2026", "Insumos"],
  ["OLEOSOL", "fab.oleosol", "oleosol.2026", "Insumos"],
  ["PROFERTIL", "fab.profertil", "profertil.2026", "Insumos"],
  ["PROTEGRAN", "fab.protegran", "protegran.2026", "Insumos"],
  ["RIZOBACTER", "fab.rizobacter", "rizobacter.2026", "Insumos"],
  ["SIPCAM", "fab.sipcam", "sipcam.2026", "Insumos"],
  ["SPEEDAGRO", "fab.speedagro", "speedagro.2026", "Insumos"],
  ["SPRAYTEC", "fab.spraytec", "spraytec.2026", "Insumos"],
  ["STOLLER", "fab.stoller", "stoller.2026", "Insumos"],
  ["SUMITOMO CHEMICAL", "fab.sumitomo", "sumitomo.2026", "Insumos"],
  ["SUMMIT AGRO", "fab.summitagro", "summitagro.2026", "Insumos"],
  ["SURCOS", "fab.surcos", "surcos.2026", "Insumos"],
  ["SYNGENTA ARGENTINA", "fab.syngenta", "syngenta.2026", "Insumos"],
  ["TIMAC AGRO", "fab.timacagro", "timacagro.2026", "Insumos"],
  ["YARA", "fab.yara", "yara.2026", "Insumos"],
  ["ALZ-SEMILLAS S.A.", "fab.alzsemillas", "alzsemillas.2026", "Semillas"],
  ["ALZ-SEMILLAS / NORD", "fab.nord", "nord.2026", "Semillas"],
  ["BIOCERES", "fab.bioceres", "bioceres.2026", "Semillas"],
  ["DON MARIO", "fab.donmario", "donmario.2026", "Semillas"],
  ["NIDERA SEMILLAS", "fab.nidera", "nidera.2026", "Semillas"],
  ["NK SEMILLAS", "fab.nksemillas", "nksemillas.2026", "Semillas"],
  ["NUSEED", "fab.nuseed", "nuseed.2026", "Semillas"],
  ["PEMAN", "fab.peman", "peman.2026", "Semillas"],
  ["PIONEER", "fab.pioneer", "pioneer.2026", "Semillas"],
];

export const INITIAL_ANTIGRAVITY_USERS: GlobalManagedUserRecord[] = [
  // 1. MiniSistema Web Comercial (/admin)
  makeVaultUser({
    id: "vault_minisistema_web_admin",
    project: "MiniSistema Web (/admin)",
    projectUrl: "https://www.minisistema.com.ar/admin",
    name: "Administrador MiniSistema Web",
    username: "admin@minisistema.com.ar",
    email: "admin@minisistema.com.ar",
    password: "MiniSistema2026!",
    userType: "Administrador",
    whatsapp: "+5493585095475",
    notes: "Panel privado de consultas comerciales, portafolio y configuración de www.minisistema.com.ar",
  }),

  // 2. Casa Nueva ERP (7 usuarios oficiales)
  makeVaultUser({
    id: "vault_casanueva_danielg",
    project: "Casa Nueva ERP",
    projectUrl: "https://www.cn.com.ar/sistema",
    name: "Daniel G. (Ghiglione Daniel Alejandro)",
    username: "danielg",
    password: "Dani1926",
    userType: "Administrador",
    notes: "Administrador Principal Casa Nueva Supermercado (todos los módulos)",
  }),
  makeVaultUser({
    id: "vault_casanueva_federicod",
    project: "Casa Nueva ERP",
    projectUrl: "https://www.cn.com.ar/sistema",
    name: "Federico D.",
    username: "federicod",
    password: "Fede0611",
    userType: "Usuario",
    notes: "Casa Central · Operador ERP / Cajas",
  }),
  makeVaultUser({
    id: "vault_casanueva_josem",
    project: "Casa Nueva ERP",
    projectUrl: "https://www.cn.com.ar/sistema",
    name: "José M.",
    username: "josem",
    password: "Jose1143",
    userType: "Usuario",
    notes: "Casa Central · Operador ERP / Cajas",
  }),
  makeVaultUser({
    id: "vault_casanueva_roxanad",
    project: "Casa Nueva ERP",
    projectUrl: "https://www.cn.com.ar/sistema",
    name: "Roxana D.",
    username: "roxanad",
    password: "Toti1120",
    userType: "Usuario",
    notes: "Casa Central · Operadora ERP / Cajas",
  }),
  makeVaultUser({
    id: "vault_casanueva_samuelr",
    project: "Casa Nueva ERP",
    projectUrl: "https://www.cn.com.ar/sistema",
    name: "Samuel R.",
    username: "samuelr",
    password: "Samuca1144",
    userType: "Usuario",
    notes: "Casa Central · Operador ERP / Cajas",
  }),
  makeVaultUser({
    id: "vault_casanueva_antoniog",
    project: "Casa Nueva ERP",
    projectUrl: "https://www.cn.com.ar/sistema",
    name: "Antonio G.",
    username: "antoniog",
    password: "Ing5050",
    userType: "Usuario",
    notes: "Casa Central · Operador ERP / Cajas",
  }),
  makeVaultUser({
    id: "vault_casanueva_arielm",
    project: "Casa Nueva ERP",
    projectUrl: "https://www.cn.com.ar/sistema",
    name: "Ariel M.",
    username: "arielm",
    password: "Ariel1145",
    userType: "Usuario",
    notes: "Casa Central · Operador ERP / Cajas",
  }),

  // 3. Paseo Alberdi ERP
  makeVaultUser({
    id: "vault_paseoalberdi_danicenteno",
    project: "Paseo Alberdi ERP",
    projectUrl: "https://www.paseoalberdi.ar/sistema",
    name: "Dani Centeno",
    username: "danicenteno",
    password: "Paseo2026",
    userType: "Administrador",
    whatsapp: "+54 9 3584 29-2027",
    notes: "Único Administrador titular habilitado en PaseoAlberdi.ar",
  }),

  // 4. Mate-Mática
  makeVaultUser({
    id: "vault_matematica_admin",
    project: "Mate-Mática",
    projectUrl: "https://www.mate-matica.com.ar/administrador",
    name: "Administración Mate-Mática",
    username: "mate-matica",
    password: "Nehuen2026",
    userType: "Administrador",
    whatsapp: "+54 9 3584 86-6586",
    notes: "Panel de administración unificado (canales Minorista /clientes y Mayorista /comercio, presupuestos PDF)",
  }),

  // 5. NOVA Distribuidora
  makeVaultUser({
    id: "vault_nova_matinova",
    project: "NOVA Distribuidora",
    projectUrl: "https://www.cn.com.ar/nova/administrador",
    name: "Matías (NOVA Distribuidora)",
    username: "MatiNova",
    password: "Nova2026",
    userType: "Administrador",
    whatsapp: "+54 9 3585 76-5983",
    notes: "Panel de catálogo, pedidos, descuentos y geolocalización GPS de empleados",
  }),

  // 6. ImportadosYa!
  makeVaultUser({
    id: "vault_importadosya_ramiro",
    project: "ImportadosYa!",
    projectUrl: "https://www.cn.com.ar/importadosya/administrador",
    name: "Ramiro (ImportadosYa!)",
    username: "RamiroImpor",
    password: "Ramiro2026",
    userType: "Administrador",
    whatsapp: "+54 9 3584 86-0072",
    notes: "Panel administrador de carrito bimonetario USD / ARS y cotización diaria del dólar",
  }),

  // 7. El Buen Sabor
  makeVaultUser({
    id: "vault_elbuensabor_marcos",
    project: "El Buen Sabor",
    projectUrl: "https://www.cn.com.ar/elbuensabor/administrador",
    name: "Marcos (El Buen Sabor)",
    username: "MarcosPizzas",
    password: "Marcos2026",
    userType: "Administrador",
    notes: "Panel administrador de catálogo y pedidos gastronómicos",
  }),

  // 8. Reiki Online (5 cuentas administrativas / operativas)
  makeVaultUser({
    id: "vault_reiki_reikionline",
    project: "Reiki Online",
    projectUrl: "https://www.reikionline.com.ar",
    name: "Daniel Alejandro Ghiglione",
    username: "reikionline",
    email: "admin@reikionline.com.ar",
    password: "Reiki2026",
    userType: "Administrador",
    notes: "Cuenta Principal Administrador de Terapias Online y Comisiones Split MP",
  }),
  makeVaultUser({
    id: "vault_reiki_danielg",
    project: "Reiki Online",
    projectUrl: "https://www.reikionline.com.ar",
    name: "Daniel Alejandro Ghiglione",
    username: "danielg",
    email: "danielg@reikionline.com.ar",
    password: "Dani1926",
    userType: "Administrador",
    notes: "Acceso directo personal @danielg en Reiki Online",
  }),
  makeVaultUser({
    id: "vault_reiki_federicod",
    project: "Reiki Online",
    projectUrl: "https://www.reikionline.com.ar",
    name: "Federico D.",
    username: "federicod",
    email: "federicod@reikionline.com.ar",
    password: "Fede2026",
    userType: "Administrador",
    notes: "Equipo Reiki Online",
  }),
  makeVaultUser({
    id: "vault_reiki_josem",
    project: "Reiki Online",
    projectUrl: "https://www.reikionline.com.ar",
    name: "José M.",
    username: "josem",
    email: "josem@reikionline.com.ar",
    password: "Jose2026",
    userType: "Administrador",
    notes: "Equipo Reiki Online",
  }),
  makeVaultUser({
    id: "vault_reiki_miltonv",
    project: "Reiki Online",
    projectUrl: "https://www.reikionline.com.ar",
    name: "Milton V.",
    username: "miltonv",
    email: "miltonv@reikionline.com.ar",
    password: "Milton2026",
    userType: "Administrador",
    notes: "Equipo Reiki Online",
  }),

  // 9. Biblioteca Roncedo
  makeVaultUser({
    id: "vault_roncedo_admin",
    project: "Biblioteca Roncedo",
    projectUrl: "https://www.bibliotecaroncedo.ar/login",
    name: "Biblioteca Dr. Lautaro Roncedo",
    username: "biblioroncedo",
    email: "biblioroncedo@bibliotecaroncedo.ar",
    password: "Biblioteca2026Roncedo",
    altPasswordNote: "También admite usuario 'biblioteca-roncedo' / 'admin@bibliotecaroncedo.ar' y clave 'Roncedo-2026'",
    userType: "Administrador",
    whatsapp: "+54 9 3585 62-1547",
    notes: "ABM de 1.283 libros físicos, Biblioteca Digital, 102 Folios de Actas y Socios Protectores",
  }),

  // 10. Club Fidel
  makeVaultUser({
    id: "vault_clubfidel_superadmin",
    project: "Club Fidel",
    projectUrl: "https://www.clubfidel.com.ar/admin",
    name: "Daniel Ghiglione (SUPERADMIN)",
    username: "danighiglionesl@gmail.com",
    email: "danighiglionesl@gmail.com",
    password: "Google OAuth / Clave Better Auth",
    userType: "Admin. Gral.",
    notes: "Correo preautorizado en platform_admin_role como SUPERADMIN central de Club Fidel",
  }),

  // 11. Campo Directo (Master Admin + 44 Usuarios Fábrica)
  makeVaultUser({
    id: "vault_campodirecto_master",
    project: "Campo Directo",
    projectUrl: "https://www.campodirecto.ar/panel",
    name: "Operador Master Campo Directo",
    username: "CampoDirecto",
    password: "Claro$008",
    userType: "Administrador",
    notes: "Master Admin del Backoffice (/panel): Productores, Cotizaciones, Ventas, Cta. Cte. y Fábricas",
  }),

  ...CAMPO_DIRECTO_FACTORIES.map(([empresa, usuario, clave, rubro]) =>
    makeVaultUser({
      id: `vault_cd_${usuario.replace(/[^a-z0-9]/gi, "_")}`,
      project: "Campo Directo (Fábricas)",
      projectUrl: "https://www.campodirecto.ar/panel",
      name: `${empresa} (${rubro})`,
      username: usuario,
      password: clave,
      userType: "Usuario Fábrica",
      notes: `Portal Mayorista Fábrica · Rubro ${rubro}`,
    })
  ),
];
