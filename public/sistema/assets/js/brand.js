/* ==========================================================================
   MINISISTEMA — MOTOR MULTI-COMERCIO (OPCIÓN 1 & OPCIÓN 2)
   Inyecta identidad corporativa, aísla sesiones por tenant y enruta fetch API
   ========================================================================== */
(function () {
  'use strict';

  var boot = (typeof window !== 'undefined' && window.__ERP_TENANT_BOOT__) || {};
  var slug = String(boot.slug || 'minisistema').toLowerCase();
  var fantasyName = boot.fantasyName || boot.businessName || 'MiniSistema';
  var businessName = boot.businessName || fantasyName;
  var storagePrefix = 'ms_' + slug + '_';
  var sessKey = storagePrefix + 'erp_active_admin_v1';

  var BRAND = {
    id: slug,
    slug: slug,
    isBase: Boolean(boot.isBase),
    optionType: Number(boot.optionType || 1),
    isPaseoAlberdi: false,
    isCasaNueva: false,
    isMiniSistema: true,
    storagePrefix: storagePrefix,
    primaryAdmin: 'danielg',
    primaryAdminDisplay: 'danielg',
    defaultBranch: fantasyName,
    name: fantasyName,
    upperName: fantasyName.toUpperCase(),
    fullName: businessName,
    upperFullName: businessName.toUpperCase(),
    shortSuper: fantasyName.toUpperCase(),
    erpTitle: boot.isBase ? 'MiniSistema ERP' : fantasyName + ' · ERP',
    clubName: boot.clubName || 'Club MiniSistema',
    clubUpper: String(boot.clubName || 'CLUB MINISISTEMA').toUpperCase(),
    clubQrPrefix: 'MS',
    domain: typeof window !== 'undefined' ? window.location.host : 'www.minisistema.com.ar',
    origin: typeof window !== 'undefined' ? window.location.origin : 'https://www.minisistema.com.ar',
    erpUrl: boot.erpUrl || '/sistema',
    carritoUrl: boot.carritoUrl || '/carrito',
    verificadorUrl: boot.verificadorUrl || '/verificador',
    emailInfo: boot.emailInfo || 'contacto@minisistema.com.ar',
    emailFidelizacion: boot.emailInfo || 'contacto@minisistema.com.ar',
    address: boot.address || 'Río Cuarto, Córdoba, Argentina',
    whatsappDigits: boot.whatsappDigits || '5493585095475',
    whatsappUrl: 'https://wa.me/' + String(boot.whatsappDigits || '5493585095475').replace(/\D/g, ''),
    whatsappDisplay: boot.whatsappDisplay || '+54 9 358 509-5475',
    whatsappLocalExample: '3585095475',
    defaultLocalidad: boot.localidad || 'RÍO CUARTO',
    defaultCp: boot.cp || '5800',
    themeColor: boot.primaryHex || '#112D3A',
    accentHex: boot.accentHex || '#56D7A1',
    carbonHex: boot.primaryHex || '#112D3A',
    enabledModules: Array.isArray(boot.enabledModules) ? boot.enabledModules : [],
    fiscal: {
      titular: businessName.toUpperCase(),
      fantasia: fantasyName.toUpperCase(),
      cuitNum: 0,
      cuitFmt: boot.cuitFmt || 'A CONFIGURAR',
      iibb: boot.iibb || '—',
      condIva: boot.condIva || 'IVA RESPONSABLE INSCRIPTO',
      inicioAct: boot.inicioAct || '—',
      domicilio: boot.address || 'Río Cuarto, Córdoba, Argentina'
    },
    assets: {
      logo1x1: boot.logo1x1Url || '/sistema/assets/img/minisistema/logo-1x1.png?v=2',
      logoHorizontal: boot.logoHorizontalUrl || '/sistema/assets/img/minisistema/logo-horizontal.png?v=2',
      logoSymbol: boot.logoSymbolUrl || '/sistema/assets/img/minisistema/logo-symbol.png?v=2',
      icon512: boot.logoSymbolUrl || '/sistema/assets/img/minisistema/icon-512.png',
      icon192: boot.logoSymbolUrl || '/sistema/assets/img/minisistema/icon-192.png',
      appleTouch: boot.logoSymbolUrl || '/sistema/assets/img/minisistema/apple-touch-icon.png',
      favicon64: boot.logoSymbolUrl || '/sistema/assets/img/minisistema/favicon-64.png',
      manifest: '/sistema/manifest.webmanifest?tenant=' + encodeURIComponent(slug)
    }
  };

  window.ERP_BRAND = BRAND;
  window.STORE_BRAND = BRAND;

  // Interceptor inteligente de fetch para enrutar llamadas ERP al tenant aislado en Supabase
  if (typeof window !== 'undefined' && typeof window.fetch === 'function' && !window.__MS_FETCH_PATCHED__) {
    window.__MS_FETCH_PATCHED__ = true;
    var origFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
      var urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      var isErpApi = false;

      // Redirigir cualquier respaldo residual de cn.com.ar hacia nuestra API local en Supabase (salvo puentes explícitos CRM _direct_cn=1)
      if (urlStr.indexOf('cn.com.ar') !== -1 && urlStr.indexOf('/sistema/api/') !== -1 && urlStr.indexOf('_direct_cn=1') === -1) {
        var afterApi = urlStr.split('/sistema/api/')[1] || '';
        urlStr = '/sistema/api/' + afterApi;
        input = urlStr;
        isErpApi = true;
      } else if (
        urlStr.indexOf('api/') === 0 ||
        urlStr.indexOf('./api/') === 0 ||
        urlStr.indexOf('../sistema/api/') === 0 ||
        urlStr.indexOf('/sistema/api/') !== -1
      ) {
        isErpApi = true;
        // Normalizar a /sistema/api/... para funcionar idéntico en /sistema, /carrito, /verificador y /<nuevosistema>
        var matchApi = urlStr.match(/(?:^|\.\.\/sistema\/|\.\/|\/sistema\/)?api\/([^?#]+)(\?.*)?$/);
        if (matchApi && urlStr.indexOf('/api/admin/') === -1 && urlStr.indexOf('/api/public/') === -1 && urlStr.indexOf('/api/mercadopago/') === -1) {
          urlStr = '/sistema/api/' + matchApi[1] + (matchApi[2] || '');
          input = urlStr;
        }
      }

      if (isErpApi) {
        var nextInit = Object.assign({}, init || {});
        var headers = new Headers(nextInit.headers || (typeof input !== 'string' && input && input.headers) || {});
        if (!headers.has('X-ERP-Tenant')) {
          headers.set('X-ERP-Tenant', slug);
        }
        try {
          var rawSess = sessionStorage.getItem(sessKey) || localStorage.getItem(sessKey);
          if (rawSess) {
            var parsed = JSON.parse(rawSess);
            if (parsed && parsed.username && !headers.has('X-ERP-User')) {
              headers.set('X-ERP-User', String(parsed.username));
            }
          }
        } catch (_e) {}
        nextInit.headers = headers;
        if (!nextInit.credentials) {
          nextInit.credentials = 'same-origin';
        }
        return origFetch(input, nextInit);
      }

      return origFetch(input, init);
    };
  }
})();
