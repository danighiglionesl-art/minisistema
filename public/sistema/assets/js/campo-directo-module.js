/* ==========================================================================
   MÓDULO "CAMPO DIRECTO" — MINISISTEMA ERP
   Gestión integral de la App y Ecosistema Campo Directo:
   1. Cotizaciones (Recibidas y Enviadas)
   2. Catálogo de Insumos y Semillas (1.115+ productos)
   3. Fábricas y Laboratorios (44 empresas agropecuarias)
   4. Productores y Establecimientos Agropecuarios
   5. Condiciones y Medios de Pago (Canje Cereal, Tarjetas Agro, Plazos)
   6. Configuración y Conectividad App
   ========================================================================== */
(function () {
  'use strict';

  var STATE = {
    activeSubmodule: 'cotizaciones',
    searchQuery: '',
    filterCategory: '',
    filterStatus: '',
    filterType: '',
    data: {
      cotizaciones: [],
      productos: [],
      empresas: [],
      productores: [],
      condicionesPago: [],
      config: {
        appUrl: 'https://campodirecto.com.ar',
        telefonoSoporte: '+54 9 358 4123456',
        emailSoporte: 'info@campodirecto.com.ar',
        diasValidezCotizacion: 15,
        autoValidarCuitAfip: true,
        notificarWhatsapp: true,
        notificarEmail: true,
        monedaPredeterminada: 'USD'
      }
    },
    // Estado de modales y edición
    editingQuote: null,
    editingProduct: null,
    editingEmpresa: null,
    editingProductor: null,
    viewingQuote: null
  };

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtMoney(num) {
    var n = Number(num) || 0;
    return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function hideAllErpSections() {
    var secs = document.querySelectorAll('.erp-section');
    for (var i = 0; i < secs.length; i++) {
      secs[i].hidden = true;
    }
  }

  function closeToHome() {
    hideAllErpSections();
    var inicio = document.getElementById('sec-inicio');
    if (inicio) inicio.hidden = false;
  }

  function isModuleAllowed() {
    var allowed = window.__ERP_SESSION__ && window.__ERP_SESSION__.modules;
    if (!allowed || !Array.isArray(allowed)) return true;
    var user = (window.__ERP_SESSION__ && window.__ERP_SESSION__.username || '').toLowerCase();
    if (user === 'danielg' || user === 'admin') return true;
    return allowed.indexOf('campo_directo') >= 0 || allowed.indexOf('campodirecto') >= 0;
  }

  /* --------------------------------------------------------------------------
     API CALLS
     -------------------------------------------------------------------------- */
  function fetchCampoDirectoData(callback) {
    fetch('/api/campo-directo', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (res) {
        if (res && res.success && res.data) {
          STATE.data = res.data;
        }
        if (callback) callback();
      })
      .catch(function (err) {
        console.warn('[campo-directo-module] Fallback local data:', err);
        if (callback) callback();
      });
  }

  function postApiAction(action, payload, callback) {
    var body = Object.assign({ action: action }, payload);
    fetch('/api/campo-directo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (callback) callback(data);
      })
      .catch(function (err) {
        console.error('[campo-directo-module] API error:', err);
        if (callback) callback({ success: false, error: err.message });
      });
  }

  /* --------------------------------------------------------------------------
     SECCIÓN 1: INYECCIÓN DE LA TARJETA PRINCIPAL EN #sec-inicio
     -------------------------------------------------------------------------- */
  function injectHomeCard() {
    if (!isModuleAllowed()) return;
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    if (!inicioGrid) return;
    if (document.getElementById('ms-campo-directo-home-card')) return;

    var card = document.createElement('article');
    card.id = 'ms-campo-directo-home-card';
    card.className = 'module-card';
    card.setAttribute('data-module-key', 'campo_directo');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.style.cursor = 'pointer';
    card.innerHTML =
      '<div class="module-icon" aria-hidden="true">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M11 20A7 7 0 0 1 4 13a7 7 0 0 1 7-7 7 7 0 0 1 7 7v7h-7z"></path>' +
          '<path d="M11 13a3 3 0 0 1-3-3 3 3 0 0 1 3-3 3 3 0 0 1 3 3v3h-3z"></path>' +
        '</svg>' +
      '</div>' +
      '<h3>Campo Directo</h3>';

    card.addEventListener('click', function () {
      openModuleMenu();
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModuleMenu();
      }
    });

    // Insertar en la grilla antes de Tema o Perfil si están al final
    var themeCard = document.getElementById('module-card-theme-toggle');
    if (themeCard && themeCard.parentNode === inicioGrid) {
      inicioGrid.insertBefore(card, themeCard);
    } else {
      inicioGrid.appendChild(card);
    }
  }

  /* --------------------------------------------------------------------------
     SECCIÓN 2: MENÚ DE SUBMÓDULOS DE CAMPO DIRECTO
     -------------------------------------------------------------------------- */
  function ensureMenuMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return;

    var menuSec = document.getElementById('sec-menu-campo-directo');
    if (!menuSec) {
      menuSec = document.createElement('section');
      menuSec.id = 'sec-menu-campo-directo';
      menuSec.className = 'erp-section';
      menuSec.hidden = true;
      menuSec.innerHTML =
        '<div class="module-back-bar">' +
          '<button type="button" class="btn-back-home" id="ms-cd-back-home-btn">← Volver a Pantalla Principal</button>' +
          '<span class="module-breadcrumb">ERP en Línea · <strong>Campo Directo</strong></span>' +
        '</div>' +
        '<div class="modules-grid" aria-label="Submódulos de Campo Directo">' +
          '<article class="module-card" role="button" tabindex="0" data-cd-sub="cotizaciones">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
                '<polyline points="14 2 14 8 20 8"></polyline>' +
                '<line x1="16" y1="13" x2="8" y2="13"></line>' +
                '<line x1="16" y1="17" x2="8" y2="17"></line>' +
              '</svg>' +
            '</div>' +
            '<h3>Cotizaciones (Recibidas y Enviadas)</h3>' +
          '</article>' +

          '<article class="module-card" role="button" tabindex="0" data-cd-sub="catalogo">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>' +
                '<line x1="8" y1="21" x2="16" y2="21"></line>' +
                '<line x1="12" y1="17" x2="12" y2="21"></line>' +
              '</svg>' +
            '</div>' +
            '<h3>Catálogo de Insumos y Semillas</h3>' +
          '</article>' +

          '<article class="module-card" role="button" tabindex="0" data-cd-sub="fabricas">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M2 20h20"></path>' +
                '<path d="M6 20V10l10-5v15"></path>' +
                '<path d="M10 14h2"></path>' +
                '<path d="M10 17h2"></path>' +
              '</svg>' +
            '</div>' +
            '<h3>Fábricas y Laboratorios</h3>' +
          '</article>' +

          '<article class="module-card" role="button" tabindex="0" data-cd-sub="productores">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>' +
                '<circle cx="9" cy="7" r="4"></circle>' +
                '<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>' +
                '<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>' +
              '</svg>' +
            '</div>' +
            '<h3>Productores y Establecimientos</h3>' +
          '</article>' +

          '<article class="module-card" role="button" tabindex="0" data-cd-sub="pagos">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>' +
                '<line x1="1" y1="10" x2="23" y2="10"></line>' +
              '</svg>' +
            '</div>' +
            '<h3>Condiciones y Medios de Pago</h3>' +
          '</article>' +

          '<article class="module-card" role="button" tabindex="0" data-cd-sub="config">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<circle cx="12" cy="12" r="3"></circle>' +
                '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' +
              '</svg>' +
            '</div>' +
            '<h3>Configuración y Conectividad App</h3>' +
          '</article>' +
        '</div>';

      erpMain.appendChild(menuSec);

      document.getElementById('ms-cd-back-home-btn').addEventListener('click', closeToHome);

      var subCards = menuSec.querySelectorAll('[data-cd-sub]');
      for (var i = 0; i < subCards.length; i++) {
        (function (el) {
          var subKey = el.getAttribute('data-cd-sub');
          el.addEventListener('click', function () {
            openWorkspace(subKey);
          });
          el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openWorkspace(subKey);
            }
          });
        })(subCards[i]);
      }
    }
  }

  function openModuleMenu() {
    hideAllErpSections();
    ensureMenuMounted();
    var menuSec = document.getElementById('sec-menu-campo-directo');
    if (menuSec) menuSec.hidden = false;
    fetchCampoDirectoData();
  }

  /* --------------------------------------------------------------------------
     SECCIÓN 3: ESPACIO DE TRABAJO (WORKSPACE)
     -------------------------------------------------------------------------- */
  function ensureWorkspaceMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return;

    var workSec = document.getElementById('sec-campo-directo-workspace');
    if (!workSec) {
      workSec = document.createElement('section');
      workSec.id = 'sec-campo-directo-workspace';
      workSec.className = 'erp-section';
      workSec.hidden = true;
      erpMain.appendChild(workSec);
    }
  }

  function getSubmoduleTitle(subKey) {
    var map = {
      cotizaciones: 'Cotizaciones (Recibidas y Enviadas)',
      catalogo: 'Catálogo de Insumos y Semillas',
      fabricas: 'Fábricas y Laboratorios',
      productores: 'Productores y Establecimientos',
      pagos: 'Condiciones y Medios de Pago',
      config: 'Configuración y Conectividad App'
    };
    return map[subKey] || 'Campo Directo';
  }

  function openWorkspace(subKey) {
    STATE.activeSubmodule = subKey || 'cotizaciones';
    hideAllErpSections();
    ensureWorkspaceMounted();
    var workSec = document.getElementById('sec-campo-directo-workspace');
    if (workSec) workSec.hidden = false;
    renderWorkspace();
  }

  function renderWorkspace() {
    var workSec = document.getElementById('sec-campo-directo-workspace');
    if (!workSec) return;

    var subKey = STATE.activeSubmodule;
    var subTitle = getSubmoduleTitle(subKey);

    var html =
      '<div class="module-back-bar">' +
        '<button type="button" class="btn-back-home" id="ms-cd-ws-back-btn">← Volver al Menú Campo Directo</button>' +
        '<span class="module-breadcrumb">Campo Directo · <strong>' + esc(subTitle) + '</strong></span>' +
      '</div>' +

      // Barra de pestañas para navegación rápida
      '<div style="display:flex; gap:8px; overflow-x:auto; padding:12px 0 16px 0; border-bottom:1px solid var(--border-color,#e2e8f0); margin-bottom:20px;">' +
        renderSubTab('cotizaciones', 'Cotizaciones', subKey) +
        renderSubTab('catalogo', 'Catálogo de Insumos', subKey) +
        renderSubTab('fabricas', 'Fábricas (44)', subKey) +
        renderSubTab('productores', 'Productores / Clientes', subKey) +
        renderSubTab('pagos', 'Medios de Pago', subKey) +
        renderSubTab('config', 'Configuración', subKey) +
      '</div>' +

      '<div id="ms-cd-content-area">' +
        renderSubContent(subKey) +
      '</div>';

    workSec.innerHTML = html;

    // Listeners
    document.getElementById('ms-cd-ws-back-btn').addEventListener('click', openModuleMenu);

    var tabs = workSec.querySelectorAll('[data-cd-tab]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        var t = this.getAttribute('data-cd-tab');
        openWorkspace(t);
      });
    }

    bindSubContentEvents(subKey);
  }

  function renderSubTab(key, label, activeKey) {
    var isActive = key === activeKey;
    var bg = isActive ? 'background:var(--color-primary,#059669); color:#fff; font-weight:700;' : 'background:var(--card-bg,#f8fafc); color:var(--text-color,#334155);';
    return (
      '<button type="button" data-cd-tab="' + key + '" style="padding:7px 14px; font-size:12px; border-radius:8px; border:1px solid var(--border-color,#cbd5e1); cursor:pointer; white-space:nowrap; transition:all 0.15s ease; ' + bg + '">' +
        esc(label) +
      '</button>'
    );
  }

  function renderSubContent(subKey) {
    if (subKey === 'cotizaciones') return renderCotizacionesView();
    if (subKey === 'catalogo') return renderCatalogoView();
    if (subKey === 'fabricas') return renderFabricasView();
    if (subKey === 'productores') return renderProductoresView();
    if (subKey === 'pagos') return renderPagosView();
    if (subKey === 'config') return renderConfigView();
    return '<p>Sección en desarrollo.</p>';
  }

  /* --------------------------------------------------------------------------
     SUB-VISTA 1: COTIZACIONES
     -------------------------------------------------------------------------- */
  function renderCotizacionesView() {
    var list = STATE.data.cotizaciones || [];
    var totalUsd = list.reduce(function (acc, c) { return acc + (Number(c.totalUsd) || 0); }, 0);
    var pendientes = list.filter(function (c) { return c.estado === 'PENDIENTE' || c.estado === 'EN_COTIZACION'; }).length;
    var aprobadas = list.filter(function (c) { return c.estado === 'APROBADA'; }).length;

    var filtered = list.filter(function (c) {
      if (STATE.filterType && c.tipo !== STATE.filterType) return false;
      if (STATE.filterStatus && c.estado !== STATE.filterStatus) return false;
      if (STATE.searchQuery) {
        var q = STATE.searchQuery.toLowerCase();
        return (
          (c.numero && c.numero.toLowerCase().indexOf(q) >= 0) ||
          (c.cuit && c.cuit.indexOf(q) >= 0) ||
          (c.razonSocial && c.razonSocial.toLowerCase().indexOf(q) >= 0) ||
          (c.productorNombre && c.productorNombre.toLowerCase().indexOf(q) >= 0)
        );
      }
      return true;
    });

    var rows = filtered.map(function (c) {
      var badgeStyle = 'background:#fef3c7; color:#92400e; border:1px solid #fde68a;';
      if (c.estado === 'APROBADA') badgeStyle = 'background:#d1fae5; color:#065f46; border:1px solid #a7f3d0;';
      if (c.estado === 'RECHAZADA') badgeStyle = 'background:#fee2e2; color:#991b1b; border:1px solid #fecaca;';
      if (c.estado === 'FACTURADA') badgeStyle = 'background:#e0e7ff; color:#3730a3; border:1px solid #c7d2fe;';

      return (
        '<tr style="border-bottom:1px solid var(--border-color,#f1f5f9);">' +
          '<td style="padding:10px 12px; font-weight:700; font-size:12px;">' + esc(c.numero) + '</td>' +
          '<td style="padding:10px 12px; font-size:12px;">' + esc(c.fecha) + '</td>' +
          '<td style="padding:10px 12px; font-size:11px;"><span style="padding:2px 8px; border-radius:6px; font-weight:700; background:' + (c.tipo === 'RECIBIDA' ? '#ecfdf5; color:#047857;' : '#eff6ff; color:#1d4ed8;') + '">' + esc(c.tipo) + '</span></td>' +
          '<td style="padding:10px 12px; font-size:12px;">' +
            '<div style="font-weight:700;">' + esc(c.razonSocial || c.productorNombre) + '</div>' +
            '<div style="font-size:11px; color:#64748b;">CUIT: ' + esc(c.cuit) + '</div>' +
          '</td>' +
          '<td style="padding:10px 12px; font-size:12px;">' + esc(c.establecimientoNombre || '-') + '</td>' +
          '<td style="padding:10px 12px; font-size:12px; font-weight:800; color:#059669;">USD ' + fmtMoney(c.totalUsd) + '</td>' +
          '<td style="padding:10px 12px; font-size:11px; max-width:180px;">' + esc(c.formaPago || 'A convenir') + '</td>' +
          '<td style="padding:10px 12px; font-size:11px;"><span style="padding:3px 8px; border-radius:6px; font-weight:700; ' + badgeStyle + '">' + esc(c.estado) + '</span></td>' +
          '<td style="padding:10px 12px; font-size:12px; text-align:right;">' +
            '<button type="button" class="btn-action-view-quote" data-id="' + c.id + '" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:5px; font-size:11px; margin-right:4px; cursor:pointer;">Ver</button>' +
            '<button type="button" class="btn-action-status-quote" data-id="' + c.id + '" style="background:#059669; color:#fff; border:none; padding:4px 8px; border-radius:5px; font-size:11px; cursor:pointer;">Estado</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div>' +
        // Métricas
        '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:20px;">' +
          '<div style="background:var(--card-bg,#fff); border:1px solid var(--border-color,#e2e8f0); padding:14px; border-radius:10px;">' +
            '<div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Total Cotizaciones</div>' +
            '<div style="font-size:24px; font-weight:900; color:var(--text-color,#0f172a); margin-top:4px;">' + list.length + '</div>' +
          '</div>' +
          '<div style="background:var(--card-bg,#fff); border:1px solid var(--border-color,#e2e8f0); padding:14px; border-radius:10px;">' +
            '<div style="font-size:11px; font-weight:700; color:#d97706; text-transform:uppercase;">Pendientes / En Curso</div>' +
            '<div style="font-size:24px; font-weight:900; color:#d97706; margin-top:4px;">' + pendientes + '</div>' +
          '</div>' +
          '<div style="background:var(--card-bg,#fff); border:1px solid var(--border-color,#e2e8f0); padding:14px; border-radius:10px;">' +
            '<div style="font-size:11px; font-weight:700; color:#059669; text-transform:uppercase;">Aprobadas</div>' +
            '<div style="font-size:24px; font-weight:900; color:#059669; margin-top:4px;">' + aprobadas + '</div>' +
          '</div>' +
          '<div style="background:var(--card-bg,#fff); border:1px solid var(--border-color,#e2e8f0); padding:14px; border-radius:10px;">' +
            '<div style="font-size:11px; font-weight:700; color:#0284c7; text-transform:uppercase;">Volumen Cotizado</div>' +
            '<div style="font-size:22px; font-weight:900; color:#0284c7; margin-top:4px;">USD ' + fmtMoney(totalUsd) + '</div>' +
          '</div>' +
        '</div>' +

        // Barra de búsqueda y acciones
        '<div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; margin-bottom:16px;">' +
          '<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">' +
            '<input type="text" id="ms-cd-quote-search" placeholder="Buscar por CUIT, Razón Social o N°..." value="' + esc(STATE.searchQuery) + '" style="padding:8px 12px; font-size:12px; border:1px solid var(--border-color,#cbd5e1); border-radius:8px; min-width:260px;" />' +
            '<select id="ms-cd-quote-filter-type" style="padding:8px 10px; font-size:12px; border:1px solid var(--border-color,#cbd5e1); border-radius:8px;">' +
              '<option value="">Todos los tipos</option>' +
              '<option value="RECIBIDA"' + (STATE.filterType === 'RECIBIDA' ? ' selected' : '') + '>Recibidas (Clientes)</option>' +
              '<option value="ENVIADA"' + (STATE.filterType === 'ENVIADA' ? ' selected' : '') + '>Enviadas (Propuestas)</option>' +
            '</select>' +
            '<select id="ms-cd-quote-filter-status" style="padding:8px 10px; font-size:12px; border:1px solid var(--border-color,#cbd5e1); border-radius:8px;">' +
              '<option value="">Todos los estados</option>' +
              '<option value="PENDIENTE"' + (STATE.filterStatus === 'PENDIENTE' ? ' selected' : '') + '>Pendiente</option>' +
              '<option value="EN_COTIZACION"' + (STATE.filterStatus === 'EN_COTIZACION' ? ' selected' : '') + '>En Cotización</option>' +
              '<option value="APROBADA"' + (STATE.filterStatus === 'APROBADA' ? ' selected' : '') + '>Aprobada</option>' +
              '<option value="RECHAZADA"' + (STATE.filterStatus === 'RECHAZADA' ? ' selected' : '') + '>Rechazada</option>' +
              '<option value="FACTURADA"' + (STATE.filterStatus === 'FACTURADA' ? ' selected' : '') + '>Facturada</option>' +
            '</select>' +
          '</div>' +
          '<button type="button" id="ms-cd-btn-new-quote" style="background:#059669; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">+ Nueva Cotización</button>' +
        '</div>' +

        // Tabla
        '<div style="overflow-x:auto; background:var(--card-bg,#fff); border:1px solid var(--border-color,#e2e8f0); border-radius:10px;">' +
          '<table style="width:100%; border-collapse:collapse; text-align:left;">' +
            '<thead>' +
              '<tr style="background:var(--table-header-bg,#f8fafc); border-bottom:1px solid var(--border-color,#e2e8f0); font-size:11px; text-transform:uppercase; color:#64748b;">' +
                '<th style="padding:10px 12px;">Número</th>' +
                '<th style="padding:10px 12px;">Fecha</th>' +
                '<th style="padding:10px 12px;">Tipo</th>' +
                '<th style="padding:10px 12px;">Productor / CUIT</th>' +
                '<th style="padding:10px 12px;">Establecimiento</th>' +
                '<th style="padding:10px 12px;">Total USD</th>' +
                '<th style="padding:10px 12px;">Forma de Pago</th>' +
                '<th style="padding:10px 12px;">Estado</th>' +
                '<th style="padding:10px 12px; text-align:right;">Acciones</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              (rows || '<tr><td colspan="9" style="text-align:center; padding:30px; color:#94a3b8; font-size:13px;">No se encontraron cotizaciones con los filtros actuales.</td></tr>') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>'
    );
  }

  /* --------------------------------------------------------------------------
     SUB-VISTA 2: CATÁLOGO DE PRODUCTOS
     -------------------------------------------------------------------------- */
  function renderCatalogoView() {
    var prods = STATE.data.productos || [];
    var categories = ['HERBICIDAS', 'FUNGICIDAS', 'INSECTICIDAS', 'COADYUVANTES', 'SEMILLAS', 'FERTILIZANTES'];

    var filtered = prods.filter(function (p) {
      if (STATE.filterCategory && p.categoria !== STATE.filterCategory) return false;
      if (STATE.searchQuery) {
        var q = STATE.searchQuery.toLowerCase();
        return (
          (p.nombre && p.nombre.toLowerCase().indexOf(q) >= 0) ||
          (p.principioActivo && p.principioActivo.toLowerCase().indexOf(q) >= 0) ||
          (p.empresaNombre && p.empresaNombre.toLowerCase().indexOf(q) >= 0)
        );
      }
      return true;
    });

    var rows = filtered.map(function (p) {
      return (
        '<tr style="border-bottom:1px solid var(--border-color,#f1f5f9);">' +
          '<td style="padding:10px 12px; font-weight:700; font-size:12px;">' + esc(p.nombre) + '</td>' +
          '<td style="padding:10px 12px; font-size:11px;"><span style="padding:2px 8px; border-radius:5px; font-weight:700; background:#f1f5f9; color:#475569;">' + esc(p.categoria) + '</span></td>' +
          '<td style="padding:10px 12px; font-size:12px; color:#334155;">' + esc(p.principioActivo || '-') + '</td>' +
          '<td style="padding:10px 12px; font-size:12px; font-weight:600;">' + esc(p.empresaNombre) + '</td>' +
          '<td style="padding:10px 12px; font-size:12px;">' + esc(p.presentacion || '-') + '</td>' +
          '<td style="padding:10px 12px; font-size:12px; font-weight:800; color:#059669;">USD ' + fmtMoney(p.precioDolar) + '</td>' +
          '<td style="padding:10px 12px; font-size:11px;">' + (p.activo ? '<span style="color:#059669; font-weight:700;">● Activo</span>' : '<span style="color:#94a3b8;">○ Inactivo</span>') + '</td>' +
          '<td style="padding:10px 12px; font-size:12px; text-align:right;">' +
            '<button type="button" class="btn-action-edit-prod" data-id="' + p.id + '" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:5px; font-size:11px; margin-right:4px; cursor:pointer;">Editar</button>' +
            '<button type="button" class="btn-action-del-prod" data-id="' + p.id + '" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:5px; font-size:11px; cursor:pointer;">Eliminar</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div>' +
        // Filtros de categoría y buscador
        '<div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; margin-bottom:16px;">' +
          '<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">' +
            '<input type="text" id="ms-cd-prod-search" placeholder="Buscar por producto, principio activo o marca..." value="' + esc(STATE.searchQuery) + '" style="padding:8px 12px; font-size:12px; border:1px solid var(--border-color,#cbd5e1); border-radius:8px; min-width:280px;" />' +
            '<select id="ms-cd-prod-filter-cat" style="padding:8px 10px; font-size:12px; border:1px solid var(--border-color,#cbd5e1); border-radius:8px;">' +
              '<option value="">Todas las categorías (' + prods.length + ')</option>' +
              categories.map(function (c) {
                return '<option value="' + c + '"' + (STATE.filterCategory === c ? ' selected' : '') + '>' + c + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<button type="button" id="ms-cd-btn-new-prod" style="background:#059669; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">+ Nuevo Insumo / Semilla</button>' +
        '</div>' +

        // Tabla
        '<div style="overflow-x:auto; background:var(--card-bg,#fff); border:1px solid var(--border-color,#e2e8f0); border-radius:10px;">' +
          '<table style="width:100%; border-collapse:collapse; text-align:left;">' +
            '<thead>' +
              '<tr style="background:var(--table-header-bg,#f8fafc); border-bottom:1px solid var(--border-color,#e2e8f0); font-size:11px; text-transform:uppercase; color:#64748b;">' +
                '<th style="padding:10px 12px;">Producto Comercial</th>' +
                '<th style="padding:10px 12px;">Rubro</th>' +
                '<th style="padding:10px 12px;">Principio Activo</th>' +
                '<th style="padding:10px 12px;">Fábrica / Laboratorio</th>' +
                '<th style="padding:10px 12px;">Presentación</th>' +
                '<th style="padding:10px 12px;">Precio Ref. USD</th>' +
                '<th style="padding:10px 12px;">Estado</th>' +
                '<th style="padding:10px 12px; text-align:right;">Acciones</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              (rows || '<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8; font-size:13px;">No se encontraron productos.</td></tr>') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>'
    );
  }

  /* --------------------------------------------------------------------------
     SUB-VISTA 3: FÁBRICAS Y LABORATORIOS
     -------------------------------------------------------------------------- */
  function renderFabricasView() {
    var emps = STATE.data.empresas || [];
    var rows = emps.map(function (e) {
      return (
        '<tr style="border-bottom:1px solid var(--border-color,#f1f5f9);">' +
          '<td style="padding:10px 12px; font-weight:800; font-size:13px; color:var(--text-color,#0f172a);">' + esc(e.nombre) + '</td>' +
          '<td style="padding:10px 12px; font-size:12px; color:#64748b;">' + esc(e.cuit || '-') + '</td>' +
          '<td style="padding:10px 12px; font-size:12px;">' + esc(e.contacto || '-') + '</td>' +
          '<td style="padding:10px 12px; font-size:12px;">' + esc(e.telefono || '-') + '</td>' +
          '<td style="padding:10px 12px; font-size:12px; color:#0284c7;">' + esc(e.email || '-') + '</td>' +
          '<td style="padding:10px 12px; font-size:12px; font-weight:700;">' + (e.productosCount || 0) + ' productos</td>' +
          '<td style="padding:10px 12px; font-size:11px;">' + (e.activo ? '<span style="color:#059669; font-weight:700;">● Activa</span>' : '<span style="color:#94a3b8;">○ Inactiva</span>') + '</td>' +
          '<td style="padding:10px 12px; font-size:12px; text-align:right;">' +
            '<button type="button" class="btn-action-edit-emp" data-id="' + e.id + '" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:5px; font-size:11px; cursor:pointer;">Editar</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div>' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">' +
          '<div style="font-size:13px; color:#64748b;">Total de Empresas Registradas: <strong>' + emps.length + '</strong></div>' +
          '<button type="button" id="ms-cd-btn-new-emp" style="background:#059669; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">+ Nueva Empresa</button>' +
        '</div>' +
        '<div style="overflow-x:auto; background:var(--card-bg,#fff); border:1px solid var(--border-color,#e2e8f0); border-radius:10px;">' +
          '<table style="width:100%; border-collapse:collapse; text-align:left;">' +
            '<thead>' +
              '<tr style="background:var(--table-header-bg,#f8fafc); border-bottom:1px solid var(--border-color,#e2e8f0); font-size:11px; text-transform:uppercase; color:#64748b;">' +
                '<th style="padding:10px 12px;">Empresa / Laboratorio</th>' +
                '<th style="padding:10px 12px;">CUIT</th>' +
                '<th style="padding:10px 12px;">Contacto</th>' +
                '<th style="padding:10px 12px;">Teléfono</th>' +
                '<th style="padding:10px 12px;">Email</th>' +
                '<th style="padding:10px 12px;">Productos</th>' +
                '<th style="padding:10px 12px;">Estado</th>' +
                '<th style="padding:10px 12px; text-align:right;">Acciones</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>'
    );
  }

  /* --------------------------------------------------------------------------
     SUB-VISTA 4: PRODUCTORES Y ESTABLECIMIENTOS
     -------------------------------------------------------------------------- */
  function renderProductoresView() {
    var prods = STATE.data.productores || [];
    var rows = prods.map(function (p) {
      var ests = (p.establecimientos || []).map(function (e) {
        return esc(e.nombre) + ' (' + (e.hectareas || 0) + ' ha - ' + esc(e.cultivoPrincipal || 'Mixto') + ')';
      }).join(', ') || 'Sin establecimientos declarados';

      var waClean = String(p.whatsapp || '').replace(/\D/g, '');

      return (
        '<tr style="border-bottom:1px solid var(--border-color,#f1f5f9);">' +
          '<td style="padding:10px 12px; font-size:12px;">' +
            '<div style="font-weight:800; color:var(--text-color,#0f172a);">' + esc(p.razonSocial) + '</div>' +
            '<div style="font-size:11px; color:#64748b;">' + esc(p.apellidos + ' ' + p.nombres) + '</div>' +
          '</td>' +
          '<td style="padding:10px 12px; font-size:12px;">' +
            '<div style="font-weight:700;">' + esc(p.cuit) + '</div>' +
            (p.validadoAfip ? '<div style="font-size:10px; color:#059669; font-weight:800;">✓ VALIDADO AFIP</div>' : '') +
          '</td>' +
          '<td style="padding:10px 12px; font-size:12px;">' +
            '<a href="https://wa.me/' + waClean + '" target="_blank" style="color:#059669; font-weight:700; text-decoration:none;">' + esc(p.whatsapp) + ' ↗</a>' +
          '</td>' +
          '<td style="padding:10px 12px; font-size:12px;">' + esc(p.localidad) + ', ' + esc(p.provincia) + '</td>' +
          '<td style="padding:10px 12px; font-size:11px; color:#475569; max-width:240px;">' + ests + '</td>' +
          '<td style="padding:10px 12px; font-size:12px; text-align:right;">' +
            '<button type="button" class="btn-action-edit-productor" data-id="' + p.id + '" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:5px; font-size:11px; cursor:pointer;">Editar</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div>' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">' +
          '<div style="font-size:13px; color:#64748b;">Padrón de Productores Registrados: <strong>' + prods.length + '</strong></div>' +
          '<button type="button" id="ms-cd-btn-new-productor" style="background:#059669; color:#fff; border:none; padding:8px 16px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">+ Registrar Productor</button>' +
        '</div>' +
        '<div style="overflow-x:auto; background:var(--card-bg,#fff); border:1px solid var(--border-color,#e2e8f0); border-radius:10px;">' +
          '<table style="width:100%; border-collapse:collapse; text-align:left;">' +
            '<thead>' +
              '<tr style="background:var(--table-header-bg,#f8fafc); border-bottom:1px solid var(--border-color,#e2e8f0); font-size:11px; text-transform:uppercase; color:#64748b;">' +
                '<th style="padding:10px 12px;">Razón Social / Contacto</th>' +
                '<th style="padding:10px 12px;">CUIT / AFIP</th>' +
                '<th style="padding:10px 12px;">WhatsApp</th>' +
                '<th style="padding:10px 12px;">Ubicación</th>' +
                '<th style="padding:10px 12px;">Establecimientos / Campos</th>' +
                '<th style="padding:10px 12px; text-align:right;">Acciones</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>'
    );
  }

  /* --------------------------------------------------------------------------
     SUB-VISTA 5: CONDICIONES Y MEDIOS DE PAGO
     -------------------------------------------------------------------------- */
  function renderPagosView() {
    var pagos = STATE.data.condicionesPago || [];
    var rows = pagos.map(function (p) {
      return (
        '<tr style="border-bottom:1px solid var(--border-color,#f1f5f9);">' +
          '<td style="padding:10px 12px; font-size:11px;"><span style="padding:2px 8px; border-radius:5px; font-weight:700; background:#f1f5f9; color:#334155;">' + esc(p.tipo) + '</span></td>' +
          '<td style="padding:10px 12px; font-weight:700; font-size:12px;">' + esc(p.titulo) + '</td>' +
          '<td style="padding:10px 12px; font-size:12px; color:#475569;">' + esc(p.descripcion) + '</td>' +
          '<td style="padding:10px 12px; font-size:12px; font-weight:700;">' + (p.recargoDescPct > 0 ? '+' + p.recargoDescPct + '%' : p.recargoDescPct < 0 ? p.recargoDescPct + '%' : '0%') + '</td>' +
          '<td style="padding:10px 12px; font-size:11px;">' + (p.activo ? '<span style="color:#059669; font-weight:700;">● Habilitado</span>' : '<span style="color:#94a3b8;">○ Pausado</span>') + '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div>' +
        '<div style="font-size:13px; color:#64748b; margin-bottom:16px;">Condiciones comerciales configuradas para las propuestas a productores:</div>' +
        '<div style="overflow-x:auto; background:var(--card-bg,#fff); border:1px solid var(--border-color,#e2e8f0); border-radius:10px;">' +
          '<table style="width:100%; border-collapse:collapse; text-align:left;">' +
            '<thead>' +
              '<tr style="background:var(--table-header-bg,#f8fafc); border-bottom:1px solid var(--border-color,#e2e8f0); font-size:11px; text-transform:uppercase; color:#64748b;">' +
                '<th style="padding:10px 12px;">Tipo</th>' +
                '<th style="padding:10px 12px;">Título</th>' +
                '<th style="padding:10px 12px;">Detalle Comercial</th>' +
                '<th style="padding:10px 12px;">Ajuste %</th>' +
                '<th style="padding:10px 12px;">Estado</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>'
    );
  }

  /* --------------------------------------------------------------------------
     SUB-VISTA 6: CONFIGURACIÓN
     -------------------------------------------------------------------------- */
  function renderConfigView() {
    var c = STATE.data.config || {};
    return (
      '<div style="max-width:680px; background:var(--card-bg,#fff); border:1px solid var(--border-color,#e2e8f0); border-radius:12px; padding:24px;">' +
        '<h3 style="margin-top:0; font-size:16px; font-weight:800; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:16px;">Parámetros del Ecosistema Campo Directo</h3>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">' +
          '<div>' +
            '<label style="display:block; font-size:11px; font-weight:700; color:#475569; margin-bottom:4px; text-transform:uppercase;">URL de la App Web</label>' +
            '<input type="text" id="ms-cd-cfg-url" value="' + esc(c.appUrl || 'https://campodirecto.com.ar') + '" style="width:100%; padding:8px 12px; font-size:12px; border:1px solid #cbd5e1; border-radius:8px;" />' +
          '</div>' +
          '<div>' +
            '<label style="display:block; font-size:11px; font-weight:700; color:#475569; margin-bottom:4px; text-transform:uppercase;">Días de Validez Cotizaciones</label>' +
            '<input type="number" id="ms-cd-cfg-dias" value="' + (c.diasValidezCotizacion || 15) + '" style="width:100%; padding:8px 12px; font-size:12px; border:1px solid #cbd5e1; border-radius:8px;" />' +
          '</div>' +
          '<div>' +
            '<label style="display:block; font-size:11px; font-weight:700; color:#475569; margin-bottom:4px; text-transform:uppercase;">Teléfono / WhatsApp Soporte</label>' +
            '<input type="text" id="ms-cd-cfg-tel" value="' + esc(c.telefonoSoporte || '') + '" style="width:100%; padding:8px 12px; font-size:12px; border:1px solid #cbd5e1; border-radius:8px;" />' +
          '</div>' +
          '<div>' +
            '<label style="display:block; font-size:11px; font-weight:700; color:#475569; margin-bottom:4px; text-transform:uppercase;">Email Soporte Agronómico</label>' +
            '<input type="email" id="ms-cd-cfg-email" value="' + esc(c.emailSoporte || '') + '" style="width:100%; padding:8px 12px; font-size:12px; border:1px solid #cbd5e1; border-radius:8px;" />' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:20px;">' +
          '<label style="display:flex; align-items:center; gap:8px; font-size:12px; font-weight:600; cursor:pointer;">' +
            '<input type="checkbox" id="ms-cd-cfg-afip" ' + (c.autoValidarCuitAfip ? 'checked' : '') + ' />' +
            'Validar automáticamente CUIT ante AFIP (ARCA) y Banco Central (BCRA)' +
          '</label>' +
        '</div>' +
        '<button type="button" id="ms-cd-btn-save-cfg" style="background:#059669; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">Guardar Configuración</button>' +
      '</div>'
    );
  }

  /* --------------------------------------------------------------------------
     EVENT BINDING DENTRO DEL CONTENIDO
     -------------------------------------------------------------------------- */
  function bindSubContentEvents(subKey) {
    // Buscadores
    var searchInput = document.getElementById('ms-cd-quote-search') || document.getElementById('ms-cd-prod-search');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        STATE.searchQuery = this.value;
        renderWorkspace();
      });
    }

    var catFilter = document.getElementById('ms-cd-prod-filter-cat');
    if (catFilter) {
      catFilter.addEventListener('change', function () {
        STATE.filterCategory = this.value;
        renderWorkspace();
      });
    }

    var typeFilter = document.getElementById('ms-cd-quote-filter-type');
    if (typeFilter) {
      typeFilter.addEventListener('change', function () {
        STATE.filterType = this.value;
        renderWorkspace();
      });
    }

    var statusFilter = document.getElementById('ms-cd-quote-filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', function () {
        STATE.filterStatus = this.value;
        renderWorkspace();
      });
    }

    // Botones Ver Cotización
    var viewBtns = document.querySelectorAll('.btn-action-view-quote');
    for (var i = 0; i < viewBtns.length; i++) {
      viewBtns[i].addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        openQuoteDetailModal(id);
      });
    }

    // Botones Estado Cotización
    var statusBtns = document.querySelectorAll('.btn-action-status-quote');
    for (var j = 0; j < statusBtns.length; j++) {
      statusBtns[j].addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        openQuoteStatusModal(id);
      });
    }

    // Botón Guardar Config
    var btnSaveCfg = document.getElementById('ms-cd-btn-save-cfg');
    if (btnSaveCfg) {
      btnSaveCfg.addEventListener('click', function () {
        var cfg = {
          appUrl: document.getElementById('ms-cd-cfg-url').value,
          diasValidezCotizacion: parseInt(document.getElementById('ms-cd-cfg-dias').value, 10) || 15,
          telefonoSoporte: document.getElementById('ms-cd-cfg-tel').value,
          emailSoporte: document.getElementById('ms-cd-cfg-email').value,
          autoValidarCuitAfip: document.getElementById('ms-cd-cfg-afip').checked
        };
        postApiAction('save_config', { config: cfg }, function (res) {
          if (res && res.success) {
            alert('¡Configuración de Campo Directo guardada correctamente!');
            fetchCampoDirectoData(renderWorkspace);
          } else {
            alert('Error al guardar configuración.');
          }
        });
      });
    }
  }

  function openQuoteDetailModal(id) {
    var quote = (STATE.data.cotizaciones || []).find(function (c) { return c.id === id; });
    if (!quote) return;

    var modal = document.createElement('div');
    modal.id = 'ms-cd-quote-modal';
    modal.style = 'position:fixed; inset:0; background:rgba(15,23,42,0.6); display:flex; align-items:center; justify-content:center; z-index:99999; padding:16px;';
    
    var itemsHtml = (quote.items || []).map(function (it) {
      return (
        '<tr style="border-bottom:1px solid #e2e8f0;">' +
          '<td style="padding:8px 10px; font-weight:700;">' + esc(it.nombre) + '</td>' +
          '<td style="padding:8px 10px; color:#64748b;">' + esc(it.categoria) + '</td>' +
          '<td style="padding:8px 10px; color:#64748b;">' + esc(it.dosis || '-') + '</td>' +
          '<td style="padding:8px 10px; text-align:right;">' + it.cantidad + ' ' + esc(it.unidad) + '</td>' +
          '<td style="padding:8px 10px; text-align:right;">USD ' + fmtMoney(it.precioUnitarioUsd) + '</td>' +
          '<td style="padding:8px 10px; text-align:right; font-weight:800; color:#059669;">USD ' + fmtMoney(it.subtotalUsd) + '</td>' +
        '</tr>'
      );
    }).join('');

    modal.innerHTML =
      '<div style="background:#fff; border-radius:12px; width:100%; max-width:760px; max-height:90vh; overflow-y:auto; padding:24px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2);">' +
        '<div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #e2e8f0; padding-bottom:14px; margin-bottom:16px;">' +
          '<div>' +
            '<h2 style="margin:0; font-size:18px; font-weight:900; color:#0f172a;">Cotización ' + esc(quote.numero) + '</h2>' +
            '<div style="font-size:12px; color:#64748b; margin-top:2px;">Fecha: ' + esc(quote.fecha) + ' · Tipo: ' + esc(quote.tipo) + ' · Estado: <strong>' + esc(quote.estado) + '</strong></div>' +
          '</div>' +
          '<button type="button" id="ms-cd-modal-close-btn" style="background:none; border:none; font-size:20px; font-weight:700; cursor:pointer; color:#64748b;">×</button>' +
        '</div>' +

        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; font-size:12px; background:#f8fafc; padding:12px; border-radius:8px;">' +
          '<div>' +
            '<div><strong>Razón Social:</strong> ' + esc(quote.razonSocial) + '</div>' +
            '<div><strong>CUIT:</strong> ' + esc(quote.cuit) + '</div>' +
            '<div><strong>Productor:</strong> ' + esc(quote.productorNombre) + '</div>' +
          '</div>' +
          '<div>' +
            '<div><strong>WhatsApp:</strong> ' + esc(quote.productorWhatsapp) + '</div>' +
            '<div><strong>Establecimiento:</strong> ' + esc(quote.establecimientoNombre || '-') + '</div>' +
            '<div><strong>Forma de Pago:</strong> ' + esc(quote.formaPago || '-') + ' (' + (quote.plazoDias || 0) + ' días)</div>' +
          '</div>' +
        '</div>' +

        '<table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:16px;">' +
          '<thead>' +
            '<tr style="background:#f1f5f9; text-transform:uppercase; font-size:10px; color:#64748b;">' +
              '<th style="padding:8px 10px; text-align:left;">Producto</th>' +
              '<th style="padding:8px 10px; text-align:left;">Rubro</th>' +
              '<th style="padding:8px 10px; text-align:left;">Dosis</th>' +
              '<th style="padding:8px 10px; text-align:right;">Cantidad</th>' +
              '<th style="padding:8px 10px; text-align:right;">Precio Unit.</th>' +
              '<th style="padding:8px 10px; text-align:right;">Subtotal</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + itemsHtml + '</tbody>' +
        '</table>' +

        '<div style="text-align:right; font-size:16px; font-weight:900; color:#059669; border-top:1px solid #e2e8f0; padding-top:12px; margin-bottom:16px;">' +
          'Total Cotizado: USD ' + fmtMoney(quote.totalUsd) +
        '</div>' +

        (quote.observaciones ? '<div style="font-size:12px; color:#64748b; background:#fef3c7; padding:10px; border-radius:6px; margin-bottom:16px;"><strong>Observaciones:</strong> ' + esc(quote.observaciones) + '</div>' : '') +

        '<div style="text-align:right;">' +
          '<button type="button" id="ms-cd-modal-ok-btn" style="background:#0f172a; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;">Cerrar</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    var close = function () {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    };
    document.getElementById('ms-cd-modal-close-btn').addEventListener('click', close);
    document.getElementById('ms-cd-modal-ok-btn').addEventListener('click', close);
  }

  function openQuoteStatusModal(id) {
    var quote = (STATE.data.cotizaciones || []).find(function (c) { return c.id === id; });
    if (!quote) return;

    var newStatus = prompt('Cambiar estado de cotización ' + quote.numero + ':\n(PENDIENTE, EN_COTIZACION, APROBADA, RECHAZADA, FACTURADA)', quote.estado);
    if (!newStatus) return;
    newStatus = newStatus.trim().toUpperCase();

    var valid = ['PENDIENTE', 'EN_COTIZACION', 'APROBADA', 'RECHAZADA', 'FACTURADA'];
    if (valid.indexOf(newStatus) < 0) {
      alert('Estado inválido. Opciones: ' + valid.join(', '));
      return;
    }

    postApiAction('update_cotizacion_status', { id: id, estado: newStatus }, function (res) {
      if (res && res.success) {
        fetchCampoDirectoData(renderWorkspace);
      } else {
        alert('Error al actualizar estado.');
      }
    });
  }

  /* --------------------------------------------------------------------------
     INICIALIZACIÓN
     -------------------------------------------------------------------------- */
  function init() {
    injectHomeCard();
    ensureMenuMounted();
    ensureWorkspaceMounted();
    fetchCampoDirectoData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
