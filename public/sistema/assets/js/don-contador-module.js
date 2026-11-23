/* ==========================================================================
   MÓDULO EXCLUSIVO DEL ADMINISTRADOR GENERAL (@danielg) — DON CONTADOR
   Control central de Don Contador (www.doncontador.com.ar) desde MiniSistema.
   Respeta estrictamente tarjetas uniformes (.modules-grid / .module-card) sin
   badges, pills ni descripciones, y aplica segregación estricta de roles.
   ========================================================================== */
(function () {
  'use strict';

  var SUBMODULES = [
    { key: 'panel', label: 'Panel General', icon: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>' },
    { key: 'operaciones', label: 'Operaciones', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>' },
    { key: 'profesionales', label: 'Profesionales', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>' },
    { key: 'catalogo', label: 'Catálogo 45 Servicios', icon: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>' },
    { key: 'clientes', label: 'Clientes y Empresas', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>' },
    { key: 'finanzas', label: 'Finanzas y Honorarios', icon: '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>' },
    { key: 'legalizaciones', label: 'Legalizaciones CPCE', icon: '<polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>' },
    { key: 'entregables', label: 'Documentos Entregados', icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>' },
    { key: 'agenda', label: 'Agenda y Consultas', icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>' },
    { key: 'indicadores', label: 'Indicadores', icon: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>' },
    { key: 'configuracion', label: 'Configuración Legal', icon: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' },
    { key: 'auditoria', label: 'Auditoría', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline>' }
  ];

  var STATE = { view: 'menu', data: null, loading: false, feedback: '' };
  var fmtArs = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isGeneralAdmin() {
    var user = typeof window.__MS_GET_ACTIVE_USER__ === 'function' ? window.__MS_GET_ACTIVE_USER__() : null;
    if (!user) {
      try {
        var pfx = (window.ERP_BRAND && window.ERP_BRAND.storagePrefix) || 'ms_minisistema_';
        var raw = sessionStorage.getItem(pfx + 'erp_active_admin_v1') || localStorage.getItem(pfx + 'erp_active_admin_v1');
        if (raw) user = JSON.parse(raw);
      } catch (_e) {}
    }
    if (!user || !user.username) return false;
    var u = String(user.username).trim().toLowerCase();
    var r = String(user.role || '').trim().toLowerCase();
    return u === 'danielg' || r === 'administrador general';
  }

  function getApiBase() {
    var boot = window.__ERP_TENANT_BOOT__;
    if (boot && !boot.isBase && boot.optionType === 2 && boot.slug) {
      return '/' + encodeURIComponent(boot.slug) + '/api/don_contador';
    }
    return '/sistema/api/don_contador';
  }

  async function apiDc(method, payload) {
    var opts = { method: method || 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' } };
    if (payload) opts.body = JSON.stringify(payload);
    var res = await fetch(getApiBase(), opts);
    return res.json();
  }

  function hideAllErpSections() {
    document.querySelectorAll('section.erp-section').forEach(function (s) { s.hidden = true; });
  }

  function closeToHome() {
    hideAllErpSections();
    var home = document.getElementById('sec-inicio');
    if (home) home.hidden = false;
  }

  function ensureSections() {
    var main = document.querySelector('main.app-main') || document.querySelector('main') || document.body;
    if (!document.getElementById('sec-menu-doncontador')) {
      var secMenu = document.createElement('section');
      secMenu.id = 'sec-menu-doncontador';
      secMenu.className = 'erp-section';
      secMenu.hidden = true;
      secMenu.innerHTML =
        '<div class="module-back-bar">' +
          '<button type="button" class="btn-back-home" id="dc-back-home">← Volver a Pantalla Principal</button>' +
          '<span class="module-breadcrumb">Administrador General · <strong>Don Contador</strong></span>' +
        '</div>' +
        '<div class="modules-grid" id="dc-submodules-grid" aria-label="Submódulos de Don Contador"></div>';
      main.appendChild(secMenu);
      secMenu.querySelector('#dc-back-home').addEventListener('click', closeToHome);
    }

    if (!document.getElementById('sec-doncontador-detail')) {
      var secDetail = document.createElement('section');
      secDetail.id = 'sec-doncontador-detail';
      secDetail.className = 'erp-section';
      secDetail.hidden = true;
      secDetail.innerHTML =
        '<div class="module-back-bar">' +
          '<button type="button" class="btn-back-home" id="dc-back-menu">← Volver a Don Contador</button>' +
          '<span class="module-breadcrumb" id="dc-detail-breadcrumb">Don Contador</span>' +
        '</div>' +
        '<div id="dc-detail-body" style="padding:1rem 0;"></div>';
      main.appendChild(secDetail);
      secDetail.querySelector('#dc-back-menu').addEventListener('click', function () {
        openDcView('menu');
      });
    }
  }

  function renderSubmodulesMenu() {
    var grid = document.getElementById('dc-submodules-grid');
    if (!grid) return;
    grid.innerHTML = SUBMODULES.map(function (m) {
      return (
        '<article class="module-card" role="button" tabindex="0" data-dc-sub="' + esc(m.key) + '">' +
          '<div class="module-icon" aria-hidden="true">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + m.icon + '</svg>' +
          '</div>' +
          '<h3>' + esc(m.label) + '</h3>' +
        '</article>'
      );
    }).join('');
    grid.querySelectorAll('[data-dc-sub]').forEach(function (card) {
      var key = card.getAttribute('data-dc-sub');
      card.addEventListener('click', function () { openDcView(key); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openDcView(key); }
      });
    });
  }

  async function reloadData() {
    STATE.loading = true;
    try {
      var res = await apiDc('GET');
      if (res && res.ok) STATE.data = res;
    } finally {
      STATE.loading = false;
    }
  }

  function renderDetailView(viewKey) {
    var body = document.getElementById('dc-detail-body');
    var bc = document.getElementById('dc-detail-breadcrumb');
    var meta = SUBMODULES.find(function (s) { return s.key === viewKey; }) || SUBMODULES[0];
    if (bc) bc.innerHTML = 'Don Contador · <strong>' + esc(meta.label) + '</strong>';
    if (!body) return;

    if (!STATE.data) {
      body.innerHTML = '<div style="padding:16px;background:#fff;border-radius:12px;">Cargando datos reales de Don Contador...</div>';
      return;
    }

    var d = STATE.data;
    if (d.schemaPending) {
      body.innerHTML = '<div style="padding:18px;background:#fff7ed;border:1px solid #fdba74;border-radius:12px;color:#9a3412;">' + esc(d.message) + '</div>';
      return;
    }

    var k = d.kpis || {};
    var banner = STATE.feedback
      ? '<div style="margin-bottom:12px;padding:10px 14px;border-radius:10px;background:#EBF4FA;color:#205578;font-weight:700;">' + esc(STATE.feedback) + '</div>'
      : '';

    if (viewKey === 'panel' || viewKey === 'indicadores') {
      var cards = [
        ['Clientes registrados', k.clientsRegistered || 0],
        ['Empresas registradas', k.organizationsRegistered || 0],
        ['Profesionales activos', k.professionalsActive || 0],
        ['Servicios en catálogo', k.servicesCatalogCount || 0],
        ['Solicitudes totales', k.requestsTotal || 0],
        ['Trabajos en proceso', k.requestsInProgress || 0],
        ['Pendientes de documentación', k.requestsPendingDocs || 0],
        ['Tasa de expedientes observados', (k.requestsObservedRatePct || 0) + '%'],
        ['Documentos entregados', k.deliverablesIssued || 0],
        ['Presupuestado total', fmtArs.format(k.quotedTotalArs || 0)],
        ['Honorarios cobrados', fmtArs.format(k.collectedFeesArs || 0)],
        ['Legalizaciones cobradas', fmtArs.format(k.collectedLegalizationArs || 0)]
      ];
      body.innerHTML = banner +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">' +
        cards.map(function (c) {
          return '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:14px;">' +
            '<div style="font-size:12px;color:#4B677B;">' + esc(c[0]) + '</div>' +
            '<div style="font-size:20px;font-weight:800;color:#205578;margin-top:4px;">' + esc(c[1]) + '</div>' +
          '</div>';
        }).join('') +
        '</div>' +
        '<p style="margin-top:14px;font-size:12px;color:#4B677B;">Segregación de funciones activa: la aprobación técnica, firma digital y emisión de certificaciones se realizan exclusivamente desde el Panel del Contador Matriculado en <strong>www.doncontador.com.ar/profesional</strong>.</p>';
      return;
    }

    var map = {
      operaciones: d.requests || [],
      profesionales: d.professionals || [],
      catalogo: d.services || [],
      clientes: d.users || [],
      finanzas: d.payments || [],
      legalizaciones: d.legalizations || [],
      entregables: d.deliverables || [],
      agenda: (d.appointments || []).concat(d.consultations || []),
      configuracion: Object.keys(d.settings || {}).map(function (key) { return { clave: key, valor: JSON.stringify(d.settings[key]) }; }),
      auditoria: d.auditLogs || []
    };

    var rows = map[viewKey] || [];
    if (!rows.length) {
      body.innerHTML = banner + '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:18px;">Sin registros aún en <strong>' + esc(meta.label) + '</strong> (datos reales PostgreSQL).</div>';
      return;
    }

    var cols = Object.keys(rows[0]).slice(0, 6);
    body.innerHTML = banner +
      '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
      cols.map(function (c) { return '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">' + esc(c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.slice(0, 60).map(function (r) {
        return '<tr>' + cols.map(function (c) {
          var v = r[c];
          if (v && typeof v === 'object') v = JSON.stringify(v);
          return '<td style="padding:8px;border-bottom:1px solid #f0f4f8;max-width:260px;overflow:hidden;text-overflow:ellipsis;">' + esc(v) + '</td>';
        }).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  async function openDcView(viewKey) {
    ensureSections();
    hideAllErpSections();
    STATE.view = viewKey || 'menu';
    STATE.feedback = '';
    if (STATE.view === 'menu') {
      renderSubmodulesMenu();
      document.getElementById('sec-menu-doncontador').hidden = false;
      reloadData();
      return;
    }
    document.getElementById('sec-doncontador-detail').hidden = false;
    if (!STATE.data) {
      renderDetailView(STATE.view);
      await reloadData();
    }
    renderDetailView(STATE.view);
  }

  function syncHomeCard() {
    var allowed = isGeneralAdmin();
    var grid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-doncontador-home-card');
    if (allowed && grid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-doncontador-home-card';
      card.className = 'module-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
            '<polyline points="14 2 14 8 20 8"></polyline>' +
            '<path d="M9 15l2 2 4-4"></path>' +
          '</svg>' +
        '</div>' +
        '<h3>Don Contador</h3>';
      card.addEventListener('click', function () { openDcView('menu'); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openDcView('menu'); }
      });
      var faCard = document.getElementById('ms-feriarte-home-card') || document.getElementById('ms-superadmin-home-card');
      if (faCard && faCard.nextSibling) {
        grid.insertBefore(card, faCard.nextSibling);
      } else {
        grid.appendChild(card);
      }
    } else if (existing) {
      existing.hidden = !allowed;
      existing.style.display = allowed ? '' : 'none';
    }
  }

  setInterval(syncHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncHomeCard);
})();
