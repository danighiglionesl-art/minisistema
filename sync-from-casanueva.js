const fs = require("fs");
const path = require("path");

const cnRoot = "C:/Users/Usuario/Desktop/Documents/Casa Nueva ERP";
const msRoot = "C:/Users/Usuario/Desktop/Documents/MiniSistema";

// 1. Copy core HTML templates and JS/CSS assets from Casa Nueva ERP -> MiniSistema
const copyPairs = [
  ["sistema/index.html", "src/lib/erp/templates/sistema.html"],
  ["carrito/index.html", "src/lib/erp/templates/carrito.html"],
  ["verificador/index.html", "src/lib/erp/templates/verificador.html"],
  ["sistema/assets/js/app.js", "public/sistema/assets/js/app.js"],
  ["sistema/assets/css/styles.css", "public/sistema/assets/css/styles.css"],
  ["sistema/assets/js/zxing.min.js", "public/sistema/assets/js/zxing.min.js"],
  ["carrito/assets/js/carrito.js", "public/carrito/assets/js/carrito.js"],
  ["carrito/assets/css/carrito.css", "public/carrito/assets/css/carrito.css"],
  ["carrito/sw.js", "public/carrito/sw.js"],
  ["carrito/version.json", "public/carrito/version.json"],
];

for (const [relSrc, relDst] of copyPairs) {
  const src = path.join(cnRoot, relSrc);
  const dst = path.join(msRoot, relDst);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    console.log(`[SYNC] Copied ${relSrc} -> ${relDst}`);
  }
}

// 2. Detect current version number stamped in sistema/index.html
const sisHtml = fs.readFileSync(
  path.join(msRoot, "src/lib/erp/templates/sistema.html"),
  "utf8"
);
const verMatch = sisHtml.match(/assets\/js\/app\.js\?v=(\d+)/);
const currentVer = verMatch ? Number(verMatch[1]) : 268;

// 3. Write clean MiniSistema Service Worker (public/sistema/sw.js) with matching version
const swContent = `const CACHE_NAME = 'minisistema-erp-v${currentVer}';
const ASSETS_TO_CACHE = [
  '/sistema/assets/js/brand.js?v=${currentVer}',
  '/sistema/assets/css/styles.css?v=${currentVer}',
  '/sistema/assets/css/brand-minisistema.css?v=${currentVer}',
  '/sistema/assets/js/zxing.min.js?v=${currentVer}',
  '/sistema/assets/js/app.js?v=${currentVer}',
  '/sistema/assets/js/superadmin-panel.js?v=${currentVer}',
  '/sistema/assets/js/cv-module.js?v=${currentVer}',
  '/sistema/assets/js/personal-module.js?v=${currentVer}',
  '/sistema/assets/js/turnos-module.js?v=${currentVer}',
  '/sistema/assets/js/mi-contador-module.js?v=${currentVer}',
  '/sistema/assets/img/minisistema/logo-1x1.png',
  '/sistema/assets/img/minisistema/logo-horizontal.png',
  '/sistema/assets/img/minisistema/logo-symbol.png',
  '/sistema/assets/img/minisistema/icon-512.png',
  '/sistema/assets/img/minisistema/icon-192.png',
  '/sistema/assets/img/minisistema/apple-touch-icon.png',
  '/sistema/assets/img/minisistema/favicon-64.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;
  if (request.url.includes('/api/')) return;

  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});
`;
fs.writeFileSync(path.join(msRoot, "public/sistema/sw.js"), swContent, "utf8");
console.log(`[SYNC] Updated public/sistema/sw.js to v${currentVer}`);

// 4. Preserve MiniSistema-exclusive modules (e.g. Curriculum Vitae) in app.js, then sync ALL_ERP_MODULE_KEYS into src/lib/erp/types.ts
const appJsPath = path.join(msRoot, "public/sistema/assets/js/app.js");
let appJs = fs.readFileSync(appJsPath, "utf8");
if (!appJs.includes("key: 'cv'")) {
  const cvBlock = `  { key: 'verificador', label: 'Consulta de Precios', sections: ['sec-verificador-precios'], submodules: [] },
  {
    key: 'cv',
    label: 'Administración de Personal',
    sections: ['sec-menu-personal', 'sec-menu-cv', 'sec-cv-workspace', 'sec-asistencias-workspace'],
    submodules: [
      { key: 'cv:recibidos', label: 'Curriculum Vitae · CV recibidos', selector: '#sec-menu-cv [data-cv-sub="recibidos"]', sections: [] },
      { key: 'cv:previsualizados', label: 'Curriculum Vitae · CV previsualizados', selector: '#sec-menu-cv [data-cv-sub="previsualizados"]', sections: [] },
      { key: 'personal:asistencias', label: 'Control de Asistencias', selector: '#sec-menu-personal [data-personal-sub="asistencias"]', sections: ['sec-asistencias-workspace'] }
    ]
  },
  {
    key: 'turnos',
    label: 'Turnero Web',
    sections: ['sec-menu-turnos', 'sec-turnos-workspace'],
    submodules: [
      { key: 'turnos:profesionales', label: 'ABM Profesionales', selector: '#sec-menu-turnos [data-turnos-sub="profesionales"]', sections: [] },
      { key: 'turnos:obras_sociales', label: 'ABM Obras Sociales', selector: '#sec-menu-turnos [data-turnos-sub="obras_sociales"]', sections: [] },
      { key: 'turnos:planes', label: 'ABM Planes', selector: '#sec-menu-turnos [data-turnos-sub="planes"]', sections: [] },
      { key: 'turnos:especialidades', label: 'ABM Especialidades', selector: '#sec-menu-turnos [data-turnos-sub="especialidades"]', sections: [] },
      { key: 'turnos:gestion_profesionales', label: 'Gestión de Profesionales', selector: '#sec-menu-turnos [data-turnos-sub="gestion_profesionales"]', sections: [] },
      { key: 'turnos:pacientes', label: 'Gestión de Pacientes', selector: '#sec-menu-turnos [data-turnos-sub="pacientes"]', sections: [] },
      { key: 'turnos:gestion_turnos', label: 'Gestión de Turnos', selector: '#sec-menu-turnos [data-turnos-sub="gestion_turnos"]', sections: [] },
      { key: 'turnos:pagos_split', label: 'Pagos Online y Split MP', selector: '#sec-menu-turnos [data-turnos-sub="pagos_split"]', sections: [] },
      { key: 'turnos:portal', label: 'Portal Público /turnos', selector: '#sec-menu-turnos [data-turnos-sub="portal"]', sections: [] }
    ]
  },
  {
    key: 'inmobiliaria',
    label: 'Inmobiliaria',
    sections: ['sec-menu-inmobiliaria', 'sec-inmobiliaria-workspace'],
    submodules: [
      { key: 'inmobiliaria:banners', label: 'Banners', selector: '', sections: [] },
      { key: 'inmobiliaria:propiedades', label: 'Propiedades', selector: '', sections: [] },
      { key: 'inmobiliaria:clientes', label: 'Clientes', selector: '', sections: [] },
      { key: 'inmobiliaria:contratos', label: 'Contratos', selector: '', sections: [] },
      { key: 'inmobiliaria:plantillas', label: 'Plantillas', selector: '', sections: [] },
      { key: 'inmobiliaria:pagos_split', label: 'Pagos Split', selector: '', sections: [] },
      { key: 'inmobiliaria:consultas', label: 'Consultas', selector: '', sections: [] },
      { key: 'inmobiliaria:portal', label: 'Portal', selector: '', sections: [] }
    ]
  },
  {
    key: 'mi_contador',
    label: 'Mi Contador',
    sections: ['sec-menu-micontador', 'sec-micontador-workspace'],
    submodules: [
      { key: 'mi_contador:ia', label: 'Asesor IA', selector: '#sec-menu-micontador [data-mc-sub="ia"]', sections: [] },
      { key: 'mi_contador:arca_ri', label: 'ARCA RI (F.2051/F.2083/F.5663)', selector: '#sec-menu-micontador [data-mc-sub="arca_ri"]', sections: [] },
      { key: 'mi_contador:monotributo', label: 'ARCA Monotributo', selector: '#sec-menu-micontador [data-mc-sub="monotributo"]', sections: [] },
      { key: 'mi_contador:gastos_retiros', label: 'Compras, Gastos y Retiros', selector: '#sec-menu-micontador [data-mc-sub="gastos_retiros"]', sections: [] },
      { key: 'mi_contador:finanzas_stock', label: 'Stock y Finanzas', selector: '#sec-menu-micontador [data-mc-sub="finanzas_stock"]', sections: [] },
      { key: 'mi_contador:config', label: 'Configuración Fiscal', selector: '#sec-menu-micontador [data-mc-sub="config"]', sections: [] }
    ]
  },`;
  appJs = appJs.replace(
    /\{\s*key:\s*'verificador'[^\n]*\},/,
    cvBlock
  );
  fs.writeFileSync(appJsPath, appJs, "utf8");
  console.log("[SYNC] Preserved MiniSistema-exclusive 'cv' module in public/sistema/assets/js/app.js");
}
if (appJs.includes("if (roleEl) roleEl.textContent = `${displayRole} (@${uKey || user.username})`;")) {
  appJs = appJs.replace(
    "if (roleEl) roleEl.textContent = `${displayRole} (@${uKey || user.username})`;",
    "const topbarRoleLabel = displayRole === 'Administrador General' ? 'Admin. Gral.' : displayRole;\n  if (roleEl) roleEl.textContent = `${topbarRoleLabel} (@${uKey || user.username})`;"
  );
  fs.writeFileSync(appJsPath, appJs, "utf8");
  console.log("[SYNC] Preserved 'Admin. Gral.' topbar label in public/sistema/assets/js/app.js");
}
const modStart = appJs.indexOf("const ALL_SYSTEM_MODULES = [");
const modEnd = appJs.indexOf("const DEFAULT_MODULE_KEYS =", modStart);
if (modStart !== -1 && modEnd !== -1) {
  const block = appJs.slice(modStart, modEnd);
  const keyMatches = [...block.matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1]);
  const uniqueKeys = Array.from(new Set(keyMatches));
  if (uniqueKeys.length > 0) {
    const typesPath = path.join(msRoot, "src/lib/erp/types.ts");
    let typesRaw = fs.readFileSync(typesPath, "utf8");
    const keysFormatted =
      "export const ALL_ERP_MODULE_KEYS: string[] = [\n" +
      uniqueKeys.map((k) => `  "${k}",`).join("\n") +
      "\n];";
    typesRaw = typesRaw.replace(
      /export const ALL_ERP_MODULE_KEYS:\s*string\[\]\s*=\s*\[[\s\S]*?\];/,
      keysFormatted
    );
    fs.writeFileSync(typesPath, typesRaw, "utf8");
    console.log(
      `[SYNC] Synchronized ${uniqueKeys.length} module keys into src/lib/erp/types.ts`
    );
  }
}
