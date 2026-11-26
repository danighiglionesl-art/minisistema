/* ==========================================================================
   MÓDULO CLUB FIDEL (www.clubfidel.com.ar) INTEGRADO EN MINISISTEMA
   - Modo Administrador General (@danielg en MiniSistema Base): gestión integral
     de toda la App Club Fidel (comercios, abonos, socios QR, programas y redes,
     planes, paquetes y respaldo de puntos, campañas, catálogo, órdenes de retiro,
     liquidaciones, API ERP, configuración global, crons FIFO y auditoría).
   - Modo Comercio Adherido (tenants con módulo `club_fidel` en Lista de Precios):
     panel operativo del comercio, acreditación/reversión ERP y acceso a su cuenta.
   Respeta estrictamente GEMINI.md: tarjetas uniformes (.modules-grid / .module-card)
   con ícono SVG monocromático + <h3> únicamente (sin pills ni descripciones).
   ========================================================================== */
(function () {
  'use strict';

  var ADMIN_SUBMODULES = [
    { key: 'panel', label: 'Panel General', icon: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>' },
    { key: 'comercios', label: 'Comercios y Abonos', icon: '<path d="M3 9l2-5h14l2 5"></path><path d="M3 9v11h18V9"></path><path d="M9 20v-6h6v6"></path>' },
    { key: 'socios', label: 'Socios y Tarjetas QR', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><rect x="15" y="4" width="6" height="6" rx="1"></rect>' },
    { key: 'programas_redes', label: 'Programas y Redes', icon: '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>' },
    { key: 'planes', label: 'Planes Mensuales', icon: '<rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>' },
    { key: 'puntos', label: 'Paquetes y Respaldo', icon: '<circle cx="12" cy="12" r="9"></circle><path d="M14.5 9a2.5 2.5 0 0 0-5 0c0 2.5 5 2 5 5a2.5 2.5 0 0 1-5 0"></path><line x1="12" y1="5" x2="12" y2="7"></line><line x1="12" y1="17" x2="12" y2="19"></line>' },
    { key: 'campanas', label: 'Campañas y Reglas', icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>' },
    { key: 'catalogo', label: 'Catálogo de Canjes', icon: '<polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>' },
    { key: 'ordenes', label: 'Órdenes y Retiros QR', icon: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>' },
    { key: 'liquidaciones', label: 'Liquidaciones de Red', icon: '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>' },
    { key: 'integracion_erp', label: 'Integración ERP y POS', icon: '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>' },
    { key: 'configuracion', label: 'Configuración y Auditoría', icon: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' }
  ];

  var TENANT_SUBMODULES = [
    { key: 'tenant_panel', label: 'Estado del Programa', icon: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>' },
    { key: 'tenant_pos', label: 'Acreditar y Revertir Puntos', icon: '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>' },
    { key: 'tenant_ordenes', label: 'Órdenes y Catálogo', icon: '<polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line>' },
    { key: 'tenant_conexion', label: 'Credencial API Key ERP', icon: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' }
  ];

  var STATE = {
    view: 'menu',
    data: null,
    loading: false,
    feedback: '',
    isError: false,
    lastRawApiKey: '',
    searchSocios: '',
    searchComercios: ''
  };

  var fmtArs = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  });

  var fmtPts = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0
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

  function isBaseSuperAdmin() {
    var isBaseTenant = Boolean(
      (window.__ERP_TENANT_BOOT__ && window.__ERP_TENANT_BOOT__.isBase) ||
      (window.ERP_BRAND && window.ERP_BRAND.isBase)
    );
    if (!isBaseTenant) return false;
    var user = getActiveUser();
    if (!user || !user.username) return false;
    return String(user.username).trim().toLowerCase() === 'danielg';
  }

  function isAllowedForCurrentUser() {
    if (isBaseSuperAdmin()) return true;
    var boot = window.__ERP_TENANT_BOOT__;
    if (!boot || boot.isBase) return false;
    var mods = Array.isArray(boot.enabledModules) ? boot.enabledModules : [];
    var tenantHasMod = mods.some(function (k) {
      return k === 'club_fidel' || String(k).indexOf('club_fidel:') === 0;
    });
    if (!tenantHasMod) return false;
    var user = getActiveUser();
    if (!user || !user.username) return false;
    var role = String(user.role || '').toLowerCase();
    if (role.indexOf('admin') !== -1 || String(user.username).toLowerCase() === 'danielg') {
      return true;
    }
    var uMods = Array.isArray(user.modules) ? user.modules : [];
    return uMods.some(function (k) {
      return k === 'club_fidel' || String(k).indexOf('club_fidel:') === 0;
    });
  }

  function getActiveSubmodules() {
    return isBaseSuperAdmin() ? ADMIN_SUBMODULES : TENANT_SUBMODULES;
  }

  function getApiBase() {
    var boot = window.__ERP_TENANT_BOOT__;
    if (boot && !boot.isBase && boot.optionType === 2 && boot.slug) {
      return '/' + encodeURIComponent(boot.slug) + '/api/club_fidel';
    }
    return '/sistema/api/club_fidel';
  }

  async function apiCf(method, payload) {
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

  function ensureSections() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var secMenu = document.getElementById('sec-menu-clubfidel');
    if (secMenu && secMenu.parentNode !== erpMain) {
      erpMain.appendChild(secMenu);
    }
    if (!secMenu) {
      secMenu = document.createElement('section');
      secMenu.id = 'sec-menu-clubfidel';
      secMenu.className = 'erp-section';
      secMenu.hidden = true;
      secMenu.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="cf-back-home">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb" id="cf-menu-breadcrumb">MiniSistema · <strong>Club Fidel</strong></span>' +
          '</div>' +
          '<div style="display:inline-flex;align-items:center;gap:0.65rem;background:#112D3A;border-radius:12px;padding:0.35rem 0.85rem;">' +
            '<img src="/sistema/assets/img/club-fidel/club-fidel-logo-horiz.png" alt="clubfidel." style="height:26px;width:auto;object-fit:contain;background:transparent;border:none;display:block;">' +
            '<a href="https://www.clubfidel.com.ar" target="_blank" rel="noopener" style="background:#56D7A1;color:#112D3A;font-size:0.7rem;font-weight:900;padding:0.2rem 0.6rem;border-radius:999px;text-decoration:none;">www.clubfidel.com.ar ↗</a>' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" id="cf-submodules-grid" aria-label="Submódulos de Club Fidel"></div>';
      erpMain.appendChild(secMenu);
      secMenu.querySelector('#cf-back-home').addEventListener('click', closeToHome);
    }

    var secDetail = document.getElementById('sec-clubfidel-detail');
    if (secDetail && secDetail.parentNode !== erpMain) {
      erpMain.appendChild(secDetail);
    }
    if (!secDetail) {
      secDetail = document.createElement('section');
      secDetail.id = 'sec-clubfidel-detail';
      secDetail.className = 'erp-section';
      secDetail.hidden = true;
      secDetail.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="cf-back-menu">← Volver a Club Fidel</button>' +
            '<span class="module-breadcrumb" id="cf-detail-breadcrumb">Club Fidel</span>' +
          '</div>' +
          '<div style="display:inline-flex;align-items:center;gap:0.55rem;">' +
            '<button type="button" id="cf-refresh-btn" style="padding:0.38rem 0.8rem;border-radius:8px;border:1px solid #112D3A;background:#fff;color:#112D3A;font-weight:800;font-size:0.78rem;cursor:pointer;">↻ Actualizar en Vivo</button>' +
            '<a href="https://www.clubfidel.com.ar" target="_blank" rel="noopener" style="padding:0.38rem 0.8rem;border-radius:8px;background:#112D3A;color:#56D7A1;font-weight:800;font-size:0.78rem;text-decoration:none;">Abrir App ↗</a>' +
          '</div>' +
        '</div>' +
        '<div id="cf-detail-body" style="padding:1rem 0;"></div>';
      erpMain.appendChild(secDetail);
      secDetail.querySelector('#cf-back-menu').addEventListener('click', function () {
        openClubFidelView('menu');
      });
      secDetail.querySelector('#cf-refresh-btn').addEventListener('click', async function () {
        STATE.feedback = '';
        await reloadData();
        renderDetailView(STATE.view);
      });
    }

    return { menuSec: secMenu, detailSec: secDetail };
  }

  function bindGlobalNavIntegration() {
    if (window.__MS_CF_NAV_BOUND__) return;
    window.__MS_CF_NAV_BOUND__ = true;

    document.addEventListener('click', function (ev) {
      var target = ev.target;
      if (!target || typeof target.closest !== 'function') return;

      var navEl = target.closest(
        '#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #sec-inicio .module-card:not(#ms-clubfidel-home-card)'
      );
      if (!navEl) return;

      var menuSec = document.getElementById('sec-menu-clubfidel');
      var detailSec = document.getElementById('sec-clubfidel-detail');
      var isCfActive = (menuSec && !menuSec.hidden) || (detailSec && !detailSec.hidden);

      if (navEl.id === 'btn-topbar-back-facturacion' && isCfActive) {
        ev.preventDefault();
        ev.stopPropagation();
        if (detailSec && !detailSec.hidden) {
          openClubFidelView('menu');
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
      var res = await apiCf('GET');
      if (res && res.ok !== false) {
        STATE.data = res;
      } else {
        STATE.isError = true;
        STATE.feedback = (res && (res.message || res.error)) || 'No se pudo consultar Club Fidel.';
      }
    } catch (_e) {
      STATE.isError = true;
      STATE.feedback = 'No se pudo conectar con Club Fidel.';
    } finally {
      STATE.loading = false;
    }
  }

  function renderSubmodulesMenu() {
    var grid = document.getElementById('cf-submodules-grid');
    var bc = document.getElementById('cf-menu-breadcrumb');
    if (bc) {
      bc.innerHTML = isBaseSuperAdmin()
        ? 'Administrador General · <strong>Club Fidel</strong>'
        : 'Comercio Adherido · <strong>Club Fidel</strong>';
    }
    if (!grid) return;

    var subs = getActiveSubmodules();
    grid.innerHTML = subs.map(function (m) {
      return (
        '<article class="module-card" role="button" tabindex="0" data-cf-sub="' + esc(m.key) + '">' +
          '<div class="module-icon" aria-hidden="true">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + m.icon + '</svg>' +
          '</div>' +
          '<h3>' + esc(m.label) + '</h3>' +
        '</article>'
      );
    }).join('');

    grid.querySelectorAll('[data-cf-sub]').forEach(function (card) {
      var open = function () {
        openClubFidelView(card.getAttribute('data-cf-sub'));
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

  function renderFeedbackBanner() {
    var html = '';
    if (STATE.feedback) {
      var bg = STATE.isError ? '#fee2e2' : '#ecfdf5';
      var fg = STATE.isError ? '#991b1b' : '#065f46';
      var bd = STATE.isError ? '#f87171' : '#56D7A1';
      html +=
        '<div style="margin-bottom:14px;padding:12px 16px;border-radius:12px;background:' + bg + ';color:' + fg + ';border:1px solid ' + bd + ';font-weight:700;font-size:13px;">' +
          esc(STATE.feedback) +
        '</div>';
    }
    if (STATE.lastRawApiKey) {
      html +=
        '<div style="margin-bottom:14px;padding:14px 16px;border-radius:12px;background:#112D3A;color:#fff;border:2px solid #56D7A1;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">' +
          '<div>' +
            '<div style="color:#56D7A1;font-size:12px;font-weight:800;text-transform:uppercase;">API Key ERP Generada (copiala ahora, solo se exhibe completa una vez)</div>' +
            '<code style="display:inline-block;margin-top:4px;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.1);color:#fff;font-size:13px;user-select:all;">' + esc(STATE.lastRawApiKey) + '</code>' +
          '</div>' +
          '<button type="button" id="cf-dismiss-rawkey" style="padding:6px 12px;border:none;border-radius:8px;background:#56D7A1;color:#112D3A;font-weight:800;cursor:pointer;">Entendido</button>' +
        '</div>';
    }
    return html;
  }

  function bindCommonDetailEvents(container) {
    var btnDismiss = container.querySelector('#cf-dismiss-rawkey');
    if (btnDismiss) {
      btnDismiss.addEventListener('click', function () {
        STATE.lastRawApiKey = '';
        renderDetailView(STATE.view);
      });
    }
  }

  function cardStyle() {
    return 'background:#fff;border:1px solid #d9e2e6;border-radius:14px;padding:18px;';
  }

  function inputStyle() {
    return 'width:100%;padding:8px 10px;margin-top:4px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;color:#112D3A;background:#fff;';
  }

  function btnPrimaryStyle() {
    return 'padding:9px 16px;border:none;border-radius:9px;background:#112D3A;color:#56D7A1;font-weight:800;font-size:13px;cursor:pointer;';
  }

  function btnMintStyle() {
    return 'padding:8px 14px;border:none;border-radius:9px;background:#56D7A1;color:#112D3A;font-weight:800;font-size:12.5px;cursor:pointer;';
  }

  function renderNeedsSecretForm(body, d) {
    var conn = (d && d.connection) || {};
    body.innerHTML =
      renderFeedbackBanner() +
      '<div style="' + cardStyle() + 'max-width:660px;display:grid;gap:14px;">' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<img src="/sistema/assets/img/club-fidel/club-fidel-mascota.png" alt="Fidel" style="width:68px;height:68px;object-fit:contain;">' +
          '<div>' +
            '<h3 style="margin:0;color:#112D3A;">Vincular Conexión Administrativa con Club Fidel</h3>' +
            '<p style="margin:4px 0 0;font-size:13px;color:#475569;">Configurá por única vez la URL y el secreto administrativo de sincronización para operar en vivo sobre <strong>www.clubfidel.com.ar</strong>.</p>' +
          '</div>' +
        '</div>' +
        '<form id="cf-conn-setup-form" style="display:grid;gap:12px;">' +
          '<label style="font-size:12.5px;font-weight:700;color:#112D3A;">URL de la App Club Fidel<input name="apiUrl" required value="' + esc(conn.apiUrl || 'https://www.clubfidel.com.ar') + '" style="' + inputStyle() + '"></label>' +
          '<label style="font-size:12.5px;font-weight:700;color:#112D3A;">Clave Secreta Server-to-Server (MINISISTEMA_SYNC_SECRET / CRON_SECRET)<input name="adminSecret" type="password" required placeholder="Pegar secreto de sincronización" style="' + inputStyle() + '"></label>' +
          '<button type="submit" style="' + btnPrimaryStyle() + '">Guardar y Conectar Club Fidel</button>' +
        '</form>' +
      '</div>';

    var form = document.getElementById('cf-conn-setup-form');
    if (form) {
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(form);
        var res = await apiCf('POST', {
          action: 'save_connection_config',
          apiUrl: fd.get('apiUrl'),
          adminSecret: fd.get('adminSecret')
        });
        STATE.isError = !(res && res.ok);
        STATE.feedback = (res && res.message) || 'Conexión actualizada.';
        await reloadData();
        renderDetailView(STATE.view);
      });
    }
  }

  function renderTenantView(viewKey, body, d) {
    var m = d.merchant;
    var tCfg = d.tenantConfig || {};
    var appUrl = d.publicAppUrl || 'https://www.clubfidel.com.ar';

    if (viewKey === 'tenant_conexion' || !m) {
      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;">' +
          '<div style="' + cardStyle() + '">' +
            '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">' +
              '<img src="/sistema/assets/img/club-fidel/club-fidel-mascota.png" alt="Fidel" style="width:56px;height:56px;object-fit:contain;">' +
              '<div>' +
                '<h3 style="margin:0;color:#112D3A;">Conexión ERP ↔ Club Fidel</h3>' +
                '<div style="font-size:12px;color:#475569;">' + (m ? 'Vinculado a <strong>' + esc(m.tradeName) + '</strong> (CUIT ' + esc(m.cuit) + ')' : 'Pendiente de vincular CUIT / API Key ERP') + '</div>' +
              '</div>' +
            '</div>' +
            '<form id="cf-tenant-key-form" style="display:grid;gap:10px;">' +
              '<label style="font-size:12.5px;font-weight:700;">CUIT del Comercio en Club Fidel<input name="cuit" value="' + esc(tCfg.cuit || '') + '" placeholder="30000000000" style="' + inputStyle() + '"></label>' +
              '<label style="font-size:12.5px;font-weight:700;">API Key ERP (cf_live_...) ' + (tCfg.hasErpApiKey ? '<span style="color:#0f766e;">(' + esc(tCfg.erpApiKeyMasked) + ')</span>' : '') + '<input name="erpApiKey" placeholder="Pegar nueva cf_live_... o dejar vacío para conservar" style="' + inputStyle() + '"></label>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
                '<label style="font-size:12.5px;font-weight:700;">Código Sucursal<input name="defaultBranchCode" value="' + esc(tCfg.defaultBranchCode || 'CENTRAL') + '" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12.5px;font-weight:700;">Código Programa (opcional)<input name="defaultProgramCode" value="' + esc(tCfg.defaultProgramCode || '') + '" placeholder="Por defecto: Cerrado propio" style="' + inputStyle() + '"></label>' +
              '</div>' +
              '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;"><input type="checkbox" name="autoEmitOnPosSale" ' + (tCfg.autoEmitOnPosSale !== false ? 'checked' : '') + '> Habilitar acreditación rápida desde Facturación / Mostrador</label>' +
              '<button type="submit" style="' + btnPrimaryStyle() + '">Guardar Credenciales del Comercio</button>' +
            '</form>' +
          '</div>' +
          '<div style="' + cardStyle() + 'background:#112D3A;color:#fff;">' +
            '<img src="/sistema/assets/img/club-fidel/club-fidel-logo-horiz.png" alt="clubfidel." style="height:36px;width:auto;margin-bottom:12px;">' +
            '<h4 style="margin:0 0 8px;color:#56D7A1;">Accesos Directos a la PWA</h4>' +
            '<p style="font-size:13px;color:rgba(255,255,255,0.82);line-height:1.5;">Desde el portal Soy Comercio podés diseñar campañas con simulador, subir fotos de premios y escanear QRs de retiro desde cualquier celular.</p>' +
            '<div style="display:grid;gap:8px;margin-top:14px;">' +
              '<a href="' + esc(appUrl) + '/comercio" target="_blank" rel="noopener" style="display:block;text-align:center;padding:10px;border-radius:9px;background:#56D7A1;color:#112D3A;font-weight:800;text-decoration:none;">Abrir Panel Soy Comercio ↗</a>' +
              '<a href="' + esc(appUrl) + '/cliente" target="_blank" rel="noopener" style="display:block;text-align:center;padding:10px;border-radius:9px;border:1px solid rgba(86,215,161,0.5);color:#fff;font-weight:700;text-decoration:none;">Ver Portal Soy Cliente ↗</a>' +
            '</div>' +
          '</div>' +
        '</div>';

      bindCommonDetailEvents(body);
      var fKey = document.getElementById('cf-tenant-key-form');
      if (fKey) {
        fKey.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(fKey);
          var res = await apiCf('POST', {
            action: 'save_tenant_erp_key',
            cuit: fd.get('cuit'),
            erpApiKey: fd.get('erpApiKey'),
            defaultBranchCode: fd.get('defaultBranchCode'),
            defaultProgramCode: fd.get('defaultProgramCode'),
            autoEmitOnPosSale: fd.get('autoEmitOnPosSale') === 'on'
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Guardado.';
          await reloadData();
          renderDetailView(STATE.view);
        });
      }
      return;
    }

    if (viewKey === 'tenant_panel') {
      var pool = m.pointPool || {};
      var sub = (m.subscriptions && m.subscriptions[0]) || {};
      var prog = (m.ownedClosedPrograms && m.ownedClosedPrograms[0]) || {};
      var kpiCards = [
        ['Comercio', m.tradeName],
        ['Estado / Plan', m.status + (sub.plan ? ' · ' + sub.plan.name : '')],
        ['Puntos Comprados Disponibles', fmtPts.format(Number(pool.availablePurchasedPoints || 0)) + ' pts'],
        ['Cupo Crédito Autorizado', fmtPts.format(Number(pool.authorizedCreditLimitPoints || 0)) + ' pts'],
        ['Puntos Emitidos Históricos', fmtPts.format(Number(pool.totalIssuedPoints || 0)) + ' pts'],
        ['% Acumulación Base', (prog.accrualPercentage || '1') + '%'],
        ['Equivalencia Canje', '$ ' + (prog.redemptionArsPerPoint || '1') + ' / pt'],
        ['Redes Abiertas Adheridas', (m.networkMemberships || []).length]
      ];
      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:12px;">' +
        kpiCards.map(function (c) {
          return '<div style="' + cardStyle() + '">' +
            '<div style="font-size:12px;color:#526570;font-weight:700;">' + esc(c[0]) + '</div>' +
            '<div style="font-size:20px;font-weight:900;color:#112D3A;margin-top:4px;">' + esc(c[1]) + '</div>' +
          '</div>';
        }).join('') +
        '</div>';
      bindCommonDetailEvents(body);
      return;
    }

    if (viewKey === 'tenant_pos') {
      var txRows = (m.erpTransactions || []).map(function (t) {
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(fmtDate(t.createdAt)) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;"><code>' + esc(t.externalTxId) + '</code></td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(t.operationType) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(t.customerIdentifier) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + fmtArs.format(Number(t.amountArs || 0)) + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;font-weight:800;">' + fmtPts.format(Number(t.pointsCalculated || 0)) + ' pts</td>' +
          '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(t.status) + '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:16px;margin-bottom:16px;">' +
          '<div style="' + cardStyle() + '">' +
            '<h3 style="margin:0 0 10px;color:#112D3A;">Acreditar Compra de Mostrador / Factura</h3>' +
            '<form id="cf-pos-purchase-form" style="display:grid;gap:10px;">' +
              '<label style="font-size:12.5px;font-weight:700;">Socio (QR CF-CARD:..., código CF-..., email o celular) *<input name="customerIdentifier" required placeholder="Escanear QR de Mi Tarjeta Fidel o ingresar email/código" style="' + inputStyle() + '"></label>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
                '<label style="font-size:12.5px;font-weight:700;">Importe Compra (ARS) *<input name="amountArs" type="number" step="0.01" min="1" required placeholder="50000" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12.5px;font-weight:700;">N° Comprobante / Ticket *<input name="externalTxId" required value="FC-' + Date.now().toString().slice(-6) + '" style="' + inputStyle() + '"></label>' +
              '</div>' +
              '<button type="submit" style="' + btnPrimaryStyle() + '">Sumar Puntos al Socio</button>' +
            '</form>' +
          '</div>' +
          '<div style="' + cardStyle() + '">' +
            '<h3 style="margin:0 0 10px;color:#112D3A;">Revertir / Nota de Crédito ERP</h3>' +
            '<form id="cf-pos-rev-form" style="display:grid;gap:10px;">' +
              '<label style="font-size:12.5px;font-weight:700;">Comprobante Original (externalTxId) *<input name="externalTxId" required placeholder="Ej: FC-123456" style="' + inputStyle() + '"></label>' +
              '<label style="font-size:12.5px;font-weight:700;">Motivo de Anulación *<input name="reason" required placeholder="Nota de crédito / devolución" style="' + inputStyle() + '"></label>' +
              '<button type="submit" style="padding:9px 16px;border:1px solid #991b1b;border-radius:9px;background:#fff;color:#991b1b;font-weight:800;font-size:13px;cursor:pointer;">Revertir Puntos del Comprobante</button>' +
            '</form>' +
          '</div>' +
        '</div>' +
        '<div style="' + cardStyle() + 'overflow:auto;">' +
          '<h4 style="margin:0 0 10px;color:#112D3A;">Últimas Operaciones ERP Sincronizadas</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Fecha</th><th style="padding:8px;">Comprobante</th><th style="padding:8px;">Tipo</th><th style="padding:8px;">Socio</th><th style="padding:8px;">Importe</th><th style="padding:8px;">Puntos</th><th style="padding:8px;">Estado</th></tr></thead><tbody>' +
          (txRows || '<tr><td colspan="7" style="padding:12px;">Sin operaciones ERP registradas aún.</td></tr>') +
          '</tbody></table>' +
        '</div>';

      bindCommonDetailEvents(body);
      var fPur = document.getElementById('cf-pos-purchase-form');
      if (fPur) {
        fPur.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(fPur);
          var res = await apiCf('POST', {
            action: 'register_erp_purchase',
            customerIdentifier: fd.get('customerIdentifier'),
            amountArs: Number(fd.get('amountArs')),
            externalTxId: fd.get('externalTxId'),
            invoiceNumber: fd.get('externalTxId')
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Operación procesada.';
          await reloadData();
          renderDetailView(STATE.view);
        });
      }
      var fRev = document.getElementById('cf-pos-rev-form');
      if (fRev) {
        fRev.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(fRev);
          var res = await apiCf('POST', {
            action: 'reverse_erp_purchase',
            externalTxId: fd.get('externalTxId'),
            reason: fd.get('reason')
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Reversión procesada.';
          await reloadData();
          renderDetailView(STATE.view);
        });
      }
      return;
    }

    // tenant_ordenes
    var ordRows = (m.redemptionOrders || []).map(function (o) {
      return '<tr>' +
        '<td style="padding:8px;border-bottom:1px solid #eee;"><strong>' + esc(o.orderCode) + '</strong><br><small>' + esc(fmtDate(o.createdAt)) + '</small></td>' +
        '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(o.user ? o.user.name : '—') + '</td>' +
        '<td style="padding:8px;border-bottom:1px solid #eee;font-weight:800;">' + fmtPts.format(Number(o.totalPoints || 0)) + ' pts</td>' +
        '<td style="padding:8px;border-bottom:1px solid #eee;"><code>' + esc(o.pickupCodeDisplay) + '</code></td>' +
        '<td style="padding:8px;border-bottom:1px solid #eee;">' + esc(o.status) + '</td>' +
      '</tr>';
    }).join('');

    body.innerHTML =
      renderFeedbackBanner() +
      '<div style="' + cardStyle() + 'overflow:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">' +
          '<h3 style="margin:0;color:#112D3A;">Órdenes de Retiro del Comercio (' + (m.redemptionOrders || []).length + ')</h3>' +
          '<a href="' + esc(appUrl) + '/comercio/ordenes" target="_blank" rel="noopener" style="' + btnMintStyle() + 'text-decoration:none;">Validar Entrega con QR Único ↗</a>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Orden</th><th style="padding:8px;">Socio</th><th style="padding:8px;">Puntos</th><th style="padding:8px;">Código Retiro</th><th style="padding:8px;">Estado</th></tr></thead><tbody>' +
        (ordRows || '<tr><td colspan="5" style="padding:12px;">Todavía no hay órdenes de canje registradas.</td></tr>') +
        '</tbody></table>' +
      '</div>';
    bindCommonDetailEvents(body);
  }

  function renderDetailView(viewKey) {
    var body = document.getElementById('cf-detail-body');
    var bc = document.getElementById('cf-detail-breadcrumb');
    var subs = getActiveSubmodules();
    var meta = subs.find(function (s) { return s.key === viewKey; }) || { label: viewKey };
    if (bc) bc.innerHTML = 'Club Fidel · <strong>' + esc(meta.label) + '</strong>';
    if (!body) return;

    if (STATE.loading && !STATE.data) {
      body.innerHTML = '<p style="padding:1rem;font-weight:700;color:#112D3A;">Sincronizando datos en tiempo real con Club Fidel (www.clubfidel.com.ar)...</p>';
      return;
    }

    var d = STATE.data;
    if (!d) {
      body.innerHTML = renderFeedbackBanner();
      return;
    }

    if (d.mode === 'tenant') {
      renderTenantView(viewKey, body, d);
      return;
    }

    if (d.needsSecretConfig) {
      renderNeedsSecretForm(body, d);
      return;
    }

    var k = d.kpis || {};
    var plans = d.plans || [];
    var packages = d.pointPackages || [];
    var merchants = d.merchants || [];
    var networks = d.networks || [];
    var appUrl = d.publicAppUrl || 'https://www.clubfidel.com.ar';

    // 1. PANEL GENERAL
    if (viewKey === 'panel') {
      var kpiList = [
        ['Comercios Activos / Totales', (k.merchantsActive || 0) + ' / ' + (k.merchantsTotal || 0)],
        ['Socios Registrados', k.customersRegistered || 0],
        ['Redes Abiertas Activas', k.networksActive || 0],
        ['Programas Configurados', k.programsTotal || 0],
        ['Facturación Abonos Vigentes', fmtArs.format(Number(k.activeSubscriptionsMonthlyArs || 0)) + '/mes'],
        ['Puntos Comprados por Comercios', fmtPts.format(Number(k.totalPurchasedPoints || 0)) + ' pts'],
        ['Cupo Disponible en Bolsas', fmtPts.format(Number(k.availablePoolPoints || 0)) + ' pts'],
        ['Puntos Emitidos a Socios', fmtPts.format(Number(k.totalIssuedPoints || 0)) + ' pts'],
        ['Obligación Vigente (Disp. + Reserv.)', fmtPts.format(Number(k.activeObligationPoints || 0)) + ' pts'],
        ['Puntos Vendidos / Canjeados', fmtPts.format(Number(k.totalRedeemedPoints || 0)) + ' pts'],
        ['Puntos Vencidos FIFO (≤ 365d)', fmtPts.format(Number(k.totalExpiredPoints || 0)) + ' pts'],
        ['Respaldo Interno Liberado Caducidad', fmtArs.format(Number(k.releasedBackingArs || 0))],
        ['Campañas Activas', k.activeCampaignsCount || 0],
        ['Beneficios en Catálogo', k.catalogItemsActiveCount || 0],
        ['Órdenes Pendientes Retiro / Entregadas', (k.ordersPendingPickupCount || 0) + ' / ' + (k.ordersDeliveredCount || 0)],
        ['Liquidaciones Red Pendientes', fmtArs.format(Number(k.pendingSettlementArs || 0))]
      ];

      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="background:#112D3A;color:#fff;border-radius:16px;padding:18px 22px;margin-bottom:16px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;">' +
          '<div style="display:flex;align-items:center;gap:16px;">' +
            '<img src="/sistema/assets/img/club-fidel/club-fidel-mascota.png" alt="Fidel" style="width:68px;height:68px;object-fit:contain;background:#fff;border-radius:14px;padding:4px;">' +
            '<div>' +
              '<div style="color:#56D7A1;font-size:11.5px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;">Control Maestro MiniSistema · SaaS Multicomercio</div>' +
              '<h3 style="margin:4px 0;font-size:20px;color:#fff;">clubfidel. — Administración Integral de la Plataforma</h3>' +
              '<div style="font-size:12.5px;color:rgba(255,255,255,0.8);">Conectado en vivo con PostgreSQL productivo (<code>clubfidel-db</code> · Región gru1) e ítem activo en la Lista de Precios de MiniSistema.</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
            '<a href="' + esc(appUrl) + '" target="_blank" rel="noopener" style="' + btnMintStyle() + 'text-decoration:none;">Portal Público ↗</a>' +
            '<a href="' + esc(appUrl) + '/cliente" target="_blank" rel="noopener" style="padding:8px 14px;border-radius:9px;border:1px solid rgba(86,215,161,0.5);color:#fff;font-weight:700;font-size:12.5px;text-decoration:none;">Soy Cliente ↗</a>' +
            '<a href="' + esc(appUrl) + '/comercio" target="_blank" rel="noopener" style="padding:8px 14px;border-radius:9px;border:1px solid rgba(86,215,161,0.5);color:#fff;font-weight:700;font-size:12.5px;text-decoration:none;">Soy Comercio ↗</a>' +
            '<a href="' + esc(appUrl) + '/admin" target="_blank" rel="noopener" style="padding:8px 14px;border-radius:9px;border:1px solid rgba(255,255,255,0.3);color:#56D7A1;font-weight:800;font-size:12.5px;text-decoration:none;">Consola /admin ↗</a>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">' +
          kpiList.map(function (c) {
            return '<div style="' + cardStyle() + '">' +
              '<div style="font-size:12px;color:#526570;font-weight:700;">' + esc(c[0]) + '</div>' +
              '<div style="font-size:21px;font-weight:900;color:#112D3A;margin-top:4px;">' + esc(c[1]) + '</div>' +
            '</div>';
          }).join('') +
        '</div>';
      bindCommonDetailEvents(body);
      return;
    }

    // 2. COMERCIOS Y ABONOS
    if (viewKey === 'comercios') {
      var msTenants = d.minisistemaTenants || [];
      var planOpts = plans.map(function (p) {
        return '<option value="' + esc(p.code) + '">' + esc(p.name) + ' (' + fmtArs.format(Number(p.monthlyPriceArs || 0)) + '/mes)</option>';
      }).join('');
      var netOpts = '<option value="">Sin red inicial (solo Programa Cerrado)</option>' + networks.map(function (n) {
        return '<option value="' + esc(n.id) + '">' + esc(n.name) + '</option>';
      }).join('');
      var msTenantOpts = msTenants.map(function (t) {
        var cuitHint = (t.branding && t.branding.cuitFmt) || '';
        return '<option value="' + esc(t.slug) + '" data-cuit="' + esc(cuitHint) + '">' + esc(t.fantasy_name) + ' (/' + esc(t.slug) + (cuitHint ? ' · CUIT ' + cuitHint : '') + ')</option>';
      }).join('');

      var mRows = merchants.map(function (m) {
        var pool = m.pointPool || {};
        var sub = (m.subscriptions && m.subscriptions[0]) || {};
        var prog = (m.ownedClosedPrograms && m.ownedClosedPrograms[0]) || {};
        var nets = (m.networkMemberships || []).map(function (nm) { return nm.network ? nm.network.name : ''; }).filter(Boolean).join(', ');
        return '<tr style="border-bottom:1px solid #e2e8f0;">' +
          '<td style="padding:10px 8px;">' +
            '<strong style="color:#112D3A;">' + esc(m.tradeName) + '</strong>' +
            '<div style="font-size:11.5px;color:#64748b;">CUIT ' + esc(m.cuit) + ' · ' + esc(m.locality) + ' · ' + esc(m.email) + '</div>' +
            (nets ? '<div style="font-size:11px;color:#0f766e;font-weight:700;">Redes: ' + esc(nets) + '</div>' : '<div style="font-size:11px;color:#64748b;">Modalidad Cerrada (' + esc(prog.code || '') + ')</div>') +
          '</td>' +
          '<td style="padding:10px 8px;">' +
            '<div><strong>' + fmtPts.format(Number(pool.availablePurchasedPoints || 0)) + ' pts</strong> disp.</div>' +
            '<div style="font-size:11.5px;color:#64748b;">Emitidos: ' + fmtPts.format(Number(pool.totalIssuedPoints || 0)) + ' · Créd: ' + fmtPts.format(Number(pool.authorizedCreditLimitPoints || 0)) + '</div>' +
          '</td>' +
          '<td style="padding:10px 8px;">' +
            '<select data-m-plan="' + esc(m.id) + '" style="padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;">' +
              plans.map(function (p) {
                var sel = sub.plan && sub.plan.code === p.code ? ' selected' : '';
                return '<option value="' + esc(p.code) + '"' + sel + '>' + esc(p.name) + '</option>';
              }).join('') +
            '</select>' +
            '<select data-m-substatus="' + esc(m.id) + '" style="padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;margin-top:4px;display:block;">' +
              ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'].map(function (st) {
                return '<option value="' + st + '"' + (sub.status === st ? ' selected' : '') + '>' + st + '</option>';
              }).join('') +
            '</select>' +
          '</td>' +
          '<td style="padding:10px 8px;">' +
            '<select data-m-status="' + esc(m.id) + '" style="padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;">' +
              ['ACTIVE', 'PENDING', 'SUSPENDED'].map(function (st) {
                return '<option value="' + st + '"' + (m.status === st ? ' selected' : '') + '>' + st + '</option>';
              }).join('') +
            '</select>' +
            '<input type="number" step="100" data-m-credit="' + esc(m.id) + '" value="' + esc(Number(pool.authorizedCreditLimitPoints || 0)) + '" title="Cupo de crédito autorizado en puntos" style="width:105px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;margin-top:4px;display:block;">' +
          '</td>' +
          '<td style="padding:10px 8px;">' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
              '<button type="button" data-save-merchant="' + esc(m.id) + '" style="' + btnMintStyle() + 'padding:6px 10px;">Guardar</button>' +
              '<button type="button" data-gen-erpkey="' + esc(m.id) + '" style="padding:6px 10px;border:1px solid #112D3A;border-radius:8px;background:#fff;color:#112D3A;font-size:12px;font-weight:800;cursor:pointer;">+ API Key ERP</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:16px;">' +
          '<div style="' + cardStyle() + '">' +
            '<h3 style="margin:0 0 10px;color:#112D3A;">Vincular Comercio Existente de MiniSistema</h3>' +
            '<p style="margin:0 0 10px;font-size:12px;color:#475569;">Da de alta al comercio en Club Fidel, habilita el módulo en su ERP y sincroniza su API Key automáticamente.</p>' +
            '<form id="cf-link-ms-tenant-form" style="display:grid;gap:9px;">' +
              '<label style="font-size:12px;font-weight:700;">Comercio MiniSistema *<select name="tenantSlug" id="cf-ms-tenant-sel" required style="' + inputStyle() + '">' + (msTenantOpts || '<option value="">Sin comercios hijos</option>') + '</select></label>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">CUIT (11 dígitos) *<input name="cuit" id="cf-ms-tenant-cuit" required placeholder="30712345678" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Plan Club Fidel<select name="planCode" style="' + inputStyle() + '">' + planOpts + '</select></label>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">Rubro Comercial<input name="rubro" value="Supermercado / Retail" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Puntos Iniciales Cortesía<input name="initialPoints" type="number" min="0" step="500" value="5000" style="' + inputStyle() + '"></label>' +
              '</div>' +
              '<button type="submit" style="' + btnPrimaryStyle() + '">Vincular Comercio + Sincronizar API Key</button>' +
            '</form>' +
          '</div>' +
          '<div style="' + cardStyle() + '">' +
            '<h3 style="margin:0 0 10px;color:#112D3A;">Alta Directa de Nuevo Comercio Externo</h3>' +
            '<form id="cf-new-merchant-form" style="display:grid;gap:9px;">' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">Nombre Fantasía *<input name="tradeName" required placeholder="Ej: Farmacia Central" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">CUIT (11 dígitos) *<input name="cuit" required placeholder="30000000000" style="' + inputStyle() + '"></label>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">Email Titular *<input name="email" type="email" required placeholder="titular@comercio.com.ar" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Rubro *<input name="rubro" required value="Comercio Minorista" style="' + inputStyle() + '"></label>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">Dirección<input name="address" value="Centro" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Localidad<input name="locality" value="Río Cuarto" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Plan<select name="planCode" style="' + inputStyle() + '">' + planOpts + '</select></label>' +
              '</div>' +
              '<label style="font-size:12px;font-weight:700;">Adherir a Red Abierta<select name="joinNetworkId" style="' + inputStyle() + '">' + netOpts + '</select></label>' +
              '<button type="submit" style="' + btnPrimaryStyle() + '">+ Crear Comercio en Club Fidel</button>' +
            '</form>' +
          '</div>' +
        '</div>' +
        '<div style="' + cardStyle() + 'overflow:auto;">' +
          '<h3 style="margin:0 0 12px;color:#112D3A;">Comercios Registrados en Club Fidel (' + merchants.length + ')</h3>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Comercio / Programa</th><th style="padding:8px;">Cuenta de Puntos</th><th style="padding:8px;">Plan y Abono</th><th style="padding:8px;">Estado / Cupo Créd.</th><th style="padding:8px;">Acciones</th></tr></thead><tbody>' +
          (mRows || '<tr><td colspan="5" style="padding:14px;">Todavía no hay comercios registrados en Club Fidel.</td></tr>') +
          '</tbody></table>' +
        '</div>';

      bindCommonDetailEvents(body);

      var msSel = document.getElementById('cf-ms-tenant-sel');
      var msCuitInp = document.getElementById('cf-ms-tenant-cuit');
      if (msSel && msCuitInp) {
        var syncCuit = function () {
          var opt = msSel.options[msSel.selectedIndex];
          if (opt && opt.getAttribute('data-cuit')) {
            msCuitInp.value = opt.getAttribute('data-cuit').replace(/\D/g, '');
          }
        };
        msSel.addEventListener('change', syncCuit);
        syncCuit();
      }

      var fLink = document.getElementById('cf-link-ms-tenant-form');
      if (fLink) {
        fLink.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(fLink);
          var res = await apiCf('POST', {
            action: 'link_minisistema_tenant',
            tenantSlug: fd.get('tenantSlug'),
            cuit: fd.get('cuit'),
            planCode: fd.get('planCode'),
            rubro: fd.get('rubro'),
            initialPoints: Number(fd.get('initialPoints') || 0)
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Procesado.';
          if (res && res.rawErpApiKey) STATE.lastRawApiKey = res.rawErpApiKey;
          await reloadData();
          renderDetailView('comercios');
        });
      }

      var fNewM = document.getElementById('cf-new-merchant-form');
      if (fNewM) {
        fNewM.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(fNewM);
          var res = await apiCf('POST', {
            action: 'onboard_merchant',
            tradeName: fd.get('tradeName'),
            legalName: fd.get('tradeName'),
            cuit: fd.get('cuit'),
            email: fd.get('email'),
            rubro: fd.get('rubro'),
            address: fd.get('address'),
            locality: fd.get('locality'),
            province: 'Córdoba',
            planCode: fd.get('planCode'),
            joinNetworkId: fd.get('joinNetworkId') || null
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && (res.message || res.error)) || 'Comercio creado.';
          if (res && res.rawErpApiKey) STATE.lastRawApiKey = res.rawErpApiKey;
          await reloadData();
          renderDetailView('comercios');
        });
      }

      body.querySelectorAll('[data-save-merchant]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-save-merchant');
          var stEl = body.querySelector('[data-m-status="' + id + '"]');
          var crEl = body.querySelector('[data-m-credit="' + id + '"]');
          var plEl = body.querySelector('[data-m-plan="' + id + '"]');
          var sbEl = body.querySelector('[data-m-substatus="' + id + '"]');
          var res = await apiCf('POST', {
            action: 'update_merchant_control',
            merchantId: id,
            status: stEl ? stEl.value : 'ACTIVE',
            authorizedCreditLimitPoints: crEl ? crEl.value : '0',
            planCode: plEl ? plEl.value : '',
            subscriptionStatus: sbEl ? sbEl.value : ''
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Actualizado.';
          await reloadData();
          renderDetailView('comercios');
        });
      });

      body.querySelectorAll('[data-gen-erpkey]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-gen-erpkey');
          var res = await apiCf('POST', {
            action: 'generate_erp_api_key',
            merchantId: id,
            name: 'MiniSistema ERP / POS'
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Clave generada.';
          if (res && res.rawApiKey) STATE.lastRawApiKey = res.rawApiKey;
          await reloadData();
          renderDetailView('comercios');
        });
      });
      return;
    }

    // 3. SOCIOS Y TARJETAS QR
    if (viewKey === 'socios') {
      var q = (STATE.searchSocios || '').toLowerCase().trim();
      var customers = (d.customers || []).filter(function (u) {
        if (!q) return true;
        var hay = (u.name || '') + ' ' + (u.email || '') + ' ' + (u.memberCode || '') + ' ' + (u.phone || '');
        return hay.toLowerCase().indexOf(q) !== -1;
      });

      var uRows = customers.map(function (u) {
        var balances = (u.pointAccounts || []).map(function (pa) {
          var pName = pa.program ? pa.program.name : 'Programa';
          return '<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;border-radius:999px;background:#ecfdf5;color:#065f46;font-size:11px;font-weight:800;">' + esc(pName) + ': ' + fmtPts.format(Number(pa.availablePoints || 0)) + ' pts (' + esc(pa.currentTier) + ')</span>';
        }).join('');
        return '<tr style="border-bottom:1px solid #eee;">' +
          '<td style="padding:8px;"><strong>' + esc(u.name) + '</strong><br><small>' + esc(u.email) + (u.phone ? ' · ' + esc(u.phone) : '') + '</small></td>' +
          '<td style="padding:8px;"><code>' + esc(u.memberCode) + '</code></td>' +
          '<td style="padding:8px;">' + esc((u.locality || '—') + (u.province ? ', ' + u.province : '')) + '</td>' +
          '<td style="padding:8px;">' + (balances || '<span style="color:#94a3b8;font-size:12px;">Sin movimientos aún</span>') + '</td>' +
          '<td style="padding:8px;text-align:center;font-weight:700;">' + esc(u._count ? u._count.redemptionOrders : 0) + '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="' + cardStyle() + 'overflow:auto;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">' +
            '<h3 style="margin:0;color:#112D3A;">Padrón Único de Socios Club Fidel (' + customers.length + ')</h3>' +
            '<input id="cf-socios-search" value="' + esc(STATE.searchSocios) + '" placeholder="Buscar por nombre, email, teléfono o código..." style="min-width:280px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;">' +
          '</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Socio</th><th style="padding:8px;">Credencial QR</th><th style="padding:8px;">Localidad</th><th style="padding:8px;">Saldos Separados por Programa (Regla 3)</th><th style="padding:8px;text-align:center;">Canjes</th></tr></thead><tbody>' +
          (uRows || '<tr><td colspan="5" style="padding:14px;">No se encontraron socios registrados.</td></tr>') +
          '</tbody></table>' +
        '</div>';

      bindCommonDetailEvents(body);
      var sInp = document.getElementById('cf-socios-search');
      if (sInp) {
        sInp.addEventListener('input', function () {
          STATE.searchSocios = sInp.value;
          renderDetailView('socios');
          var again = document.getElementById('cf-socios-search');
          if (again) {
            again.focus();
            again.setSelectionRange(again.value.length, again.value.length);
          }
        });
      }
      return;
    }

    // 4. PROGRAMAS Y REDES ABIERTAS
    if (viewKey === 'programas_redes') {
      var netRows = networks.map(function (n) {
        var memList = (n.memberships || []).map(function (mm) {
          return mm.merchant ? mm.merchant.tradeName + ' (' + mm.status + ')' : '';
        }).filter(Boolean).join(', ');
        return '<tr style="border-bottom:1px solid #eee;">' +
          '<td style="padding:8px;"><strong>' + esc(n.name) + '</strong><br><small>' + esc(n.slug) + '</small></td>' +
          '<td style="padding:8px;">' + esc(n.defaultAccrualPct) + '% · Emisión $' + esc(n.issuanceArsPerPoint) + '/pt · Canje $' + esc(n.redemptionArsPerPoint) + '/pt</td>' +
          '<td style="padding:8px;">Recargo ' + esc(n.defaultMarkupPct) + '% · Clearing ' + esc(n.clearingCommissionPct) + '%</td>' +
          '<td style="padding:8px;">' + esc(n.pointValidityDays) + ' días</td>' +
          '<td style="padding:8px;font-size:12px;">' + esc(memList || 'Sin comercios adheridos') + '</td>' +
        '</tr>';
      }).join('');

      var progRows = (d.programs || []).map(function (p) {
        return '<tr style="border-bottom:1px solid #eee;">' +
          '<td style="padding:8px;"><strong>' + esc(p.name) + '</strong><br><code>' + esc(p.code) + '</code></td>' +
          '<td style="padding:8px;">' + esc(p.type) + '</td>' +
          '<td style="padding:8px;"><input type="number" step="0.1" data-p-acc="' + esc(p.id) + '" value="' + esc(p.accrualPercentage) + '" style="width:70px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;"> %</td>' +
          '<td style="padding:8px;">$<input type="number" step="0.01" data-p-iss="' + esc(p.id) + '" value="' + esc(p.issuanceArsPerPoint) + '" style="width:70px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;"> / $<input type="number" step="0.01" data-p-red="' + esc(p.id) + '" value="' + esc(p.redemptionArsPerPoint) + '" style="width:70px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;"></td>' +
          '<td style="padding:8px;"><input type="number" step="0.5" data-p-mk="' + esc(p.id) + '" value="' + esc(p.defaultProductMarkupPct) + '" style="width:65px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;"> %</td>' +
          '<td style="padding:8px;"><input type="number" min="1" max="365" data-p-val="' + esc(p.id) + '" value="' + esc(p.pointValidityDays) + '" style="width:65px;padding:4px;border:1px solid #cbd5e1;border-radius:6px;"> d</td>' +
          '<td style="padding:8px;"><button type="button" data-save-prog="' + esc(p.id) + '" style="' + btnMintStyle() + 'padding:5px 10px;">Guardar</button></td>' +
        '</tr>';
      }).join('');

      var mSelect = merchants.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.tradeName) + '</option>'; }).join('');
      var nSelect = networks.map(function (n) { return '<option value="' + esc(n.id) + '">' + esc(n.name) + '</option>'; }).join('');

      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:16px;">' +
          '<div style="' + cardStyle() + '">' +
            '<h3 style="margin:0 0 10px;color:#112D3A;">Crear Nueva Red Abierta Multicomercio</h3>' +
            '<form id="cf-create-net-form" style="display:grid;gap:8px;">' +
              '<label style="font-size:12px;font-weight:700;">Nombre de la Red *<input name="name" required placeholder="Ej: Red Paseo Comercial Río Cuarto" style="' + inputStyle() + '"></label>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">% Acumulación<input name="defaultAccrualPct" type="number" step="0.1" value="1.5" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">ARS/pt Emisión<input name="issuanceArsPerPoint" type="number" step="0.01" value="1" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">ARS/pt Canje<input name="redemptionArsPerPoint" type="number" step="0.01" value="1" style="' + inputStyle() + '"></label>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">Recargo Canje %<input name="defaultMarkupPct" type="number" step="0.5" value="12" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Comisión Red %<input name="clearingCommissionPct" type="number" step="0.1" value="4" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Vigencia (≤365d)<input name="pointValidityDays" type="number" min="1" max="365" value="365" style="' + inputStyle() + '"></label>' +
              '</div>' +
              '<button type="submit" style="' + btnPrimaryStyle() + '">+ Crear Red Abierta</button>' +
            '</form>' +
          '</div>' +
          '<div style="' + cardStyle() + '">' +
            '<h3 style="margin:0 0 10px;color:#112D3A;">Adherir / Administrar Comercio en Red (Modalidad Híbrida)</h3>' +
            '<form id="cf-join-net-form" style="display:grid;gap:10px;">' +
              '<label style="font-size:12px;font-weight:700;">Red Abierta *<select name="networkId" required style="' + inputStyle() + '">' + (nSelect || '<option value="">Creá una red primero</option>') + '</select></label>' +
              '<label style="font-size:12px;font-weight:700;">Comercio *<select name="merchantId" required style="' + inputStyle() + '">' + (mSelect || '<option value="">Sin comercios</option>') + '</select></label>' +
              '<label style="font-size:12px;font-weight:700;">Estado Participación<select name="status" style="' + inputStyle() + '"><option value="ACTIVE">ACTIVE (Emite y Canjea)</option><option value="PAUSED">PAUSED (Pausado)</option><option value="LEFT">LEFT (Baja de Red)</option></select></label>' +
              '<button type="submit" style="' + btnPrimaryStyle() + '">Guardar Participación en Red</button>' +
            '</form>' +
          '</div>' +
        '</div>' +
        '<div style="' + cardStyle() + 'overflow:auto;margin-bottom:16px;">' +
          '<h4 style="margin:0 0 10px;color:#112D3A;">Redes Abiertas Configuradas (' + networks.length + ')</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Red</th><th style="padding:8px;">Reglas Conversión</th><th style="padding:8px;">Recargo y Clearing</th><th style="padding:8px;">Vigencia</th><th style="padding:8px;">Integrantes</th></tr></thead><tbody>' +
          (netRows || '<tr><td colspan="5" style="padding:12px;">Sin redes abiertas creadas aún.</td></tr>') +
          '</tbody></table>' +
        '</div>' +
        '<div style="' + cardStyle() + 'overflow:auto;">' +
          '<h4 style="margin:0 0 10px;color:#112D3A;">Programas Cerrados y de Red — Conversiones Independientes (Regla 1)</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Programa</th><th style="padding:8px;">Modalidad</th><th style="padding:8px;">% Acum.</th><th style="padding:8px;">Emisión / Canje ($/pt)</th><th style="padding:8px;">Recargo</th><th style="padding:8px;">Vigencia</th><th style="padding:8px;">Acción</th></tr></thead><tbody>' +
          (progRows || '<tr><td colspan="7" style="padding:12px;">Sin programas registrados.</td></tr>') +
          '</tbody></table>' +
        '</div>';

      bindCommonDetailEvents(body);

      var fNet = document.getElementById('cf-create-net-form');
      if (fNet) {
        fNet.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(fNet);
          var res = await apiCf('POST', {
            action: 'create_network',
            name: fd.get('name'),
            defaultAccrualPct: fd.get('defaultAccrualPct'),
            issuanceArsPerPoint: fd.get('issuanceArsPerPoint'),
            redemptionArsPerPoint: fd.get('redemptionArsPerPoint'),
            defaultMarkupPct: fd.get('defaultMarkupPct'),
            clearingCommissionPct: fd.get('clearingCommissionPct'),
            pointValidityDays: Number(fd.get('pointValidityDays') || 365)
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Red creada.';
          await reloadData();
          renderDetailView('programas_redes');
        });
      }

      var fJoin = document.getElementById('cf-join-net-form');
      if (fJoin) {
        fJoin.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(fJoin);
          var res = await apiCf('POST', {
            action: 'toggle_network_membership',
            networkId: fd.get('networkId'),
            merchantId: fd.get('merchantId'),
            status: fd.get('status')
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Actualizado.';
          await reloadData();
          renderDetailView('programas_redes');
        });
      }

      body.querySelectorAll('[data-save-prog]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-save-prog');
          var res = await apiCf('POST', {
            action: 'update_closed_program',
            programId: id,
            accrualPercentage: body.querySelector('[data-p-acc="' + id + '"]').value,
            issuanceArsPerPoint: body.querySelector('[data-p-iss="' + id + '"]').value,
            redemptionArsPerPoint: body.querySelector('[data-p-red="' + id + '"]').value,
            defaultProductMarkupPct: body.querySelector('[data-p-mk="' + id + '"]').value,
            pointValidityDays: Number(body.querySelector('[data-p-val="' + id + '"]').value || 365)
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Programa actualizado.';
          await reloadData();
          renderDetailView('programas_redes');
        });
      });
      return;
    }

    // 5. PLANES MENSUALES
    if (viewKey === 'planes') {
      var pRows = plans.map(function (p) {
        var feats = [
          p.allowOpenNetworks ? 'Redes Abiertas' : null,
          p.allowErpIntegration ? 'API ERP' : null,
          p.allowAdvancedStats ? 'Estadísticas' : null,
          p.allowAutomations ? 'Automatizaciones' : null
        ].filter(Boolean).join(' · ');
        return '<tr style="border-bottom:1px solid #eee;">' +
          '<td style="padding:8px;"><strong>' + esc(p.name) + '</strong> (<code>' + esc(p.code) + '</code>)<br><small>' + esc(p.description) + '</small></td>' +
          '<td style="padding:8px;font-weight:900;color:#112D3A;">' + fmtArs.format(Number(p.monthlyPriceArs || 0)) + '/mes</td>' +
          '<td style="padding:8px;font-size:12px;">' + esc(p.maxBranches) + ' suc. · ' + esc(p.maxEmployees) + ' emp. · ' + esc(p.maxSimultaneousCamps) + ' camp.</td>' +
          '<td style="padding:8px;font-size:12px;">' + esc(feats || 'Base') + '</td>' +
          '<td style="padding:8px;text-align:center;font-weight:800;">' + esc(p._count ? p._count.subscriptions : 0) + '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="display:grid;grid-template-columns:minmax(310px,420px) 1fr;gap:16px;align-items:start;">' +
          '<div style="' + cardStyle() + '">' +
            '<h3 style="margin:0 0 10px;color:#112D3A;">Crear / Editar Plan de Abono</h3>' +
            '<form id="cf-plan-form" style="display:grid;gap:9px;">' +
              '<div style="display:grid;grid-template-columns:1fr 1.3fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">Código *<input name="code" required placeholder="PROFESIONAL" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Nombre *<input name="name" required placeholder="Plan Profesional" style="' + inputStyle() + '"></label>' +
              '</div>' +
              '<label style="font-size:12px;font-weight:700;">Descripción<input name="description" required placeholder="Ideal para comercios con múltiples cajas" style="' + inputStyle() + '"></label>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">Abono Mensual (ARS) *<input name="monthlyPriceArs" type="number" min="0" step="500" required value="35000" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Días de Prueba<input name="trialDays" type="number" min="0" value="14" style="' + inputStyle() + '"></label>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">Máx. Suc.<input name="maxBranches" type="number" min="1" value="3" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Máx. Emp.<input name="maxEmployees" type="number" min="1" value="10" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Máx. Camp.<input name="maxSimultaneousCamps" type="number" min="1" value="10" style="' + inputStyle() + '"></label>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;font-weight:700;">' +
                '<label><input type="checkbox" name="allowOpenNetworks" checked> Redes Abiertas</label>' +
                '<label><input type="checkbox" name="allowErpIntegration" checked> Integración ERP</label>' +
                '<label><input type="checkbox" name="allowAdvancedStats" checked> Estadísticas</label>' +
                '<label><input type="checkbox" name="allowAutomations" checked> Automatizaciones</label>' +
              '</div>' +
              '<button type="submit" style="' + btnPrimaryStyle() + '">Guardar Plan Configurable</button>' +
            '</form>' +
          '</div>' +
          '<div style="' + cardStyle() + 'overflow:auto;">' +
            '<h3 style="margin:0 0 10px;color:#112D3A;">Planes Activos en Club Fidel (' + plans.length + ')</h3>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Plan</th><th style="padding:8px;">Valor Mensual</th><th style="padding:8px;">Cupos</th><th style="padding:8px;">Funciones</th><th style="padding:8px;">Suscriptos</th></tr></thead><tbody>' +
            (pRows || '<tr><td colspan="5" style="padding:12px;">Sin planes.</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>';

      bindCommonDetailEvents(body);
      var fPlan = document.getElementById('cf-plan-form');
      if (fPlan) {
        fPlan.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(fPlan);
          var res = await apiCf('POST', {
            action: 'upsert_plan',
            code: fd.get('code'),
            name: fd.get('name'),
            description: fd.get('description'),
            monthlyPriceArs: fd.get('monthlyPriceArs'),
            trialDays: Number(fd.get('trialDays') || 14),
            maxBranches: Number(fd.get('maxBranches') || 1),
            maxEmployees: Number(fd.get('maxEmployees') || 5),
            maxCustomers: 50000,
            maxSimultaneousCamps: Number(fd.get('maxSimultaneousCamps') || 5),
            allowOpenNetworks: fd.get('allowOpenNetworks') === 'on',
            allowErpIntegration: fd.get('allowErpIntegration') === 'on',
            allowAdvancedStats: fd.get('allowAdvancedStats') === 'on',
            allowAutomations: fd.get('allowAutomations') === 'on'
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Plan guardado.';
          await reloadData();
          renderDetailView('planes');
        });
      }
      return;
    }

    // 6. PAQUETES Y RESPALDO DE PUNTOS
    if (viewKey === 'puntos') {
      var pkgRows = packages.map(function (pk) {
        return '<tr style="border-bottom:1px solid #eee;">' +
          '<td style="padding:8px;"><strong>' + esc(pk.name) + '</strong> (<code>' + esc(pk.code) + '</code>)</td>' +
          '<td style="padding:8px;font-weight:800;">' + fmtPts.format(Number(pk.pointsAmount || 0)) + ' pts</td>' +
          '<td style="padding:8px;">$ ' + esc(pk.unitPriceArs) + ' / pt</td>' +
          '<td style="padding:8px;font-weight:900;color:#112D3A;">' + fmtArs.format(Number(pk.totalPriceArs || 0)) + '</td>' +
          '<td style="padding:8px;text-align:center;">' + esc(pk._count ? pk._count.purchases : 0) + '</td>' +
        '</tr>';
      }).join('');

      var backRows = (d.backingLedger || []).slice(0, 40).map(function (b) {
        return '<tr style="border-bottom:1px solid #eee;">' +
          '<td style="padding:7px;">' + esc(fmtDate(b.createdAt)) + '</td>' +
          '<td style="padding:7px;"><code>' + esc(b.eventType) + '</code></td>' +
          '<td style="padding:7px;">' + esc(b.fundingMerchant ? b.fundingMerchant.tradeName : '—') + '</td>' +
          '<td style="padding:7px;">' + esc(b.redeemingMerchant ? b.redeemingMerchant.tradeName : '—') + '</td>' +
          '<td style="padding:7px;font-weight:800;">' + fmtPts.format(Number(b.pointsAmount || 0)) + ' pts</td>' +
          '<td style="padding:7px;">' + fmtArs.format(Number(b.totalBackingArs || 0)) + '</td>' +
        '</tr>';
      }).join('');

      var mOpts = merchants.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.tradeName) + '</option>'; }).join('');

      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:16px;margin-bottom:16px;">' +
          '<div style="' + cardStyle() + '">' +
            '<h3 style="margin:0 0 10px;color:#112D3A;">Crear / Actualizar Paquete de Puntos</h3>' +
            '<form id="cf-pkg-form" style="display:grid;gap:9px;">' +
              '<div style="display:grid;grid-template-columns:1fr 1.2fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">Código *<input name="code" required placeholder="PACK_50000" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Nombre *<input name="name" required placeholder="Pack Mayorista 50.000 pts" style="' + inputStyle() + '"></label>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">Cantidad de Puntos *<input name="pointsAmount" type="number" min="100" step="100" required value="50000" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Precio Unitario (ARS/pt) *<input name="unitPriceArs" type="number" step="0.01" min="0.01" required value="0.90" style="' + inputStyle() + '"></label>' +
              '</div>' +
              '<button type="submit" style="' + btnPrimaryStyle() + '">Guardar Paquete</button>' +
            '</form>' +
          '</div>' +
          '<div style="' + cardStyle() + '">' +
            '<h3 style="margin:0 0 10px;color:#112D3A;">Acreditar Puntos Comprados a Comercio (Regla 2)</h3>' +
            '<form id="cf-credit-pts-form" style="display:grid;gap:9px;">' +
              '<label style="font-size:12px;font-weight:700;">Comercio *<select name="merchantId" required style="' + inputStyle() + '">' + (mOpts || '<option value="">Sin comercios</option>') + '</select></label>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                '<label style="font-size:12px;font-weight:700;">Cantidad Puntos *<input name="pointsAmount" type="number" min="1" step="100" required value="10000" style="' + inputStyle() + '"></label>' +
                '<label style="font-size:12px;font-weight:700;">Modalidad<select name="purchaseMode" style="' + inputStyle() + '"><option value="MANUAL">Compra Facturada (MANUAL)</option><option value="CREDIT_GRANT">Asignación sin comisión (CREDIT_GRANT)</option></select></label>' +
              '</div>' +
              '<label style="font-size:12px;font-weight:700;">Comprobante / Observación<input name="invoiceNumber" placeholder="Ej: FC A 0002-00001234" style="' + inputStyle() + '"></label>' +
              '<button type="submit" style="' + btnPrimaryStyle() + '">Acreditar Cupo de Puntos</button>' +
            '</form>' +
          '</div>' +
        '</div>' +
        '<div style="' + cardStyle() + 'overflow:auto;margin-bottom:16px;">' +
          '<h4 style="margin:0 0 10px;color:#112D3A;">Paquetes de Puntos Comercializables (' + packages.length + ')</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Paquete</th><th style="padding:8px;">Puntos</th><th style="padding:8px;">Unitario</th><th style="padding:8px;">Total ARS</th><th style="padding:8px;text-align:center;">Ventas</th></tr></thead><tbody>' +
          (pkgRows || '<tr><td colspan="5" style="padding:12px;">Sin paquetes.</td></tr>') +
          '</tbody></table>' +
        '</div>' +
        '<div style="' + cardStyle() + 'overflow:auto;">' +
          '<h4 style="margin:0 0 10px;color:#112D3A;">Libro Mayor Interno de Respaldo Comercial (PointBackingLedger)</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:7px;">Fecha</th><th style="padding:7px;">Evento Contable</th><th style="padding:7px;">Comercio Financiador</th><th style="padding:7px;">Comercio Receptor</th><th style="padding:7px;">Puntos</th><th style="padding:7px;">Respaldo ARS</th></tr></thead><tbody>' +
          (backRows || '<tr><td colspan="6" style="padding:12px;">Sin asientos contables registrados aún.</td></tr>') +
          '</tbody></table>' +
        '</div>';

      bindCommonDetailEvents(body);
      var fPkg = document.getElementById('cf-pkg-form');
      if (fPkg) {
        fPkg.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(fPkg);
          var res = await apiCf('POST', {
            action: 'upsert_point_package',
            code: fd.get('code'),
            name: fd.get('name'),
            pointsAmount: fd.get('pointsAmount'),
            unitPriceArs: fd.get('unitPriceArs')
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Paquete guardado.';
          await reloadData();
          renderDetailView('puntos');
        });
      }
      var fCred = document.getElementById('cf-credit-pts-form');
      if (fCred) {
        fCred.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var fd = new FormData(fCred);
          var res = await apiCf('POST', {
            action: 'purchase_merchant_points',
            merchantId: fd.get('merchantId'),
            pointsAmount: fd.get('pointsAmount'),
            purchaseMode: fd.get('purchaseMode'),
            invoiceNumber: fd.get('invoiceNumber')
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Puntos acreditados.';
          await reloadData();
          renderDetailView('puntos');
        });
      }
      return;
    }

    // 7. CAMPAÑAS Y REGLAS
    if (viewKey === 'campanas') {
      var campRows = (d.campaigns || []).map(function (c) {
        var nextSt = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        return '<tr style="border-bottom:1px solid #eee;">' +
          '<td style="padding:8px;"><strong>' + esc(c.name) + '</strong><br><small>' + esc(c.merchant ? c.merchant.tradeName : '—') + ' · ' + esc(c.program ? c.program.name : '') + '</small></td>' +
          '<td style="padding:8px;"><code>' + esc(c.ruleBehavior) + '</code> · Prioridad ' + esc(c.priority) + (c.isExclusive ? ' (Excluyente)' : '') + '</td>' +
          '<td style="padding:8px;">' +
            (c.multiplier ? 'x' + esc(c.multiplier) + ' ' : '') +
            (c.bonusAccrualPct ? '+' + esc(c.bonusAccrualPct) + '% ' : '') +
            (c.fixedBonusPoints ? '+' + fmtPts.format(Number(c.fixedBonusPoints)) + ' pts' : '') +
          '</td>' +
          '<td style="padding:8px;font-size:12px;">' + esc(fmtDate(c.startsAt)) + ' → ' + esc(fmtDate(c.endsAt)) + '</td>' +
          '<td style="padding:8px;font-weight:800;">' + esc(c.status) + '</td>' +
          '<td style="padding:8px;"><button type="button" data-camp-id="' + esc(c.id) + '" data-camp-next="' + nextSt + '" style="' + btnMintStyle() + 'padding:5px 10px;">' + (c.status === 'ACTIVE' ? 'Pausar' : 'Activar') + '</button></td>' +
        '</tr>';
      }).join('');

      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="' + cardStyle() + 'overflow:auto;">' +
          '<h3 style="margin:0 0 12px;color:#112D3A;">Campañas y Promociones de Acumulación (' + (d.campaigns || []).length + ')</h3>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Campaña / Comercio</th><th style="padding:8px;">Comportamiento</th><th style="padding:8px;">Beneficio</th><th style="padding:8px;">Vigencia</th><th style="padding:8px;">Estado</th><th style="padding:8px;">Acción</th></tr></thead><tbody>' +
          (campRows || '<tr><td colspan="6" style="padding:14px;">Sin campañas creadas por comercios aún.</td></tr>') +
          '</tbody></table>' +
        '</div>';

      bindCommonDetailEvents(body);
      body.querySelectorAll('[data-camp-id]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var res = await apiCf('POST', {
            action: 'toggle_campaign_status',
            campaignId: btn.getAttribute('data-camp-id'),
            status: btn.getAttribute('data-camp-next')
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Campaña actualizada.';
          await reloadData();
          renderDetailView('campanas');
        });
      });
      return;
    }

    // 8. CATÁLOGO DE CANJES
    if (viewKey === 'catalogo') {
      var catRows = (d.catalogItems || []).map(function (it) {
        var refArs = Number(it.referencePriceArs || 0);
        var mkPct = it.markupPctOverride != null ? Number(it.markupPctOverride) : Number((it.program && it.program.defaultProductMarkupPct) || 12);
        var redArsPt = Number((it.program && it.program.redemptionArsPerPoint) || 1) || 1;
        var compArs = refArs * (1 + mkPct / 100);
        var reqPts = Math.ceil(compArs / redArsPt);
        return '<tr style="border-bottom:1px solid #eee;">' +
          '<td style="padding:8px;"><strong>' + esc(it.name) + '</strong><br><small>' + esc(it.merchant ? it.merchant.tradeName : '—') + ' · ' + esc(it.category) + '</small></td>' +
          '<td style="padding:8px;">' + fmtArs.format(refArs) + ' <small>(+' + esc(mkPct) + '%)</small></td>' +
          '<td style="padding:8px;font-weight:900;color:#112D3A;">' + fmtPts.format(reqPts) + ' pts</td>' +
          '<td style="padding:8px;">Disp: ' + esc(it.stockQuantity) + ' (Res: ' + esc(it.reservedStock) + ')</td>' +
          '<td style="padding:8px;">' + (it.isActive ? '<span style="color:#065f46;font-weight:800;">Publicado</span>' : '<span style="color:#991b1b;font-weight:800;">Pausado</span>') + '</td>' +
          '<td style="padding:8px;"><button type="button" data-cat-id="' + esc(it.id) + '" data-cat-next="' + (!it.isActive) + '" style="' + btnMintStyle() + 'padding:5px 10px;">' + (it.isActive ? 'Pausar' : 'Publicar') + '</button></td>' +
        '</tr>';
      }).join('');

      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="' + cardStyle() + 'overflow:auto;">' +
          '<h3 style="margin:0 0 12px;color:#112D3A;">Catálogo Global de Productos y Beneficios Canjeables (' + (d.catalogItems || []).length + ')</h3>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Producto / Comercio</th><th style="padding:8px;">Precio Ref. + Recargo</th><th style="padding:8px;">Puntos Requeridos</th><th style="padding:8px;">Stock</th><th style="padding:8px;">Estado</th><th style="padding:8px;">Acción</th></tr></thead><tbody>' +
          (catRows || '<tr><td colspan="6" style="padding:14px;">Todavía no hay beneficios cargados en el catálogo.</td></tr>') +
          '</tbody></table>' +
        '</div>';

      bindCommonDetailEvents(body);
      body.querySelectorAll('[data-cat-id]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var res = await apiCf('POST', {
            action: 'toggle_catalog_item',
            itemId: btn.getAttribute('data-cat-id'),
            isActive: btn.getAttribute('data-cat-next') === 'true'
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Actualizado.';
          await reloadData();
          renderDetailView('catalogo');
        });
      });
      return;
    }

    // 9. ÓRDENES Y RETIROS QR
    if (viewKey === 'ordenes') {
      var oRows = (d.orders || []).map(function (o) {
        var itemsTxt = (o.items || []).map(function (i) { return i.quantity + 'x ' + i.itemNameSnapshot; }).join(', ');
        return '<tr style="border-bottom:1px solid #eee;">' +
          '<td style="padding:8px;"><strong>' + esc(o.orderCode) + '</strong><br><small>' + esc(fmtDate(o.createdAt)) + '</small></td>' +
          '<td style="padding:8px;">' + esc(o.user ? o.user.name : '—') + '<br><small>' + esc(o.user ? o.user.email : '') + '</small></td>' +
          '<td style="padding:8px;">' + esc(o.merchant ? o.merchant.tradeName : '—') + '<br><small>' + esc(itemsTxt) + '</small></td>' +
          '<td style="padding:8px;font-weight:900;color:#112D3A;">' + fmtPts.format(Number(o.totalPoints || 0)) + ' pts</td>' +
          '<td style="padding:8px;"><code>' + esc(o.pickupCodeDisplay) + '</code></td>' +
          '<td style="padding:8px;font-weight:800;">' + esc(o.status) + '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="' + cardStyle() + 'overflow:auto;">' +
          '<h3 style="margin:0 0 12px;color:#112D3A;">Órdenes de Entrega con QR de Un Solo Uso (' + (d.orders || []).length + ')</h3>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Orden</th><th style="padding:8px;">Socio</th><th style="padding:8px;">Comercio / Ítems</th><th style="padding:8px;">Puntos</th><th style="padding:8px;">Código Retiro</th><th style="padding:8px;">Estado</th></tr></thead><tbody>' +
          (oRows || '<tr><td colspan="6" style="padding:14px;">Sin órdenes de canje registradas aún.</td></tr>') +
          '</tbody></table>' +
        '</div>';
      bindCommonDetailEvents(body);
      return;
    }

    // 10. LIQUIDACIONES DE RED
    if (viewKey === 'liquidaciones') {
      var bRows = (d.settlementBatches || []).map(function (b) {
        return '<tr style="border-bottom:1px solid #eee;">' +
          '<td style="padding:8px;"><strong>' + esc(b.batchCode) + '</strong><br><small>' + esc(b.periodType) + ' · ' + esc(fmtDate(b.createdAt)) + '</small></td>' +
          '<td style="padding:8px;">' + fmtArs.format(Number(b.totalGrossArs || 0)) + '</td>' +
          '<td style="padding:8px;">' + fmtArs.format(Number(b.totalPlatformFeeArs || 0)) + '</td>' +
          '<td style="padding:8px;font-weight:900;color:#112D3A;">' + fmtArs.format(Number(b.totalNetMerchantArs || 0)) + '</td>' +
          '<td style="padding:8px;font-weight:800;">' + esc(b.status) + '</td>' +
          '<td style="padding:8px;">' +
            (b.status === 'RECONCILED' ? '<button type="button" data-liq-id="' + esc(b.id) + '" data-liq-st="APPROVED" style="' + btnMintStyle() + 'margin-right:6px;">Aprobar</button>' : '') +
            (b.status === 'APPROVED' || b.status === 'RECONCILED' ? '<button type="button" data-liq-id="' + esc(b.id) + '" data-liq-st="PAID" style="' + btnPrimaryStyle() + 'padding:6px 10px;">Registrar Pago</button>' : '') +
          '</td>' +
        '</tr>';
      }).join('');

      var compRows = (d.pendingCompensations || []).map(function (c) {
        return '<tr style="border-bottom:1px solid #eee;">' +
          '<td style="padding:7px;">' + esc(fmtDate(c.createdAt)) + '</td>' +
          '<td style="padding:7px;">' + esc(c.fundingMerchant ? c.fundingMerchant.tradeName : '—') + '</td>' +
          '<td style="padding:7px;">' + esc(c.redeemingMerchant ? c.redeemingMerchant.tradeName : '—') + '</td>' +
          '<td style="padding:7px;">' + fmtPts.format(Number(c.pointsUsed || 0)) + ' pts</td>' +
          '<td style="padding:7px;font-weight:800;">' + fmtArs.format(Number(c.netRecognizedToRedeemerArs || 0)) + '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="' + cardStyle() + 'margin-bottom:16px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;">' +
          '<div>' +
            '<h3 style="margin:0;color:#112D3A;">Conciliación y Liquidación entre Comercios Emisores y Receptores</h3>' +
            '<div style="font-size:12.5px;color:#475569;margin-top:4px;">Compensaciones pendientes de lote: <strong>' + esc((d.pendingCompensations || []).length) + '</strong> (' + fmtArs.format(Number(k.pendingSettlementArs || 0)) + ')</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;align-items:center;">' +
            '<select id="cf-liq-period" style="padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;"><option value="MONTHLY">Mensual</option><option value="BIWEEKLY">Quincenal</option><option value="WEEKLY">Semanal</option></select>' +
            '<button type="button" id="cf-create-liq-btn" style="' + btnPrimaryStyle() + '">Conciliar Lote Ahora</button>' +
          '</div>' +
        '</div>' +
        '<div style="' + cardStyle() + 'overflow:auto;margin-bottom:16px;">' +
          '<h4 style="margin:0 0 10px;color:#112D3A;">Lotes de Liquidación Emitidos</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Lote</th><th style="padding:8px;">Respaldo Bruto</th><th style="padding:8px;">Comisión Club Fidel</th><th style="padding:8px;">Neto Comercios</th><th style="padding:8px;">Estado</th><th style="padding:8px;">Acción</th></tr></thead><tbody>' +
          (bRows || '<tr><td colspan="6" style="padding:12px;">Sin lotes emitidos aún.</td></tr>') +
          '</tbody></table>' +
        '</div>' +
        '<div style="' + cardStyle() + 'overflow:auto;">' +
          '<h4 style="margin:0 0 10px;color:#112D3A;">Compensaciones Individuales Pendientes</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:7px;">Fecha</th><th style="padding:7px;">Comercio Financiador</th><th style="padding:7px;">Comercio Receptor</th><th style="padding:7px;">Puntos</th><th style="padding:7px;">Neto a Liquidar</th></tr></thead><tbody>' +
          (compRows || '<tr><td colspan="5" style="padding:12px;">Sin compensaciones pendientes.</td></tr>') +
          '</tbody></table>' +
        '</div>';

      bindCommonDetailEvents(body);
      var btnLiq = document.getElementById('cf-create-liq-btn');
      if (btnLiq) {
        btnLiq.addEventListener('click', async function () {
          var per = document.getElementById('cf-liq-period').value;
          var res = await apiCf('POST', { action: 'create_settlement_batch', periodType: per });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && (res.message || res.error)) || 'Procesado.';
          await reloadData();
          renderDetailView('liquidaciones');
        });
      }
      body.querySelectorAll('[data-liq-id]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var res = await apiCf('POST', {
            action: 'update_settlement_status',
            batchId: btn.getAttribute('data-liq-id'),
            nextStatus: btn.getAttribute('data-liq-st')
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'Estado actualizado.';
          await reloadData();
          renderDetailView('liquidaciones');
        });
      });
      return;
    }

    // 11. INTEGRACIÓN ERP Y POS
    if (viewKey === 'integracion_erp') {
      var keyRows = [];
      merchants.forEach(function (m) {
        (m.erpApiKeys || []).forEach(function (ek) {
          keyRows.push(
            '<tr style="border-bottom:1px solid #eee;">' +
              '<td style="padding:8px;"><strong>' + esc(m.tradeName) + '</strong></td>' +
              '<td style="padding:8px;">' + esc(ek.name) + '</td>' +
              '<td style="padding:8px;"><code>' + esc(ek.keyPrefix) + '••••••••</code></td>' +
              '<td style="padding:8px;">' + esc(fmtDate(ek.lastUsedAt)) + '</td>' +
              '<td style="padding:8px;">' + (ek.isActive ? '<span style="color:#065f46;font-weight:800;">Activa</span>' : '<span style="color:#991b1b;">Revocada</span>') + '</td>' +
              '<td style="padding:8px;">' + (ek.isActive ? '<button type="button" data-rev-key="' + esc(ek.id) + '" style="padding:5px 10px;border:1px solid #991b1b;border-radius:6px;background:#fff;color:#991b1b;font-size:12px;font-weight:700;cursor:pointer;">Revocar</button>' : '—') + '</td>' +
            '</tr>'
          );
        });
      });

      var erpTxRows = (d.erpTransactions || []).slice(0, 50).map(function (t) {
        return '<tr style="border-bottom:1px solid #eee;">' +
          '<td style="padding:7px;">' + esc(fmtDate(t.createdAt)) + '</td>' +
          '<td style="padding:7px;">' + esc(t.merchant ? t.merchant.tradeName : '—') + '</td>' +
          '<td style="padding:7px;"><code>' + esc(t.externalTxId) + '</code></td>' +
          '<td style="padding:7px;">' + esc(t.operationType) + '</td>' +
          '<td style="padding:7px;">' + fmtArs.format(Number(t.amountArs || 0)) + '</td>' +
          '<td style="padding:7px;font-weight:800;">' + fmtPts.format(Number(t.pointsCalculated || 0)) + ' pts</td>' +
          '<td style="padding:7px;">' + esc(t.status) + '</td>' +
        '</tr>';
      }).join('');

      body.innerHTML =
        renderFeedbackBanner() +
        '<div style="' + cardStyle() + 'margin-bottom:16px;">' +
          '<h3 style="margin:0 0 8px;color:#112D3A;">Endpoints REST v1 para Sistemas ERP, POS y E-Commerce</h3>' +
          '<div style="font-size:12.5px;color:#334155;display:grid;gap:4px;">' +
            '<div>• Acreditación idempotente de compras: <code>POST ' + esc(appUrl) + '/api/v1/erp/purchases</code> (Header <code>X-Api-Key: cf_live_...</code>)</div>' +
            '<div>• Anulación / Nota de Crédito: <code>POST ' + esc(appUrl) + '/api/v1/erp/reversals</code></div>' +
          '</div>' +
        '</div>' +
        '<div style="' + cardStyle() + 'overflow:auto;margin-bottom:16px;">' +
          '<h4 style="margin:0 0 10px;color:#112D3A;">API Keys Emitidas por Comercio</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:8px;">Comercio</th><th style="padding:8px;">Etiqueta</th><th style="padding:8px;">Prefijo</th><th style="padding:8px;">Último Uso</th><th style="padding:8px;">Estado</th><th style="padding:8px;">Acción</th></tr></thead><tbody>' +
          (keyRows.join('') || '<tr><td colspan="6" style="padding:12px;">Todavía no se emitieron API Keys ERP.</td></tr>') +
          '</tbody></table>' +
        '</div>' +
        '<div style="' + cardStyle() + 'overflow:auto;">' +
          '<h4 style="margin:0 0 10px;color:#112D3A;">Bitácora de Transacciones ERP / POS</h4>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:7px;">Fecha</th><th style="padding:7px;">Comercio</th><th style="padding:7px;">Comprobante</th><th style="padding:7px;">Operación</th><th style="padding:7px;">Importe</th><th style="padding:7px;">Puntos</th><th style="padding:7px;">Estado</th></tr></thead><tbody>' +
          (erpTxRows || '<tr><td colspan="7" style="padding:12px;">Sin transacciones ERP registradas aún.</td></tr>') +
          '</tbody></table>' +
        '</div>';

      bindCommonDetailEvents(body);
      body.querySelectorAll('[data-rev-key]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var res = await apiCf('POST', {
            action: 'revoke_erp_api_key',
            keyId: btn.getAttribute('data-rev-key')
          });
          STATE.isError = !(res && res.ok);
          STATE.feedback = (res && res.message) || 'API Key revocada.';
          await reloadData();
          renderDetailView('integracion_erp');
        });
      });
      return;
    }

    // 12. CONFIGURACIÓN GLOBAL, AUTOMATIZACIONES FIFO Y AUDITORÍA
    var cfg = d.platformConfig || {};
    var adminsRows = (d.admins || []).map(function (a) {
      return '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:#f1f5f9;font-size:12px;font-weight:700;color:#112D3A;">' + esc(a.email) + ' <strong style="color:#0f766e;">(' + esc(a.role) + ')</strong></span>';
    }).join(' ');

    var auditRows = (d.auditLogs || []).slice(0, 40).map(function (l) {
      return '<tr style="border-bottom:1px solid #eee;">' +
        '<td style="padding:7px;">' + esc(fmtDate(l.createdAt)) + '</td>' +
        '<td style="padding:7px;"><code>' + esc(l.action) + '</code></td>' +
        '<td style="padding:7px;">' + esc(l.entityType) + ' (' + esc(l.entityId) + ')</td>' +
        '<td style="padding:7px;">' + esc(l.actorEmail || 'Sistema') + '</td>' +
      '</tr>';
    }).join('');

    body.innerHTML =
      renderFeedbackBanner() +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:16px;">' +
        '<div style="' + cardStyle() + '">' +
          '<h3 style="margin:0 0 10px;color:#112D3A;">Parámetros Comerciales Globales (Cero Hardcodeo)</h3>' +
          '<form id="cf-global-cfg-form" style="display:grid;gap:9px;">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
              '<label style="font-size:12px;font-weight:700;">Precio Compra Punto Base (ARS)<input name="defaultPointPurchasePriceArs" type="number" step="0.01" value="' + esc(cfg.defaultPointPurchasePriceArs || 1) + '" style="' + inputStyle() + '"></label>' +
              '<label style="font-size:12px;font-weight:700;">Comisión Plataforma (%)<input name="defaultPlatformCommissionPct" type="number" step="0.1" value="' + esc(cfg.defaultPlatformCommissionPct || 5) + '" style="' + inputStyle() + '"></label>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' +
              '<label style="font-size:12px;font-weight:700;">% Acum. Sugerido<input name="defaultAccrualPct" type="number" step="0.1" value="' + esc(cfg.defaultAccrualPct || 1) + '" style="' + inputStyle() + '"></label>' +
              '<label style="font-size:12px;font-weight:700;">ARS/pt Emisión<input name="defaultIssuanceArsPerPoint" type="number" step="0.01" value="' + esc(cfg.defaultIssuanceArsPerPoint || 1) + '" style="' + inputStyle() + '"></label>' +
              '<label style="font-size:12px;font-weight:700;">ARS/pt Canje<input name="defaultRedemptionArsPerPoint" type="number" step="0.01" value="' + esc(cfg.defaultRedemptionArsPerPoint || 1) + '" style="' + inputStyle() + '"></label>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' +
              '<label style="font-size:12px;font-weight:700;">Recargo Canje (%)<input name="defaultProductMarkupPct" type="number" step="0.5" value="' + esc(cfg.defaultProductMarkupPct || 12) + '" style="' + inputStyle() + '"></label>' +
              '<label style="font-size:12px;font-weight:700;">Clearing Red (%)<input name="defaultNetworkClearingFeePct" type="number" step="0.1" value="' + esc(cfg.defaultNetworkClearingFeePct || 4) + '" style="' + inputStyle() + '"></label>' +
              '<label style="font-size:12px;font-weight:700;">Tope Vigencia (≤365d)<input name="maxPointValidityDays" type="number" min="1" max="365" value="' + esc(cfg.maxPointValidityDays || 365) + '" style="' + inputStyle() + '"></label>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
              '<label style="font-size:12px;font-weight:700;">Email Soporte<input name="supportEmail" type="email" value="' + esc(cfg.supportEmail || 'soporte@clubfidel.com.ar') + '" style="' + inputStyle() + '"></label>' +
              '<label style="font-size:12px;font-weight:700;">Teléfono / WhatsApp<input name="supportPhone" value="' + esc(cfg.supportPhone || '') + '" style="' + inputStyle() + '"></label>' +
            '</div>' +
            '<button type="submit" style="' + btnPrimaryStyle() + '">Guardar Parámetros Globales</button>' +
          '</form>' +
        '</div>' +
        '<div style="display:grid;gap:16px;">' +
          '<div style="' + cardStyle() + '">' +
            '<h3 style="margin:0 0 8px;color:#112D3A;">Ejecución Manual de Procesos Automáticos (Regla 4)</h3>' +
            '<p style="margin:0 0 12px;font-size:12.5px;color:#475569;">Además de los crons diarios en Vercel, podés disparar en cualquier momento el barrido FIFO de vencimientos y las alertas preventivas (30, 15, 7 y 1 día).</p>' +
            '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
              '<button type="button" id="cf-run-expire-btn" style="' + btnPrimaryStyle() + '">Ejecutar Caducidad FIFO Ahora</button>' +
              '<button type="button" id="cf-run-alerts-btn" style="' + btnMintStyle() + '">Despachar Avisos de Vencimiento</button>' +
            '</div>' +
          '</div>' +
          '<div style="' + cardStyle() + '">' +
            '<h3 style="margin:0 0 8px;color:#112D3A;">Administradores Autorizados en /admin</h3>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">' + adminsRows + '</div>' +
            '<form id="cf-grant-admin-form" style="display:grid;grid-template-columns:1.4fr 1fr auto;gap:8px;align-items:end;">' +
              '<input name="email" type="email" required placeholder="correo@dominio.com" style="' + inputStyle() + '">' +
              '<select name="role" style="' + inputStyle() + '"><option value="SUPERADMIN">SUPERADMIN</option><option value="FINANCE">FINANCE</option><option value="OPERATIONS">OPERATIONS</option><option value="SUPPORT">SUPPORT</option></select>' +
              '<button type="submit" style="' + btnMintStyle() + 'padding:9px 12px;">Autorizar</button>' +
            '</form>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="' + cardStyle() + 'overflow:auto;">' +
        '<h4 style="margin:0 0 10px;color:#112D3A;">Auditoría Institucional Reciente</h4>' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:7px;">Fecha</th><th style="padding:7px;">Acción</th><th style="padding:7px;">Entidad</th><th style="padding:7px;">Actor</th></tr></thead><tbody>' +
        (auditRows || '<tr><td colspan="4" style="padding:12px;">Sin eventos auditados aún.</td></tr>') +
        '</tbody></table>' +
      '</div>';

    bindCommonDetailEvents(body);

    var fCfg = document.getElementById('cf-global-cfg-form');
    if (fCfg) {
      fCfg.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(fCfg);
        var res = await apiCf('POST', {
          action: 'update_platform_config',
          defaultPointPurchasePriceArs: fd.get('defaultPointPurchasePriceArs'),
          defaultPlatformCommissionPct: fd.get('defaultPlatformCommissionPct'),
          defaultAccrualPct: fd.get('defaultAccrualPct'),
          defaultIssuanceArsPerPoint: fd.get('defaultIssuanceArsPerPoint'),
          defaultRedemptionArsPerPoint: fd.get('defaultRedemptionArsPerPoint'),
          defaultProductMarkupPct: fd.get('defaultProductMarkupPct'),
          defaultNetworkClearingFeePct: fd.get('defaultNetworkClearingFeePct'),
          maxPointValidityDays: Number(fd.get('maxPointValidityDays') || 365),
          defaultPointValidityDays: Number(fd.get('maxPointValidityDays') || 365),
          supportEmail: fd.get('supportEmail'),
          supportPhone: fd.get('supportPhone')
        });
        STATE.isError = !(res && res.ok);
        STATE.feedback = (res && res.message) || 'Configuración guardada.';
        await reloadData();
        renderDetailView('configuracion');
      });
    }

    var btnExp = document.getElementById('cf-run-expire-btn');
    if (btnExp) {
      btnExp.addEventListener('click', async function () {
        var res = await apiCf('POST', { action: 'run_expire_points' });
        STATE.isError = !(res && res.ok);
        STATE.feedback = (res && res.message) || 'Ejecutado.';
        await reloadData();
        renderDetailView('configuracion');
      });
    }

    var btnAlt = document.getElementById('cf-run-alerts-btn');
    if (btnAlt) {
      btnAlt.addEventListener('click', async function () {
        var res = await apiCf('POST', { action: 'run_expiry_alerts' });
        STATE.isError = !(res && res.ok);
        STATE.feedback = (res && res.message) || 'Alertas despachadas.';
        await reloadData();
        renderDetailView('configuracion');
      });
    }

    var fAdm = document.getElementById('cf-grant-admin-form');
    if (fAdm) {
      fAdm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(fAdm);
        var res = await apiCf('POST', {
          action: 'grant_admin_role',
          email: fd.get('email'),
          role: fd.get('role')
        });
        STATE.isError = !(res && res.ok);
        STATE.feedback = (res && res.message) || 'Rol autorizado.';
        await reloadData();
        renderDetailView('configuracion');
      });
    }
  }

  async function openClubFidelView(viewKey) {
    var secs = ensureSections();
    if (!secs) return;
    STATE.view = viewKey || 'menu';
    hideAllErpSections();

    var backTopBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backTopBtn) {
      backTopBtn.hidden = false;
      backTopBtn.textContent = '← Atrás';
    }
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    var subs = getActiveSubmodules();
    var meta = subs.find(function (s) { return s.key === STATE.view; });
    if (topbarModInd) {
      topbarModInd.hidden = false;
      topbarModInd.textContent =
        STATE.view === 'menu'
          ? 'Club Fidel'
          : 'Club Fidel · ' + (meta ? meta.label : STATE.view);
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

  function syncClubFidelHomeCard() {
    bindGlobalNavIntegration();
    var allowed = isAllowedForCurrentUser();
    var grid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-clubfidel-home-card');

    if (allowed && grid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-clubfidel-home-card';
      card.className = 'module-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>' +
          '</svg>' +
        '</div>' +
        '<h3>Club Fidel</h3>';

      card.addEventListener('click', function () {
        openClubFidelView('menu');
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openClubFidelView('menu');
        }
      });

      var anchorCard =
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

  setInterval(syncClubFidelHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncClubFidelHomeCard);
})();
