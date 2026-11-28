/* ==========================================================================
   MÓDULO EXCLUSIVO DEL ADMINISTRADOR GENERAL (@danielg) — MINISISTEMAS A MEDIDA
   Submódulo integrado: Mate-Matica (www.mate-matica.com.ar) con toda la gestión
   integral del sitio en tiempo real:
   1. Carritos / Pedidos y Emisión de Presupuesto Oficial PDF A4 + WhatsApp
   2. ABM de Productos, Orden Web, Stock Unificado (<20 Bajo, 0 Sin Stock), 4 Precios y Fotos
   3. Condiciones Mayoristas (Listas 1, 2 y 3) y Configuración de Membrete
   4. Panel de Control (Ventas, Ranking, Filtros por Fecha y Stock Valorizado)
   5. Links Útiles y Accesos Directos a los canales de Mate-Mática
   Respeta estrictamente las tarjetas uniformes (.modules-grid / .module-card)
   sin badges, pills ni descripciones en las tarjetas de navegación.
   ========================================================================== */
(function () {
  'use strict';

  var SUBMODULES = [
    {
      key: 'mate_matica',
      label: 'Mate-Matica',
      icon:
        '<path d="M7 10h10v6a5 5 0 0 1-10 0v-6z"></path>' +
        '<path d="M15 3l-3 7"></path>' +
        '<circle cx="15.5" cy="2.5" r="1"></circle>' +
        '<path d="M6 21h12"></path>'
    }
  ];

  var DEFAULT_BRANDS = [
    'Canarias',
    'Armiño',
    'Rei Verde',
    'Sara',
    'Baldo',
    'Barão',
    'Verdecita',
    'Otras Marcas'
  ];

  var STATE = {
    view: 'menu', // 'menu' | 'mate_matica'
    tab: 'orders', // 'orders' | 'products' | 'conditions' | 'dashboard' | 'links'
    loading: false,
    saving: false,
    feedback: '',
    isError: false,
    catalog: null,
    orders: [],
    editingOrderId: null,
    ordersSearch: '',
    ordersPage: 1,
    productSearch: '',
    productBrandFilter: 'ALL',
    productStockFilter: 'ALL',
    productFormOpen: false,
    editingProductId: null,
    draftImageDataUrl: '',
    dashStatusFilter: 'all',
    dashStockTier: 'minorista',
    globalNavBound: false,
    factMode: 'minorista', // 'minorista' (default) | 'mayorista'
    factRule: 'auto', // 'auto' | 'lista1' | 'lista2' | 'lista3'
    factItems: [], // [{ productId, qty, customPrice }]
    factCustName: 'CONSUMIDOR FINAL',
    factCustPhone: '',
    factCustCity: 'RIO CUARTO',
    factPayment: 'Efectivo',
    factShipping: 0,
    factSearch: ''
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

  function formatThousandsAr(num) {
    var n = Math.round(Number(num) || 0);
    return n.toLocaleString('es-AR');
  }

  function formatCurrencyPdf(num) {
    var n = Number(num) || 0;
    return n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function parsePriceInputAr(rawVal) {
    if (typeof rawVal === 'number') return Math.max(0, Math.round(rawVal));
    var cleaned = String(rawVal == null ? '' : rawVal)
      .replace(/\./g, '')
      .replace(/[^0-9,-]/g, '')
      .replace(',', '.');
    return Math.max(0, Math.round(parseFloat(cleaned) || 0));
  }

  function formatTodayDdMmYyyy() {
    var d = new Date();
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var yyyy = d.getFullYear();
    return dd + '/' + mm + '/' + yyyy;
  }

  function normalizeDateDdMmYyyy(rawDate) {
    var s = String(rawDate || '').trim();
    if (!s) return formatTodayDdMmYyyy();
    var parts = s.split(/[\/\-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return parts[2].padStart(2, '0') + '/' + parts[1].padStart(2, '0') + '/' + parts[0];
      }
      var p0 = parseInt(parts[0], 10);
      var p1 = parseInt(parts[1], 10);
      var yyyy = parts[2];
      if (p0 >= 1 && p0 <= 12 && p1 > 12 && p1 <= 31) {
        return String(p1).padStart(2, '0') + '/' + String(p0).padStart(2, '0') + '/' + yyyy;
      }
      if (p0 >= 1 && p0 <= 31 && p1 >= 1 && p1 <= 12) {
        return String(p0).padStart(2, '0') + '/' + String(p1).padStart(2, '0') + '/' + yyyy;
      }
    }
    return s;
  }

  function resolveMateAsset(relPath) {
    var s = String(relPath || '').trim();
    if (!s) return 'https://www.mate-matica.com.ar/assets/images/logo.png';
    if (s.indexOf('data:') === 0 || s.indexOf('http://') === 0 || s.indexOf('https://') === 0) {
      return s;
    }
    return 'https://www.mate-matica.com.ar/' + s.replace(/^(\.\/|\.\.\/|\/)+/, '');
  }

  function getProductStock(product) {
    if (!product || typeof product !== 'object') return 0;
    var raw = product.stock;
    if (raw === undefined || raw === null || raw === '') return 50;
    var num = Number(raw);
    return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 50;
  }

  function isGeneralAdmin() {
    var isBaseTenant = Boolean(
      (window.__ERP_TENANT_BOOT__ && window.__ERP_TENANT_BOOT__.isBase) ||
        (window.ERP_BRAND && window.ERP_BRAND.isBase)
    );
    if (!isBaseTenant) return false;
    var user =
      typeof window.__MS_GET_ACTIVE_USER__ === 'function'
        ? window.__MS_GET_ACTIVE_USER__()
        : null;
    if (!user) {
      try {
        var pfx = (window.ERP_BRAND && window.ERP_BRAND.storagePrefix) || 'ms_minisistema_';
        var raw =
          sessionStorage.getItem(pfx + 'erp_active_admin_v1') ||
          localStorage.getItem(pfx + 'erp_active_admin_v1');
        if (raw) user = JSON.parse(raw);
      } catch (_e) {}
    }
    if (!user) return false;
    var u = String(user.username || '').trim().toLowerCase();
    var r = String(user.role || '').trim().toLowerCase();
    return (
      u === 'danielg' ||
      u === 'danielg@minisistema.com.ar' ||
      r === 'administrador general'
    );
  }

  function getApiBase() {
    var boot = window.__ERP_TENANT_BOOT__;
    if (boot && !boot.isBase && boot.optionType === 2 && boot.slug) {
      return '/' + encodeURIComponent(boot.slug) + '/api/mate_matica';
    }
    return '/sistema/api/mate_matica';
  }

  async function apiMateMatica(method, payload) {
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

    var secMenu = document.getElementById('sec-menu-minisistemas-medida');
    if (secMenu && secMenu.parentNode !== erpMain) {
      erpMain.appendChild(secMenu);
    }
    if (!secMenu) {
      secMenu = document.createElement('section');
      secMenu.id = 'sec-menu-minisistemas-medida';
      secMenu.className = 'erp-section';
      secMenu.hidden = true;
      secMenu.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="mm-back-home">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">Administrador General · <strong>MiniSistemas a Medida</strong></span>' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" id="mm-submodules-grid" aria-label="Submódulos de MiniSistemas a Medida"></div>';
      erpMain.appendChild(secMenu);
      secMenu.querySelector('#mm-back-home').addEventListener('click', closeToHome);
    }

    var secDetail = document.getElementById('sec-minisistemas-medida-detail');
    if (secDetail && secDetail.parentNode !== erpMain) {
      erpMain.appendChild(secDetail);
    }
    if (!secDetail) {
      secDetail = document.createElement('section');
      secDetail.id = 'sec-minisistemas-medida-detail';
      secDetail.className = 'erp-section';
      secDetail.hidden = true;
      secDetail.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="mm-back-menu">← Volver a MiniSistemas a Medida</button>' +
            '<span class="module-breadcrumb">MiniSistemas a Medida · <strong id="mm-breadcrumb">Mate-Matica</strong></span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
            '<a href="https://www.mate-matica.com.ar/clientes" target="_blank" rel="noopener noreferrer" style="padding:6px 12px;border-radius:8px;background:#1C4328;color:#EFECE1;font-size:12px;font-weight:700;text-decoration:none;">🛍️ Tienda Clientes ↗</a>' +
            '<a href="https://www.mate-matica.com.ar/comercio" target="_blank" rel="noopener noreferrer" style="padding:6px 12px;border-radius:8px;background:#2C603B;color:#EFECE1;font-size:12px;font-weight:700;text-decoration:none;">📦 Canal Comercio ↗</a>' +
            '<a href="https://www.mate-matica.com.ar/administrador" target="_blank" rel="noopener noreferrer" style="padding:6px 12px;border-radius:8px;border:1px solid #1C4328;background:#EFECE1;color:#1C4328;font-size:12px;font-weight:800;text-decoration:none;">⚙️ Admin Web ↗</a>' +
          '</div>' +
        '</div>' +
        '<div id="mm-detail-body" style="padding:12px 0;"></div>';
      erpMain.appendChild(secDetail);
      secDetail.querySelector('#mm-back-menu').addEventListener('click', function () {
        openMmView('menu');
      });
    }

    return { menuSec: secMenu, detailSec: secDetail };
  }

  function bindGlobalNavIntegration() {
    if (STATE.globalNavBound) return;
    STATE.globalNavBound = true;

    document.addEventListener(
      'click',
      function (ev) {
        var target = ev.target;
        if (!target || typeof target.closest !== 'function') return;

        var navEl = target.closest(
          '#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-megasistemas-home-card, #ms-appcadi-home-card, #ms-campodirecto-home-card, #ms-clubfidel-home-card, #ms-cv-home-card, #ms-personal-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card'
        );
        if (!navEl) return;

        var menuSec = document.getElementById('sec-menu-minisistemas-medida');
        var detailSec = document.getElementById('sec-minisistemas-medida-detail');
        var isMmActive = Boolean(
          (menuSec && !menuSec.hidden) || (detailSec && !detailSec.hidden)
        );

        if (navEl.id === 'btn-topbar-back-facturacion' && isMmActive) {
          ev.preventDefault();
          ev.stopPropagation();
          if (detailSec && !detailSec.hidden) {
            openMmView('menu');
          } else {
            closeToHome();
          }
          return;
        }

        if (menuSec) menuSec.hidden = true;
        if (detailSec) detailSec.hidden = true;
      },
      true
    );
  }

  function renderSubmodulesMenu() {
    var grid = document.getElementById('mm-submodules-grid');
    if (!grid) return;
    grid.innerHTML = SUBMODULES.map(function (s) {
      return (
        '<article class="module-card" role="button" tabindex="0" data-mm-sub="' + esc(s.key) + '">' +
          '<div class="module-icon" aria-hidden="true">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              s.icon +
            '</svg>' +
          '</div>' +
          '<h3>' + esc(s.label) + '</h3>' +
        '</article>'
      );
    }).join('');

    grid.querySelectorAll('[data-mm-sub]').forEach(function (card) {
      var key = card.getAttribute('data-mm-sub');
      card.addEventListener('click', function () {
        openMmView(key);
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openMmView(key);
        }
      });
    });
  }

  function ensureCatalogDefaults(rawCatalog) {
    var cat = rawCatalog && typeof rawCatalog === 'object' ? rawCatalog : {};
    cat.config = Object.assign(
      {
        businessName: 'Mate-Mática',
        tagline: 'Yerbas Importadas y Accesorios',
        ownerLine1: 'NEHUEN VILLANUEVA CHIARIOTTI',
        ownerLine2: '',
        addressLine1: 'MARCONI 853',
        cityProvince: 'RIO CUARTO-CORDOBA',
        country: 'ARGENTINA',
        whatsappNumber: '5493584866586',
        nextQuoteNumber: 2292
      },
      cat.config || {}
    );
    cat.conditions = Object.assign(
      {
        lista1: {
          id: 'lista1',
          name: 'Precio Lista 1',
          minTotalUnits: 10,
          maxTotalUnits: 19,
          description: 'Entre 10 y 19 unidades surtidas en total'
        },
        lista2: {
          id: 'lista2',
          name: 'Precio Lista 2',
          minTotalUnits: 20,
          maxTotalUnits: 999999,
          description: '20 o más unidades surtidas en total'
        },
        lista3: {
          id: 'lista3',
          name: 'Precio Lista 3',
          minTotalUnits: 50,
          minSameProductUnits: 5,
          description: 'Mínimo 5 unidades iguales por producto (Compra mínima 50 unidades en total)'
        }
      },
      cat.conditions || {}
    );
    cat.products = Array.isArray(cat.products)
      ? cat.products.map(function (p, idx) {
          return Object.assign({}, p, {
            stock: getProductStock(p),
            webOrder: Number.isFinite(Number(p.webOrder)) ? Number(p.webOrder) : idx + 1
          });
        })
      : [];
    cat.brands = Array.isArray(cat.brands) && cat.brands.length > 0 ? cat.brands : DEFAULT_BRANDS;
    return cat;
  }

  function computeNextQuoteNumber(orders) {
    if (!Array.isArray(orders) || orders.length === 0) return 2291;
    var max = null;
    orders.forEach(function (o) {
      var n = parseInt(o && o.quoteNumber, 10);
      if (Number.isFinite(n) && n > 0) {
        if (max === null || n > max) max = n;
      }
    });
    return max === null ? 2291 : max + 1;
  }

  function getOrderDesiredDeductionMap(order) {
    var map = {};
    if (!order || !Array.isArray(order.items)) return map;
    var products = (STATE.catalog && STATE.catalog.products) || [];
    order.items.forEach(function (item) {
      if (item.confirmed === false) return;
      var prod =
        products.find(function (p) { return p.id === item.productId; }) ||
        products.find(function (p) { return p.code === item.code; });
      var key = prod ? prod.id : item.productId;
      if (!key) return;
      var q = Math.max(0, parseInt(item.qty, 10) || 0);
      if (q > 0) map[key] = (map[key] || 0) + q;
    });
    return map;
  }

  function reconcileOrderStock(order) {
    if (!order || !STATE.catalog || !Array.isArray(STATE.catalog.products)) return false;
    var prevMap =
      order.stockDeductedMap && typeof order.stockDeductedMap === 'object'
        ? order.stockDeductedMap
        : {};
    var nextMap = getOrderDesiredDeductionMap(order);
    var allKeys = {};
    Object.keys(prevMap).forEach(function (k) { allKeys[k] = true; });
    Object.keys(nextMap).forEach(function (k) { allKeys[k] = true; });
    var changed = false;
    var nowMs = Date.now();

    Object.keys(allKeys).forEach(function (prodId) {
      var prevQty = Number(prevMap[prodId]) || 0;
      var nextQty = Number(nextMap[prodId]) || 0;
      var delta = nextQty - prevQty;
      if (delta !== 0) {
        var prod = STATE.catalog.products.find(function (p) { return p.id === prodId; });
        if (prod) {
          prod.stock = Math.max(0, getProductStock(prod) - delta);
          prod.stockUpdatedAt = nowMs;
          changed = true;
        }
      }
    });

    order.stockDeducted = true;
    order.stockDeductedMap = nextMap;
    return changed;
  }

  async function reloadData(showSuccessMsg) {
    STATE.loading = true;
    renderMateMaticaDetail();
    try {
      var res = await apiMateMatica('GET');
      STATE.loading = false;
      if (!res || !res.ok) {
        STATE.feedback = (res && res.message) || 'No se pudo sincronizar con Mate-Mática.';
        STATE.isError = true;
        renderMateMaticaDetail();
        return;
      }
      STATE.catalog = ensureCatalogDefaults(res.catalog);
      STATE.orders = (Array.isArray(res.orders) ? res.orders : []).map(function (o) {
        var norm = Object.assign({}, o, { date: normalizeDateDdMmYyyy(o.date) });
        if (!norm.stockDeducted && !norm.stockDeductedMap) {
          norm.stockDeducted = true;
          norm.stockDeductedMap = getOrderDesiredDeductionMap(norm);
        }
        return norm;
      });
      if (!STATE.editingOrderId && STATE.orders.length > 0) {
        STATE.editingOrderId = STATE.orders[0].id;
      } else if (
        STATE.editingOrderId &&
        !STATE.orders.some(function (o) { return o.id === STATE.editingOrderId; })
      ) {
        STATE.editingOrderId = STATE.orders[0] ? STATE.orders[0].id : null;
      }
      if (showSuccessMsg) {
        STATE.feedback = '🔄 Datos sincronizados en vivo con www.mate-matica.com.ar.';
        STATE.isError = false;
      }
    } catch (err) {
      STATE.loading = false;
      STATE.feedback = 'Error de red al conectar con Mate-Mática.';
      STATE.isError = true;
    }
    renderMateMaticaDetail();
  }

  async function saveAllToCloud(successMessage, extraPayload) {
    if (!STATE.catalog) return;
    STATE.saving = true;
    STATE.catalog.updatedAt = Date.now();
    try {
      var payload = Object.assign(
        {
          action: 'save_all',
          catalog: STATE.catalog,
          orders: STATE.orders
        },
        extraPayload || {}
      );
      var res = await apiMateMatica('POST', payload);
      STATE.saving = false;
      if (res && res.ok) {
        if (res.catalog) STATE.catalog = ensureCatalogDefaults(res.catalog);
        if (Array.isArray(res.orders)) {
          STATE.orders = res.orders.map(function (o) {
            return Object.assign({}, o, { date: normalizeDateDdMmYyyy(o.date) });
          });
        }
        if (successMessage) {
          STATE.feedback = successMessage;
          STATE.isError = false;
        }
      } else {
        STATE.feedback = (res && (res.message || res.error)) || 'Error guardando en Mate-Mática.';
        STATE.isError = true;
      }
    } catch (_err) {
      STATE.saving = false;
      STATE.feedback = 'Error de conexión al guardar cambios en Mate-Mática.';
      STATE.isError = true;
    }
    renderMateMaticaDetail();
  }

  function openOfficialMateMaticaPdf(order) {
    if (!order || !STATE.catalog) return;
    var cfg = STATE.catalog.config || {};
    var confirmedItems = (order.items || []).filter(function (i) {
      return i.confirmed !== false;
    });
    var totalPackages = confirmedItems.reduce(function (s, i) {
      return s + (Number(i.qty) || 0);
    }, 0);
    var totalYerba = confirmedItems.reduce(function (s, i) {
      return s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0);
    }, 0);
    var shipping = Number(order.shippingCost) || 0;
    var grandTotal = totalYerba + shipping;
    var logoUrl = 'https://www.mate-matica.com.ar/assets/images/logo.png';

    var minRows = 16;
    var itemRowsHtml = confirmedItems
      .map(function (it) {
        var sub = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
        return (
          '<tr>' +
            '<td class="desc">' + esc(it.name) + '</td>' +
            '<td class="cant">' + esc(it.qty) + '</td>' +
            '<td class="money"><span>$</span><span>' + formatCurrencyPdf(it.unitPrice) + '</span></td>' +
            '<td class="money"><span>$</span><span>' + formatCurrencyPdf(sub) + '</span></td>' +
          '</tr>'
        );
      })
      .join('');

    var emptyCount = Math.max(0, minRows - confirmedItems.length);
    var emptyRowsHtml = '';
    for (var r = 0; r < emptyCount; r++) {
      emptyRowsHtml +=
        '<tr>' +
          '<td class="desc">&nbsp;</td>' +
          '<td class="cant">&nbsp;</td>' +
          '<td class="money"><span>$</span><span>-</span></td>' +
          '<td class="money"><span>$</span><span>-</span></td>' +
        '</tr>';
    }

    var win = window.open('', '_blank');
    if (!win) {
      STATE.feedback = 'Habilitá las ventanas emergentes para imprimir/guardar el Presupuesto PDF.';
      STATE.isError = true;
      renderMateMaticaDetail();
      return;
    }

    var html =
      '<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8">' +
      '<title>Presupuesto_MateMatica_' + esc(order.quoteNumber) + '</title>' +
      '<style>' +
        '@page { size: A4 portrait; margin: 10mm; }' +
        'body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 12px; background: #fff; }' +
        '.sheet { max-width: 780px; margin: 0 auto; border: 2px solid #000; }' +
        '.top-grid { display: grid; grid-template-columns: 165px 1fr 220px; border-bottom: 2px solid #000; }' +
        '.logo-box { display: flex; align-items: center; justify-content: center; padding: 10px; border-right: 2px solid #000; }' +
        '.logo-box img { width: 120px; height: 120px; object-fit: contain; border-radius: 50%; }' +
        '.owner-box { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 10px; border-right: 2px solid #000; font-weight: 700; font-size: 14px; line-height: 1.45; }' +
        '.quote-box { display: flex; flex-direction: column; justify-content: space-between; }' +
        '.quote-title { text-align: center; font-weight: 900; font-size: 16px; padding: 14px 8px; border-bottom: 2px solid #000; }' +
        '.quote-date { display: flex; justify-content: space-between; padding: 10px 14px; font-weight: 700; font-size: 14px; }' +
        'table { width: 100%; border-collapse: collapse; }' +
        '.cust-table td { padding: 6px 10px; font-size: 13px; font-weight: 700; border-bottom: 1px solid #000; }' +
        '.items-table th { background: #fff; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 7px 8px; font-size: 13px; font-weight: 900; }' +
        '.items-table td { border-bottom: 1px solid #000; padding: 5px 8px; font-size: 13px; font-weight: 700; }' +
        '.items-table td.desc { border-right: 2px solid #000; }' +
        '.items-table td.cant { text-align: center; width: 65px; border-right: 1px solid #000; }' +
        '.items-table td.money { width: 135px; border-right: 1px solid #000; }' +
        '.items-table td.money:last-child { border-right: none; }' +
        '.items-table td.money { display: table-cell; }' +
        '.money-inner { display: flex; justify-content: space-between; }' +
        '.footer-grid { display: grid; grid-template-columns: 165px 1fr 165px; border-top: 2px solid #000; align-items: center; }' +
        '.totals-table td { padding: 10px 12px; font-weight: 900; font-size: 14px; border-bottom: 1px solid #000; }' +
        '.totals-table tr:last-child td { border-bottom: none; }' +
        '.no-print { text-align: right; max-width: 780px; margin: 0 auto 10px; }' +
        '@media print { .no-print { display: none; } }' +
      '</style></head><body>' +
      '<div class="no-print"><button onclick="window.print()" style="padding:8px 16px;background:#1C4328;color:#fff;border:none;border-radius:6px;font-weight:800;cursor:pointer;">🖨️ Imprimir / Guardar como PDF A4</button></div>' +
      '<div class="sheet">' +
        '<div class="top-grid">' +
          '<div class="logo-box"><img src="' + logoUrl + '" alt="Mate-Mática"></div>' +
          '<div class="owner-box">' +
            '<div>' + esc(cfg.ownerLine1 || 'NEHUEN VILLANUEVA CHIARIOTTI') + '</div>' +
            (cfg.ownerLine2 ? '<div>' + esc(cfg.ownerLine2) + '</div>' : '') +
            '<div>' + esc(cfg.addressLine1 || 'MARCONI 853') + '</div>' +
            '<div>' + esc(cfg.cityProvince || 'RIO CUARTO-CORDOBA') + '</div>' +
            '<div>' + esc(cfg.country || 'ARGENTINA') + '</div>' +
          '</div>' +
          '<div class="quote-box">' +
            '<div class="quote-title">PRESUPUESTO N°' + esc(order.quoteNumber) + '</div>' +
            '<div class="quote-date"><span>FECHA</span><span>' + esc(normalizeDateDdMmYyyy(order.date)) + '</span></div>' +
          '</div>' +
        '</div>' +
        '<table class="cust-table"><tbody>' +
          '<tr><td style="width:110px;">SEÑOR:</td><td>' + esc((order.customer && order.customer.name) || '') + '</td><td style="width:110px;">PROVINCIA:</td><td>' + esc((order.customer && order.customer.province) || '') + '</td></tr>' +
          '<tr><td>DOMICILIO:</td><td>' + esc((order.customer && order.customer.address) || '') + '</td><td>TELEFONO:</td><td style="text-align:right;">' + esc((order.customer && order.customer.phone) || '') + '</td></tr>' +
          '<tr><td>LOCALIDAD:</td><td>' + esc((order.customer && order.customer.city) || '') + '</td><td colspan="2">&nbsp;</td></tr>' +
        '</tbody></table>' +
        '<table class="items-table">' +
          '<thead><tr><th style="border-right:2px solid #000;">DESCRIPCIÓN</th><th>CANT</th><th>P. UNITARIO</th><th>SUB TOTAL</th></tr></thead>' +
          '<tbody>' +
            confirmedItems
              .map(function (it) {
                var sub = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
                return (
                  '<tr>' +
                    '<td class="desc">' + esc(it.name) + '</td>' +
                    '<td class="cant">' + esc(it.qty) + '</td>' +
                    '<td class="money"><div class="money-inner"><span>$</span><span>' + formatCurrencyPdf(it.unitPrice) + '</span></div></td>' +
                    '<td class="money"><div class="money-inner"><span>$</span><span>' + formatCurrencyPdf(sub) + '</span></div></td>' +
                  '</tr>'
                );
              })
              .join('') +
            Array.from({ length: emptyCount })
              .map(function () {
                return (
                  '<tr>' +
                    '<td class="desc">&nbsp;</td>' +
                    '<td class="cant">&nbsp;</td>' +
                    '<td class="money"><div class="money-inner"><span>$</span><span>-</span></div></td>' +
                    '<td class="money"><div class="money-inner"><span>$</span><span>-</span></div></td>' +
                  '</tr>'
                );
              })
              .join('') +
            '<tr>' +
              '<td class="desc" style="text-align:center;">ENVIO</td>' +
              '<td class="cant">&nbsp;</td>' +
              '<td class="money">&nbsp;</td>' +
              '<td class="money"><div class="money-inner"><span>$</span><span>' + (shipping > 0 ? formatCurrencyPdf(shipping) : '-') + '</span></div></td>' +
            '</tr>' +
          '</tbody>' +
        '</table>' +
        '<div class="footer-grid">' +
          '<div class="logo-box"><img src="' + logoUrl + '" alt="Mate-Mática"></div>' +
          '<div style="border-right:2px solid #000;">' +
            '<table class="totals-table"><tbody>' +
              '<tr><td style="border-right:1px solid #000;text-align:center;width:58%;">CANTIDAD DE PAQUETES</td><td style="text-align:center;">' + totalPackages + '</td></tr>' +
              '<tr><td style="border-right:1px solid #000;text-align:center;">TOTAL YERBA</td><td><div class="money-inner"><span>$</span><span>' + formatCurrencyPdf(totalYerba) + '</span></div></td></tr>' +
              '<tr><td style="border-right:1px solid #000;text-align:center;">TOTAL</td><td><div class="money-inner"><span>$</span><span>' + formatCurrencyPdf(grandTotal) + '</span></div></td></tr>' +
            '</tbody></table>' +
          '</div>' +
          '<div class="logo-box" style="border-right:none;"><img src="' + logoUrl + '" alt="Mate-Mática"></div>' +
        '</div>' +
      '</div></body></html>';

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function sendQuoteToCustomerWhatsApp(order) {
    if (!order) return;
    var confirmedItems = (order.items || []).filter(function (i) { return i.confirmed !== false; });
    var totalPackages = confirmedItems.reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
    var totalYerba = confirmedItems.reduce(function (s, i) { return s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0); }, 0);
    var shipping = Number(order.shippingCost) || 0;
    var grandTotal = totalYerba + shipping;

    var lines = [];
    lines.push('🧉 *MATE-MÁTICA · PRESUPUESTO CONFIRMADO N°' + order.quoteNumber + '*');
    lines.push('📅 *Fecha:* ' + normalizeDateDdMmYyyy(order.date));
    lines.push('👤 *Señor/a:* ' + ((order.customer && order.customer.name) || ''));
    lines.push('📍 *Localidad:* ' + ((order.customer && order.customer.city) || '') + ' (' + ((order.customer && order.customer.province) || '') + ')');
    lines.push('─────────────────────');
    confirmedItems.forEach(function (it) {
      var sub = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
      lines.push('✅ *' + it.qty + ' u.* x ' + it.name + ' ($' + formatCurrencyPdf(it.unitPrice) + ') = *$' + formatCurrencyPdf(sub) + '*');
    });
    lines.push('─────────────────────');
    lines.push('📦 *CANTIDAD DE PAQUETES:* ' + totalPackages);
    if (shipping > 0) lines.push('🚚 *ENVÍO:* $' + formatCurrencyPdf(shipping));
    lines.push('💰 *TOTAL FINAL:* *$' + formatCurrencyPdf(grandTotal) + '*');
    lines.push('─────────────────────');
    lines.push('📍 Marconi 853, Río Cuarto, Córdoba');

    var rawPhone = String((order.customer && order.customer.phone) || '').replace(/\D/g, '');
    if (rawPhone && rawPhone.indexOf('54') !== 0) {
      rawPhone = '549' + rawPhone.replace(/^0+/, '');
    }
    var waUrl = rawPhone
      ? 'https://api.whatsapp.com/send?phone=' + rawPhone + '&text=' + encodeURIComponent(lines.join('\n'))
      : 'https://api.whatsapp.com/send?text=' + encodeURIComponent(lines.join('\n'));
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  function renderMateMaticaDetail() {
    var body = document.getElementById('mm-detail-body');
    if (!body) return;

    if (STATE.loading && !STATE.catalog) {
      body.innerHTML =
        '<div style="background:#fff;border:1px solid #d1dfd5;border-radius:12px;padding:24px;text-align:center;color:#1C4328;font-weight:800;">' +
          '🧉 Conectando en vivo con Mate-Mática (www.mate-matica.com.ar)...' +
        '</div>';
      return;
    }

    var cat = ensureCatalogDefaults(STATE.catalog);
    var products = cat.products || [];
    var orders = STATE.orders || [];

    var lowStockCount = products.filter(function (p) {
      var st = getProductStock(p);
      return p.active !== false && st > 0 && st < 20;
    }).length;
    var outOfStockCount = products.filter(function (p) {
      return p.active !== false && getProductStock(p) <= 0;
    }).length;
    var confirmedOrdersCount = orders.filter(function (o) { return o.status === 'confirmed'; }).length;

    var feedbackBanner = STATE.feedback
      ? '<div style="margin-bottom:12px;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:700;background:' +
          (STATE.isError ? '#FEE2E2;color:#991B1B;border:1px solid #F87171;' : '#DCFCE7;color:#166534;border:1px solid #4ADE80;') +
        '">' +
          esc(STATE.feedback) +
        '</div>'
      : '';

    var navTabs =
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;background:#1C4328;padding:12px 16px;border-radius:12px;margin-bottom:14px;color:#EFECE1;">' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
          '<img src="https://www.mate-matica.com.ar/assets/images/logo.png" alt="Mate-Mática" style="width:52px;height:52px;border-radius:50%;border:2px solid #769D61;background:#EFECE1;object-fit:cover;">' +
          '<div>' +
            '<div style="font-size:18px;font-weight:900;color:#EFECE1;">Mate-Mática · Administración Central</div>' +
            '<div style="font-size:12px;color:#C5DFB6;">' +
              orders.length + ' presupuestos (' + confirmedOrdersCount + ' confirmados) · ' +
              products.length + ' productos · ' +
              (outOfStockCount > 0 ? '<span style="color:#FCA5A5;font-weight:800;">' + outOfStockCount + ' Sin Stock</span> · ' : '') +
              (lowStockCount > 0 ? '<span style="color:#FDE68A;font-weight:800;">' + lowStockCount + ' Stock Bajo (&lt;20)</span>' : 'Stock al día') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          [
            ['facturacion', '🧾 Facturación (Caja)'],
            ['orders', '📋 1. Carritos / Pedidos y PDF'],
            ['products', '🧉 2. ABM Productos, Precios y Stock'],
            ['conditions', '⚖️ 3. Condiciones Mayoristas'],
            ['dashboard', '📊 4. Panel de Control'],
            ['links', '🔗 5. Links Útiles']
          ]
            .map(function (pair) {
              var active = STATE.tab === pair[0];
              return (
                '<button type="button" data-mm-tab="' + pair[0] + '" style="cursor:pointer;padding:8px 13px;border-radius:8px;font-size:12px;font-weight:800;border:1px solid ' +
                  (active ? '#EFECE1' : 'rgba(197,223,182,0.4)') +
                  ';background:' +
                  (active ? '#EFECE1' : 'rgba(255,255,255,0.1)') +
                  ';color:' +
                  (active ? '#1C4328' : '#EFECE1') +
                ';">' +
                  pair[1] +
                '</button>'
              );
            })
            .join('') +
          '<button type="button" id="mm-btn-sync" style="cursor:pointer;padding:8px 13px;border-radius:8px;font-size:12px;font-weight:800;border:1px solid #769D61;background:#769D61;color:#fff;">🔄 Sincronizar</button>' +
        '</div>' +
      '</div>';

    var tabContentHtml = '';
    if (STATE.tab === 'facturacion') {
      tabContentHtml = renderFacturacionTabHtml(cat, products, orders);
    } else if (STATE.tab === 'orders') {
      tabContentHtml = renderOrdersTabHtml(cat, products, orders);
    } else if (STATE.tab === 'products') {
      tabContentHtml = renderProductsTabHtml(cat, products);
    } else if (STATE.tab === 'conditions') {
      tabContentHtml = renderConditionsTabHtml(cat);
    } else if (STATE.tab === 'dashboard') {
      tabContentHtml = renderDashboardTabHtml(cat, products, orders);
    } else {
      tabContentHtml = renderLinksTabHtml();
    }

    body.innerHTML = feedbackBanner + navTabs + tabContentHtml;
    bindMateMaticaEvents(body, cat, products, orders);
  }

  function computeMmFacturacionPricing(cat, products) {
    var c1 = (cat.conditions && cat.conditions.lista1) || { minTotalUnits: 10, maxTotalUnits: 19, name: 'Precio Lista 1', description: '' };
    var c2 = (cat.conditions && cat.conditions.lista2) || { minTotalUnits: 20, name: 'Precio Lista 2', description: '' };
    var c3 = (cat.conditions && cat.conditions.lista3) || { minTotalUnits: 50, minSameProductUnits: 5, name: 'Precio Lista 3', description: '' };

    var valid = [];
    (STATE.factItems || []).forEach(function (entry) {
      var prod = products.find(function (p) { return p.id === entry.productId && p.active !== false; });
      if (!prod) return;
      var st = getProductStock(prod);
      if (st <= 0) return;
      var q = Math.max(1, Math.min(st, parseInt(entry.qty, 10) || 1));
      entry.qty = q;
      valid.push({ entry: entry, prod: prod, stock: st, qty: q });
    });

    var totalUnits = valid.reduce(function (s, x) { return s + x.qty; }, 0);
    var activeTierLabel = 'Precio Minorista';

    if (STATE.factMode === 'mayorista') {
      if (STATE.factRule === 'lista1') activeTierLabel = 'Mayorista · Lista 1';
      else if (STATE.factRule === 'lista2') activeTierLabel = 'Mayorista · Lista 2';
      else if (STATE.factRule === 'lista3') activeTierLabel = 'Mayorista · Lista 3';
      else {
        if (totalUnits >= (c3.minTotalUnits || 50) && valid.some(function (x) { return x.qty >= (c3.minSameProductUnits || 5); })) {
          activeTierLabel = 'Mayorista Automático · Lista 3 / Lista 2';
        } else if (totalUnits >= (c2.minTotalUnits || 20)) {
          activeTierLabel = 'Mayorista Automático · Lista 2';
        } else if (totalUnits >= (c1.minTotalUnits || 10)) {
          activeTierLabel = 'Mayorista Automático · Lista 1';
        } else {
          activeTierLabel = 'Mayorista Automático (<10 u. · Aplica Minorista)';
        }
      }
    }

    var lines = valid.map(function (v) {
      var p = v.prod;
      var q = v.qty;
      var autoP = p.priceMinorista;
      var tLabel = 'Minorista';

      if (STATE.factMode === 'mayorista') {
        if (STATE.factRule === 'lista1') { autoP = p.priceLista1; tLabel = 'Lista 1'; }
        else if (STATE.factRule === 'lista2') { autoP = p.priceLista2; tLabel = 'Lista 2'; }
        else if (STATE.factRule === 'lista3') { autoP = p.priceLista3; tLabel = 'Lista 3'; }
        else {
          if (totalUnits >= (c3.minTotalUnits || 50) && q >= (c3.minSameProductUnits || 5)) {
            autoP = p.priceLista3; tLabel = 'Lista 3';
          } else if (totalUnits >= (c2.minTotalUnits || 20)) {
            autoP = p.priceLista2; tLabel = 'Lista 2';
          } else if (totalUnits >= (c1.minTotalUnits || 10)) {
            autoP = p.priceLista1; tLabel = 'Lista 1';
          } else {
            autoP = p.priceMinorista; tLabel = 'Minorista';
          }
        }
      }

      var unitP = (Number(v.entry.customPrice) > 0) ? Number(v.entry.customPrice) : Number(autoP) || 0;
      return {
        productId: p.id,
        code: p.code,
        name: p.name,
        stock: v.stock,
        qty: q,
        unitPrice: unitP,
        tierLabel: tLabel,
        subtotal: q * unitP
      };
    });

    var merch = lines.reduce(function (s, l) { return s + l.subtotal; }, 0);
    var ship = Math.max(0, Number(STATE.factShipping) || 0);
    return {
      lines: lines,
      totalUnits: totalUnits,
      merchandiseTotal: merch,
      shipping: ship,
      grandTotal: merch + ship,
      activeTierLabel: activeTierLabel
    };
  }

  function renderFacturacionTabHtml(cat, products, orders) {
    var calc = computeMmFacturacionPricing(cat, products);
    var nextNum = computeNextQuoteNumber(orders);
    var c1 = cat.conditions.lista1 || {};
    var c2 = cat.conditions.lista2 || {};
    var c3 = cat.conditions.lista3 || {};
    var q = String(STATE.factSearch || '').trim().toLowerCase();

    var filteredProds = products.filter(function (p) {
      if (p.active === false) return false;
      if (!q) return true;
      var hay = (p.name || '') + ' ' + (p.brand || '') + ' ' + (p.code || '') + ' ' + (p.weight || '');
      return hay.toLowerCase().indexOf(q) !== -1;
    });

    var prodsListHtml = filteredProds
      .map(function (p) {
        var st = getProductStock(p);
        var isOut = st <= 0;
        var isLow = st > 0 && st < 20;
        var previewPrice =
          STATE.factMode === 'minorista'
            ? p.priceMinorista
            : STATE.factRule === 'lista1'
              ? p.priceLista1
              : STATE.factRule === 'lista3'
                ? p.priceLista3
                : p.priceLista2;
        var badgeStyle = isOut
          ? 'background:#FEE2E2;color:#DC2626;'
          : isLow
            ? 'background:#FEF3C7;color:#92400E;'
            : 'background:#DCFCE7;color:#166534;';
        return (
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;background:' + (isOut ? '#f1f5f9;opacity:0.6' : '#fff') + ';">' +
            '<div style="min-width:0;flex:1;">' +
              '<div style="font-weight:800;font-size:12px;color:#1C4328;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(p.name) + '</div>' +
              '<div style="font-size:11px;display:flex;gap:6px;align-items:center;">' +
                '<strong style="color:#1C4328;">' + fmtArs.format(previewPrice || 0) + '</strong>' +
                '<span style="padding:1px 6px;border-radius:999px;font-weight:800;font-size:10px;' + badgeStyle + '">' + (isOut ? 'Sin Stock' : 'Stock: ' + st + ' u.') + '</span>' +
              '</div>' +
            '</div>' +
            (isOut
              ? '<span style="font-size:10px;font-weight:800;color:#DC2626;">SIN STOCK</span>'
              : '<button type="button" data-mm-fact-add="' + esc(p.id) + '" style="cursor:pointer;padding:5px 10px;border-radius:6px;border:none;background:#1C4328;color:#fff;font-size:11px;font-weight:800;">+1</button>') +
          '</div>'
        );
      })
      .join('');

    var linesHtml = calc.lines
      .map(function (ln) {
        return (
          '<tr style="border-bottom:1px solid #e2e8f0;">' +
            '<td style="padding:6px;"><strong>' + esc(ln.name) + '</strong><br><small style="color:#64748b;">' + esc(ln.tierLabel) + ' · Disp: ' + ln.stock + ' u.</small></td>' +
            '<td style="padding:6px;text-align:center;"><input type="number" min="1" max="' + ln.stock + '" data-mm-fact-qty="' + esc(ln.productId) + '" value="' + ln.qty + '" style="width:60px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;text-align:center;font-weight:800;"></td>' +
            '<td style="padding:6px;text-align:right;"><input type="text" inputmode="numeric" data-mm-fact-price="' + esc(ln.productId) + '" value="' + formatThousandsAr(ln.unitPrice) + '" style="width:92px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;text-align:right;font-weight:800;"></td>' +
            '<td style="padding:6px;text-align:right;font-weight:900;color:#1C4328;">' + fmtArs.format(ln.subtotal) + '</td>' +
            '<td style="padding:6px;text-align:center;"><button type="button" data-mm-fact-del="' + esc(ln.productId) + '" style="cursor:pointer;padding:3px 7px;border-radius:5px;border:1px solid #EF4444;background:#FEE2E2;color:#991B1B;font-weight:800;">✕</button></td>' +
          '</tr>'
        );
      })
      .join('');

    return (
      '<div style="display:grid;gap:12px;">' +
        '<div style="background:#fff;border:2px solid #1C4328;border-radius:12px;padding:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
          '<div>' +
            '<div style="font-size:15px;font-weight:900;color:#1C4328;">🧾 Facturación (Caja · Comprobante Interno N° ' + nextNum + ' — Sin ARCA)</div>' +
            '<div style="font-size:12px;color:#64748b;">Por defecto opera con Lista Minorista y descuenta inmediatamente del Stock Unificado.</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
            '<button type="button" data-mm-fact-mode="minorista" style="cursor:pointer;padding:8px 13px;border-radius:8px;font-size:12px;font-weight:800;border:1.5px solid #1C4328;background:' + (STATE.factMode === 'minorista' ? '#1C4328;color:#fff' : '#fff;color:#1C4328') + ';">🛍️ Precio Minorista (Por Defecto)</button>' +
            '<button type="button" data-mm-fact-mode="mayorista" style="cursor:pointer;padding:8px 13px;border-radius:8px;font-size:12px;font-weight:800;border:1.5px solid #1C4328;background:' + (STATE.factMode === 'mayorista' ? '#1C4328;color:#fff' : '#fff;color:#1C4328') + ';">📦 Precio Mayorista (Condiciones 1, 2 y 3)</button>' +
          '</div>' +
          (STATE.factMode === 'mayorista'
            ? '<div style="width:100%;padding-top:8px;border-top:1px dashed #cbd5e1;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12px;">' +
                '<strong style="color:#1C4328;">Regla Mayorista:</strong>' +
                [
                  ['auto', '⚡ Automático (' + (c1.minTotalUnits || 10) + '-' + (c1.maxTotalUnits || 19) + ' L1 / ' + (c2.minTotalUnits || 20) + '+ L2 / ' + (c3.minTotalUnits || 50) + '+ y ' + (c3.minSameProductUnits || 5) + ' ig. L3)'],
                  ['lista1', 'Lista 1'],
                  ['lista2', 'Lista 2'],
                  ['lista3', 'Lista 3']
                ]
                  .map(function (r) {
                    var act = STATE.factRule === r[0];
                    return '<button type="button" data-mm-fact-rule="' + r[0] + '" style="cursor:pointer;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:800;border:1px solid #1C4328;background:' + (act ? '#1C4328;color:#fff' : '#F7F5EE;color:#1C4328') + ';">' + r[1] + '</button>';
                  })
                  .join('') +
              '</div>'
            : '') +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;align-items:start;">' +
          '<div style="background:#fff;border:1px solid #d1dfd5;border-radius:12px;padding:14px;">' +
            '<input type="search" id="mm-fact-search" value="' + esc(STATE.factSearch) + '" placeholder="🔍 Buscar producto o código para agregar a Caja..." style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;margin-bottom:10px;">' +
            '<div style="max-height:420px;overflow-y:auto;display:grid;gap:6px;">' + prodsListHtml + '</div>' +
          '</div>' +
          '<div style="background:#fff;border:2px solid #1C4328;border-radius:12px;padding:14px;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:10px;">' +
              '<label style="font-size:11px;font-weight:800;color:#1C4328;">Cliente<input type="text" id="mm-fact-cname" value="' + esc(STATE.factCustName) + '" style="width:100%;padding:6px;margin-top:2px;border:1px solid #cbd5e1;border-radius:6px;font-weight:700;"></label>' +
              '<label style="font-size:11px;font-weight:800;color:#1C4328;">WhatsApp<input type="text" id="mm-fact-cphone" value="' + esc(STATE.factCustPhone) + '" style="width:100%;padding:6px;margin-top:2px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
              '<label style="font-size:11px;font-weight:800;color:#1C4328;">Medio de Pago<select id="mm-fact-pay" style="width:100%;padding:6px;margin-top:2px;border:1px solid #cbd5e1;border-radius:6px;font-weight:700;">' +
                ['Efectivo', 'Transferencia', 'Mercado Pago / QR', 'Débito / Crédito']
                  .map(function (m) { return '<option value="' + esc(m) + '"' + (STATE.factPayment === m ? ' selected' : '') + '>' + esc(m) + '</option>'; })
                  .join('') +
              '</select></label>' +
            '</div>' +
            (calc.lines.length === 0
              ? '<div style="padding:24px;text-align:center;color:#64748b;background:#F7F5EE;border-radius:8px;font-size:12px;font-weight:700;margin-bottom:10px;">Agregá productos desde la lista izquierda para facturar y descontar del Stock.</div>'
              : '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;"><thead><tr style="border-bottom:2px solid #1C4328;text-align:left;color:#1C4328;"><th style="padding:5px;">Producto</th><th style="padding:5px;text-align:center;">Cant.</th><th style="padding:5px;text-align:right;">Unitario</th><th style="padding:5px;text-align:right;">Subtotal</th><th></th></tr></thead><tbody>' + linesHtml + '</tbody></table>') +
            '<div style="background:#F7F5EE;border:1px solid #1C4328;border-radius:8px;padding:10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;font-weight:900;color:#1C4328;">' +
              '<span>Unidades a descontar: ' + calc.totalUnits + ' u.</span>' +
              '<span style="font-size:16px;">TOTAL: ' + fmtArs.format(calc.grandTotal) + '</span>' +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
              '<button type="button" id="mm-fact-btn-confirm" ' + (calc.lines.length === 0 ? 'disabled' : '') + ' style="flex:1;cursor:pointer;padding:9px 12px;border-radius:8px;border:none;background:#1C4328;color:#fff;font-weight:900;font-size:12px;">✅ Confirmar Venta y Descontar Stock</button>' +
              '<button type="button" id="mm-fact-btn-pdf" ' + (calc.lines.length === 0 ? 'disabled' : '') + ' style="cursor:pointer;padding:9px 12px;border-radius:8px;border:none;background:#2C603B;color:#fff;font-weight:900;font-size:12px;">📄 Emitir PDF A4</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderOrdersTabHtml(cat, products, orders) {
    var q = String(STATE.ordersSearch || '').trim().toLowerCase();
    var filtered = orders.filter(function (ord) {
      if (!q) return true;
      var hay =
        String(ord.quoteNumber || '') +
        ' ' +
        String(ord.date || '') +
        ' ' +
        String((ord.customer && ord.customer.name) || '') +
        ' ' +
        String((ord.customer && ord.customer.city) || '') +
        ' ' +
        String((ord.customer && ord.customer.phone) || '');
      return hay.toLowerCase().indexOf(q) !== -1;
    });

    var pageSize = 10;
    var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (STATE.ordersPage > totalPages) STATE.ordersPage = totalPages;
    if (STATE.ordersPage < 1) STATE.ordersPage = 1;
    var startIdx = (STATE.ordersPage - 1) * pageSize;
    var pageItems = filtered.slice(startIdx, startIdx + pageSize);

    var rowsHtml = pageItems
      .map(function (ord) {
        var confirmedItems = (ord.items || []).filter(function (i) { return i.confirmed !== false; });
        var packs = confirmedItems.reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
        var tot =
          confirmedItems.reduce(function (s, i) {
            return s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0);
          }, 0) + (Number(ord.shippingCost) || 0);
        var isSelected = STATE.editingOrderId === ord.id;
        return (
          '<tr style="border-bottom:1px solid #e2e8f0;background:' + (isSelected ? '#ECFDF5' : '#fff') + ';">' +
            '<td style="padding:8px 10px;font-weight:900;color:#1C4328;">N° ' + esc(ord.quoteNumber) + '</td>' +
            '<td style="padding:8px 10px;">' + esc(normalizeDateDdMmYyyy(ord.date)) + '</td>' +
            '<td style="padding:8px 10px;"><strong>' + esc((ord.customer && ord.customer.name) || 'CLIENTE') + '</strong><br><small style="color:#64748b;">' + esc((ord.customer && ord.customer.city) || '') + ' · ' + esc(ord.appliedTierLabel || ord.mode || '') + '</small></td>' +
            '<td style="padding:8px 10px;font-weight:800;">' + packs + ' u.</td>' +
            '<td style="padding:8px 10px;font-weight:900;color:#1C4328;">' + fmtArs.format(tot) + '</td>' +
            '<td style="padding:8px 10px;">' +
              (ord.status === 'confirmed'
                ? '<span style="padding:3px 9px;border-radius:999px;font-size:11px;font-weight:800;background:#DCFCE7;color:#166534;">✅ Confirmado</span>'
                : '<span style="padding:3px 9px;border-radius:999px;font-size:11px;font-weight:800;background:#FEF3C7;color:#92400E;">⏳ Pendiente</span>') +
            '</td>' +
            '<td style="padding:8px 10px;">' +
              '<button type="button" data-mm-pick-order="' + esc(ord.id) + '" style="cursor:pointer;padding:6px 11px;border-radius:7px;border:1px solid #1C4328;background:' + (isSelected ? '#1C4328' : '#fff') + ';color:' + (isSelected ? '#fff' : '#1C4328') + ';font-size:12px;font-weight:800;">' +
                (isSelected ? '✏️ Editando' : 'Abrir / PDF') +
              '</button>' +
            '</td>' +
          '</tr>'
        );
      })
      .join('');

    var currentOrder =
      orders.find(function (o) { return o.id === STATE.editingOrderId; }) ||
      filtered[0] ||
      null;

    var editorHtml = '';
    if (currentOrder) {
      var confirmedList = (currentOrder.items || []).filter(function (i) { return i.confirmed !== false; });
      var totalPacks = confirmedList.reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
      var totalYerba = confirmedList.reduce(function (s, i) {
        return s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0);
      }, 0);
      var shipping = Number(currentOrder.shippingCost) || 0;
      var grandTotal = totalYerba + shipping;

      var prodOpts = products
        .map(function (p) {
          return (
            '<option value="' + esc(p.id) + '">' +
              esc(p.name) + ' (' + fmtArs.format(p.priceLista2) + ' L2 · Stock: ' + getProductStock(p) + ')' +
            '</option>'
          );
        })
        .join('');

      var itemsHtml = (currentOrder.items || [])
        .map(function (it, idx) {
          var sub = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
          var isConf = it.confirmed !== false;
          return (
            '<tr style="border-bottom:1px solid #e2e8f0;opacity:' + (isConf ? '1' : '0.5') + ';">' +
              '<td style="padding:6px;text-align:center;"><input type="checkbox" data-mm-item-conf="' + idx + '" ' + (isConf ? 'checked' : '') + '></td>' +
              '<td style="padding:6px;"><input type="text" data-mm-item-code="' + idx + '" value="' + esc(it.code || '') + '" style="width:115px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-family:monospace;font-size:12px;"></td>' +
              '<td style="padding:6px;"><input type="text" data-mm-item-name="' + idx + '" value="' + esc(it.name || '') + '" style="width:100%;min-width:190px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-weight:700;font-size:12px;"></td>' +
              '<td style="padding:6px;"><input type="number" min="1" data-mm-item-qty="' + idx + '" value="' + esc(it.qty || 1) + '" style="width:72px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-weight:800;text-align:center;"></td>' +
              '<td style="padding:6px;"><input type="text" inputmode="numeric" data-mm-item-price="' + idx + '" value="' + formatThousandsAr(it.unitPrice || 0) + '" style="width:105px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-weight:800;text-align:right;"></td>' +
              '<td style="padding:6px;font-weight:900;text-align:right;color:#1C4328;">' + fmtArs.format(sub) + '</td>' +
              '<td style="padding:6px;text-align:center;"><button type="button" data-mm-item-del="' + idx + '" style="cursor:pointer;border:none;background:#FEE2E2;color:#991B1B;border-radius:6px;padding:4px 8px;font-weight:800;">✕</button></td>' +
            '</tr>'
          );
        })
        .join('');

      editorHtml =
        '<div style="background:#fff;border:2px solid #1C4328;border-radius:12px;padding:16px;margin-top:16px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #e2e8f0;">' +
            '<div>' +
              '<h3 style="margin:0;color:#1C4328;font-size:16px;">📄 Editor de Presupuesto N° ' + esc(currentOrder.quoteNumber) + ' — ' + esc((currentOrder.customer && currentOrder.customer.name) || '') + '</h3>' +
              '<div style="font-size:12px;color:#64748b;">Confirmá o destildá productos (actualiza el Stock unificado), editá cantidades o precios y emití el PDF A4 oficial.</div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
              '<button type="button" id="mm-btn-pdf" style="cursor:pointer;padding:8px 14px;border-radius:8px;border:none;background:#1C4328;color:#fff;font-weight:800;font-size:12px;">📄 Emitir / Imprimir Presupuesto PDF A4</button>' +
              '<button type="button" id="mm-btn-wa" style="cursor:pointer;padding:8px 14px;border-radius:8px;border:none;background:#16A34A;color:#fff;font-weight:800;font-size:12px;">💬 Enviar a Cliente por WhatsApp</button>' +
              '<button type="button" id="mm-btn-del-order" style="cursor:pointer;padding:8px 12px;border-radius:8px;border:1px solid #EF4444;background:#FEE2E2;color:#991B1B;font-weight:800;font-size:12px;">🗑️ Eliminar</button>' +
            '</div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px;margin-bottom:12px;">' +
            '<label style="font-size:12px;font-weight:700;color:#1C4328;">N° de Presupuesto<input type="number" id="mm-ord-qnum" value="' + esc(currentOrder.quoteNumber) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;font-weight:800;"></label>' +
            '<label style="font-size:12px;font-weight:700;color:#1C4328;">Fecha (dd/mm/yyyy)<input type="text" id="mm-ord-date" value="' + esc(normalizeDateDdMmYyyy(currentOrder.date)) + '" placeholder="dd/mm/yyyy" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;"></label>' +
            '<label style="font-size:12px;font-weight:700;color:#1C4328;">Señor / Cliente<input type="text" id="mm-ord-name" value="' + esc((currentOrder.customer && currentOrder.customer.name) || '') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;font-weight:700;"></label>' +
            '<label style="font-size:12px;font-weight:700;color:#1C4328;">Domicilio<input type="text" id="mm-ord-addr" value="' + esc((currentOrder.customer && currentOrder.customer.address) || '') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;"></label>' +
            '<label style="font-size:12px;font-weight:700;color:#1C4328;">Localidad<input type="text" id="mm-ord-city" value="' + esc((currentOrder.customer && currentOrder.customer.city) || '') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;"></label>' +
            '<label style="font-size:12px;font-weight:700;color:#1C4328;">Provincia<input type="text" id="mm-ord-prov" value="' + esc((currentOrder.customer && currentOrder.customer.province) || 'CORDOBA') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;"></label>' +
            '<label style="font-size:12px;font-weight:700;color:#1C4328;">Teléfono / WhatsApp<input type="text" id="mm-ord-phone" value="' + esc((currentOrder.customer && currentOrder.customer.phone) || '') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;"></label>' +
            '<label style="font-size:12px;font-weight:700;color:#1C4328;">Costo de Envío ($)<input type="text" inputmode="numeric" id="mm-ord-ship" value="' + formatThousandsAr(shipping) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;font-weight:800;"></label>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#F7F5EE;padding:8px 12px;border-radius:8px;border:1px solid #d1dfd5;margin-bottom:10px;">' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;font-weight:800;color:#1C4328;">' +
              '<span>Aplicar tarifa general:</span>' +
              '<button type="button" data-mm-tier="minorista" style="cursor:pointer;padding:4px 9px;border-radius:6px;border:1px solid #1C4328;background:#fff;font-size:11px;font-weight:800;">Minorista</button>' +
              '<button type="button" data-mm-tier="lista1" style="cursor:pointer;padding:4px 9px;border-radius:6px;border:1px solid #1C4328;background:#fff;font-size:11px;font-weight:800;">Lista 1</button>' +
              '<button type="button" data-mm-tier="lista2" style="cursor:pointer;padding:4px 9px;border-radius:6px;border:1px solid #1C4328;background:#fff;font-size:11px;font-weight:800;">Lista 2</button>' +
              '<button type="button" data-mm-tier="lista3" style="cursor:pointer;padding:4px 9px;border-radius:6px;border:1px solid #1C4328;background:#fff;font-size:11px;font-weight:800;">Lista 3</button>' +
              '<button type="button" data-mm-tier="auto" style="cursor:pointer;padding:4px 9px;border-radius:6px;border:1px solid #1C4328;background:#1C4328;color:#fff;font-size:11px;font-weight:800;">⚡ Cálculo Automático</button>' +
            '</div>' +
            '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">' +
              '<select id="mm-add-prod-sel" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:7px;font-size:12px;max-width:260px;">' + prodOpts + '</select>' +
              '<button type="button" id="mm-btn-add-line" style="cursor:pointer;padding:6px 11px;border-radius:7px;border:none;background:#1C4328;color:#fff;font-size:12px;font-weight:800;">➕ Agregar Línea</button>' +
            '</div>' +
          '</div>' +
          '<div style="overflow-x:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
              '<thead><tr style="border-bottom:2px solid #1C4328;text-align:left;color:#1C4328;">' +
                '<th style="padding:6px;text-align:center;width:55px;">Conf.</th>' +
                '<th style="padding:6px;">Código</th>' +
                '<th style="padding:6px;">Descripción Producto</th>' +
                '<th style="padding:6px;text-align:center;">Cant.</th>' +
                '<th style="padding:6px;text-align:right;">P. Unitario ($)</th>' +
                '<th style="padding:6px;text-align:right;">Subtotal</th>' +
                '<th style="padding:6px;text-align:center;">Quitar</th>' +
              '</tr></thead>' +
              '<tbody>' + itemsHtml + '</tbody>' +
            '</table>' +
          '</div>' +
          '<div style="display:flex;justify-content:flex-end;gap:18px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:2px solid #1C4328;font-size:14px;font-weight:900;color:#1C4328;">' +
            '<span>Paquetes Confirmados: ' + totalPacks + ' u.</span>' +
            '<span>Total Yerba: ' + fmtArs.format(totalYerba) + '</span>' +
            (shipping > 0 ? '<span>Envío: ' + fmtArs.format(shipping) + '</span>' : '') +
            '<span style="background:#DCFCE7;color:#166534;padding:3px 10px;border-radius:8px;">TOTAL FINAL: ' + fmtArs.format(grandTotal) + '</span>' +
          '</div>' +
        '</div>';
    }

    return (
      '<div style="background:#fff;border:1px solid #d1dfd5;border-radius:12px;padding:16px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">' +
          '<div style="flex:1;min-width:240px;">' +
            '<input type="search" id="mm-orders-search" value="' + esc(STATE.ordersSearch) + '" placeholder="🔍 Buscar por N° de presupuesto (ej: 2291), nombre de cliente o localidad..." style="width:100%;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            '<button type="button" id="mm-btn-new-order" style="cursor:pointer;padding:8px 14px;border-radius:8px;border:none;background:#1C4328;color:#fff;font-size:12px;font-weight:800;">➕ Nuevo Presupuesto Manual</button>' +
          '</div>' +
        '</div>' +
        '<div style="overflow-x:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
            '<thead><tr style="border-bottom:2px solid #1C4328;text-align:left;color:#1C4328;">' +
              '<th style="padding:8px 10px;">N° Presup.</th>' +
              '<th style="padding:8px 10px;">Fecha</th>' +
              '<th style="padding:8px 10px;">Señor / Cliente</th>' +
              '<th style="padding:8px 10px;">Paquetes</th>' +
              '<th style="padding:8px 10px;">Total</th>' +
              '<th style="padding:8px 10px;">Estado</th>' +
              '<th style="padding:8px 10px;">Acción</th>' +
            '</tr></thead>' +
            '<tbody>' +
              (rowsHtml || '<tr><td colspan="7" style="padding:16px;text-align:center;color:#64748b;">No se encontraron presupuestos con ese criterio.</td></tr>') +
            '</tbody>' +
          '</table>' +
        '</div>' +
        (totalPages > 1
          ? '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;">' +
              '<span>Página ' + STATE.ordersPage + ' de ' + totalPages + ' (' + filtered.length + ' presupuestos)</span>' +
              '<div style="display:flex;gap:6px;">' +
                '<button type="button" id="mm-page-prev" ' + (STATE.ordersPage <= 1 ? 'disabled' : '') + ' style="cursor:pointer;padding:5px 10px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;font-weight:700;">← Anterior</button>' +
                '<button type="button" id="mm-page-next" ' + (STATE.ordersPage >= totalPages ? 'disabled' : '') + ' style="cursor:pointer;padding:5px 10px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;font-weight:700;">Siguiente →</button>' +
              '</div>' +
            '</div>'
          : '') +
      '</div>' +
      editorHtml
    );
  }

  function renderProductsTabHtml(cat, products) {
    var q = String(STATE.productSearch || '').trim().toLowerCase();
    var bFilter = STATE.productBrandFilter || 'ALL';
    var sFilter = STATE.productStockFilter || 'ALL';

    var sorted = products.slice().sort(function (a, b) {
      return (Number(a.webOrder) || 9999) - (Number(b.webOrder) || 9999);
    });

    var filtered = sorted.filter(function (p) {
      if (bFilter !== 'ALL' && p.brand !== bFilter) return false;
      var st = getProductStock(p);
      if (sFilter === 'OK' && st < 20) return false;
      if (sFilter === 'LOW' && (st <= 0 || st >= 20)) return false;
      if (sFilter === 'EMPTY' && st > 0) return false;
      if (q) {
        var hay = (p.name || '') + ' ' + (p.brand || '') + ' ' + (p.code || '') + ' ' + (p.weight || '');
        if (hay.toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });

    var edProd = STATE.editingProductId
      ? products.find(function (x) { return x.id === STATE.editingProductId; })
      : null;

    var formHtml = '';
    if (STATE.productFormOpen) {
      var imgVal = STATE.draftImageDataUrl || (edProd ? edProd.image : 'assets/images/logo.png');
      formHtml =
        '<div style="background:#F7F5EE;border:2px solid #1C4328;border-radius:12px;padding:16px;margin-bottom:14px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
            '<h4 style="margin:0;color:#1C4328;font-size:15px;">' + (edProd ? '✏️ Editar Producto: ' + esc(edProd.name) : '➕ Alta de Nuevo Producto en Mate-Mática') + '</h4>' +
            '<button type="button" id="mm-close-prod-form" style="cursor:pointer;padding:4px 10px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;font-weight:800;">✕ Cerrar</button>' +
          '</div>' +
          '<form id="mm-prod-abm-form" style="display:grid;gap:10px;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px;">' +
              '<label style="font-size:12px;font-weight:700;color:#1C4328;">Código / EAN<input name="code" value="' + esc(edProd ? edProd.code : '') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;"></label>' +
              '<label style="font-size:12px;font-weight:700;color:#1C4328;">Nombre del Producto *<input name="name" required value="' + esc(edProd ? edProd.name : '') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;font-weight:700;"></label>' +
              '<label style="font-size:12px;font-weight:700;color:#1C4328;">Marca<input name="brand" value="' + esc(edProd ? edProd.brand : 'Canarias') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;"></label>' +
              '<label style="font-size:12px;font-weight:700;color:#1C4328;">Presentación / Peso<input name="weight" value="' + esc(edProd ? edProd.weight : '500g') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;"></label>' +
              '<label style="font-size:12px;font-weight:700;color:#1C4328;">Stock Disponible (Unid.) *<input type="number" min="0" name="stock" required value="' + esc(edProd ? getProductStock(edProd) : 50) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;font-weight:800;"></label>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">' +
              '<label style="font-size:12px;font-weight:700;color:#1C4328;">1. Precio Minorista ($)<input type="text" inputmode="numeric" name="priceMinorista" required value="' + formatThousandsAr(edProd ? edProd.priceMinorista : 7000) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;font-weight:800;"></label>' +
              '<label style="font-size:12px;font-weight:700;color:#1C4328;">2. Lista 1 (10-19 u.) ($)<input type="text" inputmode="numeric" name="priceLista1" required value="' + formatThousandsAr(edProd ? edProd.priceLista1 : 6400) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;font-weight:800;"></label>' +
              '<label style="font-size:12px;font-weight:700;color:#1C4328;">3. Lista 2 (20+ u.) ($)<input type="text" inputmode="numeric" name="priceLista2" required value="' + formatThousandsAr(edProd ? edProd.priceLista2 : 6200) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;font-weight:800;"></label>' +
              '<label style="font-size:12px;font-weight:700;color:#1C4328;">4. Lista 3 (50+ / 5 ig.) ($)<input type="text" inputmode="numeric" name="priceLista3" required value="' + formatThousandsAr(edProd ? edProd.priceLista3 : 6000) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:7px;font-weight:800;"></label>' +
            '</div>' +
            '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#fff;padding:10px;border-radius:8px;border:1px solid #cbd5e1;">' +
              '<img id="mm-prod-img-prev" src="' + esc(resolveMateAsset(imgVal)) + '" alt="" style="width:64px;height:64px;object-fit:contain;border:1px solid #e2e8f0;border-radius:6px;">' +
              '<div style="flex:1;min-width:220px;display:grid;gap:6px;">' +
                '<label style="font-size:12px;font-weight:700;color:#1C4328;">Ruta o URL de Imagen<input name="image" id="mm-prod-img-inp" value="' + esc(imgVal) + '" style="width:100%;padding:6px;margin-top:2px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;"></label>' +
                '<label style="font-size:12px;font-weight:700;color:#1C4328;">O subir foto desde tu equipo: <input type="file" id="mm-prod-img-file" accept="image/*" style="font-size:12px;"></label>' +
              '</div>' +
              '<button type="submit" style="cursor:pointer;padding:10px 18px;border-radius:8px;border:none;background:#1C4328;color:#fff;font-weight:800;font-size:13px;">💾 Guardar Producto</button>' +
            '</div>' +
          '</form>' +
        '</div>';
    }

    var rowsHtml = filtered
      .map(function (p, idx) {
        var stock = getProductStock(p);
        var pillStyle =
          stock <= 0
            ? 'background:#FEE2E2;color:#DC2626;border:1.5px solid #EF4444;'
            : stock < 20
              ? 'background:#FEF3C7;color:#92400E;border:1px solid #FCD34D;'
              : 'background:#DCFCE7;color:#166534;border:1px solid #86EFAC;';
        var pillText = stock <= 0 ? 'Sin Stock' : stock < 20 ? 'Bajo' : 'Disponible';

        return (
          '<tr style="border-bottom:1px solid #e2e8f0;">' +
            '<td style="padding:6px;white-space:nowrap;">' +
              '<input type="number" min="1" data-mm-q-order="' + esc(p.id) + '" value="' + esc(p.webOrder || idx + 1) + '" style="width:58px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;font-weight:800;text-align:center;">' +
            '</td>' +
            '<td style="padding:6px;">' +
              '<img src="' + esc(resolveMateAsset(p.image)) + '" alt="" style="width:42px;height:42px;object-fit:contain;border-radius:6px;border:1px solid #cbd5e1;background:#fff;">' +
            '</td>' +
            '<td style="padding:6px;">' +
              '<strong style="color:#1C4328;">' + esc(p.name) + '</strong><br>' +
              '<small style="color:#64748b;font-family:monospace;">' + esc(p.code) + ' · ' + esc(p.brand) + ' (' + esc(p.weight) + ')</small>' +
            '</td>' +
            '<td style="padding:6px;">' +
              '<div style="display:flex;align-items:center;gap:6px;">' +
                '<input type="number" min="0" data-mm-q-stock="' + esc(p.id) + '" value="' + stock + '" style="width:74px;padding:5px;border:1px solid #1C4328;border-radius:6px;font-weight:800;text-align:center;">' +
                '<span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap;' + pillStyle + '">' + pillText + '</span>' +
              '</div>' +
            '</td>' +
            '<td style="padding:6px;"><input type="text" inputmode="numeric" data-mm-q-price="' + esc(p.id) + '" data-field="priceMinorista" value="' + formatThousandsAr(p.priceMinorista) + '" style="width:98px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-weight:800;text-align:right;"></td>' +
            '<td style="padding:6px;"><input type="text" inputmode="numeric" data-mm-q-price="' + esc(p.id) + '" data-field="priceLista1" value="' + formatThousandsAr(p.priceLista1) + '" style="width:98px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-weight:800;text-align:right;"></td>' +
            '<td style="padding:6px;"><input type="text" inputmode="numeric" data-mm-q-price="' + esc(p.id) + '" data-field="priceLista2" value="' + formatThousandsAr(p.priceLista2) + '" style="width:98px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-weight:800;text-align:right;"></td>' +
            '<td style="padding:6px;"><input type="text" inputmode="numeric" data-mm-q-price="' + esc(p.id) + '" data-field="priceLista3" value="' + formatThousandsAr(p.priceLista3) + '" style="width:98px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-weight:800;text-align:right;"></td>' +
            '<td style="padding:6px;white-space:nowrap;">' +
              '<button type="button" data-mm-edit-prod="' + esc(p.id) + '" style="cursor:pointer;padding:5px 9px;border-radius:6px;border:none;background:#1C4328;color:#fff;font-size:11px;font-weight:800;margin-right:4px;">✏️ Editar</button>' +
              '<button type="button" data-mm-del-prod="' + esc(p.id) + '" style="cursor:pointer;padding:5px 8px;border-radius:6px;border:1px solid #EF4444;background:#FEE2E2;color:#991B1B;font-size:11px;font-weight:800;">🗑️</button>' +
            '</td>' +
          '</tr>'
        );
      })
      .join('');

    return (
      formHtml +
      '<div style="background:#fff;border:1px solid #d1dfd5;border-radius:12px;padding:16px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;flex:1;">' +
            '<input type="search" id="mm-prod-search" value="' + esc(STATE.productSearch) + '" placeholder="🔍 Buscar yerba por nombre, marca, código o peso..." style="flex:1;min-width:220px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">' +
            '<select id="mm-prod-stock-filter" style="padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;font-weight:700;">' +
              '<option value="ALL"' + (sFilter === 'ALL' ? ' selected' : '') + '>📦 Todo el Stock (' + products.length + ')</option>' +
              '<option value="OK"' + (sFilter === 'OK' ? ' selected' : '') + '>🟢 Disponible (>= 20 u.)</option>' +
              '<option value="LOW"' + (sFilter === 'LOW' ? ' selected' : '') + '>🟡 Bajo (&lt; 20 u.)</option>' +
              '<option value="EMPTY"' + (sFilter === 'EMPTY' ? ' selected' : '') + '>🔴 Sin Stock (0 u.)</option>' +
            '</select>' +
          '</div>' +
          '<button type="button" id="mm-btn-new-prod" style="cursor:pointer;padding:8px 14px;border-radius:8px;border:none;background:#1C4328;color:#fff;font-size:12px;font-weight:800;">➕ Agregar Nuevo Producto</button>' +
        '</div>' +
        '<div style="overflow-x:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
            '<thead><tr style="border-bottom:2px solid #1C4328;text-align:left;color:#1C4328;">' +
              '<th style="padding:8px 6px;">Orden</th>' +
              '<th style="padding:8px 6px;">Foto</th>' +
              '<th style="padding:8px 6px;">Producto / Código / Marca</th>' +
              '<th style="padding:8px 6px;">Stock (Unid.)</th>' +
              '<th style="padding:8px 6px;">1. Minorista ($)</th>' +
              '<th style="padding:8px 6px;">2. Lista 1 ($)</th>' +
              '<th style="padding:8px 6px;">3. Lista 2 ($)</th>' +
              '<th style="padding:8px 6px;">4. Lista 3 ($)</th>' +
              '<th style="padding:8px 6px;">Acciones</th>' +
            '</tr></thead>' +
            '<tbody>' + rowsHtml + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>'
    );
  }

  function renderConditionsTabHtml(cat) {
    var c1 = cat.conditions.lista1 || {};
    var c2 = cat.conditions.lista2 || {};
    var c3 = cat.conditions.lista3 || {};
    var cfg = cat.config || {};

    return (
      '<form id="mm-cond-form" style="background:#fff;border:1px solid #d1dfd5;border-radius:12px;padding:18px;display:grid;gap:16px;">' +
        '<h3 style="margin:0;color:#1C4328;font-size:16px;">⚖️ Condiciones para Cálculo Automático de Precios Mayoristas</h3>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">' +
          '<div style="background:#F7F5EE;border:1px solid #d1dfd5;border-radius:10px;padding:12px;display:grid;gap:8px;">' +
            '<strong style="color:#1C4328;">Condición 1 · Precio Lista 1</strong>' +
            '<label style="font-size:12px;font-weight:700;">Mínimo unidades surtidas<input type="number" min="1" name="l1Min" value="' + esc(c1.minTotalUnits || 10) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
            '<label style="font-size:12px;font-weight:700;">Máximo unidades surtidas<input type="number" min="1" name="l1Max" value="' + esc(c1.maxTotalUnits || 19) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
            '<label style="font-size:12px;font-weight:700;">Texto descriptivo<input type="text" name="l1Desc" value="' + esc(c1.description || '') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
          '</div>' +
          '<div style="background:#F7F5EE;border:1px solid #d1dfd5;border-radius:10px;padding:12px;display:grid;gap:8px;">' +
            '<strong style="color:#1C4328;">Condición 2 · Precio Lista 2</strong>' +
            '<label style="font-size:12px;font-weight:700;">Mínimo unidades surtidas<input type="number" min="1" name="l2Min" value="' + esc(c2.minTotalUnits || 20) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
            '<label style="font-size:12px;font-weight:700;">Texto descriptivo<input type="text" name="l2Desc" value="' + esc(c2.description || '') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
          '</div>' +
          '<div style="background:#F7F5EE;border:1px solid #d1dfd5;border-radius:10px;padding:12px;display:grid;gap:8px;">' +
            '<strong style="color:#1C4328;">Condición 3 · Precio Lista 3</strong>' +
            '<label style="font-size:12px;font-weight:700;">Compra mínima total (unidades)<input type="number" min="1" name="l3MinTotal" value="' + esc(c3.minTotalUnits || 50) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
            '<label style="font-size:12px;font-weight:700;">Mínimo unidades iguales por producto<input type="number" min="1" name="l3MinSame" value="' + esc(c3.minSameProductUnits || 5) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
            '<label style="font-size:12px;font-weight:700;">Texto descriptivo<input type="text" name="l3Desc" value="' + esc(c3.description || '') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
          '</div>' +
        '</div>' +
        '<h3 style="margin:4px 0 0;color:#1C4328;font-size:16px;">📄 Membrete de Presupuesto PDF y WhatsApp Receptor</h3>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">' +
          '<label style="font-size:12px;font-weight:700;">WhatsApp Receptor (solo números)<input type="text" name="whatsappNumber" value="' + esc(cfg.whatsappNumber || '5493584866586') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
          '<label style="font-size:12px;font-weight:700;">Próximo N° Presupuesto<input type="number" name="nextQuoteNumber" value="' + esc(cfg.nextQuoteNumber || 2292) + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
          '<label style="font-size:12px;font-weight:700;">Titular Membrete<input type="text" name="ownerLine1" value="' + esc(cfg.ownerLine1 || '') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
          '<label style="font-size:12px;font-weight:700;">Dirección Membrete<input type="text" name="addressLine1" value="' + esc(cfg.addressLine1 || '') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
          '<label style="font-size:12px;font-weight:700;">Ciudad y Provincia<input type="text" name="cityProvince" value="' + esc(cfg.cityProvince || '') + '" style="width:100%;padding:7px;margin-top:3px;border:1px solid #cbd5e1;border-radius:6px;"></label>' +
        '</div>' +
        '<div><button type="submit" style="cursor:pointer;padding:10px 18px;border-radius:8px;border:none;background:#1C4328;color:#fff;font-weight:800;font-size:13px;">💾 Guardar Condiciones y Configuración en Mate-Mática</button></div>' +
      '</form>'
    );
  }

  function renderDashboardTabHtml(cat, products, orders) {
    var totalUnitsInStock = 0;
    var valMinorista = 0;
    var valLista1 = 0;
    var valLista2 = 0;
    var valLista3 = 0;

    products.forEach(function (p) {
      if (p.active === false) return;
      var st = getProductStock(p);
      totalUnitsInStock += st;
      valMinorista += st * (Number(p.priceMinorista) || 0);
      valLista1 += st * (Number(p.priceLista1) || 0);
      valLista2 += st * (Number(p.priceLista2) || 0);
      valLista3 += st * (Number(p.priceLista3) || 0);
    });

    var totalSoldUnits = 0;
    var totalSoldArs = 0;
    var salesByProd = {};

    orders.forEach(function (o) {
      if (STATE.dashStatusFilter !== 'all' && o.status !== STATE.dashStatusFilter) return;
      (o.items || []).forEach(function (it) {
        if (it.confirmed === false) return;
        var q = Number(it.qty) || 0;
        var sub = q * (Number(it.unitPrice) || 0);
        totalSoldUnits += q;
        totalSoldArs += sub;
        var key = it.name || it.productId || 'Producto';
        if (!salesByProd[key]) salesByProd[key] = { name: key, units: 0, revenue: 0 };
        salesByProd[key].units += q;
        salesByProd[key].revenue += sub;
      });
    });

    var topSold = Object.keys(salesByProd)
      .map(function (k) { return salesByProd[k]; })
      .sort(function (a, b) { return b.units - a.units; })
      .slice(0, 12);

    return (
      '<div style="display:grid;gap:14px;">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">' +
          '<div style="background:#fff;border:1px solid #d1dfd5;border-left:4px solid #1C4328;border-radius:10px;padding:12px;">' +
            '<div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">Ventas Acumuladas</div>' +
            '<div style="font-size:22px;font-weight:900;color:#1C4328;">' + fmtArs.format(totalSoldArs) + '</div>' +
            '<div style="font-size:12px;color:#64748b;">' + totalSoldUnits + ' paquetes vendidos</div>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #d1dfd5;border-left:4px solid #16A34A;border-radius:10px;padding:12px;">' +
            '<div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">Stock Total Unificado</div>' +
            '<div style="font-size:22px;font-weight:900;color:#166534;">' + formatThousandsAr(totalUnitsInStock) + ' u.</div>' +
            '<div style="font-size:12px;color:#64748b;">En ' + products.length + ' productos activos</div>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #d1dfd5;border-left:4px solid #2C603B;border-radius:10px;padding:12px;">' +
            '<div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">Stock Valorizado (Minorista)</div>' +
            '<div style="font-size:22px;font-weight:900;color:#1C4328;">' + fmtArs.format(valMinorista) + '</div>' +
            '<div style="font-size:12px;color:#64748b;">Lista 1: ' + fmtArs.format(valLista1) + '</div>' +
          '</div>' +
          '<div style="background:#fff;border:1px solid #d1dfd5;border-left:4px solid #769D61;border-radius:10px;padding:12px;">' +
            '<div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">Stock Valorizado (Mayorista L2/L3)</div>' +
            '<div style="font-size:22px;font-weight:900;color:#1C4328;">' + fmtArs.format(valLista2) + '</div>' +
            '<div style="font-size:12px;color:#64748b;">Lista 3: ' + fmtArs.format(valLista3) + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #d1dfd5;border-radius:12px;padding:16px;">' +
          '<h4 style="margin:0 0 10px;color:#1C4328;">🏆 Ranking de Productos Más Vendidos</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
            '<thead><tr style="border-bottom:2px solid #1C4328;text-align:left;color:#1C4328;"><th style="padding:7px;">Producto</th><th style="padding:7px;text-align:right;">Unidades</th><th style="padding:7px;text-align:right;">Total Facturado</th></tr></thead>' +
            '<tbody>' +
              topSold
                .map(function (r) {
                  return (
                    '<tr style="border-bottom:1px solid #e2e8f0;">' +
                      '<td style="padding:7px;font-weight:700;">' + esc(r.name) + '</td>' +
                      '<td style="padding:7px;text-align:right;font-weight:800;">' + r.units + ' u.</td>' +
                      '<td style="padding:7px;text-align:right;font-weight:900;color:#1C4328;">' + fmtArs.format(r.revenue) + '</td>' +
                    '</tr>'
                  );
                })
                .join('') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>'
    );
  }

  function renderLinksTabHtml() {
    var links = [
      ['🛍️ Tienda Minorista Clientes', 'https://www.mate-matica.com.ar/clientes', 'Catálogo público minorista por unidad sin mínimo de compra'],
      ['📦 Canal Mayorista Comercio', 'https://www.mate-matica.com.ar/comercio', 'Catálogo mayorista con cálculo automático de Listas 1, 2 y 3'],
      ['⚙️ Panel de Administración Web', 'https://www.mate-matica.com.ar/administrador', 'Acceso directo al portal /administrador de Mate-Mática'],
      ['📲 Instalador PWA + QR Clientes', 'https://www.mate-matica.com.ar/clientes/instalar/', 'Página de instalación Android/iOS/PC y QR para clientes'],
      ['📲 Instalador PWA + QR Comercio', 'https://www.mate-matica.com.ar/comercio/instalar/', 'Página de instalación Android/iOS/PC y QR para comercios']
    ];
    return (
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;">' +
        links
          .map(function (l) {
            return (
              '<a href="' + esc(l[1]) + '" target="_blank" rel="noopener noreferrer" style="display:block;background:#fff;border:1.5px solid #1C4328;border-radius:12px;padding:16px;text-decoration:none;color:#1C4328;">' +
                '<div style="font-size:15px;font-weight:900;margin-bottom:4px;">' + esc(l[0]) + ' ↗</div>' +
                '<div style="font-size:12px;color:#64748b;">' + esc(l[2]) + '</div>' +
              '</a>'
            );
          })
          .join('') +
      '</div>'
    );
  }

  function bindMateMaticaEvents(body, cat, products, orders) {
    body.querySelectorAll('[data-mm-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        STATE.tab = btn.getAttribute('data-mm-tab') || 'orders';
        STATE.feedback = '';
        renderMateMaticaDetail();
      });
    });

    var syncBtn = body.querySelector('#mm-btn-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', function () {
        reloadData(true);
      });
    }

    if (STATE.tab === 'facturacion') {
      body.querySelectorAll('[data-mm-fact-mode]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          STATE.factMode = btn.getAttribute('data-mm-fact-mode') || 'minorista';
          STATE.factItems.forEach(function (i) { i.customPrice = null; });
          renderMateMaticaDetail();
        });
      });

      body.querySelectorAll('[data-mm-fact-rule]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          STATE.factRule = btn.getAttribute('data-mm-fact-rule') || 'auto';
          STATE.factItems.forEach(function (i) { i.customPrice = null; });
          renderMateMaticaDetail();
        });
      });

      var fSearch = body.querySelector('#mm-fact-search');
      if (fSearch) {
        fSearch.addEventListener('input', function () {
          STATE.factSearch = fSearch.value;
          renderMateMaticaDetail();
          var nextInp = document.getElementById('mm-fact-search');
          if (nextInp) nextInp.focus();
        });
      }

      body.querySelectorAll('[data-mm-fact-add]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var pid = btn.getAttribute('data-mm-fact-add');
          var prod = products.find(function (p) { return p.id === pid; });
          if (!prod) return;
          var st = getProductStock(prod);
          if (st <= 0) return;
          var ex = STATE.factItems.find(function (i) { return i.productId === pid; });
          if (ex) {
            if (ex.qty + 1 > st) {
              ex.qty = st;
              STATE.feedback = 'No hay Stock Suficiente de "' + prod.name + '" (máximo: ' + st + ' u.).';
              STATE.isError = true;
            } else {
              ex.qty += 1;
            }
          } else {
            STATE.factItems.push({ productId: pid, qty: 1, customPrice: null });
          }
          renderMateMaticaDetail();
        });
      });

      body.querySelectorAll('[data-mm-fact-qty]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var pid = inp.getAttribute('data-mm-fact-qty');
          var prod = products.find(function (p) { return p.id === pid; });
          var ex = STATE.factItems.find(function (i) { return i.productId === pid; });
          if (!ex || !prod) return;
          var st = getProductStock(prod);
          var req = parseInt(inp.value, 10) || 1;
          if (req > st) {
            req = st;
            STATE.feedback = 'No hay Stock Suficiente de "' + prod.name + '" (máximo: ' + st + ' u.).';
            STATE.isError = true;
          }
          if (req <= 0) {
            STATE.factItems = STATE.factItems.filter(function (i) { return i.productId !== pid; });
          } else {
            ex.qty = req;
          }
          renderMateMaticaDetail();
        });
      });

      body.querySelectorAll('[data-mm-fact-price]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var pid = inp.getAttribute('data-mm-fact-price');
          var ex = STATE.factItems.find(function (i) { return i.productId === pid; });
          if (ex) {
            ex.customPrice = parsePriceInputAr(inp.value);
            renderMateMaticaDetail();
          }
        });
      });

      body.querySelectorAll('[data-mm-fact-del]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var pid = btn.getAttribute('data-mm-fact-del');
          STATE.factItems = STATE.factItems.filter(function (i) { return i.productId !== pid; });
          renderMateMaticaDetail();
        });
      });

      var cnameInp = body.querySelector('#mm-fact-cname');
      if (cnameInp) cnameInp.addEventListener('input', function () { STATE.factCustName = cnameInp.value; });
      var cphoneInp = body.querySelector('#mm-fact-cphone');
      if (cphoneInp) cphoneInp.addEventListener('input', function () { STATE.factCustPhone = cphoneInp.value; });
      var paySel = body.querySelector('#mm-fact-pay');
      if (paySel) paySel.addEventListener('change', function () { STATE.factPayment = paySel.value; });

      var confirmFactSale = function (openPdf) {
        var calc = computeMmFacturacionPricing(cat, products);
        if (calc.lines.length === 0) return;
        var qNum = computeNextQuoteNumber(STATE.orders);
        cat.config.nextQuoteNumber = qNum + 1;
        var newOrd = {
          id: 'ORD-' + qNum + '-CAJA-' + String(Date.now()).slice(-3),
          quoteNumber: qNum,
          date: formatTodayDdMmYyyy(),
          createdAt: new Date().toISOString(),
          status: 'confirmed',
          origin: 'facturacion_caja',
          mode: STATE.factMode === 'mayorista' ? 'mayorista' : 'minorista',
          appliedTierLabel: calc.activeTierLabel + ' · Caja (' + STATE.factPayment + ')',
          customer: {
            name: String(STATE.factCustName || 'CONSUMIDOR FINAL').toUpperCase(),
            address: '-',
            city: String(STATE.factCustCity || 'RIO CUARTO').toUpperCase(),
            province: 'CORDOBA',
            phone: String(STATE.factCustPhone || ''),
            notes: 'Comprobante Interno de Caja'
          },
          shippingCost: calc.shipping,
          items: calc.lines.map(function (l) {
            return {
              productId: l.productId,
              code: l.code,
              name: l.name,
              qty: l.qty,
              unitPrice: l.unitPrice,
              confirmed: true
            };
          }),
          stockDeducted: false,
          stockDeductedMap: {}
        };
        reconcileOrderStock(newOrd);
        STATE.orders.unshift(newOrd);
        STATE.editingOrderId = newOrd.id;
        STATE.factItems = [];
        saveAllToCloud('✅ Comprobante Interno N° ' + qNum + ' emitido y Stock descontado (-' + calc.totalUnits + ' u.).');
        if (openPdf) {
          openOfficialMateMaticaPdf(newOrd);
        }
      };

      var btnConf = body.querySelector('#mm-fact-btn-confirm');
      if (btnConf) btnConf.addEventListener('click', function () { confirmFactSale(false); });
      var btnPdf = body.querySelector('#mm-fact-btn-pdf');
      if (btnPdf) btnPdf.addEventListener('click', function () { confirmFactSale(true); });
      return;
    }

    if (STATE.tab === 'orders') {
      var ordSearch = body.querySelector('#mm-orders-search');
      if (ordSearch) {
        ordSearch.addEventListener('input', function () {
          STATE.ordersSearch = ordSearch.value;
          STATE.ordersPage = 1;
          renderMateMaticaDetail();
          var nextInp = document.getElementById('mm-orders-search');
          if (nextInp) nextInp.focus();
        });
      }

      var prevBtn = body.querySelector('#mm-page-prev');
      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          if (STATE.ordersPage > 1) {
            STATE.ordersPage--;
            renderMateMaticaDetail();
          }
        });
      }
      var nextBtn = body.querySelector('#mm-page-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          STATE.ordersPage++;
          renderMateMaticaDetail();
        });
      }

      body.querySelectorAll('[data-mm-pick-order]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          STATE.editingOrderId = btn.getAttribute('data-mm-pick-order');
          renderMateMaticaDetail();
        });
      });

      var newOrdBtn = body.querySelector('#mm-btn-new-order');
      if (newOrdBtn) {
        newOrdBtn.addEventListener('click', function () {
          var qNum = computeNextQuoteNumber(STATE.orders);
          cat.config.nextQuoteNumber = qNum + 1;
          var manualOrder = {
            id: 'ORD-' + qNum + '-' + String(Date.now()).slice(-4),
            quoteNumber: qNum,
            date: formatTodayDdMmYyyy(),
            createdAt: new Date().toISOString(),
            status: 'pending',
            mode: 'mayorista',
            appliedTierLabel: 'Presupuesto Manual',
            customer: {
              name: 'CONSUMIDOR FINAL',
              address: '-',
              city: 'RIO CUARTO',
              province: 'CORDOBA',
              phone: '',
              notes: ''
            },
            shippingCost: 0,
            items: [],
            stockDeducted: true,
            stockDeductedMap: {}
          };
          STATE.orders.unshift(manualOrder);
          STATE.editingOrderId = manualOrder.id;
          saveAllToCloud('➕ Presupuesto manual N° ' + qNum + ' creado.');
        });
      }

      var currentOrder = orders.find(function (o) { return o.id === STATE.editingOrderId; });
      if (currentOrder) {
        var syncOrderHeader = function () {
          currentOrder.quoteNumber = parseInt(body.querySelector('#mm-ord-qnum').value, 10) || currentOrder.quoteNumber;
          currentOrder.date = normalizeDateDdMmYyyy(body.querySelector('#mm-ord-date').value || currentOrder.date);
          currentOrder.customer = currentOrder.customer || {};
          currentOrder.customer.name = String(body.querySelector('#mm-ord-name').value || '').toUpperCase();
          currentOrder.customer.address = String(body.querySelector('#mm-ord-addr').value || '').toUpperCase();
          currentOrder.customer.city = String(body.querySelector('#mm-ord-city').value || '').toUpperCase();
          currentOrder.customer.province = String(body.querySelector('#mm-ord-prov').value || '').toUpperCase();
          currentOrder.customer.phone = String(body.querySelector('#mm-ord-phone').value || '');
          currentOrder.shippingCost = parsePriceInputAr(body.querySelector('#mm-ord-ship').value);
          currentOrder.status = 'confirmed';
          saveAllToCloud('💾 Cabecera del Presupuesto N° ' + currentOrder.quoteNumber + ' guardada.');
        };

        ['#mm-ord-qnum', '#mm-ord-date', '#mm-ord-name', '#mm-ord-addr', '#mm-ord-city', '#mm-ord-prov', '#mm-ord-phone', '#mm-ord-ship'].forEach(function (sel) {
          var el = body.querySelector(sel);
          if (el) el.addEventListener('change', syncOrderHeader);
        });

        body.querySelectorAll('[data-mm-item-conf]').forEach(function (chk) {
          chk.addEventListener('change', function () {
            var idx = parseInt(chk.getAttribute('data-mm-item-conf'), 10);
            if (currentOrder.items[idx]) {
              currentOrder.items[idx].confirmed = chk.checked;
              currentOrder.status = 'confirmed';
              reconcileOrderStock(currentOrder);
              saveAllToCloud('✅ Estado de producto y stock actualizados.');
            }
          });
        });

        body.querySelectorAll('[data-mm-item-code]').forEach(function (inp) {
          inp.addEventListener('change', function () {
            var idx = parseInt(inp.getAttribute('data-mm-item-code'), 10);
            if (currentOrder.items[idx]) {
              currentOrder.items[idx].code = inp.value.trim();
              saveAllToCloud('💾 Código actualizado.');
            }
          });
        });

        body.querySelectorAll('[data-mm-item-name]').forEach(function (inp) {
          inp.addEventListener('change', function () {
            var idx = parseInt(inp.getAttribute('data-mm-item-name'), 10);
            if (currentOrder.items[idx]) {
              currentOrder.items[idx].name = inp.value;
              saveAllToCloud('💾 Descripción actualizada.');
            }
          });
        });

        body.querySelectorAll('[data-mm-item-qty]').forEach(function (inp) {
          inp.addEventListener('change', function () {
            var idx = parseInt(inp.getAttribute('data-mm-item-qty'), 10);
            if (currentOrder.items[idx]) {
              currentOrder.items[idx].qty = Math.max(1, parseInt(inp.value, 10) || 1);
              reconcileOrderStock(currentOrder);
              saveAllToCloud('📦 Cantidad y stock unificado actualizados.');
            }
          });
        });

        body.querySelectorAll('[data-mm-item-price]').forEach(function (inp) {
          inp.addEventListener('change', function () {
            var idx = parseInt(inp.getAttribute('data-mm-item-price'), 10);
            if (currentOrder.items[idx]) {
              currentOrder.items[idx].unitPrice = parsePriceInputAr(inp.value);
              saveAllToCloud('💰 Precio unitario actualizado.');
            }
          });
        });

        body.querySelectorAll('[data-mm-item-del]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var idx = parseInt(btn.getAttribute('data-mm-item-del'), 10);
            currentOrder.items.splice(idx, 1);
            reconcileOrderStock(currentOrder);
            saveAllToCloud('🗑️ Línea eliminada y stock ajustado.');
          });
        });

        body.querySelectorAll('[data-mm-tier]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var tier = btn.getAttribute('data-mm-tier');
            var totalPacks = (currentOrder.items || [])
              .filter(function (i) { return i.confirmed !== false; })
              .reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
            (currentOrder.items || []).forEach(function (item) {
              var prod =
                products.find(function (p) { return p.id === item.productId; }) ||
                products.find(function (p) { return p.code === item.code; });
              if (!prod) return;
              if (tier === 'minorista') item.unitPrice = prod.priceMinorista;
              else if (tier === 'lista1') item.unitPrice = prod.priceLista1;
              else if (tier === 'lista2') item.unitPrice = prod.priceLista2;
              else if (tier === 'lista3') item.unitPrice = prod.priceLista3;
              else if (tier === 'auto') {
                if (
                  totalPacks >= (cat.conditions.lista3.minTotalUnits || 50) &&
                  item.qty >= (cat.conditions.lista3.minSameProductUnits || 5)
                ) {
                  item.unitPrice = prod.priceLista3;
                } else if (totalPacks >= (cat.conditions.lista2.minTotalUnits || 20)) {
                  item.unitPrice = prod.priceLista2;
                } else if (totalPacks >= (cat.conditions.lista1.minTotalUnits || 10)) {
                  item.unitPrice = prod.priceLista1;
                } else {
                  item.unitPrice = prod.priceMinorista;
                }
              }
            });
            saveAllToCloud('✅ Tarifa aplicada a los productos del presupuesto.');
          });
        });

        var addLineBtn = body.querySelector('#mm-btn-add-line');
        if (addLineBtn) {
          addLineBtn.addEventListener('click', function () {
            var sel = body.querySelector('#mm-add-prod-sel');
            var prod = products.find(function (p) { return p.id === (sel && sel.value); });
            if (!prod) return;
            currentOrder.items.push({
              productId: prod.id,
              code: prod.code,
              name: prod.name,
              qty: 1,
              unitPrice: prod.priceLista2,
              confirmed: true
            });
            reconcileOrderStock(currentOrder);
            saveAllToCloud('➕ Producto agregado al presupuesto.');
          });
        }

        var pdfBtn = body.querySelector('#mm-btn-pdf');
        if (pdfBtn) {
          pdfBtn.addEventListener('click', function () {
            currentOrder.status = 'confirmed';
            saveAllToCloud('✅ Presupuesto confirmado.');
            openOfficialMateMaticaPdf(currentOrder);
          });
        }

        var waBtn = body.querySelector('#mm-btn-wa');
        if (waBtn) {
          waBtn.addEventListener('click', function () {
            currentOrder.status = 'confirmed';
            saveAllToCloud('✅ Presupuesto confirmado.');
            sendQuoteToCustomerWhatsApp(currentOrder);
          });
        }

        var delOrdBtn = body.querySelector('#mm-btn-del-order');
        if (delOrdBtn) {
          delOrdBtn.addEventListener('click', function () {
            if (!window.confirm('¿Eliminar el Presupuesto N° ' + currentOrder.quoteNumber + ' y restaurar su stock?')) return;
            var delId = currentOrder.id;
            var restoreMap = Object.assign({}, currentOrder.stockDeductedMap || getOrderDesiredDeductionMap(currentOrder));
            currentOrder.items = [];
            reconcileOrderStock(currentOrder);
            STATE.orders = STATE.orders.filter(function (o) { return o.id !== delId; });
            if (cat && cat.config) {
              cat.config.nextQuoteNumber = computeNextQuoteNumber(STATE.orders);
            }
            STATE.editingOrderId = STATE.orders[0] ? STATE.orders[0].id : null;
            saveAllToCloud('🗑️ Presupuesto eliminado y stock restaurado.', {
              deletedOrderId: delId,
              restoredStockMap: restoreMap,
              stockRestoredByClient: true
            });
          });
        }
      }
      return;
    }

    if (STATE.tab === 'products') {
      var prodSearch = body.querySelector('#mm-prod-search');
      if (prodSearch) {
        prodSearch.addEventListener('input', function () {
          STATE.productSearch = prodSearch.value;
          renderMateMaticaDetail();
          var nextInp = document.getElementById('mm-prod-search');
          if (nextInp) nextInp.focus();
        });
      }

      var stockFilter = body.querySelector('#mm-prod-stock-filter');
      if (stockFilter) {
        stockFilter.addEventListener('change', function () {
          STATE.productStockFilter = stockFilter.value;
          renderMateMaticaDetail();
        });
      }

      var newProdBtn = body.querySelector('#mm-btn-new-prod');
      if (newProdBtn) {
        newProdBtn.addEventListener('click', function () {
          STATE.editingProductId = null;
          STATE.draftImageDataUrl = '';
          STATE.productFormOpen = true;
          renderMateMaticaDetail();
        });
      }

      var closeProdForm = body.querySelector('#mm-close-prod-form');
      if (closeProdForm) {
        closeProdForm.addEventListener('click', function () {
          STATE.productFormOpen = false;
          STATE.editingProductId = null;
          STATE.draftImageDataUrl = '';
          renderMateMaticaDetail();
        });
      }

      var imgFileInp = body.querySelector('#mm-prod-img-file');
      if (imgFileInp) {
        imgFileInp.addEventListener('change', function () {
          var file = imgFileInp.files && imgFileInp.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            var img = new Image();
            img.onload = function () {
              var maxDim = 420;
              var w = img.width;
              var h = img.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) {
                  h = Math.round((h * maxDim) / w);
                  w = maxDim;
                } else {
                  w = Math.round((w * maxDim) / h);
                  h = maxDim;
                }
              }
              var c = document.createElement('canvas');
              c.width = w;
              c.height = h;
              var ctx = c.getContext('2d');
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              var dataUrl = c.toDataURL('image/jpeg', 0.86);
              STATE.draftImageDataUrl = dataUrl;
              var txtInp = document.getElementById('mm-prod-img-inp');
              var prevImg = document.getElementById('mm-prod-img-prev');
              if (txtInp) txtInp.value = dataUrl;
              if (prevImg) prevImg.src = dataUrl;
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      var abmForm = body.querySelector('#mm-prod-abm-form');
      if (abmForm) {
        abmForm.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(abmForm);
          var nowMs = Date.now();
          var code = String(fd.get('code') || '').trim() || String(nowMs);
          var name = String(fd.get('name') || '').trim();
          var brand = String(fd.get('brand') || 'Canarias').trim();
          var weight = String(fd.get('weight') || '500g').trim();
          var stock = Math.max(0, parseInt(String(fd.get('stock') || '0'), 10) || 0);
          var priceMinorista = parsePriceInputAr(fd.get('priceMinorista'));
          var priceLista1 = parsePriceInputAr(fd.get('priceLista1'));
          var priceLista2 = parsePriceInputAr(fd.get('priceLista2'));
          var priceLista3 = parsePriceInputAr(fd.get('priceLista3'));
          var image = String(fd.get('image') || '').trim() || 'assets/images/logo.png';

          if (!name) return;

          if (STATE.editingProductId) {
            var prod = products.find(function (p) { return p.id === STATE.editingProductId; });
            if (prod) {
              prod.code = code;
              prod.name = name;
              prod.brand = brand;
              prod.weight = weight;
              prod.stock = stock;
              prod.stockUpdatedAt = nowMs;
              prod.priceMinorista = priceMinorista;
              prod.priceLista1 = priceLista1;
              prod.priceLista2 = priceLista2;
              prod.priceLista3 = priceLista3;
              prod.priceUpdatedAt = nowMs;
              prod.updatedAt = nowMs;
              prod.image = image;
            }
          } else {
            products.unshift({
              id: 'prod-' + nowMs,
              code: code,
              name: name,
              brand: brand,
              weight: weight,
              stock: stock,
              stockUpdatedAt: nowMs,
              priceMinorista: priceMinorista,
              priceLista1: priceLista1,
              priceLista2: priceLista2,
              priceLista3: priceLista3,
              priceUpdatedAt: nowMs,
              updatedAt: nowMs,
              image: image,
              active: true,
              webOrder: 1
            });
          }

          STATE.productFormOpen = false;
          STATE.editingProductId = null;
          STATE.draftImageDataUrl = '';
          saveAllToCloud('✅ Producto guardado y publicado en Mate-Mática.');
        });
      }

      body.querySelectorAll('[data-mm-q-order]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var id = inp.getAttribute('data-mm-q-order');
          var prod = products.find(function (p) { return p.id === id; });
          if (prod) {
            prod.webOrder = Math.max(1, parseInt(inp.value, 10) || 1);
            prod.updatedAt = Date.now();
            saveAllToCloud('🔢 Orden en la web actualizado para "' + prod.name + '".');
          }
        });
      });

      body.querySelectorAll('[data-mm-q-stock]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var id = inp.getAttribute('data-mm-q-stock');
          var prod = products.find(function (p) { return p.id === id; });
          if (prod) {
            prod.stock = Math.max(0, parseInt(inp.value, 10) || 0);
            prod.stockUpdatedAt = Date.now();
            prod.updatedAt = Date.now();
            saveAllToCloud('📦 Stock actualizado: ' + prod.name + ' (' + prod.stock + ' u.).');
          }
        });
      });

      body.querySelectorAll('[data-mm-q-price]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var id = inp.getAttribute('data-mm-q-price');
          var field = inp.getAttribute('data-field');
          var prod = products.find(function (p) { return p.id === id; });
          if (prod && field) {
            var nowMs = Date.now();
            prod[field] = parsePriceInputAr(inp.value);
            prod.priceUpdatedAt = nowMs;
            prod.updatedAt = nowMs;
            saveAllToCloud('💰 Precio actualizado: ' + prod.name + '.');
          }
        });
      });

      body.querySelectorAll('[data-mm-edit-prod]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          STATE.editingProductId = btn.getAttribute('data-mm-edit-prod');
          STATE.draftImageDataUrl = '';
          STATE.productFormOpen = true;
          renderMateMaticaDetail();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });

      body.querySelectorAll('[data-mm-del-prod]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-mm-del-prod');
          var prod = products.find(function (p) { return p.id === id; });
          if (!prod) return;
          if (!window.confirm('¿Eliminar el producto "' + prod.name + '" del catálogo de Mate-Mática?')) return;
          STATE.catalog.products = products.filter(function (p) { return p.id !== id; });
          saveAllToCloud('🗑️ Producto eliminado del catálogo.');
        });
      });
      return;
    }

    if (STATE.tab === 'conditions') {
      var condForm = body.querySelector('#mm-cond-form');
      if (condForm) {
        condForm.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var fd = new FormData(condForm);
          cat.conditions.lista1.minTotalUnits = Math.max(1, parseInt(String(fd.get('l1Min') || '10'), 10) || 10);
          cat.conditions.lista1.maxTotalUnits = Math.max(1, parseInt(String(fd.get('l1Max') || '19'), 10) || 19);
          cat.conditions.lista1.description = String(fd.get('l1Desc') || '').trim();

          cat.conditions.lista2.minTotalUnits = Math.max(1, parseInt(String(fd.get('l2Min') || '20'), 10) || 20);
          cat.conditions.lista2.description = String(fd.get('l2Desc') || '').trim();

          cat.conditions.lista3.minTotalUnits = Math.max(1, parseInt(String(fd.get('l3MinTotal') || '50'), 10) || 50);
          cat.conditions.lista3.minSameProductUnits = Math.max(1, parseInt(String(fd.get('l3MinSame') || '5'), 10) || 5);
          cat.conditions.lista3.description = String(fd.get('l3Desc') || '').trim();

          cat.config.whatsappNumber = String(fd.get('whatsappNumber') || '').replace(/\D/g, '') || '5493584866586';
          cat.config.nextQuoteNumber = Math.max(1, parseInt(String(fd.get('nextQuoteNumber') || '2292'), 10) || 2292);
          cat.config.ownerLine1 = String(fd.get('ownerLine1') || '').trim();
          cat.config.addressLine1 = String(fd.get('addressLine1') || '').trim();
          cat.config.cityProvince = String(fd.get('cityProvince') || '').trim();

          saveAllToCloud('⚖️ Condiciones mayoristas y configuración actualizadas en Mate-Mática.');
        });
      }
    }
  }

  async function openMmView(viewKey) {
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
          ? 'MiniSistemas a Medida'
          : 'MiniSistemas a Medida · ' + (meta ? meta.label : STATE.view);
    }

    if (STATE.view === 'menu') {
      renderSubmodulesMenu();
      secs.menuSec.hidden = false;
      secs.detailSec.hidden = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    var bc = document.getElementById('mm-breadcrumb');
    if (bc) bc.textContent = meta ? meta.label : 'Mate-Matica';

    secs.menuSec.hidden = true;
    secs.detailSec.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!STATE.catalog) {
      await reloadData(false);
    } else {
      renderMateMaticaDetail();
    }
  }

  function syncHomeCard() {
    bindGlobalNavIntegration();
    var allowed = isGeneralAdmin();
    var grid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-minisistemas-medida-home-card');
    if (allowed && grid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-minisistemas-medida-home-card';
      card.className = 'module-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>' +
            '<line x1="8" y1="21" x2="16" y2="21"></line>' +
            '<line x1="12" y1="17" x2="12" y2="21"></line>' +
            '<path d="M9 10l2 2 4-4"></path>' +
          '</svg>' +
        '</div>' +
        '<h3>MiniSistemas a Medida</h3>';
      card.addEventListener('click', function () {
        openMmView('menu');
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openMmView('menu');
        }
      });
      var anchorCard =
        document.getElementById('ms-megasistemas-home-card') ||
        document.getElementById('ms-superadmin-home-card') ||
        document.getElementById('ms-roncedo-home-card') ||
        document.getElementById('ms-reikionline-home-card') ||
        document.getElementById('ms-doncontador-home-card') ||
        document.getElementById('ms-feriarte-home-card');
      if (anchorCard && anchorCard.nextSibling) {
        grid.insertBefore(card, anchorCard.nextSibling);
      } else {
        grid.appendChild(card);
      }
    } else if (existing) {
      existing.hidden = !allowed;
      existing.style.display = allowed ? '' : 'none';
      if (allowed && grid) {
        var megaOrSa =
          document.getElementById('ms-megasistemas-home-card') ||
          document.getElementById('ms-superadmin-home-card');
        if (megaOrSa && existing.previousElementSibling !== megaOrSa) {
          grid.insertBefore(existing, megaOrSa.nextSibling);
        }
      }
    }
  }

  window.__MS_MINISISTEMAS_MEDIDA_OPEN__ = openMmView;

  setInterval(syncHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncHomeCard);
})();
