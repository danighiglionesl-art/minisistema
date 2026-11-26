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

  var ADMIN_REQ_STATUSES = [
    ['recibida', 'Recibida'],
    ['en_revision_documental', 'En revisión documental'],
    ['pendiente_documentacion_adicional', 'Pendiente documentación adicional'],
    ['documentacion_completa', 'Documentación completa'],
    ['presupuesto_pendiente_aceptacion', 'Presupuesto pendiente aceptación'],
    ['pendiente_pago', 'Pendiente de pago'],
    ['asignada_profesional', 'Asignada a profesional'],
    ['suspendida', 'Suspendida'],
    ['cancelada', 'Cancelada']
  ];

  var STATE = {
    view: 'menu',
    data: null,
    loading: false,
    feedback: '',
    isError: false,
    catalogQuery: '',
    catalogFilter: 'all',
    opsFilter: 'all'
  };

  var fmtArs = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  });

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(val) {
    if (!val) return '—';
    try {
      var d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_e) {
      return String(val);
    }
  }

  function isGeneralAdmin() {
    var isBaseTenant = Boolean(
      (window.__ERP_TENANT_BOOT__ && window.__ERP_TENANT_BOOT__.isBase) ||
      (window.ERP_BRAND && window.ERP_BRAND.isBase)
    );
    if (!isBaseTenant) return false;
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
    return u === 'danielg';
  }

  function getApiBase() {
    var boot = window.__ERP_TENANT_BOOT__;
    if (boot && !boot.isBase && boot.optionType === 2 && boot.slug) {
      return '/' + encodeURIComponent(boot.slug) + '/api/don_contador';
    }
    return '/sistema/api/don_contador';
  }

  async function apiDc(method, payload) {
    var opts = {
      method: method || 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    };
    if (payload) opts.body = JSON.stringify(payload);
    var res = await fetch(getApiBase(), opts);
    return res.json();
  }

  function hideAllErpSections() {
    document.querySelectorAll('.erp-main > .erp-section, section.erp-section').forEach(function (s) {
      s.hidden = true;
    });
  }

  function closeToHome() {
    hideAllErpSections();
    var home = document.getElementById('sec-inicio');
    if (home) home.hidden = false;
    var backBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backBtn) backBtn.hidden = true;
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    if (topbarModInd) topbarModInd.hidden = true;
  }

  function ensureSections() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var secMenu = document.getElementById('sec-menu-doncontador');
    if (secMenu && secMenu.parentNode !== erpMain) {
      erpMain.appendChild(secMenu);
    }
    if (!secMenu) {
      secMenu = document.createElement('section');
      secMenu.id = 'sec-menu-doncontador';
      secMenu.className = 'erp-section';
      secMenu.hidden = true;
      secMenu.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="dc-back-home">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">Administrador General · <strong>Don Contador</strong></span>' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" id="dc-submodules-grid" aria-label="Submódulos de Don Contador"></div>';
      erpMain.appendChild(secMenu);
      secMenu.querySelector('#dc-back-home').addEventListener('click', closeToHome);
    }

    var secDetail = document.getElementById('sec-doncontador-detail');
    if (secDetail && secDetail.parentNode !== erpMain) {
      erpMain.appendChild(secDetail);
    }
    if (!secDetail) {
      secDetail = document.createElement('section');
      secDetail.id = 'sec-doncontador-detail';
      secDetail.className = 'erp-section';
      secDetail.hidden = true;
      secDetail.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="dc-back-menu">← Volver a Don Contador</button>' +
            '<span class="module-breadcrumb" id="dc-detail-breadcrumb">Don Contador</span>' +
          '</div>' +
          '<button type="button" id="dc-refresh-btn" style="padding:6px 12px;border-radius:8px;border:1px solid #D6E4EE;background:#fff;color:#205578;font-size:12px;font-weight:700;cursor:pointer;">Actualizar datos</button>' +
        '</div>' +
        '<div id="dc-detail-body" style="padding:1rem 0;"></div>';
      erpMain.appendChild(secDetail);
      secDetail.querySelector('#dc-back-menu').addEventListener('click', function () {
        openDcView('menu');
      });
      secDetail.querySelector('#dc-refresh-btn').addEventListener('click', async function () {
        STATE.feedback = '';
        STATE.isError = false;
        await reloadData();
        renderDetailView(STATE.view);
      });
    }

    return { menuSec: secMenu, detailSec: secDetail };
  }

  function bindGlobalNavIntegration() {
    if (window.__MS_DC_NAV_BOUND__) return;
    window.__MS_DC_NAV_BOUND__ = true;

    document.addEventListener('click', function (ev) {
      var target = ev.target;
      if (!target || typeof target.closest !== 'function') return;

      var navEl = target.closest(
        '#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-feriarte-home-card, #ms-reikionline-home-card, #ms-cv-home-card, #ms-personal-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card'
      );
      if (!navEl) return;

      var menuSec = document.getElementById('sec-menu-doncontador');
      var detailSec = document.getElementById('sec-doncontador-detail');
      var isDcActive = (menuSec && !menuSec.hidden) || (detailSec && !detailSec.hidden);

      if (navEl.id === 'btn-topbar-back-facturacion' && isDcActive) {
        ev.preventDefault();
        ev.stopPropagation();
        if (detailSec && !detailSec.hidden) {
          openDcView('menu');
        } else {
          closeToHome();
        }
        return;
      }

      if (menuSec) menuSec.hidden = true;
      if (detailSec) detailSec.hidden = true;
    }, true);
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
      if (res && res.ok) {
        STATE.data = res;
      } else {
        STATE.feedback = (res && res.message) || 'No se pudo consultar Don Contador.';
        STATE.isError = true;
      }
    } catch (_e) {
      STATE.feedback = 'No se pudo conectar con Don Contador.';
      STATE.isError = true;
    } finally {
      STATE.loading = false;
    }
  }

  async function runAction(payload, targetView) {
    try {
      var res = await apiDc('POST', payload);
      STATE.feedback = (res && res.message) || (res && res.ok ? 'Actualizado correctamente.' : 'No se pudo completar la operación.');
      STATE.isError = !(res && res.ok);
    } catch (_e) {
      STATE.feedback = 'Error de red al guardar los cambios.';
      STATE.isError = true;
    }
    await reloadData();
    renderDetailView(targetView || STATE.view);
  }

  function buildLookups(d) {
    var usersById = {};
    (d.users || []).forEach(function (u) { usersById[u.id] = u; });
    var prosById = {};
    (d.professionals || []).forEach(function (p) { prosById[p.id] = p; });
    var servicesById = {};
    (d.services || []).forEach(function (s) { servicesById[s.id] = s; });
    var orgsById = {};
    (d.organizations || []).forEach(function (o) { orgsById[o.id] = o; });
    var reqsById = {};
    (d.requests || []).forEach(function (r) { reqsById[r.id] = r; });
    return {
      usersById: usersById,
      prosById: prosById,
      servicesById: servicesById,
      orgsById: orgsById,
      reqsById: reqsById
    };
  }

  function renderDetailView(viewKey) {
    var body = document.getElementById('dc-detail-body');
    var bc = document.getElementById('dc-detail-breadcrumb');
    var meta = SUBMODULES.find(function (s) { return s.key === viewKey; }) || SUBMODULES[0];
    if (bc) bc.innerHTML = 'Don Contador · <strong>' + esc(meta.label) + '</strong>';
    if (!body) return;

    if (STATE.loading && !STATE.data) {
      body.innerHTML = '<div style="padding:16px;background:#fff;border-radius:12px;border:1px solid #D6E4EE;">Cargando datos reales de Don Contador...</div>';
      return;
    }
    if (!STATE.data) {
      body.innerHTML =
        '<div style="background:#fff;border-radius:12px;padding:18px;border:1px solid #f5c2c7;color:#842029;font-weight:700;">' +
          esc(STATE.feedback || 'No se pudieron cargar los datos de Don Contador. Verificá tu sesión de Administrador General.') +
        '</div>';
      return;
    }

    var d = STATE.data;
    if (d.schemaPending) {
      body.innerHTML = '<div style="padding:18px;background:#fff7ed;border:1px solid #fdba74;border-radius:12px;color:#9a3412;">' + esc(d.message) + '</div>';
      return;
    }

    var k = d.kpis || {};
    var look = buildLookups(d);
    var banner = STATE.feedback
      ? '<div style="margin-bottom:14px;padding:10px 14px;border-radius:10px;background:' + (STATE.isError ? '#fef2f2' : '#EBF4FA') + ';border:1px solid ' + (STATE.isError ? '#fecaca' : '#8CC9F1') + ';color:' + (STATE.isError ? '#991b1b' : '#205578') + ';font-weight:700;font-size:13px;">' + esc(STATE.feedback) + '</div>'
      : '';

    /* ==================== 1. PANEL GENERAL / INDICADORES ==================== */
    if (viewKey === 'panel' || viewKey === 'indicadores') {
      var alerts = [];
      if ((k.pendingTransfersCount || 0) > 0) {
        alerts.push(
          '<div style="padding:12px 16px;border-radius:12px;background:#fff7ed;border:1px solid #fb923c;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;">' +
            '<span style="font-size:13px;color:#9a3412;">Hay <strong>' + esc(k.pendingTransfersCount) + '</strong> transferencia(s) bancaria(s) pendientes de conciliación.</span>' +
            '<button type="button" data-dc-jump="finanzas" style="padding:7px 12px;border:none;border-radius:8px;background:#205578;color:#fff;font-weight:700;cursor:pointer;font-size:12px;">Conciliar en Finanzas →</button>' +
          '</div>'
        );
      }
      if ((k.licensesPending || 0) > 0) {
        alerts.push(
          '<div style="padding:12px 16px;border-radius:12px;background:#EBF4FA;border:1px solid #8CC9F1;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;">' +
            '<span style="font-size:13px;color:#205578;">Hay <strong>' + esc(k.licensesPending) + '</strong> matrícula(s) CPCE esperando verificación administrativa.</span>' +
            '<button type="button" data-dc-jump="profesionales" style="padding:7px 12px;border:none;border-radius:8px;background:#087FCB;color:#fff;font-weight:700;cursor:pointer;font-size:12px;">Verificar Matrículas →</button>' +
          '</div>'
        );
      }
      if ((k.orgMembersPending || 0) > 0) {
        alerts.push(
          '<div style="padding:12px 16px;border-radius:12px;background:#EBF4FA;border:1px solid #8CC9F1;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;">' +
            '<span style="font-size:13px;color:#205578;">Hay <strong>' + esc(k.orgMembersPending) + '</strong> representación(es) societaria(s) pendientes de autorización.</span>' +
            '<button type="button" data-dc-jump="clientes" style="padding:7px 12px;border:none;border-radius:8px;background:#087FCB;color:#fff;font-weight:700;cursor:pointer;font-size:12px;">Revisar Empresas →</button>' +
          '</div>'
        );
      }

      var cards = [
        ['Clientes registrados', k.clientsRegistered || 0],
        ['Empresas registradas', k.organizationsRegistered || 0],
        ['Profesionales activos', k.professionalsActive || 0],
        ['Servicios en catálogo', (k.servicesEnabledCount || 0) + ' / ' + (k.servicesCatalogCount || 0) + ' hab.'],
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
        (alerts.length ? '<div style="display:grid;gap:10px;margin-bottom:14px;">' + alerts.join('') + '</div>' : '') +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">' +
        cards.map(function (c) {
          return '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:14px;">' +
            '<div style="font-size:12px;color:#4B677B;font-weight:700;">' + esc(c[0]) + '</div>' +
            '<div style="font-size:20px;font-weight:900;color:#205578;margin-top:4px;">' + esc(c[1]) + '</div>' +
          '</div>';
        }).join('') +
        '</div>' +
        '<div style="margin-top:14px;background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:14px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;">' +
          '<p style="margin:0;font-size:12px;color:#4B677B;max-width:740px;"><strong>Segregación de funciones activa:</strong> desde MiniSistema se gestionan expedientes, asignaciones, catálogo, matrículas, presupuestos, transferencias, clientes y configuración legal. La aprobación técnica, firma digital y emisión de certificaciones se realizan exclusivamente desde el Panel del Contador Matriculado.</p>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            '<a href="https://www.doncontador.com.ar/profesional" target="_blank" rel="noopener noreferrer" style="padding:7px 12px;border-radius:8px;background:#205578;color:#fff;font-size:12px;font-weight:700;text-decoration:none;">Panel Profesional ↗</a>' +
            '<a href="https://www.doncontador.com.ar" target="_blank" rel="noopener noreferrer" style="padding:7px 12px;border-radius:8px;border:1px solid #205578;color:#205578;font-size:12px;font-weight:700;text-decoration:none;">Abrir Don Contador ↗</a>' +
          '</div>' +
        '</div>';

      body.querySelectorAll('[data-dc-jump]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openDcView(btn.getAttribute('data-dc-jump'));
        });
      });
      return;
    }

    /* ==================== 2. OPERACIONES (EXPEDIENTES) ==================== */
    if (viewKey === 'operaciones') {
      var allReqs = d.requests || [];
      var filteredReqs = allReqs.filter(function (r) {
        if (STATE.opsFilter === 'all') return true;
        if (STATE.opsFilter === 'unassigned') return !r.assigned_professional_id;
        if (STATE.opsFilter === 'active') return !['borrador', 'finalizada', 'cancelada', 'rechazada'].includes(r.status);
        return r.status === STATE.opsFilter;
      });
      var pros = d.professionals || [];

      var reqRows = filteredReqs.map(function (r) {
        var client = look.usersById[r.client_user_id];
        var svc = look.servicesById[r.service_id];
        var proOptions = '<option value="">Sin asignar...</option>' + pros.map(function (p) {
          var sel = p.id === r.assigned_professional_id ? ' selected' : '';
          return '<option value="' + esc(p.id) + '"' + sel + '>' + esc(p.full_name) + (p.active ? '' : ' (inactivo)') + '</option>';
        }).join('');

        var isAdminEditableStatus = ADMIN_REQ_STATUSES.some(function (pair) { return pair[0] === r.status; }) || r.status === 'borrador' || r.status === 'solicitud_enviada';
        var statusSelectHtml = isAdminEditableStatus
          ? '<select data-req-status-sel="' + esc(r.id) + '" style="padding:5px 7px;border-radius:6px;border:1px solid #cbd5e1;font-size:12px;background:#fff;">' +
              '<option value="' + esc(r.status) + '" selected>' + esc(r.status) + '</option>' +
              ADMIN_REQ_STATUSES.filter(function (pair) { return pair[0] !== r.status; }).map(function (pair) {
                return '<option value="' + esc(pair[0]) + '">' + esc(pair[1]) + '</option>';
              }).join('') +
            '</select>'
          : '<span style="font-size:11px;font-weight:700;color:#205578;background:#EBF4FA;padding:4px 8px;border-radius:6px;display:inline-block;">' + esc(r.status) + ' (técnico)</span>';

        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' +
            '<div style="font-family:monospace;font-weight:800;color:#087FCB;">' + esc(r.request_number) + '</div>' +
            '<div style="font-size:11px;color:#4B677B;">' + esc(fmtDate(r.updated_at || r.created_at)) + '</div>' +
          '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' +
            '<div style="font-weight:700;color:#205578;">' + esc(client ? client.full_name : r.client_user_id) + '</div>' +
            '<div style="font-size:11px;color:#4B677B;">' + esc(client ? client.email : '') + '</div>' +
          '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;max-width:220px;">' +
            '<div style="font-weight:700;color:#163B54;">' + esc(svc ? (svc.code + ' · ' + svc.commercial_name) : r.service_id) + '</div>' +
            '<div style="font-size:11px;color:#4B677B;">Dest.: ' + esc(r.recipient_name || '—') + ' · Pago: <strong>' + esc(r.payment_status) + '</strong></div>' +
          '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + statusSelectHtml + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' +
            '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">' +
              '<select data-req-pro-sel="' + esc(r.id) + '" style="padding:5px 7px;border-radius:6px;border:1px solid #cbd5e1;font-size:12px;background:#fff;max-width:190px;">' + proOptions + '</select>' +
              '<button type="button" data-req-assign-btn="' + esc(r.id) + '" style="padding:5px 10px;border:none;border-radius:6px;background:#205578;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Asignar</button>' +
              '<a href="https://www.doncontador.com.ar/oficina/solicitudes/' + encodeURIComponent(r.id) + '" target="_blank" rel="noopener noreferrer" style="font-size:11px;font-weight:700;color:#087FCB;text-decoration:none;">Ver ↗</a>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="display:grid;gap:14px;">' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:12px 16px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;">' +
            '<div style="font-size:13px;color:#205578;"><strong>Expedientes y asignación profesional</strong> (' + esc(filteredReqs.length) + ' de ' + esc(allReqs.length) + ')</div>' +
            '<div style="display:flex;gap:8px;align-items:center;">' +
              '<label style="font-size:12px;font-weight:700;color:#4B677B;">Filtrar:</label>' +
              '<select id="dc-ops-filter" style="padding:6px 10px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                '<option value="all"' + (STATE.opsFilter === 'all' ? ' selected' : '') + '>Todos</option>' +
                '<option value="unassigned"' + (STATE.opsFilter === 'unassigned' ? ' selected' : '') + '>Sin profesional asignado</option>' +
                '<option value="active"' + (STATE.opsFilter === 'active' ? ' selected' : '') + '>En curso</option>' +
                '<option value="pendiente_documentacion_adicional"' + (STATE.opsFilter === 'pendiente_documentacion_adicional' ? ' selected' : '') + '>Pendiente documentación</option>' +
                '<option value="pendiente_pago"' + (STATE.opsFilter === 'pendiente_pago' ? ' selected' : '') + '>Pendiente de pago</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Expediente</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Cliente</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Actuación</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Estado administrativo</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Contador asignado</th>' +
            '</tr></thead><tbody>' +
              (reqRows || '<tr><td colspan="5" style="padding:14px;color:#4B677B;">Sin solicitudes que coincidan con el filtro seleccionado.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>';

      var opsFilterEl = document.getElementById('dc-ops-filter');
      if (opsFilterEl) {
        opsFilterEl.addEventListener('change', function () {
          STATE.opsFilter = opsFilterEl.value;
          renderDetailView('operaciones');
        });
      }

      body.querySelectorAll('[data-req-assign-btn]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var reqId = btn.getAttribute('data-req-assign-btn');
          var sel = body.querySelector('[data-req-pro-sel="' + reqId + '"]');
          var proId = sel ? sel.value : '';
          if (!proId) {
            STATE.feedback = 'Seleccioná un Contador Público antes de asignar.';
            STATE.isError = true;
            renderDetailView('operaciones');
            return;
          }
          runAction({ action: 'assign_professional', requestId: reqId, professionalId: proId }, 'operaciones');
        });
      });

      body.querySelectorAll('[data-req-status-sel]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var reqId = sel.getAttribute('data-req-status-sel');
          runAction({ action: 'update_request_status', requestId: reqId, status: sel.value }, 'operaciones');
        });
      });
      return;
    }

    /* ==================== 3. PROFESIONALES Y MATRÍCULAS ==================== */
    if (viewKey === 'profesionales') {
      var prosList = d.professionals || [];
      var licsList = d.licenses || [];
      var proUserIds = {};
      prosList.forEach(function (p) { proUserIds[p.user_id] = true; });
      var candidateUsers = (d.users || []).filter(function (u) { return !proUserIds[u.id]; });

      var proRows = prosList.map(function (p) {
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(p.full_name) + '</strong><br><small style="color:#4B677B;">' + esc(p.degree_title || 'Contador Público') + (p.university ? ' · ' + esc(p.university) : '') + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(p.professional_email || '—') + '<br><small style="color:#4B677B;">' + esc(p.professional_phone || '') + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + (p.active ? '<span style="color:#0f766e;font-weight:700;">Activo</span>' : '<span style="color:#991b1b;font-weight:700;">Inactivo</span>') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + (p.accepts_assignments ? 'Sí (máx. ' + esc(p.max_concurrent_requests || 25) + ')' : 'Pausado') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;display:flex;gap:6px;flex-wrap:wrap;">' +
            '<button type="button" data-pro-toggle-active="' + esc(p.id) + '" data-next="' + (p.active ? '0' : '1') + '" style="padding:5px 9px;border:none;border-radius:6px;background:' + (p.active ? '#e2e8f0;color:#205578' : '#205578;color:#fff') + ';font-size:11px;font-weight:700;cursor:pointer;">' + (p.active ? 'Desactivar' : 'Activar') + '</button>' +
            '<button type="button" data-pro-toggle-assign="' + esc(p.id) + '" data-next="' + (p.accepts_assignments ? '0' : '1') + '" style="padding:5px 9px;border:none;border-radius:6px;background:#087FCB;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">' + (p.accepts_assignments ? 'Pausar asign.' : 'Recibir asign.') + '</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      var licRows = licsList.map(function (l) {
        var pro = look.prosById[l.professional_id];
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(pro ? pro.full_name : l.professional_id) + '</strong></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(l.council_name) + ' (' + esc(l.jurisdiction) + ')</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><code>' + esc(l.license_number) + '</code>' + (l.tomo || l.folio ? ' <small>T° ' + esc(l.tomo || '—') + ' F° ' + esc(l.folio || '—') + '</small>' : '') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(l.habilitation_status) + '</strong>' + (l.valid_until ? '<br><small>Vto: ' + esc(l.valid_until) + '</small>' : '') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;display:flex;gap:6px;flex-wrap:wrap;">' +
            '<button type="button" data-lic-id="' + esc(l.id) + '" data-lic-st="habilitada" style="padding:5px 9px;border:none;border-radius:6px;background:#0f766e;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Habilitar</button>' +
            '<button type="button" data-lic-id="' + esc(l.id) + '" data-lic-st="suspendida" style="padding:5px 9px;border:none;border-radius:6px;background:#dc2626;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Suspender</button>' +
            '<button type="button" data-lic-id="' + esc(l.id) + '" data-lic-st="vencida" style="padding:5px 9px;border:none;border-radius:6px;background:#d97706;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Vencida</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="display:grid;gap:16px;">' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;">' +
            '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;">' +
              '<h3 style="margin:0 0 10px;color:#205578;font-size:15px;">Alta de Contador Público Matriculado</h3>' +
              '<form id="dc-create-pro-form" style="display:grid;gap:8px;">' +
                '<select name="userId" required style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                  '<option value="">Seleccionar usuario registrado en Don Contador...</option>' +
                  candidateUsers.map(function (u) {
                    return '<option value="' + esc(u.id) + '">' + esc(u.full_name) + ' (' + esc(u.email) + ')</option>';
                  }).join('') +
                '</select>' +
                '<input name="fullName" required minlength="3" placeholder="Nombre y apellido profesional *" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                  '<input name="degreeTitle" value="Contador Público" placeholder="Título" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                  '<input name="university" placeholder="Universidad (ej. UNC)" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                  '<input name="professionalEmail" type="email" placeholder="Email profesional" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                  '<input name="licenseNumber" placeholder="N° Matrícula CPCE (opcional)" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                '</div>' +
                '<button type="submit" style="padding:9px 14px;border:none;border-radius:8px;background:#205578;color:#fff;font-weight:800;cursor:pointer;font-size:12px;">Registrar Profesional</button>' +
              '</form>' +
            '</div>' +
            '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;">' +
              '<h3 style="margin:0 0 10px;color:#205578;font-size:15px;">Agregar Matrícula CPCE</h3>' +
              '<form id="dc-add-lic-form" style="display:grid;gap:8px;">' +
                '<select name="professionalId" required style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                  '<option value="">Seleccionar profesional...</option>' +
                  prosList.map(function (p) {
                    return '<option value="' + esc(p.id) + '">' + esc(p.full_name) + '</option>';
                  }).join('') +
                '</select>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                  '<input name="councilName" value="CPCE Córdoba" required placeholder="Consejo" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                  '<input name="jurisdiction" value="Córdoba" required placeholder="Jurisdicción" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;">' +
                  '<input name="licenseNumber" required placeholder="N° Matrícula *" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                  '<input name="tomo" placeholder="Tomo" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                  '<input name="folio" placeholder="Folio" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                  '<select name="habilitationStatus" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                    '<option value="habilitada">Habilitada</option>' +
                    '<option value="pending_verification">Pendiente verificación</option>' +
                  '</select>' +
                  '<input name="validUntil" type="date" style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                '</div>' +
                '<button type="submit" style="padding:9px 14px;border:none;border-radius:8px;background:#087FCB;color:#fff;font-weight:800;cursor:pointer;font-size:12px;">Guardar Matrícula</button>' +
              '</form>' +
            '</div>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
            '<h3 style="margin:0 0 10px;color:#205578;font-size:15px;">Contadores Públicos registrados (' + esc(prosList.length) + ')</h3>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Profesional</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Contacto</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Estado</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Asignaciones</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Acciones</th>' +
            '</tr></thead><tbody>' +
              (proRows || '<tr><td colspan="5" style="padding:12px;color:#4B677B;">Sin profesionales registrados aún.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
            '<h3 style="margin:0 0 10px;color:#205578;font-size:15px;">Matrículas y Habilitaciones CPCE (' + esc(licsList.length) + ')</h3>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Profesional</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Consejo</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Matrícula</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Habilitación</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Verificación</th>' +
            '</tr></thead><tbody>' +
              (licRows || '<tr><td colspan="5" style="padding:12px;color:#4B677B;">Sin matrículas cargadas aún.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>';

      var createProForm = document.getElementById('dc-create-pro-form');
      if (createProForm) {
        createProForm.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(createProForm);
          runAction({
            action: 'create_professional',
            userId: String(fd.get('userId') || ''),
            fullName: String(fd.get('fullName') || ''),
            degreeTitle: String(fd.get('degreeTitle') || 'Contador Público'),
            university: String(fd.get('university') || ''),
            professionalEmail: String(fd.get('professionalEmail') || ''),
            licenseNumber: String(fd.get('licenseNumber') || '')
          }, 'profesionales');
        });
      }

      var addLicForm = document.getElementById('dc-add-lic-form');
      if (addLicForm) {
        addLicForm.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(addLicForm);
          runAction({
            action: 'add_license',
            professionalId: String(fd.get('professionalId') || ''),
            councilName: String(fd.get('councilName') || 'CPCE Córdoba'),
            jurisdiction: String(fd.get('jurisdiction') || 'Córdoba'),
            licenseNumber: String(fd.get('licenseNumber') || ''),
            tomo: String(fd.get('tomo') || ''),
            folio: String(fd.get('folio') || ''),
            habilitationStatus: String(fd.get('habilitationStatus') || 'pending_verification'),
            validUntil: String(fd.get('validUntil') || '')
          }, 'profesionales');
        });
      }

      body.querySelectorAll('[data-pro-toggle-active]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          runAction({
            action: 'update_professional',
            professionalId: btn.getAttribute('data-pro-toggle-active'),
            active: btn.getAttribute('data-next') === '1'
          }, 'profesionales');
        });
      });

      body.querySelectorAll('[data-pro-toggle-assign]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          runAction({
            action: 'update_professional',
            professionalId: btn.getAttribute('data-pro-toggle-assign'),
            acceptsAssignments: btn.getAttribute('data-next') === '1'
          }, 'profesionales');
        });
      });

      body.querySelectorAll('[data-lic-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          runAction({
            action: 'verify_license',
            licenseId: btn.getAttribute('data-lic-id'),
            habilitationStatus: btn.getAttribute('data-lic-st')
          }, 'profesionales');
        });
      });
      return;
    }

    /* ==================== 4. CATÁLOGO 45 SERVICIOS ==================== */
    if (viewKey === 'catalogo') {
      var allServices = d.services || [];
      var q = STATE.catalogQuery.trim().toLowerCase();
      var filteredSvc = allServices.filter(function (s) {
        if (STATE.catalogFilter !== 'all' && s.commercial_status !== STATE.catalogFilter) return false;
        if (!q) return true;
        return (
          String(s.code || '').toLowerCase().indexOf(q) !== -1 ||
          String(s.commercial_name || '').toLowerCase().indexOf(q) !== -1 ||
          String(s.technical_name || '').toLowerCase().indexOf(q) !== -1
        );
      });

      var svcRows = filteredSvc.map(function (s) {
        return '<tr data-svc-row="' + esc(s.id) + '">' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;font-weight:800;color:#205578;">' + esc(s.code) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;min-width:210px;">' +
            '<div style="font-weight:700;color:#163B54;">' + esc(s.commercial_name) + '</div>' +
            '<div style="font-size:11px;color:#4B677B;">' + esc(s.act_type) + ' · ' + esc(s.jurisdiction) + '</div>' +
          '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' +
            '<select data-svc-field="commercialStatus" style="padding:5px;border-radius:6px;border:1px solid #cbd5e1;font-size:11px;">' +
              '<option value="consultar_disponibilidad"' + (s.commercial_status === 'consultar_disponibilidad' ? ' selected' : '') + '>Consultar disponibilidad</option>' +
              '<option value="habilitado_contratacion"' + (s.commercial_status === 'habilitado_contratacion' ? ' selected' : '') + '>Habilitado contratación</option>' +
              '<option value="pausado"' + (s.commercial_status === 'pausado' ? ' selected' : '') + '>Pausado</option>' +
            '</select>' +
          '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' +
            '<select data-svc-field="validityStatus" style="padding:5px;border-radius:6px;border:1px solid #cbd5e1;font-size:11px;">' +
              '<option value="pendiente_validacion"' + (s.validity_status === 'pendiente_validacion' ? ' selected' : '') + '>Pendiente validación</option>' +
              '<option value="vigente_verificado"' + (s.validity_status === 'vigente_verificado' ? ' selected' : '') + '>Vigente verificado</option>' +
              '<option value="en_revision"' + (s.validity_status === 'en_revision' ? ' selected' : '') + '>En revisión</option>' +
              '<option value="discontinuado"' + (s.validity_status === 'discontinuado' ? ' selected' : '') + '>Discontinuado</option>' +
            '</select>' +
          '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' +
            '<input data-svc-field="baseFeeArs" type="number" min="0" step="1000" value="' + esc(s.base_fee_ars != null ? s.base_fee_ars : '') + '" placeholder="ARS" style="width:95px;padding:5px;border-radius:6px;border:1px solid #cbd5e1;font-size:11px;">' +
          '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' +
            '<input data-svc-field="estimatedLegalizationFeeArs" type="number" min="0" step="500" value="' + esc(s.estimated_legalization_fee_ars != null ? s.estimated_legalization_fee_ars : '') + '" placeholder="ARS" style="width:90px;padding:5px;border-radius:6px;border:1px solid #cbd5e1;font-size:11px;">' +
          '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' +
            '<button type="button" data-svc-save="' + esc(s.id) + '" style="padding:5px 10px;border:none;border-radius:6px;background:#205578;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Guardar</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="display:grid;gap:14px;">' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:12px 16px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;">' +
            '<div style="font-size:13px;color:#205578;"><strong>Catálogo de Actuaciones</strong> (' + esc(filteredSvc.length) + ' de ' + esc(allServices.length) + ')</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
              '<input id="dc-cat-search" type="search" value="' + esc(STATE.catalogQuery) + '" placeholder="Buscar por código o nombre..." style="padding:6px 10px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;min-width:210px;">' +
              '<select id="dc-cat-filter" style="padding:6px 10px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
                '<option value="all"' + (STATE.catalogFilter === 'all' ? ' selected' : '') + '>Todos los estados</option>' +
                '<option value="habilitado_contratacion"' + (STATE.catalogFilter === 'habilitado_contratacion' ? ' selected' : '') + '>Habilitados</option>' +
                '<option value="consultar_disponibilidad"' + (STATE.catalogFilter === 'consultar_disponibilidad' ? ' selected' : '') + '>Consultar disponibilidad</option>' +
                '<option value="pausado"' + (STATE.catalogFilter === 'pausado' ? ' selected' : '') + '>Pausados</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Cód.</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Servicio</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Habilitación comercial</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Vigencia normativa</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Honorario base</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Legaliz. est.</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Acción</th>' +
            '</tr></thead><tbody>' +
              (svcRows || '<tr><td colspan="7" style="padding:14px;color:#4B677B;">Sin servicios encontrados.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>';

      var searchEl = document.getElementById('dc-cat-search');
      if (searchEl) {
        searchEl.addEventListener('input', function () {
          STATE.catalogQuery = searchEl.value;
          renderDetailView('catalogo');
          var again = document.getElementById('dc-cat-search');
          if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
        });
      }
      var filterEl = document.getElementById('dc-cat-filter');
      if (filterEl) {
        filterEl.addEventListener('change', function () {
          STATE.catalogFilter = filterEl.value;
          renderDetailView('catalogo');
        });
      }

      body.querySelectorAll('[data-svc-save]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-svc-save');
          var row = body.querySelector('[data-svc-row="' + id + '"]');
          if (!row) return;
          var commercialStatus = row.querySelector('[data-svc-field="commercialStatus"]').value;
          var validityStatus = row.querySelector('[data-svc-field="validityStatus"]').value;
          var baseFeeArs = row.querySelector('[data-svc-field="baseFeeArs"]').value;
          var estimatedLegalizationFeeArs = row.querySelector('[data-svc-field="estimatedLegalizationFeeArs"]').value;
          runAction({
            action: 'update_service_status',
            serviceId: id,
            commercialStatus: commercialStatus,
            validityStatus: validityStatus,
            baseFeeArs: baseFeeArs,
            estimatedLegalizationFeeArs: estimatedLegalizationFeeArs
          }, 'catalogo');
        });
      });
      return;
    }

    /* ==================== 5. CLIENTES Y EMPRESAS ==================== */
    if (viewKey === 'clientes') {
      var usersList = d.users || [];
      var orgsList = d.organizations || [];
      var orgMembersList = d.organizationMembers || [];

      var userRows = usersList.map(function (u) {
        var rolesTxt = (u.roles || []).map(function (r) { return r.role; }).join(', ') || 'cliente';
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(u.full_name) + '</strong><br><small style="color:#4B677B;">' + esc(u.email) + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(u.phone || '—') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><code>' + esc(rolesTxt) + '</code></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + (u.email_verified_at ? '<span style="color:#0f766e;font-weight:700;">Verificado</span>' : '<span style="color:#b45309;">Pendiente</span>') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(u.status) + '</strong></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;display:flex;gap:6px;">' +
            (u.status !== 'active'
              ? '<button type="button" data-usr-id="' + esc(u.id) + '" data-usr-st="active" style="padding:5px 9px;border:none;border-radius:6px;background:#0f766e;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Activar</button>'
              : '<button type="button" data-usr-id="' + esc(u.id) + '" data-usr-st="suspended" style="padding:5px 9px;border:none;border-radius:6px;background:#dc2626;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Suspender</button>') +
          '</td>' +
        '</tr>';
      }).join('');

      var memberRows = orgMembersList.map(function (m) {
        var org = look.orgsById[m.organization_id];
        var usr = look.usersById[m.user_id];
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(org ? org.legal_name : m.organization_id) + '</strong><br><small>CUIT: ' + esc(org ? org.cuit : '—') + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(usr ? usr.full_name : m.user_id) + '<br><small>' + esc(usr ? usr.email : '') + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(m.role_in_org) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(m.authorization_status) + '</strong></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;display:flex;gap:6px;flex-wrap:wrap;">' +
            '<button type="button" data-mem-id="' + esc(m.id) + '" data-mem-st="approved" style="padding:5px 9px;border:none;border-radius:6px;background:#0f766e;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Aprobar</button>' +
            '<button type="button" data-mem-id="' + esc(m.id) + '" data-mem-st="rejected" style="padding:5px 9px;border:none;border-radius:6px;background:#dc2626;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Rechazar</button>' +
            '<button type="button" data-mem-id="' + esc(m.id) + '" data-mem-st="revoked" style="padding:5px 9px;border:none;border-radius:6px;background:#64748b;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Revocar</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="display:grid;gap:16px;">' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
            '<h3 style="margin:0 0 10px;color:#205578;font-size:15px;">Representaciones Societarias (' + esc(orgMembersList.length) + ' · ' + esc(orgsList.length) + ' empresas)</h3>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Empresa</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Usuario</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Rol societario</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Estado</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Autorización</th>' +
            '</tr></thead><tbody>' +
              (memberRows || '<tr><td colspan="5" style="padding:12px;color:#4B677B;">Sin solicitudes de representación societaria aún.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
            '<h3 style="margin:0 0 10px;color:#205578;font-size:15px;">Usuarios Registrados (' + esc(usersList.length) + ')</h3>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Usuario</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Teléfono</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Roles</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Email</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Estado</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Acción</th>' +
            '</tr></thead><tbody>' +
              (userRows || '<tr><td colspan="6" style="padding:12px;color:#4B677B;">Sin usuarios registrados aún.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>';

      body.querySelectorAll('[data-usr-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          runAction({
            action: 'update_user_status',
            userId: btn.getAttribute('data-usr-id'),
            status: btn.getAttribute('data-usr-st')
          }, 'clientes');
        });
      });

      body.querySelectorAll('[data-mem-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          runAction({
            action: 'approve_org_membership',
            membershipId: btn.getAttribute('data-mem-id'),
            status: btn.getAttribute('data-mem-st')
          }, 'clientes');
        });
      });
      return;
    }

    /* ==================== 6. FINANZAS Y HONORARIOS ==================== */
    if (viewKey === 'finanzas') {
      var quotesList = d.quotes || [];
      var paymentsList = d.payments || [];
      var invoicesList = d.invoices || [];
      var reqOpts = (d.requests || []).map(function (r) {
        var cli = look.usersById[r.client_user_id];
        return '<option value="' + esc(r.id) + '">' + esc(r.request_number) + ' — ' + esc(cli ? cli.full_name : r.status) + '</option>';
      }).join('');

      var payRows = paymentsList.map(function (p) {
        var req = look.reqsById[p.request_id];
        var canManual = p.provider !== 'mercadopago' && p.status !== 'approved' && p.status !== 'rejected';
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(fmtArs.format(p.amount_ars || 0)) + '</strong><br><small>Hon: ' + esc(fmtArs.format(p.professional_fee_part_ars || 0)) + ' · Leg: ' + esc(fmtArs.format(p.legalization_part_ars || 0)) + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(req ? req.request_number : '—') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(p.provider) + '<br><small>Ref: ' + esc(p.transfer_reference || p.external_payment_id || '—') + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(p.status) + '</strong></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' +
            (canManual
              ? '<button type="button" data-pay-id="' + esc(p.id) + '" data-pay-dec="approved" style="margin-right:6px;padding:5px 9px;border:none;border-radius:6px;background:#0f766e;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Aprobar</button>' +
                '<button type="button" data-pay-id="' + esc(p.id) + '" data-pay-dec="rejected" style="padding:5px 9px;border:none;border-radius:6px;background:#dc2626;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Rechazar</button>'
              : (p.provider === 'mercadopago' ? '<small style="color:#4B677B;">Webhook automático</small>' : '<small style="color:#4B677B;">Conciliado</small>')) +
          '</td>' +
        '</tr>';
      }).join('');

      var quoteRows = quotesList.map(function (q) {
        var req = look.reqsById[q.request_id];
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(q.quote_number) + '</strong></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(req ? req.request_number : '—') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(fmtArs.format(q.professional_fee_ars || 0)) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(fmtArs.format(q.legalization_fee_ars || 0)) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(fmtArs.format(q.total_ars || 0)) + '</strong></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(q.status) + '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="display:grid;gap:16px;">' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;">' +
            '<h3 style="margin:0 0 10px;color:#205578;font-size:15px;">Emitir presupuesto discriminado (Honorarios + Legalización CPCE)</h3>' +
            '<form id="dc-quote-form" style="display:grid;gap:10px;">' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">' +
                '<label style="font-size:12px;font-weight:700;color:#205578;">Expediente *' +
                  '<select name="requestId" required style="width:100%;padding:8px;margin-top:4px;border-radius:8px;border:1px solid #cbd5e1;">' +
                    '<option value="">Seleccioná expediente...</option>' + reqOpts +
                  '</select>' +
                '</label>' +
                '<label style="font-size:12px;font-weight:700;color:#205578;">Honorarios profesionales (ARS)' +
                  '<input name="professionalFeeArs" type="number" min="0" step="500" value="85000" required style="width:100%;padding:8px;margin-top:4px;border-radius:8px;border:1px solid #cbd5e1;">' +
                '</label>' +
                '<label style="font-size:12px;font-weight:700;color:#205578;">Gastos de legalización CPCE (ARS)' +
                  '<input name="legalizationFeeArs" type="number" min="0" step="500" value="25000" required style="width:100%;padding:8px;margin-top:4px;border-radius:8px;border:1px solid #cbd5e1;">' +
                '</label>' +
                '<label style="font-size:12px;font-weight:700;color:#205578;">Impuestos / otros gastos (ARS)' +
                  '<input name="taxesAndExpensesArs" type="number" min="0" step="500" value="0" style="width:100%;padding:8px;margin-top:4px;border-radius:8px;border:1px solid #cbd5e1;">' +
                '</label>' +
              '</div>' +
              '<input name="description" required minlength="3" value="Honorarios profesionales y arancel de legalización CPCE Córdoba." style="padding:8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;">' +
              '<div><button type="submit" style="padding:9px 16px;border:none;border-radius:8px;background:#205578;color:#fff;font-weight:800;cursor:pointer;font-size:12px;">Emitir y enviar presupuesto al cliente</button></div>' +
            '</form>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
            '<h3 style="margin:0 0 10px;color:#205578;font-size:15px;">Pagos y conciliación de transferencias (' + esc(paymentsList.length) + ')</h3>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Importe</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Expediente</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Medio / Referencia</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Estado</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Conciliación</th>' +
            '</tr></thead><tbody>' +
              (payRows || '<tr><td colspan="5" style="padding:12px;color:#4B677B;">Sin pagos registrados aún.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
            '<h3 style="margin:0 0 10px;color:#205578;font-size:15px;">Presupuestos emitidos (' + esc(quotesList.length) + ') · Facturas (' + esc(invoicesList.length) + ')</h3>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Número</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Expediente</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Honorarios</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Legalización</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Total</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Estado</th>' +
            '</tr></thead><tbody>' +
              (quoteRows || '<tr><td colspan="6" style="padding:12px;color:#4B677B;">Sin presupuestos emitidos aún.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>';

      var quoteForm = document.getElementById('dc-quote-form');
      if (quoteForm) {
        quoteForm.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(quoteForm);
          runAction({
            action: 'create_quote',
            requestId: String(fd.get('requestId') || ''),
            professionalFeeArs: Number(fd.get('professionalFeeArs') || 0),
            legalizationFeeArs: Number(fd.get('legalizationFeeArs') || 0),
            taxesAndExpensesArs: Number(fd.get('taxesAndExpensesArs') || 0),
            description: String(fd.get('description') || '')
          }, 'finanzas');
        });
      }

      body.querySelectorAll('[data-pay-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          runAction({
            action: 'reconcile_payment',
            paymentId: btn.getAttribute('data-pay-id'),
            decision: btn.getAttribute('data-pay-dec')
          }, 'finanzas');
        });
      });
      return;
    }

    /* ==================== 7. AGENDA Y CONSULTAS ==================== */
    if (viewKey === 'agenda') {
      var consults = d.consultations || [];
      var appts = d.appointments || [];
      var prosAgenda = d.professionals || [];

      var consultRows = consults.map(function (c) {
        var cli = look.usersById[c.client_user_id];
        var proSelOpts = '<option value="">Sin asignar</option>' + prosAgenda.map(function (p) {
          return '<option value="' + esc(p.id) + '"' + (p.id === c.assigned_professional_id ? ' selected' : '') + '>' + esc(p.full_name) + '</option>';
        }).join('');
        return '<tr data-cons-row="' + esc(c.id) + '">' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(c.consultation_number) + '</strong><br><small>' + esc(c.specialty) + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(c.subject) + '</strong><br><small style="color:#4B677B;">' + esc(cli ? cli.full_name : c.client_user_id) + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><select data-cons-field="assignedProfessionalId" style="padding:5px;border-radius:6px;border:1px solid #cbd5e1;font-size:11px;">' + proSelOpts + '</select></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' +
            '<select data-cons-field="status" style="padding:5px;border-radius:6px;border:1px solid #cbd5e1;font-size:11px;">' +
              ['abierta', 'asignada', 'presupuestada', 'en_curso', 'respondida', 'cerrada'].map(function (st) {
                return '<option value="' + st + '"' + (c.status === st ? ' selected' : '') + '>' + st + '</option>';
              }).join('') +
            '</select>' +
          '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><button type="button" data-cons-save="' + esc(c.id) + '" style="padding:5px 10px;border:none;border-radius:6px;background:#205578;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Guardar</button></td>' +
        '</tr>';
      }).join('');

      var apptRows = appts.map(function (a) {
        var cli = look.usersById[a.client_user_id];
        var proSelOpts = '<option value="">Sin asignar</option>' + prosAgenda.map(function (p) {
          return '<option value="' + esc(p.id) + '"' + (p.id === a.professional_id ? ' selected' : '') + '>' + esc(p.full_name) + '</option>';
        }).join('');
        return '<tr data-appt-row="' + esc(a.id) + '">' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(a.topic) + '</strong><br><small style="color:#4B677B;">' + esc(cli ? cli.full_name : a.client_user_id) + ' · ' + esc(a.modality) + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(fmtDate(a.scheduled_start)) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><select data-appt-field="professionalId" style="padding:5px;border-radius:6px;border:1px solid #cbd5e1;font-size:11px;">' + proSelOpts + '</select></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><input data-appt-field="meetingUrl" value="' + esc(a.meeting_url || '') + '" placeholder="https://meet..." style="width:150px;padding:5px;border-radius:6px;border:1px solid #cbd5e1;font-size:11px;"></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' +
            '<select data-appt-field="status" style="padding:5px;border-radius:6px;border:1px solid #cbd5e1;font-size:11px;">' +
              ['solicitada', 'confirmada', 'reprogramada', 'completada', 'cancelada'].map(function (st) {
                return '<option value="' + st + '"' + (a.status === st ? ' selected' : '') + '>' + st + '</option>';
              }).join('') +
            '</select>' +
          '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><button type="button" data-appt-save="' + esc(a.id) + '" style="padding:5px 10px;border:none;border-radius:6px;background:#087FCB;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Guardar</button></td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="display:grid;gap:16px;">' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
            '<h3 style="margin:0 0 10px;color:#205578;font-size:15px;">Consultas Profesionales (' + esc(consults.length) + ')</h3>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">N° / Especialidad</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Asunto y Cliente</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Profesional</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Estado</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Acción</th>' +
            '</tr></thead><tbody>' +
              (consultRows || '<tr><td colspan="5" style="padding:12px;color:#4B677B;">Sin consultas recibidas aún.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
            '<h3 style="margin:0 0 10px;color:#205578;font-size:15px;">Agenda de Reuniones y Turnos (' + esc(appts.length) + ')</h3>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Motivo y Cliente</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Fecha y hora</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Profesional</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Enlace reunión</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Estado</th>' +
              '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Acción</th>' +
            '</tr></thead><tbody>' +
              (apptRows || '<tr><td colspan="6" style="padding:12px;color:#4B677B;">Sin reuniones agendadas aún.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>';

      body.querySelectorAll('[data-cons-save]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-cons-save');
          var row = body.querySelector('[data-cons-row="' + id + '"]');
          if (!row) return;
          runAction({
            action: 'update_consultation',
            consultationId: id,
            assignedProfessionalId: row.querySelector('[data-cons-field="assignedProfessionalId"]').value,
            status: row.querySelector('[data-cons-field="status"]').value
          }, 'agenda');
        });
      });

      body.querySelectorAll('[data-appt-save]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-appt-save');
          var row = body.querySelector('[data-appt-row="' + id + '"]');
          if (!row) return;
          runAction({
            action: 'update_appointment',
            appointmentId: id,
            professionalId: row.querySelector('[data-appt-field="professionalId"]').value,
            meetingUrl: row.querySelector('[data-appt-field="meetingUrl"]').value,
            status: row.querySelector('[data-appt-field="status"]').value
          }, 'agenda');
        });
      });
      return;
    }

    /* ==================== 8. CONFIGURACIÓN LEGAL Y NORMATIVA ==================== */
    if (viewKey === 'configuracion') {
      var settings = d.settings || {};
      var legal = settings.legal_and_professional_config || {};
      var tax = legal.providerTaxData || {};
      var aiCfg = settings.ai_module_config || { enabled: false, externalProviderApproved: false, note: '' };
      var otherKeys = Object.keys(settings).filter(function (key) {
        return key !== 'legal_and_professional_config' && key !== 'ai_module_config';
      });

      var jsonBlocks = otherKeys.map(function (key) {
        return '<form class="dc-raw-setting-form" data-setting-key="' + esc(key) + '" style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:14px;display:grid;gap:8px;">' +
          '<div style="font-size:13px;font-weight:800;color:#205578;">Clave normativa: <code>' + esc(key) + '</code></div>' +
          '<textarea name="jsonValue" rows="6" style="width:100%;font-family:monospace;font-size:11px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;">' + esc(JSON.stringify(settings[key], null, 2)) + '</textarea>' +
          '<div><button type="submit" style="padding:7px 14px;border:none;border-radius:8px;background:#087FCB;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">Guardar «' + esc(key) + '»</button></div>' +
        '</form>';
      }).join('');

      body.innerHTML = banner +
        '<div style="display:grid;gap:16px;">' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:18px;">' +
            '<h3 style="margin:0 0 10px;color:#205578;font-size:15px;">Datos Fiscales, Legales y Aviso Institucional CPCE</h3>' +
            '<form id="dc-legal-form" style="display:grid;gap:10px;">' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">' +
                '<label style="font-size:12px;font-weight:700;color:#205578;">Razón social / Estudio<input name="legalName" value="' + esc(tax.legalName || '') + '" style="width:100%;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;"></label>' +
                '<label style="font-size:12px;font-weight:700;color:#205578;">CUIT<input name="cuit" value="' + esc(tax.cuit || '') + '" style="width:100%;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;"></label>' +
                '<label style="font-size:12px;font-weight:700;color:#205578;">Condición fiscal<input name="taxCondition" value="' + esc(tax.taxCondition || '') + '" style="width:100%;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;"></label>' +
                '<label style="font-size:12px;font-weight:700;color:#205578;">Domicilio legal<input name="address" value="' + esc(tax.address || '') + '" style="width:100%;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;"></label>' +
                '<label style="font-size:12px;font-weight:700;color:#205578;">Email institucional<input name="contactEmail" type="email" value="' + esc(tax.contactEmail || '') + '" style="width:100%;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;"></label>' +
              '</div>' +
              '<label style="font-size:12px;font-weight:700;color:#205578;">Aviso de independencia y CPCE Córdoba<textarea name="cpceDisclaimer" rows="2" style="width:100%;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;">' + esc(legal.cpceDisclaimer || '') + '</textarea></label>' +
              '<label style="font-size:12px;font-weight:700;color:#205578;">Resumen de Términos y Condiciones<textarea name="termsSummary" rows="2" style="width:100%;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;">' + esc(legal.termsSummary || '') + '</textarea></label>' +
              '<label style="font-size:12px;font-weight:700;color:#205578;">Política de Privacidad y Confidencialidad<textarea name="privacySummary" rows="2" style="width:100%;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;">' + esc(legal.privacySummary || '') + '</textarea></label>' +
              '<label style="font-size:12px;font-weight:700;color:#205578;">Condiciones de Entrega Digital<textarea name="deliveryConditions" rows="2" style="width:100%;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;">' + esc(legal.deliveryConditions || '') + '</textarea></label>' +
              '<label style="font-size:12px;font-weight:700;color:#205578;">Procedimiento de Reclamos<textarea name="claimsProcedure" rows="2" style="width:100%;padding:8px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;">' + esc(legal.claimsProcedure || '') + '</textarea></label>' +
              '<div><button type="submit" style="padding:9px 16px;border:none;border-radius:8px;background:#205578;color:#fff;font-weight:800;cursor:pointer;font-size:12px;">Guardar Configuración Legal</button></div>' +
            '</form>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:18px;">' +
            '<h3 style="margin:0 0 8px;color:#205578;font-size:15px;">Módulo Opcional de IA Documental (solo asistencia interna)</h3>' +
            '<form id="dc-ai-form" style="display:grid;gap:10px;max-width:680px;">' +
              '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#205578;"><input type="checkbox" name="enabled"' + (aiCfg.enabled ? ' checked' : '') + '> Habilitar módulo de asistencia documental IA</label>' +
              '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#205578;"><input type="checkbox" name="externalProviderApproved"' + (aiCfg.externalProviderApproved ? ' checked' : '') + '> Proveedor externo aprobado contractual y legalmente</label>' +
              '<input name="note" value="' + esc(aiCfg.note || '') + '" placeholder="Nota de gobernanza / estado contractual" style="padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;">' +
              '<div><button type="submit" style="padding:8px 14px;border:none;border-radius:8px;background:#205578;color:#fff;font-weight:700;cursor:pointer;font-size:12px;">Guardar estado módulo IA</button></div>' +
            '</form>' +
          '</div>' +
          jsonBlocks +
        '</div>';

      var legalForm = document.getElementById('dc-legal-form');
      if (legalForm) {
        legalForm.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(legalForm);
          var nextVal = {
            responsibleProfessionals: Array.isArray(legal.responsibleProfessionals) ? legal.responsibleProfessionals : [],
            providerTaxData: {
              legalName: String(fd.get('legalName') || ''),
              cuit: String(fd.get('cuit') || ''),
              taxCondition: String(fd.get('taxCondition') || ''),
              address: String(fd.get('address') || ''),
              contactEmail: String(fd.get('contactEmail') || '')
            },
            cpceDisclaimer: String(fd.get('cpceDisclaimer') || ''),
            termsSummary: String(fd.get('termsSummary') || ''),
            privacySummary: String(fd.get('privacySummary') || ''),
            deliveryConditions: String(fd.get('deliveryConditions') || ''),
            claimsProcedure: String(fd.get('claimsProcedure') || ''),
            updatedAt: new Date().toISOString()
          };
          runAction({ action: 'save_setting', key: 'legal_and_professional_config', value: nextVal }, 'configuracion');
        });
      }

      var aiForm = document.getElementById('dc-ai-form');
      if (aiForm) {
        aiForm.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(aiForm);
          runAction({
            action: 'save_setting',
            key: 'ai_module_config',
            value: {
              enabled: fd.get('enabled') === 'on',
              externalProviderApproved: fd.get('externalProviderApproved') === 'on',
              note: String(fd.get('note') || '')
            }
          }, 'configuracion');
        });
      }

      body.querySelectorAll('.dc-raw-setting-form').forEach(function (f) {
        f.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var key = f.getAttribute('data-setting-key');
          var raw = f.querySelector('textarea[name="jsonValue"]').value;
          try {
            var parsed = JSON.parse(raw);
            runAction({ action: 'save_setting', key: key, value: parsed }, 'configuracion');
          } catch (_err) {
            STATE.feedback = 'JSON inválido en «' + key + '». Verificá la sintaxis antes de guardar.';
            STATE.isError = true;
            renderDetailView('configuracion');
          }
        });
      });
      return;
    }

    /* ==================== 9. LEGALIZACIONES CPCE (SOLO CONSULTA / SEGREGACIÓN) ==================== */
    if (viewKey === 'legalizaciones') {
      var legs = d.legalizations || [];
      var legRows = legs.map(function (l) {
        var req = look.reqsById[l.request_id];
        var pro = look.prosById[l.professional_id];
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(req ? req.request_number : l.request_id) + '</strong></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(pro ? pro.full_name : l.professional_id) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(l.council_name) + '<br><small>Ref: ' + esc(l.external_tracking_number || '—') + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(l.status) + '</strong></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(fmtDate(l.approved_at || l.submitted_at || l.created_at)) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + (l.official_validation_url ? '<a href="' + esc(l.official_validation_url) + '" target="_blank" rel="noopener noreferrer" style="color:#087FCB;font-weight:700;text-decoration:none;">Validar CPCE ↗</a>' : '—') + '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="background:#EBF4FA;border:1px solid #8CC9F1;border-radius:12px;padding:12px 16px;margin-bottom:14px;font-size:12px;color:#205578;"><strong>Segregación de funciones:</strong> la presentación, subsanación y carga de archivos legalizados en CPCE son acciones exclusivas del Contador Público matriculado en <strong>www.doncontador.com.ar/profesional</strong>.</div>' +
        '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Expediente</th>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Profesional</th>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Consejo / Seguimiento</th>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Estado</th>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Fecha</th>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Validación</th>' +
          '</tr></thead><tbody>' +
            (legRows || '<tr><td colspan="6" style="padding:12px;color:#4B677B;">Sin trámites de legalización CPCE registrados aún.</td></tr>') +
          '</tbody></table>' +
        '</div>';
      return;
    }

    /* ==================== 10. DOCUMENTOS ENTREGADOS (SOLO CONSULTA / SEGREGACIÓN) ==================== */
    if (viewKey === 'entregables') {
      var delivs = d.deliverables || [];
      var delRows = delivs.map(function (dl) {
        var req = look.reqsById[dl.request_id];
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(req ? req.request_number : dl.request_id) + '</strong></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><strong>' + esc(dl.title) + '</strong><br><small style="color:#4B677B;">' + esc(dl.original_filename) + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + (dl.is_legalized ? 'Sí (' + esc(dl.legalization_council || 'CPCE') + ')' : 'No') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(dl.external_reference || '—') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(fmtDate(dl.issued_at)) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(dl.download_count || 0) + '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="background:#EBF4FA;border:1px solid #8CC9F1;border-radius:12px;padding:12px 16px;margin-bottom:14px;font-size:12px;color:#205578;"><strong>Integridad documental:</strong> la emisión y publicación de entregables firmados/legalizados corresponden exclusivamente al profesional matriculado desde <strong>/profesional</strong>.</div>' +
        '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Expediente</th>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Documento</th>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Legalizado</th>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Ref. Externa</th>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Emitido</th>' +
            '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Descargas</th>' +
          '</tr></thead><tbody>' +
            (delRows || '<tr><td colspan="6" style="padding:12px;color:#4B677B;">Sin entregables emitidos aún.</td></tr>') +
          '</tbody></table>' +
        '</div>';
      return;
    }

    /* ==================== 11. AUDITORÍA ==================== */
    var logs = d.auditLogs || [];
    var logRows = logs.slice(0, 80).map(function (lg) {
      return '<tr>' +
        '<td style="padding:8px;border-bottom:1px solid #edf2f7;white-space:nowrap;">' + esc(fmtDate(lg.created_at)) + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #edf2f7;"><code>' + esc(lg.actor_type) + '</code><br><small>' + esc(lg.actor_id) + '</small></td>' +
        '<td style="padding:8px;border-bottom:1px solid #edf2f7;font-weight:700;color:#205578;">' + esc(lg.action) + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #edf2f7;">' + esc(lg.entity_type || '—') + '<br><small>' + esc(lg.entity_id || '') + '</small></td>' +
        '<td style="padding:8px;border-bottom:1px solid #edf2f7;max-width:280px;word-break:break-word;font-size:11px;color:#4B677B;">' + esc(lg.after_state ? JSON.stringify(lg.after_state) : '—') + '</td>' +
      '</tr>';
    }).join('');

    body.innerHTML = banner +
      '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:12px;padding:16px;overflow:auto;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>' +
          '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Fecha</th>' +
          '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Actor</th>' +
          '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Acción</th>' +
          '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Entidad</th>' +
          '<th style="text-align:left;padding:8px;border-bottom:2px solid #D6E4EE;color:#205578;">Detalle</th>' +
        '</tr></thead><tbody>' +
          (logRows || '<tr><td colspan="5" style="padding:12px;color:#4B677B;">Sin registros de auditoría aún.</td></tr>') +
        '</tbody></table>' +
      '</div>';
  }

  async function openDcView(viewKey) {
    var secs = ensureSections();
    if (!secs) return;
    hideAllErpSections();
    STATE.view = viewKey || 'menu';
    STATE.feedback = '';
    STATE.isError = false;

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
          ? 'Don Contador'
          : 'Don Contador · ' + (meta ? meta.label : STATE.view);
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

  function syncHomeCard() {
    bindGlobalNavIntegration();
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
