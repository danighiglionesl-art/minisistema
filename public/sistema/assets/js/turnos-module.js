/* ==========================================================================
   MÓDULO "TURNERO WEB" — MINISISTEMA ERP
   Vinculado en vivo con /turnos (dominio propio Opción 1 o /<slug>/turnos Opción 2):
   - ABM Profesionales (DNI, Apellido/s, Nombre/s por separado)
   - ABM Obras Sociales (CCT / Sindicales RNOS SSSalud, Prepagas, Provinciales, PAMI)
   - ABM Planes (vinculados a Obras Sociales dadas de alta)
   - ABM Especialidades (lapsos exactos de 5, 10, 15, ..., 60 minutos)
   - Gestión de Profesionales (días, rangos horarios, disponibilidad de slots, obras sociales, bloqueos)
   - Gestión de Pacientes (ABM + registro web por DNI)
   - Gestión de Turnos (turnos web + asignación manual + WhatsApp + Videollamada)
   - Pagos Online Particular & Split Mercado Pago (Organizador vs Profesional)
   - Portal Público /turnos y Código QR
   ========================================================================== */
(function () {
  'use strict';

  var DURACIONES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
  var DIAS_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var ORGANIZADOR_TIPOS = [
    'Clínica',
    'Consultorios Externos',
    'Sanatorio',
    'Staff de Profesionales',
    'Centro Médico',
    'Instituto / Policonsultorio'
  ];

  var STATE = {
    activeView: 'menu', // 'menu' | 'profesionales' | 'obras_sociales' | 'planes' | 'especialidades' | 'gestion_profesionales' | 'pacientes' | 'gestion_turnos' | 'pagos_split' | 'portal'
    publicTurnosUrl: '/turnos',
    stats: {},
    data: {
      portalConfig: {},
      splitConfig: { profesionalExceptions: {}, auditLog: [] },
      obrasSociales: [],
      planes: [],
      especialidades: [],
      profesionales: [],
      bloqueos: [],
      pacientes: [],
      turnos: [],
      transaccionesMp: []
    },
    // Estados de edición y filtros por submódulo
    editingProfId: null,
    profModalOpen: false,
    profDraft: null,
    profEspPickerOpen: false,
    profOsPickerOpen: false,
    searchProf: '',
    editingOsId: null,
    filterOsTipo: '',
    searchOs: '',
    selectedPlanOsId: '',
    editingPlanId: null,
    editingEspId: null,
    espModalOpen: false,
    espPage: 1,
    filterEspCat: '',
    searchEsp: '',
    gestionProfId: '',
    gestionHorariosDraft: [],
    gestionObrasDraft: [],
    gestionPreviewEspId: '',
    editingPacId: null,
    searchPac: '',
    filterTurnoFecha: '',
    filterTurnoModo: 'proximos', // 'hoy' | 'proximos' | 'todos'
    filterTurnoProf: '',
    filterTurnoEstado: '',
    searchTurno: '',
    manualTurnoOpen: false,
    manualSlots: [],
    manualSelectedHora: '',
    manualForm: {
      especialidadId: '',
      profesionalId: '',
      fecha: '',
      modalidad: 'presencial',
      coberturaTipo: 'obra_social',
      obraSocialId: '',
      planId: '',
      nroAfiliado: '',
      pacienteDni: '',
      pacienteApellidos: '',
      pacienteNombres: '',
      pacienteFechaNacimiento: '',
      pacienteWhatsapp: '',
      pacienteEmail: '',
      esSobreturno: false,
      motivoConsulta: ''
    }
  };

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtArs(val) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(Number(val || 0));
  }

  function todayIso() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function timeToMin(hhmm) {
    var m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return -1;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function minToTime(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
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

  function isTurnosModuleAllowed() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    var isBase = Boolean(window.ERP_BRAND && window.ERP_BRAND.isBase);
    var brandMods = (window.ERP_BRAND && window.ERP_BRAND.enabledModules) || [];
    if (!isBase && Array.isArray(brandMods) && brandMods.length > 0 && brandMods.indexOf('turnos') === -1) {
      return false;
    }
    if (String(u.username).toLowerCase() === 'danielg' || u.role === 'Administrador General' || u.role === 'Administrador') {
      return true;
    }
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return uMods.some(function (k) {
      return k === 'turnos' || String(k).indexOf('turnos:') === 0;
    });
  }

  async function apiTurnos(method, bodyOrQuery) {
    var url = '/sistema/api/turnos.php';
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (method === 'GET' && bodyOrQuery) {
      url += '?' + new URLSearchParams(bodyOrQuery).toString();
      delete opts.headers['Content-Type'];
    } else if (method === 'POST') {
      opts.body = JSON.stringify(bodyOrQuery || {});
    }
    var res = await fetch(url, opts);
    return res.json();
  }

  function showToast(msg, isErr) {
    var el = document.getElementById('ms-turnos-toast');
    if (!el) return;
    el.style.display = 'block';
    el.style.background = isErr ? '#fee2e2' : '#dcfce7';
    el.style.color = isErr ? '#991b1b' : '#065f46';
    el.style.border = isErr ? '1px solid #f87171' : '1px solid #34d399';
    el.textContent = msg;
    setTimeout(function () {
      if (el.textContent === msg) el.style.display = 'none';
    }, 5500);
  }

  function hideAllErpSections() {
    document.querySelectorAll('.erp-main > .erp-section').forEach(function (sec) {
      sec.hidden = true;
    });
  }

  function updateTopbarState(visible, label) {
    var backTopBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backTopBtn) {
      backTopBtn.hidden = !visible;
      if (visible) backTopBtn.textContent = '← Atrás';
    }
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    if (topbarModInd) {
      topbarModInd.hidden = !visible;
      if (visible && label) topbarModInd.textContent = label;
    }
  }

  function closeTurnosToHome() {
    hideAllErpSections();
    if (typeof window.__MS_OPEN_GESTION_CONSULTORIOS__ === 'function') {
      window.__MS_OPEN_GESTION_CONSULTORIOS__();
      return;
    }
    var inicio = document.getElementById('sec-inicio');
    if (inicio) inicio.hidden = false;
    updateTopbarState(false);
  }

  function applyApiResponse(res) {
    if (!res || !res.ok) return;
    if (res.publicTurnosUrl) STATE.publicTurnosUrl = res.publicTurnosUrl;
    if (res.stats) STATE.stats = res.stats;
    if (res.data) STATE.data = res.data;
    syncCountersUi();
  }

  async function reloadTurnosData(renderAfter) {
    try {
      var res = await apiTurnos('GET', { action: 'state', t: String(Date.now()) });
      applyApiResponse(res);
    } catch (_e) {}
    if (renderAfter) renderWorkspace();
  }

  function syncCountersUi() {
    var st = STATE.stats || {};
    var pill = document.getElementById('ms-turnos-home-pill');
    if (pill) {
      var hoy = Number(st.turnosHoy || 0);
      pill.textContent = hoy > 0 ? hoy + ' HOY' : 'TURNOS WEB';
      pill.style.background = hoy > 0 ? '#56D7A1' : 'rgba(86,215,161,0.18)';
    }
    var map = {
      'ms-trn-cnt-prof': (st.profesionalesActivos || 0) + ' activos',
      'ms-trn-cnt-os': (st.obrasSocialesActivas || 0) + ' activas',
      'ms-trn-cnt-planes': (st.planesActivos || 0) + ' planes',
      'ms-trn-cnt-esp': (st.especialidadesActivas || 0) + ' especialidades',
      'ms-trn-cnt-pac': (st.pacientesActivos || 0) + ' pacientes',
      'ms-trn-cnt-turnos': (st.turnosHoy || 0) + ' hoy · ' + (st.turnosProximos || 0) + ' próx.',
      'ms-trn-cnt-mp': fmtArs(st.totalRecaudadoParticularArs || 0)
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = map[id];
    });
    var topLink = document.getElementById('ms-turnos-open-public-top');
    if (topLink && STATE.publicTurnosUrl) {
      topLink.href = STATE.publicTurnosUrl;
    }
  }

  function ensureSectionsMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var menuSec = document.getElementById('sec-menu-turnos');
    var workSec = document.getElementById('sec-turnos-workspace');

    if (!menuSec) {
      menuSec = document.createElement('section');
      menuSec.id = 'sec-menu-turnos';
      menuSec.className = 'erp-section';
      menuSec.hidden = true;
      menuSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-turnos-back-home-btn">← Volver a Gestión Consultorios</button>' +
            '<span class="module-breadcrumb">Gestión Consultorios · <strong>Turnero Web</strong></span>' +
          '</div>' +
          '<a href="/turnos" target="_blank" class="ms-sa-btn" style="padding:0.42rem 0.9rem;font-size:0.8rem;" id="ms-turnos-open-public-top">🌐 Abrir Portal Público /turnos ↗</a>' +
        '</div>' +
        '<div class="modules-grid" aria-label="Submódulos de Turnero Web">' +
          subCardHtml('gestion_turnos', 'Gestión de Turnos',
            '<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>') +
          subCardHtml('gestion_profesionales', 'Gestión de Profesionales',
            '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>') +
          subCardHtml('pacientes', 'Gestión de Pacientes',
            '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>') +
          subCardHtml('profesionales', 'ABM Profesionales',
            '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>') +
          subCardHtml('especialidades', 'ABM Especialidades',
            '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>') +
          subCardHtml('obras_sociales', 'ABM Obras Sociales',
            '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>') +
          subCardHtml('planes', 'ABM Planes',
            '<rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>') +
          subCardHtml('pagos_split', 'Pagos Online y Split MP',
            '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>') +
          subCardHtml('portal', 'Enlace, QR y Videollamada',
            '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>') +
        '</div>';

      erpMain.appendChild(menuSec);
      menuSec.querySelector('#ms-turnos-back-home-btn').addEventListener('click', closeTurnosToHome);
      menuSec.querySelectorAll('[data-turnos-sub]').forEach(function (card) {
        card.addEventListener('click', function () {
          openTurnosView(card.getAttribute('data-turnos-sub'));
        });
        card.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            openTurnosView(card.getAttribute('data-turnos-sub'));
          }
        });
      });
    }

    if (!workSec) {
      workSec = document.createElement('section');
      workSec.id = 'sec-turnos-workspace';
      workSec.className = 'erp-section';
      workSec.hidden = true;
      workSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-turnos-back-sub-btn">← Volver a Turnero Web</button>' +
            '<span class="module-breadcrumb">Turnero Web · <strong id="ms-turnos-sub-title">Gestión</strong></span>' +
          '</div>' +
          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-turnos-refresh-btn" style="padding:0.38rem 0.8rem;font-size:0.78rem;">🔄 Actualizar</button>' +
        '</div>' +
        '<div id="ms-turnos-toast" style="display:none;margin-bottom:0.9rem;padding:0.7rem 1rem;border-radius:10px;font-weight:700;font-size:0.85rem;"></div>' +
        '<div id="ms-turnos-body"></div>';

      erpMain.appendChild(workSec);
      workSec.querySelector('#ms-turnos-back-sub-btn').addEventListener('click', function () {
        openTurnosView('menu');
      });
      workSec.querySelector('#ms-turnos-refresh-btn').addEventListener('click', function () {
        reloadTurnosData(true);
      });
    }

    return { menuSec: menuSec, workSec: workSec };
  }

  function subCardHtml(key, title, svgInner) {
    return (
      '<article class="module-card" role="button" tabindex="0" data-turnos-sub="' + key + '">' +
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + svgInner + '</svg>' +
        '</div>' +
        '<h3>' + esc(title) + '</h3>' +
      '</article>'
    );
  }

  async function openTurnosView(viewName) {
    bindGlobalTurnosNavReset();
    var refs = ensureSectionsMounted();
    if (!refs) return;
    STATE.activeView = viewName || 'menu';
    hideAllErpSections();

    if (STATE.activeView === 'menu') {
      refs.menuSec.hidden = false;
      updateTopbarState(true, 'Gestión Consultorios · Turnero Web');
      await reloadTurnosData(false);
    } else {
      refs.workSec.hidden = false;
      var titles = {
        profesionales: 'ABM Profesionales (DNI, Apellido/s y Nombre/s)',
        obras_sociales: 'ABM Obras Sociales (CCT / Sindicales SSSalud, Prepagas y Estatales)',
        planes: 'ABM Planes por Obra Social',
        especialidades: 'ABM Especialidades Médicas (Lapsos 5 a 60 min)',
        gestion_profesionales: 'Gestión de Profesionales (Días, Horarios, Slots y Obras Sociales)',
        pacientes: 'Gestión de Pacientes (ABM y Registro Web por DNI)',
        gestion_turnos: 'Gestión de Turnos (Turnos Web y Asignación Manual)',
        pagos_split: 'Pagos Online Particular y Split Mercado Pago',
        portal: 'Portal Público /turnos, Código QR y Sala de Videollamada'
      };
      var shortTitles = {
        profesionales: 'ABM Profesionales',
        obras_sociales: 'ABM Obras Sociales',
        planes: 'ABM Planes',
        especialidades: 'ABM Especialidades',
        gestion_profesionales: 'Gestión de Profesionales',
        pacientes: 'Gestión de Pacientes',
        gestion_turnos: 'Gestión de Turnos',
        pagos_split: 'Pagos Online y Split MP',
        portal: 'Enlace, QR y Videollamada'
      };
      var tEl = document.getElementById('ms-turnos-sub-title');
      if (tEl) tEl.textContent = titles[STATE.activeView] || 'Turnero Web';
      updateTopbarState(true, 'Turnero Web · ' + (shortTitles[STATE.activeView] || 'Gestión'));
      await reloadTurnosData(true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==================== 1. ABM PROFESIONALES ====================
  function createProfDraft(editing) {
    return {
      dni: editing ? String(editing.dni || '') : '',
      titulo: editing ? String(editing.titulo || 'Dr.') : 'Dr.',
      apellidos: editing ? String(editing.apellidos || '') : '',
      nombres: editing ? String(editing.nombres || '') : '',
      matriculaProvincial: editing ? String(editing.matriculaProvincial || '') : '',
      matriculaNacional: editing ? String(editing.matriculaNacional || '') : '',
      whatsapp: editing ? String(editing.whatsapp || '') : '',
      email: editing ? String(editing.email || '') : '',
      valorConsultaParticularArs: editing ? Number(editing.valorConsultaParticularArs || 0) : 25000,
      permitePresencial: editing ? editing.permitePresencial !== false : true,
      permiteVideollamada: editing ? editing.permiteVideollamada !== false : true,
      especialidadIds: editing && Array.isArray(editing.especialidadIds) ? editing.especialidadIds.slice() : [],
      obraSocialIds: editing && Array.isArray(editing.obraSocialIds) ? editing.obraSocialIds.slice() : []
    };
  }

  function syncProfDraftFromDom(bodyEl) {
    if (!STATE.profDraft || !bodyEl) return;
    var dniEl = bodyEl.querySelector('#trn-p-dni');
    if (!dniEl) return;
    STATE.profDraft.dni = dniEl.value;
    var titEl = bodyEl.querySelector('#trn-p-titulo');
    if (titEl) STATE.profDraft.titulo = titEl.value;
    var apEl = bodyEl.querySelector('#trn-p-ap');
    if (apEl) STATE.profDraft.apellidos = apEl.value;
    var nomEl = bodyEl.querySelector('#trn-p-nom');
    if (nomEl) STATE.profDraft.nombres = nomEl.value;
    var mpEl = bodyEl.querySelector('#trn-p-mp');
    if (mpEl) STATE.profDraft.matriculaProvincial = mpEl.value;
    var mnEl = bodyEl.querySelector('#trn-p-mn');
    if (mnEl) STATE.profDraft.matriculaNacional = mnEl.value;
    var waEl = bodyEl.querySelector('#trn-p-wa');
    if (waEl) STATE.profDraft.whatsapp = waEl.value;
    var emEl = bodyEl.querySelector('#trn-p-email');
    if (emEl) STATE.profDraft.email = emEl.value;
    var valEl = bodyEl.querySelector('#trn-p-val');
    if (valEl) STATE.profDraft.valorConsultaParticularArs = Number(valEl.value || 0);
    var presEl = bodyEl.querySelector('#trn-p-pres');
    if (presEl) STATE.profDraft.permitePresencial = presEl.checked;
    var vidEl = bodyEl.querySelector('#trn-p-vid');
    if (vidEl) STATE.profDraft.permiteVideollamada = vidEl.checked;
  }

  function renderProfesionalesView() {
    var profs = STATE.data.profesionales || [];
    var esps = (STATE.data.especialidades || [])
      .filter(function (e) { return e.activa; })
      .slice()
      .sort(function (a, b) {
        return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' });
      });
    var obras = (STATE.data.obrasSociales || [])
      .filter(function (o) { return o.activa; })
      .slice()
      .sort(function (a, b) {
        return String(a.sigla || a.nombre || '').localeCompare(String(b.sigla || b.nombre || ''), 'es', { sensitivity: 'base' });
      });

    var editing = STATE.editingProfId
      ? profs.find(function (p) { return p.id === STATE.editingProfId; }) || null
      : null;

    var filtered = profs.filter(function (p) {
      if (!STATE.searchProf) return true;
      var q = STATE.searchProf.toLowerCase();
      return (
        String(p.dni || '').toLowerCase().indexOf(q) !== -1 ||
        String(p.apellidos || '').toLowerCase().indexOf(q) !== -1 ||
        String(p.nombres || '').toLowerCase().indexOf(q) !== -1
      );
    });

    var rows = filtered.length === 0
      ? '<tr><td colspan="7" style="padding:1.5rem;text-align:center;color:#64748b;">Aún no hay profesionales cargados. Hacé clic en <strong>+ Nuevo Profesional</strong> para dar de alta el primero.</td></tr>'
      : filtered.map(function (p) {
          var espNames = (p.especialidadIds || []).map(function (eid) {
            var f = (STATE.data.especialidades || []).find(function (x) { return x.id === eid; });
            return f ? f.nombre : '';
          }).filter(Boolean).join(', ');
          var mpOk = p.mpAccount && p.mpAccount.linked;
          return (
            '<tr style="border-bottom:1px solid #e2ecf0;opacity:' + (p.activo ? '1' : '0.55') + ';">' +
              '<td style="padding:0.6rem;font-weight:800;">' + esc(p.dni) + '</td>' +
              '<td style="padding:0.6rem;"><strong>' + esc((p.titulo ? p.titulo + ' ' : '') + p.apellidos) + '</strong>, ' + esc(p.nombres) +
                (p.matriculaProvincial || p.matriculaNacional ? '<br><small style="color:#64748b;">MP: ' + esc(p.matriculaProvincial || '—') + ' · MN: ' + esc(p.matriculaNacional || '—') + '</small>' : '') +
              '</td>' +
              '<td style="padding:0.6rem;font-size:0.8rem;">' + esc(espNames || 'Sin asignar') + '</td>' +
              '<td style="padding:0.6rem;font-size:0.8rem;">' +
                (p.permitePresencial ? '🏥 Presencial ' : '') +
                (p.permiteVideollamada ? '📹 Video' : '') +
              '</td>' +
              '<td style="padding:0.6rem;font-size:0.8rem;">' +
                '<strong>' + fmtArs(p.valorConsultaParticularArs) + '</strong>' +
                '<br><small style="color:' + (mpOk ? '#047857' : '#b45309') + ';font-weight:700;">' +
                (mpOk ? '✅ MP Vinculado' : '⚠️ MP Sin vincular') + '</small>' +
              '</td>' +
              '<td style="padding:0.6rem;font-size:0.78rem;">' + (p.horarios ? p.horarios.length : 0) + ' franjas · ' + (p.obraSocialIds ? p.obraSocialIds.length : 0) + ' O.S.</td>' +
              '<td style="padding:0.6rem;text-align:right;white-space:nowrap;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.3rem 0.6rem;font-size:0.74rem;margin-right:0.3rem;" data-edit-prof="' + esc(p.id) + '">✏️ Editar</button>' +
                '<button type="button" class="ms-sa-btn" style="padding:0.3rem 0.6rem;font-size:0.74rem;margin-right:0.3rem;" data-goto-gest-prof="' + esc(p.id) + '">🗓️ Horarios/OS</button>' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.3rem 0.55rem;font-size:0.74rem;" data-toggle-prof="' + esc(p.id) + '">' + (p.activo ? 'Baja' : 'Activar') + '</button>' +
              '</td>' +
            '</tr>'
          );
        }).join('');

    var profModalHtml = '';
    if (STATE.profModalOpen) {
      var draft = STATE.profDraft || createProfDraft(editing);
      STATE.profDraft = draft;

      var selEspNames = (draft.especialidadIds || []).map(function (eid) {
        var f = esps.find(function (x) { return x.id === eid; });
        return f ? f.nombre : '';
      }).filter(Boolean);

      var activeOsIds = obras.map(function (o) { return o.id; });
      var selOsIds = (draft.obraSocialIds || []).filter(function (oid) {
        return activeOsIds.indexOf(oid) !== -1;
      });
      var allOsSelected = obras.length > 0 && selOsIds.length === obras.length;
      var selOsSiglas = selOsIds.map(function (oid) {
        var f = obras.find(function (x) { return x.id === oid; });
        return f ? f.sigla : '';
      }).filter(Boolean);

      var espSummaryTxt = selEspNames.length === 0
        ? '<span style="color:#64748b;">Ninguna especialidad seleccionada</span>'
        : '<strong style="color:#112D3A;">' + selEspNames.length + ' seleccionada' + (selEspNames.length === 1 ? '' : 's') + ':</strong> ' +
          '<span style="color:#334155;">' + esc(selEspNames.slice(0, 4).join(', ')) + (selEspNames.length > 4 ? ' +' + (selEspNames.length - 4) + ' más' : '') + '</span>';

      var osSummaryTxt = allOsSelected
        ? '<strong style="color:#047857;">Todas las Obras Sociales (' + obras.length + ')</strong>'
        : selOsSiglas.length === 0
          ? '<span style="color:#64748b;">Ninguna obra social seleccionada</span>'
          : '<strong style="color:#112D3A;">' + selOsSiglas.length + ' de ' + obras.length + ':</strong> ' +
            '<span style="color:#334155;">' + esc(selOsSiglas.slice(0, 5).join(', ')) + (selOsSiglas.length > 5 ? ' +' + (selOsSiglas.length - 5) + ' más' : '') + '</span>';

      profModalHtml =
        '<div id="trn-prof-modal-backdrop" role="dialog" aria-modal="true" style="position:fixed;inset:0;z-index:9999;background:rgba(17,45,58,0.68);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto;">' +
          '<div style="width:100%;max-width:780px;max-height:92vh;display:flex;flex-direction:column;background:#ffffff;border-radius:18px;border:2px solid #56D7A1;box-shadow:0 24px 60px rgba(0,0,0,0.32);overflow:hidden;">' +
            '<div style="background:#112D3A;color:#ffffff;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-shrink:0;">' +
              '<div>' +
                '<div style="font-size:0.7rem;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;color:#56D7A1;">Turnero Web · ABM Profesionales</div>' +
                '<h3 style="margin:0.15rem 0 0;font-size:1.1rem;color:#ffffff;">' + (editing ? '✏️ Editar Profesional' : '➕ Alta de Nuevo Profesional') + '</h3>' +
              '</div>' +
              '<button type="button" id="trn-p-modal-close" aria-label="Cerrar" style="background:rgba(255,255,255,0.12);border:none;color:#ffffff;width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:1rem;font-weight:900;">✕</button>' +
            '</div>' +
            '<form id="ms-trn-prof-form" style="padding:1.25rem;display:grid;gap:0.9rem;overflow-y:auto;">' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:0.7rem;">' +
                '<div><label class="ms-sa-label">DNI Profesional *</label><input class="ms-sa-input" id="trn-p-dni" required value="' + esc(draft.dni) + '" placeholder="Ej: 30123456"></div>' +
                '<div><label class="ms-sa-label">Título</label><select class="ms-sa-select" id="trn-p-titulo">' +
                  ['Dr.', 'Dra.', 'Lic.', 'Klgo./a', 'Od.', 'Prof.', 'Mg.'].map(function (t) {
                    return '<option value="' + t + '" ' + (draft.titulo === t ? 'selected' : '') + '>' + t + '</option>';
                  }).join('') +
                '</select></div>' +
                '<div><label class="ms-sa-label">Apellido/s *</label><input class="ms-sa-input" id="trn-p-ap" required value="' + esc(draft.apellidos) + '" placeholder="Ej: Pérez"></div>' +
                '<div><label class="ms-sa-label">Nombre/s *</label><input class="ms-sa-input" id="trn-p-nom" required value="' + esc(draft.nombres) + '" placeholder="Ej: Juan Carlos"></div>' +
                '<div><label class="ms-sa-label">Matrícula Provincial</label><input class="ms-sa-input" id="trn-p-mp" value="' + esc(draft.matriculaProvincial) + '" placeholder="Ej: 28450"></div>' +
                '<div><label class="ms-sa-label">Matrícula Nacional</label><input class="ms-sa-input" id="trn-p-mn" value="' + esc(draft.matriculaNacional) + '" placeholder="Opcional"></div>' +
                '<div><label class="ms-sa-label">WhatsApp</label><input class="ms-sa-input" id="trn-p-wa" value="' + esc(draft.whatsapp) + '" placeholder="3585095475"></div>' +
                '<div><label class="ms-sa-label">Email</label><input class="ms-sa-input" type="email" id="trn-p-email" value="' + esc(draft.email) + '" placeholder="dr@clinica.com"></div>' +
                '<div><label class="ms-sa-label">Valor Consulta Particular</label><input class="ms-sa-input" type="number" min="0" id="trn-p-val" value="' + esc(draft.valorConsultaParticularArs) + '"></div>' +
              '</div>' +

              '<div style="display:flex;flex-wrap:wrap;gap:1.25rem;padding:0.65rem 0.9rem;border-radius:10px;background:#f8fbfc;border:1px solid #dbe7ec;font-size:0.84rem;font-weight:700;">' +
                '<label style="cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="trn-p-pres" ' + (draft.permitePresencial ? 'checked' : '') + '> 🏥 Atiende Presencial</label>' +
                '<label style="cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;"><input type="checkbox" id="trn-p-vid" ' + (draft.permiteVideollamada ? 'checked' : '') + '> 📹 Atiende Videollamada</label>' +
              '</div>' +

              '<div style="display:grid;gap:0.65rem;">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.65rem;padding:0.75rem 0.9rem;border-radius:12px;border:1px solid #dbe7ec;background:#f8fbfc;">' +
                  '<div style="flex:1;min-width:220px;">' +
                    '<div style="font-size:0.78rem;font-weight:800;color:#112D3A;margin-bottom:0.2rem;">Especialidades que atiende el profesional</div>' +
                    '<div style="font-size:0.8rem;">' + espSummaryTxt + '</div>' +
                  '</div>' +
                  '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-p-open-esp-picker" style="padding:0.42rem 0.85rem;font-size:0.8rem;white-space:nowrap;">📋 Elegir Especialidades (' + selEspNames.length + ')</button>' +
                '</div>' +

                '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.65rem;padding:0.75rem 0.9rem;border-radius:12px;border:1px solid #dbe7ec;background:#f8fbfc;">' +
                  '<div style="flex:1;min-width:220px;">' +
                    '<div style="font-size:0.78rem;font-weight:800;color:#112D3A;margin-bottom:0.2rem;">Obras Sociales que atiende</div>' +
                    '<div style="font-size:0.8rem;">' + osSummaryTxt + '</div>' +
                  '</div>' +
                  '<div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">' +
                    '<label style="cursor:pointer;display:inline-flex;align-items:center;gap:0.35rem;font-size:0.8rem;font-weight:800;color:#112D3A;padding:0.38rem 0.65rem;border-radius:8px;border:1px solid ' + (allOsSelected ? '#56D7A1' : '#cbd5e1') + ';background:' + (allOsSelected ? '#dcfce7' : '#ffffff') + ';">' +
                      '<input type="checkbox" id="trn-p-os-all-quick" ' + (allOsSelected ? 'checked' : '') + '> Todas' +
                    '</label>' +
                    '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-p-open-os-picker" style="padding:0.42rem 0.85rem;font-size:0.8rem;white-space:nowrap;">🏥 Elegir Obras Sociales (' + selOsIds.length + ')</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +

              '<div style="display:flex;justify-content:flex-end;gap:0.55rem;padding-top:0.35rem;border-top:1px solid #e2ecf0;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-p-cancel">Cancelar</button>' +
                '<button type="submit" class="ms-sa-btn">💾 ' + (editing ? 'Guardar Cambios' : 'Dar de Alta Profesional') + '</button>' +
              '</div>' +
            '</form>' +
          '</div>' +
        '</div>';
    }

    var espPickerHtml = '';
    if (STATE.profModalOpen && STATE.profEspPickerOpen) {
      var draftEsp = STATE.profDraft || createProfDraft(editing);
      var selEspSet = {};
      (draftEsp.especialidadIds || []).forEach(function (id) { selEspSet[id] = true; });
      var espListItems = esps.length === 0
        ? '<div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.84rem;">No hay especialidades activas cargadas.</div>'
        : esps.map(function (e) {
            var checked = Boolean(selEspSet[e.id]);
            return (
              '<label class="trn-esp-list-row" data-search="' + esc(String(e.nombre || '').toLowerCase()) + '" style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.65rem 0.85rem;border-bottom:1px solid #e2ecf0;cursor:pointer;background:' + (checked ? '#ecfdf5' : '#ffffff') + ';">' +
                '<span style="display:inline-flex;align-items:center;gap:0.6rem;font-size:0.86rem;font-weight:700;color:#112D3A;">' +
                  '<input type="checkbox" class="trn-prof-esp-chk" value="' + esc(e.id) + '" ' + (checked ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:#112D3A;">' +
                  esc(e.nombre) +
                '</span>' +
                '<span style="font-size:0.76rem;font-weight:700;color:#475569;white-space:nowrap;">' + esc(e.duracionMinutos) + ' min</span>' +
              '</label>'
            );
          }).join('');

      espPickerHtml =
        '<div id="trn-prof-esp-picker-backdrop" role="dialog" aria-modal="true" style="position:fixed;inset:0;z-index:10010;background:rgba(17,45,58,0.65);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:1rem;">' +
          '<div style="width:100%;max-width:520px;max-height:85vh;display:flex;flex-direction:column;background:#ffffff;border-radius:16px;border:2px solid #56D7A1;box-shadow:0 24px 60px rgba(0,0,0,0.38);overflow:hidden;">' +
            '<div style="background:#112D3A;color:#ffffff;padding:0.9rem 1.15rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-shrink:0;">' +
              '<div>' +
                '<div style="font-size:0.68rem;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;color:#56D7A1;">Selección en Lista</div>' +
                '<h3 style="margin:0.1rem 0 0;font-size:1rem;color:#ffffff;">Especialidades del Profesional</h3>' +
              '</div>' +
              '<button type="button" id="trn-esp-picker-close" aria-label="Cerrar" style="background:rgba(255,255,255,0.12);border:none;color:#ffffff;width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:0.95rem;font-weight:900;">✕</button>' +
            '</div>' +
            '<div style="padding:0.75rem 1rem;border-bottom:1px solid #e2ecf0;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;background:#f8fbfc;flex-shrink:0;">' +
              '<input class="ms-sa-input" id="trn-esp-picker-search" placeholder="Buscar especialidad..." style="flex:1;min-width:180px;">' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-esp-picker-all" style="padding:0.35rem 0.65rem;font-size:0.76rem;">Todas</button>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-esp-picker-none" style="padding:0.35rem 0.65rem;font-size:0.76rem;">Limpiar</button>' +
            '</div>' +
            '<div id="trn-esp-picker-list" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;">' +
              espListItems +
            '</div>' +
            '<div style="padding:0.8rem 1rem;border-top:1px solid #e2ecf0;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;background:#ffffff;flex-shrink:0;">' +
              '<span id="trn-esp-picker-count" style="font-size:0.8rem;font-weight:800;color:#475569;">' + (draftEsp.especialidadIds || []).length + ' seleccionadas</span>' +
              '<button type="button" class="ms-sa-btn" id="trn-esp-picker-done" style="padding:0.45rem 1rem;font-size:0.82rem;">✅ Listo</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    var osPickerHtml = '';
    if (STATE.profModalOpen && STATE.profOsPickerOpen) {
      var draftOs = STATE.profDraft || createProfDraft(editing);
      var selOsSet = {};
      (draftOs.obraSocialIds || []).forEach(function (id) { selOsSet[id] = true; });
      var allSelectedNow = obras.length > 0 && obras.every(function (o) { return Boolean(selOsSet[o.id]); });

      var osListItems = obras.length === 0
        ? '<div style="padding:1.25rem;text-align:center;color:#64748b;font-size:0.84rem;">No hay obras sociales activas cargadas.</div>'
        : obras.map(function (o) {
            var checked = Boolean(selOsSet[o.id]);
            var searchKey = (String(o.sigla || '') + ' ' + String(o.nombre || '') + ' ' + String(o.codigoRnos || '')).toLowerCase();
            return (
              '<label class="trn-os-list-row" data-search="' + esc(searchKey) + '" style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.65rem 0.85rem;border-bottom:1px solid #e2ecf0;cursor:pointer;background:' + (checked ? '#ecfdf5' : '#ffffff') + ';">' +
                '<span style="display:inline-flex;align-items:center;gap:0.6rem;min-width:0;">' +
                  '<input type="checkbox" class="trn-prof-os-chk" value="' + esc(o.id) + '" ' + (checked ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:#112D3A;flex-shrink:0;">' +
                  '<span style="display:flex;flex-direction:column;min-width:0;">' +
                    '<strong style="font-size:0.86rem;color:#112D3A;">' + esc(o.sigla) + '</strong>' +
                    '<small style="font-size:0.74rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(o.nombre) + '</small>' +
                  '</span>' +
                '</span>' +
                '<span style="font-size:0.72rem;font-weight:700;color:#475569;white-space:nowrap;">' + esc(o.tipo || '') + '</span>' +
              '</label>'
            );
          }).join('');

      osPickerHtml =
        '<div id="trn-prof-os-picker-backdrop" role="dialog" aria-modal="true" style="position:fixed;inset:0;z-index:10010;background:rgba(17,45,58,0.65);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:1rem;">' +
          '<div style="width:100%;max-width:560px;max-height:85vh;display:flex;flex-direction:column;background:#ffffff;border-radius:16px;border:2px solid #56D7A1;box-shadow:0 24px 60px rgba(0,0,0,0.38);overflow:hidden;">' +
            '<div style="background:#112D3A;color:#ffffff;padding:0.9rem 1.15rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-shrink:0;">' +
              '<div>' +
                '<div style="font-size:0.68rem;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;color:#56D7A1;">Selección en Lista</div>' +
                '<h3 style="margin:0.1rem 0 0;font-size:1rem;color:#ffffff;">Obras Sociales que Atiende</h3>' +
              '</div>' +
              '<button type="button" id="trn-os-picker-close" aria-label="Cerrar" style="background:rgba(255,255,255,0.12);border:none;color:#ffffff;width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:0.95rem;font-weight:900;">✕</button>' +
            '</div>' +
            '<div style="padding:0.75rem 1rem;border-bottom:1px solid #e2ecf0;display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;background:#f8fbfc;flex-shrink:0;">' +
              '<label style="cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;font-size:0.82rem;font-weight:800;color:#112D3A;padding:0.4rem 0.7rem;border-radius:8px;border:1px solid #56D7A1;background:' + (allSelectedNow ? '#dcfce7' : '#ffffff') + ';white-space:nowrap;">' +
                '<input type="checkbox" id="trn-os-picker-all-chk" ' + (allSelectedNow ? 'checked' : '') + ' style="width:16px;height:16px;accent-color:#112D3A;"> Todas (' + obras.length + ')' +
              '</label>' +
              '<input class="ms-sa-input" id="trn-os-picker-search" placeholder="Buscar obra social..." style="flex:1;min-width:180px;">' +
            '</div>' +
            '<div id="trn-os-picker-list" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;">' +
              osListItems +
            '</div>' +
            '<div style="padding:0.8rem 1rem;border-top:1px solid #e2ecf0;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;background:#ffffff;flex-shrink:0;">' +
              '<span id="trn-os-picker-count" style="font-size:0.8rem;font-weight:800;color:#475569;">' + (draftOs.obraSocialIds || []).length + ' de ' + obras.length + ' seleccionadas</span>' +
              '<button type="button" class="ms-sa-btn" id="trn-os-picker-done" style="padding:0.45rem 1rem;font-size:0.82rem;">✅ Listo</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.85rem;">' +
            '<h4 style="margin:0;">👨‍⚕️ Padrón de Profesionales (' + filtered.length + ')</h4>' +
            '<div style="display:flex;align-items:center;gap:0.55rem;flex-wrap:wrap;">' +
              '<input class="ms-sa-input" id="trn-p-search" style="max-width:260px;" value="' + esc(STATE.searchProf) + '" placeholder="Buscar por DNI, Apellido o Nombre...">' +
              '<button type="button" class="ms-sa-btn" id="trn-p-open-new" style="white-space:nowrap;">➕ Nuevo Profesional</button>' +
            '</div>' +
          '</div>' +
          '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;font-size:0.78rem;">' +
              '<th style="padding:0.5rem;">DNI</th><th style="padding:0.5rem;">Apellido y Nombre</th><th style="padding:0.5rem;">Especialidades</th>' +
              '<th style="padding:0.5rem;">Modalidad</th><th style="padding:0.5rem;">Particular / MP</th><th style="padding:0.5rem;">Config.</th><th style="padding:0.5rem;text-align:right;">Acciones</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>' +
      '</div>' +
      profModalHtml +
      espPickerHtml +
      osPickerHtml
    );
  }

  // ==================== 2. ABM OBRAS SOCIALES ====================
  function renderObrasSocialesView() {
    var list = STATE.data.obrasSociales || [];
    var editing = STATE.editingOsId
      ? list.find(function (o) { return o.id === STATE.editingOsId; }) || null
      : null;

    var filtered = list.filter(function (o) {
      if (STATE.filterOsTipo && o.tipo !== STATE.filterOsTipo) return false;
      if (STATE.searchOs) {
        var q = STATE.searchOs.toLowerCase();
        var hay = (o.sigla + ' ' + o.nombre + ' ' + (o.codigoRnos || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var tipoLabel = {
      CCT: 'Convenio Colectivo (Sindical)',
      PREPAGA: 'Prepaga',
      ESTATAL_PROVINCIAL: 'Provincial / Estatal',
      PAMI: 'PAMI / Jubilados'
    };

    var rows = filtered.map(function (o) {
      var planCount = (STATE.data.planes || []).filter(function (p) { return p.obraSocialId === o.id && p.activo; }).length;
      return (
        '<tr style="border-bottom:1px solid #e2ecf0;opacity:' + (o.activa ? '1' : '0.5') + ';">' +
          '<td style="padding:0.55rem;font-family:monospace;font-size:0.78rem;">' + esc(o.codigoRnos || '—') + '</td>' +
          '<td style="padding:0.55rem;"><strong>' + esc(o.sigla) + '</strong><br><small style="color:#64748b;">' + esc(o.nombre) + '</small></td>' +
          '<td style="padding:0.55rem;font-size:0.78rem;"><span style="background:#f1f5f9;padding:0.2rem 0.5rem;border-radius:999px;font-weight:700;">' + esc(tipoLabel[o.tipo] || o.tipo) + '</span></td>' +
          '<td style="padding:0.55rem;font-size:0.8rem;">' + planCount + ' planes</td>' +
          '<td style="padding:0.55rem;font-size:0.78rem;font-weight:800;color:' + (o.activa ? '#047857' : '#b91c1c') + ';">' + (o.activa ? 'ACTIVA' : 'INACTIVA') + '</td>' +
          '<td style="padding:0.55rem;text-align:right;white-space:nowrap;">' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.55rem;font-size:0.74rem;margin-right:0.25rem;" data-edit-os="' + esc(o.id) + '">✏️</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.55rem;font-size:0.74rem;margin-right:0.25rem;" data-goto-planes-os="' + esc(o.id) + '">Planes</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.55rem;font-size:0.74rem;" data-toggle-os="' + esc(o.id) + '">' + (o.activa ? 'Desactivar' : 'Activar') + '</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.7rem;">' +
            '<h4 style="margin:0;">' + (editing ? '✏️ Editar Obra Social / Prepaga' : '➕ Alta de Obra Social (CCT / Prepaga / Estatal)') + '</h4>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-import-sssalud-btn" style="font-size:0.78rem;padding:0.35rem 0.75rem;">🔄 Sincronizar Catálogo SSSalud / Prepagas</button>' +
          '</div>' +
          '<form id="ms-trn-os-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.65rem;align-items:end;">' +
            '<div><label class="ms-sa-label">Sigla / Nombre Corto *</label><input class="ms-sa-input" id="trn-os-sigla" required value="' + esc(editing ? editing.sigla : '') + '" placeholder="Ej: OSDE, OSECAC, APROSS"></div>' +
            '<div><label class="ms-sa-label">Razón Social / Nombre Completo</label><input class="ms-sa-input" id="trn-os-nombre" value="' + esc(editing ? editing.nombre : '') + '" placeholder="Nombre completo oficial"></div>' +
            '<div><label class="ms-sa-label">Tipo *</label><select class="ms-sa-select" id="trn-os-tipo">' +
              '<option value="PREPAGA" ' + (editing && editing.tipo === 'PREPAGA' ? 'selected' : '') + '>Prepaga</option>' +
              '<option value="CCT" ' + (editing && editing.tipo === 'CCT' ? 'selected' : '') + '>Convenio Colectivo de Trabajo (Sindical)</option>' +
              '<option value="ESTATAL_PROVINCIAL" ' + (editing && editing.tipo === 'ESTATAL_PROVINCIAL' ? 'selected' : '') + '>Provincial / Estatal</option>' +
              '<option value="PAMI" ' + (editing && editing.tipo === 'PAMI' ? 'selected' : '') + '>PAMI / Jubilados</option>' +
            '</select></div>' +
            '<div><label class="ms-sa-label">Código RNOS (SSSalud)</label><input class="ms-sa-input" id="trn-os-rnos" value="' + esc(editing ? editing.codigoRnos : '') + '" placeholder="Ej: 126205"></div>' +
            '<div><label class="ms-sa-label">Sitio Web</label><input class="ms-sa-input" id="trn-os-web" value="' + esc(editing ? editing.web : '') + '" placeholder="https://..."></div>' +
            '<div style="display:flex;gap:0.4rem;">' +
              '<button type="submit" class="ms-sa-btn">💾 Guardar</button>' +
              (editing ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-os-cancel">Cancelar</button>' : '') +
            '</div>' +
          '</form>' +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<div style="display:flex;gap:0.6rem;flex-wrap:wrap;margin-bottom:0.8rem;align-items:center;justify-content:space-between;">' +
            '<h4 style="margin:0;">🛡️ Listado de Obras Sociales y Prepagas (' + filtered.length + ')</h4>' +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
              '<select class="ms-sa-select" id="trn-os-filter-tipo" style="width:auto;">' +
                '<option value="">Todos los tipos</option>' +
                '<option value="PREPAGA" ' + (STATE.filterOsTipo === 'PREPAGA' ? 'selected' : '') + '>Prepagas</option>' +
                '<option value="CCT" ' + (STATE.filterOsTipo === 'CCT' ? 'selected' : '') + '>Convenio Colectivo (CCT)</option>' +
                '<option value="ESTATAL_PROVINCIAL" ' + (STATE.filterOsTipo === 'ESTATAL_PROVINCIAL' ? 'selected' : '') + '>Provinciales / Estatales</option>' +
                '<option value="PAMI" ' + (STATE.filterOsTipo === 'PAMI' ? 'selected' : '') + '>PAMI</option>' +
              '</select>' +
              '<input class="ms-sa-input" id="trn-os-search" style="width:220px;" value="' + esc(STATE.searchOs) + '" placeholder="Buscar OSDE, Sancor, OSECAC...">' +
            '</div>' +
          '</div>' +
          '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;font-size:0.78rem;">' +
              '<th style="padding:0.5rem;">RNOS</th><th style="padding:0.5rem;">Obra Social / Prepaga</th><th style="padding:0.5rem;">Tipo</th>' +
              '<th style="padding:0.5rem;">Planes</th><th style="padding:0.5rem;">Estado</th><th style="padding:0.5rem;text-align:right;">Acciones</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>' +
      '</div>'
    );
  }

  // ==================== 3. ABM PLANES ====================
  function renderPlanesView() {
    var activeObras = (STATE.data.obrasSociales || []).filter(function (o) { return o.activa; });
    if (!STATE.selectedPlanOsId && activeObras.length > 0) {
      STATE.selectedPlanOsId = activeObras[0].id;
    }
    var planesList = (STATE.data.planes || []).filter(function (p) {
      return !STATE.selectedPlanOsId || p.obraSocialId === STATE.selectedPlanOsId;
    });
    var editing = STATE.editingPlanId
      ? (STATE.data.planes || []).find(function (p) { return p.id === STATE.editingPlanId; }) || null
      : null;

    var osOptions = activeObras.map(function (o) {
      return '<option value="' + esc(o.id) + '" ' + (STATE.selectedPlanOsId === o.id ? 'selected' : '') + '>' + esc(o.sigla) + ' — ' + esc(o.tipo) + '</option>';
    }).join('');

    var rows = planesList.length === 0
      ? '<tr><td colspan="6" style="padding:1.5rem;text-align:center;color:#64748b;">Esta Obra Social aún no tiene planes cargados.</td></tr>'
      : planesList.map(function (pl) {
          var os = activeObras.find(function (o) { return o.id === pl.obraSocialId; });
          return (
            '<tr style="border-bottom:1px solid #e2ecf0;opacity:' + (pl.activo ? '1' : '0.5') + ';">' +
              '<td style="padding:0.55rem;font-weight:700;">' + esc(os ? os.sigla : pl.obraSocialId) + '</td>' +
              '<td style="padding:0.55rem;"><strong>' + esc(pl.nombre) + '</strong></td>' +
              '<td style="padding:0.55rem;font-family:monospace;font-size:0.78rem;">' + esc(pl.codigo || '—') + '</td>' +
              '<td style="padding:0.55rem;font-size:0.8rem;">' + (pl.requiereAutorizacion ? '⚠️ Sí requiere' : 'No') + '</td>' +
              '<td style="padding:0.55rem;font-size:0.8rem;">' + (pl.copagoSugeridoArs ? fmtArs(pl.copagoSugeridoArs) : '$ 0') + '</td>' +
              '<td style="padding:0.55rem;text-align:right;white-space:nowrap;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.55rem;font-size:0.74rem;margin-right:0.25rem;" data-edit-plan="' + esc(pl.id) + '">✏️</button>' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.55rem;font-size:0.74rem;" data-toggle-plan="' + esc(pl.id) + '">' + (pl.activo ? 'Desactivar' : 'Activar') + '</button>' +
              '</td>' +
            '</tr>'
          );
        }).join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">💳 Seleccioná una Obra Social dada de ALTA para ver o agregar sus Planes</h4>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0.75rem;margin-bottom:1rem;">' +
            '<div><label class="ms-sa-label">Obra Social / Prepaga Activa</label><select class="ms-sa-select" id="trn-plan-os-filter">' + osOptions + '</select></div>' +
          '</div>' +
          '<form id="ms-trn-plan-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.65rem;align-items:end;padding-top:0.75rem;border-top:1px solid #e2ecf0;">' +
            '<div><label class="ms-sa-label">Nombre del Plan *</label><input class="ms-sa-input" id="trn-pl-nombre" required value="' + esc(editing ? editing.nombre : '') + '" placeholder="Ej: Plan 210, 3000, PMO"></div>' +
            '<div><label class="ms-sa-label">Código</label><input class="ms-sa-input" id="trn-pl-cod" value="' + esc(editing ? editing.codigo : '') + '" placeholder="Ej: 210"></div>' +
            '<div><label class="ms-sa-label">Copago Estimado (ARS)</label><input class="ms-sa-input" type="number" min="0" id="trn-pl-copago" value="' + esc(editing ? editing.copagoSugeridoArs || 0 : 0) + '"></div>' +
            '<div style="padding-bottom:0.4rem;"><label style="font-size:0.8rem;font-weight:700;"><input type="checkbox" id="trn-pl-aut" ' + (editing && editing.requiereAutorizacion ? 'checked' : '') + '> Requiere autorización</label></div>' +
            '<div style="display:flex;gap:0.4rem;">' +
              '<button type="submit" class="ms-sa-btn">💾 ' + (editing ? 'Actualizar' : 'Agregar Plan') + '</button>' +
              (editing ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-pl-cancel">Cancelar</button>' : '') +
            '</div>' +
          '</form>' +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">Planes registrados (' + planesList.length + ')</h4>' +
          '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;font-size:0.78rem;">' +
              '<th style="padding:0.5rem;">Obra Social</th><th style="padding:0.5rem;">Plan</th><th style="padding:0.5rem;">Código</th>' +
              '<th style="padding:0.5rem;">Autorización</th><th style="padding:0.5rem;">Copago</th><th style="padding:0.5rem;text-align:right;">Acciones</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>' +
      '</div>'
    );
  }

  // ==================== 4. ABM ESPECIALIDADES ====================
  var DEFAULT_ESP_CATEGORIAS = [
    'Clínica y Especialidades Médicas',
    'Quirúrgicas y Traumatología',
    'Salud Mental y Neurociencias',
    'Materno-Infantil y Mujer',
    'Diagnóstico y Laboratorio',
    'Rehabilitación y Bienestar',
    'Odontología',
    'Enfermería y Trámites'
  ];

  function inferEspCategoriaJs(nombre) {
    var n = String(nombre || '').toLowerCase();
    if (/(psicol|psiquiat|psicopedag|terapia ocupacional|fonoaudiol|neurolog)/.test(n)) return 'Salud Mental y Neurociencias';
    if (/(cirug|traumatolog|ortoped|neurocirug|proctolog|urolog|flebolog)/.test(n)) return 'Quirúrgicas y Traumatología';
    if (/(pediatr|ginecolog|obstetric|mastolog)/.test(n)) return 'Materno-Infantil y Mujer';
    if (/(ecograf|imágen|imagen|laboratorio)/.test(n)) return 'Diagnóstico y Laboratorio';
    if (/(kinesiol|fisioterap|nutrici|deporte)/.test(n)) return 'Rehabilitación y Bienestar';
    if (/(odontolog|ortodoncia)/.test(n)) return 'Odontología';
    if (/(enfermer|vacunat|receta|certificado)/.test(n)) return 'Enfermería y Trámites';
    return 'Clínica y Especialidades Médicas';
  }

  function renderEspecialidadesView() {
    var rawList = (STATE.data.especialidades || []).map(function (e) {
      return Object.assign({}, e, {
        categoria: String(e.categoria || '').trim() || inferEspCategoriaJs(e.nombre)
      });
    });

    // Orden alfabético A-Z estricto en español
    rawList.sort(function (a, b) {
      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' });
    });

    var catSet = {};
    DEFAULT_ESP_CATEGORIAS.forEach(function (c) { catSet[c] = true; });
    rawList.forEach(function (e) { if (e.categoria) catSet[e.categoria] = true; });
    var allCats = Object.keys(catSet).sort(function (a, b) {
      return a.localeCompare(b, 'es', { sensitivity: 'base' });
    });

    var editing = STATE.editingEspId
      ? rawList.find(function (e) { return e.id === STATE.editingEspId; }) || null
      : null;

    var filtered = rawList.filter(function (e) {
      if (STATE.filterEspCat && e.categoria !== STATE.filterEspCat) return false;
      if (STATE.searchEsp) {
        var q = STATE.searchEsp.toLowerCase();
        var hay = (String(e.nombre || '') + ' ' + String(e.categoria || '') + ' ' + String(e.descripcion || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var pageSize = 10;
    var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    var currentPage = Math.min(Math.max(1, Number(STATE.espPage || 1)), totalPages);
    STATE.espPage = currentPage;
    var startIdx = (currentPage - 1) * pageSize;
    var pageItems = filtered.slice(startIdx, startIdx + pageSize);

    var durOpts = DURACIONES.map(function (d) {
      var sel = editing ? Number(editing.duracionMinutos) === d : d === 20;
      return '<option value="' + d + '" ' + (sel ? 'selected' : '') + '>' + d + ' minutos</option>';
    }).join('');

    var rows = pageItems.length === 0
      ? '<tr><td colspan="6" style="padding:1.5rem;text-align:center;color:#64748b;">No se encontraron especialidades para ese criterio.</td></tr>'
      : pageItems.map(function (e) {
          return (
            '<tr style="border-bottom:1px solid #e2ecf0;opacity:' + (e.activa ? '1' : '0.5') + ';">' +
              '<td style="padding:0.65rem 0.55rem;"><strong>' + esc(e.nombre) + '</strong>' +
                (e.descripcion ? '<br><small style="color:#64748b;">' + esc(e.descripcion) + '</small>' : '') +
              '</td>' +
              '<td style="padding:0.65rem 0.55rem;">' +
                '<span style="display:inline-block;background:#f1f5f9;color:#112D3A;border:1px solid #cbd5e1;padding:0.2rem 0.55rem;border-radius:999px;font-weight:700;font-size:0.75rem;">' + esc(e.categoria) + '</span>' +
              '</td>' +
              '<td style="padding:0.65rem 0.55rem;"><span style="background:#dcfce7;color:#065f46;padding:0.22rem 0.6rem;border-radius:999px;font-weight:900;font-size:0.78rem;">⏱ ' + esc(e.duracionMinutos) + ' min</span></td>' +
              '<td style="padding:0.65rem 0.55rem;font-size:0.8rem;">' + (e.permiteVideollamada ? '📹 Sí' : 'Solo Presencial') + '</td>' +
              '<td style="padding:0.65rem 0.55rem;font-size:0.82rem;font-weight:700;">' + fmtArs(e.valorConsultaParticularSugeridoArs) + '</td>' +
              '<td style="padding:0.65rem 0.55rem;text-align:right;white-space:nowrap;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" title="Editar especialidad y categoría" style="padding:0.3rem 0.6rem;font-size:0.76rem;margin-right:0.3rem;" data-edit-esp="' + esc(e.id) + '">✏️</button>' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.3rem 0.6rem;font-size:0.75rem;" data-toggle-esp="' + esc(e.id) + '">' + (e.activa ? 'Desactivar' : 'Activar') + '</button>' +
              '</td>' +
            '</tr>'
          );
        }).join('');

    var pageBtns = '';
    for (var p = 1; p <= totalPages; p++) {
      var isCurr = p === currentPage;
      pageBtns +=
        '<button type="button" data-esp-page="' + p + '" style="min-width:34px;height:34px;padding:0 0.55rem;border-radius:8px;font-weight:800;font-size:0.8rem;cursor:pointer;border:1px solid ' +
        (isCurr ? '#112D3A' : '#cbd5e1') +
        ';background:' +
        (isCurr ? '#112D3A' : '#ffffff') +
        ';color:' +
        (isCurr ? '#56D7A1' : '#112D3A') +
        ';">' + p + '</button>';
    }

    var paginationHtml =
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-top:0.9rem;padding-top:0.75rem;border-top:1px solid #e2ecf0;">' +
        '<span style="font-size:0.8rem;color:#475569;font-weight:700;">' +
          (filtered.length > 0
            ? 'Mostrando <strong>' + (startIdx + 1) + '–' + Math.min(startIdx + pageSize, filtered.length) + '</strong> de <strong>' + filtered.length + '</strong> especialidades (Orden A–Z · de 10 en 10)'
            : '0 resultados') +
        '</span>' +
        '<div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">' +
          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-esp-page="' + Math.max(1, currentPage - 1) + '" ' + (currentPage <= 1 ? 'disabled style="opacity:0.45;padding:0.32rem 0.65rem;font-size:0.76rem;"' : 'style="padding:0.32rem 0.65rem;font-size:0.76rem;"') + '>« Anterior</button>' +
          pageBtns +
          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-esp-page="' + Math.min(totalPages, currentPage + 1) + '" ' + (currentPage >= totalPages ? 'disabled style="opacity:0.45;padding:0.32rem 0.65rem;font-size:0.76rem;"' : 'style="padding:0.32rem 0.65rem;font-size:0.76rem;"') + '>Siguiente »</button>' +
        '</div>' +
      '</div>';

    var modalHtml = '';
    if (STATE.espModalOpen) {
      var edCat = editing ? editing.categoria : DEFAULT_ESP_CATEGORIAS[0];
      var catOptionsDatalist = allCats.map(function (c) {
        return '<option value="' + esc(c) + '"></option>';
      }).join('');
      var catQuickSelectOpts =
        '<option value="">— Elegir categoría sugerida —</option>' +
        allCats.map(function (c) {
          return '<option value="' + esc(c) + '" ' + (edCat === c ? 'selected' : '') + '>' + esc(c) + '</option>';
        }).join('');

      modalHtml =
        '<div id="trn-esp-modal-backdrop" role="dialog" aria-modal="true" style="position:fixed;inset:0;z-index:9999;background:rgba(17,45,58,0.68);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto;">' +
          '<div style="width:100%;max-width:620px;background:#ffffff;border-radius:18px;border:2px solid #56D7A1;box-shadow:0 24px 60px rgba(0,0,0,0.32);overflow:hidden;">' +
            '<div style="background:#112D3A;color:#ffffff;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">' +
              '<div>' +
                '<div style="font-size:0.7rem;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;color:#56D7A1;">Turnero Web · ABM Especialidades</div>' +
                '<h3 style="margin:0.15rem 0 0;font-size:1.1rem;color:#ffffff;">' + (editing ? '✏️ Editar Especialidad y Categoría' : '➕ Nueva Especialidad Médica') + '</h3>' +
              '</div>' +
              '<button type="button" id="trn-e-modal-close" style="background:rgba(255,255,255,0.12);border:none;color:#ffffff;width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:1rem;font-weight:900;">✕</button>' +
            '</div>' +
            '<form id="ms-trn-esp-form" style="padding:1.25rem;display:grid;gap:0.85rem;">' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0.75rem;">' +
                '<div>' +
                  '<label class="ms-sa-label">Especialidad *</label>' +
                  '<input class="ms-sa-input" id="trn-e-nombre" required value="' + esc(editing ? editing.nombre : '') + '" placeholder="Ej: Cardiología, Psicología">' +
                '</div>' +
                '<div>' +
                  '<label class="ms-sa-label">Categoría * (Editable)</label>' +
                  '<input class="ms-sa-input" id="trn-e-cat" list="trn-e-cats-dl" required value="' + esc(edCat) + '" placeholder="Escribí o elegí la categoría">' +
                  '<datalist id="trn-e-cats-dl">' + catOptionsDatalist + '</datalist>' +
                  '<select class="ms-sa-select" id="trn-e-cat-pick" style="margin-top:0.35rem;font-size:0.76rem;padding:0.3rem 0.5rem;">' + catQuickSelectOpts + '</select>' +
                '</div>' +
                '<div>' +
                  '<label class="ms-sa-label">Duración de Turno (5 a 60 min) *</label>' +
                  '<select class="ms-sa-select" id="trn-e-dur">' + durOpts + '</select>' +
                '</div>' +
                '<div>' +
                  '<label class="ms-sa-label">Valor Particular Sugerido (ARS)</label>' +
                  '<input class="ms-sa-input" type="number" min="0" id="trn-e-val" value="' + esc(editing ? editing.valorConsultaParticularSugeridoArs : 25000) + '">' +
                '</div>' +
                '<div style="grid-column:1 / -1;">' +
                  '<label class="ms-sa-label">Descripción breve</label>' +
                  '<input class="ms-sa-input" id="trn-e-desc" value="' + esc(editing ? editing.descripcion : '') + '" placeholder="Atención médica, estudios o alcance de la especialidad">' +
                '</div>' +
              '</div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:1.25rem;padding:0.65rem 0.85rem;border-radius:10px;background:#f8fbfc;border:1px solid #dbe7ec;font-size:0.84rem;font-weight:700;">' +
                '<label style="cursor:pointer;"><input type="checkbox" id="trn-e-vid" ' + (!editing || editing.permiteVideollamada ? 'checked' : '') + '> 📹 Permite Videollamada</label>' +
                '<label style="cursor:pointer;"><input type="checkbox" id="trn-e-act" ' + (!editing || editing.activa !== false ? 'checked' : '') + '> ✅ Especialidad Activa</label>' +
              '</div>' +
              '<div style="display:flex;justify-content:flex-end;gap:0.55rem;padding-top:0.35rem;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-e-cancel">Cancelar</button>' +
                '<button type="submit" class="ms-sa-btn">💾 Guardar Cambios</button>' +
              '</div>' +
            '</form>' +
          '</div>' +
        '</div>';
    }

    var filterCatOpts =
      '<option value="">Todas las categorías (' + allCats.length + ')</option>' +
      allCats.map(function (c) {
        return '<option value="' + esc(c) + '" ' + (STATE.filterEspCat === c ? 'selected' : '') + '>' + esc(c) + '</option>';
      }).join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.85rem;">' +
            '<div style="display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;">' +
              '<h4 style="margin:0;">🩺 Especialidades Médicas (' + filtered.length + ')</h4>' +
              '<button type="button" class="ms-sa-btn" id="trn-e-open-new" style="padding:0.38rem 0.85rem;font-size:0.8rem;">➕ Nueva Especialidad</button>' +
            '</div>' +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">' +
              '<select class="ms-sa-select" id="trn-e-filter-cat" style="width:auto;min-width:200px;">' + filterCatOpts + '</select>' +
              '<input class="ms-sa-input" id="trn-e-search" style="width:240px;" value="' + esc(STATE.searchEsp) + '" placeholder="Buscar especialidad o categoría...">' +
            '</div>' +
          '</div>' +
          '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;font-size:0.78rem;">' +
              '<th style="padding:0.55rem;">Especialidad (A–Z)</th>' +
              '<th style="padding:0.55rem;">Categoría</th>' +
              '<th style="padding:0.55rem;">Duración de Turno</th>' +
              '<th style="padding:0.55rem;">Videollamada</th>' +
              '<th style="padding:0.55rem;">Valor Sugerido</th>' +
              '<th style="padding:0.55rem;text-align:right;">Acciones</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
          paginationHtml +
        '</div>' +
        modalHtml +
      '</div>'
    );
  }

  // ==================== 5. GESTIÓN DE PROFESIONALES ====================
  function syncGestionDraftForProf(profId) {
    STATE.gestionProfId = profId;
    var prof = (STATE.data.profesionales || []).find(function (p) { return p.id === profId; });
    if (prof) {
      STATE.gestionHorariosDraft = JSON.parse(JSON.stringify(prof.horarios || []));
      STATE.gestionObrasDraft = (prof.obraSocialIds || []).slice();
      STATE.gestionPreviewEspId = (prof.especialidadIds && prof.especialidadIds[0]) || ((STATE.data.especialidades[0] && STATE.data.especialidades[0].id) || '');
    } else {
      STATE.gestionHorariosDraft = [];
      STATE.gestionObrasDraft = [];
      STATE.gestionPreviewEspId = '';
    }
  }

  function renderGestionProfesionalesView() {
    var profs = STATE.data.profesionales || [];
    if (profs.length === 0) {
      return (
        '<div class="ms-sa-card" style="text-align:center;padding:2rem;">' +
          '<h4>Primero dá de alta al menos un Profesional</h4>' +
          '<p style="color:#64748b;font-size:0.86rem;">Ingresá a <strong>ABM Profesionales</strong> para registrar el DNI, Apellido/s, Nombre/s y Especialidades.</p>' +
          '<button type="button" class="ms-sa-btn" id="trn-go-abm-prof">Ir a ABM Profesionales</button>' +
        '</div>'
      );
    }

    if (!STATE.gestionProfId || !profs.some(function (p) { return p.id === STATE.gestionProfId; })) {
      syncGestionDraftForProf(profs[0].id);
    }
    var prof = profs.find(function (p) { return p.id === STATE.gestionProfId; });
    var previewEsp = (STATE.data.especialidades || []).find(function (e) { return e.id === STATE.gestionPreviewEspId; }) ||
      (STATE.data.especialidades || [])[0] || { duracionMinutos: 20, nombre: 'General' };
    var slotStep = Number(previewEsp.duracionMinutos || 20);

    var profOpts = profs.map(function (p) {
      return '<option value="' + esc(p.id) + '" ' + (p.id === STATE.gestionProfId ? 'selected' : '') + '>' +
        esc((p.titulo ? p.titulo + ' ' : '') + p.apellidos + ', ' + p.nombres + ' (DNI ' + p.dni + ')') + '</option>';
    }).join('');

    var profEsps = (STATE.data.especialidades || []).filter(function (e) {
      return (prof.especialidadIds || []).indexOf(e.id) !== -1;
    });
    var espPreviewOpts = (profEsps.length > 0 ? profEsps : (STATE.data.especialidades || [])).map(function (e) {
      return '<option value="' + esc(e.id) + '" ' + (e.id === STATE.gestionPreviewEspId ? 'selected' : '') + '>' +
        esc(e.nombre) + ' (' + esc(e.duracionMinutos) + ' min)</option>';
    }).join('');

    // Renderizar rangos horarios configurados + grilla interactiva de slots para habilitar/bloquear
    var rangosHtml = STATE.gestionHorariosDraft.length === 0
      ? '<p style="color:#64748b;font-size:0.84rem;">Todavía no agregaste días ni rangos horarios para este profesional. Usá el formulario de arriba para sumar franjas.</p>'
      : STATE.gestionHorariosDraft.map(function (r, idx) {
          var sMin = timeToMin(r.horaInicio);
          var eMin = timeToMin(r.horaFin);
          var disabledSet = Array.isArray(r.slotsDeshabilitados) ? r.slotsDeshabilitados : [];
          var slotPills = '';
          if (sMin >= 0 && eMin > sMin) {
            for (var c = sMin; c + slotStep <= eMin; c += slotStep) {
              var hh = minToTime(c);
              var isOff = disabledSet.indexOf(hh) !== -1;
              slotPills +=
                '<button type="button" data-toggle-slot-idx="' + idx + '" data-slot-time="' + hh + '" title="Clic para bloquear o habilitar este turno" ' +
                'style="padding:0.22rem 0.5rem;border-radius:8px;font-size:0.74rem;font-weight:800;cursor:pointer;border:1px solid ' +
                (isOff ? '#f87171;background:#fee2e2;color:#991b1b;text-decoration:line-through;' : '#34d399;background:#dcfce7;color:#065f46;') + '">' +
                hh + '</button>';
            }
          }
          return (
            '<div style="border:1px solid #cbd5e1;border-radius:12px;padding:0.8rem;background:#f8fbfc;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">' +
                '<div style="font-weight:800;color:#112D3A;">' +
                  '📅 ' + esc(DIAS_NOMBRES[Number(r.diaSemana)] || 'Día') + ' · <strong>' + esc(r.horaInicio) + ' a ' + esc(r.horaFin) + ' hs</strong> ' +
                  '<span style="font-size:0.76rem;background:#e2e8f0;padding:0.15rem 0.5rem;border-radius:999px;margin-left:0.35rem;">' + esc(r.modalidad) + '</span>' +
                  (r.consultorio ? ' <span style="font-size:0.76rem;color:#475569;">· ' + esc(r.consultorio) + '</span>' : '') +
                '</div>' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.25rem 0.55rem;font-size:0.74rem;color:#dc2626;border-color:#dc2626;" data-del-rango-idx="' + idx + '">🗑 Quitar rango</button>' +
              '</div>' +
              '<div style="margin-top:0.55rem;font-size:0.74rem;color:#475569;margin-bottom:0.35rem;">Disponibilidad de turnos (' + slotStep + ' min · clic en un horario para habilitarlo/bloquearlo):</div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;">' + (slotPills || '<small>Rango menor a la duración del turno</small>') + '</div>' +
            '</div>'
          );
        }).join('');

    var activeObras = (STATE.data.obrasSociales || []).filter(function (o) { return o.activa; });
    var osChecks = activeObras.map(function (o) {
      var chk = STATE.gestionObrasDraft.indexOf(o.id) !== -1;
      return (
        '<label style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.3rem 0.55rem;border-radius:8px;border:1px solid #cbd5e1;background:' +
        (chk ? '#dcfce7' : '#fff') + ';font-size:0.76rem;font-weight:700;cursor:pointer;">' +
          '<input type="checkbox" class="trn-gest-os-chk" value="' + esc(o.id) + '" ' + (chk ? 'checked' : '') + '>' +
          esc(o.sigla) + ' <small style="color:#64748b;">(' + esc(o.tipo) + ')</small>' +
        '</label>'
      );
    }).join('');

    var profBloqueos = (STATE.data.bloqueos || []).filter(function (b) {
      return b.profesionalId === '*' || b.profesionalId === prof.id;
    });
    var blqRows = profBloqueos.length === 0
      ? '<p style="font-size:0.8rem;color:#64748b;margin:0;">Sin bloqueos ni licencias cargadas.</p>'
      : profBloqueos.map(function (b) {
          return (
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.45rem 0.7rem;border:1px solid #fecaca;background:#fef2f2;border-radius:8px;font-size:0.8rem;">' +
              '<span><strong>' + esc(b.fechaDesde) + (b.fechaHasta !== b.fechaDesde ? ' al ' + esc(b.fechaHasta) : '') + '</strong>' +
              (b.horaDesde ? ' (' + esc(b.horaDesde) + '-' + esc(b.horaHasta) + ')' : ' (Día completo)') +
              ' · ' + esc(b.motivo) + (b.profesionalId === '*' ? ' [TODOS]' : '') + '</span>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.2rem 0.5rem;font-size:0.72rem;" data-del-blq="' + esc(b.id) + '">Quitar</button>' +
            '</div>'
          );
        }).join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="ms-sa-card ms-sa-card--highlight">' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0.8rem;align-items:end;">' +
            '<div><label class="ms-sa-label" style="color:#56D7A1;">Seleccioná el Profesional a Configurar</label><select class="ms-sa-select" id="trn-gest-prof-sel">' + profOpts + '</select></div>' +
            '<div><label class="ms-sa-label" style="color:#56D7A1;">Vista previa de slots según Especialidad</label><select class="ms-sa-select" id="trn-gest-esp-prev">' + espPreviewOpts + '</select></div>' +
            '<div><button type="button" class="ms-sa-btn" id="trn-gest-save-all" style="width:100%;">💾 Guardar Toda la Gestión del Profesional</button></div>' +
          '</div>' +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">🗓️ Días de Atención, Rangos Horarios y Disponibilidad de Turnos</h4>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0.55rem;align-items:end;padding-bottom:0.9rem;margin-bottom:0.9rem;border-bottom:1px solid #e2ecf0;">' +
            '<div><label class="ms-sa-label">Día</label><select class="ms-sa-select" id="trn-rng-dia">' +
              DIAS_NOMBRES.map(function (dn, i) { return '<option value="' + i + '" ' + (i === 1 ? 'selected' : '') + '>' + dn + '</option>'; }).join('') +
            '</select></div>' +
            '<div><label class="ms-sa-label">Hora Inicio</label><input class="ms-sa-input" type="time" id="trn-rng-ini" value="08:00"></div>' +
            '<div><label class="ms-sa-label">Hora Fin</label><input class="ms-sa-input" type="time" id="trn-rng-fin" value="12:00"></div>' +
            '<div><label class="ms-sa-label">Modalidad</label><select class="ms-sa-select" id="trn-rng-mod"><option value="ambas">Presencial y Video</option><option value="presencial">Solo Presencial</option><option value="videollamada">Solo Videollamada</option></select></div>' +
            '<div><label class="ms-sa-label">Consultorio / Box</label><input class="ms-sa-input" id="trn-rng-cons" placeholder="Ej: Cons. 2"></div>' +
            '<div><button type="button" class="ms-sa-btn" id="trn-rng-add-btn" style="width:100%;">+ Agregar Rango</button></div>' +
          '</div>' +
          '<div style="display:grid;gap:0.7rem;">' + rangosHtml + '</div>' +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.7rem;">' +
            '<h4 style="margin:0;">🛡️ Obras Sociales que Atiende este Profesional (' + STATE.gestionObrasDraft.length + ' seleccionadas)</h4>' +
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.25rem 0.6rem;font-size:0.74rem;" id="trn-os-sel-all">Todas</button>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.25rem 0.6rem;font-size:0.74rem;" id="trn-os-sel-prep">Solo Prepagas</button>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.25rem 0.6rem;font-size:0.74rem;" id="trn-os-sel-none">Limpiar</button>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;max-height:200px;overflow-y:auto;padding:0.55rem;border:1px solid #dbe7ec;border-radius:10px;background:#f8fbfc;">' +
            osChecks +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center;margin-top:0.85rem;padding-top:0.75rem;border-top:1px solid #e2ecf0;">' +
            '<label style="font-size:0.84rem;font-weight:700;"><input type="checkbox" id="trn-gest-part" ' + (prof.atiendeParticular ? 'checked' : '') + '> 💳 Atiende Particular (sin O.S.)</label>' +
            '<div style="display:flex;align-items:center;gap:0.4rem;"><label class="ms-sa-label" style="margin:0;">Valor Particular (ARS):</label><input class="ms-sa-input" type="number" min="0" id="trn-gest-val" style="width:140px;" value="' + esc(prof.valorConsultaParticularArs || 25000) + '"></div>' +
          '</div>' +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">🚫 Bloqueos de Agenda, Licencias y Feriados</h4>' +
          '<form id="ms-trn-blq-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:0.55rem;align-items:end;margin-bottom:0.8rem;">' +
            '<div><label class="ms-sa-label">Desde</label><input class="ms-sa-input" type="date" id="trn-blq-desde" required value="' + todayIso() + '"></div>' +
            '<div><label class="ms-sa-label">Hasta</label><input class="ms-sa-input" type="date" id="trn-blq-hasta" required value="' + todayIso() + '"></div>' +
            '<div><label class="ms-sa-label">Motivo</label><input class="ms-sa-input" id="trn-blq-mot" placeholder="Congreso / Vacaciones / Feriado"></div>' +
            '<div><label style="font-size:0.78rem;font-weight:700;"><input type="checkbox" id="trn-blq-all"> Aplicar a todos (Feriado)</label></div>' +
            '<div><button type="submit" class="ms-sa-btn ms-sa-btn--outline" style="width:100%;">+ Bloquear</button></div>' +
          '</form>' +
          '<div style="display:grid;gap:0.4rem;">' + blqRows + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ==================== 6. GESTIÓN DE PACIENTES ====================
  function renderPacientesView() {
    var pacs = (STATE.data.pacientes || []).filter(function (p) { return p.activo !== false; });
    var activeObras = (STATE.data.obrasSociales || []).filter(function (o) { return o.activa; });
    var editing = STATE.editingPacId
      ? pacs.find(function (p) { return p.id === STATE.editingPacId; }) || null
      : null;

    var filtered = pacs.filter(function (p) {
      if (!STATE.searchPac) return true;
      var q = STATE.searchPac.toLowerCase();
      return (p.dni + ' ' + p.apellidos + ' ' + p.nombres + ' ' + (p.whatsapp || '')).toLowerCase().indexOf(q) !== -1;
    });

    var osOpts = '<option value="">Particular / Sin O.S.</option>' + activeObras.map(function (o) {
      return '<option value="' + esc(o.id) + '" ' + (editing && editing.obraSocialId === o.id ? 'selected' : '') + '>' + esc(o.sigla) + '</option>';
    }).join('');

    var selectedOsForForm = editing ? editing.obraSocialId || '' : '';
    var planOpts = '<option value="">—</option>' + (STATE.data.planes || []).filter(function (pl) {
      return pl.activo && (!selectedOsForForm || pl.obraSocialId === selectedOsForForm);
    }).map(function (pl) {
      return '<option value="' + esc(pl.id) + '" ' + (editing && editing.planId === pl.id ? 'selected' : '') + '>' + esc(pl.nombre) + '</option>';
    }).join('');

    var rows = filtered.length === 0
      ? '<tr><td colspan="7" style="padding:1.5rem;text-align:center;color:#64748b;">Aún no hay pacientes registrados.</td></tr>'
      : filtered.map(function (p) {
          var os = activeObras.find(function (o) { return o.id === p.obraSocialId; });
          var pl = (STATE.data.planes || []).find(function (x) { return x.id === p.planId; });
          var trnCount = (STATE.data.turnos || []).filter(function (t) { return t.pacienteDni === p.dni; }).length;
          return (
            '<tr style="border-bottom:1px solid #e2ecf0;">' +
              '<td style="padding:0.55rem;font-weight:800;">' + esc(p.dni) + '</td>' +
              '<td style="padding:0.55rem;"><strong>' + esc(p.apellidos) + '</strong>, ' + esc(p.nombres) +
                '<br><small style="color:#64748b;">' + (p.fechaNacimiento ? 'Nac: ' + esc(p.fechaNacimiento) + (p.edad != null ? ' (' + p.edad + ' años)' : '') : 'Sin fecha nac.') + '</small></td>' +
              '<td style="padding:0.55rem;font-size:0.8rem;">' + esc(p.whatsapp || '—') + '<br><small style="color:#64748b;">' + esc(p.email || '') + '</small></td>' +
              '<td style="padding:0.55rem;font-size:0.8rem;">' + (os ? esc(os.sigla) + (pl ? ' · ' + esc(pl.nombre) : '') : 'Particular') +
                (p.nroAfiliado ? '<br><small>Af: ' + esc(p.nroAfiliado) + '</small>' : '') + '</td>' +
              '<td style="padding:0.55rem;font-size:0.75rem;"><span style="background:' + (p.origenRegistro === 'WEB' ? '#dcfce7;color:#065f46;' : '#e2e8f0;color:#334155;') + 'padding:0.18rem 0.5rem;border-radius:999px;font-weight:800;">' + esc(p.origenRegistro) + '</span></td>' +
              '<td style="padding:0.55rem;font-size:0.8rem;font-weight:700;">' + trnCount + '</td>' +
              '<td style="padding:0.55rem;text-align:right;white-space:nowrap;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.55rem;font-size:0.74rem;" data-edit-pac="' + esc(p.id) + '">✏️ Editar</button>' +
              '</td>' +
            '</tr>'
          );
        }).join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">' + (editing ? '✏️ Editar Paciente' : '➕ ABM Pacientes (con Buscador Automático por DNI)') + '</h4>' +
          '<form id="ms-trn-pac-form" style="display:grid;gap:0.65rem;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.65rem;align-items:end;">' +
              '<div><label class="ms-sa-label">DNI *</label><div style="display:flex;gap:0.35rem;"><input class="ms-sa-input" id="trn-pac-dni" required value="' + esc(editing ? editing.dni : '') + '" placeholder="35123456"><button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-pac-dni-btn" style="padding:0.35rem 0.6rem;">🔍</button></div></div>' +
              '<div><label class="ms-sa-label">Apellido/s *</label><input class="ms-sa-input" id="trn-pac-ap" required value="' + esc(editing ? editing.apellidos : '') + '"></div>' +
              '<div><label class="ms-sa-label">Nombre/s *</label><input class="ms-sa-input" id="trn-pac-nom" required value="' + esc(editing ? editing.nombres : '') + '"></div>' +
              '<div><label class="ms-sa-label">Fecha de Nacimiento</label><input class="ms-sa-input" type="date" id="trn-pac-nac" value="' + esc(editing ? editing.fechaNacimiento : '') + '"></div>' +
              '<div><label class="ms-sa-label">WhatsApp</label><input class="ms-sa-input" id="trn-pac-wa" value="' + esc(editing ? editing.whatsapp : '') + '"></div>' +
              '<div><label class="ms-sa-label">Email</label><input class="ms-sa-input" type="email" id="trn-pac-email" value="' + esc(editing ? editing.email : '') + '"></div>' +
              '<div><label class="ms-sa-label">Domicilio</label><input class="ms-sa-input" id="trn-pac-dom" value="' + esc(editing ? editing.domicilio : '') + '"></div>' +
              '<div><label class="ms-sa-label">Obra Social</label><select class="ms-sa-select" id="trn-pac-os">' + osOpts + '</select></div>' +
              '<div><label class="ms-sa-label">Plan</label><select class="ms-sa-select" id="trn-pac-plan">' + planOpts + '</select></div>' +
              '<div><label class="ms-sa-label">N° Afiliado</label><input class="ms-sa-input" id="trn-pac-af" value="' + esc(editing ? editing.nroAfiliado : '') + '"></div>' +
            '</div>' +
            '<div style="display:flex;gap:0.5rem;">' +
              '<button type="submit" class="ms-sa-btn">💾 Guardar Paciente</button>' +
              (editing ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-pac-cancel">Cancelar</button>' : '') +
            '</div>' +
          '</form>' +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.8rem;">' +
            '<h4 style="margin:0;">👥 Padrón de Pacientes (' + filtered.length + ')</h4>' +
            '<input class="ms-sa-input" id="trn-pac-search" style="max-width:280px;" value="' + esc(STATE.searchPac) + '" placeholder="Buscar DNI, apellido, nombre...">' +
          '</div>' +
          '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;font-size:0.78rem;">' +
              '<th style="padding:0.5rem;">DNI</th><th style="padding:0.5rem;">Paciente</th><th style="padding:0.5rem;">Contacto</th>' +
              '<th style="padding:0.5rem;">Cobertura</th><th style="padding:0.5rem;">Origen</th><th style="padding:0.5rem;">Turnos</th><th style="padding:0.5rem;text-align:right;">Acción</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>' +
      '</div>'
    );
  }

  // ==================== 7. GESTIÓN DE TURNOS (WEB + MANUAL) ====================
  function renderGestionTurnosView() {
    var st = STATE.stats || {};
    var today = todayIso();
    var profs = (STATE.data.profesionales || []).filter(function (p) { return p.activo; });
    var esps = (STATE.data.especialidades || []).filter(function (e) { return e.activa; });
    var activeObras = (STATE.data.obrasSociales || []).filter(function (o) { return o.activa; });
    var turnos = STATE.data.turnos || [];

    var filtered = turnos.filter(function (t) {
      if (STATE.filterTurnoFecha) {
        if (t.fecha !== STATE.filterTurnoFecha) return false;
      } else if (STATE.filterTurnoModo === 'hoy') {
        if (t.fecha !== today) return false;
      } else if (STATE.filterTurnoModo === 'proximos') {
        if (t.fecha < today) return false;
      }
      if (STATE.filterTurnoProf && t.profesionalId !== STATE.filterTurnoProf) return false;
      if (STATE.filterTurnoEstado && t.estado !== STATE.filterTurnoEstado) return false;
      if (STATE.searchTurno) {
        var q = STATE.searchTurno.toLowerCase();
        var hay = (t.codigo + ' ' + t.pacienteDni + ' ' + t.pacienteNombreCompleto + ' ' + t.profesionalNombre + ' ' + t.especialidadNombre).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) {
      return (a.fecha + ' ' + a.horaInicio).localeCompare(b.fecha + ' ' + b.horaInicio);
    });

    var mf = STATE.manualForm;
    if (!mf.fecha) mf.fecha = today;

    var manualPanelHtml = '';
    if (STATE.manualTurnoOpen) {
      var mProfOpts = '<option value="">Seleccionar profesional...</option>' + profs.filter(function (p) {
        return !mf.especialidadId || (p.especialidadIds || []).indexOf(mf.especialidadId) !== -1;
      }).map(function (p) {
        return '<option value="' + esc(p.id) + '" ' + (mf.profesionalId === p.id ? 'selected' : '') + '>' + esc(p.apellidos + ', ' + p.nombres) + '</option>';
      }).join('');

      var mEspOpts = '<option value="">Seleccionar especialidad...</option>' + esps.map(function (e) {
        return '<option value="' + esc(e.id) + '" ' + (mf.especialidadId === e.id ? 'selected' : '') + '>' + esc(e.nombre) + ' (' + e.duracionMinutos + 'm)</option>';
      }).join('');

      var mOsOpts = '<option value="">Seleccionar Obra Social...</option>' + activeObras.map(function (o) {
        return '<option value="' + esc(o.id) + '" ' + (mf.obraSocialId === o.id ? 'selected' : '') + '>' + esc(o.sigla) + '</option>';
      }).join('');

      var mPlanOpts = '<option value="">Sin plan / General</option>' + (STATE.data.planes || []).filter(function (pl) {
        return pl.activo && pl.obraSocialId === mf.obraSocialId;
      }).map(function (pl) {
        return '<option value="' + esc(pl.id) + '" ' + (mf.planId === pl.id ? 'selected' : '') + '>' + esc(pl.nombre) + '</option>';
      }).join('');

      var slotsHtml = STATE.manualSlots.length === 0
        ? '<small style="color:#64748b;">Elegí Especialidad, Profesional y Fecha para ver los horarios (o ingresá hora manual marcando Sobreturno).</small>'
        : STATE.manualSlots.map(function (s) {
            var sel = STATE.manualSelectedHora === s.horaInicio;
            return (
              '<button type="button" data-pick-manual-hora="' + esc(s.horaInicio) + '" ' + (!s.disponible && !mf.esSobreturno ? 'disabled' : '') +
              ' style="padding:0.3rem 0.6rem;border-radius:8px;font-size:0.78rem;font-weight:800;cursor:pointer;border:2px solid ' +
              (sel ? '#112D3A;background:#56D7A1;color:#112D3A;' : s.disponible ? '#cbd5e1;background:#fff;color:#112D3A;' : '#fecaca;background:#fee2e2;color:#991b1b;opacity:0.55;') + '">' +
              esc(s.horaInicio) + '</button>'
            );
          }).join('');

      manualPanelHtml =
        '<div class="ms-sa-card" style="border:2px solid #56D7A1;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">' +
            '<h4 style="margin:0;">➕ Asignar Turno Manualmente (Recepción / Secretaría)</h4>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-close-manual-btn" style="padding:0.25rem 0.6rem;font-size:0.76rem;">Cerrar</button>' +
          '</div>' +
          '<form id="ms-trn-manual-form" style="display:grid;gap:0.75rem;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.6rem;">' +
              '<div><label class="ms-sa-label">Especialidad *</label><select class="ms-sa-select" id="tm-esp" required>' + mEspOpts + '</select></div>' +
              '<div><label class="ms-sa-label">Profesional *</label><select class="ms-sa-select" id="tm-prof" required>' + mProfOpts + '</select></div>' +
              '<div><label class="ms-sa-label">Fecha *</label><input class="ms-sa-input" type="date" id="tm-fecha" required value="' + esc(mf.fecha) + '"></div>' +
              '<div><label class="ms-sa-label">Modalidad</label><select class="ms-sa-select" id="tm-mod"><option value="presencial" ' + (mf.modalidad === 'presencial' ? 'selected' : '') + '>🏥 Presencial</option><option value="videollamada" ' + (mf.modalidad === 'videollamada' ? 'selected' : '') + '>📹 Videollamada</option></select></div>' +
              '<div><label class="ms-sa-label">Hora elegida *</label><input class="ms-sa-input" type="time" id="tm-hora" required value="' + esc(STATE.manualSelectedHora) + '"></div>' +
              '<div style="display:flex;align-items:end;padding-bottom:0.4rem;"><label style="font-size:0.8rem;font-weight:700;"><input type="checkbox" id="tm-sobre" ' + (mf.esSobreturno ? 'checked' : '') + '> Permitir Sobreturno</label></div>' +
            '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;padding:0.5rem;background:#f8fbfc;border-radius:10px;border:1px solid #dbe7ec;">' + slotsHtml + '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.6rem;padding-top:0.5rem;border-top:1px solid #e2ecf0;">' +
              '<div><label class="ms-sa-label">DNI Paciente *</label><div style="display:flex;gap:0.3rem;"><input class="ms-sa-input" id="tm-dni" required value="' + esc(mf.pacienteDni) + '" placeholder="35123456"><button type="button" class="ms-sa-btn ms-sa-btn--outline" id="tm-dni-lookup" style="padding:0.3rem 0.6rem;">🔍</button></div></div>' +
              '<div><label class="ms-sa-label">Apellido/s *</label><input class="ms-sa-input" id="tm-ap" required value="' + esc(mf.pacienteApellidos) + '"></div>' +
              '<div><label class="ms-sa-label">Nombre/s *</label><input class="ms-sa-input" id="tm-nom" required value="' + esc(mf.pacienteNombres) + '"></div>' +
              '<div><label class="ms-sa-label">WhatsApp</label><input class="ms-sa-input" id="tm-wa" value="' + esc(mf.pacienteWhatsapp) + '"></div>' +
              '<div><label class="ms-sa-label">Cobertura</label><select class="ms-sa-select" id="tm-cob"><option value="obra_social" ' + (mf.coberturaTipo === 'obra_social' ? 'selected' : '') + '>Obra Social / Prepaga</option><option value="particular" ' + (mf.coberturaTipo === 'particular' ? 'selected' : '') + '>Particular</option></select></div>' +
              (mf.coberturaTipo === 'obra_social'
                ? '<div><label class="ms-sa-label">Obra Social</label><select class="ms-sa-select" id="tm-os">' + mOsOpts + '</select></div>' +
                  '<div><label class="ms-sa-label">Plan</label><select class="ms-sa-select" id="tm-plan">' + mPlanOpts + '</select></div>'
                : '') +
            '</div>' +
            '<div><button type="submit" class="ms-sa-btn">✅ Confirmar y Asignar Turno</button></div>' +
          '</form>' +
        '</div>';
    }

    var basePublic = STATE.publicTurnosUrl || '/turnos';
    var rows = filtered.length === 0
      ? '<tr><td colspan="7" style="padding:1.8rem;text-align:center;color:#64748b;font-weight:700;">No hay turnos para el filtro seleccionado.</td></tr>'
      : filtered.map(function (t) {
          var waDigits = String(t.pacienteWhatsapp || '').replace(/\D/g, '');
          var salaHref = basePublic + '?sala=' + encodeURIComponent(t.codigo) + '&rol=profesional';
          var salaPacHref = basePublic + '?sala=' + encodeURIComponent(t.codigo) + '&rol=paciente';
          var waMsg = 'Hola ' + (t.pacienteNombres || '') + ', te recordamos tu turno (' + t.codigo + ') de ' + t.especialidadNombre + ' con ' + t.profesionalNombre + ' el ' + t.fecha + ' a las ' + t.horaInicio + ' hs.' +
            (t.modalidad === 'videollamada' ? ' Ingresá a la videollamada aquí: ' + (salaPacHref.indexOf('http') === 0 ? salaPacHref : window.location.origin + salaPacHref) : '');
          var estadoColors = {
            pendiente_pago: '#fef3c7;color:#92400e;',
            pendiente: '#e0f2fe;color:#075985;',
            confirmado: '#dcfce7;color:#065f46;',
            en_sala: '#ede9fe;color:#5b21b6;',
            atendido: '#d1fae5;color:#064e3b;',
            ausente: '#fee2e2;color:#991b1b;',
            cancelado: '#f1f5f9;color:#64748b;'
          };
          return (
            '<tr style="border-bottom:1px solid #e2ecf0;opacity:' + (t.estado === 'cancelado' ? '0.55' : '1') + ';">' +
              '<td style="padding:0.55rem;white-space:nowrap;"><strong>' + esc(t.fecha) + '</strong><br><span style="font-weight:900;color:#112D3A;">' + esc(t.horaInicio) + ' - ' + esc(t.horaFin) + '</span>' +
                '<br><small style="color:#64748b;"><code>' + esc(t.codigo) + '</code> · ' + esc(t.origen) + (t.esSobreturno ? ' · SOBRETURNO' : '') + '</small></td>' +
              '<td style="padding:0.55rem;"><strong>' + esc(t.pacienteNombreCompleto) + '</strong><br><small style="color:#64748b;">DNI ' + esc(t.pacienteDni) + ' · ' + esc(t.pacienteWhatsapp) + '</small></td>' +
              '<td style="padding:0.55rem;font-size:0.82rem;"><strong>' + esc(t.profesionalNombre) + '</strong><br><small style="color:#475569;">' + esc(t.especialidadNombre) + ' (' + esc(t.duracionMinutos) + 'm)</small></td>' +
              '<td style="padding:0.55rem;font-size:0.8rem;">' +
                (t.coberturaTipo === 'particular'
                  ? '<strong>💳 Particular ' + fmtArs(t.pago && t.pago.montoTotalArs) + '</strong><br><small style="color:' + (t.pago && t.pago.estado === 'approved' ? '#047857' : '#b45309') + ';font-weight:800;">' + (t.pago && t.pago.estado === 'approved' ? '✅ Pagado' : '⏳ Pendiente') + '</small>'
                  : '<strong>' + esc(t.obraSocialNombre || 'O.S.') + '</strong>' + (t.planNombre ? '<br><small>' + esc(t.planNombre) + '</small>' : '')) +
              '</td>' +
              '<td style="padding:0.55rem;font-size:0.8rem;">' + (t.modalidad === 'videollamada' ? '📹 Videollamada' : '🏥 Presencial') + '</td>' +
              '<td style="padding:0.55rem;">' +
                '<span style="background:' + (estadoColors[t.estado] || '#e2e8f0;color:#112D3A;') + 'padding:0.2rem 0.5rem;border-radius:999px;font-size:0.72rem;font-weight:900;text-transform:uppercase;">' + esc(t.estado) + '</span>' +
                '<div style="margin-top:0.35rem;"><select class="ms-sa-select" data-change-turno-estado="' + esc(t.id) + '" style="padding:0.2rem 0.35rem;font-size:0.74rem;width:auto;">' +
                  ['pendiente_pago', 'pendiente', 'confirmado', 'en_sala', 'atendido', 'ausente', 'cancelado'].map(function (es) {
                    return '<option value="' + es + '" ' + (t.estado === es ? 'selected' : '') + '>' + es + '</option>';
                  }).join('') +
                '</select></div>' +
              '</td>' +
              '<td style="padding:0.55rem;text-align:right;white-space:nowrap;">' +
                (t.modalidad === 'videollamada' && t.estado !== 'cancelado'
                  ? '<a href="' + esc(salaHref) + '" target="_blank" class="ms-sa-btn" style="padding:0.3rem 0.6rem;font-size:0.73rem;margin-right:0.25rem;">📹 Sala Video</a>'
                  : '') +
                (t.coberturaTipo === 'particular' && (!t.pago || t.pago.estado !== 'approved') && t.estado !== 'cancelado'
                  ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-mark-paid="' + esc(t.id) + '" style="padding:0.28rem 0.55rem;font-size:0.73rem;margin-right:0.25rem;">💵 Cobrado</button>'
                  : '') +
                (waDigits
                  ? '<a href="https://wa.me/' + esc(waDigits) + '?text=' + encodeURIComponent(waMsg) + '" target="_blank" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.55rem;font-size:0.73rem;">📲 WA</a>'
                  : '') +
              '</td>' +
            '</tr>'
          );
        }).join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.65rem;">' +
          kpiCard('Turnos Hoy', st.turnosHoy || 0, '#112D3A', '#56D7A1') +
          kpiCard('Próximos Activos', st.turnosProximos || 0, '#ffffff', '#112D3A') +
          kpiCard('Confirmados', st.turnosConfirmados || 0, '#ffffff', '#047857') +
          kpiCard('Videollamadas Próx.', st.videollamadasProximas || 0, '#ffffff', '#0369a1') +
          kpiCard('Recaudado Particular', fmtArs(st.totalRecaudadoParticularArs || 0), '#ffffff', '#065f46') +
        '</div>' +

        manualPanelHtml +

        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;margin-bottom:0.85rem;">' +
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">' +
              '<button type="button" class="ms-sa-btn ' + (STATE.filterTurnoModo === 'hoy' && !STATE.filterTurnoFecha ? '' : 'ms-sa-btn--outline') + '" data-trn-modo="hoy" style="padding:0.35rem 0.7rem;font-size:0.78rem;">Hoy</button>' +
              '<button type="button" class="ms-sa-btn ' + (STATE.filterTurnoModo === 'proximos' && !STATE.filterTurnoFecha ? '' : 'ms-sa-btn--outline') + '" data-trn-modo="proximos" style="padding:0.35rem 0.7rem;font-size:0.78rem;">Próximos</button>' +
              '<button type="button" class="ms-sa-btn ' + (STATE.filterTurnoModo === 'todos' && !STATE.filterTurnoFecha ? '' : 'ms-sa-btn--outline') + '" data-trn-modo="todos" style="padding:0.35rem 0.7rem;font-size:0.78rem;">Historial Completo</button>' +
            '</div>' +
            '<button type="button" class="ms-sa-btn" id="trn-open-manual-btn">+ Asignar Turno Manualmente</button>' +
          '</div>' +

          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.55rem;margin-bottom:0.85rem;">' +
            '<div><label class="ms-sa-label">Fecha exacta</label><input class="ms-sa-input" type="date" id="trn-f-fecha" value="' + esc(STATE.filterTurnoFecha) + '"></div>' +
            '<div><label class="ms-sa-label">Profesional</label><select class="ms-sa-select" id="trn-f-prof"><option value="">Todos</option>' +
              profs.map(function (p) { return '<option value="' + esc(p.id) + '" ' + (STATE.filterTurnoProf === p.id ? 'selected' : '') + '>' + esc(p.apellidos + ', ' + p.nombres) + '</option>'; }).join('') +
            '</select></div>' +
            '<div><label class="ms-sa-label">Estado</label><select class="ms-sa-select" id="trn-f-est"><option value="">Todos</option>' +
              ['pendiente_pago', 'pendiente', 'confirmado', 'en_sala', 'atendido', 'ausente', 'cancelado'].map(function (es) {
                return '<option value="' + es + '" ' + (STATE.filterTurnoEstado === es ? 'selected' : '') + '>' + es + '</option>';
              }).join('') +
            '</select></div>' +
            '<div><label class="ms-sa-label">Buscar DNI / Paciente / Código</label><input class="ms-sa-input" id="trn-f-search" value="' + esc(STATE.searchTurno) + '" placeholder="TRN-... o DNI"></div>' +
          '</div>' +

          '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;font-size:0.78rem;">' +
              '<th style="padding:0.5rem;">Fecha / Hora</th><th style="padding:0.5rem;">Paciente</th><th style="padding:0.5rem;">Profesional / Esp.</th>' +
              '<th style="padding:0.5rem;">Cobertura / Pago</th><th style="padding:0.5rem;">Modalidad</th><th style="padding:0.5rem;">Estado</th><th style="padding:0.5rem;text-align:right;">Acciones</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</div>' +
      '</div>'
    );
  }

  function kpiCard(label, val, bg, fg) {
    return (
      '<div class="ms-sa-card" style="background:' + bg + ';color:' + (bg === '#112D3A' ? '#fff' : '#112D3A') + ';padding:0.9rem;">' +
        '<div style="font-size:0.72rem;font-weight:800;text-transform:uppercase;opacity:0.8;">' + esc(label) + '</div>' +
        '<div style="font-size:1.35rem;font-weight:900;margin-top:0.2rem;color:' + fg + ';">' + esc(val) + '</div>' +
      '</div>'
    );
  }

  // ==================== 8. PAGOS ONLINE & SPLIT MERCADO PAGO ====================
  function renderPagosSplitView() {
    var sc = STATE.data.splitConfig || {};
    var st = STATE.stats || {};
    var profs = STATE.data.profesionales || [];
    var txs = STATE.data.transaccionesMp || [];
    var excs = sc.profesionalExceptions || {};

    var orgDef = Number(sc.defaultOrganizadorPct != null ? sc.defaultOrganizadorPct : 20);
    var orgPres = Number(sc.presencialOrganizadorPct != null ? sc.presencialOrganizadorPct : 20);
    var orgVid = Number(sc.videollamadaOrganizadorPct != null ? sc.videollamadaOrganizadorPct : 15);

    var profMpRows = profs.length === 0
      ? '<tr><td colspan="5" style="padding:1rem;text-align:center;color:#64748b;">No hay profesionales dados de alta.</td></tr>'
      : profs.map(function (p) {
          var linked = p.mpAccount && p.mpAccount.linked;
          var exc = excs[p.id];
          var effOrg = exc ? exc.organizadorPct : orgDef;
          return (
            '<tr style="border-bottom:1px solid #e2ecf0;">' +
              '<td style="padding:0.55rem;"><strong>' + esc(p.apellidos + ', ' + p.nombres) + '</strong><br><small>Valor Particular: ' + fmtArs(p.valorConsultaParticularArs) + '</small></td>' +
              '<td style="padding:0.55rem;font-size:0.8rem;">' +
                (linked ? '<span style="color:#047857;font-weight:800;">✅ Vinculado</span><br><small>' + esc(p.mpAccount.mpUserId || '') + ' · ' + esc(p.mpAccount.mpAccountAlias || '') + '</small>' : '<span style="color:#b45309;font-weight:800;">⚠️ Sin vincular</span>') +
              '</td>' +
              '<td style="padding:0.55rem;font-size:0.8rem;">' +
                '<strong>' + effOrg + '% Organizador / ' + (100 - effOrg) + '% Prof.</strong>' +
                (exc ? '<br><small style="color:#0369a1;">Excepción: ' + esc(exc.motivo) + '</small>' : '<br><small style="color:#64748b;">Regla general</small>') +
              '</td>' +
              '<td style="padding:0.55rem;">' +
                '<div style="display:flex;gap:0.3rem;align-items:center;">' +
                  '<input type="number" min="0" max="100" step="0.5" class="ms-sa-input" style="width:72px;padding:0.25rem;" id="exc-pct-' + esc(p.id) + '" value="' + esc(effOrg) + '">' +
                  '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.25rem 0.5rem;font-size:0.72rem;" data-save-exc="' + esc(p.id) + '">Fijar %</button>' +
                  (exc ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.25rem 0.45rem;font-size:0.72rem;color:#dc2626;" data-del-exc="' + esc(p.id) + '">✕</button>' : '') +
                '</div>' +
              '</td>' +
              '<td style="padding:0.55rem;text-align:right;white-space:nowrap;">' +
                (linked
                  ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.55rem;font-size:0.74rem;color:#dc2626;" data-mp-disconnect="' + esc(p.id) + '">Desvincular</button>'
                  : '<button type="button" class="ms-sa-btn" style="padding:0.28rem 0.65rem;font-size:0.74rem;" data-mp-connect="' + esc(p.id) + '">🔗 Vincular MP OAuth</button>') +
              '</td>' +
            '</tr>'
          );
        }).join('');

    var txRows = txs.length === 0
      ? '<tr><td colspan="7" style="padding:1.5rem;text-align:center;color:#64748b;">Todavía no hay transacciones particulares registradas.</td></tr>'
      : txs.map(function (tx) {
          return (
            '<tr style="border-bottom:1px solid #e2ecf0;font-size:0.8rem;">' +
              '<td style="padding:0.5rem;"><strong>' + esc(tx.turnoCodigo) + '</strong><br><small>' + esc(tx.fechaTurno + ' ' + tx.horaTurno) + '</small></td>' +
              '<td style="padding:0.5rem;">' + esc(tx.profesionalNombre) + '<br><small>' + esc(tx.especialidadNombre) + '</small></td>' +
              '<td style="padding:0.5rem;">' + esc(tx.pacienteNombre) + '<br><small>DNI ' + esc(tx.pacienteDni) + '</small></td>' +
              '<td style="padding:0.5rem;font-weight:800;">' + fmtArs(tx.montoTotalArs) + '</td>' +
              '<td style="padding:0.5rem;color:#0369a1;font-weight:800;">' + fmtArs(tx.organizadorFeeArs) + ' (' + esc(tx.commissionSnapshot && tx.commissionSnapshot.organizadorPct) + '%)</td>' +
              '<td style="padding:0.5rem;color:#047857;font-weight:800;">' + fmtArs(tx.profesionalBrutoArs) + ' (' + esc(tx.commissionSnapshot && tx.commissionSnapshot.profesionalPct) + '%)<br><small style="color:#64748b;">Neto est: ' + fmtArs(tx.profesionalNetoEstimadoArs) + '</small></td>' +
              '<td style="padding:0.5rem;"><span style="background:' + (tx.status === 'approved' ? '#dcfce7;color:#065f46;' : '#fef3c7;color:#92400e;') + 'padding:0.18rem 0.5rem;border-radius:999px;font-weight:900;text-transform:uppercase;font-size:0.7rem;">' + esc(tx.status) + '</span></td>' +
            '</tr>'
          );
        }).join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.65rem;">' +
          kpiCard('Total Cobrado Particular', fmtArs(st.totalRecaudadoParticularArs || 0), '#112D3A', '#56D7A1') +
          kpiCard('Participación Organizador', fmtArs(st.totalOrganizadorArs || 0), '#ffffff', '#0369a1') +
          kpiCard('Participación Profesionales', fmtArs(st.totalProfesionalesBrutoArs || 0), '#ffffff', '#047857') +
          kpiCard('Pagos Aprobados', st.pagosAprobadosCount || 0, '#ffffff', '#112D3A') +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">💳 Distribución Automática Mercado Pago (Split 1:1 — Modalidad Particular)</h4>' +
          '<p style="font-size:0.82rem;color:#475569;margin-top:0;">Definí qué porcentaje corresponde al <strong>Organizador</strong> (Clínica, Sanatorio, Consultorios Externos, Staff) y qué porcentaje al <strong>Profesional</strong> en cada consulta Particular (sin obra social). Mercado Pago liquida el <code>marketplace_fee</code> en ARS automáticamente.</p>' +
          '<form id="ms-trn-split-form" style="display:grid;gap:0.75rem;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.65rem;">' +
              '<div><label class="ms-sa-label">Tipo de Organizador</label><select class="ms-sa-select" id="sp-org-tipo">' +
                ORGANIZADOR_TIPOS.map(function (t) { return '<option value="' + t + '" ' + (sc.organizadorTipo === t ? 'selected' : '') + '>' + t + '</option>'; }).join('') +
              '</select></div>' +
              '<div><label class="ms-sa-label">Nombre del Organizador</label><input class="ms-sa-input" id="sp-org-nom" value="' + esc(sc.organizadorNombre || '') + '"></div>' +
              '<div><label class="ms-sa-label">Alias / Cuenta MP Organizador</label><input class="ms-sa-input" id="sp-org-alias" value="' + esc(sc.mpOrganizadorAlias || '') + '" placeholder="clinica.salud.mp"></div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.65rem;background:#f8fbfc;padding:0.8rem;border-radius:12px;border:1px solid #dbe7ec;">' +
              '<div><label class="ms-sa-label">% Organizador General (Prof: ' + (100 - orgDef) + '%)</label><input class="ms-sa-input" type="number" min="0" max="100" step="0.5" id="sp-pct-def" value="' + orgDef + '"></div>' +
              '<div><label class="ms-sa-label">% Organizador Presencial (Prof: ' + (100 - orgPres) + '%)</label><input class="ms-sa-input" type="number" min="0" max="100" step="0.5" id="sp-pct-pres" value="' + orgPres + '"></div>' +
              '<div><label class="ms-sa-label">% Organizador Videollamada (Prof: ' + (100 - orgVid) + '%)</label><input class="ms-sa-input" type="number" min="0" max="100" step="0.5" id="sp-pct-vid" value="' + orgVid + '"></div>' +
            '</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:1.2rem;font-size:0.83rem;font-weight:700;">' +
              '<label><input type="checkbox" id="sp-enable" ' + (sc.habilitarPagoOnlineParticular !== false ? 'checked' : '') + '> Habilitar pago online Mercado Pago en consultas Particulares</label>' +
              '<label><input type="checkbox" id="sp-req" ' + (sc.pagoObligatorioParaConfirmarParticular ? 'checked' : '') + '> Exigir pago aprobado para pasar turno web a Confirmado</label>' +
            '</div>' +
            '<div><button type="submit" class="ms-sa-btn">💾 Guardar Configuración de Distribución</button></div>' +
          '</form>' +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">🔗 Cuentas Mercado Pago de Profesionales y Porcentajes Individuales</h4>' +
          '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;font-size:0.78rem;">' +
              '<th style="padding:0.5rem;">Profesional</th><th style="padding:0.5rem;">Estado OAuth MP</th><th style="padding:0.5rem;">Split Vigente</th>' +
              '<th style="padding:0.5rem;">% Organizador Individual</th><th style="padding:0.5rem;text-align:right;">Vinculación</th>' +
            '</tr></thead><tbody>' + profMpRows + '</tbody></table></div>' +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">' +
            '<h4 style="margin:0;">📊 Liquidación de Consultas Particulares (' + txs.length + ')</h4>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="trn-export-csv-btn" style="font-size:0.78rem;padding:0.35rem 0.75rem;">⬇ Exportar CSV Liquidación</button>' +
          '</div>' +
          '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;font-size:0.78rem;">' +
              '<th style="padding:0.5rem;">Turno</th><th style="padding:0.5rem;">Profesional</th><th style="padding:0.5rem;">Paciente</th>' +
              '<th style="padding:0.5rem;">Total Consulta</th><th style="padding:0.5rem;">Organizador</th><th style="padding:0.5rem;">Profesional</th><th style="padding:0.5rem;">Estado</th>' +
            '</tr></thead><tbody>' + txRows + '</tbody></table></div>' +
        '</div>' +
      '</div>'
    );
  }

  // ==================== 9. PORTAL PÚBLICO, QR Y CONFIG ====================
  function renderPortalView() {
    var pc = STATE.data.portalConfig || {};
    var fullUrl = STATE.publicTurnosUrl.indexOf('http') === 0
      ? STATE.publicTurnosUrl
      : window.location.origin + STATE.publicTurnosUrl;
    var qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&ecc=M&margin=2&data=' + encodeURIComponent(fullUrl);

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="ms-sa-grid">' +
          '<div class="ms-sa-card">' +
            '<h4 style="margin-top:0;">🌐 Enlace Público del Turnero Web</h4>' +
            '<p style="font-size:0.83rem;color:#475569;">Compatible automáticamente con <strong>Dominio Propio (Opción 1)</strong> con tu marca o con <strong>Extensión MiniSistema (Opción 2)</strong>.</p>' +
            '<input class="ms-sa-input" readonly value="' + esc(fullUrl) + '" onclick="this.select()" style="font-weight:800;margin-bottom:0.75rem;">' +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
              '<a href="' + esc(fullUrl) + '" target="_blank" class="ms-sa-btn">Abrir Turnero /turnos ↗</a>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--dark" id="trn-copy-link-btn" data-url="' + esc(fullUrl) + '">📋 Copiar Enlace</button>' +
            '</div>' +
          '</div>' +
          '<div class="ms-sa-card" style="text-align:center;">' +
            '<h4 style="margin-top:0;">📱 Código QR para Recepción / Sala de Espera</h4>' +
            '<img src="' + esc(qrSrc) + '" alt="QR Turnero Web" style="width:185px;height:185px;margin:0.4rem auto;border-radius:14px;border:2px solid #56D7A1;padding:6px;background:#fff;">' +
            '<p style="font-size:0.78rem;color:#475569;margin:0.35rem 0 0;">"Escaneá el QR y sacá tu turno online en segundos"</p>' +
          '</div>' +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">⚙️ Parámetros Generales del Portal de Turnos</h4>' +
          '<form id="ms-trn-portal-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.7rem;">' +
            '<div><label class="ms-sa-label">Dirección de Consultorios</label><input class="ms-sa-input" id="pc-dir" value="' + esc(pc.direccionConsultorio || '') + '"></div>' +
            '<div><label class="ms-sa-label">WhatsApp de Recepción</label><input class="ms-sa-input" id="pc-wa" value="' + esc(pc.whatsappRecepcion || '') + '"></div>' +
            '<div><label class="ms-sa-label">Email de Recepción</label><input class="ms-sa-input" id="pc-email" value="' + esc(pc.emailRecepcion || '') + '"></div>' +
            '<div><label class="ms-sa-label">Anticipación Máxima (días)</label><input class="ms-sa-input" type="number" min="7" max="180" id="pc-dias" value="' + esc(pc.diasAnticipacionMax || 60) + '"></div>' +
            '<div style="grid-column:1/-1;"><label class="ms-sa-label">Mensaje en comprobante de turno</label><input class="ms-sa-input" id="pc-msg" value="' + esc(pc.mensajeConfirmacion || '') + '"></div>' +
            '<div><button type="submit" class="ms-sa-btn">💾 Guardar Configuración</button></div>' +
          '</form>' +
        '</div>' +
      '</div>'
    );
  }

  function renderWorkspace() {
    var bodyEl = document.getElementById('ms-turnos-body');
    if (!bodyEl) return;

    switch (STATE.activeView) {
      case 'profesionales': bodyEl.innerHTML = renderProfesionalesView(); break;
      case 'obras_sociales': bodyEl.innerHTML = renderObrasSocialesView(); break;
      case 'planes': bodyEl.innerHTML = renderPlanesView(); break;
      case 'especialidades': bodyEl.innerHTML = renderEspecialidadesView(); break;
      case 'gestion_profesionales': bodyEl.innerHTML = renderGestionProfesionalesView(); break;
      case 'pacientes': bodyEl.innerHTML = renderPacientesView(); break;
      case 'gestion_turnos': bodyEl.innerHTML = renderGestionTurnosView(); break;
      case 'pagos_split': bodyEl.innerHTML = renderPagosSplitView(); break;
      case 'portal': bodyEl.innerHTML = renderPortalView(); break;
    }
    bindWorkspaceEvents(bodyEl);
  }

  async function refreshManualSlots() {
    var mf = STATE.manualForm;
    if (!mf.profesionalId || !mf.especialidadId || !mf.fecha) {
      STATE.manualSlots = [];
      return;
    }
    var res = await apiTurnos('GET', {
      action: 'slots',
      profesionalId: mf.profesionalId,
      especialidadId: mf.especialidadId,
      fecha: mf.fecha,
      modalidad: mf.modalidad
    });
    STATE.manualSlots = (res && res.ok && Array.isArray(res.slots)) ? res.slots : [];
  }

  function bindWorkspaceEvents(bodyEl) {
    // --- ABM Profesionales ---
    var closeProfModal = function () {
      STATE.profModalOpen = false;
      STATE.profEspPickerOpen = false;
      STATE.profOsPickerOpen = false;
      STATE.editingProfId = null;
      STATE.profDraft = null;
      renderWorkspace();
    };

    var profOpenNew = bodyEl.querySelector('#trn-p-open-new');
    if (profOpenNew) {
      profOpenNew.addEventListener('click', function () {
        STATE.editingProfId = null;
        STATE.profDraft = createProfDraft(null);
        STATE.profModalOpen = true;
        STATE.profEspPickerOpen = false;
        STATE.profOsPickerOpen = false;
        renderWorkspace();
      });
    }

    var profForm = bodyEl.querySelector('#ms-trn-prof-form');
    if (profForm) {
      profForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        syncProfDraftFromDom(bodyEl);
        var d = STATE.profDraft || createProfDraft(null);
        var res = await apiTurnos('POST', {
          action: 'save_profesional',
          profesional: {
            id: STATE.editingProfId || undefined,
            dni: d.dni,
            titulo: d.titulo,
            apellidos: d.apellidos,
            nombres: d.nombres,
            matriculaProvincial: d.matriculaProvincial,
            matriculaNacional: d.matriculaNacional,
            whatsapp: d.whatsapp,
            email: d.email,
            valorConsultaParticularArs: Number(d.valorConsultaParticularArs || 0),
            permitePresencial: Boolean(d.permitePresencial),
            permiteVideollamada: Boolean(d.permiteVideollamada),
            atiendeParticular: true,
            especialidadIds: Array.isArray(d.especialidadIds) ? d.especialidadIds : [],
            obraSocialIds: Array.isArray(d.obraSocialIds) ? d.obraSocialIds : []
          }
        });
        if (res && res.ok) {
          STATE.profModalOpen = false;
          STATE.profEspPickerOpen = false;
          STATE.profOsPickerOpen = false;
          STATE.editingProfId = null;
          STATE.profDraft = null;
          applyApiResponse(res);
          showToast(res.message || 'Profesional guardado.', false);
          renderWorkspace();
        } else {
          showToast((res && res.message) || 'Error guardando profesional.', true);
        }
      });
    }

    var profCancel = bodyEl.querySelector('#trn-p-cancel');
    if (profCancel) profCancel.addEventListener('click', closeProfModal);
    var profModalClose = bodyEl.querySelector('#trn-p-modal-close');
    if (profModalClose) profModalClose.addEventListener('click', closeProfModal);
    var profBackdrop = bodyEl.querySelector('#trn-prof-modal-backdrop');
    if (profBackdrop) {
      profBackdrop.addEventListener('click', function (ev) {
        if (ev.target === profBackdrop) closeProfModal();
      });
    }

    var openEspPickerBtn = bodyEl.querySelector('#trn-p-open-esp-picker');
    if (openEspPickerBtn) {
      openEspPickerBtn.addEventListener('click', function () {
        syncProfDraftFromDom(bodyEl);
        STATE.profEspPickerOpen = true;
        renderWorkspace();
        var s = document.getElementById('trn-esp-picker-search');
        if (s) s.focus();
      });
    }

    var openOsPickerBtn = bodyEl.querySelector('#trn-p-open-os-picker');
    if (openOsPickerBtn) {
      openOsPickerBtn.addEventListener('click', function () {
        syncProfDraftFromDom(bodyEl);
        STATE.profOsPickerOpen = true;
        renderWorkspace();
        var s = document.getElementById('trn-os-picker-search');
        if (s) s.focus();
      });
    }

    var osAllQuick = bodyEl.querySelector('#trn-p-os-all-quick');
    if (osAllQuick) {
      osAllQuick.addEventListener('change', function () {
        syncProfDraftFromDom(bodyEl);
        if (!STATE.profDraft) return;
        var activeOs = (STATE.data.obrasSociales || []).filter(function (o) { return o.activa; });
        STATE.profDraft.obraSocialIds = osAllQuick.checked
          ? activeOs.map(function (o) { return o.id; })
          : [];
        renderWorkspace();
      });
    }

    // --- Picker Modal: Especialidades en lista ---
    var closeEspPicker = function () {
      STATE.profEspPickerOpen = false;
      renderWorkspace();
    };
    var espPickerBackdrop = bodyEl.querySelector('#trn-prof-esp-picker-backdrop');
    if (espPickerBackdrop) {
      espPickerBackdrop.addEventListener('click', function (ev) {
        if (ev.target === espPickerBackdrop) closeEspPicker();
      });
    }
    var espPickerClose = bodyEl.querySelector('#trn-esp-picker-close');
    if (espPickerClose) espPickerClose.addEventListener('click', closeEspPicker);
    var espPickerDone = bodyEl.querySelector('#trn-esp-picker-done');
    if (espPickerDone) espPickerDone.addEventListener('click', closeEspPicker);

    var updateEspPickerUi = function () {
      if (!STATE.profDraft) return;
      var ids = [];
      bodyEl.querySelectorAll('.trn-prof-esp-chk').forEach(function (chk) {
        var row = chk.closest('.trn-esp-list-row');
        if (chk.checked) {
          ids.push(chk.value);
          if (row) row.style.background = '#ecfdf5';
        } else if (row) {
          row.style.background = '#ffffff';
        }
      });
      STATE.profDraft.especialidadIds = ids;
      var cnt = bodyEl.querySelector('#trn-esp-picker-count');
      if (cnt) cnt.textContent = ids.length + ' seleccionadas';
    };
    bodyEl.querySelectorAll('.trn-prof-esp-chk').forEach(function (chk) {
      chk.addEventListener('change', updateEspPickerUi);
    });
    var espPickerAll = bodyEl.querySelector('#trn-esp-picker-all');
    if (espPickerAll) {
      espPickerAll.addEventListener('click', function () {
        bodyEl.querySelectorAll('.trn-prof-esp-chk').forEach(function (chk) { chk.checked = true; });
        updateEspPickerUi();
      });
    }
    var espPickerNone = bodyEl.querySelector('#trn-esp-picker-none');
    if (espPickerNone) {
      espPickerNone.addEventListener('click', function () {
        bodyEl.querySelectorAll('.trn-prof-esp-chk').forEach(function (chk) { chk.checked = false; });
        updateEspPickerUi();
      });
    }
    var espPickerSearch = bodyEl.querySelector('#trn-esp-picker-search');
    if (espPickerSearch) {
      espPickerSearch.addEventListener('input', function () {
        var q = String(espPickerSearch.value || '').trim().toLowerCase();
        bodyEl.querySelectorAll('.trn-esp-list-row').forEach(function (row) {
          var hay = row.getAttribute('data-search') || '';
          row.style.display = !q || hay.indexOf(q) !== -1 ? 'flex' : 'none';
        });
      });
    }

    // --- Picker Modal: Obras Sociales en lista + Todas ---
    var closeOsPicker = function () {
      STATE.profOsPickerOpen = false;
      renderWorkspace();
    };
    var osPickerBackdrop = bodyEl.querySelector('#trn-prof-os-picker-backdrop');
    if (osPickerBackdrop) {
      osPickerBackdrop.addEventListener('click', function (ev) {
        if (ev.target === osPickerBackdrop) closeOsPicker();
      });
    }
    var osPickerClose = bodyEl.querySelector('#trn-os-picker-close');
    if (osPickerClose) osPickerClose.addEventListener('click', closeOsPicker);
    var osPickerDone = bodyEl.querySelector('#trn-os-picker-done');
    if (osPickerDone) osPickerDone.addEventListener('click', closeOsPicker);

    var updateOsPickerUi = function () {
      if (!STATE.profDraft) return;
      var chks = bodyEl.querySelectorAll('.trn-prof-os-chk');
      var ids = [];
      chks.forEach(function (chk) {
        var row = chk.closest('.trn-os-list-row');
        if (chk.checked) {
          ids.push(chk.value);
          if (row) row.style.background = '#ecfdf5';
        } else if (row) {
          row.style.background = '#ffffff';
        }
      });
      STATE.profDraft.obraSocialIds = ids;
      var cnt = bodyEl.querySelector('#trn-os-picker-count');
      if (cnt) cnt.textContent = ids.length + ' de ' + chks.length + ' seleccionadas';
      var allChk = bodyEl.querySelector('#trn-os-picker-all-chk');
      if (allChk) {
        allChk.checked = chks.length > 0 && ids.length === chks.length;
        var lbl = allChk.closest('label');
        if (lbl) lbl.style.background = allChk.checked ? '#dcfce7' : '#ffffff';
      }
    };
    bodyEl.querySelectorAll('.trn-prof-os-chk').forEach(function (chk) {
      chk.addEventListener('change', updateOsPickerUi);
    });
    var osPickerAllChk = bodyEl.querySelector('#trn-os-picker-all-chk');
    if (osPickerAllChk) {
      osPickerAllChk.addEventListener('change', function () {
        var checked = osPickerAllChk.checked;
        bodyEl.querySelectorAll('.trn-prof-os-chk').forEach(function (chk) { chk.checked = checked; });
        updateOsPickerUi();
      });
    }
    var osPickerSearch = bodyEl.querySelector('#trn-os-picker-search');
    if (osPickerSearch) {
      osPickerSearch.addEventListener('input', function () {
        var q = String(osPickerSearch.value || '').trim().toLowerCase();
        bodyEl.querySelectorAll('.trn-os-list-row').forEach(function (row) {
          var hay = row.getAttribute('data-search') || '';
          row.style.display = !q || hay.indexOf(q) !== -1 ? 'flex' : 'none';
        });
      });
    }

    var profSearch = bodyEl.querySelector('#trn-p-search');
    if (profSearch) profSearch.addEventListener('input', function () {
      STATE.searchProf = profSearch.value;
      renderWorkspace();
      var el = document.getElementById('trn-p-search');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
    bodyEl.querySelectorAll('[data-edit-prof]').forEach(function (b) {
      b.addEventListener('click', function () {
        var pid = b.getAttribute('data-edit-prof');
        var found = (STATE.data.profesionales || []).find(function (p) { return p.id === pid; }) || null;
        STATE.editingProfId = pid;
        STATE.profDraft = createProfDraft(found);
        STATE.profModalOpen = true;
        STATE.profEspPickerOpen = false;
        STATE.profOsPickerOpen = false;
        renderWorkspace();
      });
    });
    bodyEl.querySelectorAll('[data-goto-gest-prof]').forEach(function (b) {
      b.addEventListener('click', function () { syncGestionDraftForProf(b.getAttribute('data-goto-gest-prof')); openTurnosView('gestion_profesionales'); });
    });
    bodyEl.querySelectorAll('[data-toggle-prof]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiTurnos('POST', { action: 'toggle_profesional', id: b.getAttribute('data-toggle-prof') });
        if (res && res.ok) { applyApiResponse(res); renderWorkspace(); }
      });
    });

    // --- ABM Obras Sociales ---
    var osForm = bodyEl.querySelector('#ms-trn-os-form');
    if (osForm) {
      osForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiTurnos('POST', {
          action: 'save_obra_social',
          obraSocial: {
            id: STATE.editingOsId || undefined,
            sigla: bodyEl.querySelector('#trn-os-sigla').value,
            nombre: bodyEl.querySelector('#trn-os-nombre').value,
            tipo: bodyEl.querySelector('#trn-os-tipo').value,
            codigoRnos: bodyEl.querySelector('#trn-os-rnos').value,
            web: bodyEl.querySelector('#trn-os-web').value
          }
        });
        if (res && res.ok) {
          STATE.editingOsId = null;
          applyApiResponse(res);
          showToast(res.message || 'Obra Social guardada.', false);
          renderWorkspace();
        } else showToast((res && res.message) || 'Error guardando Obra Social.', true);
      });
    }
    var osCancel = bodyEl.querySelector('#trn-os-cancel');
    if (osCancel) osCancel.addEventListener('click', function () { STATE.editingOsId = null; renderWorkspace(); });
    var importBtn = bodyEl.querySelector('#trn-import-sssalud-btn');
    if (importBtn) importBtn.addEventListener('click', async function () {
      var res = await apiTurnos('POST', { action: 'import_sssalud_catalog' });
      if (res && res.ok) { applyApiResponse(res); showToast(res.message, false); renderWorkspace(); }
    });
    var osFilterTipo = bodyEl.querySelector('#trn-os-filter-tipo');
    if (osFilterTipo) osFilterTipo.addEventListener('change', function () { STATE.filterOsTipo = osFilterTipo.value; renderWorkspace(); });
    var osSearch = bodyEl.querySelector('#trn-os-search');
    if (osSearch) osSearch.addEventListener('input', function () {
      STATE.searchOs = osSearch.value;
      renderWorkspace();
      var el = document.getElementById('trn-os-search');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
    bodyEl.querySelectorAll('[data-edit-os]').forEach(function (b) {
      b.addEventListener('click', function () { STATE.editingOsId = b.getAttribute('data-edit-os'); renderWorkspace(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    });
    bodyEl.querySelectorAll('[data-goto-planes-os]').forEach(function (b) {
      b.addEventListener('click', function () { STATE.selectedPlanOsId = b.getAttribute('data-goto-planes-os'); openTurnosView('planes'); });
    });
    bodyEl.querySelectorAll('[data-toggle-os]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiTurnos('POST', { action: 'toggle_obra_social', id: b.getAttribute('data-toggle-os') });
        if (res && res.ok) { applyApiResponse(res); renderWorkspace(); }
      });
    });

    // --- ABM Planes ---
    var planOsSel = bodyEl.querySelector('#trn-plan-os-filter');
    if (planOsSel) planOsSel.addEventListener('change', function () { STATE.selectedPlanOsId = planOsSel.value; STATE.editingPlanId = null; renderWorkspace(); });
    var planForm = bodyEl.querySelector('#ms-trn-plan-form');
    if (planForm) {
      planForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiTurnos('POST', {
          action: 'save_plan',
          plan: {
            id: STATE.editingPlanId || undefined,
            obraSocialId: STATE.selectedPlanOsId,
            nombre: bodyEl.querySelector('#trn-pl-nombre').value,
            codigo: bodyEl.querySelector('#trn-pl-cod').value,
            copagoSugeridoArs: Number(bodyEl.querySelector('#trn-pl-copago').value || 0),
            requiereAutorizacion: bodyEl.querySelector('#trn-pl-aut').checked
          }
        });
        if (res && res.ok) {
          STATE.editingPlanId = null;
          applyApiResponse(res);
          showToast(res.message || 'Plan guardado.', false);
          renderWorkspace();
        } else showToast((res && res.message) || 'Error guardando plan.', true);
      });
    }
    var plCancel = bodyEl.querySelector('#trn-pl-cancel');
    if (plCancel) plCancel.addEventListener('click', function () { STATE.editingPlanId = null; renderWorkspace(); });
    bodyEl.querySelectorAll('[data-edit-plan]').forEach(function (b) {
      b.addEventListener('click', function () { STATE.editingPlanId = b.getAttribute('data-edit-plan'); renderWorkspace(); });
    });
    bodyEl.querySelectorAll('[data-toggle-plan]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiTurnos('POST', { action: 'toggle_plan', id: b.getAttribute('data-toggle-plan') });
        if (res && res.ok) { applyApiResponse(res); renderWorkspace(); }
      });
    });

    // --- ABM Especialidades (Ventana Emergente + Categoría + Paginación 10 en 10) ---
    var closeEspModalFn = function () {
      STATE.espModalOpen = false;
      STATE.editingEspId = null;
      renderWorkspace();
    };
    var openNewEspBtn = bodyEl.querySelector('#trn-e-open-new');
    if (openNewEspBtn) {
      openNewEspBtn.addEventListener('click', function () {
        STATE.editingEspId = null;
        STATE.espModalOpen = true;
        renderWorkspace();
        var nInp = document.getElementById('trn-e-nombre');
        if (nInp) nInp.focus();
      });
    }
    var eModalClose = bodyEl.querySelector('#trn-e-modal-close');
    if (eModalClose) eModalClose.addEventListener('click', closeEspModalFn);
    var eCancel = bodyEl.querySelector('#trn-e-cancel');
    if (eCancel) eCancel.addEventListener('click', closeEspModalFn);
    var eBackdrop = bodyEl.querySelector('#trn-esp-modal-backdrop');
    if (eBackdrop) {
      eBackdrop.addEventListener('click', function (ev) {
        if (ev.target === eBackdrop) closeEspModalFn();
      });
    }
    var eCatPick = bodyEl.querySelector('#trn-e-cat-pick');
    if (eCatPick) {
      eCatPick.addEventListener('change', function () {
        if (eCatPick.value) {
          var cInp = bodyEl.querySelector('#trn-e-cat');
          if (cInp) cInp.value = eCatPick.value;
        }
      });
    }
    var espForm = bodyEl.querySelector('#ms-trn-esp-form');
    if (espForm) {
      espForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var actChk = bodyEl.querySelector('#trn-e-act');
        var res = await apiTurnos('POST', {
          action: 'save_especialidad',
          especialidad: {
            id: STATE.editingEspId || undefined,
            nombre: bodyEl.querySelector('#trn-e-nombre').value,
            categoria: bodyEl.querySelector('#trn-e-cat').value,
            duracionMinutos: Number(bodyEl.querySelector('#trn-e-dur').value || 20),
            valorConsultaParticularSugeridoArs: Number(bodyEl.querySelector('#trn-e-val').value || 0),
            descripcion: bodyEl.querySelector('#trn-e-desc').value,
            permiteVideollamada: bodyEl.querySelector('#trn-e-vid').checked,
            activa: actChk ? actChk.checked : true
          }
        });
        if (res && res.ok) {
          STATE.editingEspId = null;
          STATE.espModalOpen = false;
          applyApiResponse(res);
          showToast(res.message || 'Especialidad guardada.', false);
          renderWorkspace();
        } else showToast((res && res.message) || 'Error guardando especialidad.', true);
      });
    }
    var eFilterCat = bodyEl.querySelector('#trn-e-filter-cat');
    if (eFilterCat) {
      eFilterCat.addEventListener('change', function () {
        STATE.filterEspCat = eFilterCat.value;
        STATE.espPage = 1;
        renderWorkspace();
      });
    }
    var eSearch = bodyEl.querySelector('#trn-e-search');
    if (eSearch) eSearch.addEventListener('input', function () {
      STATE.searchEsp = eSearch.value;
      STATE.espPage = 1;
      renderWorkspace();
      var el = document.getElementById('trn-e-search');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
    bodyEl.querySelectorAll('[data-esp-page]').forEach(function (pb) {
      pb.addEventListener('click', function () {
        var nextP = Number(pb.getAttribute('data-esp-page') || 1);
        if (nextP && nextP !== STATE.espPage) {
          STATE.espPage = nextP;
          renderWorkspace();
        }
      });
    });
    bodyEl.querySelectorAll('[data-edit-esp]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.editingEspId = b.getAttribute('data-edit-esp');
        STATE.espModalOpen = true;
        renderWorkspace();
        var nInp = document.getElementById('trn-e-nombre');
        if (nInp) nInp.focus();
      });
    });
    bodyEl.querySelectorAll('[data-toggle-esp]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiTurnos('POST', { action: 'toggle_especialidad', id: b.getAttribute('data-toggle-esp') });
        if (res && res.ok) { applyApiResponse(res); renderWorkspace(); }
      });
    });

    // --- Gestión de Profesionales ---
    var goAbmProf = bodyEl.querySelector('#trn-go-abm-prof');
    if (goAbmProf) goAbmProf.addEventListener('click', function () { openTurnosView('profesionales'); });
    var gestProfSel = bodyEl.querySelector('#trn-gest-prof-sel');
    if (gestProfSel) gestProfSel.addEventListener('change', function () { syncGestionDraftForProf(gestProfSel.value); renderWorkspace(); });
    var gestEspPrev = bodyEl.querySelector('#trn-gest-esp-prev');
    if (gestEspPrev) gestEspPrev.addEventListener('change', function () { STATE.gestionPreviewEspId = gestEspPrev.value; renderWorkspace(); });

    var addRngBtn = bodyEl.querySelector('#trn-rng-add-btn');
    if (addRngBtn) {
      addRngBtn.addEventListener('click', function () {
        var ini = bodyEl.querySelector('#trn-rng-ini').value;
        var fin = bodyEl.querySelector('#trn-rng-fin').value;
        if (timeToMin(ini) < 0 || timeToMin(fin) <= timeToMin(ini)) {
          showToast('La hora fin debe ser mayor a la hora inicio.', true);
          return;
        }
        STATE.gestionHorariosDraft.push({
          id: 'rng_' + Date.now(),
          diaSemana: Number(bodyEl.querySelector('#trn-rng-dia').value),
          horaInicio: ini,
          horaFin: fin,
          modalidad: bodyEl.querySelector('#trn-rng-mod').value,
          consultorio: bodyEl.querySelector('#trn-rng-cons').value,
          slotsDeshabilitados: [],
          activo: true
        });
        renderWorkspace();
      });
    }
    bodyEl.querySelectorAll('[data-del-rango-idx]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.gestionHorariosDraft.splice(Number(b.getAttribute('data-del-rango-idx')), 1);
        renderWorkspace();
      });
    });
    bodyEl.querySelectorAll('[data-toggle-slot-idx]').forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = Number(b.getAttribute('data-toggle-slot-idx'));
        var hh = b.getAttribute('data-slot-time');
        var rng = STATE.gestionHorariosDraft[idx];
        if (!rng) return;
        if (!Array.isArray(rng.slotsDeshabilitados)) rng.slotsDeshabilitados = [];
        var pos = rng.slotsDeshabilitados.indexOf(hh);
        if (pos >= 0) rng.slotsDeshabilitados.splice(pos, 1);
        else rng.slotsDeshabilitados.push(hh);
        renderWorkspace();
      });
    });
    bodyEl.querySelectorAll('.trn-gest-os-chk').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var val = chk.value;
        var pos = STATE.gestionObrasDraft.indexOf(val);
        if (chk.checked && pos === -1) STATE.gestionObrasDraft.push(val);
        if (!chk.checked && pos >= 0) STATE.gestionObrasDraft.splice(pos, 1);
      });
    });
    var selAllOs = bodyEl.querySelector('#trn-os-sel-all');
    if (selAllOs) selAllOs.addEventListener('click', function () {
      STATE.gestionObrasDraft = (STATE.data.obrasSociales || []).filter(function (o) { return o.activa; }).map(function (o) { return o.id; });
      renderWorkspace();
    });
    var selPrepOs = bodyEl.querySelector('#trn-os-sel-prep');
    if (selPrepOs) selPrepOs.addEventListener('click', function () {
      STATE.gestionObrasDraft = (STATE.data.obrasSociales || []).filter(function (o) { return o.activa && o.tipo === 'PREPAGA'; }).map(function (o) { return o.id; });
      renderWorkspace();
    });
    var selNoneOs = bodyEl.querySelector('#trn-os-sel-none');
    if (selNoneOs) selNoneOs.addEventListener('click', function () { STATE.gestionObrasDraft = []; renderWorkspace(); });

    var saveGestBtn = bodyEl.querySelector('#trn-gest-save-all');
    if (saveGestBtn) {
      saveGestBtn.addEventListener('click', async function () {
        var res = await apiTurnos('POST', {
          action: 'save_profesional_gestion',
          profesionalId: STATE.gestionProfId,
          horarios: STATE.gestionHorariosDraft,
          obraSocialIds: STATE.gestionObrasDraft,
          atiendeParticular: bodyEl.querySelector('#trn-gest-part').checked,
          valorConsultaParticularArs: Number(bodyEl.querySelector('#trn-gest-val').value || 0)
        });
        if (res && res.ok) {
          applyApiResponse(res);
          showToast(res.message || 'Agenda guardada.', false);
          renderWorkspace();
        } else showToast((res && res.message) || 'Error guardando gestión.', true);
      });
    }

    var blqForm = bodyEl.querySelector('#ms-trn-blq-form');
    if (blqForm) {
      blqForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiTurnos('POST', {
          action: 'save_bloqueo',
          bloqueo: {
            profesionalId: bodyEl.querySelector('#trn-blq-all').checked ? '*' : STATE.gestionProfId,
            fechaDesde: bodyEl.querySelector('#trn-blq-desde').value,
            fechaHasta: bodyEl.querySelector('#trn-blq-hasta').value,
            motivo: bodyEl.querySelector('#trn-blq-mot').value
          }
        });
        if (res && res.ok) { applyApiResponse(res); showToast('Bloqueo registrado.', false); renderWorkspace(); }
      });
    }
    bodyEl.querySelectorAll('[data-del-blq]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiTurnos('POST', { action: 'delete_bloqueo', id: b.getAttribute('data-del-blq') });
        if (res && res.ok) { applyApiResponse(res); renderWorkspace(); }
      });
    });

    // --- Gestión de Pacientes ---
    var pacDniBtn = bodyEl.querySelector('#trn-pac-dni-btn');
    if (pacDniBtn) {
      pacDniBtn.addEventListener('click', async function () {
        var dniVal = bodyEl.querySelector('#trn-pac-dni').value;
        var res = await apiTurnos('GET', { action: 'lookup_dni', dni: dniVal });
        if (res && res.found && res.paciente) {
          var p = res.paciente;
          if (p.apellidos) bodyEl.querySelector('#trn-pac-ap').value = p.apellidos;
          if (p.nombres) bodyEl.querySelector('#trn-pac-nom').value = p.nombres;
          if (p.fechaNacimiento) bodyEl.querySelector('#trn-pac-nac').value = p.fechaNacimiento;
          if (p.whatsapp) bodyEl.querySelector('#trn-pac-wa').value = p.whatsapp;
          if (p.email) bodyEl.querySelector('#trn-pac-email').value = p.email;
          if (p.domicilio) bodyEl.querySelector('#trn-pac-dom').value = p.domicilio;
          showToast('Datos recuperados automáticamente (' + res.source + ').', false);
        } else {
          showToast('Sin datos previos para ese DNI. Completalos manualmente.', false);
        }
      });
    }
    var pacForm = bodyEl.querySelector('#ms-trn-pac-form');
    if (pacForm) {
      pacForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiTurnos('POST', {
          action: 'save_paciente',
          paciente: {
            id: STATE.editingPacId || undefined,
            dni: bodyEl.querySelector('#trn-pac-dni').value,
            apellidos: bodyEl.querySelector('#trn-pac-ap').value,
            nombres: bodyEl.querySelector('#trn-pac-nom').value,
            fechaNacimiento: bodyEl.querySelector('#trn-pac-nac').value,
            whatsapp: bodyEl.querySelector('#trn-pac-wa').value,
            email: bodyEl.querySelector('#trn-pac-email').value,
            domicilio: bodyEl.querySelector('#trn-pac-dom').value,
            obraSocialId: bodyEl.querySelector('#trn-pac-os').value,
            planId: bodyEl.querySelector('#trn-pac-plan').value,
            nroAfiliado: bodyEl.querySelector('#trn-pac-af').value
          }
        });
        if (res && res.ok) {
          STATE.editingPacId = null;
          applyApiResponse(res);
          showToast(res.message || 'Paciente guardado.', false);
          renderWorkspace();
        } else showToast((res && res.message) || 'Error guardando paciente.', true);
      });
    }
    var pacCancel = bodyEl.querySelector('#trn-pac-cancel');
    if (pacCancel) pacCancel.addEventListener('click', function () { STATE.editingPacId = null; renderWorkspace(); });
    var pacSearch = bodyEl.querySelector('#trn-pac-search');
    if (pacSearch) pacSearch.addEventListener('input', function () {
      STATE.searchPac = pacSearch.value;
      renderWorkspace();
      var el = document.getElementById('trn-pac-search');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
    bodyEl.querySelectorAll('[data-edit-pac]').forEach(function (b) {
      b.addEventListener('click', function () { STATE.editingPacId = b.getAttribute('data-edit-pac'); renderWorkspace(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    });

    // --- Gestión de Turnos ---
    bodyEl.querySelectorAll('[data-trn-modo]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.filterTurnoModo = b.getAttribute('data-trn-modo');
        STATE.filterTurnoFecha = '';
        renderWorkspace();
      });
    });
    var fFecha = bodyEl.querySelector('#trn-f-fecha');
    if (fFecha) fFecha.addEventListener('change', function () { STATE.filterTurnoFecha = fFecha.value; renderWorkspace(); });
    var fProf = bodyEl.querySelector('#trn-f-prof');
    if (fProf) fProf.addEventListener('change', function () { STATE.filterTurnoProf = fProf.value; renderWorkspace(); });
    var fEst = bodyEl.querySelector('#trn-f-est');
    if (fEst) fEst.addEventListener('change', function () { STATE.filterTurnoEstado = fEst.value; renderWorkspace(); });
    var fSearch = bodyEl.querySelector('#trn-f-search');
    if (fSearch) fSearch.addEventListener('input', function () {
      STATE.searchTurno = fSearch.value;
      renderWorkspace();
      var el = document.getElementById('trn-f-search');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });

    var openManual = bodyEl.querySelector('#trn-open-manual-btn');
    if (openManual) openManual.addEventListener('click', function () { STATE.manualTurnoOpen = true; renderWorkspace(); });
    var closeManual = bodyEl.querySelector('#trn-close-manual-btn');
    if (closeManual) closeManual.addEventListener('click', function () { STATE.manualTurnoOpen = false; renderWorkspace(); });

    ['#tm-esp', '#tm-prof', '#tm-fecha', '#tm-mod', '#tm-cob', '#tm-os', '#tm-sobre'].forEach(function (sel) {
      var el = bodyEl.querySelector(sel);
      if (!el) return;
      el.addEventListener('change', async function () {
        STATE.manualForm.especialidadId = bodyEl.querySelector('#tm-esp').value;
        STATE.manualForm.profesionalId = bodyEl.querySelector('#tm-prof').value;
        STATE.manualForm.fecha = bodyEl.querySelector('#tm-fecha').value;
        STATE.manualForm.modalidad = bodyEl.querySelector('#tm-mod').value;
        STATE.manualForm.coberturaTipo = bodyEl.querySelector('#tm-cob').value;
        STATE.manualForm.esSobreturno = bodyEl.querySelector('#tm-sobre').checked;
        var osEl = bodyEl.querySelector('#tm-os');
        if (osEl) STATE.manualForm.obraSocialId = osEl.value;
        await refreshManualSlots();
        renderWorkspace();
      });
    });

    bodyEl.querySelectorAll('[data-pick-manual-hora]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.manualSelectedHora = b.getAttribute('data-pick-manual-hora');
        var hInp = bodyEl.querySelector('#tm-hora');
        if (hInp) hInp.value = STATE.manualSelectedHora;
        renderWorkspace();
      });
    });

    var tmDniLookup = bodyEl.querySelector('#tm-dni-lookup');
    if (tmDniLookup) {
      tmDniLookup.addEventListener('click', async function () {
        var dniVal = bodyEl.querySelector('#tm-dni').value;
        STATE.manualForm.pacienteDni = dniVal;
        var res = await apiTurnos('GET', { action: 'lookup_dni', dni: dniVal });
        if (res && res.found && res.paciente) {
          STATE.manualForm.pacienteApellidos = res.paciente.apellidos || '';
          STATE.manualForm.pacienteNombres = res.paciente.nombres || '';
          STATE.manualForm.pacienteWhatsapp = res.paciente.whatsapp || '';
          STATE.manualForm.pacienteFechaNacimiento = res.paciente.fechaNacimiento || '';
          if (res.paciente.obraSocialId) STATE.manualForm.obraSocialId = res.paciente.obraSocialId;
          if (res.paciente.planId) STATE.manualForm.planId = res.paciente.planId;
          showToast('Paciente encontrado (' + res.source + ').', false);
          renderWorkspace();
        } else showToast('DNI nuevo: completá Apellido y Nombre para registrarlo automáticamente.', false);
      });
    }

    var manualForm = bodyEl.querySelector('#ms-trn-manual-form');
    if (manualForm) {
      manualForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var osEl = bodyEl.querySelector('#tm-os');
        var plEl = bodyEl.querySelector('#tm-plan');
        var res = await apiTurnos('POST', {
          action: 'create_turno_manual',
          turno: {
            especialidadId: bodyEl.querySelector('#tm-esp').value,
            profesionalId: bodyEl.querySelector('#tm-prof').value,
            fecha: bodyEl.querySelector('#tm-fecha').value,
            horaInicio: bodyEl.querySelector('#tm-hora').value,
            modalidad: bodyEl.querySelector('#tm-mod').value,
            esSobreturno: bodyEl.querySelector('#tm-sobre').checked,
            coberturaTipo: bodyEl.querySelector('#tm-cob').value,
            obraSocialId: osEl ? osEl.value : '',
            planId: plEl ? plEl.value : '',
            pacienteDni: bodyEl.querySelector('#tm-dni').value,
            pacienteApellidos: bodyEl.querySelector('#tm-ap').value,
            pacienteNombres: bodyEl.querySelector('#tm-nom').value,
            pacienteWhatsapp: bodyEl.querySelector('#tm-wa').value
          }
        });
        if (res && res.ok) {
          STATE.manualTurnoOpen = false;
          STATE.manualSelectedHora = '';
          STATE.manualForm.pacienteDni = '';
          STATE.manualForm.pacienteApellidos = '';
          STATE.manualForm.pacienteNombres = '';
          STATE.manualForm.pacienteWhatsapp = '';
          applyApiResponse(res);
          showToast(res.message || 'Turno asignado.', false);
          renderWorkspace();
        } else showToast((res && res.message) || 'Error asignando turno.', true);
      });
    }

    bodyEl.querySelectorAll('[data-change-turno-estado]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        var res = await apiTurnos('POST', {
          action: 'update_turno_estado',
          id: sel.getAttribute('data-change-turno-estado'),
          estado: sel.value
        });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message, false); renderWorkspace(); }
      });
    });

    bodyEl.querySelectorAll('[data-mark-paid]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiTurnos('POST', { action: 'mark_turno_paid_manual', id: b.getAttribute('data-mark-paid') });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message, false); renderWorkspace(); }
      });
    });

    // --- Pagos & Split Mercado Pago ---
    var splitForm = bodyEl.querySelector('#ms-trn-split-form');
    if (splitForm) {
      splitForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiTurnos('POST', {
          action: 'save_split_config',
          splitConfig: {
            organizadorTipo: bodyEl.querySelector('#sp-org-tipo').value,
            organizadorNombre: bodyEl.querySelector('#sp-org-nom').value,
            mpOrganizadorAlias: bodyEl.querySelector('#sp-org-alias').value,
            defaultOrganizadorPct: Number(bodyEl.querySelector('#sp-pct-def').value || 0),
            presencialOrganizadorPct: Number(bodyEl.querySelector('#sp-pct-pres').value || 0),
            videollamadaOrganizadorPct: Number(bodyEl.querySelector('#sp-pct-vid').value || 0),
            habilitarPagoOnlineParticular: bodyEl.querySelector('#sp-enable').checked,
            pagoObligatorioParaConfirmarParticular: bodyEl.querySelector('#sp-req').checked
          }
        });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message, false); renderWorkspace(); }
      });
    }
    bodyEl.querySelectorAll('[data-save-exc]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var pid = b.getAttribute('data-save-exc');
        var inp = document.getElementById('exc-pct-' + pid);
        var res = await apiTurnos('POST', {
          action: 'save_profesional_split_exception',
          profesionalId: pid,
          organizadorPct: Number(inp ? inp.value : 20),
          motivo: 'Porcentaje personalizado'
        });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message, false); renderWorkspace(); }
      });
    });
    bodyEl.querySelectorAll('[data-del-exc]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiTurnos('POST', { action: 'delete_profesional_split_exception', profesionalId: b.getAttribute('data-del-exc') });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message, false); renderWorkspace(); }
      });
    });
    bodyEl.querySelectorAll('[data-mp-connect]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var pid = b.getAttribute('data-mp-connect');
        var alias = window.prompt('Ingresá el Alias de Mercado Pago del profesional (opcional):', '') || '';
        var res = await apiTurnos('POST', { action: 'connect_profesional_mp', profesionalId: pid, mpAccountAlias: alias });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message, false); renderWorkspace(); }
      });
    });
    bodyEl.querySelectorAll('[data-mp-disconnect]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiTurnos('POST', { action: 'disconnect_profesional_mp', profesionalId: b.getAttribute('data-mp-disconnect') });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message, false); renderWorkspace(); }
      });
    });
    var csvBtn = bodyEl.querySelector('#trn-export-csv-btn');
    if (csvBtn) {
      csvBtn.addEventListener('click', function () {
        var rowsCsv = [['Turno', 'Fecha', 'Hora', 'Profesional', 'Especialidad', 'Paciente', 'DNI', 'Total_ARS', 'Organizador_ARS', 'Profesional_Bruto_ARS', 'Estado']];
        (STATE.data.transaccionesMp || []).forEach(function (tx) {
          rowsCsv.push([tx.turnoCodigo, tx.fechaTurno, tx.horaTurno, tx.profesionalNombre, tx.especialidadNombre, tx.pacienteNombre, tx.pacienteDni, tx.montoTotalArs, tx.organizadorFeeArs, tx.profesionalBrutoArs, tx.status]);
        });
        var csv = rowsCsv.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'liquidacion_turnos_particular_' + todayIso() + '.csv';
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // --- Portal Config & Copy ---
    var copyBtn = bodyEl.querySelector('#trn-copy-link-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var url = copyBtn.getAttribute('data-url') || '';
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url);
          showToast('Enlace del Turnero Web copiado al portapapeles.', false);
        }
      });
    }
    var portalForm = bodyEl.querySelector('#ms-trn-portal-form');
    if (portalForm) {
      portalForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiTurnos('POST', {
          action: 'save_portal_config',
          portalConfig: {
            direccionConsultorio: bodyEl.querySelector('#pc-dir').value,
            whatsappRecepcion: bodyEl.querySelector('#pc-wa').value,
            emailRecepcion: bodyEl.querySelector('#pc-email').value,
            diasAnticipacionMax: Number(bodyEl.querySelector('#pc-dias').value || 60),
            mensajeConfirmacion: bodyEl.querySelector('#pc-msg').value
          }
        });
        if (res && res.ok) { applyApiResponse(res); showToast(res.message, false); }
      });
    }
  }

  function bindGlobalTurnosNavReset() {
    if (window.__MS_TURNOS_NAV_BOUND__) return;
    window.__MS_TURNOS_NAV_BOUND__ = true;
    document.addEventListener(
      'click',
      function (ev) {
        var t = ev.target;
        if (!t || typeof t.closest !== 'function') return;
        var navTrigger = t.closest('#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-cv-home-card, #ms-personal-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card');
        if (navTrigger) {
          var m = document.getElementById('sec-menu-turnos');
          var w = document.getElementById('sec-turnos-workspace');
          var isTurnosActive = (m && !m.hidden) || (w && !w.hidden);

          if (navTrigger.id === 'btn-topbar-back-facturacion' && isTurnosActive) {
            ev.preventDefault();
            ev.stopPropagation();
            if (w && !w.hidden) {
              openTurnosView('menu');
            } else {
              closeTurnosToHome();
            }
            return;
          }

          if (m) m.hidden = true;
          if (w) w.hidden = true;
        }
      },
      true
    );
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (STATE.activeView !== 'profesionales' || !STATE.profModalOpen) return;
      if (STATE.profOsPickerOpen) {
        STATE.profOsPickerOpen = false;
        renderWorkspace();
      } else if (STATE.profEspPickerOpen) {
        STATE.profEspPickerOpen = false;
        renderWorkspace();
      } else {
        STATE.profModalOpen = false;
        STATE.editingProfId = null;
        STATE.profDraft = null;
        renderWorkspace();
      }
    });
  }

  var initialLoaded = false;

  window.__MS_OPEN_TURNOS_MENU__ = function () {
    openTurnosView('menu');
  };

  function syncTurnosHomeCard() {
    bindGlobalTurnosNavReset();
    var allowed = isTurnosModuleAllowed();
    var ownedByConsultorios = Boolean(window.__MS_GESTION_CONSULTORIOS_OWNS_TURNOS__);
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existingCard = document.getElementById('ms-turnos-home-card');

    if (ownedByConsultorios) {
      if (existingCard) {
        existingCard.hidden = true;
        existingCard.style.display = 'none';
      }
      if (allowed && !initialLoaded) {
        initialLoaded = true;
        reloadTurnosData(false);
      }
      return;
    }

    if (allowed && inicioGrid && !existingCard) {
      var card = document.createElement('article');
      card.id = 'ms-turnos-home-card';
      card.className = 'module-card';
      card.setAttribute('data-module-key', 'turnos');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>' +
            '<line x1="16" y1="2" x2="16" y2="6"></line>' +
            '<line x1="8" y1="2" x2="8" y2="6"></line>' +
            '<line x1="3" y1="10" x2="21" y2="10"></line>' +
            '<path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path>' +
            '<path d="M8 18h.01"></path><path d="M12 18h.01"></path>' +
          '</svg>' +
        '</div>' +
        '<h3>Turnero Web</h3>';

      card.addEventListener('click', function () {
        openTurnosView('menu');
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openTurnosView('menu');
        }
      });

      var perfilCard = inicioGrid.querySelector('[data-module-key="perfil"]');
      if (perfilCard) {
        inicioGrid.insertBefore(card, perfilCard);
      } else {
        inicioGrid.appendChild(card);
      }

      if (!initialLoaded) {
        initialLoaded = true;
        reloadTurnosData(false);
      }
    } else if (existingCard) {
      existingCard.hidden = !allowed;
      existingCard.style.display = allowed ? '' : 'none';
    }
  }

  setInterval(syncTurnosHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncTurnosHomeCard);
})();
