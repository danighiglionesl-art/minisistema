/* ==========================================================================
   MÓDULO EXCLUSIVO DEL ADMINISTRADOR GENERAL (@danielg) — REIKI ONLINE
   Gestión integral del sitio Reiki Online (www.reikionline.com.ar) desde MiniSistema.
   Respeta estrictamente tarjetas uniformes (.modules-grid / .module-card) sin
   sobretítulos (badges/pills) ni descripciones, y sin agregar valor comercial en
   el listado de precios del Administrador General.
   ========================================================================== */
(function () {
  'use strict';

  var SUBMODULES = [
    { key: 'panel', label: 'Panel General', icon: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>' },
    { key: 'usuarios', label: 'Consultantes y Terapeutas', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>' },
    { key: 'terapias', label: 'Terapias y Categorías Propuestas', icon: '<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"></path>' },
    { key: 'comisiones', label: 'Comisiones y Pagos Split 1:1', icon: '<rect x="1" y="4" width="22" height="16" rx="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>' },
    { key: 'capacitaciones', label: 'Academia y Capacitaciones', icon: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path>' },
    { key: 'biometria', label: 'Verificación Biométrica e Identidad', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline>' },
    { key: 'videollamadas', label: 'Videollamadas y Turnos', icon: '<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>' },
    { key: 'whatsapp', label: 'WhatsApp Oficial', icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>' },
    { key: 'estadisticas', label: 'Estadísticas', icon: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>' },
    { key: 'configuracion', label: 'Configuración y Auditoría', icon: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' }
  ];

  var STATE = {
    view: 'menu',
    data: null,
    loading: false,
    feedback: '',
    isError: false,
    userRoleFilter: 'todos',
    userSearch: '',
    catSearch: '',
    selectedCatId: 'terapias-energeticas'
  };

  var fmtArs = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
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
      return '/' + encodeURIComponent(boot.slug) + '/api/reiki_online';
    }
    return '/sistema/api/reiki_online';
  }

  async function apiRo(method, payload) {
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

    var secMenu = document.getElementById('sec-menu-reikionline');
    if (secMenu && secMenu.parentNode !== erpMain) {
      erpMain.appendChild(secMenu);
    }
    if (!secMenu) {
      secMenu = document.createElement('section');
      secMenu.id = 'sec-menu-reikionline';
      secMenu.className = 'erp-section';
      secMenu.hidden = true;
      secMenu.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ro-back-home">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">Administrador General · <strong>Reiki online</strong></span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
            '<a href="https://www.reikionline.com.ar" target="_blank" rel="noopener noreferrer" style="padding:6px 12px;border-radius:8px;border:1px solid #836DAD;background:#F6F3FA;color:#836DAD;font-size:12px;font-weight:700;text-decoration:none;">Abrir www.reikionline.com.ar ↗</a>' +
            '<a href="https://www.reikionline.com.ar/sistema" target="_blank" rel="noopener noreferrer" style="padding:6px 12px;border-radius:8px;border:none;background:#836DAD;color:#fff;font-size:12px;font-weight:700;text-decoration:none;">Portal /sistema ↗</a>' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" id="ro-submodules-grid" aria-label="Submódulos de Reiki online"></div>';
      erpMain.appendChild(secMenu);
      secMenu.querySelector('#ro-back-home').addEventListener('click', closeToHome);
    }

    var secDetail = document.getElementById('sec-reikionline-detail');
    if (secDetail && secDetail.parentNode !== erpMain) {
      erpMain.appendChild(secDetail);
    }
    if (!secDetail) {
      secDetail = document.createElement('section');
      secDetail.id = 'sec-reikionline-detail';
      secDetail.className = 'erp-section';
      secDetail.hidden = true;
      secDetail.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ro-back-menu">← Volver a Reiki online</button>' +
            '<span class="module-breadcrumb" id="ro-detail-breadcrumb">Reiki online</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;">' +
            '<button type="button" id="ro-refresh-btn" style="padding:6px 12px;border-radius:8px;border:1px solid #836DAD;background:#fff;color:#836DAD;font-size:12px;font-weight:700;cursor:pointer;">Actualizar datos</button>' +
          '</div>' +
        '</div>' +
        '<div id="ro-detail-body" style="padding:1rem 0;"></div>';
      erpMain.appendChild(secDetail);
      secDetail.querySelector('#ro-back-menu').addEventListener('click', function () {
        openRoView('menu');
      });
      secDetail.querySelector('#ro-refresh-btn').addEventListener('click', async function () {
        STATE.feedback = '';
        STATE.isError = false;
        await reloadData();
        renderDetailView(STATE.view);
      });
    }

    return { menuSec: secMenu, detailSec: secDetail };
  }

  function bindGlobalNavIntegration() {
    if (window.__MS_RO_NAV_BOUND__) return;
    window.__MS_RO_NAV_BOUND__ = true;

    document.addEventListener('click', function (ev) {
      var target = ev.target;
      if (!target || typeof target.closest !== 'function') return;

      var navEl = target.closest(
        '#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-feriarte-home-card, #ms-doncontador-home-card, #ms-bibliotecaroncedo-home-card, #ms-cv-home-card, #ms-personal-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card'
      );
      if (!navEl) return;

      var menuSec = document.getElementById('sec-menu-reikionline');
      var detailSec = document.getElementById('sec-reikionline-detail');
      var isRoActive = (menuSec && !menuSec.hidden) || (detailSec && !detailSec.hidden);

      if (navEl.id === 'btn-topbar-back-facturacion' && isRoActive) {
        ev.preventDefault();
        ev.stopPropagation();
        if (detailSec && !detailSec.hidden) {
          openRoView('menu');
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
    var grid = document.getElementById('ro-submodules-grid');
    if (!grid) return;
    grid.innerHTML = SUBMODULES.map(function (m) {
      return (
        '<article class="module-card" role="button" tabindex="0" data-ro-sub="' + esc(m.key) + '">' +
          '<div class="module-icon" aria-hidden="true">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + m.icon + '</svg>' +
          '</div>' +
          '<h3>' + esc(m.label) + '</h3>' +
        '</article>'
      );
    }).join('');
    grid.querySelectorAll('[data-ro-sub]').forEach(function (card) {
      var key = card.getAttribute('data-ro-sub');
      card.addEventListener('click', function () { openRoView(key); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openRoView(key); }
      });
    });
  }

  async function reloadData() {
    STATE.loading = true;
    try {
      var res = await apiRo('GET');
      if (res && res.ok) {
        STATE.data = res;
      } else {
        STATE.feedback = (res && res.message) || 'No se pudo consultar Reiki online.';
        STATE.isError = true;
      }
    } catch (_e) {
      STATE.feedback = 'No se pudo conectar con Reiki online.';
      STATE.isError = true;
    } finally {
      STATE.loading = false;
    }
  }

  async function runAction(payload, targetView) {
    try {
      var res = await apiRo('POST', payload);
      STATE.feedback = (res && res.message) || (res && res.ok ? 'Actualizado correctamente.' : 'No se pudo completar la operación.');
      STATE.isError = !(res && res.ok);
    } catch (_e) {
      STATE.feedback = 'Error de red al guardar los cambios.';
      STATE.isError = true;
    }
    await reloadData();
    renderDetailView(targetView || STATE.view);
  }

  function exportProfilesCsv(profiles) {
    var headers = [
      'ID', 'Rol', 'Estado', 'Nombre', 'Apellido', 'Nickname', 'URL_Red_Social',
      'Visible_En_Red', 'DNI', 'Fecha_Nacimiento', 'Genero', 'Email', 'WhatsApp_E164',
      'WhatsApp_Verificado', 'Biometria', 'Pais', 'Provincia', 'Localidad', 'CP',
      'Barrio', 'Calle', 'Numero', 'Latitud', 'Longitud', 'MP_Vinculado', 'Precio_Sesion_ARS', 'Terapias'
    ];
    var rows = (profiles || []).map(function (p) {
      return [
        p.id,
        p.soyTerapeuta ? 'Terapeuta' : 'Consultante',
        (p.suspension && p.suspension.status) || 'activa',
        p.nombre,
        p.apellido,
        '@' + p.nickname,
        'https://www.reikionline.com.ar/' + p.nickname,
        p.visibleEnRed ? 'SI' : 'NO',
        p.dni,
        p.fechaNacimiento,
        p.genero,
        p.email,
        p.whatsappE164,
        p.whatsappVerified ? 'VERIFICADO' : 'SIN_VERIFICAR',
        p.biometricStatus,
        p.pais,
        p.provincia,
        p.localidad,
        p.codigoPostal,
        p.barrio,
        p.calle,
        p.numeroCalle,
        p.lat,
        p.lng,
        p.mpLinked ? 'SI' : 'NO',
        p.sessionPriceArs || 0,
        (p.therapiesOffered || []).join(' | ')
      ];
    });
    var csv = '\uFEFF' + [headers].concat(rows).map(function (r) {
      return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'reiki_online_padron_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderDetailView(viewKey) {
    var body = document.getElementById('ro-detail-body');
    var bc = document.getElementById('ro-detail-breadcrumb');
    var meta = SUBMODULES.find(function (s) { return s.key === viewKey; }) || SUBMODULES[0];
    if (bc) bc.innerHTML = 'Reiki online · <strong>' + esc(meta.label) + '</strong>';
    if (!body) return;

    if (STATE.loading && !STATE.data) {
      body.innerHTML = '<div style="padding:16px;background:#fff;border-radius:12px;border:1px solid #d9e2e6;">Cargando gestión del sitio Reiki online...</div>';
      return;
    }
    if (!STATE.data) {
      body.innerHTML =
        '<div style="background:#fff;border-radius:12px;padding:18px;border:1px solid #f5c2c7;color:#842029;font-weight:700;">' +
          esc(STATE.feedback || 'No se pudieron cargar los datos de Reiki online.') +
        '</div>';
      return;
    }

    var d = STATE.data;
    var k = d.kpis || {};
    var banner = STATE.feedback
      ? '<div style="margin-bottom:14px;padding:10px 14px;border-radius:10px;background:' + (STATE.isError ? '#fef2f2' : '#F6F3FA') + ';border:1px solid ' + (STATE.isError ? '#fecaca' : '#836DAD') + ';color:' + (STATE.isError ? '#991b1b' : '#2B1F42') + ';font-weight:700;font-size:13px;">' + esc(STATE.feedback) + '</div>'
      : '';

    /* ==================== 1. PANEL GENERAL & ESTADÍSTICAS ==================== */
    if (viewKey === 'panel' || viewKey === 'estadisticas') {
      var propAlert = (k.pendingProposals || 0) > 0
        ? '<div style="margin-bottom:14px;padding:12px 16px;border-radius:12px;background:#F6F3FA;border:1px solid #836DAD;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;">' +
            '<span style="font-size:13px;color:#2B1F42;">Hay <strong>' + esc(k.pendingProposals) + '</strong> propuesta(s) de terapia («Otra → ¿Cuál?») esperando aprobación.</span>' +
            '<button type="button" data-ro-jump="terapias" style="padding:7px 14px;border:none;border-radius:8px;background:#836DAD;color:#fff;font-weight:700;cursor:pointer;font-size:12px;">Revisar en Terapias y Categorías →</button>' +
          '</div>'
        : '';

      var cards = [
        ['Usuarios Registrados', k.totalUsers + ' (' + k.terapeutas + ' Ter. / ' + k.consultantes + ' Cons.)'],
        ['Identidades Biométricas Verificadas', k.bioVerificados + ' de ' + k.totalUsers],
        ['WhatsApp E.164 Verificados', k.whatsappVerificados + ' de ' + k.totalUsers],
        ['Perfiles Suspendidos', k.suspendidos],
        ['Categorías Activas', k.totalCategories],
        ['Terapias Vinculadas', k.totalTherapies],
        ['Propuestas «Otra → ¿Cuál?» Pendientes', k.pendingProposals],
        ['Cuentas Mercado Pago Split 1:1', k.mpVinculados],
        ['Sesiones / Videollamadas 1:1', k.sessionsTotal + ' (' + k.sessionsCompleted + ' finalizadas)'],
        ['Cursos y Formaciones en Academia', k.coursesCount],
        ['Alumnos Inscriptos en Academia', k.totalEnrollments],
        ['Certificados Digitales QR Emitidos', k.certificatesCount],
        ['Volumen Bruto Sesiones Split 1:1', fmtArs.format(k.grossSessionsArs || 0)],
        ['Comisión Reiki Online (Sesiones)', fmtArs.format(k.platformFeeSessionsArs || 0)],
        ['Comisión Reiki Online (Academia)', fmtArs.format(k.platformFeeCoursesArs || 0)],
        ['Ingresos Netos Plataforma Reiki Online', fmtArs.format(k.totalPlatformRevenueArs || 0)]
      ];

      body.innerHTML = banner + propAlert +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">' +
        cards.map(function (c) {
          return '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:14px;">' +
            '<div style="font-size:12px;color:#526570;font-weight:700;">' + esc(c[0]) + '</div>' +
            '<div style="font-size:20px;font-weight:900;color:#2B1F42;margin-top:4px;">' + esc(c[1]) + '</div>' +
          '</div>';
        }).join('') +
        '</div>';

      body.querySelectorAll('[data-ro-jump]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openRoView(btn.getAttribute('data-ro-jump'));
        });
      });
      return;
    }

    /* ==================== 2. CONSULTANTES Y TERAPEUTAS ==================== */
    if (viewKey === 'usuarios') {
      var allProfiles = d.profiles || [];
      var q = STATE.userSearch.trim().toLowerCase();
      var filtered = allProfiles.filter(function (p) {
        var isTer = Boolean(p.soyTerapeuta || p.role === 'terapeuta');
        var isSusp = p.suspension && p.suspension.status !== 'activa';
        if (STATE.userRoleFilter === 'consultantes' && isTer) return false;
        if (STATE.userRoleFilter === 'terapeutas' && !isTer) return false;
        if (STATE.userRoleFilter === 'suspendidos' && !isSusp) return false;
        if (!q) return true;
        var hay = [p.nombre, p.apellido, p.nickname, p.dni, p.email, p.whatsappE164, p.localidad, p.provincia, (p.therapiesOffered || []).join(' ')].join(' ').toLowerCase();
        return hay.indexOf(q) !== -1;
      });

      var rowsHtml = filtered.map(function (p) {
        var isTer = Boolean(p.soyTerapeuta || p.role === 'terapeuta');
        var isSusp = p.suspension && p.suspension.status !== 'activa';
        var mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.lat + ',' + p.lng);
        return '<tr>' +
          '<td style="padding:10px;border-bottom:1px solid #eee;">' +
            '<strong>' + esc(p.nombre + ' ' + p.apellido) + '</strong> <span style="color:#836DAD;font-weight:700;">(@' + esc(p.nickname) + ')</span><br>' +
            '<small style="color:#526570;">DNI: ' + esc(p.dni || '—') + ' · ' + esc(p.email) + '</small><br>' +
            '<a href="https://www.reikionline.com.ar/' + esc(p.nickname) + '" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#836DAD;font-weight:700;">reikionline.com.ar/' + esc(p.nickname) + ' ↗</a>' +
          '</td>' +
          '<td style="padding:10px;border-bottom:1px solid #eee;">' +
            '<span style="display:inline-block;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:800;background:' + (isTer ? '#F3D791' : '#F6F3FA') + ';color:#2B1F42;">' + (isTer ? 'Terapeuta' : 'Consultante') + '</span><br>' +
            '<small style="color:#526570;">' + esc((p.therapiesOffered || []).slice(0, 3).join(', ') || 'Sin terapias') + '</small>' +
          '</td>' +
          '<td style="padding:10px;border-bottom:1px solid #eee;font-size:12px;">' +
            esc(p.calle + ' ' + p.numeroCalle + ', ' + p.localidad + ' (' + p.provincia + ')') + '<br>' +
            '<a href="' + esc(mapsUrl) + '" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#069294;font-weight:700;">GPS: ' + esc(p.lat) + ', ' + esc(p.lng) + ' ↗</a>' +
          '</td>' +
          '<td style="padding:10px;border-bottom:1px solid #eee;font-size:12px;">' +
            'WA: <strong>' + (p.whatsappVerified ? '✓ Verificado' : 'Sin verificar') + '</strong> (' + esc(p.whatsappE164) + ')<br>' +
            'Bio: <strong>' + esc(p.biometricStatus) + '</strong>' +
          '</td>' +
          '<td style="padding:10px;border-bottom:1px solid #eee;">' +
            (isSusp
              ? '<span style="color:#b91c1c;font-weight:800;font-size:12px;">SUSPENDIDO (' + esc(p.suspension.status.toUpperCase()) + ')</span><br><small>' + esc(p.suspension.reason) + '</small><br>' +
                '<button type="button" data-ro-lift="' + esc(p.id) + '" style="margin-top:4px;padding:5px 10px;border:none;border-radius:6px;background:#059669;color:#fff;font-weight:700;cursor:pointer;font-size:11px;">Reactivar Perfil</button>'
              : '<div style="display:flex;flex-wrap:wrap;gap:4px;">' +
                  '<button type="button" data-ro-susp-temp="' + esc(p.id) + '" style="padding:5px 8px;border:none;border-radius:6px;background:#d97706;color:#fff;font-weight:700;cursor:pointer;font-size:11px;">Suspender 7d</button>' +
                  '<button type="button" data-ro-susp-def="' + esc(p.id) + '" style="padding:5px 8px;border:none;border-radius:6px;background:#dc2626;color:#fff;font-weight:700;cursor:pointer;font-size:11px;">Susp. Definitiva</button>' +
                '</div>') +
          '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #d9e2e6;margin-bottom:14px;">' +
          '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
              ['todos', 'terapeutas', 'consultantes', 'suspendidos'].map(function (f) {
                var active = STATE.userRoleFilter === f;
                return '<button type="button" data-ro-ufilter="' + f + '" style="padding:7px 12px;border-radius:8px;border:1px solid #836DAD;background:' + (active ? '#836DAD' : '#fff') + ';color:' + (active ? '#fff' : '#2B1F42') + ';font-weight:700;font-size:12px;cursor:pointer;text-transform:capitalize;">' + f + '</button>';
              }).join('') +
            '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
              '<input type="search" id="ro-user-search" placeholder="Buscar por nombre, @nickname, DNI, localidad o terapia..." value="' + esc(STATE.userSearch) + '" style="padding:7px 12px;border-radius:8px;border:1px solid #ccd5db;min-width:260px;font-size:12px;">' +
              '<button type="button" id="ro-export-csv" style="padding:7px 14px;border-radius:8px;border:none;background:#2B1F42;color:#F3D791;font-weight:700;font-size:12px;cursor:pointer;">Exportar Padrón CSV</button>' +
            '</div>' +
          '</div>' +
          '<details style="margin-bottom:12px;background:#FAF8FC;border:1px solid #E6E0F0;border-radius:10px;padding:10px 14px;">' +
            '<summary style="cursor:pointer;font-weight:800;color:#836DAD;font-size:13px;">+ Dar de Alta / Actualizar Consultante o Terapeuta</summary>' +
            '<form id="ro-upsert-user-form" style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;">' +
              '<input name="nombre" required placeholder="Nombre *" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<input name="apellido" required placeholder="Apellido *" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<input name="nickname" required placeholder="Nickname (4-16 alfanum) *" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<select name="role" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;"><option value="terapeuta">Terapeuta</option><option value="consultante">Consultante</option></select>' +
              '<input name="dni" placeholder="DNI" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<input name="email" type="email" placeholder="Correo electrónico" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<input name="telefono" placeholder="Celular sin 0 ni 15" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<input name="provincia" placeholder="Provincia" value="Córdoba" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<input name="localidad" placeholder="Localidad" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<input name="calle" placeholder="Calle" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<input name="numeroCalle" placeholder="Número" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<input name="therapiesOfferedCsv" placeholder="Terapias (separadas por coma)" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<button type="submit" style="padding:8px 14px;border:none;border-radius:8px;background:#836DAD;color:#fff;font-weight:800;cursor:pointer;">Guardar Perfil</button>' +
            '</form>' +
          '</details>' +
          '<div style="overflow:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#F6F3FA;color:#2B1F42;">' +
              '<th style="text-align:left;padding:10px;">Usuario / Red Social</th>' +
              '<th style="text-align:left;padding:10px;">Rol / Terapias</th>' +
              '<th style="text-align:left;padding:10px;">Domicilio y GPS</th>' +
              '<th style="text-align:left;padding:10px;">Verificaciones</th>' +
              '<th style="text-align:left;padding:10px;">Moderación</th>' +
            '</tr></thead><tbody>' + (rowsHtml || '<tr><td colspan="5" style="padding:14px;">Sin perfiles para el filtro seleccionado.</td></tr>') + '</tbody></table>' +
          '</div>' +
        '</div>';

      body.querySelectorAll('[data-ro-ufilter]').forEach(function (b) {
        b.addEventListener('click', function () {
          STATE.userRoleFilter = b.getAttribute('data-ro-ufilter');
          renderDetailView('usuarios');
        });
      });
      var sIn = document.getElementById('ro-user-search');
      if (sIn) {
        sIn.addEventListener('input', function () {
          STATE.userSearch = sIn.value;
          renderDetailView('usuarios');
        });
      }
      var csvBtn = document.getElementById('ro-export-csv');
      if (csvBtn) {
        csvBtn.addEventListener('click', function () { exportProfilesCsv(filtered); });
      }
      var uForm = document.getElementById('ro-upsert-user-form');
      if (uForm) {
        uForm.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(uForm);
          runAction({
            action: 'upsert_profile',
            nombre: fd.get('nombre'),
            apellido: fd.get('apellido'),
            nickname: fd.get('nickname'),
            role: fd.get('role'),
            soyTerapeuta: fd.get('role') === 'terapeuta',
            dni: fd.get('dni'),
            email: fd.get('email'),
            telefono: fd.get('telefono'),
            provincia: fd.get('provincia'),
            localidad: fd.get('localidad'),
            calle: fd.get('calle'),
            numeroCalle: fd.get('numeroCalle'),
            therapiesOfferedCsv: fd.get('therapiesOfferedCsv'),
            whatsappVerified: true,
            biometricStatus: 'verificada'
          }, 'usuarios');
        });
      }
      body.querySelectorAll('[data-ro-susp-temp]').forEach(function (b) {
        b.addEventListener('click', function () {
          runAction({ action: 'suspend_profile', profileId: b.getAttribute('data-ro-susp-temp'), mode: 'temporal', days: 7 }, 'usuarios');
        });
      });
      body.querySelectorAll('[data-ro-susp-def]').forEach(function (b) {
        b.addEventListener('click', function () {
          runAction({ action: 'suspend_profile', profileId: b.getAttribute('data-ro-susp-def'), mode: 'definitiva' }, 'usuarios');
        });
      });
      body.querySelectorAll('[data-ro-lift]').forEach(function (b) {
        b.addEventListener('click', function () {
          runAction({ action: 'lift_suspension', profileId: b.getAttribute('data-ro-lift') }, 'usuarios');
        });
      });
      return;
    }

    /* ==================== 3. CATEGORÍAS Y TERAPIAS (ABM + PROPUESTAS) ==================== */
    if (viewKey === 'terapias') {
      var cats = d.categories || [];
      var pendingProps = (d.proposals || []).filter(function (p) { return p.status === 'pendiente'; });

      var catOptionsSelect = cats.map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.number + '. ' + c.title) + '</option>';
      }).join('');

      var propsHtml = pendingProps.length
        ? '<div style="background:#FFF8EF;border:1px solid #f59e0b;border-radius:12px;padding:14px;margin-bottom:14px;">' +
            '<h4 style="margin:0 0 8px;color:#2B1F42;">Propuestas de Terapeutas («Otra → ¿Cuál?») Pendientes</h4>' +
            pendingProps.map(function (pr) {
              return '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid #fde68a;">' +
                '<div><strong>«' + esc(pr.proposedOption) + '»</strong> · Sugerida en: <em>' + esc(pr.categoryTitle) + '</em> por ' + esc(pr.proposedBy) + '</div>' +
                '<div style="display:flex;gap:6px;align-items:center;">' +
                  '<select data-ro-prop-cat="' + esc(pr.id) + '" style="padding:5px 8px;border-radius:6px;border:1px solid #ccd5db;font-size:12px;">' +
                    cats.map(function (c) {
                      return '<option value="' + esc(c.id) + '"' + (c.id === pr.categoryId ? ' selected' : '') + '>' + esc(c.title) + '</option>';
                    }).join('') +
                  '</select>' +
                  '<button type="button" data-ro-prop-approve="' + esc(pr.id) + '" style="padding:6px 10px;border:none;border-radius:6px;background:#836DAD;color:#fff;font-weight:700;cursor:pointer;font-size:12px;">Aprobar y Vincular</button>' +
                  '<button type="button" data-ro-prop-dismiss="' + esc(pr.id) + '" style="padding:6px 10px;border:1px solid #ccd5db;border-radius:6px;background:#fff;color:#526570;font-weight:700;cursor:pointer;font-size:12px;">Descartar</button>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>'
        : '';

      var catsHtml = cats.map(function (cat) {
        var thBadges = (cat.options || []).map(function (th) {
          return '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:99px;background:#F6F3FA;border:1px solid #D8CEE8;font-size:12px;font-weight:700;color:#2B1F42;">' +
            esc(th) +
            '<button type="button" data-ro-del-th="' + esc(th) + '" data-ro-th-cat="' + esc(cat.id) + '" title="Eliminar terapia" style="border:none;background:none;color:#dc2626;font-weight:900;cursor:pointer;padding:0 2px;">×</button>' +
          '</span>';
        }).join(' ');

        return '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;margin-bottom:12px;">' +
          '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">' +
            '<div>' +
              '<span style="font-size:11px;font-weight:800;color:#836DAD;text-transform:uppercase;">Categoría ' + esc(cat.number) + ' (' + esc((cat.options || []).length) + ' terapias vinculadas)</span>' +
              '<h4 style="margin:2px 0;font-size:16px;color:#2B1F42;">' + esc(cat.title) + '</h4>' +
              '<p style="margin:0;font-size:12px;color:#526570;">' + esc(cat.description) + '</p>' +
            '</div>' +
            '<div style="display:flex;gap:6px;">' +
              '<button type="button" data-ro-cat-up="' + esc(cat.id) + '" style="padding:5px 9px;border:1px solid #ccd5db;border-radius:6px;background:#fff;cursor:pointer;font-weight:700;">↑</button>' +
              '<button type="button" data-ro-cat-down="' + esc(cat.id) + '" style="padding:5px 9px;border:1px solid #ccd5db;border-radius:6px;background:#fff;cursor:pointer;font-weight:700;">↓</button>' +
              '<button type="button" data-ro-cat-del="' + esc(cat.id) + '" style="padding:5px 10px;border:1px solid #fecaca;border-radius:6px;background:#fef2f2;color:#dc2626;cursor:pointer;font-weight:700;font-size:12px;">Eliminar Categoría</button>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">' + (thBadges || '<em style="font-size:12px;color:#526570;">Sin terapias vinculadas.</em>') + '</div>' +
          '<form data-ro-add-th-form="' + esc(cat.id) + '" style="display:flex;gap:8px;max-width:460px;">' +
            '<input name="therapyName" required placeholder="Nueva terapia en ' + esc(cat.title) + '..." style="flex:1;padding:7px 10px;border:1px solid #ccd5db;border-radius:8px;font-size:12px;">' +
            '<button type="submit" style="padding:7px 12px;border:none;border-radius:8px;background:#836DAD;color:#fff;font-weight:700;font-size:12px;cursor:pointer;">+ Agregar Terapia</button>' +
          '</form>' +
        '</div>';
      }).join('');

      body.innerHTML = banner + propsHtml +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-bottom:14px;">' +
          '<form id="ro-new-cat-form" style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;">' +
            '<h4 style="margin:0 0 10px;color:#2B1F42;">+ Alta de Nueva Categoría</h4>' +
            '<div style="display:grid;gap:8px;">' +
              '<input name="title" required placeholder="Título de la Categoría *" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<input name="description" placeholder="Descripción breve" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<input name="initialTherapiesCsv" placeholder="Terapias iniciales (separadas por coma)" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<button type="submit" style="padding:8px 14px;border:none;border-radius:8px;background:#836DAD;color:#fff;font-weight:800;cursor:pointer;">Crear Categoría</button>' +
            '</div>' +
          '</form>' +
          '<form id="ro-global-add-th-form" style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;">' +
            '<h4 style="margin:0 0 10px;color:#2B1F42;">+ Vincular Nueva Terapia a una Categoría</h4>' +
            '<div style="display:grid;gap:8px;">' +
              '<select name="categoryId" required style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' + catOptionsSelect + '</select>' +
              '<input name="therapyName" required placeholder="Nombre de la Terapia *" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<button type="submit" style="padding:8px 14px;border:none;border-radius:8px;background:#2B1F42;color:#F3D791;font-weight:800;cursor:pointer;">Dar de Alta Terapia Vinculada</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
        catsHtml;

      var newCatForm = document.getElementById('ro-new-cat-form');
      if (newCatForm) {
        newCatForm.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(newCatForm);
          runAction({
            action: 'create_category',
            title: fd.get('title'),
            description: fd.get('description'),
            initialTherapiesCsv: fd.get('initialTherapiesCsv')
          }, 'terapias');
        });
      }
      var glThForm = document.getElementById('ro-global-add-th-form');
      if (glThForm) {
        glThForm.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(glThForm);
          runAction({
            action: 'add_therapy',
            categoryId: fd.get('categoryId'),
            therapyName: fd.get('therapyName')
          }, 'terapias');
        });
      }
      body.querySelectorAll('[data-ro-add-th-form]').forEach(function (f) {
        f.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(f);
          runAction({
            action: 'add_therapy',
            categoryId: f.getAttribute('data-ro-add-th-form'),
            therapyName: fd.get('therapyName')
          }, 'terapias');
        });
      });
      body.querySelectorAll('[data-ro-del-th]').forEach(function (b) {
        b.addEventListener('click', function () {
          runAction({
            action: 'delete_therapy',
            categoryId: b.getAttribute('data-ro-th-cat'),
            therapyName: b.getAttribute('data-ro-del-th')
          }, 'terapias');
        });
      });
      body.querySelectorAll('[data-ro-cat-up]').forEach(function (b) {
        b.addEventListener('click', function () {
          runAction({ action: 'move_category', categoryId: b.getAttribute('data-ro-cat-up'), direction: -1 }, 'terapias');
        });
      });
      body.querySelectorAll('[data-ro-cat-down]').forEach(function (b) {
        b.addEventListener('click', function () {
          runAction({ action: 'move_category', categoryId: b.getAttribute('data-ro-cat-down'), direction: 1 }, 'terapias');
        });
      });
      body.querySelectorAll('[data-ro-cat-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          var cId = b.getAttribute('data-ro-cat-del');
          var fallbackCat = (cats.find(function (c) { return c.id !== cId; }) || {}).id || '';
          runAction({ action: 'delete_category', categoryId: cId, reassignToCategoryId: fallbackCat }, 'terapias');
        });
      });
      body.querySelectorAll('[data-ro-prop-approve]').forEach(function (b) {
        b.addEventListener('click', function () {
          var pId = b.getAttribute('data-ro-prop-approve');
          var sel = body.querySelector('[data-ro-prop-cat="' + pId + '"]');
          runAction({
            action: 'resolve_proposal',
            proposalId: pId,
            decision: 'aprobada',
            targetCategoryId: sel ? sel.value : ''
          }, 'terapias');
        });
      });
      body.querySelectorAll('[data-ro-prop-dismiss]').forEach(function (b) {
        b.addEventListener('click', function () {
          runAction({
            action: 'resolve_proposal',
            proposalId: b.getAttribute('data-ro-prop-dismiss'),
            decision: 'descartada'
          }, 'terapias');
        });
      });
      return;
    }

    /* ==================== 4. COMISIONES Y PAGOS SPLIT 1:1 ==================== */
    if (viewKey === 'comisiones') {
      var comm = d.commissions || { presencialPct: 10, virtualTurnoPct: 10, virtualAhoraPct: 12, academiaPct: 10 };
      var txs = d.transactions || [];
      var txRows = txs.map(function (t) {
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(t.id) + '</strong><br><small>MP: ' + esc(t.mpPaymentId) + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(t.therapyName) + '</strong><br><small>' + esc(t.scheduledSlotLabel) + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">Ter: <strong>' + esc(t.therapistName) + '</strong><br>Cons: ' + esc(t.consultanteName) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;font-weight:800;">' + fmtArs.format(t.sessionPriceArs) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;color:#836DAD;font-weight:800;">' + fmtArs.format(t.marketplaceFeeArs) + ' (' + esc(t.commissionPct) + '%)</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;color:#059669;font-weight:800;">' + fmtArs.format(t.therapistNetArs) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' +
            (t.status === 'approved'
              ? '<span style="color:#059669;font-weight:800;">Aprobado</span> <button type="button" data-ro-refund="' + esc(t.id) + '" style="margin-left:6px;padding:4px 8px;border:none;border-radius:6px;background:#dc2626;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Devolver 100%</button>'
              : '<span style="color:#b91c1c;font-weight:800;">Reembolsado 100%</span>') +
          '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:18px;margin-bottom:14px;">' +
          '<h4 style="margin:0 0 10px;color:#2B1F42;">Porcentajes de Comisión Split 1:1 (Mercado Pago OAuth 2.0)</h4>' +
          '<form id="ro-comm-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end;">' +
            '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#2B1F42;">' +
              'Presencial con turno (%)' +
              '<input name="presencialPct" type="number" min="0" max="50" step="0.5" required value="' + esc(comm.presencialPct) + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
            '</label>' +
            '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#2B1F42;">' +
              'Online con turno (%)' +
              '<input name="virtualTurnoPct" type="number" min="0" max="50" step="0.5" required value="' + esc(comm.virtualTurnoPct) + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
            '</label>' +
            '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#2B1F42;">' +
              'Online ahora / Inmediata (%)' +
              '<input name="virtualAhoraPct" type="number" min="0" max="50" step="0.5" required value="' + esc(comm.virtualAhoraPct) + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
            '</label>' +
            '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#2B1F42;">' +
              'Academia y Capacitaciones (%)' +
              '<input name="academiaPct" type="number" min="0" max="50" step="0.5" required value="' + esc(comm.academiaPct) + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
            '</label>' +
            '<button type="submit" style="padding:9px 16px;border:none;border-radius:8px;background:#836DAD;color:#fff;font-weight:800;cursor:pointer;">Guardar Porcentajes</button>' +
          '</form>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;overflow:auto;">' +
          '<h4 style="margin:0 0 10px;color:#2B1F42;">Operaciones Split 1:1 Registradas</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#F6F3FA;color:#2B1F42;">' +
            '<th style="text-align:left;padding:8px;">Operación</th>' +
            '<th style="text-align:left;padding:8px;">Terapia / Turno</th>' +
            '<th style="text-align:left;padding:8px;">Partes</th>' +
            '<th style="text-align:left;padding:8px;">Total Sesión</th>' +
            '<th style="text-align:left;padding:8px;">Comisión Reiki</th>' +
            '<th style="text-align:left;padding:8px;">Participación Terapeuta</th>' +
            '<th style="text-align:left;padding:8px;">Estado</th>' +
          '</tr></thead><tbody>' + (txRows || '<tr><td colspan="7" style="padding:12px;">Sin transacciones registradas.</td></tr>') + '</tbody></table>' +
        '</div>';

      var cForm = document.getElementById('ro-comm-form');
      if (cForm) {
        cForm.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(cForm);
          runAction({
            action: 'save_commission_config',
            presencialPct: fd.get('presencialPct'),
            virtualTurnoPct: fd.get('virtualTurnoPct'),
            virtualAhoraPct: fd.get('virtualAhoraPct'),
            academiaPct: fd.get('academiaPct')
          }, 'comisiones');
        });
      }
      body.querySelectorAll('[data-ro-refund]').forEach(function (b) {
        b.addEventListener('click', function () {
          runAction({ action: 'refund_transaction', transactionId: b.getAttribute('data-ro-refund') }, 'comisiones');
        });
      });
      return;
    }

    /* ==================== 5. ACADEMIA Y CAPACITACIONES ==================== */
    if (viewKey === 'capacitaciones') {
      var courses = d.courses || [];
      var certs = d.certificates || [];
      var cRows = courses.map(function (c) {
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(c.title) + '</strong><br><small>' + esc(c.discipline) + ' · ' + esc(c.scheduleLabel) + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(c.instructorName) + ' (@' + esc(c.instructorNickname) + ')</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(c.modality) + ' (' + esc(c.totalMeetings) + ' enc.)</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;font-weight:800;">' + fmtArs.format(c.priceArs) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(c.enrolledCount) + ' / ' + esc(c.maxStudents) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(c.certificatesIssuedCount) + ' emitidos</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' +
            '<button type="button" data-ro-cert-course="' + esc(c.id) + '" style="margin-right:6px;padding:5px 8px;border:none;border-radius:6px;background:#836DAD;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">+ Emitir Certificado</button>' +
            '<button type="button" data-ro-del-course="' + esc(c.id) + '" style="padding:5px 8px;border:none;border-radius:6px;background:#dc2626;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Eliminar</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      var certRows = certs.map(function (ct) {
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><code>' + esc(ct.code) + '</code></td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(ct.studentName) + '</strong> (' + esc(ct.studentEmail) + ')</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(ct.courseTitle) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(ct.instructorName) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(fmtDate(ct.issuedAt)) + '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;margin-bottom:14px;">' +
          '<h4 style="margin:0 0 10px;color:#2B1F42;">+ Publicar Nueva Capacitación en Academia Reiki Online</h4>' +
          '<form id="ro-new-course-form" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;">' +
            '<input name="title" required placeholder="Título del Curso / Formación *" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
            '<input name="discipline" required placeholder="Terapia / Disciplina *" value="Reiki Usui" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
            '<input name="instructorName" required placeholder="Terapeuta Formador *" value="Daniel Alejandro Ghiglione" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
            '<input name="instructorNickname" required placeholder="Nickname Formador *" value="danielghiglione" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
            '<select name="modality" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;"><option value="Online en vivo">Online en vivo</option><option value="Presencial">Presencial</option><option value="Híbrido">Híbrido</option></select>' +
            '<input name="priceArs" type="number" required placeholder="Valor Total (ARS) *" value="45000" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
            '<input name="totalMeetings" type="number" required placeholder="Encuentros *" value="4" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
            '<input name="scheduleLabel" placeholder="Días y Horario" value="Sábados 10:00 hs" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
            '<button type="submit" style="padding:8px 14px;border:none;border-radius:8px;background:#836DAD;color:#fff;font-weight:800;cursor:pointer;">Publicar Curso</button>' +
          '</form>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;margin-bottom:14px;overflow:auto;">' +
          '<h4 style="margin:0 0 10px;color:#2B1F42;">Cursos y Formaciones Activos</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#F6F3FA;color:#2B1F42;">' +
            '<th style="text-align:left;padding:8px;">Capacitación</th>' +
            '<th style="text-align:left;padding:8px;">Formador</th>' +
            '<th style="text-align:left;padding:8px;">Modalidad</th>' +
            '<th style="text-align:left;padding:8px;">Valor</th>' +
            '<th style="text-align:left;padding:8px;">Inscriptos</th>' +
            '<th style="text-align:left;padding:8px;">Certificados</th>' +
            '<th style="text-align:left;padding:8px;">Acciones</th>' +
          '</tr></thead><tbody>' + (cRows || '<tr><td colspan="7" style="padding:12px;">Sin cursos registrados.</td></tr>') + '</tbody></table>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;overflow:auto;">' +
          '<h4 style="margin:0 0 10px;color:#2B1F42;">Certificados Digitales Emitidos (con QR verificable)</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#F6F3FA;color:#2B1F42;">' +
            '<th style="text-align:left;padding:8px;">Código</th>' +
            '<th style="text-align:left;padding:8px;">Alumno</th>' +
            '<th style="text-align:left;padding:8px;">Curso</th>' +
            '<th style="text-align:left;padding:8px;">Formador</th>' +
            '<th style="text-align:left;padding:8px;">Fecha</th>' +
          '</tr></thead><tbody>' + (certRows || '<tr><td colspan="5" style="padding:12px;">Sin certificados emitidos.</td></tr>') + '</tbody></table>' +
        '</div>';

      var ncForm = document.getElementById('ro-new-course-form');
      if (ncForm) {
        ncForm.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(ncForm);
          runAction({
            action: 'upsert_course',
            title: fd.get('title'),
            discipline: fd.get('discipline'),
            instructorName: fd.get('instructorName'),
            instructorNickname: fd.get('instructorNickname'),
            modality: fd.get('modality'),
            priceArs: fd.get('priceArs'),
            totalMeetings: fd.get('totalMeetings'),
            scheduleLabel: fd.get('scheduleLabel')
          }, 'capacitaciones');
        });
      }
      body.querySelectorAll('[data-ro-del-course]').forEach(function (b) {
        b.addEventListener('click', function () {
          runAction({ action: 'delete_course', courseId: b.getAttribute('data-ro-del-course') }, 'capacitaciones');
        });
      });
      body.querySelectorAll('[data-ro-cert-course]').forEach(function (b) {
        b.addEventListener('click', function () {
          var student = window.prompt('Nombre y Apellido del alumno a certificar:', 'Carolina Gómez');
          if (!student) return;
          runAction({
            action: 'issue_certificate',
            courseId: b.getAttribute('data-ro-cert-course'),
            studentName: student
          }, 'capacitaciones');
        });
      });
      return;
    }

    /* ==================== 6. VERIFICACIÓN BIOMÉTRICA E IDENTIDAD ==================== */
    if (viewKey === 'biometria') {
      var bioRows = (d.profiles || []).map(function (p) {
        var isTer = Boolean(p.soyTerapeuta || p.role === 'terapeuta');
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(p.nombre + ' ' + p.apellido) + '</strong> (@' + esc(p.nickname) + ')</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + (isTer ? 'Terapeuta' : 'Consultante') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(p.dni || '—') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(p.biometricStatus) + '</strong>' + (p.biometricRiskFlag ? ' <span style="color:#dc2626;font-weight:800;">(Alerta Riesgo)</span>' : '') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' +
            '<select data-ro-bio-sel="' + esc(p.id) + '" style="padding:5px 8px;border-radius:6px;border:1px solid #ccd5db;font-size:12px;margin-right:6px;">' +
              ['verificada', 'pendiente', 'no_iniciada', 'revision_requerida', 'rechazada'].map(function (st) {
                return '<option value="' + st + '"' + (p.biometricStatus === st ? ' selected' : '') + '>' + st + '</option>';
              }).join('') +
            '</select>' +
            '<button type="button" data-ro-bio-risk="' + esc(p.id) + '" style="padding:5px 9px;border:1px solid #836DAD;border-radius:6px;background:#FAF8FC;color:#836DAD;font-size:11px;font-weight:700;cursor:pointer;">' +
              (p.biometricRiskFlag ? 'Quitar Alerta Riesgo' : 'Simular Riesgo Consultante') +
            '</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;overflow:auto;">' +
          '<h4 style="margin:0 0 10px;color:#2B1F42;">Verificación Biométrica e Identidad (RENAPER / KYC Único)</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#F6F3FA;color:#2B1F42;">' +
            '<th style="text-align:left;padding:8px;">Usuario</th>' +
            '<th style="text-align:left;padding:8px;">Rol</th>' +
            '<th style="text-align:left;padding:8px;">DNI</th>' +
            '<th style="text-align:left;padding:8px;">Estado Biométrico</th>' +
            '<th style="text-align:left;padding:8px;">Acción Administrativa</th>' +
          '</tr></thead><tbody>' + bioRows + '</tbody></table>' +
        '</div>';

      body.querySelectorAll('[data-ro-bio-sel]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          runAction({
            action: 'update_biometric_status',
            profileId: sel.getAttribute('data-ro-bio-sel'),
            biometricStatus: sel.value
          }, 'biometria');
        });
      });
      body.querySelectorAll('[data-ro-bio-risk]').forEach(function (b) {
        b.addEventListener('click', function () {
          runAction({
            action: 'update_biometric_status',
            profileId: b.getAttribute('data-ro-bio-risk'),
            toggleRisk: true
          }, 'biometria');
        });
      });
      return;
    }

    /* ==================== 7. VIDEOLLAMADAS Y TURNOS (DAILY.CO 1:1) ==================== */
    if (viewKey === 'videollamadas') {
      var sesRows = (d.sessions || []).map(function (s) {
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(s.therapyName) + '</strong><br><small>' + esc(s.modality) + '</small></td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(s.therapistName) + ' (@' + esc(s.therapistNickname) + ')</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(s.consultanteName) + ' (' + esc(s.consultanteEmail) + ')</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(s.scheduledAt) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(s.status) + '</strong></td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' +
            '<select data-ro-ses-sel="' + esc(s.id) + '" style="padding:5px 8px;border-radius:6px;border:1px solid #ccd5db;font-size:12px;">' +
              ['programada', 'en_curso', 'efectuada', 'cancelada'].map(function (st) {
                return '<option value="' + st + '"' + (s.status === st ? ' selected' : '') + '>' + st + '</option>';
              }).join('') +
            '</select>' +
          '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;overflow:auto;">' +
          '<h4 style="margin:0 0 10px;color:#2B1F42;">Salas Privadas de Videollamada 1:1 (Daily.co) y Turnos</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#F6F3FA;color:#2B1F42;">' +
            '<th style="text-align:left;padding:8px;">Terapia / Modalidad</th>' +
            '<th style="text-align:left;padding:8px;">Terapeuta</th>' +
            '<th style="text-align:left;padding:8px;">Consultante</th>' +
            '<th style="text-align:left;padding:8px;">Horario</th>' +
            '<th style="text-align:left;padding:8px;">Estado</th>' +
            '<th style="text-align:left;padding:8px;">Cambiar Estado</th>' +
          '</tr></thead><tbody>' + (sesRows || '<tr><td colspan="6" style="padding:12px;">Sin sesiones registradas.</td></tr>') + '</tbody></table>' +
        '</div>';

      body.querySelectorAll('[data-ro-ses-sel]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          runAction({
            action: 'update_session_status',
            sessionId: sel.getAttribute('data-ro-ses-sel'),
            status: sel.value
          }, 'videollamadas');
        });
      });
      return;
    }

    /* ==================== 8. WHATSAPP OFICIAL (TWILIO VERIFY E.164) ==================== */
    if (viewKey === 'whatsapp') {
      var waRows = (d.profiles || []).map(function (p) {
        var isTer = Boolean(p.soyTerapeuta || p.role === 'terapeuta');
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(p.nombre + ' ' + p.apellido) + '</strong> (@' + esc(p.nickname) + ')</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + (isTer ? 'Terapeuta' : 'Consultante') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;font-weight:700;">' + esc(p.whatsappE164 || 'Sin cargar') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' +
            (p.whatsappVerified
              ? '<span style="color:#059669;font-weight:800;">✓ WhatsApp Verificado</span>'
              : '<span style="color:#d97706;font-weight:800;">Sin verificar</span>') +
          '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' +
            '<button type="button" data-ro-wa-toggle="' + esc(p.id) + '" data-ro-wa-next="' + (p.whatsappVerified ? '0' : '1') + '" style="padding:5px 10px;border:none;border-radius:6px;background:' + (p.whatsappVerified ? '#d97706' : '#059669') + ';color:#fff;font-size:11px;font-weight:700;cursor:pointer;">' +
              (p.whatsappVerified ? 'Marcar Sin Verificar' : 'Marcar Verificado') +
            '</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML = banner +
        '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;overflow:auto;">' +
          '<h4 style="margin:0 0 6px;color:#2B1F42;">WhatsApp Oficial (Twilio Verify · Formato E.164 Confidencial)</h4>' +
          '<p style="margin:0 0 12px;font-size:12px;color:#526570;">El número de WhatsApp de consultantes y terapeutas es estrictamente confidencial y nunca se publica en el perfil público.</p>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#F6F3FA;color:#2B1F42;">' +
            '<th style="text-align:left;padding:8px;">Usuario</th>' +
            '<th style="text-align:left;padding:8px;">Rol</th>' +
            '<th style="text-align:left;padding:8px;">WhatsApp E.164</th>' +
            '<th style="text-align:left;padding:8px;">Estado Twilio Verify</th>' +
            '<th style="text-align:left;padding:8px;">Acción</th>' +
          '</tr></thead><tbody>' + waRows + '</tbody></table>' +
        '</div>';

      body.querySelectorAll('[data-ro-wa-toggle]').forEach(function (b) {
        b.addEventListener('click', function () {
          runAction({
            action: 'update_whatsapp_status',
            profileId: b.getAttribute('data-ro-wa-toggle'),
            verified: b.getAttribute('data-ro-wa-next') === '1'
          }, 'whatsapp');
        });
      });
      return;
    }

    /* ==================== 10. CONFIGURACIÓN Y AUDITORÍA ==================== */
    var st = d.settings || {};
    var adminsHtml = (st.adminAccounts || []).map(function (a) {
      return '<div style="padding:10px;border-radius:10px;border:1px solid #E6E0F0;background:#FAF8FC;">' +
        '<strong>' + esc(a.nombre + ' ' + a.apellido) + '</strong><br>' +
        '<code style="color:#836DAD;font-weight:700;">@' + esc(a.username) + '</code> · <small>' + esc(a.email) + '</small>' +
      '</div>';
    }).join('');

    var logsHtml = (d.auditLogs || []).slice(0, 40).map(function (l) {
      return '<tr>' +
        '<td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap;">' + esc(fmtDate(l.createdAt)) + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #eee;"><code>@' + esc(l.actor) + '</code></td>' +
        '<td style="padding:8px;border-bottom:1px solid #eee;font-weight:700;color:#836DAD;">' + esc(l.action) + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(l.detail) + '</td>' +
      '</tr>';
    }).join('');

    body.innerHTML = banner +
      '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:18px;margin-bottom:14px;">' +
        '<h4 style="margin:0 0 12px;color:#2B1F42;">Configuración General del Sitio Reiki Online</h4>' +
        '<form id="ro-settings-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;align-items:end;">' +
          '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#2B1F42;">' +
            'URL Pública del Sitio' +
            '<input name="portalUrl" value="' + esc(st.portalUrl || 'https://www.reikionline.com.ar') + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
          '</label>' +
          '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#2B1F42;">' +
            'URL Portal ERP (/sistema)' +
            '<input name="erpUrl" value="' + esc(st.erpUrl || 'https://www.reikionline.com.ar/sistema') + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
          '</label>' +
          '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#2B1F42;">' +
            'Email Institucional' +
            '<input name="supportEmail" value="' + esc(st.supportEmail || 'contacto@reikionline.com.ar') + '" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
          '</label>' +
          '<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#2B1F42;">' +
            'Máximo de Terapias por Flyer Credencial' +
            '<select name="maxTherapiesPerFlyer" style="padding:8px;border:1px solid #ccd5db;border-radius:8px;">' +
              '<option value="4"' + (Number(st.maxTherapiesPerFlyer) !== 6 ? ' selected' : '') + '>4 terapias por Flyer</option>' +
              '<option value="6"' + (Number(st.maxTherapiesPerFlyer) === 6 ? ' selected' : '') + '>6 terapias por Flyer</option>' +
            '</select>' +
          '</label>' +
          '<button type="submit" style="padding:9px 16px;border:none;border-radius:8px;background:#836DAD;color:#fff;font-weight:800;cursor:pointer;">Guardar Configuración</button>' +
        '</form>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;margin-bottom:14px;">' +
        '<h4 style="margin:0 0 10px;color:#2B1F42;">Nómina de Administradores Habilitados en Reiki Online</h4>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">' + adminsHtml + '</div>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid #d9e2e6;border-radius:12px;padding:16px;overflow:auto;">' +
        '<h4 style="margin:0 0 10px;color:#2B1F42;">Historial de Auditoría Administrativa</h4>' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#F6F3FA;color:#2B1F42;">' +
          '<th style="text-align:left;padding:8px;">Fecha</th>' +
          '<th style="text-align:left;padding:8px;">Actor</th>' +
          '<th style="text-align:left;padding:8px;">Acción</th>' +
          '<th style="text-align:left;padding:8px;">Detalle</th>' +
        '</tr></thead><tbody>' + logsHtml + '</tbody></table>' +
      '</div>';

    var stForm = document.getElementById('ro-settings-form');
    if (stForm) {
      stForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var fd = new FormData(stForm);
        runAction({
          action: 'save_site_settings',
          portalUrl: fd.get('portalUrl'),
          erpUrl: fd.get('erpUrl'),
          supportEmail: fd.get('supportEmail'),
          maxTherapiesPerFlyer: fd.get('maxTherapiesPerFlyer')
        }, 'configuracion');
      });
    }
  }

  async function openRoView(viewKey) {
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
          ? 'Reiki online'
          : 'Reiki online · ' + (meta ? meta.label : STATE.view);
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
    var existing = document.getElementById('ms-reikionline-home-card');
    if (allowed && grid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-reikionline-home-card';
      card.className = 'module-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"></path>' +
          '</svg>' +
        '</div>' +
        '<h3>Reiki online</h3>';
      card.addEventListener('click', function () { openRoView('menu'); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openRoView('menu'); }
      });
      var anchorCard =
        document.getElementById('ms-doncontador-home-card') ||
        document.getElementById('ms-feriarte-home-card') ||
        document.getElementById('ms-superadmin-home-card');
      if (anchorCard && anchorCard.nextSibling) {
        grid.insertBefore(card, anchorCard.nextSibling);
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
