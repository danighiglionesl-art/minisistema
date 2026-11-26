/* ==========================================================================
   MÓDULO EXCLUSIVO DEL ADMINISTRADOR GENERAL (@danielg) — APPCADI
   Gestión integral de AppCaDi (Campo Directo - Insumos Agropecuarios).
   Respeta estrictamente las reglas de GEMINI.md:
   - Tarjetas uniformes (.modules-grid / .module-card) con min-height: 158px y height: 100%.
   - Sin sobretítulos (badges / pills) ni descripciones (<p>) en las tarjetas.
   - Estructura canónica: Ícono SVG monocromático + <h3>Nombre del Submódulo</h3>.
   - Sin alterar la lista de precios comercial de MiniSistema.
   ========================================================================== */
(function () {
  'use strict';

  var SUBMODULES = [
    {
      key: 'panel',
      label: 'Panel General',
      icon: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>'
    },
    {
      key: 'insumos',
      label: 'Catálogo de Insumos',
      icon: '<path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path>'
    },
    {
      key: 'pedidos',
      label: 'Pedidos y Logística Rural',
      icon: '<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>'
    },
    {
      key: 'productores',
      label: 'Productores y Comercios',
      icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>'
    },
    {
      key: 'categorias',
      label: 'Categorías y Rubros Agro',
      icon: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>'
    },
    {
      key: 'logistica',
      label: 'Logística, Fletes y Rutas',
      icon: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>'
    },
    {
      key: 'liquidaciones',
      label: 'Comisiones y Finanzas',
      icon: '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>'
    },
    {
      key: 'configuracion',
      label: 'Configuración de AppCaDi',
      icon: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>'
    },
    {
      key: 'auditoria',
      label: 'Auditoría y Trazabilidad',
      icon: '<polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>'
    }
  ];

  var CATEGORIAS_METADATA = {
    agroquimicos: { etiqueta: 'Agroquímicos', icono: '🧪' },
    fertilizantes: { etiqueta: 'Fertilizantes', icono: '🌱' },
    semillas: { etiqueta: 'Semillas', icono: '🌾' },
    repuestosMaquinaria: { etiqueta: 'Repuestos y Maquinaria', icono: '🚜' },
    combustiblesLubricantes: { etiqueta: 'Combustibles y Lubricantes', icono: '⛽' },
    boyerosAlambrados: { etiqueta: 'Boyeros y Alambrados', icono: '⚡' },
    sanidadVeterinaria: { etiqueta: 'Sanidad Veterinaria', icono: '💉' }
  };

  var STATE = {
    view: 'menu',
    data: null,
    metrics: null,
    loading: false,
    feedback: '',
    isError: false,
    insumosSearch: '',
    insumosCatFilter: 'todas',
    pedidosEstadoFilter: 'todos',
    usuariosTipoFilter: 'todos',
    modalInsumoOpen: false,
    editingInsumoId: null
  };

  var fmtArs = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  });

  var fmtUsd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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
    var user = null;
    if (typeof window.__MS_GET_ACTIVE_USER__ === 'function') {
      user = window.__MS_GET_ACTIVE_USER__();
    }
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
      return '/' + encodeURIComponent(boot.slug) + '/api/appcadi';
    }
    return '/sistema/api/appcadi';
  }

  async function apiCall(method, payload) {
    var opts = {
      method: method || 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    };
    if (payload) opts.body = JSON.stringify(payload);
    var res = await fetch(getApiBase(), opts);
    return res.json();
  }

  function ensureSections() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var secMenu = document.getElementById('sec-menu-appcadi');
    if (secMenu && secMenu.parentNode !== erpMain) {
      erpMain.appendChild(secMenu);
    }
    if (!secMenu) {
      secMenu = document.createElement('section');
      secMenu.id = 'sec-menu-appcadi';
      secMenu.className = 'erp-section';
      secMenu.hidden = true;
      secMenu.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="appcadi-back-home">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">Administrador General · <strong>AppCadi</strong></span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;">' +
            '<button type="button" class="btn-secondary btn-sm" id="btn-appcadi-reload" style="cursor:pointer;">🔄 Actualizar</button>' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" id="appcadi-submodules-grid" aria-label="Submódulos de AppCaDi"></div>';
      erpMain.appendChild(secMenu);
      secMenu.querySelector('#appcadi-back-home').addEventListener('click', closeToHome);
      secMenu.querySelector('#btn-appcadi-reload').addEventListener('click', function () {
        reloadData().then(function () { renderSubmodulesMenu(); });
      });
    }

    var secDetail = document.getElementById('sec-appcadi-detail');
    if (secDetail && secDetail.parentNode !== erpMain) {
      erpMain.appendChild(secDetail);
    }
    if (!secDetail) {
      secDetail = document.createElement('section');
      secDetail.id = 'sec-appcadi-detail';
      secDetail.className = 'erp-section';
      secDetail.hidden = true;
      secDetail.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="appcadi-back-menu">← Volver a AppCadi</button>' +
            '<span class="module-breadcrumb" id="appcadi-detail-breadcrumb">AppCadi</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;" id="appcadi-detail-top-actions"></div>' +
        '</div>' +
        '<div id="appcadi-detail-body" style="padding:1rem 0;"></div>';
      erpMain.appendChild(secDetail);
      secDetail.querySelector('#appcadi-back-menu').addEventListener('click', function () {
        openAppCadiView('menu');
      });
    }

    return { menuSec: secMenu, detailSec: secDetail };
  }

  function hideAllErpSections() {
    document.querySelectorAll('.erp-main > .erp-section, section.erp-section').forEach(function (sec) {
      sec.hidden = true;
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

  function bindGlobalNavIntegration() {
    if (window.__MS_APPCADI_NAV_BOUND__) return;
    window.__MS_APPCADI_NAV_BOUND__ = true;

    document.addEventListener('click', function (ev) {
      var target = ev.target;
      if (!target || typeof target.closest !== 'function') return;

      var navEl = target.closest(
        '#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-feriarte-home-card, #ms-doncontador-home-card, #ms-reikionline-home-card, #ms-cv-home-card, #ms-personal-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-micontador-home-card'
      );
      if (!navEl) return;

      var menuSec = document.getElementById('sec-menu-appcadi');
      var detailSec = document.getElementById('sec-appcadi-detail');
      var isActive = (menuSec && !menuSec.hidden) || (detailSec && !detailSec.hidden);

      if (navEl.id === 'btn-topbar-back-facturacion' && isActive) {
        ev.preventDefault();
        ev.stopPropagation();
        if (detailSec && !detailSec.hidden) {
          openAppCadiView('menu');
        } else {
          closeToHome();
        }
        return;
      }

      if (menuSec) menuSec.hidden = true;
      if (detailSec) detailSec.hidden = true;
    }, true);
  }

  async function reloadData() {
    STATE.loading = true;
    try {
      var res = await apiCall('GET');
      if (res && res.ok) {
        STATE.data = res.data;
        STATE.metrics = res.metrics;
        STATE.feedback = '';
        STATE.isError = false;
      } else {
        STATE.feedback = (res && res.message) || 'No se pudo consultar AppCaDi.';
        STATE.isError = true;
      }
    } catch (_e) {
      STATE.feedback = 'No se pudo conectar con el servicio de AppCaDi.';
      STATE.isError = true;
    } finally {
      STATE.loading = false;
    }
  }

  function renderSubmodulesMenu() {
    var grid = document.getElementById('appcadi-submodules-grid');
    if (!grid) return;
    grid.innerHTML = SUBMODULES.map(function (m) {
      return (
        '<article class="module-card" role="button" tabindex="0" data-appcadi-sub="' + esc(m.key) + '">' +
          '<div class="module-icon" aria-hidden="true">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + m.icon + '</svg>' +
          '</div>' +
          '<h3>' + esc(m.label) + '</h3>' +
        '</article>'
      );
    }).join('');

    grid.querySelectorAll('[data-appcadi-sub]').forEach(function (card) {
      var open = function () {
        openAppCadiView(card.getAttribute('data-appcadi-sub'));
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          open();
        }
      });
    });
  }

  // =========================================================================
  // RENDER DETALLE DE CADA SUBMÓDULO
  // =========================================================================
  function renderDetailView(viewKey) {
    var body = document.getElementById('appcadi-detail-body');
    var topActions = document.getElementById('appcadi-detail-top-actions');
    if (!body) return;
    if (topActions) topActions.innerHTML = '';

    var data = STATE.data || {};
    var metrics = STATE.metrics || {};
    var insumos = data.insumos || [];
    var pedidos = data.pedidos || [];
    var usuarios = data.usuarios || [];
    var tarifas = data.tarifasFlete || {};
    var config = data.configuracion || {};
    var auditoria = data.auditoria || [];

    var feedbackHtml = '';
    if (STATE.feedback) {
      feedbackHtml =
        '<div style="padding:0.75rem 1rem;margin-bottom:1rem;border-radius:8px;' +
          (STATE.isError ? 'background:#fee2e2;color:#991b1b;border:1px solid #f87171;' : 'background:#dcfce7;color:#166534;border:1px solid #86efac;') +
        '">' + esc(STATE.feedback) + '</div>';
    }

    // 1. PANEL GENERAL
    if (viewKey === 'panel') {
      body.innerHTML = feedbackHtml +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:1rem;margin-bottom:1.5rem;">' +
          '<div style="background:#fff;padding:1.25rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid #16a34a;">' +
            '<div style="font-size:0.85rem;color:#64748b;font-weight:600;text-transform:uppercase;">Insumos Publicados</div>' +
            '<div style="font-size:2rem;font-weight:700;color:#0f172a;margin-top:0.25rem;">' + (metrics.insumosActivos || 0) + ' <span style="font-size:1rem;color:#64748b;font-weight:400;">/ ' + (metrics.insumosTotales || 0) + ' tot.</span></div>' +
          '</div>' +
          '<div style="background:#fff;padding:1.25rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid #2563eb;">' +
            '<div style="font-size:0.85rem;color:#64748b;font-weight:600;text-transform:uppercase;">Pedidos en Despacho</div>' +
            '<div style="font-size:2rem;font-weight:700;color:#0f172a;margin-top:0.25rem;">' + (metrics.pedidosEnCurso || 0) + ' <span style="font-size:1rem;color:#64748b;font-weight:400;">(' + (metrics.pedidosEntregados || 0) + ' entregados)</span></div>' +
          '</div>' +
          '<div style="background:#fff;padding:1.25rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid #ca8a04;">' +
            '<div style="font-size:0.85rem;color:#64748b;font-weight:600;text-transform:uppercase;">Productores y Agronomías</div>' +
            '<div style="font-size:2rem;font-weight:700;color:#0f172a;margin-top:0.25rem;">' + (metrics.usuariosTotales || 0) + ' <span style="font-size:0.9rem;color:#64748b;font-weight:400;">(' + (metrics.productoresCount || 0) + ' prod. / ' + (metrics.agronomiasCount || 0) + ' agro.)</span></div>' +
          '</div>' +
          '<div style="background:#fff;padding:1.25rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid #0d9488;">' +
            '<div style="font-size:0.85rem;color:#64748b;font-weight:600;text-transform:uppercase;">Volumen Transaccionado</div>' +
            '<div style="font-size:1.4rem;font-weight:700;color:#0f172a;margin-top:0.25rem;">' + fmtArs.format(metrics.volumenArs || 0) + '</div>' +
            '<div style="font-size:1rem;color:#0d9488;font-weight:600;">+ ' + fmtUsd.format(metrics.volumenUsd || 0) + '</div>' +
          '</div>' +
        '</div>' +

        '<div style="background:#fff;padding:1.5rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:1.5rem;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">' +
            '<h3 style="margin:0;font-size:1.15rem;color:#0f172a;">🚜 Estado Operativo de la Aplicación Móvil</h3>' +
            '<span style="padding:0.25rem 0.75rem;border-radius:9999px;font-size:0.85rem;font-weight:700;background:#dcfce7;color:#166534;">' +
              (config.modoOperativo === 'mantenimiento' ? 'Mantenimiento' : 'App Activa / En Línea') +
            '</span>' +
          '</div>' +
          '<p style="color:#475569;margin-bottom:1rem;font-size:0.95rem;">' +
            'AppCaDi conecta productores agropecuarios con excedentes de insumos y agronomías con compradores en campos vecinos mediante geolocalización, flete calculado por km y seguimiento en vivo.' +
          '</p>' +
          '<div style="display:flex;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-primary btn-sm" id="btn-quick-insumos">Gestionar Insumos</button>' +
            '<button type="button" class="btn-secondary btn-sm" id="btn-quick-pedidos">Ver Pedidos Activos</button>' +
            '<button type="button" class="btn-secondary btn-sm" id="btn-quick-reset" style="margin-left:auto;color:#b91c1c;">Restablecer Datos Demo</button>' +
          '</div>' +
        '</div>';

      document.getElementById('btn-quick-insumos').addEventListener('click', function () { openAppCadiView('insumos'); });
      document.getElementById('btn-quick-pedidos').addEventListener('click', function () { openAppCadiView('pedidos'); });
      document.getElementById('btn-quick-reset').addEventListener('click', async function () {
        if (!confirm('¿Restablecer el catálogo de insumos, pedidos y productores de demostración a valores iniciales?')) return;
        var r = await apiCall('POST', { action: 'reset_demo_data' });
        STATE.feedback = (r && r.message) || 'Restablecido.';
        await reloadData();
        renderDetailView('panel');
      });
      return;
    }

    // 2. CATÁLOGO DE INSUMOS
    if (viewKey === 'insumos') {
      if (topActions) {
        topActions.innerHTML = '<button type="button" class="btn-primary btn-sm" id="btn-nuevo-insumo">+ Nuevo Insumo</button>';
      }

      var filtered = insumos.filter(function (ins) {
        if (STATE.insumosCatFilter !== 'todas' && ins.categoria !== STATE.insumosCatFilter) return false;
        if (STATE.insumosSearch) {
          var q = STATE.insumosSearch.toLowerCase();
          var match = (ins.nombre && ins.nombre.toLowerCase().indexOf(q) >= 0) ||
                      (ins.marca && ins.marca.toLowerCase().indexOf(q) >= 0) ||
                      (ins.vendedorEstablecimiento && ins.vendedorEstablecimiento.toLowerCase().indexOf(q) >= 0);
          if (!match) return false;
        }
        return true;
      });

      var rows = filtered.map(function (ins) {
        var catMeta = CATEGORIAS_METADATA[ins.categoria] || { etiqueta: ins.categoria, icono: '📦' };
        var precioFmt = ins.moneda === 'USD' ? fmtUsd.format(ins.precioUnitario) : fmtArs.format(ins.precioUnitario);
        var estadoBadge = ins.estado === 'activo'
          ? '<span style="background:#dcfce7;color:#166534;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600;">Activo</span>'
          : '<span style="background:#fee2e2;color:#991b1b;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600;">Pausado</span>';
        var origenBadge = ins.esProductorVecino
          ? '<span style="background:#fef3c7;color:#92400e;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600;">Productor Vecino</span>'
          : '<span style="background:#e0e7ff;color:#3730a3;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600;">Agronomía</span>';

        return (
          '<tr style="border-bottom:1px solid #e2e8f0;">' +
            '<td style="padding:0.75rem 0.5rem;">' +
              '<div style="font-weight:600;color:#0f172a;">' + esc(ins.nombre) + '</div>' +
              '<div style="font-size:0.8rem;color:#64748b;">Marca: ' + esc(ins.marca) + ' · ' + catMeta.icono + ' ' + esc(catMeta.etiqueta) + '</div>' +
            '</td>' +
            '<td style="padding:0.75rem 0.5rem;">' +
              '<div style="font-weight:600;color:#16a34a;">' + precioFmt + '</div>' +
              '<div style="font-size:0.8rem;color:#64748b;">Stock: ' + ins.stockDisponible + ' ' + esc(ins.unidadMedida) + '</div>' +
            '</td>' +
            '<td style="padding:0.75rem 0.5rem;">' +
              '<div style="font-size:0.85rem;font-weight:600;color:#0f172a;">' + esc(ins.vendedorEstablecimiento) + '</div>' +
              '<div style="font-size:0.78rem;color:#64748b;">' + esc(ins.ubicacionTexto) + '</div>' +
              '<div style="margin-top:0.25rem;">' + origenBadge + '</div>' +
            '</td>' +
            '<td style="padding:0.75rem 0.5rem;text-align:center;">' + estadoBadge + '</td>' +
            '<td style="padding:0.75rem 0.5rem;text-align:right;white-space:nowrap;">' +
              '<button type="button" class="btn-sm btn-secondary btn-toggle-ins" data-ins-id="' + esc(ins.id) + '" style="margin-right:0.35rem;">' +
                (ins.estado === 'activo' ? 'Pausar' : 'Activar') +
              '</button>' +
              '<button type="button" class="btn-sm btn-secondary btn-del-ins" data-ins-id="' + esc(ins.id) + '" style="color:#b91c1c;">Eliminar</button>' +
            '</td>' +
          '</tr>'
        );
      }).join('');

      body.innerHTML = feedbackHtml +
        '<div style="background:#fff;padding:1rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:1rem;">' +
          '<div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center;">' +
            '<input type="text" id="input-ins-search" placeholder="Buscar por nombre, marca o campo..." value="' + esc(STATE.insumosSearch) + '" style="flex:1;min-width:240px;padding:0.5rem 0.75rem;border:1px solid #cbd5e1;border-radius:6px;">' +
            '<select id="select-ins-cat" style="padding:0.5rem 0.75rem;border:1px solid #cbd5e1;border-radius:6px;">' +
              '<option value="todas"' + (STATE.insumosCatFilter === 'todas' ? ' selected' : '') + '>Todas las Categorías (' + insumos.length + ')</option>' +
              Object.keys(CATEGORIAS_METADATA).map(function (k) {
                var c = CATEGORIAS_METADATA[k];
                return '<option value="' + k + '"' + (STATE.insumosCatFilter === k ? ' selected' : '') + '>' + c.icono + ' ' + c.etiqueta + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +

        '<div style="background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow-x:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.9rem;">' +
            '<thead>' +
              '<tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;text-align:left;color:#475569;">' +
                '<th style="padding:0.75rem 0.5rem;">Insumo / Marca</th>' +
                '<th style="padding:0.75rem 0.5rem;">Precio & Stock</th>' +
                '<th style="padding:0.75rem 0.5rem;">Vendedor / Ubicación</th>' +
                '<th style="padding:0.75rem 0.5rem;text-align:center;">Estado</th>' +
                '<th style="padding:0.75rem 0.5rem;text-align:right;">Acciones</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              (rows || '<tr><td colspan="5" style="padding:2rem;text-align:center;color:#64748b;">No se encontraron insumos con los filtros aplicados.</td></tr>') +
            '</tbody>' +
          '</table>' +
        '</div>';

      // Eventos
      var searchInp = document.getElementById('input-ins-search');
      if (searchInp) {
        searchInp.addEventListener('input', function (e) {
          STATE.insumosSearch = e.target.value;
          renderDetailView('insumos');
        });
      }
      var catSel = document.getElementById('select-ins-cat');
      if (catSel) {
        catSel.addEventListener('change', function (e) {
          STATE.insumosCatFilter = e.target.value;
          renderDetailView('insumos');
        });
      }
      var btnNuevo = document.getElementById('btn-nuevo-insumo');
      if (btnNuevo) {
        btnNuevo.addEventListener('click', function () {
          promptNuevoInsumo();
        });
      }

      body.querySelectorAll('.btn-toggle-ins').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-ins-id');
          btn.disabled = true;
          var r = await apiCall('POST', { action: 'toggle_insumo_estado', id: id });
          STATE.feedback = (r && r.message) || 'Actualizado.';
          await reloadData();
          renderDetailView('insumos');
        });
      });

      body.querySelectorAll('.btn-del-ins').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-ins-id');
          if (!confirm('¿Eliminar definitivamente este insumo del catálogo de AppCaDi?')) return;
          btn.disabled = true;
          var r = await apiCall('POST', { action: 'delete_insumo', id: id });
          STATE.feedback = (r && r.message) || 'Eliminado.';
          await reloadData();
          renderDetailView('insumos');
        });
      });
      return;
    }

    // 3. PEDIDOS Y DESPACHO RURAL
    if (viewKey === 'pedidos') {
      var filteredPeds = pedidos.filter(function (p) {
        if (STATE.pedidosEstadoFilter !== 'todos' && p.estado !== STATE.pedidosEstadoFilter) return false;
        return true;
      });

      var pedCards = filteredPeds.map(function (ped) {
        var estadoBadgeStyle = '';
        var estadoLabel = '';
        switch (ped.estado) {
          case 'solicitado':
            estadoBadgeStyle = 'background:#fef3c7;color:#92400e;';
            estadoLabel = '⏳ Solicitado (Pendiente)';
            break;
          case 'confirmado':
            estadoBadgeStyle = 'background:#e0e7ff;color:#3730a3;';
            estadoLabel = '✅ Confirmado por Vendedor';
            break;
          case 'enCamino':
            estadoBadgeStyle = 'background:#dbeafe;color:#1e40af;';
            estadoLabel = '🚚 En Camino al Campo';
            break;
          case 'entregado':
            estadoBadgeStyle = 'background:#dcfce7;color:#166534;';
            estadoLabel = '📍 Entregado con Éxito';
            break;
          case 'cancelado':
            estadoBadgeStyle = 'background:#fee2e2;color:#991b1b;';
            estadoLabel = '❌ Cancelado';
            break;
        }

        var totalFmt = ped.moneda === 'USD' ? fmtUsd.format(ped.total) : fmtArs.format(ped.total);
        var fleteFmt = fmtArs.format(ped.costoFlete || 0);

        return (
          '<div style="background:#fff;border-radius:10px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:1rem;border:1px solid #e2e8f0;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">' +
              '<div>' +
                '<span style="font-weight:700;font-size:1.05rem;color:#0f172a;">Pedido ' + esc(ped.numeroPedido) + '</span>' +
                '<span style="font-size:0.8rem;color:#64748b;margin-left:0.5rem;">' + fmtDate(ped.fechaCreacion) + '</span>' +
              '</div>' +
              '<span style="padding:0.25rem 0.65rem;border-radius:6px;font-size:0.8rem;font-weight:700;' + estadoBadgeStyle + '">' +
                estadoLabel +
              '</span>' +
            '</div>' +

            '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:1rem;margin-bottom:1rem;font-size:0.9rem;">' +
              '<div style="background:#f8fafc;padding:0.75rem;border-radius:8px;">' +
                '<div style="font-size:0.75rem;text-transform:uppercase;color:#64748b;font-weight:700;">Insumo Solicitado</div>' +
                '<div style="font-weight:600;color:#0f172a;margin-top:0.25rem;">' + esc(ped.insumoNombre) + ' (' + esc(ped.marca) + ')</div>' +
                '<div style="color:#16a34a;font-weight:700;">Cantidad: ' + ped.cantidad + ' ' + esc(ped.unidadMedida) + ' · Total: ' + totalFmt + '</div>' +
              '</div>' +

              '<div style="background:#f8fafc;padding:0.75rem;border-radius:8px;">' +
                '<div style="font-size:0.75rem;text-transform:uppercase;color:#64748b;font-weight:700;">Comprador (Destino)</div>' +
                '<div style="font-weight:600;color:#0f172a;margin-top:0.25rem;">' + esc(ped.compradorNombre) + ' (' + esc(ped.compradorEstablecimiento) + ')</div>' +
                '<div style="color:#64748b;font-size:0.8rem;">📍 ' + esc(ped.destinoTexto) + ' · 📞 ' + esc(ped.compradorTelefono) + '</div>' +
              '</div>' +

              '<div style="background:#f8fafc;padding:0.75rem;border-radius:8px;">' +
                '<div style="font-size:0.75rem;text-transform:uppercase;color:#64748b;font-weight:700;">Vendedor (Origen)</div>' +
                '<div style="font-weight:600;color:#0f172a;margin-top:0.25rem;">' + esc(ped.vendedorNombre) + ' (' + esc(ped.vendedorEstablecimiento) + ')</div>' +
                '<div style="color:#64748b;font-size:0.8rem;">🏭 ' + esc(ped.origenTexto) + ' · 📞 ' + esc(ped.vendedorTelefono) + '</div>' +
              '</div>' +

              '<div style="background:#f8fafc;padding:0.75rem;border-radius:8px;">' +
                '<div style="font-size:0.75rem;text-transform:uppercase;color:#64748b;font-weight:700;">Flete y Distancia</div>' +
                '<div style="font-weight:600;color:#0f172a;margin-top:0.25rem;">🚚 ' + ped.distanciaKm + ' km · ~' + ped.tiempoEstimadoMinutos + ' min</div>' +
                '<div style="color:#2563eb;font-weight:600;">Costo Flete: ' + fleteFmt + '</div>' +
              '</div>' +
            '</div>' +

            '<div style="display:flex;align-items:center;justify-content:flex-end;gap:0.5rem;flex-wrap:wrap;border-top:1px solid #f1f5f9;padding-top:0.75rem;">' +
              '<span style="font-size:0.85rem;color:#64748b;margin-right:auto;">Cambiar Estado:</span>' +
              '<button type="button" class="btn-sm btn-secondary btn-ped-status" data-ped-id="' + esc(ped.id) + '" data-status="solicitado"' + (ped.estado === 'solicitado' ? ' disabled' : '') + '>Solicitado</button>' +
              '<button type="button" class="btn-sm btn-secondary btn-ped-status" data-ped-id="' + esc(ped.id) + '" data-status="confirmado"' + (ped.estado === 'confirmado' ? ' disabled' : '') + '>Confirmado</button>' +
              '<button type="button" class="btn-sm btn-secondary btn-ped-status" data-ped-id="' + esc(ped.id) + '" data-status="enCamino"' + (ped.estado === 'enCamino' ? ' disabled' : '') + '>En Camino</button>' +
              '<button type="button" class="btn-sm btn-primary btn-ped-status" data-ped-id="' + esc(ped.id) + '" data-status="entregado"' + (ped.estado === 'entregado' ? ' disabled' : '') + '>Entregado</button>' +
              '<button type="button" class="btn-sm btn-secondary btn-ped-status" data-ped-id="' + esc(ped.id) + '" data-status="cancelado" style="color:#b91c1c;"' + (ped.estado === 'cancelado' ? ' disabled' : '') + '>Cancelar</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');

      body.innerHTML = feedbackHtml +
        '<div style="background:#fff;padding:1rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">' +
          '<button type="button" class="btn-sm ' + (STATE.pedidosEstadoFilter === 'todos' ? 'btn-primary' : 'btn-secondary') + ' btn-ped-filter" data-filter="todos">Todos (' + pedidos.length + ')</button>' +
          '<button type="button" class="btn-sm ' + (STATE.pedidosEstadoFilter === 'solicitado' ? 'btn-primary' : 'btn-secondary') + ' btn-ped-filter" data-filter="solicitado">Solicitados</button>' +
          '<button type="button" class="btn-sm ' + (STATE.pedidosEstadoFilter === 'confirmado' ? 'btn-primary' : 'btn-secondary') + ' btn-ped-filter" data-filter="confirmado">Confirmados</button>' +
          '<button type="button" class="btn-sm ' + (STATE.pedidosEstadoFilter === 'enCamino' ? 'btn-primary' : 'btn-secondary') + ' btn-ped-filter" data-filter="enCamino">En Camino</button>' +
          '<button type="button" class="btn-sm ' + (STATE.pedidosEstadoFilter === 'entregado' ? 'btn-primary' : 'btn-secondary') + ' btn-ped-filter" data-filter="entregado">Entregados</button>' +
          '<button type="button" class="btn-sm ' + (STATE.pedidosEstadoFilter === 'cancelado' ? 'btn-primary' : 'btn-secondary') + ' btn-ped-filter" data-filter="cancelado">Cancelados</button>' +
        '</div>' +
        (pedCards || '<div style="background:#fff;padding:2rem;text-align:center;border-radius:10px;color:#64748b;">No hay pedidos registrados con el estado seleccionado.</div>');

      body.querySelectorAll('.btn-ped-filter').forEach(function (btn) {
        btn.addEventListener('click', function () {
          STATE.pedidosEstadoFilter = btn.getAttribute('data-filter');
          renderDetailView('pedidos');
        });
      });

      body.querySelectorAll('.btn-ped-status').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-ped-id');
          var st = btn.getAttribute('data-status');
          var motivo = '';
          if (st === 'cancelado') {
            motivo = prompt('Motivo de cancelación del pedido:') || 'Cancelado por el Administrador';
          }
          btn.disabled = true;
          var r = await apiCall('POST', { action: 'update_pedido_estado', id: id, estado: st, motivo: motivo });
          STATE.feedback = (r && r.message) || 'Estado actualizado.';
          await reloadData();
          renderDetailView('pedidos');
        });
      });
      return;
    }

    // 4. PRODUCTORES Y COMERCIOS
    if (viewKey === 'productores') {
      if (topActions) {
        topActions.innerHTML = '<button type="button" class="btn-primary btn-sm" id="btn-nuevo-usuario">+ Nuevo Usuario</button>';
      }

      var usrRows = usuarios.map(function (u) {
        var tipoLabel = '';
        var tipoBadge = '';
        if (u.tipo === 'productor') {
          tipoLabel = 'Productor Agropecuario';
          tipoBadge = '<span style="background:#dcfce7;color:#166534;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600;">Productor</span>';
        } else if (u.tipo === 'vendedor') {
          tipoLabel = 'Agronomía Comercial';
          tipoBadge = '<span style="background:#e0e7ff;color:#3730a3;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600;">Agronomía</span>';
        } else {
          tipoLabel = 'Productor Mixto (Vende excedentes)';
          tipoBadge = '<span style="background:#fef3c7;color:#92400e;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600;">Mixto (Vecino)</span>';
        }

        var estadoSpan = u.estado === 'activo'
          ? '<span style="color:#16a34a;font-weight:700;">Activo</span>'
          : '<span style="color:#b91c1c;font-weight:700;">Suspendido</span>';

        return (
          '<tr style="border-bottom:1px solid #e2e8f0;">' +
            '<td style="padding:0.75rem 0.5rem;">' +
              '<div style="font-weight:600;color:#0f172a;">' + esc(u.nombre) + '</div>' +
              '<div style="font-size:0.8rem;color:#64748b;">' + esc(u.email) + '</div>' +
            '</td>' +
            '<td style="padding:0.75rem 0.5rem;">' +
              '<div style="font-weight:600;color:#0f172a;">' + esc(u.nombreEstablecimiento) + '</div>' +
              '<div style="font-size:0.8rem;color:#64748b;">' + esc(u.localidad) + ', ' + esc(u.provincia) + '</div>' +
            '</td>' +
            '<td style="padding:0.75rem 0.5rem;">' + tipoBadge + '<div style="font-size:0.75rem;color:#64748b;margin-top:0.2rem;">' + esc(u.cuitRenspa || '—') + '</div></td>' +
            '<td style="padding:0.75rem 0.5rem;">' +
              '<a href="https://wa.me/' + esc(u.telefono.replace(/[^0-9]/g, '')) + '" target="_blank" style="color:#0d9488;text-decoration:none;font-weight:600;">' +
                esc(u.telefono) +
              '</a>' +
            '</td>' +
            '<td style="padding:0.75rem 0.5rem;text-align:center;">' + estadoSpan + '</td>' +
            '<td style="padding:0.75rem 0.5rem;text-align:right;">' +
              '<button type="button" class="btn-sm btn-secondary btn-toggle-usr" data-usr-id="' + esc(u.id) + '">' +
                (u.estado === 'activo' ? 'Suspender' : 'Habilitar') +
              '</button>' +
            '</td>' +
          '</tr>'
        );
      }).join('');

      body.innerHTML = feedbackHtml +
        '<div style="background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow-x:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.9rem;">' +
            '<thead>' +
              '<tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;text-align:left;color:#475569;">' +
                '<th style="padding:0.75rem 0.5rem;">Nombre / Contacto</th>' +
                '<th style="padding:0.75rem 0.5rem;">Establecimiento / Zona</th>' +
                '<th style="padding:0.75rem 0.5rem;">Perfil / RENSPA</th>' +
                '<th style="padding:0.75rem 0.5rem;">WhatsApp</th>' +
                '<th style="padding:0.75rem 0.5rem;text-align:center;">Estado</th>' +
                '<th style="padding:0.75rem 0.5rem;text-align:right;">Acción</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              (usrRows || '<tr><td colspan="6" style="padding:2rem;text-align:center;color:#64748b;">No hay usuarios registrados.</td></tr>') +
            '</tbody>' +
          '</table>' +
        '</div>';

      var btnNuevoU = document.getElementById('btn-nuevo-usuario');
      if (btnNuevoU) {
        btnNuevoU.addEventListener('click', promptNuevoUsuario);
      }

      body.querySelectorAll('.btn-toggle-usr').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-usr-id');
          btn.disabled = true;
          var r = await apiCall('POST', { action: 'toggle_usuario_estado', id: id });
          STATE.feedback = (r && r.message) || 'Actualizado.';
          await reloadData();
          renderDetailView('productores');
        });
      });
      return;
    }

    // 5. CATEGORÍAS AGROPECUARIAS
    if (viewKey === 'categorias') {
      var catCards = Object.keys(CATEGORIAS_METADATA).map(function (k) {
        var cat = CATEGORIAS_METADATA[k];
        var count = insumos.filter(function (i) { return i.categoria === k; }).length;
        var activos = insumos.filter(function (i) { return i.categoria === k && i.estado === 'activo'; }).length;

        return (
          '<div style="background:#fff;border-radius:10px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid #16a34a;">' +
            '<div style="font-size:2rem;margin-bottom:0.5rem;">' + cat.icono + '</div>' +
            '<h4 style="margin:0 0 0.25rem 0;font-size:1.1rem;color:#0f172a;">' + esc(cat.etiqueta) + '</h4>' +
            '<div style="font-size:0.85rem;color:#64748b;margin-bottom:0.75rem;">Clave: ' + esc(k) + '</div>' +
            '<div style="font-size:0.9rem;font-weight:600;color:#16a34a;">' + activos + ' insumos activos <span style="font-weight:400;color:#64748b;">(' + count + ' tot.)</span></div>' +
          '</div>'
        );
      }).join('');

      body.innerHTML = feedbackHtml +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:1rem;">' +
          catCards +
        '</div>';
      return;
    }

    // 6. LOGÍSTICA, FLETES Y RUTAS
    if (viewKey === 'logistica') {
      body.innerHTML = feedbackHtml +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:1.5rem;">' +
          '<div style="background:#fff;padding:1.5rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">' +
            '<h3 style="margin:0 0 1rem 0;font-size:1.15rem;color:#0f172a;">🚚 Tarifas Oficiales de Flete Rural</h3>' +
            '<div style="margin-bottom:1rem;">' +
              '<label style="display:block;font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:0.25rem;">Costo Base de Arranque (ARS):</label>' +
              '<input type="number" id="inp-flete-base" value="' + (tarifas.costoBaseFleteArs || 18000) + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;">' +
            '</div>' +
            '<div style="margin-bottom:1rem;">' +
              '<label style="display:block;font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:0.25rem;">Tarifa por Kilómetro Recorrido (ARS/km):</label>' +
              '<input type="number" id="inp-flete-km" value="' + (tarifas.costoPorKmArs || 1400) + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;">' +
            '</div>' +
            '<div style="margin-bottom:1.25rem;">' +
              '<label style="display:block;font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:0.25rem;">Radio Máximo de Entrega / Búsqueda (km):</label>' +
              '<input type="number" id="inp-flete-radio" value="' + (tarifas.radioMaximoKm || 180) + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;">' +
            '</div>' +
            '<button type="button" class="btn-primary" id="btn-save-flete" style="width:100%;">Guardar Tarifas de Flete</button>' +
          '</div>' +

          '<div style="background:#fff;padding:1.5rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">' +
            '<h3 style="margin:0 0 1rem 0;font-size:1.15rem;color:#0f172a;">⚡ Simulador de Flete en Vivo</h3>' +
            '<p style="color:#64748b;font-size:0.9rem;margin-bottom:1rem;">Calcula el flete estimado que verá el comprador según la distancia entre el galpón del vendedor y su campo:</p>' +
            '<div style="margin-bottom:1rem;">' +
              '<label style="display:block;font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:0.25rem;">Distancia en Kilómetros (km):</label>' +
              '<input type="number" id="inp-sim-km" value="35" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;">' +
            '</div>' +
            '<div id="sim-result" style="background:#f8fafc;padding:1rem;border-radius:8px;border:1px solid #e2e8f0;margin-top:1rem;"></div>' +
          '</div>' +
        '</div>';

      function calcSim() {
        var base = Number(document.getElementById('inp-flete-base').value) || 0;
        var pkm = Number(document.getElementById('inp-flete-km').value) || 0;
        var dist = Number(document.getElementById('inp-sim-km').value) || 0;
        var total = base + (dist * pkm);
        var res = document.getElementById('sim-result');
        if (res) {
          res.innerHTML =
            '<div style="font-size:0.85rem;color:#64748b;">Flete para <strong>' + dist + ' km</strong>:</div>' +
            '<div style="font-size:1.5rem;font-weight:700;color:#16a34a;margin-top:0.25rem;">' + fmtArs.format(total) + '</div>' +
            '<div style="font-size:0.8rem;color:#64748b;margin-top:0.25rem;">(Base: ' + fmtArs.format(base) + ' + Distancia: ' + fmtArs.format(dist * pkm) + ')</div>';
        }
      }

      calcSim();
      document.getElementById('inp-sim-km').addEventListener('input', calcSim);
      document.getElementById('inp-flete-base').addEventListener('input', calcSim);
      document.getElementById('inp-flete-km').addEventListener('input', calcSim);

      document.getElementById('btn-save-flete').addEventListener('click', async function () {
        var b = Number(document.getElementById('inp-flete-base').value) || 18000;
        var k = Number(document.getElementById('inp-flete-km').value) || 1400;
        var rkm = Number(document.getElementById('inp-flete-radio').value) || 180;
        var r = await apiCall('POST', {
          action: 'save_config',
          tarifasFlete: { costoBaseFleteArs: b, costoPorKmArs: k, radioMaximoKm: rkm }
        });
        STATE.feedback = (r && r.message) || 'Tarifas guardadas.';
        await reloadData();
        renderDetailView('logistica');
      });
      return;
    }

    // 7. COMISIONES Y FINANZAS
    if (viewKey === 'liquidaciones') {
      body.innerHTML = feedbackHtml +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:1rem;margin-bottom:1.5rem;">' +
          '<div style="background:#fff;padding:1.25rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid #16a34a;">' +
            '<div style="font-size:0.85rem;color:#64748b;font-weight:600;text-transform:uppercase;">Comisión Plataforma (%)</div>' +
            '<div style="font-size:2rem;font-weight:700;color:#0f172a;margin-top:0.25rem;">' + (tarifas.comisionPlataformaPct || 3.5) + '%</div>' +
          '</div>' +
          '<div style="background:#fff;padding:1.25rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid #0d9488;">' +
            '<div style="font-size:0.85rem;color:#64748b;font-weight:600;text-transform:uppercase;">Recaudación Comisiones (ARS)</div>' +
            '<div style="font-size:1.8rem;font-weight:700;color:#0f172a;margin-top:0.25rem;">' + fmtArs.format(metrics.comisionArs || 0) + '</div>' +
          '</div>' +
          '<div style="background:#fff;padding:1.25rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid #2563eb;">' +
            '<div style="font-size:0.85rem;color:#64748b;font-weight:600;text-transform:uppercase;">Recaudación Comisiones (USD)</div>' +
            '<div style="font-size:1.8rem;font-weight:700;color:#0f172a;margin-top:0.25rem;">' + fmtUsd.format(metrics.comisionUsd || 0) + '</div>' +
          '</div>' +
        '</div>' +

        '<div style="background:#fff;padding:1.5rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">' +
          '<h3 style="margin:0 0 1rem 0;font-size:1.15rem;color:#0f172a;">⚙️ Configuración de Comisión de Plataforma</h3>' +
          '<div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;">' +
            '<input type="number" step="0.1" id="inp-comision-pct" value="' + (tarifas.comisionPlataformaPct || 3.5) + '" style="padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;width:120px;">' +
            '<button type="button" class="btn-primary" id="btn-save-comision">Actualizar Comisión</button>' +
          '</div>' +
          '<p style="color:#64748b;font-size:0.85rem;margin-top:0.75rem;">La comisión se calcula sobre el subtotal del insumo en cada pedido completado.</p>' +
        '</div>';

      document.getElementById('btn-save-comision').addEventListener('click', async function () {
        var pct = Number(document.getElementById('inp-comision-pct').value) || 3.5;
        var r = await apiCall('POST', {
          action: 'save_config',
          tarifasFlete: { comisionPlataformaPct: pct }
        });
        STATE.feedback = (r && r.message) || 'Comisión guardada.';
        await reloadData();
        renderDetailView('liquidaciones');
      });
      return;
    }

    // 8. CONFIGURACIÓN
    if (viewKey === 'configuracion') {
      body.innerHTML = feedbackHtml +
        '<div style="background:#fff;padding:1.5rem;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);max-width:680px;">' +
          '<h3 style="margin:0 0 1.25rem 0;font-size:1.15rem;color:#0f172a;">🚜 Parámetros Operativos de AppCaDi</h3>' +
          '<div style="margin-bottom:1rem;">' +
            '<label style="display:block;font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:0.25rem;">Nombre de la App:</label>' +
            '<input type="text" id="inp-cfg-nombre" value="' + esc(config.nombreApp || 'AppCaDi - Campo Directo') + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;">' +
          '</div>' +
          '<div style="margin-bottom:1rem;">' +
            '<label style="display:block;font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:0.25rem;">Slogan:</label>' +
            '<input type="text" id="inp-cfg-slogan" value="' + esc(config.slogan || '') + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;">' +
          '</div>' +
          '<div style="margin-bottom:1rem;">' +
            '<label style="display:block;font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:0.25rem;">WhatsApp Oficial de Soporte Rural:</label>' +
            '<input type="text" id="inp-cfg-ws" value="' + esc(config.soporteWhatsApp || '+5493585095475') + '" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;">' +
          '</div>' +
          '<div style="margin-bottom:1rem;">' +
            '<label style="display:block;font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:0.25rem;">Moneda Predeterminada:</label>' +
            '<select id="inp-cfg-moneda" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;">' +
              '<option value="ARS"' + (config.monedaDefault === 'ARS' ? ' selected' : '') + '>Pesos Argentinos (ARS)</option>' +
              '<option value="USD"' + (config.monedaDefault === 'USD' ? ' selected' : '') + '>Dólares Estadounidenses (USD)</option>' +
            '</select>' +
          '</div>' +
          '<div style="margin-bottom:1.5rem;">' +
            '<label style="display:block;font-size:0.85rem;font-weight:600;color:#475569;margin-bottom:0.25rem;">Modo de la Plataforma:</label>' +
            '<select id="inp-cfg-modo" style="width:100%;padding:0.5rem;border:1px solid #cbd5e1;border-radius:6px;">' +
              '<option value="online"' + (config.modoOperativo === 'online' ? ' selected' : '') + '>En Línea / Operativo</option>' +
              '<option value="mantenimiento"' + (config.modoOperativo === 'mantenimiento' ? ' selected' : '') + '>Mantenimiento</option>' +
            '</select>' +
          '</div>' +
          '<button type="button" class="btn-primary" id="btn-save-cfg" style="width:100%;">Guardar Parámetros de la App</button>' +
        '</div>';

      document.getElementById('btn-save-cfg').addEventListener('click', async function () {
        var n = document.getElementById('inp-cfg-nombre').value;
        var s = document.getElementById('inp-cfg-slogan').value;
        var w = document.getElementById('inp-cfg-ws').value;
        var m = document.getElementById('inp-cfg-moneda').value;
        var modo = document.getElementById('inp-cfg-modo').value;

        var r = await apiCall('POST', {
          action: 'save_config',
          configuracion: { nombreApp: n, slogan: s, soporteWhatsApp: w, monedaDefault: m, modoOperativo: modo }
        });
        STATE.feedback = (r && r.message) || 'Configuración guardada.';
        await reloadData();
        renderDetailView('configuracion');
      });
      return;
    }

    // 9. AUDITORÍA
    if (viewKey === 'auditoria') {
      var auditRows = auditoria.map(function (a) {
        return (
          '<tr style="border-bottom:1px solid #e2e8f0;">' +
            '<td style="padding:0.75rem 0.5rem;white-space:nowrap;color:#64748b;font-size:0.85rem;">' + fmtDate(a.fecha) + '</td>' +
            '<td style="padding:0.75rem 0.5rem;font-weight:600;color:#0f172a;">' + esc(a.usuario) + '</td>' +
            '<td style="padding:0.75rem 0.5rem;font-weight:600;color:#16a34a;">' + esc(a.accion) + '</td>' +
            '<td style="padding:0.75rem 0.5rem;color:#475569;">' + esc(a.detalle) + '</td>' +
          '</tr>'
        );
      }).join('');

      body.innerHTML = feedbackHtml +
        '<div style="background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow-x:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.9rem;">' +
            '<thead>' +
              '<tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;text-align:left;color:#475569;">' +
                '<th style="padding:0.75rem 0.5rem;">Fecha</th>' +
                '<th style="padding:0.75rem 0.5rem;">Usuario</th>' +
                '<th style="padding:0.75rem 0.5rem;">Acción</th>' +
                '<th style="padding:0.75rem 0.5rem;">Detalle</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              (auditRows || '<tr><td colspan="4" style="padding:2rem;text-align:center;color:#64748b;">No hay eventos de auditoría registrados.</td></tr>') +
            '</tbody>' +
          '</table>' +
        '</div>';
      return;
    }
  }

  // =========================================================================
  // MODALES Y FORMULARIOS RÁPIDOS
  // =========================================================================
  function promptNuevoInsumo() {
    var nombre = prompt('Nombre del Insumo (ej. Semillas de Soja DM 46E21):');
    if (!nombre) return;
    var marca = prompt('Marca del Insumo (ej. Don Mario / Bayer / Syngenta):') || 'Genérica';
    var cat = prompt('Categoría (agroquimicos, fertilizantes, semillas, repuestosMaquinaria, combustiblesLubricantes, boyerosAlambrados, sanidadVeterinaria):') || 'semillas';
    var precio = Number(prompt('Precio unitario en ARS:') || 0);
    var stock = Number(prompt('Stock disponible:') || 10);
    var unidad = prompt('Unidad de medida (Bolsas, Litros, Kg, Bidones 20L, Unidades):') || 'Bolsas';
    var estab = prompt('Establecimiento o Galpón (ej. La Rinconada):') || 'Establecimiento Rural';
    var esVecino = confirm('¿Es un Productor Vecino con excedente? (Aceptar = Productor Vecino, Cancelar = Agronomía Comercial)');

    apiCall('POST', {
      action: 'save_insumo',
      insumo: {
        nombre: nombre,
        marca: marca,
        categoria: cat,
        precioUnitario: precio,
        moneda: 'ARS',
        stockDisponible: stock,
        unidadMedida: unidad,
        vendedorEstablecimiento: estab,
        esProductorVecino: esVecino,
        ubicacionTexto: 'Zona Rural'
      }
    }).then(function (r) {
      STATE.feedback = (r && r.message) || 'Insumo guardado.';
      reloadData().then(function () { renderDetailView('insumos'); });
    });
  }

  function promptNuevoUsuario() {
    var nombre = prompt('Nombre Completo o Razón Social:');
    if (!nombre) return;
    var tel = prompt('Teléfono WhatsApp (ej. +54 9 358 1234567):');
    if (!tel) return;
    var estab = prompt('Nombre del Establecimiento Rural o Agronomía:');
    var loc = prompt('Localidad (ej. Río Cuarto, Pergamino, Sampacho):') || 'Zona Rural';
    var tipo = prompt('Tipo de usuario (productor / vendedor / mixto):') || 'productor';
    var cuit = prompt('CUIT / RENSPA:') || '';

    apiCall('POST', {
      action: 'save_usuario',
      usuario: {
        nombre: nombre,
        telefono: tel,
        nombreEstablecimiento: estab || nombre,
        localidad: loc,
        tipo: tipo,
        cuitRenspa: cuit
      }
    }).then(function (r) {
      STATE.feedback = (r && r.message) || 'Usuario guardado.';
      reloadData().then(function () { renderDetailView('productores'); });
    });
  }

  // =========================================================================
  // CONTROL DE VISTAS Y NAVEGACIÓN
  // =========================================================================
  async function openAppCadiView(viewKey) {
    var secs = ensureSections();
    if (!secs) return;

    STATE.view = viewKey;
    hideAllErpSections();

    var breadcrumb = document.getElementById('appcadi-detail-breadcrumb');
    if (breadcrumb) {
      var item = SUBMODULES.find(function (s) { return s.key === viewKey; });
      breadcrumb.innerHTML = 'AppCadi · <strong>' + esc(item ? item.label : viewKey) + '</strong>';
    }

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
          ? 'AppCadi'
          : 'AppCadi · ' + (meta ? meta.label : STATE.view);
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

  // =========================================================================
  // SINCRONIZACIÓN DE LA TARJETA PRINCIPAL (INICIO)
  // =========================================================================
  function syncHomeCard() {
    bindGlobalNavIntegration();
    var allowed = isGeneralAdmin();
    var grid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-appcadi-home-card');

    if (allowed && grid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-appcadi-home-card';
      card.className = 'module-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M7 20h10M12 20V4M12 4l-4 4M12 4l4 4"/>' +
          '</svg>' +
        '</div>' +
        '<h3>AppCadi</h3>';

      card.addEventListener('click', function () { openAppCadiView('menu'); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openAppCadiView('menu');
        }
      });

      var anchorCard =
        document.getElementById('ms-reikionline-home-card') ||
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
