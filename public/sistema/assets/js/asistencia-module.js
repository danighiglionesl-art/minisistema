/* ==========================================================================
   MÓDULO ADMINISTRATIVO "CONTROL DE ASISTENCIAS" — MINISISTEMA ERP
   Organizado por submódulos (.modules-grid / .module-card) dentro de
   Administración de Personal:
   1. Jornadas y Desvíos (monitor, filtros, desvíos, CSV y Track GPS en mapa)
   2. Resumen por Empleado (consolidado de horas, desvíos, extras y km)
   3. Empleados y Accesos (usuario/contraseña del empleador, horarios y biometría)
   4. Horarios y Configuración (ingreso/egreso, tolerancias, GPS y Google)
   5. App PWA y Código QR (/asistencia)
   ========================================================================== */
(function () {
  'use strict';

  var SUBMODULE_TITLES = {
    jornadas: 'Jornadas y Desvíos',
    resumen: 'Resumen por Empleado',
    empleados: 'Empleados y Accesos',
    config: 'Horarios y Configuración',
    portal: 'App PWA y Código QR (/asistencia)'
  };

  var STATE = {
    loaded: false,
    loading: false,
    activeView: 'menu', // 'menu' | 'jornadas' | 'resumen' | 'empleados' | 'config' | 'portal'
    publicAsistenciaUrl: '/asistencia',
    config: null,
    employees: [],
    shifts: [],
    stats: {},
    perEmployeeSummary: [],
    filters: {
      employeeId: '',
      dateFrom: '',
      dateTo: '',
      deviation: 'all',
      search: ''
    },
    trackModalShiftId: null,
    leafletMap: null,
    leafletPlaybackMarker: null,
    editEmployeeModalId: null
  };

  var DAY_LABELS = [
    { d: 1, label: 'Lun' },
    { d: 2, label: 'Mar' },
    { d: 3, label: 'Mié' },
    { d: 4, label: 'Jue' },
    { d: 5, label: 'Vie' },
    { d: 6, label: 'Sáb' },
    { d: 0, label: 'Dom' }
  ];

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtMin(min) {
    var n = Number(min || 0);
    if (!n) return '0 min';
    var sign = n < 0 ? '-' : '';
    var abs = Math.abs(Math.round(n));
    var h = Math.floor(abs / 60);
    var m = abs % 60;
    if (h <= 0) return sign + m + ' min';
    return sign + h + 'h ' + String(m).padStart(2, '0') + 'm';
  }

  function fmtSignedMin(min) {
    var n = Number(min || 0);
    if (!n) return '0 min';
    return (n > 0 ? '+' : '') + fmtMin(n);
  }

  function fmtLocalTimeFromIso(iso) {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(new Date(iso));
    } catch (_e) {
      return String(iso).slice(11, 19);
    }
  }

  function getFullPublicUrl() {
    if (STATE.publicAsistenciaUrl && STATE.publicAsistenciaUrl.indexOf('http') === 0) {
      return STATE.publicAsistenciaUrl;
    }
    var bootUrl = window.__ERP_TENANT_BOOT__ && window.__ERP_TENANT_BOOT__.asistenciaUrl;
    if (bootUrl) return bootUrl;
    return window.location.origin + (STATE.publicAsistenciaUrl || '/asistencia');
  }

  async function apiAsistencia(method, body) {
    var url = '/sistema/api/asistencia.php';
    var opts = { method: method, headers: {} };
    if (method === 'POST') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body || {});
    }
    var res = await fetch(url, opts);
    return res.json();
  }

  function notify(msg, isErr) {
    var el = document.getElementById('ms-asist-toast');
    if (!el) return;
    el.hidden = false;
    el.style.background = isErr ? '#fef2f2' : '#ecfdf5';
    el.style.borderColor = isErr ? '#fca5a5' : '#6ee7b7';
    el.style.color = isErr ? '#991b1b' : '#065f46';
    el.textContent = msg;
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.hidden = true;
    }, 5500);
  }

  function ensureLeafletLoaded() {
    return new Promise(function (resolve) {
      if (window.L && typeof window.L.map === 'function') {
        resolve(true);
        return;
      }
      if (!document.getElementById('ms-leaflet-css')) {
        var link = document.createElement('link');
        link.id = 'ms-leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      var existingScript = document.getElementById('ms-leaflet-js');
      if (existingScript) {
        existingScript.addEventListener('load', function () { resolve(Boolean(window.L)); });
        existingScript.addEventListener('error', function () { resolve(false); });
        return;
      }
      var script = document.createElement('script');
      script.id = 'ms-leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = function () { resolve(Boolean(window.L)); };
      script.onerror = function () { resolve(false); };
      document.head.appendChild(script);
    });
  }

  function applyPayload(data) {
    if (!data || !data.ok) return;
    STATE.loaded = true;
    STATE.publicAsistenciaUrl = data.publicAsistenciaUrl || '/asistencia';
    STATE.config = data.config || null;
    STATE.employees = Array.isArray(data.employees) ? data.employees : [];
    STATE.shifts = Array.isArray(data.shifts) ? data.shifts : [];
    STATE.stats = data.stats || {};
    STATE.perEmployeeSummary = Array.isArray(data.perEmployeeSummary)
      ? data.perEmployeeSummary
      : [];
  }

  async function refreshData(silentRender) {
    STATE.loading = true;
    if (!silentRender) renderWorkspace();
    try {
      var data = await apiAsistencia('GET');
      if (data && data.ok) {
        applyPayload(data);
      } else if (!silentRender) {
        notify((data && data.message) || 'No se pudo cargar Control de Asistencias.', true);
      }
    } catch (_err) {
      if (!silentRender) {
        notify('Error de conexión con el servidor de Control de Asistencias.', true);
      }
    } finally {
      STATE.loading = false;
      renderWorkspace();
    }
  }

  function updateSectionHeader() {
    var sec = document.getElementById('sec-asistencias-workspace');
    if (!sec) return;
    var bar = sec.querySelector('.module-back-bar');
    if (!bar) return;

    var isMenu = STATE.activeView === 'menu';
    var subTitle = SUBMODULE_TITLES[STATE.activeView] || '';
    var fullUrl = getFullPublicUrl();

    if (isMenu) {
      bar.innerHTML =
        '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
          '<button type="button" class="btn-back-home" id="ms-asistencias-back-btn">← Volver a Administración de Personal</button>' +
          '<span class="module-breadcrumb">Administración de Personal · <strong>Control de Asistencias</strong></span>' +
        '</div>' +
        '<a href="' + esc(fullUrl) + '" target="_blank" rel="noopener" class="ms-sa-btn" style="padding:0.42rem 0.9rem;font-size:0.8rem;text-decoration:none;">Abrir App PWA (/asistencia) ↗</a>';
    } else {
      bar.innerHTML =
        '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
          '<button type="button" class="btn-back-home" id="ms-asistencias-back-btn">← Volver a Control de Asistencias</button>' +
          '<span class="module-breadcrumb">Control de Asistencias · <strong>' + esc(subTitle) + '</strong></span>' +
        '</div>' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-asist-refresh-btn" style="padding:0.38rem 0.85rem;font-size:0.78rem;">Actualizar</button>';
    }

    var backBtn = bar.querySelector('#ms-asistencias-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (STATE.activeView !== 'menu') {
          openView('menu');
        } else if (typeof window.__MS_OPEN_PERSONAL_MENU__ === 'function') {
          window.__MS_OPEN_PERSONAL_MENU__();
        }
      });
    }

    var refBtn = bar.querySelector('#ms-asist-refresh-btn');
    if (refBtn) {
      refBtn.addEventListener('click', function () {
        refreshData(false);
      });
    }

    var topbarModInd = document.getElementById('topbar-caja-indicator');
    if (topbarModInd) {
      topbarModInd.hidden = false;
      topbarModInd.textContent = isMenu
        ? 'Administración de Personal · Control de Asistencias'
        : 'Control de Asistencias · ' + subTitle;
    }
  }

  function openView(viewKey) {
    if (STATE.leafletMap) {
      try { STATE.leafletMap.remove(); } catch (_e) {}
      STATE.leafletMap = null;
    }
    STATE.trackModalShiftId = null;
    STATE.editEmployeeModalId = null;
    STATE.activeView = viewKey || 'menu';
    renderWorkspace();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getFilteredShifts() {
    var f = STATE.filters;
    return STATE.shifts.filter(function (s) {
      if (f.employeeId && s.employeeId !== f.employeeId) return false;
      if (f.dateFrom && s.fecha < f.dateFrom) return false;
      if (f.dateTo && s.fecha > f.dateTo) return false;
      var m = s.metrics || {};
      if (f.deviation === 'active' && s.status !== 'active') return false;
      if (f.deviation === 'late' && !(m.lateArrivalMinutes > 0)) return false;
      if (f.deviation === 'early_dep' && !(m.earlyDepartureMinutes > 0)) return false;
      if (f.deviation === 'late_dep' && !(m.lateDepartureMinutes > 0)) return false;
      if (f.deviation === 'overtime' && !(m.overtimeMinutes > 0)) return false;
      if (f.deviation === 'puntual' && !(Array.isArray(m.flags) && m.flags.indexOf('puntual') !== -1)) return false;
      if (f.search) {
        var q = f.search.toLowerCase();
        var hay = (
          (s.employeeName || '') + ' ' + (s.employeeDni || '') + ' ' + (s.fecha || '')
        ).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function exportFilteredShiftsCsv() {
    var rows = getFilteredShifts();
    if (!rows.length) {
      notify('No hay jornadas para exportar con los filtros actuales.', true);
      return;
    }
    var headers = [
      'Fecha', 'Empleado', 'DNI', 'Estado', 'Horario Ingreso', 'Horario Egreso',
      'Ingreso Real', 'Egreso Real', 'Trabajado (min)', 'Llegada Tarde (min)',
      'Salida Temprana (min)', 'Salida Tarde (min)', 'Horas Extras (min)',
      'Desvío Neto (min)', 'Recorrido (km)', 'Puntos GPS', 'Observaciones'
    ];
    var lines = [headers.join(';')];
    rows.forEach(function (s) {
      var m = s.metrics || {};
      var vals = [
        s.fecha,
        s.employeeName || '',
        s.employeeDni || '',
        s.status,
        s.scheduledIngreso || '',
        s.scheduledEgreso || '',
        s.checkInLocalTime || '',
        s.checkOutLocalTime || '',
        m.workedMinutes || 0,
        m.lateArrivalMinutes || 0,
        m.earlyDepartureMinutes || 0,
        m.lateDepartureMinutes || 0,
        m.overtimeMinutes || 0,
        m.netDeviationMinutes || 0,
        Number(s.totalDistanceKm || 0).toFixed(2),
        (s.trackPoints || []).length,
        (s.adminNotes || '').replace(/[\r\n;]+/g, ' ')
      ];
      lines.push(vals.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'control-asistencias-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ==================== VISTA MENÚ DE SUBMÓDULOS (CANÓNICO GEMINI.md) ====================
  function renderMenuGrid() {
    return (
      '<div class="modules-grid" aria-label="Submódulos de Control de Asistencias">' +
        '<article class="module-card" role="button" tabindex="0" data-asist-sub="jornadas">' +
          '<div class="module-icon" aria-hidden="true">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<circle cx="12" cy="12" r="9"></circle>' +
              '<polyline points="12 7 12 12 15 14"></polyline>' +
            '</svg>' +
          '</div>' +
          '<h3>Jornadas y Desvíos</h3>' +
        '</article>' +
        '<article class="module-card" role="button" tabindex="0" data-asist-sub="resumen">' +
          '<div class="module-icon" aria-hidden="true">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<line x1="18" y1="20" x2="18" y2="10"></line>' +
              '<line x1="12" y1="20" x2="12" y2="4"></line>' +
              '<line x1="6" y1="20" x2="6" y2="14"></line>' +
            '</svg>' +
          '</div>' +
          '<h3>Resumen por Empleado</h3>' +
        '</article>' +
        '<article class="module-card" role="button" tabindex="0" data-asist-sub="empleados">' +
          '<div class="module-icon" aria-hidden="true">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>' +
              '<circle cx="9" cy="7" r="4"></circle>' +
              '<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>' +
              '<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>' +
            '</svg>' +
          '</div>' +
          '<h3>Empleados y Accesos</h3>' +
        '</article>' +
        '<article class="module-card" role="button" tabindex="0" data-asist-sub="config">' +
          '<div class="module-icon" aria-hidden="true">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<circle cx="12" cy="12" r="3"></circle>' +
              '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' +
            '</svg>' +
          '</div>' +
          '<h3>Horarios y Configuración</h3>' +
        '</article>' +
        '<article class="module-card" role="button" tabindex="0" data-asist-sub="portal">' +
          '<div class="module-icon" aria-hidden="true">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<rect x="3" y="3" width="7" height="7"></rect>' +
              '<rect x="14" y="3" width="7" height="7"></rect>' +
              '<rect x="14" y="14" width="7" height="7"></rect>' +
              '<rect x="3" y="14" width="7" height="7"></rect>' +
            '</svg>' +
          '</div>' +
          '<h3>App PWA y Código QR (/asistencia)</h3>' +
        '</article>' +
      '</div>'
    );
  }

  function renderShiftBadges(s) {
    var m = s.metrics || {};
    var out = [];
    if (s.status === 'active') {
      out.push('<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#dcfce7;color:#166534;">● En curso</span>');
    } else if (s.status === 'closed_by_admin') {
      out.push('<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#e0e7ff;color:#3730a3;">Cierre admin</span>');
    }
    if (m.lateArrivalMinutes > 0) {
      out.push('<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#fef3c7;color:#92400e;">Tarde +' + m.lateArrivalMinutes + 'm</span>');
    }
    if (m.earlyDepartureMinutes > 0) {
      out.push('<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#fee2e2;color:#991b1b;">Sal. temp. -' + m.earlyDepartureMinutes + 'm</span>');
    }
    if (m.lateDepartureMinutes > 0) {
      out.push('<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#e0f2fe;color:#075985;">Sal. tarde +' + m.lateDepartureMinutes + 'm</span>');
    }
    if (m.overtimeMinutes > 0) {
      out.push('<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#d1fae5;color:#065f46;">Extras +' + fmtMin(m.overtimeMinutes) + '</span>');
    }
    if (!out.length) {
      out.push('<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#f1f5f9;color:#334155;">Puntual</span>');
    }
    return '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + out.join('') + '</div>';
  }

  function renderJornadasView() {
    var st = STATE.stats || {};
    var kpiCard = function (label, value, color) {
      return (
        '<div style="background:#fff;border:1px solid rgba(17,45,58,0.12);border-radius:14px;padding:0.85rem 1rem;">' +
          '<div style="font-size:0.7rem;font-weight:700;color:#64748b;text-transform:uppercase;">' + label + '</div>' +
          '<div style="font-size:1.35rem;font-weight:900;color:' + (color || '#112D3A') + ';margin-top:0.2rem;">' + value + '</div>' +
        '</div>'
      );
    };

    var rows = getFilteredShifts();
    var empOpts = '<option value="">Todos los empleados</option>' +
      STATE.employees.map(function (e) {
        var nm = (e.profile && e.profile.nombreCompleto) || e.username || e.email;
        return '<option value="' + esc(e.id) + '"' + (STATE.filters.employeeId === e.id ? ' selected' : '') + '>' + esc(nm) + '</option>';
      }).join('');

    var html =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:0.7rem;margin-bottom:1rem;">' +
        kpiCard('En Jornada Ahora', st.employeesActiveNow || 0, '#059669') +
        kpiCard('Empleados Activos', st.totalEmployees || 0, '#112D3A') +
        kpiCard('Llegadas Tarde', st.lateCount || 0, '#b45309') +
        kpiCard('Salidas Tempranas', st.earlyDepCount || 0, '#b91c1c') +
        kpiCard('Salidas Tarde', st.lateDepCount || 0, '#0369a1') +
        kpiCard('Horas Extras Acum.', esc(fmtMin(st.overtimeTotalMin || 0)), '#047857') +
      '</div>' +

      '<div style="display:flex;flex-wrap:wrap;gap:0.6rem;align-items:flex-end;background:#f8fafc;border:1px solid rgba(17,45,58,0.1);border-radius:14px;padding:0.9rem;margin-bottom:1rem;">' +
        '<div style="flex:1 1 180px;">' +
          '<label style="display:block;font-size:0.72rem;font-weight:700;color:#112D3A;margin-bottom:4px;">Empleado</label>' +
          '<select id="ms-asist-f-emp" style="width:100%;padding:0.48rem 0.6rem;border-radius:9px;border:1px solid #cbd5e1;font-size:0.82rem;background:#fff;">' + empOpts + '</select>' +
        '</div>' +
        '<div style="flex:0 1 140px;">' +
          '<label style="display:block;font-size:0.72rem;font-weight:700;color:#112D3A;margin-bottom:4px;">Desde</label>' +
          '<input type="date" id="ms-asist-f-from" value="' + esc(STATE.filters.dateFrom) + '" style="width:100%;padding:0.45rem 0.55rem;border-radius:9px;border:1px solid #cbd5e1;font-size:0.82rem;background:#fff;">' +
        '</div>' +
        '<div style="flex:0 1 140px;">' +
          '<label style="display:block;font-size:0.72rem;font-weight:700;color:#112D3A;margin-bottom:4px;">Hasta</label>' +
          '<input type="date" id="ms-asist-f-to" value="' + esc(STATE.filters.dateTo) + '" style="width:100%;padding:0.45rem 0.55rem;border-radius:9px;border:1px solid #cbd5e1;font-size:0.82rem;background:#fff;">' +
        '</div>' +
        '<div style="flex:0 1 175px;">' +
          '<label style="display:block;font-size:0.72rem;font-weight:700;color:#112D3A;margin-bottom:4px;">Filtro de desvío</label>' +
          '<select id="ms-asist-f-dev" style="width:100%;padding:0.48rem 0.6rem;border-radius:9px;border:1px solid #cbd5e1;font-size:0.82rem;background:#fff;">' +
            '<option value="all"' + (STATE.filters.deviation === 'all' ? ' selected' : '') + '>Todas las jornadas</option>' +
            '<option value="active"' + (STATE.filters.deviation === 'active' ? ' selected' : '') + '>En curso ahora</option>' +
            '<option value="puntual"' + (STATE.filters.deviation === 'puntual' ? ' selected' : '') + '>Puntuales</option>' +
            '<option value="late"' + (STATE.filters.deviation === 'late' ? ' selected' : '') + '>Llegadas tarde</option>' +
            '<option value="early_dep"' + (STATE.filters.deviation === 'early_dep' ? ' selected' : '') + '>Salidas tempranas</option>' +
            '<option value="late_dep"' + (STATE.filters.deviation === 'late_dep' ? ' selected' : '') + '>Salidas tarde</option>' +
            '<option value="overtime"' + (STATE.filters.deviation === 'overtime' ? ' selected' : '') + '>Con horas extras</option>' +
          '</select>' +
        '</div>' +
        '<div style="display:flex;gap:0.45rem;">' +
          '<button type="button" id="ms-asist-clear-filters" style="padding:0.5rem 0.75rem;border-radius:9px;border:1px solid #cbd5e1;background:#fff;color:#112D3A;font-size:0.78rem;font-weight:700;cursor:pointer;">Limpiar</button>' +
          '<button type="button" id="ms-asist-export-csv" style="padding:0.5rem 0.85rem;border-radius:9px;border:none;background:#112D3A;color:#fff;font-size:0.78rem;font-weight:700;cursor:pointer;">Exportar CSV</button>' +
        '</div>' +
      '</div>';

    if (!rows.length) {
      html +=
        '<div style="text-align:center;padding:2.5rem 1rem;background:#fff;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;font-size:0.9rem;">' +
          'No se encontraron jornadas registradas con los filtros seleccionados.<br>' +
          '<span style="font-size:0.8rem;">Compartí el link o código QR de la App PWA para que tus empleados inicien su jornada con biometría y GPS.</span>' +
        '</div>';
      return html;
    }

    html +=
      '<div style="overflow-x:auto;background:#fff;border:1px solid rgba(17,45,58,0.12);border-radius:14px;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;min-width:960px;">' +
          '<thead>' +
            '<tr style="background:#112D3A;color:#fff;text-align:left;">' +
              '<th style="padding:0.7rem 0.75rem;">Fecha</th>' +
              '<th style="padding:0.7rem 0.75rem;">Empleado</th>' +
              '<th style="padding:0.7rem 0.75rem;">Horario Fijado</th>' +
              '<th style="padding:0.7rem 0.75rem;">Ingreso / Egreso</th>' +
              '<th style="padding:0.7rem 0.75rem;">Trabajado</th>' +
              '<th style="padding:0.7rem 0.75rem;">Desvíos y Extras</th>' +
              '<th style="padding:0.7rem 0.75rem;">Desvío Neto</th>' +
              '<th style="padding:0.7rem 0.75rem;">Track GPS</th>' +
              '<th style="padding:0.7rem 0.75rem;text-align:right;">Acciones</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            rows.map(function (s) {
              var m = s.metrics || {};
              var netColor = m.netDeviationMinutes > 0 ? '#065f46' : (m.netDeviationMinutes < 0 ? '#991b1b' : '#334155');
              var ptCount = Array.isArray(s.trackPoints) ? s.trackPoints.length : 0;
              return (
                '<tr style="border-top:1px solid #e2e8f0;">' +
                  '<td style="padding:0.65rem 0.75rem;font-weight:700;white-space:nowrap;">' + esc(s.fecha) + '</td>' +
                  '<td style="padding:0.65rem 0.75rem;">' +
                    '<div style="font-weight:700;color:#112D3A;">' + esc(s.employeeName || 'Sin nombre') + '</div>' +
                    '<div style="font-size:0.72rem;color:#64748b;">DNI ' + esc(s.employeeDni || '—') + '</div>' +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;white-space:nowrap;color:#334155;">' + esc(s.scheduledIngreso) + ' - ' + esc(s.scheduledEgreso) + '</td>' +
                  '<td style="padding:0.65rem 0.75rem;white-space:nowrap;">' +
                    '<div><strong>In:</strong> ' + esc(s.checkInLocalTime || '—') + ' <span style="font-size:10px;color:#059669;" title="Biometría + GPS">✓Bio/GPS</span></div>' +
                    '<div><strong>Out:</strong> ' + esc(s.checkOutLocalTime || (s.status === 'active' ? 'En curso' : '—')) + '</div>' +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;white-space:nowrap;font-weight:700;">' + esc(fmtMin(m.workedMinutes)) + '</td>' +
                  '<td style="padding:0.65rem 0.75rem;">' + renderShiftBadges(s) + '</td>' +
                  '<td style="padding:0.65rem 0.75rem;white-space:nowrap;font-weight:800;color:' + netColor + ';">' +
                    (s.status === 'active' ? '—' : esc(fmtSignedMin(m.netDeviationMinutes))) +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;white-space:nowrap;">' +
                    '<div style="font-weight:700;color:#112D3A;">' + Number(s.totalDistanceKm || 0).toFixed(2) + ' km</div>' +
                    '<div style="font-size:0.7rem;color:#64748b;">' + ptCount + ' pts GPS</div>' +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;text-align:right;white-space:nowrap;">' +
                    '<button type="button" data-asist-track="' + esc(s.id) + '" style="padding:0.38rem 0.65rem;border-radius:8px;border:none;background:#56D7A1;color:#112D3A;font-size:0.74rem;font-weight:800;cursor:pointer;margin-right:4px;">Ver Track</button>' +
                    (s.status === 'active'
                      ? '<button type="button" data-asist-close-shift="' + esc(s.id) + '" style="padding:0.38rem 0.6rem;border-radius:8px;border:1px solid #fca5a5;background:#fef2f2;color:#991b1b;font-size:0.74rem;font-weight:700;cursor:pointer;">Cerrar</button>'
                      : '') +
                  '</td>' +
                '</tr>'
              );
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';

    return html;
  }

  function renderResumenView() {
    if (!STATE.perEmployeeSummary.length) {
      return '<div style="text-align:center;padding:2.5rem 1rem;background:#fff;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;font-size:0.9rem;">Aún no hay empleados registrados.</div>';
    }
    return (
      '<div style="overflow-x:auto;background:#fff;border:1px solid rgba(17,45,58,0.12);border-radius:14px;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;min-width:920px;">' +
          '<thead>' +
            '<tr style="background:#112D3A;color:#fff;text-align:left;">' +
              '<th style="padding:0.7rem 0.75rem;">Empleado</th>' +
              '<th style="padding:0.7rem 0.75rem;">Estado</th>' +
              '<th style="padding:0.7rem 0.75rem;">Jornadas</th>' +
              '<th style="padding:0.7rem 0.75rem;">Horas Trabajadas</th>' +
              '<th style="padding:0.7rem 0.75rem;">Llegadas Tarde</th>' +
              '<th style="padding:0.7rem 0.75rem;">Salidas Tempranas</th>' +
              '<th style="padding:0.7rem 0.75rem;">Salidas Tarde</th>' +
              '<th style="padding:0.7rem 0.75rem;">Horas Extras</th>' +
              '<th style="padding:0.7rem 0.75rem;">Desvío Neto</th>' +
              '<th style="padding:0.7rem 0.75rem;">Track Total</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            STATE.perEmployeeSummary.map(function (r) {
              var netColor = r.netDeviationMin > 0 ? '#065f46' : (r.netDeviationMin < 0 ? '#991b1b' : '#334155');
              return (
                '<tr style="border-top:1px solid #e2e8f0;">' +
                  '<td style="padding:0.65rem 0.75rem;">' +
                    '<div style="font-weight:700;color:#112D3A;">' + esc(r.employeeName) + '</div>' +
                    '<div style="font-size:0.72rem;color:#64748b;">DNI ' + esc(r.dni || '—') + '</div>' +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;">' +
                    (r.activeNow
                      ? '<span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#dcfce7;color:#166534;">● En jornada</span>'
                      : '<span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#f1f5f9;color:#475569;">Fuera</span>') +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;font-weight:700;">' + r.totalShifts + '</td>' +
                  '<td style="padding:0.65rem 0.75rem;font-weight:700;">' + esc(fmtMin(r.totalWorkedMin)) + '</td>' +
                  '<td style="padding:0.65rem 0.75rem;color:' + (r.lateArrivalsCount ? '#92400e' : '#64748b') + ';font-weight:' + (r.lateArrivalsCount ? '700' : '400') + ';">' +
                    r.lateArrivalsCount + ' (' + esc(fmtMin(r.lateArrivalsMin)) + ')' +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;color:' + (r.earlyDeparturesCount ? '#991b1b' : '#64748b') + ';font-weight:' + (r.earlyDeparturesCount ? '700' : '400') + ';">' +
                    r.earlyDeparturesCount + ' (' + esc(fmtMin(r.earlyDeparturesMin)) + ')' +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;color:' + (r.lateDeparturesCount ? '#075985' : '#64748b') + ';font-weight:' + (r.lateDeparturesCount ? '700' : '400') + ';">' +
                    r.lateDeparturesCount + ' (' + esc(fmtMin(r.lateDeparturesMin)) + ')' +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;color:#065f46;font-weight:800;">' + esc(fmtMin(r.overtimeMin)) + '</td>' +
                  '<td style="padding:0.65rem 0.75rem;font-weight:800;color:' + netColor + ';">' + esc(fmtSignedMin(r.netDeviationMin)) + '</td>' +
                  '<td style="padding:0.65rem 0.75rem;font-weight:700;">' + Number(r.totalDistanceKm || 0).toFixed(2) + ' km</td>' +
                '</tr>'
              );
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  function renderEmpleadosView() {
    var html =
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:0.9rem;">' +
        '<div style="font-size:0.84rem;color:#475569;">Administrá cuentas gestionadas por el empleador (usuario y contraseña), horarios individuales, datos obligatorios y biometría.</div>' +
        '<button type="button" id="ms-asist-new-emp-btn" style="padding:0.55rem 1rem;border-radius:10px;border:none;background:#112D3A;color:#fff;font-size:0.82rem;font-weight:800;cursor:pointer;">+ Nuevo Empleado (Usuario y Contraseña)</button>' +
      '</div>';

    if (!STATE.employees.length) {
      html += '<div style="text-align:center;padding:2.5rem 1rem;background:#fff;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;font-size:0.9rem;">Todavía no hay empleados cargados. Creá uno con usuario y contraseña o compartí la App PWA desde el submódulo App PWA y Código QR.</div>';
      return html;
    }

    html +=
      '<div style="overflow-x:auto;background:#fff;border:1px solid rgba(17,45,58,0.12);border-radius:14px;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;min-width:960px;">' +
          '<thead>' +
            '<tr style="background:#112D3A;color:#fff;text-align:left;">' +
              '<th style="padding:0.7rem 0.75rem;">Empleado / DNI</th>' +
              '<th style="padding:0.7rem 0.75rem;">Acceso</th>' +
              '<th style="padding:0.7rem 0.75rem;">Contacto y Urgencias</th>' +
              '<th style="padding:0.7rem 0.75rem;">Domicilio</th>' +
              '<th style="padding:0.7rem 0.75rem;">Horario</th>' +
              '<th style="padding:0.7rem 0.75rem;">Biometría / Datos</th>' +
              '<th style="padding:0.7rem 0.75rem;text-align:right;">Acciones</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            STATE.employees.map(function (e) {
              var p = e.profile || {};
              var sched = e.effectiveSchedule || {};
              var waDigits = String(p.whatsappCompleto || '').replace(/\D/g, '');
              var waUrgDigits = String(p.whatsappUrgenciasCompleto || '').replace(/\D/g, '');
              return (
                '<tr style="border-top:1px solid #e2e8f0;' + (e.active === false ? 'opacity:0.55;' : '') + '">' +
                  '<td style="padding:0.65rem 0.75rem;">' +
                    '<div style="font-weight:700;color:#112D3A;">' + esc(p.nombreCompleto || e.username || e.email) + '</div>' +
                    '<div style="font-size:0.72rem;color:#64748b;">DNI ' + esc(p.dni || 'Pendiente') + (p.fechaNacimiento ? ' · Nac. ' + esc(p.fechaNacimiento) : '') + '</div>' +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;">' +
                    '<div style="font-weight:700;">@' + esc(e.username) + '</div>' +
                    '<div style="font-size:0.72rem;color:#64748b;">' + esc(e.email || 'Solo usuario empresa') + '</div>' +
                    '<span style="display:inline-block;margin-top:2px;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:700;background:#f1f5f9;color:#334155;">' +
                      (e.authProvider === 'google' ? 'Google' : e.authProvider === 'email' ? 'Correo' : 'Empleador') +
                    '</span>' +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;font-size:0.75rem;">' +
                    '<div>' + (waDigits ? '<a href="https://wa.me/' + esc(waDigits) + '" target="_blank" rel="noopener" style="color:#047857;font-weight:700;text-decoration:none;">WA: ' + esc(p.whatsappCompleto) + '</a>' : '<span style="color:#94a3b8;">Sin WhatsApp</span>') + '</div>' +
                    '<div>' + (waUrgDigits ? '<a href="https://wa.me/' + esc(waUrgDigits) + '" target="_blank" rel="noopener" style="color:#b91c1c;font-weight:700;text-decoration:none;">Urg: ' + esc(p.whatsappUrgenciasCompleto) + '</a>' : '<span style="color:#94a3b8;">Sin urgencias</span>') + '</div>' +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;font-size:0.74rem;max-width:210px;">' + esc(p.domicilioCompleto || 'Sin completar') + '</td>' +
                  '<td style="padding:0.65rem 0.75rem;white-space:nowrap;">' +
                    '<div style="font-weight:700;">' + esc(sched.horaIngreso || '08:00') + ' - ' + esc(sched.horaEgreso || '17:00') + '</div>' +
                    '<div style="font-size:0.7rem;color:#64748b;">' + (e.scheduleOverride && e.scheduleOverride.useCustom ? 'Personalizado' : 'General') + '</div>' +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;">' +
                    '<div>' + (e.biometrics && e.biometrics.enrolled
                      ? '<span style="padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;background:#dcfce7;color:#166534;">Biometría OK</span>'
                      : '<span style="padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;background:#fef3c7;color:#92400e;">Sin biometría</span>') + '</div>' +
                    '<div style="margin-top:3px;">' + (!e.mustCompleteProfile
                      ? '<span style="font-size:10px;color:#059669;font-weight:700;">✓ Datos completos</span>'
                      : '<span style="font-size:10px;color:#b45309;font-weight:700;">⚠ Datos incompletos</span>') + '</div>' +
                  '</td>' +
                  '<td style="padding:0.65rem 0.75rem;text-align:right;white-space:nowrap;">' +
                    '<button type="button" data-asist-edit-emp="' + esc(e.id) + '" style="padding:0.35rem 0.6rem;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#112D3A;font-size:0.72rem;font-weight:700;cursor:pointer;margin-right:3px;">Editar / Horario</button>' +
                    '<button type="button" data-asist-reset-bio="' + esc(e.id) + '" title="Reiniciar dispositivo biométrico" style="padding:0.35rem 0.55rem;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;font-size:0.72rem;font-weight:700;cursor:pointer;margin-right:3px;">Reset Bio</button>' +
                    '<button type="button" data-asist-toggle-emp="' + esc(e.id) + '" style="padding:0.35rem 0.55rem;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:' + (e.active === false ? '#047857' : '#b45309') + ';font-size:0.72rem;font-weight:700;cursor:pointer;">' + (e.active === false ? 'Activar' : 'Pausar') + '</button>' +
                  '</td>' +
                '</tr>'
              );
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';

    return html;
  }

  function renderConfigView() {
    var cfg = STATE.config || {};
    var sched = cfg.defaultSchedule || { horaIngreso: '08:00', horaEgreso: '17:00', toleranciaIngresoMin: 10, toleranciaEgresoMin: 10, diasLaborales: [1, 2, 3, 4, 5] };
    var geo = cfg.workplaceGeo || { enabled: false, label: 'Sede Principal', lat: '', lng: '', radiusMeters: 150 };
    var days = Array.isArray(sched.diasLaborales) ? sched.diasLaborales : [1, 2, 3, 4, 5];

    return (
      '<form id="ms-asist-config-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:1rem;">' +
        '<div style="background:#fff;border:1px solid rgba(17,45,58,0.12);border-radius:14px;padding:1.25rem;">' +
          '<h3 style="margin:0 0 0.85rem;font-size:1rem;color:#112D3A;">Horario General de Ingreso y Egreso</h3>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Hora de Ingreso</label>' +
              '<input type="time" id="ms-cfg-in" value="' + esc(sched.horaIngreso) + '" required style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:9px;">' +
            '</div>' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Hora de Egreso</label>' +
              '<input type="time" id="ms-cfg-out" value="' + esc(sched.horaEgreso) + '" required style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:9px;">' +
            '</div>' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Tolerancia Ingreso (min)</label>' +
              '<input type="number" min="0" max="120" id="ms-cfg-tol-in" value="' + esc(sched.toleranciaIngresoMin) + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:9px;">' +
            '</div>' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Tolerancia Egreso / Extras (min)</label>' +
              '<input type="number" min="0" max="120" id="ms-cfg-tol-out" value="' + esc(sched.toleranciaEgresoMin) + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:9px;">' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:0.85rem;">' +
            '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:6px;">Días laborales</label>' +
            '<div style="display:flex;flex-wrap:wrap;gap:0.45rem;">' +
              DAY_LABELS.map(function (dl) {
                var checked = days.indexOf(dl.d) !== -1;
                return '<label style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:8px;border:1px solid #cbd5e1;font-size:0.78rem;cursor:pointer;background:' + (checked ? '#ecfdf5' : '#fff') + ';">' +
                  '<input type="checkbox" class="ms-cfg-day" value="' + dl.d + '"' + (checked ? ' checked' : '') + '> ' + dl.label +
                '</label>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div style="margin-top:0.85rem;">' +
            '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Frecuencia de Track GPS durante jornada (segundos)</label>' +
            '<select id="ms-cfg-track-sec" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:9px;background:#fff;">' +
              [15, 30, 60, 120, 300].map(function (sec) {
                return '<option value="' + sec + '"' + (Number(cfg.trackingIntervalSec || 60) === sec ? ' selected' : '') + '>Cada ' + sec + ' segundos</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +

        '<div style="background:#fff;border:1px solid rgba(17,45,58,0.12);border-radius:14px;padding:1.25rem;">' +
          '<h3 style="margin:0 0 0.85rem;font-size:1rem;color:#112D3A;">Sede de Referencia y Acceso PWA</h3>' +
          '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;font-weight:700;margin-bottom:0.75rem;cursor:pointer;">' +
            '<input type="checkbox" id="ms-cfg-geo-en"' + (geo.enabled ? ' checked' : '') + '> Mostrar sede y radio de referencia en el mapa de Track' +
          '</label>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.65rem;">' +
            '<div style="grid-column:span 2;">' +
              '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Nombre de Sede</label>' +
              '<input type="text" id="ms-cfg-geo-label" value="' + esc(geo.label || 'Sede Principal') + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:9px;">' +
            '</div>' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Latitud</label>' +
              '<input type="text" id="ms-cfg-geo-lat" value="' + esc(geo.lat != null ? geo.lat : '') + '" placeholder="-33.12345" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:9px;">' +
            '</div>' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Longitud</label>' +
              '<input type="text" id="ms-cfg-geo-lng" value="' + esc(geo.lng != null ? geo.lng : '') + '" placeholder="-64.34567" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:9px;">' +
            '</div>' +
            '<div>' +
              '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Radio referencia (metros)</label>' +
              '<input type="number" min="25" max="50000" id="ms-cfg-geo-rad" value="' + esc(geo.radiusMeters || 150) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:9px;">' +
            '</div>' +
            '<div style="display:flex;align-items:flex-end;">' +
              '<button type="button" id="ms-cfg-geo-here" style="width:100%;padding:0.5rem;border-radius:9px;border:1px solid #112D3A;background:#f8fafc;color:#112D3A;font-size:0.75rem;font-weight:700;cursor:pointer;">Usar mi ubicación</button>' +
            '</div>' +
          '</div>' +
          '<hr style="margin:1rem 0;border:none;border-top:1px solid #e2e8f0;">' +
          '<div style="margin-bottom:0.65rem;">' +
            '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Google OAuth Client ID (opcional para botón oficial GSI)</label>' +
            '<input type="text" id="ms-cfg-google-id" value="' + esc(cfg.googleClientId || '') + '" placeholder="xxxxx.apps.googleusercontent.com" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:9px;font-size:0.8rem;">' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;font-weight:700;cursor:pointer;">' +
            '<input type="checkbox" id="ms-cfg-selfreg"' + (cfg.allowSelfRegistration !== false ? ' checked' : '') + '> Permitir que los empleados se registren con Google o Correo' +
          '</label>' +
        '</div>' +

        '<div style="grid-column:1 / -1;display:flex;justify-content:flex-end;">' +
          '<button type="submit" style="padding:0.7rem 1.4rem;border-radius:11px;border:none;background:#56D7A1;color:#112D3A;font-size:0.88rem;font-weight:900;cursor:pointer;">Guardar Horarios y Configuración</button>' +
        '</div>' +
      '</form>'
    );
  }

  function renderPortalQrView() {
    var fullUrl = getFullPublicUrl();
    var qrSrc =
      'https://api.qrserver.com/v1/create-qr-code/?size=260x260&ecc=M&margin=2&data=' +
      encodeURIComponent(fullUrl);

    return (
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;">' +
        '<div style="background:#fff;border:1px solid rgba(17,45,58,0.12);border-radius:16px;padding:1.35rem;display:flex;flex-direction:column;gap:0.9rem;">' +
          '<h3 style="margin:0;font-size:1.05rem;color:#112D3A;">Enlace de la App PWA de Empleados</h3>' +
          '<p style="margin:0;font-size:0.84rem;color:#475569;line-height:1.5;">Compartí este enlace con tu equipo por WhatsApp o correo para que instalen la App PWA en sus celulares e inicien su jornada con biometría y geoposición satelital.</p>' +
          '<input type="text" readonly value="' + esc(fullUrl) + '" style="width:100%;padding:0.6rem 0.75rem;border:1px solid #cbd5e1;border-radius:10px;font-size:0.84rem;background:#f8fafc;color:#112D3A;font-weight:700;">' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.55rem;">' +
            '<a href="' + esc(fullUrl) + '" target="_blank" rel="noopener" style="padding:0.58rem 1rem;border-radius:10px;background:#56D7A1;color:#112D3A;font-size:0.82rem;font-weight:900;text-decoration:none;">Abrir App PWA ↗</a>' +
            '<button type="button" id="ms-asist-copy-url" style="padding:0.58rem 1rem;border-radius:10px;border:1px solid #112D3A;background:#fff;color:#112D3A;font-size:0.82rem;font-weight:800;cursor:pointer;">Copiar Enlace</button>' +
          '</div>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid rgba(17,45,58,0.12);border-radius:16px;padding:1.35rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:0.75rem;">' +
          '<h3 style="margin:0;font-size:1.05rem;color:#112D3A;">Código QR para Instalar la App</h3>' +
          '<img src="' + esc(qrSrc) + '" alt="Código QR App Control de Asistencia" width="220" height="220" style="border-radius:14px;border:1px solid #e2e8f0;padding:8px;background:#fff;">' +
          '<div style="font-size:0.78rem;color:#64748b;">Escaneá desde el celular del empleado para abrir e instalar la PWA.</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderEmployeeModal() {
    if (!STATE.editEmployeeModalId) return '';
    var isNew = STATE.editEmployeeModalId === 'new';
    var emp = isNew
      ? null
      : STATE.employees.find(function (e) { return e.id === STATE.editEmployeeModalId; });
    var p = (emp && emp.profile) || {};
    var so = (emp && emp.scheduleOverride) || {};
    var defSched = (STATE.config && STATE.config.defaultSchedule) || { horaIngreso: '08:00', horaEgreso: '17:00', toleranciaIngresoMin: 10, toleranciaEgresoMin: 10 };

    return (
      '<div id="ms-asist-emp-modal" style="position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.65);display:flex;align-items:center;justify-content:center;padding:1rem;">' +
        '<div style="background:#fff;border-radius:18px;max-width:640px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,0.28);">' +
          '<div style="background:#112D3A;color:#fff;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;border-radius:18px 18px 0 0;">' +
            '<strong style="font-size:1rem;">' + (isNew ? 'Nuevo Empleado (Usuario y Contraseña)' : 'Editar Empleado y Horario') + '</strong>' +
            '<button type="button" id="ms-asist-emp-modal-close" style="background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer;">&times;</button>' +
          '</div>' +
          '<form id="ms-asist-emp-form" style="padding:1.25rem;display:flex;flex-direction:column;gap:0.9rem;">' +
            '<input type="hidden" id="ms-emp-id" value="' + esc(emp ? emp.id : '') + '">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
              '<div>' +
                '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Usuario (acceso empresa) *</label>' +
                '<input type="text" id="ms-emp-user" required value="' + esc(emp ? emp.username : '') + '" placeholder="ej: jperez" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:9px;">' +
              '</div>' +
              '<div>' +
                '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">' + (isNew ? 'Contraseña *' : 'Nueva Contraseña (opcional)') + '</label>' +
                '<input type="password" id="ms-emp-pass" ' + (isNew ? 'required minlength="4"' : '') + ' placeholder="' + (isNew ? 'Mínimo 4 caracteres' : 'Dejar vacío para mantener') + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:9px;">' +
              '</div>' +
              '<div>' +
                '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Apellido/s</label>' +
                '<input type="text" id="ms-emp-ape" value="' + esc(p.apellidos || '') + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:9px;">' +
              '</div>' +
              '<div>' +
                '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Nombre/s</label>' +
                '<input type="text" id="ms-emp-nom" value="' + esc(p.nombres || '') + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:9px;">' +
              '</div>' +
              '<div>' +
                '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">DNI</label>' +
                '<input type="text" id="ms-emp-dni" value="' + esc(p.dni || '') + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:9px;">' +
              '</div>' +
              '<div>' +
                '<label style="display:block;font-size:0.75rem;font-weight:700;margin-bottom:4px;">Correo electrónico (opcional)</label>' +
                '<input type="email" id="ms-emp-email" value="' + esc(emp ? emp.email : '') + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:9px;">' +
              '</div>' +
            '</div>' +
            '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:0.85rem;">' +
              '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.82rem;font-weight:800;color:#112D3A;cursor:pointer;">' +
                '<input type="checkbox" id="ms-emp-custom-sched"' + (so.useCustom ? ' checked' : '') + '> Fijar horario personalizado para este empleado' +
              '</label>' +
              '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.6rem;margin-top:0.7rem;">' +
                '<div>' +
                  '<label style="display:block;font-size:0.72rem;font-weight:700;margin-bottom:3px;">Ingreso</label>' +
                  '<input type="time" id="ms-emp-in" value="' + esc(so.horaIngreso || defSched.horaIngreso) + '" style="width:100%;padding:0.42rem;border:1px solid #cbd5e1;border-radius:8px;">' +
                '</div>' +
                '<div>' +
                  '<label style="display:block;font-size:0.72rem;font-weight:700;margin-bottom:3px;">Egreso</label>' +
                  '<input type="time" id="ms-emp-out" value="' + esc(so.horaEgreso || defSched.horaEgreso) + '" style="width:100%;padding:0.42rem;border:1px solid #cbd5e1;border-radius:8px;">' +
                '</div>' +
                '<div>' +
                  '<label style="display:block;font-size:0.72rem;font-weight:700;margin-bottom:3px;">Tol. In (m)</label>' +
                  '<input type="number" min="0" max="120" id="ms-emp-tol-in" value="' + esc(so.toleranciaIngresoMin != null ? so.toleranciaIngresoMin : defSched.toleranciaIngresoMin) + '" style="width:100%;padding:0.42rem;border:1px solid #cbd5e1;border-radius:8px;">' +
                '</div>' +
                '<div>' +
                  '<label style="display:block;font-size:0.72rem;font-weight:700;margin-bottom:3px;">Tol. Out (m)</label>' +
                  '<input type="number" min="0" max="120" id="ms-emp-tol-out" value="' + esc(so.toleranciaEgresoMin != null ? so.toleranciaEgresoMin : defSched.toleranciaEgresoMin) + '" style="width:100%;padding:0.42rem;border:1px solid #cbd5e1;border-radius:8px;">' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div style="font-size:0.75rem;color:#64748b;">Si dejás incompletos los datos básicos, la App PWA le exigirá obligatoriamente al empleado completarlos al iniciar sesión.</div>' +
            '<div style="display:flex;justify-content:flex-end;gap:0.6rem;">' +
              '<button type="button" id="ms-asist-emp-cancel" style="padding:0.55rem 1rem;border-radius:9px;border:1px solid #cbd5e1;background:#fff;font-weight:700;cursor:pointer;">Cancelar</button>' +
              '<button type="submit" style="padding:0.55rem 1.15rem;border-radius:9px;border:none;background:#56D7A1;color:#112D3A;font-weight:900;cursor:pointer;">Guardar Empleado</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>'
    );
  }

  function renderTrackModal() {
    if (!STATE.trackModalShiftId) return '';
    var shift = STATE.shifts.find(function (s) { return s.id === STATE.trackModalShiftId; });
    if (!shift) return '';
    var m = shift.metrics || {};
    var pts = Array.isArray(shift.trackPoints) ? shift.trackPoints : [];
    var firstPt = pts[0];
    var gmapsUrl = firstPt
      ? 'https://www.google.com/maps?q=' + firstPt.lat + ',' + firstPt.lng
      : '#';

    return (
      '<div id="ms-asist-track-modal" style="position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.72);display:flex;align-items:center;justify-content:center;padding:1rem;">' +
        '<div style="background:#fff;border-radius:18px;max-width:980px;width:100%;max-height:94vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.35);">' +
          '<div style="background:#112D3A;color:#fff;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;border-radius:18px 18px 0 0;">' +
            '<div>' +
              '<div style="font-size:0.72rem;color:#56D7A1;font-weight:800;text-transform:uppercase;">Track de Recorrido Satelital · ' + esc(shift.fecha) + '</div>' +
              '<strong style="font-size:1.05rem;">' + esc(shift.employeeName) + ' (DNI ' + esc(shift.employeeDni || '—') + ')</strong>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:0.5rem;">' +
              (firstPt ? '<a href="' + esc(gmapsUrl) + '" target="_blank" rel="noopener" style="padding:0.4rem 0.7rem;border-radius:8px;background:rgba(255,255,255,0.15);color:#fff;font-size:0.76rem;font-weight:700;text-decoration:none;">Abrir en Google Maps</a>' : '') +
              '<button type="button" id="ms-asist-track-close" style="background:none;border:none;color:#fff;font-size:1.5rem;cursor:pointer;line-height:1;">&times;</button>' +
            '</div>' +
          '</div>' +

          '<div style="padding:1.15rem;display:flex;flex-direction:column;gap:1rem;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0.6rem;">' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;padding:0.65rem;">' +
                '<div style="font-size:0.7rem;color:#64748b;">Horario Fijado</div>' +
                '<div style="font-weight:800;color:#112D3A;">' + esc(shift.scheduledIngreso) + ' - ' + esc(shift.scheduledEgreso) + '</div>' +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;padding:0.65rem;">' +
                '<div style="font-size:0.7rem;color:#64748b;">Ingreso / Egreso</div>' +
                '<div style="font-weight:800;color:#112D3A;">' + esc(shift.checkInLocalTime) + ' / ' + esc(shift.checkOutLocalTime || 'En curso') + '</div>' +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;padding:0.65rem;">' +
                '<div style="font-size:0.7rem;color:#64748b;">Trabajado / Extras</div>' +
                '<div style="font-weight:800;color:#065f46;">' + esc(fmtMin(m.workedMinutes)) + ' / +' + esc(fmtMin(m.overtimeMinutes)) + '</div>' +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;padding:0.65rem;">' +
                '<div style="font-size:0.7rem;color:#64748b;">Lleg. Tarde / Sal. Temp.</div>' +
                '<div style="font-weight:800;color:#92400e;">+' + (m.lateArrivalMinutes || 0) + 'm / -' + (m.earlyDepartureMinutes || 0) + 'm</div>' +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;padding:0.65rem;">' +
                '<div style="font-size:0.7rem;color:#64748b;">Distancia / Puntos</div>' +
                '<div style="font-weight:800;color:#112D3A;">' + Number(shift.totalDistanceKm || 0).toFixed(2) + ' km (' + pts.length + ' pts)</div>' +
              '</div>' +
            '</div>' +

            '<div id="ms-asist-track-map" style="height:360px;width:100%;border-radius:14px;border:1px solid #cbd5e1;background:#e2e8f0;overflow:hidden;"></div>' +

            (pts.length > 1
              ? '<div style="display:flex;align-items:center;gap:0.75rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;padding:0.65rem 0.9rem;">' +
                  '<span style="font-size:0.76rem;font-weight:800;color:#112D3A;white-space:nowrap;">Línea de tiempo:</span>' +
                  '<input type="range" id="ms-asist-track-slider" min="0" max="' + (pts.length - 1) + '" value="' + (pts.length - 1) + '" style="flex:1;">' +
                  '<span id="ms-asist-track-slider-label" style="font-size:0.76rem;font-weight:700;color:#334155;white-space:nowrap;">' + esc(fmtLocalTimeFromIso(pts[pts.length - 1].ts)) + '</span>' +
                '</div>'
              : '') +

            '<div style="display:grid;grid-template-columns:1fr 280px;gap:0.9rem;">' +
              '<div style="max-height:200px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:11px;">' +
                '<table style="width:100%;border-collapse:collapse;font-size:0.75rem;">' +
                  '<thead><tr style="background:#f1f5f9;text-align:left;"><th style="padding:6px 8px;">#</th><th style="padding:6px 8px;">Hora</th><th style="padding:6px 8px;">Evento</th><th style="padding:6px 8px;">Coordenadas</th><th style="padding:6px 8px;">Precisión</th></tr></thead>' +
                  '<tbody>' +
                    pts.map(function (pt, idx) {
                      return '<tr style="border-top:1px solid #e2e8f0;">' +
                        '<td style="padding:5px 8px;color:#64748b;">' + (idx + 1) + '</td>' +
                        '<td style="padding:5px 8px;font-weight:700;">' + esc(fmtLocalTimeFromIso(pt.ts)) + '</td>' +
                        '<td style="padding:5px 8px;">' + (pt.event === 'checkin' ? 'Ingreso' : pt.event === 'checkout' ? 'Egreso' : 'Recorrido') + '</td>' +
                        '<td style="padding:5px 8px;font-family:monospace;">' + Number(pt.lat).toFixed(5) + ', ' + Number(pt.lng).toFixed(5) + '</td>' +
                        '<td style="padding:5px 8px;">±' + Math.round(pt.accuracy || 0) + 'm</td>' +
                      '</tr>';
                    }).join('') +
                  '</tbody>' +
                '</table>' +
              '</div>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;padding:0.75rem;display:flex;flex-direction:column;gap:0.5rem;">' +
                '<label style="font-size:0.75rem;font-weight:800;color:#112D3A;">Observaciones del Administrador</label>' +
                '<textarea id="ms-asist-shift-notes" rows="4" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.78rem;resize:vertical;">' + esc(shift.adminNotes || '') + '</textarea>' +
                '<button type="button" id="ms-asist-save-notes-btn" data-shift-id="' + esc(shift.id) + '" style="padding:0.45rem;border-radius:8px;border:none;background:#112D3A;color:#fff;font-size:0.76rem;font-weight:700;cursor:pointer;">Guardar Observación</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function mountLeafletTrackMap(shift) {
    var mapEl = document.getElementById('ms-asist-track-map');
    if (!mapEl) return;
    if (STATE.leafletMap) {
      try { STATE.leafletMap.remove(); } catch (_e) {}
      STATE.leafletMap = null;
    }
    var pts = Array.isArray(shift.trackPoints) ? shift.trackPoints : [];
    if (!pts.length) {
      mapEl.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#475569;font-size:0.85rem;">Sin puntos GPS registrados.</div>';
      return;
    }

    ensureLeafletLoaded().then(function (ok) {
      if (!ok || !window.L) {
        mapEl.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;padding:1rem;text-align:center;color:#475569;font-size:0.84rem;">Mapa no disponible sin conexión externa. Consultá la tabla cronológica de coordenadas GPS debajo.</div>';
        return;
      }
      var L = window.L;
      var latlngs = pts.map(function (p) { return [p.lat, p.lng]; });
      var map = L.map(mapEl).setView(latlngs[0], 15);
      STATE.leafletMap = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      var wg = STATE.config && STATE.config.workplaceGeo;
      if (wg && wg.enabled && typeof wg.lat === 'number' && typeof wg.lng === 'number') {
        L.circle([wg.lat, wg.lng], {
          radius: wg.radiusMeters || 150,
          color: '#112D3A',
          fillColor: '#56D7A1',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '6 4'
        }).addTo(map).bindPopup('<strong>' + esc(wg.label || 'Sede') + '</strong>');
      }

      if (latlngs.length > 1) {
        var poly = L.polyline(latlngs, {
          color: '#112D3A',
          weight: 4,
          opacity: 0.85
        }).addTo(map);
        map.fitBounds(poly.getBounds(), { padding: [36, 36] });
      }

      L.circleMarker(latlngs[0], {
        radius: 9,
        color: '#065f46',
        fillColor: '#10b981',
        fillOpacity: 1,
        weight: 2
      }).addTo(map).bindPopup('<strong>Ingreso</strong><br>' + esc(fmtLocalTimeFromIso(pts[0].ts)) + '<br>±' + Math.round(pts[0].accuracy || 0) + 'm');

      for (var i = 1; i < pts.length - 1; i++) {
        L.circleMarker(latlngs[i], {
          radius: 4,
          color: '#112D3A',
          fillColor: '#56D7A1',
          fillOpacity: 0.9,
          weight: 1.5
        }).addTo(map).bindPopup('<strong>Punto #' + (i + 1) + '</strong><br>' + esc(fmtLocalTimeFromIso(pts[i].ts)) + '<br>±' + Math.round(pts[i].accuracy || 0) + 'm');
      }

      var lastIdx = pts.length - 1;
      var endMarker = L.circleMarker(latlngs[lastIdx], {
        radius: 9,
        color: shift.status === 'active' ? '#047857' : '#991b1b',
        fillColor: shift.status === 'active' ? '#56D7A1' : '#ef4444',
        fillOpacity: 1,
        weight: 2
      }).addTo(map).bindPopup(
        '<strong>' + (shift.status === 'active' ? 'Última ubicación (En curso)' : 'Egreso') + '</strong><br>' +
        esc(fmtLocalTimeFromIso(pts[lastIdx].ts)) + '<br>±' + Math.round(pts[lastIdx].accuracy || 0) + 'm'
      );

      STATE.leafletPlaybackMarker = endMarker;

      var slider = document.getElementById('ms-asist-track-slider');
      var sliderLabel = document.getElementById('ms-asist-track-slider-label');
      if (slider) {
        slider.addEventListener('input', function () {
          var idx = Number(slider.value || 0);
          var pt = pts[idx];
          if (!pt) return;
          endMarker.setLatLng([pt.lat, pt.lng]);
          if (sliderLabel) {
            sliderLabel.textContent = '#' + (idx + 1) + ' · ' + fmtLocalTimeFromIso(pt.ts);
          }
        });
      }

      setTimeout(function () {
        map.invalidateSize();
      }, 150);
    });
  }

  function renderWorkspace() {
    var body = document.getElementById('ms-asistencias-body');
    if (!body) return;

    updateSectionHeader();

    if (STATE.activeView === 'menu') {
      body.style.maxWidth = '';
      body.style.margin = '';
      body.innerHTML = renderMenuGrid();
      bindMenuEvents();
      return;
    }

    body.style.maxWidth = '1260px';
    body.style.margin = '0 auto';

    var content = '';
    if (STATE.loading && !STATE.loaded) {
      content = '<div style="padding:2.5rem;text-align:center;color:#475569;font-weight:700;">Cargando información...</div>';
    } else if (STATE.activeView === 'jornadas') {
      content = renderJornadasView();
    } else if (STATE.activeView === 'resumen') {
      content = renderResumenView();
    } else if (STATE.activeView === 'empleados') {
      content = renderEmpleadosView();
    } else if (STATE.activeView === 'config') {
      content = renderConfigView();
    } else if (STATE.activeView === 'portal') {
      content = renderPortalQrView();
    }

    body.innerHTML =
      '<div id="ms-asist-toast" hidden style="margin-bottom:0.85rem;padding:0.75rem 1rem;border-radius:12px;border:1px solid #6ee7b7;font-size:0.84rem;font-weight:700;"></div>' +
      content +
      renderEmployeeModal() +
      renderTrackModal();

    bindSubmoduleEvents();

    if (STATE.trackModalShiftId) {
      var targetShift = STATE.shifts.find(function (s) { return s.id === STATE.trackModalShiftId; });
      if (targetShift) mountLeafletTrackMap(targetShift);
    }
  }

  function bindMenuEvents() {
    var body = document.getElementById('ms-asistencias-body');
    if (!body) return;
    body.querySelectorAll('[data-asist-sub]').forEach(function (card) {
      var target = card.getAttribute('data-asist-sub');
      card.addEventListener('click', function () {
        openView(target);
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openView(target);
        }
      });
    });
  }

  function bindSubmoduleEvents() {
    var body = document.getElementById('ms-asistencias-body');
    if (!body) return;

    var copyBtn = body.querySelector('#ms-asist-copy-url');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(getFullPublicUrl()).then(function () {
            notify('Enlace de la App PWA copiado al portapapeles.');
          });
        }
      });
    }

    // Filters
    var fEmp = body.querySelector('#ms-asist-f-emp');
    if (fEmp) fEmp.addEventListener('change', function () { STATE.filters.employeeId = fEmp.value; renderWorkspace(); });
    var fFrom = body.querySelector('#ms-asist-f-from');
    if (fFrom) fFrom.addEventListener('change', function () { STATE.filters.dateFrom = fFrom.value; renderWorkspace(); });
    var fTo = body.querySelector('#ms-asist-f-to');
    if (fTo) fTo.addEventListener('change', function () { STATE.filters.dateTo = fTo.value; renderWorkspace(); });
    var fDev = body.querySelector('#ms-asist-f-dev');
    if (fDev) fDev.addEventListener('change', function () { STATE.filters.deviation = fDev.value; renderWorkspace(); });
    var clearBtn = body.querySelector('#ms-asist-clear-filters');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        STATE.filters = { employeeId: '', dateFrom: '', dateTo: '', deviation: 'all', search: '' };
        renderWorkspace();
      });
    }
    var expBtn = body.querySelector('#ms-asist-export-csv');
    if (expBtn) expBtn.addEventListener('click', exportFilteredShiftsCsv);

    // Track Modal
    body.querySelectorAll('[data-asist-track]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        STATE.trackModalShiftId = btn.getAttribute('data-asist-track');
        renderWorkspace();
      });
    });

    body.querySelectorAll('[data-asist-close-shift]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var sid = btn.getAttribute('data-asist-close-shift');
        var note = window.prompt('Motivo del cierre administrativo de esta jornada (opcional):', 'Cierre administrativo');
        if (note === null) return;
        var data = await apiAsistencia('POST', { action: 'admin_close_shift', shiftId: sid, adminNotes: note });
        if (data && data.ok) {
          applyPayload(data);
          renderWorkspace();
          notify(data.message || 'Jornada cerrada.');
        } else {
          notify((data && data.message) || 'No se pudo cerrar la jornada.', true);
        }
      });
    });

    var trackClose = body.querySelector('#ms-asist-track-close');
    if (trackClose) {
      trackClose.addEventListener('click', function () {
        if (STATE.leafletMap) {
          try { STATE.leafletMap.remove(); } catch (_e) {}
          STATE.leafletMap = null;
        }
        STATE.trackModalShiftId = null;
        renderWorkspace();
      });
    }
    var saveNotesBtn = body.querySelector('#ms-asist-save-notes-btn');
    if (saveNotesBtn) {
      saveNotesBtn.addEventListener('click', async function () {
        var sid = saveNotesBtn.getAttribute('data-shift-id');
        var notesEl = body.querySelector('#ms-asist-shift-notes');
        var data = await apiAsistencia('POST', {
          action: 'update_shift_notes',
          shiftId: sid,
          adminNotes: notesEl ? notesEl.value : ''
        });
        if (data && data.ok) {
          applyPayload(data);
          notify('Observación guardada.');
        } else {
          notify((data && data.message) || 'Error al guardar observación.', true);
        }
      });
    }

    // Employees
    var newEmpBtn = body.querySelector('#ms-asist-new-emp-btn');
    if (newEmpBtn) {
      newEmpBtn.addEventListener('click', function () {
        STATE.editEmployeeModalId = 'new';
        renderWorkspace();
      });
    }
    body.querySelectorAll('[data-asist-edit-emp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        STATE.editEmployeeModalId = btn.getAttribute('data-asist-edit-emp');
        renderWorkspace();
      });
    });
    body.querySelectorAll('[data-asist-reset-bio]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!window.confirm('¿Reiniciar la biometría de este empleado para que vincule un nuevo dispositivo?')) return;
        var data = await apiAsistencia('POST', {
          action: 'reset_employee_biometrics',
          employeeId: btn.getAttribute('data-asist-reset-bio')
        });
        if (data && data.ok) {
          applyPayload(data);
          renderWorkspace();
          notify(data.message);
        } else {
          notify((data && data.message) || 'Error al reiniciar biometría.', true);
        }
      });
    });
    body.querySelectorAll('[data-asist-toggle-emp]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var data = await apiAsistencia('POST', {
          action: 'toggle_employee_active',
          employeeId: btn.getAttribute('data-asist-toggle-emp')
        });
        if (data && data.ok) {
          applyPayload(data);
          renderWorkspace();
          notify(data.message);
        } else {
          notify((data && data.message) || 'Error al cambiar estado.', true);
        }
      });
    });

    var closeEmpModal = function () {
      STATE.editEmployeeModalId = null;
      renderWorkspace();
    };
    var empCloseBtn = body.querySelector('#ms-asist-emp-modal-close');
    if (empCloseBtn) empCloseBtn.addEventListener('click', closeEmpModal);
    var empCancelBtn = body.querySelector('#ms-asist-emp-cancel');
    if (empCancelBtn) empCancelBtn.addEventListener('click', closeEmpModal);

    var empForm = body.querySelector('#ms-asist-emp-form');
    if (empForm) {
      empForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var payload = {
          action: 'save_employee',
          employee: {
            id: body.querySelector('#ms-emp-id').value,
            username: body.querySelector('#ms-emp-user').value.trim(),
            password: body.querySelector('#ms-emp-pass').value,
            email: body.querySelector('#ms-emp-email').value.trim(),
            profile: {
              apellidos: body.querySelector('#ms-emp-ape').value.trim(),
              nombres: body.querySelector('#ms-emp-nom').value.trim(),
              dni: body.querySelector('#ms-emp-dni').value.trim()
            },
            scheduleOverride: {
              useCustom: body.querySelector('#ms-emp-custom-sched').checked,
              horaIngreso: body.querySelector('#ms-emp-in').value,
              horaEgreso: body.querySelector('#ms-emp-out').value,
              toleranciaIngresoMin: Number(body.querySelector('#ms-emp-tol-in').value || 0),
              toleranciaEgresoMin: Number(body.querySelector('#ms-emp-tol-out').value || 0)
            }
          }
        };
        var data = await apiAsistencia('POST', payload);
        if (data && data.ok) {
          STATE.editEmployeeModalId = null;
          applyPayload(data);
          renderWorkspace();
          notify(data.message || 'Empleado guardado.');
        } else {
          notify((data && data.message) || 'No se pudo guardar el empleado.', true);
        }
      });
    }

    // Config
    var geoHereBtn = body.querySelector('#ms-cfg-geo-here');
    if (geoHereBtn) {
      geoHereBtn.addEventListener('click', function () {
        if (!navigator.geolocation) {
          notify('Geolocalización no soportada en este navegador.', true);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            body.querySelector('#ms-cfg-geo-lat').value = pos.coords.latitude.toFixed(6);
            body.querySelector('#ms-cfg-geo-lng').value = pos.coords.longitude.toFixed(6);
            body.querySelector('#ms-cfg-geo-en').checked = true;
            notify('Coordenadas de sede capturadas.');
          },
          function () {
            notify('No se pudo obtener tu ubicación actual.', true);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }

    var cfgForm = body.querySelector('#ms-asist-config-form');
    if (cfgForm) {
      cfgForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var checkedDays = [];
        body.querySelectorAll('.ms-cfg-day:checked').forEach(function (cb) {
          checkedDays.push(Number(cb.value));
        });
        var latVal = body.querySelector('#ms-cfg-geo-lat').value.trim();
        var lngVal = body.querySelector('#ms-cfg-geo-lng').value.trim();
        var data = await apiAsistencia('POST', {
          action: 'save_config',
          config: {
            googleClientId: body.querySelector('#ms-cfg-google-id').value.trim(),
            allowSelfRegistration: body.querySelector('#ms-cfg-selfreg').checked,
            trackingIntervalSec: Number(body.querySelector('#ms-cfg-track-sec').value || 60),
            defaultSchedule: {
              horaIngreso: body.querySelector('#ms-cfg-in').value,
              horaEgreso: body.querySelector('#ms-cfg-out').value,
              toleranciaIngresoMin: Number(body.querySelector('#ms-cfg-tol-in').value || 0),
              toleranciaEgresoMin: Number(body.querySelector('#ms-cfg-tol-out').value || 0),
              diasLaborales: checkedDays.length ? checkedDays : [1, 2, 3, 4, 5]
            },
            workplaceGeo: {
              enabled: body.querySelector('#ms-cfg-geo-en').checked,
              label: body.querySelector('#ms-cfg-geo-label').value.trim(),
              lat: latVal ? Number(latVal) : null,
              lng: lngVal ? Number(lngVal) : null,
              radiusMeters: Number(body.querySelector('#ms-cfg-geo-rad').value || 150)
            }
          }
        });
        if (data && data.ok) {
          applyPayload(data);
          renderWorkspace();
          notify(data.message || 'Configuración guardada.');
        } else {
          notify((data && data.message) || 'Error al guardar configuración.', true);
        }
      });
    }
  }

  window.__MS_MOUNT_ASISTENCIAS__ = function () {
    STATE.activeView = 'menu';
    STATE.trackModalShiftId = null;
    STATE.editEmployeeModalId = null;
    renderWorkspace();
    refreshData(true);
  };

  window.__MS_ASISTENCIAS_BACK__ = function () {
    if (STATE.activeView !== 'menu') {
      openView('menu');
      return true;
    }
    return false;
  };
})();
