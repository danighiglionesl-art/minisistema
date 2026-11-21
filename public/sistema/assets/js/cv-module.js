/* ==========================================================================
   MÓDULO "CURRICULUM VITAE" — EXCLUSIVO DE MINISISTEMA ERP
   Vinculado en vivo con el portal público /cv:
   - Submódulo "CV recibidos" (todos los recibidos aún sin previsualizar)
   - Submódulo "CV previsualizados" (todos los previsualizados + valoración 1 a 10)
   - Visor completo de ficha, fotografía, adjunto PDF, WhatsApp y Código QR
   ========================================================================== */
(function () {
  'use strict';

  var INTERVIEW_CRITERIA = [
    { key: 'experiencia_laboral', label: 'Experiencia laboral', weight: 15 },
    { key: 'competencias_tecnicas', label: 'Competencias técnicas', weight: 15 },
    { key: 'comunicacion_interpersonal', label: 'Comunicación interpersonal', weight: 15 },
    { key: 'inteligencia_emocional', label: 'Inteligencia emocional', weight: 10 },
    { key: 'actitud_motivacion', label: 'Actitud y motivación', weight: 15 },
    { key: 'responsabilidad', label: 'Responsabilidad', weight: 10 },
    { key: 'trabajo_en_equipo', label: 'Trabajo en equipo', weight: 10 },
    { key: 'adaptabilidad', label: 'Adaptabilidad', weight: 10 }
  ];

  function defaultInterviewScores() {
    return {
      experiencia_laboral: 3,
      competencias_tecnicas: 3,
      comunicacion_interpersonal: 3,
      inteligencia_emocional: 3,
      actitud_motivacion: 3,
      responsabilidad: 3,
      trabajo_en_equipo: 3,
      adaptabilidad: 3
    };
  }

  function calcInterviewWeighted(scores) {
    var total = 0;
    INTERVIEW_CRITERIA.forEach(function (c) {
      var v = Math.min(5, Math.max(1, Math.round(Number((scores && scores[c.key]) || 3))));
      total += (v / 5) * c.weight;
    });
    return Math.round(total * 10) / 10;
  }

  function todayIsoLocal() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function ensureInterviewStyles() {
    if (document.getElementById('ms-cv-interview-styles')) return;
    var st = document.createElement('style');
    st.id = 'ms-cv-interview-styles';
    st.textContent =
      '.ms-cv-matrix-card{background:#111417;color:#f8fafc;border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:1.4rem 1.5rem;box-shadow:0 12px 30px rgba(17,45,58,0.22);}' +
      '.ms-cv-matrix-progress-bg{height:10px;width:100%;border-radius:999px;background:rgba(255,255,255,0.14);overflow:hidden;margin:0.85rem 0 1.25rem;}' +
      '.ms-cv-matrix-progress-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#56D7A1,#ffffff);transition:width 180ms ease;}' +
      '.ms-cv-matrix-range{-webkit-appearance:none;appearance:none;width:100%;height:22px;border-radius:999px;background:rgba(255,255,255,0.1);outline:none;cursor:pointer;padding:0 3px;}' +
      '.ms-cv-matrix-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;border-radius:50%;background:#ffffff;border:2px solid #56D7A1;box-shadow:0 2px 8px rgba(0,0,0,0.45);cursor:pointer;transition:transform 120ms ease;}' +
      '.ms-cv-matrix-range::-webkit-slider-thumb:hover{transform:scale(1.12);}' +
      '.ms-cv-matrix-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#ffffff;border:2px solid #56D7A1;box-shadow:0 2px 8px rgba(0,0,0,0.45);cursor:pointer;}' +
      '.ms-cv-matrix-reset{background:transparent;color:#f8fafc;border:1px solid rgba(255,255,255,0.28);border-radius:10px;padding:0.42rem 0.95rem;font-size:0.8rem;font-weight:700;cursor:pointer;}' +
      '.ms-cv-matrix-reset:hover{background:rgba(255,255,255,0.1);}';
    document.head.appendChild(st);
  }

  var STATE_CV = {
    activeView: 'menu', // 'menu' | 'recibidos' | 'previsualizados' | 'entrevistas' | 'portal' | 'tablas' | 'detail'
    previousListView: 'recibidos',
    publicCvUrl: '/cv',
    stats: {
      totalActivos: 0,
      recibidosSinVer: 0,
      actualizadosSinVerCount: 0,
      previsualizadosCount: 0,
      entrevistadosCount: 0,
      promedioValoracion: null
    },
    recibidos: [],
    previsualizados: [],
    entrevistados: [],
    selectedCv: null,
    filterPuesto: '',
    filterMinRating: 0,
    filterSearch: '',
    filterDni: '',
    sortBy: 'recent', // 'recent' | 'rating_desc'
    interviewSelectedId: '',
    interviewScores: defaultInterviewScores(),
    interviewReview: '',
    interviewDate: todayIsoLocal(),
    interviewFilterPuesto: '',
    interviewSearch: '',
    formConfig: null,
    configDirty: false,
    configSectionFilter: 'all',
    configSearch: '',
    configModalMode: null, // null | 'edit' | 'new'
    configEditingKey: null,
    configDraft: null
  };

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function isCvModuleAllowed() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    if (String(u.username).toLowerCase() === 'danielg' || u.role === 'Administrador General') {
      return true;
    }
    var brandMods = (window.ERP_BRAND && window.ERP_BRAND.enabledModules) || [];
    if (
      Array.isArray(brandMods) &&
      brandMods.length > 0 &&
      brandMods.indexOf('cv') === -1 &&
      brandMods.indexOf('administracion_personal') === -1
    ) {
      return false;
    }
    if (u.role === 'Administrador') return true;
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return (
      uMods.indexOf('administracion_personal') !== -1 ||
      uMods.indexOf('cv') !== -1 ||
      uMods.indexOf('cv:recibidos') !== -1 ||
      uMods.indexOf('cv:previsualizados') !== -1 ||
      uMods.indexOf('cv:tablas') !== -1
    );
  }

  async function apiCv(method, bodyOrQuery) {
    var url = '/sistema/api/curriculum.php';
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

  function ratingBadgeColor(val) {
    var n = Number(val || 0);
    if (!n) return { bg: '#e2e8f0', fg: '#334155', label: 'Sin valorar' };
    if (n >= 8) return { bg: '#dcfce7', fg: '#065f46', label: '⭐ ' + n + ' / 10' };
    if (n >= 5) return { bg: '#fef3c7', fg: '#92400e', label: '⭐ ' + n + ' / 10' };
    return { bg: '#fee2e2', fg: '#991b1b', label: '⭐ ' + n + ' / 10' };
  }

  function ensureCvSectionsMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var menuSec = document.getElementById('sec-menu-cv');
    var detailSec = document.getElementById('sec-cv-workspace');

    if (!menuSec) {
      var ownedByPersonal = Boolean(window.__MS_PERSONAL_OWNS_CV__);
      menuSec = document.createElement('section');
      menuSec.id = 'sec-menu-cv';
      menuSec.className = 'erp-section';
      menuSec.hidden = true;
      menuSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-cv-back-home-btn">' +
              (ownedByPersonal ? '← Volver a Administración de Personal' : '← Volver a Pantalla Principal') +
            '</button>' +
            '<span class="module-breadcrumb">' +
              (ownedByPersonal ? 'Administración de Personal' : 'ERP en Línea') +
              ' · <strong>Curriculum Vitae</strong></span>' +
          '</div>' +
          '<a href="/cv" target="_blank" class="ms-sa-btn" style="padding:0.42rem 0.9rem;font-size:0.8rem;" id="ms-cv-open-public-top">Abrir Formulario Público ↗</a>' +
        '</div>' +
        '<div class="modules-grid" aria-label="Submódulos de Curriculum Vitae">' +
          '<article class="module-card" role="button" tabindex="0" data-cv-sub="recibidos">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>' +
                '<path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>' +
              '</svg>' +
            '</div>' +
            '<h3>CV recibidos</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-cv-sub="previsualizados">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>' +
              '</svg>' +
            '</div>' +
            '<h3>CV previsualizados</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-cv-sub="entrevistas">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M9 11l3 3L22 4"></path>' +
                '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>' +
              '</svg>' +
            '</div>' +
            '<h3>Entrevistas Realizadas</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-cv-sub="portal">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect>' +
                '<rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>' +
              '</svg>' +
            '</div>' +
            '<h3>Enlace y Código QR</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-cv-sub="tablas">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<circle cx="12" cy="12" r="3"></circle>' +
                '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' +
              '</svg>' +
            '</div>' +
            '<h3>Configuración de Tablas</h3>' +
          '</article>' +
        '</div>';

      erpMain.appendChild(menuSec);

      menuSec.querySelector('#ms-cv-back-home-btn').addEventListener('click', closeCvToHome);
      menuSec.querySelectorAll('[data-cv-sub]').forEach(function (card) {
        card.addEventListener('click', function () {
          openCvView(card.getAttribute('data-cv-sub'));
        });
        card.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            openCvView(card.getAttribute('data-cv-sub'));
          }
        });
      });
    }

    if (!detailSec) {
      detailSec = document.createElement('section');
      detailSec.id = 'sec-cv-workspace';
      detailSec.className = 'erp-section';
      detailSec.hidden = true;
      detailSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-cv-back-sub-btn">← Volver a Curriculum Vitae</button>' +
            '<span class="module-breadcrumb">Curriculum Vitae · <strong id="ms-cv-sub-title">CV recibidos</strong></span>' +
          '</div>' +
          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-cv-refresh-btn" style="padding:0.38rem 0.8rem;font-size:0.78rem;">🔄 Actualizar</button>' +
        '</div>' +
        '<div id="ms-cv-toast" style="display:none;margin-bottom:0.9rem;padding:0.7rem 1rem;border-radius:10px;font-weight:700;font-size:0.85rem;"></div>' +
        '<div id="ms-cv-body"></div>';

      erpMain.appendChild(detailSec);

      detailSec.querySelector('#ms-cv-back-sub-btn').addEventListener('click', function () {
        if (STATE_CV.activeView === 'detail') {
          openCvView(STATE_CV.previousListView || 'previsualizados');
        } else {
          openCvView('menu');
        }
      });
      detailSec.querySelector('#ms-cv-refresh-btn').addEventListener('click', function () {
        reloadCvData(true);
      });
    }

    return { menuSec: menuSec, detailSec: detailSec };
  }

  function showCvToast(msg, isErr) {
    var el = document.getElementById('ms-cv-toast');
    if (!el) return;
    el.style.display = 'block';
    el.style.background = isErr ? '#fee2e2' : '#dcfce7';
    el.style.color = isErr ? '#991b1b' : '#065f46';
    el.style.border = isErr ? '1px solid #f87171' : '1px solid #34d399';
    el.textContent = msg;
    setTimeout(function () {
      if (el.textContent === msg) el.style.display = 'none';
    }, 5000);
  }

  function hideAllErpSections() {
    document.querySelectorAll('.erp-main > .erp-section').forEach(function (sec) {
      sec.hidden = true;
    });
  }

  function closeCvToHome() {
    if (window.__MS_PERSONAL_OWNS_CV__ && typeof window.__MS_OPEN_PERSONAL_MENU__ === 'function') {
      window.__MS_OPEN_PERSONAL_MENU__();
      return;
    }
    hideAllErpSections();
    var inicio = document.getElementById('sec-inicio');
    if (inicio) inicio.hidden = false;
    var backTopBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backTopBtn) backTopBtn.hidden = true;
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    if (topbarModInd) topbarModInd.hidden = true;
  }

  async function openCvView(viewName) {
    var refs = ensureCvSectionsMounted();
    if (!refs) return;
    STATE_CV.activeView = viewName || 'menu';
    hideAllErpSections();

    var titleMap = {
      recibidos: 'CV recibidos (sin previsualizar)',
      previsualizados: 'CV previsualizados (Valoración 1 a 10)',
      entrevistas: 'Entrevistas Realizadas',
      portal: 'Enlace Público y Código QR',
      tablas: 'Configuración de Tablas',
      detail: 'Ficha Completa del Postulante'
    };

    var backTopBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backTopBtn) {
      backTopBtn.hidden = false;
      backTopBtn.textContent = '← Atrás';
    }
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    if (topbarModInd) {
      topbarModInd.hidden = false;
      var cvPrefix = window.__MS_PERSONAL_OWNS_CV__ ? 'Administración de Personal · Curriculum Vitae' : 'Curriculum Vitae';
      topbarModInd.textContent =
        STATE_CV.activeView === 'menu'
          ? cvPrefix
          : 'Curriculum Vitae · ' + (titleMap[STATE_CV.activeView] || '');
    }

    if (STATE_CV.activeView === 'menu') {
      refs.menuSec.hidden = false;
      await reloadCvData(false);
    } else {
      refs.detailSec.hidden = false;
      var tEl = document.getElementById('ms-cv-sub-title');
      if (tEl) tEl.textContent = titleMap[STATE_CV.activeView] || 'Curriculum Vitae';
      if (STATE_CV.activeView !== 'detail') {
        await reloadCvData(true);
      } else {
        renderCvWorkspace();
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function reloadCvData(renderAfter) {
    try {
      var res = await apiCv('GET', { action: 'list', t: String(Date.now()) });
      if (res && res.ok) {
        STATE_CV.publicCvUrl = res.publicCvUrl || '/cv';
        STATE_CV.stats = res.stats || STATE_CV.stats;
        STATE_CV.recibidos = Array.isArray(res.recibidos) ? res.recibidos : [];
        STATE_CV.previsualizados = Array.isArray(res.previsualizados) ? res.previsualizados : [];
        STATE_CV.entrevistados = Array.isArray(res.entrevistados) ? res.entrevistados : [];
        if (res.formConfig && Array.isArray(res.formConfig.fields) && !STATE_CV.configDirty) {
          STATE_CV.formConfig = res.formConfig;
        }
        syncCountersUi();
      }
    } catch (_e) {}
    if (renderAfter) {
      renderCvWorkspace();
    }
  }

  function syncCountersUi() {
    var unread = Number(STATE_CV.stats.recibidosSinVer || 0);
    var updatedUnread = Number(STATE_CV.stats.actualizadosSinVerCount || 0);
    var prevCount = Number(STATE_CV.stats.previsualizadosCount || 0);

    var bRec = document.getElementById('ms-cv-badge-recibidos');
    if (bRec) {
      bRec.textContent =
        unread +
        ' sin ver' +
        (updatedUnread > 0 ? ' · 🔔 ' + updatedUnread + ' actualizados' : '');
    }

    var bPrev = document.getElementById('ms-cv-badge-prev');
    if (bPrev) {
      var avgTxt = STATE_CV.stats.promedioValoracion ? ' · Prom: ' + STATE_CV.stats.promedioValoracion + '/10' : '';
      bPrev.textContent = prevCount + ' previsualizados' + avgTxt;
    }

    var homeBadge = document.getElementById('ms-cv-home-unread-pill');
    if (homeBadge) {
      if (updatedUnread > 0) {
        homeBadge.textContent = '🔔 ' + unread + ' (' + updatedUnread + ' ACT.)';
        homeBadge.style.background = '#56D7A1';
      } else {
        homeBadge.textContent = unread > 0 ? unread + ' NUEVOS' : 'ACTIVO';
        homeBadge.style.background = unread > 0 ? '#56D7A1' : 'rgba(86,215,161,0.18)';
      }
    }

    var openTop = document.getElementById('ms-cv-open-public-top');
    if (openTop && STATE_CV.publicCvUrl) {
      openTop.href = STATE_CV.publicCvUrl;
    }
  }

  function renderAvatarHtml(cv, sizePx) {
    var sz = sizePx || 46;
    if (cv.archivos && cv.archivos.fotoUrl) {
      return (
        '<img src="' +
        esc(cv.archivos.fotoUrl) +
        '" alt="' +
        esc(cv.personal && cv.personal.nombreCompleto) +
        '" style="width:' +
        sz +
        'px;height:' +
        sz +
        'px;border-radius:12px;object-fit:cover;border:2px solid #56D7A1;flex-shrink:0;">'
      );
    }
    var ini =
      ((cv.personal && cv.personal.apellidos && cv.personal.apellidos.charAt(0)) || 'C').toUpperCase();
    return (
      '<span style="display:inline-flex;align-items:center;justify-content:center;width:' +
      sz +
      'px;height:' +
      sz +
      'px;border-radius:12px;background:#112D3A;color:#56D7A1;font-weight:900;font-size:1rem;flex-shrink:0;">' +
      esc(ini) +
      '</span>'
    );
  }

  function renderCvListView(isPrevisualizados) {
    var sourceList = isPrevisualizados ? STATE_CV.previsualizados : STATE_CV.recibidos;
    var allPuestos = {};
    sourceList.forEach(function (c) {
      var p = c.postulacion && c.postulacion.puestoPrincipal;
      if (p) allPuestos[p] = true;
    });

    var filtered = sourceList.filter(function (c) {
      if (STATE_CV.filterDni) {
        var qDni = String(STATE_CV.filterDni).replace(/\D/g, '') || String(STATE_CV.filterDni).toLowerCase();
        var docRaw = String((c.personal && c.personal.nroDoc) || '');
        var docClean = docRaw.replace(/\D/g, '') || docRaw.toLowerCase();
        if (docClean.indexOf(qDni) === -1 && docRaw.toLowerCase().indexOf(String(STATE_CV.filterDni).toLowerCase()) === -1) {
          return false;
        }
      }
      if (STATE_CV.filterPuesto && (!c.postulacion || c.postulacion.puestoPrincipal !== STATE_CV.filterPuesto)) {
        return false;
      }
      if (isPrevisualizados && STATE_CV.filterMinRating > 0) {
        if (Number(c.rating || 0) < STATE_CV.filterMinRating) return false;
      }
      if (STATE_CV.filterSearch) {
        var q = STATE_CV.filterSearch.toLowerCase();
        var hay = [
          c.codigo,
          c.personal && c.personal.nombreCompleto,
          c.personal && c.personal.nroDoc,
          c.ubicacionContacto && c.ubicacionContacto.localidad,
          c.postulacion && c.postulacion.puestoPrincipal
        ]
          .join(' ')
          .toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (isPrevisualizados && STATE_CV.sortBy === 'rating_desc') {
      filtered.sort(function (a, b) {
        return Number(b.rating || 0) - Number(a.rating || 0);
      });
    }

    var puestoOptions = Object.keys(allPuestos)
      .sort()
      .map(function (p) {
        return (
          '<option value="' +
          esc(p) +
          '" ' +
          (STATE_CV.filterPuesto === p ? 'selected' : '') +
          '>' +
          esc(p) +
          '</option>'
        );
      })
      .join('');

    var rowsHtml =
      filtered.length === 0
        ? '<tr><td colspan="7" style="padding:2rem;text-align:center;color:#546e7a;font-weight:700;">' +
          (isPrevisualizados
            ? 'Aún no hay CVs previsualizados con los filtros actuales.'
            : '🎉 No hay CVs pendientes de previsualizar en este momento.') +
          '</td></tr>'
        : filtered
            .map(function (c) {
              var p = c.personal || {};
              var u = c.ubicacionContacto || {};
              var post = c.postulacion || {};
              var arch = c.archivos || {};
              var rb = ratingBadgeColor(c.rating);
              var quickSelectRating = '';

              if (isPrevisualizados) {
                var opts1to10 = '<option value="">Valorar (1-10)</option>';
                for (var score = 1; score <= 10; score++) {
                  opts1to10 +=
                    '<option value="' +
                    score +
                    '" ' +
                    (Number(c.rating) === score ? 'selected' : '') +
                    '>' +
                    score +
                    ' / 10</option>';
                }
                quickSelectRating =
                  '<div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">' +
                  '<span style="background:' +
                  rb.bg +
                  ';color:' +
                  rb.fg +
                  ';padding:0.22rem 0.55rem;border-radius:999px;font-size:0.76rem;font-weight:800;">' +
                  rb.label +
                  '</span>' +
                  '<select class="ms-sa-select" data-quick-rate="' +
                  esc(c.id) +
                  '" style="width:auto;padding:0.25rem 0.45rem;font-size:0.76rem;font-weight:700;">' +
                  opts1to10 +
                  '</select>' +
                  '</div>';
              }

              var updateBadgeHtml = c.hasCandidateUpdate
                ? '<span style="display:inline-flex;align-items:center;gap:0.25rem;background:#56D7A1;color:#112D3A;font-size:0.7rem;font-weight:900;padding:0.15rem 0.5rem;border-radius:999px;margin-left:0.4rem;">🔔 NUEVOS DATOS ACTUALIZADOS</span>'
                : Number(c.candidateUpdateCount || 0) > 0
                  ? '<span style="display:inline-flex;align-items:center;gap:0.25rem;background:rgba(86,215,161,0.2);color:#0f5d3f;font-size:0.7rem;font-weight:800;padding:0.12rem 0.45rem;border-radius:999px;margin-left:0.4rem;">↻ Actualizado (' +
                    esc(c.candidateUpdateCount) +
                    ')</span>'
                  : '';

              return (
                '<tr style="border-bottom:1px solid #e2ecf0;' +
                (c.hasCandidateUpdate ? 'background:rgba(86,215,161,0.1);' : '') +
                '">' +
                '<td style="padding:0.65rem;">' +
                '<div style="display:flex;align-items:center;gap:0.65rem;">' +
                renderAvatarHtml(c, 44) +
                '<div>' +
                '<div style="font-weight:800;color:#112D3A;display:flex;align-items:center;flex-wrap:wrap;gap:0.2rem;">' +
                esc(p.nombreCompleto || '') +
                updateBadgeHtml +
                '</div>' +
                '<div style="font-size:0.75rem;color:#546e7a;">' +
                esc(p.tipoDoc || 'DNI') +
                ' <strong>' +
                esc(p.nroDoc || '') +
                '</strong>' +
                (p.edad ? ' · ' + esc(p.edad) + ' años' : '') +
                ' · <code>' +
                esc(c.codigo) +
                '</code></div>' +
                '</div>' +
                '</div>' +
                '</td>' +
                '<td style="padding:0.65rem;font-size:0.83rem;"><strong>' +
                esc(post.puestoPrincipal || '') +
                '</strong><br><small style="color:#546e7a;">' +
                esc(post.disponibilidadHoraria || '') +
                '</small></td>' +
                '<td style="padding:0.65rem;font-size:0.82rem;">' +
                esc(u.localidad || '') +
                '<br><small style="color:#546e7a;">' +
                esc(u.provincia || '') +
                '</small></td>' +
                '<td style="padding:0.65rem;font-size:0.8rem;">' +
                (arch.pdfUrl
                  ? '<a href="' +
                    esc(arch.pdfUrl) +
                    '" target="_blank" style="color:#0b5e3e;font-weight:800;text-decoration:underline;">📄 PDF adjunto</a>'
                  : '<span style="color:#94a3b8;">Sin PDF</span>') +
                '</td>' +
                '<td style="padding:0.65rem;font-size:0.78rem;color:#475569;">' +
                esc(new Date(c.lastCandidateUpdateAt || c.updatedAt || c.createdAt).toLocaleDateString('es-AR')) +
                (c.lastCandidateUpdateAt
                  ? '<br><small style="color:#0f5d3f;font-weight:800;">Act. ' +
                    esc(new Date(c.lastCandidateUpdateAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })) +
                    '</small>'
                  : '') +
                '</td>' +
                (isPrevisualizados
                  ? '<td style="padding:0.65rem;">' + quickSelectRating + '</td>'
                  : '') +
                '<td style="padding:0.65rem;text-align:right;">' +
                '<button type="button" class="ms-sa-btn" style="padding:0.42rem 0.8rem;font-size:0.78rem;" data-open-cv-id="' +
                esc(c.id) +
                '">' +
                (isPrevisualizados ? '👁️ Abrir / Valorar' : '👁️ Previsualizar CV') +
                '</button>' +
                '</td>' +
                '</tr>'
              );
            })
            .join('');

    var updatedAlertsInList = sourceList.filter(function (c) {
      return Boolean(c.hasCandidateUpdate);
    });
    var alertBannerHtml =
      updatedAlertsInList.length > 0
        ? '<div style="margin-bottom:0.9rem;padding:0.75rem 1rem;border-radius:12px;border:2px solid #56D7A1;background:#112D3A;color:#FFFFFF;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">' +
          '<div style="font-size:0.84rem;">' +
          '<strong style="color:#56D7A1;">🔔 Alerta de Nuevos Datos en CV:</strong> Hay <strong>' +
          esc(updatedAlertsInList.length) +
          '</strong> postulante(s) que actualizaron su Curriculum Vitae usando su DNI (sin duplicar registro).' +
          '</div>' +
          '</div>'
        : '';

    return (
      '<div class="ms-sa-card">' +
      alertBannerHtml +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.65rem;margin-bottom:1rem;">' +
      '<div><label class="ms-sa-label">🔎 Filtro por DNI / Documento</label><input class="ms-sa-input" id="ms-cv-dni-inp" value="' +
      esc(STATE_CV.filterDni) +
      '" placeholder="Ej: 38123456"></div>' +
      '<div><label class="ms-sa-label">Buscar por Nombre, Código o Localidad</label><input class="ms-sa-input" id="ms-cv-search-inp" value="' +
      esc(STATE_CV.filterSearch) +
      '" placeholder="Ej: González, CV-2026..., Río Cuarto"></div>' +
      '<div><label class="ms-sa-label">Filtrar por Puesto</label><select class="ms-sa-select" id="ms-cv-puesto-sel"><option value="">Todos los puestos</option>' +
      puestoOptions +
      '</select></div>' +
      (isPrevisualizados
        ? '<div><label class="ms-sa-label">Valoración Mínima (1 a 10)</label><select class="ms-sa-select" id="ms-cv-minrate-sel">' +
          '<option value="0" ' +
          (STATE_CV.filterMinRating === 0 ? 'selected' : '') +
          '>Todas las valoraciones</option>' +
          '<option value="8" ' +
          (STATE_CV.filterMinRating === 8 ? 'selected' : '') +
          '>8 a 10 (Destacados)</option>' +
          '<option value="6" ' +
          (STATE_CV.filterMinRating === 6 ? 'selected' : '') +
          '>6 o más</option>' +
          '<option value="4" ' +
          (STATE_CV.filterMinRating === 4 ? 'selected' : '') +
          '>4 o más</option>' +
          '</select></div>' +
          '<div><label class="ms-sa-label">Ordenar listado</label><select class="ms-sa-select" id="ms-cv-sort-sel">' +
          '<option value="recent" ' +
          (STATE_CV.sortBy === 'recent' ? 'selected' : '') +
          '>Más recientes primero</option>' +
          '<option value="rating_desc" ' +
          (STATE_CV.sortBy === 'rating_desc' ? 'selected' : '') +
          '>Mayor valoración (10 → 1)</option>' +
          '</select></div>'
        : '') +
      '</div>' +
      '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;">' +
      '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;font-size:0.8rem;">' +
      '<th style="padding:0.55rem;">Postulante</th>' +
      '<th style="padding:0.55rem;">Puesto y Horario</th>' +
      '<th style="padding:0.55rem;">Ubicación</th>' +
      '<th style="padding:0.55rem;">Adjunto PDF</th>' +
      '<th style="padding:0.55rem;">Fecha</th>' +
      (isPrevisualizados ? '<th style="padding:0.55rem;">Valoración (1 a 10)</th>' : '') +
      '<th style="padding:0.55rem;text-align:right;">Acción</th>' +
      '</tr></thead>' +
      '<tbody>' +
      rowsHtml +
      '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>'
    );
  }

  function renderCvDetailView() {
    var c = STATE_CV.selectedCv;
    if (!c) return '<div class="ms-sa-card">No se seleccionó ningún CV.</div>';

    var p = c.personal || {};
    var u = c.ubicacionContacto || {};
    var post = c.postulacion || {};
    var fh = c.formacionHabilidades || {};
    var arch = c.archivos || {};
    var exps = Array.isArray(c.experiencias) ? c.experiencias : [];

    var waDigits = String(u.whatsappCompleto || '').replace(/\D/g, '');
    var waHref = waDigits
      ? 'https://wa.me/' +
        waDigits +
        '?text=' +
        encodeURIComponent(
          '¡Hola ' +
            (p.nombres || '') +
            '! Nos comunicamos desde Recursos Humanos respecto a tu CV (' +
            c.codigo +
            ') enviado para el puesto de ' +
            (post.puestoPrincipal || '') +
            '.'
        )
      : '';

    var ratingButtons = '';
    for (var r = 1; r <= 10; r++) {
      var active = Number(c.rating) === r;
      ratingButtons +=
        '<button type="button" data-set-cv-score="' +
        r +
        '" style="width:38px;height:38px;border-radius:10px;font-weight:900;font-size:0.92rem;cursor:pointer;border:2px solid ' +
        (active ? '#56D7A1' : 'rgba(255,255,255,0.25)') +
        ';background:' +
        (active ? '#56D7A1' : 'rgba(255,255,255,0.08)') +
        ';color:' +
        (active ? '#112D3A' : '#FFFFFF') +
        ';">' +
        r +
        '</button>';
    }

    var expHtml =
      exps.length === 0
        ? '<p style="font-size:0.84rem;color:#546e7a;margin:0;">Sin experiencia laboral previa declarada (Primer Empleo).</p>'
        : exps
            .map(function (e) {
              return (
                '<div style="padding:0.75rem;border:1px solid #dbe7ec;border-radius:10px;background:#f8fbfc;">' +
                '<div style="font-weight:800;color:#112D3A;">' +
                esc(e.puesto || 'Puesto') +
                ' — ' +
                esc(e.empresa || 'Empresa') +
                ' <span style="font-weight:600;color:#546e7a;">(' +
                esc(e.desdeAnio || '') +
                ' - ' +
                esc(e.hastaAnio || '') +
                ' · ' +
                esc(e.antiguedad || '') +
                ')</span></div>' +
                '<div style="font-size:0.78rem;color:#334155;margin-top:0.2rem;"><strong>Rubro:</strong> ' +
                esc(e.rubroEmpresa || '') +
                ' · <strong>Motivo egreso:</strong> ' +
                esc(e.motivoEgreso || '') +
                '</div>' +
                (e.tareas
                  ? '<div style="font-size:0.8rem;margin-top:0.25rem;"><strong>Tareas:</strong> ' +
                    esc(e.tareas) +
                    '</div>'
                  : '') +
                (e.referenciaNombre || e.referenciaTelefono
                  ? '<div style="font-size:0.78rem;color:#0f5d3f;margin-top:0.25rem;"><strong>Referencia:</strong> ' +
                    esc(e.referenciaNombre || '') +
                    ' ' +
                    esc(e.referenciaTelefono || '') +
                    '</div>'
                  : '') +
                '</div>'
              );
            })
            .join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
      '<div class="ms-sa-card ms-sa-card--highlight">' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:1rem;">' +
      '<div style="display:flex;align-items:center;gap:1rem;">' +
      renderAvatarHtml(c, 74) +
      '<div>' +
      '<span style="background:#56D7A1;color:#112D3A;font-size:0.72rem;font-weight:900;padding:0.18rem 0.6rem;border-radius:999px;">' +
      esc(c.codigo) +
      ' · PREVISUALIZADO</span>' +
      (Number(c.candidateUpdateCount || 0) > 0
        ? '<span style="background:rgba(86,215,161,0.22);color:#56D7A1;border:1px solid #56D7A1;font-size:0.7rem;font-weight:900;padding:0.16rem 0.55rem;border-radius:999px;margin-left:0.4rem;">🔔 ACTUALIZADO POR DNI (' +
          esc(c.candidateUpdateCount) +
          (c.lastCandidateUpdateAt
            ? ' · ' + esc(new Date(c.lastCandidateUpdateAt).toLocaleString('es-AR'))
            : '') +
          ')</span>'
        : '') +
      '<h3 style="margin:0.35rem 0 0.15rem;font-size:1.35rem;color:#FFFFFF;">' +
      esc(p.nombreCompleto || '') +
      '</h3>' +
      '<div style="font-size:0.84rem;color:#d1fae5;">' +
      esc(post.puestoPrincipal || '') +
      ' · ' +
      esc(u.localidad || '') +
      ', ' +
      esc(u.provincia || '') +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">' +
      (waHref
        ? '<a href="' +
          esc(waHref) +
          '" target="_blank" class="ms-sa-btn">📲 Contactar por WhatsApp</a>'
        : '') +
      (arch.pdfUrl
        ? '<a href="' +
          esc(arch.pdfUrl) +
          '" target="_blank" class="ms-sa-btn ms-sa-btn--outline" style="background:#fff;">📄 Abrir PDF</a>' +
          '<a href="' +
          esc(arch.pdfUrl) +
          '&download=1" class="ms-sa-btn ms-sa-btn--outline" style="background:#fff;">⬇ Descargar PDF</a>'
        : '') +
      '</div>' +
      '</div>' +

      '<div style="margin-top:1.1rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.16);">' +
      '<div style="font-size:0.8rem;font-weight:800;color:#56D7A1;margin-bottom:0.45rem;">VALORACIÓN DEL POSTULANTE (DE 1 A 10):</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;">' +
      ratingButtons +
      '<span style="margin-left:0.5rem;font-size:0.85rem;font-weight:800;color:#FFFFFF;">' +
      (c.rating ? 'Puntaje actual: ' + c.rating + ' / 10' : 'Seleccioná un puntaje del 1 al 10') +
      '</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr auto;gap:0.6rem;margin-top:0.85rem;">' +
      '<input class="ms-sa-input" id="ms-cv-notes-inp" value="' +
      esc(c.notes || '') +
      '" placeholder="Observaciones internas del selector (ej: excelente trato, disponibilidad inmediata, citar a entrevista)...">' +
      '<button type="button" class="ms-sa-btn" id="ms-cv-save-notes-btn">💾 Guardar Nota</button>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div class="ms-sa-grid">' +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">👤 Datos Personales y Contacto</h4>' +
      '<div style="display:grid;gap:0.35rem;font-size:0.84rem;">' +
      '<div><strong>Documento:</strong> ' +
      esc(p.tipoDoc) +
      ' ' +
      esc(p.nroDoc) +
      '</div>' +
      '<div><strong>Nacimiento / Edad:</strong> ' +
      esc(p.fechaNacimiento || '—') +
      (p.edad ? ' (' + esc(p.edad) + ' años)' : '') +
      '</div>' +
      '<div><strong>Género / Nacionalidad:</strong> ' +
      esc(p.genero || '—') +
      ' · ' +
      esc(p.nacionalidad || '—') +
      '</div>' +
      '<div><strong>Estado Civil / Cargas:</strong> ' +
      esc(p.estadoCivil || '—') +
      ' · ' +
      esc(p.hijosACargo || '') +
      '</div>' +
      '<div><strong>Ubicación:</strong> ' +
      esc(u.domicilio || '') +
      ' — ' +
      esc(u.localidad || '') +
      ', ' +
      esc(u.provincia || '') +
      ' (' +
      esc(u.pais || '') +
      ' · CP ' +
      esc(u.cp || '') +
      ')</div>' +
      '<div><strong>WhatsApp:</strong> ' +
      esc(u.whatsappCompleto || '') +
      ' (' +
      esc(u.whatsappPais || '') +
      ')</div>' +
      '<div><strong>Email:</strong> ' +
      esc(u.email || '') +
      '</div>' +
      (u.facebookUrl
        ? '<div><strong>Facebook:</strong> ' +
          (/^https?:\/\//i.test(u.facebookUrl)
            ? '<a href="' + esc(u.facebookUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(u.facebookUrl) + '</a>'
            : esc(u.facebookUrl)) +
          '</div>'
        : '') +
      (u.instagramUrl
        ? '<div><strong>Instagram:</strong> ' +
          (/^https?:\/\//i.test(u.instagramUrl)
            ? '<a href="' + esc(u.instagramUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(u.instagramUrl) + '</a>'
            : esc(u.instagramUrl)) +
          '</div>'
        : '') +
      (u.linkedinUrl
        ? '<div><strong>LinkedIn / Web:</strong> <a href="' +
          esc(u.linkedinUrl) +
          '" target="_blank" rel="noopener noreferrer">' +
          esc(u.linkedinUrl) +
          '</a></div>'
        : '') +
      '</div>' +
      '</div>' +

      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">💼 Perfil Laboral, Estudios y Sistemas</h4>' +
      '<div style="display:grid;gap:0.35rem;font-size:0.84rem;">' +
      '<div><strong>Puesto Principal:</strong> ' +
      esc(post.puestoPrincipal || '') +
      '</div>' +
      (post.puestoSecundario
        ? '<div><strong>2° Puesto:</strong> ' + esc(post.puestoSecundario) + '</div>'
        : '') +
      '<div><strong>Disponibilidad / Modalidad:</strong> ' +
      esc(post.disponibilidadHoraria || '') +
      ' · ' +
      esc(post.modalidad || '') +
      ' · Inicio: ' +
      esc(post.incorporacion || '') +
      '</div>' +
      '<div><strong>Experiencia / Movilidad:</strong> ' +
      esc(post.experienciaTotal || '') +
      ' · ' +
      esc(post.movilidadPropia || '') +
      ' (Licencia: ' +
      esc(post.licenciaConducir || '') +
      ')</div>' +
      '<div><strong>Pretensión Salarial:</strong> ' +
      esc(post.pretensionSalarial || 'A convenir') +
      '</div>' +
      '<div><strong>Estudios:</strong> ' +
      esc(fh.nivelEstudios || '') +
      ' (' +
      esc(fh.estadoEstudios || '') +
      ') ' +
      esc(fh.tituloCarrera || '') +
      '</div>' +
      '<div><strong>Manejo Sistemas:</strong> POS/Caja: ' +
      esc(fh.nivelPosFacturacion || '') +
      ' · Excel: ' +
      esc(fh.nivelExcel || '') +
      ' · Digital/WA: ' +
      esc(fh.nivelAtencionDigital || '') +
      '</div>' +
      '<div><strong>Idiomas:</strong> ' +
      (Array.isArray(fh.idiomas) && fh.idiomas.length > 0
        ? fh.idiomas
            .map(function (it) {
              return (
                esc(it.idioma || '') +
                (it.nivel ? ' (' + esc(it.nivel) + ')' : '')
              );
            })
            .filter(Boolean)
            .join(' · ')
        : esc(fh.idiomaPrincipal || 'Ninguno') +
          (fh.idiomaPrincipal && fh.idiomaPrincipal !== 'Ninguno' && fh.nivelIdioma
            ? ' (' + esc(fh.nivelIdioma) + ')'
            : '')) +
      '</div>' +
      (fh.cursosAdicionales
        ? '<div><strong>Cursos / Carnets:</strong> ' + esc(fh.cursosAdicionales) + '</div>'
        : '') +
      '</div>' +
      '</div>' +
      '</div>' +

      (post.presentacion
        ? '<div class="ms-sa-card"><h4 style="margin-top:0;">📝 Presentación del Postulante</h4><p style="margin:0;font-size:0.86rem;line-height:1.5;">' +
          esc(post.presentacion) +
          '</p></div>'
        : '') +

      (Array.isArray(c.customFields) && c.customFields.length > 0
        ? '<div class="ms-sa-card"><h4 style="margin-top:0;">📋 Campos Adicionales del Formulario</h4><div style="display:grid;gap:0.35rem;font-size:0.84rem;">' +
          c.customFields.map(function (cf) {
            return '<div><strong>' + esc(cf.label || cf.key) + ':</strong> ' + esc(cf.value || '') + '</div>';
          }).join('') +
          '</div></div>'
        : '') +

      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">🏢 Experiencia Laboral y Referencias</h4>' +
      '<div style="display:grid;gap:0.65rem;">' +
      expHtml +
      '</div>' +
      '</div>' +

      (arch.pdfUrl
        ? '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">📄 Vista Previa de CV Adjunto en PDF (' +
          esc(arch.pdfNombreOriginal || 'CV.pdf') +
          ')</h4>' +
          '<iframe src="' +
          esc(arch.pdfUrl) +
          '" style="width:100%;height:560px;border:1px solid #cbd5e1;border-radius:12px;" title="CV en PDF"></iframe>' +
          '</div>'
        : '') +

      (c.interview
        ? '<div class="ms-sa-card" style="border-left:4px solid #56D7A1;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;">' +
            '<div>' +
              '<h4 style="margin:0;">Entrevista Realizada · Puntaje Ponderado: ' + Number(c.interview.weightedScore || 0).toFixed(1) + '%</h4>' +
              '<div style="font-size:0.78rem;color:#64748b;margin-top:0.2rem;">Fecha: ' + esc(c.interview.interviewDate || '—') + ' · Evaluado por: ' + esc(c.interview.evaluatedBy || 'admin') + '</div>' +
            '</div>' +
            '<button type="button" class="ms-sa-btn" id="ms-cv-open-interview-from-detail">Editar Evaluación de Entrevista</button>' +
          '</div>' +
          (c.interview.review
            ? '<p style="margin:0.7rem 0 0;font-size:0.86rem;line-height:1.5;white-space:pre-wrap;">' + esc(c.interview.review) + '</p>'
            : '') +
          '</div>'
        : '<div class="ms-sa-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;">' +
            '<div><strong>Entrevista pendiente</strong><div style="font-size:0.78rem;color:#64748b;">Podés cargar la matriz de evaluación y reseña de este candidato.</div></div>' +
            '<button type="button" class="ms-sa-btn" id="ms-cv-open-interview-from-detail">Cargar Entrevista</button>' +
          '</div>') +

      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">' +
      '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-cv-mark-unread-btn">↩ Devolver a "CV recibidos" (sin previsualizar)</button>' +
      '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="border-color:#dc2626;color:#dc2626;" id="ms-cv-delete-btn">🗑 Eliminar CV</button>' +
      '</div>' +
      '</div>'
    );
  }

  function renderPortalQrView() {
    var fullUrl = STATE_CV.publicCvUrl.indexOf('http') === 0
      ? STATE_CV.publicCvUrl
      : window.location.origin + STATE_CV.publicCvUrl;
    var qrSrc =
      'https://api.qrserver.com/v1/create-qr-code/?size=260x260&ecc=M&margin=2&data=' +
      encodeURIComponent(fullUrl);

    return (
      '<div class="ms-sa-grid">' +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">🌐 Enlace Público de Postulaciones</h4>' +
      '<p style="font-size:0.84rem;color:#475569;">Compartí este enlace en tus redes sociales, WhatsApp o avisos de empleo. Todo CV enviado ingresa directo a <strong>CV recibidos</strong>.</p>' +
      '<input class="ms-sa-input" readonly value="' +
      esc(fullUrl) +
      '" onclick="this.select()" style="font-weight:700;margin-bottom:0.75rem;">' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
      '<a href="' +
      esc(fullUrl) +
      '" target="_blank" class="ms-sa-btn">Abrir Formulario ↗</a>' +
      '<button type="button" class="ms-sa-btn ms-sa-btn--dark" id="ms-cv-copy-link-btn" data-url="' +
      esc(fullUrl) +
      '">📋 Copiar Enlace</button>' +
      '</div>' +
      '</div>' +
      '<div class="ms-sa-card" style="text-align:center;">' +
      '<h4 style="margin-top:0;">📱 Código QR para Mostrador / Vidriera</h4>' +
      '<img src="' +
      esc(qrSrc) +
      '" alt="QR Curriculum Vitae" style="width:190px;height:190px;margin:0.4rem auto;border-radius:14px;border:2px solid #56D7A1;padding:6px;background:#fff;">' +
      '<p style="font-size:0.78rem;color:#475569;margin:0.4rem 0 0;">"Escaneá el QR y cargá tu Curriculum Vitae en línea"</p>' +
      '</div>' +
      '</div>'
    );
  }

  var CV_SECTION_NAMES = {
    personal: 'Paso 1 · Datos Personales',
    ubicacion: 'Paso 2 · Ubicación y Contacto',
    postulacion: 'Paso 3 · Puesto y Pretensión',
    formacion: 'Paso 4 · Estudios y Sistemas',
    experiencia: 'Paso 5 · Experiencia y PDF'
  };

  var CV_TYPE_NAMES = {
    text: 'Texto corto',
    textarea: 'Texto largo',
    number: 'Número',
    date: 'Fecha',
    email: 'Email',
    tel: 'Teléfono',
    select: 'Desplegable'
  };

  function cloneField(f) {
    return {
      key: String(f.key || ''),
      label: String(f.label || ''),
      section: String(f.section || 'postulacion'),
      type: String(f.type || 'text'),
      enabled: f.enabled !== false,
      required: Boolean(f.required),
      isCustom: Boolean(f.isCustom),
      locked: Boolean(f.locked),
      placeholder: f.placeholder ? String(f.placeholder) : '',
      options: Array.isArray(f.options) ? f.options.slice() : []
    };
  }

  function renderConfigTablasView() {
    var cfg = STATE_CV.formConfig;
    var fields = (cfg && Array.isArray(cfg.fields)) ? cfg.fields : [];
    var secFilter = STATE_CV.configSectionFilter || 'all';
    var q = String(STATE_CV.configSearch || '').trim().toLowerCase();

    var filtered = fields.filter(function (f) {
      if (secFilter === 'selects' && f.type !== 'select') return false;
      if (secFilter === 'custom' && !f.isCustom) return false;
      if (
        secFilter !== 'all' &&
        secFilter !== 'selects' &&
        secFilter !== 'custom' &&
        f.section !== secFilter
      ) {
        return false;
      }
      if (q) {
        var hay = (
          String(f.label || '') +
          ' ' +
          String(f.key || '') +
          ' ' +
          (Array.isArray(f.options) ? f.options.join(' ') : '')
        ).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var rowsHtml = filtered.length === 0
      ? '<tr><td colspan="6" style="padding:1.5rem;text-align:center;color:#64748b;">No se encontraron campos para ese filtro.</td></tr>'
      : filtered.map(function (f) {
          var isSelect = f.type === 'select';
          var optsCount = Array.isArray(f.options) ? f.options.length : 0;
          var optsPreview = isSelect && optsCount > 0
            ? '<div style="font-size:0.73rem;color:#64748b;margin-top:0.2rem;max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
              esc(f.options.slice(0, 3).join(' · ')) +
              (optsCount > 3 ? ' (+' + (optsCount - 3) + ' más)' : '') +
              '</div>'
            : '';

          return (
            '<tr style="border-bottom:1px solid #e2ecf0;opacity:' + (f.enabled ? '1' : '0.58') + ';">' +
              '<td style="padding:0.6rem;font-size:0.76rem;white-space:nowrap;">' +
                '<span style="display:inline-block;background:#f1f5f9;color:#112D3A;padding:0.2rem 0.5rem;border-radius:999px;font-weight:700;">' +
                  esc(CV_SECTION_NAMES[f.section] || f.section) +
                '</span>' +
              '</td>' +
              '<td style="padding:0.6rem;">' +
                '<div style="font-weight:800;color:#112D3A;font-size:0.86rem;">' +
                  esc(f.label) +
                  (f.isCustom ? ' <span style="background:#e0f2fe;color:#0369a1;font-size:0.68rem;font-weight:800;padding:0.12rem 0.45rem;border-radius:999px;margin-left:0.25rem;">Personalizado</span>' : '') +
                  (f.locked ? ' <span style="background:#fef3c7;color:#92400e;font-size:0.68rem;font-weight:800;padding:0.12rem 0.45rem;border-radius:999px;margin-left:0.25rem;">Base</span>' : '') +
                '</div>' +
                optsPreview +
              '</td>' +
              '<td style="padding:0.6rem;font-size:0.8rem;white-space:nowrap;">' +
                '<span style="font-weight:700;color:#334155;">' + esc(CV_TYPE_NAMES[f.type] || f.type) + '</span>' +
                (isSelect ? ' <small style="color:#047857;font-weight:800;">(' + optsCount + ')</small>' : '') +
              '</td>' +
              '<td style="padding:0.6rem;text-align:center;">' +
                '<input type="checkbox" data-cv-cfg-enabled="' + esc(f.key) + '" ' +
                  (f.enabled ? 'checked' : '') +
                  (f.locked ? ' disabled title="Campo obligatorio del sistema"' : '') +
                  ' style="width:17px;height:17px;accent-color:#112D3A;cursor:' + (f.locked ? 'not-allowed' : 'pointer') + ';">' +
              '</td>' +
              '<td style="padding:0.6rem;text-align:center;">' +
                '<input type="checkbox" data-cv-cfg-req="' + esc(f.key) + '" ' +
                  (f.enabled && f.required ? 'checked' : '') +
                  (f.locked || !f.enabled ? ' disabled' : '') +
                  ' style="width:17px;height:17px;accent-color:#112D3A;cursor:' + (f.locked || !f.enabled ? 'not-allowed' : 'pointer') + ';">' +
              '</td>' +
              '<td style="padding:0.6rem;text-align:right;white-space:nowrap;">' +
                '<button type="button" class="ms-sa-btn ' + (isSelect ? '' : 'ms-sa-btn--outline') + '" style="padding:0.32rem 0.65rem;font-size:0.75rem;margin-right:0.25rem;" data-cv-cfg-edit="' + esc(f.key) + '">' +
                  (isSelect ? '📋 Opciones / Editar' : '✏️ Editar') +
                '</button>' +
                (f.isCustom
                  ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.32rem 0.55rem;font-size:0.75rem;border-color:#dc2626;color:#dc2626;" data-cv-cfg-del="' + esc(f.key) + '" title="Eliminar campo personalizado">🗑</button>'
                  : '') +
              '</td>' +
            '</tr>'
          );
        }).join('');

    var modalHtml = '';
    if (STATE_CV.configModalMode && STATE_CV.configDraft) {
      var d = STATE_CV.configDraft;
      var isNew = STATE_CV.configModalMode === 'new';
      var isSel = d.type === 'select';
      var optRows = (d.options || []).map(function (opt, idx) {
        return (
          '<div class="ms-cv-opt-row" style="display:flex;align-items:center;gap:0.4rem;padding:0.35rem 0.45rem;border-bottom:1px solid #e2ecf0;background:#ffffff;">' +
            '<span style="font-size:0.72rem;font-weight:800;color:#64748b;min-width:22px;text-align:center;">' + (idx + 1) + '</span>' +
            '<input type="text" class="ms-sa-input ms-cv-opt-inp" data-opt-idx="' + idx + '" value="' + esc(opt) + '" style="flex:1;padding:0.38rem 0.6rem;font-size:0.84rem;">' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-opt-up="' + idx + '" ' + (idx === 0 ? 'disabled style="opacity:0.35;padding:0.28rem 0.45rem;font-size:0.75rem;"' : 'style="padding:0.28rem 0.45rem;font-size:0.75rem;"') + ' title="Subir">↑</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-opt-down="' + idx + '" ' + (idx === d.options.length - 1 ? 'disabled style="opacity:0.35;padding:0.28rem 0.45rem;font-size:0.75rem;"' : 'style="padding:0.28rem 0.45rem;font-size:0.75rem;"') + ' title="Bajar">↓</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-opt-del="' + idx + '" style="padding:0.28rem 0.5rem;font-size:0.75rem;border-color:#dc2626;color:#dc2626;" title="Quitar opción">✕</button>' +
          '</div>'
        );
      }).join('');

      modalHtml =
        '<div id="ms-cv-cfg-modal-backdrop" role="dialog" aria-modal="true" style="position:fixed;inset:0;z-index:9999;background:rgba(17,45,58,0.68);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto;">' +
          '<div style="width:100%;max-width:640px;max-height:92vh;display:flex;flex-direction:column;background:#ffffff;border-radius:18px;border:2px solid #56D7A1;box-shadow:0 24px 60px rgba(0,0,0,0.32);overflow:hidden;">' +
            '<div style="background:#112D3A;color:#ffffff;padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-shrink:0;">' +
              '<div>' +
                '<div style="font-size:0.7rem;font-weight:900;text-transform:uppercase;letter-spacing:0.06em;color:#56D7A1;">Curriculum Vitae · Configuración de Tablas</div>' +
                '<h3 style="margin:0.15rem 0 0;font-size:1.08rem;color:#ffffff;">' + (isNew ? '➕ Agregar Nuevo Campo al Formulario' : '✏️ Editar Campo: ' + esc(d.label)) + '</h3>' +
              '</div>' +
              '<button type="button" id="ms-cv-cfg-modal-close" aria-label="Cerrar" style="background:rgba(255,255,255,0.12);border:none;color:#ffffff;width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:1rem;font-weight:900;">✕</button>' +
            '</div>' +
            '<form id="ms-cv-cfg-modal-form" style="padding:1.25rem;display:grid;gap:0.9rem;overflow-y:auto;">' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;">' +
                '<div style="grid-column:1 / -1;">' +
                  '<label class="ms-sa-label">Nombre / Etiqueta del Campo *</label>' +
                  '<input class="ms-sa-input" id="ms-cv-cfg-label" required value="' + esc(d.label) + '" placeholder="Ej: Disponibilidad para horas extras, Pretensión Salarial...">' +
                '</div>' +
                '<div>' +
                  '<label class="ms-sa-label">Sección del Formulario</label>' +
                  '<select class="ms-sa-select" id="ms-cv-cfg-section" ' + (!isNew && !d.isCustom ? 'disabled' : '') + '>' +
                    Object.keys(CV_SECTION_NAMES).map(function (sk) {
                      return '<option value="' + sk + '" ' + (d.section === sk ? 'selected' : '') + '>' + esc(CV_SECTION_NAMES[sk]) + '</option>';
                    }).join('') +
                  '</select>' +
                '</div>' +
                '<div>' +
                  '<label class="ms-sa-label">Tipo de Campo</label>' +
                  '<select class="ms-sa-select" id="ms-cv-cfg-type" ' + (!isNew && !d.isCustom ? 'disabled' : '') + '>' +
                    Object.keys(CV_TYPE_NAMES).map(function (tk) {
                      return '<option value="' + tk + '" ' + (d.type === tk ? 'selected' : '') + '>' + esc(CV_TYPE_NAMES[tk]) + '</option>';
                    }).join('') +
                  '</select>' +
                '</div>' +
                (!isSel
                  ? '<div style="grid-column:1 / -1;">' +
                      '<label class="ms-sa-label">Texto de ayuda (placeholder)</label>' +
                      '<input class="ms-sa-input" id="ms-cv-cfg-placeholder" value="' + esc(d.placeholder || '') + '" placeholder="Ejemplo que verá el postulante dentro del campo">' +
                    '</div>'
                  : '') +
              '</div>' +

              '<div style="display:flex;flex-wrap:wrap;gap:1.25rem;padding:0.65rem 0.9rem;border-radius:10px;background:#f8fbfc;border:1px solid #dbe7ec;font-size:0.84rem;font-weight:700;">' +
                '<label style="display:inline-flex;align-items:center;gap:0.4rem;cursor:' + (d.locked ? 'not-allowed' : 'pointer') + ';"><input type="checkbox" id="ms-cv-cfg-enabled" ' + (d.enabled ? 'checked' : '') + (d.locked ? ' disabled' : '') + '> ✅ Campo habilitado en /cv</label>' +
                '<label style="display:inline-flex;align-items:center;gap:0.4rem;cursor:' + (d.locked || !d.enabled ? 'not-allowed' : 'pointer') + ';"><input type="checkbox" id="ms-cv-cfg-required" ' + (d.enabled && d.required ? 'checked' : '') + (d.locked || !d.enabled ? ' disabled' : '') + '> ★ Obligatorio</label>' +
              '</div>' +

              (isSel
                ? '<div>' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.4rem;">' +
                      '<label class="ms-sa-label" style="margin:0;">Opciones del Desplegable (' + (d.options || []).length + ')</label>' +
                      '<small style="color:#64748b;font-weight:600;">Editá los textos, reordená o agregá nuevas opciones</small>' +
                    '</div>' +
                    '<div id="ms-cv-opt-list" style="max-height:240px;overflow-y:auto;border:1px solid #cbd5e1;border-radius:10px;background:#ffffff;">' +
                      (optRows || '<div style="padding:0.9rem;text-align:center;color:#64748b;font-size:0.82rem;">Aún no hay opciones. Agregá al menos una abajo.</div>') +
                    '</div>' +
                    '<div style="display:flex;gap:0.45rem;margin-top:0.55rem;">' +
                      '<input type="text" class="ms-sa-input" id="ms-cv-opt-new-inp" placeholder="Nueva opción (ej: $ 1.500.000 a $ 2.000.000 netos)..." style="flex:1;">' +
                      '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-cv-opt-add-btn" style="white-space:nowrap;">➕ Agregar opción</button>' +
                    '</div>' +
                  '</div>'
                : '') +

              '<div style="display:flex;justify-content:flex-end;gap:0.55rem;padding-top:0.4rem;border-top:1px solid #e2ecf0;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-cv-cfg-modal-cancel">Cancelar</button>' +
                '<button type="submit" class="ms-sa-btn">💾 ' + (isNew ? 'Agregar y Guardar' : 'Aplicar y Guardar') + '</button>' +
              '</div>' +
            '</form>' +
          '</div>' +
        '</div>';
    }

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div id="ms-cv-cfg-card" class="ms-sa-card ms-cv-cfg-card">' +
          '<div id="ms-cv-cfg-sticky-panel" class="ms-cv-cfg-sticky-panel">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.7rem;margin-bottom:0.85rem;">' +
              '<div>' +
                '<h4 style="margin:0;">Configuración de Tablas y Campos del Formulario</h4>' +
                '<div style="font-size:0.78rem;color:#64748b;margin-top:0.2rem;">Habilitá o deshabilitá campos, agregá nuevos campos y actualizá las opciones desplegables (como pretensión salarial, puestos o rubros).</div>' +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-cv-cfg-new-btn">➕ Nuevo Campo</button>' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-cv-cfg-reset-btn">↺ Restablecer</button>' +
                '<button type="button" class="ms-sa-btn" id="ms-cv-cfg-save-btn" style="' + (STATE_CV.configDirty ? 'background:#56D7A1;color:#112D3A;' : '') + '">💾 ' + (STATE_CV.configDirty ? 'Guardar Cambios *' : 'Guardar Cambios') + '</button>' +
              '</div>' +
            '</div>' +

            '<div style="display:flex;flex-wrap:wrap;gap:0.6rem;">' +
              '<select class="ms-sa-select" id="ms-cv-cfg-filter-sec" style="max-width:300px;">' +
                '<option value="all" ' + (secFilter === 'all' ? 'selected' : '') + '>Todos los campos (' + fields.length + ')</option>' +
                '<option value="selects" ' + (secFilter === 'selects' ? 'selected' : '') + '>📋 Solo Desplegables (Pretensión salarial, Puestos...)</option>' +
                '<option value="custom" ' + (secFilter === 'custom' ? 'selected' : '') + '>✨ Solo Campos Personalizados</option>' +
                Object.keys(CV_SECTION_NAMES).map(function (sk) {
                  return '<option value="' + sk + '" ' + (secFilter === sk ? 'selected' : '') + '>' + esc(CV_SECTION_NAMES[sk]) + '</option>';
                }).join('') +
              '</select>' +
              '<input class="ms-sa-input" id="ms-cv-cfg-search" style="max-width:280px;" value="' + esc(STATE_CV.configSearch) + '" placeholder="Buscar campo u opción (ej: salarial)...">' +
            '</div>' +
          '</div>' +

          '<div class="ms-cv-cfg-table-wrap">' +
            '<table class="ms-cv-cfg-table" data-excel-table-key="cv-form-config" style="width:100%;border-collapse:separate;border-spacing:0;">' +
              '<thead><tr style="text-align:left;font-size:0.78rem;">' +
                '<th style="padding:0.55rem 0.5rem;">Sección</th>' +
                '<th style="padding:0.55rem 0.5rem;">Campo / Etiqueta</th>' +
                '<th style="padding:0.55rem 0.5rem;">Tipo</th>' +
                '<th style="padding:0.55rem 0.5rem;text-align:center;">Habilitado</th>' +
                '<th style="padding:0.55rem 0.5rem;text-align:center;">Obligatorio</th>' +
                '<th style="padding:0.55rem 0.5rem;text-align:right;">Acciones</th>' +
              '</tr></thead>' +
              '<tbody>' + rowsHtml + '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>' +
      modalHtml
    );
  }

  function getAllActiveCvs() {
    var byId = {};
    var out = [];
    STATE_CV.previsualizados.concat(STATE_CV.recibidos).forEach(function (cv) {
      if (cv && cv.id && !byId[cv.id]) {
        byId[cv.id] = true;
        out.push(cv);
      }
    });
    out.sort(function (a, b) {
      var na = String((a.personal && a.personal.nombreCompleto) || '');
      var nb = String((b.personal && b.personal.nombreCompleto) || '');
      return na.localeCompare(nb, 'es');
    });
    return out;
  }

  function loadCandidateIntoInterviewForm(cvId) {
    STATE_CV.interviewSelectedId = cvId || '';
    var cv = cvId ? findCvById(cvId) : null;
    if (cv && cv.interview && cv.interview.scores) {
      var s = defaultInterviewScores();
      INTERVIEW_CRITERIA.forEach(function (c) {
        var v = Number(cv.interview.scores[c.key]);
        if (v >= 1 && v <= 5) s[c.key] = Math.round(v);
      });
      STATE_CV.interviewScores = s;
      STATE_CV.interviewReview = String(cv.interview.review || '');
      STATE_CV.interviewDate = String(cv.interview.interviewDate || todayIsoLocal());
    } else {
      STATE_CV.interviewScores = defaultInterviewScores();
      STATE_CV.interviewReview = '';
      STATE_CV.interviewDate = todayIsoLocal();
    }
  }

  function scoreBadgeStyle(pct) {
    var n = Number(pct || 0);
    if (n >= 80) return { bg: '#dcfce7', fg: '#065f46' };
    if (n >= 60) return { bg: '#fef3c7', fg: '#92400e' };
    return { bg: '#fee2e2', fg: '#991b1b' };
  }

  function renderEntrevistasView() {
    ensureInterviewStyles();
    var allCvs = getAllActiveCvs();
    var selectedCv = STATE_CV.interviewSelectedId
      ? findCvById(STATE_CV.interviewSelectedId)
      : null;

    var scores = STATE_CV.interviewScores || defaultInterviewScores();
    var weighted = calcInterviewWeighted(scores);

    var puestosMap = {};
    STATE_CV.entrevistados.forEach(function (cv) {
      var p = cv.postulacion && cv.postulacion.puestoPrincipal;
      if (p) puestosMap[p] = true;
    });
    var puestosList = Object.keys(puestosMap).sort();

    var q = String(STATE_CV.interviewSearch || '').trim().toLowerCase();
    var ranked = STATE_CV.entrevistados
      .slice()
      .sort(function (a, b) {
        var diff =
          Number((b.interview && b.interview.weightedScore) || 0) -
          Number((a.interview && a.interview.weightedScore) || 0);
        if (diff !== 0) return diff;
        return String((b.interview && b.interview.evaluatedAt) || '').localeCompare(
          String((a.interview && a.interview.evaluatedAt) || '')
        );
      })
      .filter(function (cv) {
        if (
          STATE_CV.interviewFilterPuesto &&
          (!cv.postulacion || cv.postulacion.puestoPrincipal !== STATE_CV.interviewFilterPuesto)
        ) {
          return false;
        }
        if (q) {
          var hay = (
            String((cv.personal && cv.personal.nombreCompleto) || '') + ' ' +
            String((cv.personal && cv.personal.nroDoc) || '') + ' ' +
            String((cv.postulacion && cv.postulacion.puestoPrincipal) || '') + ' ' +
            String((cv.interview && cv.interview.review) || '')
          ).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });

    var candidateOpts =
      '<option value="">— Seleccioná un perfil para evaluar —</option>' +
      allCvs.map(function (cv) {
        var nm = (cv.personal && cv.personal.nombreCompleto) || 'Sin nombre';
        var dni = (cv.personal && cv.personal.nroDoc) || '';
        var puesto = (cv.postulacion && cv.postulacion.puestoPrincipal) || '';
        var tag =
          cv.interview && typeof cv.interview.weightedScore === 'number'
            ? ' [Evaluado: ' + Number(cv.interview.weightedScore).toFixed(1) + '%]'
            : '';
        return (
          '<option value="' + esc(cv.id) + '"' + (STATE_CV.interviewSelectedId === cv.id ? ' selected' : '') + '>' +
            esc(nm) + (dni ? ' · DNI ' + esc(dni) : '') + (puesto ? ' · ' + esc(puesto) : '') + tag +
          '</option>'
        );
      }).join('');

    var selectedSubtitle = selectedCv
      ? esc((selectedCv.personal && selectedCv.personal.nombreCompleto) || '') +
        ' · ' +
        esc((selectedCv.postulacion && selectedCv.postulacion.puestoPrincipal) || 'Sin puesto especificado')
      : 'Elegí un perfil arriba para cargar su evaluación';

    var matrixRowsHtml = INTERVIEW_CRITERIA.map(function (c) {
      var val = Math.min(5, Math.max(1, Math.round(Number(scores[c.key] || 3))));
      return (
        '<div style="display:grid;grid-template-columns:minmax(170px,1.5fr) 62px minmax(160px,1.7fr) 44px;align-items:center;gap:0.8rem;padding:0.62rem 0;border-top:1px solid rgba(255,255,255,0.08);">' +
          '<div style="font-size:0.9rem;font-weight:500;color:#f1f5f9;">' + esc(c.label) + '</div>' +
          '<div style="font-size:0.84rem;color:#94a3b8;font-weight:600;">' + c.weight + '%</div>' +
          '<div>' +
            '<input type="range" min="1" max="5" step="1" value="' + val + '" class="ms-cv-matrix-range" data-interview-score="' + esc(c.key) + '" aria-label="' + esc(c.label) + '">' +
          '</div>' +
          '<div style="text-align:right;font-size:0.88rem;font-weight:800;color:#ffffff;font-variant-numeric:tabular-nums;" id="ms-iv-val-' + esc(c.key) + '">' + val + '/5</div>' +
        '</div>'
      );
    }).join('');

    var rankingHtml = ranked.length === 0
      ? '<div style="text-align:center;padding:2rem 1rem;color:#64748b;font-size:0.88rem;border:1px dashed #cbd5e1;border-radius:14px;">Todavía no hay entrevistas cargadas. Seleccioná un perfil arriba, completá la matriz de evaluación y la reseña para armar el ranking ordenado de mayor a menor.</div>'
      : ranked.map(function (cv, idx) {
          var iv = cv.interview || {};
          var pct = Number(iv.weightedScore || 0);
          var badge = scoreBadgeStyle(pct);
          var p = cv.personal || {};
          var post = cv.postulacion || {};
          var arch = cv.archivos || {};
          var miniScores = INTERVIEW_CRITERIA.map(function (c) {
            var sv = (iv.scores && iv.scores[c.key]) || 0;
            return '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#f1f5f9;color:#334155;font-size:0.72rem;font-weight:600;">' + esc(c.label) + ': <strong>' + sv + '/5</strong></span>';
          }).join(' ');

          return (
            '<div style="background:#fff;border:1px solid rgba(17,45,58,0.12);border-radius:16px;padding:1.05rem 1.15rem;display:grid;gap:0.75rem;">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
                '<div style="display:flex;align-items:center;gap:0.85rem;min-width:220px;">' +
                  '<div style="width:36px;height:36px;border-radius:10px;background:#112D3A;color:#56D7A1;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:0.9rem;flex-shrink:0;">#' + (idx + 1) + '</div>' +
                  (arch.fotoUrl
                    ? '<img src="' + esc(arch.fotoUrl) + '" alt="' + esc(p.nombreCompleto) + '" style="width:44px;height:44px;border-radius:12px;object-fit:cover;border:1px solid #cbd5e1;flex-shrink:0;">'
                    : '') +
                  '<div>' +
                    '<div style="font-weight:800;font-size:0.98rem;color:#112D3A;">' + esc(p.nombreCompleto || 'Sin nombre') + '</div>' +
                    '<div style="font-size:0.76rem;color:#64748b;">DNI ' + esc(p.nroDoc || '—') + ' · ' + esc(post.puestoPrincipal || 'Sin puesto') + ' · Entrevista: ' + esc(iv.interviewDate || '—') + '</div>' +
                  '</div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;">' +
                  '<div style="padding:0.35rem 0.85rem;border-radius:999px;background:' + badge.bg + ';color:' + badge.fg + ';font-size:0.95rem;font-weight:900;font-variant-numeric:tabular-nums;">' + pct.toFixed(1) + '%</div>' +
                  '<button type="button" class="ms-sa-btn" data-iv-edit="' + esc(cv.id) + '" style="padding:0.38rem 0.75rem;font-size:0.76rem;">Editar</button>' +
                  '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-iv-open-cv="' + esc(cv.id) + '" style="padding:0.38rem 0.75rem;font-size:0.76rem;">Ver CV</button>' +
                  '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-iv-delete="' + esc(cv.id) + '" style="padding:0.38rem 0.65rem;font-size:0.76rem;border-color:#fca5a5;color:#b91c1c;">Quitar</button>' +
                '</div>' +
              '</div>' +

              '<div style="height:7px;width:100%;border-radius:999px;background:#e2e8f0;overflow:hidden;">' +
                '<div style="height:100%;width:' + Math.min(100, Math.max(0, pct)) + '%;background:#112D3A;border-radius:999px;"></div>' +
              '</div>' +

              '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;">' + miniScores + '</div>' +

              (iv.review
                ? '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:11px;padding:0.7rem 0.85rem;font-size:0.83rem;color:#1e293b;line-height:1.5;white-space:pre-wrap;"><strong style="color:#112D3A;display:block;font-size:0.74rem;text-transform:uppercase;margin-bottom:3px;">Reseña de la entrevista</strong>' + esc(iv.review) + '</div>'
                : '') +
            '</div>'
          );
        }).join('');

    return (
      '<div style="display:grid;gap:1.25rem;max-width:1100px;margin:0 auto;">' +

        '<div class="ms-sa-card" style="display:grid;gap:1rem;">' +
          '<div style="display:grid;grid-template-columns:1fr 190px;gap:0.75rem;align-items:end;">' +
            '<div>' +
              '<label style="display:block;font-size:0.78rem;font-weight:800;color:#112D3A;margin-bottom:4px;">Perfil / Candidato Seleccionado</label>' +
              '<select id="ms-iv-candidate-select" class="ms-sa-select" style="width:100%;">' + candidateOpts + '</select>' +
            '</div>' +
            '<div>' +
              '<label style="display:block;font-size:0.78rem;font-weight:800;color:#112D3A;margin-bottom:4px;">Fecha de Entrevista</label>' +
              '<input type="date" id="ms-iv-date" class="ms-sa-input" value="' + esc(STATE_CV.interviewDate || todayIsoLocal()) + '">' +
            '</div>' +
          '</div>' +

          '<div class="ms-cv-matrix-card">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.75rem;">' +
              '<div>' +
                '<div style="font-size:1.2rem;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">Matriz de evaluación del candidato</div>' +
                '<div style="font-size:0.84rem;color:#94a3b8;margin-top:2px;">' + selectedSubtitle + '</div>' +
              '</div>' +
              '<div style="text-align:right;">' +
                '<div id="ms-iv-weighted-display" style="font-size:1.9rem;font-weight:900;color:#ffffff;line-height:1;font-variant-numeric:tabular-nums;">' + weighted.toFixed(1) + '%</div>' +
                '<div style="font-size:0.78rem;color:#94a3b8;margin-top:3px;">Puntaje ponderado</div>' +
              '</div>' +
            '</div>' +

            '<div class="ms-cv-matrix-progress-bg">' +
              '<div id="ms-iv-progress-fill" class="ms-cv-matrix-progress-fill" style="width:' + Math.min(100, Math.max(0, weighted)) + '%;"></div>' +
            '</div>' +

            '<div style="display:grid;grid-template-columns:minmax(170px,1.5fr) 62px minmax(160px,1.7fr) 44px;gap:0.8rem;padding-bottom:0.45rem;font-size:0.76rem;font-weight:700;color:#94a3b8;">' +
              '<div>Competencia</div>' +
              '<div>Peso</div>' +
              '<div>Calificación</div>' +
              '<div></div>' +
            '</div>' +

            matrixRowsHtml +

            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-top:1rem;padding-top:0.85rem;border-top:1px solid rgba(255,255,255,0.08);">' +
              '<span style="font-size:0.8rem;color:#94a3b8;">Modificá las calificaciones del 1 al 5 para calcular el puntaje ponderado.</span>' +
              '<button type="button" id="ms-iv-reset-btn" class="ms-cv-matrix-reset">Restablecer</button>' +
            '</div>' +
          '</div>' +

          '<div>' +
            '<label style="display:block;font-size:0.8rem;font-weight:800;color:#112D3A;margin-bottom:5px;">Reseña de la entrevista</label>' +
            '<textarea id="ms-iv-review-inp" rows="4" class="ms-sa-input" style="width:100%;resize:vertical;" placeholder="Escribí las conclusiones de la entrevista, fortalezas observadas, disponibilidad acordada y recomendación...">' + esc(STATE_CV.interviewReview || '') + '</textarea>' +
          '</div>' +

          '<div style="display:flex;justify-content:flex-end;gap:0.6rem;flex-wrap:wrap;">' +
            '<button type="button" id="ms-iv-save-btn" class="ms-sa-btn" style="padding:0.65rem 1.35rem;font-weight:800;">Guardar Entrevista en el Perfil</button>' +
          '</div>' +
        '</div>' +

        '<div class="ms-sa-card" style="display:grid;gap:0.9rem;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">' +
            '<div>' +
              '<h4 style="margin:0;color:#112D3A;">Ranking de Perfiles Entrevistados (de mayor a menor)</h4>' +
              '<div style="font-size:0.78rem;color:#64748b;margin-top:2px;">Total evaluados: <strong>' + ranked.length + '</strong></div>' +
            '</div>' +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
              '<select id="ms-iv-filter-puesto" class="ms-sa-select" style="max-width:240px;">' +
                '<option value="">Todos los puestos</option>' +
                puestosList.map(function (pu) {
                  return '<option value="' + esc(pu) + '"' + (STATE_CV.interviewFilterPuesto === pu ? ' selected' : '') + '>' + esc(pu) + '</option>';
                }).join('') +
              '</select>' +
              '<input id="ms-iv-search" class="ms-sa-input" style="max-width:230px;" value="' + esc(STATE_CV.interviewSearch || '') + '" placeholder="Buscar candidato o reseña...">' +
            '</div>' +
          '</div>' +
          '<div style="display:grid;gap:0.8rem;">' + rankingHtml + '</div>' +
        '</div>' +

      '</div>'
    );
  }

  function renderCvWorkspace() {
    var bodyEl = document.getElementById('ms-cv-body');
    if (!bodyEl) return;

    if (STATE_CV.activeView === 'recibidos') {
      bodyEl.innerHTML = renderCvListView(false);
    } else if (STATE_CV.activeView === 'previsualizados') {
      bodyEl.innerHTML = renderCvListView(true);
    } else if (STATE_CV.activeView === 'entrevistas') {
      bodyEl.innerHTML = renderEntrevistasView();
    } else if (STATE_CV.activeView === 'detail') {
      bodyEl.innerHTML = renderCvDetailView();
    } else if (STATE_CV.activeView === 'portal') {
      bodyEl.innerHTML = renderPortalQrView();
    } else if (STATE_CV.activeView === 'tablas') {
      bodyEl.innerHTML = renderConfigTablasView();
    }

    bindCvWorkspaceEvents(bodyEl);
  }

  function findCvById(id) {
    return (
      STATE_CV.recibidos.find(function (x) {
        return x.id === id;
      }) ||
      STATE_CV.previsualizados.find(function (x) {
        return x.id === id;
      }) ||
      null
    );
  }

  function bindCvWorkspaceEvents(bodyEl) {
    var dniInp = bodyEl.querySelector('#ms-cv-dni-inp');
    if (dniInp) {
      dniInp.addEventListener('input', function () {
        STATE_CV.filterDni = dniInp.value;
        renderCvWorkspace();
        var nextDniInp = document.getElementById('ms-cv-dni-inp');
        if (nextDniInp) {
          nextDniInp.focus();
          nextDniInp.setSelectionRange(nextDniInp.value.length, nextDniInp.value.length);
        }
      });
    }

    var searchInp = bodyEl.querySelector('#ms-cv-search-inp');
    if (searchInp) {
      searchInp.addEventListener('input', function () {
        STATE_CV.filterSearch = searchInp.value;
        renderCvWorkspace();
        var nextInp = document.getElementById('ms-cv-search-inp');
        if (nextInp) {
          nextInp.focus();
          nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length);
        }
      });
    }

    var puestoSel = bodyEl.querySelector('#ms-cv-puesto-sel');
    if (puestoSel) {
      puestoSel.addEventListener('change', function () {
        STATE_CV.filterPuesto = puestoSel.value;
        renderCvWorkspace();
      });
    }

    var minRateSel = bodyEl.querySelector('#ms-cv-minrate-sel');
    if (minRateSel) {
      minRateSel.addEventListener('change', function () {
        STATE_CV.filterMinRating = Number(minRateSel.value || 0);
        renderCvWorkspace();
      });
    }

    var sortSel = bodyEl.querySelector('#ms-cv-sort-sel');
    if (sortSel) {
      sortSel.addEventListener('change', function () {
        STATE_CV.sortBy = sortSel.value;
        renderCvWorkspace();
      });
    }

    bodyEl.querySelectorAll('[data-open-cv-id]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-open-cv-id');
        var found = findCvById(id);
        if (!found) return;
        STATE_CV.previousListView = STATE_CV.activeView === 'recibidos' ? 'previsualizados' : STATE_CV.activeView;
        if (!found.viewed) {
          var res = await apiCv('POST', { action: 'mark_previewed', id: id });
          if (res && res.ok && res.cv) {
            found = res.cv;
          }
          await reloadCvData(false);
        }
        STATE_CV.selectedCv = found;
        openCvView('detail');
      });
    });

    bodyEl.querySelectorAll('[data-quick-rate]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        var id = sel.getAttribute('data-quick-rate');
        var val = Number(sel.value || 0);
        if (!val) return;
        var res = await apiCv('POST', { action: 'rate_cv', id: id, rating: val });
        if (res && res.ok) {
          showCvToast(res.message || 'Valoración guardada.', false);
          await reloadCvData(true);
        }
      });
    });

    bodyEl.querySelectorAll('[data-set-cv-score]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!STATE_CV.selectedCv) return;
        var score = Number(btn.getAttribute('data-set-cv-score'));
        var notesEl = bodyEl.querySelector('#ms-cv-notes-inp');
        var res = await apiCv('POST', {
          action: 'rate_cv',
          id: STATE_CV.selectedCv.id,
          rating: score,
          notes: notesEl ? notesEl.value : STATE_CV.selectedCv.notes
        });
        if (res && res.ok && res.cv) {
          STATE_CV.selectedCv = res.cv;
          showCvToast(res.message || 'Valoración guardada.', false);
          await reloadCvData(false);
          renderCvWorkspace();
        }
      });
    });

    var saveNotesBtn = bodyEl.querySelector('#ms-cv-save-notes-btn');
    if (saveNotesBtn) {
      saveNotesBtn.addEventListener('click', async function () {
        if (!STATE_CV.selectedCv) return;
        var notesEl = bodyEl.querySelector('#ms-cv-notes-inp');
        var res = await apiCv('POST', {
          action: 'rate_cv',
          id: STATE_CV.selectedCv.id,
          notes: notesEl ? notesEl.value : ''
        });
        if (res && res.ok && res.cv) {
          STATE_CV.selectedCv = res.cv;
          showCvToast('Observaciones guardadas.', false);
          await reloadCvData(false);
        }
      });
    }

    var unreadBtn = bodyEl.querySelector('#ms-cv-mark-unread-btn');
    if (unreadBtn) {
      unreadBtn.addEventListener('click', async function () {
        if (!STATE_CV.selectedCv) return;
        await apiCv('POST', { action: 'unmark_previewed', id: STATE_CV.selectedCv.id });
        showCvToast('El CV volvió a la bandeja de CV recibidos.', false);
        openCvView('recibidos');
      });
    }

    var delBtn = bodyEl.querySelector('#ms-cv-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', async function () {
        if (!STATE_CV.selectedCv) return;
        if (!window.confirm('¿Confirmás eliminar este Curriculum Vitae?')) return;
        await apiCv('POST', { action: 'delete_cv', id: STATE_CV.selectedCv.id });
        openCvView('previsualizados');
      });
    }

    var openIvFromDetail = bodyEl.querySelector('#ms-cv-open-interview-from-detail');
    if (openIvFromDetail) {
      openIvFromDetail.addEventListener('click', function () {
        if (!STATE_CV.selectedCv) return;
        loadCandidateIntoInterviewForm(STATE_CV.selectedCv.id);
        openCvView('entrevistas');
      });
    }

    // --- Submódulo: Entrevistas Realizadas ---
    var ivSel = bodyEl.querySelector('#ms-iv-candidate-select');
    if (ivSel) {
      ivSel.addEventListener('change', function () {
        loadCandidateIntoInterviewForm(ivSel.value);
        renderCvWorkspace();
      });
    }

    var ivDateEl = bodyEl.querySelector('#ms-iv-date');
    if (ivDateEl) {
      ivDateEl.addEventListener('change', function () {
        STATE_CV.interviewDate = ivDateEl.value;
      });
    }

    var ivReviewEl = bodyEl.querySelector('#ms-iv-review-inp');
    if (ivReviewEl) {
      ivReviewEl.addEventListener('input', function () {
        STATE_CV.interviewReview = ivReviewEl.value;
      });
    }

    bodyEl.querySelectorAll('[data-interview-score]').forEach(function (rng) {
      rng.addEventListener('input', function () {
        var key = rng.getAttribute('data-interview-score');
        var val = Math.min(5, Math.max(1, Math.round(Number(rng.value || 3))));
        STATE_CV.interviewScores[key] = val;
        var lbl = document.getElementById('ms-iv-val-' + key);
        if (lbl) lbl.textContent = val + '/5';
        var pct = calcInterviewWeighted(STATE_CV.interviewScores);
        var pctEl = document.getElementById('ms-iv-weighted-display');
        if (pctEl) pctEl.textContent = pct.toFixed(1) + '%';
        var fillEl = document.getElementById('ms-iv-progress-fill');
        if (fillEl) fillEl.style.width = Math.min(100, Math.max(0, pct)) + '%';
      });
    });

    var ivResetBtn = bodyEl.querySelector('#ms-iv-reset-btn');
    if (ivResetBtn) {
      ivResetBtn.addEventListener('click', function () {
        STATE_CV.interviewScores = defaultInterviewScores();
        renderCvWorkspace();
      });
    }

    var ivSaveBtn = bodyEl.querySelector('#ms-iv-save-btn');
    if (ivSaveBtn) {
      ivSaveBtn.addEventListener('click', async function () {
        if (!STATE_CV.interviewSelectedId) {
          showCvToast('Seleccioná primero un perfil / candidato para guardar su entrevista.', true);
          return;
        }
        var reviewVal = ivReviewEl ? ivReviewEl.value : STATE_CV.interviewReview;
        var dateVal = ivDateEl ? ivDateEl.value : STATE_CV.interviewDate;
        var res = await apiCv('POST', {
          action: 'save_interview',
          id: STATE_CV.interviewSelectedId,
          scores: STATE_CV.interviewScores,
          review: reviewVal,
          interviewDate: dateVal
        });
        if (res && res.ok) {
          showCvToast(res.message || 'Entrevista guardada correctamente.', false);
          await reloadCvData(true);
        } else {
          showCvToast((res && res.message) || 'No se pudo guardar la entrevista.', true);
        }
      });
    }

    bodyEl.querySelectorAll('[data-iv-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-iv-edit');
        loadCandidateIntoInterviewForm(id);
        renderCvWorkspace();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    bodyEl.querySelectorAll('[data-iv-open-cv]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-iv-open-cv');
        var found = findCvById(id);
        if (!found) return;
        STATE_CV.previousListView = 'entrevistas';
        STATE_CV.selectedCv = found;
        openCvView('detail');
      });
    });

    bodyEl.querySelectorAll('[data-iv-delete]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-iv-delete');
        if (!window.confirm('¿Quitar la evaluación de entrevista de este perfil? (El CV seguirá guardado).')) return;
        var res = await apiCv('POST', { action: 'delete_interview', id: id });
        if (res && res.ok) {
          if (STATE_CV.interviewSelectedId === id) {
            STATE_CV.interviewScores = defaultInterviewScores();
            STATE_CV.interviewReview = '';
          }
          showCvToast(res.message || 'Evaluación quitada.', false);
          await reloadCvData(true);
        }
      });
    });

    var ivFilterPuesto = bodyEl.querySelector('#ms-iv-filter-puesto');
    if (ivFilterPuesto) {
      ivFilterPuesto.addEventListener('change', function () {
        STATE_CV.interviewFilterPuesto = ivFilterPuesto.value;
        renderCvWorkspace();
      });
    }

    var ivSearch = bodyEl.querySelector('#ms-iv-search');
    if (ivSearch) {
      ivSearch.addEventListener('input', function () {
        STATE_CV.interviewSearch = ivSearch.value;
        renderCvWorkspace();
        var next = document.getElementById('ms-iv-search');
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      });
    }

    var copyBtn = bodyEl.querySelector('#ms-cv-copy-link-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var url = copyBtn.getAttribute('data-url') || '';
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url);
          showCvToast('Enlace copiado al portapapeles.', false);
        }
      });
    }

    // --- Submódulo: Configuración de Tablas ---
    var persistCvFormConfig = async function () {
      if (!STATE_CV.formConfig) return;
      var res = await apiCv('POST', {
        action: 'save_form_config',
        formConfig: STATE_CV.formConfig
      });
      if (res && res.ok) {
        STATE_CV.formConfig = res.formConfig || STATE_CV.formConfig;
        STATE_CV.configDirty = false;
        showCvToast(res.message || 'Configuración guardada.', false);
        renderCvWorkspace();
      } else {
        showCvToast((res && res.message) || 'Error guardando configuración.', true);
      }
    };

    var syncCfgDraftFromModal = function () {
      if (!STATE_CV.configDraft) return;
      var lblEl = bodyEl.querySelector('#ms-cv-cfg-label');
      if (lblEl) STATE_CV.configDraft.label = lblEl.value;
      var secEl = bodyEl.querySelector('#ms-cv-cfg-section');
      if (secEl) STATE_CV.configDraft.section = secEl.value;
      var typeEl = bodyEl.querySelector('#ms-cv-cfg-type');
      if (typeEl) STATE_CV.configDraft.type = typeEl.value;
      var phEl = bodyEl.querySelector('#ms-cv-cfg-placeholder');
      if (phEl) STATE_CV.configDraft.placeholder = phEl.value;
      var enEl = bodyEl.querySelector('#ms-cv-cfg-enabled');
      if (enEl && !STATE_CV.configDraft.locked) STATE_CV.configDraft.enabled = enEl.checked;
      var reqEl = bodyEl.querySelector('#ms-cv-cfg-required');
      if (reqEl && !STATE_CV.configDraft.locked) {
        STATE_CV.configDraft.required = STATE_CV.configDraft.enabled && reqEl.checked;
      }
      var optInps = bodyEl.querySelectorAll('.ms-cv-opt-inp');
      if (optInps.length > 0) {
        var opts = [];
        optInps.forEach(function (inp) { opts.push(inp.value); });
        STATE_CV.configDraft.options = opts;
      }
    };

    var cfgSecSel = bodyEl.querySelector('#ms-cv-cfg-filter-sec');
    if (cfgSecSel) {
      var syncCvCfgStickyMetrics = function () {
        var cardEl = document.getElementById('ms-cv-cfg-card');
        var panelEl = document.getElementById('ms-cv-cfg-sticky-panel');
        if (!cardEl || !panelEl) return;
        var topbarEl = document.querySelector('.erp-topbar');
        var topbarH = topbarEl ? Math.round(topbarEl.getBoundingClientRect().height) : 64;
        var panelH = Math.round(panelEl.getBoundingClientRect().height);
        cardEl.style.setProperty('--ms-topbar-h', topbarH + 'px');
        cardEl.style.setProperty('--ms-cv-cfg-panel-h', panelH + 'px');
      };
      requestAnimationFrame(syncCvCfgStickyMetrics);
      if (!window.__msCvCfgStickyResizeBound) {
        window.__msCvCfgStickyResizeBound = true;
        window.addEventListener('resize', function () {
          var cardEl = document.getElementById('ms-cv-cfg-card');
          var panelEl = document.getElementById('ms-cv-cfg-sticky-panel');
          if (!cardEl || !panelEl) return;
          var topbarEl = document.querySelector('.erp-topbar');
          var topbarH = topbarEl ? Math.round(topbarEl.getBoundingClientRect().height) : 64;
          var panelH = Math.round(panelEl.getBoundingClientRect().height);
          cardEl.style.setProperty('--ms-topbar-h', topbarH + 'px');
          cardEl.style.setProperty('--ms-cv-cfg-panel-h', panelH + 'px');
        });
      }

      cfgSecSel.addEventListener('change', function () {
        STATE_CV.configSectionFilter = cfgSecSel.value;
        renderCvWorkspace();
      });
    }

    var cfgSearch = bodyEl.querySelector('#ms-cv-cfg-search');
    if (cfgSearch) {
      cfgSearch.addEventListener('input', function () {
        STATE_CV.configSearch = cfgSearch.value;
        renderCvWorkspace();
        var nextEl = document.getElementById('ms-cv-cfg-search');
        if (nextEl) {
          nextEl.focus();
          nextEl.setSelectionRange(nextEl.value.length, nextEl.value.length);
        }
      });
    }

    bodyEl.querySelectorAll('[data-cv-cfg-enabled]').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var key = chk.getAttribute('data-cv-cfg-enabled');
        var fields = (STATE_CV.formConfig && STATE_CV.formConfig.fields) || [];
        var f = fields.find(function (x) { return x.key === key; });
        if (!f || f.locked) return;
        f.enabled = chk.checked;
        if (!f.enabled) f.required = false;
        STATE_CV.configDirty = true;
        renderCvWorkspace();
      });
    });

    bodyEl.querySelectorAll('[data-cv-cfg-req]').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var key = chk.getAttribute('data-cv-cfg-req');
        var fields = (STATE_CV.formConfig && STATE_CV.formConfig.fields) || [];
        var f = fields.find(function (x) { return x.key === key; });
        if (!f || f.locked || !f.enabled) return;
        f.required = chk.checked;
        STATE_CV.configDirty = true;
        renderCvWorkspace();
      });
    });

    var cfgSaveBtn = bodyEl.querySelector('#ms-cv-cfg-save-btn');
    if (cfgSaveBtn) {
      cfgSaveBtn.addEventListener('click', persistCvFormConfig);
    }

    var cfgResetBtn = bodyEl.querySelector('#ms-cv-cfg-reset-btn');
    if (cfgResetBtn) {
      cfgResetBtn.addEventListener('click', async function () {
        if (!window.confirm('¿Restablecer todos los campos y desplegables del formulario /cv a sus valores predeterminados? Se quitarán los campos personalizados.')) {
          return;
        }
        var res = await apiCv('POST', { action: 'reset_form_config' });
        if (res && res.ok) {
          STATE_CV.formConfig = res.formConfig;
          STATE_CV.configDirty = false;
          STATE_CV.configModalMode = null;
          STATE_CV.configDraft = null;
          showCvToast(res.message || 'Configuración restablecida.', false);
          renderCvWorkspace();
        }
      });
    }

    var cfgNewBtn = bodyEl.querySelector('#ms-cv-cfg-new-btn');
    if (cfgNewBtn) {
      cfgNewBtn.addEventListener('click', function () {
        STATE_CV.configModalMode = 'new';
        STATE_CV.configEditingKey = null;
        STATE_CV.configDraft = {
          key: 'custom_' + Date.now(),
          label: '',
          section: 'postulacion',
          type: 'text',
          enabled: true,
          required: false,
          isCustom: true,
          locked: false,
          placeholder: '',
          options: ['Opción 1', 'Opción 2']
        };
        renderCvWorkspace();
        var l = document.getElementById('ms-cv-cfg-label');
        if (l) l.focus();
      });
    }

    bodyEl.querySelectorAll('[data-cv-cfg-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-cv-cfg-edit');
        var fields = (STATE_CV.formConfig && STATE_CV.formConfig.fields) || [];
        var f = fields.find(function (x) { return x.key === key; });
        if (!f) return;
        STATE_CV.configModalMode = 'edit';
        STATE_CV.configEditingKey = key;
        STATE_CV.configDraft = cloneField(f);
        renderCvWorkspace();
      });
    });

    bodyEl.querySelectorAll('[data-cv-cfg-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var key = btn.getAttribute('data-cv-cfg-del');
        if (!window.confirm('¿Eliminar este campo personalizado del formulario /cv?')) return;
        if (!STATE_CV.formConfig || !Array.isArray(STATE_CV.formConfig.fields)) return;
        STATE_CV.formConfig.fields = STATE_CV.formConfig.fields.filter(function (x) {
          return x.key !== key;
        });
        await persistCvFormConfig();
      });
    });

    var closeCfgModal = function () {
      STATE_CV.configModalMode = null;
      STATE_CV.configEditingKey = null;
      STATE_CV.configDraft = null;
      renderCvWorkspace();
    };
    var cfgModalBackdrop = bodyEl.querySelector('#ms-cv-cfg-modal-backdrop');
    if (cfgModalBackdrop) {
      cfgModalBackdrop.addEventListener('click', function (ev) {
        if (ev.target === cfgModalBackdrop) closeCfgModal();
      });
    }
    var cfgModalClose = bodyEl.querySelector('#ms-cv-cfg-modal-close');
    if (cfgModalClose) cfgModalClose.addEventListener('click', closeCfgModal);
    var cfgModalCancel = bodyEl.querySelector('#ms-cv-cfg-modal-cancel');
    if (cfgModalCancel) cfgModalCancel.addEventListener('click', closeCfgModal);

    var cfgTypeSel = bodyEl.querySelector('#ms-cv-cfg-type');
    if (cfgTypeSel) {
      cfgTypeSel.addEventListener('change', function () {
        syncCfgDraftFromModal();
        if (STATE_CV.configDraft && STATE_CV.configDraft.type === 'select' && (!STATE_CV.configDraft.options || STATE_CV.configDraft.options.length === 0)) {
          STATE_CV.configDraft.options = ['Opción 1', 'Opción 2'];
        }
        renderCvWorkspace();
      });
    }

    var cfgModalEnabled = bodyEl.querySelector('#ms-cv-cfg-enabled');
    if (cfgModalEnabled) {
      cfgModalEnabled.addEventListener('change', function () {
        syncCfgDraftFromModal();
        renderCvWorkspace();
      });
    }

    var addOptionAction = function () {
      syncCfgDraftFromModal();
      var newInp = bodyEl.querySelector('#ms-cv-opt-new-inp');
      var txt = newInp ? String(newInp.value || '').trim() : '';
      if (!txt || !STATE_CV.configDraft) return;
      if (!Array.isArray(STATE_CV.configDraft.options)) STATE_CV.configDraft.options = [];
      STATE_CV.configDraft.options.push(txt);
      renderCvWorkspace();
      var nextInp = document.getElementById('ms-cv-opt-new-inp');
      if (nextInp) nextInp.focus();
    };
    var optAddBtn = bodyEl.querySelector('#ms-cv-opt-add-btn');
    if (optAddBtn) optAddBtn.addEventListener('click', addOptionAction);
    var optNewInp = bodyEl.querySelector('#ms-cv-opt-new-inp');
    if (optNewInp) {
      optNewInp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          addOptionAction();
        }
      });
    }

    bodyEl.querySelectorAll('[data-opt-up]').forEach(function (b) {
      b.addEventListener('click', function () {
        syncCfgDraftFromModal();
        var i = Number(b.getAttribute('data-opt-up'));
        var arr = STATE_CV.configDraft && STATE_CV.configDraft.options;
        if (!arr || i <= 0) return;
        var tmp = arr[i - 1];
        arr[i - 1] = arr[i];
        arr[i] = tmp;
        renderCvWorkspace();
      });
    });

    bodyEl.querySelectorAll('[data-opt-down]').forEach(function (b) {
      b.addEventListener('click', function () {
        syncCfgDraftFromModal();
        var i = Number(b.getAttribute('data-opt-down'));
        var arr = STATE_CV.configDraft && STATE_CV.configDraft.options;
        if (!arr || i >= arr.length - 1) return;
        var tmp = arr[i + 1];
        arr[i + 1] = arr[i];
        arr[i] = tmp;
        renderCvWorkspace();
      });
    });

    bodyEl.querySelectorAll('[data-opt-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        syncCfgDraftFromModal();
        var i = Number(b.getAttribute('data-opt-del'));
        var arr = STATE_CV.configDraft && STATE_CV.configDraft.options;
        if (!arr) return;
        arr.splice(i, 1);
        renderCvWorkspace();
      });
    });

    var cfgModalForm = bodyEl.querySelector('#ms-cv-cfg-modal-form');
    if (cfgModalForm) {
      cfgModalForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        syncCfgDraftFromModal();
        var d = STATE_CV.configDraft;
        if (!d || !STATE_CV.formConfig || !Array.isArray(STATE_CV.formConfig.fields)) return;
        d.label = String(d.label || '').trim();
        if (!d.label) {
          showCvToast('Ingresá un nombre para el campo.', true);
          return;
        }
        if (d.type === 'select') {
          var newOptEl = bodyEl.querySelector('#ms-cv-opt-new-inp');
          if (newOptEl && String(newOptEl.value || '').trim()) {
            d.options.push(String(newOptEl.value || '').trim());
          }
          d.options = (d.options || [])
            .map(function (x) { return String(x || '').trim(); })
            .filter(function (x, idx, arr) { return Boolean(x) && arr.indexOf(x) === idx; });
          if (d.options.length === 0) {
            showCvToast('Agregá al menos una opción para el campo desplegable.', true);
            return;
          }
        } else {
          delete d.options;
        }

        if (STATE_CV.configModalMode === 'new') {
          STATE_CV.formConfig.fields.push(cloneField(d));
        } else {
          var idx = STATE_CV.formConfig.fields.findIndex(function (x) {
            return x.key === STATE_CV.configEditingKey;
          });
          if (idx >= 0) {
            STATE_CV.formConfig.fields[idx] = cloneField(d);
          }
        }
        STATE_CV.configModalMode = null;
        STATE_CV.configEditingKey = null;
        STATE_CV.configDraft = null;
        await persistCvFormConfig();
      });
    }
  }

  function bindGlobalCvNavReset() {
    if (window.__MS_CV_NAV_BOUND__) return;
    window.__MS_CV_NAV_BOUND__ = true;
    document.addEventListener(
      'click',
      function (ev) {
        var t = ev.target;
        if (!t || typeof t.closest !== 'function') return;
        var navTrigger = t.closest('#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card, #ms-personal-home-card');
        if (navTrigger) {
          var m = document.getElementById('sec-menu-cv');
          var d = document.getElementById('sec-cv-workspace');
          var isCvActive = (m && !m.hidden) || (d && !d.hidden);

          if (navTrigger.id === 'btn-topbar-back-facturacion' && isCvActive) {
            ev.preventDefault();
            ev.stopPropagation();
            if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
            if (d && !d.hidden) {
              if (STATE_CV.activeView === 'detail') {
                openCvView(STATE_CV.previousListView || 'previsualizados');
              } else {
                openCvView('menu');
              }
            } else {
              closeCvToHome();
            }
            return;
          }

          if (m) m.hidden = true;
          if (d) d.hidden = true;
        }
      },
      true
    );
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (STATE_CV.activeView === 'tablas' && STATE_CV.configModalMode) {
        STATE_CV.configModalMode = null;
        STATE_CV.configEditingKey = null;
        STATE_CV.configDraft = null;
        renderCvWorkspace();
      }
    });
  }

  var initialBadgeLoaded = false;

  window.__MS_OPEN_CV_MENU__ = function () {
    openCvView('menu');
  };

  window.__MS_SYNC_CV_COUNTERS__ = function () {
    syncCountersUi();
  };

  function syncCvHomeCard() {
    bindGlobalCvNavReset();
    var allowed = isCvModuleAllowed();
    var ownedByPersonal = Boolean(window.__MS_PERSONAL_OWNS_CV__);
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existingCard = document.getElementById('ms-cv-home-card');

    if (ownedByPersonal) {
      if (existingCard) {
        existingCard.hidden = true;
        existingCard.style.display = 'none';
      }
      if (allowed && !initialBadgeLoaded) {
        initialBadgeLoaded = true;
        reloadCvData(false);
      }
      return;
    }

    if (allowed && inicioGrid && !existingCard) {
      var card = document.createElement('article');
      card.id = 'ms-cv-home-card';
      card.className = 'module-card';
      card.setAttribute('data-module-key', 'cv');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
            '<polyline points="14 2 14 8 20 8"></polyline>' +
            '<circle cx="10" cy="13" r="2"></circle>' +
            '<path d="M14 17c0-1.5-1.8-2.5-4-2.5s-4 1-4 2.5"></path>' +
          '</svg>' +
        '</div>' +
        '<h3>Curriculum Vitae</h3>';

      card.addEventListener('click', function () {
        openCvView('menu');
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openCvView('menu');
        }
      });

      // Insertar antes de Perfil / Ayuda para mantener orden natural de módulos operativos
      var perfilCard = inicioGrid.querySelector('[data-module-key="perfil"]');
      if (perfilCard) {
        inicioGrid.insertBefore(card, perfilCard);
      } else {
        inicioGrid.appendChild(card);
      }

      if (!initialBadgeLoaded) {
        initialBadgeLoaded = true;
        reloadCvData(false);
      }
    } else if (existingCard) {
      existingCard.hidden = !allowed;
      existingCard.style.display = allowed ? '' : 'none';
    }
  }

  setInterval(syncCvHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncCvHomeCard);
})();
