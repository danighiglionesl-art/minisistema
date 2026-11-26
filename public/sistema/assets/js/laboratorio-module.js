/* ==========================================================================
   MÓDULO INTEGRAL "LABORATORIO" (ANÁLISIS CLÍNICOS / BIOQUÍMICA) — MINISISTEMA
   Integra:
   1. Pedidos Médicos y Protocolos (autocompletado DNI ARCA, Perfiles rápidos,
      asociación de QR pre-impreso o escaneado, precios Particular/Obra Social
      fácilmente editables, etiquetas de tubos y envío a Caja / Facturación ARCA).
   2. Carga, Validación y Entrega de Resultados (fórmulas automáticas VCM/HCM/CHCM,
      Fórmula Leucocitaria absoluta, HOMA, TyG, Riesgo CV, No-HDL, Aterógeno,
      alertas fuera de rango, historial por paciente, confirmación WhatsApp/Email
      y emisión del Reporte Clínico A4 PDF con Firma Digital del Bioquímico).
   3. Tarjetas QR Pre-impresas para Pacientes (lotes recortables A4).
   4. ABM de Prestaciones Bioquímicas + 100% Nomenclador Nacional (66xxxx) y
      Tabla de Valores de Referencia.
   5. Listas de Costos por Obra Social ($/UB, % o lista por código) y Liquidación.
   6. Firma Digital del Bioquímico por Usuario (pizarra manuscrita o imagen con
      limpieza automática de fondo blanco) y Membrete Institucional.
   ========================================================================== */
(function () {
  'use strict';

  var fmtArs = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  var STATE = {
    loaded: false,
    view: 'menu', // 'menu' | 'ordenes' | 'resultados' | 'qr' | 'nomenclador' | 'obras_sociales' | 'firma'
    portalBaseUrl: '/laboratorio',
    secciones: [],
    config: {},
    catalog: [],
    profiles: [],
    obrasSocialesTarifas: [],
    firmasBioquimicos: [],
    qrCards: [],
    orders: [],
    turnosRef: { obrasSociales: [], pacientes: [], profesionales: [] },
    stats: {},
    // UI states
    orderSearch: '',
    orderStatusFilter: 'ALL',
    orderOsFilter: 'ALL',
    editingOrder: null,
    practicePickerQuery: '',
    selectedResultOrderId: '',
    lastWhatsappUrl: '',
    qrStatusFilter: 'ALL',
    qrBatchFilter: 'ALL',
    nomSearch: '',
    nomSeccion: 'ALL',
    nomPage: 1,
    editingPractice: null,
    selectedOsId: '',
    osCodeSearch: '',
    osLiqFrom: '',
    osLiqTo: '',
    editingSignatureUser: ''
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

  function monthStartIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
  }

  function formatDateAr(iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || '—');
  }

  function formatDniDots(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (!d) return String(raw || '');
    return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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

  function isSubAllowed(subKey) {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    var isBase = Boolean(window.ERP_BRAND && window.ERP_BRAND.isBase);
    var brandMods = (window.ERP_BRAND && window.ERP_BRAND.enabledModules) || [];
    if (
      !isBase &&
      Array.isArray(brandMods) &&
      brandMods.length > 0 &&
      brandMods.indexOf('laboratorio') === -1 &&
      brandMods.indexOf('gestion_consultorios') === -1 &&
      brandMods.indexOf('turnos') === -1 &&
      brandMods.indexOf('laboratorio:' + subKey) === -1
    ) {
      return false;
    }
    if (
      String(u.username).toLowerCase() === 'danielg' ||
      u.role === 'Administrador General' ||
      u.role === 'Administrador'
    ) {
      return true;
    }
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    if (!subKey) {
      return uMods.some(function (m) {
        var s = String(m || '');
        return (
          s === 'laboratorio' ||
          s === 'gestion_consultorios' ||
          s.indexOf('laboratorio:') === 0
        );
      });
    }
    return (
      uMods.indexOf('laboratorio') >= 0 ||
      uMods.indexOf('gestion_consultorios') >= 0 ||
      uMods.indexOf('laboratorio:' + subKey) >= 0
    );
  }

  async function apiLab(method, body) {
    var url = '/sistema/api/laboratorio.php';
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (method === 'GET') {
      url += '?_t=' + Date.now();
      delete opts.headers['Content-Type'];
    } else {
      var u = getActiveUser();
      opts.headers['x-erp-user'] = (u && u.username) || 'sistema';
      opts.body = JSON.stringify(body || {});
    }
    var res = await fetch(url, opts);
    return res.json();
  }

  function applyServerPayload(res) {
    if (!res || !res.ok) return;
    if (res.portalBaseUrl) STATE.portalBaseUrl = res.portalBaseUrl;
    if (Array.isArray(res.secciones)) STATE.secciones = res.secciones;
    if (res.config) STATE.config = res.config;
    if (Array.isArray(res.catalog)) STATE.catalog = res.catalog;
    if (Array.isArray(res.profiles)) STATE.profiles = res.profiles;
    if (Array.isArray(res.obrasSocialesTarifas)) {
      STATE.obrasSocialesTarifas = res.obrasSocialesTarifas;
      if (!STATE.selectedOsId && STATE.obrasSocialesTarifas[0]) {
        STATE.selectedOsId = STATE.obrasSocialesTarifas[0].id;
      }
    }
    if (Array.isArray(res.firmasBioquimicos)) STATE.firmasBioquimicos = res.firmasBioquimicos;
    if (Array.isArray(res.qrCards)) STATE.qrCards = res.qrCards;
    if (Array.isArray(res.orders)) {
      STATE.orders = res.orders;
      if (!STATE.selectedResultOrderId && STATE.orders[0]) {
        STATE.selectedResultOrderId = STATE.orders[0].id;
      }
    }
    if (res.turnosRef) STATE.turnosRef = res.turnosRef;
    if (res.stats) STATE.stats = res.stats;
    STATE.loaded = true;
  }

  async function ensureLoaded(force) {
    if (STATE.loaded && !force) return;
    try {
      var res = await apiLab('GET');
      if (res && res.ok) applyServerPayload(res);
    } catch (_e) {}
  }

  function showToast(msg, isError) {
    var el = document.getElementById('ms-lab-toast');
    if (!el) return;
    el.style.display = 'block';
    el.style.background = isError ? '#fee2e2' : '#dcfce7';
    el.style.color = isError ? '#991b1b' : '#065f46';
    el.style.border = '1px solid ' + (isError ? '#f87171' : '#34d399');
    el.textContent = msg;
    clearTimeout(window.__msLabToastTimer);
    window.__msLabToastTimer = setTimeout(function () {
      if (el) el.style.display = 'none';
    }, 6000);
  }

  function hideAllErpSections() {
    document.querySelectorAll('.erp-main > .erp-section').forEach(function (sec) {
      sec.hidden = true;
    });
  }

  function updateTopbar(visible, label) {
    var backBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backBtn) {
      backBtn.hidden = !visible;
      if (visible) backBtn.textContent = '← Atrás';
    }
    var ind = document.getElementById('topbar-caja-indicator');
    if (ind) {
      ind.hidden = !visible;
      if (visible && label) ind.textContent = label;
    }
  }

  function returnToParentOrHome() {
    hideAllErpSections();
    var gcMenu = document.getElementById('sec-menu-gestion-consultorios');
    if (window.__MS_GESTION_CONSULTORIOS_OWNS_LABORATORIO__ && gcMenu) {
      gcMenu.hidden = false;
      updateTopbar(true, 'GESTIÓN CONSULTORIOS');
      STATE.view = 'menu';
      return;
    }
    var inicio = document.getElementById('sec-inicio');
    if (inicio) inicio.hidden = false;
    updateTopbar(false);
    STATE.view = 'menu';
  }

  // Cálculo de arancel de una práctica según modalidad Particular u Obra Social
  function computePracticePriceForCoverage(catItem, coberturaTipo, osId) {
    if (!catItem) return { unitPrice: 0, coseguro: 0 };
    if (coberturaTipo !== 'obra_social' || !osId) {
      return { unitPrice: Number(catItem.valorParticularArs || 0), coseguro: 0 };
    }
    var os = STATE.obrasSocialesTarifas.find(function (t) {
      return t.id === osId;
    });
    if (!os) {
      return { unitPrice: Number(catItem.valorObraSocialBaseArs || 0), coseguro: 0 };
    }
    if (os.preciosPorCodigo && os.preciosPorCodigo[catItem.codigo] != null) {
      return {
        unitPrice: Number(os.preciosPorCodigo[catItem.codigo]),
        coseguro: 0
      };
    }
    if (os.modalidad === 'por_ub') {
      var ubPrice = Math.round(((Number(catItem.ub) || 1) * (Number(os.valorUbArs) || 1350)) / 10) * 10;
      return { unitPrice: ubPrice, coseguro: 0 };
    }
    if (os.modalidad === 'porcentaje_particular') {
      var pct = Number(os.porcentajeSobreParticular || 80) / 100;
      return {
        unitPrice: Math.round((Number(catItem.valorParticularArs || 0) * pct) / 10) * 10,
        coseguro: 0
      };
    }
    return { unitPrice: Number(catItem.valorObraSocialBaseArs || 0), coseguro: 0 };
  }

  // Tarjeta canónica estricta según GEMINI.md (sólo .module-icon SVG monocromático + <h3>)
  function buildCanonicalCard(subKey, title, svgInner) {
    return (
      '<article class="module-card" role="button" tabindex="0" data-lab-sub="' + esc(subKey) + '" style="cursor:pointer;">' +
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            svgInner +
          '</svg>' +
        '</div>' +
        '<h3>' + esc(title) + '</h3>' +
      '</article>'
    );
  }

  function ensureSectionsMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var menuSec = document.getElementById('sec-menu-laboratorio');
    var workSec = document.getElementById('sec-laboratorio-workspace');

    if (!menuSec) {
      menuSec = document.createElement('section');
      menuSec.id = 'sec-menu-laboratorio';
      menuSec.className = 'erp-section';
      menuSec.hidden = true;
      var backText = window.__MS_GESTION_CONSULTORIOS_OWNS_LABORATORIO__
        ? '← Volver a Gestión Consultorios'
        : '← Volver a Pantalla Principal';

      menuSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-lab-back-parent-btn">' + esc(backText) + '</button>' +
            '<span class="module-breadcrumb">Gestión Consultorios · <strong>Laboratorio Bioquímico</strong></span>' +
          '</div>' +
          '<a href="/laboratorio" target="_blank" class="ms-sa-btn" style="padding:0.42rem 0.9rem;font-size:0.8rem;" id="ms-lab-open-portal-link">📱 Portal Público QR (/laboratorio) ↗</a>' +
        '</div>' +
        '<div class="modules-grid" id="ms-lab-submodules-grid" aria-label="Submódulos de Laboratorio">' +
          buildCanonicalCard(
            'ordenes',
            'Pedidos y Protocolos',
            '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line>'
          ) +
          buildCanonicalCard(
            'resultados',
            'Carga y Entrega de Resultados',
            '<path d="M9 3h6"></path><path d="M10 3v6.5L5.2 17.6A2 2 0 0 0 6.9 20.6h10.2a2 2 0 0 0 1.7-3L14 9.5V3"></path><path d="M7.5 14h9"></path>'
          ) +
          buildCanonicalCard(
            'qr',
            'Tarjetas QR para Pacientes',
            '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><path d="M14 14h3v3h-3z"></path><path d="M18 18h3v3h-3z"></path><path d="M14 19h2v2h-2z"></path><path d="M19 14h2v2h-2z"></path>'
          ) +
          buildCanonicalCard(
            'nomenclador',
            'ABM Prestaciones y Nomenclador',
            '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><line x1="8" y1="7" x2="16" y2="7"></line><line x1="8" y1="11" x2="16" y2="11"></line>'
          ) +
          buildCanonicalCard(
            'obras_sociales',
            'Valores por Obra Social',
            '<rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line><line x1="6" y1="15" x2="10" y2="15"></line>'
          ) +
          buildCanonicalCard(
            'firma',
            'Firma Digital y Membrete',
            '<path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>'
          ) +
        '</div>';

      erpMain.appendChild(menuSec);
      menuSec
        .querySelector('#ms-lab-back-parent-btn')
        .addEventListener('click', returnToParentOrHome);

      menuSec.querySelectorAll('[data-lab-sub]').forEach(function (card) {
        var sub = card.getAttribute('data-lab-sub');
        var act = function () {
          openLaboratorioView(sub);
        };
        card.addEventListener('click', act);
        card.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            act();
          }
        });
      });
    }

    if (!workSec) {
      workSec = document.createElement('section');
      workSec.id = 'sec-laboratorio-workspace';
      workSec.className = 'erp-section';
      workSec.hidden = true;
      workSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-lab-back-menu-btn">← Volver a Laboratorio</button>' +
            '<span class="module-breadcrumb" id="ms-lab-work-breadcrumb">Laboratorio · <strong>Pedidos y Protocolos</strong></span>' +
          '</div>' +
          '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;" id="ms-lab-quick-tabs">' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-lab-tab="ordenes" style="padding:0.35rem 0.7rem;font-size:0.76rem;">📋 Pedidos</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-lab-tab="resultados" style="padding:0.35rem 0.7rem;font-size:0.76rem;">🧪 Resultados y PDF</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-lab-tab="qr" style="padding:0.35rem 0.7rem;font-size:0.76rem;">📱 Tarjetas QR</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-lab-tab="nomenclador" style="padding:0.35rem 0.7rem;font-size:0.76rem;">📖 Nomenclador</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-lab-tab="obras_sociales" style="padding:0.35rem 0.7rem;font-size:0.76rem;">🏥 Obras Sociales</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-lab-tab="firma" style="padding:0.35rem 0.7rem;font-size:0.76rem;">✒️ Firma Digital</button>' +
          '</div>' +
        '</div>' +
        '<div id="ms-lab-toast" style="display:none;margin-bottom:0.85rem;padding:0.7rem 1rem;border-radius:10px;font-size:0.84rem;font-weight:700;"></div>' +
        '<div id="ms-lab-workspace-body"></div>';

      erpMain.appendChild(workSec);
      workSec.querySelector('#ms-lab-back-menu-btn').addEventListener('click', function () {
        openLaboratorioView('menu');
      });
      workSec.querySelectorAll('[data-lab-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openLaboratorioView(btn.getAttribute('data-lab-tab'));
        });
      });
    }

    var portalLink = document.getElementById('ms-lab-open-portal-link');
    if (portalLink && STATE.portalBaseUrl) {
      portalLink.href = STATE.portalBaseUrl;
    }

    return { menuSec: menuSec, workSec: workSec };
  }

  function getViewTitle(v) {
    var map = {
      ordenes: 'Pedidos Médicos y Protocolos',
      resultados: 'Carga, Validación y Reporte PDF',
      qr: 'Tarjetas QR Pre-impresas para Pacientes',
      nomenclador: 'ABM Prestaciones y Nomenclador Bioquímico Nacional',
      obras_sociales: 'Listas de Costos y Liquidación por Obra Social',
      firma: 'Firma Digital del Bioquímico y Membrete'
    };
    return map[v] || 'Laboratorio';
  }

  async function openLaboratorioView(view) {
    var refs = ensureSectionsMounted();
    if (!refs) return;
    STATE.view = view || 'menu';

    hideAllErpSections();
    if (STATE.view === 'menu') {
      refs.menuSec.hidden = false;
      refs.menuSec.querySelectorAll('[data-lab-sub]').forEach(function (card) {
        var sk = card.getAttribute('data-lab-sub');
        var ok = isSubAllowed(sk);
        card.hidden = !ok;
        card.style.display = ok ? '' : 'none';
      });
      updateTopbar(true, 'LABORATORIO BIOQUÍMICO');
      ensureLoaded(false).then(function () {
        var portalLink = document.getElementById('ms-lab-open-portal-link');
        if (portalLink && STATE.portalBaseUrl) portalLink.href = STATE.portalBaseUrl;
      });
      return;
    }

    refs.workSec.hidden = false;
    var bc = document.getElementById('ms-lab-work-breadcrumb');
    if (bc) bc.innerHTML = 'Laboratorio · <strong>' + esc(getViewTitle(STATE.view)) + '</strong>';
    updateTopbar(true, 'LABORATORIO · ' + getViewTitle(STATE.view).toUpperCase());

    refs.workSec.querySelectorAll('[data-lab-tab]').forEach(function (btn) {
      var active = btn.getAttribute('data-lab-tab') === STATE.view;
      btn.classList.toggle('ms-sa-btn--outline', !active);
    });

    var bodyEl = document.getElementById('ms-lab-workspace-body');
    if (!STATE.loaded && bodyEl) {
      bodyEl.innerHTML = '<div class="ms-sa-card" style="padding:2rem;text-align:center;">⏳ Cargando Nomenclador Bioquímico Nacional y base de datos del laboratorio...</div>';
    }
    await ensureLoaded(false);
    renderWorkspace();
  }

  // ==========================================================================
  // GENERADOR DEL REPORTE CLÍNICO A4 / PDF OFICIAL (IDÉNTICO AL MODELO BIOQUÍMICO)
  // ==========================================================================
  function parseRefLinesJs(raw) {
    if (!raw) return [];
    return String(raw)
      .split(/\r?\n/)
      .map(function (l) { return l.trim(); })
      .filter(Boolean)
      .map(function (line) {
        if (line.indexOf('|') >= 0) {
          var idx = line.indexOf('|');
          return {
            left: line.slice(0, idx).trim(),
            right: line.slice(idx + 1).trim()
          };
        }
        return { left: '', right: line };
      });
  }

  function paginatePracticesA4(practicas) {
    var pages = [];
    var cur = [];
    var used = 0;
    var maxUnits = 26;
    (practicas || []).forEach(function (p) {
      var resArr = Array.isArray(p.resultados) ? p.resultados : [];
      var refExtra = 0;
      resArr.forEach(function (r) {
        var ln = String(r.rangoReferencia || '').split(/\n/).filter(Boolean).length;
        if (ln > 1) refExtra += (ln - 1) * 0.65;
      });
      var noteUnits = p.notaPractica ? 2.6 : 0;
      var w = 2.2 + Math.max(1, resArr.length) * 1.05 + refExtra + noteUnits;
      if (cur.length > 0 && used + w > maxUnits) {
        pages.push(cur);
        cur = [p];
        used = w;
        maxUnits = 31;
      } else {
        cur.push(p);
        used += w;
      }
    });
    if (cur.length > 0) pages.push(cur);
    if (pages.length === 0) pages.push([]);
    return pages;
  }

  function openOfficialBiochemicalPdf(order) {
    if (!order) return;
    var cfg = STATE.config || {};
    var u = getActiveUser();
    var fallbackSig =
      STATE.firmasBioquimicos.find(function (f) {
        return u && f.username && f.username.toLowerCase() === String(u.username).toLowerCase();
      }) ||
      STATE.firmasBioquimicos[0] ||
      null;

    var signerName = order.validadoPorNombre || (fallbackSig && fallbackSig.nombreCompleto) || '';
    var signerTitle = order.validadoPorTitulo || (fallbackSig && fallbackSig.tituloProfesional) || 'Bioquímico';
    var signerMat = order.validadoPorMatricula || (fallbackSig && fallbackSig.matricula) || '';
    var signerImg = order.validadoFirmaDataUrl || (fallbackSig && fallbackSig.firmaDataUrl) || '';
    var pieLeyenda =
      (fallbackSig && fallbackSig.resolucionPie) ||
      cfg.leyendaPiePagina ||
      '';

    var qrPortalUrl =
      (STATE.portalBaseUrl || (window.location.origin + '/laboratorio')) +
      '?qr=' +
      encodeURIComponent(order.qrCode || '');
    var qrImgSrc =
      'https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=2&data=' +
      encodeURIComponent(qrPortalUrl);

    var pages = paginatePracticesA4(order.practicas || []);
    var primaryColor = cfg.bannerColorPrimary || '#1e5aa8';

    var sheetsHtml = pages
      .map(function (pagePracs, pageIdx) {
        var topBanner =
          pageIdx === 0
            ? '<div class="inst-banner">' +
                '<div class="inst-row">' +
                  (cfg.logoUrl
                    ? '<img class="inst-logo" src="' + esc(cfg.logoUrl) + '" alt="Logo">'
                    : '<div class="inst-logo-placeholder">⚗️</div>') +
                  '<div class="inst-center">' +
                    '<div class="inst-title">' + esc(cfg.nombreLaboratorio || 'Laboratorio Clínico') + '</div>' +
                    (cfg.subtituloDirector ? '<div class="inst-sub">' + esc(cfg.subtituloDirector) + '</div>' : '') +
                    '<div class="inst-contact">' +
                      (cfg.direccion ? '<span>' + esc(cfg.direccion) + '</span>' : '') +
                      (cfg.telefono ? '<span>' + esc(cfg.telefono) + '</span>' : '') +
                    '</div>' +
                  '</div>' +
                '</div>' +
              '</div>'
            : '';

        var pracsHtml = pagePracs
          .map(function (prac) {
            var lastSub = '';
            var rowsHtml = (prac.resultados || [])
              .map(function (res) {
                var subHeader = '';
                if (res.subgrupo && res.subgrupo !== lastSub) {
                  lastSub = res.subgrupo;
                  subHeader = '<div class="prac-subgrupo">' + esc(res.subgrupo) + '</div>';
                }
                var isExamSub =
                  res.subgrupo &&
                  (res.subgrupo.indexOf('EXAMEN') >= 0 || res.subgrupo.indexOf('ORINA') >= 0);
                var refLines = parseRefLinesJs(res.rangoReferencia);
                var refHtml = refLines
                  .map(function (rl) {
                    return rl.left
                      ? '<div class="ref-split"><span>' + esc(rl.left) + '</span><span>' + esc(rl.right) + '</span></div>'
                      : '<div class="ref-single">' + esc(rl.right) + '</div>';
                  })
                  .join('');

                return (
                  subHeader +
                  '<div class="analyte-row">' +
                    '<div class="analyte-name-col">' +
                      '<span>' + esc(res.label) + (isExamSub ? '' : ':') + '</span>' +
                      '<span class="dot-leader"></span>' +
                    '</div>' +
                    '<div class="analyte-val-col">' +
                      '<span>' + esc(res.valor !== '' && res.valor != null ? res.valor : '—') + (res.unidad ? ' ' + esc(res.unidad) : '') + '</span>' +
                      (res.valorSecundario ? '<span class="val-sec">' + esc(res.valorSecundario) + '</span>' : '') +
                    '</div>' +
                    '<div class="analyte-ref-col">' + refHtml + '</div>' +
                  '</div>'
                );
              })
              .join('');

            var notaHtml = prac.notaPractica
              ? '<div class="prac-note"><strong>Nota:</strong><br>' +
                esc(prac.notaPractica).replace(/\r?\n/g, '<br>') +
                '</div>'
              : '';

            return (
              '<div class="prac-block">' +
                '<div class="prac-title">' + esc(prac.nombre) + '</div>' +
                (prac.metodo ? '<div class="prac-method">Método: ' + esc(prac.metodo) + '</div>' : '') +
                rowsHtml +
                notaHtml +
              '</div>'
            );
          })
          .join('');

        return (
          '<section class="a4-page">' +
            '<div class="page-top">' +
              topBanner +
              '<div class="proto-header ' + (pageIdx === 0 ? 'proto-header--first' : '') + '">' +
                '<div class="proto-line1">' +
                  '<div>Paciente: <strong class="it">' + esc(order.pacienteNombreCompleto) + '</strong>' +
                    '<strong class="it" style="margin-left:16px;">DNI: ' + esc(formatDniDots(order.pacienteDni)) + '</strong>' +
                  '</div>' +
                  '<div>Protocolo: <strong class="it">' + esc(order.protocoloNro) + '</strong></div>' +
                  '<div>Fecha: <strong>' + esc(formatDateAr(order.fecha)) + '</strong></div>' +
                '</div>' +
                '<div class="proto-line2">' +
                  '<div>Médico: <span style="margin-left:8px;">' + esc(order.medicoSolicitante || 'S/D') + '</span></div>' +
                  '<div>Hoja: <strong style="margin-left:6px;">' + (pageIdx + 1) + ' / ' + pages.length + '</strong></div>' +
                '</div>' +
              '</div>' +
              '<div class="col-headers">' +
                '<div></div>' +
                '<div>Resultado</div>' +
                '<div style="padding-left:8px;">Rango de referencia</div>' +
              '</div>' +
              '<div class="practices-container">' + pracsHtml + '</div>' +
            '</div>' +
            '<div class="page-bottom">' +
              '<div class="sig-row">' +
                (cfg.mostrarQrVerificacionEnPdf !== false && order.qrCode
                  ? '<div class="qr-verify">' +
                      '<img src="' + esc(qrImgSrc) + '" alt="QR">' +
                      '<div>' +
                        '<strong>Código QR: ' + esc(order.qrCode) + '</strong><br>' +
                        'Protocolo N° ' + esc(order.protocoloNro) + '<br>' +
                        'Verificación online de resultados' +
                      '</div>' +
                    '</div>'
                  : '<div></div>') +
                '<div class="bioq-sig">' +
                  (signerImg ? '<img src="' + esc(signerImg) + '" alt="Firma">' : '<div style="height:44px;"></div>') +
                  (signerName ? '<div class="sig-name">' + esc(signerName) + '</div>' : '') +
                  '<div class="sig-mat">' + esc((signerTitle + ' ' + signerMat).trim()) + '</div>' +
                '</div>' +
              '</div>' +
              (pieLeyenda ? '<div class="auth-footer">' + esc(pieLeyenda) + '</div>' : '') +
            '</div>' +
          '</section>'
        );
      })
      .join('');

    var fileTitle =
      'RESULTADOS_' +
      order.protocoloNro +
      '_' +
      String(order.pacienteNombreCompleto || 'PACIENTE').replace(/\s+/g, '_') +
      '_DNI' +
      order.pacienteDni;

    var htmlDoc =
      '<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8">' +
      '<title>' + esc(fileTitle) + '</title>' +
      '<style>' +
        '*{box-sizing:border-box;}' +
        'body{margin:0;padding:16px;background:#e2e8f0;font-family:"Times New Roman",Georgia,serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
        '.toolbar{max-width:210mm;margin:0 auto 14px auto;background:#112D3A;color:#fff;padding:10px 16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;font-family:system-ui,sans-serif;}' +
        '.toolbar button{background:#56D7A1;color:#112D3A;border:none;padding:8px 16px;border-radius:8px;font-weight:800;cursor:pointer;font-size:13px;}' +
        '.a4-page{width:210mm;min-height:292mm;background:#fff;margin:0 auto 16px auto;padding:10mm 13mm 9mm 13mm;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 8px 28px rgba(0,0,0,0.15);}' +
        '.inst-banner{background:linear-gradient(180deg,rgba(219,234,254,0.75) 0%,#ffffff 100%);border-top:4px solid ' + esc(primaryColor) + ';padding:8px 12px 6px 12px;margin-bottom:6px;border-radius:4px 4px 0 0;}' +
        '.inst-row{display:flex;align-items:center;gap:14px;}' +
        '.inst-logo{width:64px;height:64px;object-fit:contain;border-radius:50%;border:3px solid ' + esc(primaryColor) + ';background:#fff;padding:3px;}' +
        '.inst-logo-placeholder{width:60px;height:60px;border-radius:50%;border:3px solid ' + esc(primaryColor) + ';display:flex;align-items:center;justify-content:center;font-size:24px;background:#fff;}' +
        '.inst-center{flex:1;text-align:center;}' +
        '.inst-title{font-size:23px;font-weight:700;letter-spacing:2.4px;border-bottom:1.5px solid ' + esc(primaryColor) + ';display:inline-block;padding-bottom:2px;}' +
        '.inst-sub{font-size:12.5px;font-weight:700;margin-top:4px;}' +
        '.inst-contact{font-size:12.5px;font-weight:700;margin-top:4px;display:flex;justify-content:center;gap:28px;flex-wrap:wrap;}' +
        '.proto-header{border-bottom:1.5px solid #000;padding:4px 2px 5px 2px;font-size:12.5px;line-height:1.42;}' +
        '.proto-header--first{border-top:1.5px solid #000;}' +
        '.proto-line1,.proto-line2{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}' +
        '.it{font-style:italic;font-size:13.5px;}' +
        '.col-headers{display:grid;grid-template-columns:46% 24% 30%;padding:4px 2px 7px 2px;font-size:11.5px;}' +
        '.prac-block{margin-bottom:12px;page-break-inside:avoid;}' +
        '.prac-title{font-size:13px;font-weight:700;text-transform:uppercase;}' +
        '.prac-method{font-size:10.5px;color:#1e293b;margin-bottom:3px;}' +
        '.prac-subgrupo{font-family:Arial,Helvetica,sans-serif;font-size:10.8px;font-weight:700;text-transform:uppercase;margin:6px 0 3px 0;}' +
        '.analyte-row{display:grid;grid-template-columns:46% 24% 30%;align-items:start;font-size:11.8px;line-height:1.32;margin-bottom:1.5px;}' +
        '.analyte-name-col{display:flex;align-items:baseline;font-family:Arial,Helvetica,sans-serif;font-size:11.2px;}' +
        '.dot-leader{flex:1;border-bottom:1px dotted #334155;margin:0 8px 3px 6px;min-width:12px;}' +
        '.analyte-val-col{display:flex;gap:14px;font-family:"Times New Roman",Georgia,serif;font-size:12px;}' +
        '.val-sec{white-space:nowrap;}' +
        '.analyte-ref-col{padding-left:8px;font-size:10px;line-height:1.26;}' +
        '.ref-split{display:grid;grid-template-columns:48% 52%;gap:4px;}' +
        '.prac-note{margin-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:10.2px;line-height:1.35;}' +
        '.sig-row{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;}' +
        '.qr-verify{display:flex;align-items:center;gap:8px;font-family:Arial,sans-serif;font-size:8.8px;color:#334155;}' +
        '.qr-verify img{width:46px;height:46px;}' +
        '.bioq-sig{text-align:center;min-width:180px;margin-right:16px;font-family:Arial,Helvetica,sans-serif;}' +
        '.bioq-sig img{height:52px;max-width:165px;object-fit:contain;display:block;margin:0 auto -3px auto;}' +
        '.sig-name{font-weight:700;font-size:11px;}' +
        '.sig-mat{font-size:10.3px;}' +
        '.auth-footer{text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:9.2px;color:#111;padding-top:3px;}' +
        '@media print{@page{size:A4 portrait;margin:8mm 10mm;}body{background:#fff;padding:0;}.toolbar{display:none !important;}.a4-page{box-shadow:none;margin:0;padding:4mm 4mm;width:100%;min-height:276mm;max-height:278mm;page-break-after:always;break-after:page;}.a4-page:last-child{page-break-after:auto;break-after:auto;}}' +
      '</style></head><body>' +
      '<div class="toolbar">' +
        '<div><strong>Informe Bioquímico A4</strong> · Protocolo N° ' + esc(order.protocoloNro) + ' (' + pages.length + ' hoja/s)</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button type="button" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>' +
        '</div>' +
      '</div>' +
      sheetsHtml +
      '</body></html>';

    var win = window.open('', '_blank');
    if (!win) {
      showToast('Habilitá las ventanas emergentes para abrir el PDF A4.', true);
      return;
    }
    win.document.open();
    win.document.write(htmlDoc);
    win.document.close();
  }

  // ==========================================================================
  // IMPRESIÓN DE PLANCHA A4 DE TARJETAS QR RECORTABLES Y ETIQUETAS DE TUBOS
  // ==========================================================================
  function openPrintableQrCardsSheet(cards) {
    if (!cards || cards.length === 0) {
      showToast('No hay tarjetas QR seleccionadas para imprimir.', true);
      return;
    }
    var cfg = STATE.config || {};
    var baseUrl = STATE.portalBaseUrl || (window.location.origin + '/laboratorio');
    var cardsHtml = cards
      .map(function (c) {
        var link = baseUrl + '?qr=' + encodeURIComponent(c.code);
        var qrImg =
          'https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&data=' +
          encodeURIComponent(link);
        return (
          '<div class="qr-card">' +
            '<div class="qr-card-head">' +
              '<strong>' + esc(cfg.nombreLaboratorio || 'Laboratorio Bioquímico') + '</strong>' +
              '<span>' + esc(cfg.telefono || '') + '</span>' +
            '</div>' +
            '<div class="qr-card-body">' +
              '<img src="' + esc(qrImg) + '" alt="' + esc(c.code) + '">' +
              '<div class="qr-card-info">' +
                '<div class="qr-badge">MIS RESULTADOS ONLINE</div>' +
                '<div class="qr-code-txt">' + esc(c.code) + '</div>' +
                '<div class="qr-hint">Escaneá este QR con la cámara de tu celular para ver y descargar tu informe firmado.</div>' +
                '<div class="qr-line">Protocolo: ______________</div>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      })
      .join('');

    var html =
      '<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>Plancha Tarjetas QR Laboratorio</title>' +
      '<style>' +
        '*{box-sizing:border-box;}body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:14px;background:#f1f5f9;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
        '.bar{max-width:210mm;margin:0 auto 12px auto;background:#112D3A;color:#fff;padding:10px 16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;}' +
        '.bar button{background:#56D7A1;color:#112D3A;border:none;padding:8px 16px;border-radius:8px;font-weight:800;cursor:pointer;}' +
        '.sheet{width:210mm;margin:0 auto;background:#fff;padding:8mm;display:grid;grid-template-columns:repeat(2,1fr);gap:4mm;}' +
        '.qr-card{border:1.5px dashed #64748b;border-radius:8px;padding:8px 10px;page-break-inside:avoid;background:#fff;}' +
        '.qr-card-head{display:flex;justify-content:space-between;font-size:10px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:6px;color:#0f172a;}' +
        '.qr-card-body{display:flex;gap:10px;align-items:center;}' +
        '.qr-card-body img{width:68px;height:68px;flex-shrink:0;}' +
        '.qr-badge{font-size:8.5px;font-weight:900;color:#047857;letter-spacing:0.5px;}' +
        '.qr-code-txt{font-family:monospace;font-size:13px;font-weight:900;color:#0f172a;margin:2px 0;}' +
        '.qr-hint{font-size:8.5px;color:#475569;line-height:1.25;}' +
        '.qr-line{font-size:9px;font-weight:700;color:#0f172a;margin-top:5px;}' +
        '@media print{@page{size:A4 portrait;margin:6mm;}body{background:#fff;padding:0;}.bar{display:none;}.sheet{padding:0;width:100%;}}' +
      '</style></head><body>' +
      '<div class="bar"><div><strong>Plancha de ' + cards.length + ' Tarjetas QR Pre-impresas</strong> · Recortables para entregar al paciente</div><button onclick="window.print()">🖨️ Imprimir Plancha A4</button></div>' +
      '<div class="sheet">' + cardsHtml + '</div></body></html>';

    var w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  }

  function openSampleTubeLabels(order) {
    if (!order) return;
    var muestrasMap = {};
    (order.practicas || []).forEach(function (p) {
      var m = p.muestra || 'Suero';
      if (!muestrasMap[m]) muestrasMap[m] = [];
      muestrasMap[m].push(p.codigo);
    });
    var labels = Object.keys(muestrasMap).map(function (m) {
      return (
        '<div class="tube-lbl">' +
          '<div style="display:flex;justify-content:space-between;font-weight:900;font-size:12px;">' +
            '<span>PROT #' + esc(order.protocoloNro) + '</span>' +
            '<span>' + esc(formatDateAr(order.fecha)) + '</span>' +
          '</div>' +
          '<div style="font-weight:800;font-size:11px;margin:2px 0;">' + esc(order.pacienteNombreCompleto) + '</div>' +
          '<div style="font-size:9.5px;">DNI: ' + esc(order.pacienteDni) + ' · <strong>' + esc(m.toUpperCase()) + '</strong></div>' +
          '<div style="font-family:monospace;font-size:8.5px;margin-top:3px;">QR: ' + esc(order.qrCode) + ' | ' + esc(muestrasMap[m].join(', ')) + '</div>' +
        '</div>'
      );
    }).join('');

    var w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Etiquetas Tubos #' + esc(order.protocoloNro) + '</title>' +
        '<style>body{font-family:Arial,sans-serif;padding:12px;}.tube-lbl{width:58mm;border:1px solid #000;border-radius:4px;padding:5px 7px;margin-bottom:6mm;page-break-inside:avoid;}@media print{.no-p{display:none;}}</style></head><body>' +
        '<div class="no-p" style="margin-bottom:10px;"><button onclick="window.print()" style="padding:6px 14px;font-weight:700;cursor:pointer;">🖨️ Imprimir Etiquetas de Tubos</button></div>' +
        labels + '</body></html>'
      );
      w.document.close();
    }
  }

  // ==========================================================================
  // RENDERIZADO PRINCIPAL DE CADA SUBMÓDULO
  // ==========================================================================
  function renderWorkspace() {
    var bodyEl = document.getElementById('ms-lab-workspace-body');
    if (!bodyEl) return;

    if (STATE.view === 'ordenes') bodyEl.innerHTML = renderOrdenesView();
    else if (STATE.view === 'resultados') bodyEl.innerHTML = renderResultadosView();
    else if (STATE.view === 'qr') bodyEl.innerHTML = renderQrView();
    else if (STATE.view === 'nomenclador') bodyEl.innerHTML = renderNomencladorView();
    else if (STATE.view === 'obras_sociales') bodyEl.innerHTML = renderObrasSocialesView();
    else if (STATE.view === 'firma') bodyEl.innerHTML = renderFirmaView();

    bindWorkspaceEvents(bodyEl);
  }

  function estadoPillHtml(est) {
    var map = {
      PENDIENTE_MUESTRA: { bg: '#fef3c7', fg: '#92400e', t: 'Pendiente Muestra' },
      EN_PROCESO: { bg: '#dbeafe', fg: '#1e40af', t: 'En Proceso' },
      VALIDADO: { bg: '#dcfce7', fg: '#166534', t: 'Validado y Firmado' },
      ENTREGADO: { bg: '#d1fae5', fg: '#065f46', t: 'Entregado' },
      ANULADO: { bg: '#fee2e2', fg: '#991b1b', t: 'Anulado' }
    }[est] || { bg: '#f1f5f9', fg: '#334155', t: est || '—' };
    return (
      '<span style="display:inline-block;padding:0.2rem 0.6rem;border-radius:999px;font-size:0.72rem;font-weight:800;background:' +
      map.bg + ';color:' + map.fg + ';">' + esc(map.t) + '</span>'
    );
  }

  // 1) VISTA: PEDIDOS MÉDICOS Y PROTOCOLOS
  function renderOrdenesView() {
    var availableQrs = STATE.qrCards.filter(function (q) {
      return q.status === 'DISPONIBLE';
    });

    var ed = STATE.editingOrder;
    var editorHtml = '';

    if (ed) {
      var osOpts = STATE.obrasSocialesTarifas
        .filter(function (o) { return o.activa !== false; })
        .map(function (o) {
          return (
            '<option value="' + esc(o.id) + '" ' + (ed.obraSocialId === o.id ? 'selected' : '') + '>' +
            esc(o.sigla + ' — ' + o.nombre + ' ($ ' + o.valorUbArs + '/UB)') +
            '</option>'
          );
        })
        .join('');

      var qrSelectOpts =
        '<option value="">✨ Generar nuevo QR automáticamente al guardar</option>' +
        availableQrs.slice(0, 80).map(function (q) {
          return '<option value="' + esc(q.code) + '" ' + (ed.qrCode === q.code ? 'selected' : '') + '>' + esc(q.code + ' (' + q.batchLabel + ')') + '</option>';
        }).join('');

      var qTerm = String(STATE.practicePickerQuery || '').trim().toLowerCase();
      var matches = [];
      if (qTerm.length >= 1) {
        matches = STATE.catalog
          .filter(function (c) {
            if (!c.activa) return false;
            return (
              String(c.codigo).toLowerCase().indexOf(qTerm) >= 0 ||
              String(c.nombre).toLowerCase().indexOf(qTerm) >= 0
            );
          })
          .slice(0, 20);
      }

      var totalUnitSum = (ed.practicas || []).reduce(function (a, p) {
        return a + (Number(p.precioUnitarioArs) || 0);
      }, 0);
      var totalCosSum = (ed.practicas || []).reduce(function (a, p) {
        return a + (Number(p.coseguroPacienteArs) || 0);
      }, 0);

      editorHtml =
        '<div class="ms-sa-card" style="border:2px solid #56D7A1;margin-bottom:1.1rem;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;margin-bottom:0.85rem;">' +
            '<h4 style="margin:0;">' + (ed.id ? '✏️ Editar Pedido / Protocolo N° ' + esc(ed.protocoloNro) : '➕ Nuevo Pedido Médico y Asociación de QR') + '</h4>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-lab-cancel-order">Cerrar Formulario</button>' +
          '</div>' +
          '<form id="ms-lab-order-form" style="display:grid;gap:0.9rem;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.7rem;">' +
              '<div>' +
                '<label class="ms-sa-label">DNI / CUIT Paciente * (Enter busca en ARCA)</label>' +
                '<div style="display:flex;gap:0.35rem;">' +
                  '<input class="ms-sa-input" id="ms-lab-ord-dni" value="' + esc(ed.pacienteDni || '') + '" placeholder="Ej: 22523947" required>' +
                  '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-lab-lookup-dni" title="Buscar en Padrón ARCA / Pacientes" style="padding:0 0.65rem;">🔎</button>' +
                '</div>' +
              '</div>' +
              '<div><label class="ms-sa-label">Apellido(s) *</label><input class="ms-sa-input" id="ms-lab-ord-ape" value="' + esc(ed.pacienteApellido || '') + '" placeholder="GHIGLIONE" required></div>' +
              '<div><label class="ms-sa-label">Nombre(s) *</label><input class="ms-sa-input preserve-case-input" data-preserve-case="true" id="ms-lab-ord-nom" value="' + esc(ed.pacienteNombres || '') + '" placeholder="Daniel Alejandro" required></div>' +
              '<div><label class="ms-sa-label">Sexo Biológico (Rangos Ref.)</label>' +
                '<select class="ms-sa-select" id="ms-lab-ord-sexo">' +
                  '<option value="M" ' + (ed.pacienteSexo !== 'F' ? 'selected' : '') + '>Masculino</option>' +
                  '<option value="F" ' + (ed.pacienteSexo === 'F' ? 'selected' : '') + '>Femenino</option>' +
                '</select>' +
              '</div>' +
              '<div><label class="ms-sa-label">Edad</label><input class="ms-sa-input" type="number" id="ms-lab-ord-edad" value="' + esc(ed.pacienteEdad != null ? ed.pacienteEdad : '') + '" placeholder="Años"></div>' +
              '<div><label class="ms-sa-label">WhatsApp Paciente</label><input class="ms-sa-input" id="ms-lab-ord-tel" value="' + esc(ed.pacienteTelefono || '') + '" placeholder="Ej: 3584254841"></div>' +
              '<div><label class="ms-sa-label">Email Paciente</label><input class="ms-sa-input" type="email" id="ms-lab-ord-email" value="' + esc(ed.pacienteEmail || '') + '" placeholder="paciente@mail.com"></div>' +
              '<div><label class="ms-sa-label">Médico Solicitante</label><input class="ms-sa-input preserve-case-input" data-preserve-case="true" id="ms-lab-ord-medico" value="' + esc(ed.medicoSolicitante || '') + '" placeholder="Ej: MINARDI, Miguel M."></div>' +
              '<div><label class="ms-sa-label">Fecha Protocolo</label><input class="ms-sa-input" type="date" id="ms-lab-ord-fecha" value="' + esc(ed.fecha || todayIso()) + '"></div>' +
              '<div><label class="ms-sa-label">N° Protocolo (auto)</label><input class="ms-sa-input" type="number" id="ms-lab-ord-proto" value="' + esc(ed.protocoloNro || STATE.config.proximoProtocoloNro || 1001) + '"></div>' +
              '<div><label class="ms-sa-label">Diagnóstico / Orden Médica</label><input class="ms-sa-input" id="ms-lab-ord-diag" value="' + esc(ed.diagnosticoPresuntivo || '') + '" placeholder="Ej: Control clínico anual"></div>' +
            '</div>' +

            // Bloque Cobertura + Asociación QR
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;background:#f8fafc;padding:0.85rem;border-radius:12px;border:1px solid #e2e8f0;">' +
              '<div>' +
                '<label class="ms-sa-label">Modalidad de Cobertura</label>' +
                '<select class="ms-sa-select" id="ms-lab-ord-cob">' +
                  '<option value="particular" ' + (ed.coberturaTipo !== 'obra_social' ? 'selected' : '') + '>💵 Particular</option>' +
                  '<option value="obra_social" ' + (ed.coberturaTipo === 'obra_social' ? 'selected' : '') + '>🏥 Obra Social / Prepaga</option>' +
                '</select>' +
              '</div>' +
              (ed.coberturaTipo === 'obra_social'
                ? '<div><label class="ms-sa-label">Obra Social / Convenio</label><select class="ms-sa-select" id="ms-lab-ord-os">' + osOpts + '</select></div>' +
                  '<div><label class="ms-sa-label">N° Afiliado / Credencial</label><input class="ms-sa-input" id="ms-lab-ord-afil" value="' + esc(ed.nroAfiliado || '') + '"></div>' +
                  '<div><label class="ms-sa-label">N° Autorización Colegio/OS</label><input class="ms-sa-input" id="ms-lab-ord-aut" value="' + esc(ed.nroAutorizacion || '') + '"></div>'
                : '') +
              '<div style="grid-column:span 2;">' +
                '<label class="ms-sa-label">📱 Asociar Tarjeta QR (Escanear lector o elegir QR pre-impreso)</label>' +
                '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;">' +
                  '<input class="ms-sa-input" id="ms-lab-ord-qr" style="flex:1;min-width:170px;font-family:monospace;font-weight:800;" value="' + esc(ed.qrCode || '') + '" placeholder="Escanear QR aquí (ej: LAB-XXXX-XXXX) o dejar vacío">' +
                  '<select class="ms-sa-select" id="ms-lab-ord-qr-pick" style="flex:1;min-width:210px;">' + qrSelectOpts + '</select>' +
                '</div>' +
              '</div>' +
            '</div>' +

            // Selector de Perfiles Rápidos + Buscador del Nomenclador 66xxxx
            '<div style="background:#f0fdf4;padding:0.85rem;border-radius:12px;border:1px solid #bbf7d0;">' +
              '<div style="font-size:0.78rem;font-weight:800;color:#065f46;margin-bottom:0.45rem;">⚡ Perfiles Bioquímicos en 1 Clic:</div>' +
              '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.7rem;">' +
                (STATE.profiles || []).map(function (prof) {
                  return (
                    '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-lab-add-profile="' + esc(prof.id) + '" style="padding:0.26rem 0.6rem;font-size:0.73rem;background:#fff;">+ ' + esc(prof.nombre) + '</button>'
                  );
                }).join('') +
              '</div>' +
              '<label class="ms-sa-label">🔎 Agregar Prestación por Código Nomenclador (ej: 660475, 660412) o Nombre</label>' +
              '<input class="ms-sa-input" id="ms-lab-prac-search" value="' + esc(STATE.practicePickerQuery) + '" placeholder="Escribí código 66xxxx o nombre (ej: Hemograma, Glucemia, TSH, PSA, Orina)...">' +
              (matches.length > 0
                ? '<div style="margin-top:0.45rem;max-height:210px;overflow-y:auto;background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:0.3rem;">' +
                    matches.map(function (m) {
                      var pr = computePracticePriceForCoverage(m, ed.coberturaTipo, ed.obraSocialId);
                      return (
                        '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.35rem 0.55rem;border-bottom:1px solid #f1f5f9;font-size:0.8rem;">' +
                          '<div><code>' + esc(m.codigo) + '</code> · <strong>' + esc(m.nombre) + '</strong> <span style="opacity:0.7;">(' + esc(m.ub) + ' UB · ' + esc(m.muestra) + ')</span></div>' +
                          '<button type="button" class="ms-sa-btn" data-lab-add-code="' + esc(m.codigo) + '" style="padding:0.2rem 0.6rem;font-size:0.74rem;">+ Agregar (' + esc(fmtArs.format(pr.unitPrice)) + ')</button>' +
                        '</div>'
                      );
                    }).join('') +
                  '</div>'
                : '') +
            '</div>' +

            // Tabla de Prácticas del Pedido con Precios Editables en Vivo
            '<div style="overflow-x:auto;">' +
              '<table class="ms-sa-table" style="width:100%;">' +
                '<thead>' +
                  '<tr>' +
                    '<th>Código</th>' +
                    '<th>Prestación Bioquímica</th>' +
                    '<th>Muestra</th>' +
                    '<th>U.B.</th>' +
                    '<th>' + (ed.coberturaTipo === 'obra_social' ? 'Valor Obra Social ($) [Editable]' : 'Valor Particular ($) [Editable]') + '</th>' +
                    (ed.coberturaTipo === 'obra_social' ? '<th>Coseguro Paciente ($) [Editable]</th>' : '') +
                    '<th>Quitar</th>' +
                  '</tr>' +
                '</thead>' +
                '<tbody>' +
                  ((ed.practicas || []).length === 0
                    ? '<tr><td colspan="7" style="text-align:center;padding:1.1rem;opacity:0.7;">Seleccioná un perfil rápido arriba o buscá prestaciones del Nomenclador 66xxxx.</td></tr>'
                    : (ed.practicas || []).map(function (p, idx) {
                        return (
                          '<tr>' +
                            '<td><code>' + esc(p.codigo) + '</code></td>' +
                            '<td><strong>' + esc(p.nombre) + '</strong></td>' +
                            '<td style="font-size:0.76rem;">' + esc(p.muestra || 'Suero') + '</td>' +
                            '<td>' + esc(p.ub) + '</td>' +
                            '<td style="max-width:150px;">' +
                              '<input type="number" step="10" min="0" class="ms-sa-input" data-ord-price-idx="' + idx + '" value="' + esc(p.precioUnitarioArs) + '" style="font-weight:800;">' +
                            '</td>' +
                            (ed.coberturaTipo === 'obra_social'
                              ? '<td style="max-width:140px;"><input type="number" step="10" min="0" class="ms-sa-input" data-ord-cos-idx="' + idx + '" value="' + esc(p.coseguroPacienteArs || 0) + '"></td>'
                              : '') +
                            '<td><button type="button" class="ms-sa-btn ms-sa-btn--outline" data-ord-del-idx="' + idx + '" style="padding:0.2rem 0.5rem;border-color:#ef4444;color:#b91c1c;">✕</button></td>' +
                          '</tr>'
                        );
                      }).join('')) +
                '</tbody>' +
              '</table>' +
            '</div>' +

            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.8rem;padding-top:0.5rem;border-top:1px solid #e2e8f0;">' +
              '<div style="font-size:0.9rem;">' +
                'Prácticas: <strong>' + (ed.practicas || []).length + '</strong> · ' +
                (ed.coberturaTipo === 'obra_social'
                  ? 'Total Obra Social: <strong style="color:#0369a1;">' + esc(fmtArs.format(totalUnitSum)) + '</strong> · A abonar Paciente (Coseguro): <strong style="color:#047857;">' + esc(fmtArs.format(totalCosSum)) + '</strong>'
                  : 'Total Particular: <strong style="color:#047857;font-size:1.05rem;">' + esc(fmtArs.format(totalUnitSum)) + '</strong>') +
              '</div>' +
              '<div style="display:flex;gap:0.55rem;flex-wrap:wrap;">' +
                '<button type="submit" class="ms-sa-btn">💾 Guardar Protocolo y Asociar QR</button>' +
              '</div>' +
            '</div>' +
          '</form>' +
        '</div>';
    }

    var qOrd = String(STATE.orderSearch || '').trim().toLowerCase();
    var filteredOrders = STATE.orders.filter(function (o) {
      if (STATE.orderStatusFilter !== 'ALL' && o.estado !== STATE.orderStatusFilter) return false;
      if (STATE.orderOsFilter === 'PARTICULAR' && o.coberturaTipo !== 'particular') return false;
      if (
        STATE.orderOsFilter !== 'ALL' &&
        STATE.orderOsFilter !== 'PARTICULAR' &&
        o.obraSocialId !== STATE.orderOsFilter
      ) {
        return false;
      }
      if (!qOrd) return true;
      return (
        String(o.protocoloNro).indexOf(qOrd) >= 0 ||
        String(o.pacienteNombreCompleto || '').toLowerCase().indexOf(qOrd) >= 0 ||
        String(o.pacienteDni || '').indexOf(qOrd) >= 0 ||
        String(o.qrCode || '').toLowerCase().indexOf(qOrd) >= 0 ||
        String(o.medicoSolicitante || '').toLowerCase().indexOf(qOrd) >= 0
      );
    });

    return (
      editorHtml +
      '<div class="ms-sa-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.7rem;margin-bottom:0.9rem;">' +
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;flex:1;">' +
            '<input class="ms-sa-input" id="ms-lab-filter-q" style="max-width:290px;" value="' + esc(STATE.orderSearch) + '" placeholder="🔎 Buscar protocolo, paciente, DNI o QR...">' +
            '<select class="ms-sa-select" id="ms-lab-filter-status" style="max-width:190px;">' +
              '<option value="ALL">Todos los estados</option>' +
              '<option value="EN_PROCESO" ' + (STATE.orderStatusFilter === 'EN_PROCESO' ? 'selected' : '') + '>En Proceso</option>' +
              '<option value="VALIDADO" ' + (STATE.orderStatusFilter === 'VALIDADO' ? 'selected' : '') + '>Validados</option>' +
              '<option value="ENTREGADO" ' + (STATE.orderStatusFilter === 'ENTREGADO' ? 'selected' : '') + '>Entregados</option>' +
            '</select>' +
          '</div>' +
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-lab-load-demo-btn" title="Carga el protocolo completo de 26 prácticas del modelo bioquímico para probar el PDF de 7 hojas">🧪 Cargar Protocolo Modelo #19928</button>' +
            '<button type="button" class="ms-sa-btn" id="ms-lab-new-order-btn">➕ Nuevo Pedido Médico</button>' +
          '</div>' +
        '</div>' +

        '<div style="overflow-x:auto;">' +
          '<table class="ms-sa-table" data-excel-table-key="lab-protocolos" style="width:100%;">' +
            '<thead>' +
              '<tr>' +
                '<th>Protocolo</th>' +
                '<th>Fecha</th>' +
                '<th>Paciente / DNI</th>' +
                '<th>Médico</th>' +
                '<th>Cobertura</th>' +
                '<th>Tarjeta QR</th>' +
                '<th>Importe</th>' +
                '<th>Estado</th>' +
                '<th>Acciones</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              (filteredOrders.length === 0
                ? '<tr><td colspan="9" style="text-align:center;padding:1.5rem;opacity:0.75;">No hay pedidos cargados. Hacé clic en <strong>"➕ Nuevo Pedido Médico"</strong> o en <strong>"🧪 Cargar Protocolo Modelo #19928"</strong> para ver el reporte de muestra.</td></tr>'
                : filteredOrders.map(function (o) {
                    return (
                      '<tr>' +
                        '<td><strong style="font-size:0.95rem;">#' + esc(o.protocoloNro) + '</strong><div style="font-size:0.7rem;opacity:0.7;">' + (o.practicas || []).length + ' práct.</div></td>' +
                        '<td>' + esc(formatDateAr(o.fecha)) + '</td>' +
                        '<td><strong>' + esc(o.pacienteNombreCompleto) + '</strong><div style="font-size:0.74rem;opacity:0.75;">DNI ' + esc(formatDniDots(o.pacienteDni)) + '</div></td>' +
                        '<td style="font-size:0.8rem;">' + esc(o.medicoSolicitante || '—') + '</td>' +
                        '<td><span style="font-size:0.76rem;font-weight:700;">' + esc(o.obraSocialNombre || 'Particular') + '</span></td>' +
                        '<td><code style="background:#f1f5f9;padding:0.18rem 0.45rem;border-radius:6px;font-weight:800;">' + esc(o.qrCode) + '</code></td>' +
                        '<td style="font-weight:800;">' + esc(fmtArs.format(o.totalGeneralArs || 0)) + '</td>' +
                        '<td>' + estadoPillHtml(o.estado) + '</td>' +
                        '<td style="white-space:nowrap;">' +
                          '<button type="button" class="ms-sa-btn" data-ord-go-res="' + esc(o.id) + '" style="padding:0.25rem 0.55rem;font-size:0.72rem;margin-right:0.25rem;" title="Cargar / Validar Resultados">🧪 Resultados</button>' +
                          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-ord-pdf="' + esc(o.id) + '" style="padding:0.25rem 0.5rem;font-size:0.72rem;margin-right:0.25rem;" title="Emitir Reporte PDF A4">🖨️ PDF</button>' +
                          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-ord-tubes="' + esc(o.id) + '" style="padding:0.25rem 0.5rem;font-size:0.72rem;margin-right:0.25rem;" title="Imprimir etiquetas de tubos">🏷️</button>' +
                          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-ord-pos="' + esc(o.id) + '" style="padding:0.25rem 0.5rem;font-size:0.72rem;margin-right:0.25rem;" title="Enviar a Facturación / Caja POS">🧾 Facturar</button>' +
                          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-ord-edit="' + esc(o.id) + '" style="padding:0.25rem 0.5rem;font-size:0.72rem;margin-right:0.25rem;" title="Editar pedido">✏️</button>' +
                          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-ord-del="' + esc(o.id) + '" style="padding:0.25rem 0.5rem;font-size:0.72rem;border-color:#ef4444;color:#b91c1c;" title="Eliminar">🗑</button>' +
                        '</td>' +
                      '</tr>'
                    );
                  }).join('')) +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>'
    );
  }

  // 2) VISTA: CARGA, VALIDACIÓN Y ENTREGA DE RESULTADOS
  function renderResultadosView() {
    if (STATE.orders.length === 0) {
      return (
        '<div class="ms-sa-card" style="text-align:center;padding:2rem;">' +
          '<h4>No hay protocolos registrados todavía</h4>' +
          '<p style="opacity:0.75;">Cargá un pedido médico o probá el Protocolo Modelo #19928 para visualizar la planilla de resultados y el PDF bioquímico.</p>' +
          '<button type="button" class="ms-sa-btn" id="ms-lab-empty-demo">🧪 Cargar Protocolo Modelo #19928</button>' +
        '</div>'
      );
    }

    var ord =
      STATE.orders.find(function (o) { return o.id === STATE.selectedResultOrderId; }) ||
      STATE.orders[0];
    STATE.selectedResultOrderId = ord.id;

    // Buscar historial previo del mismo DNI para Delta Check
    var prevOrdersSamePatient = STATE.orders.filter(function (o) {
      return o.id !== ord.id && o.pacienteDni && o.pacienteDni === ord.pacienteDni;
    });
    var prevAnalyteMap = {};
    prevOrdersSamePatient.forEach(function (po) {
      (po.practicas || []).forEach(function (pp) {
        (pp.resultados || []).forEach(function (rr) {
          if (rr.valor && !prevAnalyteMap[rr.analyteId]) {
            prevAnalyteMap[rr.analyteId] = rr.valor + ' (' + formatDateAr(po.fecha) + ')';
          }
        });
      });
    });

    var u = getActiveUser();
    var currentUsername = (u && u.username) || 'danielg';
    var sigOpts =
      STATE.firmasBioquimicos.length > 0
        ? STATE.firmasBioquimicos.map(function (f) {
            var sel =
              (ord.validadoPorUsername && ord.validadoPorUsername.toLowerCase() === f.username.toLowerCase()) ||
              (!ord.validadoPorUsername && f.username.toLowerCase() === currentUsername.toLowerCase());
            return (
              '<option value="' + esc(f.username) + '" ' + (sel ? 'selected' : '') + '>' +
              esc(f.nombreCompleto + ' — ' + f.tituloProfesional + ' ' + f.matricula) +
              '</option>'
            );
          }).join('')
        : '<option value="' + esc(currentUsername) + '">Sin firma cargada aún (Configurar en pestaña Firma Digital)</option>';

    var portalLink = (STATE.portalBaseUrl || '/laboratorio') + '?qr=' + encodeURIComponent(ord.qrCode);

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="ms-sa-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;flex:1;">' +
            '<label style="font-weight:800;font-size:0.84rem;">Protocolo Activo:</label>' +
            '<select class="ms-sa-select" id="ms-lab-res-order-sel" style="max-width:440px;font-weight:700;">' +
              STATE.orders.map(function (o) {
                return (
                  '<option value="' + esc(o.id) + '" ' + (o.id === ord.id ? 'selected' : '') + '>' +
                  '#' + esc(o.protocoloNro) + ' — ' + esc(o.pacienteNombreCompleto) + ' (DNI ' + esc(o.pacienteDni) + ') · [' + esc(o.estado) + ']' +
                  '</option>'
                );
              }).join('') +
            '</select>' +
            estadoPillHtml(ord.estado) +
            '<a href="' + esc(portalLink) + '" target="_blank" style="font-size:0.78rem;font-weight:800;color:#047857;text-decoration:underline;">🔗 Ver Portal QR (' + esc(ord.qrCode) + ') ↗</a>' +
          '</div>' +
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-lab-btn-print-pdf">🖨️ Emitir Reporte PDF Oficial (A4)</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-lab-btn-notify-wa" style="border-color:#10b981;color:#047857;">📲 Enviar WhatsApp / Email</button>' +
          '</div>' +
        '</div>' +

        '<form id="ms-lab-results-form" style="display:grid;gap:0.9rem;">' +
          (ord.practicas || []).map(function (prac, pIdx) {
            var lastSub = '';
            return (
              '<div class="ms-sa-card" style="padding:1rem;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;border-bottom:1px solid #e2e8f0;padding-bottom:0.55rem;margin-bottom:0.65rem;">' +
                  '<div>' +
                    '<code style="font-size:0.75rem;background:#f1f5f9;padding:0.12rem 0.4rem;border-radius:4px;">' + esc(prac.codigo) + '</code> ' +
                    '<strong style="font-size:0.95rem;">' + esc(prac.nombre) + '</strong>' +
                  '</div>' +
                  '<div style="display:flex;align-items:center;gap:0.4rem;">' +
                    '<span style="font-size:0.75rem;opacity:0.75;">Método:</span>' +
                    '<input class="ms-sa-input preserve-case-input" data-preserve-case="true" data-res-metodo="' + pIdx + '" value="' + esc(prac.metodo || '') + '" style="padding:0.22rem 0.5rem;font-size:0.76rem;min-width:240px;">' +
                  '</div>' +
                '</div>' +
                '<div style="display:grid;gap:0.4rem;">' +
                  (prac.resultados || []).map(function (res, rIdx) {
                    var subHdr = '';
                    if (res.subgrupo && res.subgrupo !== lastSub) {
                      lastSub = res.subgrupo;
                      subHdr = '<div style="font-size:0.75rem;font-weight:900;color:#0f172a;background:#f8fafc;padding:0.28rem 0.5rem;border-radius:6px;margin-top:0.3rem;">' + esc(res.subgrupo) + '</div>';
                    }
                    var prevVal = prevAnalyteMap[res.analyteId];
                    var flagBadge =
                      res.flag === 'ALTO'
                        ? '<span style="color:#b91c1c;font-weight:900;font-size:0.74rem;">↑ ALTO</span>'
                        : res.flag === 'BAJO'
                          ? '<span style="color:#1d4ed8;font-weight:900;font-size:0.74rem;">↓ BAJO</span>'
                          : '';
                    return (
                      subHdr +
                      '<div style="display:grid;grid-template-columns:minmax(180px,2fr) minmax(150px,1.3fr) minmax(100px,0.8fr) minmax(200px,2fr);gap:0.55rem;align-items:center;font-size:0.82rem;">' +
                        '<div style="font-weight:700;">' +
                          esc(res.label) +
                          (prevVal ? '<div style="font-size:0.68rem;color:#64748b;font-weight:500;">Ant: ' + esc(prevVal) + '</div>' : '') +
                        '</div>' +
                        '<div style="display:flex;align-items:center;gap:0.35rem;">' +
                          '<input class="ms-sa-input preserve-case-input" data-preserve-case="true" data-res-val="' + pIdx + ':' + rIdx + '" data-analyte-id="' + esc(res.analyteId) + '" value="' + esc(res.valor || '') + '" placeholder="Resultado..." style="padding:0.32rem 0.55rem;font-weight:700;">' +
                          '<span style="font-size:0.76rem;opacity:0.8;white-space:nowrap;">' + esc(res.unidad || '') + '</span>' +
                        '</div>' +
                        '<div style="font-size:0.76rem;color:#334155;">' +
                          '<span data-res-sec="' + pIdx + ':' + rIdx + '">' + esc(res.valorSecundario || '') + '</span> ' +
                          flagBadge +
                        '</div>' +
                        '<div style="font-size:0.73rem;color:#475569;white-space:pre-line;line-height:1.2;">' +
                          esc(String(res.rangoReferencia || '').replace(/\s*\|\s*/g, ': ')) +
                        '</div>' +
                      '</div>'
                    );
                  }).join('') +
                '</div>' +
                '<div style="margin-top:0.55rem;">' +
                  '<input class="ms-sa-input preserve-case-input" data-preserve-case="true" data-res-nota="' + pIdx + '" value="' + esc(prac.notaPractica || '') + '" placeholder="Nota opcional al pie de esta práctica (ej. comentario metodológico o sugerencia clínica)..." style="font-size:0.76rem;padding:0.28rem 0.55rem;">' +
                '</div>' +
              '</div>'
            );
          }).join('') +

          // Barra inferior de Firma Digital y Validación
          '<div class="ms-sa-card" style="background:#f0fdf4;border:2px solid #34d399;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.8rem;">' +
            '<div style="display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;">' +
              '<label style="font-weight:800;font-size:0.84rem;color:#065f46;">✒️ Bioquímico Validador (Firma en PDF):</label>' +
              '<select class="ms-sa-select" id="ms-lab-signer-sel" style="min-width:280px;">' + sigOpts + '</select>' +
            '</div>' +
            '<div style="display:flex;gap:0.55rem;flex-wrap:wrap;">' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-lab-save-draft-res">💾 Guardar Borrador</button>' +
              '<button type="submit" class="ms-sa-btn" style="background:#059669;color:#fff;">✅ Validar con Firma Digital, Publicar QR y Notificar</button>' +
            '</div>' +
          '</div>' +
        '</form>' +
      '</div>'
    );
  }

  // 3) VISTA: TARJETAS QR PRE-IMPRESAS PARA PACIENTES
  function renderQrView() {
    var batches = [];
    var seenBatch = {};
    STATE.qrCards.forEach(function (c) {
      if (c.batchId && !seenBatch[c.batchId]) {
        seenBatch[c.batchId] = true;
        batches.push({ id: c.batchId, label: c.batchLabel || c.batchId });
      }
    });

    var filteredCards = STATE.qrCards.filter(function (c) {
      if (STATE.qrStatusFilter !== 'ALL' && c.status !== STATE.qrStatusFilter) return false;
      if (STATE.qrBatchFilter !== 'ALL' && c.batchId !== STATE.qrBatchFilter) return false;
      return true;
    });

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="ms-sa-card" style="border:2px solid #56D7A1;">' +
          '<h4 style="margin:0 0 0.4rem;">🖨️ Generar Nuevo Lote de Tarjetas QR Pre-impresas</h4>' +
          '<p style="margin:0 0 0.85rem;font-size:0.82rem;opacity:0.8;">Imprimí con anticipación planchas A4 de tarjetas QR recortables para tener en el mostrador. Cuando ingresa el paciente con el pedido médico, le entregás una tarjeta en mano y asociás ese código al protocolo.</p>' +
          '<form id="ms-lab-qr-batch-form" style="display:flex;gap:0.65rem;flex-wrap:wrap;align-items:flex-end;">' +
            '<div>' +
              '<label class="ms-sa-label">Cantidad de Tarjetas</label>' +
              '<select class="ms-sa-select" id="ms-lab-qr-qty">' +
                '<option value="12">12 tarjetas (1 hoja A4)</option>' +
                '<option value="24" selected>24 tarjetas (2 hojas A4)</option>' +
                '<option value="48">48 tarjetas (4 hojas A4)</option>' +
                '<option value="96">96 tarjetas (8 hojas A4)</option>' +
              '</select>' +
            '</div>' +
            '<div style="min-width:240px;">' +
              '<label class="ms-sa-label">Identificador del Talonario / Lote</label>' +
              '<input class="ms-sa-input" id="ms-lab-qr-label" placeholder="Ej: Mostrador Recepción Noviembre">' +
            '</div>' +
            '<button type="submit" class="ms-sa-btn">✨ Generar Lote e Imprimir Plancha A4</button>' +
          '</form>' +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.85rem;">' +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
              '<select class="ms-sa-select" id="ms-lab-qr-filter-st">' +
                '<option value="ALL">Todos los estados (' + STATE.qrCards.length + ')</option>' +
                '<option value="DISPONIBLE" ' + (STATE.qrStatusFilter === 'DISPONIBLE' ? 'selected' : '') + '>🟢 Disponibles para entregar (' + (STATE.stats.qrDisponibles || 0) + ')</option>' +
                '<option value="ASIGNADO" ' + (STATE.qrStatusFilter === 'ASIGNADO' ? 'selected' : '') + '>🔵 Asignados en proceso</option>' +
                '<option value="PUBLICADO" ' + (STATE.qrStatusFilter === 'PUBLICADO' ? 'selected' : '') + '>✅ Publicados con resultados</option>' +
              '</select>' +
              '<select class="ms-sa-select" id="ms-lab-qr-filter-batch">' +
                '<option value="ALL">Todos los lotes</option>' +
                batches.map(function (b) {
                  return '<option value="' + esc(b.id) + '" ' + (STATE.qrBatchFilter === b.id ? 'selected' : '') + '>' + esc(b.label) + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-lab-print-filtered-qrs">🖨️ Imprimir Tarjetas Filtradas (' + Math.min(filteredCards.length, 96) + ')</button>' +
          '</div>' +

          '<div style="overflow-x:auto;">' +
            '<table class="ms-sa-table" style="width:100%;">' +
              '<thead><tr><th>Código QR</th><th>Lote</th><th>Estado</th><th>Protocolo / Paciente Asociado</th><th>Acciones</th></tr></thead>' +
              '<tbody>' +
                (filteredCards.length === 0
                  ? '<tr><td colspan="5" style="text-align:center;padding:1.3rem;opacity:0.75;">Aún no generaste tarjetas QR pre-impresas. Usá el botón superior para crear tu primer lote A4.</td></tr>'
                  : filteredCards.slice(0, 120).map(function (c) {
                      var url = (STATE.portalBaseUrl || '/laboratorio') + '?qr=' + encodeURIComponent(c.code);
                      return (
                        '<tr>' +
                          '<td><code style="font-weight:900;font-size:0.86rem;">' + esc(c.code) + '</code></td>' +
                          '<td style="font-size:0.8rem;">' + esc(c.batchLabel || '—') + '</td>' +
                          '<td><strong>' + esc(c.status) + '</strong></td>' +
                          '<td>' + (c.protocoloNro ? '#' + esc(c.protocoloNro) + ' — ' + esc(c.pacienteNombre || '') : '<span style="opacity:0.6;">Libre en mostrador</span>') + '</td>' +
                          '<td style="white-space:nowrap;">' +
                            (c.status === 'DISPONIBLE'
                              ? '<button type="button" class="ms-sa-btn" data-qr-use="' + esc(c.code) + '" style="padding:0.22rem 0.55rem;font-size:0.73rem;margin-right:0.3rem;">➕ Cargar Pedido con este QR</button>'
                              : '') +
                            '<a href="' + esc(url) + '" target="_blank" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.22rem 0.55rem;font-size:0.73rem;text-decoration:none;">🔗 Abrir QR ↗</a>' +
                          '</td>' +
                        '</tr>'
                      );
                    }).join('')) +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // 4) VISTA: ABM DE PRESTACIONES BIOQUÍMICAS Y NOMENCLADOR NACIONAL
  function renderNomencladorView() {
    var ed = STATE.editingPractice;
    var formHtml = '';
    if (ed) {
      var dets = Array.isArray(ed.determinaciones) && ed.determinaciones.length > 0
        ? ed.determinaciones
        : [{ id: 'det_1', label: 'Resultado', unidad: '', rangoReferencia: '' }];

      formHtml =
        '<div class="ms-sa-card" style="border:2px solid #56D7A1;margin-bottom:1rem;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">' +
            '<h4 style="margin:0;">' + (ed._isNew ? '➕ Nueva Prestación Bioquímica' : '✏️ Editar Prestación ' + esc(ed.codigo)) + '</h4>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-lab-nom-cancel">Cancelar</button>' +
          '</div>' +
          '<form id="ms-lab-practice-form" style="display:grid;gap:0.8rem;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.65rem;">' +
              '<div><label class="ms-sa-label">Código Nomenclador *</label><input class="ms-sa-input" id="nom-f-cod" value="' + esc(ed.codigo || '') + '" placeholder="Ej: 660475" required></div>' +
              '<div style="grid-column:span 2;"><label class="ms-sa-label">Nombre de la Prestación *</label><input class="ms-sa-input" id="nom-f-nom" value="' + esc(ed.nombre || '') + '" required></div>' +
              '<div><label class="ms-sa-label">Sección Bioquímica</label><select class="ms-sa-select" id="nom-f-sec">' +
                (STATE.secciones || []).map(function (s) {
                  return '<option value="' + esc(s) + '" ' + (ed.seccion === s ? 'selected' : '') + '>' + esc(s) + '</option>';
                }).join('') +
              '</select></div>' +
              '<div><label class="ms-sa-label">Método Analítico</label><input class="ms-sa-input preserve-case-input" data-preserve-case="true" id="nom-f-met" value="' + esc(ed.metodoDefault || '') + '"></div>' +
              '<div><label class="ms-sa-label">Tipo de Muestra</label><input class="ms-sa-input preserve-case-input" data-preserve-case="true" id="nom-f-mue" value="' + esc(ed.muestra || 'Suero') + '"></div>' +
              '<div><label class="ms-sa-label">Unidades Bioq. (U.B.)</label><input class="ms-sa-input" type="number" step="0.5" id="nom-f-ub" value="' + esc(ed.ub != null ? ed.ub : 3) + '"></div>' +
              '<div><label class="ms-sa-label">Valor Particular ($)</label><input class="ms-sa-input" type="number" step="50" id="nom-f-part" value="' + esc(ed.valorParticularArs != null ? ed.valorParticularArs : 0) + '"></div>' +
              '<div><label class="ms-sa-label">Valor Obra Social Base ($)</label><input class="ms-sa-input" type="number" step="50" id="nom-f-os" value="' + esc(ed.valorObraSocialBaseArs != null ? ed.valorObraSocialBaseArs : 0) + '"></div>' +
            '</div>' +
            '<div><label class="ms-sa-label">Nota Clínica / Metodológica por Defecto (Opcional)</label><textarea class="ms-sa-input preserve-case-input" data-preserve-case="true" rows="2" id="nom-f-nota">' + esc(ed.notaDefault || '') + '</textarea></div>' +

            '<div style="background:#f8fafc;padding:0.8rem;border-radius:10px;border:1px solid #e2e8f0;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">' +
                '<strong style="font-size:0.82rem;">📊 Sub-determinaciones y Tabla de Valores de Referencia</strong>' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="nom-f-add-det" style="padding:0.2rem 0.55rem;font-size:0.74rem;">+ Agregar Determinación</button>' +
              '</div>' +
              '<div style="display:grid;gap:0.5rem;">' +
                dets.map(function (d, dIdx) {
                  return (
                    '<div style="display:grid;grid-template-columns:1.2fr 1fr 0.7fr 2fr auto;gap:0.45rem;align-items:start;">' +
                      '<input class="ms-sa-input preserve-case-input" data-preserve-case="true" data-det-lbl="' + dIdx + '" value="' + esc(d.label || '') + '" placeholder="Determinación (ej: Resultado)">' +
                      '<input class="ms-sa-input" data-det-sub="' + dIdx + '" value="' + esc(d.subgrupo || '') + '" placeholder="Subgrupo (opcional)">' +
                      '<input class="ms-sa-input preserve-case-input" data-preserve-case="true" data-det-uni="' + dIdx + '" value="' + esc(d.unidad || '') + '" placeholder="Unidad (mg/dL)">' +
                      '<textarea class="ms-sa-input preserve-case-input" data-preserve-case="true" rows="2" data-det-ref="' + dIdx + '" placeholder="Ej: Hombre | 0,70 a 1,30&#10;Mujer | 0,60 a 1,10">' + esc(d.rangoReferencia || '') + '</textarea>' +
                      '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-det-del="' + dIdx + '" style="padding:0.25rem 0.5rem;border-color:#ef4444;color:#b91c1c;">✕</button>' +
                    '</div>'
                  );
                }).join('') +
              '</div>' +
            '</div>' +
            '<div style="text-align:right;"><button type="submit" class="ms-sa-btn">💾 Guardar Prestación y Valores de Referencia</button></div>' +
          '</form>' +
        '</div>';
    }

    var q = String(STATE.nomSearch || '').trim().toLowerCase();
    var filtered = STATE.catalog.filter(function (c) {
      if (STATE.nomSeccion !== 'ALL' && c.seccion !== STATE.nomSeccion) return false;
      if (!q) return true;
      return (
        String(c.codigo).toLowerCase().indexOf(q) >= 0 ||
        String(c.nombre).toLowerCase().indexOf(q) >= 0 ||
        String(c.metodoDefault || '').toLowerCase().indexOf(q) >= 0
      );
    });

    var pageSize = 60;
    var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (STATE.nomPage > totalPages) STATE.nomPage = 1;
    var slice = filtered.slice((STATE.nomPage - 1) * pageSize, STATE.nomPage * pageSize);

    return (
      formHtml +
      '<div class="ms-sa-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.85rem;">' +
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;flex:1;">' +
            '<input class="ms-sa-input" id="ms-lab-nom-q" style="max-width:320px;" value="' + esc(STATE.nomSearch) + '" placeholder="🔎 Buscar en ' + STATE.catalog.length + ' códigos Nomenclador (66xxxx o nombre)...">' +
            '<select class="ms-sa-select" id="ms-lab-nom-sec" style="max-width:240px;">' +
              '<option value="ALL">Todas las secciones (' + STATE.catalog.length + ')</option>' +
              (STATE.secciones || []).map(function (s) {
                return '<option value="' + esc(s) + '" ' + (STATE.nomSeccion === s ? 'selected' : '') + '>' + esc(s) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<button type="button" class="ms-sa-btn" id="ms-lab-nom-new">➕ Nueva Prestación Bioquímica</button>' +
        '</div>' +

        '<div style="overflow-x:auto;">' +
          '<table class="ms-sa-table" data-excel-table-key="lab-nomenclador" style="width:100%;">' +
            '<thead>' +
              '<tr>' +
                '<th>Código</th>' +
                '<th>Prestación Bioquímica</th>' +
                '<th>Sección / Muestra</th>' +
                '<th>U.B.</th>' +
                '<th>Valor Particular</th>' +
                '<th>Valor Obra Social Base</th>' +
                '<th>Valores de Referencia</th>' +
                '<th>Acciones</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              slice.map(function (c) {
                var firstRef = (c.determinaciones && c.determinaciones[0] && c.determinaciones[0].rangoReferencia) || '';
                var refPreview = String(firstRef).replace(/\s*\|\s*/g, ': ').slice(0, 90);
                if (c.determinaciones && c.determinaciones.length > 1) {
                  refPreview = '(' + c.determinaciones.length + ' determinaciones) ' + refPreview;
                }
                return (
                  '<tr>' +
                    '<td><code>' + esc(c.codigo) + '</code></td>' +
                    '<td><strong>' + esc(c.nombre) + '</strong><div style="font-size:0.72rem;opacity:0.72;">' + esc(c.metodoDefault || '') + '</div></td>' +
                    '<td style="font-size:0.76rem;">' + esc(c.seccion) + '<div style="opacity:0.7;">' + esc(c.muestra) + '</div></td>' +
                    '<td><strong>' + esc(c.ub) + '</strong></td>' +
                    '<td style="font-weight:800;color:#047857;">' + esc(fmtArs.format(c.valorParticularArs || 0)) + '</td>' +
                    '<td style="font-weight:700;color:#0369a1;">' + esc(fmtArs.format(c.valorObraSocialBaseArs || 0)) + '</td>' +
                    '<td style="font-size:0.73rem;max-width:240px;white-space:pre-line;">' + esc(refPreview) + '</td>' +
                    '<td style="white-space:nowrap;">' +
                      '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-nom-edit="' + esc(c.codigo) + '" style="padding:0.22rem 0.55rem;font-size:0.73rem;">✏️ Editar</button>' +
                    '</td>' +
                  '</tr>'
                );
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.8rem;font-size:0.8rem;">' +
          '<span>Mostrando ' + slice.length + ' de <strong>' + filtered.length + '</strong> prestaciones</span>' +
          '<div style="display:flex;gap:0.4rem;align-items:center;">' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-nom-prev" ' + (STATE.nomPage <= 1 ? 'disabled' : '') + ' style="padding:0.25rem 0.6rem;">◀ Anterior</button>' +
            '<span>Página ' + STATE.nomPage + ' / ' + totalPages + '</span>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-nom-next" ' + (STATE.nomPage >= totalPages ? 'disabled' : '') + ' style="padding:0.25rem 0.6rem;">Siguiente ▶</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // 5) VISTA: LISTAS DE COSTOS Y LIQUIDACIÓN POR OBRA SOCIAL
  function renderObrasSocialesView() {
    var selOs =
      STATE.obrasSocialesTarifas.find(function (o) { return o.id === STATE.selectedOsId; }) ||
      STATE.obrasSocialesTarifas[0] ||
      null;
    if (selOs) STATE.selectedOsId = selOs.id;

    var qCode = String(STATE.osCodeSearch || '').trim().toLowerCase();
    var catSample = STATE.catalog
      .filter(function (c) {
        if (!qCode) return true;
        return (
          String(c.codigo).toLowerCase().indexOf(qCode) >= 0 ||
          String(c.nombre).toLowerCase().indexOf(qCode) >= 0
        );
      })
      .slice(0, 35);

    var fromD = STATE.osLiqFrom || monthStartIso();
    var toD = STATE.osLiqTo || todayIso();
    var osOrders = selOs
      ? STATE.orders.filter(function (o) {
          return (
            o.coberturaTipo === 'obra_social' &&
            o.obraSocialId === selOs.id &&
            o.fecha >= fromD &&
            o.fecha <= toD
          );
        })
      : [];
    var totalLiqOs = osOrders.reduce(function (a, o) {
      return a + (Number(o.totalObraSocialArs) || 0);
    }, 0);

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.85rem;">' +
            '<div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">' +
              '<label style="font-weight:800;font-size:0.85rem;">Seleccionar Obra Social / Prepaga:</label>' +
              '<select class="ms-sa-select" id="ms-lab-os-sel" style="min-width:280px;font-weight:700;">' +
                STATE.obrasSocialesTarifas.map(function (o) {
                  return '<option value="' + esc(o.id) + '" ' + (selOs && selOs.id === o.id ? 'selected' : '') + '>' + esc(o.sigla + ' — ' + o.nombre) + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
            '<button type="button" class="ms-sa-btn" id="ms-lab-os-new">➕ Nueva Obra Social / Convenio</button>' +
          '</div>' +

          (selOs
            ? '<form id="ms-lab-os-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.7rem;background:#f8fafc;padding:0.9rem;border-radius:12px;border:1px solid #e2e8f0;">' +
                '<input type="hidden" id="os-f-id" value="' + esc(selOs.id) + '">' +
                '<div><label class="ms-sa-label">Nombre Obra Social *</label><input class="ms-sa-input" id="os-f-nom" value="' + esc(selOs.nombre) + '" required></div>' +
                '<div><label class="ms-sa-label">Sigla</label><input class="ms-sa-input" id="os-f-sig" value="' + esc(selOs.sigla) + '"></div>' +
                '<div><label class="ms-sa-label">CUIT Facturación</label><input class="ms-sa-input" id="os-f-cuit" value="' + esc(selOs.cuit || '') + '" placeholder="30-00000000-0"></div>' +
                '<div><label class="ms-sa-label">Modalidad de Arancel</label><select class="ms-sa-select" id="os-f-mod">' +
                  '<option value="por_ub" ' + (selOs.modalidad === 'por_ub' ? 'selected' : '') + '>Por Unidad Bioquímica ($ / U.B.)</option>' +
                  '<option value="porcentaje_particular" ' + (selOs.modalidad === 'porcentaje_particular' ? 'selected' : '') + '>% sobre Lista Particular</option>' +
                  '<option value="lista_fija" ' + (selOs.modalidad === 'lista_fija' ? 'selected' : '') + '>Lista Base + Precios por Código</option>' +
                '</select></div>' +
                '<div><label class="ms-sa-label">Valor de 1 U.B. ($ ARS)</label><input class="ms-sa-input" type="number" step="10" id="os-f-ub" value="' + esc(selOs.valorUbArs) + '"></div>' +
                '<div><label class="ms-sa-label">% sobre Particular</label><input class="ms-sa-input" type="number" step="1" id="os-f-pct" value="' + esc(selOs.porcentajeSobreParticular || 80) + '"></div>' +
                '<div><label class="ms-sa-label">Coseguro Sugerido ($)</label><input class="ms-sa-input" type="number" step="100" id="os-f-cos" value="' + esc(selOs.coseguroDefaultArs || 0) + '"></div>' +
                '<div style="display:flex;align-items:flex-end;"><button type="submit" class="ms-sa-btn" style="width:100%;">💾 Guardar Convenio</button></div>' +
              '</form>' +

              // Precios específicos por código en esta Obra Social
              '<div style="margin-top:1rem;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.6rem;">' +
                  '<div>' +
                    '<strong style="font-size:0.86rem;">💲 Lista de Costos de ' + esc(selOs.sigla) + ' por Prestación (Editable por Código)</strong>' +
                    '<div style="font-size:0.75rem;opacity:0.75;">Podés fijar un importe manual para cualquier práctica puntual en esta Obra Social; si lo dejás vacío usa el cálculo automático del convenio.</div>' +
                  '</div>' +
                  '<input class="ms-sa-input" id="ms-lab-os-code-q" style="max-width:280px;" value="' + esc(STATE.osCodeSearch) + '" placeholder="🔎 Filtrar código 66xxxx o práctica...">' +
                '</div>' +
                '<div style="overflow-x:auto;max-height:320px;overflow-y:auto;">' +
                  '<table class="ms-sa-table" style="width:100%;">' +
                    '<thead><tr><th>Código</th><th>Prestación</th><th>U.B.</th><th>Valor Particular</th><th>Valor Calculado ' + esc(selOs.sigla) + '</th><th>Precio Específico en ' + esc(selOs.sigla) + ' ($)</th></tr></thead>' +
                    '<tbody>' +
                      catSample.map(function (c) {
                        var calc = computePracticePriceForCoverage(c, 'obra_social', selOs.id);
                        var customVal = (selOs.preciosPorCodigo && selOs.preciosPorCodigo[c.codigo] != null)
                          ? selOs.preciosPorCodigo[c.codigo]
                          : '';
                        return (
                          '<tr>' +
                            '<td><code>' + esc(c.codigo) + '</code></td>' +
                            '<td><strong>' + esc(c.nombre) + '</strong></td>' +
                            '<td>' + esc(c.ub) + '</td>' +
                            '<td>' + esc(fmtArs.format(c.valorParticularArs || 0)) + '</td>' +
                            '<td style="font-weight:800;color:#0369a1;">' + esc(fmtArs.format(calc.unitPrice)) + '</td>' +
                            '<td style="max-width:160px;">' +
                              '<input type="number" step="50" class="ms-sa-input" data-os-override-code="' + esc(c.codigo) + '" value="' + esc(customVal) + '" placeholder="Automático" style="padding:0.24rem 0.5rem;">' +
                            '</td>' +
                          '</tr>'
                        );
                      }).join('') +
                    '</tbody>' +
                  '</table>' +
                '</div>' +
              '</div>' +

              // Liquidación / Facturación por lote de la Obra Social
              '<div style="margin-top:1.1rem;padding-top:0.9rem;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.7rem;">' +
                '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
                  '<strong style="font-size:0.84rem;">📑 Resumen de Órdenes ' + esc(selOs.sigla) + ':</strong>' +
                  '<input type="date" class="ms-sa-input" id="ms-os-liq-from" value="' + esc(fromD) + '" style="max-width:150px;">' +
                  '<span>a</span>' +
                  '<input type="date" class="ms-sa-input" id="ms-os-liq-to" value="' + esc(toD) + '" style="max-width:150px;">' +
                  '<span style="font-size:0.84rem;">Órdenes: <strong>' + osOrders.length + '</strong> · Total a Facturar: <strong style="color:#047857;">' + esc(fmtArs.format(totalLiqOs)) + '</strong></span>' +
                '</div>' +
                (osOrders.length > 0
                  ? '<button type="button" class="ms-sa-btn" id="ms-os-bill-batch">🧾 Facturar Lote ' + esc(selOs.sigla) + ' en Caja / ARCA</button>'
                  : '') +
              '</div>'
            : '') +
        '</div>' +
      '</div>'
    );
  }

  // 6) VISTA: FIRMA DIGITAL POR USUARIO Y MEMBRETE DEL REPORTE
  function renderFirmaView() {
    var u = getActiveUser();
    var curUsername = STATE.editingSignatureUser || (u && u.username) || 'danielg';
    var mySig =
      STATE.firmasBioquimicos.find(function (f) {
        return f.username.toLowerCase() === String(curUsername).toLowerCase();
      }) || {
        username: curUsername,
        nombreCompleto: (u && u.name) || '',
        tituloProfesional: 'Bioquímico',
        matricula: 'M.P. ',
        firmaDataUrl: ''
      };
    var cfg = STATE.config || {};

    return (
      '<div style="display:grid;gap:1rem;">' +
        // Tarjeta Firma Digital del Usuario
        '<div class="ms-sa-card" style="border:2px solid #56D7A1;">' +
          '<h4 style="margin:0 0 0.35rem;">✒️ Firma Digital del Bioquímico (Gestionable por Usuario)</h4>' +
          '<p style="margin:0 0 0.85rem;font-size:0.82rem;opacity:0.8;">Podés dibujar tu firma directamente en el recuadro o subir una foto/escaneo de tu firma y quitarle el fondo blanco en 1 clic. Esta firma se inserta automáticamente al pie de cada hoja del PDF.</p>' +
          '<form id="ms-lab-sig-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;">' +
            '<div><label class="ms-sa-label">Usuario ERP Asociado</label><input class="ms-sa-input" id="sig-f-user" value="' + esc(mySig.username) + '"></div>' +
            '<div><label class="ms-sa-label">Nombre y Apellido en el Sello *</label><input class="ms-sa-input preserve-case-input" data-preserve-case="true" id="sig-f-name" value="' + esc(mySig.nombreCompleto || '') + '" placeholder="Ej: Pablo Borda" required></div>' +
            '<div><label class="ms-sa-label">Título Profesional</label><input class="ms-sa-input preserve-case-input" data-preserve-case="true" id="sig-f-title" value="' + esc(mySig.tituloProfesional || 'Bioquímico') + '"></div>' +
            '<div><label class="ms-sa-label">Matrícula Profesional (M.P. / M.N.) *</label><input class="ms-sa-input preserve-case-input" data-preserve-case="true" id="sig-f-mat" value="' + esc(mySig.matricula || '') + '" placeholder="Ej: M.P. 5504" required></div>' +

            '<div style="grid-column:1 / -1;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;align-items:start;margin-top:0.3rem;">' +
              '<div style="background:#f8fafc;padding:0.8rem;border-radius:12px;border:1px solid #cbd5e1;">' +
                '<div style="font-size:0.78rem;font-weight:800;margin-bottom:0.4rem;">Opción A: Dibujar Firma Manuscrita aquí</div>' +
                '<canvas id="ms-lab-sig-canvas" width="360" height="120" style="width:100%;max-width:360px;height:120px;background:#ffffff;border:1.5px dashed #94a3b8;border-radius:8px;touch-action:none;cursor:crosshair;"></canvas>' +
                '<div style="display:flex;gap:0.45rem;margin-top:0.45rem;flex-wrap:wrap;">' +
                  '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-sig-clear-pad" style="font-size:0.74rem;padding:0.25rem 0.6rem;">🧹 Limpiar Trazo</button>' +
                  '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-sig-use-pad" style="font-size:0.74rem;padding:0.25rem 0.6rem;">✓ Usar Trazo Dibujado</button>' +
                '</div>' +
              '</div>' +

              '<div style="background:#f8fafc;padding:0.8rem;border-radius:12px;border:1px solid #cbd5e1;">' +
                '<div style="font-size:0.78rem;font-weight:800;margin-bottom:0.4rem;">Opción B: Subir Imagen de Firma (PNG / JPG)</div>' +
                '<input type="file" accept="image/*" id="ms-sig-upload-inp" class="ms-sa-input" style="font-size:0.78rem;">' +
                '<input type="hidden" id="sig-f-dataurl" value="' + esc(mySig.firmaDataUrl || '') + '">' +
                '<div style="margin-top:0.6rem;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:0.6rem;min-height:92px;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
                  (mySig.firmaDataUrl
                    ? '<img id="ms-sig-preview-img" src="' + esc(mySig.firmaDataUrl) + '" alt="Vista previa firma" style="max-height:58px;object-fit:contain;">'
                    : '<span id="ms-sig-preview-empty" style="font-size:0.76rem;opacity:0.6;">Vista previa del pie de firma</span><img id="ms-sig-preview-img" src="" alt="" style="max-height:58px;object-fit:contain;display:none;">') +
                  '<div style="font-weight:700;font-size:0.8rem;margin-top:2px;">' + esc(mySig.nombreCompleto || 'Nombre Bioquímico') + '</div>' +
                  '<div style="font-size:0.74rem;opacity:0.8;">' + esc((mySig.tituloProfesional || 'Bioquímico') + ' ' + (mySig.matricula || '')) + '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div style="grid-column:1 / -1;text-align:right;">' +
              '<button type="submit" class="ms-sa-btn">💾 Guardar Mi Firma Digital</button>' +
            '</div>' +
          '</form>' +
        '</div>' +

        // Tarjeta Membrete Institucional y Parámetros del Reporte PDF
        '<div class="ms-sa-card">' +
          '<h4 style="margin:0 0 0.75rem;">🏛️ Encabezado Institucional, Pie del Colegio de Bioquímicos y Parámetros</h4>' +
          '<form id="ms-lab-config-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0.75rem;">' +
            '<div><label class="ms-sa-label">Nombre del Laboratorio (Encabezado Hoja 1)</label><input class="ms-sa-input preserve-case-input" data-preserve-case="true" id="cfg-f-nom" value="' + esc(cfg.nombreLaboratorio || '') + '"></div>' +
            '<div><label class="ms-sa-label">Subtítulo Director Técnico</label><input class="ms-sa-input preserve-case-input" data-preserve-case="true" id="cfg-f-dir" value="' + esc(cfg.subtituloDirector || '') + '" placeholder="Ej: Dr. Pablo Borda - Bioq. M.P. 5504"></div>' +
            '<div><label class="ms-sa-label">Dirección y Localidad</label><input class="ms-sa-input preserve-case-input" data-preserve-case="true" id="cfg-f-dom" value="' + esc(cfg.direccion || '') + '"></div>' +
            '<div><label class="ms-sa-label">Teléfono / Celular</label><input class="ms-sa-input preserve-case-input" data-preserve-case="true" id="cfg-f-tel" value="' + esc(cfg.telefono || '') + '"></div>' +
            '<div><label class="ms-sa-label">Color Institucional del Encabezado</label><input class="ms-sa-input" type="color" id="cfg-f-col" value="' + esc(cfg.bannerColorPrimary || '#1e5aa8') + '" style="height:40px;padding:3px;"></div>' +
            '<div><label class="ms-sa-label">Próximo N° de Protocolo</label><input class="ms-sa-input" type="number" id="cfg-f-proto" value="' + esc(cfg.proximoProtocoloNro || 1001) + '"></div>' +
            '<div><label class="ms-sa-label">Valor Base 1 U.B. Particular ($)</label><input class="ms-sa-input" type="number" step="50" id="cfg-f-ubp" value="' + esc(cfg.valorUbBaseParticularArs || 1800) + '"></div>' +
            '<div><label class="ms-sa-label">Valor Base 1 U.B. Obra Social ($)</label><input class="ms-sa-input" type="number" step="50" id="cfg-f-ubos" value="' + esc(cfg.valorUbBaseObraSocialArs || 1350) + '"></div>' +
            '<div style="grid-column:1 / -1;"><label class="ms-sa-label">Leyenda de Habilitación al Pie de Página (Colegio de Bioquímicos)</label><input class="ms-sa-input preserve-case-input" data-preserve-case="true" id="cfg-f-pie" value="' + esc(cfg.leyendaPiePagina || '') + '"></div>' +
            '<div style="grid-column:1 / -1;"><label class="ms-sa-label">Plantilla de Confirmación WhatsApp ({PACIENTE}, {LABORATORIO}, {PROTOCOLO}, {LINK_QR})</label><textarea class="ms-sa-input preserve-case-input" data-preserve-case="true" rows="2" id="cfg-f-wa">' + esc(cfg.plantillaWhatsapp || '') + '</textarea></div>' +
            '<div style="grid-column:1 / -1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;">' +
              '<div style="display:flex;gap:1.2rem;flex-wrap:wrap;font-size:0.82rem;font-weight:700;">' +
                '<label style="display:inline-flex;align-items:center;gap:0.4rem;cursor:pointer;"><input type="checkbox" id="cfg-f-qrdni" ' + (cfg.requerirDniEnPortalQr ? 'checked' : '') + '> Pedir DNI al paciente al escanear QR</label>' +
                '<label style="display:inline-flex;align-items:center;gap:0.4rem;cursor:pointer;"><input type="checkbox" id="cfg-f-qrpdf" ' + (cfg.mostrarQrVerificacionEnPdf !== false ? 'checked' : '') + '> Incluir QR verificador en el pie del PDF</label>' +
              '</div>' +
              '<button type="submit" class="ms-sa-btn">💾 Guardar Configuración del Reporte</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>'
    );
  }

  // ==========================================================================
  // INTERACCIÓN, AUTOCÁLCULO BIOQUÍMICO EN VIVO Y FACTURACIÓN POS
  // ==========================================================================
  function sendOrderToNativePos(order) {
    if (!order) return;
    var items = (order.practicas || []).map(function (p) {
      var price =
        order.coberturaTipo === 'obra_social'
          ? Number(p.coseguroPacienteArs || 0) || Number(p.precioUnitarioArs || 0)
          : Number(p.precioUnitarioArs || 0);
      return {
        codigo: p.codigo,
        nombre: '[PROT #' + order.protocoloNro + '] ' + p.nombre,
        cantidad: 1,
        precioFinal: price,
        descPct: 0,
        ivaPct: 0,
        isService: true,
        itemType: 'service'
      };
    });

    if (typeof window.__MS_LOAD_SERVICES_INTO_POS__ === 'function') {
      window.__MS_LOAD_SERVICES_INTO_POS__({
        observacion: 'Laboratorio Protocolo N° ' + order.protocoloNro + ' — ' + order.pacienteNombreCompleto,
        ocasional: {
          cuit: order.pacienteCuit || order.pacienteDni || '',
          razonSocial: order.pacienteNombreCompleto
        },
        items: items
      });
      return;
    }

    // Fallback directo abriendo Caja 1 / Facturador
    var cardFact = document.querySelector('[data-open-section="sec-caja-pos"]');
    if (cardFact) cardFact.click();
    showToast('Abriendo Facturador POS para Protocolo #' + order.protocoloNro, false);
  }

  function syncDraftOrderFromDom(bodyEl) {
    var ed = STATE.editingOrder;
    if (!ed || !bodyEl) return;
    var g = function (id) {
      var el = bodyEl.querySelector('#' + id);
      return el ? el.value : undefined;
    };
    if (g('ms-lab-ord-dni') !== undefined) ed.pacienteDni = g('ms-lab-ord-dni');
    if (g('ms-lab-ord-ape') !== undefined) ed.pacienteApellido = g('ms-lab-ord-ape');
    if (g('ms-lab-ord-nom') !== undefined) ed.pacienteNombres = g('ms-lab-ord-nom');
    if (g('ms-lab-ord-sexo') !== undefined) ed.pacienteSexo = g('ms-lab-ord-sexo');
    if (g('ms-lab-ord-edad') !== undefined) ed.pacienteEdad = g('ms-lab-ord-edad');
    if (g('ms-lab-ord-tel') !== undefined) ed.pacienteTelefono = g('ms-lab-ord-tel');
    if (g('ms-lab-ord-email') !== undefined) ed.pacienteEmail = g('ms-lab-ord-email');
    if (g('ms-lab-ord-medico') !== undefined) ed.medicoSolicitante = g('ms-lab-ord-medico');
    if (g('ms-lab-ord-fecha') !== undefined) ed.fecha = g('ms-lab-ord-fecha');
    if (g('ms-lab-ord-proto') !== undefined) ed.protocoloNro = Number(g('ms-lab-ord-proto') || 0);
    if (g('ms-lab-ord-diag') !== undefined) ed.diagnosticoPresuntivo = g('ms-lab-ord-diag');
    if (g('ms-lab-ord-qr') !== undefined) ed.qrCode = g('ms-lab-ord-qr');
    if (g('ms-lab-ord-afil') !== undefined) ed.nroAfiliado = g('ms-lab-ord-afil');
    if (g('ms-lab-ord-aut') !== undefined) ed.nroAutorizacion = g('ms-lab-ord-aut');
  }

  function addPracticeCodeToDraft(code) {
    var ed = STATE.editingOrder;
    if (!ed) return;
    if ((ed.practicas || []).some(function (p) { return p.codigo === code; })) return;
    var cat = STATE.catalog.find(function (c) { return c.codigo === code; });
    if (!cat) return;
    var pr = computePracticePriceForCoverage(cat, ed.coberturaTipo, ed.obraSocialId);
    ed.practicas.push({
      codigo: cat.codigo,
      nombre: cat.nombre,
      seccion: cat.seccion,
      metodo: cat.metodoDefault,
      muestra: cat.muestra,
      ub: cat.ub,
      precioUnitarioArs: pr.unitPrice,
      coseguroPacienteArs: pr.coseguro
    });
  }

  // Limpieza automática de fondo blanco de firma subida por foto/escaneo
  function removeWhiteBackgroundToTransparentPng(imgEl) {
    var canvas = document.createElement('canvas');
    var maxW = 420;
    var scale = imgEl.width > maxW ? maxW / imgEl.width : 1;
    canvas.width = Math.max(1, Math.round(imgEl.width * scale));
    canvas.height = Math.max(1, Math.round(imgEl.height * scale));
    var ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var d = imgData.data;
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i];
      var g = d[i + 1];
      var b = d[i + 2];
      var lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 232) {
        d[i + 3] = 0;
      } else if (lum > 195) {
        d[i + 3] = Math.round(((232 - lum) / 37) * 255);
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  function bindSignaturePad(bodyEl) {
    var canvas = bodyEl.querySelector('#ms-lab-sig-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0f2942';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var drawing = false;

    var getPos = function (ev) {
      var rect = canvas.getBoundingClientRect();
      var touch = ev.touches && ev.touches[0];
      var clientX = touch ? touch.clientX : ev.clientX;
      var clientY = touch ? touch.clientY : ev.clientY;
      return {
        x: ((clientX - rect.left) * canvas.width) / rect.width,
        y: ((clientY - rect.top) * canvas.height) / rect.height
      };
    };

    var start = function (ev) {
      ev.preventDefault();
      drawing = true;
      var p = getPos(ev);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    var move = function (ev) {
      if (!drawing) return;
      ev.preventDefault();
      var p = getPos(ev);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    var stop = function () {
      drawing = false;
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', stop);

    var clearBtn = bodyEl.querySelector('#ms-sig-clear-pad');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }

    var useBtn = bodyEl.querySelector('#ms-sig-use-pad');
    if (useBtn) {
      useBtn.addEventListener('click', function () {
        var dataUrl = canvas.toDataURL('image/png');
        var hid = bodyEl.querySelector('#sig-f-dataurl');
        var prev = bodyEl.querySelector('#ms-sig-preview-img');
        var emp = bodyEl.querySelector('#ms-sig-preview-empty');
        if (hid) hid.value = dataUrl;
        if (prev) {
          prev.src = dataUrl;
          prev.style.display = 'block';
        }
        if (emp) emp.style.display = 'none';
        showToast('Trazo aplicado a la vista previa. Hacé clic en "Guardar Mi Firma Digital".', false);
      });
    }

    var fileInp = bodyEl.querySelector('#ms-sig-upload-inp');
    if (fileInp) {
      fileInp.addEventListener('change', function () {
        var f = fileInp.files && fileInp.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            var cleanPng = removeWhiteBackgroundToTransparentPng(img);
            var hid = bodyEl.querySelector('#sig-f-dataurl');
            var prev = bodyEl.querySelector('#ms-sig-preview-img');
            var emp = bodyEl.querySelector('#ms-sig-preview-empty');
            if (hid) hid.value = cleanPng;
            if (prev) {
              prev.src = cleanPng;
              prev.style.display = 'block';
            }
            if (emp) emp.style.display = 'none';
            showToast('Firma cargada y fondo blanco transparentado automáticamente.', false);
          };
          img.src = String(reader.result || '');
        };
        reader.readAsDataURL(f);
      });
    }
  }

  function bindWorkspaceEvents(bodyEl) {
    // --- EVENTOS DE PEDIDOS Y PROTOCOLOS ---
    var newOrdBtn = bodyEl.querySelector('#ms-lab-new-order-btn');
    if (newOrdBtn) {
      newOrdBtn.addEventListener('click', function () {
        var firstOs = STATE.obrasSocialesTarifas[0];
        STATE.editingOrder = {
          fecha: todayIso(),
          protocoloNro: STATE.config.proximoProtocoloNro || 1001,
          pacienteSexo: 'M',
          coberturaTipo: 'particular',
          obraSocialId: firstOs ? firstOs.id : '',
          obraSocialNombre: firstOs ? firstOs.nombre : '',
          qrCode: '',
          practicas: []
        };
        renderWorkspace();
      });
    }

    var demoBtn = bodyEl.querySelector('#ms-lab-load-demo-btn') || bodyEl.querySelector('#ms-lab-empty-demo');
    if (demoBtn) {
      demoBtn.addEventListener('click', async function () {
        demoBtn.disabled = true;
        var res = await apiLab('POST', { action: 'load_demo_protocol' });
        demoBtn.disabled = false;
        if (res && res.ok) {
          applyServerPayload(res);
          if (res.savedOrder) STATE.selectedResultOrderId = res.savedOrder.id;
          showToast(res.message, false);
          openLaboratorioView('resultados');
        }
      });
    }

    var cancelOrdBtn = bodyEl.querySelector('#ms-lab-cancel-order');
    if (cancelOrdBtn) {
      cancelOrdBtn.addEventListener('click', function () {
        STATE.editingOrder = null;
        renderWorkspace();
      });
    }

    var lookupDniBtn = bodyEl.querySelector('#ms-lab-lookup-dni');
    var dniInp = bodyEl.querySelector('#ms-lab-ord-dni');
    var doLookupDni = async function () {
      if (!dniInp || !dniInp.value.trim()) return;
      var clean = dniInp.value.replace(/\D/g, '');
      if (clean.length < 7) return;
      syncDraftOrderFromDom(bodyEl);
      // 1. Buscar primero en pacientes de Turnos/Laboratorio
      var localPac = (STATE.turnosRef.pacientes || []).find(function (p) {
        return String(p.dni || '').replace(/\D/g, '') === clean;
      });
      if (localPac) {
        var parts = String(localPac.nombreCompleto || localPac.nombre || '').split(',');
        if (parts.length > 1) {
          STATE.editingOrder.pacienteApellido = parts[0].trim().toUpperCase();
          STATE.editingOrder.pacienteNombres = parts.slice(1).join(',').trim();
        } else {
          STATE.editingOrder.pacienteApellido = String(localPac.apellido || localPac.nombre || '').toUpperCase();
          STATE.editingOrder.pacienteNombres = String(localPac.nombres || '');
        }
        STATE.editingOrder.pacienteTelefono = localPac.telefono || STATE.editingOrder.pacienteTelefono || '';
        STATE.editingOrder.pacienteEmail = localPac.email || STATE.editingOrder.pacienteEmail || '';
        showToast('Datos del paciente recuperados del padrón de Consultorios.', false);
        renderWorkspace();
        return;
      }
      // 2. Consultar Padrón Oficial ARCA
      try {
        var res = await fetch('/sistema/api/padron_arca.php?cuit=' + encodeURIComponent(clean));
        var data = await res.json();
        if (data && data.ok && data.razonSocial) {
          var rz = String(data.razonSocial).trim();
          var tokens = rz.split(/\s+/);
          STATE.editingOrder.pacienteApellido = tokens[0] || rz;
          STATE.editingOrder.pacienteNombres = tokens.slice(1).join(' ');
          STATE.editingOrder.pacienteCuit = data.cuit || '';
          if (String(data.cuit || '').indexOf('27') === 0) STATE.editingOrder.pacienteSexo = 'F';
          else if (String(data.cuit || '').indexOf('20') === 0) STATE.editingOrder.pacienteSexo = 'M';
          showToast('Paciente identificado en Padrón ARCA: ' + rz, false);
          renderWorkspace();
        } else {
          showToast('DNI no hallado en ARCA; completá Apellido y Nombre manualmente.', true);
        }
      } catch (_e) {}
    };
    if (lookupDniBtn) lookupDniBtn.addEventListener('click', doLookupDni);
    if (dniInp) {
      dniInp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          doLookupDni();
        }
      });
    }

    var cobSel = bodyEl.querySelector('#ms-lab-ord-cob');
    if (cobSel) {
      cobSel.addEventListener('change', function () {
        syncDraftOrderFromDom(bodyEl);
        STATE.editingOrder.coberturaTipo = cobSel.value;
        if (cobSel.value === 'obra_social' && !STATE.editingOrder.obraSocialId && STATE.obrasSocialesTarifas[0]) {
          STATE.editingOrder.obraSocialId = STATE.obrasSocialesTarifas[0].id;
          STATE.editingOrder.obraSocialNombre = STATE.obrasSocialesTarifas[0].nombre;
        }
        // Recalcular precios según nueva cobertura
        (STATE.editingOrder.practicas || []).forEach(function (p) {
          var cat = STATE.catalog.find(function (c) { return c.codigo === p.codigo; });
          if (cat) {
            var pr = computePracticePriceForCoverage(cat, STATE.editingOrder.coberturaTipo, STATE.editingOrder.obraSocialId);
            p.precioUnitarioArs = pr.unitPrice;
          }
        });
        renderWorkspace();
      });
    }

    var osOrdSel = bodyEl.querySelector('#ms-lab-ord-os');
    if (osOrdSel) {
      osOrdSel.addEventListener('change', function () {
        syncDraftOrderFromDom(bodyEl);
        var os = STATE.obrasSocialesTarifas.find(function (o) { return o.id === osOrdSel.value; });
        STATE.editingOrder.obraSocialId = osOrdSel.value;
        STATE.editingOrder.obraSocialNombre = os ? os.nombre : '';
        (STATE.editingOrder.practicas || []).forEach(function (p) {
          var cat = STATE.catalog.find(function (c) { return c.codigo === p.codigo; });
          if (cat) {
            var pr = computePracticePriceForCoverage(cat, 'obra_social', osOrdSel.value);
            p.precioUnitarioArs = pr.unitPrice;
          }
        });
        renderWorkspace();
      });
    }

    var qrPickSel = bodyEl.querySelector('#ms-lab-ord-qr-pick');
    if (qrPickSel) {
      qrPickSel.addEventListener('change', function () {
        var qrInp = bodyEl.querySelector('#ms-lab-ord-qr');
        if (qrInp && qrPickSel.value) qrInp.value = qrPickSel.value;
      });
    }

    bodyEl.querySelectorAll('[data-lab-add-profile]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncDraftOrderFromDom(bodyEl);
        var prof = STATE.profiles.find(function (p) { return p.id === btn.getAttribute('data-lab-add-profile'); });
        if (prof) {
          (prof.codigos || []).forEach(addPracticeCodeToDraft);
          renderWorkspace();
        }
      });
    });

    var pracSearchInp = bodyEl.querySelector('#ms-lab-prac-search');
    if (pracSearchInp) {
      pracSearchInp.addEventListener('input', function () {
        syncDraftOrderFromDom(bodyEl);
        STATE.practicePickerQuery = pracSearchInp.value;
        renderWorkspace();
        var nextInp = document.getElementById('ms-lab-prac-search');
        if (nextInp) {
          nextInp.focus();
          nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length);
        }
      });
    }

    bodyEl.querySelectorAll('[data-lab-add-code]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncDraftOrderFromDom(bodyEl);
        addPracticeCodeToDraft(btn.getAttribute('data-lab-add-code'));
        STATE.practicePickerQuery = '';
        renderWorkspace();
      });
    });

    bodyEl.querySelectorAll('[data-ord-price-idx]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        syncDraftOrderFromDom(bodyEl);
        var idx = Number(inp.getAttribute('data-ord-price-idx'));
        if (STATE.editingOrder && STATE.editingOrder.practicas[idx]) {
          STATE.editingOrder.practicas[idx].precioUnitarioArs = Math.max(0, Number(inp.value || 0));
          renderWorkspace();
        }
      });
    });

    bodyEl.querySelectorAll('[data-ord-cos-idx]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        syncDraftOrderFromDom(bodyEl);
        var idx = Number(inp.getAttribute('data-ord-cos-idx'));
        if (STATE.editingOrder && STATE.editingOrder.practicas[idx]) {
          STATE.editingOrder.practicas[idx].coseguroPacienteArs = Math.max(0, Number(inp.value || 0));
          renderWorkspace();
        }
      });
    });

    bodyEl.querySelectorAll('[data-ord-del-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncDraftOrderFromDom(bodyEl);
        var idx = Number(btn.getAttribute('data-ord-del-idx'));
        if (STATE.editingOrder && STATE.editingOrder.practicas) {
          STATE.editingOrder.practicas.splice(idx, 1);
          renderWorkspace();
        }
      });
    });

    var ordForm = bodyEl.querySelector('#ms-lab-order-form');
    if (ordForm) {
      ordForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        syncDraftOrderFromDom(bodyEl);
        var os = STATE.obrasSocialesTarifas.find(function (o) {
          return o.id === STATE.editingOrder.obraSocialId;
        });
        if (STATE.editingOrder.coberturaTipo === 'obra_social' && os) {
          STATE.editingOrder.obraSocialNombre = os.nombre;
        }
        var res = await apiLab('POST', { action: 'save_order', order: STATE.editingOrder });
        if (res && res.ok) {
          applyServerPayload(res);
          STATE.editingOrder = null;
          showToast(res.message, false);
          renderWorkspace();
        } else {
          showToast((res && res.message) || 'Error guardando el pedido.', true);
        }
      });
    }

    var fq = bodyEl.querySelector('#ms-lab-filter-q');
    if (fq) {
      fq.addEventListener('input', function () {
        STATE.orderSearch = fq.value;
        renderWorkspace();
        var el = document.getElementById('ms-lab-filter-q');
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }

    var fst = bodyEl.querySelector('#ms-lab-filter-status');
    if (fst) {
      fst.addEventListener('change', function () {
        STATE.orderStatusFilter = fst.value;
        renderWorkspace();
      });
    }

    bodyEl.querySelectorAll('[data-ord-go-res]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.selectedResultOrderId = b.getAttribute('data-ord-go-res');
        openLaboratorioView('resultados');
      });
    });
    bodyEl.querySelectorAll('[data-ord-pdf]').forEach(function (b) {
      b.addEventListener('click', function () {
        var o = STATE.orders.find(function (x) { return x.id === b.getAttribute('data-ord-pdf'); });
        openOfficialBiochemicalPdf(o);
      });
    });
    bodyEl.querySelectorAll('[data-ord-tubes]').forEach(function (b) {
      b.addEventListener('click', function () {
        var o = STATE.orders.find(function (x) { return x.id === b.getAttribute('data-ord-tubes'); });
        openSampleTubeLabels(o);
      });
    });
    bodyEl.querySelectorAll('[data-ord-pos]').forEach(function (b) {
      b.addEventListener('click', function () {
        var o = STATE.orders.find(function (x) { return x.id === b.getAttribute('data-ord-pos'); });
        sendOrderToNativePos(o);
      });
    });
    bodyEl.querySelectorAll('[data-ord-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var o = STATE.orders.find(function (x) { return x.id === b.getAttribute('data-ord-edit'); });
        if (o) {
          STATE.editingOrder = JSON.parse(JSON.stringify(o));
          renderWorkspace();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
    bodyEl.querySelectorAll('[data-ord-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar este protocolo y liberar su tarjeta QR?')) return;
        var res = await apiLab('POST', { action: 'delete_order', orderId: b.getAttribute('data-ord-del') });
        if (res && res.ok) {
          applyServerPayload(res);
          showToast(res.message, false);
          renderWorkspace();
        }
      });
    });

    // --- EVENTOS DE CARGA Y ENTREGA DE RESULTADOS ---
    var resOrdSel = bodyEl.querySelector('#ms-lab-res-order-sel');
    if (resOrdSel) {
      resOrdSel.addEventListener('change', function () {
        STATE.selectedResultOrderId = resOrdSel.value;
        renderWorkspace();
      });
    }

    var printPdfBtn = bodyEl.querySelector('#ms-lab-btn-print-pdf');
    if (printPdfBtn) {
      printPdfBtn.addEventListener('click', function () {
        var ord = STATE.orders.find(function (o) { return o.id === STATE.selectedResultOrderId; });
        openOfficialBiochemicalPdf(ord);
      });
    }

    var notifyWaBtn = bodyEl.querySelector('#ms-lab-btn-notify-wa');
    if (notifyWaBtn) {
      notifyWaBtn.addEventListener('click', async function () {
        var res = await apiLab('POST', {
          action: 'notify_patient',
          orderId: STATE.selectedResultOrderId
        });
        if (res && res.ok) {
          applyServerPayload(res);
          showToast(res.message, false);
          if (res.whatsappUrl) {
            window.open(res.whatsappUrl, '_blank');
          }
        }
      });
    }

    var collectResultsFromForm = function () {
      var ord = STATE.orders.find(function (o) { return o.id === STATE.selectedResultOrderId; });
      if (!ord) return null;
      var clone = JSON.parse(JSON.stringify(ord.practicas || []));
      bodyEl.querySelectorAll('[data-res-metodo]').forEach(function (inp) {
        var pIdx = Number(inp.getAttribute('data-res-metodo'));
        if (clone[pIdx]) clone[pIdx].metodo = inp.value;
      });
      bodyEl.querySelectorAll('[data-res-nota]').forEach(function (inp) {
        var pIdx = Number(inp.getAttribute('data-res-nota'));
        if (clone[pIdx]) clone[pIdx].notaPractica = inp.value;
      });
      bodyEl.querySelectorAll('[data-res-val]').forEach(function (inp) {
        var parts = inp.getAttribute('data-res-val').split(':');
        var pIdx = Number(parts[0]);
        var rIdx = Number(parts[1]);
        if (clone[pIdx] && clone[pIdx].resultados[rIdx]) {
          clone[pIdx].resultados[rIdx].valor = inp.value;
        }
      });
      return clone;
    };

    // Autocálculo instantáneo en vivo al tipear resultados
    bodyEl.querySelectorAll('[data-res-val]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var mapVal = {};
        bodyEl.querySelectorAll('[data-analyte-id]').forEach(function (el) {
          var id = el.getAttribute('data-analyte-id');
          var raw = String(el.value || '').trim().replace(/\./g, '').replace(',', '.');
          var n = parseFloat(raw);
          if (isFinite(n)) mapVal[id] = n;
        });
        var setIf = function (id, strVal) {
          var target = bodyEl.querySelector('[data-analyte-id="' + id + '"]');
          if (target) target.value = strVal;
        };
        if (mapVal.hematocrito && mapVal.eritrocitos > 0) {
          setIf('vcm', ((mapVal.hematocrito * 10) / mapVal.eritrocitos).toFixed(2).replace('.', ','));
        }
        if (mapVal.hemoglobina && mapVal.eritrocitos > 0) {
          setIf('hcm', ((mapVal.hemoglobina * 10) / mapVal.eritrocitos).toFixed(2).replace('.', ','));
        }
        if (mapVal.hemoglobina && mapVal.hematocrito > 0) {
          setIf('chcm', ((mapVal.hemoglobina * 100) / mapVal.hematocrito).toFixed(2).replace('.', ','));
        }
        if (mapVal.glucemia && mapVal.insulina_basal) {
          setIf('indice_homa', ((mapVal.glucemia * mapVal.insulina_basal) / 405).toFixed(2).replace('.', ','));
        }
        if (mapVal.trigliceridos > 0 && mapVal.glucemia > 0) {
          setIf('indice_tyg', Math.log((mapVal.trigliceridos * mapVal.glucemia) / 2).toFixed(1).replace('.', ','));
        }
        if (mapVal.colesterol_total && mapVal.colesterol_hdl > 0) {
          setIf('indice_riesgo_cv', (mapVal.colesterol_total / mapVal.colesterol_hdl).toFixed(1).replace('.', ','));
          setIf('colesterol_no_hdl', String(Math.round(mapVal.colesterol_total - mapVal.colesterol_hdl)));
        }
        if (mapVal.colesterol_ldl && mapVal.colesterol_hdl > 0) {
          setIf('indice_aterogeno', (mapVal.colesterol_ldl / mapVal.colesterol_hdl).toFixed(1).replace('.', ','));
        }
      });
    });

    var saveDraftBtn = bodyEl.querySelector('#ms-lab-save-draft-res');
    if (saveDraftBtn) {
      saveDraftBtn.addEventListener('click', async function () {
        var practicas = collectResultsFromForm();
        var res = await apiLab('POST', {
          action: 'save_results',
          orderId: STATE.selectedResultOrderId,
          practicas: practicas,
          validate: false
        });
        if (res && res.ok) {
          applyServerPayload(res);
          showToast(res.message, false);
          renderWorkspace();
        }
      });
    }

    var resForm = bodyEl.querySelector('#ms-lab-results-form');
    if (resForm) {
      resForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var practicas = collectResultsFromForm();
        var signerSel = bodyEl.querySelector('#ms-lab-signer-sel');
        var res = await apiLab('POST', {
          action: 'save_results',
          orderId: STATE.selectedResultOrderId,
          practicas: practicas,
          validate: true,
          signerUsername: signerSel ? signerSel.value : ''
        });
        if (res && res.ok) {
          applyServerPayload(res);
          showToast(res.message, false);
          renderWorkspace();
          if (res.whatsappUrl && !res.waCloudSent) {
            var ord = res.savedOrder;
            if (ord && ord.pacienteTelefono && window.confirm('Protocolo validado y publicado en el QR.\n¿Deseás abrir WhatsApp ahora para enviarle la confirmación al paciente?')) {
              window.open(res.whatsappUrl, '_blank');
            }
          }
        } else {
          showToast((res && res.message) || 'Error validando resultados.', true);
        }
      });
    }

    // --- EVENTOS DE TARJETAS QR PRE-IMPRESAS ---
    var qrBatchForm = bodyEl.querySelector('#ms-lab-qr-batch-form');
    if (qrBatchForm) {
      qrBatchForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var qty = Number(bodyEl.querySelector('#ms-lab-qr-qty').value || 24);
        var lbl = bodyEl.querySelector('#ms-lab-qr-label').value || '';
        var res = await apiLab('POST', {
          action: 'generate_qr_batch',
          cantidad: qty,
          batchLabel: lbl
        });
        if (res && res.ok) {
          applyServerPayload(res);
          showToast(res.message, false);
          renderWorkspace();
          if (Array.isArray(res.createdCards) && res.createdCards.length > 0) {
            openPrintableQrCardsSheet(res.createdCards);
          }
        }
      });
    }

    var qrStSel = bodyEl.querySelector('#ms-lab-qr-filter-st');
    if (qrStSel) qrStSel.addEventListener('change', function () { STATE.qrStatusFilter = qrStSel.value; renderWorkspace(); });
    var qrBSel = bodyEl.querySelector('#ms-lab-qr-filter-batch');
    if (qrBSel) qrBSel.addEventListener('change', function () { STATE.qrBatchFilter = qrBSel.value; renderWorkspace(); });

    var printFilteredQrsBtn = bodyEl.querySelector('#ms-lab-print-filtered-qrs');
    if (printFilteredQrsBtn) {
      printFilteredQrsBtn.addEventListener('click', function () {
        var cards = STATE.qrCards.filter(function (c) {
          if (STATE.qrStatusFilter !== 'ALL' && c.status !== STATE.qrStatusFilter) return false;
          if (STATE.qrBatchFilter !== 'ALL' && c.batchId !== STATE.qrBatchFilter) return false;
          return true;
        }).slice(0, 96);
        openPrintableQrCardsSheet(cards);
      });
    }

    bodyEl.querySelectorAll('[data-qr-use]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var code = btn.getAttribute('data-qr-use');
        var firstOs = STATE.obrasSocialesTarifas[0];
        STATE.editingOrder = {
          fecha: todayIso(),
          protocoloNro: STATE.config.proximoProtocoloNro || 1001,
          pacienteSexo: 'M',
          coberturaTipo: 'particular',
          obraSocialId: firstOs ? firstOs.id : '',
          obraSocialNombre: firstOs ? firstOs.nombre : '',
          qrCode: code,
          practicas: []
        };
        openLaboratorioView('ordenes');
      });
    });

    // --- EVENTOS ABM NOMENCLADOR ---
    var nomQ = bodyEl.querySelector('#ms-lab-nom-q');
    if (nomQ) {
      nomQ.addEventListener('input', function () {
        STATE.nomSearch = nomQ.value;
        STATE.nomPage = 1;
        renderWorkspace();
        var el = document.getElementById('ms-lab-nom-q');
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }
    var nomSec = bodyEl.querySelector('#ms-lab-nom-sec');
    if (nomSec) {
      nomSec.addEventListener('change', function () {
        STATE.nomSeccion = nomSec.value;
        STATE.nomPage = 1;
        renderWorkspace();
      });
    }
    var nomPrev = bodyEl.querySelector('#ms-nom-prev');
    if (nomPrev) nomPrev.addEventListener('click', function () { STATE.nomPage = Math.max(1, STATE.nomPage - 1); renderWorkspace(); });
    var nomNext = bodyEl.querySelector('#ms-nom-next');
    if (nomNext) nomNext.addEventListener('click', function () { STATE.nomPage += 1; renderWorkspace(); });

    var nomNewBtn = bodyEl.querySelector('#ms-lab-nom-new');
    if (nomNewBtn) {
      nomNewBtn.addEventListener('click', function () {
        STATE.editingPractice = {
          _isNew: true,
          codigo: '',
          nombre: '',
          seccion: 'Química Clínica',
          metodoDefault: 'Automatizado',
          muestra: 'Suero',
          ub: 3,
          valorParticularArs: 5400,
          valorObraSocialBaseArs: 4050,
          determinaciones: [{ id: 'det_1', label: 'Resultado', unidad: '', rangoReferencia: '' }]
        };
        renderWorkspace();
      });
    }
    var nomCancelBtn = bodyEl.querySelector('#ms-lab-nom-cancel');
    if (nomCancelBtn) nomCancelBtn.addEventListener('click', function () { STATE.editingPractice = null; renderWorkspace(); });

    bodyEl.querySelectorAll('[data-nom-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = STATE.catalog.find(function (x) { return x.codigo === btn.getAttribute('data-nom-edit'); });
        if (c) {
          STATE.editingPractice = JSON.parse(JSON.stringify(c));
          renderWorkspace();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

    var syncPracticeDraftFromDom = function () {
      var ed = STATE.editingPractice;
      if (!ed) return;
      ed.codigo = bodyEl.querySelector('#nom-f-cod').value;
      ed.nombre = bodyEl.querySelector('#nom-f-nom').value;
      ed.seccion = bodyEl.querySelector('#nom-f-sec').value;
      ed.metodoDefault = bodyEl.querySelector('#nom-f-met').value;
      ed.muestra = bodyEl.querySelector('#nom-f-mue').value;
      ed.ub = Number(bodyEl.querySelector('#nom-f-ub').value || 1);
      ed.valorParticularArs = Number(bodyEl.querySelector('#nom-f-part').value || 0);
      ed.valorObraSocialBaseArs = Number(bodyEl.querySelector('#nom-f-os').value || 0);
      ed.notaDefault = bodyEl.querySelector('#nom-f-nota').value;
      var dets = ed.determinaciones || [];
      bodyEl.querySelectorAll('[data-det-lbl]').forEach(function (inp) {
        var idx = Number(inp.getAttribute('data-det-lbl'));
        if (dets[idx]) dets[idx].label = inp.value;
      });
      bodyEl.querySelectorAll('[data-det-sub]').forEach(function (inp) {
        var idx = Number(inp.getAttribute('data-det-sub'));
        if (dets[idx]) dets[idx].subgrupo = inp.value;
      });
      bodyEl.querySelectorAll('[data-det-uni]').forEach(function (inp) {
        var idx = Number(inp.getAttribute('data-det-uni'));
        if (dets[idx]) dets[idx].unidad = inp.value;
      });
      bodyEl.querySelectorAll('[data-det-ref]').forEach(function (inp) {
        var idx = Number(inp.getAttribute('data-det-ref'));
        if (dets[idx]) dets[idx].rangoReferencia = inp.value;
      });
    };

    var addDetBtn = bodyEl.querySelector('#nom-f-add-det');
    if (addDetBtn) {
      addDetBtn.addEventListener('click', function () {
        syncPracticeDraftFromDom();
        STATE.editingPractice.determinaciones.push({
          id: 'det_' + Date.now(),
          label: 'Determinación',
          unidad: '',
          rangoReferencia: ''
        });
        renderWorkspace();
      });
    }

    bodyEl.querySelectorAll('[data-det-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        syncPracticeDraftFromDom();
        var idx = Number(btn.getAttribute('data-det-del'));
        if (STATE.editingPractice.determinaciones.length > 1) {
          STATE.editingPractice.determinaciones.splice(idx, 1);
          renderWorkspace();
        }
      });
    });

    var pracForm = bodyEl.querySelector('#ms-lab-practice-form');
    if (pracForm) {
      pracForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        syncPracticeDraftFromDom();
        var res = await apiLab('POST', {
          action: 'save_practice',
          practice: STATE.editingPractice
        });
        if (res && res.ok) {
          applyServerPayload(res);
          STATE.editingPractice = null;
          showToast(res.message, false);
          renderWorkspace();
        } else {
          showToast((res && res.message) || 'Error guardando prestación.', true);
        }
      });
    }

    // --- EVENTOS OBRAS SOCIALES ---
    var osSel = bodyEl.querySelector('#ms-lab-os-sel');
    if (osSel) {
      osSel.addEventListener('change', function () {
        STATE.selectedOsId = osSel.value;
        renderWorkspace();
      });
    }
    var osNewBtn = bodyEl.querySelector('#ms-lab-os-new');
    if (osNewBtn) {
      osNewBtn.addEventListener('click', async function () {
        var nom = window.prompt('Nombre de la nueva Obra Social / Prepaga:');
        if (!nom || !nom.trim()) return;
        var res = await apiLab('POST', {
          action: 'save_os_tarifa',
          tarifa: {
            nombre: nom.trim(),
            sigla: nom.trim().slice(0, 12).toUpperCase(),
            modalidad: 'por_ub',
            valorUbArs: STATE.config.valorUbBaseObraSocialArs || 1350
          }
        });
        if (res && res.ok) {
          applyServerPayload(res);
          var last = STATE.obrasSocialesTarifas[STATE.obrasSocialesTarifas.length - 1];
          if (last) STATE.selectedOsId = last.id;
          showToast(res.message, false);
          renderWorkspace();
        }
      });
    }

    var osForm = bodyEl.querySelector('#ms-lab-os-form');
    if (osForm) {
      osForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiLab('POST', {
          action: 'save_os_tarifa',
          tarifa: {
            id: bodyEl.querySelector('#os-f-id').value,
            nombre: bodyEl.querySelector('#os-f-nom').value,
            sigla: bodyEl.querySelector('#os-f-sig').value,
            cuit: bodyEl.querySelector('#os-f-cuit').value,
            modalidad: bodyEl.querySelector('#os-f-mod').value,
            valorUbArs: Number(bodyEl.querySelector('#os-f-ub').value || 0),
            porcentajeSobreParticular: Number(bodyEl.querySelector('#os-f-pct').value || 80),
            coseguroDefaultArs: Number(bodyEl.querySelector('#os-f-cos').value || 0)
          }
        });
        if (res && res.ok) {
          applyServerPayload(res);
          showToast(res.message, false);
          renderWorkspace();
        }
      });
    }

    var osCodeQ = bodyEl.querySelector('#ms-lab-os-code-q');
    if (osCodeQ) {
      osCodeQ.addEventListener('input', function () {
        STATE.osCodeSearch = osCodeQ.value;
        renderWorkspace();
        var el = document.getElementById('ms-lab-os-code-q');
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }

    bodyEl.querySelectorAll('[data-os-override-code]').forEach(function (inp) {
      inp.addEventListener('change', async function () {
        var res = await apiLab('POST', {
          action: 'set_os_practice_price',
          obraSocialId: STATE.selectedOsId,
          codigo: inp.getAttribute('data-os-override-code'),
          precioArs: inp.value
        });
        if (res && res.ok) {
          applyServerPayload(res);
          showToast(res.message, false);
          renderWorkspace();
        }
      });
    });

    var liqFrom = bodyEl.querySelector('#ms-os-liq-from');
    var liqTo = bodyEl.querySelector('#ms-os-liq-to');
    if (liqFrom) liqFrom.addEventListener('change', function () { STATE.osLiqFrom = liqFrom.value; renderWorkspace(); });
    if (liqTo) liqTo.addEventListener('change', function () { STATE.osLiqTo = liqTo.value; renderWorkspace(); });

    var billBatchBtn = bodyEl.querySelector('#ms-os-bill-batch');
    if (billBatchBtn) {
      billBatchBtn.addEventListener('click', function () {
        var selOs = STATE.obrasSocialesTarifas.find(function (o) { return o.id === STATE.selectedOsId; });
        if (!selOs) return;
        var fromD = STATE.osLiqFrom || monthStartIso();
        var toD = STATE.osLiqTo || todayIso();
        var osOrders = STATE.orders.filter(function (o) {
          return o.coberturaTipo === 'obra_social' && o.obraSocialId === selOs.id && o.fecha >= fromD && o.fecha <= toD;
        });
        var total = osOrders.reduce(function (a, o) { return a + (Number(o.totalObraSocialArs) || 0); }, 0);
        if (typeof window.__MS_LOAD_SERVICES_INTO_POS__ === 'function') {
          window.__MS_LOAD_SERVICES_INTO_POS__({
            observacion: 'Liquidación Prestaciones Bioquímicas ' + selOs.nombre + ' (' + fromD + ' a ' + toD + ')',
            ocasional: { cuit: selOs.cuit || '', razonSocial: selOs.nombre },
            items: [{
              codigo: 'LIQ-BIOQ',
              nombre: 'LIQUIDACIÓN PRESTACIONES BIOQUÍMICAS ' + selOs.sigla + ' (' + osOrders.length + ' ÓRDENES)',
              cantidad: 1,
              precioFinal: total,
              descPct: 0,
              ivaPct: 10.5,
              isService: true,
              itemType: 'service'
            }]
          });
        }
      });
    }

    // --- EVENTOS FIRMA DIGITAL Y MEMBRETE ---
    bindSignaturePad(bodyEl);

    var sigForm = bodyEl.querySelector('#ms-lab-sig-form');
    if (sigForm) {
      sigForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiLab('POST', {
          action: 'save_signature',
          signature: {
            username: bodyEl.querySelector('#sig-f-user').value,
            nombreCompleto: bodyEl.querySelector('#sig-f-name').value,
            tituloProfesional: bodyEl.querySelector('#sig-f-title').value,
            matricula: bodyEl.querySelector('#sig-f-mat').value,
            firmaDataUrl: bodyEl.querySelector('#sig-f-dataurl').value
          }
        });
        if (res && res.ok) {
          applyServerPayload(res);
          showToast(res.message, false);
          renderWorkspace();
        } else {
          showToast((res && res.message) || 'Error guardando firma.', true);
        }
      });
    }

    var cfgForm = bodyEl.querySelector('#ms-lab-config-form');
    if (cfgForm) {
      cfgForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiLab('POST', {
          action: 'save_config',
          config: {
            nombreLaboratorio: bodyEl.querySelector('#cfg-f-nom').value,
            subtituloDirector: bodyEl.querySelector('#cfg-f-dir').value,
            direccion: bodyEl.querySelector('#cfg-f-dom').value,
            telefono: bodyEl.querySelector('#cfg-f-tel').value,
            bannerColorPrimary: bodyEl.querySelector('#cfg-f-col').value,
            proximoProtocoloNro: Number(bodyEl.querySelector('#cfg-f-proto').value || 1001),
            valorUbBaseParticularArs: Number(bodyEl.querySelector('#cfg-f-ubp').value || 1800),
            valorUbBaseObraSocialArs: Number(bodyEl.querySelector('#cfg-f-ubos').value || 1350),
            leyendaPiePagina: bodyEl.querySelector('#cfg-f-pie').value,
            plantillaWhatsapp: bodyEl.querySelector('#cfg-f-wa').value,
            requerirDniEnPortalQr: bodyEl.querySelector('#cfg-f-qrdni').checked,
            mostrarQrVerificacionEnPdf: bodyEl.querySelector('#cfg-f-qrpdf').checked
          }
        });
        if (res && res.ok) {
          applyServerPayload(res);
          showToast(res.message, false);
          renderWorkspace();
        }
      });
    }
  }

  function bindGlobalNavReset() {
    if (window.__MS_LAB_NAV_BOUND__) return;
    window.__MS_LAB_NAV_BOUND__ = true;
    document.addEventListener(
      'click',
      function (ev) {
        var t = ev.target;
        if (!t || typeof t.closest !== 'function') return;
        var nav = t.closest(
          '#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card'
        );
        if (!nav) return;
        var m = document.getElementById('sec-menu-laboratorio');
        var w = document.getElementById('sec-laboratorio-workspace');
        var isLabActive = (m && !m.hidden) || (w && !w.hidden);

        if (nav.id === 'btn-topbar-back-facturacion' && isLabActive) {
          ev.preventDefault();
          ev.stopPropagation();
          if (w && !w.hidden) {
            openLaboratorioView('menu');
          } else {
            returnToParentOrHome();
          }
          return;
        }
        if (m) m.hidden = true;
        if (w) w.hidden = true;
      },
      true
    );
  }

  // Tarjeta standalone en #sec-inicio sólo si el cliente contrató "laboratorio" sin "gestion_consultorios"
  function syncStandaloneHomeCard() {
    bindGlobalNavReset();
    var gcCard = document.getElementById('ms-gestion-consultorios-home-card');
    var gcOwns = Boolean(window.__MS_GESTION_CONSULTORIOS_OWNS_LABORATORIO__ && gcCard && !gcCard.hidden);
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-laboratorio-home-card');
    var allowed = isSubAllowed('') && !gcOwns;

    if (allowed && inicioGrid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-laboratorio-home-card';
      card.className = 'module-card';
      card.setAttribute('data-module-key', 'laboratorio');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6"></path><path d="M10 3v6.5L5.2 17.6A2 2 0 0 0 6.9 20.6h10.2a2 2 0 0 0 1.7-3L14 9.5V3"></path><path d="M7.5 14h9"></path></svg>' +
        '</div>' +
        '<h3>Laboratorio</h3>';
      var openFn = function () {
        openLaboratorioView('menu');
      };
      card.addEventListener('click', openFn);
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openFn();
        }
      });
      var perfilCard = inicioGrid.querySelector('[data-module-key="perfil"]');
      if (perfilCard) inicioGrid.insertBefore(card, perfilCard);
      else inicioGrid.appendChild(card);
    } else if (existing) {
      existing.hidden = !allowed;
      existing.style.display = allowed ? '' : 'none';
    }
  }

  window.__MS_OPEN_LABORATORIO__ = openLaboratorioView;
  setInterval(syncStandaloneHomeCard, 1200);
  document.addEventListener('DOMContentLoaded', syncStandaloneHomeCard);
})();
