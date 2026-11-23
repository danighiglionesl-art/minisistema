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
    { key: 'feriantes', label: 'Feriantes', icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>' },
    { key: 'tiendas', label: 'Tiendas', icon: '<path d="M3 9l2-5h14l2 5"></path><path d="M3 9v11h18V9"></path><path d="M9 20v-6h6v6"></path>' },
    { key: 'productos', label: 'Productos', icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>' },
    { key: 'categorias', label: 'Categorías', icon: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>' },
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
    var main = document.querySelector('main.app-main') || document.querySelector('main') || document.body;
    if (!document.getElementById('sec-menu-feriarte')) {
      var secMenu = document.createElement('section');
      secMenu.id = 'sec-menu-feriarte';
      secMenu.className = 'erp-section';
      secMenu.hidden = true;
      secMenu.innerHTML =
        '<div class="module-back-bar">' +
          '<button type="button" class="btn-back-home" id="fa-back-home">← Volver a Pantalla Principal</button>' +
          '<span class="module-breadcrumb">Administrador General · <strong>FeriARTE</strong></span>' +
        '</div>' +
        '<div class="modules-grid" id="fa-submodules-grid" aria-label="Submódulos de FeriARTE"></div>';
      main.appendChild(secMenu);
      secMenu.querySelector('#fa-back-home').addEventListener('click', closeToHome);
    }

    if (!document.getElementById('sec-feriarte-detail')) {
      var secDetail = document.createElement('section');
      secDetail.id = 'sec-feriarte-detail';
      secDetail.className = 'erp-section';
      secDetail.hidden = true;
      secDetail.innerHTML =
        '<div class="module-back-bar">' +
          '<button type="button" class="btn-back-home" id="fa-back-menu">← Volver a FeriARTE</button>' +
          '<span class="module-breadcrumb" id="fa-detail-breadcrumb">FeriARTE</span>' +
        '</div>' +
        '<div id="fa-detail-body" style="padding:1rem 0;"></div>';
      main.appendChild(secDetail);
      secDetail.querySelector('#fa-back-menu').addEventListener('click', function () {
        openFeriarteView('menu');
      });
    }
  }

  function hideAllErpSections() {
    document.querySelectorAll('section.erp-section').forEach(function (sec) {
      sec.hidden = true;
    });
  }

  function closeToHome() {
    hideAllErpSections();
    var home = document.getElementById('sec-inicio');
    if (home) home.hidden = false;
  }

  async function reloadData() {
    STATE.loading = true;
    try {
      var res = await apiFeriarte('GET');
      if (res && res.ok) STATE.data = res;
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

    if (STATE.loading || !STATE.data) {
      body.innerHTML = '<p style="padding:1rem;">Cargando datos reales de FeriARTE...</p>';
      return;
    }

    var d = STATE.data;
    var k = d.kpis || {};
    var banner = STATE.feedback
      ? '<div style="margin-bottom:1rem;padding:0.75rem 1rem;border-radius:10px;background:#e6f7f2;color:#023C46;font-weight:700;">' + esc(STATE.feedback) + '</div>'
      : '';

    if (viewKey === 'panel' || viewKey === 'estadisticas') {
      var cards = [
        ['Usuarios registrados', k.usersRegistered],
        ['Clientes / Caminantes activos', k.clientsActive],
        ['Feriantes activos', k.feriantesActive],
        ['Organizadores activos', k.organizersActive],
        ['Organizadores pendientes', k.organizersPending],
        ['Ferias publicadas', k.fairsPublished],
        ['Tiendas habilitadas', k.storesEnabled],
        ['Productos disponibles', k.productsAvailable],
        ['Ventas brutas', fmtCents(k.grossSalesCents)],
        ['Ventas netas feriantes', fmtCents(k.netSalesCents)],
        ['Comisión FeriARTE', fmtCents(k.platformCommissionCents)],
        ['Comisiones organizadores', fmtCents(k.organizerCommissionCents)],
        ['Liquidaciones pendientes', fmtCents(k.pendingSettlementsCents)],
        ['Órdenes pendientes', k.pendingOrdersCount],
        ['Reclamos abiertos', k.openClaimsCount],
        ['Escaneos QR / Conversiones', (k.qrScansTotal || 0) + ' / ' + (k.qrConvertedOrders || 0)]
      ];
      body.innerHTML = banner +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;">' +
        cards.map(function (c) {
          return '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:14px;">' +
            '<div style="font-size:12px;color:#526570;font-weight:700;">' + esc(c[0]) + '</div>' +
            '<div style="font-size:22px;font-weight:900;color:#023C46;margin-top:4px;">' + esc(c[1]) + '</div>' +
          '</div>';
        }).join('') +
        '</div>';
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
    ensureSections();
    hideAllErpSections();
    STATE.view = viewKey || 'menu';
    STATE.feedback = '';

    if (STATE.view === 'menu') {
      renderSubmodulesMenu();
      document.getElementById('sec-menu-feriarte').hidden = false;
      reloadData();
      return;
    }

    document.getElementById('sec-feriarte-detail').hidden = false;
    if (!STATE.data) {
      renderDetailView(STATE.view);
      await reloadData();
    }
    renderDetailView(STATE.view);
  }

  function syncFeriarteHomeCard() {
    var allowed = isGeneralAdmin();
    var grid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-feriarte-home-card');

    if (allowed && grid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-feriarte-home-card';
      card.className = 'module-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M3 20h18L12 4 3 20z"></path><path d="M8.5 14h7"></path>' +
          '</svg>' +
        '</div>' +
        '<h3>FeriARTE</h3>';
      card.addEventListener('click', function () {
        openFeriarteView('menu');
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openFeriarteView('menu');
        }
      });
      var saCard = document.getElementById('ms-superadmin-home-card');
      if (saCard && saCard.nextSibling) {
        grid.insertBefore(card, saCard.nextSibling);
      } else {
        grid.appendChild(card);
      }
    } else if (existing) {
      existing.hidden = !allowed;
      existing.style.display = allowed ? '' : 'none';
    }
  }

  setInterval(syncFeriarteHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncFeriarteHomeCard);
})();
