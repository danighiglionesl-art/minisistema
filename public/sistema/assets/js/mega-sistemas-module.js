/* ==========================================================================
   MÓDULO CONTENEDOR "MEGA SISTEMAS" — PANEL ADMINISTRADOR GENERAL (@danielg)
   Agrupa los módulos independientes de gran escala gestionados desde MiniSistema:
   1. ReikiOnLine
   2. FeriARTE
   3. Don Contador
   4. Biblioteca Roncedo
   Respeta estrictamente las reglas de diseño de tarjetas uniformes
   (.modules-grid / .module-card) sin badges, pills ni descripciones.
   ========================================================================== */
(function () {
  'use strict';

  var SUBMODULES = [
    {
      key: 'reikionline',
      label: 'ReikiOnLine',
      icon:
        '<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"></path>',
      open: function () {
        if (typeof window.__MS_REIKIONLINE_OPEN__ === 'function') {
          window.__MS_REIKIONLINE_OPEN__('menu');
        }
      }
    },
    {
      key: 'feriarte',
      label: 'FeriARTE',
      icon:
        '<path d="M3 20h18L12 4 3 20z"></path>' +
        '<path d="M8.5 14h7"></path>',
      open: function () {
        if (typeof window.__MS_FERIARTE_OPEN__ === 'function') {
          window.__MS_FERIARTE_OPEN__('menu');
        }
      }
    },
    {
      key: 'doncontador',
      label: 'Don Contador',
      icon:
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
        '<polyline points="14 2 14 8 20 8"></polyline>' +
        '<path d="M9 15l2 2 4-4"></path>',
      open: function () {
        if (typeof window.__MS_DONCONTADOR_OPEN__ === 'function') {
          window.__MS_DONCONTADOR_OPEN__('menu');
        }
      }
    },
    {
      key: 'bibliotecaroncedo',
      label: 'Biblioteca Roncedo',
      icon:
        '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>' +
        '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>',
      open: function () {
        if (typeof window.__MS_RONCEDO_GO === 'function') {
          window.__MS_RONCEDO_GO('menu');
        }
      }
    }
  ];

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
    var user =
      typeof window.__MS_GET_ACTIVE_USER__ === 'function'
        ? window.__MS_GET_ACTIVE_USER__()
        : null;
    if (!user) {
      try {
        var pfx =
          (window.ERP_BRAND && window.ERP_BRAND.storagePrefix) ||
          'ms_minisistema_';
        var raw =
          sessionStorage.getItem(pfx + 'erp_active_admin_v1') ||
          localStorage.getItem(pfx + 'erp_active_admin_v1');
        if (raw) user = JSON.parse(raw);
      } catch (_e) {}
    }
    if (!user || !user.username) return false;
    var u = String(user.username).trim().toLowerCase();
    return u === 'danielg' || u === 'danielg@minisistema.com.ar';
  }

  function hideAllErpSections() {
    document
      .querySelectorAll('.erp-main > .erp-section, section.erp-section')
      .forEach(function (sec) {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function ensureSection() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var secMenu = document.getElementById('sec-menu-megasistemas');
    if (secMenu && secMenu.parentNode !== erpMain) {
      erpMain.appendChild(secMenu);
    }
    if (!secMenu) {
      secMenu = document.createElement('section');
      secMenu.id = 'sec-menu-megasistemas';
      secMenu.className = 'erp-section';
      secMenu.hidden = true;
      secMenu.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-mega-back-home">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">Administrador General · <strong>Mega Sistemas</strong></span>' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" id="ms-megasistemas-grid" aria-label="Submódulos de Mega Sistemas"></div>';
      erpMain.appendChild(secMenu);
      var backHomeBtn = secMenu.querySelector('#ms-mega-back-home');
      if (backHomeBtn) {
        backHomeBtn.addEventListener('click', closeToHome);
      }
    }
    return secMenu;
  }

  function renderSubmodulesGrid() {
    var grid = document.getElementById('ms-megasistemas-grid');
    if (!grid) return;
    grid.innerHTML = SUBMODULES.map(function (m) {
      return (
        '<article class="module-card" role="button" tabindex="0" data-mega-sub="' + esc(m.key) + '">' +
          '<div class="module-icon" aria-hidden="true">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              m.icon +
            '</svg>' +
          '</div>' +
          '<h3>' + esc(m.label) + '</h3>' +
        '</article>'
      );
    }).join('');

    grid.querySelectorAll('.module-card[data-mega-sub]').forEach(function (card) {
      var key = card.getAttribute('data-mega-sub');
      var mod = SUBMODULES.find(function (m) { return m.key === key; });
      if (!mod) return;
      var launch = function () {
        mod.open();
      };
      card.addEventListener('click', launch);
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          launch();
        }
      });
    });
  }

  function openMegaSistemasMenu() {
    if (!isGeneralAdmin()) return;
    bindGlobalNavIntegration();
    var secMenu = ensureSection();
    if (!secMenu) return;
    hideAllErpSections();
    renderSubmodulesGrid();
    secMenu.hidden = false;

    var backBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backBtn) backBtn.hidden = false;
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    if (topbarModInd) {
      topbarModInd.textContent = 'Mega Sistemas';
      topbarModInd.hidden = false;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindGlobalNavIntegration() {
    if (window.__MS_MEGA_NAV_BOUND__) return;
    window.__MS_MEGA_NAV_BOUND__ = true;

    document.addEventListener(
      'click',
      function (ev) {
        var target = ev.target;
        if (!target || typeof target.closest !== 'function') return;

        var navEl = target.closest(
          '#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-minisistemas-medida-home-card, #ms-appcadi-home-card, #ms-campodirecto-home-card, #ms-clubfidel-home-card, #ms-cv-home-card, #ms-personal-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card'
        );
        if (!navEl) return;

        var secMenu = document.getElementById('sec-menu-megasistemas');
        var isMegaActive = Boolean(secMenu && !secMenu.hidden);

        if (navEl.id === 'btn-topbar-back-facturacion' && isMegaActive) {
          ev.preventDefault();
          ev.stopPropagation();
          closeToHome();
          return;
        }

        if (secMenu) secMenu.hidden = true;
      },
      true
    );
  }

  function removeLegacyChildHomeCards() {
    [
      'ms-reikionline-home-card',
      'ms-feriarte-home-card',
      'ms-doncontador-home-card',
      'ms-bibliotecaroncedo-home-card'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function syncHomeCard() {
    bindGlobalNavIntegration();
    var allowed = isGeneralAdmin();
    var grid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-megasistemas-home-card');

    if (allowed) {
      removeLegacyChildHomeCards();
    }

    if (allowed && grid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-megasistemas-home-card';
      card.className = 'module-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>' +
            '<polyline points="2 17 12 22 22 17"></polyline>' +
            '<polyline points="2 12 12 17 22 12"></polyline>' +
          '</svg>' +
        '</div>' +
        '<h3>Mega Sistemas</h3>';
      card.addEventListener('click', openMegaSistemasMenu);
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openMegaSistemasMenu();
        }
      });

      var saCard = document.getElementById('ms-superadmin-home-card');
      if (saCard && saCard.nextSibling) {
        grid.insertBefore(card, saCard.nextSibling);
      } else {
        grid.appendChild(card);
      }
    } else if (existing) {
      existing.hidden = !allowed;
      existing.style.display = allowed ? '' : 'none';
    }
  }

  window.__MS_MEGASISTEMAS_OPEN__ = openMegaSistemasMenu;

  setInterval(syncHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncHomeCard);
})();
