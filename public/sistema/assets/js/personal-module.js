/* ==========================================================================
   MÓDULO PADRE "ADMINISTRACIÓN DE PERSONAL" — MINISISTEMA ERP
   Agrupa:
   1. Curriculum Vitae (vinculado a cv-module.js y portal público /cv)
   2. Control de Asistencias (estructura base lista para configuración)
   ========================================================================== */
(function () {
  'use strict';

  window.__MS_PERSONAL_OWNS_CV__ = true;

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

  function isPersonalAllowed() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    var isBase = Boolean(window.ERP_BRAND && window.ERP_BRAND.isBase);
    var brandMods = (window.ERP_BRAND && window.ERP_BRAND.enabledModules) || [];
    if (
      !isBase &&
      Array.isArray(brandMods) &&
      brandMods.length > 0 &&
      brandMods.indexOf('administracion_personal') === -1 &&
      brandMods.indexOf('personal') === -1 &&
      brandMods.indexOf('cv') === -1 &&
      brandMods.indexOf('personal:asistencias') === -1 &&
      brandMods.indexOf('asistencia') === -1
    ) {
      return false;
    }
    if (String(u.username).toLowerCase() === 'danielg' || u.role === 'Administrador General' || u.role === 'Administrador') {
      return true;
    }
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return uMods.some(function (k) {
      var s = String(k || '');
      return (
        s === 'administracion_personal' ||
        s === 'cv' ||
        s.indexOf('cv:') === 0 ||
        s === 'personal:asistencias' ||
        s.indexOf('personal:') === 0
      );
    });
  }

  function isCvSubAllowed() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    if (
      String(u.username).toLowerCase() === 'danielg' ||
      u.role === 'Administrador General' ||
      u.role === 'Administrador'
    ) {
      return true;
    }
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return uMods.some(function (k) {
      var s = String(k || '');
      return s === 'administracion_personal' || s === 'cv' || s.indexOf('cv:') === 0;
    });
  }

  function isAsistenciasSubAllowed() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    if (
      String(u.username).toLowerCase() === 'danielg' ||
      u.role === 'Administrador General' ||
      u.role === 'Administrador'
    ) {
      return true;
    }
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return uMods.some(function (k) {
      var s = String(k || '');
      return (
        s === 'administracion_personal' ||
        s === 'cv' ||
        s === 'personal:asistencias' ||
        s.indexOf('asistencias') === 0
      );
    });
  }

  function hideAllErpSections() {
    document.querySelectorAll('.erp-main > .erp-section').forEach(function (sec) {
      sec.hidden = true;
    });
  }

  function updateTopbarState(visible, label) {
    var backTopBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backTopBtn) {
      backTopBtn.hidden = !visible;
      if (visible) backTopBtn.textContent = '← Atrás';
    }
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    if (topbarModInd) {
      topbarModInd.hidden = !visible;
      if (visible && label) topbarModInd.textContent = label;
    }
  }

  function closePersonalToHome() {
    hideAllErpSections();
    var inicio = document.getElementById('sec-inicio');
    if (inicio) inicio.hidden = false;
    updateTopbarState(false);
  }

  function ensureSectionsMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var menuSec = document.getElementById('sec-menu-personal');
    var asistSec = document.getElementById('sec-asistencias-workspace');

    if (!menuSec) {
      menuSec = document.createElement('section');
      menuSec.id = 'sec-menu-personal';
      menuSec.className = 'erp-section';
      menuSec.hidden = true;
      menuSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-personal-back-home-btn">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">ERP en Línea · <strong>Administración de Personal</strong></span>' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" aria-label="Submódulos de Administración de Personal">' +
          '<article class="module-card" id="ms-personal-open-cv" data-personal-sub="cv" role="button" tabindex="0" style="cursor:pointer;">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
                '<polyline points="14 2 14 8 20 8"></polyline>' +
                '<circle cx="10" cy="13" r="2"></circle>' +
                '<path d="M14 17c0-1.5-1.8-2.5-4-2.5s-4 1-4 2.5"></path>' +
              '</svg>' +
            '</div>' +
            '<h3>Curriculum Vitae</h3>' +
          '</article>' +
          '<article class="module-card" id="ms-personal-open-asistencias" data-personal-sub="asistencias" role="button" tabindex="0" style="cursor:pointer;">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<circle cx="12" cy="12" r="9"></circle>' +
                '<polyline points="12 7 12 12 15 14"></polyline>' +
              '</svg>' +
            '</div>' +
            '<h3>Control de Asistencias</h3>' +
          '</article>' +
        '</div>';

      erpMain.appendChild(menuSec);

      menuSec.querySelector('#ms-personal-back-home-btn').addEventListener('click', closePersonalToHome);

      var cvCard = menuSec.querySelector('#ms-personal-open-cv');
      cvCard.addEventListener('click', function () {
        if (typeof window.__MS_OPEN_CV_MENU__ === 'function') {
          window.__MS_OPEN_CV_MENU__();
        }
      });
      cvCard.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          if (typeof window.__MS_OPEN_CV_MENU__ === 'function') {
            window.__MS_OPEN_CV_MENU__();
          }
        }
      });

      var asistCard = menuSec.querySelector('#ms-personal-open-asistencias');
      asistCard.addEventListener('click', openAsistenciasWorkspace);
      asistCard.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openAsistenciasWorkspace();
        }
      });
    }

    if (!asistSec) {
      asistSec = document.createElement('section');
      asistSec.id = 'sec-asistencias-workspace';
      asistSec.className = 'erp-section';
      asistSec.hidden = true;
      asistSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-asistencias-back-personal-btn">← Volver a Administración de Personal</button>' +
            '<span class="module-breadcrumb">Administración de Personal · <strong>Control de Asistencias</strong></span>' +
          '</div>' +
        '</div>' +
        '<div id="ms-asistencias-body" style="max-width:860px;margin:0 auto;">' +
          '<div style="background:var(--surface,#fff);border:1px solid rgba(17,45,58,0.12);border-radius:16px;padding:1.75rem;box-shadow:0 6px 20px rgba(17,45,58,0.06);">' +
            '<div style="display:flex;align-items:center;gap:0.9rem;margin-bottom:0.85rem;">' +
              '<div style="width:46px;height:46px;border-radius:12px;background:rgba(86,215,161,0.18);color:#112D3A;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>' +
              '</div>' +
              '<div>' +
                '<h2 style="margin:0;font-size:1.2rem;color:#112D3A;">Control de Asistencias</h2>' +
                '<p style="margin:0.15rem 0 0;font-size:0.86rem;opacity:0.75;">Submódulo integrado dentro de Administración de Personal.</p>' +
              '</div>' +
            '</div>' +
            '<p style="margin:0;font-size:0.92rem;line-height:1.55;opacity:0.88;">' +
              'Este espacio ya se encuentra estructurado y vinculado a <strong>Administración de Personal</strong>, listo para incorporar el flujo operativo de control de asistencias (fichadas, turnos, llegadas tarde, licencias y reportes).' +
            '</p>' +
          '</div>' +
        '</div>';

      erpMain.appendChild(asistSec);
      asistSec.querySelector('#ms-asistencias-back-personal-btn').addEventListener('click', openPersonalMenu);
    }

    // Ajustar visibilidad de submódulos por permisos del usuario activo
    var cvCardEl = menuSec.querySelector('#ms-personal-open-cv');
    if (cvCardEl) {
      var showCv = isCvSubAllowed();
      cvCardEl.hidden = !showCv;
      cvCardEl.style.display = showCv ? '' : 'none';
    }
    var asistCardEl = menuSec.querySelector('#ms-personal-open-asistencias');
    if (asistCardEl) {
      var showAsist = isAsistenciasSubAllowed();
      asistCardEl.hidden = !showAsist;
      asistCardEl.style.display = showAsist ? '' : 'none';
    }

    return { menuSec: menuSec, asistSec: asistSec };
  }

  function openPersonalMenu() {
    var mounted = ensureSectionsMounted();
    if (!mounted) return;
    hideAllErpSections();
    mounted.menuSec.hidden = false;
    updateTopbarState(true, 'Administración de Personal');
    if (typeof window.__MS_SYNC_CV_COUNTERS__ === 'function') {
      window.__MS_SYNC_CV_COUNTERS__();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openAsistenciasWorkspace() {
    var mounted = ensureSectionsMounted();
    if (!mounted) return;
    hideAllErpSections();
    mounted.asistSec.hidden = false;
    updateTopbarState(true, 'Administración de Personal · Control de Asistencias');
    if (typeof window.__MS_MOUNT_ASISTENCIAS__ === 'function') {
      window.__MS_MOUNT_ASISTENCIAS__();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.__MS_OPEN_PERSONAL_MENU__ = openPersonalMenu;
  window.__MS_OPEN_ASISTENCIAS__ = openAsistenciasWorkspace;

  function bindGlobalPersonalNavReset() {
    if (window.__MS_PERSONAL_NAV_BOUND__) return;
    window.__MS_PERSONAL_NAV_BOUND__ = true;
    document.addEventListener(
      'click',
      function (ev) {
        var t = ev.target;
        if (!t || typeof t.closest !== 'function') return;
        var navTrigger = t.closest(
          '#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card'
        );
        if (navTrigger) {
          var m = document.getElementById('sec-menu-personal');
          var a = document.getElementById('sec-asistencias-workspace');
          var isPersonalActive = (m && !m.hidden) || (a && !a.hidden);

          if (navTrigger.id === 'btn-topbar-back-facturacion' && isPersonalActive) {
            ev.preventDefault();
            ev.stopPropagation();
            if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
            if (a && !a.hidden) {
              if (typeof window.__MS_ASISTENCIAS_BACK__ === 'function' && window.__MS_ASISTENCIAS_BACK__()) {
                return;
              }
              openPersonalMenu();
            } else {
              closePersonalToHome();
            }
            return;
          }

          if (m) m.hidden = true;
          if (a) a.hidden = true;
        }
      },
      true
    );
  }

  function syncPersonalHomeCard() {
    bindGlobalPersonalNavReset();
    var allowed = isPersonalAllowed();
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existingCard = document.getElementById('ms-personal-home-card');

    if (allowed && inicioGrid && !existingCard) {
      var card = document.createElement('article');
      card.id = 'ms-personal-home-card';
      card.className = 'module-card';
      card.setAttribute('data-module-key', 'administracion_personal');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>' +
            '<circle cx="9" cy="7" r="4"></circle>' +
            '<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>' +
            '<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>' +
          '</svg>' +
        '</div>' +
        '<h3>Administración de Personal</h3>';

      card.addEventListener('click', openPersonalMenu);
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openPersonalMenu();
        }
      });

      var perfilCard = inicioGrid.querySelector('[data-module-key="perfil"]');
      if (perfilCard) {
        inicioGrid.insertBefore(card, perfilCard);
      } else {
        inicioGrid.appendChild(card);
      }
    } else if (existingCard) {
      existingCard.hidden = !allowed;
      existingCard.style.display = allowed ? '' : 'none';
    }
  }

  setInterval(syncPersonalHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncPersonalHomeCard);
})();
