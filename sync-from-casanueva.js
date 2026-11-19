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
    label: 'Curriculum Vitae',
    sections: ['sec-menu-cv', 'sec-cv-workspace'],
    submodules: [
      { key: 'cv:recibidos', label: 'CV recibidos', selector: '#sec-menu-cv [data-cv-sub="recibidos"]', sections: [] },
      { key: 'cv:previsualizados', label: 'CV previsualizados', selector: '#sec-menu-cv [data-cv-sub="previsualizados"]', sections: [] }
    ]
  },`;
  appJs = appJs.replace(
    /\{\s*key:\s*'verificador'[^\n]*\},/,
    cvBlock
  );
  fs.writeFileSync(appJsPath, appJs, "utf8");
  console.log("[SYNC] Preserved MiniSistema-exclusive 'cv' module in public/sistema/assets/js/app.js");
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
