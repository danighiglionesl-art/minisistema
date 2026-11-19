/* ==========================================================================
   MÓDULO EXCLUSIVO DEL ADMINISTRADOR GENERAL (@danielg) — MINISISTEMA ERP
   Integrado con el diseño nativo de Módulos y Submódulos (.erp-section / .modules-grid / .module-card):
   1. Comercios Habilitados (y gestión de Administradores / Usuarios por comercio)
   2. Habilitar Nuevo Sistema (Opción 1 / Opción 2) con selección visual por tarjetas de módulos
   3. Valor Mensual, Descuentos y Mercado Pago
   4. Credenciales API (MP · GitHub · Vercel)
   ========================================================================== */
(function () {
  'use strict';

  var STATE_SA = {
    activeView: 'menu', // 'menu' | 'tenants' | 'new' | 'pricing' | 'secrets'
    data: null,
    loading: false,
    quoteOptionType: 1,
    quoteSelected: {},
    quoteDiscountsByMod: {},
    quoteGlobalType: 'temporary',
    quoteGlobalPct: 20,
    quoteGlobalFixed: 0,
    quoteTempMonths: 3,
    newOptionType: 2,
    newLogo1x1Data: '',
    newLogoHorizData: '',
    managingUsersSlug: null,
    managingUsersList: []
  };

  var fmtArs = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  });

  var MODULE_ICONS_SVG = {
    facturacion:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="6" y1="8" x2="18" y2="8"></line><line x1="6" y1="12" x2="14" y2="12"></line><line x1="6" y1="16" x2="10" y2="16"></line></svg>',
    articulos:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
    clientes:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    proveedores:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
    fondos:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"></path><path d="M3 10h18"></path><polygon points="12 3 20 7 4 7"></polygon><line x1="6" y1="10" x2="6" y2="17"></line><line x1="10" y1="10" x2="10" y2="17"></line><line x1="14" y1="10" x2="14" y2="17"></line><line x1="18" y1="10" x2="18" y2="17"></line></svg>',
    carrito:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>',
    fidelizacion:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
    whatsapp:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>',
    estadisticas:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
    verificador:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5v14"></path><path d="M8 5v14"></path><path d="M12 5v14"></path><path d="M17 5v14"></path><path d="M21 5v14"></path></svg>',
    cv:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><circle cx="10" cy="13" r="2"></circle><path d="M14 17c0-1.5-1.8-2.5-4-2.5s-4 1-4 2.5"></path></svg>',
    manual_usuario:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>'
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

  function isDanielGeneralAdmin() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    return String(u.username).toLowerCase() === 'danielg' || u.role === 'Administrador General';
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
    if (viewKey === 'new') return 'Habilitar Nuevo Sistema';
    if (viewKey === 'pricing') return 'Valor Mensual, Descuentos y Mercado Pago';
    if (viewKey === 'secrets') return 'Credenciales API';
    return 'Administrador General';
  }

  function ensureSectionsMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var menuSec = document.getElementById('sec-menu-superadmin');
    var detailSec = document.getElementById('sec-superadmin-detail');

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
          '<article class="module-card" role="button" tabindex="0" data-sa-open-view="pricing">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>' +
                '<line x1="1" y1="10" x2="23" y2="10"></line>' +
              '</svg>' +
            '</div>' +
            '<h3>Valor Mensual, Descuentos y Mercado Pago</h3>' +
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
  }

  async function openSuperAdminView(viewKey) {
    var secs = ensureSectionsMounted();
    if (!secs) return;
    STATE_SA.activeView = viewKey || 'menu';
    if (viewKey !== 'tenants') {
      STATE_SA.managingUsersSlug = null;
    }

    // Ocultar todas las demás secciones de .erp-main
    document.querySelectorAll('.erp-main > .erp-section').forEach(function (sec) {
      sec.hidden = true;
    });

    var backTopBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backTopBtn) {
      backTopBtn.hidden = false;
    }

    if (STATE_SA.activeView === 'menu') {
      secs.menuSec.hidden = false;
      secs.detailSec.hidden = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Pre-cargar datos en segundo plano
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
    }, 7000);
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
    if (Object.keys(STATE_SA.quoteSelected).length === 0 && Array.isArray(json.commercialModules)) {
      json.commercialModules.forEach(function (m) {
        if (['facturacion', 'articulos', 'clientes', 'manual_usuario'].indexOf(m.key) !== -1) {
          STATE_SA.quoteSelected[m.key] = true;
        }
      });
    }
    if (shouldRender) {
      renderBody();
    }
  }

  function computeLocalQuote(optionType, selectedMap, modDiscountMap, globalType, globalPct, globalFixed, tempMonths) {
    var data = STATE_SA.data;
    if (!data) return { optionBase: 0, modTotal: 0, subtotal: 0, promoMonthly: 0, regularMonthly: 0 };
    var cfg = data.pricingConfig || {};
    var rawOptBase = Number(optionType === 1 ? cfg.option_1_base : cfg.option_2_base) || 0;
    var optDiscPct = Math.min(100, Math.max(0, Number((modDiscountMap && modDiscountMap['__opt' + optionType]) || 0)));
    var optionBase = Math.round(rawOptBase * (1 - optDiscPct / 100));
    var modTotal = 0;
    (data.commercialModules || []).forEach(function (m) {
      if (!selectedMap[m.key]) return;
      var baseP =
        Number(
          (cfg.module_prices && cfg.module_prices[m.key] && cfg.module_prices[m.key].price) ??
            m.defaultMonthlyArs
        ) || 0;
      var discP = Math.min(100, Math.max(0, Number(modDiscountMap[m.key] || 0)));
      modTotal += Math.round(baseP * (1 - discP / 100));
    });
    var subtotal = Math.round(optionBase + modTotal);
    var gPct = Math.min(100, Math.max(0, Number(globalPct || 0)));
    var gFix = Math.max(0, Number(globalFixed || 0));
    var discounted = Math.max(0, Math.round(subtotal * (1 - gPct / 100) - gFix));

    if (globalType === 'permanent') {
      return {
        optionBase: optionBase,
        modTotal: modTotal,
        subtotal: subtotal,
        promoMonthly: discounted,
        regularMonthly: discounted,
        months: 0
      };
    }
    if (globalType === 'temporary') {
      return {
        optionBase: optionBase,
        modTotal: modTotal,
        subtotal: subtotal,
        promoMonthly: discounted,
        regularMonthly: subtotal,
        months: Math.max(1, Number(tempMonths || 3))
      };
    }
    return {
      optionBase: optionBase,
      modTotal: modTotal,
      subtotal: subtotal,
      promoMonthly: subtotal,
      regularMonthly: subtotal,
      months: 0
    };
  }

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
        '<table style="width:100%;border-collapse:collapse;font-size:0.86rem;">' +
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
        var mpBadge = t.is_base
          ? '<span class="ms-sa-pill">Sistema Base Propio</span>'
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
          '<div style="margin-top:0.7rem;padding:0.65rem;background:rgba(86,215,161,0.08);border:1px solid rgba(86,215,161,0.25);border-radius:10px;font-size:0.8rem;display:grid;gap:0.28rem;">' +
          '<div><strong>BD Supabase independiente:</strong> <code>' +
          esc(t.db_schema) +
          '</code></div>' +
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
          (dep.githubRepoUrl
            ? '<div><strong>GitHub:</strong> <a href="' +
              esc(dep.githubRepoUrl) +
              '" target="_blank">' +
              esc(dep.githubRepoUrl) +
              '</a></div>'
            : '') +
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
      '<button type="button" class="ms-sa-btn" id="ms-sa-go-new">+ Habilitar Nuevo Comercio</button>' +
      '</div>' +
      '<div class="ms-sa-grid">' +
      cards +
      '</div>' +
      '</div>'
    );
  }

  function renderNewTenantTab() {
    var d = STATE_SA.data;
    var mods = (d && d.commercialModules) || [];
    var quote = computeLocalQuote(
      STATE_SA.newOptionType,
      STATE_SA.quoteSelected,
      STATE_SA.quoteDiscountsByMod,
      STATE_SA.quoteGlobalType,
      STATE_SA.quoteGlobalPct,
      STATE_SA.quoteGlobalFixed,
      STATE_SA.quoteTempMonths
    );

    // Tarjetas de Módulos estilo ERP (con ícono .module-icon, título y valor mensual, sin textos de detalle)
    var modsCardsHtml = mods
      .map(function (m) {
        var checked = Boolean(STATE_SA.quoteSelected[m.key]);
        var cfgP = Number(
          (d.pricingConfig.module_prices &&
            d.pricingConfig.module_prices[m.key] &&
            d.pricingConfig.module_prices[m.key].price) ??
            m.defaultMonthlyArs
        );
        var svgIcon = MODULE_ICONS_SVG[m.key] || MODULE_ICONS_SVG.facturacion;
        return (
          '<article class="module-card ' +
          (checked ? 'is-sa-mod-selected' : '') +
          '" role="button" tabindex="0" data-toggle-mod-card="' +
          esc(m.key) +
          '" style="cursor:pointer;border:2px solid ' +
          (checked ? '#56D7A1' : 'rgba(17,45,58,0.16)') +
          ';background:' +
          (checked ? 'linear-gradient(135deg, #112D3A 0%, #173b4c 100%)' : '') +
          ';color:' +
          (checked ? '#FFFFFF' : '') +
          ';">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:0.35rem;">' +
          '<div class="module-icon" aria-hidden="true" style="margin:0;' +
          (checked ? 'background:#56D7A1;color:#112D3A;' : '') +
          '">' +
          svgIcon +
          '</div>' +
          '<span style="font-size:0.78rem;font-weight:900;padding:0.22rem 0.6rem;border-radius:999px;background:' +
          (checked ? '#56D7A1' : 'rgba(86,215,161,0.18)') +
          ';color:#112D3A;">' +
          (cfgP > 0 ? fmtArs.format(cfgP) : 'Incluido') +
          '</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;width:100%;">' +
          '<h3 style="margin:0;font-size:0.95rem;' +
          (checked ? 'color:#FFFFFF;' : '') +
          '">' +
          esc(m.name) +
          '</h3>' +
          '<input type="checkbox" data-new-mod="' +
          esc(m.key) +
          '" ' +
          (checked ? 'checked' : '') +
          ' style="width:18px;height:18px;accent-color:#56D7A1;pointer-events:none;">' +
          '</div>' +
          '</article>'
        );
      })
      .join('');

    return (
      '<form id="ms-sa-create-tenant-form" style="display:grid;gap:1.1rem;">' +
      '<div class="modules-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">' +
      '<article class="module-card" role="button" tabindex="0" data-pick-opt="1" style="cursor:pointer;border:2px solid ' +
      (STATE_SA.newOptionType === 1 ? '#56D7A1' : 'rgba(17,45,58,0.16)') +
      ';background:' +
      (STATE_SA.newOptionType === 1 ? 'linear-gradient(135deg, #112D3A 0%, #173b4c 100%)' : '') +
      ';color:' +
      (STATE_SA.newOptionType === 1 ? '#FFFFFF' : '') +
      ';">' +
      '<div class="module-icon" aria-hidden="true" style="' +
      (STATE_SA.newOptionType === 1 ? 'background:#56D7A1;color:#112D3A;' : '') +
      '">🌐</div>' +
      '<h3 style="' +
      (STATE_SA.newOptionType === 1 ? 'color:#FFFFFF;' : '') +
      '">Opción 1 · Dominio y Marca Propia</h3>' +
      '</article>' +
      '<article class="module-card" role="button" tabindex="0" data-pick-opt="2" style="cursor:pointer;border:2px solid ' +
      (STATE_SA.newOptionType === 2 ? '#56D7A1' : 'rgba(17,45,58,0.16)') +
      ';background:' +
      (STATE_SA.newOptionType === 2 ? 'linear-gradient(135deg, #112D3A 0%, #173b4c 100%)' : '') +
      ';color:' +
      (STATE_SA.newOptionType === 2 ? '#FFFFFF' : '') +
      ';">' +
      '<div class="module-icon" aria-hidden="true" style="' +
      (STATE_SA.newOptionType === 2 ? 'background:#56D7A1;color:#112D3A;' : '') +
      '">⚡</div>' +
      '<h3 style="' +
      (STATE_SA.newOptionType === 2 ? 'color:#FFFFFF;' : '') +
      '">Opción 2 · Subruta MiniSistema</h3>' +
      '</article>' +
      '</div>' +
      '<div class="ms-sa-grid">' +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">1. Datos del Comercio y Ruta</h4>' +
      '<div style="display:grid;gap:0.7rem;">' +
      '<div><label class="ms-sa-label">Identificador corto (slug sin espacios)</label><input class="ms-sa-input" name="slug" required placeholder="ej: superalberdi o ferreteriasur"></div>' +
      '<div><label class="ms-sa-label">Nombre Comercial / Fantasía</label><input class="ms-sa-input" name="fantasyName" required placeholder="Ej: Despensa El Sol"></div>' +
      '<div><label class="ms-sa-label">Razón Social / Titular</label><input class="ms-sa-input" name="businessName" required placeholder="Ej: Despensa El Sol S.A.S."></div>' +
      (STATE_SA.newOptionType === 1
        ? '<div><label class="ms-sa-label">Dominio Propio (Opción 1 — Vercel + GitHub)</label><input class="ms-sa-input" name="customDomain" required placeholder="www.nuevoerp.com.ar"></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">' +
          '<div><label class="ms-sa-label">Color Principal Comercio</label><input type="color" class="ms-sa-input" name="primaryHex" value="#112D3A" style="height:40px;padding:3px;"></div>' +
          '<div><label class="ms-sa-label">Color Acento Comercio</label><input type="color" class="ms-sa-input" name="accentHex" value="#56D7A1" style="height:40px;padding:3px;"></div>' +
          '</div>' +
          '<div><label class="ms-sa-label">Logo 1x1 (URL o subir PNG/JPG)</label><input class="ms-sa-input" name="logo1x1Url" placeholder="https://... o seleccioná archivo abajo"><input type="file" accept="image/*" id="ms-sa-file-logo1x1" style="margin-top:0.3rem;font-size:0.76rem;"></div>' +
          '<div><label class="ms-sa-label">Logo Horizontal Cabecera (URL o subir PNG/JPG)</label><input class="ms-sa-input" name="logoHorizontalUrl" placeholder="https://... o seleccioná archivo abajo"><input type="file" accept="image/*" id="ms-sa-file-logohoriz" style="margin-top:0.3rem;font-size:0.76rem;"></div>'
        : '<div style="padding:0.65rem;border-radius:9px;background:rgba(86,215,161,0.14);border:1px solid #56D7A1;font-size:0.8rem;">✓ <strong>Identidad MiniSistema activa:</strong> usará Azul Petróleo <code>#112D3A</code>, Verde Menta <code>#56D7A1</code> e isologotipo oficial de MiniSistema.</div>') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">' +
      '<div><label class="ms-sa-label">Localidad</label><input class="ms-sa-input" name="localidad" value="RÍO CUARTO"></div>' +
      '<div><label class="ms-sa-label">WhatsApp Comercio</label><input class="ms-sa-input" name="whatsappDigits" placeholder="549358..."></div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">2. Administrador del Comercio + Base Limpia</h4>' +
      '<div style="display:grid;gap:0.65rem;">' +
      '<div><label class="ms-sa-label">Usuario Administrador del Comercio</label><input class="ms-sa-input" name="adminUsername" placeholder="ej: adminsol (opcional)"></div>' +
      '<div><label class="ms-sa-label">Contraseña Inicial del Administrador</label><input class="ms-sa-input" name="adminPassword" placeholder="Mínimo 4 caracteres"></div>' +
      '<div><label class="ms-sa-label">Nombre del Administrador</label><input class="ms-sa-input" name="adminName" placeholder="Ej: Carlos Gómez"></div>' +
      '<div><label class="ms-sa-label">Email Pagador Mercado Pago (Débito Automático)</label><input type="email" class="ms-sa-input" name="payerEmail" required placeholder="cliente@comercio.com.ar"></div>' +
      '</div>' +
      '<div class="ms-sa-card ms-sa-card--highlight" style="margin-top:0.9rem;">' +
      '<div style="font-size:0.78rem;color:#56D7A1;font-weight:800;">ABONO MENSUAL CALCULADO (MERCADO PAGO)</div>' +
      '<div style="font-size:1.75rem;font-weight:900;margin:0.2rem 0;">' +
      fmtArs.format(quote.promoMonthly) +
      ' <span style="font-size:0.9rem;font-weight:500;">/ mes</span></div>' +
      (quote.months > 0
        ? '<div style="font-size:0.8rem;color:#d1fae5;">Promoción por <strong>' +
          quote.months +
          ' meses</strong> · Luego: ' +
          fmtArs.format(quote.regularMonthly) +
          '/mes</div>'
        : '') +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;margin-bottom:0.85rem;">3. Módulos Contratados y Descuento del Abono</h4>' +
      '<div class="modules-grid" style="margin-bottom:1.1rem;">' +
      modsCardsHtml +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.7rem;align-items:end;">' +
      '<div><label class="ms-sa-label">Tipo de Descuento</label><select class="ms-sa-select" id="ms-new-disc-type">' +
      '<option value="none" ' +
      (STATE_SA.quoteGlobalType === 'none' ? 'selected' : '') +
      '>Sin descuento</option>' +
      '<option value="temporary" ' +
      (STATE_SA.quoteGlobalType === 'temporary' ? 'selected' : '') +
      '>Por tiempo determinado (ej. 3 meses)</option>' +
      '<option value="permanent" ' +
      (STATE_SA.quoteGlobalType === 'permanent' ? 'selected' : '') +
      '>Descuento Permanente</option>' +
      '</select></div>' +
      '<div><label class="ms-sa-label">% Descuento</label><input type="number" min="0" max="100" class="ms-sa-input" id="ms-new-disc-pct" value="' +
      esc(STATE_SA.quoteGlobalPct) +
      '"></div>' +
      (STATE_SA.quoteGlobalType === 'temporary'
        ? '<div><label class="ms-sa-label">Duración Promo (Meses)</label><input type="number" min="1" max="60" class="ms-sa-input" id="ms-new-disc-months" value="' +
          esc(STATE_SA.quoteTempMonths) +
          '"></div>'
        : '') +
      '<div><button type="submit" class="ms-sa-btn" style="width:100%;padding:0.75rem;">🚀 Crear Sistema + BD Limpia + Suscripción MP</button></div>' +
      '</div>' +
      '</div>' +
      '</form>'
    );
  }

  function renderPricingTab() {
    var d = STATE_SA.data;
    var cfg = (d && d.pricingConfig) || {};
    var mods = (d && d.commercialModules) || [];
    var quote = computeLocalQuote(
      STATE_SA.quoteOptionType,
      STATE_SA.quoteSelected,
      STATE_SA.quoteDiscountsByMod,
      STATE_SA.quoteGlobalType,
      STATE_SA.quoteGlobalPct,
      STATE_SA.quoteGlobalFixed,
      STATE_SA.quoteTempMonths
    );

    var opt1Price = Number(cfg.option_1_base ?? 35000);
    var opt2Price = Number(cfg.option_2_base ?? 15000);
    var opt1Disc = Number(STATE_SA.quoteDiscountsByMod['__opt1'] || 0);
    var opt2Disc = Number(STATE_SA.quoteDiscountsByMod['__opt2'] || 0);
    var opt1Net = Math.round(opt1Price * (1 - opt1Disc / 100));
    var opt2Net = Math.round(opt2Price * (1 - opt2Disc / 100));
    var isOpt1 = STATE_SA.quoteOptionType === 1;

    var optionRowsHtml =
      '<tr style="border-bottom:1px solid rgba(86,215,161,0.28);background:rgba(86,215,161,0.06);">' +
      '<td style="padding:0.5rem;"><input type="checkbox" data-q-opt-chk="1" ' +
      (isOpt1 ? 'checked' : '') +
      '></td>' +
      '<td style="padding:0.5rem;"><strong>Base Mensual Opción 1 (Dominio + Marca Propia)</strong></td>' +
      '<td style="padding:0.5rem;width:140px;"><input type="number" min="0" step="500" class="ms-sa-input" id="ms-cfg-opt1" value="' +
      esc(opt1Price) +
      '"></td>' +
      '<td style="padding:0.5rem;width:110px;"><input type="number" min="0" max="100" class="ms-sa-input" data-q-opt-disc="1" value="' +
      esc(opt1Disc) +
      '"></td>' +
      '<td data-net-opt-cell="1" style="padding:0.5rem;font-weight:800;text-align:right;">' +
      (isOpt1 ? fmtArs.format(opt1Net) : '—') +
      '</td>' +
      '</tr>' +
      '<tr style="border-bottom:2px solid rgba(86,215,161,0.38);background:rgba(86,215,161,0.06);">' +
      '<td style="padding:0.5rem;"><input type="checkbox" data-q-opt-chk="2" ' +
      (!isOpt1 ? 'checked' : '') +
      '></td>' +
      '<td style="padding:0.5rem;"><strong>Base Mensual Opción 2 (Subruta MiniSistema)</strong></td>' +
      '<td style="padding:0.5rem;width:140px;"><input type="number" min="0" step="500" class="ms-sa-input" id="ms-cfg-opt2" value="' +
      esc(opt2Price) +
      '"></td>' +
      '<td style="padding:0.5rem;width:110px;"><input type="number" min="0" max="100" class="ms-sa-input" data-q-opt-disc="2" value="' +
      esc(opt2Disc) +
      '"></td>' +
      '<td data-net-opt-cell="2" style="padding:0.5rem;font-weight:800;text-align:right;">' +
      (!isOpt1 ? fmtArs.format(opt2Net) : '—') +
      '</td>' +
      '</tr>';

    var selectedCount = 0;
    var modRows = mods
      .map(function (m) {
        var curPrice = Number(
          (cfg.module_prices && cfg.module_prices[m.key] && cfg.module_prices[m.key].price) ??
            m.defaultMonthlyArs
        );
        var checked = Boolean(STATE_SA.quoteSelected[m.key]);
        if (checked) selectedCount += 1;
        var modDisc = Number(STATE_SA.quoteDiscountsByMod[m.key] || 0);
        var netMod = Math.round(curPrice * (1 - modDisc / 100));
        return (
          '<tr style="border-bottom:1px solid rgba(86,215,161,0.2);">' +
          '<td style="padding:0.5rem;"><input type="checkbox" data-q-mod="' +
          esc(m.key) +
          '" ' +
          (checked ? 'checked' : '') +
          '></td>' +
          '<td style="padding:0.5rem;"><strong>' +
          esc(m.name) +
          '</strong></td>' +
          '<td style="padding:0.5rem;width:140px;"><input type="number" min="0" step="500" class="ms-sa-input" data-cfg-mod-price="' +
          esc(m.key) +
          '" value="' +
          esc(curPrice) +
          '"></td>' +
          '<td style="padding:0.5rem;width:110px;"><input type="number" min="0" max="100" class="ms-sa-input" data-q-mod-disc="' +
          esc(m.key) +
          '" value="' +
          esc(modDisc) +
          '"></td>' +
          '<td data-net-mod-cell="' +
          esc(m.key) +
          '" style="padding:0.5rem;font-weight:800;text-align:right;">' +
          (checked ? fmtArs.format(netMod) : '—') +
          '</td>' +
          '</tr>'
        );
      })
      .join('');

    return (
      '<div style="display:grid;gap:1.1rem;">' +
      '<div class="ms-sa-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:0.65rem;">' +
      '<h4 style="margin:0;">📦 Valor Mensual y Descuento Individual por Módulo</h4>' +
      '<button type="button" class="ms-sa-btn ms-sa-btn--dark" id="ms-save-pricing-btn">💾 Guardar Lista Oficial de Valores Mensuales</button>' +
      '</div>' +
      '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">' +
      '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;">' +
      '<th style="padding:0.5rem;white-space:nowrap;">' +
      '<label style="display:inline-flex;align-items:center;gap:0.45rem;cursor:pointer;user-select:none;font-weight:800;color:#112D3A;" title="Tildar o destildar todos los módulos">' +
      '<input type="checkbox" id="ms-q-select-all-mods" ' +
      (mods.length > 0 && selectedCount === mods.length ? 'checked' : '') +
      '>' +
      '<span>Tildar todos</span>' +
      '</label>' +
      '</th>' +
      '<th style="padding:0.5rem;">Opción Base / Módulo del Sistema ERP</th><th style="padding:0.5rem;">Valor Mensual ($)</th><th style="padding:0.5rem;">Dto. Módulo (%)</th><th style="padding:0.5rem;text-align:right;">Neto Módulo</th></tr></thead>' +
      '<tbody>' +
      optionRowsHtml +
      modRows +
      '</tbody>' +
      '<tfoot>' +
      '<tr style="border-top:2px solid #56D7A1;background:rgba(86,215,161,0.12);">' +
      '<td colspan="4" style="padding:0.75rem 0.6rem;font-weight:800;font-size:0.95rem;color:#112D3A;">Subtotal (<span id="ms-sa-selected-opt-label">Opción ' +
      esc(STATE_SA.quoteOptionType) +
      '</span> + <span id="ms-sa-selected-mods-count">' +
      esc(selectedCount) +
      '</span> módulos seleccionados)</td>' +
      '<td id="ms-sa-selected-mods-subtotal" style="padding:0.75rem 0.5rem;font-weight:900;font-size:1.08rem;text-align:right;color:#112D3A;">' +
      fmtArs.format(quote.subtotal) +
      '</td>' +
      '</tr>' +
      '</tfoot>' +
      '</table>' +
      '</div>' +
      '</div>' +
      '<div class="ms-sa-card ms-sa-card--highlight">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<span style="color:#56D7A1;font-weight:800;font-size:0.8rem;">SIMULADOR DE ABONO MENSUAL (DÉBITO MP)</span>' +
      '</div>' +
      '<div style="font-size:2rem;font-weight:900;margin:0.4rem 0;"><span id="ms-q-sim-promo">' +
      fmtArs.format(quote.promoMonthly) +
      '</span> <span style="font-size:0.95rem;font-weight:500;">/ mes</span></div>' +
      '<div id="ms-q-sim-breakdown" style="font-size:0.82rem;color:#d1fae5;">Base Opción ' +
      STATE_SA.quoteOptionType +
      ': ' +
      fmtArs.format(quote.optionBase) +
      ' + Módulos: ' +
      fmtArs.format(quote.modTotal) +
      ' = Subtotal: ' +
      fmtArs.format(quote.subtotal) +
      '</div>' +
      '<div id="ms-q-sim-temp-note" style="margin-top:0.35rem;font-size:0.83rem;color:#56D7A1;font-weight:700;' +
      (quote.months > 0 ? '' : 'display:none;') +
      '">' +
      (quote.months > 0
        ? '⏱ Descuento temporal por ' +
          quote.months +
          ' meses · Desde el mes ' +
          (quote.months + 1) +
          ': ' +
          fmtArs.format(quote.regularMonthly) +
          '/mes'
        : '') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1.3fr 0.8fr 0.8fr;gap:0.5rem;margin-top:0.8rem;">' +
      '<select id="ms-q-gtype" class="ms-sa-select">' +
      '<option value="none" ' +
      (STATE_SA.quoteGlobalType === 'none' ? 'selected' : '') +
      '>Sin dto. global</option>' +
      '<option value="temporary" ' +
      (STATE_SA.quoteGlobalType === 'temporary' ? 'selected' : '') +
      '>Dto. Temporal (Meses)</option>' +
      '<option value="permanent" ' +
      (STATE_SA.quoteGlobalType === 'permanent' ? 'selected' : '') +
      '>Dto. Permanente</option>' +
      '</select>' +
      '<input type="number" min="0" max="100" id="ms-q-gpct" class="ms-sa-input" placeholder="% Dto" title="% Descuento Global" value="' +
      esc(STATE_SA.quoteGlobalPct) +
      '">' +
      '<input type="number" min="1" max="60" id="ms-q-gmonths" class="ms-sa-input" placeholder="Meses" title="Meses de promoción" value="' +
      esc(STATE_SA.quoteTempMonths) +
      '" ' +
      (STATE_SA.quoteGlobalType === 'temporary' ? '' : 'disabled') +
      '>' +
      '</div>' +
      '<button type="button" class="ms-sa-btn" id="ms-q-apply-to-new" style="margin-top:0.8rem;width:100%;">Usar esta Cotización en Nuevo Comercio →</button>' +
      '</div>' +
      '</div>'
    );
  }

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
      /* TARJETA 1: CREDENCIALES AFIP / ARCA */
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
      /* TARJETA 2 y 3: MERCADO PAGO + GITHUB / VERCEL */
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

  function renderBody() {
    var bodyEl = document.getElementById('ms-sa-body');
    if (!bodyEl || !STATE_SA.data) return;

    var bc = document.getElementById('ms-sa-detail-breadcrumb');
    if (bc) bc.textContent = getViewTitle(STATE_SA.activeView);

    if (STATE_SA.activeView === 'tenants') bodyEl.innerHTML = renderTenantsTab();
    else if (STATE_SA.activeView === 'new') bodyEl.innerHTML = renderNewTenantTab();
    else if (STATE_SA.activeView === 'pricing') bodyEl.innerHTML = renderPricingTab();
    else if (STATE_SA.activeView === 'secrets') bodyEl.innerHTML = renderSecretsTab();

    bindBodyEvents(bodyEl);
  }

  function bindBodyEvents(bodyEl) {
    var goNew = bodyEl.querySelector('#ms-sa-go-new');
    if (goNew) {
      goNew.addEventListener('click', function () {
        openSuperAdminView('new');
      });
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

    // Tab 2: New Tenant
    bodyEl.querySelectorAll('[data-pick-opt]').forEach(function (card) {
      card.addEventListener('click', function () {
        STATE_SA.newOptionType = Number(card.getAttribute('data-pick-opt')) === 1 ? 1 : 2;
        renderBody();
      });
    });

    bodyEl.querySelectorAll('[data-toggle-mod-card]').forEach(function (card) {
      card.addEventListener('click', function () {
        var key = card.getAttribute('data-toggle-mod-card');
        STATE_SA.quoteSelected[key] = !STATE_SA.quoteSelected[key];
        renderBody();
      });
    });

    var newDiscType = bodyEl.querySelector('#ms-new-disc-type');
    if (newDiscType) {
      newDiscType.addEventListener('change', function () {
        STATE_SA.quoteGlobalType = newDiscType.value;
        renderBody();
      });
    }
    var newDiscPct = bodyEl.querySelector('#ms-new-disc-pct');
    if (newDiscPct) {
      newDiscPct.addEventListener('input', function () {
        STATE_SA.quoteGlobalPct = Number(newDiscPct.value || 0);
      });
      newDiscPct.addEventListener('change', renderBody);
    }
    var newDiscMonths = bodyEl.querySelector('#ms-new-disc-months');
    if (newDiscMonths) {
      newDiscMonths.addEventListener('change', function () {
        STATE_SA.quoteTempMonths = Number(newDiscMonths.value || 3);
        renderBody();
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

    var createForm = bodyEl.querySelector('#ms-sa-create-tenant-form');
    if (createForm) {
      createForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(createForm);
        var selectedMods = Object.keys(STATE_SA.quoteSelected).filter(function (k) {
          return Boolean(STATE_SA.quoteSelected[k]);
        });
        var modOverrides = selectedMods.map(function (k) {
          return {
            moduleKey: k,
            discountPct: Number(STATE_SA.quoteDiscountsByMod[k] || 0)
          };
        });
        var adminUser = String(fd.get('adminUsername') || '').trim();
        var adminPass = String(fd.get('adminPassword') || '').trim();

        var payload = {
          action: 'provision_tenant',
          optionType: STATE_SA.newOptionType,
          slug: fd.get('slug'),
          fantasyName: fd.get('fantasyName'),
          businessName: fd.get('businessName'),
          customDomain: fd.get('customDomain') || '',
          payerEmail: fd.get('payerEmail') || '',
          commercialModuleKeys: selectedMods,
          moduleOverrides: modOverrides,
          globalDiscountType: STATE_SA.quoteGlobalType,
          globalDiscountPct: STATE_SA.quoteGlobalPct,
          temporaryMonths: STATE_SA.quoteTempMonths,
          branding: {
            primaryHex: fd.get('primaryHex') || '#112D3A',
            accentHex: fd.get('accentHex') || '#56D7A1',
            logo1x1Url: STATE_SA.newLogo1x1Data || fd.get('logo1x1Url') || '',
            logoHorizontalUrl: STATE_SA.newLogoHorizData || fd.get('logoHorizontalUrl') || '',
            localidad: fd.get('localidad') || 'RÍO CUARTO',
            whatsappDigits: fd.get('whatsappDigits') || '5493585095475',
            emailInfo: fd.get('payerEmail') || ''
          },
          initialAdmin:
            adminUser && adminPass.length >= 4
              ? {
                  username: adminUser,
                  password: adminPass,
                  name: String(fd.get('adminName') || adminUser)
                }
              : null
        };

        var submitBtn = createForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Aprovisionando esquema aislado en Supabase...';
        }
        var res = await apiSuperAdmin('POST', payload);
        if (submitBtn) submitBtn.disabled = false;

        if (res && res.ok) {
          STATE_SA.newLogo1x1Data = '';
          STATE_SA.newLogoHorizData = '';
          STATE_SA.activeView = 'tenants';
          showFeedback(res.message, false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'No se pudo crear el comercio.', true);
          renderBody();
        }
      });
    }

    // Tab 3: Pricing & Quote Simulator
    function refreshPricingDomLive() {
      var d = STATE_SA.data;
      if (!d) return;
      if (!d.pricingConfig) d.pricingConfig = {};
      if (!d.pricingConfig.module_prices) d.pricingConfig.module_prices = {};

      var opt1Inp = bodyEl.querySelector('#ms-cfg-opt1');
      var opt2Inp = bodyEl.querySelector('#ms-cfg-opt2');
      if (opt1Inp) d.pricingConfig.option_1_base = Math.max(0, Number(opt1Inp.value || 0));
      if (opt2Inp) d.pricingConfig.option_2_base = Math.max(0, Number(opt2Inp.value || 0));

      bodyEl.querySelectorAll('[data-q-opt-disc]').forEach(function (inp) {
        var optNum = inp.getAttribute('data-q-opt-disc');
        STATE_SA.quoteDiscountsByMod['__opt' + optNum] = Math.min(100, Math.max(0, Number(inp.value || 0)));
      });

      var chkOpt1 = bodyEl.querySelector('[data-q-opt-chk="1"]');
      var chkOpt2 = bodyEl.querySelector('[data-q-opt-chk="2"]');
      var qOptEl = bodyEl.querySelector('#ms-q-opt');
      if (chkOpt1) chkOpt1.checked = STATE_SA.quoteOptionType === 1;
      if (chkOpt2) chkOpt2.checked = STATE_SA.quoteOptionType === 2;
      if (qOptEl) qOptEl.value = String(STATE_SA.quoteOptionType);

      var opt1Net = Math.round(
        Number(d.pricingConfig.option_1_base || 0) *
          (1 - Number(STATE_SA.quoteDiscountsByMod['__opt1'] || 0) / 100)
      );
      var opt2Net = Math.round(
        Number(d.pricingConfig.option_2_base || 0) *
          (1 - Number(STATE_SA.quoteDiscountsByMod['__opt2'] || 0) / 100)
      );
      var netOptCell1 = bodyEl.querySelector('[data-net-opt-cell="1"]');
      var netOptCell2 = bodyEl.querySelector('[data-net-opt-cell="2"]');
      if (netOptCell1) netOptCell1.textContent = STATE_SA.quoteOptionType === 1 ? fmtArs.format(opt1Net) : '—';
      if (netOptCell2) netOptCell2.textContent = STATE_SA.quoteOptionType === 2 ? fmtArs.format(opt2Net) : '—';

      var qGTypeEl = bodyEl.querySelector('#ms-q-gtype');
      if (qGTypeEl) STATE_SA.quoteGlobalType = qGTypeEl.value;

      var qGPctEl = bodyEl.querySelector('#ms-q-gpct');
      if (qGPctEl) STATE_SA.quoteGlobalPct = Math.min(100, Math.max(0, Number(qGPctEl.value || 0)));

      var qGMonthsEl = bodyEl.querySelector('#ms-q-gmonths');
      if (qGMonthsEl) {
        qGMonthsEl.disabled = STATE_SA.quoteGlobalType !== 'temporary';
        STATE_SA.quoteTempMonths = Math.max(1, Number(qGMonthsEl.value || 3));
      }

      var selectedCount = 0;
      var modChks = bodyEl.querySelectorAll('[data-q-mod]');
      modChks.forEach(function (chk) {
        var k = chk.getAttribute('data-q-mod');
        STATE_SA.quoteSelected[k] = chk.checked;
        if (chk.checked) selectedCount += 1;
      });

      var selectAllChk = bodyEl.querySelector('#ms-q-select-all-mods');
      if (selectAllChk) {
        selectAllChk.checked = modChks.length > 0 && selectedCount === modChks.length;
        selectAllChk.indeterminate = selectedCount > 0 && selectedCount < modChks.length;
      }

      bodyEl.querySelectorAll('[data-q-mod-disc]').forEach(function (inp) {
        var k = inp.getAttribute('data-q-mod-disc');
        STATE_SA.quoteDiscountsByMod[k] = Math.min(100, Math.max(0, Number(inp.value || 0)));
      });

      bodyEl.querySelectorAll('[data-cfg-mod-price]').forEach(function (inp) {
        var k = inp.getAttribute('data-cfg-mod-price');
        var curPrice = Math.max(0, Number(inp.value || 0));
        if (!d.pricingConfig.module_prices[k]) d.pricingConfig.module_prices[k] = {};
        d.pricingConfig.module_prices[k].price = curPrice;
        d.pricingConfig.module_prices[k].defaultDiscountPct = Number(STATE_SA.quoteDiscountsByMod[k] || 0);

        var checked = Boolean(STATE_SA.quoteSelected[k]);
        var modDisc = Number(STATE_SA.quoteDiscountsByMod[k] || 0);
        var netMod = Math.round(curPrice * (1 - modDisc / 100));
        var netCell = bodyEl.querySelector('[data-net-mod-cell="' + k + '"]');
        if (netCell) {
          netCell.textContent = checked ? fmtArs.format(netMod) : '—';
        }
      });

      var quote = computeLocalQuote(
        STATE_SA.quoteOptionType,
        STATE_SA.quoteSelected,
        STATE_SA.quoteDiscountsByMod,
        STATE_SA.quoteGlobalType,
        STATE_SA.quoteGlobalPct,
        STATE_SA.quoteGlobalFixed,
        STATE_SA.quoteTempMonths
      );

      var optLabelEl = bodyEl.querySelector('#ms-sa-selected-opt-label');
      if (optLabelEl) optLabelEl.textContent = 'Opción ' + String(STATE_SA.quoteOptionType);

      var countEl = bodyEl.querySelector('#ms-sa-selected-mods-count');
      if (countEl) countEl.textContent = String(selectedCount);

      var subModsEl = bodyEl.querySelector('#ms-sa-selected-mods-subtotal');
      if (subModsEl) subModsEl.textContent = fmtArs.format(quote.subtotal);

      var promoEl = bodyEl.querySelector('#ms-q-sim-promo');
      if (promoEl) promoEl.textContent = fmtArs.format(quote.promoMonthly);

      var breakdownEl = bodyEl.querySelector('#ms-q-sim-breakdown');
      if (breakdownEl) {
        breakdownEl.textContent =
          'Base Opción ' +
          STATE_SA.quoteOptionType +
          ': ' +
          fmtArs.format(quote.optionBase) +
          ' + Módulos: ' +
          fmtArs.format(quote.modTotal) +
          ' = Subtotal: ' +
          fmtArs.format(quote.subtotal);
      }

      var tempNoteEl = bodyEl.querySelector('#ms-q-sim-temp-note');
      if (tempNoteEl) {
        if (quote.months > 0) {
          tempNoteEl.style.display = '';
          tempNoteEl.textContent =
            '⏱ Descuento temporal por ' +
            quote.months +
            ' meses · Desde el mes ' +
            (quote.months + 1) +
            ': ' +
            fmtArs.format(quote.regularMonthly) +
            '/mes';
        } else {
          tempNoteEl.style.display = 'none';
          tempNoteEl.textContent = '';
        }
      }
    }

    bodyEl.querySelectorAll('[data-q-opt-chk]').forEach(function (chk) {
      chk.addEventListener('change', function () {
        var which = Number(chk.getAttribute('data-q-opt-chk')) === 1 ? 1 : 2;
        if (chk.checked) {
          STATE_SA.quoteOptionType = which;
        } else {
          STATE_SA.quoteOptionType = which === 1 ? 2 : 1;
        }
        refreshPricingDomLive();
      });
    });

    var qOptSelect = bodyEl.querySelector('#ms-q-opt');
    if (qOptSelect) {
      qOptSelect.addEventListener('change', function () {
        STATE_SA.quoteOptionType = Number(qOptSelect.value) === 1 ? 1 : 2;
        refreshPricingDomLive();
      });
    }

    ['#ms-q-gtype', '#ms-q-gpct', '#ms-q-gmonths', '#ms-cfg-opt1', '#ms-cfg-opt2'].forEach(function (sel) {
      var el = bodyEl.querySelector(sel);
      if (el) {
        el.addEventListener('input', refreshPricingDomLive);
        el.addEventListener('change', refreshPricingDomLive);
      }
    });

    var selectAllModsChk = bodyEl.querySelector('#ms-q-select-all-mods');
    if (selectAllModsChk) {
      var initModChks = bodyEl.querySelectorAll('[data-q-mod]');
      var initSelectedCount = 0;
      initModChks.forEach(function (chk) {
        if (chk.checked) initSelectedCount += 1;
      });
      selectAllModsChk.indeterminate = initSelectedCount > 0 && initSelectedCount < initModChks.length;

      selectAllModsChk.addEventListener('change', function () {
        var checkAll = Boolean(selectAllModsChk.checked);
        bodyEl.querySelectorAll('[data-q-mod]').forEach(function (chk) {
          chk.checked = checkAll;
          var k = chk.getAttribute('data-q-mod');
          STATE_SA.quoteSelected[k] = checkAll;
        });
        refreshPricingDomLive();
      });
    }

    bodyEl.querySelectorAll('[data-q-mod], [data-q-mod-disc], [data-cfg-mod-price], [data-q-opt-disc]').forEach(function (el) {
      el.addEventListener('input', refreshPricingDomLive);
      el.addEventListener('change', refreshPricingDomLive);
    });

    var applyToNewBtn = bodyEl.querySelector('#ms-q-apply-to-new');
    if (applyToNewBtn) {
      applyToNewBtn.addEventListener('click', function () {
        STATE_SA.newOptionType = STATE_SA.quoteOptionType;
        openSuperAdminView('new');
      });
    }

    var savePricingBtn = bodyEl.querySelector('#ms-save-pricing-btn');
    if (savePricingBtn) {
      savePricingBtn.addEventListener('click', async function () {
        var opt1 = Number(bodyEl.querySelector('#ms-cfg-opt1').value || 0);
        var opt2 = Number(bodyEl.querySelector('#ms-cfg-opt2').value || 0);
        var modulePrices = {};
        bodyEl.querySelectorAll('[data-cfg-mod-price]').forEach(function (inp) {
          var k = inp.getAttribute('data-cfg-mod-price');
          modulePrices[k] = {
            price: Math.max(0, Number(inp.value || 0)),
            defaultDiscountPct: Number(STATE_SA.quoteDiscountsByMod[k] || 0)
          };
        });
        var res = await apiSuperAdmin('POST', {
          action: 'save_pricing_config',
          pricingConfig: {
            option_1_base: opt1,
            option_2_base: opt2,
            module_prices: modulePrices
          }
        });
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData(true);
        } else {
          showFeedback((res && res.message) || 'Error guardando precios.', true);
        }
      });
    }

    // Tab 4: Secrets & AFIP Credentials
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

    document.addEventListener('click', function (ev) {
      var target = ev.target;
      if (!target || typeof target.closest !== 'function') return;

      // Si el usuario hace clic en el logo de inicio o en cualquier botón nativo data-open-section, ocultar secciones de superadmin
      var homeBtn = target.closest('#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section]');
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
    }, true);
  }

  function syncSuperAdminEntrypointVisibility() {
    bindGlobalNavIntegration();
    var allowed = isDanielGeneralAdmin();
    var existingBtn = document.getElementById('ms-open-superadmin-btn');
    if (existingBtn) {
      existingBtn.remove();
    }

    // Inyectar tarjeta destacada en #sec-inicio para @danielg (sin texto descriptivo)
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
        '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:0.35rem;">' +
          '<div class="module-icon" aria-hidden="true" style="margin:0;background:#56D7A1;color:#112D3A;">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>' +
            '</svg>' +
          '</div>' +
          '<span style="background:#56D7A1;color:#112D3A;font-size:0.7rem;font-weight:800;padding:0.2rem 0.55rem;border-radius:999px;">EXCLUSIVO @danielg</span>' +
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

  setInterval(syncSuperAdminEntrypointVisibility, 900);
  document.addEventListener('DOMContentLoaded', syncSuperAdminEntrypointVisibility);
})();
