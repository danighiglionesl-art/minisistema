/* ==========================================================================
   MÓDULO PADRE "GESTIÓN CONSULTORIOS" — MINISISTEMA ERP
   Agrupa:
   1. Turnero Web (vinculado a turnos-module.js)
   2. Historia Clínica (Fichas Médicas, Evoluciones SOAP, Signos Vitales,
      Estudios Adjuntos visibles en Portal Pacientes y Recetas Digitales)
   ========================================================================== */
(function () {
  'use strict';

  window.__MS_GESTION_CONSULTORIOS_OWNS_TURNOS__ = true;
  window.__MS_GESTION_CONSULTORIOS_OWNS_GESTION_WEB__ = true;

  var ESTUDIO_TIPOS = [
    'Laboratorio',
    'Ecografía',
    'Cardiología',
    'Radiología',
    'Diagnóstico por Imágenes',
    'Circuito Integral',
    'EMMAC',
    'Informe Médico',
    'Otro'
  ];

  var STATE = {
    publicCemepUrl: '/cemep',
    hcTab: 'fichas', // 'fichas' | 'estudios' | 'recetas'
    selectedPacDni: '',
    selectedPacName: '',
    selectedPacId: '',
    searchPac: '',
    stats: {},
    historiaClinica: { fichas: [], evoluciones: [], estudios: [], recetas: [] },
    turnosRef: { pacientes: [], profesionales: [], especialidades: [], turnosRecientes: [] }
  };

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

  function isConsultoriosAllowed() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    if (String(u.username).toLowerCase() === 'danielg' || u.role === 'Administrador General') {
      return true;
    }
    var brandMods = (window.ERP_BRAND && window.ERP_BRAND.enabledModules) || [];
    if (
      Array.isArray(brandMods) &&
      brandMods.length > 0 &&
      brandMods.indexOf('turnos') === -1 &&
      brandMods.indexOf('gestion_consultorios') === -1 &&
      brandMods.indexOf('historia_clinica') === -1 &&
      brandMods.indexOf('gestion_web') === -1
    ) {
      return false;
    }
    if (u.role === 'Administrador') return true;
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return uMods.some(function (k) {
      var s = String(k || '');
      return (
        s === 'gestion_consultorios' ||
        s === 'turnos' ||
        s === 'historia_clinica' ||
        s === 'gestion_web' ||
        s.indexOf('turnos:') === 0 ||
        s.indexOf('historia_clinica:') === 0 ||
        s.indexOf('gestion_web:') === 0
      );
    });
  }

  async function apiConsultorios(method, body) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (method === 'GET') delete opts.headers['Content-Type'];
    else opts.body = JSON.stringify(body || {});
    var res = await fetch('/sistema/api/consultorios.php', opts);
    return res.json();
  }

  function applyRes(res) {
    if (!res || !res.ok) return;
    if (res.publicCemepUrl) STATE.publicCemepUrl = res.publicCemepUrl;
    if (res.stats) STATE.stats = res.stats;
    if (res.historiaClinica) STATE.historiaClinica = res.historiaClinica;
    if (res.turnosRef) STATE.turnosRef = res.turnosRef;
    syncHubPills();
  }

  async function reloadData(rerender) {
    try {
      var res = await apiConsultorios('GET');
      if (res && res.ok) {
        applyRes(res);
        if (rerender) renderHcBody();
      }
    } catch (_e) {}
  }

  function showToast(msg, isErr) {
    var el = document.getElementById('ms-hc-toast');
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

  function closeToHome() {
    hideAllErpSections();
    var inicio = document.getElementById('sec-inicio');
    if (inicio) inicio.hidden = false;
    updateTopbarState(false);
  }

  function syncHubPills() {
    var pTurnos = document.getElementById('ms-gc-pill-turnos');
    var pHc = document.getElementById('ms-gc-pill-hc');
    var pHome = document.getElementById('ms-gc-home-pill');
    if (pTurnos) pTurnos.textContent = (STATE.stats.totalTurnos || 0) + ' turnos';
    if (pHc) pHc.textContent = (STATE.stats.totalEvoluciones || 0) + ' evol.';
    if (pHome) {
      var pend = STATE.stats.recetasPendientes || 0;
      pHome.textContent = pend > 0 ? pend + ' RECETAS PEND.' : 'TURNOS + HC';
    }
    var linkTop = document.getElementById('ms-gc-open-cemep-link');
    if (linkTop && STATE.publicCemepUrl) linkTop.href = STATE.publicCemepUrl;
  }

  function ensureSectionsMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var menuSec = document.getElementById('sec-menu-gestion-consultorios');
    var hcSec = document.getElementById('sec-hc-workspace');

    if (!menuSec) {
      menuSec = document.createElement('section');
      menuSec.id = 'sec-menu-gestion-consultorios';
      menuSec.className = 'erp-section';
      menuSec.hidden = true;
      menuSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-gc-back-home-btn">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">ERP en Línea · <strong>Gestión Consultorios</strong></span>' +
          '</div>' +
          '<a href="/cemep" target="_blank" class="ms-sa-btn" style="padding:0.42rem 0.9rem;font-size:0.8rem;" id="ms-gc-open-cemep-link">🌐 Abrir Portal CEMEP (/cemep) ↗</a>' +
        '</div>' +
        '<div class="modules-grid" aria-label="Submódulos de Gestión Consultorios">' +
          '<article class="module-card" id="ms-gc-open-turnero" role="button" tabindex="0" style="cursor:pointer;">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>' +
            '</div>' +
            '<h3>Turnero Web</h3>' +
          '</article>' +
          '<article class="module-card" id="ms-gc-open-hc" role="button" tabindex="0" style="cursor:pointer;">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>' +
            '</div>' +
            '<h3>Historia Clínica</h3>' +
          '</article>' +
          '<article class="module-card" id="ms-gc-jump-web" role="button" tabindex="0" style="cursor:pointer;">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>' +
            '</div>' +
            '<h3>Gestión Web</h3>' +
          '</article>' +
        '</div>';

      erpMain.appendChild(menuSec);
      menuSec.querySelector('#ms-gc-back-home-btn').addEventListener('click', closeToHome);
      var openTurneroFn = function () {
        if (typeof window.__MS_OPEN_TURNOS_MENU__ === 'function') {
          window.__MS_OPEN_TURNOS_MENU__();
        }
      };
      var openHcFn = function () {
        openHistoriaClinica('fichas');
      };
      var jumpWebFn = function () {
        if (typeof window.__MS_OPEN_GESTION_WEB__ === 'function') {
          window.__MS_OPEN_GESTION_WEB__('menu');
        }
      };
      var bindCardActivation = function (el, fn) {
        if (!el) return;
        el.addEventListener('click', fn);
        el.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            fn();
          }
        });
      };
      bindCardActivation(menuSec.querySelector('#ms-gc-open-turnero'), openTurneroFn);
      bindCardActivation(menuSec.querySelector('#ms-gc-open-hc'), openHcFn);
      bindCardActivation(menuSec.querySelector('#ms-gc-jump-web'), jumpWebFn);
    }

    if (!hcSec) {
      hcSec = document.createElement('section');
      hcSec.id = 'sec-hc-workspace';
      hcSec.className = 'erp-section';
      hcSec.hidden = true;
      hcSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-hc-back-gc-btn">← Volver a Gestión Consultorios</button>' +
            '<span class="module-breadcrumb">Gestión Consultorios · <strong>Historia Clínica Integral</strong></span>' +
          '</div>' +
          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-hc-refresh-btn" style="padding:0.38rem 0.8rem;font-size:0.78rem;">🔄 Actualizar</button>' +
        '</div>' +
        '<div id="ms-hc-toast" style="display:none;margin-bottom:0.9rem;padding:0.7rem 1rem;border-radius:10px;font-weight:700;font-size:0.85rem;"></div>' +
        '<div id="ms-hc-body"></div>';

      erpMain.appendChild(hcSec);
      hcSec.querySelector('#ms-hc-back-gc-btn').addEventListener('click', openGestionConsultoriosMenu);
      hcSec.querySelector('#ms-hc-refresh-btn').addEventListener('click', function () {
        reloadData(true);
      });
    }

    return { menuSec: menuSec, hcSec: hcSec };
  }

  function openGestionConsultoriosMenu() {
    bindGlobalNavReset();
    var mounted = ensureSectionsMounted();
    if (!mounted) return;
    hideAllErpSections();
    mounted.menuSec.hidden = false;
    updateTopbarState(true, 'Gestión Consultorios');
    reloadData(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openHistoriaClinica(tab) {
    bindGlobalNavReset();
    var mounted = ensureSectionsMounted();
    if (!mounted) return;
    STATE.hcTab = tab || 'fichas';
    hideAllErpSections();
    mounted.hcSec.hidden = false;
    updateTopbarState(true, 'Gestión Consultorios · Historia Clínica');
    renderHcBody();
    reloadData(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.__MS_OPEN_GESTION_CONSULTORIOS__ = openGestionConsultoriosMenu;
  window.__MS_OPEN_HISTORIA_CLINICA__ = openHistoriaClinica;

  function readFileToDataUrl(file, cb) {
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      showToast('El archivo supera 4.5 MB. Comprimilo antes de subirlo.', true);
      return;
    }
    var r = new FileReader();
    r.onload = function () {
      cb(file.name, file.type || 'application/pdf', String(r.result || ''));
    };
    r.readAsDataURL(file);
  }

  function renderHcBody() {
    var root = document.getElementById('ms-hc-body');
    if (!root) return;

    var hc = STATE.historiaClinica || { fichas: [], evoluciones: [], estudios: [], recetas: [] };
    var pacientes = (STATE.turnosRef && STATE.turnosRef.pacientes) || [];
    var q = (STATE.searchPac || '').trim().toLowerCase();
    var filteredPacs = pacientes.filter(function (p) {
      if (!q) return true;
      return (p.nombreCompleto + ' ' + p.dni + ' ' + (p.email || '')).toLowerCase().indexOf(q) !== -1;
    });

    var tabsHtml =
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem;">' +
        '<button type="button" class="ms-sa-btn ' + (STATE.hcTab === 'fichas' ? '' : 'ms-sa-btn--outline') + '" data-hc-tab="fichas">📋 Fichas y Evoluciones (' + (hc.evoluciones || []).length + ')</button>' +
        '<button type="button" class="ms-sa-btn ' + (STATE.hcTab === 'estudios' ? '' : 'ms-sa-btn--outline') + '" data-hc-tab="estudios">🧪 Estudios Adjuntos (' + (hc.estudios || []).length + ')</button>' +
        '<button type="button" class="ms-sa-btn ' + (STATE.hcTab === 'recetas' ? '' : 'ms-sa-btn--outline') + '" data-hc-tab="recetas">💊 Recetas Digitales (' + (hc.recetas || []).length + ')</button>' +
      '</div>';

    var contentHtml = '';

    if (STATE.hcTab === 'fichas') {
      var activeFicha = (hc.fichas || []).find(function (f) {
        return (STATE.selectedPacDni && f.pacienteDni === STATE.selectedPacDni) ||
          (STATE.selectedPacId && f.pacienteId === STATE.selectedPacId);
      }) || {};
      var pacEvs = (hc.evoluciones || []).filter(function (e) {
        return (STATE.selectedPacDni && e.pacienteDni === STATE.selectedPacDni) ||
          (STATE.selectedPacId && e.pacienteId === STATE.selectedPacId);
      });

      var pacListHtml = filteredPacs.length === 0
        ? '<p style="font-size:0.82rem;opacity:0.7;">No hay pacientes aún. También podés cargar una ficha directa por DNI a la derecha.</p>'
        : filteredPacs.map(function (p) {
            var isSel = STATE.selectedPacDni === p.dni && STATE.selectedPacName === p.nombreCompleto;
            return (
              '<div data-hc-pick-pac="' + esc(p.dni) + '" data-hc-pick-name="' + esc(p.nombreCompleto) + '" data-hc-pick-id="' + esc(p.pacienteId) + '" style="cursor:pointer;padding:0.6rem 0.75rem;border-radius:10px;border:1px solid ' + (isSel ? '#0099D8' : '#e2e8f0') + ';background:' + (isSel ? '#ebf7fd' : '#fff') + ';margin-bottom:0.4rem;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">' +
                  '<strong style="font-size:0.84rem;color:#112D3A;">' + esc(p.nombreCompleto) + '</strong>' +
                  (p.esUsuarioRegistrado ? '<span style="background:#dcfce7;color:#166534;font-size:0.68rem;font-weight:800;padding:0.1rem 0.45rem;border-radius:999px;">WEB</span>' : '') +
                '</div>' +
                '<div style="font-size:0.75rem;color:#64748b;">DNI: ' + esc(p.dni || '—') + (p.obraSocial ? ' · ' + esc(p.obraSocial) : '') + '</div>' +
              '</div>'
            );
          }).join('');

      var evListHtml = pacEvs.length === 0
        ? '<p style="font-size:0.82rem;color:#64748b;">Sin evoluciones clínicas para este paciente.</p>'
        : pacEvs.map(function (e) {
            var sv = e.signosVitales || {};
            var svTxt = [
              sv.ta ? 'TA ' + sv.ta : '',
              sv.fc ? 'FC ' + sv.fc : '',
              sv.temp ? 'T° ' + sv.temp : '',
              sv.pesoKg ? 'Peso ' + sv.pesoKg + 'kg' : '',
              sv.imc ? 'IMC ' + sv.imc : '',
              sv.satO2 ? 'SatO2 ' + sv.satO2 : ''
            ].filter(Boolean).join(' · ');
            return (
              '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:0.85rem;background:#fff;margin-bottom:0.6rem;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;">' +
                  '<strong style="color:#112D3A;font-size:0.88rem;">' + esc(e.fecha) + ' ' + esc(e.hora) + ' · ' + esc(e.especialidadNombre) + ' — ' + esc(e.profesionalNombre) + '</strong>' +
                  '<button type="button" data-hc-del-ev="' + esc(e.id) + '" style="border:none;background:#fee2e2;color:#991b1b;border-radius:8px;padding:0.2rem 0.55rem;font-size:0.72rem;font-weight:700;cursor:pointer;">Eliminar</button>' +
                '</div>' +
                (svTxt ? '<div style="margin-top:0.35rem;font-size:0.76rem;font-weight:700;color:#0369a1;">Signos vitales: ' + esc(svTxt) + '</div>' : '') +
                '<div style="margin-top:0.35rem;font-size:0.82rem;"><strong>Motivo:</strong> ' + esc(e.motivoConsulta) + '</div>' +
                (e.subjetivo ? '<div style="font-size:0.82rem;"><strong>Anamnesis:</strong> ' + esc(e.subjetivo) + '</div>' : '') +
                (e.objetivo ? '<div style="font-size:0.82rem;"><strong>Examen físico:</strong> ' + esc(e.objetivo) + '</div>' : '') +
                '<div style="font-size:0.84rem;color:#112D3A;margin-top:0.25rem;"><strong>Diagnóstico:</strong> ' + esc(e.diagnostico) + (e.codigoCie10 ? ' (' + esc(e.codigoCie10) + ')' : '') + '</div>' +
                (e.planTerapeutico ? '<div style="font-size:0.82rem;margin-top:0.2rem;"><strong>Plan / Tratamiento:</strong> ' + esc(e.planTerapeutico) + '</div>' : '') +
              '</div>'
            );
          }).join('');

      contentHtml =
        '<div style="display:grid;grid-template-columns:minmax(240px,310px) 1fr;gap:1rem;align-items:start;">' +
          '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:0.85rem;">' +
            '<h4 style="margin:0 0 0.5rem;font-size:0.9rem;color:#112D3A;">Pacientes (' + pacientes.length + ')</h4>' +
            '<input id="ms-hc-search-pac" type="text" value="' + esc(STATE.searchPac) + '" placeholder="Buscar por nombre o DNI..." style="width:100%;padding:0.5rem 0.65rem;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:0.65rem;font-size:0.82rem;">' +
            '<div style="max-height:520px;overflow-y:auto;">' + pacListHtml + '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:1rem;">' +
            '<form id="ms-hc-ficha-form" style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1rem;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">' +
                '<h3 style="margin:0;color:#112D3A;font-size:1rem;">Ficha Médica del Paciente</h3>' +
                '<div style="display:flex;gap:0.4rem;">' +
                  '<button type="button" id="ms-hc-print-btn" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.35rem 0.75rem;font-size:0.78rem;">🖨️ Imprimir HC</button>' +
                  '<button type="submit" class="ms-sa-btn" style="padding:0.35rem 0.85rem;font-size:0.78rem;">💾 Guardar Ficha</button>' +
                '</div>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.55rem;">' +
                '<input id="hcf-dni" placeholder="DNI *" value="' + esc(activeFicha.pacienteDni || STATE.selectedPacDni) + '" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hcf-nombre" placeholder="Apellido y Nombre *" value="' + esc(activeFicha.pacienteNombre || STATE.selectedPacName) + '" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hcf-grupo" placeholder="Grupo Sanguíneo (ej. O+)" value="' + esc(activeFicha.grupoSanguineo || '') + '" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hcf-os" placeholder="Obra Social / CEMEP Plus" value="' + esc(activeFicha.obraSocialNombre || '') + '" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hcf-alergias" placeholder="⚠️ Alergias conocidas" value="' + esc(activeFicha.alergias || '') + '" style="padding:0.48rem;border:1px solid #fca5a5;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hcf-med" placeholder="Medicación crónica" value="' + esc(activeFicha.medicacionCronica || '') + '" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hcf-antp" placeholder="Antecedentes personales" value="' + esc(activeFicha.antecedentesPersonales || '') + '" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hcf-antf" placeholder="Antecedentes familiares" value="' + esc(activeFicha.antecedentesFamiliares || '') + '" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hcf-antq" placeholder="Antecedentes quirúrgicos" value="' + esc(activeFicha.antecedentesQuirurgicos || '') + '" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hcf-alertas" placeholder="Alertas clínicas" value="' + esc(activeFicha.alertasClinicas || '') + '" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
              '</div>' +
            '</form>' +

            '<form id="ms-hc-ev-form" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:14px;padding:1rem;">' +
              '<h3 style="margin:0 0 0.65rem;color:#112D3A;font-size:0.95rem;">➕ Nueva Evolución Clínica (SOAP + Signos Vitales)</h3>' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.5rem;margin-bottom:0.5rem;">' +
                '<input id="hev-esp" placeholder="Especialidad" value="Clínica Médica" style="padding:0.45rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hev-prof" placeholder="Profesional" value="' + esc((getActiveUser() && getActiveUser().name) || '') + '" style="padding:0.45rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hev-fecha" type="date" value="' + todayIso() + '" style="padding:0.45rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hev-motivo" placeholder="Motivo de consulta *" style="padding:0.45rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:repeat(6,minmax(80px,1fr));gap:0.4rem;margin-bottom:0.5rem;">' +
                '<input id="hev-ta" placeholder="TA 120/80" style="padding:0.4rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.78rem;">' +
                '<input id="hev-fc" placeholder="FC lpm" style="padding:0.4rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.78rem;">' +
                '<input id="hev-temp" placeholder="Temp °C" style="padding:0.4rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.78rem;">' +
                '<input id="hev-peso" placeholder="Peso kg" style="padding:0.4rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.78rem;">' +
                '<input id="hev-talla" placeholder="Talla cm" style="padding:0.4rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.78rem;">' +
                '<input id="hev-sat" placeholder="SatO2 %" style="padding:0.4rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.78rem;">' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">' +
                '<textarea id="hev-sub" rows="2" placeholder="Subjetivo / Anamnesis" style="padding:0.45rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;"></textarea>' +
                '<textarea id="hev-obj" rows="2" placeholder="Objetivo / Examen físico" style="padding:0.45rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;"></textarea>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:2fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">' +
                '<input id="hev-diag" placeholder="Diagnóstico clínico *" style="padding:0.45rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
                '<input id="hev-cie" placeholder="CIE-10 (opcional)" style="padding:0.45rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
              '</div>' +
              '<textarea id="hev-plan" rows="2" placeholder="Plan terapéutico / Estudios / Indicaciones" style="width:100%;padding:0.45rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;margin-bottom:0.55rem;"></textarea>' +
              '<button type="submit" class="ms-sa-btn">Guardar Evolución Clínica</button>' +
            '</form>' +

            '<div><h4 style="margin:0 0 0.5rem;color:#112D3A;">Historial de Evoluciones (' + pacEvs.length + ')</h4>' + evListHtml + '</div>' +
          '</div>' +
        '</div>';
    } else if (STATE.hcTab === 'estudios') {
      var pacOptions = '<option value="">Seleccionar paciente...</option>' + pacientes.map(function (p) {
        return '<option value="' + esc(p.dni) + '">' + esc(p.nombreCompleto) + ' — DNI ' + esc(p.dni || 'S/D') + (p.esUsuarioRegistrado ? ' [WEB]' : '') + '</option>';
      }).join('');
      var estRows = (hc.estudios || []).length === 0
        ? '<p style="font-size:0.85rem;color:#64748b;">No hay estudios cargados todavía.</p>'
        : (hc.estudios || []).map(function (e) {
            return (
              '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:0.85rem;background:#fff;margin-bottom:0.55rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;">' +
                '<div>' +
                  '<span style="background:#e0f2fe;color:#0369a1;font-size:0.72rem;font-weight:800;padding:0.12rem 0.5rem;border-radius:999px;">' + esc(e.tipoEstudio) + '</span> ' +
                  '<strong style="color:#112D3A;">' + esc(e.titulo) + '</strong> <span style="font-size:0.78rem;color:#64748b;">(' + esc(e.fechaEstudio) + ')</span>' +
                  '<div style="font-size:0.8rem;color:#475569;margin-top:0.2rem;">Paciente: <strong>' + esc(e.pacienteNombre) + '</strong> (DNI ' + esc(e.pacienteDni || '—') + ') · ' + (e.visibleParaPaciente ? '✅ Visible Portal Pacientes' : '🔒 Uso interno') + '</div>' +
                '</div>' +
                '<div style="display:flex;gap:0.4rem;">' +
                  (e.archivoDataUrl ? '<a href="' + e.archivoDataUrl + '" download="' + esc(e.archivoNombre || 'estudio.pdf') + '" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.3rem 0.7rem;font-size:0.76rem;">⬇️ Descargar</a>' : '') +
                  '<button type="button" data-hc-del-est="' + esc(e.id) + '" style="border:none;background:#fee2e2;color:#991b1b;border-radius:8px;padding:0.3rem 0.65rem;font-size:0.75rem;font-weight:700;cursor:pointer;">Eliminar</button>' +
                '</div>' +
              '</div>'
            );
          }).join('');

      contentHtml =
        '<div style="display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:1rem;align-items:start;">' +
          '<form id="ms-hc-est-form" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:1rem;display:flex;flex-direction:column;gap:0.55rem;">' +
            '<h3 style="margin:0;color:#112D3A;font-size:0.95rem;">📤 Cargar Estudio a Paciente</h3>' +
            '<select id="hest-pac" style="padding:0.5rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' + pacOptions + '</select>' +
            '<input id="hest-dni-manual" placeholder="O escribir DNI manualmente" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<input id="hest-nom-manual" placeholder="Nombre paciente (si es DNI manual)" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<select id="hest-tipo" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' + ESTUDIO_TIPOS.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select>' +
            '<input id="hest-fecha" type="date" value="' + todayIso() + '" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<input id="hest-titulo" required placeholder="Título del estudio (ej. Ecografía Obstétrica) *" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<textarea id="hest-desc" rows="3" placeholder="Informe / conclusiones médicas..." style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;"></textarea>' +
            '<input id="hest-file" type="file" accept=".pdf,image/*" style="font-size:0.78rem;">' +
            '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.8rem;font-weight:700;"><input id="hest-vis" type="checkbox" checked> Visible para el paciente en /cemep</label>' +
            '<button type="submit" class="ms-sa-btn">Publicar Estudio</button>' +
          '</form>' +
          '<div><h3 style="margin:0 0 0.65rem;color:#112D3A;">Estudios Cargados (' + (hc.estudios || []).length + ')</h3>' + estRows + '</div>' +
        '</div>';
    } else if (STATE.hcTab === 'recetas') {
      var recRows = (hc.recetas || []).length === 0
        ? '<p style="font-size:0.85rem;color:#64748b;">No hay solicitudes de recetas digitales todavía.</p>'
        : (hc.recetas || []).map(function (r) {
            return (
              '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:0.9rem;background:#fff;margin-bottom:0.65rem;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">' +
                  '<div><strong style="color:#112D3A;">' + esc(r.codigo) + ' — ' + esc(r.pacienteNombre) + '</strong> <span style="font-size:0.78rem;color:#64748b;">DNI ' + esc(r.pacienteDni || '—') + ' · ' + esc(r.obraSocialNombre) + '</span></div>' +
                  '<span style="background:' + (r.estado === 'emitida' ? '#dcfce7' : '#fef3c7') + ';color:' + (r.estado === 'emitida' ? '#166534' : '#92400e') + ';font-size:0.74rem;font-weight:800;padding:0.18rem 0.55rem;border-radius:999px;text-transform:uppercase;">' + esc(r.estado) + '</span>' +
                '</div>' +
                '<div style="margin:0.45rem 0;padding:0.55rem 0.75rem;background:#f8fafc;border-radius:8px;font-size:0.84rem;white-space:pre-wrap;">' + esc(r.medicamentosSolicitados) + '</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;">' +
                  '<input data-rec-code="' + esc(r.id) + '" value="' + esc(r.recetaCodigoValidacion || '') + '" placeholder="Código validación" style="padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.78rem;">' +
                  '<input data-rec-obs="' + esc(r.id) + '" value="' + esc(r.observacionesAdmin || '') + '" placeholder="Observaciones al paciente" style="padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.78rem;min-width:200px;">' +
                  '<label class="ms-sa-btn" style="padding:0.35rem 0.75rem;font-size:0.76rem;cursor:pointer;">📎 Subir Receta Digital (PDF/Img)<input type="file" accept=".pdf,image/*" data-rec-upload="' + esc(r.id) + '" style="display:none;"></label>' +
                  (r.recetaArchivoDataUrl ? '<a href="' + r.recetaArchivoDataUrl + '" download="' + esc(r.recetaArchivoNombre || r.codigo + '.pdf') + '" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.35rem 0.7rem;font-size:0.76rem;">⬇️ Ver PDF</a>' : '') +
                '</div>' +
              '</div>'
            );
          }).join('');
      contentHtml = '<div><h3 style="margin:0 0 0.65rem;color:#112D3A;">Bandeja de Recetas Digitales (Solicitudes Pacientes + Carga Digital)</h3>' + recRows + '</div>';
    }

    root.innerHTML = tabsHtml + contentHtml;
    bindHcEvents(root);
  }

  function bindHcEvents(root) {
    root.querySelectorAll('[data-hc-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        STATE.hcTab = btn.getAttribute('data-hc-tab');
        renderHcBody();
      });
    });

    var searchInp = root.querySelector('#ms-hc-search-pac');
    if (searchInp) {
      searchInp.addEventListener('input', function () {
        STATE.searchPac = searchInp.value;
        renderHcBody();
        var next = document.getElementById('ms-hc-search-pac');
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      });
    }

    root.querySelectorAll('[data-hc-pick-pac]').forEach(function (el) {
      el.addEventListener('click', function () {
        STATE.selectedPacDni = el.getAttribute('data-hc-pick-pac') || '';
        STATE.selectedPacName = el.getAttribute('data-hc-pick-name') || '';
        STATE.selectedPacId = el.getAttribute('data-hc-pick-id') || '';
        renderHcBody();
      });
    });

    var fichaForm = root.querySelector('#ms-hc-ficha-form');
    if (fichaForm) {
      fichaForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var dni = root.querySelector('#hcf-dni').value.trim();
        var nombre = root.querySelector('#hcf-nombre').value.trim();
        var res = await apiConsultorios('POST', {
          action: 'save_ficha',
          ficha: {
            pacienteId: STATE.selectedPacId || undefined,
            pacienteDni: dni,
            pacienteNombre: nombre,
            grupoSanguineo: root.querySelector('#hcf-grupo').value,
            obraSocialNombre: root.querySelector('#hcf-os').value,
            alergias: root.querySelector('#hcf-alergias').value,
            medicacionCronica: root.querySelector('#hcf-med').value,
            antecedentesPersonales: root.querySelector('#hcf-antp').value,
            antecedentesFamiliares: root.querySelector('#hcf-antf').value,
            antecedentesQuirurgicos: root.querySelector('#hcf-antq').value,
            alertasClinicas: root.querySelector('#hcf-alertas').value
          }
        });
        if (res && res.ok) {
          STATE.selectedPacDni = dni;
          STATE.selectedPacName = nombre;
          applyRes(res);
          showToast(res.message, false);
          renderHcBody();
        } else {
          showToast((res && res.message) || 'Error guardando ficha.', true);
        }
      });
    }

    var printBtn = root.querySelector('#ms-hc-print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        var nom = (root.querySelector('#hcf-nombre') && root.querySelector('#hcf-nombre').value) || STATE.selectedPacName;
        if (!nom) { showToast('Seleccioná un paciente para imprimir su Historia Clínica.', true); return; }
        var w = window.open('', '_blank', 'width=900,height=720');
        if (!w) return;
        var evs = (STATE.historiaClinica.evoluciones || []).filter(function (e) {
          return (STATE.selectedPacDni && e.pacienteDni === STATE.selectedPacDni) || e.pacienteNombre === nom;
        });
        w.document.write('<html><head><meta charset="UTF-8"><title>HC ' + esc(nom) + '</title></head><body style="font-family:system-ui;padding:24px;"><h2>Historia Clínica — ' + esc(nom) + ' (DNI ' + esc(STATE.selectedPacDni) + ')</h2><hr>' + evs.map(function (e) {
          return '<p><strong>' + esc(e.fecha) + ' · ' + esc(e.especialidadNombre) + ' (' + esc(e.profesionalNombre) + ')</strong><br>Motivo: ' + esc(e.motivoConsulta) + '<br>Diagnóstico: ' + esc(e.diagnostico) + '<br>Plan: ' + esc(e.planTerapeutico) + '</p>';
        }).join('') + '<script>window.print();</script></body></html>');
        w.document.close();
      });
    }

    var evForm = root.querySelector('#ms-hc-ev-form');
    if (evForm) {
      evForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var dni = (root.querySelector('#hcf-dni') && root.querySelector('#hcf-dni').value.trim()) || STATE.selectedPacDni;
        var nombre = (root.querySelector('#hcf-nombre') && root.querySelector('#hcf-nombre').value.trim()) || STATE.selectedPacName;
        var res = await apiConsultorios('POST', {
          action: 'save_evolucion',
          evolucion: {
            pacienteId: STATE.selectedPacId || undefined,
            pacienteDni: dni,
            pacienteNombre: nombre,
            especialidadNombre: root.querySelector('#hev-esp').value,
            profesionalNombre: root.querySelector('#hev-prof').value,
            fecha: root.querySelector('#hev-fecha').value,
            motivoConsulta: root.querySelector('#hev-motivo').value,
            subjetivo: root.querySelector('#hev-sub').value,
            objetivo: root.querySelector('#hev-obj').value,
            signosVitales: {
              ta: root.querySelector('#hev-ta').value,
              fc: root.querySelector('#hev-fc').value,
              temp: root.querySelector('#hev-temp').value,
              pesoKg: root.querySelector('#hev-peso').value,
              tallaCm: root.querySelector('#hev-talla').value,
              satO2: root.querySelector('#hev-sat').value
            },
            diagnostico: root.querySelector('#hev-diag').value,
            codigoCie10: root.querySelector('#hev-cie').value,
            planTerapeutico: root.querySelector('#hev-plan').value
          }
        });
        if (res && res.ok) {
          applyRes(res);
          showToast(res.message, false);
          renderHcBody();
        } else {
          showToast((res && res.message) || 'Error guardando evolución.', true);
        }
      });
    }

    root.querySelectorAll('[data-hc-del-ev]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar esta evolución?')) return;
        var res = await apiConsultorios('POST', { action: 'delete_evolucion', id: btn.getAttribute('data-hc-del-ev') });
        if (res && res.ok) { applyRes(res); showToast(res.message, false); renderHcBody(); }
      });
    });

    var estForm = root.querySelector('#ms-hc-est-form');
    if (estForm) {
      var uploadedFile = { name: '', mime: '', url: '' };
      var fileInput = root.querySelector('#hest-file');
      if (fileInput) {
        fileInput.addEventListener('change', function () {
          readFileToDataUrl(fileInput.files && fileInput.files[0], function (n, m, u) {
            uploadedFile = { name: n, mime: m, url: u };
          });
        });
      }
      estForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var selDni = root.querySelector('#hest-pac').value || root.querySelector('#hest-dni-manual').value.trim();
        var pacObj = ((STATE.turnosRef && STATE.turnosRef.pacientes) || []).find(function (p) { return p.dni === selDni; });
        var res = await apiConsultorios('POST', {
          action: 'save_estudio',
          estudio: {
            pacienteId: pacObj ? pacObj.pacienteId : undefined,
            pacienteDni: selDni,
            pacienteNombre: pacObj ? pacObj.nombreCompleto : root.querySelector('#hest-nom-manual').value.trim(),
            webUserId: pacObj ? pacObj.webUserId : undefined,
            tipoEstudio: root.querySelector('#hest-tipo').value,
            fechaEstudio: root.querySelector('#hest-fecha').value,
            titulo: root.querySelector('#hest-titulo').value,
            descripcionInforme: root.querySelector('#hest-desc').value,
            visibleParaPaciente: root.querySelector('#hest-vis').checked,
            archivoNombre: uploadedFile.name || undefined,
            archivoMime: uploadedFile.mime || undefined,
            archivoDataUrl: uploadedFile.url || undefined
          }
        });
        if (res && res.ok) {
          applyRes(res);
          showToast(res.message, false);
          renderHcBody();
        } else {
          showToast((res && res.message) || 'Error cargando estudio.', true);
        }
      });
    }

    root.querySelectorAll('[data-hc-del-est]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar este estudio?')) return;
        var res = await apiConsultorios('POST', { action: 'delete_estudio', id: btn.getAttribute('data-hc-del-est') });
        if (res && res.ok) { applyRes(res); showToast(res.message, false); renderHcBody(); }
      });
    });

    root.querySelectorAll('[data-rec-upload]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var rid = inp.getAttribute('data-rec-upload');
        var codeInp = root.querySelector('[data-rec-code="' + rid + '"]');
        var obsInp = root.querySelector('[data-rec-obs="' + rid + '"]');
        readFileToDataUrl(inp.files && inp.files[0], async function (n, m, u) {
          var res = await apiConsultorios('POST', {
            action: 'upload_receta_digital',
            id: rid,
            estado: 'emitida',
            recetaCodigoValidacion: codeInp ? codeInp.value : '',
            observacionesAdmin: obsInp ? obsInp.value : '',
            recetaArchivoNombre: n,
            recetaArchivoMime: m,
            recetaArchivoDataUrl: u
          });
          if (res && res.ok) { applyRes(res); showToast(res.message, false); renderHcBody(); }
        });
      });
    });
  }

  function bindGlobalNavReset() {
    if (window.__MS_GC_NAV_BOUND__) return;
    window.__MS_GC_NAV_BOUND__ = true;
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || typeof t.closest !== 'function') return;
      var nav = t.closest('#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-cv-home-card, #ms-personal-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-web-home-card');
      if (nav) {
        var m = document.getElementById('sec-menu-gestion-consultorios');
        var h = document.getElementById('sec-hc-workspace');
        var isGcActive = (m && !m.hidden) || (h && !h.hidden);

        if (nav.id === 'btn-topbar-back-facturacion' && isGcActive) {
          ev.preventDefault();
          ev.stopPropagation();
          if (h && !h.hidden) {
            openGestionConsultoriosMenu();
          } else {
            closeToHome();
          }
          return;
        }

        if (m) m.hidden = true;
        if (h) h.hidden = true;
      }
    }, true);
  }

  var initialLoaded = false;

  function syncHomeCard() {
    bindGlobalNavReset();
    var allowed = isConsultoriosAllowed();
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-gestion-consultorios-home-card');

    if (allowed && inicioGrid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-gestion-consultorios-home-card';
      card.className = 'module-card';
      card.setAttribute('data-module-key', 'gestion_consultorios');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"></path><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"></path><circle cx="20" cy="10" r="2"></circle></svg>' +
        '</div>' +
        '<h3>Gestión Consultorios</h3>';

      card.addEventListener('click', openGestionConsultoriosMenu);
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openGestionConsultoriosMenu();
        }
      });

      var perfilCard = inicioGrid.querySelector('[data-module-key="perfil"]');
      if (perfilCard) inicioGrid.insertBefore(card, perfilCard);
      else inicioGrid.appendChild(card);

      if (!initialLoaded) {
        initialLoaded = true;
        reloadData(false);
      }
    } else if (existing) {
      existing.hidden = !allowed;
      existing.style.display = allowed ? '' : 'none';
    }
  }

  setInterval(syncHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncHomeCard);
})();
