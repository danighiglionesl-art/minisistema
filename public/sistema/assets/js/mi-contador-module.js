/* ==========================================================================
   MÓDULO "MI CONTADOR" — ARCA (F.2051 · F.2083 · F.5663 · MONOTRIBUTO) + CFO IA
   Compatible con MiniSistema ERP, Casa Nueva ERP y PaseoAlberdi.ar
   ========================================================================== */
(function () {
  'use strict';

  var GASTOS_CATS = [
    'Alquiler / Expensas',
    'Energía Eléctrica / Gas / Agua / Internet',
    'Sueldos y Cargas Sociales',
    'Impuestos y Tasas Municipales',
    'Fletes y Logística',
    'Mantenimiento y Reparaciones',
    'Publicidad y Marketing',
    'Honorarios Profesionales',
    'Insumos y Papelería',
    'Comisiones Bancarias / Posnet / MP',
    'Retiro Diario / Titular',
    'Otros Gastos Operativos'
  ];

  var STATE = {
    activeView: 'menu', // 'menu' | 'ia' | 'arca_ri' | 'monotributo' | 'gastos_retiros' | 'finanzas_stock' | 'config'
    periodo: currentYm(),
    data: null,
    analytics: null,
    chatHistory: [],
    chatLoading: false,
    simPrecioDeltaPct: 5,
    simLiquidarMuertoPct: 30,
    simReducirRetirosPct: 15
  };

  function currentYm() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

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

  function fmtArs2(val) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(val || 0));
  }

  function formatSimpleMd(text) {
    return esc(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function getThemeColors() {
    var b = (document.documentElement.getAttribute('data-brand') || '').toLowerCase();
    var boot = window.__ERP_TENANT_BOOT__ || {};
    if (boot.primaryHex && boot.accentHex) {
      return { primary: boot.primaryHex, accent: boot.accentHex };
    }
    if (b === 'paseo-alberdi') {
      return { primary: '#1C1B1E', accent: '#C9A44C' };
    }
    if (b === 'minisistema') {
      return { primary: '#112D3A', accent: '#56D7A1' };
    }
    // Casa Nueva ERP por defecto
    return { primary: '#163829', accent: '#D4A41E' };
  }

  function ensureStylesInjected() {
    if (document.getElementById('mc-module-styles')) return;
    var c = getThemeColors();
    var st = document.createElement('style');
    st.id = 'mc-module-styles';
    st.textContent =
      '.mc-card{background:#fff;border:1px solid #dbe7ec;border-radius:16px;padding:1.15rem;box-shadow:0 4px 16px rgba(15,23,42,0.05);color:#112D3A;}' +
      '.mc-card--dark{background:' + c.primary + ';color:#fff;border-color:' + c.accent + ';}' +
      '.mc-btn{display:inline-flex;align-items:center;justify-content:center;gap:0.35rem;background:' + c.accent + ';color:#112D3A;border:none;border-radius:10px;padding:0.5rem 0.95rem;font-weight:800;font-size:0.82rem;cursor:pointer;text-decoration:none;transition:opacity .15s;}' +
      '.mc-btn:hover{opacity:0.9;}' +
      '.mc-btn--dark{background:' + c.primary + ';color:#fff;}' +
      '.mc-btn--outline{background:#fff;color:#112D3A;border:1.5px solid #cbd5e1;}' +
      '.mc-btn--outline:hover{border-color:' + c.primary + ';}' +
      '.mc-input,.mc-select{width:100%;box-sizing:border-box;border:1.5px solid #cbd5e1;border-radius:10px;padding:0.48rem 0.7rem;font-size:0.84rem;background:#fff;color:#112D3A;font-weight:600;}' +
      '.mc-label{display:block;font-size:0.74rem;font-weight:800;color:#475569;margin-bottom:0.25rem;text-transform:uppercase;letter-spacing:0.02em;}' +
      '.mc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.85rem;}' +
      '.mc-grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem;}' +
      '.mc-kpi{background:#fff;border:1px solid #dbe7ec;border-radius:14px;padding:0.9rem;box-shadow:0 2px 8px rgba(15,23,42,0.04);}' +
      '.mc-kpi-lbl{font-size:0.72rem;font-weight:800;text-transform:uppercase;color:#64748b;}' +
      '.mc-kpi-val{font-size:1.35rem;font-weight:900;margin-top:0.2rem;color:#112D3A;}' +
      '.mc-badge{display:inline-block;padding:0.18rem 0.55rem;border-radius:999px;font-size:0.72rem;font-weight:900;}' +
      '.mc-table{width:100%;border-collapse:collapse;font-size:0.81rem;}' +
      '.mc-table th{text-align:left;padding:0.5rem;border-bottom:2px solid ' + c.accent + ';font-size:0.75rem;color:#334155;}' +
      '.mc-table td{padding:0.5rem;border-bottom:1px solid #e2ecf0;vertical-align:middle;}' +
      '.mc-bar-track{width:100%;height:12px;border-radius:999px;background:#e2e8f0;overflow:hidden;}' +
      '.mc-bar-fill{height:100%;border-radius:999px;transition:width .3s;}' +
      '.mc-chat-box{max-height:420px;overflow-y:auto;display:grid;gap:0.7rem;padding:0.85rem;background:#f8fbfc;border:1px solid #dbe7ec;border-radius:14px;}' +
      '.mc-msg{padding:0.75rem 0.95rem;border-radius:12px;font-size:0.85rem;line-height:1.5;max-width:92%;}' +
      '.mc-msg--user{justify-self:end;background:' + c.primary + ';color:#fff;font-weight:600;}' +
      '.mc-msg--ai{justify-self:start;background:#fff;border:1.5px solid ' + c.accent + ';color:#112D3A;}';
    document.head.appendChild(st);
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
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.username) return parsed;
      }
    } catch (_e) {}
    return null;
  }

  function isMiContadorAllowed() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    var un = String(u.username).toLowerCase();
    if (un === 'danielg' || un === 'danicenteno' || u.role === 'Administrador General' || u.role === 'Administrador') {
      var brandMods = (window.ERP_BRAND && window.ERP_BRAND.enabledModules) || [];
      // Si es MiniSistema multitenant (no base) y tiene enabledModules definido sin mi_contador, respetar plan
      if (
        window.__ERP_TENANT_BOOT__ &&
        !window.__ERP_TENANT_BOOT__.isBase &&
        Array.isArray(brandMods) &&
        brandMods.length > 0 &&
        brandMods.indexOf('mi_contador') === -1 &&
        un !== 'danielg'
      ) {
        return false;
      }
      return true;
    }
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return uMods.some(function (k) {
      return k === 'mi_contador' || String(k).indexOf('mi_contador:') === 0;
    });
  }

  function resolveApiUrl() {
    if (window.location.pathname.indexOf('/sistema') !== -1) {
      return 'api/mi_contador.php';
    }
    return '/sistema/api/mi_contador.php';
  }

  async function apiMc(method, bodyOrQuery) {
    var url = resolveApiUrl();
    var u = getActiveUser();
    var headers = { 'Content-Type': 'application/json' };
    if (u && u.username) headers['x-erp-user'] = u.username;
    var opts = { method: method, headers: headers };
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
    var el = document.getElementById('ms-mc-toast');
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

  function downloadTextFile(filename, content, mime) {
    var blob = new Blob([content || ''], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function hideAllErpSections() {
    document.querySelectorAll('.erp-main > .erp-section').forEach(function (sec) {
      sec.hidden = true;
    });
  }

  function closeToHome() {
    hideAllErpSections();
    var inicio = document.getElementById('sec-inicio');
    if (inicio) inicio.hidden = false;
  }

  async function reloadData(renderAfter) {
    try {
      var res = await apiMc('GET', { action: 'dashboard', periodo: STATE.periodo, t: String(Date.now()) });
      if (res && res.ok) {
        STATE.data = res.data;
        STATE.analytics = res.analytics;
        syncHomePill();
      }
    } catch (_e) {}
    if (renderAfter) renderWorkspace();
  }

  function syncHomePill() {
    var pill = document.getElementById('ms-mc-home-pill');
    if (!pill || !STATE.analytics) return;
    var alerts = (STATE.analytics.alertasEjecutivas || []).filter(function (a) { return a.nivel === 'alta'; }).length;
    if (alerts > 0) {
      pill.textContent = '🔔 ' + alerts + ' ALERTAS';
      pill.style.background = '#fef3c7';
      pill.style.color = '#92400e';
    } else {
      pill.textContent = 'ARCA + IA';
    }
    var bIva = document.getElementById('mc-badge-ri');
    if (bIva && STATE.analytics.arca) {
      bIva.textContent = 'F.2051: ' + fmtArs(STATE.analytics.arca.f2051.saldoAPagar);
    }
    var bMono = document.getElementById('mc-badge-mono');
    if (bMono && STATE.analytics.arca) {
      bMono.textContent = 'Cat. ' + STATE.analytics.arca.monotributo.categoriaActual + ' (' + STATE.analytics.arca.monotributo.pctConsumidoCatActual + '%)';
    }
    var bStock = document.getElementById('mc-badge-stock');
    if (bStock && STATE.analytics.inventario) {
      bStock.textContent = STATE.analytics.inventario.stockMuertoCount + ' stock muerto';
    }
  }

  function subCard(key, title, svgPath) {
    return (
      '<article class="module-card" role="button" tabindex="0" data-mc-sub="' + key + '">' +
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + svgPath + '</svg>' +
        '</div>' +
        '<h3>' + esc(title) + '</h3>' +
      '</article>'
    );
  }

  function ensureSectionsMounted() {
    ensureStylesInjected();
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var menuSec = document.getElementById('sec-menu-micontador');
    var workSec = document.getElementById('sec-micontador-workspace');

    if (!menuSec) {
      menuSec = document.createElement('section');
      menuSec.id = 'sec-menu-micontador';
      menuSec.className = 'erp-section';
      menuSec.hidden = true;
      menuSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="mc-back-home-btn">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">ERP en Línea · <strong>Mi Contador (ARCA + CFO IA)</strong></span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;">' +
            '<label style="font-size:0.78rem;font-weight:800;">Período Fiscal:</label>' +
            '<input type="month" id="mc-menu-periodo" class="mc-input" style="width:auto;" value="' + esc(STATE.periodo) + '">' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" aria-label="Submódulos de Mi Contador">' +
          subCard('ia', 'Asesor Empresarial IA (CFO Virtual)', '<path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"></path><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>') +
          subCard('arca_ri', 'ARCA · Responsable Inscripto (F.2051 · F.2083 · F.5663)', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>') +
          subCard('monotributo', 'ARCA · Monotributo y Recategorización', '<path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path>') +
          subCard('gastos_retiros', 'Compras, Gastos, Retiros y Retenciones', '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>') +
          subCard('finanzas_stock', 'Inteligencia de Stock, Ventas y Finanzas', '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>') +
          subCard('config', 'Configuración Fiscal, Tablas y Calendario', '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>') +
        '</div>';

      erpMain.appendChild(menuSec);
      menuSec.querySelector('#mc-back-home-btn').addEventListener('click', closeToHome);
      menuSec.querySelector('#mc-menu-periodo').addEventListener('change', function (ev) {
        STATE.periodo = ev.target.value || currentYm();
        reloadData(false);
      });
      menuSec.querySelectorAll('[data-mc-sub]').forEach(function (card) {
        card.addEventListener('click', function () { openMcView(card.getAttribute('data-mc-sub')); });
        card.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openMcView(card.getAttribute('data-mc-sub')); }
        });
      });
    }

    if (!workSec) {
      workSec = document.createElement('section');
      workSec.id = 'sec-micontador-workspace';
      workSec.className = 'erp-section';
      workSec.hidden = true;
      workSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="mc-back-sub-btn">← Volver a Mi Contador</button>' +
            '<span class="module-breadcrumb">Mi Contador · <strong id="mc-sub-title">Panel</strong></span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
            '<input type="month" id="mc-work-periodo" class="mc-input" style="width:auto;" value="' + esc(STATE.periodo) + '">' +
            '<button type="button" class="mc-btn mc-btn--outline" id="mc-refresh-btn">🔄 Actualizar</button>' +
          '</div>' +
        '</div>' +
        '<div id="ms-mc-toast" style="display:none;margin-bottom:0.85rem;padding:0.7rem 1rem;border-radius:10px;font-weight:700;font-size:0.84rem;"></div>' +
        '<div id="ms-mc-body"></div>';

      erpMain.appendChild(workSec);
      workSec.querySelector('#mc-back-sub-btn').addEventListener('click', function () { openMcView('menu'); });
      workSec.querySelector('#mc-work-periodo').addEventListener('change', function (ev) {
        STATE.periodo = ev.target.value || currentYm();
        var mp = document.getElementById('mc-menu-periodo');
        if (mp) mp.value = STATE.periodo;
        reloadData(true);
      });
      workSec.querySelector('#mc-refresh-btn').addEventListener('click', function () { reloadData(true); });
    }

    return { menuSec: menuSec, workSec: workSec };
  }

  async function openMcView(viewName) {
    var refs = ensureSectionsMounted();
    if (!refs) return;
    STATE.activeView = viewName || 'menu';
    hideAllErpSections();

    if (STATE.activeView === 'menu') {
      refs.menuSec.hidden = false;
      var mp = document.getElementById('mc-menu-periodo');
      if (mp) mp.value = STATE.periodo;
      await reloadData(false);
    } else {
      refs.workSec.hidden = false;
      var wp = document.getElementById('mc-work-periodo');
      if (wp) wp.value = STATE.periodo;
      var titles = {
        ia: 'Asesor Empresarial IA (CFO Virtual con Datos Reales del ERP)',
        arca_ri: 'ARCA Responsable Inscripto — F.2051 (IVA) · F.2083 (Libro IVA) · F.5663 (IIBB Córdoba)',
        monotributo: 'ARCA Monotributo — Control 12 Meses, Categorías y Anti-Exclusión',
        gastos_retiros: 'Compras (Crédito Fiscal), Gastos Operativos, Retiros Diarios y Retenciones',
        finanzas_stock: 'Inteligencia de Stock (Abastecimiento · ABC · Stock Muerto) y Finanzas',
        config: 'Configuración Fiscal ARCA, Delegación de Servicios, Escalas y Calendario'
      };
      var tEl = document.getElementById('mc-sub-title');
      if (tEl) tEl.textContent = titles[STATE.activeView] || 'Mi Contador';
      await reloadData(true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==================== 1. ASESOR EMPRESARIAL IA (CFO VIRTUAL) ====================
  function renderIaView() {
    var a = STATE.analytics;
    if (!a) return '<div class="mc-card">Cargando diagnóstico financiero...</div>';
    var v = a.ventas;
    var f = a.finanzas;
    var inv = a.inventario;

    var alertsHtml = (a.alertasEjecutivas || []).length === 0
      ? '<div class="mc-card" style="border-left:4px solid #10b981;"><strong>✅ Salud Financiera Estable:</strong> No se detectaron alertas críticas en el período ' + esc(a.periodo) + '.</div>'
      : (a.alertasEjecutivas || []).map(function (al) {
          var clr = al.nivel === 'alta' ? '#dc2626' : '#d97706';
          var bg = al.nivel === 'alta' ? '#fef2f2' : '#fffbeb';
          return '<div class="mc-card" style="border-left:5px solid ' + clr + ';background:' + bg + ';padding:0.75rem 1rem;"><strong style="color:' + clr + ';">' + esc(al.titulo) + '</strong><div style="font-size:0.82rem;margin-top:0.2rem;">' + esc(al.detalle) + '</div></div>';
        }).join('');

    var quickPrompts = [
      'Haceme un diagnóstico completo de mi negocio este mes',
      '¿Cuánta plata puedo retirar hoy sin descapitalizarme?',
      'Analizá mi Stock Muerto y cuánto capital tengo inmovilizado',
      '¿Qué artículos tengo que reponer urgente?',
      '¿Cuánto voy a pagar de IVA F.2051 y de IIBB F.5663 este mes?',
      'Analizá mis ventas Contado vs Cuenta Corriente y Efectivo vs Bancarizado',
      '¿Cuál es mi Punto de Equilibrio mensual y diario?',
      '¿Cómo estoy en Monotributo y cuánto margen me queda?'
    ];

    var chatMsgsHtml = STATE.chatHistory.length === 0
      ? '<div class="mc-msg mc-msg--ai"><strong>🤖 Mi Contador IA (CFO Virtual):</strong><br>¡Hola! Ya analicé tus datos en vivo del período <strong>' + esc(a.periodo) + '</strong> (Ventas: <strong>' + fmtArs(v.totalPeriodo) + '</strong> · Ganancia neta est.: <strong>' + fmtArs(f.gananciaNetaEstimada) + '</strong> · Stock Muerto: <strong>' + inv.stockMuertoCount + ' art.</strong>). Elegí una consulta rápida o preguntame lo que necesites para decidir mejor.</div>'
      : STATE.chatHistory.map(function (m) {
          return '<div class="mc-msg ' + (m.role === 'user' ? 'mc-msg--user' : 'mc-msg--ai') + '">' +
            (m.role === 'ai' ? '<div style="font-size:0.7rem;font-weight:900;opacity:0.7;margin-bottom:0.2rem;">🤖 MI CONTADOR IA (' + esc(m.source || 'CFO') + ')</div>' : '') +
            formatSimpleMd(m.text) +
          '</div>';
        }).join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="mc-grid">' +
          '<div class="mc-kpi"><div class="mc-kpi-lbl">Ventas ' + esc(a.periodo) + '</div><div class="mc-kpi-val">' + fmtArs(v.totalPeriodo) + '</div><small style="color:#64748b;">Hoy: ' + fmtArs(v.totalHoy) + ' · Margen: ' + v.margenBrutoPct + '%</small></div>' +
          '<div class="mc-kpi"><div class="mc-kpi-lbl">Ganancia Neta Estimada</div><div class="mc-kpi-val" style="color:' + (f.gananciaNetaEstimada >= 0 ? '#047857' : '#dc2626') + ';">' + fmtArs(f.gananciaNetaEstimada) + '</div><small style="color:#64748b;">Retiros mes: ' + fmtArs(f.retirosTotalesPeriodo) + '</small></div>' +
          '<div class="mc-kpi"><div class="mc-kpi-lbl">Stock Muerto (60+ días)</div><div class="mc-kpi-val" style="color:#b45309;">' + fmtArs(inv.stockMuertoCapitalCosto) + '</div><small style="color:#64748b;">' + inv.stockMuertoCount + ' artículos sin movimiento</small></div>' +
          '<div class="mc-kpi"><div class="mc-kpi-lbl">Impuestos ARCA Est. Mes</div><div class="mc-kpi-val" style="color:#0369a1;">' + fmtArs(f.impuestosEstimadosMes) + '</div><small style="color:#64748b;">F.2051: ' + fmtArs(a.arca.f2051.saldoAPagar) + ' · F.5663: ' + fmtArs(a.arca.f5663.saldoAPagar) + '</small></div>' +
        '</div>' +

        '<div style="display:grid;gap:0.5rem;">' + alertsHtml + '</div>' +

        '<div class="mc-card">' +
          '<h4 style="margin-top:0;">🧠 Consultale a Mi Contador IA (Datos 100% reales de tu ERP)</h4>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.85rem;">' +
            quickPrompts.map(function (qp) {
              return '<button type="button" class="mc-btn mc-btn--outline" style="font-size:0.74rem;padding:0.32rem 0.65rem;" data-mc-quick-q="' + esc(qp) + '">✨ ' + esc(qp) + '</button>';
            }).join('') +
          '</div>' +
          '<div class="mc-chat-box" id="mc-chat-box">' + chatMsgsHtml + '</div>' +
          '<form id="mc-chat-form" style="display:flex;gap:0.5rem;margin-top:0.75rem;">' +
            '<input class="mc-input" id="mc-chat-inp" placeholder="Preguntá sobre ventas, retiros, stock muerto, IVA F.2051, IIBB F.5663, Monotributo o finanzas..." ' + (STATE.chatLoading ? 'disabled' : '') + '>' +
            '<button type="submit" class="mc-btn mc-btn--dark" ' + (STATE.chatLoading ? 'disabled' : '') + '>' + (STATE.chatLoading ? 'Analizando...' : 'Enviar Consulta') + '</button>' +
          '</form>' +
        '</div>' +
      '</div>'
    );
  }

  // ==================== 2. ARCA RESPONSABLE INSCRIPTO (F.2051 · F.2083 · F.5663) ====================
  function renderArcaRiView() {
    var a = STATE.analytics;
    var d = STATE.data;
    if (!a || !d) return '<div class="mc-card">Cargando liquidación ARCA...</div>';
    var f2051 = a.arca.f2051;
    var f2083 = a.arca.f2083;
    var f5663 = a.arca.f5663;
    var cfg = d.fiscalConfig || {};

    function findPres(formCode) {
      return (d.presentaciones || []).find(function (p) { return p.periodo === a.periodo && p.formulario === formCode; }) || null;
    }
    var p2051 = findPres('F2051');
    var p2083 = findPres('F2083');
    var p5663 = findPres('F5663');

    function statusPill(pres) {
      var st = pres ? pres.estado : 'BORRADOR';
      var bg = st === 'PAGADA' || st === 'PRESENTADA' ? '#dcfce7;color:#065f46;' : st === 'LISTA_PARA_ARCA' ? '#e0f2fe;color:#075985;' : '#fef3c7;color:#92400e;';
      return '<span class="mc-badge" style="background:' + bg + '">' + esc(st) + (pres && pres.nroTransaccionArca ? ' · #' + esc(pres.nroTransaccionArca) : '') + '</span>';
    }

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="mc-card mc-card--dark">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">' +
            '<div>' +
              '<span class="mc-badge" style="background:#56D7A1;color:#112D3A;">PAQUETE MENSUAL RESPONSABLE INSCRIPTO · PERÍODO ' + esc(a.periodo) + '</span>' +
              '<h3 style="margin:0.4rem 0 0.2rem;color:#fff;">Presentaciones Obligatorias ARCA Listas para Cargar</h3>' +
              '<div style="font-size:0.82rem;opacity:0.88;">CUIT: <strong>' + esc(cfg.cuit || a.arcaCuitCert || 'Configurar en Configuración Fiscal') + '</strong> · Jurisdicción IIBB: <strong>' + esc(f5663.jurisdiccion) + '</strong>' +
              (cfg.cuitDelegadoArca ? ' · Delegado ARCA: <code>' + esc(cfg.cuitDelegadoArca) + '</code>' : '') + '</div>' +
            '</div>' +
            '<a href="https://auth.afip.gob.ar/contribuyente_/login.xhtml" target="_blank" rel="noopener noreferrer" class="mc-btn">🌐 Abrir Portal ARCA (Clave Fiscal) ↗</a>' +
          '</div>' +
        '</div>' +

        // 1. F2051 - IVA SIMPLE
        '<div class="mc-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">' +
            '<div><h4 style="margin:0;">1. Formulario F.2051 — Declaración Jurada de IVA (IVA Simple)</h4><small style="color:#64748b;">Ruta ARCA: Clave Fiscal → Portal IVA → Determinación del impuesto y saldo resultante</small></div>' +
            statusPill(p2051) +
          '</div>' +
          '<div class="mc-grid" style="margin-bottom:0.85rem;">' +
            '<div class="mc-kpi"><div class="mc-kpi-lbl">Débito Fiscal (Ventas)</div><div class="mc-kpi-val">' + fmtArs2(f2051.debitoFiscal) + '</div><small>Neto gravado est.: ' + fmtArs2(f2051.ventasNetoGravado21) + '</small></div>' +
            '<div class="mc-kpi"><div class="mc-kpi-lbl">Crédito Fiscal (Compras)</div><div class="mc-kpi-val" style="color:#047857;">− ' + fmtArs2(f2051.creditoFiscalCompras) + '</div><small>Saldo técnico ant.: ' + fmtArs2(f2051.saldoTecnicoAnterior) + '</small></div>' +
            '<div class="mc-kpi"><div class="mc-kpi-lbl">Retenciones / Percepciones IVA</div><div class="mc-kpi-val" style="color:#0369a1;">− ' + fmtArs2(f2051.percepcionesIvaCompras + f2051.retencionesIvaExtra) + '</div><small>Saldo libre disp. ant.: ' + fmtArs2(f2051.saldoLibreDispAnterior) + '</small></div>' +
            '<div class="mc-kpi" style="border:2px solid ' + (f2051.saldoAPagar > 0 ? '#dc2626' : '#10b981') + ';"><div class="mc-kpi-lbl">' + (f2051.saldoAPagar > 0 ? 'SALDO A PAGAR F.2051' : 'SALDO A FAVOR TÉCNICO') + '</div><div class="mc-kpi-val" style="color:' + (f2051.saldoAPagar > 0 ? '#dc2626' : '#047857') + ';">' + fmtArs2(f2051.saldoAPagar > 0 ? f2051.saldoAPagar : f2051.saldoFavorTecnicoSiguiente) + '</div><small>Libre disp. sig.: ' + fmtArs2(f2051.saldoFavorLibreDispSiguiente) + '</small></div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">' +
            '<button type="button" class="mc-btn mc-btn--outline" data-copy-val="' + f2051.debitoFiscal + '">📋 Copiar Débito Fiscal</button>' +
            '<button type="button" class="mc-btn mc-btn--outline" data-copy-val="' + f2051.creditoFiscalCompras + '">📋 Copiar Crédito Fiscal</button>' +
            '<button type="button" class="mc-btn mc-btn--outline" data-copy-val="' + f2051.saldoAPagar + '">📋 Copiar Saldo F.2051</button>' +
            '<button type="button" class="mc-btn" data-mark-pres="F2051" data-pres-amt="' + f2051.saldoAPagar + '">✅ Registrar F.2051 Presentada</button>' +
          '</div>' +
        '</div>' +

        // 2. F2083 - LIBRO IVA DIGITAL
        '<div class="mc-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">' +
            '<div><h4 style="margin:0;">2. Formulario F.2083 — Libro de IVA Digital</h4><small style="color:#64748b;">Ruta ARCA: Clave Fiscal → Portal IVA → Registración Electrónica de Operaciones (Importar TXT)</small></div>' +
            statusPill(p2083) +
          '</div>' +
          '<p style="font-size:0.83rem;margin-top:0;">Comprobantes listos del período <strong>' + esc(a.periodo) + '</strong>: <strong>' + f2083.ventasCantidadCbtes + ' comprobantes de Venta</strong> (' + fmtArs(f2083.ventasTotal) + ') y <strong>' + f2083.comprasCantidadCbtes + ' comprobantes de Compra</strong> (' + fmtArs(f2083.comprasTotal) + ').</p>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">' +
            '<button type="button" class="mc-btn mc-btn--dark" data-dl-f2083="ventas_cbte">⬇ TXT Ventas Comprobantes</button>' +
            '<button type="button" class="mc-btn mc-btn--dark" data-dl-f2083="ventas_alic">⬇ TXT Ventas Alícuotas</button>' +
            '<button type="button" class="mc-btn mc-btn--outline" data-dl-f2083="compras_cbte">⬇ TXT Compras Comprobantes</button>' +
            '<button type="button" class="mc-btn mc-btn--outline" data-dl-f2083="compras_alic">⬇ TXT Compras Alícuotas</button>' +
            '<button type="button" class="mc-btn" data-mark-pres="F2083" data-pres-amt="' + f2083.ventasTotal + '">✅ Registrar F.2083 Presentado</button>' +
          '</div>' +
        '</div>' +

        // 3. F5663 - INGRESOS BRUTOS CÓRDOBA (SIFERE LOCALES)
        '<div class="mc-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">' +
            '<div><h4 style="margin:0;">3. Formulario F.5663 — Ingresos Brutos Locales de Córdoba</h4><small style="color:#64748b;">Ruta ARCA: Clave Fiscal → SIFERE Locales – Provincia de Córdoba</small></div>' +
            statusPill(p5663) +
          '</div>' +
          '<div class="mc-grid" style="margin-bottom:0.85rem;">' +
            '<div class="mc-kpi"><div class="mc-kpi-lbl">Base Imponible Neta</div><div class="mc-kpi-val">' + fmtArs2(f5663.baseImponible) + '</div><small>Alícuota aplicada: ' + esc(f5663.alicuotaPct) + '%</small></div>' +
            '<div class="mc-kpi"><div class="mc-kpi-lbl">Impuesto Determinado</div><div class="mc-kpi-val">' + fmtArs2(f5663.impuestoDeterminado) + '</div><small>Base × Alícuota IIBB</small></div>' +
            '<div class="mc-kpi"><div class="mc-kpi-lbl">SIRCREB / Ret. / Perc. IIBB</div><div class="mc-kpi-val" style="color:#0369a1;">− ' + fmtArs2(f5663.retencionesPercepcionesTotal) + '</div><small>Saldo favor ant.: ' + fmtArs2(f5663.saldoFavorAnterior) + '</small></div>' +
            '<div class="mc-kpi" style="border:2px solid ' + (f5663.saldoAPagar > 0 ? '#dc2626' : '#10b981') + ';"><div class="mc-kpi-lbl">' + (f5663.saldoAPagar > 0 ? 'SALDO A PAGAR F.5663' : 'SALDO A FAVOR IIBB') + '</div><div class="mc-kpi-val" style="color:' + (f5663.saldoAPagar > 0 ? '#dc2626' : '#047857') + ';">' + fmtArs2(f5663.saldoAPagar > 0 ? f5663.saldoAPagar : f5663.saldoFavorSiguiente) + '</div><small>SIFERE Locales Córdoba</small></div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">' +
            '<button type="button" class="mc-btn mc-btn--outline" data-copy-val="' + f5663.baseImponible + '">📋 Copiar Base Imponible</button>' +
            '<button type="button" class="mc-btn mc-btn--outline" data-copy-val="' + f5663.retencionesPercepcionesTotal + '">📋 Copiar Ret./SIRCREB</button>' +
            '<button type="button" class="mc-btn mc-btn--outline" id="mc-dl-f5663-csv">⬇ Exportar Planilla F.5663 (CSV)</button>' +
            '<button type="button" class="mc-btn" data-mark-pres="F5663" data-pres-amt="' + f5663.saldoAPagar + '">✅ Registrar F.5663 Presentada</button>' +
          '</div>' +
        '</div>' +

        // Nota de seguridad legal sobre Clave Fiscal y Delegación Oficial
        '<div class="mc-card" style="background:#f8fbfc;border-left:4px solid #0284c7;font-size:0.81rem;">' +
          '<strong>🔐 Seguridad ARCA (Delegación Oficial de Servicios):</strong> Por norma de ARCA la Clave Fiscal es personal e intransferible y no existe API pública para enviar F.2051/F.2083/F.5663 sin sesión web. Si un asesor o responsable opera bajo tu comando, debe hacerlo mediante <em>ARCA → Administrador de Relaciones de Clave Fiscal → Nueva Relación (Delegar Portal IVA y SIFERE Locales)</em>, revocable en 1 clic sin compartir jamás tu contraseña.' +
        '</div>' +
      '</div>'
    );
  }

  // ==================== 3. ARCA MONOTRIBUTO ====================
  function renderMonotributoView() {
    var a = STATE.analytics;
    var d = STATE.data;
    if (!a || !d) return '<div class="mc-card">Cargando monitor Monotributo...</div>';
    var m = a.arca.monotributo;
    var escalas = d.monotributoEscalas || [];
    var barColor = m.pctConsumidoCatActual >= 90 ? '#dc2626' : m.pctConsumidoCatActual >= 75 ? '#d97706' : '#10b981';

    var escalasRows = escalas.map(function (e, idx) {
      var isCur = e.categoria === m.categoriaActual;
      var isSug = e.categoria === m.categoriaSugerida;
      return (
        '<tr style="' + (isCur ? 'background:#ecfdf5;font-weight:800;' : '') + '">' +
          '<td><strong>Cat. ' + esc(e.categoria) + '</strong>' + (isCur ? ' <span class="mc-badge" style="background:#112D3A;color:#56D7A1;">ACTUAL</span>' : '') + (isSug ? ' <span class="mc-badge" style="background:#e0f2fe;color:#0369a1;">SUGERIDA</span>' : '') + '</td>' +
          '<td><input type="number" class="mc-input mc-esc-tope" data-idx="' + idx + '" value="' + esc(e.topeIngresosAnualArs) + '"></td>' +
          '<td><input type="number" class="mc-input mc-esc-bienes" data-idx="' + idx + '" value="' + esc(e.cuotaMensualBienesArs) + '"></td>' +
          '<td><input type="number" class="mc-input mc-esc-serv" data-idx="' + idx + '" value="' + esc(e.cuotaMensualServiciosArs) + '"></td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="mc-grid">' +
          '<div class="mc-kpi"><div class="mc-kpi-lbl">Facturación Últimos 12 Meses</div><div class="mc-kpi-val">' + fmtArs(m.facturacion12Meses) + '</div><small>Tope máximo Monotributo: ' + fmtArs(m.topeMaximoMonotributo) + '</small></div>' +
          '<div class="mc-kpi"><div class="mc-kpi-lbl">Categoría Actual / Sugerida</div><div class="mc-kpi-val">' + esc(m.categoriaActual) + ' → ' + esc(m.categoriaSugerida) + '</div><small>Cuota mensual est.: ' + fmtArs(m.cuotaEstimadaActual) + '</small></div>' +
          '<div class="mc-kpi"><div class="mc-kpi-lbl">Margen Disponible en tu Cat.</div><div class="mc-kpi-val" style="color:' + (m.margenRestanteCatActual >= 0 ? '#047857' : '#dc2626') + ';">' + fmtArs(m.margenRestanteCatActual) + '</div><small>Consumido: ' + m.pctConsumidoCatActual + '% del tope</small></div>' +
          '<div class="mc-kpi"><div class="mc-kpi-lbl">Regla Anti-Exclusión (Compras/Ventas)</div><div class="mc-kpi-val" style="color:' + (m.alertaExclusionCompras ? '#dc2626' : '#047857') + ';">' + m.ratioComprasGastosSobreVentasPct + '%</div><small>Límite legal: ' + m.limiteLegalComprasPct + '%</small></div>' +
        '</div>' +

        '<div class="mc-card">' +
          '<h4 style="margin-top:0;">📏 Consumo del Tope de tu Categoría Actual (' + esc(m.categoriaActual) + ')</h4>' +
          '<div class="mc-bar-track"><div class="mc-bar-fill" style="width:' + Math.min(100, m.pctConsumidoCatActual) + '%;background:' + barColor + ';"></div></div>' +
          '<div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-top:0.4rem;font-weight:700;">' +
            '<span>Facturado 12m: ' + fmtArs(m.facturacion12Meses) + '</span>' +
            '<span>Tope Cat. ' + esc(m.categoriaActual) + ': ' + fmtArs(m.topeCategoriaActual) + ' (' + m.pctConsumidoCatActual + '%)</span>' +
          '</div>' +
        '</div>' +

        '<div class="mc-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">' +
            '<div><h4 style="margin:0;">📋 Tabla Editable de Categorías de Monotributo ARCA (A a K)</h4><small style="color:#64748b;">Cuando ARCA actualice las escalas semestralmente, podés editar los topes y cuotas aquí mismo.</small></div>' +
            '<button type="button" class="mc-btn" id="mc-save-escalas-btn">💾 Guardar Escalas Actualizadas</button>' +
          '</div>' +
          '<div style="overflow-x:auto;"><table class="mc-table"><thead><tr><th>Categoría</th><th>Tope Ingresos Anual (ARS)</th><th>Cuota Mensual Bienes</th><th>Cuota Mensual Servicios</th></tr></thead><tbody>' + escalasRows + '</tbody></table></div>' +
        '</div>' +
      '</div>'
    );
  }

  // ==================== 4. COMPRAS, GASTOS, RETIROS Y RETENCIONES ====================
  function renderGastosRetirosView() {
    var d = STATE.data;
    if (!d) return '<div class="mc-card">Cargando registros...</div>';
    var compras = (d.compras || []).filter(function (c) { return c.periodo === STATE.periodo; });
    var grs = (d.gastosRetiros || []).filter(function (g) { return g.periodo === STATE.periodo; });
    var rets = (d.retenciones || []).filter(function (r) { return r.periodo === STATE.periodo; });

    return (
      '<div style="display:grid;gap:1rem;">' +
        // Compras (Crédito Fiscal F.2051 / F.2083)
        '<div class="mc-card">' +
          '<h4 style="margin-top:0;">🧾 Cargar Factura de Compra (Alimenta Crédito Fiscal F.2051 y Libro IVA F.2083)</h4>' +
          '<form id="mc-compra-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:0.55rem;align-items:end;">' +
            '<div><label class="mc-label">Fecha</label><input type="date" class="mc-input" id="cmp-fecha" required value="' + todayIso() + '"></div>' +
            '<div><label class="mc-label">Tipo</label><select class="mc-select" id="cmp-tipo"><option value="FA">Factura A</option><option value="FB">Factura B</option><option value="FC">Factura C</option><option value="NCA">Nota Crédito A</option><option value="TICKET_A">Ticket A</option></select></div>' +
            '<div><label class="mc-label">Pto. Vta.</label><input class="mc-input" id="cmp-pv" value="0001"></div>' +
            '<div><label class="mc-label">Número</label><input class="mc-input" id="cmp-nro" placeholder="00012345" required></div>' +
            '<div><label class="mc-label">CUIT Proveedor</label><input class="mc-input" id="cmp-cuit" placeholder="30-12345678-9" required></div>' +
            '<div><label class="mc-label">Razón Social</label><input class="mc-input" id="cmp-rs" placeholder="Distribuidora S.A." required></div>' +
            '<div><label class="mc-label">Neto Grav. 21%</label><input type="number" step="0.01" min="0" class="mc-input" id="cmp-n21" value="0"></div>' +
            '<div><label class="mc-label">Neto Grav. 10,5%</label><input type="number" step="0.01" min="0" class="mc-input" id="cmp-n105" value="0"></div>' +
            '<div><label class="mc-label">Exento / No Grav.</label><input type="number" step="0.01" min="0" class="mc-input" id="cmp-ex" value="0"></div>' +
            '<div><label class="mc-label">Perc. IVA</label><input type="number" step="0.01" min="0" class="mc-input" id="cmp-piva" value="0"></div>' +
            '<div><label class="mc-label">Perc. IIBB</label><input type="number" step="0.01" min="0" class="mc-input" id="cmp-piibb" value="0"></div>' +
            '<div><button type="submit" class="mc-btn" style="width:100%;">+ Agregar Compra</button></div>' +
          '</form>' +
          '<div style="overflow-x:auto;margin-top:0.8rem;"><table class="mc-table"><thead><tr><th>Fecha</th><th>Comprobante</th><th>Proveedor</th><th>Neto</th><th>IVA Crédito</th><th>Perc.</th><th>Total</th><th></th></tr></thead><tbody>' +
            (compras.length === 0 ? '<tr><td colspan="8" style="text-align:center;color:#64748b;">Sin compras cargadas en ' + esc(STATE.periodo) + '.</td></tr>' :
              compras.map(function (c) {
                return '<tr><td>' + esc(c.fecha) + '</td><td><strong>' + esc(c.tipoComprobante + ' ' + c.puntoVenta + '-' + c.numero) + '</strong></td><td>' + esc(c.razonSocialProveedor) + '<br><small>' + esc(c.cuitProveedor) + '</small></td><td>' + fmtArs2(c.netoGravado21 + c.netoGravado105 + c.netoGravado27) + '</td><td style="color:#047857;font-weight:800;">' + fmtArs2(c.ivaTotal) + '</td><td>' + fmtArs2(c.percepcionIva + c.percepcionIibb) + '</td><td><strong>' + fmtArs2(c.total) + '</strong></td><td><button type="button" class="mc-btn mc-btn--outline" style="padding:0.2rem 0.5rem;color:#dc2626;" data-del-cmp="' + esc(c.id) + '">🗑</button></td></tr>';
              }).join('')) +
          '</tbody></table></div>' +
        '</div>' +

        // Gastos Operativos y Retiros Diarios
        '<div class="mc-card">' +
          '<h4 style="margin-top:0;">💸 Gastos Operativos y Retiros Diarios del Titular</h4>' +
          '<form id="mc-gr-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.55rem;align-items:end;">' +
            '<div><label class="mc-label">Fecha</label><input type="date" class="mc-input" id="gr-fecha" required value="' + todayIso() + '"></div>' +
            '<div><label class="mc-label">Tipo</label><select class="mc-select" id="gr-tipo"><option value="GASTO">Gasto Operativo</option><option value="RETIRO_TITULAR">Retiro Diario / Titular</option></select></div>' +
            '<div><label class="mc-label">Categoría</label><select class="mc-select" id="gr-cat">' + GASTOS_CATS.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="mc-label">Descripción</label><input class="mc-input" id="gr-desc" placeholder="Ej: Alquiler local / Retiro efectivo" required></div>' +
            '<div><label class="mc-label">Medio Pago</label><select class="mc-select" id="gr-mp"><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="DEBITO">Débito</option><option value="QR_MP">Mercado Pago / QR</option></select></div>' +
            '<div><label class="mc-label">Monto (ARS)</label><input type="number" step="0.01" min="1" class="mc-input" id="gr-monto" required></div>' +
            '<div style="padding-bottom:0.35rem;"><label style="font-size:0.78rem;font-weight:700;"><input type="checkbox" id="gr-fijo" checked> Gasto Fijo (Break-even)</label></div>' +
            '<div><button type="submit" class="mc-btn" style="width:100%;">+ Registrar</button></div>' +
          '</form>' +
          '<div style="overflow-x:auto;margin-top:0.8rem;"><table class="mc-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría / Detalle</th><th>Medio</th><th>Monto</th><th></th></tr></thead><tbody>' +
            (grs.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#64748b;">Sin gastos ni retiros manuales en ' + esc(STATE.periodo) + '.</td></tr>' :
              grs.map(function (g) {
                return '<tr><td>' + esc(g.fecha) + '</td><td><span class="mc-badge" style="background:' + (g.tipo === 'RETIRO_TITULAR' ? '#fef3c7;color:#92400e;' : '#e2e8f0;color:#112D3A;') + '">' + (g.tipo === 'RETIRO_TITULAR' ? 'RETIRO' : 'GASTO') + '</span></td><td><strong>' + esc(g.categoria) + '</strong> · ' + esc(g.descripcion) + '</td><td>' + esc(g.medioPago) + '</td><td><strong>' + fmtArs(g.monto) + '</strong></td><td><button type="button" class="mc-btn mc-btn--outline" style="padding:0.2rem 0.5rem;color:#dc2626;" data-del-gr="' + esc(g.id) + '">🗑</button></td></tr>';
              }).join('')) +
          '</tbody></table></div>' +
        '</div>' +

        // Retenciones y Percepciones (SIRCREB / Tarjetas)
        '<div class="mc-card">' +
          '<h4 style="margin-top:0;">🏦 Retenciones y Percepciones Sufridas (SIRCREB Córdoba · Tarjetas · Mercado Pago)</h4>' +
          '<form id="mc-ret-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.55rem;align-items:end;">' +
            '<div><label class="mc-label">Fecha</label><input type="date" class="mc-input" id="ret-fecha" required value="' + todayIso() + '"></div>' +
            '<div><label class="mc-label">Impuesto</label><select class="mc-select" id="ret-imp"><option value="IIBB_CORDOBA">IIBB Córdoba (F.5663)</option><option value="IVA">IVA (F.2051)</option></select></div>' +
            '<div><label class="mc-label">Origen</label><select class="mc-select" id="ret-ori"><option value="SIRCREB">SIRCREB Bancario</option><option value="TARJETAS">Liquidación Tarjetas</option><option value="MERCADO_PAGO">Mercado Pago</option><option value="PROVEEDOR">Proveedor</option><option value="CLIENTE">Cliente</option></select></div>' +
            '<div><label class="mc-label">Referencia / Certificado</label><input class="mc-input" id="ret-ref" placeholder="Extracto / Cert. N°"></div>' +
            '<div><label class="mc-label">Monto (ARS)</label><input type="number" step="0.01" min="1" class="mc-input" id="ret-monto" required></div>' +
            '<div><button type="submit" class="mc-btn" style="width:100%;">+ Cargar Retención</button></div>' +
          '</form>' +
          '<div style="overflow-x:auto;margin-top:0.8rem;"><table class="mc-table"><thead><tr><th>Fecha</th><th>Impuesto</th><th>Origen</th><th>Referencia</th><th>Monto</th><th></th></tr></thead><tbody>' +
            (rets.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#64748b;">Sin retenciones/SIRCREB cargadas en ' + esc(STATE.periodo) + '.</td></tr>' :
              rets.map(function (r) {
                return '<tr><td>' + esc(r.fecha) + '</td><td><strong>' + esc(r.impuesto) + '</strong></td><td>' + esc(r.origen) + '</td><td>' + esc(r.comprobanteRef || '—') + '</td><td style="color:#0369a1;font-weight:800;">' + fmtArs2(r.monto) + '</td><td><button type="button" class="mc-btn mc-btn--outline" style="padding:0.2rem 0.5rem;color:#dc2626;" data-del-ret="' + esc(r.id) + '">🗑</button></td></tr>';
              }).join('')) +
          '</tbody></table></div>' +
        '</div>' +
      '</div>'
    );
  }

  // ==================== 5. INTELIGENCIA DE STOCK, VENTAS Y FINANZAS ====================
  function renderFinanzasStockView() {
    var a = STATE.analytics;
    if (!a) return '<div class="mc-card">Cargando analítica...</div>';
    var v = a.ventas;
    var f = a.finanzas;
    var inv = a.inventario;

    // Simulador financiero
    var extraPrecio = v.totalPeriodo * (STATE.simPrecioDeltaPct / 100);
    var extraCajaStockMuerto = inv.stockMuertoValorVenta * (STATE.simLiquidarMuertoPct / 100) * 0.8; // 20% off promo
    var ahorroRetiros = f.retirosTotalesPeriodo * (STATE.simReducirRetirosPct / 100);
    var impactoTotalCaja = extraPrecio + extraCajaStockMuerto + ahorroRetiros;

    return (
      '<div style="display:grid;gap:1rem;">' +
        // Ventas Contado vs Cta Cte & Efectivo vs Bancarizado
        '<div class="mc-grid-2">' +
          '<div class="mc-card">' +
            '<h4 style="margin-top:0;">💵 Contado vs. Cuenta Corriente (' + esc(a.periodo) + ')</h4>' +
            '<div style="display:flex;justify-content:space-between;font-size:0.85rem;font-weight:800;margin-bottom:0.35rem;">' +
              '<span>Contado: ' + fmtArs(v.contado) + ' (' + v.pctContado + '%)</span>' +
              '<span>Cta. Cte.: ' + fmtArs(v.ctaCte) + ' (' + v.pctCtaCte + '%)</span>' +
            '</div>' +
            '<div class="mc-bar-track"><div class="mc-bar-fill" style="width:' + v.pctContado + '%;background:#10b981;"></div></div>' +
            '<div style="margin-top:0.8rem;font-size:0.82rem;"><strong>Total a cobrar en Cuentas Corrientes Clientes:</strong> <span style="color:#b45309;font-weight:900;">' + fmtArs(f.saldoACobrarClientes) + '</span> · <strong>Deuda Proveedores:</strong> ' + fmtArs(f.deudaProveedores) + '</div>' +
          '</div>' +
          '<div class="mc-card">' +
            '<h4 style="margin-top:0;">🏦 Efectivo vs. Bancarizado (sobre Ventas Contado)</h4>' +
            '<div style="display:flex;justify-content:space-between;font-size:0.85rem;font-weight:800;margin-bottom:0.35rem;">' +
              '<span>Efectivo: ' + fmtArs(v.efectivo) + ' (' + v.pctEfectivo + '%)</span>' +
              '<span>Bancarizado: ' + fmtArs(v.bancarizado) + ' (' + v.pctBancarizado + '%)</span>' +
            '</div>' +
            '<div class="mc-bar-track"><div class="mc-bar-fill" style="width:' + v.pctEfectivo + '%;background:#0284c7;"></div></div>' +
            '<div style="margin-top:0.75rem;display:flex;flex-wrap:wrap;gap:0.35rem;">' +
              (v.mediosDesglose || []).map(function (md) {
                return '<span class="mc-badge" style="background:#f1f5f9;color:#112D3A;">' + esc(md.label) + ': ' + fmtArs(md.total) + '</span>';
              }).join('') +
            '</div>' +
          '</div>' +
        '</div>' +

        // Punto de Equilibrio + Capital de Trabajo + Simulador "¿Qué pasa si...?"
        '<div class="mc-card">' +
          '<h4 style="margin-top:0;">⚖️ Herramientas Financieras: Punto de Equilibrio y Simulador de Decisiones</h4>' +
          '<div class="mc-grid" style="margin-bottom:0.9rem;">' +
            '<div class="mc-kpi"><div class="mc-kpi-lbl">Punto de Equilibrio Mensual</div><div class="mc-kpi-val">' + fmtArs(f.puntoEquilibrioMensual) + '</div><small>Diario (26 días): ' + fmtArs(f.puntoEquilibrioDiario) + ' · Cubierto: ' + f.pctEquilibrioAlcanzado + '%</small></div>' +
            '<div class="mc-kpi"><div class="mc-kpi-lbl">Liquidez Inmediata (Caja + Bancos)</div><div class="mc-kpi-val">' + fmtArs(f.liquidezInmediata) + '</div><small>Capital de trabajo neto: ' + fmtArs(f.capitalTrabajoNeto) + '</small></div>' +
            '<div class="mc-kpi"><div class="mc-kpi-lbl">Stock Valorizado (a Costo)</div><div class="mc-kpi-val">' + fmtArs(inv.stockValorizadoCostoTotal) + '</div><small>A venta: ' + fmtArs(inv.stockValorizadoVentaTotal) + '</small></div>' +
          '</div>' +
          '<div style="background:#f8fbfc;border:1px solid #dbe7ec;border-radius:12px;padding:0.85rem;">' +
            '<strong style="font-size:0.84rem;">🔮 Simulador "¿Qué pasa si...?" (Impacto estimado en Caja del Mes):</strong>' +
            '<div class="mc-grid" style="margin-top:0.6rem;">' +
              '<div><label class="mc-label">Ajustar Precios/Margen (+' + STATE.simPrecioDeltaPct + '%)</label><input type="range" min="-10" max="25" id="sim-precio" value="' + STATE.simPrecioDeltaPct + '" style="width:100%;"></div>' +
              '<div><label class="mc-label">Liquidar Stock Muerto (' + STATE.simLiquidarMuertoPct + '% con 20% OFF)</label><input type="range" min="0" max="100" step="5" id="sim-muerto" value="' + STATE.simLiquidarMuertoPct + '" style="width:100%;"></div>' +
              '<div><label class="mc-label">Optimizar Retiros (-' + STATE.simReducirRetirosPct + '%)</label><input type="range" min="0" max="50" step="5" id="sim-ret" value="' + STATE.simReducirRetirosPct + '" style="width:100%;"></div>' +
            '</div>' +
            '<div style="margin-top:0.65rem;font-size:0.86rem;font-weight:800;color:#047857;">👉 Recuperación / Mejora proyectada de Caja: +' + fmtArs(impactoTotalCaja) + ' <small style="color:#475569;font-weight:600;">(Precios: ' + fmtArs(extraPrecio) + ' · Stock muerto: ' + fmtArs(extraCajaStockMuerto) + ' · Retiros: ' + fmtArs(ahorroRetiros) + ')</small></div>' +
          '</div>' +
        '</div>' +

        // Detector de Stock Muerto + Alertas de Abastecimiento
        '<div class="mc-grid-2">' +
          '<div class="mc-card">' +
            '<h4 style="margin-top:0;">🧊 Detector de Stock Muerto (60+ días sin ventas · ' + inv.stockMuertoCount + ' art.)</h4>' +
            '<p style="font-size:0.8rem;color:#64748b;margin-top:0;">Capital inmovilizado a costo: <strong style="color:#b45309;">' + fmtArs(inv.stockMuertoCapitalCosto) + '</strong></p>' +
            '<div style="max-height:300px;overflow-y:auto;"><table class="mc-table"><thead><tr><th>Artículo</th><th>Stock</th><th>Costo Inmov.</th></tr></thead><tbody>' +
              ((inv.stockMuertoTop || []).length === 0 ? '<tr><td colspan="3" style="text-align:center;color:#64748b;">✅ Sin stock muerto detectado.</td></tr>' :
                inv.stockMuertoTop.slice(0, 20).map(function (x) {
                  return '<tr><td><strong>' + esc(x.nombre) + '</strong><br><small>' + esc(x.codigo) + '</small></td><td>' + esc(x.stockActual) + '</td><td style="color:#b45309;font-weight:800;">' + fmtArs(x.capitalCostoInmovilizado) + '</td></tr>';
                }).join('')) +
            '</tbody></table></div>' +
          '</div>' +

          '<div class="mc-card">' +
            '<h4 style="margin-top:0;">🚨 Alertas de Abastecimiento / Quiebre (' + inv.alertasAbastecimientoCount + ' art.)</h4>' +
            '<div style="max-height:330px;overflow-y:auto;"><table class="mc-table"><thead><tr><th>Prioridad</th><th>Artículo</th><th>Stock / Mín.</th></tr></thead><tbody>' +
              ((inv.alertasAbastecimiento || []).length === 0 ? '<tr><td colspan="3" style="text-align:center;color:#64748b;">✅ Todo abastecido.</td></tr>' :
                inv.alertasAbastecimiento.slice(0, 20).map(function (x) {
                  var clr = x.prioridad === 'CRITICA' ? '#fee2e2;color:#991b1b;' : '#fef3c7;color:#92400e;';
                  return '<tr><td><span class="mc-badge" style="background:' + clr + '">' + esc(x.prioridad) + '</span></td><td><strong>' + esc(x.nombre) + '</strong><br><small>' + esc(x.codigo) + '</small></td><td><strong>' + esc(x.stockActual) + '</strong> / ' + esc(x.stockMinimo) + '</td></tr>';
                }).join('')) +
            '</tbody></table></div>' +
          '</div>' +
        '</div>' +

        // Rotación ABC
        '<div class="mc-card">' +
          '<h4 style="margin-top:0;">🔄 Rotación de Productos (Análisis ABC · Top ' + (inv.rotacionTop || []).length + ')</h4>' +
          '<div style="overflow-x:auto;max-height:320px;"><table class="mc-table"><thead><tr><th>ABC</th><th>Artículo</th><th>Unidades</th><th>Venta</th><th>Margen $</th><th>Margen %</th><th>Stock Actual</th></tr></thead><tbody>' +
            ((inv.rotacionTop || []).length === 0 ? '<tr><td colspan="7" style="text-align:center;color:#64748b;">Sin movimientos de artículos registrados en ' + esc(a.periodo) + '.</td></tr>' :
              inv.rotacionTop.map(function (x) {
                var bClr = x.claseAbc === 'A' ? '#dcfce7;color:#065f46;' : x.claseAbc === 'B' ? '#e0f2fe;color:#075985;' : '#f1f5f9;color:#475569;';
                return '<tr><td><span class="mc-badge" style="background:' + bClr + '">' + esc(x.claseAbc) + '</span></td><td><strong>' + esc(x.nombre) + '</strong></td><td>' + esc(x.unidades) + '</td><td><strong>' + fmtArs(x.venta) + '</strong></td><td style="color:#047857;font-weight:700;">' + fmtArs(x.margenArs) + '</td><td>' + esc(x.margenPct) + '%</td><td>' + esc(x.stockActual) + '</td></tr>';
              }).join('')) +
          '</tbody></table></div>' +
        '</div>' +
      '</div>'
    );
  }

  // ==================== 6. CONFIGURACIÓN FISCAL Y CALENDARIO ====================
  function renderConfigView() {
    var d = STATE.data;
    var a = STATE.analytics;
    if (!d || !a) return '<div class="mc-card">Cargando configuración...</div>';
    var cfg = d.fiscalConfig || {};
    var cal = a.arca.calendario || { vencimientos: [] };

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="mc-card">' +
          '<h4 style="margin-top:0;">⚙️ Parámetros Fiscales ARCA e IIBB Córdoba</h4>' +
          '<form id="mc-cfg-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.7rem;">' +
            '<div><label class="mc-label">Condición Fiscal</label><select class="mc-select" id="cfg-cond">' +
              '<option value="RI" ' + (cfg.condicionFiscal === 'RI' ? 'selected' : '') + '>Responsable Inscripto (RI)</option>' +
              '<option value="MONOTRIBUTO" ' + (cfg.condicionFiscal === 'MONOTRIBUTO' ? 'selected' : '') + '>Monotributista</option>' +
              '<option value="EXENTO" ' + (cfg.condicionFiscal === 'EXENTO' ? 'selected' : '') + '>Exento</option>' +
            '</select></div>' +
            '<div><label class="mc-label">CUIT del Contribuyente</label><input class="mc-input" id="cfg-cuit" value="' + esc(cfg.cuit || '') + '" placeholder="20-12345678-9"></div>' +
            '<div><label class="mc-label">Razón Social / Titular</label><input class="mc-input" id="cfg-rs" value="' + esc(cfg.razonSocial || '') + '"></div>' +
            '<div><label class="mc-label">Jurisdicción IIBB</label><input class="mc-input" id="cfg-jur" value="' + esc(cfg.jurisdiccionIibb || 'CÓRDOBA') + '"></div>' +
            '<div><label class="mc-label">Alícuota IIBB F.5663 (%)</label><input type="number" step="0.01" class="mc-input" id="cfg-iibb" value="' + esc(cfg.alicuotaIibbPct != null ? cfg.alicuotaIibbPct : 3.0) + '"></div>' +
            '<div><label class="mc-label">Categoría Monotributo Actual</label><select class="mc-select" id="cfg-cat">' +
              ['A','B','C','D','E','F','G','H','I','J','K'].map(function (c) { return '<option value="' + c + '" ' + (cfg.categoriaMonotributoActual === c ? 'selected' : '') + '>Categoría ' + c + '</option>'; }).join('') +
            '</select></div>' +
            '<div><label class="mc-label">Actividad Monotributo</label><select class="mc-select" id="cfg-act-m">' +
              '<option value="VENTA_COSAS_MUEBLES" ' + (cfg.tipoActividadMonotributo !== 'SERVICIOS' ? 'selected' : '') + '>Venta de Cosas Muebles (Tope 80%)</option>' +
              '<option value="SERVICIOS" ' + (cfg.tipoActividadMonotributo === 'SERVICIOS' ? 'selected' : '') + '>Locación / Servicios (Tope 40%)</option>' +
            '</select></div>' +
            '<div><label class="mc-label">Saldo Técnico IVA Anterior</label><input type="number" step="0.01" class="mc-input" id="cfg-st-iva" value="' + esc(cfg.saldoTecnicoIvaAnterior || 0) + '"></div>' +
            '<div><label class="mc-label">Saldo Libre Disp. IVA Anterior</label><input type="number" step="0.01" class="mc-input" id="cfg-sld-iva" value="' + esc(cfg.saldoLibreDispIvaAnterior || 0) + '"></div>' +
            '<div><label class="mc-label">Saldo a Favor IIBB Anterior</label><input type="number" step="0.01" class="mc-input" id="cfg-sf-iibb" value="' + esc(cfg.saldoFavorIibbAnterior || 0) + '"></div>' +
            '<div><label class="mc-label">Gastos Fijos Base Mensuales (Break-even)</label><input type="number" step="1" class="mc-input" id="cfg-gfijos" value="' + esc(cfg.gastosFijosMensualesBase || 0) + '"></div>' +
            '<div><label class="mc-label">CUIT Delegado Oficial ARCA (Opcional)</label><input class="mc-input" id="cfg-del-cuit" value="' + esc(cfg.cuitDelegadoArca || '') + '" placeholder="Sin guardar Clave Fiscal"></div>' +
            '<div style="grid-column:1/-1;"><button type="submit" class="mc-btn">💾 Guardar Configuración Fiscal</button></div>' +
          '</form>' +
        '</div>' +

        '<div class="mc-card">' +
          '<h4 style="margin-top:0;">📅 Calendario Fiscal ARCA (Terminación CUIT: ' + esc(cal.cuitTerminacion) + ' · Período ' + esc(a.periodo) + ')</h4>' +
          '<div style="overflow-x:auto;"><table class="mc-table"><thead><tr><th>Formulario</th><th>Obligación</th><th>Vencimiento Est.</th><th>Aplica a</th><th>Portal ARCA</th></tr></thead><tbody>' +
            (cal.vencimientos || []).map(function (v) {
              return '<tr><td><strong>' + esc(v.formulario) + '</strong></td><td>' + esc(v.nombre) + '</td><td><strong>' + esc(v.fechaEstimada) + '</strong></td><td>' + esc(v.aplica) + '</td><td><small>' + esc(v.portal) + '</small></td></tr>';
            }).join('') +
          '</tbody></table></div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderWorkspace() {
    var body = document.getElementById('ms-mc-body');
    if (!body) return;
    switch (STATE.activeView) {
      case 'ia': body.innerHTML = renderIaView(); break;
      case 'arca_ri': body.innerHTML = renderArcaRiView(); break;
      case 'monotributo': body.innerHTML = renderMonotributoView(); break;
      case 'gastos_retiros': body.innerHTML = renderGastosRetirosView(); break;
      case 'finanzas_stock': body.innerHTML = renderFinanzasStockView(); break;
      case 'config': body.innerHTML = renderConfigView(); break;
    }
    bindWorkspaceEvents(body);
  }

  async function askAiQuestion(qText) {
    var clean = String(qText || '').trim();
    if (!clean || STATE.chatLoading) return;
    STATE.chatHistory.push({ role: 'user', text: clean });
    STATE.chatLoading = true;
    renderWorkspace();
    try {
      var res = await apiMc('POST', { action: 'ask_ai', periodo: STATE.periodo, question: clean });
      STATE.chatHistory.push({
        role: 'ai',
        source: (res && res.source) || 'CFO',
        text: (res && res.ok && res.answer) ? res.answer : ((res && res.message) || 'No se pudo procesar la consulta.')
      });
    } catch (_e) {
      STATE.chatHistory.push({ role: 'ai', source: 'error', text: 'Error de conexión al consultar Mi Contador IA.' });
    } finally {
      STATE.chatLoading = false;
      renderWorkspace();
      var box = document.getElementById('mc-chat-box');
      if (box) box.scrollTop = box.scrollHeight;
    }
  }

  function bindWorkspaceEvents(body) {
    // Chat IA
    var chatForm = body.querySelector('#mc-chat-form');
    if (chatForm) {
      chatForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var inp = body.querySelector('#mc-chat-inp');
        if (inp) askAiQuestion(inp.value);
      });
    }
    body.querySelectorAll('[data-mc-quick-q]').forEach(function (b) {
      b.addEventListener('click', function () { askAiQuestion(b.getAttribute('data-mc-quick-q')); });
    });

    // Copiar valores ARCA
    body.querySelectorAll('[data-copy-val]').forEach(function (b) {
      b.addEventListener('click', function () {
        var val = b.getAttribute('data-copy-val') || '0';
        if (navigator.clipboard) {
          navigator.clipboard.writeText(val);
          showToast('Valor copiado: ' + val, false);
        }
      });
    });

    // Exportar archivos TXT oficiales F.2083
    body.querySelectorAll('[data-dl-f2083]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var which = b.getAttribute('data-dl-f2083');
        var res = await apiMc('GET', { action: 'export_f2083', periodo: STATE.periodo });
        if (!res || !res.ok || !res.files) {
          showToast('No se pudieron generar los archivos F.2083.', true);
          return;
        }
        var map = {
          ventas_cbte: ['LIBRO_IVA_DIGITAL_VENTAS_CBTE_' + STATE.periodo + '.txt', res.files.ventasCbteTxt],
          ventas_alic: ['LIBRO_IVA_DIGITAL_VENTAS_ALICUOTAS_' + STATE.periodo + '.txt', res.files.ventasAlicuotasTxt],
          compras_cbte: ['LIBRO_IVA_DIGITAL_COMPRAS_CBTE_' + STATE.periodo + '.txt', res.files.comprasCbteTxt],
          compras_alic: ['LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS_' + STATE.periodo + '.txt', res.files.comprasAlicuotasTxt]
        };
        var item = map[which];
        if (item) {
          downloadTextFile(item[0], item[1], 'text/plain;charset=utf-8');
          showToast('Archivo oficial ARCA descargado: ' + item[0], false);
        }
      });
    });

    // Exportar planilla F.5663 CSV
    var dl5663 = body.querySelector('#mc-dl-f5663-csv');
    if (dl5663 && STATE.analytics) {
      dl5663.addEventListener('click', function () {
        var f = STATE.analytics.arca.f5663;
        var csv = [
          'Campo,Valor',
          'Formulario,F.5663 - Ingresos Brutos Locales Cordoba (SIFERE Locales)',
          'Periodo,' + f.periodo,
          'Jurisdiccion,' + f.jurisdiccion,
          'Base Imponible Neta,' + f.baseImponible,
          'Alicuota %,' + f.alicuotaPct,
          'Impuesto Determinado,' + f.impuestoDeterminado,
          'Retenciones y Percepciones / SIRCREB,' + f.retencionesPercepcionesTotal,
          'Saldo a Favor Anterior,' + f.saldoFavorAnterior,
          'Saldo a Pagar F.5663,' + f.saldoAPagar,
          'Saldo a Favor Siguiente,' + f.saldoFavorSiguiente
        ].join('\n');
        downloadTextFile('F5663_IIBB_CORDOBA_' + f.periodo + '.csv', csv, 'text/csv;charset=utf-8');
        showToast('Planilla F.5663 descargada.', false);
      });
    }

    // Marcar presentación ARCA
    body.querySelectorAll('[data-mark-pres]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var form = b.getAttribute('data-mark-pres');
        var amt = Number(b.getAttribute('data-pres-amt') || 0);
        var nro = window.prompt('Ingresá el N° de Transacción / Acuse de ARCA para ' + form + ' (opcional):', '');
        if (nro === null) return;
        var res = await apiMc('POST', {
          action: 'save_presentacion',
          periodo: STATE.periodo,
          presentacion: { formulario: form, periodo: STATE.periodo, estado: 'PRESENTADA', montoDeterminado: amt, nroTransaccionArca: nro }
        });
        if (res && res.ok) { STATE.data = res.data; STATE.analytics = res.analytics; showToast(res.message, false); renderWorkspace(); }
      });
    });

    // Guardar escalas Monotributo
    var saveEscBtn = body.querySelector('#mc-save-escalas-btn');
    if (saveEscBtn) {
      saveEscBtn.addEventListener('click', async function () {
        var escalas = (STATE.data.monotributoEscalas || []).map(function (e, idx) {
          var tEl = body.querySelector('.mc-esc-tope[data-idx="' + idx + '"]');
          var bEl = body.querySelector('.mc-esc-bienes[data-idx="' + idx + '"]');
          var sEl = body.querySelector('.mc-esc-serv[data-idx="' + idx + '"]');
          return {
            categoria: e.categoria,
            topeIngresosAnualArs: Number(tEl ? tEl.value : e.topeIngresosAnualArs),
            cuotaMensualBienesArs: Number(bEl ? bEl.value : e.cuotaMensualBienesArs),
            cuotaMensualServiciosArs: Number(sEl ? sEl.value : e.cuotaMensualServiciosArs)
          };
        });
        var res = await apiMc('POST', { action: 'save_monotributo_escalas', periodo: STATE.periodo, escalas: escalas });
        if (res && res.ok) { STATE.data = res.data; STATE.analytics = res.analytics; showToast(res.message, false); renderWorkspace(); }
      });
    }

    // Compras / Gastos / Retenciones
    var cmpForm = body.querySelector('#mc-compra-form');
    if (cmpForm) {
      cmpForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiMc('POST', {
          action: 'save_compra',
          periodo: STATE.periodo,
          compra: {
            fecha: body.querySelector('#cmp-fecha').value,
            tipoComprobante: body.querySelector('#cmp-tipo').value,
            puntoVenta: body.querySelector('#cmp-pv').value,
            numero: body.querySelector('#cmp-nro').value,
            cuitProveedor: body.querySelector('#cmp-cuit').value,
            razonSocialProveedor: body.querySelector('#cmp-rs').value,
            netoGravado21: Number(body.querySelector('#cmp-n21').value || 0),
            netoGravado105: Number(body.querySelector('#cmp-n105').value || 0),
            exentoNoGravado: Number(body.querySelector('#cmp-ex').value || 0),
            percepcionIva: Number(body.querySelector('#cmp-piva').value || 0),
            percepcionIibb: Number(body.querySelector('#cmp-piibb').value || 0)
          }
        });
        if (res && res.ok) { STATE.data = res.data; STATE.analytics = res.analytics; showToast(res.message, false); renderWorkspace(); }
        else showToast((res && res.message) || 'Error guardando compra.', true);
      });
    }
    body.querySelectorAll('[data-del-cmp]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiMc('POST', { action: 'delete_compra', periodo: STATE.periodo, id: b.getAttribute('data-del-cmp') });
        if (res && res.ok) { STATE.data = res.data; STATE.analytics = res.analytics; renderWorkspace(); }
      });
    });

    var grForm = body.querySelector('#mc-gr-form');
    if (grForm) {
      grForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiMc('POST', {
          action: 'save_gasto_retiro',
          periodo: STATE.periodo,
          item: {
            fecha: body.querySelector('#gr-fecha').value,
            tipo: body.querySelector('#gr-tipo').value,
            categoria: body.querySelector('#gr-cat').value,
            descripcion: body.querySelector('#gr-desc').value,
            medioPago: body.querySelector('#gr-mp').value,
            monto: Number(body.querySelector('#gr-monto').value || 0),
            esFijo: body.querySelector('#gr-fijo').checked
          }
        });
        if (res && res.ok) { STATE.data = res.data; STATE.analytics = res.analytics; showToast(res.message, false); renderWorkspace(); }
        else showToast((res && res.message) || 'Error guardando registro.', true);
      });
    }
    body.querySelectorAll('[data-del-gr]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiMc('POST', { action: 'delete_gasto_retiro', periodo: STATE.periodo, id: b.getAttribute('data-del-gr') });
        if (res && res.ok) { STATE.data = res.data; STATE.analytics = res.analytics; renderWorkspace(); }
      });
    });

    var retForm = body.querySelector('#mc-ret-form');
    if (retForm) {
      retForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiMc('POST', {
          action: 'save_retencion',
          periodo: STATE.periodo,
          retencion: {
            fecha: body.querySelector('#ret-fecha').value,
            impuesto: body.querySelector('#ret-imp').value,
            origen: body.querySelector('#ret-ori').value,
            comprobanteRef: body.querySelector('#ret-ref').value,
            monto: Number(body.querySelector('#ret-monto').value || 0)
          }
        });
        if (res && res.ok) { STATE.data = res.data; STATE.analytics = res.analytics; showToast(res.message, false); renderWorkspace(); }
        else showToast((res && res.message) || 'Error guardando retención.', true);
      });
    }
    body.querySelectorAll('[data-del-ret]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiMc('POST', { action: 'delete_retencion', periodo: STATE.periodo, id: b.getAttribute('data-del-ret') });
        if (res && res.ok) { STATE.data = res.data; STATE.analytics = res.analytics; renderWorkspace(); }
      });
    });

    // Simulador sliders
    ['#sim-precio', '#sim-muerto', '#sim-ret'].forEach(function (sel) {
      var el = body.querySelector(sel);
      if (!el) return;
      el.addEventListener('input', function () {
        if (sel === '#sim-precio') STATE.simPrecioDeltaPct = Number(el.value);
        if (sel === '#sim-muerto') STATE.simLiquidarMuertoPct = Number(el.value);
        if (sel === '#sim-ret') STATE.simReducirRetirosPct = Number(el.value);
        renderWorkspace();
      });
    });

    // Config fiscal
    var cfgForm = body.querySelector('#mc-cfg-form');
    if (cfgForm) {
      cfgForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiMc('POST', {
          action: 'save_fiscal_config',
          periodo: STATE.periodo,
          fiscalConfig: {
            condicionFiscal: body.querySelector('#cfg-cond').value,
            cuit: body.querySelector('#cfg-cuit').value,
            razonSocial: body.querySelector('#cfg-rs').value,
            jurisdiccionIibb: body.querySelector('#cfg-jur').value,
            alicuotaIibbPct: Number(body.querySelector('#cfg-iibb').value || 3.0),
            categoriaMonotributoActual: body.querySelector('#cfg-cat').value,
            tipoActividadMonotributo: body.querySelector('#cfg-act-m').value,
            saldoTecnicoIvaAnterior: Number(body.querySelector('#cfg-st-iva').value || 0),
            saldoLibreDispIvaAnterior: Number(body.querySelector('#cfg-sld-iva').value || 0),
            saldoFavorIibbAnterior: Number(body.querySelector('#cfg-sf-iibb').value || 0),
            gastosFijosMensualesBase: Number(body.querySelector('#cfg-gfijos').value || 0),
            cuitDelegadoArca: body.querySelector('#cfg-del-cuit').value
          }
        });
        if (res && res.ok) { STATE.data = res.data; STATE.analytics = res.analytics; showToast(res.message, false); renderWorkspace(); }
      });
    }
  }

  function bindGlobalNavReset() {
    if (window.__MS_MC_NAV_BOUND__) return;
    window.__MS_MC_NAV_BOUND__ = true;
    document.addEventListener(
      'click',
      function (ev) {
        var t = ev.target;
        if (!t || typeof t.closest !== 'function') return;
        var navTrigger = t.closest('#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-cv-home-card, #ms-personal-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card');
        if (navTrigger) {
          var m = document.getElementById('sec-menu-micontador');
          var w = document.getElementById('sec-micontador-workspace');
          var isActive = (m && !m.hidden) || (w && !w.hidden);
          if (navTrigger.id === 'btn-topbar-back-facturacion' && isActive) {
            ev.preventDefault();
            ev.stopPropagation();
            if (w && !w.hidden) openMcView('menu');
            else closeToHome();
            return;
          }
          if (m) m.hidden = true;
          if (w) w.hidden = true;
        }
      },
      true
    );
  }

  var initialLoaded = false;

  function syncHomeCard() {
    bindGlobalNavReset();
    var allowed = isMiContadorAllowed();
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existingCard = document.getElementById('ms-micontador-home-card');

    if (allowed && inicioGrid && !existingCard) {
      var c = getThemeColors();
      var card = document.createElement('article');
      card.id = 'ms-micontador-home-card';
      card.className = 'module-card';
      card.setAttribute('data-module-key', 'mi_contador');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<rect x="4" y="2" width="16" height="20" rx="2"></rect>' +
            '<line x1="8" y1="6" x2="16" y2="6"></line>' +
            '<line x1="8" y1="10" x2="10" y2="10"></line><line x1="14" y1="10" x2="16" y2="10"></line>' +
            '<line x1="8" y1="14" x2="10" y2="14"></line><line x1="14" y1="14" x2="16" y2="14"></line>' +
            '<line x1="8" y1="18" x2="16" y2="18"></line>' +
          '</svg>' +
        '</div>' +
        '<h3>Mi Contador</h3>';

      card.addEventListener('click', function () { openMcView('menu'); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openMcView('menu'); }
      });

      var perfilCard = inicioGrid.querySelector('[data-module-key="perfil"]');
      if (perfilCard) inicioGrid.insertBefore(card, perfilCard);
      else inicioGrid.appendChild(card);
    } else if (existingCard) {
      existingCard.hidden = !allowed;
      existingCard.style.display = allowed ? '' : 'none';
    }
  }

  setInterval(syncHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncHomeCard);
})();
