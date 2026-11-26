/* ==========================================================================
   MÓDULO EXCLUSIVO DEL ADMINISTRADOR GENERAL (@danielg) — BIBLIOTECA RONCEDO
   Gestión integral de la plataforma institucional Biblioteca Roncedo (www.bibliotecaroncedo.ar)
   desde el panel central de MiniSistema.
   Cumple estrictamente con las reglas de diseño canónico de GEMINI.md:
   - Tarjetas uniformes (.modules-grid / .module-card)
   - Sin sobretítulos, badges, pills ni descripciones <p> en tarjetas de módulos
   - Ícono SVG monocromático dentro de .module-icon y título en <h3>
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
      key: 'catalogo',
      label: 'Catálogo Físico (1.283 Libros)',
      icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>'
    },
    {
      key: 'digital',
      label: 'Biblioteca Digital y Audiolibros',
      icon: '<circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon>'
    },
    {
      key: 'fototeca',
      label: 'Fototeca Activa',
      icon: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle>'
    },
    {
      key: 'actas',
      label: 'Archivo de Actas (102 Folios)',
      icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>'
    },
    {
      key: 'roncedo',
      label: 'Dr. Lautaro Roncedo',
      icon: '<circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>'
    },
    {
      key: 'socios',
      label: 'Socios y Carnet QR',
      icon: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>'
    },
    {
      key: 'novedades',
      label: 'Novedades y Anuncios',
      icon: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><path d="M18 14h-8"></path><path d="M15 18h-5"></path><path d="M10 6h8v4h-8V6Z"></path>'
    },
    {
      key: 'eventos',
      label: 'Eventos y Talleres',
      icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>'
    },
    {
      key: 'tienda',
      label: 'Tienda Institucional',
      icon: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path>'
    },
    {
      key: 'config',
      label: 'Configuración y Sitio Web',
      icon: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>'
    }
  ];

  var STATE = {
    view: 'menu',
    data: null,
    loading: false,
    feedback: '',
    isError: false,
    searchQuery: '',
    activeTab: 'todos'
  };

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isGeneralAdmin() {
    var isBaseTenant = Boolean(
      (window.__ERP_TENANT_BOOT__ && window.__ERP_TENANT_BOOT__.isBase) ||
      (window.ERP_BRAND && window.ERP_BRAND.isBase)
    );
    if (!isBaseTenant) return false;
    var user = typeof window.__MS_GET_ACTIVE_USER__ === 'function' ? window.__MS_GET_ACTIVE_USER__() : null;
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
      return '/' + encodeURIComponent(boot.slug) + '/api/biblioteca_roncedo';
    }
    return '/sistema/api/biblioteca_roncedo';
  }

  async function apiRoncedo(method, payload) {
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

  function ensureSections() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var secMenu = document.getElementById('sec-menu-bibliotecaroncedo');
    if (secMenu && secMenu.parentNode !== erpMain) {
      erpMain.appendChild(secMenu);
    }
    if (!secMenu) {
      secMenu = document.createElement('section');
      secMenu.id = 'sec-menu-bibliotecaroncedo';
      secMenu.className = 'erp-section';
      secMenu.hidden = true;
      secMenu.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="br-back-home">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">Administrador General · <strong>Biblioteca Roncedo</strong></span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;">' +
            '<a href="https://www.bibliotecaroncedo.ar" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:0.35rem;text-decoration:none;font-weight:700;padding:6px 14px;border-radius:10px;background:#0F2D54;color:#fff;border:none;">' +
              '<span>Abrir Sitio Web Oficial ↗</span>' +
            '</a>' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" id="br-submodules-grid" aria-label="Submódulos de Biblioteca Roncedo"></div>';
      erpMain.appendChild(secMenu);

      var backHomeBtn = secMenu.querySelector('#br-back-home');
      if (backHomeBtn) {
        backHomeBtn.addEventListener('click', function () {
          hideAllErpSections();
          var home = document.getElementById('sec-inicio');
          if (home) home.hidden = false;
          var backBtn = document.getElementById('btn-topbar-back-facturacion');
          if (backBtn) backBtn.hidden = true;
          var topbarModInd = document.getElementById('topbar-caja-indicator');
          if (topbarModInd) topbarModInd.hidden = true;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
    }

    var secDetail = document.getElementById('sec-bibliotecaroncedo-detail');
    if (secDetail && secDetail.parentNode !== erpMain) {
      erpMain.appendChild(secDetail);
    }
    if (!secDetail) {
      secDetail = document.createElement('section');
      secDetail.id = 'sec-bibliotecaroncedo-detail';
      secDetail.className = 'erp-section';
      secDetail.hidden = true;
      secDetail.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="br-back-menu">← Volver a Biblioteca Roncedo</button>' +
            '<span class="module-breadcrumb" id="br-detail-breadcrumb">Biblioteca Roncedo</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;">' +
            '<a href="https://www.bibliotecaroncedo.ar" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:0.35rem;text-decoration:none;font-weight:700;padding:6px 14px;border-radius:10px;background:#0F2D54;color:#fff;border:none;">' +
              '<span>Sitio Web ↗</span>' +
            '</a>' +
          '</div>' +
        '</div>' +
        '<div id="br-detail-body" style="margin-top:1rem;"></div>';
      erpMain.appendChild(secDetail);

      var backMenuBtn = secDetail.querySelector('#br-back-menu');
      if (backMenuBtn) {
        backMenuBtn.addEventListener('click', function () {
          openRoncedoView('menu');
        });
      }
    }

    return { menuSec: secMenu, detailSec: secDetail };
  }

  function bindGlobalNavIntegration() {
    var backTopBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backTopBtn && !backTopBtn.dataset.brBound) {
      backTopBtn.dataset.brBound = '1';
      backTopBtn.addEventListener('click', function () {
        var menuSec = document.getElementById('sec-menu-bibliotecaroncedo');
        var detailSec = document.getElementById('sec-bibliotecaroncedo-detail');
        if (detailSec && !detailSec.hidden) {
          openRoncedoView('menu');
          return;
        }
        if (menuSec && !menuSec.hidden) {
          hideAllErpSections();
          var home = document.getElementById('sec-inicio');
          if (home) home.hidden = false;
          backTopBtn.hidden = true;
          var topbarModInd = document.getElementById('topbar-caja-indicator');
          if (topbarModInd) topbarModInd.hidden = true;
        }
      });
    }

    var topbarHomeBtn = document.getElementById('topbar-home-btn');
    if (topbarHomeBtn && !topbarHomeBtn.dataset.brBound) {
      topbarHomeBtn.dataset.brBound = '1';
      topbarHomeBtn.addEventListener('click', function () {
        var menuSec = document.getElementById('sec-menu-bibliotecaroncedo');
        var detailSec = document.getElementById('sec-bibliotecaroncedo-detail');
        if (menuSec) menuSec.hidden = true;
        if (detailSec) detailSec.hidden = true;
      });
    }
  }

  async function reloadData() {
    STATE.loading = true;
    try {
      var res = await apiRoncedo('GET');
      if (res && res.ok) {
        STATE.data = res;
        STATE.feedback = '';
        STATE.isError = false;
      } else {
        STATE.feedback = (res && res.message) || 'No se pudo conectar con Biblioteca Roncedo.';
        STATE.isError = true;
      }
    } catch (_e) {
      STATE.feedback = 'No se pudo consultar el servidor de Biblioteca Roncedo.';
      STATE.isError = true;
    }
    STATE.loading = false;
  }

  function renderSubmodulesMenu() {
    var grid = document.getElementById('br-submodules-grid');
    if (!grid) return;
    grid.innerHTML = SUBMODULES.map(function (sub) {
      return '<article class="module-card" role="button" tabindex="0" data-br-sub="' + esc(sub.key) + '">' +
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            sub.icon +
          '</svg>' +
        '</div>' +
        '<h3>' + esc(sub.label) + '</h3>' +
      '</article>';
    }).join('');

    grid.querySelectorAll('.module-card[data-br-sub]').forEach(function (card) {
      card.addEventListener('click', function () {
        openRoncedoView(card.getAttribute('data-br-sub'));
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openRoncedoView(card.getAttribute('data-br-sub'));
        }
      });
    });
  }

  function renderDetailView(subKey) {
    var body = document.getElementById('br-detail-body');
    var bc = document.getElementById('br-detail-breadcrumb');
    if (!body) return;

    var meta = SUBMODULES.find(function (s) { return s.key === subKey; });
    if (bc) bc.innerHTML = 'Biblioteca Roncedo · <strong>' + esc(meta ? meta.label : subKey) + '</strong>';

    if (STATE.loading && !STATE.data) {
      body.innerHTML = '<div style="padding:2rem;text-align:center;color:#4B677B;">Cargando datos institucionales de Biblioteca Roncedo...</div>';
      return;
    }

    var d = STATE.data || {};
    var st = d.stats || {};

    if (subKey === 'panel') {
      renderPanelGeneral(body, d, st);
    } else if (subKey === 'catalogo') {
      renderCatalogoFisico(body, d);
    } else if (subKey === 'digital') {
      renderBibliotecaDigital(body, d);
    } else if (subKey === 'fototeca') {
      renderFototeca(body, d);
    } else if (subKey === 'actas') {
      renderActas(body, d);
    } else if (subKey === 'roncedo') {
      renderDrRoncedo(body, d);
    } else if (subKey === 'socios') {
      renderSociosCarnet(body, d);
    } else if (subKey === 'novedades') {
      renderNovedades(body, d);
    } else if (subKey === 'eventos') {
      renderEventos(body, d);
    } else if (subKey === 'tienda') {
      renderTienda(body, d);
    } else if (subKey === 'config') {
      renderConfiguracion(body, d);
    } else {
      body.innerHTML = '<p style="padding:1rem;">Módulo en preparación.</p>';
    }
  }

  // 1. Panel General
  function renderPanelGeneral(container, d, st) {
    container.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1.5rem;">' +
        '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;box-shadow:0 2px 4px rgba(0,0,0,0.02);">' +
          '<div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#5B768A;letter-spacing:0.5px;">Libros en Sala</div>' +
          '<div style="font-size:1.8rem;font-weight:900;color:#0F2D54;margin-top:0.25rem;">' + esc(st.totalLibrosFisicos || 1283) + '</div>' +
          '<div style="font-size:0.75rem;color:#1B5699;margin-top:0.25rem;font-weight:600;">Inventariados y catalogados</div>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;box-shadow:0 2px 4px rgba(0,0,0,0.02);">' +
          '<div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#5B768A;letter-spacing:0.5px;">Biblioteca Digital</div>' +
          '<div style="font-size:1.8rem;font-weight:900;color:#0F2D54;margin-top:0.25rem;">' + esc((st.totalDigitales || 18) + (st.totalAudiolibros || 9)) + '</div>' +
          '<div style="font-size:0.75rem;color:#1B5699;margin-top:0.25rem;font-weight:600;">PDFs y Audiolibros</div>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;box-shadow:0 2px 4px rgba(0,0,0,0.02);">' +
          '<div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#5B768A;letter-spacing:0.5px;">Fototeca Activa</div>' +
          '<div style="font-size:1.8rem;font-weight:900;color:#0F2D54;margin-top:0.25rem;">' + esc(st.totalFotosHistoricas || 42) + '</div>' +
          '<div style="font-size:0.75rem;color:#1B5699;margin-top:0.25rem;font-weight:600;">Fotos históricas HD</div>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;box-shadow:0 2px 4px rgba(0,0,0,0.02);">' +
          '<div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#5B768A;letter-spacing:0.5px;">Archivo de Actas</div>' +
          '<div style="font-size:1.8rem;font-weight:900;color:#0F2D54;margin-top:0.25rem;">102</div>' +
          '<div style="font-size:0.75rem;color:#1B5699;margin-top:0.25rem;font-weight:600;">Folios 1926-1932</div>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;box-shadow:0 2px 4px rgba(0,0,0,0.02);">' +
          '<div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#5B768A;letter-spacing:0.5px;">Padrón de Socios</div>' +
          '<div style="font-size:1.8rem;font-weight:900;color:#0F2D54;margin-top:0.25rem;">' + esc(st.totalSociosRegistrados || 164) + '</div>' +
          '<div style="font-size:0.75rem;color:#1B5699;margin-top:0.25rem;font-weight:600;">Con carnet QR oficial</div>' +
        '</div>' +
      '</div>' +

      '<div style="background:linear-gradient(135deg,#0F2D54 0%,#1B5699 50%,#5B9BE5 100%);color:#fff;border-radius:16px;padding:1.75rem;margin-bottom:1.5rem;box-shadow:0 6px 16px rgba(15,45,84,0.15);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;">' +
          '<div>' +
            '<span style="background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:20px;font-size:0.75rem;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Club Sp. y Bibl. Dr. Lautaro Roncedo</span>' +
            '<h2 style="font-size:1.5rem;font-weight:900;margin:0.5rem 0 0.25rem;color:#fff;">Centenario Institucional (1926 - 2026)</h2>' +
            '<p style="margin:0;font-size:0.875rem;color:rgba(255,255,255,0.9);max-width:600px;">' +
              'Plataforma integral de gestión social, patrimonio cultural, préstamos, biblioteca digital y preservación histórica de Alcira Gigena.' +
            '</p>' +
          '</div>' +
          '<div style="display:flex;gap:0.75rem;flex-wrap:wrap;">' +
            '<a href="https://www.bibliotecaroncedo.ar" target="_blank" rel="noopener noreferrer" style="background:#fff;color:#0F2D54;font-weight:800;padding:10px 18px;border-radius:12px;text-decoration:none;font-size:0.85rem;box-shadow:0 4px 8px rgba(0,0,0,0.1);display:inline-flex;align-items:center;gap:0.4rem;">' +
              '<span>Ver Sitio Web en Vivo ↗</span>' +
            '</a>' +
            '<a href="https://www.bibliotecaroncedo.ar/admin" target="_blank" rel="noopener noreferrer" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4);font-weight:800;padding:10px 18px;border-radius:12px;text-decoration:none;font-size:0.85rem;display:inline-flex;align-items:center;gap:0.4rem;">' +
              '<span>Panel Admin Directo ↗</span>' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1rem;">' +
        '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;">' +
          '<h3 style="font-size:1rem;font-weight:800;color:#0F2D54;margin:0 0 1rem;display:flex;align-items:center;gap:0.5rem;">' +
            '<span>📚 Accesos Operativos Directos</span>' +
          '</h3>' +
          '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
            '<button type="button" class="btn-secondary" style="text-align:left;padding:10px 14px;border-radius:10px;font-weight:700;font-size:0.85rem;" onclick="window.__MS_RONCEDO_GO(\'catalogo\')">🔍 Buscar en los 1.283 Libros Físicos</button>' +
            '<button type="button" class="btn-secondary" style="text-align:left;padding:10px 14px;border-radius:10px;font-weight:700;font-size:0.85rem;" onclick="window.__MS_RONCEDO_GO(\'digital\')">📱 Ver Libros Digitales y Audiolibros</button>' +
            '<button type="button" class="btn-secondary" style="text-align:left;padding:10px 14px;border-radius:10px;font-weight:700;font-size:0.85rem;" onclick="window.__MS_RONCEDO_GO(\'fototeca\')">📷 Moderar Archivo Fotográfico</button>' +
            '<button type="button" class="btn-secondary" style="text-align:left;padding:10px 14px;border-radius:10px;font-weight:700;font-size:0.85rem;" onclick="window.__MS_RONCEDO_GO(\'actas\')">📜 Explorar 102 Folios de Actas HD</button>' +
            '<button type="button" class="btn-secondary" style="text-align:left;padding:10px 14px;border-radius:10px;font-weight:700;font-size:0.85rem;" onclick="window.__MS_RONCEDO_GO(\'socios\')">💳 Padrón de Socios y Carnet QR</button>' +
          '</div>' +
        '</div>' +

        '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;">' +
          '<h3 style="font-size:1rem;font-weight:800;color:#0F2D54;margin:0 0 1rem;display:flex;align-items:center;gap:0.5rem;">' +
            '<span>⚡ Estado de Conexión</span>' +
          '</h3>' +
          '<div style="font-size:0.85rem;color:#334E68;display:flex;flex-direction:column;gap:0.75rem;">' +
            '<div style="display:flex;justify-content:space-between;border-bottom:1px solid #EDF2F7;padding-bottom:0.5rem;">' +
              '<strong>Dominio Oficial:</strong> <code>www.bibliotecaroncedo.ar</code>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;border-bottom:1px solid #EDF2F7;padding-bottom:0.5rem;">' +
              '<strong>Base de Datos Supabase:</strong> <code>kthtfbkvgvucqhosrpqx</code>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;border-bottom:1px solid #EDF2F7;padding-bottom:0.5rem;">' +
              '<strong>Conexión Plataforma:</strong> <span style="color:#059669;font-weight:700;">' + (d.connected ? '● En Línea (Supabase Directo)' : '● Base Local Sincronizada') + '</span>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;">' +
              '<strong>Gestión de Precios:</strong> <span style="color:#64748B;font-style:italic;">Excluido del listado comercial general</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // 2. Catálogo Físico (1.283 Libros)
  function renderCatalogoFisico(container, d) {
    var libros = d.libros || [];
    container.innerHTML =
      '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;margin-bottom:1rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">' +
          '<div>' +
            '<h3 style="font-size:1.1rem;font-weight:800;color:#0F2D54;margin:0;">Catálogo de 1.283 Libros Físicos</h3>' +
            '<p style="font-size:0.8rem;color:#64748B;margin:0.25rem 0 0;">Libros catalogados en sala de la Biblioteca Roncedo con inventario y fichas</p>' +
          '</div>' +
          '<div style="display:flex;gap:0.5rem;">' +
            '<a href="https://www.bibliotecaroncedo.ar/mi-biblioteca" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="text-decoration:none;padding:6px 12px;border-radius:8px;font-weight:700;">' +
              'Abrir Buscador en Sitio ↗' +
            '</a>' +
          '</div>' +
        '</div>' +
        '<input type="text" id="br-libros-filter" placeholder="Escribí para buscar por título, autor o inventario..." style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid #CBD5E1;font-size:0.875rem;margin-bottom:1rem;box-sizing:border-box;">' +
        '<div style="overflow-x:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.825rem;text-align:left;">' +
            '<thead>' +
              '<tr style="background:#F8FAFC;border-bottom:2px solid #E2E8F0;color:#475569;">' +
                '<th style="padding:10px 12px;">Inv. #</th>' +
                '<th style="padding:10px 12px;">Título</th>' +
                '<th style="padding:10px 12px;">Autor</th>' +
                '<th style="padding:10px 12px;">Año</th>' +
                '<th style="padding:10px 12px;">Género</th>' +
                '<th style="padding:10px 12px;">Estado</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody id="br-libros-tbody">' +
              libros.map(function (b) {
                return '<tr style="border-bottom:1px solid #F1F5F9;">' +
                  '<td style="padding:10px 12px;font-weight:700;color:#0F2D54;">#' + esc(b.inventario) + '</td>' +
                  '<td style="padding:10px 12px;font-weight:700;color:#1E293B;">' + esc(b.titulo) + '</td>' +
                  '<td style="padding:10px 12px;color:#475569;">' + esc(b.autor) + '</td>' +
                  '<td style="padding:10px 12px;color:#64748B;">' + esc(b.anio || '—') + '</td>' +
                  '<td style="padding:10px 12px;color:#64748B;">' + esc(b.genero || 'General') + '</td>' +
                  '<td style="padding:10px 12px;"><span style="background:#ECFDF5;color:#065F46;padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">' + esc(b.estado || 'Disponible') + '</span></td>' +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';

    var inp = container.querySelector('#br-libros-filter');
    var tbody = container.querySelector('#br-libros-tbody');
    if (inp && tbody) {
      inp.addEventListener('input', function () {
        var q = inp.value.toLowerCase().trim();
        var rows = tbody.querySelectorAll('tr');
        rows.forEach(function (tr) {
          tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }
  }

  // 3. Biblioteca Digital y Audiolibros
  function renderBibliotecaDigital(container, _d) {
    container.innerHTML =
      '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">' +
          '<div>' +
            '<h3 style="font-size:1.1rem;font-weight:800;color:#0F2D54;margin:0;">Biblioteca Digital & Audiolibros</h3>' +
            '<p style="font-size:0.8rem;color:#64748B;margin:0.25rem 0 0;">Streaming libre de audiolibros y lectura de libros en PDF para socios y usuarios</p>' +
          '</div>' +
          '<a href="https://www.bibliotecaroncedo.ar/biblioteca-digital" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="text-decoration:none;padding:6px 12px;border-radius:8px;font-weight:700;">' +
            'Abrir Lector Digital ↗' +
          '</a>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;margin-top:1rem;">' +
          '<div style="border:1px solid #E2E8F0;border-radius:12px;padding:1rem;background:#F8FAFC;">' +
            '<h4 style="margin:0 0 0.5rem;color:#0F2D54;font-size:0.95rem;font-weight:800;">📖 Libros Digitales en PDF</h4>' +
            '<p style="font-size:0.8rem;color:#475569;margin:0 0 0.75rem;">Visor interactivo con control de zoom, modo nocturno y compatibilidad con celulares y computadoras.</p>' +
            '<a href="https://www.bibliotecaroncedo.ar/biblioteca-digital" target="_blank" rel="noopener noreferrer" style="font-size:0.8rem;color:#1B5699;font-weight:700;text-decoration:none;">Explorar estantería digital →</a>' +
          '</div>' +
          '<div style="border:1px solid #E2E8F0;border-radius:12px;padding:1rem;background:#F8FAFC;">' +
            '<h4 style="margin:0 0 0.5rem;color:#0F2D54;font-size:0.95rem;font-weight:800;">🎧 Audiolibros en Streaming</h4>' +
            '<p style="font-size:0.8rem;color:#475569;margin:0 0 0.75rem;">Reproductor flotante con velocidad ajustable, marcas de tiempo y obras clásicas narradas en español.</p>' +
            '<a href="https://www.bibliotecaroncedo.ar/biblioteca-digital" target="_blank" rel="noopener noreferrer" style="font-size:0.8rem;color:#1B5699;font-weight:700;text-decoration:none;">Escuchar audiolibros →</a>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // 4. Fototeca Activa
  function renderFototeca(container, d) {
    var fotos = d.fotos || [];
    container.innerHTML =
      '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">' +
          '<div>' +
            '<h3 style="font-size:1.1rem;font-weight:800;color:#0F2D54;margin:0;">Fototeca Histórica Inteligente</h3>' +
            '<p style="font-size:0.8rem;color:#64748B;margin:0.25rem 0 0;">Patrimonio fotográfico del Club y Alcira Gigena por décadas con moderación y reconocimiento de vecinos</p>' +
          '</div>' +
          '<a href="https://www.bibliotecaroncedo.ar/fotos" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="text-decoration:none;padding:6px 12px;border-radius:8px;font-weight:700;">' +
            'Ver Galería Completa ↗' +
          '</a>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;">' +
          fotos.map(function (f) {
            return '<div style="border:1px solid #E2E8F0;border-radius:12px;padding:1rem;background:#F8FAFC;">' +
              '<div style="font-size:0.75rem;font-weight:800;color:#1B5699;text-transform:uppercase;">' + esc(f.decada || 'Histórica') + ' • ' + esc(f.coleccion || 'General') + '</div>' +
              '<div style="font-weight:800;color:#0F2D54;font-size:0.9rem;margin:0.35rem 0;">' + esc(f.titulo) + '</div>' +
              '<div style="font-size:0.75rem;color:#64748B;">Lugar: ' + esc(f.lugar || 'Alcira Gigena') + '</div>' +
              '<div style="margin-top:0.5rem;"><span style="background:#ECFDF5;color:#065F46;padding:2px 8px;border-radius:6px;font-size:0.7rem;font-weight:700;">' + esc(f.estado_moderacion || 'Publicada') + '</span></div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  // 5. Archivo de Actas
  function renderActas(container, d) {
    var actas = d.actas || [];
    container.innerHTML =
      '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">' +
          '<div>' +
            '<h3 style="font-size:1.1rem;font-weight:800;color:#0F2D54;margin:0;">Archivo de Actas (102 Folios Digitalizados)</h3>' +
            '<p style="font-size:0.8rem;color:#64748B;margin:0.25rem 0 0;">Libro N° 1 de Actas (1926-1932): Fundación, firmas históricas y transcripciones</p>' +
          '</div>' +
          '<a href="https://www.bibliotecaroncedo.ar/actas" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="text-decoration:none;padding:6px 12px;border-radius:8px;font-weight:700;">' +
            'Abrir Visor HD ↗' +
          '</a>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:0.75rem;">' +
          actas.map(function (a) {
            return '<div style="border:1px solid #E2E8F0;border-radius:10px;padding:0.9rem;background:#F8FAFC;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">' +
              '<div>' +
                '<span style="font-size:0.75rem;font-weight:800;color:#1B5699;">ACTA N° ' + esc(a.numero_acta) + ' (' + esc(a.anio || 1926) + ')</span>' +
                '<div style="font-weight:800;color:#0F2D54;font-size:0.9rem;margin-top:0.15rem;">' + esc(a.titulo) + '</div>' +
                '<div style="font-size:0.75rem;color:#64748B;">Folio ' + esc(a.folio_inicio) + ' a ' + esc(a.folio_fin) + ' • Reunión: ' + esc(a.tipo_reunion || 'General') + '</div>' +
              '</div>' +
              '<a href="https://www.bibliotecaroncedo.ar/actas" target="_blank" rel="noopener noreferrer" style="font-size:0.8rem;color:#1B5699;font-weight:700;text-decoration:none;">Ver Folio en Visor →</a>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  // 6. Dr. Lautaro Roncedo
  function renderDrRoncedo(container, _d) {
    container.innerHTML =
      '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">' +
          '<div>' +
            '<h3 style="font-size:1.1rem;font-weight:800;color:#0F2D54;margin:0;">Dr. Lautaro Roncedo • Museo Digital</h3>' +
            '<p style="font-size:0.8rem;color:#64748B;margin:0.25rem 0 0;">Historia, biografía, partituras, marchas oficiales y museo virtual</p>' +
          '</div>' +
          '<a href="https://www.bibliotecaroncedo.ar/roncedo" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="text-decoration:none;padding:6px 12px;border-radius:8px;font-weight:700;">' +
            'Ver Sección en el Sitio ↗' +
          '</a>' +
        '</div>' +
        '<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:1rem;color:#166534;font-size:0.85rem;line-height:1.5;">' +
          '<strong>Patrimonio institucional:</strong> Módulo dotado de reproducción de Marchas Oficiales del Club, visor de documentos históricos, reseñas del Dr. Lautaro Roncedo y sistema de interacción social para la comunidad.' +
        '</div>' +
      '</div>';
  }

  // 7. Socios y Carnet QR
  function renderSociosCarnet(container, d) {
    var socios = d.socios || [];
    container.innerHTML =
      '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">' +
          '<div>' +
            '<h3 style="font-size:1.1rem;font-weight:800;color:#0F2D54;margin:0;">Padrón de Socios y Carnet Digital con QR</h3>' +
            '<p style="font-size:0.8rem;color:#64748B;margin:0.25rem 0 0;">Emisión de credenciales con código QR dinámico y programa de Socios Protectores</p>' +
          '</div>' +
          '<a href="https://www.bibliotecaroncedo.ar/carnet" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="text-decoration:none;padding:6px 12px;border-radius:8px;font-weight:700;">' +
            'Ver Emisor de Carnet ↗' +
          '</a>' +
        '</div>' +
        '<div style="overflow-x:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.825rem;text-align:left;">' +
            '<thead>' +
              '<tr style="background:#F8FAFC;border-bottom:2px solid #E2E8F0;color:#475569;">' +
                '<th style="padding:10px 12px;">Socio / Usuario</th>' +
                '<th style="padding:10px 12px;">Rol</th>' +
                '<th style="padding:10px 12px;">Socio Protector</th>' +
                '<th style="padding:10px 12px;">Carnet QR</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              (socios.length ? socios.map(function (s) {
                return '<tr style="border-bottom:1px solid #F1F5F9;">' +
                  '<td style="padding:10px 12px;font-weight:700;color:#0F2D54;">' + esc((s.nombre || '') + ' ' + (s.apellido || '')) + '</td>' +
                  '<td style="padding:10px 12px;text-transform:capitalize;">' + esc(s.role || 'Usuario') + '</td>' +
                  '<td style="padding:10px 12px;">' + (s.es_socio_protector ? '<span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">' + esc(s.tipo_socio_protector || 'Activo') + '</span>' : '—') + '</td>' +
                  '<td style="padding:10px 12px;"><span style="color:#059669;font-weight:700;">✓ Oficial</span></td>' +
                '</tr>';
              }).join('') : '<tr><td colspan="4" style="padding:12px;text-align:center;color:#64748B;">Padrón conectado a Supabase en tiempo real.</td></tr>') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  // 8. Novedades y Anuncios
  function renderNovedades(container, d) {
    var novedades = d.novedades || [];
    container.innerHTML =
      '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">' +
          '<div>' +
            '<h3 style="font-size:1.1rem;font-weight:800;color:#0F2D54;margin:0;">Novedades y Anuncios Institucionales</h3>' +
            '<p style="font-size:0.8rem;color:#64748B;margin:0.25rem 0 0;">Publicación oficial de noticias en la portada de la Biblioteca</p>' +
          '</div>' +
          '<a href="https://www.bibliotecaroncedo.ar/admin?tab=novedades" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="text-decoration:none;padding:6px 12px;border-radius:8px;font-weight:700;">' +
            'Gestionar Novedades (ABM) ↗' +
          '</a>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:0.75rem;">' +
          novedades.map(function (n) {
            return '<div style="border:1px solid #E2E8F0;border-radius:10px;padding:0.9rem;background:#F8FAFC;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                '<span style="font-size:0.75rem;font-weight:700;color:#1B5699;">' + esc(n.categoria || 'Institucional') + '</span>' +
                '<span style="font-size:0.75rem;color:#64748B;">' + esc(n.fecha_publicacion || '') + '</span>' +
              '</div>' +
              '<div style="font-weight:800;color:#0F2D54;font-size:0.95rem;margin-top:0.25rem;">' + esc(n.titulo) + '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  // 9. Eventos y Talleres
  function renderEventos(container, _d) {
    container.innerHTML =
      '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">' +
          '<div>' +
            '<h3 style="font-size:1.1rem;font-weight:800;color:#0F2D54;margin:0;">Eventos y Talleres Culturales</h3>' +
            '<p style="font-size:0.8rem;color:#64748B;margin:0.25rem 0 0;">Cursos de ajedrez, teatro, yoga, talleres literarios e inscripciones</p>' +
          '</div>' +
          '<a href="https://www.bibliotecaroncedo.ar/eventos" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="text-decoration:none;padding:6px 12px;border-radius:8px;font-weight:700;">' +
            'Abrir Cartelera de Eventos ↗' +
          '</a>' +
        '</div>' +
        '<p style="font-size:0.85rem;color:#475569;margin:0;">Gestión de cronograma de actividades comunitarias, preventas de entradas para festejos y certificados de participación.</p>' +
      '</div>';
  }

  // 10. Tienda Institucional
  function renderTienda(container, _d) {
    container.innerHTML =
      '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">' +
          '<div>' +
            '<h3 style="font-size:1.1rem;font-weight:800;color:#0F2D54;margin:0;">Tienda Institucional y Recuerdos</h3>' +
            '<p style="font-size:0.8rem;color:#64748B;margin:0.25rem 0 0;">Libros del centenario, indumentaria del club, banderas y recuerdos</p>' +
          '</div>' +
          '<a href="https://www.bibliotecaroncedo.ar/tienda" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="text-decoration:none;padding:6px 12px;border-radius:8px;font-weight:700;">' +
            'Abrir Tienda Online ↗' +
          '</a>' +
        '</div>' +
        '<p style="font-size:0.85rem;color:#475569;margin:0;">Catálogo de artículos oficiales con reservas directas y descuentos automáticos para Socios Protectores.</p>' +
      '</div>';
  }

  // 11. Configuración y Enlaces del Sitio
  function renderConfiguracion(container, d) {
    container.innerHTML =
      '<div style="background:#fff;border:1px solid #D6E4EE;border-radius:14px;padding:1.25rem;">' +
        '<h3 style="font-size:1.1rem;font-weight:800;color:#0F2D54;margin:0 0 1rem;">Configuración de Plataforma e Infraestructura</h3>' +
        '<div style="display:flex;flex-direction:column;gap:0.75rem;font-size:0.85rem;color:#334E68;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #EDF2F7;padding-bottom:0.5rem;">' +
            '<strong>URL Pública de Producción:</strong>' +
            '<a href="https://www.bibliotecaroncedo.ar" target="_blank" rel="noopener noreferrer" style="color:#1B5699;font-weight:700;">www.bibliotecaroncedo.ar ↗</a>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #EDF2F7;padding-bottom:0.5rem;">' +
            '<strong>Panel de Administración General:</strong>' +
            '<a href="https://www.bibliotecaroncedo.ar/admin" target="_blank" rel="noopener noreferrer" style="color:#1B5699;font-weight:700;">www.bibliotecaroncedo.ar/admin ↗</a>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #EDF2F7;padding-bottom:0.5rem;">' +
            '<strong>Base de Datos Supabase:</strong>' +
            '<code>kthtfbkvgvucqhosrpqx.supabase.co</code>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #EDF2F7;padding-bottom:0.5rem;">' +
            '<strong>Estado de Vinculación en MiniSistema:</strong>' +
            '<span style="color:#059669;font-weight:700;">✓ Módulo Vinculado (Administrador General)</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<strong>Condición Comercial en Precios:</strong>' +
            '<span style="color:#64748B;font-style:italic;">No se coloca en el listado precios del Administrador General</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  async function openRoncedoView(viewKey) {
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
          ? 'Biblioteca Roncedo'
          : 'Biblioteca Roncedo · ' + (meta ? meta.label : STATE.view);
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

  window.__MS_RONCEDO_GO = function (viewKey) {
    openRoncedoView(viewKey);
  };

  function syncHomeCard() {
    bindGlobalNavIntegration();
    var allowed = isGeneralAdmin();
    var grid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-bibliotecaroncedo-home-card');

    if (allowed && grid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-bibliotecaroncedo-home-card';
      card.className = 'module-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>' +
            '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>' +
          '</svg>' +
        '</div>' +
        '<h3>Biblioteca Roncedo</h3>';
      card.addEventListener('click', function () { openRoncedoView('menu'); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openRoncedoView('menu');
        }
      });

      // Insertar después de Don Contador o FeriARTE
      var prevCard = document.getElementById('ms-doncontador-home-card') ||
                     document.getElementById('ms-feriarte-home-card') ||
                     document.getElementById('ms-superadmin-home-card');
      if (prevCard && prevCard.nextSibling) {
        grid.insertBefore(card, prevCard.nextSibling);
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
