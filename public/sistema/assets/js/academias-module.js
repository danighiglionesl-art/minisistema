/* ==========================================================================
   MÓDULO INTEGRAL: GESTIÓN DE ACADEMIAS — MINISISTEMA ERP
   Para Academias, Escuelas de Danza, Capacitaciones, Escuelas de Negocios y Cursos.
   Integrado con:
   - Clientes y Cuenta Corriente Única (clientes_db)
   - Administración de Personal (asistencia_db.employees -> Docentes)
   - Cobranzas Presenciales y Opcional Pagos Online (Mercado Pago)
   - Aula Virtual (Google Classroom + Materiales) y Clases Online Multiusuario (Daily.co)
   - Emisión de Certificados/Diplomas PDF con código verificador
   - Tarjetas estrictamente uniformes (.modules-grid / .module-card) sin pills ni <p>
   ========================================================================== */
(function () {
  'use strict';

  var SUBMODULES = [
    { key: 'panel', label: 'Tablero y Resumen General', icon: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>' },
    { key: 'inscripciones', label: 'Inscripciones y Base General', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line>' },
    { key: 'cursos', label: 'Cursos, Comisiones y Horarios', icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>' },
    { key: 'asistencias', label: 'Planilla de Asistencias', icon: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>' },
    { key: 'cuotas', label: 'Control de Cuotas y Cobranzas', icon: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>' },
    { key: 'aula_virtual', label: 'Aula Virtual y Clases Online', icon: '<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>' },
    { key: 'docentes', label: 'Docentes y Liquidaciones', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>' },
    { key: 'certificados', label: 'Certificados y Diplomas', icon: '<circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>' },
    { key: 'config', label: 'Configuración, Opcionales y Portal', icon: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' }
  ];

  var STATE = {
    view: 'menu',
    loading: false,
    db: null,
    summary: null,
    tenantSlug: '',
    empleadosAsistencia: [],
    search: '',
    cuotaFilter: 'pendientes',
    cuotaPeriodo: new Date().toISOString().slice(0, 7),
    asistCursoId: '',
    asistFecha: todayIso(),
    asistDraft: {},
    asistTema: '',
    asistModalidad: 'presencial',
    asistObs: '',
    editingCursoId: '',
    editingAlumnoId: '',
    editingDocenteId: '',
    payingCuotaId: '',
    liqPeriodo: new Date().toISOString().slice(0, 7),
    aulaCursoFilter: 'ALL',
    propuestaBase: 180000,
    propuestaPagos: 65000,
    propuestaCert: 45000,
    propuestaLogo: 40000
  };

  var fmtArs = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  });

  function fmtMoney(v) {
    return fmtArs.format(Number(v) || 0);
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function todayIso() {
    var d = new Date();
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function getActiveUser() {
    if (typeof window.__MS_GET_ACTIVE_USER__ === 'function') {
      var u = window.__MS_GET_ACTIVE_USER__();
      if (u && u.username) return u;
    }
    try {
      var pfx = (window.ERP_BRAND && window.ERP_BRAND.storagePrefix) || 'ms_minisistema_';
      var raw =
        sessionStorage.getItem(pfx + 'erp_active_admin_v1') ||
        localStorage.getItem(pfx + 'erp_active_admin_v1');
      if (raw) return JSON.parse(raw);
    } catch (_e) {}
    return null;
  }

  function isAcademiasAllowed() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    var isBase = Boolean(window.ERP_BRAND && window.ERP_BRAND.isBase);
    var brandMods = (window.ERP_BRAND && window.ERP_BRAND.enabledModules) || [];
    if (!isBase && Array.isArray(brandMods) && brandMods.length > 0) {
      var hasTenant = brandMods.some(function (k) {
        var s = String(k || '');
        return s === 'academias' || s.indexOf('academias:') === 0 || s === 'gestion_academias';
      });
      if (!hasTenant) return false;
    }
    if (
      String(u.username).toLowerCase() === 'danielg' ||
      u.role === 'Administrador General' ||
      u.role === 'Administrador'
    ) {
      return true;
    }
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return uMods.some(function (k) {
      var s = String(k || '');
      return s === 'academias' || s.indexOf('academias:') === 0;
    });
  }

  function isSubAllowed(subKey) {
    var u = getActiveUser();
    if (!u) return false;
    if (
      String(u.username).toLowerCase() === 'danielg' ||
      u.role === 'Administrador General' ||
      u.role === 'Administrador'
    ) {
      return true;
    }
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return uMods.indexOf('academias') >= 0 || uMods.indexOf('academias:' + subKey) >= 0;
  }

  function getApiBase() {
    var boot = window.__ERP_TENANT_BOOT__;
    if (boot && !boot.isBase && boot.optionType === 2 && boot.slug) {
      return '/' + encodeURIComponent(boot.slug) + '/api/academias';
    }
    return '/sistema/api/academias';
  }

  function getPublicPortalUrl() {
    var boot = window.__ERP_TENANT_BOOT__;
    var origin = window.location.origin;
    if (boot && !boot.isBase && boot.optionType === 2 && boot.slug) {
      return origin + '/' + encodeURIComponent(boot.slug) + '/academias';
    }
    return origin + '/academias';
  }

  async function apiAc(method, payload) {
    var u = getActiveUser();
    var headers = { 'Content-Type': 'application/json' };
    if (u && u.username) headers['X-ERP-User'] = u.username;
    var opts = { method: method || 'GET', credentials: 'include', headers: headers };
    if (payload) {
      if (u && u.username && !payload.usuario) payload.usuario = u.name || u.username;
      opts.body = JSON.stringify(payload);
    }
    var res = await fetch(getApiBase(), opts);
    var json = await res.json().catch(function () {
      return { ok: false, message: 'Respuesta inválida del servidor' };
    });
    if (!res.ok && json.ok !== false) json.ok = false;
    return json;
  }

  function showToast(msg, isErr) {
    var el = document.getElementById('ms-ac-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ms-ac-toast';
      el.style.cssText =
        'position:fixed;bottom:1.25rem;right:1.25rem;z-index:99999;padding:0.75rem 1.15rem;border-radius:10px;font-weight:700;font-size:0.86rem;box-shadow:0 10px 28px rgba(0,0,0,0.22);max-width:440px;transition:opacity 0.2s;';
      document.body.appendChild(el);
    }
    el.style.background = isErr ? '#dc2626' : '#112D3A';
    el.style.color = '#ffffff';
    el.style.borderLeft = isErr ? '4px solid #fecaca' : '4px solid #56D7A1';
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.display = 'block';
    clearTimeout(window.__MS_AC_TOAST_T);
    window.__MS_AC_TOAST_T = setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { el.style.display = 'none'; }, 220);
    }, 3600);
  }

  function downloadCsv(filename, rows) {
    var csv = rows
      .map(function (r) {
        return r
          .map(function (cell) {
            var s = String(cell == null ? '' : cell).replace(/"/g, '""');
            return '"' + s + '"';
          })
          .join(';');
      })
      .join('\r\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function openWhatsApp(phoneRaw, text) {
    var digits = String(phoneRaw || '').replace(/\D/g, '');
    if (!digits) {
      showToast('Este contacto no tiene número de WhatsApp cargado.', true);
      return;
    }
    var url = 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text || '');
    window.open(url, '_blank', 'noopener,noreferrer');
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
    var topInd = document.getElementById('topbar-caja-indicator');
    if (topInd) topInd.hidden = true;
  }

  function ensureStyles() {
    if (document.getElementById('ms-academias-inline-styles')) return;
    var st = document.createElement('style');
    st.id = 'ms-academias-inline-styles';
    st.textContent =
      '.ac-wrap{max-width:1360px;margin:0 auto;display:flex;flex-direction:column;gap:1rem;}' +
      '.ac-kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:0.75rem;}' +
      '.ac-kpi{background:var(--surface,#fff);border:1px solid #e2e8f0;border-radius:12px;padding:0.9rem 1rem;display:flex;flex-direction:column;gap:0.2rem;box-shadow:0 2px 8px rgba(15,23,42,0.04);}' +
      '.ac-kpi span{font-size:0.76rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;}' +
      '.ac-kpi strong{font-size:1.35rem;color:#0f172a;font-weight:800;}' +
      '.ac-kpi small{font-size:0.74rem;color:#475569;}' +
      '.ac-card{background:var(--surface,#fff);border:1px solid #e2e8f0;border-radius:14px;padding:1.15rem 1.25rem;box-shadow:0 2px 10px rgba(15,23,42,0.04);}' +
      '.ac-card h3{margin:0 0 0.75rem;font-size:1.05rem;color:#112D3A;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;}' +
      '.ac-form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:0.7rem;}' +
      '.ac-field{display:flex;flex-direction:column;gap:0.25rem;}' +
      '.ac-field label{font-size:0.78rem;font-weight:700;color:#334155;}' +
      '.ac-input,.ac-select,.ac-textarea{width:100%;padding:0.5rem 0.65rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.86rem;background:#fff;color:#0f172a;box-sizing:border-box;}' +
      '.ac-btn{display:inline-flex;align-items:center;justify-content:center;gap:0.35rem;padding:0.5rem 0.9rem;border-radius:8px;border:1px solid transparent;font-size:0.83rem;font-weight:700;cursor:pointer;text-decoration:none;white-space:nowrap;}' +
      '.ac-btn--primary{background:#112D3A;color:#fff;}' +
      '.ac-btn--primary:hover{background:#1b4558;}' +
      '.ac-btn--accent{background:#10b981;color:#fff;}' +
      '.ac-btn--accent:hover{background:#059669;}' +
      '.ac-btn--outline{background:#fff;border-color:#cbd5e1;color:#1e293b;}' +
      '.ac-btn--outline:hover{background:#f8fafc;border-color:#94a3b8;}' +
      '.ac-btn--danger{background:#fef2f2;border-color:#fecaca;color:#b91c1c;}' +
      '.ac-btn--sm{padding:0.3rem 0.58rem;font-size:0.76rem;}' +
      '.ac-table-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px;}' +
      '.ac-table{width:100%;border-collapse:collapse;font-size:0.84rem;}' +
      '.ac-table th{background:#f8fafc;color:#334155;font-weight:700;text-align:left;padding:0.6rem 0.7rem;border-bottom:1px solid #e2e8f0;white-space:nowrap;}' +
      '.ac-table td{padding:0.55rem 0.7rem;border-bottom:1px solid #f1f5f9;vertical-align:middle;}' +
      '.ac-badge{display:inline-flex;align-items:center;padding:0.16rem 0.5rem;border-radius:999px;font-size:0.72rem;font-weight:700;}' +
      '.ac-badge--green{background:#dcfce7;color:#166534;}' +
      '.ac-badge--yellow{background:#fef3c7;color:#92400e;}' +
      '.ac-badge--red{background:#fee2e2;color:#991b1b;}' +
      '.ac-badge--blue{background:#dbeafe;color:#1e40af;}' +
      '.ac-badge--gray{background:#f1f5f9;color:#475569;}' +
      '.ac-att-btn{min-width:34px;padding:0.3rem 0.45rem;border-radius:7px;border:1.5px solid #cbd5e1;background:#fff;font-weight:800;font-size:0.78rem;cursor:pointer;}' +
      '.ac-att-btn.is-P{background:#16a34a;border-color:#15803d;color:#fff;}' +
      '.ac-att-btn.is-A{background:#dc2626;border-color:#b91c1c;color:#fff;}' +
      '.ac-att-btn.is-T{background:#d97706;border-color:#b45309;color:#fff;}' +
      '.ac-att-btn.is-J{background:#2563eb;border-color:#1d4ed8;color:#fff;}' +
      '.ac-banner-flow{background:linear-gradient(135deg,#112D3A 0%,#1d4b5e 100%);color:#fff;border-radius:12px;padding:0.9rem 1.15rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;}' +
      '.ac-banner-flow strong{color:#56D7A1;}' +
      'html[data-theme="dark"] .ac-kpi,html[data-theme="dark"] .ac-card{background:#181e2c;border-color:rgba(255,255,255,0.12);}' +
      'html[data-theme="dark"] .ac-kpi strong,html[data-theme="dark"] .ac-card h3{color:#f8fafc;}' +
      'html[data-theme="dark"] .ac-table th{background:#1e2638;color:#e2e8f0;border-color:rgba(255,255,255,0.1);}' +
      'html[data-theme="dark"] .ac-table td{border-color:rgba(255,255,255,0.08);color:#e2e8f0;}' +
      'html[data-theme="dark"] .ac-input,html[data-theme="dark"] .ac-select,html[data-theme="dark"] .ac-textarea{background:#0f172a;color:#f8fafc;border-color:rgba(255,255,255,0.18);}';
    document.head.appendChild(st);
  }

  function ensureSections() {
    ensureStyles();
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var secMenu = document.getElementById('sec-menu-academias');
    if (!secMenu) {
      secMenu = document.createElement('section');
      secMenu.id = 'sec-menu-academias';
      secMenu.className = 'erp-section';
      secMenu.hidden = true;
      secMenu.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ac-back-home">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">Módulo · <strong>Gestión de Academias</strong></span>' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" id="ac-submodules-grid" aria-label="Submódulos de Gestión de Academias"></div>';
      erpMain.appendChild(secMenu);
      secMenu.querySelector('#ac-back-home').addEventListener('click', closeToHome);
    }

    var secWs = document.getElementById('sec-academias-workspace');
    if (!secWs) {
      secWs = document.createElement('section');
      secWs.id = 'sec-academias-workspace';
      secWs.className = 'erp-section';
      secWs.hidden = true;
      secWs.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ac-back-menu">← Volver a Gestión de Academias</button>' +
            '<span class="module-breadcrumb" id="ac-ws-breadcrumb">Gestión de Academias</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
            '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" id="ac-refresh-btn">🔄 Actualizar</button>' +
          '</div>' +
        '</div>' +
        '<div id="ac-ws-body" class="ac-wrap" style="padding:0.75rem 0 2rem;"></div>';
      erpMain.appendChild(secWs);
      secWs.querySelector('#ac-back-menu').addEventListener('click', function () {
        openAcademiasView('menu');
      });
      secWs.querySelector('#ac-refresh-btn').addEventListener('click', async function () {
        await reloadData();
        renderWorkspace();
        showToast('Datos de Gestión de Academias actualizados.');
      });
    }

    return { secMenu: secMenu, secWs: secWs };
  }

  function renderSubmodulesGrid() {
    var grid = document.getElementById('ac-submodules-grid');
    if (!grid) return;
    var visibleSubs = SUBMODULES.filter(function (m) { return isSubAllowed(m.key); });
    grid.innerHTML = visibleSubs
      .map(function (m) {
        return (
          '<article class="module-card" role="button" tabindex="0" data-ac-sub="' + esc(m.key) + '">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + m.icon + '</svg>' +
            '</div>' +
            '<h3>' + esc(m.label) + '</h3>' +
          '</article>'
        );
      })
      .join('');

    grid.querySelectorAll('[data-ac-sub]').forEach(function (card) {
      var k = card.getAttribute('data-ac-sub');
      card.addEventListener('click', function () { openAcademiasView(k); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openAcademiasView(k); }
      });
    });
  }

  function applyApiResponse(res) {
    if (res && res.db) STATE.db = res.db;
    if (res && res.summary) STATE.summary = res.summary;
    if (res && res.tenantSlug) STATE.tenantSlug = res.tenantSlug;
    if (res && Array.isArray(res.empleadosAsistencia)) {
      STATE.empleadosAsistencia = res.empleadosAsistencia;
    }
    if (STATE.db && !STATE.asistCursoId && STATE.db.cursos.length > 0) {
      STATE.asistCursoId = STATE.db.cursos[0].id;
    }
  }

  async function reloadData() {
    STATE.loading = true;
    try {
      var res = await apiAc('GET');
      if (res && res.ok) {
        applyApiResponse(res);
      } else {
        showToast((res && res.message) || 'Error cargando Gestión de Academias.', true);
      }
    } catch (_e) {
      showToast('Error de conexión con el servidor.', true);
    } finally {
      STATE.loading = false;
    }
  }

  async function openAcademiasView(viewKey) {
    var secs = ensureSections();
    if (!secs) return;
    STATE.view = viewKey || 'menu';
    hideAllErpSections();

    var backTop = document.getElementById('btn-topbar-back-facturacion');
    if (backTop) backTop.hidden = false;

    if (STATE.view === 'menu') {
      renderSubmodulesGrid();
      secs.secMenu.hidden = false;
      if (!STATE.db) reloadData();
      return;
    }

    var subMeta = SUBMODULES.find(function (m) { return m.key === STATE.view; });
    var bc = document.getElementById('ac-ws-breadcrumb');
    if (bc) {
      bc.innerHTML = 'Gestión de Academias · <strong>' + esc(subMeta ? subMeta.label : STATE.view) + '</strong>';
    }
    secs.secWs.hidden = false;

    if (!STATE.db) {
      var body = document.getElementById('ac-ws-body');
      if (body) body.innerHTML = '<div class="ac-card">Cargando Gestión de Academias...</div>';
      await reloadData();
    }
    if (STATE.view === 'asistencias') {
      syncAsistenciaDraftFromDb();
    }
    renderWorkspace();
  }

  function calcAlumnoAttendance(alumnoId, cursoId) {
    var db = STATE.db;
    if (!db) return { total: 0, presentes: 0, pct: 100 };
    var total = 0;
    var presentes = 0;
    (db.asistencias || []).forEach(function (ses) {
      if (cursoId && ses.cursoId !== cursoId) return;
      var st = ses.registros && ses.registros[alumnoId];
      if (!st) return;
      total++;
      if (st === 'P' || st === 'T' || st === 'J') presentes++;
    });
    return {
      total: total,
      presentes: presentes,
      pct: total > 0 ? Math.round((presentes / total) * 100) : 100
    };
  }

  function syncAsistenciaDraftFromDb() {
    var db = STATE.db;
    if (!db) return;
    if (!STATE.asistCursoId && db.cursos.length > 0) {
      STATE.asistCursoId = db.cursos[0].id;
    }
    var ses = (db.asistencias || []).find(function (s) {
      return s.cursoId === STATE.asistCursoId && s.fecha === STATE.asistFecha;
    });
    var draft = {};
    var insList = (db.inscripciones || []).filter(function (i) {
      return i.cursoId === STATE.asistCursoId && i.estado === 'activa';
    });
    insList.forEach(function (i) {
      draft[i.alumnoId] = (ses && ses.registros && ses.registros[i.alumnoId]) || 'P';
    });
    STATE.asistDraft = draft;
    STATE.asistTema = ses ? ses.temaClase || '' : '';
    STATE.asistModalidad = ses ? ses.modalidadSesion || 'presencial' : 'presencial';
    STATE.asistObs = ses ? ses.observaciones || '' : '';
  }

  /* ==================== IMPRESIÓN DE RECIBO Y CERTIFICADO ==================== */
  function printReciboPago(pago) {
    var cfg = (STATE.db && STATE.db.config) || {};
    var logoHtml = cfg.logoUrl
      ? '<img src="' + esc(cfg.logoUrl) + '" alt="Logo" style="max-height:64px;max-width:180px;object-fit:contain;margin-bottom:6px;">'
      : '';
    var win = window.open('', '_blank', 'width=760,height=640');
    if (!win) { showToast('Permití ventanas emergentes para imprimir el recibo.', true); return; }
    win.document.open();
    win.document.write(
      '<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>Recibo ' + esc(pago.reciboNumero) + '</title>' +
      '<style>body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#0f172a;background:#fff;}' +
      '.box{max-width:680px;margin:0 auto;border:2px solid #112D3A;border-radius:12px;padding:22px;}' +
      '.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:14px;margin-bottom:16px;}' +
      '.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed #e2e8f0;font-size:14px;}' +
      '.total{margin-top:14px;background:#f8fafc;border:1.5px solid #112D3A;border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between;font-size:18px;font-weight:800;}' +
      '.no-print{text-align:center;margin-top:18px;}@media print{.no-print{display:none!important;}}</style></head><body>' +
      '<div class="box">' +
        '<div class="top"><div>' + logoHtml + '<div style="font-size:18px;font-weight:800;color:#112D3A;">' + esc(cfg.nombreAcademia || 'Academia') + '</div>' +
        '<div style="font-size:12px;color:#475569;">' + esc(cfg.direccion || '') + (cfg.localidad ? ' · ' + esc(cfg.localidad) : '') + '</div></div>' +
        '<div style="text-align:right;"><div style="font-size:12px;font-weight:700;color:#64748b;">RECIBO DE COBRANZA</div>' +
        '<div style="font-size:20px;font-weight:900;color:#112D3A;">' + esc(pago.reciboNumero) + '</div>' +
        '<div style="font-size:13px;">Fecha: ' + esc(pago.fechaPago) + '</div></div></div>' +
        '<div class="row"><span>Alumno/a:</span><strong>' + esc(pago.alumnoNombre) + '</strong></div>' +
        '<div class="row"><span>Curso / Comisión:</span><strong>' + esc(pago.cursoNombre) + '</strong></div>' +
        '<div class="row"><span>Concepto:</span><span>' + esc(pago.concepto) + '</span></div>' +
        '<div class="row"><span>Medio de pago:</span><strong style="text-transform:uppercase;">' + esc(pago.medioPago) + ' (' + esc(pago.canal) + ')</strong></div>' +
        (pago.referencia ? '<div class="row"><span>Referencia:</span><span>' + esc(pago.referencia) + '</span></div>' : '') +
        (pago.observaciones ? '<div class="row"><span>Observaciones:</span><span>' + esc(pago.observaciones) + '</span></div>' : '') +
        '<div class="total"><span>TOTAL RECIBIDO</span><span>' + fmtMoney(pago.importe) + '</span></div>' +
        '<div style="margin-top:26px;display:flex;justify-content:space-between;font-size:12px;color:#64748b;">' +
          '<span>Cobrado por: ' + esc(pago.cobradoPor || 'Administración') + '</span>' +
          '<span>Documento no válido como factura fiscal</span>' +
        '</div>' +
      '</div>' +
      '<div class="no-print"><button onclick="window.print()" style="padding:10px 22px;background:#112D3A;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">🖨️ Imprimir / Guardar PDF</button></div>' +
      '</body></html>'
    );
    win.document.close();
  }

  function printCertificadoDiploma(cert) {
    var cfg = (STATE.db && STATE.db.config) || {};
    var verifyUrl = getPublicPortalUrl() + '?cert=' + encodeURIComponent(cert.codigoVerificacion);
    var logoHtml = cfg.logoUrl
      ? '<img src="' + esc(cfg.logoUrl) + '" alt="Logo" style="max-height:76px;max-width:200px;object-fit:contain;margin-bottom:8px;">'
      : '';
    var win = window.open('', '_blank', 'width=1060,height=760');
    if (!win) { showToast('Permití ventanas emergentes para imprimir el certificado.', true); return; }
    win.document.open();
    win.document.write(
      '<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>Certificado ' + esc(cert.codigoVerificacion) + '</title>' +
      '<style>@page{size:A4 landscape;margin:8mm;}body{margin:0;padding:18px;font-family:Georgia,"Times New Roman",serif;background:#f1f5f9;color:#112D3A;}' +
      '.diploma{width:275mm;min-height:185mm;margin:0 auto;background:#fff;border:8px double #112D3A;outline:2px solid #56D7A1;outline-offset:-14px;padding:18mm 22mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;text-align:center;box-shadow:0 12px 35px rgba(0,0,0,0.16);}' +
      '.kicker{font-family:system-ui,sans-serif;letter-spacing:0.22em;font-size:12px;font-weight:800;color:#0f766e;text-transform:uppercase;}' +
      'h1{margin:8px 0 4px;font-size:38px;letter-spacing:0.06em;color:#112D3A;}' +
      '.name{font-size:32px;font-weight:700;color:#0f172a;border-bottom:2px solid #56D7A1;display:inline-block;padding:4px 28px;margin:10px 0;}' +
      '.course{font-size:22px;font-weight:700;color:#112D3A;margin:10px 0;}' +
      '.desc{max-width:720px;margin:10px auto;font-size:15px;line-height:1.55;color:#334155;}' +
      '.meta{font-family:system-ui,sans-serif;font-size:12px;color:#475569;margin-top:8px;}' +
      '.sigs{display:flex;justify-content:space-around;gap:40px;margin-top:26px;}' +
      '.sig{min-width:210px;border-top:1.5px solid #334155;padding-top:6px;font-family:system-ui,sans-serif;}' +
      '.sig strong{display:block;font-size:13px;color:#0f172a;}.sig span{font-size:11px;color:#64748b;}' +
      '.verify{font-family:monospace;font-size:11px;color:#64748b;margin-top:14px;}' +
      '.no-print{text-align:center;margin-top:14px;}@media print{body{background:#fff;padding:0;}.diploma{box-shadow:none;}.no-print{display:none!important;}}</style></head><body>' +
      '<div class="diploma">' +
        '<div>' +
          logoHtml +
          '<div class="kicker">' + esc(cfg.nombreAcademia || 'ACADEMIA') + '</div>' +
          '<h1>CERTIFICADO</h1>' +
          '<div style="font-size:14px;color:#64748b;font-style:italic;">Se otorga el presente diploma a</div>' +
          '<div class="name">' + esc(cert.alumnoNombre) + '</div>' +
          (cert.alumnoDni ? '<div class="meta">DNI Nº ' + esc(cert.alumnoDni) + '</div>' : '') +
          '<div class="desc">' + esc(cert.textoPersonalizado || cfg.textoCertificado || '') + '</div>' +
          '<div class="course">«' + esc(cert.cursoNombre) + '»</div>' +
          '<div class="meta">' +
            (cert.cargaHorariaHs ? 'Carga horaria: <strong>' + esc(cert.cargaHorariaHs) + ' hs</strong> · ' : '') +
            'Asistencia verificada: <strong>' + esc(cert.asistenciaPct) + '%</strong> · ' +
            'Resultado: <strong>' + esc(cert.calificacion || 'Aprobado') + '</strong> · ' +
            'Emitido el ' + esc(cert.fechaEmision) +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="sigs">' +
            '<div class="sig"><strong>' + esc(cert.firmante1Nombre || 'Dirección') + '</strong><span>' + esc(cert.firmante1Cargo || '') + '</span></div>' +
            '<div class="sig"><strong>' + esc(cert.firmante2Nombre || 'Docente') + '</strong><span>' + esc(cert.firmante2Cargo || '') + '</span></div>' +
          '</div>' +
          '<div class="verify">Código de verificación: <strong>' + esc(cert.codigoVerificacion) + '</strong> · Validar en ' + esc(verifyUrl) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="no-print"><button onclick="window.print()" style="padding:10px 24px;background:#112D3A;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">🖨️ Imprimir / Guardar Diploma PDF</button></div>' +
      '</body></html>'
    );
    win.document.close();
  }

  /* ==================== RENDER DE CADA SUBMÓDULO ==================== */
  function renderWorkspace() {
    var body = document.getElementById('ac-ws-body');
    if (!body || !STATE.db) return;
    var db = STATE.db;
    var sum = STATE.summary || {};

    if (STATE.view === 'panel') renderPanel(body, db, sum);
    else if (STATE.view === 'inscripciones') renderInscripciones(body, db);
    else if (STATE.view === 'cursos') renderCursos(body, db);
    else if (STATE.view === 'asistencias') renderAsistencias(body, db);
    else if (STATE.view === 'cuotas') renderCuotas(body, db);
    else if (STATE.view === 'aula_virtual') renderAulaVirtual(body, db);
    else if (STATE.view === 'docentes') renderDocentes(body, db);
    else if (STATE.view === 'certificados') renderCertificados(body, db);
    else if (STATE.view === 'config') renderConfig(body, db);
  }

  /* ---------- 1. TABLERO ---------- */
  function renderPanel(body, db, sum) {
    var today = todayIso();
    var vencidas = (db.cuotas || []).filter(function (c) {
      return (c.estado === 'pendiente' || c.estado === 'parcial') && c.fechaVencimiento && c.fechaVencimiento < today;
    });
    var opt = (db.config && db.config.opcionales) || {};

    body.innerHTML =
      '<div class="ac-banner-flow">' +
        '<div>' +
          '<div style="font-size:1.05rem;font-weight:800;">' + esc(db.config.nombreAcademia || 'Gestión de Academias') + '</div>' +
          '<div style="font-size:0.83rem;opacity:0.92;margin-top:2px;">Sistema integral conectado: <strong>Base General</strong> · <strong>Asistencias</strong> · <strong>Control de Cuotas</strong> · <strong>Aula Virtual / Daily.co</strong> · <strong>Clientes ERP</strong></div>' +
        '</div>' +
        '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;">' +
          '<button type="button" class="ac-btn ac-btn--accent" data-ac-go="inscripciones">➕ Nueva Inscripción</button>' +
          '<button type="button" class="ac-btn ac-btn--outline" data-ac-go="asistencias">✅ Tomar Asistencia</button>' +
          '<button type="button" class="ac-btn ac-btn--outline" data-ac-go="cuotas">💵 Cobrar Cuota</button>' +
          (db.alumnos.length === 0 ? '<button type="button" class="ac-btn ac-btn--outline" id="ac-btn-load-demo">⚡ Cargar Ejemplo Demo</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ac-kpi-grid">' +
        '<div class="ac-kpi"><span>Alumnos Activos</span><strong>' + esc(sum.alumnosActivos || 0) + '</strong><small>' + esc(sum.inscripcionesActivas || 0) + ' inscripciones vigentes</small></div>' +
        '<div class="ac-kpi"><span>Cursos / Comisiones</span><strong>' + esc(sum.cursosActivos || 0) + '</strong><small>' + esc(sum.docentesActivos || 0) + ' docente(s) activo(s)</small></div>' +
        '<div class="ac-kpi"><span>Asistencia del Mes</span><strong>' + esc(sum.asistenciaMesPct || 0) + '%</strong><small>Período ' + esc(sum.periodoActual || '') + '</small></div>' +
        '<div class="ac-kpi"><span>Recaudado del Mes</span><strong style="color:#059669;">' + fmtMoney(sum.recaudadoMes || 0) + '</strong><small>' + esc(sum.pagosMesCount || 0) + ' cobranza(s) registrada(s)</small></div>' +
        '<div class="ac-kpi"><span>Saldo Pendiente Cuotas</span><strong style="color:#d97706;">' + fmtMoney(sum.totalPendiente || 0) + '</strong><small>' + esc(sum.cuotasPendientesCount || 0) + ' cuota(s) · ' + esc(sum.cuotasVencidasCount || 0) + ' vencida(s)</small></div>' +
        '<div class="ac-kpi"><span>Clases Online Próx.</span><strong>' + esc(sum.clasesOnlineProx || 0) + '</strong><small>Plataforma Daily.co / Classroom</small></div>' +
        '<div class="ac-kpi"><span>Certificados Emitidos</span><strong>' + esc(sum.certificadosEmitidos || 0) + '</strong><small>' + (opt.certificadosAuto ? 'Módulo activo' : 'Opcional desactivado') + '</small></div>' +
        (opt.fichaSaludAptoFisico ? '<div class="ac-kpi"><span>Aptos Físicos Pend.</span><strong style="color:' + ((sum.aptoPendienteCount || 0) > 0 ? '#dc2626' : '#059669') + ';">' + esc(sum.aptoPendienteCount || 0) + '</strong><small>Control sanitario alumnos</small></div>' : '') +
      '</div>' +
      '<div class="ac-card">' +
        '<h3><span>⚠️ Cuotas Vencidas / Seguimiento de Cobranza</span><button type="button" class="ac-btn ac-btn--primary ac-btn--sm" data-ac-go="cuotas">Ver todas las cuotas →</button></h3>' +
        (vencidas.length === 0
          ? '<p style="margin:0;color:#475569;font-size:0.88rem;">✅ No hay cuotas vencidas pendientes al día de hoy.</p>'
          : '<div class="ac-table-wrap"><table class="ac-table"><thead><tr><th>Alumno</th><th>Curso / Concepto</th><th>Vencimiento</th><th>Saldo</th><th>Acciones</th></tr></thead><tbody>' +
            vencidas.slice(0, 10).map(function (c) {
              return (
                '<tr>' +
                  '<td><strong>' + esc(c.alumnoNombre) + '</strong></td>' +
                  '<td>' + esc(c.concepto) + '</td>' +
                  '<td><span class="ac-badge ac-badge--red">' + esc(c.fechaVencimiento) + '</span></td>' +
                  '<td><strong>' + fmtMoney(c.saldoPendiente) + '</strong></td>' +
                  '<td style="display:flex;gap:0.35rem;flex-wrap:wrap;">' +
                    '<button type="button" class="ac-btn ac-btn--accent ac-btn--sm" data-ac-quick-pay="' + esc(c.id) + '">💵 Cobrar</button>' +
                    '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" data-ac-wa-cuota="' + esc(c.id) + '">💬 Recordar</button>' +
                  '</td>' +
                '</tr>'
              );
            }).join('') +
            '</tbody></table></div>') +
      '</div>';

    body.querySelectorAll('[data-ac-go]').forEach(function (b) {
      b.addEventListener('click', function () { openAcademiasView(b.getAttribute('data-ac-go')); });
    });
    var btnDemo = body.querySelector('#ac-btn-load-demo');
    if (btnDemo) {
      btnDemo.addEventListener('click', async function () {
        var r = await apiAc('POST', { action: 'load_demo' });
        if (r && r.ok) { applyApiResponse(r); showToast(r.message); renderWorkspace(); }
        else showToast((r && r.message) || 'Error cargando ejemplo.', true);
      });
    }
    body.querySelectorAll('[data-ac-quick-pay]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.payingCuotaId = b.getAttribute('data-ac-quick-pay');
        openAcademiasView('cuotas');
      });
    });
    body.querySelectorAll('[data-ac-wa-cuota]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = db.cuotas.find(function (x) { return x.id === b.getAttribute('data-ac-wa-cuota'); });
        if (c) {
          openWhatsApp(c.alumnoWhatsapp, 'Hola ' + c.alumnoNombre + ', te recordamos desde ' + (db.config.nombreAcademia || 'la Academia') + ' que tenés pendiente ' + c.concepto + ' por ' + fmtMoney(c.saldoPendiente) + ' (venc. ' + c.fechaVencimiento + '). ¡Muchas gracias!');
        }
      });
    });
  }

  /* ---------- 2. INSCRIPCIONES Y BASE GENERAL ---------- */
  function renderInscripciones(body, db) {
    var activeCursos = (db.cursos || []).filter(function (c) { return c.activo; });
    var q = STATE.search.trim().toLowerCase();
    var filteredAlu = (db.alumnos || []).filter(function (a) {
      if (!q) return true;
      return (
        String(a.nombre || '').toLowerCase().indexOf(q) >= 0 ||
        String(a.dni || '').indexOf(q) >= 0 ||
        String(a.legajo || '').toLowerCase().indexOf(q) >= 0
      );
    });
    var editAlu = STATE.editingAlumnoId
      ? db.alumnos.find(function (a) { return a.id === STATE.editingAlumnoId; })
      : null;

    body.innerHTML =
      '<div class="ac-banner-flow">' +
        '<div><strong>Envío automático a 3 planillas:</strong> Cada inscripción alimenta al instante la <strong>Base General de Alumnos</strong>, la <strong>Planilla de Asistencias</strong> y el <strong>Control de Cuotas</strong>' +
        (db.config.opcionales.integrarClientesCtaCte ? ' + sincroniza con <strong>Clientes / Cta. Cte. ERP</strong>.' : '.') + '</div>' +
        '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" id="ac-export-base-csv">📥 Exportar Base General (CSV)</button>' +
      '</div>' +

      (editAlu
        ? '<div class="ac-card" style="border-color:#0ea5e9;">' +
            '<h3><span>✏️ Editando Ficha de Alumno: ' + esc(editAlu.nombre) + ' (' + esc(editAlu.legajo) + ')</span><button type="button" class="ac-btn ac-btn--outline ac-btn--sm" id="ac-cancel-edit-alu">Cancelar</button></h3>' +
            '<form id="ac-form-edit-alu" class="ac-form-grid">' +
              '<div class="ac-field"><label>Apellido y Nombre *</label><input class="ac-input" name="nombre" required value="' + esc(editAlu.nombre) + '"></div>' +
              '<div class="ac-field"><label>DNI</label><input class="ac-input" name="dni" value="' + esc(editAlu.dni) + '"></div>' +
              '<div class="ac-field"><label>WhatsApp</label><input class="ac-input" name="whatsapp" value="' + esc(editAlu.whatsapp) + '"></div>' +
              '<div class="ac-field"><label>Email</label><input class="ac-input" name="email" value="' + esc(editAlu.email) + '"></div>' +
              '<div class="ac-field"><label>Domicilio</label><input class="ac-input" name="domicilio" value="' + esc(editAlu.domicilio) + '"></div>' +
              '<div class="ac-field"><label>Tutor / Responsable</label><input class="ac-input" name="tutorNombre" value="' + esc(editAlu.tutorNombre) + '"></div>' +
              '<div class="ac-field"><label>WhatsApp Tutor</label><input class="ac-input" name="tutorWhatsapp" value="' + esc(editAlu.tutorWhatsapp) + '"></div>' +
              '<div class="ac-field"><label>Contacto Emergencia</label><input class="ac-input" name="contactoEmergencia" value="' + esc(editAlu.contactoEmergencia) + '"></div>' +
              '<div class="ac-field"><label>Estado</label><select class="ac-select" name="estado">' +
                ['activo', 'pausado', 'egresado', 'baja'].map(function (st) {
                  return '<option value="' + st + '"' + (editAlu.estado === st ? ' selected' : '') + '>' + st.toUpperCase() + '</option>';
                }).join('') +
              '</select></div>' +
              '<div class="ac-field"><label>Apto Físico / Salud</label><label style="display:flex;align-items:center;gap:6px;font-weight:600;margin-top:6px;"><input type="checkbox" name="aptoFisicoOk"' + (editAlu.aptoFisicoOk ? ' checked' : '') + '> Apto físico presentado</label></div>' +
              '<div class="ac-field"><label>Obs. Salud / Alergias</label><input class="ac-input" name="observacionesSalud" value="' + esc(editAlu.observacionesSalud) + '"></div>' +
              '<div class="ac-field"><label>Notas</label><input class="ac-input" name="notas" value="' + esc(editAlu.notas) + '"></div>' +
              '<div style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:0.5rem;"><button type="submit" class="ac-btn ac-btn--primary">💾 Guardar Cambios</button></div>' +
            '</form>' +
          '</div>'
        : '') +

      '<div class="ac-card">' +
        '<h3><span>📝 Formulario de Inscripción Rápida</span>' +
          (activeCursos.length === 0 ? '<button type="button" class="ac-btn ac-btn--primary ac-btn--sm" data-ac-go="cursos">Primero creá un Curso →</button>' : '') +
        '</h3>' +
        '<form id="ac-form-inscripcion" class="ac-form-grid">' +
          '<div class="ac-field"><label>Curso / Comisión *</label><select class="ac-select" name="cursoId" required>' +
            (activeCursos.length === 0
              ? '<option value="">-- Creá primero un curso en Cursos y Horarios --</option>'
              : activeCursos.map(function (c) {
                  var oc = (db.inscripciones || []).filter(function (i) { return i.cursoId === c.id && i.estado === 'activa'; }).length;
                  return '<option value="' + esc(c.id) + '">' + esc(c.nombre) + ' (' + oc + '/' + c.cupoMaximo + ' · Cuota ' + fmtMoney(c.arancelCuotaMensual) + ')</option>';
                }).join('')) +
          '</select></div>' +
          '<div class="ac-field"><label>Apellido y Nombre del Alumno *</label><input class="ac-input" name="nombre" required placeholder="Ej: LÓPEZ, CAMILA"></div>' +
          '<div class="ac-field"><label>DNI</label><input class="ac-input" name="dni" placeholder="Ej: 41234567"></div>' +
          '<div class="ac-field"><label>Fecha de Nacimiento</label><input class="ac-input" type="date" name="fechaNacimiento"></div>' +
          '<div class="ac-field"><label>WhatsApp</label><input class="ac-input" name="whatsapp" placeholder="Ej: 5493584..."></div>' +
          '<div class="ac-field"><label>Email</label><input class="ac-input" type="email" name="email" placeholder="alumno@mail.com"></div>' +
          '<div class="ac-field"><label>Tutor / Responsable (si es menor)</label><input class="ac-input" name="tutorNombre" placeholder="Opcional"></div>' +
          '<div class="ac-field"><label>Contacto de Emergencia</label><input class="ac-input" name="contactoEmergencia" placeholder="Nombre y teléfono"></div>' +
          '<div class="ac-field"><label>Beca / Descuento (%)</label><input class="ac-input" type="number" name="becaPct" min="0" max="100" step="1" value="0"></div>' +
          '<div class="ac-field"><label>Medio de Pago Inicial (si cobra ahora)</label><select class="ac-select" name="medioPagoInicial">' +
            '<option value="efectivo">Efectivo (Presencial)</option><option value="transferencia">Transferencia</option><option value="debito">Débito</option><option value="credito">Crédito</option><option value="qr">QR / Billetera</option>' +
          '</select></div>' +
          '<div class="ac-field"><label>Observaciones / Salud</label><input class="ac-input" name="observacionesSalud" placeholder="Alergias, lesiones, notas..."></div>' +
          '<div class="ac-field" style="justify-content:center;gap:0.35rem;">' +
            '<label style="display:flex;align-items:center;gap:6px;font-weight:600;"><input type="checkbox" name="cobrarMatriculaAhora"> Cobrar matrícula ahora</label>' +
            '<label style="display:flex;align-items:center;gap:6px;font-weight:600;"><input type="checkbox" name="cobrarPrimeraCuotaAhora"> Cobrar 1° cuota ahora</label>' +
            '<label style="display:flex;align-items:center;gap:6px;font-weight:600;"><input type="checkbox" name="aptoFisicoOk"> Apto físico OK</label>' +
          '</div>' +
          '<div style="grid-column:1/-1;display:flex;justify-content:flex-end;">' +
            '<button type="submit" class="ac-btn ac-btn--primary"' + (activeCursos.length === 0 ? ' disabled' : '') + '>✅ Inscribir y Enviar a Base + Asistencias + Cuotas</button>' +
          '</div>' +
        '</form>' +
      '</div>' +

      '<div class="ac-card">' +
        '<h3><span>📋 Base General de Alumnos (' + filteredAlu.length + ')</span>' +
          '<input type="search" id="ac-search-alu" class="ac-input" style="max-width:290px;" placeholder="Buscar por nombre, DNI o legajo..." value="' + esc(STATE.search) + '">' +
        '</h3>' +
        '<div class="ac-table-wrap"><table class="ac-table"><thead><tr><th>Legajo</th><th>Alumno / DNI</th><th>Cursos Activos</th><th>Contacto</th><th>Apto Físico</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>' +
        (filteredAlu.length === 0
          ? '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:1.25rem;">Todavía no hay alumnos cargados.</td></tr>'
          : filteredAlu.map(function (a) {
              var cursosAlu = (db.inscripciones || [])
                .filter(function (i) { return i.alumnoId === a.id && i.estado === 'activa'; })
                .map(function (i) { return i.cursoNombre + (i.becaPct > 0 ? ' (-' + i.becaPct + '%)' : ''); });
              return (
                '<tr>' +
                  '<td><strong>' + esc(a.legajo) + '</strong>' + (a.clienteId ? '<br><small style="color:#0f766e;">ERP #' + esc(a.clienteId) + '</small>' : '') + '</td>' +
                  '<td><strong>' + esc(a.nombre) + '</strong><br><small>DNI: ' + esc(a.dni || '—') + (a.tutorNombre ? ' · Tutor: ' + esc(a.tutorNombre) : '') + '</small></td>' +
                  '<td>' + (cursosAlu.length ? cursosAlu.map(function (c) { return '<span class="ac-badge ac-badge--blue" style="margin:2px;">' + esc(c) + '</span>'; }).join('') : '<span class="ac-badge ac-badge--gray">Sin cursado</span>') + '</td>' +
                  '<td>' + esc(a.whatsapp || a.tutorWhatsapp || '—') + (a.email ? '<br><small>' + esc(a.email) + '</small>' : '') + '</td>' +
                  '<td>' + (a.aptoFisicoOk ? '<span class="ac-badge ac-badge--green">✓ OK</span>' : '<span class="ac-badge ac-badge--yellow">Pendiente</span>') + '</td>' +
                  '<td><span class="ac-badge ' + (a.estado === 'activo' ? 'ac-badge--green' : 'ac-badge--gray') + '">' + esc(a.estado.toUpperCase()) + '</span></td>' +
                  '<td style="display:flex;gap:0.3rem;flex-wrap:wrap;">' +
                    '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" data-ac-edit-alu="' + esc(a.id) + '">✏️</button>' +
                    '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" data-ac-wa-alu="' + esc(a.id) + '">💬</button>' +
                  '</td>' +
                '</tr>'
              );
            }).join('')) +
        '</tbody></table></div>' +
      '</div>';

    body.querySelectorAll('[data-ac-go]').forEach(function (b) {
      b.addEventListener('click', function () { openAcademiasView(b.getAttribute('data-ac-go')); });
    });
    var searchInp = body.querySelector('#ac-search-alu');
    if (searchInp) {
      searchInp.addEventListener('input', function () {
        STATE.search = searchInp.value;
        renderWorkspace();
      });
    }
    var btnExp = body.querySelector('#ac-export-base-csv');
    if (btnExp) {
      btnExp.addEventListener('click', function () {
        var rows = [['Legajo', 'Nombre', 'DNI', 'WhatsApp', 'Email', 'Tutor', 'Apto Fisico', 'Estado', 'Cursos Activos']];
        db.alumnos.forEach(function (a) {
          var cs = db.inscripciones.filter(function (i) { return i.alumnoId === a.id && i.estado === 'activa'; }).map(function (i) { return i.cursoNombre; }).join(' | ');
          rows.push([a.legajo, a.nombre, a.dni, a.whatsapp, a.email, a.tutorNombre, a.aptoFisicoOk ? 'SI' : 'PENDIENTE', a.estado, cs]);
        });
        downloadCsv('base_general_alumnos_' + todayIso() + '.csv', rows);
      });
    }
    var formInsc = body.querySelector('#ac-form-inscripcion');
    if (formInsc) {
      formInsc.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(formInsc);
        var res = await apiAc('POST', {
          action: 'inscribir_alumno',
          inscripcion: {
            cursoId: fd.get('cursoId'),
            nombre: fd.get('nombre'),
            dni: fd.get('dni'),
            fechaNacimiento: fd.get('fechaNacimiento'),
            whatsapp: fd.get('whatsapp'),
            email: fd.get('email'),
            tutorNombre: fd.get('tutorNombre'),
            contactoEmergencia: fd.get('contactoEmergencia'),
            becaPct: Number(fd.get('becaPct')) || 0,
            medioPagoInicial: fd.get('medioPagoInicial'),
            observacionesSalud: fd.get('observacionesSalud'),
            cobrarMatriculaAhora: fd.get('cobrarMatriculaAhora') === 'on',
            cobrarPrimeraCuotaAhora: fd.get('cobrarPrimeraCuotaAhora') === 'on',
            aptoFisicoOk: fd.get('aptoFisicoOk') === 'on'
          }
        });
        if (res && res.ok) {
          applyApiResponse(res);
          showToast(res.message);
          renderWorkspace();
        } else {
          showToast((res && res.message) || 'No se pudo inscribir al alumno.', true);
        }
      });
    }
    body.querySelectorAll('[data-ac-edit-alu]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.editingAlumnoId = b.getAttribute('data-ac-edit-alu');
        renderWorkspace();
      });
    });
    var btnCancelAlu = body.querySelector('#ac-cancel-edit-alu');
    if (btnCancelAlu) {
      btnCancelAlu.addEventListener('click', function () { STATE.editingAlumnoId = ''; renderWorkspace(); });
    }
    var formEditAlu = body.querySelector('#ac-form-edit-alu');
    if (formEditAlu && editAlu) {
      formEditAlu.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(formEditAlu);
        var res = await apiAc('POST', {
          action: 'save_alumno',
          alumno: {
            id: editAlu.id,
            nombre: fd.get('nombre'),
            dni: fd.get('dni'),
            whatsapp: fd.get('whatsapp'),
            email: fd.get('email'),
            domicilio: fd.get('domicilio'),
            tutorNombre: fd.get('tutorNombre'),
            tutorWhatsapp: fd.get('tutorWhatsapp'),
            contactoEmergencia: fd.get('contactoEmergencia'),
            estado: fd.get('estado'),
            aptoFisicoOk: fd.get('aptoFisicoOk') === 'on',
            observacionesSalud: fd.get('observacionesSalud'),
            notas: fd.get('notas')
          }
        });
        if (res && res.ok) {
          STATE.editingAlumnoId = '';
          applyApiResponse(res);
          showToast(res.message);
          renderWorkspace();
        } else {
          showToast((res && res.message) || 'Error guardando ficha.', true);
        }
      });
    }
    body.querySelectorAll('[data-ac-wa-alu]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = db.alumnos.find(function (x) { return x.id === b.getAttribute('data-ac-wa-alu'); });
        if (a) openWhatsApp(a.whatsapp || a.tutorWhatsapp, 'Hola ' + a.nombre + ', te escribimos desde ' + (db.config.nombreAcademia || 'la Academia') + '.');
      });
    });
  }

  /* ---------- 3. CURSOS, COMISIONES Y HORARIOS ---------- */
  function renderCursos(body, db) {
    var editing = STATE.editingCursoId
      ? db.cursos.find(function (c) { return c.id === STATE.editingCursoId; })
      : null;
    var cur = editing || {
      id: '', codigo: '', nombre: '', categoria: 'Danza', nivel: 'Inicial',
      modalidad: 'presencial', docenteId: '', diasHorarios: '', aulaSala: '',
      cupoMaximo: 25, arancelMatricula: 0, arancelCuotaMensual: 0, duracionMeses: 6,
      cargaHorariaHs: 40, classroomUrl: '', classroomCodigo: '', activo: true, notas: ''
    };

    body.innerHTML =
      '<div class="ac-card">' +
        '<h3><span>' + (editing ? '✏️ Editar Curso / Comisión' : '➕ Nuevo Curso, Clase o Capacitación') + '</span>' +
          (editing ? '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" id="ac-cancel-edit-curso">Cancelar edición</button>' : '') +
        '</h3>' +
        '<form id="ac-form-curso" class="ac-form-grid">' +
          '<div class="ac-field"><label>Código</label><input class="ac-input" name="codigo" placeholder="Ej: DAN-01" value="' + esc(cur.codigo) + '"></div>' +
          '<div class="ac-field"><label>Nombre del Curso / Clase *</label><input class="ac-input" name="nombre" required placeholder="Ej: Danza Urbana / Finanzas para PyMEs" value="' + esc(cur.nombre) + '"></div>' +
          '<div class="ac-field"><label>Categoría / Disciplina</label><select class="ac-select" name="categoria">' +
            ['Danza', 'Escuela de Negocios', 'Capacitación Profesional', 'Idiomas', 'Arte y Música', 'Deportes / Fitness', 'Oficios y Talleres', 'Curso Intensivo', 'General'].map(function (cat) {
              return '<option value="' + esc(cat) + '"' + (cur.categoria === cat ? ' selected' : '') + '>' + esc(cat) + '</option>';
            }).join('') +
          '</select></div>' +
          '<div class="ac-field"><label>Nivel</label><input class="ac-input" name="nivel" value="' + esc(cur.nivel) + '"></div>' +
          '<div class="ac-field"><label>Modalidad</label><select class="ac-select" name="modalidad">' +
            '<option value="presencial"' + (cur.modalidad === 'presencial' ? ' selected' : '') + '>Presencial</option>' +
            '<option value="online"' + (cur.modalidad === 'online' ? ' selected' : '') + '>Online en Vivo (Daily.co / Classroom)</option>' +
            '<option value="hibrida"' + (cur.modalidad === 'hibrida' ? ' selected' : '') + '>Híbrida (Presencial + Online)</option>' +
          '</select></div>' +
          '<div class="ac-field"><label>Docente / Profesor</label><select class="ac-select" name="docenteId">' +
            '<option value="">-- Sin asignar --</option>' +
            (db.docentes || []).map(function (d) {
              return '<option value="' + esc(d.id) + '"' + (cur.docenteId === d.id ? ' selected' : '') + '>' + esc(d.nombre) + '</option>';
            }).join('') +
          '</select></div>' +
          '<div class="ac-field"><label>Días y Horarios</label><input class="ac-input" name="diasHorarios" placeholder="Ej: Lun y Mié 18:30 a 20:00" value="' + esc(cur.diasHorarios) + '"></div>' +
          '<div class="ac-field"><label>Sala / Aula</label><input class="ac-input" name="aulaSala" placeholder="Ej: Salón Espejos / Sala Virtual" value="' + esc(cur.aulaSala) + '"></div>' +
          '<div class="ac-field"><label>Cupo Máximo</label><input class="ac-input" type="number" name="cupoMaximo" min="1" value="' + esc(cur.cupoMaximo) + '"></div>' +
          '<div class="ac-field"><label>Matrícula ($)</label><input class="ac-input" type="number" name="arancelMatricula" min="0" step="100" value="' + esc(cur.arancelMatricula) + '"></div>' +
          '<div class="ac-field"><label>Cuota Mensual ($)</label><input class="ac-input" type="number" name="arancelCuotaMensual" min="0" step="100" value="' + esc(cur.arancelCuotaMensual) + '"></div>' +
          '<div class="ac-field"><label>Carga Horaria (hs para certificado)</label><input class="ac-input" type="number" name="cargaHorariaHs" min="0" value="' + esc(cur.cargaHorariaHs) + '"></div>' +
          '<div class="ac-field"><label>URL Google Classroom</label><input class="ac-input" name="classroomUrl" placeholder="https://classroom.google.com/c/..." value="' + esc(cur.classroomUrl) + '"></div>' +
          '<div class="ac-field"><label>Código de Clase Classroom</label><input class="ac-input" name="classroomCodigo" placeholder="Ej: ABC1234" value="' + esc(cur.classroomCodigo) + '"></div>' +
          '<div class="ac-field" style="justify-content:center;"><label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" name="activo"' + (cur.activo !== false ? ' checked' : '') + '> Curso activo para inscripciones</label></div>' +
          '<div style="grid-column:1/-1;display:flex;justify-content:flex-end;"><button type="submit" class="ac-btn ac-btn--primary">💾 Guardar Curso / Comisión</button></div>' +
        '</form>' +
      '</div>' +

      '<div class="ac-card">' +
        '<h3><span>📚 Cursos y Comisiones (' + db.cursos.length + ')</span></h3>' +
        '<div class="ac-table-wrap"><table class="ac-table"><thead><tr><th>Código / Curso</th><th>Modalidad / Horario</th><th>Docente</th><th>Cupo</th><th>Aranceles</th><th>Classroom</th><th>Acciones</th></tr></thead><tbody>' +
        (db.cursos.length === 0
          ? '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:1.25rem;">Aún no creaste cursos o comisiones.</td></tr>'
          : db.cursos.map(function (c) {
              var oc = db.inscripciones.filter(function (i) { return i.cursoId === c.id && i.estado === 'activa'; }).length;
              return (
                '<tr>' +
                  '<td><strong>' + esc(c.codigo) + ' · ' + esc(c.nombre) + '</strong><br><small>' + esc(c.categoria) + ' · ' + esc(c.nivel) + (c.cargaHorariaHs ? ' · ' + c.cargaHorariaHs + ' hs' : '') + '</small></td>' +
                  '<td><span class="ac-badge ac-badge--blue">' + esc(c.modalidad.toUpperCase()) + '</span><br><small>' + esc(c.diasHorarios || '—') + (c.aulaSala ? ' · ' + esc(c.aulaSala) : '') + '</small></td>' +
                  '<td>' + esc(c.docenteNombre || 'Sin asignar') + '</td>' +
                  '<td><strong>' + oc + ' / ' + c.cupoMaximo + '</strong></td>' +
                  '<td>Cuota: <strong>' + fmtMoney(c.arancelCuotaMensual) + '</strong><br><small>Matríc.: ' + fmtMoney(c.arancelMatricula) + '</small></td>' +
                  '<td>' + (c.classroomUrl ? '<a href="' + esc(c.classroomUrl) + '" target="_blank" rel="noopener noreferrer" class="ac-btn ac-btn--outline ac-btn--sm">Classroom ↗</a>' + (c.classroomCodigo ? '<br><small>Cód: ' + esc(c.classroomCodigo) + '</small>' : '') : '<small style="color:#94a3b8;">Sin vincular</small>') + '</td>' +
                  '<td style="display:flex;gap:0.3rem;flex-wrap:wrap;">' +
                    '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" data-ac-edit-curso="' + esc(c.id) + '">✏️</button>' +
                    '<button type="button" class="ac-btn ac-btn--danger ac-btn--sm" data-ac-del-curso="' + esc(c.id) + '">🗑️</button>' +
                  '</td>' +
                '</tr>'
              );
            }).join('')) +
        '</tbody></table></div>' +
      '</div>';

    var btnCancel = body.querySelector('#ac-cancel-edit-curso');
    if (btnCancel) btnCancel.addEventListener('click', function () { STATE.editingCursoId = ''; renderWorkspace(); });

    body.querySelector('#ac-form-curso').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var res = await apiAc('POST', {
        action: 'save_curso',
        curso: {
          id: cur.id || '',
          codigo: fd.get('codigo'),
          nombre: fd.get('nombre'),
          categoria: fd.get('categoria'),
          nivel: fd.get('nivel'),
          modalidad: fd.get('modalidad'),
          docenteId: fd.get('docenteId'),
          diasHorarios: fd.get('diasHorarios'),
          aulaSala: fd.get('aulaSala'),
          cupoMaximo: Number(fd.get('cupoMaximo')) || 25,
          arancelMatricula: Number(fd.get('arancelMatricula')) || 0,
          arancelCuotaMensual: Number(fd.get('arancelCuotaMensual')) || 0,
          cargaHorariaHs: Number(fd.get('cargaHorariaHs')) || 0,
          classroomUrl: fd.get('classroomUrl'),
          classroomCodigo: fd.get('classroomCodigo'),
          activo: fd.get('activo') === 'on'
        }
      });
      if (res && res.ok) {
        STATE.editingCursoId = '';
        applyApiResponse(res);
        showToast(res.message);
        renderWorkspace();
      } else {
        showToast((res && res.message) || 'Error guardando curso.', true);
      }
    });

    body.querySelectorAll('[data-ac-edit-curso]').forEach(function (b) {
      b.addEventListener('click', function () { STATE.editingCursoId = b.getAttribute('data-ac-edit-curso'); renderWorkspace(); });
    });
    body.querySelectorAll('[data-ac-del-curso]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar este curso/comisión?')) return;
        var res = await apiAc('POST', { action: 'delete_curso', id: b.getAttribute('data-ac-del-curso') });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
      });
    });
  }

  /* ---------- 4. PLANILLA DE ASISTENCIAS ---------- */
  function renderAsistencias(body, db) {
    var cursos = db.cursos || [];
    if (!STATE.asistCursoId && cursos.length > 0) {
      STATE.asistCursoId = cursos[0].id;
      syncAsistenciaDraftFromDb();
    }
    var insList = (db.inscripciones || []).filter(function (i) {
      return i.cursoId === STATE.asistCursoId && i.estado === 'activa';
    });
    var minPct = Number(db.config.asistenciaMinimaCertificadoPct) || 75;
    var history = (db.asistencias || []).filter(function (s) {
      return !STATE.asistCursoId || s.cursoId === STATE.asistCursoId;
    });

    body.innerHTML =
      '<div class="ac-card">' +
        '<h3><span>✅ Toma de Asistencia por Comisión</span>' +
          '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">' +
            '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" id="ac-att-all-p">Todos Presentes (P)</button>' +
            '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" id="ac-att-export-csv">📥 Exportar Planilla CSV</button>' +
          '</div>' +
        '</h3>' +
        '<div class="ac-form-grid" style="margin-bottom:0.85rem;">' +
          '<div class="ac-field"><label>Curso / Comisión</label><select class="ac-select" id="ac-att-curso">' +
            cursos.map(function (c) {
              return '<option value="' + esc(c.id) + '"' + (c.id === STATE.asistCursoId ? ' selected' : '') + '>' + esc(c.nombre) + '</option>';
            }).join('') +
          '</select></div>' +
          '<div class="ac-field"><label>Fecha de Clase</label><input class="ac-input" type="date" id="ac-att-fecha" value="' + esc(STATE.asistFecha) + '"></div>' +
          '<div class="ac-field"><label>Modalidad</label><select class="ac-select" id="ac-att-mod">' +
            '<option value="presencial"' + (STATE.asistModalidad === 'presencial' ? ' selected' : '') + '>Presencial</option>' +
            '<option value="online"' + (STATE.asistModalidad === 'online' ? ' selected' : '') + '>Online (Daily.co / Meet)</option>' +
          '</select></div>' +
          '<div class="ac-field"><label>Tema dictado en clase</label><input class="ac-input" id="ac-att-tema" placeholder="Ej: Coreografía bloque 2 / Costos" value="' + esc(STATE.asistTema) + '"></div>' +
        '</div>' +
        '<div class="ac-table-wrap"><table class="ac-table"><thead><tr><th>Alumno</th><th>Estado Hoy (P/A/T/J)</th><th>Asistencia Acumulada</th><th>Certificado</th></tr></thead><tbody>' +
        (insList.length === 0
          ? '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:1.25rem;">No hay alumnos inscriptos en este curso todavía.</td></tr>'
          : insList.map(function (ins) {
              var curVal = STATE.asistDraft[ins.alumnoId] || 'P';
              var stat = calcAlumnoAttendance(ins.alumnoId, STATE.asistCursoId);
              return (
                '<tr>' +
                  '<td><strong>' + esc(ins.alumnoNombre) + '</strong><br><small>DNI: ' + esc(ins.alumnoDni || '—') + '</small></td>' +
                  '<td style="display:flex;gap:0.3rem;">' +
                    ['P', 'A', 'T', 'J'].map(function (code) {
                      var lbl = code === 'P' ? 'Presente' : code === 'A' ? 'Ausente' : code === 'T' ? 'Tardanza' : 'Justificado';
                      return '<button type="button" title="' + lbl + '" class="ac-att-btn' + (curVal === code ? ' is-' + code : '') + '" data-ac-att-alu="' + esc(ins.alumnoId) + '" data-ac-att-val="' + code + '">' + code + '</button>';
                    }).join('') +
                  '</td>' +
                  '<td><strong>' + stat.pct + '%</strong> <small>(' + stat.presentes + '/' + stat.total + ' clases)</small></td>' +
                  '<td>' + (stat.pct >= minPct ? '<span class="ac-badge ac-badge--green">✓ Cumple (' + minPct + '%)</span>' : '<span class="ac-badge ac-badge--red">Bajo mínimo</span>') + '</td>' +
                '</tr>'
              );
            }).join('')) +
        '</tbody></table></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:0.85rem;">' +
          '<button type="button" class="ac-btn ac-btn--primary" id="ac-att-save"' + (insList.length === 0 ? ' disabled' : '') + '>💾 Guardar Planilla de Asistencia</button>' +
        '</div>' +
      '</div>' +

      '<div class="ac-card">' +
        '<h3><span>📅 Historial de Clases Registradas (' + history.length + ')</span></h3>' +
        '<div class="ac-table-wrap"><table class="ac-table"><thead><tr><th>Fecha</th><th>Curso</th><th>Modalidad</th><th>Tema</th><th>Presentes</th><th>Acción</th></tr></thead><tbody>' +
        (history.length === 0
          ? '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:1rem;">Sin sesiones registradas aún.</td></tr>'
          : history.slice(0, 20).map(function (s) {
              var vals = Object.values(s.registros || {});
              var pres = vals.filter(function (v) { return v === 'P' || v === 'T' || v === 'J'; }).length;
              return (
                '<tr>' +
                  '<td><strong>' + esc(s.fecha) + '</strong></td>' +
                  '<td>' + esc(s.cursoNombre) + '</td>' +
                  '<td><span class="ac-badge ac-badge--blue">' + esc(s.modalidadSesion) + '</span></td>' +
                  '<td>' + esc(s.temaClase || '—') + '</td>' +
                  '<td><strong>' + pres + ' / ' + vals.length + '</strong></td>' +
                  '<td><button type="button" class="ac-btn ac-btn--outline ac-btn--sm" data-ac-open-ses="' + esc(s.cursoId) + '|' + esc(s.fecha) + '">Abrir / Editar</button></td>' +
                '</tr>'
              );
            }).join('')) +
        '</tbody></table></div>' +
      '</div>';

    var selCur = body.querySelector('#ac-att-curso');
    if (selCur) {
      selCur.addEventListener('change', function () {
        STATE.asistCursoId = selCur.value;
        syncAsistenciaDraftFromDb();
        renderWorkspace();
      });
    }
    var inpFecha = body.querySelector('#ac-att-fecha');
    if (inpFecha) {
      inpFecha.addEventListener('change', function () {
        STATE.asistFecha = inpFecha.value;
        syncAsistenciaDraftFromDb();
        renderWorkspace();
      });
    }
    var selMod = body.querySelector('#ac-att-mod');
    if (selMod) selMod.addEventListener('change', function () { STATE.asistModalidad = selMod.value; });
    var inpTema = body.querySelector('#ac-att-tema');
    if (inpTema) inpTema.addEventListener('input', function () { STATE.asistTema = inpTema.value; });

    body.querySelectorAll('[data-ac-att-alu]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.asistDraft[b.getAttribute('data-ac-att-alu')] = b.getAttribute('data-ac-att-val');
        renderWorkspace();
      });
    });
    var btnAllP = body.querySelector('#ac-att-all-p');
    if (btnAllP) {
      btnAllP.addEventListener('click', function () {
        insList.forEach(function (i) { STATE.asistDraft[i.alumnoId] = 'P'; });
        renderWorkspace();
      });
    }
    var btnSave = body.querySelector('#ac-att-save');
    if (btnSave) {
      btnSave.addEventListener('click', async function () {
        var res = await apiAc('POST', {
          action: 'save_asistencia',
          sesion: {
            cursoId: STATE.asistCursoId,
            fecha: STATE.asistFecha,
            temaClase: STATE.asistTema,
            modalidadSesion: STATE.asistModalidad,
            registros: STATE.asistDraft
          }
        });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
        else showToast((res && res.message) || 'Error guardando asistencia.', true);
      });
    }
    body.querySelectorAll('[data-ac-open-ses]').forEach(function (b) {
      b.addEventListener('click', function () {
        var parts = b.getAttribute('data-ac-open-ses').split('|');
        STATE.asistCursoId = parts[0];
        STATE.asistFecha = parts[1];
        syncAsistenciaDraftFromDb();
        renderWorkspace();
      });
    });
    var btnCsv = body.querySelector('#ac-att-export-csv');
    if (btnCsv) {
      btnCsv.addEventListener('click', function () {
        var rows = [['Fecha', 'Curso', 'Modalidad', 'Tema', 'Alumno', 'Estado']];
        history.forEach(function (s) {
          Object.keys(s.registros || {}).forEach(function (aid) {
            var alu = db.alumnos.find(function (a) { return a.id === aid; });
            rows.push([s.fecha, s.cursoNombre, s.modalidadSesion, s.temaClase, alu ? alu.nombre : aid, s.registros[aid]]);
          });
        });
        downloadCsv('planilla_asistencias_' + todayIso() + '.csv', rows);
      });
    }
  }

  /* ---------- 5. CONTROL DE CUOTAS Y COBRANZAS ---------- */
  function renderCuotas(body, db) {
    var today = todayIso();
    var q = STATE.search.trim().toLowerCase();
    var cuotas = (db.cuotas || []).filter(function (c) {
      if (STATE.cuotaFilter === 'pendientes' && !(c.estado === 'pendiente' || c.estado === 'parcial')) return false;
      if (STATE.cuotaFilter === 'vencidas' && !((c.estado === 'pendiente' || c.estado === 'parcial') && c.fechaVencimiento < today)) return false;
      if (STATE.cuotaFilter === 'pagadas' && c.estado !== 'pagada') return false;
      if (q && String(c.alumnoNombre + ' ' + c.concepto + ' ' + c.numero).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var payTarget = STATE.payingCuotaId
      ? db.cuotas.find(function (c) { return c.id === STATE.payingCuotaId; })
      : null;

    body.innerHTML =
      '<div class="ac-card">' +
        '<h3><span>💵 Generación Mensual y Filtros de Cuotas</span>' +
          '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;align-items:center;">' +
            '<input type="month" id="ac-cuo-periodo" class="ac-input" style="width:auto;" value="' + esc(STATE.cuotaPeriodo) + '">' +
            '<button type="button" class="ac-btn ac-btn--primary ac-btn--sm" id="ac-btn-gen-cuotas">⚡ Generar Cuotas del Mes</button>' +
            '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" id="ac-export-cuotas-csv">📥 Exportar Cuotas CSV</button>' +
          '</div>' +
        '</h3>' +
        '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;align-items:center;justify-content:space-between;">' +
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">' +
            [['pendientes', 'Pendientes y Parciales'], ['vencidas', 'Vencidas'], ['pagadas', 'Pagadas'], ['todas', 'Todas']].map(function (it) {
              return '<button type="button" class="ac-btn ac-btn--sm ' + (STATE.cuotaFilter === it[0] ? 'ac-btn--primary' : 'ac-btn--outline') + '" data-ac-cfilter="' + it[0] + '">' + it[1] + '</button>';
            }).join('') +
          '</div>' +
          '<input type="search" id="ac-cuo-search" class="ac-input" style="max-width:260px;" placeholder="Buscar alumno o cuota..." value="' + esc(STATE.search) + '">' +
        '</div>' +
      '</div>' +

      (payTarget
        ? '<div class="ac-card" style="border:2px solid #10b981;">' +
            '<h3><span>💵 Registrar Cobranza Presencial — ' + esc(payTarget.alumnoNombre) + ' (' + esc(payTarget.concepto) + ')</span><button type="button" class="ac-btn ac-btn--outline ac-btn--sm" id="ac-cancel-pay">Cerrar</button></h3>' +
            '<form id="ac-form-pay" class="ac-form-grid">' +
              '<div class="ac-field"><label>Importe a Cobrar ($) *</label><input class="ac-input" type="number" step="0.01" min="1" name="importe" required value="' + esc(payTarget.saldoPendiente) + '"></div>' +
              '<div class="ac-field"><label>Recargo por Mora adicional ($)</label><input class="ac-input" type="number" step="0.01" min="0" name="recargoMora" value="0"></div>' +
              '<div class="ac-field"><label>Medio de Pago</label><select class="ac-select" name="medioPago">' +
                '<option value="efectivo">Efectivo (Local)</option><option value="transferencia">Transferencia Bancaria</option><option value="debito">Tarjeta Débito</option><option value="credito">Tarjeta Crédito</option><option value="qr">QR / Billetera Virtual</option>' +
                (db.config.opcionales.pagosOnlineMp ? '<option value="mercadopago">Mercado Pago Online</option>' : '') +
                '<option value="ctacte">Cuenta Corriente ERP</option>' +
              '</select></div>' +
              '<div class="ac-field"><label>Fecha de Cobro</label><input class="ac-input" type="date" name="fechaPago" value="' + todayIso() + '"></div>' +
              '<div class="ac-field"><label>Referencia / Comprobante</label><input class="ac-input" name="referencia" placeholder="Ej: Caja local / N° op."></div>' +
              '<div class="ac-field"><label>Observaciones</label><input class="ac-input" name="observaciones"></div>' +
              '<div style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:0.5rem;"><button type="submit" class="ac-btn ac-btn--accent">✅ Confirmar Cobro y Emitir Recibo</button></div>' +
            '</form>' +
          '</div>'
        : '') +

      '<div class="ac-card">' +
        '<h3><span>📑 Control de Cuotas (' + cuotas.length + ')</span></h3>' +
        '<div class="ac-table-wrap"><table class="ac-table"><thead><tr><th>N° / Período</th><th>Alumno</th><th>Concepto</th><th>Venc.</th><th>Total</th><th>Pagado / Saldo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>' +
        (cuotas.length === 0
          ? '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:1.25rem;">Sin cuotas para este filtro.</td></tr>'
          : cuotas.map(function (c) {
              var isVenc = (c.estado === 'pendiente' || c.estado === 'parcial') && c.fechaVencimiento < today;
              var badgeCls = c.estado === 'pagada' ? 'ac-badge--green' : c.estado === 'parcial' ? 'ac-badge--blue' : isVenc ? 'ac-badge--red' : c.estado === 'pendiente' ? 'ac-badge--yellow' : 'ac-badge--gray';
              return (
                '<tr>' +
                  '<td><strong>' + esc(c.numero) + '</strong><br><small>' + esc(c.periodo) + '</small></td>' +
                  '<td><strong>' + esc(c.alumnoNombre) + '</strong></td>' +
                  '<td>' + esc(c.concepto) + (c.descuentoBeca > 0 ? '<br><small style="color:#0f766e;">Beca: -' + fmtMoney(c.descuentoBeca) + '</small>' : '') + '</td>' +
                  '<td>' + esc(c.fechaVencimiento) + '</td>' +
                  '<td>' + fmtMoney(c.importeTotal) + '</td>' +
                  '<td>Pag: ' + fmtMoney(c.importePagado) + '<br><strong>Sal: ' + fmtMoney(c.saldoPendiente) + '</strong></td>' +
                  '<td><span class="ac-badge ' + badgeCls + '">' + esc(isVenc ? 'VENCIDA' : c.estado.toUpperCase()) + '</span></td>' +
                  '<td style="display:flex;gap:0.3rem;flex-wrap:wrap;">' +
                    ((c.estado === 'pendiente' || c.estado === 'parcial') ? '<button type="button" class="ac-btn ac-btn--accent ac-btn--sm" data-ac-pay="' + esc(c.id) + '">💵 Cobrar</button>' : '') +
                    (c.ultimoReciboNumero ? '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" data-ac-print-rec="' + esc(c.ultimoReciboNumero) + '">🖨️ Recibo</button>' : '') +
                    ((c.estado === 'pendiente' || c.estado === 'parcial') ? '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" data-ac-wa-c="' + esc(c.id) + '">💬</button>' : '') +
                  '</td>' +
                '</tr>'
              );
            }).join('')) +
        '</tbody></table></div>' +
      '</div>' +

      '<div class="ac-card">' +
        '<h3><span>🧾 Últimos Pagos y Recibos Emitidos (' + db.pagos.length + ')</span></h3>' +
        '<div class="ac-table-wrap"><table class="ac-table"><thead><tr><th>Recibo</th><th>Fecha</th><th>Alumno</th><th>Concepto</th><th>Medio</th><th>Importe</th><th>Imprimir</th></tr></thead><tbody>' +
        (db.pagos.length === 0
          ? '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:1rem;">Aún no hay cobros registrados.</td></tr>'
          : db.pagos.slice(0, 20).map(function (p) {
              return (
                '<tr>' +
                  '<td><strong>' + esc(p.reciboNumero) + '</strong></td>' +
                  '<td>' + esc(p.fechaPago) + '</td>' +
                  '<td>' + esc(p.alumnoNombre) + '</td>' +
                  '<td>' + esc(p.concepto) + '</td>' +
                  '<td style="text-transform:uppercase;">' + esc(p.medioPago) + '</td>' +
                  '<td><strong>' + fmtMoney(p.importe) + '</strong></td>' +
                  '<td><button type="button" class="ac-btn ac-btn--outline ac-btn--sm" data-ac-print-rec="' + esc(p.reciboNumero) + '">🖨️ Recibo</button></td>' +
                '</tr>'
              );
            }).join('')) +
        '</tbody></table></div>' +
      '</div>';

    body.querySelector('#ac-cuo-periodo').addEventListener('change', function (ev) { STATE.cuotaPeriodo = ev.target.value; });
    body.querySelector('#ac-btn-gen-cuotas').addEventListener('click', async function () {
      var res = await apiAc('POST', { action: 'generar_cuotas_mes', periodo: STATE.cuotaPeriodo });
      if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
      else showToast((res && res.message) || 'Error generando cuotas.', true);
    });
    body.querySelectorAll('[data-ac-cfilter]').forEach(function (b) {
      b.addEventListener('click', function () { STATE.cuotaFilter = b.getAttribute('data-ac-cfilter'); renderWorkspace(); });
    });
    body.querySelector('#ac-cuo-search').addEventListener('input', function (ev) { STATE.search = ev.target.value; renderWorkspace(); });
    body.querySelectorAll('[data-ac-pay]').forEach(function (b) {
      b.addEventListener('click', function () { STATE.payingCuotaId = b.getAttribute('data-ac-pay'); renderWorkspace(); });
    });
    var btnCancelPay = body.querySelector('#ac-cancel-pay');
    if (btnCancelPay) btnCancelPay.addEventListener('click', function () { STATE.payingCuotaId = ''; renderWorkspace(); });
    var formPay = body.querySelector('#ac-form-pay');
    if (formPay && payTarget) {
      formPay.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(formPay);
        var res = await apiAc('POST', {
          action: 'registrar_pago',
          pago: {
            cuotaId: payTarget.id,
            importe: Number(fd.get('importe')) || 0,
            recargoMora: Number(fd.get('recargoMora')) || 0,
            medioPago: fd.get('medioPago'),
            fechaPago: fd.get('fechaPago'),
            referencia: fd.get('referencia'),
            observaciones: fd.get('observaciones')
          }
        });
        if (res && res.ok) {
          STATE.payingCuotaId = '';
          applyApiResponse(res);
          showToast(res.message);
          renderWorkspace();
        } else {
          showToast((res && res.message) || 'Error registrando pago.', true);
        }
      });
    }
    body.querySelectorAll('[data-ac-print-rec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var rNum = b.getAttribute('data-ac-print-rec');
        var p = db.pagos.find(function (x) { return x.reciboNumero === rNum; });
        if (p) printReciboPago(p);
      });
    });
    body.querySelectorAll('[data-ac-wa-c]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = db.cuotas.find(function (x) { return x.id === b.getAttribute('data-ac-wa-c'); });
        if (c) openWhatsApp(c.alumnoWhatsapp, 'Hola ' + c.alumnoNombre + ', te compartimos el detalle de tu ' + c.concepto + ' por ' + fmtMoney(c.saldoPendiente) + ' (venc. ' + c.fechaVencimiento + '). ¡Gracias!');
      });
    });
    body.querySelector('#ac-export-cuotas-csv').addEventListener('click', function () {
      var rows = [['Numero', 'Periodo', 'Alumno', 'Curso', 'Vencimiento', 'Total', 'Pagado', 'Saldo', 'Estado', 'Ultimo Recibo']];
      cuotas.forEach(function (c) {
        rows.push([c.numero, c.periodo, c.alumnoNombre, c.cursoNombre, c.fechaVencimiento, c.importeTotal, c.importePagado, c.saldoPendiente, c.estado, c.ultimoReciboNumero]);
      });
      downloadCsv('control_cuotas_' + todayIso() + '.csv', rows);
    });
  }

  /* ---------- 6. AULA VIRTUAL, GOOGLE CLASSROOM Y CLASES ONLINE (DAILY.CO) ---------- */
  function renderAulaVirtual(body, db) {
    var cursos = db.cursos || [];
    body.innerHTML =
      '<div class="ac-banner-flow">' +
        '<div><strong>Aula Virtual Integrada:</strong> Conectá tus cursos con <strong>Google Classroom</strong> y dictá <strong>Clases Online Multiusuario en Vivo</strong> con la plataforma <strong>Daily.co</strong> (hasta 50 participantes por sala, misma tecnología que Reiki Online).</div>' +
      '</div>' +

      '<div class="ac-card">' +
        '<h3><span>🎥 Programar Clase Online Multiusuario (Daily.co / Meet / Zoom)</span></h3>' +
        '<form id="ac-form-online" class="ac-form-grid">' +
          '<div class="ac-field"><label>Curso / Comisión *</label><select class="ac-select" name="cursoId" required>' +
            cursos.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.nombre) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="ac-field"><label>Título del Encuentro *</label><input class="ac-input" name="titulo" required placeholder="Ej: Clase en Vivo #3 — Taller Práctico"></div>' +
          '<div class="ac-field"><label>Plataforma</label><select class="ac-select" name="plataforma">' +
            '<option value="daily">Daily.co Multiusuario (Integrado — hasta 50 alumnos)</option>' +
            '<option value="google_meet">Google Meet</option>' +
            '<option value="zoom">Zoom</option>' +
            '<option value="classroom">Google Classroom</option>' +
          '</select></div>' +
          '<div class="ac-field"><label>Fecha</label><input class="ac-input" type="date" name="fecha" value="' + todayIso() + '"></div>' +
          '<div class="ac-field"><label>Hora Inicio</label><input class="ac-input" type="time" name="horaInicio" value="19:00"></div>' +
          '<div class="ac-field"><label>Duración (min)</label><input class="ac-input" type="number" name="duracionMin" min="15" max="300" value="90"></div>' +
          '<div class="ac-field"><label>URL externa (solo si usás Meet/Zoom)</label><input class="ac-input" name="roomUrl" placeholder="Automático si elegís Daily.co"></div>' +
          '<div style="grid-column:1/-1;display:flex;justify-content:flex-end;"><button type="submit" class="ac-btn ac-btn--primary"' + (cursos.length === 0 ? ' disabled' : '') + '>🎥 Crear Sala y Programar Clase</button></div>' +
        '</form>' +
        '<div class="ac-table-wrap" style="margin-top:0.9rem;"><table class="ac-table"><thead><tr><th>Fecha / Hora</th><th>Curso y Encuentro</th><th>Plataforma</th><th>Accesos a Sala</th><th>Grabación</th><th>Acción</th></tr></thead><tbody>' +
        (db.clasesOnline.length === 0
          ? '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:1rem;">Sin clases online programadas aún.</td></tr>'
          : db.clasesOnline.map(function (cl) {
              return (
                '<tr>' +
                  '<td><strong>' + esc(cl.fecha) + '</strong><br><small>' + esc(cl.horaInicio) + ' hs (' + cl.duracionMin + 'm)</small></td>' +
                  '<td><strong>' + esc(cl.titulo) + '</strong><br><small>' + esc(cl.cursoNombre) + ' · ' + esc(cl.docenteNombre) + '</small></td>' +
                  '<td><span class="ac-badge ac-badge--blue">' + esc(cl.plataforma.toUpperCase()) + '</span></td>' +
                  '<td style="display:flex;gap:0.35rem;flex-wrap:wrap;">' +
                    (cl.roomUrlHost ? '<a class="ac-btn ac-btn--accent ac-btn--sm" href="' + esc(cl.roomUrlHost) + '" target="_blank" rel="noopener noreferrer">Entrar Docente ↗</a>' : '') +
                    (cl.roomUrlAlumno ? '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" data-ac-copy-url="' + esc(cl.roomUrlAlumno) + '">📋 Link Alumnos</button>' : '') +
                  '</td>' +
                  '<td>' + (cl.grabacionUrl ? '<a href="' + esc(cl.grabacionUrl) + '" target="_blank" rel="noopener noreferrer">Ver video ↗</a>' : '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" data-ac-set-rec="' + esc(cl.id) + '">+ Grabación</button>') + '</td>' +
                  '<td><button type="button" class="ac-btn ac-btn--danger ac-btn--sm" data-ac-del-cls="' + esc(cl.id) + '">🗑️</button></td>' +
                '</tr>'
              );
            }).join('')) +
        '</tbody></table></div>' +
      '</div>' +

      '<div class="ac-card">' +
        '<h3><span>🎓 Integración Google Classroom y Repositorio de Materiales</span></h3>' +
        '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.85rem;">' +
          cursos.filter(function (c) { return c.classroomUrl || c.classroomCodigo; }).map(function (c) {
            return (
              '<div style="border:1px solid #cbd5e1;border-radius:10px;padding:0.6rem 0.85rem;background:#f8fafc;display:flex;align-items:center;gap:0.6rem;">' +
                '<div><strong>' + esc(c.nombre) + '</strong><br><small>Código Classroom: <strong>' + esc(c.classroomCodigo || '—') + '</strong></small></div>' +
                (c.classroomUrl ? '<a href="' + esc(c.classroomUrl) + '" target="_blank" rel="noopener noreferrer" class="ac-btn ac-btn--primary ac-btn--sm">Abrir Classroom ↗</a>' : '') +
              '</div>'
            );
          }).join('') +
        '</div>' +
        '<form id="ac-form-material" class="ac-form-grid">' +
          '<div class="ac-field"><label>Curso *</label><select class="ac-select" name="cursoId" required>' +
            cursos.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.nombre) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="ac-field"><label>Título del Material / Tarea *</label><input class="ac-input" name="titulo" required placeholder="Ej: Apunte Módulo 1 / Coreografía referencia"></div>' +
          '<div class="ac-field"><label>Tipo</label><select class="ac-select" name="tipo">' +
            '<option value="classroom">Google Classroom</option><option value="pdf">PDF / Apunte</option><option value="video">Video / YouTube</option><option value="grabacion">Clase Grabada</option><option value="tarea">Tarea / Consigna</option><option value="link">Enlace Web</option>' +
          '</select></div>' +
          '<div class="ac-field"><label>URL / Enlace</label><input class="ac-input" name="url" placeholder="https://..."></div>' +
          '<div class="ac-field"><label>Descripción</label><input class="ac-input" name="descripcion" placeholder="Indicaciones para alumnos"></div>' +
          '<div style="grid-column:1/-1;display:flex;justify-content:flex-end;"><button type="submit" class="ac-btn ac-btn--primary"' + (cursos.length === 0 ? ' disabled' : '') + '>➕ Publicar en Aula Virtual</button></div>' +
        '</form>' +
        '<div class="ac-table-wrap" style="margin-top:0.85rem;"><table class="ac-table"><thead><tr><th>Fecha</th><th>Curso</th><th>Tipo</th><th>Material</th><th>Enlace</th><th>Acción</th></tr></thead><tbody>' +
        (db.materiales.length === 0
          ? '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:1rem;">Sin materiales cargados aún.</td></tr>'
          : db.materiales.map(function (m) {
              return (
                '<tr>' +
                  '<td>' + esc(m.fechaPublicacion) + '</td>' +
                  '<td>' + esc(m.cursoNombre) + '</td>' +
                  '<td><span class="ac-badge ac-badge--gray">' + esc(m.tipo.toUpperCase()) + '</span></td>' +
                  '<td><strong>' + esc(m.titulo) + '</strong>' + (m.descripcion ? '<br><small>' + esc(m.descripcion) + '</small>' : '') + '</td>' +
                  '<td>' + (m.url ? '<a href="' + esc(m.url) + '" target="_blank" rel="noopener noreferrer" class="ac-btn ac-btn--outline ac-btn--sm">Abrir ↗</a>' : '—') + '</td>' +
                  '<td><button type="button" class="ac-btn ac-btn--danger ac-btn--sm" data-ac-del-mat="' + esc(m.id) + '">🗑️</button></td>' +
                '</tr>'
              );
            }).join('')) +
        '</tbody></table></div>' +
      '</div>';

    body.querySelector('#ac-form-online').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var res = await apiAc('POST', {
        action: 'create_online_class',
        clase: {
          cursoId: fd.get('cursoId'),
          titulo: fd.get('titulo'),
          plataforma: fd.get('plataforma'),
          fecha: fd.get('fecha'),
          horaInicio: fd.get('horaInicio'),
          duracionMin: Number(fd.get('duracionMin')) || 90,
          roomUrl: fd.get('roomUrl')
        }
      });
      if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
      else showToast((res && res.message) || 'Error creando clase online.', true);
    });
    body.querySelectorAll('[data-ac-copy-url]').forEach(function (b) {
      b.addEventListener('click', function () {
        var u = b.getAttribute('data-ac-copy-url');
        if (navigator.clipboard) navigator.clipboard.writeText(u);
        showToast('Enlace de sala para alumnos copiado al portapapeles.');
      });
    });
    body.querySelectorAll('[data-ac-set-rec]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var url = window.prompt('Pegá el enlace de la grabación (Drive, YouTube, Daily, etc.):');
        if (!url) return;
        var res = await apiAc('POST', { action: 'update_online_class', id: b.getAttribute('data-ac-set-rec'), grabacionUrl: url, estado: 'finalizada' });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
      });
    });
    body.querySelectorAll('[data-ac-del-cls]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiAc('POST', { action: 'delete_online_class', id: b.getAttribute('data-ac-del-cls') });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
      });
    });
    body.querySelector('#ac-form-material').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var res = await apiAc('POST', {
        action: 'save_material',
        material: {
          cursoId: fd.get('cursoId'),
          titulo: fd.get('titulo'),
          tipo: fd.get('tipo'),
          url: fd.get('url'),
          descripcion: fd.get('descripcion')
        }
      });
      if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
      else showToast((res && res.message) || 'Error publicando material.', true);
    });
    body.querySelectorAll('[data-ac-del-mat]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiAc('POST', { action: 'delete_material', id: b.getAttribute('data-ac-del-mat') });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
      });
    });
  }

  /* ---------- 7. DOCENTES Y LIQUIDACIONES ---------- */
  function renderDocentes(body, db) {
    var ym = STATE.liqPeriodo;
    var empList = STATE.empleadosAsistencia || [];

    var liqRows = (db.docentes || []).map(function (d) {
      var cursosDoc = db.cursos.filter(function (c) { return c.docenteId === d.id; });
      var cIds = cursosDoc.map(function (c) { return c.id; });
      var recaudado = db.pagos
        .filter(function (p) { return String(p.fechaPago || '').startsWith(ym) && cIds.indexOf(p.cursoId) >= 0; })
        .reduce(function (s, p) { return s + (Number(p.importe) || 0); }, 0);
      var clasesDictadas = db.asistencias.filter(function (s) {
        return String(s.fecha || '').startsWith(ym) && cIds.indexOf(s.cursoId) >= 0;
      }).length;
      var honorario = 0;
      if (d.esquemaHonorarios === 'porcentaje') honorario = Math.round((recaudado * (Number(d.valorEsquema) || 0)) / 100);
      else if (d.esquemaHonorarios === 'valor_clase') honorario = Math.round(clasesDictadas * (Number(d.valorEsquema) || 0));
      else honorario = Number(d.valorEsquema) || 0;
      return { docente: d, cursosCount: cursosDoc.length, recaudado: recaudado, clasesDictadas: clasesDictadas, honorario: honorario };
    });

    body.innerHTML =
      '<div class="ac-card">' +
        '<h3><span>👩‍🏫 Alta de Docente / Profesor</span>' +
          (empList.length > 0
            ? '<select id="ac-import-emp" class="ac-select" style="max-width:290px;"><option value="">+ Importar desde Personal ERP (' + empList.length + ')</option>' +
              empList.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.nombre) + (e.puesto ? ' (' + esc(e.puesto) + ')' : '') + '</option>'; }).join('') +
              '</select>'
            : '') +
        '</h3>' +
        '<form id="ac-form-docente" class="ac-form-grid">' +
          '<div class="ac-field"><label>Apellido y Nombre *</label><input class="ac-input" name="nombre" id="ac-doc-nombre" required></div>' +
          '<div class="ac-field"><label>DNI</label><input class="ac-input" name="dni" id="ac-doc-dni"></div>' +
          '<div class="ac-field"><label>Especialidad</label><input class="ac-input" name="especialidad" placeholder="Ej: Danza Clásica / Marketing"></div>' +
          '<div class="ac-field"><label>WhatsApp</label><input class="ac-input" name="whatsapp" id="ac-doc-wa"></div>' +
          '<div class="ac-field"><label>Esquema de Honorarios</label><select class="ac-select" name="esquemaHonorarios">' +
            '<option value="porcentaje">% sobre Recaudación de sus Cursos</option>' +
            '<option value="valor_clase">Valor Fijo por Clase Dictada ($)</option>' +
            '<option value="fijo_mensual">Sueldo / Honorario Fijo Mensual ($)</option>' +
          '</select></div>' +
          '<div class="ac-field"><label>Valor (% o $)</label><input class="ac-input" type="number" step="0.01" min="0" name="valorEsquema" value="40"></div>' +
          '<div class="ac-field"><label>CBU / Alias</label><input class="ac-input" name="cbuAlias"></div>' +
          '<div style="grid-column:1/-1;display:flex;justify-content:flex-end;"><button type="submit" class="ac-btn ac-btn--primary">💾 Guardar Docente</button></div>' +
        '</form>' +
      '</div>' +

      '<div class="ac-card">' +
        '<h3><span>💰 Liquidación Estimada de Docentes</span><input type="month" id="ac-liq-ym" class="ac-input" style="width:auto;" value="' + esc(ym) + '"></h3>' +
        '<div class="ac-table-wrap"><table class="ac-table"><thead><tr><th>Docente</th><th>Esquema</th><th>Cursos</th><th>Clases (' + esc(ym) + ')</th><th>Recaudado Cursos</th><th>A Liquidar</th><th>Acción</th></tr></thead><tbody>' +
        (liqRows.length === 0
          ? '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:1.25rem;">Sin docentes cargados aún.</td></tr>'
          : liqRows.map(function (r) {
              var esqTxt = r.docente.esquemaHonorarios === 'porcentaje' ? r.docente.valorEsquema + '% recaudación' : r.docente.esquemaHonorarios === 'valor_clase' ? fmtMoney(r.docente.valorEsquema) + ' / clase' : fmtMoney(r.docente.valorEsquema) + ' / mes';
              return (
                '<tr>' +
                  '<td><strong>' + esc(r.docente.nombre) + '</strong><br><small>' + esc(r.docente.especialidad || '') + (r.docente.cbuAlias ? ' · Alias: ' + esc(r.docente.cbuAlias) : '') + '</small></td>' +
                  '<td>' + esc(esqTxt) + '</td>' +
                  '<td>' + r.cursosCount + '</td>' +
                  '<td>' + r.clasesDictadas + '</td>' +
                  '<td>' + fmtMoney(r.recaudado) + '</td>' +
                  '<td><strong style="color:#059669;">' + fmtMoney(r.honorario) + '</strong></td>' +
                  '<td><button type="button" class="ac-btn ac-btn--danger ac-btn--sm" data-ac-del-doc="' + esc(r.docente.id) + '">🗑️</button></td>' +
                '</tr>'
              );
            }).join('')) +
        '</tbody></table></div>' +
      '</div>';

    var impSel = body.querySelector('#ac-import-emp');
    if (impSel) {
      impSel.addEventListener('change', function () {
        var e = empList.find(function (x) { return x.id === impSel.value; });
        if (!e) return;
        body.querySelector('#ac-doc-nombre').value = e.nombre || '';
        body.querySelector('#ac-doc-dni').value = e.dni || '';
        body.querySelector('#ac-doc-wa').value = e.whatsapp || '';
      });
    }
    body.querySelector('#ac-liq-ym').addEventListener('change', function (ev) { STATE.liqPeriodo = ev.target.value; renderWorkspace(); });
    body.querySelector('#ac-form-docente').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var res = await apiAc('POST', {
        action: 'save_docente',
        docente: {
          nombre: fd.get('nombre'),
          dni: fd.get('dni'),
          especialidad: fd.get('especialidad'),
          whatsapp: fd.get('whatsapp'),
          esquemaHonorarios: fd.get('esquemaHonorarios'),
          valorEsquema: Number(fd.get('valorEsquema')) || 0,
          cbuAlias: fd.get('cbuAlias')
        }
      });
      if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
      else showToast((res && res.message) || 'Error guardando docente.', true);
    });
    body.querySelectorAll('[data-ac-del-doc]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar este docente?')) return;
        var res = await apiAc('POST', { action: 'delete_docente', id: b.getAttribute('data-ac-del-doc') });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
      });
    });
  }

  /* ---------- 8. CERTIFICADOS Y DIPLOMAS ---------- */
  function renderCertificados(body, db) {
    body.innerHTML =
      '<div class="ac-card">' +
        '<h3><span>🎓 Emitir Certificado Individual o Masivo por Curso</span></h3>' +
        '<form id="ac-form-cert" class="ac-form-grid">' +
          '<div class="ac-field"><label>Alumno *</label><select class="ac-select" name="alumnoId" required>' +
            (db.alumnos || []).map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.nombre) + ' (' + esc(a.legajo) + ')</option>'; }).join('') +
          '</select></div>' +
          '<div class="ac-field"><label>Curso / Capacitación *</label><select class="ac-select" name="cursoId" id="ac-cert-curso" required>' +
            (db.cursos || []).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.nombre) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="ac-field"><label>Calificación / Mención</label><input class="ac-input" name="calificacion" value="Aprobado"></div>' +
          '<div class="ac-field"><label>Fecha Emisión</label><input class="ac-input" type="date" name="fechaEmision" value="' + todayIso() + '"></div>' +
          '<div style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:0.5rem;flex-wrap:wrap;">' +
            '<button type="button" class="ac-btn ac-btn--outline" id="ac-btn-cert-lote"' + (db.cursos.length === 0 ? ' disabled' : '') + '>⚡ Emitir Lote para todo el Curso (≥' + esc(db.config.asistenciaMinimaCertificadoPct) + '% asist.)</button>' +
            '<button type="submit" class="ac-btn ac-btn--primary"' + (db.alumnos.length === 0 || db.cursos.length === 0 ? ' disabled' : '') + '>🎓 Emitir Certificado Individual</button>' +
          '</div>' +
        '</form>' +
      '</div>' +

      '<div class="ac-card">' +
        '<h3><span>📜 Certificados Emitidos (' + db.certificados.length + ')</span></h3>' +
        '<div class="ac-table-wrap"><table class="ac-table"><thead><tr><th>Código Verificador</th><th>Alumno</th><th>Curso</th><th>Asistencia / Hs</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>' +
        (db.certificados.length === 0
          ? '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:1.25rem;">Todavía no se emitieron certificados.</td></tr>'
          : db.certificados.map(function (cert) {
              return (
                '<tr>' +
                  '<td><strong>' + esc(cert.codigoVerificacion) + '</strong></td>' +
                  '<td><strong>' + esc(cert.alumnoNombre) + '</strong><br><small>DNI: ' + esc(cert.alumnoDni || '—') + '</small></td>' +
                  '<td>' + esc(cert.cursoNombre) + '</td>' +
                  '<td>' + esc(cert.asistenciaPct) + '%' + (cert.cargaHorariaHs ? ' · ' + cert.cargaHorariaHs + ' hs' : '') + '</td>' +
                  '<td>' + esc(cert.fechaEmision) + '</td>' +
                  '<td style="display:flex;gap:0.35rem;flex-wrap:wrap;">' +
                    '<button type="button" class="ac-btn ac-btn--primary ac-btn--sm" data-ac-print-cert="' + esc(cert.id) + '">🖨️ Diploma PDF</button>' +
                    '<button type="button" class="ac-btn ac-btn--danger ac-btn--sm" data-ac-del-cert="' + esc(cert.id) + '">🗑️</button>' +
                  '</td>' +
                '</tr>'
              );
            }).join('')) +
        '</tbody></table></div>' +
      '</div>';

    body.querySelector('#ac-form-cert').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var res = await apiAc('POST', {
        action: 'emitir_certificado',
        certificado: {
          alumnoId: fd.get('alumnoId'),
          cursoId: fd.get('cursoId'),
          calificacion: fd.get('calificacion'),
          fechaEmision: fd.get('fechaEmision')
        }
      });
      if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
      else showToast((res && res.message) || 'Error emitiendo certificado.', true);
    });
    var btnLote = body.querySelector('#ac-btn-cert-lote');
    if (btnLote) {
      btnLote.addEventListener('click', async function () {
        var cid = body.querySelector('#ac-cert-curso').value;
        var res = await apiAc('POST', { action: 'emitir_certificados_lote', cursoId: cid });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
        else showToast((res && res.message) || 'Error emitiendo lote.', true);
      });
    }
    body.querySelectorAll('[data-ac-print-cert]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cert = db.certificados.find(function (x) { return x.id === b.getAttribute('data-ac-print-cert'); });
        if (cert) printCertificadoDiploma(cert);
      });
    });
    body.querySelectorAll('[data-ac-del-cert]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiAc('POST', { action: 'delete_certificado', id: b.getAttribute('data-ac-del-cert') });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
      });
    });
  }

  /* ---------- 9. CONFIGURACIÓN, OPCIONALES, PORTAL Y PROPUESTA ---------- */
  function renderConfig(body, db) {
    var cfg = db.config;
    var opt = cfg.opcionales || {};
    var portalUrl = getPublicPortalUrl();

    body.innerHTML =
      '<div class="ac-card">' +
        '<h3><span>⚙️ Identidad, Reglas y Módulos Opcionales</span></h3>' +
        '<form id="ac-form-config" class="ac-form-grid">' +
          '<div class="ac-field"><label>Nombre de la Academia / Escuela</label><input class="ac-input" name="nombreAcademia" value="' + esc(cfg.nombreAcademia) + '"></div>' +
          '<div class="ac-field"><label>Tipo de Unidad de Negocio</label><select class="ac-select" name="tipoNegocio">' +
            [['academia_danza', 'Academia de Danza'], ['capacitaciones', 'Centro de Capacitaciones'], ['escuela_negocios', 'Escuela de Negocios'], ['idiomas', 'Instituto de Idiomas'], ['arte_musica', 'Escuela de Arte / Música'], ['deportes', 'Academia Deportiva'], ['cursos_oficios', 'Cursos y Oficios'], ['mixta', 'Mixta / Multidisciplina']].map(function (t) {
              return '<option value="' + t[0] + '"' + (cfg.tipoNegocio === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
            }).join('') +
          '</select></div>' +
          '<div class="ac-field"><label>URL del Logo (para Recibos y Certificados)</label><input class="ac-input" name="logoUrl" value="' + esc(cfg.logoUrl) + '"></div>' +
          '<div class="ac-field"><label>WhatsApp Oficial</label><input class="ac-input" name="whatsapp" value="' + esc(cfg.whatsapp) + '"></div>' +
          '<div class="ac-field"><label>Dirección</label><input class="ac-input" name="direccion" value="' + esc(cfg.direccion) + '"></div>' +
          '<div class="ac-field"><label>Localidad</label><input class="ac-input" name="localidad" value="' + esc(cfg.localidad) + '"></div>' +
          '<div class="ac-field"><label>Día Vencimiento Cuotas (1-28)</label><input class="ac-input" type="number" name="diaVencimientoCuota" min="1" max="28" value="' + esc(cfg.diaVencimientoCuota) + '"></div>' +
          '<div class="ac-field"><label>Recargo Mora Sugerido (%)</label><input class="ac-input" type="number" name="recargoMoraPct" min="0" value="' + esc(cfg.recargoMoraPct) + '"></div>' +
          '<div class="ac-field"><label>Asistencia Mínima Certificado (%)</label><input class="ac-input" type="number" name="asistenciaMinimaCertificadoPct" min="0" max="100" value="' + esc(cfg.asistenciaMinimaCertificadoPct) + '"></div>' +
          '<div class="ac-field"><label>Firmante 1 (Certificados)</label><input class="ac-input" name="firmante1Nombre" value="' + esc(cfg.firmante1Nombre) + '"></div>' +
          '<div class="ac-field"><label>Cargo Firmante 1</label><input class="ac-input" name="firmante1Cargo" value="' + esc(cfg.firmante1Cargo) + '"></div>' +
          '<div class="ac-field"><label>Dominio Daily.co (opcional)</label><input class="ac-input" name="dailyDomain" placeholder="tuacademia.daily.co" value="' + esc(cfg.dailyDomain) + '"></div>' +
          '<div class="ac-field" style="grid-column:1/-1;"><label>Texto Base del Certificado</label><textarea class="ac-textarea" rows="2" name="textoCertificado">' + esc(cfg.textoCertificado) + '</textarea></div>' +
          '<div style="grid-column:1/-1;border-top:1px solid #e2e8f0;padding-top:0.75rem;">' +
            '<div style="font-weight:800;margin-bottom:0.5rem;">Módulos Opcionales Habilitados en esta Academia:</div>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.45rem;font-size:0.85rem;">' +
              '<label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" name="opt_pagosOnlineMp"' + (opt.pagosOnlineMp ? ' checked' : '') + '> Integración Cobros / Pagos Online (MP)</label>' +
              '<label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" name="opt_certificadosAuto"' + (opt.certificadosAuto ? ' checked' : '') + '> Certificados y Diplomas Automatizados</label>' +
              '<label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" name="opt_aulaVirtualClassroom"' + (opt.aulaVirtualClassroom ? ' checked' : '') + '> Aula Virtual + Google Classroom</label>' +
              '<label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" name="opt_clasesOnlineDaily"' + (opt.clasesOnlineDaily ? ' checked' : '') + '> Clases Online Multiusuario (Daily.co)</label>' +
              '<label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" name="opt_inscripcionPublicaWeb"' + (opt.inscripcionPublicaWeb ? ' checked' : '') + '> Inscripción Online Pública (desactivable)</label>' +
              '<label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" name="opt_fichaSaludAptoFisico"' + (opt.fichaSaludAptoFisico ? ' checked' : '') + '> Control Apto Físico / Ficha de Salud</label>' +
              '<label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" name="opt_integrarClientesCtaCte"' + (opt.integrarClientesCtaCte ? ' checked' : '') + '> Sincronizar con Clientes y Cta. Cte. ERP</label>' +
            '</div>' +
          '</div>' +
          '<div style="grid-column:1/-1;display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">' +
            '<div style="display:flex;gap:0.4rem;">' +
              '<button type="button" class="ac-btn ac-btn--outline ac-btn--sm" id="ac-cfg-demo">⚡ Cargar Demo</button>' +
              '<button type="button" class="ac-btn ac-btn--danger ac-btn--sm" id="ac-cfg-reset">🧹 Vaciar Datos</button>' +
            '</div>' +
            '<button type="submit" class="ac-btn ac-btn--primary">💾 Guardar Configuración</button>' +
          '</div>' +
        '</form>' +
      '</div>' +

      '<div class="ac-card">' +
        '<h3><span>🌐 Portal Público de Inscripción y Verificación de Certificados</span></h3>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.6rem;">' +
          '<div><strong>URL Pública:</strong> <code>' + esc(portalUrl) + '</code><br><small>Estado inscripción web: ' + (opt.inscripcionPublicaWeb ? '<span class="ac-badge ac-badge--green">HABILITADA</span>' : '<span class="ac-badge ac-badge--gray">DESACTIVADA (solo inscripción presencial)</span>') + '</small></div>' +
          '<a href="' + esc(portalUrl) + '" target="_blank" rel="noopener noreferrer" class="ac-btn ac-btn--outline ac-btn--sm">Abrir Portal Público ↗</a>' +
        '</div>' +
      '</div>' +

      '<div class="ac-card">' +
        '<h3><span>📄 Generador de Propuesta Estimativa — Sistema de Gestión Simple</span></h3>' +
        '<div class="ac-form-grid" style="margin-bottom:0.75rem;">' +
          '<div class="ac-field"><label>Paquete Base ($)</label><input class="ac-input" type="number" id="ac-prop-base" value="' + esc(STATE.propuestaBase) + '"></div>' +
          '<div class="ac-field"><label>Opcional: Integración Pagos ($)</label><input class="ac-input" type="number" id="ac-prop-pagos" value="' + esc(STATE.propuestaPagos) + '"></div>' +
          '<div class="ac-field"><label>Opcional: Certificados ($)</label><input class="ac-input" type="number" id="ac-prop-cert" value="' + esc(STATE.propuestaCert) + '"></div>' +
          '<div class="ac-field"><label>Opcional: Logo / Identidad ($)</label><input class="ac-input" type="number" id="ac-prop-logo" value="' + esc(STATE.propuestaLogo) + '"></div>' +
        '</div>' +
        '<button type="button" class="ac-btn ac-btn--primary ac-btn--sm" id="ac-copy-propuesta">📋 Copiar Propuesta Estimativa para WhatsApp</button>' +
      '</div>';

    body.querySelector('#ac-form-config').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var res = await apiAc('POST', {
        action: 'save_config',
        config: {
          nombreAcademia: fd.get('nombreAcademia'),
          tipoNegocio: fd.get('tipoNegocio'),
          logoUrl: fd.get('logoUrl'),
          whatsapp: fd.get('whatsapp'),
          direccion: fd.get('direccion'),
          localidad: fd.get('localidad'),
          diaVencimientoCuota: Number(fd.get('diaVencimientoCuota')) || 10,
          recargoMoraPct: Number(fd.get('recargoMoraPct')) || 0,
          asistenciaMinimaCertificadoPct: Number(fd.get('asistenciaMinimaCertificadoPct')) || 75,
          firmante1Nombre: fd.get('firmante1Nombre'),
          firmante1Cargo: fd.get('firmante1Cargo'),
          dailyDomain: fd.get('dailyDomain'),
          textoCertificado: fd.get('textoCertificado'),
          opcionales: {
            pagosOnlineMp: fd.get('opt_pagosOnlineMp') === 'on',
            certificadosAuto: fd.get('opt_certificadosAuto') === 'on',
            aulaVirtualClassroom: fd.get('opt_aulaVirtualClassroom') === 'on',
            clasesOnlineDaily: fd.get('opt_clasesOnlineDaily') === 'on',
            inscripcionPublicaWeb: fd.get('opt_inscripcionPublicaWeb') === 'on',
            fichaSaludAptoFisico: fd.get('opt_fichaSaludAptoFisico') === 'on',
            integrarClientesCtaCte: fd.get('opt_integrarClientesCtaCte') === 'on'
          }
        }
      });
      if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
      else showToast((res && res.message) || 'Error guardando configuración.', true);
    });
    body.querySelector('#ac-cfg-demo').addEventListener('click', async function () {
      var res = await apiAc('POST', { action: 'load_demo' });
      if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
    });
    body.querySelector('#ac-cfg-reset').addEventListener('click', async function () {
      if (!window.confirm('¿Vaciar todos los alumnos, cursos, asistencias y cuotas?')) return;
      var res = await apiAc('POST', { action: 'reset_empty' });
      if (res && res.ok) { applyApiResponse(res); showToast(res.message); renderWorkspace(); }
    });
    body.querySelector('#ac-copy-propuesta').addEventListener('click', function () {
      var b = Number(body.querySelector('#ac-prop-base').value) || 0;
      var p = Number(body.querySelector('#ac-prop-pagos').value) || 0;
      var c = Number(body.querySelector('#ac-prop-cert').value) || 0;
      var l = Number(body.querySelector('#ac-prop-logo').value) || 0;
      STATE.propuestaBase = b; STATE.propuestaPagos = p; STATE.propuestaCert = c; STATE.propuestaLogo = l;
      var txt =
        '*Propuesta estimativa — Sistema de Gestión de Academias*\n\n' +
        '*1. Sistema base de gestión y control*\n' +
        '• Formulario de inscripción con envío automático a 3 vistas/planillas: Base General, Asistencias y Control de Cuotas.\n' +
        '• Registro de pagos y tablero simple para ver asistencia, cobranzas y estado general de un vistazo.\n' +
        '• Cobranza registrada para operación presencial en el local con recibo imprimible.\n\n' +
        '*Opcionales (para sumar ahora o más adelante):*\n' +
        '• Integración de cobros / pagos online: +' + fmtMoney(p) + '\n' +
        '• Certificados automatizados con código verificador: +' + fmtMoney(c) + '\n' +
        '• Diseño de identidad / logo básico: +' + fmtMoney(l) + '\n' +
        '(También escalable a Aula Virtual con Google Classroom y Clases Online Multiusuario Daily.co).\n\n' +
        '*Estimación referencial:*\n' +
        '• Paquete base: ' + fmtMoney(b) + '\n' +
        '(Redes sociales e inscripciones online quedan fuera en esta etapa, activables cuando lo necesiten).';
      if (navigator.clipboard) navigator.clipboard.writeText(txt);
      showToast('Propuesta estimativa copiada al portapapeles.');
    });
  }

  /* ==================== INTEGRACIÓN CON NAVEGACIÓN Y HOME GRID ==================== */
  function bindGlobalNav() {
    if (window.__MS_ACADEMIAS_NAV_BOUND__) return;
    window.__MS_ACADEMIAS_NAV_BOUND__ = true;

    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || typeof t.closest !== 'function') return;
      var backTop = t.closest('#btn-topbar-back-facturacion');
      if (backTop) {
        var secMenu = document.getElementById('sec-menu-academias');
        var secWs = document.getElementById('sec-academias-workspace');
        if (secWs && !secWs.hidden) {
          ev.preventDefault();
          ev.stopPropagation();
          openAcademiasView('menu');
          return;
        }
        if (secMenu && !secMenu.hidden) {
          ev.preventDefault();
          ev.stopPropagation();
          closeToHome();
          return;
        }
      }

      var navEl = t.closest(
        '#topbar-home-btn, [data-open-section], #ms-superadmin-home-card, #ms-servicios-home-card, #ms-cv-home-card, #ms-personal-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card, #ms-feriarte-home-card, #ms-doncontador-home-card, #ms-reikionline-home-card, #ms-bibliotecaroncedo-home-card'
      );
      if (navEl) {
        var m = document.getElementById('sec-menu-academias');
        var w = document.getElementById('sec-academias-workspace');
        if (m) m.hidden = true;
        if (w) w.hidden = true;
      }
    }, true);
  }

  function syncHomeCard() {
    bindGlobalNav();
    var allowed = isAcademiasAllowed();
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-academias-home-card');

    if (allowed && inicioGrid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-academias-home-card';
      card.className = 'module-card';
      card.setAttribute('data-module-key', 'academias');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>' +
            '<path d="M6 12v5c3 3 9 3 12 0v-5"></path>' +
          '</svg>' +
        '</div>' +
        '<h3>Gestión de Academias</h3>';

      card.addEventListener('click', function () { openAcademiasView('menu'); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openAcademiasView('menu'); }
      });

      var perfilCard = inicioGrid.querySelector('[data-module-key="perfil"]');
      if (perfilCard) inicioGrid.insertBefore(card, perfilCard);
      else inicioGrid.appendChild(card);
    } else if (existing) {
      existing.hidden = !allowed;
      existing.style.display = allowed ? '' : 'none';
    }
  }

  window.openAcademiasView = openAcademiasView;
  setInterval(syncHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncHomeCard);
})();
