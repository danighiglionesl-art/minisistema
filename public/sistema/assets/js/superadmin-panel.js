/* ==========================================================================
   MÓDULO EXCLUSIVO DEL ADMINISTRADOR GENERAL (@danielg) — MINISISTEMA ERP
   Integrado con el diseño canónico de Módulos y Submódulos (.erp-section / .modules-grid / .module-card):
   1. Comercios Habilitados (incluye control de Períodos de Prueba, Extensión, Confirmación de Plan y Baja)
   2. Habilitar Nuevo Sistema (UNIFICADO: Árbol de Módulos + Submódulos con suma automática,
      Lista Oficial de Valores Mensuales, Descuentos, Presupuesto PDF, Alta/Edición/Seguimiento
      de Presupuestos, Período de Prueba configurable en horas y Alta Definitiva con Mercado Pago)
   3. Credenciales API (AFIP/ARCA · Mercado Pago · GitHub · Vercel)
   4. Usuarios (Directorio Global Multi-Proyecto)
   5. CRM · Reporte de Mejoras
   ========================================================================== */
(function () {
  'use strict';

  var STATE_SA = {
    activeView: 'menu', // 'menu' | 'tenants' | 'new' | 'secrets' | 'users'
    newSubTab: 'config', // 'config' | 'quotes'
    data: null,
    loading: false,
    // Configurador unificado (Opción + Árbol de Submódulos + Descuentos + Cliente + Demo)
    newOptionType: 1,
    newActividadNegocio: 'comercial',
    selectedSubmodules: {}, // { [subKey]: boolean }
    expandedModules: {}, // { [modKey]: boolean }
    submodulePrices: {}, // { [subKey]: number }
    quoteDiscountsByMod: {}, // { [modKey]: number, '__opt1': number, '__opt2': number }
    quoteGlobalType: 'none',
    quoteGlobalPct: 0,
    quoteGlobalFixed: 0,
    quoteTempMonths: 3,
    // Datos borrador de cliente / presupuesto / demo
    editingQuoteId: '',
    editingQuoteNumero: '',
    editingQuoteEstado: 'BORRADOR',
    draftForm: {
      slug: '',
      fantasyName: '',
      businessName: '',
      cuit: '',
      contactName: '',
      payerEmail: '',
      whatsappDigits: '',
      localidad: 'RÍO CUARTO',
      customDomain: '',
      primaryHex: '#112D3A',
      accentHex: '#56D7A1',
      logo1x1Url: '',
      logoHorizontalUrl: '',
      validDays: 15,
      notas: '',
      trialHours: 72,
      demoUsername: '',
      demoPassword: 'Demo2026',
      adminUsername: '',
      adminPassword: '',
      adminName: '',
      linkedTenantSlug: ''
    },
    newLogo1x1Data: '',
    newLogoHorizData: '',
    lastCreatedDemoBanner: null,
    // Filtros Seguimiento de Presupuestos
    quotesSearch: '',
    quotesStatusFilter: 'ALL',
    // Gestión comercios / usuarios / AFIP
    managingUsersSlug: null,
    managingUsersList: [],
    afipSelectedSlug: 'minisistema',
    afipTenantInfo: null,
    usersSearch: '',
    usersProjectFilter: 'ALL',
    usersTypeFilter: 'ALL',
    usersStatusFilter: 'ALL',
    usersShowAllPasswords: true,
    usersRevealedMap: {},
    usersFormOpen: false,
    usersEditingItem: null
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

  function sanitizeSlugLocal(raw) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\.com\.ar.*$|\.ar.*$/g, '')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_]+|[-_]+$/g, '')
      .slice(0, 36);
  }

  function formatDateTimeAr(isoStr) {
    if (!isoStr) return '—';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Cordoba',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  function formatDateAr(isoStr) {
    if (!isoStr) return '—';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Cordoba',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function generateRandomPass() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    var out = '';
    for (var i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out + '26';
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

  function isDanielGeneralAdmin() {
    var isBaseTenant = Boolean(
      (window.__ERP_TENANT_BOOT__ && window.__ERP_TENANT_BOOT__.isBase) ||
        (window.ERP_BRAND && window.ERP_BRAND.isBase)
    );
    if (!isBaseTenant) return false;
    var u = getActiveUser();
    if (!u || !u.username) return false;
    return String(u.username).trim().toLowerCase() === 'danielg';
  }

  async function apiSuperAdmin(method, bodyOrQuery) {
    var url = '/sistema/api/superadmin.php';
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

  function getViewTitle(viewKey) {
    if (viewKey === 'tenants') return 'Comercios Habilitados';
    if (viewKey === 'new' || viewKey === 'pricing') return 'Habilitar Nuevo Sistema';
    if (viewKey === 'secrets') return 'Credenciales API';
    if (viewKey === 'users') return 'Usuarios';
    return 'Administrador General';
  }

  function getModuleSubmodules(mod) {
    if (Array.isArray(mod.submodules) && mod.submodules.length > 0) {
      return mod.submodules;
    }
    return [{ key: mod.key, name: mod.name, defaultMonthlyArs: Number(mod.defaultMonthlyArs || 0) }];
  }

  function syncSubmodulePricesFromServer(data) {
    if (!data || !Array.isArray(data.commercialModules)) return;
    var cfg = data.pricingConfig || {};
    var modPrices = cfg.module_prices || {};
    data.commercialModules.forEach(function (m) {
      var subs = getModuleSubmodules(m);
      var mEntry = modPrices[m.key] || {};
      var srvSubMap = mEntry.submodulePrices || {};
      subs.forEach(function (s) {
        if (STATE_SA.submodulePrices[s.key] === undefined) {
          var v =
            srvSubMap[s.key] !== undefined
              ? Number(srvSubMap[s.key])
              : Number(s.defaultMonthlyArs || 0);
          STATE_SA.submodulePrices[s.key] = Math.max(0, Math.round(v));
        }
      });
      if (
        STATE_SA.quoteDiscountsByMod[m.key] === undefined &&
        Number(mEntry.defaultDiscountPct || 0) > 0
      ) {
        STATE_SA.quoteDiscountsByMod[m.key] = Number(mEntry.defaultDiscountPct || 0);
      }
    });
  }

  function applyActivityPresetSubmodules(actividad) {
    var data = STATE_SA.data;
    if (!data || !Array.isArray(data.commercialModules)) return;
    var targetModKeys;
    if (actividad === 'servicios') {
      targetModKeys = ['servicios', 'facturacion', 'clientes', 'tema', 'manual_usuario'];
    } else if (actividad === 'mixta') {
      targetModKeys = [
        'servicios',
        'facturacion',
        'articulos',
        'clientes',
        'proveedores',
        'fondos',
        'tema',
        'manual_usuario'
      ];
    } else {
      targetModKeys = [
        'facturacion',
        'articulos',
        'clientes',
        'proveedores',
        'fondos',
        'tema',
        'manual_usuario'
      ];
    }
    var nextSubs = {};
    data.commercialModules.forEach(function (m) {
      if (targetModKeys.indexOf(m.key) !== -1) {
        getModuleSubmodules(m).forEach(function (s) {
          nextSubs[s.key] = true;
        });
      }
    });
    STATE_SA.selectedSubmodules = nextSubs;
  }

  function resetNewConfiguratorBlank() {
    STATE_SA.editingQuoteId = '';
    STATE_SA.editingQuoteNumero = '';
    STATE_SA.editingQuoteEstado = 'BORRADOR';
    STATE_SA.newOptionType = 1;
    STATE_SA.newActividadNegocio = 'comercial';
    STATE_SA.quoteDiscountsByMod = {};
    STATE_SA.quoteGlobalType = 'none';
    STATE_SA.quoteGlobalPct = 0;
    STATE_SA.quoteGlobalFixed = 0;
    STATE_SA.quoteTempMonths = 3;
    STATE_SA.newLogo1x1Data = '';
    STATE_SA.newLogoHorizData = '';
    STATE_SA.draftForm = {
      slug: '',
      fantasyName: '',
      businessName: '',
      cuit: '',
      contactName: '',
      payerEmail: '',
      whatsappDigits: '',
      localidad: 'RÍO CUARTO',
      customDomain: '',
      primaryHex: '#112D3A',
      accentHex: '#56D7A1',
      logo1x1Url: '',
      logoHorizontalUrl: '',
      validDays: 15,
      notas: '',
      trialHours: 72,
      demoUsername: '',
      demoPassword: 'Demo2026',
      adminUsername: '',
      adminPassword: '',
      adminName: '',
      linkedTenantSlug: ''
    };
    if (STATE_SA.data) {
      STATE_SA.submodulePrices = {};
      syncSubmodulePricesFromServer(STATE_SA.data);
      applyActivityPresetSubmodules('comercial');
    }
  }

  function loadQuoteIntoConfigurator(q) {
    if (!q) return;
    STATE_SA.editingQuoteId = q.id || '';
    STATE_SA.editingQuoteNumero = q.numero || '';
    STATE_SA.editingQuoteEstado = q.estado || 'ENVIADO';
    STATE_SA.newOptionType = Number(q.optionType) === 2 ? 2 : 1;
    STATE_SA.newActividadNegocio = q.actividadNegocio || 'comercial';
    STATE_SA.quoteGlobalType = q.globalDiscountType || 'none';
    STATE_SA.quoteGlobalPct = Number(q.globalDiscountPct || 0);
    STATE_SA.quoteGlobalFixed = Number(q.globalDiscountFixed || 0);
    STATE_SA.quoteTempMonths = Number(q.temporaryMonths || 3) || 3;

    var nextDisc = Object.assign({}, q.moduleDiscountsPct || {});
    nextDisc['__opt' + STATE_SA.newOptionType] = Number(q.optionDiscountPct || 0);
    STATE_SA.quoteDiscountsByMod = nextDisc;

    if (STATE_SA.data) {
      STATE_SA.submodulePrices = {};
      syncSubmodulePricesFromServer(STATE_SA.data);
    }
    if (q.submodulePricesSnapshot && typeof q.submodulePricesSnapshot === 'object') {
      Object.keys(q.submodulePricesSnapshot).forEach(function (sk) {
        STATE_SA.submodulePrices[sk] = Math.max(0, Math.round(Number(q.submodulePricesSnapshot[sk] || 0)));
      });
    }

    var nextSel = {};
    var subArr = Array.isArray(q.selectedSubmoduleKeys) ? q.selectedSubmoduleKeys : [];
    if (subArr.length > 0) {
      subArr.forEach(function (sk) {
        nextSel[sk] = true;
      });
    } else if (Array.isArray(q.selectedModuleKeys) && STATE_SA.data) {
      (STATE_SA.data.commercialModules || []).forEach(function (m) {
        if (q.selectedModuleKeys.indexOf(m.key) !== -1) {
          getModuleSubmodules(m).forEach(function (s) {
            nextSel[s.key] = true;
          });
        }
      });
    }
    STATE_SA.selectedSubmodules = nextSel;

    STATE_SA.draftForm = {
      slug: q.slug || '',
      fantasyName: q.fantasyName || '',
      businessName: q.businessName || '',
      cuit: q.cuit || '',
      contactName: q.contactName || '',
      payerEmail: q.payerEmail || '',
      whatsappDigits: q.whatsappDigits || '',
      localidad: q.localidad || 'RÍO CUARTO',
      customDomain: q.customDomain || '',
      primaryHex: q.primaryHex || '#112D3A',
      accentHex: q.accentHex || '#56D7A1',
      logo1x1Url: q.logo1x1Url || '',
      logoHorizontalUrl: q.logoHorizontalUrl || '',
      validDays: Number(q.validDays || 15),
      notas: q.notas || '',
      trialHours: Number(q.trialHours || 72),
      demoUsername: q.demoUsername || '',
      demoPassword: q.demoPassword || 'Demo2026',
      adminUsername: q.adminUsername || '',
      adminPassword: q.adminPassword || '',
      adminName: q.adminName || '',
      linkedTenantSlug: q.linkedTenantSlug || ''
    };
    STATE_SA.newSubTab = 'config';
  }

  function computeTreeQuote() {
    var data = STATE_SA.data;
    if (!data) {
      return {
        optionRaw: 0,
        optionDiscPct: 0,
        optionBase: 0,
        modTotal: 0,
        subtotal: 0,
        promoMonthly: 0,
        regularMonthly: 0,
        months: 0,
        selectedModCount: 0,
        selectedSubCount: 0,
        selectedModuleKeys: [],
        selectedSubmoduleKeys: [],
        moduleBreakdown: []
      };
    }
    var cfg = data.pricingConfig || {};
    var optType = STATE_SA.newOptionType === 2 ? 2 : 1;
    var rawOptBase = Math.max(
      0,
      Math.round(Number(optType === 1 ? cfg.option_1_base ?? 35000 : cfg.option_2_base ?? 15000))
    );
    var optDiscPct = Math.min(
      100,
      Math.max(0, Number(STATE_SA.quoteDiscountsByMod['__opt' + optType] || 0))
    );
    var optionBase = Math.round(rawOptBase * (1 - optDiscPct / 100));

    var modTotal = 0;
    var selectedModKeys = [];
    var selectedSubKeys = [];
    var breakdown = [];

    (data.commercialModules || []).forEach(function (m) {
      var subs = getModuleSubmodules(m);
      var catalogSum = 0;
      var activeSum = 0;
      var chosenSubs = [];

      subs.forEach(function (s) {
        var sp = Math.max(
          0,
          Math.round(
            STATE_SA.submodulePrices[s.key] !== undefined
              ? Number(STATE_SA.submodulePrices[s.key])
              : Number(s.defaultMonthlyArs || 0)
          )
        );
        catalogSum += sp;
        if (STATE_SA.selectedSubmodules[s.key]) {
          activeSum += sp;
          selectedSubKeys.push(s.key);
          chosenSubs.push({ key: s.key, name: s.name, price: sp });
        }
      });

      var modDiscPct = Math.min(
        100,
        Math.max(0, Number(STATE_SA.quoteDiscountsByMod[m.key] || 0))
      );
      var hasSelection = chosenSubs.length > 0;
      var modNet = hasSelection ? Math.max(0, Math.round(activeSum * (1 - modDiscPct / 100))) : 0;

      if (hasSelection) {
        selectedModKeys.push(m.key);
        modTotal += modNet;
      }

      breakdown.push({
        key: m.key,
        name: m.name,
        totalSubsCount: subs.length,
        selectedSubsCount: chosenSubs.length,
        catalogSum: catalogSum,
        selectedBaseSum: activeSum,
        discountPct: modDiscPct,
        netSelected: modNet,
        chosenSubs: chosenSubs
      });
    });

    var subtotal = Math.max(0, Math.round(optionBase + modTotal));
    var gType = STATE_SA.quoteGlobalType || 'none';
    var gPct = gType === 'none' ? 0 : Math.min(100, Math.max(0, Number(STATE_SA.quoteGlobalPct || 0)));
    var gFix = gType === 'none' ? 0 : Math.max(0, Math.round(Number(STATE_SA.quoteGlobalFixed || 0)));
    var discounted = Math.max(0, Math.round(subtotal * (1 - gPct / 100) - gFix));
    var months = gType === 'temporary' ? Math.max(1, Number(STATE_SA.quoteTempMonths || 3)) : 0;

    return {
      optionRaw: rawOptBase,
      optionDiscPct: optDiscPct,
      optionBase: optionBase,
      modTotal: modTotal,
      subtotal: subtotal,
      promoMonthly: gType === 'none' ? subtotal : discounted,
      regularMonthly: gType === 'permanent' ? discounted : subtotal,
      months: months,
      selectedModCount: selectedModKeys.length,
      selectedSubCount: selectedSubKeys.length,
      selectedModuleKeys: selectedModKeys,
      selectedSubmoduleKeys: selectedSubKeys,
      moduleBreakdown: breakdown
    };
  }

  function ensureSectionsMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var menuSec = document.getElementById('sec-menu-superadmin');
    var detailSec = document.getElementById('sec-superadmin-detail');

    // Si había un menú viejo con la tarjeta duplicada "pricing", reconstruirlo limpio
    if (menuSec && menuSec.querySelector('[data-sa-open-view="pricing"]')) {
      menuSec.remove();
      menuSec = null;
    }

    if (!menuSec) {
      menuSec = document.createElement('section');
      menuSec.id = 'sec-menu-superadmin';
      menuSec.className = 'erp-section';
      menuSec.hidden = true;
      menuSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-sa-back-home-btn">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">ERP en Línea · <strong>Administrador General (@danielg)</strong></span>' +
          '</div>' +
          '<div style="display:inline-flex;align-items:center;gap:0.65rem;background:#112D3A;border-radius:12px;padding:0.35rem 0.85rem;">' +
            '<img src="/sistema/assets/img/minisistema/logo-horizontal.png" alt="MiniSistema" style="height:26px;width:auto;object-fit:contain;background:transparent;border:none;display:block;">' +
            '<span style="background:#56D7A1;color:#112D3A;font-size:0.68rem;font-weight:900;padding:0.15rem 0.5rem;border-radius:999px;">EXCLUSIVO @danielg</span>' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" aria-label="Submódulos de Administrador General">' +
          '<article class="module-card" role="button" tabindex="0" data-sa-open-view="tenants">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>' +
                '<path d="M9 22v-4h6v4"></path>' +
                '<path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path>' +
                '<path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path>' +
                '<path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path>' +
              '</svg>' +
            '</div>' +
            '<h3>Comercios Habilitados</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-sa-open-view="new">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<circle cx="12" cy="12" r="10"></circle>' +
                '<line x1="12" y1="8" x2="12" y2="16"></line>' +
                '<line x1="8" y1="12" x2="16" y2="12"></line>' +
              '</svg>' +
            '</div>' +
            '<h3>Habilitar Nuevo Sistema</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-sa-open-view="secrets">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
                '<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' +
              '</svg>' +
            '</div>' +
            '<h3>Credenciales API</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-sa-open-view="users">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>' +
                '<circle cx="9" cy="7" r="4"></circle>' +
                '<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>' +
                '<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>' +
              '</svg>' +
            '</div>' +
            '<h3>Usuarios</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-sa-open-view="crm">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>' +
              '</svg>' +
            '</div>' +
            '<h3>CRM · Reporte de Mejoras</h3>' +
          '</article>' +
        '</div>';

      erpMain.appendChild(menuSec);

      menuSec.querySelector('#ms-sa-back-home-btn').addEventListener('click', function () {
        closeSuperAdminSectionsToHome();
      });

      menuSec.querySelectorAll('[data-sa-open-view]').forEach(function (card) {
        card.addEventListener('click', function () {
          var v = card.getAttribute('data-sa-open-view');
          openSuperAdminView(v);
        });
        card.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            var v = card.getAttribute('data-sa-open-view');
            openSuperAdminView(v);
          }
        });
      });
    }

    if (!detailSec) {
      detailSec = document.createElement('section');
      detailSec.id = 'sec-superadmin-detail';
      detailSec.className = 'erp-section';
      detailSec.hidden = true;
      detailSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-sa-back-menu-btn">← Volver a Administrador General</button>' +
            '<span class="module-breadcrumb">ERP en Línea · Administrador General · <strong id="ms-sa-detail-breadcrumb">Comercios Habilitados</strong></span>' +
          '</div>' +
          '<div style="display:inline-flex;align-items:center;gap:0.65rem;background:#112D3A;border-radius:12px;padding:0.35rem 0.85rem;">' +
            '<img src="/sistema/assets/img/minisistema/logo-horizontal.png" alt="MiniSistema" style="height:26px;width:auto;object-fit:contain;background:transparent;border:none;display:block;">' +
            '<span style="background:#56D7A1;color:#112D3A;font-size:0.68rem;font-weight:900;padding:0.15rem 0.5rem;border-radius:999px;">@danielg</span>' +
          '</div>' +
        '</div>' +
        '<div id="ms-sa-feedback" style="display:none;margin:0 0 1rem;padding:0.75rem 1rem;border-radius:10px;font-weight:700;font-size:0.86rem;"></div>' +
        '<div id="ms-sa-body">Cargando datos...</div>';

      erpMain.appendChild(detailSec);

      detailSec.querySelector('#ms-sa-back-menu-btn').addEventListener('click', function () {
        openSuperAdminView('menu');
      });
    }

    return { menuSec: menuSec, detailSec: detailSec };
  }

  function closeSuperAdminSectionsToHome() {
    var menuSec = document.getElementById('sec-menu-superadmin');
    var detailSec = document.getElementById('sec-superadmin-detail');
    if (menuSec) menuSec.hidden = true;
    if (detailSec) detailSec.hidden = true;
    var inicioSec = document.getElementById('sec-inicio');
    if (inicioSec) inicioSec.hidden = false;
    var backBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backBtn) backBtn.hidden = true;
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    if (topbarModInd) topbarModInd.hidden = true;
  }

  async function openSuperAdminView(viewKey) {
    if (viewKey === 'pricing') viewKey = 'new';
    if (viewKey === 'crm') {
      var menuSec0 = document.getElementById('sec-menu-superadmin');
      var detailSec0 = document.getElementById('sec-superadmin-detail');
      if (menuSec0) menuSec0.hidden = true;
      if (detailSec0) detailSec0.hidden = true;
      var crmCard = document.getElementById('card-inicio-crm');
      if (crmCard) {
        crmCard.click();
      } else {
        document.querySelectorAll('.erp-main > .erp-section').forEach(function (sec) {
          sec.hidden = true;
        });
        var crmSec = document.getElementById('sec-crm');
        if (crmSec) crmSec.hidden = false;
      }
      if (typeof window.initOrRefreshCrmSection === 'function') {
        window.initOrRefreshCrmSection();
      }
      return;
    }
    var secs = ensureSectionsMounted();
    if (!secs) return;
    STATE_SA.activeView = viewKey || 'menu';
    if (viewKey !== 'tenants') {
      STATE_SA.managingUsersSlug = null;
    }

    document.querySelectorAll('.erp-main > .erp-section').forEach(function (sec) {
      sec.hidden = true;
    });

    var backTopBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backTopBtn) {
      backTopBtn.hidden = false;
      backTopBtn.textContent = '← Atrás';
    }
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    if (topbarModInd) {
      topbarModInd.hidden = false;
      topbarModInd.textContent =
        STATE_SA.activeView === 'menu'
          ? 'Administrador General'
          : 'Administrador General · ' + getViewTitle(STATE_SA.activeView);
    }

    if (STATE_SA.activeView === 'menu') {
      secs.menuSec.hidden = false;
      secs.detailSec.hidden = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (!STATE_SA.data) {
        reloadSuperAdminData(false);
      }
      return;
    }

    secs.menuSec.hidden = true;
    secs.detailSec.hidden = false;
    var bc = document.getElementById('ms-sa-detail-breadcrumb');
    if (bc) bc.textContent = getViewTitle(STATE_SA.activeView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await reloadSuperAdminData(true);
  }

  function showFeedback(msg, isError) {
    var box = document.getElementById('ms-sa-feedback');
    if (!box) return;
    box.style.display = 'block';
    box.style.background = isError ? '#fee2e2' : '#dcfce7';
    box.style.color = isError ? '#991b1b' : '#065f46';
    box.style.border = isError ? '1px solid #f87171' : '1px solid #34d399';
    box.textContent = msg;
    setTimeout(function () {
      if (box.textContent === msg) box.style.display = 'none';
    }, 8000);
  }

  async function reloadSuperAdminData(shouldRender) {
    var bodyEl = document.getElementById('ms-sa-body');
    if (shouldRender && bodyEl && !STATE_SA.data) {
      bodyEl.innerHTML = '<p style="font-weight:700;">Conectando con Supabase (minisistema-erp)...</p>';
    }
    var json = await apiSuperAdmin('GET');
    if (!json || !json.ok) {
      if (shouldRender && bodyEl) {
        bodyEl.innerHTML =
          '<p style="color:#991b1b;font-weight:700;">' +
          esc((json && json.message) || 'No se pudo cargar el módulo.') +
          '</p>';
      }
      return;
    }
    STATE_SA.data = json;
    syncSubmodulePricesFromServer(json);
    if (Object.keys(STATE_SA.selectedSubmodules).length === 0) {
      applyActivityPresetSubmodules(STATE_SA.newActividadNegocio || 'comercial');
    }
    if (shouldRender) {
      renderBody();
    }
  }

  // =========================================================================
  // GENERADOR DE PRESUPUESTO EN PDF (IMPRESIÓN / GUARDADO A4 PROFESIONAL)
  // =========================================================================
  function openQuotePdfWindow(quoteRecord) {
    if (!quoteRecord) return;
    var data = STATE_SA.data || {};
    var allMods = data.commercialModules || [];
    var subMapCfg = quoteRecord.submodulePricesSnapshot || {};
    var modDiscMap = quoteRecord.moduleDiscountsPct || {};
    var selSubSet = {};
    (quoteRecord.selectedSubmoduleKeys || []).forEach(function (k) {
      selSubSet[k] = true;
    });

    var optLabel =
      Number(quoteRecord.optionType) === 1
        ? 'Opción 1 · Dominio y Marca Propia' +
          (quoteRecord.customDomain ? ' (' + quoteRecord.customDomain + ')' : '')
        : 'Opción 2 · Subruta Oficial MiniSistema (minisistema.com.ar/' +
          (quoteRecord.slug || 'comercio') +
          ')';

    var fechaEmision = formatDateAr(quoteRecord.updatedAt || quoteRecord.createdAt || new Date().toISOString());
    var validDays = Number(quoteRecord.validDays || 15);
    var vencDate = new Date(
      (quoteRecord.createdAt ? Date.parse(quoteRecord.createdAt) : Date.now()) +
        validDays * 86400000
    );
    var fechaValidez = formatDateAr(vencDate.toISOString());

    var itemsRowsHtml = '';
    var optRaw = Number(quoteRecord.optionBasePrice || 0);
    var optDisc = Number(quoteRecord.optionDiscountPct || 0);
    var optNet = Number(quoteRecord.optionNet != null ? quoteRecord.optionNet : Math.round(optRaw * (1 - optDisc / 100)));

    itemsRowsHtml +=
      '<tr class="mod-row">' +
        '<td><strong>Infraestructura Base — ' + esc(optLabel) + '</strong><div class="sub-note">Base de datos aislada en la nube, copias de seguridad, SSL y actualizaciones continuas.</div></td>' +
        '<td class="num">' + fmtArs.format(optRaw) + '</td>' +
        '<td class="num">' + (optDisc > 0 ? optDisc + '%' : '—') + '</td>' +
        '<td class="num"><strong>' + fmtArs.format(optNet) + '</strong></td>' +
      '</tr>';

    allMods.forEach(function (m) {
      var subs = getModuleSubmodules(m);
      var chosen = subs.filter(function (s) {
        return Boolean(selSubSet[s.key]);
      });
      if (!chosen.length) return;
      var modSum = 0;
      var subsBadges = chosen
        .map(function (s) {
          var sp =
            subMapCfg[s.key] !== undefined
              ? Number(subMapCfg[s.key])
              : STATE_SA.submodulePrices[s.key] !== undefined
                ? Number(STATE_SA.submodulePrices[s.key])
                : Number(s.defaultMonthlyArs || 0);
          modSum += sp;
          return (
            '<span class="sub-chip">✓ ' +
            esc(s.name) +
            (sp > 0 ? ' <em>(' + fmtArs.format(sp) + ')</em>' : '') +
            '</span>'
          );
        })
        .join(' ');
      var mDisc = Number(modDiscMap[m.key] || 0);
      var mNet = Math.max(0, Math.round(modSum * (1 - mDisc / 100)));

      itemsRowsHtml +=
        '<tr class="mod-row">' +
          '<td>' +
            '<strong>Módulo: ' + esc(m.name) + '</strong> ' +
            '<span style="font-size:11px;color:#475569;">(' + chosen.length + '/' + subs.length + ' submódulos)</span>' +
            '<div class="subs-wrap">' + subsBadges + '</div>' +
          '</td>' +
          '<td class="num">' + (modSum > 0 ? fmtArs.format(modSum) : 'Sin cargo') + '</td>' +
          '<td class="num">' + (mDisc > 0 ? mDisc + '%' : '—') + '</td>' +
          '<td class="num"><strong>' + (mNet > 0 ? fmtArs.format(mNet) : 'Sin cargo') + '</strong></td>' +
        '</tr>';
    });

    var subtotal = Number(quoteRecord.subtotalMensual || 0);
    var totalFinal = Number(quoteRecord.totalPromoMensual || subtotal);
    var totalReg = Number(quoteRecord.totalRegularMensual || subtotal);
    var gType = quoteRecord.globalDiscountType || 'none';
    var gPct = Number(quoteRecord.globalDiscountPct || 0);
    var gFix = Number(quoteRecord.globalDiscountFixed || 0);
    var ahorroGlobal = Math.max(0, subtotal - totalFinal);
    var trialHs = Number(quoteRecord.trialHours || 72);

    var waShareText =
      '¡Hola' +
      (quoteRecord.contactName ? ' ' + quoteRecord.contactName : '') +
      '! Te compartimos el Presupuesto *' +
      (quoteRecord.numero || 'MiniSistema') +
      '* para *' +
      (quoteRecord.fantasyName || 'tu sistema') +
      '*:\n' +
      '• Modalidad: ' +
      optLabel +
      '\n' +
      '• Módulos incluidos: ' +
      (quoteRecord.selectedModuleKeys || []).length +
      ' (' +
      (quoteRecord.selectedSubmoduleKeys || []).length +
      ' submódulos)\n' +
      '• Valor mensual: *' +
      fmtArs.format(totalFinal) +
      '/mes*' +
      (gType === 'temporary' && quoteRecord.temporaryMonths
        ? ' (promo por ' + quoteRecord.temporaryMonths + ' meses, luego ' + fmtArs.format(totalReg) + '/mes)'
        : '') +
      '\n' +
      '• Incluye Período de Prueba sin cargo por *' +
      trialHs +
      ' horas* con base de datos limpia para que lo pruebes antes de contratar.';
    var waDigitsClean = String(quoteRecord.whatsappDigits || '').replace(/\D/g, '');
    var waHref =
      'https://wa.me/' +
      (waDigitsClean ? waDigitsClean : '') +
      '?text=' +
      encodeURIComponent(waShareText);

    var win = window.open('', '_blank');
    if (!win) {
      showFeedback('Habilitá las ventanas emergentes del navegador para abrir el Presupuesto en PDF.', true);
      return;
    }

    var htmlDoc =
      '<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8">' +
      '<title>Presupuesto ' + esc(quoteRecord.numero || '') + ' — ' + esc(quoteRecord.fantasyName || 'MiniSistema') + '</title>' +
      '<style>' +
        '*{box-sizing:border-box;}' +
        'body{margin:0;padding:0;font-family:"Segoe UI",Roboto,Arial,sans-serif;background:#e2e8f0;color:#0f172a;}' +
        '.toolbar{position:sticky;top:0;z-index:20;background:#112D3A;color:#fff;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 4px 14px rgba(0,0,0,.22);}' +
        '.toolbar-btns{display:flex;gap:10px;flex-wrap:wrap;}' +
        '.tbtn{border:none;border-radius:8px;padding:9px 16px;font-weight:800;font-size:13px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;}' +
        '.tbtn--mint{background:#56D7A1;color:#112D3A;}' +
        '.tbtn--wa{background:#22c55e;color:#fff;}' +
        '.tbtn--ghost{background:rgba(255,255,255,.14);color:#fff;}' +
        '.sheet{max-width:210mm;margin:22px auto;background:#fff;padding:16mm 15mm;border-radius:12px;box-shadow:0 12px 36px rgba(15,23,42,.15);}' +
        '.hdr{display:flex;justify-content:space-between;align-items:center;background:#112D3A;color:#fff;padding:20px 24px;border-radius:12px;border-bottom:4px solid #56D7A1;}' +
        '.hdr img{height:42px;width:auto;object-fit:contain;}' +
        '.hdr-right{text-align:right;}' +
        '.pres-num{font-size:20px;font-weight:900;color:#56D7A1;letter-spacing:.03em;}' +
        '.pres-meta{font-size:12px;color:#cbd5e1;margin-top:4px;}' +
        '.client-box{margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;padding:14px 18px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;font-size:12.5px;}' +
        '.client-box div strong{color:#112D3A;}' +
        'table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12.5px;}' +
        'th{background:#112D3A;color:#fff;padding:9px 10px;text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.03em;}' +
        'th.num,td.num{text-align:right;white-space:nowrap;vertical-align:top;}' +
        'td{padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top;}' +
        '.sub-note{font-size:11px;color:#64748b;margin-top:3px;}' +
        '.subs-wrap{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;}' +
        '.sub-chip{display:inline-block;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:5px;padding:2px 7px;font-size:10.5px;color:#1e293b;}' +
        '.sub-chip em{font-style:normal;color:#0f766e;font-weight:700;}' +
        '.totals-wrap{margin-top:16px;display:grid;grid-template-columns:1.25fr 1fr;gap:16px;align-items:start;}' +
        '.trial-card{padding:14px 16px;border-radius:10px;background:#ecfdf5;border:1.5px solid #56D7A1;font-size:12px;color:#064e3b;line-height:1.45;}' +
        '.totals-card{padding:14px 18px;border-radius:10px;background:#112D3A;color:#fff;}' +
        '.tot-row{display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0;color:#cbd5e1;}' +
        '.tot-final{display:flex;justify-content:space-between;align-items:baseline;border-top:1.5px solid rgba(86,215,161,.45);margin-top:8px;padding-top:8px;font-size:18px;font-weight:900;color:#56D7A1;}' +
        '.notes-box{margin-top:14px;padding:12px 16px;border-radius:8px;background:#f8fafc;border:1px dashed #94a3b8;font-size:12px;color:#334155;white-space:pre-wrap;}' +
        '.sign-row{margin-top:26px;display:grid;grid-template-columns:1fr 1fr;gap:40px;font-size:11.5px;color:#475569;text-align:center;}' +
        '.sign-line{border-top:1px solid #94a3b8;padding-top:6px;margin-top:34px;}' +
        '@media print{body{background:#fff;} .toolbar{display:none !important;} .sheet{margin:0;padding:8mm;box-shadow:none;border-radius:0;max-width:100%;}}' +
      '</style></head><body>' +
      '<div class="toolbar">' +
        '<div><strong>Presupuesto ' + esc(quoteRecord.numero || '') + '</strong> · ' + esc(quoteRecord.fantasyName || '') + '</div>' +
        '<div class="toolbar-btns">' +
          '<button class="tbtn tbtn--mint" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>' +
          '<a class="tbtn tbtn--wa" href="' + esc(waHref) + '" target="_blank" rel="noopener">📲 Enviar Resumen por WhatsApp</a>' +
          '<button class="tbtn tbtn--ghost" onclick="window.close()">✕ Cerrar</button>' +
        '</div>' +
      '</div>' +
      '<div class="sheet">' +
        '<div class="hdr">' +
          '<div>' +
            '<img src="' + window.location.origin + '/sistema/assets/img/minisistema/logo-horizontal.png" alt="MiniSistema">' +
            '<div style="font-size:11.5px;color:#cbd5e1;margin-top:5px;">Sistemas de Gestión ERP, Portales Web y Aplicaciones en la Nube · www.minisistema.com.ar</div>' +
          '</div>' +
          '<div class="hdr-right">' +
            '<div class="pres-num">' + esc(quoteRecord.numero || 'PRESUPUESTO') + '</div>' +
            '<div class="pres-meta">Fecha: ' + esc(fechaEmision) + ' · Validez: ' + validDays + ' días (hasta ' + esc(fechaValidez) + ')</div>' +
          '</div>' +
        '</div>' +
        '<div class="client-box">' +
          '<div><strong>Comercio / Fantasía:</strong> ' + esc(quoteRecord.fantasyName || '—') + '</div>' +
          '<div><strong>Modalidad:</strong> ' + esc(optLabel) + '</div>' +
          '<div><strong>Razón Social / Titular:</strong> ' + esc(quoteRecord.businessName || quoteRecord.fantasyName || '—') + '</div>' +
          '<div><strong>CUIT / Documento:</strong> ' + esc(quoteRecord.cuit || '—') + '</div>' +
          '<div><strong>Contacto:</strong> ' + esc(quoteRecord.contactName || '—') + (quoteRecord.localidad ? ' (' + esc(quoteRecord.localidad) + ')' : '') + '</div>' +
          '<div><strong>Email / WhatsApp:</strong> ' + esc(quoteRecord.payerEmail || '—') + (quoteRecord.whatsappDigits ? ' · ' + esc(quoteRecord.whatsappDigits) : '') + '</div>' +
        '</div>' +
        '<table>' +
          '<thead><tr><th>Módulo y Submódulos Incluidos</th><th class="num">Valor Lista</th><th class="num">Dto.</th><th class="num">Neto Mensual</th></tr></thead>' +
          '<tbody>' + itemsRowsHtml + '</tbody>' +
        '</table>' +
        '<div class="totals-wrap">' +
          '<div class="trial-card">' +
            '<strong>🧪 Período de Prueba Operativo Incluido (' + trialHs + ' horas):</strong><br>' +
            'Una vez aceptado este presupuesto, habilitamos un entorno real con <strong>base de datos propia y limpia</strong> durante <strong>' + trialHs + ' horas</strong> con usuario y contraseña demo para validar todos los módulos y submódulos seleccionados.<br>' +
            'Al finalizar la prueba, podés confirmar la habilitación del Plan conservando los datos cargados (de no contratarse, el entorno demo se da de baja automáticamente a los 10 días).' +
          '</div>' +
          '<div class="totals-card">' +
            '<div class="tot-row"><span>Subtotal Mensual:</span><span>' + fmtArs.format(subtotal) + '</span></div>' +
            (ahorroGlobal > 0
              ? '<div class="tot-row" style="color:#56D7A1;"><span>Bonificación (' +
                (gPct > 0 ? gPct + '%' : '') +
                (gFix > 0 ? (gPct > 0 ? ' + ' : '') + fmtArs.format(gFix) : '') +
                '):</span><span>- ' +
                fmtArs.format(ahorroGlobal) +
                '</span></div>'
              : '') +
            '<div class="tot-final"><span>ABONO MENSUAL:</span><span>' + fmtArs.format(totalFinal) + ' / mes</span></div>' +
            (gType === 'temporary' && quoteRecord.temporaryMonths > 0
              ? '<div style="font-size:11px;color:#a7f3d0;margin-top:6px;text-align:right;">Valor promocional durante ' +
                quoteRecord.temporaryMonths +
                ' meses · Luego: ' +
                fmtArs.format(totalReg) +
                '/mes</div>'
              : '') +
          '</div>' +
        '</div>' +
        (quoteRecord.notas
          ? '<div class="notes-box"><strong>Observaciones y Condiciones Particulares:</strong>\n' + esc(quoteRecord.notas) + '</div>'
          : '') +
        '<div class="sign-row">' +
          '<div><div class="sign-line"><strong>MiniSistema</strong> · Dirección Comercial (@danielg)</div></div>' +
          '<div><div class="sign-line"><strong>Conformidad del Cliente</strong> · ' + esc(quoteRecord.fantasyName || '') + '</div></div>' +
        '</div>' +
      '</div></body></html>';

    win.document.open();
    win.document.write(htmlDoc);
    win.document.close();
  }

  // =========================================================================
  // VISTA 1: COMERCIOS HABILITADOS (CON GESTIÓN DE PERÍODOS DE PRUEBA)
  // =========================================================================
  function renderTenantsTab() {
    var d = STATE_SA.data;
    var tenants = (d && d.tenants) || [];

    if (STATE_SA.managingUsersSlug) {
      var targetT = tenants.find(function (x) {
        return x.slug === STATE_SA.managingUsersSlug;
      });
      var rowsHtml = STATE_SA.managingUsersList
        .map(function (u) {
          var isDaniel = String(u.username).toLowerCase() === 'danielg';
          return (
            '<tr style="border-bottom:1px solid #e2ecf0;">' +
            '<td style="padding:0.55rem;"><strong>' +
            esc(u.name) +
            '</strong><br><small>@' +
            esc(u.username) +
            '</small></td>' +
            '<td style="padding:0.55rem;"><span class="ms-sa-pill">' +
            esc(u.role) +
            '</span></td>' +
            '<td style="padding:0.55rem;"><code>' +
            esc(isDaniel ? '••••••••' : u.pass || '') +
            '</code></td>' +
            '<td style="padding:0.55rem;">' +
            (u.active !== false ? '🟢 Habilitado' : '⛔ Suspendido') +
            '</td>' +
            '<td style="padding:0.55rem;">' +
            (isDaniel
              ? '<small>Fijo (Admin. General)</small>'
              : '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.3rem 0.65rem;font-size:0.76rem;" data-del-tuser="' +
                esc(u.username) +
                '">Dar de baja</button>') +
            '</td>' +
            '</tr>'
          );
        })
        .join('');

      return (
        '<div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">' +
        '<h3 style="margin:0;">👥 Habilitar Administradores y Usuarios — ' +
        esc(targetT ? targetT.fantasy_name : STATE_SA.managingUsersSlug) +
        '</h3>' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-sa-back-tenants">← Volver a Comercios</button>' +
        '</div>' +
        '<div class="ms-sa-grid">' +
        '<div class="ms-sa-card">' +
        '<h4 style="margin-top:0;">Usuarios del Sistema (Esquema <code>' +
        esc(targetT ? targetT.db_schema : '') +
        '</code>)</h4>' +
        '<table class="ms-sa-table" data-excel-table-key="sa-tenant-users" style="width:100%;border-collapse:collapse;font-size:0.86rem;">' +
        '<thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:0.45rem;">Usuario</th><th style="padding:0.45rem;">Jerarquía</th><th style="padding:0.45rem;">Clave</th><th style="padding:0.45rem;">Estado</th><th style="padding:0.45rem;">Acción</th></tr></thead>' +
        '<tbody>' +
        rowsHtml +
        '</tbody>' +
        '</table>' +
        '</div>' +
        '<div class="ms-sa-card">' +
        '<h4 style="margin-top:0;">➕ Habilitar / Actualizar Administrador o Usuario</h4>' +
        '<form id="ms-sa-save-tuser-form" style="display:grid;gap:0.7rem;">' +
        '<div><label class="ms-sa-label">Usuario (@login)</label><input class="ms-sa-input" name="username" required placeholder="ej: admincomercio"></div>' +
        '<div><label class="ms-sa-label">Nombre y Apellido</label><input class="ms-sa-input" name="name" required placeholder="Ej: Juan Pérez"></div>' +
        '<div><label class="ms-sa-label">Rol en Jerarquía</label><select class="ms-sa-select" name="role"><option value="Administrador">👑 Administrador (habilita Usuarios)</option><option value="Usuario">👤 Usuario / Operador</option></select></div>' +
        '<div><label class="ms-sa-label">Contraseña</label><input class="ms-sa-input" name="password" required placeholder="Mínimo 4 caracteres"></div>' +
        '<div><label class="ms-sa-label">WhatsApp (opcional)</label><input class="ms-sa-input" name="whatsapp" placeholder="+54 9 358..."></div>' +
        '<button type="submit" class="ms-sa-btn">Guardar y Habilitar Usuario</button>' +
        '</form>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }

    var cards = tenants
      .map(function (t) {
        var sub = t.subscription || {};
        var dep = t.deployment || {};
        var trial = dep.trial || null;
        var isTrial = Boolean(trial && trial.isTrial);
        var remHours =
          isTrial && trial.endsAt
            ? Math.max(0, Math.ceil((Date.parse(trial.endsAt) - Date.now()) / 3600000))
            : 0;

        var mpBadge = t.is_base
          ? '<span class="ms-sa-pill">Sistema Base Propio</span>'
          : t.status === 'cancelled' || (trial && trial.status === 'cancelled_baja')
            ? '<span class="ms-sa-pill" style="background:#fee2e2;color:#991b1b;">🗑️ Dado de Baja</span>'
            : isTrial
              ? remHours > 0
                ? '<span class="ms-sa-pill" style="background:#fef3c7;color:#92400e;">🧪 Demo Activa (' + remHours + ' hs rest.)</span>'
                : '<span class="ms-sa-pill" style="background:#ffedd5;color:#9a3412;">⌛ Prueba Vencida (+10d gracia)</span>'
              : sub.mpStatus === 'authorized'
                ? '<span class="ms-sa-pill" style="background:#dcfce7;color:#065f46;">✅ Débito MP Activo</span>'
                : sub.mpStatus === 'sandbox_ready'
                  ? '<span class="ms-sa-pill" style="background:#fef3c7;color:#92400e;">🧪 Link Adhesión Prueba</span>'
                  : '<span class="ms-sa-pill" style="background:#e0f2fe;color:#075985;">⏳ Pendiente Adhesión MP</span>';

        var optBadge = t.is_base
          ? 'Base Oficial MiniSistema'
          : t.option_type === 1
            ? 'Opción 1 · Dominio + Marca Propia'
            : 'Opción 2 · minisistema.com.ar/' + t.slug;

        var waMsg = sub.mpInitPoint
          ? 'https://wa.me/?text=' +
            encodeURIComponent(
              '¡Hola! Ya habilitamos el sistema ERP de ' +
                t.fantasy_name +
                ' (' +
                dep.publicErpUrl +
                '). Te compartimos el enlace de adhesión al abono mensual por débito automático de Mercado Pago (' +
                fmtArs.format(sub.activeMonthlyAmount || 0) +
                '/mes): ' +
                sub.mpInitPoint
            )
          : '';

        var trialBannerHtml = '';
        if (trial && (trial.isTrial || trial.status === 'cancelled_baja')) {
          var waDemoUrl =
            'https://wa.me/' +
            String((t.branding && t.branding.whatsappDigits) || '').replace(/\D/g, '') +
            '?text=' +
            encodeURIComponent(
              '¡Hola! Ya habilitamos tu Período de Prueba de *' +
                t.fantasy_name +
                '* (' +
                (trial.trialHours || 72) +
                ' hs):\n🔗 Ingreso: ' +
                (dep.publicErpUrl || '') +
                '\n👤 Usuario: ' +
                (trial.demoUsername || 'demo') +
                '\n🔑 Contraseña: ' +
                (trial.demoPassword || '') +
                '\n⏱️ Vigente hasta: ' +
                formatDateTimeAr(trial.endsAt)
            );
          trialBannerHtml =
            '<div style="margin-top:0.65rem;padding:0.65rem 0.75rem;border-radius:10px;background:' +
            (trial.status === 'cancelled_baja'
              ? '#fef2f2;border:1px solid #fca5a5;color:#7f1d1d;'
              : '#fffbeb;border:1px solid #fcd34d;color:#78350f;') +
            'font-size:0.78rem;display:grid;gap:0.25rem;">' +
              '<div><strong>🧪 Período de Prueba' +
                (trial.quoteNumber ? ' (' + esc(trial.quoteNumber) + ')' : '') +
                ':</strong> ' +
                esc(trial.trialHours || 72) +
                ' hs totales · Usuario Demo: <code>@' +
                esc(trial.demoUsername || 'demo') +
                '</code> / <code>' +
                esc(trial.demoPassword || '—') +
                '</code></div>' +
              '<div><strong>Vence prueba:</strong> ' +
                esc(formatDateTimeAr(trial.endsAt)) +
                ' · <strong>Baja auto (+10d):</strong> ' +
                esc(formatDateAr(trial.autoCancelAt)) +
              '</div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:0.3rem;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.6rem;font-size:0.74rem;" data-extend-trial="' + esc(t.slug) + '">⏱️ Extender (+Horas)</button>' +
                '<button type="button" class="ms-sa-btn" style="padding:0.28rem 0.6rem;font-size:0.74rem;" data-confirm-trial-plan="' + esc(t.slug) + '">✅ Confirmar Plan</button>' +
                '<a class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.6rem;font-size:0.74rem;" href="' + esc(waDemoUrl) + '" target="_blank">📲 Enviar Demo WA</a>' +
                (trial.status !== 'cancelled_baja'
                  ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.6rem;font-size:0.74rem;border-color:#ef4444;color:#991b1b;" data-cancel-trial="' + esc(t.slug) + '">🗑️ Dar de Baja</button>'
                  : '') +
              '</div>' +
            '</div>';
        }

        return (
          '<div class="ms-sa-card" style="display:flex;flex-direction:column;justify-content:space-between;gap:0.85rem;">' +
          '<div>' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">' +
          '<div>' +
          '<div style="font-size:1.05rem;font-weight:800;">' +
          esc(t.fantasy_name) +
          '</div>' +
          '<div style="font-size:0.78rem;opacity:0.75;">' +
          esc(optBadge) +
          '</div>' +
          '</div>' +
          mpBadge +
          '</div>' +
          trialBannerHtml +
          '<div style="margin-top:0.7rem;padding:0.65rem;background:rgba(86,215,161,0.08);border:1px solid rgba(86,215,161,0.25);border-radius:10px;font-size:0.8rem;display:grid;gap:0.28rem;">' +
          '<div><strong>BD Supabase independiente:</strong> <code>' +
          esc(t.db_schema) +
          '</code></div>' +
          '<div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;"><strong>Actividad Operativa:</strong> ' +
          '<select class="ms-sa-select" data-tenant-actividad="' + esc(t.slug) + '" style="width:auto;padding:0.2rem 0.5rem;font-size:0.76rem;min-height:28px;">' +
          '<option value="comercial"' + (((dep.actividadNegocio || 'comercial') === 'comercial') ? ' selected' : '') + '>Comercial (Retail / Cajas)</option>' +
          '<option value="servicios"' + ((dep.actividadNegocio === 'servicios') ? ' selected' : '') + '>Servicios (Facturación Directa sin Caja)</option>' +
          '<option value="mixta"' + ((dep.actividadNegocio === 'mixta') ? ' selected' : '') + '>Mixta (Comercial + Servicios)</option>' +
          '</select></div>' +
          '<div><strong>URL Sistema:</strong> <a href="' +
          esc(dep.publicErpUrl || '/sistema') +
          '" target="_blank" style="color:#56D7A1;font-weight:800;">' +
          esc(dep.publicErpUrl || '/sistema') +
          '</a></div>' +
          (t.is_base
            ? ''
            : '<div><strong>Abono Mensual:</strong> ' +
              fmtArs.format(sub.activeMonthlyAmount || 0) +
              '/mes' +
              (sub.globalDiscountType === 'temporary' && sub.temporaryMonths > 0
                ? ' <small>(Promo ' +
                  sub.temporaryMonths +
                  'm · luego ' +
                  fmtArs.format(sub.monthlyRegularAmount || 0) +
                  ')</small>'
                : '') +
              '</div>') +
          '</div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.45rem;">' +
          '<a class="ms-sa-btn" style="padding:0.42rem 0.75rem;font-size:0.78rem;" href="' +
          esc(dep.publicErpUrl || '/sistema') +
          '" target="_blank">Abrir ERP</a>' +
          '<button type="button" class="ms-sa-btn ms-sa-btn--dark" style="padding:0.42rem 0.75rem;font-size:0.78rem;" data-manage-users="' +
          esc(t.slug) +
          '">👥 Admin / Usuarios</button>' +
          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.42rem 0.75rem;font-size:0.78rem;" data-open-afip-tenant="' +
          esc(t.slug) +
          '">🏛️ Credenciales AFIP</button>' +
          (t.is_base
            ? ''
            : '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.42rem 0.75rem;font-size:0.78rem;" data-gen-mp="' +
              esc(t.slug) +
              '">💳 Link Débito MP</button>' +
              (sub.mpInitPoint
                ? '<a class="ms-sa-btn ms-sa-btn--outline" style="padding:0.42rem 0.75rem;font-size:0.78rem;" href="' +
                  esc(sub.mpInitPoint) +
                  '" target="_blank">Ver Adhesión</a>'
                : '') +
              (waMsg
                ? '<a class="ms-sa-btn ms-sa-btn--outline" style="padding:0.42rem 0.75rem;font-size:0.78rem;" href="' +
                  esc(waMsg) +
                  '" target="_blank">📲 Enviar WA</a>'
                : '') +
              (t.option_type === 1
                ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.42rem 0.75rem;font-size:0.78rem;" data-reprov-opt1="' +
                  esc(t.slug) +
                  '">🔗 Vercel+GitHub</button>'
                : '') +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.42rem 0.75rem;font-size:0.78rem;" data-toggle-status="' +
              esc(t.slug) +
              '" data-curr-status="' +
              esc(t.status) +
              '">' +
              (t.status === 'active' ? '⏸ Suspender' : '▶ Reactivar') +
              '</button>') +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    return (
      '<div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.6rem;">' +
      '<h3 style="margin:0;">Sistemas y Comercios Habilitados (' +
      tenants.length +
      ')</h3>' +
      '<button type="button" class="ms-sa-btn" id="ms-sa-go-new">+ Habilitar Nuevo Sistema</button>' +
      '</div>' +
      '<div class="ms-sa-grid">' +
      cards +
      '</div>' +
      '</div>'
    );
  }

  // =========================================================================
  // VISTA 2 (UNIFICADA): HABILITAR NUEVO SISTEMA
  // (Árbol Módulos/Submódulos + Lista Oficial Valores + Presupuesto PDF + Seguimiento + Demo en Horas)
  // =========================================================================
  function getQuoteBadgeHtml(estado) {
    var st = String(estado || 'BORRADOR').toUpperCase();
    var map = {
      BORRADOR: { bg: '#e2e8f0', fg: '#334155', lbl: '📝 Borrador' },
      ENVIADO: { bg: '#e0f2fe', fg: '#075985', lbl: '📤 Enviado (PDF)' },
      ACEPTADO: { bg: '#dcfce7', fg: '#166534', lbl: '👍 Aceptado' },
      EN_PRUEBA: { bg: '#fef3c7', fg: '#92400e', lbl: '🧪 En Prueba Demo' },
      CONFIRMADO: { bg: '#bbf7d0', fg: '#065f46', lbl: '✅ Plan Confirmado' },
      RECHAZADO: { bg: '#fee2e2', fg: '#991b1b', lbl: '✕ Rechazado' },
      BAJA_DEMO: { bg: '#f1f5f9', fg: '#64748b', lbl: '🗑️ Baja Demo' }
    };
    var m = map[st] || map.BORRADOR;
    return (
      '<span style="display:inline-block;padding:0.2rem 0.58rem;border-radius:999px;font-size:0.73rem;font-weight:800;background:' +
      m.bg +
      ';color:' +
      m.fg +
      ';">' +
      m.lbl +
      '</span>'
    );
  }

  function renderQuotesTrackingSubTab() {
    var d = STATE_SA.data || {};
    var quotes = Array.isArray(d.quotes) ? d.quotes : [];
    var tenants = Array.isArray(d.tenants) ? d.tenants : [];
    var qSearch = String(STATE_SA.quotesSearch || '').trim().toLowerCase();
    var qFilter = STATE_SA.quotesStatusFilter || 'ALL';

    var countEnv = 0;
    var countDemo = 0;
    var countConf = 0;
    quotes.forEach(function (q) {
      if (q.estado === 'ENVIADO' || q.estado === 'ACEPTADO' || q.estado === 'BORRADOR') countEnv++;
      if (q.estado === 'EN_PRUEBA') countDemo++;
      if (q.estado === 'CONFIRMADO') countConf++;
    });

    var filtered = quotes.filter(function (q) {
      if (qFilter !== 'ALL' && q.estado !== qFilter) return false;
      if (qSearch) {
        var hay =
          (q.numero || '') +
          ' ' +
          (q.fantasyName || '') +
          ' ' +
          (q.businessName || '') +
          ' ' +
          (q.contactName || '') +
          ' ' +
          (q.slug || '') +
          ' ' +
          (q.payerEmail || '');
        if (hay.toLowerCase().indexOf(qSearch) === -1) return false;
      }
      return true;
    });

    var rowsHtml = filtered
      .map(function (q) {
        var linkedT = q.linkedTenantSlug
          ? tenants.find(function (t) {
              return t.slug === q.linkedTenantSlug;
            })
          : null;
        var trial = linkedT && linkedT.deployment ? linkedT.deployment.trial : null;
        var trialNote = '';
        if (linkedT && trial && trial.isTrial) {
          var remHs = Math.max(0, Math.ceil((Date.parse(trial.endsAt || '') - Date.now()) / 3600000));
          trialNote =
            '<div style="font-size:0.72rem;color:#92400e;margin-top:0.2rem;">' +
            '🧪 <code>/' + esc(linkedT.slug) + '</code> · ' +
            (remHs > 0 ? 'Restan <strong>' + remHs + ' hs</strong>' : '<strong>Vencida</strong>') +
            ' (vence ' + esc(formatDateTimeAr(trial.endsAt)) + ')' +
            '</div>';
        } else if (linkedT) {
          trialNote =
            '<div style="font-size:0.72rem;color:#0f766e;margin-top:0.2rem;">🔗 Sistema: <code>' +
            esc(linkedT.slug) +
            '</code></div>';
        }

        return (
          '<tr style="border-bottom:1px solid #e2ecf0;">' +
            '<td style="padding:0.55rem;">' +
              '<strong style="color:#112D3A;">' + esc(q.numero) + '</strong>' +
              '<div style="font-size:0.72rem;opacity:0.75;">' + esc(formatDateTimeAr(q.updatedAt || q.createdAt)) + '</div>' +
            '</td>' +
            '<td style="padding:0.55rem;">' +
              '<div style="font-weight:800;">' + esc(q.fantasyName) + '</div>' +
              '<div style="font-size:0.73rem;opacity:0.8;">' +
                esc(q.contactName || q.businessName || '') +
                (q.whatsappDigits ? ' · 📱 ' + esc(q.whatsappDigits) : '') +
              '</div>' +
              trialNote +
            '</td>' +
            '<td style="padding:0.55rem;font-size:0.8rem;">' +
              '<div><strong>' + (Number(q.optionType) === 1 ? 'Opción 1 (Marca Propia)' : 'Opción 2 (Subruta)') + '</strong></div>' +
              '<div style="font-size:0.73rem;opacity:0.8;">' +
                esc((q.selectedModuleKeys || []).length) + ' mód. · ' +
                esc((q.selectedSubmoduleKeys || []).length) + ' submód. · Demo ' + esc(q.trialHours || 72) + ' hs' +
              '</div>' +
            '</td>' +
            '<td style="padding:0.55rem;text-align:right;font-weight:900;color:#112D3A;">' +
              fmtArs.format(q.totalPromoMensual || 0) + '<small style="font-weight:500;">/mes</small>' +
            '</td>' +
            '<td style="padding:0.55rem;">' +
              getQuoteBadgeHtml(q.estado) +
              '<div style="margin-top:0.25rem;">' +
                '<select class="ms-sa-select" data-quote-status-sel="' + esc(q.id) + '" style="padding:0.18rem 0.4rem;font-size:0.72rem;width:auto;">' +
                  ['BORRADOR', 'ENVIADO', 'ACEPTADO', 'EN_PRUEBA', 'CONFIRMADO', 'RECHAZADO', 'BAJA_DEMO']
                    .map(function (st) {
                      return '<option value="' + st + '"' + (q.estado === st ? ' selected' : '') + '>' + st + '</option>';
                    })
                    .join('') +
                '</select>' +
              '</div>' +
            '</td>' +
            '<td style="padding:0.55rem;">' +
              '<div style="display:flex;flex-wrap:wrap;gap:0.32rem;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.55rem;font-size:0.73rem;" data-q-edit="' + esc(q.id) + '">✏️ Editar</button>' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--dark" style="padding:0.28rem 0.55rem;font-size:0.73rem;" data-q-pdf="' + esc(q.id) + '">📄 PDF</button>' +
                (!linkedT
                  ? '<button type="button" class="ms-sa-btn" style="padding:0.28rem 0.55rem;font-size:0.73rem;" data-q-start-demo="' + esc(q.id) + '">🧪 Activar Demo (' + esc(q.trialHours || 72) + 'h)</button>'
                  : trial && trial.isTrial
                    ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.55rem;font-size:0.73rem;" data-extend-trial="' + esc(linkedT.slug) + '">⏱️ +Horas</button>' +
                      '<button type="button" class="ms-sa-btn" style="padding:0.28rem 0.55rem;font-size:0.73rem;" data-confirm-trial-plan="' + esc(linkedT.slug) + '">✅ Confirmar Plan</button>'
                    : '') +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.28rem 0.5rem;font-size:0.73rem;border-color:#ef4444;color:#991b1b;" data-q-del="' + esc(q.id) + '">🗑️</button>' +
              '</div>' +
            '</td>' +
          '</tr>'
        );
      })
      .join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:0.75rem;">' +
          '<div class="ms-sa-card" style="padding:0.85rem 1rem;border-left:4px solid #112D3A;">' +
            '<div style="font-size:0.72rem;font-weight:800;opacity:0.75;text-transform:uppercase;">Total Presupuestos</div>' +
            '<div style="font-size:1.55rem;font-weight:900;color:#112D3A;">' + quotes.length + '</div>' +
          '</div>' +
          '<div class="ms-sa-card" style="padding:0.85rem 1rem;border-left:4px solid #0284c7;">' +
            '<div style="font-size:0.72rem;font-weight:800;opacity:0.75;text-transform:uppercase;">En Gestión / Enviados</div>' +
            '<div style="font-size:1.55rem;font-weight:900;color:#0369a1;">' + countEnv + '</div>' +
          '</div>' +
          '<div class="ms-sa-card" style="padding:0.85rem 1rem;border-left:4px solid #d97706;">' +
            '<div style="font-size:0.72rem;font-weight:800;opacity:0.75;text-transform:uppercase;">En Prueba Demo</div>' +
            '<div style="font-size:1.55rem;font-weight:900;color:#b45309;">' + countDemo + '</div>' +
          '</div>' +
          '<div class="ms-sa-card" style="padding:0.85rem 1rem;border-left:4px solid #16a34a;">' +
            '<div style="font-size:0.72rem;font-weight:800;opacity:0.75;text-transform:uppercase;">Planes Confirmados</div>' +
            '<div style="font-size:1.55rem;font-weight:900;color:#15803d;">' + countConf + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:end;flex-wrap:wrap;gap:0.75rem;margin-bottom:0.85rem;">' +
            '<div style="display:flex;gap:0.65rem;flex-wrap:wrap;flex:1;">' +
              '<div style="min-width:240px;flex:1;"><label class="ms-sa-label">🔎 Buscar Presupuesto / Cliente</label><input class="ms-sa-input" id="ms-q-track-search" value="' + esc(STATE_SA.quotesSearch) + '" placeholder="PRES-0001, nombre comercial, contacto..."></div>' +
              '<div style="min-width:190px;"><label class="ms-sa-label">Estado</label><select class="ms-sa-select" id="ms-q-track-filter">' +
                '<option value="ALL"' + (qFilter === 'ALL' ? ' selected' : '') + '>Todos los estados</option>' +
                '<option value="BORRADOR"' + (qFilter === 'BORRADOR' ? ' selected' : '') + '>📝 Borrador</option>' +
                '<option value="ENVIADO"' + (qFilter === 'ENVIADO' ? ' selected' : '') + '>📤 Enviado</option>' +
                '<option value="ACEPTADO"' + (qFilter === 'ACEPTADO' ? ' selected' : '') + '>👍 Aceptado</option>' +
                '<option value="EN_PRUEBA"' + (qFilter === 'EN_PRUEBA' ? ' selected' : '') + '>🧪 En Prueba Demo</option>' +
                '<option value="CONFIRMADO"' + (qFilter === 'CONFIRMADO' ? ' selected' : '') + '>✅ Confirmado</option>' +
                '<option value="RECHAZADO"' + (qFilter === 'RECHAZADO' ? ' selected' : '') + '>✕ Rechazado</option>' +
                '<option value="BAJA_DEMO"' + (qFilter === 'BAJA_DEMO' ? ' selected' : '') + '>🗑️ Baja Demo</option>' +
              '</select></div>' +
            '</div>' +
            '<button type="button" class="ms-sa-btn" id="ms-q-new-blank-btn">+ Nuevo Presupuesto / Sistema</button>' +
          '</div>' +
          '<div style="overflow-x:auto;">' +
            '<table class="ms-sa-table" style="width:100%;border-collapse:collapse;font-size:0.84rem;">' +
              '<thead><tr style="text-align:left;border-bottom:2px solid #112D3A;">' +
                '<th style="padding:0.5rem;">N° / Fecha</th>' +
                '<th style="padding:0.5rem;">Cliente / Comercio</th>' +
                '<th style="padding:0.5rem;">Opción y Alcance</th>' +
                '<th style="padding:0.5rem;text-align:right;">Mensual</th>' +
                '<th style="padding:0.5rem;">Estado Seguimiento</th>' +
                '<th style="padding:0.5rem;">Acciones</th>' +
              '</tr></thead>' +
              '<tbody>' +
                (rowsHtml || '<tr><td colspan="6" style="padding:1.4rem;text-align:center;opacity:0.7;">Todavía no hay presupuestos registrados. Armá uno desde la pestaña Configurador y generá su PDF.</td></tr>') +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderUnifiedNewSystemTab() {
    var d = STATE_SA.data || {};
    var cfg = d.pricingConfig || {};
    var mods = d.commercialModules || [];
    var quotesCount = Array.isArray(d.quotes) ? d.quotes.length : 0;

    var subTabsHeader =
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:1rem;">' +
        '<div style="display:inline-flex;gap:0.45rem;background:rgba(17,45,58,0.07);padding:0.32rem;border-radius:12px;flex-wrap:wrap;">' +
          '<button type="button" data-sa-new-subtab="config" class="ms-sa-btn ' +
            (STATE_SA.newSubTab === 'config' ? '' : 'ms-sa-btn--outline') +
            '" style="padding:0.45rem 0.95rem;font-size:0.82rem;border-radius:9px;">' +
            '🛠️ 1. Configurar Módulos, Presupuesto PDF y Alta' +
          '</button>' +
          '<button type="button" data-sa-new-subtab="quotes" class="ms-sa-btn ' +
            (STATE_SA.newSubTab === 'quotes' ? '' : 'ms-sa-btn--outline') +
            '" style="padding:0.45rem 0.95rem;font-size:0.82rem;border-radius:9px;">' +
            '📋 2. Alta y Seguimiento de Presupuestos (' + quotesCount + ')' +
          '</button>' +
        '</div>' +
        (STATE_SA.editingQuoteId
          ? '<div style="display:inline-flex;align-items:center;gap:0.55rem;background:#fef3c7;border:1px solid #f59e0b;color:#78350f;padding:0.38rem 0.8rem;border-radius:10px;font-size:0.8rem;font-weight:800;">' +
              '<span>✏️ Editando ' + esc(STATE_SA.editingQuoteNumero || 'Presupuesto') + ' (' + esc(STATE_SA.editingQuoteEstado) + ')</span>' +
              '<button type="button" id="ms-q-reset-blank" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.2rem 0.55rem;font-size:0.73rem;">+ Nuevo Limpio</button>' +
            '</div>'
          : '') +
      '</div>';

    var demoBannerHtml = '';
    if (STATE_SA.lastCreatedDemoBanner) {
      var dbn = STATE_SA.lastCreatedDemoBanner;
      var waCreatedHref =
        'https://wa.me/' +
        String(dbn.whatsappDigits || '').replace(/\D/g, '') +
        '?text=' +
        encodeURIComponent(
          '¡Hola! Te habilitamos el Período de Prueba sin cargo de *' +
            dbn.fantasyName +
            '* por *' +
            dbn.trialHours +
            ' horas*:\n🔗 Acceso al Sistema: ' +
            dbn.url +
            '\n👤 Usuario: ' +
            dbn.demoUsername +
            '\n🔑 Contraseña: ' +
            dbn.demoPassword +
            '\n⏱️ Vigencia de la prueba: hasta el ' +
            formatDateTimeAr(dbn.endsAt)
        );
      demoBannerHtml =
        '<div class="ms-sa-card" style="margin-bottom:1rem;border:2px solid #56D7A1;background:#ecfdf5;">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;flex-wrap:wrap;">' +
            '<div>' +
              '<div style="font-weight:900;color:#065f46;font-size:0.98rem;">🎉 ¡Período de Prueba Habilitado con Base de Datos Limpia! (' + esc(dbn.fantasyName) + ')</div>' +
              '<div style="font-size:0.83rem;color:#064e3b;margin-top:0.3rem;">' +
                'URL: <a href="' + esc(dbn.url) + '" target="_blank" style="font-weight:800;color:#0f766e;">' + esc(dbn.url) + ' ↗</a> · ' +
                'Usuario Demo: <code>' + esc(dbn.demoUsername) + '</code> · ' +
                'Clave: <code>' + esc(dbn.demoPassword) + '</code> · ' +
                'Duración: <strong>' + esc(dbn.trialHours) + ' horas</strong> (vence ' + esc(formatDateTimeAr(dbn.endsAt)) + ' · baja auto +10d: ' + esc(formatDateAr(dbn.autoCancelAt)) + ')' +
              '</div>' +
            '</div>' +
            '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;">' +
              '<a class="ms-sa-btn" style="padding:0.38rem 0.75rem;font-size:0.78rem;" href="' + esc(waCreatedHref) + '" target="_blank">📲 Enviar Accesos por WhatsApp</a>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-close-demo-banner" style="padding:0.38rem 0.65rem;font-size:0.78rem;">✕</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    if (STATE_SA.newSubTab === 'quotes') {
      return subTabsHeader + demoBannerHtml + renderQuotesTrackingSubTab();
    }

    var quote = computeTreeQuote();
    var opt1Price = Math.max(0, Math.round(Number(cfg.option_1_base ?? 35000)));
    var opt2Price = Math.max(0, Math.round(Number(cfg.option_2_base ?? 15000)));
    var opt1Disc = Number(STATE_SA.quoteDiscountsByMod['__opt1'] || 0);
    var opt2Disc = Number(STATE_SA.quoteDiscountsByMod['__opt2'] || 0);
    var opt1Net = Math.round(opt1Price * (1 - opt1Disc / 100));
    var opt2Net = Math.round(opt2Price * (1 - opt2Disc / 100));
    var isOpt1 = STATE_SA.newOptionType === 1;

    var totalAllSubmodulesCount = 0;
    mods.forEach(function (m) {
      totalAllSubmodulesCount += getModuleSubmodules(m).length;
    });

    var optionRowsHtml =
      '<tr style="border-bottom:1px solid rgba(86,215,161,0.28);background:rgba(86,215,161,0.08);">' +
        '<td style="padding:0.5rem;"><input type="radio" name="ms_opt_radio" data-q-opt-chk="1" ' + (isOpt1 ? 'checked' : '') + '></td>' +
        '<td style="padding:0.5rem;"><strong>🌐 Opción 1 · Dominio y Marca Propia</strong> <small style="opacity:0.75;">(Web + ERP con dominio e identidad del cliente)</small></td>' +
        '<td style="padding:0.5rem;width:145px;"><input type="number" min="0" step="500" class="ms-sa-input" id="ms-cfg-opt1" value="' + esc(opt1Price) + '"></td>' +
        '<td style="padding:0.5rem;width:105px;"><input type="number" min="0" max="100" class="ms-sa-input" data-q-opt-disc="1" value="' + esc(opt1Disc) + '"></td>' +
        '<td data-net-opt-cell="1" style="padding:0.5rem;font-weight:800;text-align:right;">' + (isOpt1 ? fmtArs.format(opt1Net) : '—') + '</td>' +
      '</tr>' +
      '<tr style="border-bottom:2px solid rgba(86,215,161,0.42);background:rgba(86,215,161,0.08);">' +
        '<td style="padding:0.5rem;"><input type="radio" name="ms_opt_radio" data-q-opt-chk="2" ' + (!isOpt1 ? 'checked' : '') + '></td>' +
        '<td style="padding:0.5rem;"><strong>⚡ Opción 2 · Subruta MiniSistema</strong> <small style="opacity:0.75;">(minisistema.com.ar/comercio con marca MiniSistema)</small></td>' +
        '<td style="padding:0.5rem;width:145px;"><input type="number" min="0" step="500" class="ms-sa-input" id="ms-cfg-opt2" value="' + esc(opt2Price) + '"></td>' +
        '<td style="padding:0.5rem;width:105px;"><input type="number" min="0" max="100" class="ms-sa-input" data-q-opt-disc="2" value="' + esc(opt2Disc) + '"></td>' +
        '<td data-net-opt-cell="2" style="padding:0.5rem;font-weight:800;text-align:right;">' + (!isOpt1 ? fmtArs.format(opt2Net) : '—') + '</td>' +
      '</tr>';

    var treeRowsHtml = mods
      .map(function (m, mIdx) {
        var subs = getModuleSubmodules(m);
        var bInfo = quote.moduleBreakdown[mIdx];
        var selCnt = bInfo.selectedSubsCount;
        var totCnt = bInfo.totalSubsCount;
        var allChecked = totCnt > 0 && selCnt === totCnt;
        var someChecked = selCnt > 0;
        var isExpanded = Boolean(STATE_SA.expandedModules[m.key]);
        var modDisplayPrice = someChecked ? bInfo.selectedBaseSum : bInfo.catalogSum;
        var modDisc = bInfo.discountPct;

        var parentRow =
          '<tr data-mod-parent-row="' + esc(m.key) + '" style="border-bottom:1px solid rgba(17,45,58,0.12);background:' +
            (someChecked ? 'rgba(86,215,161,0.05)' : 'transparent') +
          ';">' +
            '<td style="padding:0.5rem;white-space:nowrap;">' +
              '<input type="checkbox" data-tree-mod-chk="' + esc(m.key) + '" ' + (allChecked ? 'checked' : '') + '>' +
            '</td>' +
            '<td style="padding:0.5rem;">' +
              '<div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">' +
                '<button type="button" data-tree-toggle="' + esc(m.key) + '" style="border:1px solid rgba(17,45,58,0.2);background:#fff;color:#112D3A;border-radius:6px;padding:0.15rem 0.45rem;font-size:0.74rem;font-weight:900;cursor:pointer;" title="Desplegar / ocultar submódulos">' +
                  '<span data-tree-arrow="' + esc(m.key) + '">' + (isExpanded ? '▼' : '▶') + '</span> ' +
                  '<span data-tree-count="' + esc(m.key) + '">' + selCnt + '/' + totCnt + '</span>' +
                '</button>' +
                '<strong style="cursor:pointer;" data-tree-toggle="' + esc(m.key) + '">' + esc(m.name) + '</strong>' +
                (someChecked && selCnt < totCnt
                  ? '<span data-tree-partial-note="' + esc(m.key) + '" style="font-size:0.71rem;color:#0f766e;font-weight:700;">(Parcial: suma ' + selCnt + ' submód.)</span>'
                  : '<span data-tree-partial-note="' + esc(m.key) + '" style="font-size:0.71rem;color:#64748b;">(Σ ' + totCnt + ' submód.)</span>') +
              '</div>' +
            '</td>' +
            '<td style="padding:0.5rem;width:145px;">' +
              '<input type="number" min="0" step="500" class="ms-sa-input" data-cfg-mod-price="' + esc(m.key) + '" value="' + esc(modDisplayPrice) + '" title="Suma automática de sus submódulos (si editás este total se reparte entre sus submódulos)">' +
            '</td>' +
            '<td style="padding:0.5rem;width:105px;">' +
              '<input type="number" min="0" max="100" class="ms-sa-input" data-q-mod-disc="' + esc(m.key) + '" value="' + esc(modDisc) + '">' +
            '</td>' +
            '<td data-net-mod-cell="' + esc(m.key) + '" style="padding:0.5rem;font-weight:800;text-align:right;">' +
              (someChecked ? (bInfo.netSelected > 0 ? fmtArs.format(bInfo.netSelected) : 'Sin cargo') : '—') +
            '</td>' +
          '</tr>';

        var childrenRows = subs
          .map(function (s, sIdx) {
            var sChecked = Boolean(STATE_SA.selectedSubmodules[s.key]);
            var sPrice = Math.max(
              0,
              Math.round(
                STATE_SA.submodulePrices[s.key] !== undefined
                  ? Number(STATE_SA.submodulePrices[s.key])
                  : Number(s.defaultMonthlyArs || 0)
              )
            );
            var sNet = Math.round(sPrice * (1 - modDisc / 100));
            var branchChar = sIdx === subs.length - 1 ? '└─' : '├─';
            return (
              '<tr data-sub-row-of="' + esc(m.key) + '" style="' +
                (isExpanded ? '' : 'display:none;') +
                'background:#f8fafc;border-bottom:1px dashed rgba(148,163,184,0.35);font-size:0.81rem;">' +
                '<td style="padding:0.36rem 0.5rem 0.36rem 1.35rem;">' +
                  '<input type="checkbox" data-tree-sub-chk="' + esc(s.key) + '" data-parent-mod="' + esc(m.key) + '" ' + (sChecked ? 'checked' : '') + '>' +
                '</td>' +
                '<td style="padding:0.36rem 0.5rem 0.36rem 1.6rem;color:#334155;">' +
                  '<span style="color:#94a3b8;font-family:monospace;margin-right:0.35rem;">' + branchChar + '</span>' +
                  '<label style="cursor:pointer;" data-sub-lbl="' + esc(s.key) + '">' + esc(s.name) + '</label>' +
                '</td>' +
                '<td style="padding:0.32rem 0.5rem;width:145px;">' +
                  '<input type="number" min="0" step="250" class="ms-sa-input" style="padding:0.28rem 0.45rem;font-size:0.79rem;" data-cfg-sub-price="' + esc(s.key) + '" data-parent-mod="' + esc(m.key) + '" value="' + esc(sPrice) + '">' +
                '</td>' +
                '<td style="padding:0.36rem 0.5rem;text-align:center;color:#94a3b8;font-size:0.74rem;">' +
                  (modDisc > 0 ? '-' + modDisc + '%' : '—') +
                '</td>' +
                '<td data-net-sub-cell="' + esc(s.key) + '" style="padding:0.36rem 0.5rem;text-align:right;font-weight:700;color:#0f766e;">' +
                  (sChecked ? (sNet > 0 ? fmtArs.format(sNet) : 'Sin cargo') : '—') +
                '</td>' +
              '</tr>'
            );
          })
          .join('');

        return parentRow + childrenRows;
      })
      .join('');

    var df = STATE_SA.draftForm;
    var trialHsNow = Math.max(1, Number(df.trialHours || 72));
    var previewEndsIso = new Date(Date.now() + trialHsNow * 3600000).toISOString();
    var previewAutoBajaIso = new Date(Date.now() + (trialHsNow + 240) * 3600000).toISOString();

    return (
      subTabsHeader +
      demoBannerHtml +
      '<form id="ms-sa-unified-form" style="display:grid;gap:1.1rem;">' +
        /* PASO 1: MODALIDAD + PERFIL + ÁRBOL DE MÓDULOS Y SUBMÓDULOS */
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.8rem;">' +
            '<div>' +
              '<h4 style="margin:0;">1. Modalidad, Árbol de Módulos y Submódulos y Valores Mensuales</h4>' +
              '<div style="font-size:0.78rem;opacity:0.78;margin-top:0.15rem;">Cada módulo suma automáticamente el valor de sus submódulos tildados. Desplegá cualquier módulo (▶) para elegir submódulos puntuales.</div>' +
            '</div>' +
            '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;">' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-tree-expand-all" style="padding:0.38rem 0.7rem;font-size:0.76rem;">➕ Expandir Submódulos</button>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-tree-collapse-all" style="padding:0.38rem 0.7rem;font-size:0.76rem;">➖ Contraer Todos</button>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--dark" id="ms-save-pricing-btn" style="padding:0.38rem 0.8rem;font-size:0.78rem;">💾 Guardar Lista Oficial de Valores</button>' +
            '</div>' +
          '</div>' +

          /* Selector rápido Opción 1 / Opción 2 + Perfil Actividad */
          '<div style="display:flex;flex-wrap:wrap;gap:0.55rem;align-items:center;margin-bottom:0.85rem;padding:0.65rem 0.8rem;border-radius:10px;background:rgba(17,45,58,0.04);border:1px solid rgba(17,45,58,0.12);">' +
            '<strong style="font-size:0.8rem;">Modalidad:</strong>' +
            '<button type="button" class="ms-sa-btn ' + (isOpt1 ? '' : 'ms-sa-btn--outline') + '" data-pick-opt="1" style="padding:0.34rem 0.78rem;font-size:0.78rem;">🌐 Opción 1 · Dominio y Marca Propia</button>' +
            '<button type="button" class="ms-sa-btn ' + (!isOpt1 ? '' : 'ms-sa-btn--outline') + '" data-pick-opt="2" style="padding:0.34rem 0.78rem;font-size:0.78rem;">⚡ Opción 2 · Subruta MiniSistema</button>' +
            '<span style="margin-left:0.5rem;font-weight:800;font-size:0.8rem;">| Preselección por Actividad:</span>' +
            '<button type="button" class="ms-sa-btn ' + (STATE_SA.newActividadNegocio === 'comercial' ? '' : 'ms-sa-btn--outline') + '" data-pick-actividad="comercial" style="padding:0.34rem 0.7rem;font-size:0.76rem;">🏪 Comercial</button>' +
            '<button type="button" class="ms-sa-btn ' + (STATE_SA.newActividadNegocio === 'servicios' ? '' : 'ms-sa-btn--outline') + '" data-pick-actividad="servicios" style="padding:0.34rem 0.7rem;font-size:0.76rem;">🔧 Servicios</button>' +
            '<button type="button" class="ms-sa-btn ' + (STATE_SA.newActividadNegocio === 'mixta' ? '' : 'ms-sa-btn--outline') + '" data-pick-actividad="mixta" style="padding:0.34rem 0.7rem;font-size:0.76rem;">🔀 Mixta</button>' +
          '</div>' +

          '<div style="overflow-x:auto;">' +
            '<table class="ms-sa-table" style="width:100%;border-collapse:collapse;font-size:0.84rem;">' +
              '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;">' +
                '<th style="padding:0.5rem;white-space:nowrap;width:95px;">' +
                  '<label style="display:inline-flex;align-items:center;gap:0.4rem;cursor:pointer;user-select:none;font-weight:800;color:#112D3A;">' +
                    '<input type="checkbox" id="ms-q-select-all-mods" ' +
                      (totalAllSubmodulesCount > 0 && quote.selectedSubCount === totalAllSubmodulesCount ? 'checked' : '') +
                    '>' +
                    '<span>Todos</span>' +
                  '</label>' +
                '</th>' +
                '<th style="padding:0.5rem;">Opción Base / Árbol de Módulos y Submódulos</th>' +
                '<th style="padding:0.5rem;">Valor Mensual ($)</th>' +
                '<th style="padding:0.5rem;">Dto. (%)</th>' +
                '<th style="padding:0.5rem;text-align:right;">Neto Mensual</th>' +
              '</tr></thead>' +
              '<tbody>' +
                optionRowsHtml +
                treeRowsHtml +
              '</tbody>' +
              '<tfoot>' +
                '<tr style="border-top:2px solid #56D7A1;background:rgba(86,215,161,0.13);">' +
                  '<td colspan="4" style="padding:0.72rem 0.6rem;font-weight:800;font-size:0.93rem;color:#112D3A;">' +
                    'Subtotal (<span id="ms-sa-selected-opt-label">Opción ' + esc(STATE_SA.newOptionType) + '</span> + ' +
                    '<span id="ms-sa-selected-mods-count">' + esc(quote.selectedModCount) + '</span> módulos / ' +
                    '<span id="ms-sa-selected-subs-count">' + esc(quote.selectedSubCount) + '</span> submódulos)' +
                  '</td>' +
                  '<td id="ms-sa-selected-mods-subtotal" style="padding:0.72rem 0.5rem;font-weight:900;font-size:1.08rem;text-align:right;color:#112D3A;">' +
                    fmtArs.format(quote.subtotal) +
                  '</td>' +
                '</tr>' +
              '</tfoot>' +
            '</table>' +
          '</div>' +

          /* Descuento Global + Resumen Mensual */
          '<div class="ms-sa-card ms-sa-card--highlight" style="margin-top:1rem;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;align-items:center;">' +
              '<div>' +
                '<div style="color:#56D7A1;font-weight:800;font-size:0.78rem;letter-spacing:0.03em;">VALOR MENSUAL FINAL COTIZADO</div>' +
                '<div style="font-size:1.95rem;font-weight:900;margin:0.2rem 0;">' +
                  '<span id="ms-q-sim-promo">' + fmtArs.format(quote.promoMonthly) + '</span> ' +
                  '<span style="font-size:0.9rem;font-weight:500;">/ mes</span>' +
                '</div>' +
                '<div id="ms-q-sim-breakdown" style="font-size:0.8rem;color:#d1fae5;">' +
                  'Base Opción ' + STATE_SA.newOptionType + ': ' + fmtArs.format(quote.optionBase) +
                  ' + Módulos/Submódulos: ' + fmtArs.format(quote.modTotal) +
                  ' = Subtotal: ' + fmtArs.format(quote.subtotal) +
                '</div>' +
                '<div id="ms-q-sim-temp-note" style="margin-top:0.25rem;font-size:0.8rem;color:#56D7A1;font-weight:700;' + (quote.months > 0 ? '' : 'display:none;') + '">' +
                  (quote.months > 0 ? '⏱ Promoción por ' + quote.months + ' meses · Luego: ' + fmtArs.format(quote.regularMonthly) + '/mes' : '') +
                '</div>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:1.2fr 0.7fr 0.8fr 0.7fr;gap:0.45rem;align-items:end;">' +
                '<div><label class="ms-sa-label" style="color:#d1fae5;">Descuento Global</label><select id="ms-q-gtype" class="ms-sa-select">' +
                  '<option value="none"' + (STATE_SA.quoteGlobalType === 'none' ? ' selected' : '') + '>Sin dto. global</option>' +
                  '<option value="temporary"' + (STATE_SA.quoteGlobalType === 'temporary' ? ' selected' : '') + '>Temporal (Meses)</option>' +
                  '<option value="permanent"' + (STATE_SA.quoteGlobalType === 'permanent' ? ' selected' : '') + '>Permanente</option>' +
                '</select></div>' +
                '<div><label class="ms-sa-label" style="color:#d1fae5;">% Dto.</label><input type="number" min="0" max="100" id="ms-q-gpct" class="ms-sa-input" value="' + esc(STATE_SA.quoteGlobalPct) + '" ' + (STATE_SA.quoteGlobalType === 'none' ? 'disabled' : '') + '></div>' +
                '<div><label class="ms-sa-label" style="color:#d1fae5;">$ Fijo Dto.</label><input type="number" min="0" step="500" id="ms-q-gfixed" class="ms-sa-input" value="' + esc(STATE_SA.quoteGlobalFixed) + '" ' + (STATE_SA.quoteGlobalType === 'none' ? 'disabled' : '') + '></div>' +
                '<div><label class="ms-sa-label" style="color:#d1fae5;">Meses</label><input type="number" min="1" max="60" id="ms-q-gmonths" class="ms-sa-input" value="' + esc(STATE_SA.quoteTempMonths) + '" ' + (STATE_SA.quoteGlobalType === 'temporary' ? '' : 'disabled') + '></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        /* PASO 2 y 3: DATOS DEL CLIENTE + CONFIGURACIÓN DE PERÍODO DE PRUEBA (HORAS) Y USUARIO DEMO */
        '<div class="ms-sa-grid">' +
          '<div class="ms-sa-card">' +
            '<h4 style="margin-top:0;">2. Datos del Cliente y Configuración para Presupuesto / Alta</h4>' +
            '<div style="display:grid;gap:0.65rem;">' +
              '<div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:0.6rem;">' +
                '<div><label class="ms-sa-label">Nombre Comercial / Fantasía *</label><input class="ms-sa-input" name="fantasyName" id="ms-inp-fantasy" required value="' + esc(df.fantasyName) + '" placeholder="Ej: Supermercado El Sol"></div>' +
                '<div><label class="ms-sa-label">Identificador Ruta (slug) *</label><input class="ms-sa-input" name="slug" id="ms-inp-slug" value="' + esc(df.slug) + '" placeholder="ej: superelsol"></div>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:0.6rem;">' +
                '<div><label class="ms-sa-label">Razón Social / Titular</label><input class="ms-sa-input" name="businessName" value="' + esc(df.businessName) + '" placeholder="Ej: El Sol S.A.S."></div>' +
                '<div><label class="ms-sa-label">CUIT (Opcional)</label><input class="ms-sa-input" name="cuit" value="' + esc(df.cuit) + '" placeholder="30-00000000-0"></div>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">' +
                '<div><label class="ms-sa-label">Persona de Contacto</label><input class="ms-sa-input" name="contactName" value="' + esc(df.contactName) + '" placeholder="Ej: Martín López"></div>' +
                '<div><label class="ms-sa-label">WhatsApp Cliente</label><input class="ms-sa-input" name="whatsappDigits" value="' + esc(df.whatsappDigits) + '" placeholder="549358..."></div>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:0.6rem;">' +
                '<div><label class="ms-sa-label">Email Cliente / Pagador Mercado Pago</label><input type="email" class="ms-sa-input" name="payerEmail" value="' + esc(df.payerEmail) + '" placeholder="cliente@comercio.com.ar"></div>' +
                '<div><label class="ms-sa-label">Localidad</label><input class="ms-sa-input" name="localidad" value="' + esc(df.localidad || 'RÍO CUARTO') + '"></div>' +
              '</div>' +
              (isOpt1
                ? '<div style="padding:0.65rem;border-radius:10px;background:#f8fafc;border:1px solid #cbd5e1;display:grid;gap:0.55rem;">' +
                    '<div><label class="ms-sa-label">Dominio Propio (Opción 1 — ej: www.cliente.com.ar)</label><input class="ms-sa-input" name="customDomain" value="' + esc(df.customDomain) + '" placeholder="www.nuevoerp.com.ar"></div>' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">' +
                      '<div><label class="ms-sa-label">Color Principal</label><input type="color" class="ms-sa-input" name="primaryHex" value="' + esc(df.primaryHex || '#112D3A') + '" style="height:38px;padding:3px;"></div>' +
                      '<div><label class="ms-sa-label">Color Acento</label><input type="color" class="ms-sa-input" name="accentHex" value="' + esc(df.accentHex || '#56D7A1') + '" style="height:38px;padding:3px;"></div>' +
                    '</div>' +
                    '<div><label class="ms-sa-label">Logo 1x1 (URL o archivo)</label><input class="ms-sa-input" name="logo1x1Url" value="' + esc(df.logo1x1Url) + '" placeholder="https://..."><input type="file" accept="image/*" id="ms-sa-file-logo1x1" style="margin-top:0.25rem;font-size:0.74rem;"></div>' +
                    '<div><label class="ms-sa-label">Logo Horizontal (URL o archivo)</label><input class="ms-sa-input" name="logoHorizontalUrl" value="' + esc(df.logoHorizontalUrl) + '" placeholder="https://..."><input type="file" accept="image/*" id="ms-sa-file-logohoriz" style="margin-top:0.25rem;font-size:0.74rem;"></div>' +
                  '</div>'
                : '<div style="padding:0.6rem 0.75rem;border-radius:9px;background:rgba(86,215,161,0.14);border:1px solid #56D7A1;font-size:0.79rem;">✓ <strong>Opción 2 (Subruta MiniSistema):</strong> el sistema operará en <code>minisistema.com.ar/' + esc(df.slug || 'comercio') + '</code> con los colores e isologotipo oficiales de MiniSistema.</div>') +
              '<div style="display:grid;grid-template-columns:0.45fr 1.55fr;gap:0.6rem;">' +
                '<div><label class="ms-sa-label">Validez PDF (días)</label><input type="number" min="1" max="90" class="ms-sa-input" name="validDays" value="' + esc(df.validDays || 15) + '"></div>' +
                '<div><label class="ms-sa-label">Notas / Observaciones del Presupuesto</label><input class="ms-sa-input" name="notas" value="' + esc(df.notas) + '" placeholder="Ej: Incluye capacitación inicial online y soporte WhatsApp."></div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="ms-sa-card" style="display:flex;flex-direction:column;justify-content:space-between;gap:0.85rem;">' +
            '<div>' +
              '<h4 style="margin-top:0;">3. Período de Prueba (Demo en Horas · BD Limpia) y Accesos</h4>' +
              '<div style="padding:0.8rem;border-radius:10px;background:#fffbeb;border:1.5px solid #f59e0b;display:grid;gap:0.6rem;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;">' +
                  '<strong style="font-size:0.84rem;color:#78350f;">⏱️ Cantidad de Horas del Período de Prueba:</strong>' +
                  '<div style="display:flex;gap:0.3rem;flex-wrap:wrap;">' +
                    [24, 48, 72, 120, 168]
                      .map(function (hs) {
                        var activeHs = trialHsNow === hs;
                        return (
                          '<button type="button" data-pick-trial-hs="' + hs + '" style="cursor:pointer;border:1px solid ' +
                          (activeHs ? '#112D3A' : '#d97706') +
                          ';background:' +
                          (activeHs ? '#112D3A' : '#fff') +
                          ';color:' +
                          (activeHs ? '#56D7A1' : '#92400e') +
                          ';border-radius:7px;padding:0.22rem 0.52rem;font-size:0.74rem;font-weight:800;">' +
                          hs + ' hs' +
                          '</button>'
                        );
                      })
                      .join('') +
                  '</div>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:0.7fr 1.3fr;gap:0.6rem;align-items:center;">' +
                  '<div><label class="ms-sa-label" style="color:#78350f;">Horas Habilitadas *</label><input type="number" min="1" max="2160" class="ms-sa-input" name="trialHours" id="ms-inp-trial-hs" value="' + esc(trialHsNow) + '"></div>' +
                  '<div id="ms-trial-preview-dates" style="font-size:0.76rem;color:#78350f;line-height:1.4;">' +
                    '• Vencimiento prueba: <strong>' + esc(formatDateTimeAr(previewEndsIso)) + '</strong><br>' +
                    '• Si no contrata el Plan: <strong>baja automática el ' + esc(formatDateAr(previewAutoBajaIso)) + '</strong> (10 días después).' +
                  '</div>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">' +
                  '<div><label class="ms-sa-label" style="color:#78350f;">Usuario Demo (@login)</label><input class="ms-sa-input" name="demoUsername" id="ms-inp-demo-user" value="' + esc(df.demoUsername) + '" placeholder="ej: demo_cliente"></div>' +
                  '<div>' +
                    '<label class="ms-sa-label" style="color:#78350f;">Contraseña Demo</label>' +
                    '<div style="display:flex;gap:0.3rem;">' +
                      '<input class="ms-sa-input" name="demoPassword" id="ms-inp-demo-pass" value="' + esc(df.demoPassword || 'Demo2026') + '">' +
                      '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-gen-demo-pass" title="Generar clave demo" style="padding:0.35rem 0.6rem;">🎲</button>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +

              '<div style="margin-top:0.85rem;padding:0.75rem;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;display:grid;gap:0.55rem;">' +
                '<strong style="font-size:0.81rem;color:#112D3A;">👑 Usuario Administrador Titular (Opcional · Para Alta directa de Plan):</strong>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;">' +
                  '<div><label class="ms-sa-label">Usuario Admin</label><input class="ms-sa-input" name="adminUsername" value="' + esc(df.adminUsername) + '" placeholder="ej: adminsol"></div>' +
                  '<div><label class="ms-sa-label">Clave Admin</label><input class="ms-sa-input" name="adminPassword" value="' + esc(df.adminPassword) + '" placeholder="Mín. 4 caract."></div>' +
                  '<div><label class="ms-sa-label">Nombre Titular</label><input class="ms-sa-input" name="adminName" value="' + esc(df.adminName) + '" placeholder="Ej: Carlos Gómez"></div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            /* BOTONERA DE FLUJO COMERCIAL COMPLETO: 1) PDF -> 2) GUARDAR -> 3) DEMO -> 4) PLAN DEFINITIVO */
            '<div style="display:grid;gap:0.55rem;margin-top:0.4rem;">' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--dark" id="ms-btn-quote-pdf" style="width:100%;padding:0.72rem;font-size:0.83rem;">📄 1. Guardar y Generar Presupuesto PDF</button>' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-btn-quote-save" style="width:100%;padding:0.72rem;font-size:0.83rem;">💾 Guardar Presupuesto en Seguimiento</button>' +
              '</div>' +
              '<button type="button" class="ms-sa-btn" id="ms-btn-start-trial" style="width:100%;padding:0.78rem;font-size:0.86rem;background:#f59e0b;color:#112D3A;border-color:#d97706;">' +
                '🧪 2. Habilitar Período de Prueba (<span id="ms-btn-trial-hs-lbl">' + esc(trialHsNow) + '</span> hs · Usuario Demo + BD Limpia)' +
              '</button>' +
              '<button type="submit" class="ms-sa-btn" id="ms-btn-confirm-direct-plan" style="width:100%;padding:0.78rem;font-size:0.86rem;">' +
                '🚀 3. Confirmar y Habilitar Plan Definitivo (+ Suscripción Mercado Pago)' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</form>'
    );
  }

  // =========================================================================
  // VISTA 3: CREDENCIALES API (INTACTA)
  // =========================================================================
  function renderSecretsTab() {
    var d = STATE_SA.data || {};
    var st = d.credentialsStatus || {};
    var tenants = d.tenants || [];
    var selectedAfipSlug = STATE_SA.afipSelectedSlug || 'minisistema';
    var afipInfo = STATE_SA.afipTenantInfo || null;
    var targetTenant =
      tenants.find(function (t) {
        return t.slug === selectedAfipSlug;
      }) || tenants[0] || { slug: 'minisistema', fantasy_name: 'MiniSistema', business_name: 'MiniSistema', branding: {} };

    var afipCuitVal =
      (afipInfo && afipInfo.slug === selectedAfipSlug ? afipInfo.cuit : '') ||
      (targetTenant.branding && targetTenant.branding.cuitFmt !== 'A CONFIGURAR' ? targetTenant.branding.cuitFmt : '') ||
      st.afipCuit ||
      '';
    var afipTitularVal =
      (afipInfo && afipInfo.slug === selectedAfipSlug ? afipInfo.titular : '') ||
      targetTenant.business_name ||
      targetTenant.fantasy_name ||
      '';
    var afipPtoVtaVal =
      (afipInfo && afipInfo.slug === selectedAfipSlug ? afipInfo.ptoVta : '') ||
      st.afipPtoVta ||
      '0002';
    var afipEntornoVal =
      (afipInfo && afipInfo.slug === selectedAfipSlug ? afipInfo.entorno : '') ||
      st.afipEntorno ||
      'produccion';
    var hasAfipCert =
      (afipInfo && afipInfo.slug === selectedAfipSlug && afipInfo.hasCertPem) || st.afipConfigured;
    var certMasked =
      (afipInfo && afipInfo.slug === selectedAfipSlug ? afipInfo.certMasked : '') ||
      st.afipCertMasked ||
      '';
    var keyMasked =
      (afipInfo && afipInfo.slug === selectedAfipSlug ? afipInfo.keyMasked : '') ||
      st.afipKeyMasked ||
      '';

    var tenantOptsHtml = tenants
      .map(function (t) {
        return (
          '<option value="' +
          esc(t.slug) +
          '" ' +
          (t.slug === selectedAfipSlug ? 'selected' : '') +
          '>' +
          esc(t.fantasy_name) +
          ' (' +
          esc(t.slug) +
          ')</option>'
        );
      })
      .join('');

    var webhookUrl = window.location.origin + '/api/mercadopago/webhook';

    return (
      '<div style="display:grid;gap:1.1rem;">' +
      '<div class="ms-sa-card" style="border:2px solid #56D7A1;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.85rem;">' +
      '<div>' +
      '<h4 style="margin:0;font-size:1.05rem;">🏛️ Credenciales AFIP / ARCA (Facturación Electrónica WSFEv1 y Padrón)</h4>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
      '<span class="ms-sa-pill">' +
      (hasAfipCert ? '🟢 Certificado X.509 Vinculado' : '⚙️ Pendiente de Certificado') +
      '</span>' +
      '<button type="button" class="ms-sa-btn ms-sa-btn--dark" id="ms-sa-open-arca-module" style="padding:0.4rem 0.8rem;font-size:0.78rem;">📄 Ir a Administración Comprobantes ARCA</button>' +
      '<a href="https://auth.afip.gob.ar/contribuyente_/login.xhtml" target="_blank" rel="noopener noreferrer" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.4rem 0.8rem;font-size:0.78rem;">🔗 Portal Clave Fiscal AFIP / ARCA ↗</a>' +
      '</div>' +
      '</div>' +
      '<form id="ms-sa-afip-form" style="display:grid;gap:0.8rem;">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.7rem;">' +
      '<div><label class="ms-sa-label">Comercio / Sistema a Vincular</label><select class="ms-sa-select" id="ms-sa-afip-slug" name="slug">' +
      tenantOptsHtml +
      '</select></div>' +
      '<div><label class="ms-sa-label">CUIT del Emisor (sin o con guiones)</label><input class="ms-sa-input" name="cuit" required value="' +
      esc(afipCuitVal) +
      '" placeholder="Ej: 27-05457050-9"></div>' +
      '<div><label class="ms-sa-label">Razón Social / Titular Fiscal</label><input class="ms-sa-input" name="titular" required value="' +
      esc(afipTitularVal) +
      '" placeholder="Ej: RAZÓN SOCIAL S.A."></div>' +
      '<div><label class="ms-sa-label">Punto de Venta WebService</label><input class="ms-sa-input" name="ptoVta" value="' +
      esc(afipPtoVtaVal) +
      '" placeholder="0002"></div>' +
      '<div><label class="ms-sa-label">Entorno WebService AFIP / ARCA</label><select class="ms-sa-select" name="entorno">' +
      '<option value="produccion" ' +
      (afipEntornoVal === 'produccion' ? 'selected' : '') +
      '>🟢 Producción (CAE Real WSFEv1)</option>' +
      '<option value="homologacion" ' +
      (afipEntornoVal === 'homologacion' ? 'selected' : '') +
      '>🧪 Homologación / Testing</option>' +
      '</select></div>' +
      '</div>' +
      '<div class="ms-sa-grid">' +
      '<div>' +
      '<label class="ms-sa-label">Certificado Digital AFIP / ARCA (<code>.crt</code> / <code>.pem</code>)</label>' +
      '<textarea class="ms-sa-input" name="certPem" id="ms-sa-afip-cert-txt" rows="3" style="font-family:monospace;font-size:0.76rem;" placeholder="' +
      esc(
        certMasked
          ? 'Certificado cargado (' + certMasked + '). Pegá uno nuevo o subí archivo .crt para reemplazar.'
          : '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'
      ) +
      '"></textarea>' +
      '<input type="file" id="ms-sa-afip-cert-file" accept=".crt,.pem,.cer,.txt" style="margin-top:0.35rem;font-size:0.76rem;">' +
      '</div>' +
      '<div>' +
      '<label class="ms-sa-label">Clave Privada RSA (<code>.key</code> / <code>.pem</code>)</label>' +
      '<textarea class="ms-sa-input" name="keyPem" id="ms-sa-afip-key-txt" rows="3" style="font-family:monospace;font-size:0.76rem;" placeholder="' +
      esc(
        keyMasked
          ? 'Clave privada cargada (' + keyMasked + '). Pegá una nueva o subí archivo .key para reemplazar.'
          : '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
      ) +
      '"></textarea>' +
      '<input type="file" id="ms-sa-afip-key-file" accept=".key,.pem,.txt" style="margin-top:0.35rem;font-size:0.76rem;">' +
      '</div>' +
      '</div>' +
      '<div><button type="submit" class="ms-sa-btn">🏛️ Guardar y Vincular Credenciales AFIP / ARCA</button></div>' +
      '</form>' +
      '</div>' +
      '<form id="ms-sa-secrets-form" style="display:grid;gap:1rem;">' +
      '<div class="ms-sa-grid">' +
      '<div class="ms-sa-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">' +
      '<h4 style="margin:0;">💳 Mercado Pago (Débito Automático / Suscripciones)</h4>' +
      '<span class="ms-sa-pill">' +
      (st.mpConfigured ? '🟢 Producción Activa' : '🧪 Modo Prueba') +
      '</span>' +
      '</div>' +
      '<div style="display:grid;gap:0.65rem;">' +
      '<div><label class="ms-sa-label">Access Token de Producción (<code>APP_USR-...</code>)</label><input type="password" class="ms-sa-input" name="mp_access_token" placeholder="' +
      esc(st.mpAccessTokenMasked || 'Pegar APP_USR-... cuando quieras pasar a cobro real') +
      '"></div>' +
      '<div><label class="ms-sa-label">Public Key (<code>APP_USR-...</code>)</label><input class="ms-sa-input" name="mp_public_key" value="' +
      esc(st.mpPublicKey || '') +
      '" placeholder="APP_USR-..."></div>' +
      '<div><label class="ms-sa-label">Webhook URL para pegar en tu Panel de Mercado Pago</label><input class="ms-sa-input" readonly value="' +
      esc(webhookUrl) +
      '" onclick="this.select()"></div>' +
      '</div>' +
      '</div>' +
      '<div class="ms-sa-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">' +
      '<h4 style="margin:0;">🌐 GitHub + Vercel (Automatización Opción 1)</h4>' +
      '<span class="ms-sa-pill">' +
      (st.githubConfigured && st.vercelConfigured ? '🟢 Conectado' : '⚙️ Opcional / Manual') +
      '</span>' +
      '</div>' +
      '<div style="display:grid;gap:0.65rem;">' +
      '<div><label class="ms-sa-label">GitHub Personal Access Token (<code>ghp_...</code>)</label><input type="password" class="ms-sa-input" name="github_token" placeholder="' +
      esc(st.githubTokenMasked || 'Pegar token con permiso repo') +
      '"></div>' +
      '<div><label class="ms-sa-label">Usuario / Organización GitHub</label><input class="ms-sa-input" name="github_owner" value="' +
      esc(st.githubOwner || 'danighiglionesl-art') +
      '"></div>' +
      '<div><label class="ms-sa-label">Vercel API Token</label><input type="password" class="ms-sa-input" name="vercel_token" placeholder="' +
      esc(st.vercelTokenMasked || 'Pegar token desde vercel.com/account/tokens') +
      '"></div>' +
      '<div><label class="ms-sa-label">Vercel Team ID</label><input class="ms-sa-input" name="vercel_team_id" value="' +
      esc(st.vercelTeamId || '') +
      '"></div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div><button type="submit" class="ms-sa-btn">🔐 Guardar Credenciales MP · GitHub · Vercel</button></div>' +
      '</form>' +
      '</div>'
    );
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        resolve(String(r.result || ''));
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // =========================================================================
  // VISTA 4: DIRECTORIO GLOBAL DE USUARIOS (INTACTA)
  // =========================================================================
  function getUserTypeBadgeStyle(uType) {
    if (uType === 'Admin. Gral.') return 'background:#112D3A;color:#56D7A1;border:1px solid #56D7A1;';
    if (uType === 'Administrador') return 'background:#fef3c7;color:#92400e;border:1px solid #f59e0b;';
    if (uType === 'Usuario Fábrica') return 'background:#e0f2fe;color:#075985;border:1px solid #38bdf8;';
    if (uType === 'Profesional / Especialista') return 'background:#f3e8ff;color:#6b21a8;border:1px solid #c084fc;';
    if (uType === 'Socio / Cliente') return 'background:#f1f5f9;color:#334155;border:1px solid #94a3b8;';
    return 'background:#dcfce7;color:#166534;border:1px solid #4ade80;';
  }

  function renderStatusBadgeHtml(status, reason) {
    if (status === 'suspended_nonpayment') {
      return (
        '<span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.22rem 0.55rem;border-radius:999px;font-size:0.73rem;font-weight:800;background:#ffedd5;color:#9a3412;border:1px solid #fb923c;" title="' +
        esc(reason || 'Deshabilitado transitoriamente por falta de pago') +
        '">⏸️ Falta de Pago</span>'
      );
    }
    if (status === 'disabled') {
      return (
        '<span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.22rem 0.55rem;border-radius:999px;font-size:0.73rem;font-weight:800;background:#fee2e2;color:#991b1b;border:1px solid #f87171;" title="' +
        esc(reason || 'Deshabilitado') +
        '">⛔ Deshabilitado</span>'
      );
    }
    return '<span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.22rem 0.55rem;border-radius:999px;font-size:0.73rem;font-weight:800;background:#dcfce7;color:#166534;border:1px solid #4ade80;">✅ Activo</span>';
  }

  function getFilteredGlobalUsers() {
    var d = STATE_SA.data || {};
    var all = Array.isArray(d.globalUsers) ? d.globalUsers : [];
    var q = String(STATE_SA.usersSearch || '').trim().toLowerCase();
    var pFilter = STATE_SA.usersProjectFilter || 'ALL';
    var tFilter = STATE_SA.usersTypeFilter || 'ALL';
    var sFilter = STATE_SA.usersStatusFilter || 'ALL';

    return all.filter(function (u) {
      if (pFilter !== 'ALL' && u.project !== pFilter) return false;
      if (tFilter !== 'ALL' && u.userType !== tFilter) return false;
      if (sFilter !== 'ALL' && u.status !== sFilter) return false;
      if (q) {
        var hay =
          (u.project || '') +
          ' ' +
          (u.name || '') +
          ' ' +
          (u.username || '') +
          ' ' +
          (u.email || '') +
          ' ' +
          (u.password || '') +
          ' ' +
          (u.userType || '') +
          ' ' +
          (u.notes || '');
        if (hay.toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderUsersTab() {
    var d = STATE_SA.data || {};
    var all = Array.isArray(d.globalUsers) ? d.globalUsers : [];
    var tenants = Array.isArray(d.tenants) ? d.tenants : [];
    var defTypes = Array.isArray(d.definedUserTypes) && d.definedUserTypes.length
      ? d.definedUserTypes
      : [
          { key: 'Admin. Gral.', label: 'Admin. Gral.', description: 'Superadministrador global' },
          { key: 'Administrador', label: 'Administrador', description: 'Administrador titular de sistema' },
          { key: 'Usuario', label: 'Usuario', description: 'Operador / cajero / vendedor' },
          { key: 'Usuario Fábrica', label: 'Usuario Fábrica', description: 'Proveedor mayorista' },
          { key: 'Profesional / Especialista', label: 'Profesional / Especialista', description: 'Médico / terapeuta' },
          { key: 'Socio / Cliente', label: 'Socio / Cliente', description: 'Cliente / socio web' }
        ];

    var projectCounts = {};
    var projectTenantSlug = {};
    var typeCounts = {};
    var activeCount = 0;
    var nonPaymentCount = 0;

    all.forEach(function (u) {
      var p = u.project || 'Sin Proyecto';
      projectCounts[p] = (projectCounts[p] || 0) + 1;
      if (u.tenantSlug) projectTenantSlug[p] = u.tenantSlug;
      var ut = u.userType || 'Usuario';
      typeCounts[ut] = (typeCounts[ut] || 0) + 1;
      if (u.status === 'active') activeCount++;
      if (u.status === 'suspended_nonpayment') nonPaymentCount++;
    });

    var projectNames = Object.keys(projectCounts).sort(function (a, b) {
      if (a.indexOf('MiniSistema') === 0 && b.indexOf('MiniSistema') !== 0) return -1;
      if (b.indexOf('MiniSistema') === 0 && a.indexOf('MiniSistema') !== 0) return 1;
      return a.localeCompare(b, 'es');
    });

    var filtered = getFilteredGlobalUsers();
    var ed = STATE_SA.usersEditingItem || null;

    var kpiHtml =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:0.8rem;margin-bottom:1rem;">' +
        '<div class="ms-sa-card" style="padding:0.9rem 1.1rem;border-left:4px solid #112D3A;">' +
          '<div style="font-size:0.73rem;font-weight:800;text-transform:uppercase;opacity:0.75;">Proyectos / Sistemas</div>' +
          '<div style="font-size:1.65rem;font-weight:900;color:#112D3A;">' + projectNames.length + '</div>' +
          '<div style="font-size:0.74rem;opacity:0.75;">Desde el inicio de Antigravity</div>' +
        '</div>' +
        '<div class="ms-sa-card" style="padding:0.9rem 1.1rem;border-left:4px solid #56D7A1;">' +
          '<div style="font-size:0.73rem;font-weight:800;text-transform:uppercase;opacity:0.75;">Total Usuarios y Claves</div>' +
          '<div style="font-size:1.65rem;font-weight:900;color:#112D3A;">' + all.length + '</div>' +
          '<div style="font-size:0.74rem;opacity:0.75;">Mostrando ' + filtered.length + ' en tabla</div>' +
        '</div>' +
        '<div class="ms-sa-card" style="padding:0.9rem 1.1rem;border-left:4px solid #22c55e;">' +
          '<div style="font-size:0.73rem;font-weight:800;text-transform:uppercase;opacity:0.75;">Usuarios Habilitados</div>' +
          '<div style="font-size:1.65rem;font-weight:900;color:#15803d;">' + activeCount + '</div>' +
          '<div style="font-size:0.74rem;opacity:0.75;">Con acceso operativo activo</div>' +
        '</div>' +
        '<div class="ms-sa-card" style="padding:0.9rem 1.1rem;border-left:4px solid #f97316;">' +
          '<div style="font-size:0.73rem;font-weight:800;text-transform:uppercase;opacity:0.75;">Suspendidos (Falta Pago)</div>' +
          '<div style="font-size:1.65rem;font-weight:900;color:#c2410c;">' + nonPaymentCount + '</div>' +
          '<div style="font-size:0.74rem;opacity:0.75;">Deshabilitación transitoria</div>' +
        '</div>' +
      '</div>';

    var typePillsHtml =
      '<div class="ms-sa-card" style="padding:0.85rem 1rem;margin-bottom:1rem;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.55rem;">' +
          '<strong style="font-size:0.82rem;text-transform:uppercase;letter-spacing:0.03em;">🏷️ Tipos de Usuarios Definidos (Clic para filtrar)</strong>' +
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
            '<button type="button" class="ms-sa-btn" id="ms-gu-open-new" style="padding:0.42rem 0.85rem;font-size:0.8rem;">➕ Nuevo Usuario (ABM)</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-gu-toggle-all-pass" style="padding:0.42rem 0.85rem;font-size:0.8rem;">' +
              (STATE_SA.usersShowAllPasswords ? '🙈 Ocultar Contraseñas' : '👁️ Mostrar Contraseñas') +
            '</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--dark" id="ms-gu-export-csv" style="padding:0.42rem 0.85rem;font-size:0.8rem;">📥 Exportar Nómina CSV</button>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:0.45rem;">' +
          '<button type="button" data-gu-type-pill="ALL" style="cursor:pointer;padding:0.32rem 0.7rem;border-radius:999px;font-size:0.76rem;font-weight:800;border:2px solid ' +
            (STATE_SA.usersTypeFilter === 'ALL' ? '#112D3A' : 'transparent') +
            ';background:#e2e8f0;color:#0f172a;">Todos (' + all.length + ')</button>' +
          defTypes
            .map(function (t) {
              var cnt = typeCounts[t.key] || 0;
              var active = STATE_SA.usersTypeFilter === t.key;
              return (
                '<button type="button" data-gu-type-pill="' +
                esc(t.key) +
                '" title="' +
                esc(t.description || '') +
                '" style="cursor:pointer;padding:0.32rem 0.7rem;border-radius:999px;font-size:0.76rem;font-weight:800;' +
                getUserTypeBadgeStyle(t.key) +
                (active ? 'box-shadow:0 0 0 2px #112D3A;' : 'opacity:0.9;') +
                '">' +
                esc(t.label) +
                ' (' +
                cnt +
                ')</button>'
              );
            })
            .join('') +
        '</div>' +
      '</div>';

    var formHtml = '';
    if (STATE_SA.usersFormOpen) {
      var edTargetMode = ed
        ? ed.tenantSlug
          ? 'erp:' + ed.tenantSlug
          : 'vault'
        : 'erp:minisistema';
      var tenantSelectOpts =
        tenants
          .map(function (t) {
            var val = 'erp:' + t.slug;
            return (
              '<option value="' +
              esc(val) +
              '" ' +
              (edTargetMode === val ? 'selected' : '') +
              '>⚡ Sistema ERP Activo: ' +
              esc(t.fantasy_name) +
              ' (' +
              esc(t.slug) +
              ')</option>'
            );
          })
          .join('') +
        '<option value="vault" ' +
        (edTargetMode === 'vault' ? 'selected' : '') +
        '>🗂️ Proyecto Externo / Otro Sistema Antigravity</option>';

      var datalistProjects = projectNames
        .map(function (p) {
          return '<option value="' + esc(p) + '"></option>';
        })
        .join('');

      formHtml =
        '<div class="ms-sa-card" style="border:2px solid #56D7A1;margin-bottom:1rem;background:#f8fafc;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">' +
            '<h4 style="margin:0;color:#112D3A;">' +
              (ed ? '✏️ Modificar Usuario: ' + esc(ed.username) + ' (' + esc(ed.project) + ')' : '➕ Alta de Nuevo Usuario en Sistema / Proyecto') +
            '</h4>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-gu-cancel-form" style="padding:0.3rem 0.7rem;font-size:0.76rem;">✕ Cerrar</button>' +
          '</div>' +
          '<form id="ms-gu-abm-form" style="display:grid;gap:0.75rem;">' +
            '<input type="hidden" name="id" value="' + esc(ed ? ed.id : '') + '">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.65rem;">' +
              '<div>' +
                '<label class="ms-sa-label">Asociar a Sistema / Proyecto *</label>' +
                '<select class="ms-sa-select" name="targetMode" id="ms-gu-target-mode">' +
                  tenantSelectOpts +
                '</select>' +
              '</div>' +
              '<div id="ms-gu-vault-proj-wrap" style="' + (edTargetMode === 'vault' ? '' : 'display:none;') + '">' +
                '<label class="ms-sa-label">Nombre del Proyecto *</label>' +
                '<input class="ms-sa-input" name="project" list="ms-gu-projects-dl" value="' + esc(ed ? ed.project : '') + '" placeholder="Ej: Casa Nueva ERP, Mate-Mática, Nova...">' +
                '<datalist id="ms-gu-projects-dl">' + datalistProjects + '</datalist>' +
              '</div>' +
              '<div id="ms-gu-vault-url-wrap" style="' + (edTargetMode === 'vault' ? '' : 'display:none;') + '">' +
                '<label class="ms-sa-label">URL / Acceso del Proyecto</label>' +
                '<input class="ms-sa-input" name="projectUrl" value="' + esc(ed ? ed.projectUrl : '') + '" placeholder="https://...">' +
              '</div>' +
              '<div>' +
                '<label class="ms-sa-label">Nombre y Apellido / Titular *</label>' +
                '<input class="ms-sa-input" name="name" required value="' + esc(ed ? ed.name : '') + '" placeholder="Ej: Juan Pérez">' +
              '</div>' +
              '<div>' +
                '<label class="ms-sa-label">Usuario / Login (@usuario o Email) *</label>' +
                '<input class="ms-sa-input" name="username" required value="' + esc(ed ? ed.username : '') + '" placeholder="Ej: juanp">' +
              '</div>' +
              '<div>' +
                '<label class="ms-sa-label">Contraseña *</label>' +
                '<div style="display:flex;gap:0.35rem;">' +
                  '<input class="ms-sa-input" type="text" name="password" id="ms-gu-pass-inp" required value="' + esc(ed ? ed.password : '') + '" placeholder="Clave de acceso">' +
                  '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-gu-gen-pass" title="Generar clave segura" style="padding:0.4rem 0.65rem;">🎲</button>' +
                '</div>' +
              '</div>' +
              '<div>' +
                '<label class="ms-sa-label">Tipo de Usuario Definido *</label>' +
                '<select class="ms-sa-select" name="userType">' +
                  defTypes
                    .map(function (t) {
                      return (
                        '<option value="' +
                        esc(t.key) +
                        '" ' +
                        (ed && ed.userType === t.key ? 'selected' : !ed && t.key === 'Usuario' ? 'selected' : '') +
                        '>' +
                        esc(t.label) +
                        '</option>'
                      );
                    })
                    .join('') +
                '</select>' +
              '</div>' +
              '<div>' +
                '<label class="ms-sa-label">Estado de Acceso *</label>' +
                '<select class="ms-sa-select" name="status">' +
                  '<option value="active" ' + (!ed || ed.status === 'active' ? 'selected' : '') + '>✅ Activo (Habilitado)</option>' +
                  '<option value="suspended_nonpayment" ' + (ed && ed.status === 'suspended_nonpayment' ? 'selected' : '') + '>⏸️ Deshabilitado transitoriamente (Falta de Pago)</option>' +
                  '<option value="disabled" ' + (ed && ed.status === 'disabled' ? 'selected' : '') + '>⛔ Deshabilitado / Baja Lógica</option>' +
                '</select>' +
              '</div>' +
              '<div>' +
                '<label class="ms-sa-label">Correo Electrónico (Opcional)</label>' +
                '<input class="ms-sa-input" name="email" value="' + esc(ed ? ed.email : '') + '" placeholder="correo@dominio.com">' +
              '</div>' +
              '<div>' +
                '<label class="ms-sa-label">WhatsApp (Opcional)</label>' +
                '<input class="ms-sa-input" name="whatsapp" value="' + esc(ed ? ed.whatsapp : '') + '" placeholder="+54 9 358...">' +
              '</div>' +
              '<div style="grid-column:1 / -1;">' +
                '<label class="ms-sa-label">Observaciones / Detalle de Rol o Suspensión</label>' +
                '<input class="ms-sa-input" name="notes" value="' + esc(ed ? ed.notes : '') + '" placeholder="Ej: Abono mensual vencido / Cajero turno mañana / Permisos especiales...">' +
              '</div>' +
            '</div>' +
            '<div style="display:flex;gap:0.6rem;justify-content:flex-end;">' +
              '<button type="submit" class="ms-sa-btn">💾 Guardar Usuario</button>' +
            '</div>' +
          '</form>' +
        '</div>';
    }

    var selectedProjSlug =
      STATE_SA.usersProjectFilter !== 'ALL'
        ? projectTenantSlug[STATE_SA.usersProjectFilter] || ''
        : '';
    var canBatchProject =
      STATE_SA.usersProjectFilter !== 'ALL' && selectedProjSlug !== 'minisistema';

    var filterBarHtml =
      '<div class="ms-sa-card" style="padding:0.85rem 1rem;margin-bottom:1rem;">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.65rem;align-items:end;">' +
          '<div>' +
            '<label class="ms-sa-label">🔎 Buscar por Proyecto, Usuario, Nombre o Clave</label>' +
            '<input class="ms-sa-input" id="ms-gu-search" value="' + esc(STATE_SA.usersSearch) + '" placeholder="Ej: danielg, Casa Nueva, Mate-Mática, Nova...">' +
          '</div>' +
          '<div>' +
            '<label class="ms-sa-label">📁 Filtrar por Proyecto / Sistema</label>' +
            '<select class="ms-sa-select" id="ms-gu-proj-filter">' +
              '<option value="ALL">Todos los Proyectos (' + projectNames.length + ')</option>' +
              projectNames
                .map(function (p) {
                  return (
                    '<option value="' +
                    esc(p) +
                    '" ' +
                    (STATE_SA.usersProjectFilter === p ? 'selected' : '') +
                    '>' +
                    esc(p) +
                    ' (' +
                    projectCounts[p] +
                    ')</option>'
                  );
                })
                .join('') +
            '</select>' +
          '</div>' +
          '<div>' +
            '<label class="ms-sa-label">🚦 Filtrar por Estado</label>' +
            '<select class="ms-sa-select" id="ms-gu-status-filter">' +
              '<option value="ALL" ' + (STATE_SA.usersStatusFilter === 'ALL' ? 'selected' : '') + '>Todos los Estados</option>' +
              '<option value="active" ' + (STATE_SA.usersStatusFilter === 'active' ? 'selected' : '') + '>✅ Activos</option>' +
              '<option value="suspended_nonpayment" ' + (STATE_SA.usersStatusFilter === 'suspended_nonpayment' ? 'selected' : '') + '>⏸️ Suspendidos (Falta de Pago)</option>' +
              '<option value="disabled" ' + (STATE_SA.usersStatusFilter === 'disabled' ? 'selected' : '') + '>⛔ Deshabilitados</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        (canBatchProject
          ? '<div style="margin-top:0.75rem;padding-top:0.7rem;border-top:1px dashed rgba(17,45,58,0.16);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">' +
              '<span style="font-size:0.8rem;font-weight:700;color:#112D3A;">Acción masiva sobre el proyecto seleccionado: <strong>' + esc(STATE_SA.usersProjectFilter) + '</strong></span>' +
              '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-gu-batch-suspend" data-proj="' + esc(STATE_SA.usersProjectFilter) + '" data-slug="' + esc(selectedProjSlug) + '" style="padding:0.35rem 0.75rem;font-size:0.76rem;border-color:#ea580c;color:#9a3412;">⏸️ Suspender todo el proyecto (Falta de Pago)</button>' +
                '<button type="button" class="ms-sa-btn" id="ms-gu-batch-activate" data-proj="' + esc(STATE_SA.usersProjectFilter) + '" data-slug="' + esc(selectedProjSlug) + '" style="padding:0.35rem 0.75rem;font-size:0.76rem;">▶️ Rehabilitar todo el proyecto</button>' +
              '</div>' +
            '</div>'
          : '') +
      '</div>';

    var rowsHtml = filtered
      .map(function (u) {
        var hasRowOverride = Object.prototype.hasOwnProperty.call(STATE_SA.usersRevealedMap, u.id);
        var showPass = hasRowOverride
          ? Boolean(STATE_SA.usersRevealedMap[u.id])
          : Boolean(STATE_SA.usersShowAllPasswords);
        var isBaseDaniel = u.tenantSlug === 'minisistema' && String(u.username || '').toLowerCase() === 'danielg';
        var isSuspended = u.status === 'suspended_nonpayment' || u.status === 'disabled';

        return (
          '<tr style="' + (u.status === 'suspended_nonpayment' ? 'background:rgba(251,146,60,0.08);' : '') + '">' +
            '<td>' +
              '<div style="font-weight:800;color:#112D3A;">' + esc(u.project) + '</div>' +
              (u.projectUrl
                ? '<a href="' + esc(u.projectUrl) + '" target="_blank" rel="noopener noreferrer" style="font-size:0.73rem;color:#0f766e;text-decoration:underline;word-break:break-all;">' + esc(u.projectUrl.replace(/^https?:\/\//, '')) + ' ↗</a>'
                : '') +
              (u.source === 'erp_tenant'
                ? '<div><span style="font-size:0.66rem;font-weight:800;background:#dcfce7;color:#166534;padding:0.1rem 0.4rem;border-radius:4px;">⚡ Sincronizado Supabase</span></div>'
                : '') +
            '</td>' +
            '<td>' +
              '<div style="font-weight:700;">' + esc(u.name || '—') + '</div>' +
              (u.notes ? '<div style="font-size:0.72rem;opacity:0.75;">' + esc(u.notes) + '</div>' : '') +
            '</td>' +
            '<td>' +
              '<code style="font-weight:900;font-size:0.84rem;background:rgba(17,45,58,0.07);padding:0.18rem 0.45rem;border-radius:6px;color:#112D3A;">' + esc(u.username) + '</code>' +
              (u.email && u.email !== u.username ? '<div style="font-size:0.72rem;opacity:0.8;margin-top:0.15rem;">' + esc(u.email) + '</div>' : '') +
            '</td>' +
            '<td>' +
              '<div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;">' +
                '<code data-gu-pass-code="' + esc(u.id) + '" data-gu-pass-raw="' + esc(u.password || '—') + '" style="font-weight:800;font-size:0.83rem;padding:0.18rem 0.48rem;border-radius:6px;background:' +
                  (showPass ? '#ecfdf5' : '#f1f5f9') +
                  ';color:#064e3b;border:1px solid rgba(16,185,129,0.35);">' +
                  (showPass ? esc(u.password || '—') : '••••••••••') +
                '</code>' +
                '<button type="button" data-gu-reveal="' + esc(u.id) + '" title="' + (showPass ? 'Ocultar contraseña' : 'Mostrar contraseña') + '" style="border:none;background:transparent;cursor:pointer;font-size:0.88rem;padding:0.15rem;">' + (showPass ? '🙈' : '👁️') + '</button>' +
                (u.password
                  ? '<button type="button" data-gu-copy="' + esc(u.password) + '" title="Copiar contraseña" style="border:none;background:transparent;cursor:pointer;font-size:0.85rem;padding:0.15rem;">📋</button>'
                  : '') +
              '</div>' +
            '</td>' +
            '<td>' +
              '<span style="display:inline-block;padding:0.22rem 0.58rem;border-radius:999px;font-size:0.73rem;font-weight:800;' + getUserTypeBadgeStyle(u.userType) + '">' +
                esc(u.userType) +
              '</span>' +
            '</td>' +
            '<td>' + renderStatusBadgeHtml(u.status, u.suspendedReason) + '</td>' +
            '<td>' +
              '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-gu-edit="' + esc(u.id) + '" style="padding:0.28rem 0.55rem;font-size:0.73rem;">✏️ Editar</button>' +
                (!isBaseDaniel
                  ? isSuspended
                    ? '<button type="button" class="ms-sa-btn" data-gu-status="' + esc(u.id) + '" data-next-status="active" style="padding:0.28rem 0.55rem;font-size:0.73rem;">▶️ Habilitar</button>'
                    : '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-gu-status="' + esc(u.id) + '" data-next-status="suspended_nonpayment" style="padding:0.28rem 0.55rem;font-size:0.73rem;border-color:#ea580c;color:#9a3412;">⏸️ Falta Pago</button>'
                  : '') +
                (!isBaseDaniel
                  ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-gu-del="' + esc(u.id) + '" style="padding:0.28rem 0.52rem;font-size:0.73rem;border-color:#ef4444;color:#991b1b;">🗑️</button>'
                  : '') +
              '</div>' +
            '</td>' +
          '</tr>'
        );
      })
      .join('');

    var tableCardHtml =
      '<div class="ms-sa-card" style="overflow-x:auto;">' +
        '<table class="ms-sa-table" data-excel-table-key="sa-global-users" style="width:100%;min-width:880px;">' +
          '<thead>' +
            '<tr>' +
              '<th>Proyecto / Sistema Asociado</th>' +
              '<th>Nombre / Referencia</th>' +
              '<th>Usuario / Login</th>' +
              '<th>Contraseña</th>' +
              '<th>Tipo de Usuario</th>' +
              '<th>Estado</th>' +
              '<th>Acciones ABM</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            (rowsHtml || '<tr><td colspan="7" style="text-align:center;padding:1.5rem;opacity:0.7;">No se encontraron usuarios con los filtros actuales.</td></tr>') +
          '</tbody>' +
        '</table>' +
      '</div>';

    return kpiHtml + typePillsHtml + formHtml + filterBarHtml + tableCardHtml;
  }

  function bindUsersTabEvents(bodyEl) {
    var d = STATE_SA.data || {};
    var all = Array.isArray(d.globalUsers) ? d.globalUsers : [];

    var searchInp = bodyEl.querySelector('#ms-gu-search');
    if (searchInp) {
      searchInp.addEventListener('input', function () {
        var pos = searchInp.selectionStart || 0;
        STATE_SA.usersSearch = searchInp.value;
        renderBody();
        var nextInp = document.getElementById('ms-gu-search');
        if (nextInp) {
          nextInp.focus();
          try { nextInp.setSelectionRange(pos, pos); } catch (_e) {}
        }
      });
    }

    var projSel = bodyEl.querySelector('#ms-gu-proj-filter');
    if (projSel) {
      projSel.addEventListener('change', function () {
        STATE_SA.usersProjectFilter = projSel.value;
        renderBody();
      });
    }

    var stSel = bodyEl.querySelector('#ms-gu-status-filter');
    if (stSel) {
      stSel.addEventListener('change', function () {
        STATE_SA.usersStatusFilter = stSel.value;
        renderBody();
      });
    }

    bodyEl.querySelectorAll('[data-gu-type-pill]').forEach(function (pill) {
      pill.addEventListener('click', function () {
        STATE_SA.usersTypeFilter = pill.getAttribute('data-gu-type-pill') || 'ALL';
        renderBody();
      });
    });

    var toggleAllPassBtn = bodyEl.querySelector('#ms-gu-toggle-all-pass');
    if (toggleAllPassBtn) {
      toggleAllPassBtn.addEventListener('click', function () {
        STATE_SA.usersShowAllPasswords = !STATE_SA.usersShowAllPasswords;
        STATE_SA.usersRevealedMap = {};
        renderBody();
      });
    }

    bodyEl.querySelectorAll('[data-gu-reveal]').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var id = btn.getAttribute('data-gu-reveal');
        var hasOverride = Object.prototype.hasOwnProperty.call(STATE_SA.usersRevealedMap, id);
        var currentlyShown = hasOverride
          ? Boolean(STATE_SA.usersRevealedMap[id])
          : Boolean(STATE_SA.usersShowAllPasswords);
        var nextShown = !currentlyShown;
        STATE_SA.usersRevealedMap[id] = nextShown;

        var codeEl = btn.parentElement ? btn.parentElement.querySelector('[data-gu-pass-code]') : null;
        if (codeEl) {
          var rawPass = codeEl.getAttribute('data-gu-pass-raw') || '—';
          codeEl.textContent = nextShown ? rawPass : '••••••••••';
          codeEl.style.background = nextShown ? '#ecfdf5' : '#f1f5f9';
        }
        btn.textContent = nextShown ? '🙈' : '👁️';
      });
    });

    bodyEl.querySelectorAll('[data-gu-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pw = btn.getAttribute('data-gu-copy') || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(pw).then(function () {
            showFeedback('📋 Contraseña copiada al portapapeles.', false);
          });
        }
      });
    });

    var exportBtn = bodyEl.querySelector('#ms-gu-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var rows = getFilteredGlobalUsers();
        var header = ['Proyecto', 'URL', 'Nombre', 'Usuario', 'Email', 'Contrasena', 'TipoUsuario', 'Estado', 'Notas'];
        var lines = [header.join(';')];
        rows.forEach(function (u) {
          var vals = [
            u.project || '',
            u.projectUrl || '',
            u.name || '',
            u.username || '',
            u.email || '',
            u.password || '',
            u.userType || '',
            u.status === 'suspended_nonpayment' ? 'Suspendido Falta de Pago' : u.status === 'disabled' ? 'Deshabilitado' : 'Activo',
            u.notes || ''
          ].map(function (v) {
            return '"' + String(v).replace(/"/g, '""') + '"';
          });
          lines.push(vals.join(';'));
        });
        var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'minisistema_usuarios_proyectos.csv';
        a.click();
      });
    }

    var openNewBtn = bodyEl.querySelector('#ms-gu-open-new');
    if (openNewBtn) {
      openNewBtn.addEventListener('click', function () {
        STATE_SA.usersEditingItem = null;
        STATE_SA.usersFormOpen = true;
        renderBody();
      });
    }

    var cancelFormBtn = bodyEl.querySelector('#ms-gu-cancel-form');
    if (cancelFormBtn) {
      cancelFormBtn.addEventListener('click', function () {
        STATE_SA.usersFormOpen = false;
        STATE_SA.usersEditingItem = null;
        renderBody();
      });
    }

    var targetModeSel = bodyEl.querySelector('#ms-gu-target-mode');
    if (targetModeSel) {
      targetModeSel.addEventListener('change', function () {
        var isVault = targetModeSel.value === 'vault';
        var w1 = bodyEl.querySelector('#ms-gu-vault-proj-wrap');
        var w2 = bodyEl.querySelector('#ms-gu-vault-url-wrap');
        if (w1) w1.style.display = isVault ? '' : 'none';
        if (w2) w2.style.display = isVault ? '' : 'none';
      });
    }

    var genPassBtn = bodyEl.querySelector('#ms-gu-gen-pass');
    if (genPassBtn) {
      genPassBtn.addEventListener('click', function () {
        var inp = bodyEl.querySelector('#ms-gu-pass-inp');
        if (inp) inp.value = generateRandomPass();
      });
    }

    var abmForm = bodyEl.querySelector('#ms-gu-abm-form');
    if (abmForm) {
      abmForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(abmForm);
        var mode = String(fd.get('targetMode') || 'vault');
        var tenantSlug = mode.indexOf('erp:') === 0 ? mode.slice(4) : '';
        var res = await apiSuperAdmin('POST', {
          action: 'save_global_user',
          id: String(fd.get('id') || ''),
          tenantSlug: tenantSlug,
          project: String(fd.get('project') || ''),
          projectUrl: String(fd.get('projectUrl') || ''),
          name: String(fd.get('name') || ''),
          username: String(fd.get('username') || ''),
          password: String(fd.get('password') || ''),
          userType: String(fd.get('userType') || 'Usuario'),
          status: String(fd.get('status') || 'active'),
          email: String(fd.get('email') || ''),
          whatsapp: String(fd.get('whatsapp') || ''),
          notes: String(fd.get('notes') || '')
        });
        if (res && res.ok) {
          showFeedback(res.message, false);
          STATE_SA.usersFormOpen = false;
          STATE_SA.usersEditingItem = null;
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'No se pudo guardar el usuario.', true);
        }
      });
    }

    bodyEl.querySelectorAll('[data-gu-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-gu-edit');
        var found = all.find(function (x) { return x.id === id; });
        if (!found) return;
        STATE_SA.usersEditingItem = found;
        STATE_SA.usersFormOpen = true;
        renderBody();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    bodyEl.querySelectorAll('[data-gu-status]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-gu-status');
        var nextStatus = btn.getAttribute('data-next-status') || 'active';
        var found = all.find(function (x) { return x.id === id; });
        if (!found) return;
        var res = await apiSuperAdmin('POST', {
          action: 'toggle_global_user_status',
          id: found.id,
          tenantSlug: found.tenantSlug || '',
          username: found.username,
          status: nextStatus
        });
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'No se pudo cambiar el estado.', true);
        }
      });
    });

    bodyEl.querySelectorAll('[data-gu-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-gu-del');
        var found = all.find(function (x) { return x.id === id; });
        if (!found) return;
        if (!window.confirm('¿Confirmás dar de baja al usuario "' + found.username + '" del proyecto "' + found.project + '"?')) return;
        var res = await apiSuperAdmin('POST', {
          action: 'delete_global_user',
          id: found.id,
          tenantSlug: found.tenantSlug || '',
          username: found.username
        });
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'No se pudo eliminar el usuario.', true);
        }
      });
    });

    var batchSusp = bodyEl.querySelector('#ms-gu-batch-suspend');
    if (batchSusp) {
      batchSusp.addEventListener('click', async function () {
        var proj = batchSusp.getAttribute('data-proj') || '';
        var slug = batchSusp.getAttribute('data-slug') || '';
        if (!window.confirm('¿Suspender transitoriamente por falta de pago a todos los usuarios de "' + proj + '"?')) return;
        var res = await apiSuperAdmin('POST', {
          action: 'toggle_project_nonpayment',
          project: proj,
          tenantSlug: slug,
          suspend: true
        });
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'No se pudo suspender el proyecto.', true);
        }
      });
    }

    var batchAct = bodyEl.querySelector('#ms-gu-batch-activate');
    if (batchAct) {
      batchAct.addEventListener('click', async function () {
        var proj = batchAct.getAttribute('data-proj') || '';
        var slug = batchAct.getAttribute('data-slug') || '';
        var res = await apiSuperAdmin('POST', {
          action: 'toggle_project_nonpayment',
          project: proj,
          tenantSlug: slug,
          suspend: false
        });
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'No se pudo rehabilitar el proyecto.', true);
        }
      });
    }
  }

  // =========================================================================
  // RENDERIZADO Y EVENTOS INTERACTIVOS
  // =========================================================================
  function captureDraftFormFromDom(bodyEl) {
    var form = bodyEl ? bodyEl.querySelector('#ms-sa-unified-form') : null;
    if (!form) return;
    var fd = new FormData(form);
    var fields = [
      'slug',
      'fantasyName',
      'businessName',
      'cuit',
      'contactName',
      'payerEmail',
      'whatsappDigits',
      'localidad',
      'customDomain',
      'primaryHex',
      'accentHex',
      'logo1x1Url',
      'logoHorizontalUrl',
      'notas',
      'demoUsername',
      'demoPassword',
      'adminUsername',
      'adminPassword',
      'adminName'
    ];
    fields.forEach(function (f) {
      if (fd.has(f)) {
        STATE_SA.draftForm[f] = String(fd.get(f) || '');
      }
    });
    if (fd.has('validDays')) {
      STATE_SA.draftForm.validDays = Math.max(1, Number(fd.get('validDays') || 15));
    }
    if (fd.has('trialHours')) {
      STATE_SA.draftForm.trialHours = Math.max(1, Number(fd.get('trialHours') || 72));
    }
  }

  function buildQuotePayloadFromState(targetStatus, histAction) {
    var qCalc = computeTreeQuote();
    var df = STATE_SA.draftForm;
    var fantasy = String(df.fantasyName || '').trim() || 'Cliente en Cotización';
    var slugClean = sanitizeSlugLocal(df.slug || fantasy) || 'comercio';
    var modDiscOnly = {};
    (STATE_SA.data.commercialModules || []).forEach(function (m) {
      var v = Number(STATE_SA.quoteDiscountsByMod[m.key] || 0);
      if (v > 0) modDiscOnly[m.key] = v;
    });
    var subSnap = {};
    Object.keys(STATE_SA.submodulePrices).forEach(function (sk) {
      subSnap[sk] = Number(STATE_SA.submodulePrices[sk] || 0);
    });

    return {
      id: STATE_SA.editingQuoteId || '',
      estado: targetStatus || STATE_SA.editingQuoteEstado || 'ENVIADO',
      histAction: histAction || undefined,
      slug: slugClean,
      fantasyName: fantasy,
      businessName: String(df.businessName || fantasy).trim(),
      cuit: String(df.cuit || '').trim(),
      contactName: String(df.contactName || '').trim(),
      payerEmail: String(df.payerEmail || '').trim(),
      whatsappDigits: String(df.whatsappDigits || '').trim(),
      localidad: String(df.localidad || 'RÍO CUARTO').trim(),
      optionType: STATE_SA.newOptionType,
      customDomain: String(df.customDomain || '').trim(),
      actividadNegocio: STATE_SA.newActividadNegocio || 'comercial',
      primaryHex: df.primaryHex || '#112D3A',
      accentHex: df.accentHex || '#56D7A1',
      logo1x1Url: STATE_SA.newLogo1x1Data || df.logo1x1Url || '',
      logoHorizontalUrl: STATE_SA.newLogoHorizData || df.logoHorizontalUrl || '',
      selectedModuleKeys: qCalc.selectedModuleKeys,
      selectedSubmoduleKeys: qCalc.selectedSubmoduleKeys,
      optionBasePrice: qCalc.optionRaw,
      optionDiscountPct: qCalc.optionDiscPct,
      moduleDiscountsPct: modDiscOnly,
      submodulePricesSnapshot: subSnap,
      globalDiscountType: STATE_SA.quoteGlobalType || 'none',
      globalDiscountPct: Number(STATE_SA.quoteGlobalPct || 0),
      globalDiscountFixed: Number(STATE_SA.quoteGlobalFixed || 0),
      temporaryMonths: Number(STATE_SA.quoteTempMonths || 3),
      validDays: Number(df.validDays || 15),
      trialHours: Math.max(1, Math.round(Number(df.trialHours || 72))),
      demoUsername:
        String(df.demoUsername || '').trim() ||
        'demo_' + slugClean.slice(0, 12),
      demoPassword: String(df.demoPassword || 'Demo2026').trim() || 'Demo2026',
      adminUsername: String(df.adminUsername || '').trim(),
      adminPassword: String(df.adminPassword || '').trim(),
      adminName: String(df.adminName || '').trim(),
      notas: String(df.notas || '').trim(),
      linkedTenantSlug: df.linkedTenantSlug || null
    };
  }

  function bindSharedTrialActionButtons(bodyEl) {
    bodyEl.querySelectorAll('[data-extend-trial]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var slug = btn.getAttribute('data-extend-trial');
        var rawHs = window.prompt(
          '¿Cuántas horas adicionales querés extender el período de prueba para "' + slug + '"?',
          '72'
        );
        if (rawHs === null) return;
        var hs = Math.round(Number(rawHs));
        if (!hs || hs < 1) {
          showFeedback('Ingresá una cantidad de horas válida (ej: 24, 48, 72).', true);
          return;
        }
        btn.disabled = true;
        var res = await apiSuperAdmin('POST', {
          action: 'extend_tenant_trial',
          slug: slug,
          addHours: hs
        });
        btn.disabled = false;
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'No se pudo extender la prueba.', true);
        }
      });
    });

    bodyEl.querySelectorAll('[data-confirm-trial-plan]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var slug = btn.getAttribute('data-confirm-trial-plan');
        if (
          !window.confirm(
            '¿Confirmar la habilitación del Plan Definitivo para "' +
              slug +
              '"? Se conservarán todos sus datos y usuarios y se generará el enlace de suscripción en Mercado Pago.'
          )
        ) {
          return;
        }
        btn.disabled = true;
        var res = await apiSuperAdmin('POST', {
          action: 'confirm_tenant_plan',
          slug: slug
        });
        btn.disabled = false;
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'No se pudo confirmar el plan.', true);
        }
      });
    });

    bodyEl.querySelectorAll('[data-cancel-trial]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var slug = btn.getAttribute('data-cancel-trial');
        if (
          !window.confirm(
            '¿Dar de baja ahora el sistema demo "' +
              slug +
              '"? Se deshabilitará el acceso de prueba.'
          )
        ) {
          return;
        }
        btn.disabled = true;
        var res = await apiSuperAdmin('POST', {
          action: 'cancel_tenant_trial',
          slug: slug
        });
        btn.disabled = false;
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'No se pudo dar de baja la demo.', true);
        }
      });
    });
  }

  function bindUnifiedNewTabEvents(bodyEl) {
    var d = STATE_SA.data || {};
    var mods = d.commercialModules || [];

    bodyEl.querySelectorAll('[data-sa-new-subtab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        captureDraftFormFromDom(bodyEl);
        STATE_SA.newSubTab = btn.getAttribute('data-sa-new-subtab') || 'config';
        renderBody();
      });
    });

    var closeBannerBtn = bodyEl.querySelector('#ms-close-demo-banner');
    if (closeBannerBtn) {
      closeBannerBtn.addEventListener('click', function () {
        STATE_SA.lastCreatedDemoBanner = null;
        renderBody();
      });
    }

    var resetBlankBtn = bodyEl.querySelector('#ms-q-reset-blank');
    if (resetBlankBtn) {
      resetBlankBtn.addEventListener('click', function () {
        resetNewConfiguratorBlank();
        renderBody();
      });
    }

    // Eventos de Seguimiento de Presupuestos
    if (STATE_SA.newSubTab === 'quotes') {
      var qSearchInp = bodyEl.querySelector('#ms-q-track-search');
      if (qSearchInp) {
        qSearchInp.addEventListener('input', function () {
          var pos = qSearchInp.selectionStart || 0;
          STATE_SA.quotesSearch = qSearchInp.value;
          renderBody();
          var nextInp = document.getElementById('ms-q-track-search');
          if (nextInp) {
            nextInp.focus();
            try { nextInp.setSelectionRange(pos, pos); } catch (_e) {}
          }
        });
      }

      var qFilterSel = bodyEl.querySelector('#ms-q-track-filter');
      if (qFilterSel) {
        qFilterSel.addEventListener('change', function () {
          STATE_SA.quotesStatusFilter = qFilterSel.value;
          renderBody();
        });
      }

      var newBlankBtn = bodyEl.querySelector('#ms-q-new-blank-btn');
      if (newBlankBtn) {
        newBlankBtn.addEventListener('click', function () {
          resetNewConfiguratorBlank();
          STATE_SA.newSubTab = 'config';
          renderBody();
        });
      }

      bodyEl.querySelectorAll('[data-quote-status-sel]').forEach(function (sel) {
        sel.addEventListener('change', async function () {
          var id = sel.getAttribute('data-quote-status-sel');
          var res = await apiSuperAdmin('POST', {
            action: 'update_quote_status',
            id: id,
            estado: sel.value
          });
          if (res && res.ok) {
            showFeedback(res.message, false);
            await reloadSuperAdminData(true);
          } else {
            showFeedback((res && res.message) || 'Error actualizando estado.', true);
          }
        });
      });

      bodyEl.querySelectorAll('[data-q-edit]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-q-edit');
          var found = (d.quotes || []).find(function (x) { return x.id === id; });
          if (!found) return;
          loadQuoteIntoConfigurator(found);
          renderBody();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });

      bodyEl.querySelectorAll('[data-q-pdf]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-q-pdf');
          var found = (d.quotes || []).find(function (x) { return x.id === id; });
          if (found) openQuotePdfWindow(found);
        });
      });

      bodyEl.querySelectorAll('[data-q-start-demo]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-q-start-demo');
          var found = (d.quotes || []).find(function (x) { return x.id === id; });
          if (!found) return;
          var askHs = window.prompt(
            'Confirmá la cantidad de horas del período de prueba para "' + found.fantasyName + '":',
            String(found.trialHours || 72)
          );
          if (askHs === null) return;
          var hs = Math.max(1, Math.round(Number(askHs) || 72));
          loadQuoteIntoConfigurator(found);
          STATE_SA.draftForm.trialHours = hs;
          await executeProvisionFromConfigurator(bodyEl, true);
        });
      });

      bodyEl.querySelectorAll('[data-q-del]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-q-del');
          var found = (d.quotes || []).find(function (x) { return x.id === id; });
          if (!found) return;
          if (!window.confirm('¿Eliminar el presupuesto ' + found.numero + ' (' + found.fantasyName + ')?')) return;
          var res = await apiSuperAdmin('POST', { action: 'delete_quote', id: id });
          if (res && res.ok) {
            if (STATE_SA.editingQuoteId === id) resetNewConfiguratorBlank();
            showFeedback(res.message, false);
            await reloadSuperAdminData(true);
          }
        });
      });

      bindSharedTrialActionButtons(bodyEl);
      return;
    }

    // Sincronizar estado visual indeterminado inicial en checkboxes de módulos padres
    function syncIndeterminateAndDomTotals() {
      var cfgObj = d.pricingConfig || (d.pricingConfig = {});
      var opt1Inp = bodyEl.querySelector('#ms-cfg-opt1');
      var opt2Inp = bodyEl.querySelector('#ms-cfg-opt2');
      if (opt1Inp) cfgObj.option_1_base = Math.max(0, Number(opt1Inp.value || 0));
      if (opt2Inp) cfgObj.option_2_base = Math.max(0, Number(opt2Inp.value || 0));

      bodyEl.querySelectorAll('[data-q-opt-disc]').forEach(function (inp) {
        var n = inp.getAttribute('data-q-opt-disc');
        STATE_SA.quoteDiscountsByMod['__opt' + n] = Math.min(100, Math.max(0, Number(inp.value || 0)));
      });

      var gTypeEl = bodyEl.querySelector('#ms-q-gtype');
      if (gTypeEl) STATE_SA.quoteGlobalType = gTypeEl.value;
      var gPctEl = bodyEl.querySelector('#ms-q-gpct');
      var gFixEl = bodyEl.querySelector('#ms-q-gfixed');
      var gMonEl = bodyEl.querySelector('#ms-q-gmonths');
      if (gPctEl) {
        gPctEl.disabled = STATE_SA.quoteGlobalType === 'none';
        STATE_SA.quoteGlobalPct =
          STATE_SA.quoteGlobalType === 'none' ? 0 : Math.min(100, Math.max(0, Number(gPctEl.value || 0)));
      }
      if (gFixEl) {
        gFixEl.disabled = STATE_SA.quoteGlobalType === 'none';
        STATE_SA.quoteGlobalFixed =
          STATE_SA.quoteGlobalType === 'none' ? 0 : Math.max(0, Math.round(Number(gFixEl.value || 0)));
      }
      if (gMonEl) {
        gMonEl.disabled = STATE_SA.quoteGlobalType !== 'temporary';
        STATE_SA.quoteTempMonths = Math.max(1, Number(gMonEl.value || 3));
      }

      var quote = computeTreeQuote();

      var opt1Net = Math.round(Number(cfgObj.option_1_base || 0) * (1 - Number(STATE_SA.quoteDiscountsByMod['__opt1'] || 0) / 100));
      var opt2Net = Math.round(Number(cfgObj.option_2_base || 0) * (1 - Number(STATE_SA.quoteDiscountsByMod['__opt2'] || 0) / 100));
      var netOpt1El = bodyEl.querySelector('[data-net-opt-cell="1"]');
      var netOpt2El = bodyEl.querySelector('[data-net-opt-cell="2"]');
      if (netOpt1El) netOpt1El.textContent = STATE_SA.newOptionType === 1 ? fmtArs.format(opt1Net) : '—';
      if (netOpt2El) netOpt2El.textContent = STATE_SA.newOptionType === 2 ? fmtArs.format(opt2Net) : '—';

      var totalSubCount = 0;
      quote.moduleBreakdown.forEach(function (b, idx) {
        var mod = mods[idx];
        var subs = getModuleSubmodules(mod);
        totalSubCount += b.totalSubsCount;

        var pChk = bodyEl.querySelector('[data-tree-mod-chk="' + b.key + '"]');
        if (pChk) {
          pChk.checked = b.totalSubsCount > 0 && b.selectedSubsCount === b.totalSubsCount;
          pChk.indeterminate = b.selectedSubsCount > 0 && b.selectedSubsCount < b.totalSubsCount;
        }
        var cntSpan = bodyEl.querySelector('[data-tree-count="' + b.key + '"]');
        if (cntSpan) cntSpan.textContent = b.selectedSubsCount + '/' + b.totalSubsCount;

        var pNote = bodyEl.querySelector('[data-tree-partial-note="' + b.key + '"]');
        if (pNote) {
          if (b.selectedSubsCount > 0 && b.selectedSubsCount < b.totalSubsCount) {
            pNote.style.color = '#0f766e';
            pNote.style.fontWeight = '700';
            pNote.textContent = '(Parcial: suma ' + b.selectedSubsCount + ' submód.)';
          } else {
            pNote.style.color = '#64748b';
            pNote.style.fontWeight = '400';
            pNote.textContent = '(Σ ' + b.totalSubsCount + ' submód.)';
          }
        }

        var modPriceInp = bodyEl.querySelector('[data-cfg-mod-price="' + b.key + '"]');
        if (modPriceInp && document.activeElement !== modPriceInp) {
          modPriceInp.value = String(b.selectedSubsCount > 0 ? b.selectedBaseSum : b.catalogSum);
        }

        var netModCell = bodyEl.querySelector('[data-net-mod-cell="' + b.key + '"]');
        if (netModCell) {
          netModCell.textContent =
            b.selectedSubsCount > 0
              ? b.netSelected > 0
                ? fmtArs.format(b.netSelected)
                : 'Sin cargo'
              : '—';
        }

        var parentRow = bodyEl.querySelector('[data-mod-parent-row="' + b.key + '"]');
        if (parentRow) {
          parentRow.style.background = b.selectedSubsCount > 0 ? 'rgba(86,215,161,0.05)' : 'transparent';
        }

        subs.forEach(function (s) {
          var sChecked = Boolean(STATE_SA.selectedSubmodules[s.key]);
          var sPrice = Math.max(0, Math.round(Number(STATE_SA.submodulePrices[s.key] || 0)));
          var sNet = Math.round(sPrice * (1 - b.discountPct / 100));
          var sNetCell = bodyEl.querySelector('[data-net-sub-cell="' + s.key + '"]');
          if (sNetCell) {
            sNetCell.textContent = sChecked ? (sNet > 0 ? fmtArs.format(sNet) : 'Sin cargo') : '—';
          }
        });
      });

      var selAllChk = bodyEl.querySelector('#ms-q-select-all-mods');
      if (selAllChk) {
        selAllChk.checked = totalSubCount > 0 && quote.selectedSubCount === totalSubCount;
        selAllChk.indeterminate = quote.selectedSubCount > 0 && quote.selectedSubCount < totalSubCount;
      }

      var optLbl = bodyEl.querySelector('#ms-sa-selected-opt-label');
      if (optLbl) optLbl.textContent = 'Opción ' + STATE_SA.newOptionType;
      var modCntEl = bodyEl.querySelector('#ms-sa-selected-mods-count');
      if (modCntEl) modCntEl.textContent = String(quote.selectedModCount);
      var subCntEl = bodyEl.querySelector('#ms-sa-selected-subs-count');
      if (subCntEl) subCntEl.textContent = String(quote.selectedSubCount);
      var subTotEl = bodyEl.querySelector('#ms-sa-selected-mods-subtotal');
      if (subTotEl) subTotEl.textContent = fmtArs.format(quote.subtotal);

      var promoEl = bodyEl.querySelector('#ms-q-sim-promo');
      if (promoEl) promoEl.textContent = fmtArs.format(quote.promoMonthly);
      var brkEl = bodyEl.querySelector('#ms-q-sim-breakdown');
      if (brkEl) {
        var ahorro = Math.max(0, quote.subtotal - quote.promoMonthly);
        brkEl.textContent =
          'Base Opción ' +
          STATE_SA.newOptionType +
          ': ' +
          fmtArs.format(quote.optionBase) +
          ' + Módulos/Submódulos: ' +
          fmtArs.format(quote.modTotal) +
          ' = Subtotal: ' +
          fmtArs.format(quote.subtotal) +
          (ahorro > 0 ? ' · Bonificación: -' + fmtArs.format(ahorro) : '');
      }
      var tmpNote = bodyEl.querySelector('#ms-q-sim-temp-note');
      if (tmpNote) {
        if (quote.months > 0) {
          tmpNote.style.display = '';
          tmpNote.textContent =
            '⏱ Promoción por ' + quote.months + ' meses · Luego: ' + fmtArs.format(quote.regularMonthly) + '/mes';
        } else {
          tmpNote.style.display = 'none';
        }
      }
    }

    syncIndeterminateAndDomTotals();

    // Expandir / contraer árbol
    bodyEl.querySelectorAll('[data-tree-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        var mKey = el.getAttribute('data-tree-toggle');
        var next = !STATE_SA.expandedModules[mKey];
        STATE_SA.expandedModules[mKey] = next;
        var arrow = bodyEl.querySelector('[data-tree-arrow="' + mKey + '"]');
        if (arrow) arrow.textContent = next ? '▼' : '▶';
        bodyEl.querySelectorAll('[data-sub-row-of="' + mKey + '"]').forEach(function (row) {
          row.style.display = next ? '' : 'none';
        });
      });
    });

    var expAllBtn = bodyEl.querySelector('#ms-tree-expand-all');
    if (expAllBtn) {
      expAllBtn.addEventListener('click', function () {
        mods.forEach(function (m) {
          STATE_SA.expandedModules[m.key] = true;
          var arrow = bodyEl.querySelector('[data-tree-arrow="' + m.key + '"]');
          if (arrow) arrow.textContent = '▼';
          bodyEl.querySelectorAll('[data-sub-row-of="' + m.key + '"]').forEach(function (r) {
            r.style.display = '';
          });
        });
      });
    }

    var colAllBtn = bodyEl.querySelector('#ms-tree-collapse-all');
    if (colAllBtn) {
      colAllBtn.addEventListener('click', function () {
        mods.forEach(function (m) {
          STATE_SA.expandedModules[m.key] = false;
          var arrow = bodyEl.querySelector('[data-tree-arrow="' + m.key + '"]');
          if (arrow) arrow.textContent = '▶';
          bodyEl.querySelectorAll('[data-sub-row-of="' + m.key + '"]').forEach(function (r) {
            r.style.display = 'none';
          });
        });
      });
    }

    // Checkbox padre de módulo -> marca o desmarca todos sus submódulos
    bodyEl.querySelectorAll('[data-tree-mod-chk]').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var mKey = chk.getAttribute('data-tree-mod-chk');
        var mod = mods.find(function (x) { return x.key === mKey; });
        if (!mod) return;
        var nextVal = Boolean(chk.checked);
        getModuleSubmodules(mod).forEach(function (s) {
          STATE_SA.selectedSubmodules[s.key] = nextVal;
          var sChk = bodyEl.querySelector('[data-tree-sub-chk="' + s.key + '"]');
          if (sChk) sChk.checked = nextVal;
        });
        syncIndeterminateAndDomTotals();
      });
    });

    // Checkbox hijo de submódulo
    bodyEl.querySelectorAll('[data-tree-sub-chk]').forEach(function (sChk) {
      sChk.addEventListener('change', function () {
        var sKey = sChk.getAttribute('data-tree-sub-chk');
        STATE_SA.selectedSubmodules[sKey] = Boolean(sChk.checked);
        syncIndeterminateAndDomTotals();
      });
    });

    bodyEl.querySelectorAll('[data-sub-lbl]').forEach(function (lbl) {
      lbl.addEventListener('click', function () {
        var sKey = lbl.getAttribute('data-sub-lbl');
        var sChk = bodyEl.querySelector('[data-tree-sub-chk="' + sKey + '"]');
        if (sChk) {
          sChk.checked = !sChk.checked;
          STATE_SA.selectedSubmodules[sKey] = Boolean(sChk.checked);
          syncIndeterminateAndDomTotals();
        }
      });
    });

    // Tildar todos
    var selAllModsChk = bodyEl.querySelector('#ms-q-select-all-mods');
    if (selAllModsChk) {
      selAllModsChk.addEventListener('change', function () {
        var nextVal = Boolean(selAllModsChk.checked);
        mods.forEach(function (m) {
          getModuleSubmodules(m).forEach(function (s) {
            STATE_SA.selectedSubmodules[s.key] = nextVal;
            var sChk = bodyEl.querySelector('[data-tree-sub-chk="' + s.key + '"]');
            if (sChk) sChk.checked = nextVal;
          });
        });
        syncIndeterminateAndDomTotals();
      });
    }

    // Edición de precio de submódulo -> suma automática en su módulo padre
    bodyEl.querySelectorAll('[data-cfg-sub-price]').forEach(function (inp) {
      var handler = function () {
        var sKey = inp.getAttribute('data-cfg-sub-price');
        STATE_SA.submodulePrices[sKey] = Math.max(0, Math.round(Number(inp.value || 0)));
        syncIndeterminateAndDomTotals();
      };
      inp.addEventListener('input', handler);
      inp.addEventListener('change', handler);
    });

    // Edición de precio del módulo padre -> reparte proporcionalmente entre sus submódulos
    bodyEl.querySelectorAll('[data-cfg-mod-price]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var mKey = inp.getAttribute('data-cfg-mod-price');
        var mod = mods.find(function (x) { return x.key === mKey; });
        if (!mod) return;
        var targetTotal = Math.max(0, Math.round(Number(inp.value || 0)));
        var subs = getModuleSubmodules(mod);
        var activeSubs = subs.filter(function (s) { return Boolean(STATE_SA.selectedSubmodules[s.key]); });
        var listToAdjust = activeSubs.length > 0 ? activeSubs : subs;
        var currentSum = listToAdjust.reduce(function (a, s) {
          return a + Math.max(0, Math.round(Number(STATE_SA.submodulePrices[s.key] || 0)));
        }, 0);
        var running = 0;
        listToAdjust.forEach(function (s, idx) {
          var v;
          if (idx === listToAdjust.length - 1) {
            v = Math.max(0, targetTotal - running);
          } else if (currentSum > 0) {
            v = Math.round((targetTotal * Number(STATE_SA.submodulePrices[s.key] || 0)) / currentSum);
            running += v;
          } else {
            v = Math.round(targetTotal / listToAdjust.length);
            running += v;
          }
          STATE_SA.submodulePrices[s.key] = v;
          var sInp = bodyEl.querySelector('[data-cfg-sub-price="' + s.key + '"]');
          if (sInp) sInp.value = String(v);
        });
        syncIndeterminateAndDomTotals();
      });
    });

    bodyEl.querySelectorAll('[data-q-mod-disc]').forEach(function (inp) {
      var h = function () {
        var mKey = inp.getAttribute('data-q-mod-disc');
        STATE_SA.quoteDiscountsByMod[mKey] = Math.min(100, Math.max(0, Number(inp.value || 0)));
        syncIndeterminateAndDomTotals();
      };
      inp.addEventListener('input', h);
      inp.addEventListener('change', h);
    });

    ['#ms-cfg-opt1', '#ms-cfg-opt2', '#ms-q-gtype', '#ms-q-gpct', '#ms-q-gfixed', '#ms-q-gmonths'].forEach(function (sel) {
      var el = bodyEl.querySelector(sel);
      if (el) {
        el.addEventListener('input', syncIndeterminateAndDomTotals);
        el.addEventListener('change', syncIndeterminateAndDomTotals);
      }
    });

    bodyEl.querySelectorAll('[data-q-opt-disc]').forEach(function (el) {
      el.addEventListener('input', syncIndeterminateAndDomTotals);
      el.addEventListener('change', syncIndeterminateAndDomTotals);
    });

    bodyEl.querySelectorAll('[data-q-opt-chk]').forEach(function (rad) {
      rad.addEventListener('change', function () {
        if (!rad.checked) return;
        captureDraftFormFromDom(bodyEl);
        STATE_SA.newOptionType = Number(rad.getAttribute('data-q-opt-chk')) === 2 ? 2 : 1;
        renderBody();
      });
    });

    bodyEl.querySelectorAll('[data-pick-opt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        captureDraftFormFromDom(bodyEl);
        STATE_SA.newOptionType = Number(btn.getAttribute('data-pick-opt')) === 2 ? 2 : 1;
        renderBody();
      });
    });

    bodyEl.querySelectorAll('[data-pick-actividad]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        captureDraftFormFromDom(bodyEl);
        var act = btn.getAttribute('data-pick-actividad') || 'comercial';
        STATE_SA.newActividadNegocio = act;
        applyActivityPresetSubmodules(act);
        renderBody();
      });
    });

    // Guardar Lista Oficial de Valores Mensuales (con precios por submódulo)
    var savePricingBtn = bodyEl.querySelector('#ms-save-pricing-btn');
    if (savePricingBtn) {
      savePricingBtn.addEventListener('click', async function () {
        var opt1 = Number((bodyEl.querySelector('#ms-cfg-opt1') || {}).value || 0);
        var opt2 = Number((bodyEl.querySelector('#ms-cfg-opt2') || {}).value || 0);
        var modulePrices = {};
        mods.forEach(function (m) {
          var subMap = {};
          var sum = 0;
          getModuleSubmodules(m).forEach(function (s) {
            var sp = Math.max(0, Math.round(Number(STATE_SA.submodulePrices[s.key] || 0)));
            subMap[s.key] = sp;
            sum += sp;
          });
          modulePrices[m.key] = {
            price: sum,
            defaultDiscountPct: Number(STATE_SA.quoteDiscountsByMod[m.key] || 0),
            submodulePrices: subMap
          };
        });
        savePricingBtn.disabled = true;
        var res = await apiSuperAdmin('POST', {
          action: 'save_pricing_config',
          pricingConfig: {
            option_1_base: opt1,
            option_2_base: opt2,
            module_prices: modulePrices
          }
        });
        savePricingBtn.disabled = false;
        if (res && res.ok) {
          showFeedback(res.message || 'Lista oficial de valores mensuales por módulo y submódulo guardada.', false);
          captureDraftFormFromDom(bodyEl);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'Error guardando precios.', true);
        }
      });
    }

    // Autocompletar slug y usuario demo al escribir el Nombre Comercial
    var fantasyInp = bodyEl.querySelector('#ms-inp-fantasy');
    var slugInp = bodyEl.querySelector('#ms-inp-slug');
    var demoUserInp = bodyEl.querySelector('#ms-inp-demo-user');
    if (fantasyInp) {
      fantasyInp.addEventListener('input', function () {
        var autoS = sanitizeSlugLocal(fantasyInp.value);
        if (slugInp && (!STATE_SA.draftForm.slug || slugInp.dataset.autoFilled === '1')) {
          slugInp.value = autoS;
          slugInp.dataset.autoFilled = '1';
        }
        if (demoUserInp && (!STATE_SA.draftForm.demoUsername || demoUserInp.dataset.autoFilled === '1')) {
          demoUserInp.value = autoS ? 'demo_' + autoS.slice(0, 12) : 'demo';
          demoUserInp.dataset.autoFilled = '1';
        }
      });
    }
    if (slugInp) {
      slugInp.addEventListener('input', function () {
        slugInp.dataset.autoFilled = '0';
      });
    }
    if (demoUserInp) {
      demoUserInp.addEventListener('input', function () {
        demoUserInp.dataset.autoFilled = '0';
      });
    }

    // Selector de horas de prueba (botones rápidos + input libre)
    var trialHsInp = bodyEl.querySelector('#ms-inp-trial-hs');
    function updateTrialPreviewDom(hsVal) {
      var hs = Math.max(1, Math.min(2160, Math.round(Number(hsVal || 72))));
      STATE_SA.draftForm.trialHours = hs;
      if (trialHsInp && Number(trialHsInp.value) !== hs) trialHsInp.value = String(hs);
      var lblBtn = bodyEl.querySelector('#ms-btn-trial-hs-lbl');
      if (lblBtn) lblBtn.textContent = String(hs);
      var prevBox = bodyEl.querySelector('#ms-trial-preview-dates');
      if (prevBox) {
        var endIso = new Date(Date.now() + hs * 3600000).toISOString();
        var bajaIso = new Date(Date.now() + (hs + 240) * 3600000).toISOString();
        prevBox.innerHTML =
          '• Vencimiento prueba: <strong>' + esc(formatDateTimeAr(endIso)) + '</strong><br>' +
          '• Si no contrata el Plan: <strong>baja automática el ' + esc(formatDateAr(bajaIso)) + '</strong> (10 días después).';
      }
      bodyEl.querySelectorAll('[data-pick-trial-hs]').forEach(function (b) {
        var bHs = Number(b.getAttribute('data-pick-trial-hs'));
        var act = bHs === hs;
        b.style.background = act ? '#112D3A' : '#fff';
        b.style.color = act ? '#56D7A1' : '#92400e';
        b.style.borderColor = act ? '#112D3A' : '#d97706';
      });
    }

    bodyEl.querySelectorAll('[data-pick-trial-hs]').forEach(function (b) {
      b.addEventListener('click', function () {
        updateTrialPreviewDom(Number(b.getAttribute('data-pick-trial-hs') || 72));
      });
    });
    if (trialHsInp) {
      trialHsInp.addEventListener('input', function () {
        updateTrialPreviewDom(Number(trialHsInp.value || 72));
      });
    }

    var genDemoPassBtn = bodyEl.querySelector('#ms-gen-demo-pass');
    if (genDemoPassBtn) {
      genDemoPassBtn.addEventListener('click', function () {
        var pInp = bodyEl.querySelector('#ms-inp-demo-pass');
        if (pInp) {
          pInp.value = generateRandomPass();
          STATE_SA.draftForm.demoPassword = pInp.value;
        }
      });
    }

    var file1x1 = bodyEl.querySelector('#ms-sa-file-logo1x1');
    if (file1x1) {
      file1x1.addEventListener('change', async function () {
        if (file1x1.files && file1x1.files[0]) {
          STATE_SA.newLogo1x1Data = await fileToDataUrl(file1x1.files[0]);
          showFeedback('Logo 1x1 cargado listo para aplicar.', false);
        }
      });
    }
    var fileHoriz = bodyEl.querySelector('#ms-sa-file-logohoriz');
    if (fileHoriz) {
      fileHoriz.addEventListener('change', async function () {
        if (fileHoriz.files && fileHoriz.files[0]) {
          STATE_SA.newLogoHorizData = await fileToDataUrl(fileHoriz.files[0]);
          showFeedback('Logo Horizontal cargado listo para aplicar.', false);
        }
      });
    }

    // 1A. Guardar y Generar Presupuesto en PDF
    var btnQuotePdf = bodyEl.querySelector('#ms-btn-quote-pdf');
    if (btnQuotePdf) {
      btnQuotePdf.addEventListener('click', async function () {
        captureDraftFormFromDom(bodyEl);
        if (!String(STATE_SA.draftForm.fantasyName || '').trim()) {
          showFeedback('Ingresá al menos el Nombre Comercial del cliente para emitir el Presupuesto en PDF.', true);
          var fEl = bodyEl.querySelector('#ms-inp-fantasy');
          if (fEl) fEl.focus();
          return;
        }
        var qPayload = buildQuotePayloadFromState(
          STATE_SA.editingQuoteId && STATE_SA.editingQuoteEstado !== 'BORRADOR'
            ? STATE_SA.editingQuoteEstado
            : 'ENVIADO',
          'EMISIÓN DE PRESUPUESTO PDF'
        );
        btnQuotePdf.disabled = true;
        var res = await apiSuperAdmin('POST', { action: 'save_quote', quote: qPayload });
        btnQuotePdf.disabled = false;
        if (res && res.ok && res.quote) {
          STATE_SA.editingQuoteId = res.quote.id;
          STATE_SA.editingQuoteNumero = res.quote.numero;
          STATE_SA.editingQuoteEstado = res.quote.estado;
          showFeedback('📄 Presupuesto ' + res.quote.numero + ' guardado y abierto en PDF.', false);
          openQuotePdfWindow(res.quote);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'No se pudo guardar el presupuesto.', true);
        }
      });
    }

    // 1B. Guardar Presupuesto en Seguimiento (sin abrir PDF)
    var btnQuoteSave = bodyEl.querySelector('#ms-btn-quote-save');
    if (btnQuoteSave) {
      btnQuoteSave.addEventListener('click', async function () {
        captureDraftFormFromDom(bodyEl);
        if (!String(STATE_SA.draftForm.fantasyName || '').trim()) {
          showFeedback('Ingresá el Nombre Comercial del cliente para guardar el presupuesto.', true);
          return;
        }
        var qPayload = buildQuotePayloadFromState(
          STATE_SA.editingQuoteId ? STATE_SA.editingQuoteEstado : 'BORRADOR'
        );
        btnQuoteSave.disabled = true;
        var res = await apiSuperAdmin('POST', { action: 'save_quote', quote: qPayload });
        btnQuoteSave.disabled = false;
        if (res && res.ok && res.quote) {
          STATE_SA.editingQuoteId = res.quote.id;
          STATE_SA.editingQuoteNumero = res.quote.numero;
          STATE_SA.editingQuoteEstado = res.quote.estado;
          showFeedback('💾 ' + res.message, false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'Error guardando presupuesto.', true);
        }
      });
    }

    // 2. Habilitar Período de Prueba (Demo con BD Limpia por X horas)
    var btnStartTrial = bodyEl.querySelector('#ms-btn-start-trial');
    if (btnStartTrial) {
      btnStartTrial.addEventListener('click', async function () {
        captureDraftFormFromDom(bodyEl);
        await executeProvisionFromConfigurator(bodyEl, true);
      });
    }

    // 3. Confirmar y Habilitar Plan Definitivo
    var unifiedForm = bodyEl.querySelector('#ms-sa-unified-form');
    if (unifiedForm) {
      unifiedForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        captureDraftFormFromDom(bodyEl);
        // Si el presupuesto ya tenía un tenant demo vinculado, confirmarlo directamente sin duplicar BD
        if (STATE_SA.draftForm.linkedTenantSlug) {
          var slugExisting = STATE_SA.draftForm.linkedTenantSlug;
          var resConf = await apiSuperAdmin('POST', {
            action: 'confirm_tenant_plan',
            slug: slugExisting,
            payerEmail: STATE_SA.draftForm.payerEmail || ''
          });
          if (resConf && resConf.ok) {
            resetNewConfiguratorBlank();
            STATE_SA.activeView = 'tenants';
            showFeedback(resConf.message, false);
            await reloadSuperAdminData(true);
            return;
          }
        }
        await executeProvisionFromConfigurator(bodyEl, false);
      });
    }
  }

  async function executeProvisionFromConfigurator(bodyEl, isTrialMode) {
    var qCalc = computeTreeQuote();
    var df = STATE_SA.draftForm;
    var fantasy = String(df.fantasyName || '').trim();
    if (!fantasy) {
      showFeedback('Ingresá el Nombre Comercial / Fantasía del cliente.', true);
      return;
    }
    if (qCalc.selectedSubmoduleKeys.length === 0) {
      showFeedback('Seleccioná al menos un módulo o submódulo en el árbol.', true);
      return;
    }
    var slugClean = sanitizeSlugLocal(df.slug || fantasy);
    if (!slugClean || slugClean.length < 2) {
      showFeedback('Ingresá un identificador corto (slug) válido (ej: superelsol).', true);
      return;
    }
    if (STATE_SA.newOptionType === 1 && !String(df.customDomain || '').trim()) {
      showFeedback('Para la Opción 1 (Dominio y Marca Propia) indicá el dominio del cliente (o elegí Opción 2 Subruta MiniSistema para la prueba).', true);
      return;
    }

    // Primero guardar/actualizar el Presupuesto en Seguimiento para trazabilidad completa
    var qPayload = buildQuotePayloadFromState(
      isTrialMode ? 'EN_PRUEBA' : 'CONFIRMADO',
      isTrialMode ? 'ALTA DE PERÍODO DE PRUEBA' : 'ALTA DE PLAN DEFINITIVO'
    );
    var savedQuoteRes = await apiSuperAdmin('POST', { action: 'save_quote', quote: qPayload });
    var quoteId =
      savedQuoteRes && savedQuoteRes.ok && savedQuoteRes.quote
        ? savedQuoteRes.quote.id
        : STATE_SA.editingQuoteId || '';

    var modOverrides = [];
    (STATE_SA.data.commercialModules || []).forEach(function (m) {
      var chosen = getModuleSubmodules(m)
        .filter(function (s) {
          return Boolean(STATE_SA.selectedSubmodules[s.key]);
        })
        .map(function (s) {
          return s.key;
        });
      if (!chosen.length) return;
      var sumSub = chosen.reduce(function (a, sk) {
        return a + Math.max(0, Math.round(Number(STATE_SA.submodulePrices[sk] || 0)));
      }, 0);
      modOverrides.push({
        moduleKey: m.key,
        selectedSubmodules: chosen,
        customPrice: sumSub,
        discountPct: Number(STATE_SA.quoteDiscountsByMod[m.key] || 0)
      });
    });

    var adminUser = String(df.adminUsername || '').trim();
    var adminPass = String(df.adminPassword || '').trim();
    var demoUser =
      String(df.demoUsername || '').trim() || 'demo_' + slugClean.slice(0, 12);
    var demoPass = String(df.demoPassword || 'Demo2026').trim() || 'Demo2026';
    var trialHours = Math.max(1, Math.round(Number(df.trialHours || 72)));

    var btnTarget = bodyEl
      ? bodyEl.querySelector(isTrialMode ? '#ms-btn-start-trial' : '#ms-btn-confirm-direct-plan')
      : null;
    if (btnTarget) {
      btnTarget.disabled = true;
      btnTarget.textContent = 'Aprovisionando base de datos limpia en Supabase...';
    }

    var provRes = await apiSuperAdmin('POST', {
      action: 'provision_tenant',
      quoteId: quoteId,
      trialMode: isTrialMode,
      trialHours: trialHours,
      demoUsername: demoUser,
      demoPassword: demoPass,
      optionType: STATE_SA.newOptionType,
      actividadNegocio: STATE_SA.newActividadNegocio || 'comercial',
      slug: slugClean,
      fantasyName: fantasy,
      businessName: String(df.businessName || fantasy).trim(),
      customDomain: String(df.customDomain || '').trim(),
      payerEmail: String(df.payerEmail || '').trim(),
      commercialModuleKeys: qCalc.selectedModuleKeys,
      selectedSubmoduleKeys: qCalc.selectedSubmoduleKeys,
      moduleOverrides: modOverrides,
      customOptionBasePrice: qCalc.optionRaw,
      optionDiscountPct: qCalc.optionDiscPct,
      globalDiscountType: STATE_SA.quoteGlobalType || 'none',
      globalDiscountPct: Number(STATE_SA.quoteGlobalPct || 0),
      globalDiscountFixed: Number(STATE_SA.quoteGlobalFixed || 0),
      temporaryMonths: Number(STATE_SA.quoteTempMonths || 3),
      branding: {
        primaryHex: df.primaryHex || '#112D3A',
        accentHex: df.accentHex || '#56D7A1',
        logo1x1Url: STATE_SA.newLogo1x1Data || df.logo1x1Url || '',
        logoHorizontalUrl: STATE_SA.newLogoHorizData || df.logoHorizontalUrl || '',
        localidad: df.localidad || 'RÍO CUARTO',
        whatsappDigits: df.whatsappDigits || '5493585095475',
        emailInfo: df.payerEmail || '',
        cuitFmt: df.cuit || 'A CONFIGURAR'
      },
      initialAdmin:
        adminUser && adminPass.length >= 4
          ? {
              username: adminUser,
              password: adminPass,
              name: String(df.adminName || df.contactName || adminUser)
            }
          : null
    });

    if (btnTarget) btnTarget.disabled = false;

    if (provRes && provRes.ok && provRes.tenant) {
      var createdT = provRes.tenant;
      var trInfo = (createdT.deployment && createdT.deployment.trial) || null;
      resetNewConfiguratorBlank();
      if (isTrialMode && trInfo) {
        STATE_SA.lastCreatedDemoBanner = {
          fantasyName: createdT.fantasy_name,
          slug: createdT.slug,
          url: (createdT.deployment && createdT.deployment.publicErpUrl) || '/' + createdT.slug,
          demoUsername: trInfo.demoUsername,
          demoPassword: trInfo.demoPassword,
          trialHours: trInfo.trialHours,
          endsAt: trInfo.endsAt,
          autoCancelAt: trInfo.autoCancelAt,
          whatsappDigits: (createdT.branding && createdT.branding.whatsappDigits) || ''
        };
        STATE_SA.newSubTab = 'quotes';
        showFeedback(provRes.message, false);
        await reloadSuperAdminData(true);
      } else {
        STATE_SA.activeView = 'tenants';
        showFeedback(provRes.message, false);
        await reloadSuperAdminData(true);
      }
    } else {
      showFeedback((provRes && provRes.message) || 'No se pudo habilitar el sistema.', true);
      renderBody();
    }
  }

  function renderBody() {
    var bodyEl = document.getElementById('ms-sa-body');
    if (!bodyEl || !STATE_SA.data) return;

    var bc = document.getElementById('ms-sa-detail-breadcrumb');
    if (bc) bc.textContent = getViewTitle(STATE_SA.activeView);

    if (STATE_SA.activeView === 'tenants') bodyEl.innerHTML = renderTenantsTab();
    else if (STATE_SA.activeView === 'new' || STATE_SA.activeView === 'pricing') {
      bodyEl.innerHTML = renderUnifiedNewSystemTab();
    } else if (STATE_SA.activeView === 'secrets') bodyEl.innerHTML = renderSecretsTab();
    else if (STATE_SA.activeView === 'users') bodyEl.innerHTML = renderUsersTab();

    bindBodyEvents(bodyEl);
    if (STATE_SA.activeView === 'new' || STATE_SA.activeView === 'pricing') {
      bindUnifiedNewTabEvents(bodyEl);
    } else if (STATE_SA.activeView === 'users') {
      bindUsersTabEvents(bodyEl);
    }
  }

  function bindBodyEvents(bodyEl) {
    var goNew = bodyEl.querySelector('#ms-sa-go-new');
    if (goNew) {
      goNew.addEventListener('click', function () {
        openSuperAdminView('new');
      });
    }

    if (STATE_SA.activeView === 'tenants') {
      bindSharedTrialActionButtons(bodyEl);
    }

    bodyEl.querySelectorAll('[data-manage-users]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var slug = btn.getAttribute('data-manage-users');
        var res = await apiSuperAdmin('GET', { action: 'tenant_users', slug: slug });
        if (res && res.ok) {
          STATE_SA.managingUsersSlug = slug;
          STATE_SA.managingUsersList = res.users || [];
          renderBody();
        }
      });
    });

    var backTenants = bodyEl.querySelector('#ms-sa-back-tenants');
    if (backTenants) {
      backTenants.addEventListener('click', function () {
        STATE_SA.managingUsersSlug = null;
        renderBody();
      });
    }

    var saveTUserForm = bodyEl.querySelector('#ms-sa-save-tuser-form');
    if (saveTUserForm) {
      saveTUserForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(saveTUserForm);
        var res = await apiSuperAdmin('POST', {
          action: 'save_tenant_user',
          slug: STATE_SA.managingUsersSlug,
          username: fd.get('username'),
          name: fd.get('name'),
          role: fd.get('role'),
          password: fd.get('password'),
          whatsapp: fd.get('whatsapp')
        });
        if (res && res.ok) {
          showFeedback(res.message || 'Usuario habilitado.', false);
          var listRes = await apiSuperAdmin('GET', {
            action: 'tenant_users',
            slug: STATE_SA.managingUsersSlug
          });
          STATE_SA.managingUsersList = (listRes && listRes.users) || [];
          renderBody();
        } else {
          showFeedback((res && res.message) || 'Error al guardar usuario.', true);
        }
      });
    }

    bodyEl.querySelectorAll('[data-del-tuser]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var u = btn.getAttribute('data-del-tuser');
        var res = await apiSuperAdmin('POST', {
          action: 'delete_tenant_user',
          slug: STATE_SA.managingUsersSlug,
          username: u
        });
        if (res && res.ok) {
          showFeedback(res.message, false);
          var listRes = await apiSuperAdmin('GET', {
            action: 'tenant_users',
            slug: STATE_SA.managingUsersSlug
          });
          STATE_SA.managingUsersList = (listRes && listRes.users) || [];
          renderBody();
        }
      });
    });

    bodyEl.querySelectorAll('[data-gen-mp]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var slug = btn.getAttribute('data-gen-mp');
        btn.disabled = true;
        var res = await apiSuperAdmin('POST', { action: 'generate_mp_link', slug: slug });
        btn.disabled = false;
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'Error generando link MP.', true);
        }
      });
    });

    bodyEl.querySelectorAll('[data-reprov-opt1]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var slug = btn.getAttribute('data-reprov-opt1');
        var res = await apiSuperAdmin('POST', { action: 'reprovision_option1_domain', slug: slug });
        showFeedback((res && res.message) || 'Proceso ejecutado.', !(res && res.ok));
        await reloadSuperAdminData(true);
      });
    });

    bodyEl.querySelectorAll('[data-toggle-status]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var slug = btn.getAttribute('data-toggle-status');
        var curr = btn.getAttribute('data-curr-status');
        var next = curr === 'active' ? 'suspended' : 'active';
        var res = await apiSuperAdmin('POST', {
          action: 'update_tenant',
          slug: slug,
          status: next
        });
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData(true);
        }
      });
    });

    bodyEl.querySelectorAll('[data-tenant-actividad]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        var slug = sel.getAttribute('data-tenant-actividad');
        var act = sel.value;
        sel.disabled = true;
        var res = await apiSuperAdmin('POST', {
          action: 'update_tenant',
          slug: slug,
          actividadNegocio: act
        });
        sel.disabled = false;
        if (res && res.ok) {
          showFeedback('Actividad de "' + slug + '" actualizada a ' + act.toUpperCase() + '.', false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'No se pudo actualizar la actividad.', true);
        }
      });
    });

    // Tab Credenciales AFIP + Secretos
    bodyEl.querySelectorAll('[data-open-afip-tenant]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var slug = btn.getAttribute('data-open-afip-tenant') || 'minisistema';
        STATE_SA.afipSelectedSlug = slug;
        var res = await apiSuperAdmin('GET', { action: 'tenant_afip', slug: slug });
        if (res && res.ok) {
          STATE_SA.afipTenantInfo = res;
        }
        openSuperAdminView('secrets');
      });
    });

    var afipSlugSelect = bodyEl.querySelector('#ms-sa-afip-slug');
    if (afipSlugSelect) {
      afipSlugSelect.addEventListener('change', async function () {
        var slug = afipSlugSelect.value || 'minisistema';
        STATE_SA.afipSelectedSlug = slug;
        var res = await apiSuperAdmin('GET', { action: 'tenant_afip', slug: slug });
        if (res && res.ok) {
          STATE_SA.afipTenantInfo = res;
        }
        renderBody();
      });
    }

    var openArcaModBtn = bodyEl.querySelector('#ms-sa-open-arca-module');
    if (openArcaModBtn) {
      openArcaModBtn.addEventListener('click', function () {
        var arcaNavBtn = document.querySelector('[data-open-section="sec-admin-comprobantes"]');
        if (arcaNavBtn) {
          arcaNavBtn.click();
        } else {
          var menuSec = document.getElementById('sec-menu-superadmin');
          var detailSec = document.getElementById('sec-superadmin-detail');
          if (menuSec) menuSec.hidden = true;
          if (detailSec) detailSec.hidden = true;
          var arcaSec = document.getElementById('sec-admin-comprobantes');
          if (arcaSec) arcaSec.hidden = false;
        }
      });
    }

    var afipCertFile = bodyEl.querySelector('#ms-sa-afip-cert-file');
    if (afipCertFile) {
      afipCertFile.addEventListener('change', function () {
        if (afipCertFile.files && afipCertFile.files[0]) {
          var r = new FileReader();
          r.onload = function () {
            var txtEl = bodyEl.querySelector('#ms-sa-afip-cert-txt');
            if (txtEl) txtEl.value = String(r.result || '').trim();
            showFeedback('Certificado Digital .CRT cargado en el campo.', false);
          };
          r.readAsText(afipCertFile.files[0]);
        }
      });
    }

    var afipKeyFile = bodyEl.querySelector('#ms-sa-afip-key-file');
    if (afipKeyFile) {
      afipKeyFile.addEventListener('change', function () {
        if (afipKeyFile.files && afipKeyFile.files[0]) {
          var r = new FileReader();
          r.onload = function () {
            var txtEl = bodyEl.querySelector('#ms-sa-afip-key-txt');
            if (txtEl) txtEl.value = String(r.result || '').trim();
            showFeedback('Clave Privada .KEY cargada en el campo.', false);
          };
          r.readAsText(afipKeyFile.files[0]);
        }
      });
    }

    var afipForm = bodyEl.querySelector('#ms-sa-afip-form');
    if (afipForm) {
      afipForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(afipForm);
        var slug = String(fd.get('slug') || 'minisistema').trim();
        var res = await apiSuperAdmin('POST', {
          action: 'save_tenant_afip_credentials',
          slug: slug,
          cuit: String(fd.get('cuit') || '').trim(),
          titular: String(fd.get('titular') || '').trim(),
          ptoVta: String(fd.get('ptoVta') || '0002').trim(),
          entorno: String(fd.get('entorno') || 'produccion').trim(),
          certPem: String(fd.get('certPem') || '').trim(),
          keyPem: String(fd.get('keyPem') || '').trim()
        });
        if (res && res.ok) {
          showFeedback(res.message, false);
          var infoRes = await apiSuperAdmin('GET', { action: 'tenant_afip', slug: slug });
          if (infoRes && infoRes.ok) {
            STATE_SA.afipTenantInfo = infoRes;
          }
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'Error al guardar credenciales AFIP / ARCA.', true);
        }
      });
    }

    var secretsForm = bodyEl.querySelector('#ms-sa-secrets-form');
    if (secretsForm) {
      secretsForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(secretsForm);
        var secrets = {};
        [
          'mp_access_token',
          'mp_public_key',
          'github_token',
          'github_owner',
          'vercel_token',
          'vercel_team_id'
        ].forEach(function (k) {
          var v = String(fd.get(k) || '').trim();
          if (v !== '' || k === 'mp_public_key' || k === 'github_owner' || k === 'vercel_team_id') {
            secrets[k] = v;
          }
        });
        var res = await apiSuperAdmin('POST', {
          action: 'save_platform_secrets',
          secrets: secrets
        });
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'No se pudieron guardar las credenciales.', true);
        }
      });
    }
  }

  function bindGlobalNavIntegration() {
    if (window.__MS_SA_NAV_BOUND__) return;
    window.__MS_SA_NAV_BOUND__ = true;

    document.addEventListener(
      'click',
      function (ev) {
        var target = ev.target;
        if (!target || typeof target.closest !== 'function') return;

        var homeBtn = target.closest(
          '#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-cv-home-card, #ms-personal-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card'
        );
        if (homeBtn) {
          var menuSec = document.getElementById('sec-menu-superadmin');
          var detailSec = document.getElementById('sec-superadmin-detail');
          var isSaActive = (menuSec && !menuSec.hidden) || (detailSec && !detailSec.hidden);

          if (homeBtn.id === 'btn-topbar-back-facturacion' && isSaActive) {
            ev.preventDefault();
            ev.stopPropagation();
            if (detailSec && !detailSec.hidden) {
              openSuperAdminView('menu');
            } else {
              closeSuperAdminSectionsToHome();
            }
            return;
          }

          if (menuSec) menuSec.hidden = true;
          if (detailSec) detailSec.hidden = true;
        }
      },
      true
    );
  }

  function syncSuperAdminEntrypointVisibility() {
    bindGlobalNavIntegration();
    var allowed = isDanielGeneralAdmin();
    var existingBtn = document.getElementById('ms-open-superadmin-btn');
    if (existingBtn) {
      existingBtn.remove();
    }

    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existingCard = document.getElementById('ms-superadmin-home-card');
    if (allowed && inicioGrid && !existingCard) {
      var card = document.createElement('article');
      card.id = 'ms-superadmin-home-card';
      card.className = 'module-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.style.border = '2px solid #56D7A1';
      card.style.background = 'linear-gradient(135deg, #112D3A 0%, #183f52 100%)';
      card.style.color = '#FFFFFF';
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true" style="background:#56D7A1;color:#112D3A;">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>' +
          '</svg>' +
        '</div>' +
        '<h3 style="margin:0;color:#FFFFFF;">Administrador General</h3>';
      card.addEventListener('click', function () {
        openSuperAdminView('menu');
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openSuperAdminView('menu');
        }
      });
      inicioGrid.insertBefore(card, inicioGrid.firstChild);
    } else if (existingCard) {
      existingCard.hidden = !allowed;
      existingCard.style.display = allowed ? '' : 'none';
    }
  }

  window.__SUPERADMIN_REFRESH_CRM_BADGE__ = function () {
    // Mantenido por compatibilidad; las tarjetas .module-card no muestran pills según regla de diseño
  };

  setInterval(syncSuperAdminEntrypointVisibility, 900);
  document.addEventListener('DOMContentLoaded', syncSuperAdminEntrypointVisibility);
})();
