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
    feedback: ''
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

  async function apiFeriarte(method, payload) {
    var opts = {
      method: method || 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    };
    if (payload) opts.body = JSON.stringify(payload);
    var res = await fetch(getApiBase(), opts);
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

    var d = STATE.data;
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
      var rows = (d.organizers || []).map(function (o) {
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(o.organization_name) + '</strong><br><small>' + esc(o.locality) + ', ' + esc(o.province) + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(o.approval_status) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><code>' + esc(o.invite_code) + '</code></td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' +
            '<button type="button" data-org-act="approved" data-org-id="' + esc(o.id) + '" style="margin-right:6px;padding:5px 10px;border-radius:6px;border:none;background:#069294;color:#fff;font-weight:700;cursor:pointer;">Aprobar</button>' +
            '<button type="button" data-org-act="suspended" data-org-id="' + esc(o.id) + '" style="padding:5px 10px;border-radius:6px;border:none;background:#FC4702;color:#fff;font-weight:700;cursor:pointer;">Suspender</button>' +
          '</td>' +
        '</tr>';
      }).join('');
      body.innerHTML = banner +
        '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;overflow:auto;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr><th style="text-align:left;padding:8px;">Organización</th><th style="text-align:left;padding:8px;">Estado</th><th style="text-align:left;padding:8px;">Código Invitación</th><th style="text-align:left;padding:8px;">Acción</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="4" style="padding:12px;">Sin solicitudes de organizadores registradas aún.</td></tr>') +
        '</tbody></table></div>';
      body.querySelectorAll('[data-org-act]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var res = await apiFeriarte('POST', {
            action: 'review_organizer',
            organizerProfileId: btn.getAttribute('data-org-id'),
            decision: btn.getAttribute('data-org-act')
          });
          STATE.feedback = (res && res.message) || 'Actualizado';
          await reloadData();
          renderDetailView('organizadores');
        });
      });
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
