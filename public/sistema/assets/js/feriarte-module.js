/* ==========================================================================
   MÓDULO EXCLUSIVO DEL ADMINISTRADOR GENERAL (@danielg) — FERIARTE
   Control central del marketplace FeriARTE (www.feriarte.com.ar) desde MiniSistema.
   Respeta tarjetas uniformes (.modules-grid / .module-card) sin pills ni descripciones.
   ========================================================================== */
(function () {
  'use strict';

  var SUBMODULES = [
    { key: 'panel', label: 'Panel General', icon: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>' },
    { key: 'usuarios', label: 'Usuarios', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>' },
    { key: 'organizadores', label: 'Organizadores', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>' },
    { key: 'ferias', label: 'Ferias', icon: '<path d="M3 20h18L12 4 3 20z"></path><path d="M12 13v7"></path>' },
    { key: 'feriantes', label: 'Emprendedores', icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>' },
    { key: 'tiendas', label: 'Tiendas', icon: '<path d="M3 9l2-5h14l2 5"></path><path d="M3 9v11h18V9"></path><path d="M9 20v-6h6v6"></path>' },
    { key: 'productos', label: 'Productos', icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>' },
    { key: 'categorias', label: 'Categorías', icon: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>' },
    { key: 'otros_productos', label: 'Productos en Otros', icon: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>' },
    { key: 'pedidos', label: 'Pedidos', icon: '<circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>' },
    { key: 'pagos', label: 'Pagos', icon: '<rect x="1" y="4" width="22" height="16" rx="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>' },
    { key: 'comisiones', label: 'Comisiones', icon: '<line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle>' },
    { key: 'liquidaciones', label: 'Liquidaciones', icon: '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>' },
    { key: 'reclamos', label: 'Reclamos', icon: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>' },
    { key: 'estadisticas', label: 'Estadísticas', icon: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>' },
    { key: 'configuracion', label: 'Configuración', icon: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' },
    { key: 'contenido', label: 'Contenido', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>' },
    { key: 'auditoria', label: 'Auditoría', icon: '<polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>' }
  ];

  var STATE = {
    view: 'menu',
    data: null,
    loading: false,
    feedback: '',
    productsAdmin: {
      q: '',
      storeId: '',
      categoryId: '',
      status: '',
      moderationStatus: '',
      dateFrom: '',
      dateTo: '',
      sort: 'newest',
      page: 1,
      pageSize: 25,
      items: [],
      total: 0,
      totalPages: 1,
      loading: false,
      error: '',
      filtersLoaded: false,
      stores: [],
      categories: [],
      reqSeq: 0
    }
  };

  var fmtArs = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  });

  function fmtCents(c) {
    return fmtArs.format((Number(c) || 0) / 100);
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isGeneralAdmin() {
    var isBaseTenant = Boolean(
      (window.__ERP_TENANT_BOOT__ && window.__ERP_TENANT_BOOT__.isBase) ||
      (window.ERP_BRAND && window.ERP_BRAND.isBase)
    );
    if (!isBaseTenant) return false;
    var user = null;
    if (typeof window.__MS_GET_ACTIVE_USER__ === 'function') {
      user = window.__MS_GET_ACTIVE_USER__();
    }
    if (!user) {
      try {
        var pfx = (window.ERP_BRAND && window.ERP_BRAND.storagePrefix) || 'ms_minisistema_';
        var raw = sessionStorage.getItem(pfx + 'erp_active_admin_v1') || localStorage.getItem(pfx + 'erp_active_admin_v1');
        if (raw) user = JSON.parse(raw);
      } catch (_e) {}
    }
    if (!user || !user.username) return false;
    var u = String(user.username).trim().toLowerCase();
    return u === 'danielg';
  }

  function getApiBase() {
    var boot = window.__ERP_TENANT_BOOT__;
    if (boot && !boot.isBase && boot.optionType === 2 && boot.slug) {
      return '/' + encodeURIComponent(boot.slug) + '/api/feriarte';
    }
    return '/sistema/api/feriarte';
  }

  async function apiFeriarte(method, payload, queryParams) {
    var url = getApiBase();
    if (queryParams && typeof queryParams === 'object') {
      var usp = new URLSearchParams();
      Object.keys(queryParams).forEach(function (k) {
        var v = queryParams[k];
        if (v !== undefined && v !== null && String(v) !== '') {
          usp.set(k, String(v));
        }
      });
      var qs = usp.toString();
      if (qs) url += (url.indexOf('?') === -1 ? '?' : '&') + qs;
    }
    var opts = {
      method: method || 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    };
    if (payload) opts.body = JSON.stringify(payload);
    var res = await fetch(url, opts);
    return res.json();
  }

  function ensureSections() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var secMenu = document.getElementById('sec-menu-feriarte');
    if (secMenu && secMenu.parentNode !== erpMain) {
      erpMain.appendChild(secMenu);
    }
    if (!secMenu) {
      secMenu = document.createElement('section');
      secMenu.id = 'sec-menu-feriarte';
      secMenu.className = 'erp-section';
      secMenu.hidden = true;
      secMenu.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="fa-back-home">← Volver a Mega Sistemas</button>' +
            '<span class="module-breadcrumb">Mega Sistemas · <strong>FeriARTE</strong></span>' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" id="fa-submodules-grid" aria-label="Submódulos de FeriARTE"></div>';
      erpMain.appendChild(secMenu);
      secMenu.querySelector('#fa-back-home').addEventListener('click', closeToHome);
    }

    var secDetail = document.getElementById('sec-feriarte-detail');
    if (secDetail && secDetail.parentNode !== erpMain) {
      erpMain.appendChild(secDetail);
    }
    if (!secDetail) {
      secDetail = document.createElement('section');
      secDetail.id = 'sec-feriarte-detail';
      secDetail.className = 'erp-section';
      secDetail.hidden = true;
      secDetail.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="fa-back-menu">← Volver a FeriARTE</button>' +
            '<span class="module-breadcrumb" id="fa-detail-breadcrumb">FeriARTE</span>' +
          '</div>' +
        '</div>' +
        '<div id="fa-detail-body" style="padding:1rem 0;"></div>';
      erpMain.appendChild(secDetail);
      secDetail.querySelector('#fa-back-menu').addEventListener('click', function () {
        openFeriarteView('menu');
      });
    }

    return { menuSec: secMenu, detailSec: secDetail };
  }

  function hideAllErpSections() {
    document.querySelectorAll('.erp-main > .erp-section, section.erp-section').forEach(function (sec) {
      sec.hidden = true;
    });
  }

  function closeToHome() {
    if (typeof window.__MS_MEGASISTEMAS_OPEN__ === 'function') {
      window.__MS_MEGASISTEMAS_OPEN__();
      return;
    }
    hideAllErpSections();
    var home = document.getElementById('sec-inicio');
    if (home) home.hidden = false;
    var backBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backBtn) backBtn.hidden = true;
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    if (topbarModInd) topbarModInd.hidden = true;
  }

  function bindGlobalNavIntegration() {
    if (window.__MS_FA_NAV_BOUND__) return;
    window.__MS_FA_NAV_BOUND__ = true;

    document.addEventListener('click', function (ev) {
      var target = ev.target;
      if (!target || typeof target.closest !== 'function') return;

      var navEl = target.closest(
        '#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-megasistemas-home-card, #ms-doncontador-home-card, #ms-reikionline-home-card, #ms-bibliotecaroncedo-home-card, #ms-cv-home-card, #ms-personal-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card'
      );
      if (!navEl) return;

      var menuSec = document.getElementById('sec-menu-feriarte');
      var detailSec = document.getElementById('sec-feriarte-detail');
      var isFaActive = (menuSec && !menuSec.hidden) || (detailSec && !detailSec.hidden);

      if (navEl.id === 'btn-topbar-back-facturacion' && isFaActive) {
        ev.preventDefault();
        ev.stopPropagation();
        if (detailSec && !detailSec.hidden) {
          openFeriarteView('menu');
        } else {
          closeToHome();
        }
        return;
      }

      if (menuSec) menuSec.hidden = true;
      if (detailSec) detailSec.hidden = true;
    }, true);
  }

  async function reloadData() {
    STATE.loading = true;
    try {
      var res = await apiFeriarte('GET');
      if (res && res.ok) {
        STATE.data = res;
      } else {
        STATE.feedback = (res && res.message) || 'No se pudo consultar FeriARTE.';
      }
    } catch (_e) {
      STATE.feedback = 'No se pudo consultar FeriARTE.';
    } finally {
      STATE.loading = false;
    }
  }

  function renderSubmodulesMenu() {
    var grid = document.getElementById('fa-submodules-grid');
    if (!grid) return;
    grid.innerHTML = SUBMODULES.map(function (m) {
      return (
        '<article class="module-card" role="button" tabindex="0" data-fa-sub="' + esc(m.key) + '">' +
          '<div class="module-icon" aria-hidden="true">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + m.icon + '</svg>' +
          '</div>' +
          '<h3>' + esc(m.label) + '</h3>' +
        '</article>'
      );
    }).join('');

    grid.querySelectorAll('[data-fa-sub]').forEach(function (card) {
      var open = function () {
        openFeriarteView(card.getAttribute('data-fa-sub'));
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          open();
        }
      });
    });
  }

  function renderDetailView(viewKey) {
    var body = document.getElementById('fa-detail-body');
    var bc = document.getElementById('fa-detail-breadcrumb');
    var meta = SUBMODULES.find(function (s) { return s.key === viewKey; }) || { label: viewKey };
    if (bc) bc.innerHTML = 'FeriARTE · <strong>' + esc(meta.label) + '</strong>';
    if (!body) return;

    if (viewKey !== 'productos') {
      if (STATE.loading) {
        body.innerHTML = '<p style="padding:1rem;">Cargando datos reales de FeriARTE...</p>';
        return;
      }
      if (!STATE.data) {
        body.innerHTML =
          '<div style="background:#fff;border-radius:12px;padding:18px;border:1px solid #f5c2c7;color:#842029;font-weight:700;">' +
            esc(STATE.feedback || 'No se pudieron cargar los datos de FeriARTE. Verificá tu sesión de Administrador General.') +
          '</div>';
        return;
      }
    }

    var d = STATE.data || {};
    var k = d.kpis || {};
    var banner = STATE.feedback
      ? '<div style="margin-bottom:1rem;padding:0.75rem 1rem;border-radius:10px;background:#e6f7f2;color:#023C46;font-weight:700;">' + esc(STATE.feedback) + '</div>'
      : '';

    if (viewKey === 'panel' || viewKey === 'estadisticas') {
      var otrosCount = Number(k.productsInOtrosCount || 0);
      var otrosAlert = otrosCount > 0
        ? '<div style="margin-bottom:14px;padding:14px 16px;border-radius:12px;background:#FFF8EF;border:1px solid #FC4702;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">' +
            '<div style="font-size:13px;color:#023C46;"><strong>Atención · Descubrimiento de categorías:</strong> Hay <strong>' + esc(otrosCount) + '</strong> producto(s) en <strong>«Otros»</strong> esperando revisión para recategorizar o crear una nueva categoría.</div>' +
            '<button type="button" id="fa-go-otros-btn" style="padding:8px 14px;border:none;border-radius:8px;background:#FC4702;color:#fff;font-weight:800;cursor:pointer;">Revisar «Productos en Otros» →</button>' +
          '</div>'
        : '';
      var cards = [
        ['Usuarios registrados', k.usersRegistered],
        ['Clientes / Caminantes activos', k.clientsActive],
        ['Emprendedores activos', k.feriantesActive],
        ['Organizadores activos', k.organizersActive],
        ['Organizadores pendientes', k.organizersPending],
        ['Ferias publicadas', k.fairsPublished],
        ['Tiendas habilitadas', k.storesEnabled],
        ['Productos disponibles', k.productsAvailable],
        ['Productos en «Otros»', otrosCount],
        ['Ventas brutas', fmtCents(k.grossSalesCents)],
        ['Ventas netas emprendedores', fmtCents(k.netSalesCents)],
        ['Comisión FeriARTE', fmtCents(k.platformCommissionCents)],
        ['Comisiones organizadores', fmtCents(k.organizerCommissionCents)],
        ['Liquidaciones pendientes', fmtCents(k.pendingSettlementsCents)],
        ['Órdenes pendientes', k.pendingOrdersCount],
        ['Reclamos abiertos', k.openClaimsCount],
        ['Escaneos QR / Conversiones', (k.qrScansTotal || 0) + ' / ' + (k.qrConvertedOrders || 0)]
      ];
      body.innerHTML = banner + otrosAlert +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;">' +
        cards.map(function (c) {
          return '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:14px;">' +
            '<div style="font-size:12px;color:#526570;font-weight:700;">' + esc(c[0]) + '</div>' +
            '<div style="font-size:22px;font-weight:900;color:#023C46;margin-top:4px;">' + esc(c[1]) + '</div>' +
          '</div>';
        }).join('') +
        '</div>';
      var goOtros = document.getElementById('fa-go-otros-btn');
      if (goOtros) {
        goOtros.addEventListener('click', function () {
          openFeriarteView('otros_productos');
        });
      }
      return;
    }

    if (viewKey === 'organizadores') {
      var allOrgs = d.organizers || [];

      var fmtOrgDate = function (iso) {
        if (!iso) return '—';
        try {
          return new Date(iso).toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
        } catch (_e) { return String(iso); }
      };

      var orgStatusMeta = function (st) {
        if (st === 'approved') return { label: 'Aprobado', bg: '#dcfce7', color: '#166534' };
        if (st === 'pending') return { label: 'Pendiente', bg: '#fef3c7', color: '#92400e' };
        if (st === 'suspended') return { label: 'Suspendido', bg: '#fee2e2', color: '#991b1b' };
        if (st === 'rejected') return { label: 'Rechazado', bg: '#f1f5f9', color: '#475569' };
        return { label: String(st || '—'), bg: '#f1f5f9', color: '#334155' };
      };

      var openOrgFichaModal = function (orgObj) {
        if (!orgObj) return;
        var prevModal = document.getElementById('fa-org-ficha-modal');
        if (prevModal) prevModal.remove();

        var stMeta = orgStatusMeta(orgObj.approval_status);
        var hasPayout = Boolean(orgObj.payout_cbu_cvu || orgObj.payout_alias || orgObj.payout_holder_name);
        var payoutBlock = hasPayout
          ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;font-size:12px;">' +
              '<div><strong>Método:</strong> ' + esc(orgObj.payout_method || 'Transferencia') + '</div>' +
              '<div><strong>Titular:</strong> ' + esc(orgObj.payout_holder_name || '—') + '</div>' +
              '<div><strong>Alias:</strong> ' + esc(orgObj.payout_alias || '—') + '</div>' +
              '<div><strong>CBU / CVU:</strong> ' + esc(orgObj.payout_cbu_cvu || '—') + '</div>' +
            '</div>'
          : '<div style="font-size:12px;color:#64748b;">Aún no cargó datos bancarios de cobro.</div>';

        var fairsListHtml = (orgObj.fairs || []).length
          ? orgObj.fairs.map(function (f) {
              var loc = [f.locality, f.province].filter(Boolean).join(', ');
              return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;margin-top:6px;font-size:12px;">' +
                '<div><strong>' + esc(f.name) + '</strong>' + (loc ? ' · <span style="color:#64748b;">' + esc(loc) + '</span>' : '') + ' · <span style="text-transform:capitalize;">' + esc(f.status || '') + '</span></div>' +
                '<a href="https://feriarte.vercel.app/feria/' + encodeURIComponent(f.slug) + '" target="_blank" rel="noopener" style="color:#069294;font-weight:700;text-decoration:none;">Ver feria ↗</a>' +
              '</div>';
            }).join('')
          : '<div style="font-size:12px;color:#64748b;">Todavía no creó ferias.</div>';

        var overlay = document.createElement('div');
        overlay.id = 'fa-org-ficha-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(2,60,70,0.62);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;';
        overlay.innerHTML =
          '<div style="background:#fff;border-radius:16px;max-width:650px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,0.28);border:1px solid #d9e2e6;">' +
            '<div style="background:#023C46;color:#fff;padding:18px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-radius:16px 16px 0 0;">' +
              '<div>' +
                '<div style="font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#56D7A1;">Ficha de Organizador · FeriARTE</div>' +
                '<h3 style="margin:4px 0 2px;font-size:19px;font-weight:900;color:#fff;">' + esc(orgObj.organization_name || 'Sin nombre') + '</h3>' +
                '<div style="font-size:13px;color:rgba(255,255,255,0.88);">' + esc(orgObj.user_full_name || 'Responsable') + (orgObj.user_email ? ' · ' + esc(orgObj.user_email) : '') + '</div>' +
              '</div>' +
              '<button type="button" id="fa-org-close-x" aria-label="Cerrar ficha" style="background:rgba(255,255,255,0.14);color:#fff;border:none;border-radius:8px;width:32px;height:32px;font-size:18px;font-weight:700;cursor:pointer;line-height:1;">&times;</button>' +
            '</div>' +
            '<div style="padding:18px 20px;display:grid;gap:14px;color:#023C46;">' +
              '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
                '<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:' + stMeta.bg + ';color:' + stMeta.color + ';">Estado: ' + esc(stMeta.label) + '</span>' +
                '<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:#f1f5f9;color:#023C46;">Código invitación: <code>' + esc(orgObj.invite_code || '—') + '</code></span>' +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">' +
                '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#069294;margin-bottom:8px;">Datos de registración Web</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;font-size:12.5px;">' +
                  '<div><strong>Responsable:</strong><br>' + esc(orgObj.user_full_name || '—') + '</div>' +
                  '<div><strong>Correo electrónico:</strong><br>' + esc(orgObj.user_email || '—') + '</div>' +
                  '<div><strong>WhatsApp / Teléfono:</strong><br>' + esc(orgObj.user_phone || 'No informado') + '</div>' +
                  '<div><strong>CUIT / CUIL:</strong><br>' + esc(orgObj.cuit_cuil || 'No informado') + '</div>' +
                  '<div><strong>Ubicación:</strong><br>' + esc([orgObj.locality, orgObj.province].filter(Boolean).join(', ') || 'No informada') + '</div>' +
                  '<div><strong>Comisión especial:</strong><br>' + (orgObj.commission_override_pct != null ? esc(orgObj.commission_override_pct) + '%' : 'Regla global vigente') + '</div>' +
                  '<div><strong>Fecha de solicitud:</strong><br>' + esc(fmtOrgDate(orgObj.created_at)) + '</div>' +
                  '<div><strong>Aprobación:</strong><br>' + (orgObj.approved_at ? esc(fmtOrgDate(orgObj.approved_at)) + (orgObj.approved_by ? ' (' + esc(orgObj.approved_by) + ')' : '') : 'Pendiente') + '</div>' +
                '</div>' +
                (orgObj.description ? '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:12.5px;"><strong>Descripción:</strong><br>' + esc(orgObj.description) + '</div>' : '') +
              '</div>' +
              '<div style="background:#FFF8EF;border:1px solid #f2dfc4;border-radius:12px;padding:14px;">' +
                '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#FC4702;margin-bottom:8px;">Datos de cobro de comisiones</div>' +
                payoutBlock +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">' +
                '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#023C46;margin-bottom:6px;">Ferias registradas (' + esc(orgObj.fairs_count || 0) + ')</div>' +
                fairsListHtml +
              '</div>' +
              '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding-top:4px;">' +
                '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
                  '<button type="button" data-modal-org-act="approved" style="padding:8px 14px;border-radius:8px;border:none;background:#069294;color:#fff;font-weight:700;cursor:pointer;">Aprobar organizador</button>' +
                  '<button type="button" data-modal-org-act="suspended" style="padding:8px 14px;border-radius:8px;border:none;background:#FC4702;color:#fff;font-weight:700;cursor:pointer;">Suspender</button>' +
                '</div>' +
                '<button type="button" id="fa-org-close-btn" style="background:#023C46;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;">Cerrar ficha</button>' +
              '</div>' +
            '</div>' +
          '</div>';

        var closeModal = function () {
          overlay.remove();
          document.removeEventListener('keydown', onEsc);
        };
        var onEsc = function (e) { if (e.key === 'Escape') closeModal(); };
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
        overlay.querySelector('#fa-org-close-x').addEventListener('click', closeModal);
        overlay.querySelector('#fa-org-close-btn').addEventListener('click', closeModal);
        overlay.querySelectorAll('[data-modal-org-act]').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            var res = await apiFeriarte('POST', {
              action: 'review_organizer',
              organizerProfileId: orgObj.id,
              decision: btn.getAttribute('data-modal-org-act')
            });
            closeModal();
            STATE.feedback = (res && res.message) || 'Organizador actualizado.';
            await reloadData();
            renderDetailView('organizadores');
          });
        });
        document.addEventListener('keydown', onEsc);
        document.body.appendChild(overlay);
      };

      var renderOrgsTable = function (queryStr) {
        var q = String(queryStr || '').trim().toLowerCase();
        var filtered = q
          ? allOrgs.filter(function (o) {
              return String(o.organization_name || '').toLowerCase().indexOf(q) !== -1 ||
                String(o.user_full_name || '').toLowerCase().indexOf(q) !== -1 ||
                String(o.user_email || '').toLowerCase().indexOf(q) !== -1;
            })
          : allOrgs;

        var tbody = document.getElementById('fa-orgs-tbody');
        var countEl = document.getElementById('fa-orgs-count');
        if (countEl) countEl.textContent = filtered.length + ' registro(s)';
        if (!tbody) return;

        if (!filtered.length) {
          tbody.innerHTML = '<tr><td colspan="4" style="padding:14px;color:#64748b;">Sin organizadores registrados aún.</td></tr>';
          return;
        }

        tbody.innerHTML = filtered.map(function (o) {
          var stMeta = orgStatusMeta(o.approval_status);
          return '<tr data-fa-org-id="' + esc(o.id) + '" style="cursor:pointer;">' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:700;color:#023C46;">' + esc(o.organization_name || 'Sin nombre') + '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#334155;">' +
              '<div>' + esc(o.user_full_name || '—') + '</div>' +
              '<small style="color:#64748b;">' + esc(o.user_email || '') + '</small>' +
            '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">' +
              '<span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:' + stMeta.bg + ';color:' + stMeta.color + ';">' + esc(stMeta.label) + '</span>' +
            '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;">' +
              '<button type="button" style="background:#069294;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">Ver ficha</button>' +
            '</td>' +
          '</tr>';
        }).join('');

        tbody.querySelectorAll('[data-fa-org-id]').forEach(function (tr) {
          tr.addEventListener('click', function () {
            var oid = tr.getAttribute('data-fa-org-id');
            var found = allOrgs.find(function (x) { return x.id === oid; });
            openOrgFichaModal(found);
          });
        });
      };

      body.innerHTML = banner +
        '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;">' +
          '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
            '<input id="fa-orgs-search" type="search" placeholder="Buscar por organización, responsable o correo..." style="flex:1;min-width:220px;max-width:400px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">' +
            '<span id="fa-orgs-count" style="font-size:12px;font-weight:700;color:#64748b;">' + esc(allOrgs.length) + ' registro(s)</span>' +
          '</div>' +
          '<div style="overflow:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr>' +
              '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Organización</th>' +
              '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Responsable y correo</th>' +
              '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Estado</th>' +
              '<th style="text-align:right;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Ficha</th>' +
            '</tr></thead><tbody id="fa-orgs-tbody"></tbody></table>' +
          '</div>' +
        '</div>';

      renderOrgsTable('');
      var orgSearch = document.getElementById('fa-orgs-search');
      if (orgSearch) {
        orgSearch.addEventListener('input', function () {
          renderOrgsTable(orgSearch.value);
        });
      }
      return;
    }

    if (viewKey === 'ferias') {
      var allFairs = d.fairs || [];

      var fmtFairDate = function (iso) {
        if (!iso) return '—';
        try {
          return new Date(iso).toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
        } catch (_e) { return String(iso); }
      };

      var fairStatusMeta = function (st) {
        if (st === 'active') return { label: 'Activa', bg: '#dcfce7', color: '#166534' };
        if (st === 'upcoming') return { label: 'Próxima', bg: '#e0f2fe', color: '#075985' };
        if (st === 'finished') return { label: 'Finalizada', bg: '#f1f5f9', color: '#475569' };
        if (st === 'draft') return { label: 'Borrador', bg: '#fef3c7', color: '#92400e' };
        if (st === 'suspended') return { label: 'Suspendida', bg: '#fee2e2', color: '#991b1b' };
        return { label: String(st || '—'), bg: '#f1f5f9', color: '#334155' };
      };

      var modalityLabel = function (m) {
        if (m === 'presencial') return 'Presencial';
        if (m === 'virtual') return 'Virtual';
        if (m === 'hibrida') return 'Híbrida';
        return String(m || '—');
      };

      var openFairFichaModal = function (fairObj) {
        if (!fairObj) return;
        var prevModal = document.getElementById('fa-fair-ficha-modal');
        if (prevModal) prevModal.remove();

        var stMeta = fairStatusMeta(fairObj.status);
        var tags = Array.isArray(fairObj.categories_tags) ? fairObj.categories_tags.filter(Boolean) : [];
        var socials = fairObj.social_links && typeof fairObj.social_links === 'object' ? fairObj.social_links : {};
        var socialEntries = Object.keys(socials).filter(function (k) { return Boolean(socials[k]); });

        var storesHtml = (fairObj.linked_stores || []).length
          ? fairObj.linked_stores.map(function (ls) {
              return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;margin-top:6px;font-size:12px;">' +
                '<div><strong>' + esc(ls.store_name) + '</strong>' + (ls.stand_code ? ' · Puesto ' + esc(ls.stand_code) : '') + ' · <span style="color:#64748b;">' + esc(ls.status) + '</span></div>' +
                (ls.store_slug ? '<a href="https://feriarte.vercel.app/tienda/' + encodeURIComponent(ls.store_slug) + '" target="_blank" rel="noopener" style="color:#069294;font-weight:700;text-decoration:none;">Ver tienda ↗</a>' : '') +
              '</div>';
            }).join('')
          : '<div style="font-size:12px;color:#64748b;">Sin emprendedores vinculados todavía.</div>';

        var overlay = document.createElement('div');
        overlay.id = 'fa-fair-ficha-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(2,60,70,0.62);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;';
        overlay.innerHTML =
          '<div style="background:#fff;border-radius:16px;max-width:650px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,0.28);border:1px solid #d9e2e6;">' +
            '<div style="background:#023C46;color:#fff;padding:18px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-radius:16px 16px 0 0;">' +
              '<div>' +
                '<div style="font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#56D7A1;">Ficha de Feria · FeriARTE</div>' +
                '<h3 style="margin:4px 0 2px;font-size:19px;font-weight:900;color:#fff;">' + esc(fairObj.name || 'Sin nombre') + '</h3>' +
                '<div style="font-size:13px;color:rgba(255,255,255,0.88);">' + esc(fairObj.organizer_name || 'Organizador') + (fairObj.organizer_email ? ' · ' + esc(fairObj.organizer_email) : '') + '</div>' +
              '</div>' +
              '<button type="button" id="fa-fair-close-x" aria-label="Cerrar ficha" style="background:rgba(255,255,255,0.14);color:#fff;border:none;border-radius:8px;width:32px;height:32px;font-size:18px;font-weight:700;cursor:pointer;line-height:1;">&times;</button>' +
            '</div>' +
            '<div style="padding:18px 20px;display:grid;gap:14px;color:#023C46;">' +
              '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
                '<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:' + stMeta.bg + ';color:' + stMeta.color + ';">Estado: ' + esc(stMeta.label) + '</span>' +
                '<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:#f1f5f9;color:#023C46;">Modalidad: ' + esc(modalityLabel(fairObj.modality)) + '</span>' +
                (fairObj.is_featured ? '<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:#FFF8EF;color:#FC4702;">Destacada</span>' : '') +
                (fairObj.slug ? '<a href="https://feriarte.vercel.app/feria/' + encodeURIComponent(fairObj.slug) + '" target="_blank" rel="noopener" style="margin-left:auto;font-size:12px;font-weight:800;color:#069294;text-decoration:none;">Abrir página pública ↗</a>' : '') +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">' +
                '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#069294;margin-bottom:8px;">Datos de registración Web</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;font-size:12.5px;">' +
                  '<div><strong>Organizador:</strong><br>' + esc(fairObj.organizer_name || '—') + '</div>' +
                  '<div><strong>Contacto organizador:</strong><br>' + esc([fairObj.organizer_user_name, fairObj.organizer_email].filter(Boolean).join(' · ') || '—') + '</div>' +
                  '<div><strong>Dirección / Predio:</strong><br>' + esc(fairObj.address || 'No informada') + '</div>' +
                  '<div><strong>Localidad y Provincia:</strong><br>' + esc([fairObj.locality, fairObj.province].filter(Boolean).join(', ') || 'No informada') + '</div>' +
                  '<div><strong>Inicio:</strong><br>' + esc(fmtFairDate(fairObj.starts_at)) + '</div>' +
                  '<div><strong>Finalización:</strong><br>' + esc(fmtFairDate(fairObj.ends_at)) + '</div>' +
                  '<div><strong>Horarios:</strong><br>' + esc(fairObj.schedule_text || 'No informado') + '</div>' +
                  '<div><strong>Sigue online al finalizar:</strong><br>' + (fairObj.keep_online_after_end ? 'Sí (vidriera 24/7)' : 'No') + '</div>' +
                  '<div><strong>Fecha de alta:</strong><br>' + esc(fmtFairDate(fairObj.created_at)) + '</div>' +
                '</div>' +
                (fairObj.description ? '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:12.5px;"><strong>Descripción:</strong><br>' + esc(fairObj.description) + '</div>' : '') +
                (tags.length ? '<div style="margin-top:10px;font-size:12px;"><strong>Rubros / etiquetas:</strong> ' + esc(tags.join(', ')) + '</div>' : '') +
                (socialEntries.length ? '<div style="margin-top:8px;font-size:12px;"><strong>Redes:</strong> ' + socialEntries.map(function (k) { return esc(k + ': ' + socials[k]); }).join(' · ') + '</div>' : '') +
              '</div>' +
              '<div style="background:#FFF8EF;border:1px solid #f2dfc4;border-radius:12px;padding:14px;">' +
                '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#FC4702;margin-bottom:6px;">Emprendedores / Tiendas vinculadas (' + esc((fairObj.linked_stores || []).length) + ')</div>' +
                storesHtml +
              '</div>' +
              '<div style="display:flex;justify-content:flex-end;padding-top:4px;">' +
                '<button type="button" id="fa-fair-close-btn" style="background:#023C46;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;">Cerrar ficha</button>' +
              '</div>' +
            '</div>' +
          '</div>';

        var closeModal = function () {
          overlay.remove();
          document.removeEventListener('keydown', onEsc);
        };
        var onEsc = function (e) { if (e.key === 'Escape') closeModal(); };
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
        overlay.querySelector('#fa-fair-close-x').addEventListener('click', closeModal);
        overlay.querySelector('#fa-fair-close-btn').addEventListener('click', closeModal);
        document.addEventListener('keydown', onEsc);
        document.body.appendChild(overlay);
      };

      var renderFairsTable = function (queryStr) {
        var q = String(queryStr || '').trim().toLowerCase();
        var filtered = q
          ? allFairs.filter(function (f) {
              return String(f.name || '').toLowerCase().indexOf(q) !== -1 ||
                String(f.organizer_name || '').toLowerCase().indexOf(q) !== -1 ||
                String(f.organizer_email || '').toLowerCase().indexOf(q) !== -1;
            })
          : allFairs;

        var tbody = document.getElementById('fa-fairs-tbody');
        var countEl = document.getElementById('fa-fairs-count');
        if (countEl) countEl.textContent = filtered.length + ' registro(s)';
        if (!tbody) return;

        if (!filtered.length) {
          tbody.innerHTML = '<tr><td colspan="4" style="padding:14px;color:#64748b;">Sin ferias registradas aún.</td></tr>';
          return;
        }

        tbody.innerHTML = filtered.map(function (f) {
          var stMeta = fairStatusMeta(f.status);
          return '<tr data-fa-fair-id="' + esc(f.id) + '" style="cursor:pointer;">' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:700;color:#023C46;">' + esc(f.name || 'Sin nombre') + '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#334155;">' +
              '<div>' + esc(f.organizer_name || '—') + '</div>' +
              '<small style="color:#64748b;">' + esc(f.organizer_email || '') + '</small>' +
            '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">' +
              '<span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:' + stMeta.bg + ';color:' + stMeta.color + ';">' + esc(stMeta.label) + '</span>' +
            '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;">' +
              '<button type="button" style="background:#069294;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">Ver ficha</button>' +
            '</td>' +
          '</tr>';
        }).join('');

        tbody.querySelectorAll('[data-fa-fair-id]').forEach(function (tr) {
          tr.addEventListener('click', function () {
            var fid = tr.getAttribute('data-fa-fair-id');
            var found = allFairs.find(function (x) { return x.id === fid; });
            openFairFichaModal(found);
          });
        });
      };

      body.innerHTML = banner +
        '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;">' +
          '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
            '<input id="fa-fairs-search" type="search" placeholder="Buscar por nombre de feria, organizador o correo..." style="flex:1;min-width:220px;max-width:400px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">' +
            '<span id="fa-fairs-count" style="font-size:12px;font-weight:700;color:#64748b;">' + esc(allFairs.length) + ' registro(s)</span>' +
          '</div>' +
          '<div style="overflow:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr>' +
              '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Feria</th>' +
              '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Organizador y correo</th>' +
              '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Estado</th>' +
              '<th style="text-align:right;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Ficha</th>' +
            '</tr></thead><tbody id="fa-fairs-tbody"></tbody></table>' +
          '</div>' +
        '</div>';

      renderFairsTable('');
      var fairSearch = document.getElementById('fa-fairs-search');
      if (fairSearch) {
        fairSearch.addEventListener('input', function () {
          renderFairsTable(fairSearch.value);
        });
      }
      return;
    }

    if (viewKey === 'comisiones') {
      var activeRule = (d.commissionRules || []).find(function (r) { return r.scope === 'global' && r.is_active; }) || {
        platform_share_pct: 8,
        organizer_share_pct: 3,
        attribution_window_days: 30
      };
      body.innerHTML = banner +
        '<div style="background:#fff;border-radius:12px;padding:18px;border:1px solid #d9e2e6;max-width:620px;">' +
          '<h3 style="margin:0 0 12px;color:#023C46;">Regla Comercial Global Vigente</h3>' +
          '<form id="fa-comm-form" style="display:grid;gap:12px;">' +
            '<label style="font-size:13px;font-weight:700;">% FeriARTE Plataforma <input name="platformSharePct" type="number" step="0.1" value="' + esc(activeRule.platform_share_pct) + '" style="width:100%;padding:8px;margin-top:4px;border:1px solid #ccc;border-radius:8px;"></label>' +
            '<label style="font-size:13px;font-weight:700;">% Organizador (dentro de la comisión del marketplace) <input name="organizerSharePct" type="number" step="0.1" value="' + esc(activeRule.organizer_share_pct) + '" style="width:100%;padding:8px;margin-top:4px;border:1px solid #ccc;border-radius:8px;"></label>' +
            '<label style="font-size:13px;font-weight:700;">Plazo de atribución (días) <input name="attributionWindowDays" type="number" min="1" max="365" value="' + esc(activeRule.attribution_window_days) + '" style="width:100%;padding:8px;margin-top:4px;border:1px solid #ccc;border-radius:8px;"></label>' +
            '<button type="submit" style="padding:10px 16px;border:none;border-radius:8px;background:#023C46;color:#fff;font-weight:800;cursor:pointer;">Guardar nueva regla vigente</button>' +
          '</form>' +
        '</div>';
      var form = document.getElementById('fa-comm-form');
      if (form) {
        form.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(form);
          var res = await apiFeriarte('POST', {
            action: 'save_commission_rule',
            platformSharePct: Number(fd.get('platformSharePct')),
            organizerSharePct: Number(fd.get('organizerSharePct')),
            attributionWindowDays: Number(fd.get('attributionWindowDays'))
          });
          STATE.feedback = (res && res.message) || 'Regla actualizada.';
          await reloadData();
          renderDetailView('comisiones');
        });
      }
      return;
    }

    if (viewKey === 'liquidaciones') {
      var orgOptions = (d.organizers || [])
        .filter(function (o) { return o.approval_status === 'approved'; })
        .map(function (o) {
          return '<option value="' + esc(o.id) + '">' + esc(o.organization_name) + '</option>';
        }).join('');
      var settleRows = (d.settlements || []).map(function (s) {
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(s.settlement_number) + '</strong></td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(s.cadence) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(s.orders_count) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(fmtCents(s.net_payout_cents)) + '</strong></td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(s.status) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' +
            (s.status !== 'paid'
              ? '<button type="button" data-pay-settle="' + esc(s.id) + '" style="padding:5px 10px;border:none;border-radius:6px;background:#069294;color:#fff;font-weight:700;cursor:pointer;">Registrar Pago</button>'
              : '<span>Ref: ' + esc(s.transfer_reference || '—') + '</span>') +
          '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="display:grid;gap:14px;">' +
          '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">' +
            '<button type="button" id="fa-btn-release-comm" style="padding:8px 14px;border:none;border-radius:8px;background:#023C46;color:#fff;font-weight:700;cursor:pointer;">Habilitar comisiones devengadas</button>' +
            '<select id="fa-settle-org" style="padding:8px;border-radius:8px;border:1px solid #ccc;">' + (orgOptions || '<option value="">Sin organizadores aprobados</option>') + '</select>' +
            '<select id="fa-settle-cadence" style="padding:8px;border-radius:8px;border:1px solid #ccc;"><option value="monthly">Mensual</option><option value="biweekly">Quincenal</option><option value="weekly">Semanal</option><option value="on_demand">Por solicitud</option></select>' +
            '<button type="button" id="fa-btn-gen-settle" style="padding:8px 14px;border:none;border-radius:8px;background:#FC4702;color:#fff;font-weight:800;cursor:pointer;">Emitir Liquidación</button>' +
          '</div>' +
          '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;overflow:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr><th style="text-align:left;padding:8px;">Número</th><th style="text-align:left;padding:8px;">Periodicidad</th><th style="text-align:left;padding:8px;">Ventas</th><th style="text-align:left;padding:8px;">Total a Pagar</th><th style="text-align:left;padding:8px;">Estado</th><th style="text-align:left;padding:8px;">Acción</th></tr></thead><tbody>' +
            (settleRows || '<tr><td colspan="6" style="padding:12px;">Sin liquidaciones generadas aún.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>';

      var btnRel = document.getElementById('fa-btn-release-comm');
      if (btnRel) {
        btnRel.addEventListener('click', async function () {
          var res = await apiFeriarte('POST', { action: 'release_available_commissions', forceAll: true });
          STATE.feedback = (res && res.message) || 'Actualizado.';
          await reloadData();
          renderDetailView('liquidaciones');
        });
      }
      var btnGen = document.getElementById('fa-btn-gen-settle');
      if (btnGen) {
        btnGen.addEventListener('click', async function () {
          var orgSel = document.getElementById('fa-settle-org');
          var cadSel = document.getElementById('fa-settle-cadence');
          var res = await apiFeriarte('POST', {
            action: 'generate_organizer_settlement',
            organizerId: orgSel ? orgSel.value : '',
            cadence: cadSel ? cadSel.value : 'monthly'
          });
          STATE.feedback = (res && res.message) || 'Procesado.';
          await reloadData();
          renderDetailView('liquidaciones');
        });
      }
      body.querySelectorAll('[data-pay-settle]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var ref = window.prompt('Ingresá la referencia bancaria o comprobante de transferencia:');
          if (!ref) return;
          var res = await apiFeriarte('POST', {
            action: 'mark_settlement_paid',
            settlementId: btn.getAttribute('data-pay-settle'),
            transferReference: ref
          });
          STATE.feedback = (res && res.message) || 'Liquidación pagada.';
          await reloadData();
          renderDetailView('liquidaciones');
        });
      });
      return;
    }

    if (viewKey === 'otros_productos') {
      var inOtros = d.productsInOtros || [];
      var targetCategories = (d.categories || []).filter(function (c) {
        return c.is_active && c.slug !== 'otros';
      });
      var catOptionsHtml = targetCategories.map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
      }).join('');

      if (!inOtros.length) {
        body.innerHTML = banner +
          '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #d9e2e6;display:grid;gap:12px;max-width:760px;">' +
            '<h3 style="margin:0;color:#023C46;">Sin productos pendientes en «Otros»</h3>' +
            '<p style="margin:0;font-size:13px;color:#526570;line-height:1.5;">Cuando algún emprendedor publique un producto seleccionando la categoría <strong>Otros</strong>, aparecerá automáticamente en esta sección para que puedas redescubrir el producto, moverlo a una categoría existente o crear una nueva categoría al instante.</p>' +
            '<div><button type="button" id="fa-go-cats-btn" style="padding:8px 14px;border:none;border-radius:8px;background:#023C46;color:#fff;font-weight:700;cursor:pointer;">Ir a gestionar Categorías →</button></div>' +
          '</div>';
        var goCats = document.getElementById('fa-go-cats-btn');
        if (goCats) {
          goCats.addEventListener('click', function () {
            openFeriarteView('categorias');
          });
        }
        return;
      }

      var cardsHtml = inOtros.map(function (p) {
        var prodUrl = 'https://www.feriarte.com.ar/producto/' + encodeURIComponent(p.slug || '');
        var suggestionBadge = p.suggested_category_note
          ? '<div style="margin-top:8px;padding:8px 12px;border-radius:8px;background:#FFF8EF;border:1px solid #FC4702;font-size:12px;color:#023C46;"><strong>Categoría sugerida por el emprendedor:</strong> ' + esc(p.suggested_category_note) + '</div>'
          : '';
        return (
          '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;display:grid;gap:12px;">' +
            '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:flex-start;">' +
              '<div>' +
                '<div style="font-size:16px;font-weight:900;color:#023C46;">' + esc(p.title) + '</div>' +
                '<div style="font-size:12px;color:#526570;margin-top:2px;">Tienda: <strong>' + esc(p.store_name) + '</strong>' +
                  (p.artisan_name ? ' · ' + esc(p.artisan_name) : '') +
                  (p.locality || p.province ? ' · ' + esc([p.locality, p.province].filter(Boolean).join(', ')) : '') +
                '</div>' +
                '<div style="font-size:12px;color:#023C46;margin-top:4px;"><strong>' + esc(fmtCents(p.price_cents)) + '</strong> · Stock: ' + esc(p.stock_qty) + ' · Estado: ' + esc(p.status) + '</div>' +
              '</div>' +
              '<a href="' + esc(prodUrl) + '" target="_blank" rel="noopener noreferrer" style="padding:6px 12px;border-radius:8px;border:1px solid #023C46;color:#023C46;font-size:12px;font-weight:700;text-decoration:none;">Ver ficha en FeriARTE ↗</a>' +
            '</div>' +
            (p.description ? '<div style="font-size:13px;color:#334e58;line-height:1.45;background:#f8fafb;padding:10px 12px;border-radius:8px;">' + esc(p.description) + (p.materials ? '<br><small style="color:#526570;"><strong>Materiales:</strong> ' + esc(p.materials) + '</small>' : '') + '</div>' : '') +
            suggestionBadge +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;border-top:1px solid #edf2f4;padding-top:12px;">' +
              '<form class="fa-reassign-form" data-prod-id="' + esc(p.id) + '" style="display:grid;gap:8px;background:#f9fbfc;padding:12px;border-radius:10px;border:1px solid #e3ecef;">' +
                '<div style="font-size:12px;font-weight:800;color:#023C46;">Opción 1 · Mover a una categoría existente</div>' +
                '<select name="categoryId" required style="padding:8px;border-radius:8px;border:1px solid #ccc;background:#fff;font-size:13px;">' + catOptionsHtml + '</select>' +
                '<button type="submit" style="padding:8px 12px;border:none;border-radius:8px;background:#069294;color:#fff;font-weight:700;cursor:pointer;font-size:13px;">Reasignar producto</button>' +
              '</form>' +
              '<form class="fa-create-assign-form" data-prod-id="' + esc(p.id) + '" style="display:grid;gap:8px;background:#FFF8EF;padding:12px;border-radius:10px;border:1px solid rgba(252,71,2,0.3);">' +
                '<div style="font-size:12px;font-weight:800;color:#023C46;">Opción 2 · Crear nueva categoría y mover este producto</div>' +
                '<input name="name" required minlength="2" maxlength="80" placeholder="Nombre de la nueva categoría" value="' + esc(p.suggested_category_note || '') + '" style="padding:8px;border-radius:8px;border:1px solid #ccc;font-size:13px;">' +
                '<input name="description" maxlength="300" placeholder="Descripción breve del rubro (opcional)" style="padding:8px;border-radius:8px;border:1px solid #ccc;font-size:13px;">' +
                '<button type="submit" style="padding:8px 12px;border:none;border-radius:8px;background:#FC4702;color:#fff;font-weight:800;cursor:pointer;font-size:13px;">Crear categoría y asignar</button>' +
              '</form>' +
            '</div>' +
          '</div>'
        );
      }).join('');

      body.innerHTML = banner +
        '<div style="display:grid;gap:14px;">' +
          '<div style="background:#FFF8EF;border:1px solid #FC4702;border-radius:12px;padding:14px 16px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;">' +
            '<div style="font-size:13px;color:#023C46;"><strong>' + esc(inOtros.length) + ' producto(s) en «Otros»</strong> pendientes de revisión. Podés ubicarlos en una categoría actual o dar de alta una categoría nueva.</div>' +
            '<button type="button" id="fa-go-cats-btn" style="padding:7px 12px;border:none;border-radius:8px;background:#023C46;color:#fff;font-weight:700;cursor:pointer;font-size:12px;">Ver todas las categorías</button>' +
          '</div>' +
          cardsHtml +
        '</div>';

      var goCatsTop = document.getElementById('fa-go-cats-btn');
      if (goCatsTop) {
        goCatsTop.addEventListener('click', function () {
          openFeriarteView('categorias');
        });
      }

      body.querySelectorAll('.fa-reassign-form').forEach(function (formEl) {
        formEl.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(formEl);
          var res = await apiFeriarte('POST', {
            action: 'recategorize_product',
            productId: formEl.getAttribute('data-prod-id'),
            categoryId: String(fd.get('categoryId') || '')
          });
          STATE.feedback = (res && res.message) || 'Producto reasignado.';
          await reloadData();
          renderDetailView('otros_productos');
        });
      });

      body.querySelectorAll('.fa-create-assign-form').forEach(function (formEl) {
        formEl.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(formEl);
          var res = await apiFeriarte('POST', {
            action: 'create_category',
            name: String(fd.get('name') || ''),
            description: String(fd.get('description') || ''),
            assignProductId: formEl.getAttribute('data-prod-id')
          });
          STATE.feedback = (res && res.message) || 'Categoría creada y asignada.';
          await reloadData();
          renderDetailView('otros_productos');
        });
      });
      return;
    }

    if (viewKey === 'categorias') {
      var cats = d.categories || [];
      var otrosCountCat = (d.productsInOtros || []).length;
      var otrosBannerCat = otrosCountCat > 0
        ? '<div style="background:#FFF8EF;border:1px solid #FC4702;border-radius:12px;padding:14px 16px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;">' +
            '<div style="font-size:13px;color:#023C46;">Hay <strong>' + esc(otrosCountCat) + ' producto(s)</strong> publicados en <strong>«Otros»</strong> esperando revisión para recategorizar o crear nuevas categorías.</div>' +
            '<button type="button" id="fa-open-otros-from-cats" style="padding:8px 14px;border:none;border-radius:8px;background:#FC4702;color:#fff;font-weight:800;cursor:pointer;">Revisar «Productos en Otros» →</button>' +
          '</div>'
        : '';

      var catRows = cats.map(function (c) {
        var isOtros = c.slug === 'otros';
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(c.sort_order) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(c.name) + '</strong><br><small style="color:#526570;"><code>' + esc(c.slug) + '</code>' + (c.description ? ' · ' + esc(c.description) : '') + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;">' + esc(c.products_count || 0) + (isOtros && (c.products_count || 0) > 0 ? ' <span style="color:#FC4702;">(por revisar)</span>' : '') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + (c.is_active ? '<span style="color:#069294;font-weight:700;">Activa</span>' : '<span style="color:#999;">Inactiva</span>') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' +
            '<button type="button" data-cat-toggle="' + esc(c.id) + '" data-cat-next="' + (c.is_active ? '0' : '1') + '" style="padding:5px 10px;border:none;border-radius:6px;background:' + (c.is_active ? '#e2e8f0;color:#023C46' : '#069294;color:#fff') + ';font-weight:700;cursor:pointer;">' +
              (c.is_active ? 'Desactivar' : 'Activar') +
            '</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="display:grid;gap:14px;">' +
          otrosBannerCat +
          '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;">' +
            '<h3 style="margin:0 0 10px;color:#023C46;font-size:15px;">Crear nueva categoría artesanal</h3>' +
            '<form id="fa-new-cat-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;align-items:end;">' +
              '<label style="font-size:12px;font-weight:700;">Nombre *<input name="name" required minlength="2" maxlength="80" placeholder="Ej. Instrumentos Musicales" style="width:100%;padding:8px;margin-top:4px;border:1px solid #ccc;border-radius:8px;"></label>' +
              '<label style="font-size:12px;font-weight:700;">Descripción (opcional)<input name="description" maxlength="300" placeholder="Descripción breve del rubro..." style="width:100%;padding:8px;margin-top:4px;border:1px solid #ccc;border-radius:8px;"></label>' +
              '<button type="submit" style="padding:9px 16px;border:none;border-radius:8px;background:#023C46;color:#fff;font-weight:800;cursor:pointer;">Crear categoría</button>' +
            '</form>' +
          '</div>' +
          '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;overflow:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #eee;">Orden</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #eee;">Categoría</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #eee;">Productos</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #eee;">Estado</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #eee;">Acción</th>' +
            '</tr></thead><tbody>' +
              (catRows || '<tr><td colspan="5" style="padding:12px;">Sin categorías cargadas.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>';

      var openOtrosBtn = document.getElementById('fa-open-otros-from-cats');
      if (openOtrosBtn) {
        openOtrosBtn.addEventListener('click', function () {
          openFeriarteView('otros_productos');
        });
      }

      var newCatForm = document.getElementById('fa-new-cat-form');
      if (newCatForm) {
        newCatForm.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(newCatForm);
          var res = await apiFeriarte('POST', {
            action: 'create_category',
            name: String(fd.get('name') || ''),
            description: String(fd.get('description') || '')
          });
          STATE.feedback = (res && res.message) || 'Categoría creada.';
          await reloadData();
          renderDetailView('categorias');
        });
      }

      body.querySelectorAll('[data-cat-toggle]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var res = await apiFeriarte('POST', {
            action: 'toggle_category_active',
            categoryId: btn.getAttribute('data-cat-toggle'),
            isActive: btn.getAttribute('data-cat-next') === '1'
          });
          STATE.feedback = (res && res.message) || 'Categoría actualizada.';
          await reloadData();
          renderDetailView('categorias');
        });
      });
      return;
    }

    if (viewKey === 'configuracion') {
      var st = (d.settings && d.settings.shipping_tariffs) || {};
      var z = st.zones || {};
      var mult = st.packageMultipliers || {};
      var localArs = Math.round(Number(z.localCents != null ? z.localCents : 450000) / 100);
      var provincialArs = Math.round(Number(z.provincialCents != null ? z.provincialCents : 750000) / 100);
      var nationalArs = Math.round(Number(z.nationalCents != null ? z.nationalCents : 1150000) / 100);
      var fragileArs = Math.round(Number(st.fragileSurchargeCents || 0) / 100);
      var multChico = Number(mult.chico != null ? mult.chico : 1.0);
      var multMediano = Number(mult.mediano != null ? mult.mediano : 1.35);
      var multGrande = Number(mult.grande != null ? mult.grande : 1.8);
      var refProvider = String(st.referenceProvider || 'Correo Argentino / Paq.ar (Referencial)');

      var otherSettingsRows = Object.keys(d.settings || {}).map(function (k) {
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #f0f0f0;font-weight:700;">' + esc(k) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #f0f0f0;font-size:11px;word-break:break-word;">' + esc(JSON.stringify(d.settings[k])) + '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="background:#fff;border-radius:12px;padding:18px;border:1px solid #d9e2e6;margin-bottom:16px;">' +
          '<h3 style="margin:0 0 6px;color:#023C46;">Tarifario Nacional de Envíos FeriARTE</h3>' +
          '<p style="margin:0 0 14px;font-size:12px;color:#556;">' +
            'Define los importes referenciales por zona geográfica y tamaño de paquete cuando un producto usa <strong>Tarifa estándar FeriARTE</strong>. ' +
            'La comisión de la plataforma sobre el envío es siempre <strong>0%</strong> (el 100% del envío va al emprendedor).' +
          '</p>' +
          '<form id="fa-shipping-tariffs-form" style="display:grid;gap:12px;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;">' +
              '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#023C46;">' +
                'Misma localidad (ARS)' +
                '<input name="localArs" type="number" min="0" step="100" required value="' + esc(localArs) + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '</label>' +
              '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#023C46;">' +
                'Misma provincia (ARS)' +
                '<input name="provincialArs" type="number" min="0" step="100" required value="' + esc(provincialArs) + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '</label>' +
              '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#023C46;">' +
                'Otra provincia / Nacional (ARS)' +
                '<input name="nationalArs" type="number" min="0" step="100" required value="' + esc(nationalArs) + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '</label>' +
              '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#023C46;">' +
                'Recargo embalaje frágil (ARS)' +
                '<input name="fragileArs" type="number" min="0" step="100" value="' + esc(fragileArs) + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '</label>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;">' +
              '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#023C46;">' +
                'Mult. Paquete Chico (&le; 1 kg)' +
                '<input name="multChico" type="number" min="0.5" max="5" step="0.05" required value="' + esc(multChico) + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '</label>' +
              '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#023C46;">' +
                'Mult. Paquete Mediano (1-5 kg)' +
                '<input name="multMediano" type="number" min="0.5" max="5" step="0.05" required value="' + esc(multMediano) + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '</label>' +
              '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#023C46;">' +
                'Mult. Paquete Grande (&gt; 5 kg)' +
                '<input name="multGrande" type="number" min="0.5" max="5" step="0.05" required value="' + esc(multGrande) + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '</label>' +
              '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#023C46;">' +
                'Referencia tarifaria' +
                '<input name="referenceProvider" type="text" maxlength="120" value="' + esc(refProvider) + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '</label>' +
            '</div>' +
            '<div>' +
              '<button type="submit" style="background:#023C46;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer;">Guardar Tarifario de Envíos</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
        '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;overflow:auto;">' +
          '<h4 style="margin:0 0 10px;color:#023C46;">Todas las claves de configuración (fa_platform_settings)</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #eee;">Clave</th>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #eee;">Valor JSON</th>' +
          '</tr></thead><tbody>' + (otherSettingsRows || '<tr><td colspan="2" style="padding:10px;">Sin claves registradas.</td></tr>') + '</tbody></table>' +
        '</div>';

      var shipForm = document.getElementById('fa-shipping-tariffs-form');
      if (shipForm) {
        shipForm.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(shipForm);
          var res = await apiFeriarte('POST', {
            action: 'save_shipping_tariffs',
            localArs: Number(fd.get('localArs') || 0),
            provincialArs: Number(fd.get('provincialArs') || 0),
            nationalArs: Number(fd.get('nationalArs') || 0),
            fragileArs: Number(fd.get('fragileArs') || 0),
            multChico: Number(fd.get('multChico') || 1),
            multMediano: Number(fd.get('multMediano') || 1.35),
            multGrande: Number(fd.get('multGrande') || 1.8),
            referenceProvider: String(fd.get('referenceProvider') || '')
          });
          STATE.feedback = (res && res.message) || 'Tarifario actualizado.';
          await reloadData();
          renderDetailView('configuracion');
        });
      }
      return;
    }

    if (viewKey === 'usuarios' || viewKey === 'feriantes') {
      var isEmpView = viewKey === 'feriantes';
      var allUsers = isEmpView
        ? (d.users || []).filter(function (u) {
            return (u.roles || []).some(function (r) { return r.role === 'feriante'; });
          })
        : (d.users || []);

      var fmtDate = function (iso) {
        if (!iso) return '—';
        try {
          return new Date(iso).toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (_e) {
          return String(iso);
        }
      };

      var roleLabel = function (r) {
        if (r === 'caminante') return 'Caminante / Cliente';
        if (r === 'feriante') return 'Emprendedor';
        if (r === 'organizador') return 'Organizador';
        return String(r || '');
      };

      var statusLabel = function (s) {
        if (s === 'active') return 'Activo';
        if (s === 'suspended') return 'Suspendido';
        if (s === 'disabled') return 'Deshabilitado';
        return String(s || '—');
      };

      var openUserFichaModal = function (userObj) {
        if (!userObj) return;
        var prevModal = document.getElementById('fa-user-ficha-modal');
        if (prevModal) prevModal.remove();

        var rolesText = (userObj.roles || []).length
          ? userObj.roles.map(function (r) {
              var st = r.status === 'active' ? '' : ' (' + r.status + ')';
              return roleLabel(r.role) + st;
            }).join(' · ')
          : roleLabel(userObj.active_profile);

        var authMethods = [];
        var hasGoogle = (userObj.identities || []).some(function (i) { return i.provider === 'google'; });
        if (hasGoogle) authMethods.push('Google');
        if (userObj.has_password) authMethods.push('Correo y contraseña');
        if (!authMethods.length) authMethods.push('Registración Web');

        var addr = userObj.shipping_address && typeof userObj.shipping_address === 'object'
          ? userObj.shipping_address
          : {};
        var hasPostal = Boolean(addr.street && addr.locality && addr.province);
        var postalBlock = hasPostal
          ? (
              '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;font-size:12px;">' +
                '<div><strong>Calle y número:</strong> ' + esc(addr.street) + ' ' + esc(addr.noNumber ? 'S/N' : (addr.number || '')) + '</div>' +
                (addr.floor ? '<div><strong>Piso:</strong> ' + esc(addr.floor) + '</div>' : '') +
                (addr.apartment ? '<div><strong>Dpto:</strong> ' + esc(addr.apartment) + '</div>' : '') +
                (addr.building ? '<div><strong>Edificio:</strong> ' + esc(addr.building) + '</div>' : '') +
                (addr.tower ? '<div><strong>Torre:</strong> ' + esc(addr.tower) + '</div>' : '') +
                '<div><strong>Código Postal:</strong> ' + esc(addr.postalCode || '—') + '</div>' +
                '<div><strong>Localidad:</strong> ' + esc(addr.locality || '—') + '</div>' +
                '<div><strong>Provincia:</strong> ' + esc(addr.province || '—') + '</div>' +
              '</div>'
            )
          : '<div style="font-size:12px;color:#64748b;">Aún no cargó domicilio de envío en Mi Perfil.</div>';

        var storesList = (userObj.stores || []).length
          ? userObj.stores.map(function (st) {
              var loc = [st.locality, st.province].filter(Boolean).join(', ');
              return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;margin-top:6px;font-size:12px;">' +
                '<div><strong>' + esc(st.name) + '</strong>' + (loc ? ' · <span style="color:#64748b;">' + esc(loc) + '</span>' : '') + '</div>' +
                '<a href="https://feriarte.vercel.app/tienda/' + encodeURIComponent(st.slug) + '" target="_blank" rel="noopener" style="color:#069294;font-weight:700;text-decoration:none;">Ver tienda ↗</a>' +
              '</div>';
            }).join('')
          : '<div style="font-size:12px;color:#64748b;">Sin tienda creada.</div>';

        var orgBlock = userObj.organizer_profile
          ? '<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;">' +
              '<strong>Organizador:</strong> ' + esc(userObj.organizer_profile.organization_name) +
              ' · Estado: <strong>' + esc(userObj.organizer_profile.approval_status) + '</strong>' +
              (userObj.organizer_profile.cuit_cuil ? ' · CUIT/CUIL: ' + esc(userObj.organizer_profile.cuit_cuil) : '') +
            '</div>'
          : '';

        var overlay = document.createElement('div');
        overlay.id = 'fa-user-ficha-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(2,60,70,0.62);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;';
        overlay.innerHTML =
          '<div style="background:#fff;border-radius:16px;max-width:640px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,0.28);border:1px solid #d9e2e6;">' +
            '<div style="background:#023C46;color:#fff;padding:18px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-radius:16px 16px 0 0;">' +
              '<div>' +
                '<div style="font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#56D7A1;">Ficha de Registración Web · FeriARTE</div>' +
                '<h3 style="margin:4px 0 2px;font-size:19px;font-weight:900;color:#fff;">' + esc(userObj.full_name || 'Sin nombre') + '</h3>' +
                '<div style="font-size:13px;color:rgba(255,255,255,0.88);">' + esc(userObj.email || '—') + '</div>' +
              '</div>' +
              '<button type="button" id="fa-ficha-close-x" aria-label="Cerrar ficha" style="background:rgba(255,255,255,0.14);color:#fff;border:none;border-radius:8px;width:32px;height:32px;font-size:18px;font-weight:700;cursor:pointer;line-height:1;">&times;</button>' +
            '</div>' +
            '<div style="padding:18px 20px;display:grid;gap:14px;color:#023C46;">' +
              '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
                '<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:' + (userObj.status === 'active' ? '#dcfce7;color:#166534;' : '#fee2e2;color:#991b1b;') + '">Estado: ' + esc(statusLabel(userObj.status)) + '</span>' +
                '<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:' + (userObj.email_verified_at ? '#e0f2fe;color:#075985;' : '#fef3c7;color:#92400e;') + '">' + (userObj.email_verified_at ? 'Correo verificado' : 'Correo pendiente de verificación') + '</span>' +
                '<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:#f1f5f9;color:#023C46;">Acceso: ' + esc(authMethods.join(' + ')) + '</span>' +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">' +
                '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#069294;margin-bottom:8px;">Datos de cuenta y contacto</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;font-size:12.5px;">' +
                  '<div><strong>Perfiles habilitados:</strong><br>' + esc(rolesText) + '</div>' +
                  '<div><strong>Perfil activo:</strong><br>' + esc(roleLabel(userObj.active_profile)) + '</div>' +
                  '<div><strong>WhatsApp / Teléfono:</strong><br>' + esc(userObj.phone || 'No informado') + '</div>' +
                  '<div><strong>Ubicación perfil:</strong><br>' + esc([userObj.locality, userObj.province].filter(Boolean).join(', ') || 'No informada') + '</div>' +
                  '<div><strong>Fecha de registro:</strong><br>' + esc(fmtDate(userObj.created_at)) + '</div>' +
                  '<div><strong>Último ingreso:</strong><br>' + esc(fmtDate(userObj.last_login_at)) + '</div>' +
                  '<div><strong>Términos y privacidad:</strong><br>' + (userObj.terms_accepted_at ? 'Aceptados (' + esc(fmtDate(userObj.terms_accepted_at)) + ')' : 'Sin fecha registrada') + '</div>' +
                  '<div><strong>Compras realizadas:</strong><br>' + esc(userObj.orders_count || 0) + ' pedido(s)</div>' +
                '</div>' +
              '</div>' +
              '<div style="background:#FFF8EF;border:1px solid #f2dfc4;border-radius:12px;padding:14px;">' +
                '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#FC4702;margin-bottom:8px;">Domicilio postal de envío (Mi Perfil)</div>' +
                postalBlock +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">' +
                '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#023C46;margin-bottom:6px;">Tiendas y actividad</div>' +
                storesList +
                orgBlock +
              '</div>' +
              '<div style="display:flex;justify-content:flex-end;padding-top:4px;">' +
                '<button type="button" id="fa-ficha-close-btn" style="background:#023C46;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;">Cerrar ficha</button>' +
              '</div>' +
            '</div>' +
          '</div>';

        var closeModal = function () {
          overlay.remove();
          document.removeEventListener('keydown', onEsc);
        };
        var onEsc = function (e) {
          if (e.key === 'Escape') closeModal();
        };
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay) closeModal();
        });
        overlay.querySelector('#fa-ficha-close-x').addEventListener('click', closeModal);
        overlay.querySelector('#fa-ficha-close-btn').addEventListener('click', closeModal);
        document.addEventListener('keydown', onEsc);
        document.body.appendChild(overlay);
      };

      var renderUsersTable = function (queryStr) {
        var q = String(queryStr || '').trim().toLowerCase();
        var filtered = q
          ? allUsers.filter(function (u) {
              return String(u.full_name || '').toLowerCase().indexOf(q) !== -1 ||
                String(u.email || '').toLowerCase().indexOf(q) !== -1;
            })
          : allUsers;

        var tbody = document.getElementById('fa-users-tbody');
        var countEl = document.getElementById('fa-users-count');
        if (countEl) countEl.textContent = filtered.length + ' registro(s)';
        if (!tbody) return;

        if (!filtered.length) {
          tbody.innerHTML = '<tr><td colspan="3" style="padding:14px;color:#64748b;">No se encontraron registros.</td></tr>';
          return;
        }

        tbody.innerHTML = filtered.map(function (u) {
          return '<tr data-fa-user-id="' + esc(u.id) + '" style="cursor:pointer;">' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:700;color:#023C46;">' + esc(u.full_name || 'Sin nombre') + '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#334155;">' + esc(u.email || '—') + '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;">' +
              '<button type="button" data-fa-open-ficha="' + esc(u.id) + '" style="background:#069294;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">Ver ficha</button>' +
            '</td>' +
          '</tr>';
        }).join('');

        tbody.querySelectorAll('[data-fa-user-id]').forEach(function (tr) {
          tr.addEventListener('click', function () {
            var uid = tr.getAttribute('data-fa-user-id');
            var found = allUsers.find(function (x) { return x.id === uid; });
            openUserFichaModal(found);
          });
        });
      };

      body.innerHTML = banner +
        '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;">' +
          '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
            '<input id="fa-users-search" type="search" placeholder="Buscar por nombre o correo..." style="flex:1;min-width:220px;max-width:380px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">' +
            '<span id="fa-users-count" style="font-size:12px;font-weight:700;color:#64748b;">' + esc(allUsers.length) + ' registro(s)</span>' +
          '</div>' +
          '<div style="overflow:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr>' +
              '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">' + (isEmpView ? 'Emprendedor' : 'Cliente') + '</th>' +
              '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Correo electrónico</th>' +
              '<th style="text-align:right;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Ficha</th>' +
            '</tr></thead><tbody id="fa-users-tbody"></tbody></table>' +
          '</div>' +
        '</div>';

      renderUsersTable('');
      var searchInput = document.getElementById('fa-users-search');
      if (searchInput) {
        searchInput.addEventListener('input', function () {
          renderUsersTable(searchInput.value);
        });
      }
      return;
    }

    if (viewKey === 'productos') {
      var pa = STATE.productsAdmin;

      var fmtProdDate = function (iso) {
        if (!iso) return '—';
        try {
          var dt = new Date(iso);
          if (isNaN(dt.getTime())) return String(iso);
          var parts = new Intl.DateTimeFormat('es-AR', {
            timeZone: 'America/Argentina/Cordoba',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).formatToParts(dt);
          var map = {};
          parts.forEach(function (pt) { map[pt.type] = pt.value; });
          return (map.day || '01') + '/' + (map.month || '01') + '/' + (map.year || '') + ' ' + (map.hour || '00') + ':' + (map.minute || '00');
        } catch (_e) {
          return String(iso);
        }
      };

      var prodStatusMeta = function (s) {
        if (s === 'published') return { label: 'Publicado', bg: '#dcfce7', color: '#166534' };
        if (s === 'draft') return { label: 'Borrador', bg: '#f1f5f9', color: '#475569' };
        if (s === 'paused') return { label: 'Pausado', bg: '#fef3c7', color: '#92400e' };
        if (s === 'sold_out') return { label: 'Agotado', bg: '#ffedd5', color: '#9a3412' };
        if (s === 'archived') return { label: 'Archivado', bg: '#e2e8f0', color: '#475569' };
        return { label: String(s || '—'), bg: '#f1f5f9', color: '#334155' };
      };

      var prodModMeta = function (m) {
        if (m === 'approved') return { label: 'Aprobado', bg: '#e0f2fe', color: '#075985' };
        if (m === 'pending_review') return { label: 'Pendiente revisión', bg: '#fef9c3', color: '#854d0e' };
        if (m === 'flagged') return { label: 'Marcado', bg: '#ffedd5', color: '#c2410c' };
        if (m === 'rejected') return { label: 'Rechazado', bg: '#fee2e2', color: '#991b1b' };
        return { label: String(m || '—'), bg: '#f1f5f9', color: '#334155' };
      };

      var craftTypeLabel = function (ct) {
        if (ct === 'unico') return 'Pieza única';
        if (ct === 'reproducible') return 'Reproducible artesanalmente';
        if (ct === 'personalizado') return 'Personalizado';
        if (ct === 'a_pedido') return 'A pedido';
        if (ct === 'edicion_limitada') return 'Edición limitada';
        return String(ct || '—');
      };

      var availabilityLabel = function (mode, days, stockQty) {
        if (mode === 'bajo_pedido') {
          var dNum = Number(days || 0);
          return 'Bajo pedido' + (dNum > 0 ? ' · ' + dNum + ' día(s) de elaboración' : '');
        }
        return 'Entrega inmediata · Stock: ' + Number(stockQty || 0) + ' u.';
      };

      var shippingModeLabel = function (sm) {
        if (sm === 'tarifa_plataforma') return 'Tarifa estándar FeriARTE';
        if (sm === 'gratis') return 'Envío gratis';
        if (sm === 'fija_vendedor') return 'Tarifa fija del emprendedor';
        if (sm === 'a_convenir') return 'A convenir';
        return String(sm || '—');
      };

      var badgeHtml = function (metaObj) {
        return '<span style="display:inline-block;font-size:11px;font-weight:800;padding:3px 8px;border-radius:999px;background:' + metaObj.bg + ';color:' + metaObj.color + ';white-space:nowrap;">' + esc(metaObj.label) + '</span>';
      };

      var buildPageNumbers = function (cur, totalP) {
        if (totalP <= 7) {
          var all = [];
          for (var i = 1; i <= totalP; i++) all.push(i);
          return all;
        }
        var pages = [1];
        var start = Math.max(2, cur - 1);
        var end = Math.min(totalP - 1, cur + 1);
        if (start > 2) pages.push('...');
        for (var p = start; p <= end; p++) pages.push(p);
        if (end < totalP - 1) pages.push('...');
        pages.push(totalP);
        return pages;
      };

      var openProductFichaModal = async function (productId) {
        if (!productId) return;
        var prevModal = document.getElementById('fa-product-ficha-modal');
        if (prevModal) prevModal.remove();

        var overlay = document.createElement('div');
        overlay.id = 'fa-product-ficha-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(2,60,70,0.62);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;';
        overlay.innerHTML =
          '<div style="background:#fff;border-radius:16px;max-width:860px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);border:1px solid #d9e2e6;">' +
            '<div style="background:#023C46;color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-radius:16px 16px 0 0;">' +
              '<div style="font-size:15px;font-weight:800;">Cargando ficha completa del producto...</div>' +
              '<button type="button" id="fa-pf-close-x" aria-label="Cerrar ficha" style="background:rgba(255,255,255,0.14);color:#fff;border:none;border-radius:8px;width:32px;height:32px;font-size:18px;font-weight:700;cursor:pointer;line-height:1;">&times;</button>' +
            '</div>' +
            '<div id="fa-pf-content" style="padding:24px;color:#526570;font-size:13px;">Consultando datos completos y galería en PostgreSQL...</div>' +
          '</div>';

        var closeModal = function () {
          overlay.remove();
          document.removeEventListener('keydown', onEsc);
        };
        var onEsc = function (e) {
          if (e.key === 'Escape') closeModal();
        };
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay) closeModal();
        });
        overlay.querySelector('#fa-pf-close-x').addEventListener('click', closeModal);
        document.addEventListener('keydown', onEsc);
        document.body.appendChild(overlay);

        var renderModalBody = function (prod, feedbackMsg, isErr) {
          var dialogBox = overlay.firstElementChild;
          if (!dialogBox) return;

          var mediaList = Array.isArray(prod.media) ? prod.media : [];
          var mainImgUrl = mediaList.length ? mediaList[0].url : '';
          var st = prod.store || {};
          var cat = prod.category || {};
          var publicUrl = 'https://www.feriarte.com.ar/producto/' + encodeURIComponent(prod.slug || '');
          var storeUrl = st.slug ? 'https://www.feriarte.com.ar/tienda/' + encodeURIComponent(st.slug) : '';
          var sMeta = prodStatusMeta(prod.status);
          var mMeta = prodModMeta(prod.moderation_status);

          var galleryHtml = mediaList.length
            ? (
                '<div style="display:grid;gap:10px;">' +
                  '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;height:280px;">' +
                    '<img id="fa-pf-main-img" src="' + esc(mainImgUrl) + '" alt="' + esc(prod.title) + '" style="max-width:100%;max-height:100%;object-fit:contain;display:block;">' +
                  '</div>' +
                  (mediaList.length > 1
                    ? '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">' +
                        mediaList.map(function (m, idx) {
                          return '<button type="button" class="fa-pf-thumb" data-url="' + esc(m.url) + '" style="padding:0;border:2px solid ' + (idx === 0 ? '#069294' : '#e2e8f0') + ';border-radius:8px;overflow:hidden;width:62px;height:62px;flex:0 0 auto;background:#fff;cursor:pointer;">' +
                            '<img src="' + esc(m.url) + '" alt="' + esc(m.alt_text || prod.title) + '" style="width:100%;height:100%;object-fit:cover;display:block;">' +
                          '</button>';
                        }).join('') +
                      '</div>'
                    : '') +
                '</div>'
              )
            : '<div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;height:200px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:13px;font-weight:700;">Sin fotos cargadas</div>';

          var modalFeedback = feedbackMsg
            ? '<div style="padding:10px 12px;border-radius:10px;font-size:12.5px;font-weight:700;background:' + (isErr ? '#fee2e2;color:#991b1b;border:1px solid #fecaca;' : '#e6f7f2;color:#023C46;border:1px solid #a7f3d0;') + '">' + esc(feedbackMsg) + '</div>'
            : '';

          dialogBox.innerHTML =
            '<div style="background:#023C46;color:#fff;padding:18px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-radius:16px 16px 0 0;">' +
              '<div style="min-width:0;">' +
                '<div style="font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#56D7A1;">Ficha de Producto · FeriARTE' + (cat.name ? ' · ' + esc(cat.name) : '') + '</div>' +
                '<h3 style="margin:4px 0 4px;font-size:20px;font-weight:900;color:#fff;line-height:1.25;">' + esc(prod.title || 'Sin título') + '</h3>' +
                '<div style="font-size:12.5px;color:rgba(255,255,255,0.88);">' +
                  esc(st.name || 'Sin tienda') +
                  (st.artisan_name ? ' · Artesano/a: ' + esc(st.artisan_name) : '') +
                  ' · Alta: ' + esc(fmtProdDate(prod.created_at)) +
                '</div>' +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">' +
                '<a href="' + esc(publicUrl) + '" target="_blank" rel="noopener noreferrer" style="padding:7px 12px;border-radius:8px;background:#FC4702;color:#fff;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap;">Ver en FeriARTE ↗</a>' +
                '<button type="button" id="fa-pf-close-x" aria-label="Cerrar ficha" style="background:rgba(255,255,255,0.14);color:#fff;border:none;border-radius:8px;width:32px;height:32px;font-size:18px;font-weight:700;cursor:pointer;line-height:1;">&times;</button>' +
              '</div>' +
            '</div>' +
            '<div style="padding:18px 20px;display:grid;gap:16px;color:#023C46;">' +
              modalFeedback +
              '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
                badgeHtml(sMeta) +
                badgeHtml(mMeta) +
                (prod.is_featured ? '<span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:#fef3c7;color:#92400e;">★ Destacado</span>' : '') +
                (prod.sku ? '<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:#f1f5f9;color:#475569;">SKU: ' + esc(prod.sku) + '</span>' : '') +
                '<span style="font-size:11px;color:#64748b;margin-left:auto;">Slug: <code>' + esc(prod.slug || '—') + '</code></span>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;align-items:start;">' +
                galleryHtml +
                '<div style="display:grid;gap:12px;">' +
                  '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;display:grid;gap:8px;">' +
                    '<div style="font-size:24px;font-weight:900;color:#023C46;">' + esc(fmtCents(prod.price_cents)) + '</div>' +
                    '<div style="font-size:12.5px;color:#334155;"><strong>Disponibilidad:</strong> ' + esc(availabilityLabel(prod.availability_mode, prod.production_days, prod.stock_qty)) + '</div>' +
                    '<div style="font-size:12.5px;color:#334155;"><strong>Tipo de obra:</strong> ' + esc(craftTypeLabel(prod.craft_type)) + '</div>' +
                    '<div style="font-size:12.5px;color:#334155;"><strong>Envío:</strong> ' + esc(shippingModeLabel(prod.shipping_mode)) + (prod.package_size ? ' · Paquete ' + esc(prod.package_size) : '') + (prod.fragile_packaging ? ' · Frágil' : '') + '</div>' +
                  '</div>' +
                  '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;display:grid;gap:6px;font-size:12.5px;">' +
                    '<div style="font-size:11.5px;font-weight:900;text-transform:uppercase;color:#069294;">Detalles técnicos</div>' +
                    '<div><strong>Materiales:</strong> ' + esc(prod.materials || 'No especificados') + '</div>' +
                    '<div><strong>Dimensiones:</strong> ' + esc(prod.dimensions_cm || 'No especificadas') + (prod.weight_grams ? ' · Peso: ' + esc(prod.weight_grams) + ' g' : '') + '</div>' +
                    '<div><strong>Categoría:</strong> ' + esc(cat.name || 'Sin categoría') + (prod.suggested_category_note ? ' · <em>Sugerida: ' + esc(prod.suggested_category_note) + '</em>' : '') + '</div>' +
                    (prod.video_url ? '<div><strong>Video:</strong> <a href="' + esc(prod.video_url) + '" target="_blank" rel="noopener noreferrer" style="color:#069294;font-weight:700;">Ver enlace ↗</a></div>' : '') +
                  '</div>' +
                  '<div style="background:#FFF8EF;border:1px solid #f2dfc4;border-radius:12px;padding:14px;display:grid;gap:6px;font-size:12.5px;">' +
                    '<div style="font-size:11.5px;font-weight:900;text-transform:uppercase;color:#FC4702;">Emprendedor / Tienda</div>' +
                    '<div><strong>' + esc(st.name || 'Sin tienda') + '</strong>' + (st.verified_artisan_badge ? ' <span style="font-size:11px;color:#069294;font-weight:800;">✓ Verificado</span>' : '') + '</div>' +
                    '<div><strong>Artesano/a:</strong> ' + esc(st.artisan_name || '—') + '</div>' +
                    '<div><strong>Ubicación:</strong> ' + esc([st.locality, st.province].filter(Boolean).join(', ') || 'No informada') + ' · <strong>Estado tienda:</strong> ' + esc(st.status || '—') + '</div>' +
                    (storeUrl ? '<div style="margin-top:2px;"><a href="' + esc(storeUrl) + '" target="_blank" rel="noopener noreferrer" style="color:#069294;font-weight:700;text-decoration:none;">Abrir tienda en FeriARTE ↗</a></div>' : '') +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">' +
                '<div style="font-size:11.5px;font-weight:900;text-transform:uppercase;color:#023C46;margin-bottom:6px;">Descripción completa</div>' +
                '<div style="font-size:13px;color:#1e293b;line-height:1.55;white-space:pre-wrap;word-break:break-word;">' + esc(prod.description || 'Sin descripción cargada.') + '</div>' +
              '</div>' +
              '<div style="background:#fff;border:1.5px solid #cbd5e1;border-radius:12px;padding:14px;display:grid;gap:12px;">' +
                '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">' +
                  '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#023C46;">Moderación y Estado del Artículo</div>' +
                  '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
                    '<button type="button" class="fa-pf-quick" data-q-status="published" data-q-mod="approved" style="padding:5px 10px;border:none;border-radius:7px;background:#069294;color:#fff;font-size:11.5px;font-weight:800;cursor:pointer;">✓ Aprobar y publicar</button>' +
                    '<button type="button" class="fa-pf-quick" data-q-status="paused" data-q-mod="" style="padding:5px 10px;border:none;border-radius:7px;background:#f59e0b;color:#fff;font-size:11.5px;font-weight:800;cursor:pointer;">⏸ Pausar</button>' +
                    '<button type="button" class="fa-pf-quick" data-q-status="" data-q-mod="flagged" style="padding:5px 10px;border:none;border-radius:7px;background:#ea580c;color:#fff;font-size:11.5px;font-weight:800;cursor:pointer;">⚑ Marcar revisión</button>' +
                    '<button type="button" class="fa-pf-quick" data-q-status="paused" data-q-mod="rejected" style="padding:5px 10px;border:none;border-radius:7px;background:#dc2626;color:#fff;font-size:11.5px;font-weight:800;cursor:pointer;">✕ Rechazar</button>' +
                  '</div>' +
                '</div>' +
                '<form id="fa-pf-mod-form" style="display:grid;gap:10px;">' +
                  '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">' +
                    '<label style="display:grid;gap:4px;font-size:12px;font-weight:700;">Estado de publicación' +
                      '<select name="status" style="padding:8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:13px;">' +
                        '<option value="published"' + (prod.status === 'published' ? ' selected' : '') + '>Publicado</option>' +
                        '<option value="draft"' + (prod.status === 'draft' ? ' selected' : '') + '>Borrador</option>' +
                        '<option value="paused"' + (prod.status === 'paused' ? ' selected' : '') + '>Pausado</option>' +
                        '<option value="sold_out"' + (prod.status === 'sold_out' ? ' selected' : '') + '>Agotado</option>' +
                        '<option value="archived"' + (prod.status === 'archived' ? ' selected' : '') + '>Archivado</option>' +
                      '</select>' +
                    '</label>' +
                    '<label style="display:grid;gap:4px;font-size:12px;font-weight:700;">Estado de moderación' +
                      '<select name="moderationStatus" style="padding:8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:13px;">' +
                        '<option value="approved"' + (prod.moderation_status === 'approved' ? ' selected' : '') + '>Aprobado</option>' +
                        '<option value="pending_review"' + (prod.moderation_status === 'pending_review' ? ' selected' : '') + '>Pendiente de revisión</option>' +
                        '<option value="flagged"' + (prod.moderation_status === 'flagged' ? ' selected' : '') + '>Marcado</option>' +
                        '<option value="rejected"' + (prod.moderation_status === 'rejected' ? ' selected' : '') + '>Rechazado</option>' +
                      '</select>' +
                    '</label>' +
                  '</div>' +
                  '<label style="display:grid;gap:4px;font-size:12px;font-weight:700;">Nota de moderación (opcional)' +
                    '<textarea name="moderationNote" rows="2" maxlength="500" placeholder="Motivo de pausa, observación o nota administrativa..." style="padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:12.5px;resize:vertical;">' + esc(prod.moderation_note || '') + '</textarea>' +
                  '</label>' +
                  '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding-top:4px;">' +
                    '<button type="submit" id="fa-pf-save-btn" style="background:#023C46;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-weight:800;font-size:13px;cursor:pointer;">Guardar estado y moderación</button>' +
                    '<button type="button" id="fa-pf-close-btn" style="background:#e2e8f0;color:#023C46;border:none;border-radius:8px;padding:9px 16px;font-weight:700;font-size:13px;cursor:pointer;">Cerrar ficha</button>' +
                  '</div>' +
                '</form>' +
              '</div>' +
            '</div>';

          dialogBox.querySelector('#fa-pf-close-x').addEventListener('click', closeModal);
          dialogBox.querySelector('#fa-pf-close-btn').addEventListener('click', closeModal);

          dialogBox.querySelectorAll('.fa-pf-thumb').forEach(function (thumbBtn) {
            thumbBtn.addEventListener('click', function () {
              var mainImg = dialogBox.querySelector('#fa-pf-main-img');
              if (mainImg) mainImg.src = thumbBtn.getAttribute('data-url') || '';
              dialogBox.querySelectorAll('.fa-pf-thumb').forEach(function (b) {
                b.style.borderColor = b === thumbBtn ? '#069294' : '#e2e8f0';
              });
            });
          });

          var saveModeration = async function (nextStatus, nextMod, nextNote) {
            var saveBtn = dialogBox.querySelector('#fa-pf-save-btn');
            if (saveBtn) {
              saveBtn.disabled = true;
              saveBtn.textContent = 'Guardando...';
            }
            try {
              var modRes = await apiFeriarte('POST', {
                action: 'moderate_product',
                productId: prod.id,
                status: nextStatus,
                moderationStatus: nextMod,
                moderationNote: nextNote
              });
              if (modRes && modRes.ok) {
                prod.status = (modRes.product && modRes.product.status) || nextStatus;
                prod.moderation_status = (modRes.product && modRes.product.moderation_status) || nextMod;
                prod.moderation_note = modRes.product ? modRes.product.moderation_note : nextNote;
                renderModalBody(prod, modRes.message || 'Producto actualizado.', false);
                fetchProductsPage(false);
              } else {
                renderModalBody(prod, (modRes && modRes.message) || 'No se pudo actualizar el producto.', true);
              }
            } catch (_err) {
              renderModalBody(prod, 'Error de red al guardar cambios.', true);
            }
          };

          var modForm = dialogBox.querySelector('#fa-pf-mod-form');
          if (modForm) {
            modForm.addEventListener('submit', function (ev) {
              ev.preventDefault();
              var fd = new FormData(modForm);
              saveModeration(
                String(fd.get('status') || prod.status),
                String(fd.get('moderationStatus') || prod.moderation_status),
                String(fd.get('moderationNote') || '')
              );
            });
          }

          dialogBox.querySelectorAll('.fa-pf-quick').forEach(function (qBtn) {
            qBtn.addEventListener('click', function () {
              var qs = qBtn.getAttribute('data-q-status') || prod.status;
              var qm = qBtn.getAttribute('data-q-mod') || prod.moderation_status;
              var noteField = modForm ? modForm.querySelector('[name="moderationNote"]') : null;
              saveModeration(qs, qm, noteField ? noteField.value : (prod.moderation_note || ''));
            });
          });
        };

        try {
          var detailRes = await apiFeriarte('GET', null, { mode: 'product_detail', productId: productId });
          if (detailRes && detailRes.ok && detailRes.product) {
            renderModalBody(detailRes.product, '', false);
          } else {
            var contentEl = overlay.querySelector('#fa-pf-content');
            if (contentEl) {
              contentEl.innerHTML = '<div style="color:#991b1b;font-weight:700;">' + esc((detailRes && detailRes.message) || 'No se pudo cargar la ficha del producto.') + '</div>';
            }
          }
        } catch (_e) {
          var contentErr = overlay.querySelector('#fa-pf-content');
          if (contentErr) {
            contentErr.innerHTML = '<div style="color:#991b1b;font-weight:700;">Error de conexión al consultar la ficha del producto.</div>';
          }
        }
      };

      var renderProductsTableContent = function () {
        var wrap = document.getElementById('fa-prods-table-wrap');
        var topSummary = document.getElementById('fa-prods-summary-top');
        var topPag = document.getElementById('fa-prods-pag-top');
        var botPag = document.getElementById('fa-prods-pag-bottom');
        if (!wrap) return;

        if (pa.loading) {
          wrap.innerHTML = '<div style="padding:28px;text-align:center;color:#526570;font-size:13px;font-weight:700;">Cargando listado de productos...</div>';
          if (topSummary) topSummary.textContent = 'Consultando servidor...';
          return;
        }
        if (pa.error) {
          wrap.innerHTML = '<div style="padding:18px;color:#991b1b;background:#fef2f2;border-radius:10px;font-size:13px;font-weight:700;">' + esc(pa.error) + '</div>';
          return;
        }

        var items = pa.items || [];
        var total = Number(pa.total || 0);
        var page = Number(pa.page || 1);
        var pageSize = Number(pa.pageSize || 25);
        var totalPages = Math.max(1, Number(pa.totalPages || 1));
        var fromNum = total === 0 ? 0 : (page - 1) * pageSize + 1;
        var toNum = Math.min(total, (page - 1) * pageSize + items.length);

        if (topSummary) {
          topSummary.innerHTML = total === 0
            ? 'Sin productos para los filtros seleccionados'
            : 'Mostrando <strong>' + esc(fromNum) + '–' + esc(toNum) + '</strong> de <strong>' + esc(total.toLocaleString('es-AR')) + '</strong> producto(s) · Página <strong>' + esc(page) + '</strong> de <strong>' + esc(totalPages) + '</strong>';
        }

        var renderPagHtml = function () {
          if (total === 0) return '';
          var nums = buildPageNumbers(page, totalPages);
          var btnStyle = function (active, disabled) {
            return 'padding:5px 10px;border-radius:7px;font-size:12px;font-weight:700;border:1px solid ' +
              (active ? '#023C46' : '#cbd5e1') + ';background:' +
              (active ? '#023C46' : '#fff') + ';color:' +
              (active ? '#fff' : (disabled ? '#94a3b8' : '#023C46')) + ';cursor:' +
              (disabled ? 'not-allowed' : 'pointer') + ';opacity:' + (disabled ? '0.6' : '1') + ';';
          };
          return (
            '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:5px;">' +
              '<button type="button" data-fa-page="1" ' + (page <= 1 ? 'disabled' : '') + ' style="' + btnStyle(false, page <= 1) + '">«</button>' +
              '<button type="button" data-fa-page="' + (page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + ' style="' + btnStyle(false, page <= 1) + '">‹ Anterior</button>' +
              nums.map(function (n) {
                if (n === '...') return '<span style="padding:0 4px;color:#64748b;font-size:12px;">…</span>';
                return '<button type="button" data-fa-page="' + n + '" style="' + btnStyle(n === page, false) + '">' + n + '</button>';
              }).join('') +
              '<button type="button" data-fa-page="' + (page + 1) + '" ' + (page >= totalPages ? 'disabled' : '') + ' style="' + btnStyle(false, page >= totalPages) + '">Siguiente ›</button>' +
              '<button type="button" data-fa-page="' + totalPages + '" ' + (page >= totalPages ? 'disabled' : '') + ' style="' + btnStyle(false, page >= totalPages) + '">»</button>' +
            '</div>'
          );
        };

        var pagHtml = renderPagHtml();
        if (topPag) topPag.innerHTML = pagHtml;
        if (botPag) botPag.innerHTML = pagHtml;

        var bindPag = function (container) {
          if (!container) return;
          container.querySelectorAll('[data-fa-page]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              if (btn.disabled) return;
              var nextP = parseInt(btn.getAttribute('data-fa-page') || '1', 10);
              if (Number.isFinite(nextP) && nextP >= 1 && nextP !== pa.page) {
                pa.page = nextP;
                fetchProductsPage(false);
              }
            });
          });
        };
        bindPag(topPag);
        bindPag(botPag);

        if (!items.length) {
          wrap.innerHTML = '<div style="padding:28px;text-align:center;color:#64748b;font-size:13px;">No se encontraron productos con los filtros actuales.</div>';
          return;
        }

        var rowsHtml = items.map(function (p) {
          var thumbHtml = p.thumbnail_url
            ? '<img src="' + esc(p.thumbnail_url) + '" alt="" loading="lazy" style="width:46px;height:46px;border-radius:8px;object-fit:cover;border:1px solid #e2e8f0;flex:0 0 46px;background:#f8fafc;">'
            : '<div aria-hidden="true" style="width:46px;height:46px;border-radius:8px;border:1px solid #e2e8f0;background:#f1f5f9;color:#94a3b8;display:flex;align-items:center;justify-content:center;flex:0 0 46px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>';

          var stockHtml = p.availability_mode === 'bajo_pedido'
            ? '<span style="display:inline-block;margin-top:3px;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;background:#FFF8EF;color:#c2410c;border:1px solid rgba(252,71,2,0.28);">Bajo pedido</span>'
            : '<div style="font-size:11.5px;margin-top:2px;color:' + (Number(p.stock_qty) > 0 ? '#475569' : '#b91c1c;font-weight:700') + ';">' +
                (Number(p.stock_qty) > 0 ? 'Stock: ' + esc(p.stock_qty) + ' u.' : 'Sin stock (0)') +
              '</div>';

          return '<tr data-fa-prod-row="' + esc(p.id) + '" style="cursor:pointer;">' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">' +
              '<div style="display:flex;align-items:center;gap:10px;min-width:220px;">' +
                thumbHtml +
                '<div style="min-width:0;">' +
                  '<div style="font-weight:800;color:#023C46;line-height:1.3;word-break:break-word;">' + esc(p.title || 'Sin título') + '</div>' +
                  '<div style="font-size:11.5px;color:#069294;font-weight:700;margin-top:2px;">' + esc(p.category_name || 'Sin categoría') + '</div>' +
                '</div>' +
              '</div>' +
            '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;min-width:160px;">' +
              '<div style="font-weight:700;color:#0f172a;">' + esc(p.store_name || 'Sin tienda') + '</div>' +
              (p.artisan_name ? '<div style="font-size:11.5px;color:#64748b;margin-top:2px;">' + esc(p.artisan_name) + '</div>' : '') +
            '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;white-space:nowrap;">' +
              '<div style="font-weight:800;color:#023C46;">' + esc(fmtCents(p.price_cents)) + '</div>' +
              stockHtml +
            '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">' +
              '<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">' +
                badgeHtml(prodStatusMeta(p.status)) +
                badgeHtml(prodModMeta(p.moderation_status)) +
              '</div>' +
            '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;white-space:nowrap;font-size:12px;color:#475569;">' + esc(fmtProdDate(p.created_at)) + '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap;">' +
              '<button type="button" data-fa-open-prod="' + esc(p.id) + '" style="background:#069294;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">Ver ficha</button>' +
            '</td>' +
          '</tr>';
        }).join('');

        wrap.innerHTML =
          '<div style="overflow:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
              '<thead><tr>' +
                '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Producto</th>' +
                '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Emprendedor</th>' +
                '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Precio / Stock</th>' +
                '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Estado</th>' +
                '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Fecha de alta</th>' +
                '<th style="text-align:right;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Acción</th>' +
              '</tr></thead>' +
              '<tbody>' + rowsHtml + '</tbody>' +
            '</table>' +
          '</div>';

        wrap.querySelectorAll('[data-fa-prod-row]').forEach(function (tr) {
          tr.addEventListener('click', function () {
            openProductFichaModal(tr.getAttribute('data-fa-prod-row'));
          });
        });
      };

      var populateFilterDropdowns = function () {
        var storeSel = document.getElementById('fa-prod-store');
        if (storeSel) {
          var prevSt = pa.storeId || '';
          storeSel.innerHTML = '<option value="">Todos los emprendedores / tiendas</option>' +
            (pa.stores || []).map(function (st) {
              var label = st.name + (st.artisan_name ? ' — ' + st.artisan_name : '');
              return '<option value="' + esc(st.id) + '"' + (st.id === prevSt ? ' selected' : '') + '>' + esc(label) + '</option>';
            }).join('');
        }
        var catSel = document.getElementById('fa-prod-category');
        if (catSel) {
          var prevCat = pa.categoryId || '';
          catSel.innerHTML = '<option value="">Todas las categorías</option>' +
            (pa.categories || []).map(function (c) {
              return '<option value="' + esc(c.id) + '"' + (c.id === prevCat ? ' selected' : '') + '>' + esc(c.name) + (c.is_active === false ? ' (inactiva)' : '') + '</option>';
            }).join('');
        }
      };

      var fetchProductsPage = async function (includeFilters) {
        var seq = ++pa.reqSeq;
        pa.loading = true;
        pa.error = '';
        renderProductsTableContent();

        try {
          var res = await apiFeriarte('GET', null, {
            mode: 'products',
            page: pa.page,
            pageSize: pa.pageSize,
            q: pa.q,
            storeId: pa.storeId,
            categoryId: pa.categoryId,
            status: pa.status,
            moderationStatus: pa.moderationStatus,
            dateFrom: pa.dateFrom,
            dateTo: pa.dateTo,
            sort: pa.sort,
            includeFilters: includeFilters ? '1' : ''
          });
          if (seq !== pa.reqSeq) return;
          if (res && res.ok) {
            pa.items = res.items || [];
            pa.total = Number(res.total || 0);
            pa.page = Number(res.page || 1);
            pa.pageSize = Number(res.pageSize || pa.pageSize);
            pa.totalPages = Math.max(1, Number(res.totalPages || 1));
            if (res.filters) {
              pa.stores = res.filters.stores || [];
              pa.categories = res.filters.categories || [];
              pa.filtersLoaded = true;
              populateFilterDropdowns();
            }
          } else {
            pa.error = (res && res.message) || 'No se pudo consultar el catálogo de productos.';
          }
        } catch (_e) {
          if (seq !== pa.reqSeq) return;
          pa.error = 'Error de conexión al consultar los productos.';
        } finally {
          if (seq === pa.reqSeq) {
            pa.loading = false;
            renderProductsTableContent();
          }
        }
      };

      var inputStyle = 'width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12.5px;background:#fff;color:#0f172a;box-sizing:border-box;';
      var lblStyle = 'display:grid;gap:4px;font-size:11.5px;font-weight:700;color:#334155;';

      body.innerHTML = banner +
        '<div style="display:grid;gap:14px;">' +
          '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;display:grid;gap:12px;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;align-items:end;">' +
              '<label style="' + lblStyle + 'grid-column:span 2;min-width:220px;">Buscar producto (nombre o slug)' +
                '<input id="fa-prod-q" type="search" value="' + esc(pa.q) + '" placeholder="Ej: mate algarrobo, cerámica..." style="' + inputStyle + '">' +
              '</label>' +
              '<label style="' + lblStyle + '">Emprendedor / Tienda' +
                '<select id="fa-prod-store" style="' + inputStyle + '"><option value="">Cargando tiendas...</option></select>' +
              '</label>' +
              '<label style="' + lblStyle + '">Categoría' +
                '<select id="fa-prod-category" style="' + inputStyle + '"><option value="">Cargando categorías...</option></select>' +
              '</label>' +
              '<label style="' + lblStyle + '">Estado' +
                '<select id="fa-prod-status" style="' + inputStyle + '">' +
                  '<option value="">Todos los estados</option>' +
                  '<option value="published"' + (pa.status === 'published' ? ' selected' : '') + '>Publicado</option>' +
                  '<option value="draft"' + (pa.status === 'draft' ? ' selected' : '') + '>Borrador</option>' +
                  '<option value="paused"' + (pa.status === 'paused' ? ' selected' : '') + '>Pausado</option>' +
                  '<option value="sold_out"' + (pa.status === 'sold_out' ? ' selected' : '') + '>Agotado</option>' +
                  '<option value="archived"' + (pa.status === 'archived' ? ' selected' : '') + '>Archivado</option>' +
                '</select>' +
              '</label>' +
              '<label style="' + lblStyle + '">Moderación' +
                '<select id="fa-prod-mod" style="' + inputStyle + '">' +
                  '<option value="">Todas las moderaciones</option>' +
                  '<option value="approved"' + (pa.moderationStatus === 'approved' ? ' selected' : '') + '>Aprobado</option>' +
                  '<option value="pending_review"' + (pa.moderationStatus === 'pending_review' ? ' selected' : '') + '>Pendiente revisión</option>' +
                  '<option value="flagged"' + (pa.moderationStatus === 'flagged' ? ' selected' : '') + '>Marcado</option>' +
                  '<option value="rejected"' + (pa.moderationStatus === 'rejected' ? ' selected' : '') + '>Rechazado</option>' +
                '</select>' +
              '</label>' +
              '<label style="' + lblStyle + '">Fecha de alta (desde)' +
                '<input id="fa-prod-from" type="date" value="' + esc(pa.dateFrom) + '" style="' + inputStyle + '">' +
              '</label>' +
              '<label style="' + lblStyle + '">Fecha de alta (hasta)' +
                '<input id="fa-prod-to" type="date" value="' + esc(pa.dateTo) + '" style="' + inputStyle + '">' +
              '</label>' +
              '<label style="' + lblStyle + '">Ordenar por' +
                '<select id="fa-prod-sort" style="' + inputStyle + '">' +
                  '<option value="newest"' + (pa.sort === 'newest' ? ' selected' : '') + '>Más recientes</option>' +
                  '<option value="oldest"' + (pa.sort === 'oldest' ? ' selected' : '') + '>Más antiguos</option>' +
                  '<option value="price_asc"' + (pa.sort === 'price_asc' ? ' selected' : '') + '>Precio: menor a mayor</option>' +
                  '<option value="price_desc"' + (pa.sort === 'price_desc' ? ' selected' : '') + '>Precio: mayor a menor</option>' +
                '</select>' +
              '</label>' +
              '<label style="' + lblStyle + '">Por página' +
                '<select id="fa-prod-pagesize" style="' + inputStyle + '">' +
                  '<option value="25"' + (pa.pageSize === 25 ? ' selected' : '') + '>25 por página</option>' +
                  '<option value="50"' + (pa.pageSize === 50 ? ' selected' : '') + '>50 por página</option>' +
                '</select>' +
              '</label>' +
              '<div style="display:flex;align-items:flex-end;">' +
                '<button type="button" id="fa-prod-clear" style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;color:#023C46;font-size:12.5px;font-weight:700;cursor:pointer;">Limpiar filtros</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;display:grid;gap:12px;">' +
            '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;">' +
              '<div id="fa-prods-summary-top" style="font-size:12.5px;color:#475569;">Cargando productos...</div>' +
              '<div id="fa-prods-pag-top"></div>' +
            '</div>' +
            '<div id="fa-prods-table-wrap"></div>' +
            '<div style="display:flex;justify-content:flex-end;">' +
              '<div id="fa-prods-pag-bottom"></div>' +
            '</div>' +
          '</div>' +
        '</div>';

      if (pa.filtersLoaded) {
        populateFilterDropdowns();
      }

      var searchDebounce = null;
      var qInp = document.getElementById('fa-prod-q');
      if (qInp) {
        qInp.addEventListener('input', function () {
          clearTimeout(searchDebounce);
          searchDebounce = setTimeout(function () {
            pa.q = qInp.value.trim();
            pa.page = 1;
            fetchProductsPage(false);
          }, 300);
        });
        qInp.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            clearTimeout(searchDebounce);
            pa.q = qInp.value.trim();
            pa.page = 1;
            fetchProductsPage(false);
          }
        });
      }

      var bindFilterChange = function (elId, propName, parseFn) {
        var el = document.getElementById(elId);
        if (!el) return;
        el.addEventListener('change', function () {
          pa[propName] = parseFn ? parseFn(el.value) : el.value;
          pa.page = 1;
          fetchProductsPage(false);
        });
      };

      bindFilterChange('fa-prod-store', 'storeId');
      bindFilterChange('fa-prod-category', 'categoryId');
      bindFilterChange('fa-prod-status', 'status');
      bindFilterChange('fa-prod-mod', 'moderationStatus');
      bindFilterChange('fa-prod-from', 'dateFrom');
      bindFilterChange('fa-prod-to', 'dateTo');
      bindFilterChange('fa-prod-sort', 'sort');
      bindFilterChange('fa-prod-pagesize', 'pageSize', function (v) { return v === '50' ? 50 : 25; });

      var clearBtn = document.getElementById('fa-prod-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          pa.q = '';
          pa.storeId = '';
          pa.categoryId = '';
          pa.status = '';
          pa.moderationStatus = '';
          pa.dateFrom = '';
          pa.dateTo = '';
          pa.sort = 'newest';
          pa.page = 1;
          renderDetailView('productos');
        });
      }

      fetchProductsPage(!pa.filtersLoaded);
      return;
    }

    if (viewKey === 'tiendas') {
      var allStores = d.stores || [];

      var fmtStoreDate = function (iso) {
        if (!iso) return '—';
        try {
          return new Date(iso).toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
        } catch (_e) { return String(iso); }
      };

      var storeStatusMeta = function (st) {
        if (st === 'active') return { label: 'Activa', bg: '#dcfce7', color: '#166534' };
        if (st === 'paused') return { label: 'Pausada', bg: '#fef3c7', color: '#92400e' };
        if (st === 'suspended') return { label: 'Suspendida', bg: '#fee2e2', color: '#991b1b' };
        return { label: String(st || '—'), bg: '#f1f5f9', color: '#334155' };
      };

      var openStoreFichaModal = function (stObj) {
        if (!stObj) return;
        var prevModal = document.getElementById('fa-store-ficha-modal');
        if (prevModal) prevModal.remove();

        var stMeta = storeStatusMeta(stObj.status);
        var contact = stObj.contact_info && typeof stObj.contact_info === 'object' ? stObj.contact_info : {};
        var mp = stObj.mp_account || null;
        var mpText = mp && mp.status === 'active'
          ? (mp.sandbox_mode ? 'Vinculada (Modo Prueba / Sandbox)' : 'Vinculada (Producción)')
          : 'Sin vincular todavía';

        var prodsHtml = (stObj.products_preview || []).length
          ? stObj.products_preview.map(function (p) {
              return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;margin-top:6px;font-size:12px;">' +
                '<div><strong>' + esc(p.title) + '</strong> · ' + esc(fmtCents(p.price_cents)) + ' · Stock: ' + esc(p.stock_qty) + '</div>' +
                '<a href="https://feriarte.vercel.app/producto/' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener" style="color:#069294;font-weight:700;text-decoration:none;white-space:nowrap;">Ver ↗</a>' +
              '</div>';
            }).join('')
          : '<div style="font-size:12px;color:#64748b;">Todavía no publicó productos.</div>';

        var fairsHtml = (stObj.linked_fairs || []).length
          ? stObj.linked_fairs.map(function (lf) {
              return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;margin-top:6px;font-size:12px;">' +
                '<div><strong>' + esc(lf.fair_name) + '</strong>' + (lf.stand_code ? ' · Puesto ' + esc(lf.stand_code) : '') + ' · <span style="color:#64748b;">' + esc(lf.status) + '</span></div>' +
                '<a href="https://feriarte.vercel.app/feria/' + encodeURIComponent(lf.fair_slug) + '" target="_blank" rel="noopener" style="color:#069294;font-weight:700;text-decoration:none;">Ver feria ↗</a>' +
              '</div>';
            }).join('')
          : '<div style="font-size:12px;color:#64748b;">Sin ferias vinculadas (vende de forma independiente).</div>';

        var overlay = document.createElement('div');
        overlay.id = 'fa-store-ficha-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(2,60,70,0.62);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;';
        overlay.innerHTML =
          '<div style="background:#fff;border-radius:16px;max-width:660px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,0.28);border:1px solid #d9e2e6;">' +
            '<div style="background:#023C46;color:#fff;padding:18px 20px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-radius:16px 16px 0 0;">' +
              '<div>' +
                '<div style="font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#56D7A1;">Ficha de Tienda · FeriARTE</div>' +
                '<h3 style="margin:4px 0 2px;font-size:19px;font-weight:900;color:#fff;">' + esc(stObj.name || 'Sin nombre') + '</h3>' +
                '<div style="font-size:13px;color:rgba(255,255,255,0.88);">' + esc(stObj.artisan_name || stObj.owner_full_name || 'Emprendedor') + (stObj.owner_email ? ' · ' + esc(stObj.owner_email) : '') + '</div>' +
              '</div>' +
              '<button type="button" id="fa-store-close-x" aria-label="Cerrar ficha" style="background:rgba(255,255,255,0.14);color:#fff;border:none;border-radius:8px;width:32px;height:32px;font-size:18px;font-weight:700;cursor:pointer;line-height:1;">&times;</button>' +
            '</div>' +
            '<div style="padding:18px 20px;display:grid;gap:14px;color:#023C46;">' +
              '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
                '<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:' + stMeta.bg + ';color:' + stMeta.color + ';">Estado: ' + esc(stMeta.label) + '</span>' +
                (stObj.verified_artisan_badge ? '<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:#e0f2fe;color:#075985;">Emprendedor Verificado</span>' : '') +
                (stObj.accepts_custom_orders ? '<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:#FFF8EF;color:#FC4702;">Acepta pedidos personalizados</span>' : '') +
                (stObj.slug ? '<a href="https://feriarte.vercel.app/tienda/' + encodeURIComponent(stObj.slug) + '" target="_blank" rel="noopener" style="margin-left:auto;font-size:12px;font-weight:800;color:#069294;text-decoration:none;">Abrir tienda pública ↗</a>' : '') +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">' +
                '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#069294;margin-bottom:8px;">Datos de registración Web</div>' +
                '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;font-size:12.5px;">' +
                  '<div><strong>Emprendedor / Titular:</strong><br>' + esc(stObj.artisan_name || stObj.owner_full_name || '—') + '</div>' +
                  '<div><strong>Correo de registro:</strong><br>' + esc(stObj.owner_email || '—') + '</div>' +
                  '<div><strong>WhatsApp tienda / cuenta:</strong><br>' + esc(contact.whatsapp || stObj.owner_phone || 'No informado') + '</div>' +
                  '<div><strong>Instagram:</strong><br>' + esc(contact.instagram || 'No informado') + '</div>' +
                  '<div><strong>Localidad y Provincia:</strong><br>' + esc([stObj.locality, stObj.province].filter(Boolean).join(', ') || 'No informada') + '</div>' +
                  '<div><strong>Fecha de creación:</strong><br>' + esc(fmtStoreDate(stObj.created_at)) + '</div>' +
                '</div>' +
                (stObj.activity_description ? '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:12.5px;"><strong>Actividad / Rubro:</strong><br>' + esc(stObj.activity_description) + '</div>' : '') +
                (stObj.craft_story ? '<div style="margin-top:8px;font-size:12.5px;"><strong>Historia del emprendimiento:</strong><br>' + esc(stObj.craft_story) + '</div>' : '') +
                (stObj.delivery_policies ? '<div style="margin-top:8px;font-size:12.5px;"><strong>Políticas de entrega:</strong><br>' + esc(stObj.delivery_policies) + '</div>' : '') +
                (stObj.accepts_custom_orders && stObj.custom_orders_note ? '<div style="margin-top:8px;font-size:12.5px;"><strong>Condiciones pedidos personalizados:</strong><br>' + esc(stObj.custom_orders_note) + '</div>' : '') +
              '</div>' +
              '<div style="background:#FFF8EF;border:1px solid #f2dfc4;border-radius:12px;padding:14px;font-size:12.5px;">' +
                '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#FC4702;margin-bottom:6px;">Cuenta de cobro (Mercado Pago Split)</div>' +
                '<div><strong>Estado:</strong> ' + esc(mpText) + '</div>' +
                (mp && mp.mp_account_email ? '<div><strong>Cuenta MP:</strong> ' + esc(mp.mp_account_email) + '</div>' : '') +
                (mp && mp.linked_at ? '<div><strong>Vinculada el:</strong> ' + esc(fmtStoreDate(mp.linked_at)) + '</div>' : '') +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">' +
                '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#023C46;margin-bottom:6px;">Productos publicados (' + esc(stObj.products_count || 0) + ')</div>' +
                prodsHtml +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">' +
                '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#023C46;margin-bottom:6px;">Ferias vinculadas (' + esc((stObj.linked_fairs || []).length) + ')</div>' +
                fairsHtml +
              '</div>' +
              '<div style="display:flex;justify-content:flex-end;padding-top:4px;">' +
                '<button type="button" id="fa-store-close-btn" style="background:#023C46;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;">Cerrar ficha</button>' +
              '</div>' +
            '</div>' +
          '</div>';

        var closeModal = function () {
          overlay.remove();
          document.removeEventListener('keydown', onEsc);
        };
        var onEsc = function (e) { if (e.key === 'Escape') closeModal(); };
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
        overlay.querySelector('#fa-store-close-x').addEventListener('click', closeModal);
        overlay.querySelector('#fa-store-close-btn').addEventListener('click', closeModal);
        document.addEventListener('keydown', onEsc);
        document.body.appendChild(overlay);
      };

      var renderStoresTable = function (queryStr) {
        var q = String(queryStr || '').trim().toLowerCase();
        var filtered = q
          ? allStores.filter(function (s) {
              return String(s.name || '').toLowerCase().indexOf(q) !== -1 ||
                String(s.artisan_name || '').toLowerCase().indexOf(q) !== -1 ||
                String(s.owner_email || '').toLowerCase().indexOf(q) !== -1;
            })
          : allStores;

        var tbody = document.getElementById('fa-stores-tbody');
        var countEl = document.getElementById('fa-stores-count');
        if (countEl) countEl.textContent = filtered.length + ' registro(s)';
        if (!tbody) return;

        if (!filtered.length) {
          tbody.innerHTML = '<tr><td colspan="4" style="padding:14px;color:#64748b;">Sin tiendas registradas aún.</td></tr>';
          return;
        }

        tbody.innerHTML = filtered.map(function (s) {
          var stMeta = storeStatusMeta(s.status);
          return '<tr data-fa-store-id="' + esc(s.id) + '" style="cursor:pointer;">' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:700;color:#023C46;">' + esc(s.name || 'Sin nombre') + '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#334155;">' +
              '<div>' + esc(s.artisan_name || s.owner_full_name || '—') + '</div>' +
              '<small style="color:#64748b;">' + esc(s.owner_email || '') + '</small>' +
            '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">' +
              '<span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:' + stMeta.bg + ';color:' + stMeta.color + ';">' + esc(stMeta.label) + '</span>' +
            '</td>' +
            '<td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;">' +
              '<button type="button" style="background:#069294;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">Ver ficha</button>' +
            '</td>' +
          '</tr>';
        }).join('');

        tbody.querySelectorAll('[data-fa-store-id]').forEach(function (tr) {
          tr.addEventListener('click', function () {
            var sid = tr.getAttribute('data-fa-store-id');
            var found = allStores.find(function (x) { return x.id === sid; });
            openStoreFichaModal(found);
          });
        });
      };

      body.innerHTML = banner +
        '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;">' +
          '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">' +
            '<input id="fa-stores-search" type="search" placeholder="Buscar por tienda, emprendedor o correo..." style="flex:1;min-width:220px;max-width:400px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">' +
            '<span id="fa-stores-count" style="font-size:12px;font-weight:700;color:#64748b;">' + esc(allStores.length) + ' registro(s)</span>' +
          '</div>' +
          '<div style="overflow:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr>' +
              '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Tienda</th>' +
              '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Emprendedor y correo</th>' +
              '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Estado</th>' +
              '<th style="text-align:right;padding:10px 12px;border-bottom:2px solid #e2e8f0;color:#023C46;">Ficha</th>' +
            '</tr></thead><tbody id="fa-stores-tbody"></tbody></table>' +
          '</div>' +
        '</div>';

      renderStoresTable('');
      var storeSearch = document.getElementById('fa-stores-search');
      if (storeSearch) {
        storeSearch.addEventListener('input', function () {
          renderStoresTable(storeSearch.value);
        });
      }
      return;
    }

    // Vista tabular genérica con datos reales para el resto de los submódulos
    var datasetMap = {
      usuarios: d.users || [],
      ferias: d.fairs || [],
      feriantes: (d.users || []).filter(function (u) {
        return (u.roles || []).some(function (r) { return r.role === 'feriante'; });
      }),
      tiendas: d.stores || [],
      productos: d.products || [],
      categorias: d.categories || [],
      pedidos: d.orders || [],
      pagos: d.payments || [],
      liquidaciones: d.settlements || [],
      reclamos: d.claims || [],
      configuracion: Object.keys(d.settings || {}).map(function (k) { return { clave: k, valor: JSON.stringify(d.settings[k]) }; }),
      contenido: [d.settings && d.settings.portal_hero ? d.settings.portal_hero : {}],
      auditoria: d.auditLogs || []
    };

    var list = datasetMap[viewKey] || [];
    if (!list.length) {
      body.innerHTML = banner + '<div style="background:#fff;border-radius:12px;padding:18px;border:1px solid #d9e2e6;">Sin registros cargados aún en <strong>' + esc(meta.label) + '</strong> (datos 100% reales desde PostgreSQL).</div>';
      return;
    }

    var cols = Object.keys(list[0]).slice(0, 6);
    body.innerHTML = banner +
      '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;overflow:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
      cols.map(function (c) { return '<th style="text-align:left;padding:8px;border-bottom:2px solid #eee;">' + esc(c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      list.slice(0, 50).map(function (row) {
        return '<tr>' + cols.map(function (c) {
          var v = row[c];
          if (v && typeof v === 'object') v = JSON.stringify(v);
          return '<td style="padding:8px;border-bottom:1px solid #f0f0f0;max-width:260px;overflow:hidden;text-overflow:ellipsis;">' + esc(v) + '</td>';
        }).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  async function openFeriarteView(viewKey) {
    var secs = ensureSections();
    if (!secs) return;
    hideAllErpSections();
    STATE.view = viewKey || 'menu';
    STATE.feedback = '';

    var backTopBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backTopBtn) {
      backTopBtn.hidden = false;
      backTopBtn.textContent = '← Atrás';
    }
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    var meta = SUBMODULES.find(function (s) { return s.key === STATE.view; });
    if (topbarModInd) {
      topbarModInd.hidden = false;
      topbarModInd.textContent =
        STATE.view === 'menu'
          ? 'FeriARTE'
          : 'FeriARTE · ' + (meta ? meta.label : STATE.view);
    }

    if (STATE.view === 'menu') {
      renderSubmodulesMenu();
      secs.menuSec.hidden = false;
      secs.detailSec.hidden = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      reloadData();
      return;
    }

    secs.menuSec.hidden = true;
    secs.detailSec.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (STATE.view === 'productos') {
      renderDetailView('productos');
      return;
    }
    if (!STATE.data) {
      renderDetailView(STATE.view);
      await reloadData();
    }
    renderDetailView(STATE.view);
  }

  window.__MS_FERIARTE_OPEN__ = openFeriarteView;

  function syncFeriarteHomeCard() {
    bindGlobalNavIntegration();
    // Alojado dentro del módulo contenedor "Mega Sistemas"
    var existing = document.getElementById('ms-feriarte-home-card');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  setInterval(syncFeriarteHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncFeriarteHomeCard);
})();
