/* ==========================================================================
   MÓDULO "GESTIÓN WEB" — MINISISTEMA ERP
   Administra el portal institucional /cemep (CEMEP + CEMEP Plus):
   1. Usuarios Registrados (Google / Correo, DNI, Cobertura, Habilitar/Clave)
   2. Editor de Espacios Web + Publicación en vivo (/cemep)
   3. Recetas Digitales (Carga del Administrador de recetas PDF/imagen)
   4. Accesos de Profesionales (Credenciales Portal Profesionales /cemep)
   ========================================================================== */
(function () {
  'use strict';

  var STATE = {
    activeView: 'menu', // 'menu' | 'usuarios' | 'editor' | 'recetas' | 'profesionales'
    publicCemepUrl: '/cemep',
    stats: {},
    gestionWeb: {
      googleClientId: '',
      publishedAt: '',
      publishedBy: '',
      hasUnpublishedChanges: false,
      draftContent: null,
      publishedContent: null,
      webUsers: [],
      profesionalAccounts: []
    },
    recetas: [],
    profesionalesTurnero: [],
    searchUser: ''
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

  function isGestionWebAllowed() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    if (String(u.username).toLowerCase() === 'danielg' || u.role === 'Administrador General') {
      return true;
    }
    var brandMods = (window.ERP_BRAND && window.ERP_BRAND.enabledModules) || [];
    if (
      Array.isArray(brandMods) &&
      brandMods.length > 0 &&
      brandMods.indexOf('gestion_web') === -1 &&
      brandMods.indexOf('turnos') === -1
    ) {
      return false;
    }
    if (u.role === 'Administrador') return true;
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return uMods.some(function (k) {
      var s = String(k || '');
      return s === 'gestion_web' || s.indexOf('gestion_web:') === 0;
    });
  }

  async function apiWeb(method, body) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (method === 'GET') delete opts.headers['Content-Type'];
    else opts.body = JSON.stringify(body || {});
    var res = await fetch('/sistema/api/consultorios.php', opts);
    return res.json();
  }

  function applyRes(res) {
    if (!res || !res.ok) return;
    if (res.publicCemepUrl) STATE.publicCemepUrl = res.publicCemepUrl;
    if (res.stats) STATE.stats = res.stats;
    if (res.gestionWeb) STATE.gestionWeb = res.gestionWeb;
    if (res.historiaClinica && Array.isArray(res.historiaClinica.recetas)) {
      STATE.recetas = res.historiaClinica.recetas;
    }
    if (res.turnosRef && Array.isArray(res.turnosRef.profesionales)) {
      STATE.profesionalesTurnero = res.turnosRef.profesionales;
    }
    syncCounters();
  }

  async function reloadData(rerender) {
    try {
      var res = await apiWeb('GET');
      if (res && res.ok) {
        applyRes(res);
        if (rerender) renderWorkspace();
      }
    } catch (_e) {}
  }

  function showToast(msg, isErr) {
    var el = document.getElementById('ms-gw-toast');
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

  function syncCounters() {
    var uEl = document.getElementById('ms-gw-cnt-users');
    var eEl = document.getElementById('ms-gw-cnt-editor');
    var rEl = document.getElementById('ms-gw-cnt-recetas');
    var pEl = document.getElementById('ms-gw-cnt-profs');
    var hEl = document.getElementById('ms-gw-home-pill');
    if (uEl) uEl.textContent = (STATE.gestionWeb.webUsers || []).length + ' usuarios';
    if (eEl) eEl.textContent = STATE.gestionWeb.hasUnpublishedChanges ? 'Sin publicar' : 'Publicado ✓';
    if (rEl) rEl.textContent = (STATE.stats.recetasPendientes || 0) + ' pendientes';
    if (pEl) pEl.textContent = (STATE.gestionWeb.profesionalAccounts || []).length + ' accesos';
    if (hEl) hEl.textContent = STATE.gestionWeb.hasUnpublishedChanges ? 'CAMBIOS SIN PUBLICAR' : 'PORTAL /CEMEP';
    var lnk = document.getElementById('ms-gw-open-public');
    if (lnk && STATE.publicCemepUrl) lnk.href = STATE.publicCemepUrl;
  }

  function subCard(key, title, desc, cntId, cntTxt, bg) {
    return (
      '<article class="module-card" data-gw-sub="' + key + '" role="button" tabindex="0" style="cursor:pointer;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:0.35rem;">' +
          '<div class="module-icon" aria-hidden="true" style="margin:0;">🌐</div>' +
          '<span id="' + cntId + '" style="background:' + bg + ';color:#112D3A;font-size:0.72rem;font-weight:800;padding:0.2rem 0.55rem;border-radius:999px;">' + cntTxt + '</span>' +
        '</div>' +
        '<h3>' + title + '</h3>' +
        '<p style="margin:0.2rem 0 0;font-size:0.78rem;opacity:0.75;">' + desc + '</p>' +
      '</article>'
    );
  }

  function ensureMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var menuSec = document.getElementById('sec-menu-gestion-web');
    var workSec = document.getElementById('sec-gestion-web-workspace');

    if (!menuSec) {
      menuSec = document.createElement('section');
      menuSec.id = 'sec-menu-gestion-web';
      menuSec.className = 'erp-section';
      menuSec.hidden = true;
      menuSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-gw-back-home">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">ERP en Línea · <strong>Gestión Web</strong></span>' +
          '</div>' +
          '<a href="/cemep" target="_blank" class="ms-sa-btn" id="ms-gw-open-public" style="padding:0.42rem 0.9rem;font-size:0.8rem;">🌐 Abrir Página Web /cemep ↗</a>' +
        '</div>' +
        '<div class="modules-grid">' +
          subCard('usuarios', 'Usuarios Registrados', 'Ver pacientes registrados (Google / Email), editar DNI/cobertura, habilitar o resetear clave.', 'ms-gw-cnt-users', '0 usuarios', '#e0f2fe') +
          subCard('editor', 'Editor Web y Publicación', 'Editar espacios configurables de CEMEP y CEMEP Plus y publicarlos en vivo en /cemep.', 'ms-gw-cnt-editor', 'Publicado ✓', 'rgba(86,215,161,0.22)') +
          subCard('recetas', 'Recetas Digitales (Admin)', 'Recibir solicitudes de pacientes y cargar recetas digitales PDF/imagen para descarga inmediata.', 'ms-gw-cnt-recetas', '0 pendientes', '#fef3c7') +
          subCard('profesionales', 'Accesos de Profesionales', 'Crear y gestionar credenciales de profesionales para el Portal de Profesionales en /cemep.', 'ms-gw-cnt-profs', '0 accesos', 'rgba(17,45,58,0.1)') +
        '</div>';

      erpMain.appendChild(menuSec);
      menuSec.querySelector('#ms-gw-back-home').addEventListener('click', closeToHome);
      menuSec.querySelectorAll('[data-gw-sub]').forEach(function (card) {
        card.addEventListener('click', function () {
          openView(card.getAttribute('data-gw-sub'));
        });
      });
    }

    if (!workSec) {
      workSec = document.createElement('section');
      workSec.id = 'sec-gestion-web-workspace';
      workSec.className = 'erp-section';
      workSec.hidden = true;
      workSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-gw-back-menu">← Volver a Gestión Web</button>' +
            '<span class="module-breadcrumb">Gestión Web · <strong id="ms-gw-sub-title">Panel</strong></span>' +
          '</div>' +
          '<div style="display:flex;gap:0.5rem;">' +
            '<a href="/cemep" target="_blank" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.38rem 0.8rem;font-size:0.78rem;">🌐 Ver /cemep ↗</a>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-gw-refresh" style="padding:0.38rem 0.8rem;font-size:0.78rem;">🔄 Actualizar</button>' +
          '</div>' +
        '</div>' +
        '<div id="ms-gw-toast" style="display:none;margin-bottom:0.9rem;padding:0.7rem 1rem;border-radius:10px;font-weight:700;font-size:0.85rem;"></div>' +
        '<div id="ms-gw-body"></div>';

      erpMain.appendChild(workSec);
      workSec.querySelector('#ms-gw-back-menu').addEventListener('click', function () {
        openView('menu');
      });
      workSec.querySelector('#ms-gw-refresh').addEventListener('click', function () {
        reloadData(true);
      });
    }

    return { menuSec: menuSec, workSec: workSec };
  }

  function openView(view) {
    var mounted = ensureMounted();
    if (!mounted) return;
    STATE.activeView = view || 'menu';
    hideAllErpSections();
    if (STATE.activeView === 'menu') {
      mounted.menuSec.hidden = false;
      reloadData(false);
    } else {
      mounted.workSec.hidden = false;
      var titles = {
        usuarios: 'Usuarios Registrados (/cemep)',
        editor: 'Editor de Contenidos Web y Publicación',
        recetas: 'Recetas Digitales (Carga del Administrador)',
        profesionales: 'Accesos de Profesionales'
      };
      var tEl = document.getElementById('ms-gw-sub-title');
      if (tEl) tEl.textContent = titles[STATE.activeView] || 'Gestión Web';
      renderWorkspace();
      reloadData(true);
    }
  }

  window.__MS_OPEN_GESTION_WEB__ = openView;

  function readFileToDataUrl(file, cb) {
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      showToast('El archivo supera los 4.5 MB recomendados.', true);
      return;
    }
    var r = new FileReader();
    r.onload = function () {
      cb(file.name, file.type || 'application/pdf', String(r.result || ''));
    };
    r.readAsDataURL(file);
  }

  function renderWorkspace() {
    var root = document.getElementById('ms-gw-body');
    if (!root) return;

    if (STATE.activeView === 'usuarios') {
      var users = STATE.gestionWeb.webUsers || [];
      var q = (STATE.searchUser || '').trim().toLowerCase();
      var list = users.filter(function (u) {
        if (!q) return true;
        return (u.nombreCompleto + ' ' + u.email + ' ' + (u.dni || '') + ' ' + (u.obraSocial || '')).toLowerCase().indexOf(q) !== -1;
      });
      root.innerHTML =
        '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1rem;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;margin-bottom:0.85rem;">' +
            '<h3 style="margin:0;color:#112D3A;">Pacientes / Usuarios Registrados en la Web (' + users.length + ')</h3>' +
            '<input id="gw-search-u" value="' + esc(STATE.searchUser) + '" placeholder="Buscar por nombre, correo o DNI..." style="padding:0.48rem 0.7rem;border:1px solid #cbd5e1;border-radius:10px;min-width:240px;font-size:0.82rem;">' +
          '</div>' +
          (list.length === 0
            ? '<p style="color:#64748b;font-size:0.85rem;">Aún no hay usuarios registrados en /cemep. Cuando un paciente se registre con Google o Correo aparecerá aquí.</p>'
            : '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.82rem;">' +
                '<thead><tr style="text-align:left;border-bottom:2px solid #e2e8f0;color:#475569;">' +
                  '<th style="padding:0.55rem;">Paciente</th><th style="padding:0.55rem;">DNI</th><th style="padding:0.55rem;">Correo / Acceso</th><th style="padding:0.55rem;">Cobertura</th><th style="padding:0.55rem;">Estado</th><th style="padding:0.55rem;">Acciones</th>' +
                '</tr></thead><tbody>' +
                list.map(function (u) {
                  return (
                    '<tr style="border-bottom:1px solid #f1f5f9;">' +
                      '<td style="padding:0.55rem;"><strong>' + esc(u.nombreCompleto) + '</strong><div style="font-size:0.74rem;color:#64748b;">WA: ' + esc(u.whatsapp || '—') + '</div></td>' +
                      '<td style="padding:0.55rem;">' + esc(u.dni || 'Sin DNI') + '</td>' +
                      '<td style="padding:0.55rem;">' + esc(u.email) + ' <span style="background:#f1f5f9;padding:0.1rem 0.4rem;border-radius:6px;font-size:0.7rem;font-weight:700;">' + esc(u.authProvider === 'google' ? 'Google' : 'Email') + '</span></td>' +
                      '<td style="padding:0.55rem;">' + esc(u.obraSocial || 'Particular') + (u.esAfiliadoCemepPlus ? ' <span style="background:#e0f2fe;color:#0369a1;padding:0.1rem 0.4rem;border-radius:999px;font-size:0.7rem;font-weight:800;">CEMEP Plus</span>' : '') + '</td>' +
                      '<td style="padding:0.55rem;">' + (u.activo !== false ? '<span style="color:#166534;font-weight:800;">Activo</span>' : '<span style="color:#991b1b;font-weight:800;">Deshabilitado</span>') + '</td>' +
                      '<td style="padding:0.55rem;display:flex;gap:0.35rem;flex-wrap:wrap;">' +
                        '<button type="button" data-gw-toggle-u="' + esc(u.id) + '" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.25rem 0.55rem;font-size:0.74rem;">' + (u.activo !== false ? 'Deshabilitar' : 'Habilitar') + '</button>' +
                        '<button type="button" data-gw-edit-u="' + esc(u.id) + '" class="ms-sa-btn" style="padding:0.25rem 0.55rem;font-size:0.74rem;">Editar / Clave</button>' +
                      '</td>' +
                    '</tr>'
                  );
                }).join('') +
              '</tbody></table></div>') +
        '</div>';

      var su = root.querySelector('#gw-search-u');
      if (su) {
        su.addEventListener('input', function () {
          STATE.searchUser = su.value;
          renderWorkspace();
          var n = document.getElementById('gw-search-u');
          if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
        });
      }
      root.querySelectorAll('[data-gw-toggle-u]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var res = await apiWeb('POST', { action: 'toggle_web_user', id: b.getAttribute('data-gw-toggle-u') });
          if (res && res.ok) { applyRes(res); showToast(res.message, false); renderWorkspace(); }
        });
      });
      root.querySelectorAll('[data-gw-edit-u]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var uid = b.getAttribute('data-gw-edit-u');
          var u = users.find(function (x) { return x.id === uid; });
          if (!u) return;
          var newDni = window.prompt('DNI del paciente:', u.dni || '');
          if (newDni === null) return;
          var newOs = window.prompt('Obra Social / Cobertura:', u.obraSocial || '');
          if (newOs === null) return;
          var newPass = window.prompt('Nueva contraseña (dejar vacío para no cambiar):', '');
          var res = await apiWeb('POST', {
            action: 'update_web_user_admin',
            id: uid,
            dni: newDni,
            obraSocial: newOs,
            newPassword: newPass || undefined
          });
          if (res && res.ok) { applyRes(res); showToast(res.message, false); renderWorkspace(); }
        });
      });
      return;
    }

    if (STATE.activeView === 'editor') {
      var d = STATE.gestionWeb.draftContent;
      if (!d) {
        root.innerHTML = '<p>Cargando editor web...</p>';
        return;
      }
      var statusBanner = STATE.gestionWeb.hasUnpublishedChanges
        ? '<div style="background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:0.75rem 1rem;border-radius:12px;margin-bottom:1rem;font-weight:700;font-size:0.84rem;">⚠️ Tenés cambios guardados en borrador pendientes de publicación. Presioná «Publicar en la Web» para actualizar /cemep.</div>'
        : '<div style="background:#dcfce7;border:1px solid #34d399;color:#065f46;padding:0.75rem 1rem;border-radius:12px;margin-bottom:1rem;font-weight:700;font-size:0.84rem;">✅ La página web /cemep está actualizada (última publicación: ' + esc((STATE.gestionWeb.publishedAt || '').slice(0, 16).replace('T', ' ')) + ' por ' + esc(STATE.gestionWeb.publishedBy || 'Sistema') + ').</div>';

      root.innerHTML =
        statusBanner +
        '<form id="ms-gw-editor-form" style="display:flex;flex-direction:column;gap:1rem;">' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.6rem;justify-content:flex-end;">' +
            '<button type="button" id="gw-btn-discard" class="ms-sa-btn ms-sa-btn--outline">Descartar Borrador</button>' +
            '<button type="button" id="gw-btn-save-draft" class="ms-sa-btn ms-sa-btn--outline">💾 Guardar Borrador</button>' +
            '<button type="submit" id="gw-btn-publish" class="ms-sa-btn" style="background:#16a34a;color:#fff;">🚀 Publicar en la Web (/cemep)</button>' +
          '</div>' +

          // BLOQUE 1: GENERAL
          '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1rem;">' +
            '<h3 style="margin:0 0 0.7rem;color:#112D3A;">1. Datos Institucionales y Aviso Superior</h3>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.6rem;">' +
              '<label style="font-size:0.76rem;font-weight:700;">Dirección<input id="gwe-dir" value="' + esc(d.general.direccion) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
              '<label style="font-size:0.76rem;font-weight:700;">Localidad<input id="gwe-loc" value="' + esc(d.general.localidad) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
              '<label style="font-size:0.76rem;font-weight:700;">Email Institucional<input id="gwe-email" value="' + esc(d.general.emailInstitucional) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
              '<label style="font-size:0.76rem;font-weight:700;">Google Client ID (Opcional OAuth)<input id="gwe-gclient" value="' + esc(STATE.gestionWeb.googleClientId || '') + '" placeholder="xxx.apps.googleusercontent.com" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
            '</div>' +
            '<div style="margin-top:0.6rem;display:flex;flex-wrap:wrap;gap:0.6rem;align-items:center;">' +
              '<label style="font-size:0.8rem;font-weight:700;display:flex;align-items:center;gap:0.4rem;"><input id="gwe-aviso-on" type="checkbox"' + (d.general.avisoSuperiorActivo ? ' checked' : '') + '> Mostrar cinta superior destacada</label>' +
              '<input id="gwe-aviso-txt" value="' + esc(d.general.avisoSuperiorTexto) + '" style="flex:1;min-width:260px;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '</div>' +
          '</div>' +

          // BLOQUE 2: CEMEP
          '<div style="background:#fff;border:1px solid #bae6fd;border-radius:14px;padding:1rem;">' +
            '<h3 style="margin:0 0 0.7rem;color:#1B335D;">2. Pestaña CEMEP (Centro Médico Paulucci)</h3>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.6rem;">' +
              '<label style="font-size:0.76rem;font-weight:700;">WhatsApp CEMEP (dígitos)<input id="gwe-c-wadig" value="' + esc(d.cemep.whatsappDigits) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
              '<label style="font-size:0.76rem;font-weight:700;">WhatsApp CEMEP (visible)<input id="gwe-c-wadisp" value="' + esc(d.cemep.whatsappDisplay) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
              '<label style="font-size:0.76rem;font-weight:700;">Título Principal Hero<input id="gwe-c-title" value="' + esc(d.cemep.heroTitle) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
              '<label style="font-size:0.76rem;font-weight:700;">Fecha / Texto Circuito Integral<input id="gwe-c-circfecha" value="' + esc(d.cemep.circuitoFechaTexto) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
            '</div>' +
            '<label style="display:block;margin-top:0.6rem;font-size:0.76rem;font-weight:700;">Subtítulo Hero CEMEP<textarea id="gwe-c-sub" rows="2" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;">' + esc(d.cemep.heroSubtitle) + '</textarea></label>' +
            '<label style="display:block;margin-top:0.6rem;font-size:0.76rem;font-weight:700;">Especialidades Destacadas (una por línea)<textarea id="gwe-c-esps" rows="4" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;font-family:inherit;">' + esc((d.cemep.especialidadesDestacadas || []).join('\n')) + '</textarea></label>' +
            '<label style="display:block;margin-top:0.6rem;font-size:0.76rem;font-weight:700;">Tips de Salud del Community Manager (JSON editable)<textarea id="gwe-c-tips" rows="6" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;font-family:monospace;font-size:0.74rem;">' + esc(JSON.stringify(d.cemep.tipsSalud || [], null, 2)) + '</textarea></label>' +
          '</div>' +

          // BLOQUE 3: CEMEP PLUS
          '<div style="background:#fff;border:1px solid #a7f3d0;border-radius:14px;padding:1rem;">' +
            '<h3 style="margin:0 0 0.7rem;color:#0B6E5B;">3. Pestaña CEMEP Plus (Cobertura y Comercios Adheridos)</h3>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.6rem;">' +
              '<label style="font-size:0.76rem;font-weight:700;">WhatsApp CEMEP Plus (dígitos)<input id="gwe-p-wadig" value="' + esc(d.cemepPlus.whatsappDigits) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
              '<label style="font-size:0.76rem;font-weight:700;">WhatsApp CEMEP Plus (visible)<input id="gwe-p-wadisp" value="' + esc(d.cemepPlus.whatsappDisplay) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
              '<label style="font-size:0.76rem;font-weight:700;">Título Hero CEMEP Plus<input id="gwe-p-title" value="' + esc(d.cemepPlus.heroTitle) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
              '<label style="font-size:0.76rem;font-weight:700;">Slogan Corto<input id="gwe-p-slogan" value="' + esc(d.cemepPlus.sloganCorto) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
            '</div>' +
            '<label style="display:block;margin-top:0.6rem;font-size:0.76rem;font-weight:700;">Subtítulo Hero CEMEP Plus<textarea id="gwe-p-sub" rows="2" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;">' + esc(d.cemepPlus.heroSubtitle) + '</textarea></label>' +
            '<label style="display:block;margin-top:0.6rem;font-size:0.76rem;font-weight:700;">Beneficio Estrella (50% DTO Circuitos)<input id="gwe-p-estrella" value="' + esc(d.cemepPlus.beneficioEstrellaTexto) + '" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;"></label>' +
            '<label style="display:block;margin-top:0.6rem;font-size:0.76rem;font-weight:700;">Comercios Adheridos (JSON editable)<textarea id="gwe-p-comercios" rows="6" style="width:100%;padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;margin-top:0.2rem;font-family:monospace;font-size:0.74rem;">' + esc(JSON.stringify(d.cemepPlus.comerciosAdheridos || [], null, 2)) + '</textarea></label>' +
          '</div>' +
        '</form>';

      function collectDraft() {
        var next = JSON.parse(JSON.stringify(STATE.gestionWeb.draftContent));
        next.general.direccion = root.querySelector('#gwe-dir').value.trim();
        next.general.localidad = root.querySelector('#gwe-loc').value.trim();
        next.general.emailInstitucional = root.querySelector('#gwe-email').value.trim();
        next.general.avisoSuperiorActivo = root.querySelector('#gwe-aviso-on').checked;
        next.general.avisoSuperiorTexto = root.querySelector('#gwe-aviso-txt').value.trim();

        next.cemep.whatsappDigits = root.querySelector('#gwe-c-wadig').value.replace(/\D/g, '');
        next.cemep.whatsappDisplay = root.querySelector('#gwe-c-wadisp').value.trim();
        next.cemep.heroTitle = root.querySelector('#gwe-c-title').value.trim();
        next.cemep.heroSubtitle = root.querySelector('#gwe-c-sub').value.trim();
        next.cemep.circuitoFechaTexto = root.querySelector('#gwe-c-circfecha').value.trim();
        next.cemep.especialidadesDestacadas = root.querySelector('#gwe-c-esps').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        try {
          var parsedTips = JSON.parse(root.querySelector('#gwe-c-tips').value);
          if (Array.isArray(parsedTips)) next.cemep.tipsSalud = parsedTips;
        } catch (_e) {
          showToast('El JSON de Tips de Salud tiene un error de formato. Revisalo antes de guardar.', true);
          return null;
        }

        next.cemepPlus.whatsappDigits = root.querySelector('#gwe-p-wadig').value.replace(/\D/g, '');
        next.cemepPlus.whatsappDisplay = root.querySelector('#gwe-p-wadisp').value.trim();
        next.cemepPlus.heroTitle = root.querySelector('#gwe-p-title').value.trim();
        next.cemepPlus.sloganCorto = root.querySelector('#gwe-p-slogan').value.trim();
        next.cemepPlus.heroSubtitle = root.querySelector('#gwe-p-sub').value.trim();
        next.cemepPlus.beneficioEstrellaTexto = root.querySelector('#gwe-p-estrella').value.trim();
        try {
          var parsedCom = JSON.parse(root.querySelector('#gwe-p-comercios').value);
          if (Array.isArray(parsedCom)) next.cemepPlus.comerciosAdheridos = parsedCom;
        } catch (_e) {
          showToast('El JSON de Comercios Adheridos tiene un error de formato.', true);
          return null;
        }

        return {
          draftContent: next,
          googleClientId: root.querySelector('#gwe-gclient').value.trim()
        };
      }

      root.querySelector('#gw-btn-save-draft').addEventListener('click', async function () {
        var payload = collectDraft();
        if (!payload) return;
        var res = await apiWeb('POST', { action: 'save_web_draft', draftContent: payload.draftContent, googleClientId: payload.googleClientId });
        if (res && res.ok) { applyRes(res); showToast(res.message, false); renderWorkspace(); }
      });

      root.querySelector('#gw-btn-discard').addEventListener('click', async function () {
        if (!window.confirm('¿Descartar los cambios sin publicar y restaurar la versión publicada?')) return;
        var res = await apiWeb('POST', { action: 'discard_web_draft' });
        if (res && res.ok) { applyRes(res); showToast(res.message, false); renderWorkspace(); }
      });

      root.querySelector('#ms-gw-editor-form').addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var payload = collectDraft();
        if (!payload) return;
        var res = await apiWeb('POST', { action: 'publish_web', draftContent: payload.draftContent, googleClientId: payload.googleClientId });
        if (res && res.ok) { applyRes(res); showToast(res.message, false); renderWorkspace(); }
      });
      return;
    }

    if (STATE.activeView === 'recetas') {
      var recs = STATE.recetas || [];
      root.innerHTML =
        '<div style="display:grid;grid-template-columns:minmax(270px,360px) 1fr;gap:1rem;align-items:start;">' +
          '<form id="gw-receta-manual-form" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:1rem;display:flex;flex-direction:column;gap:0.5rem;">' +
            '<h3 style="margin:0;color:#112D3A;font-size:0.95rem;">➕ Cargar Receta Digital Directa</h3>' +
            '<input id="gwrm-dni" required placeholder="DNI del paciente *" style="padding:0.46rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<input id="gwrm-nom" required placeholder="Nombre y Apellido *" style="padding:0.46rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<input id="gwrm-os" placeholder="Obra Social / CEMEP Plus" style="padding:0.46rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<input id="gwrm-prof" placeholder="Profesional emisor" style="padding:0.46rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<textarea id="gwrm-meds" required rows="3" placeholder="Medicamentos / prescripción *" style="padding:0.46rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;"></textarea>' +
            '<input id="gwrm-code" placeholder="Código validación (opcional)" style="padding:0.46rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<input id="gwrm-file" type="file" accept=".pdf,image/*" style="font-size:0.78rem;">' +
            '<button type="submit" class="ms-sa-btn">Emitir y Cargar Receta Digital</button>' +
          '</form>' +
          '<div>' +
            '<h3 style="margin:0 0 0.65rem;color:#112D3A;">Solicitudes de Pacientes (' + recs.length + ')</h3>' +
            (recs.length === 0
              ? '<p style="color:#64748b;font-size:0.85rem;">No hay solicitudes de recetas aún.</p>'
              : recs.map(function (r) {
                  return (
                    '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:0.9rem;margin-bottom:0.6rem;">' +
                      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;">' +
                        '<strong>' + esc(r.codigo) + ' · ' + esc(r.pacienteNombre) + ' (DNI ' + esc(r.pacienteDni || '—') + ')</strong>' +
                        '<span style="background:' + (r.estado === 'emitida' ? '#dcfce7' : '#fef3c7') + ';color:' + (r.estado === 'emitida' ? '#166534' : '#92400e') + ';padding:0.15rem 0.55rem;border-radius:999px;font-size:0.72rem;font-weight:800;text-transform:uppercase;">' + esc(r.estado) + '</span>' +
                      '</div>' +
                      '<div style="font-size:0.78rem;color:#64748b;margin-top:0.2rem;">' + esc(r.obraSocialNombre) + ' · ' + esc(r.pacienteEmail) + ' · WA: ' + esc(r.pacienteWhatsapp || '—') + '</div>' +
                      '<div style="background:#f8fafc;border-radius:8px;padding:0.55rem;margin:0.45rem 0;font-size:0.84rem;white-space:pre-wrap;">' + esc(r.medicamentosSolicitados) + '</div>' +
                      '<div style="display:flex;flex-wrap:wrap;gap:0.45rem;align-items:center;">' +
                        '<input data-gwr-code="' + esc(r.id) + '" value="' + esc(r.recetaCodigoValidacion || '') + '" placeholder="Código validación" style="padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.78rem;">' +
                        '<input data-gwr-obs="' + esc(r.id) + '" value="' + esc(r.observacionesAdmin || '') + '" placeholder="Observaciones" style="padding:0.35rem 0.5rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.78rem;min-width:190px;">' +
                        '<label class="ms-sa-btn" style="padding:0.35rem 0.75rem;font-size:0.76rem;cursor:pointer;">📎 Cargar Receta Digital<input type="file" accept=".pdf,image/*" data-gwr-up="' + esc(r.id) + '" style="display:none;"></label>' +
                        (r.recetaArchivoDataUrl ? '<a href="' + r.recetaArchivoDataUrl + '" download="' + esc(r.recetaArchivoNombre || r.codigo + '.pdf') + '" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.35rem 0.7rem;font-size:0.76rem;">⬇️ Descargar</a>' : '') +
                      '</div>' +
                    '</div>'
                  );
                }).join('')) +
          '</div>' +
        '</div>';

      var manualFile = { name: '', mime: '', url: '' };
      var mFileInp = root.querySelector('#gwrm-file');
      if (mFileInp) {
        mFileInp.addEventListener('change', function () {
          readFileToDataUrl(mFileInp.files && mFileInp.files[0], function (n, m, u) {
            manualFile = { name: n, mime: m, url: u };
          });
        });
      }
      root.querySelector('#gw-receta-manual-form').addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiWeb('POST', {
          action: 'create_receta_manual',
          receta: {
            pacienteDni: root.querySelector('#gwrm-dni').value,
            pacienteNombre: root.querySelector('#gwrm-nom').value,
            obraSocialNombre: root.querySelector('#gwrm-os').value,
            profesionalNombre: root.querySelector('#gwrm-prof').value,
            medicamentosSolicitados: root.querySelector('#gwrm-meds').value,
            recetaCodigoValidacion: root.querySelector('#gwrm-code').value,
            recetaArchivoNombre: manualFile.name || undefined,
            recetaArchivoMime: manualFile.mime || undefined,
            recetaArchivoDataUrl: manualFile.url || undefined
          }
        });
        if (res && res.ok) { applyRes(res); showToast(res.message, false); renderWorkspace(); }
        else showToast((res && res.message) || 'Error cargando receta.', true);
      });

      root.querySelectorAll('[data-gwr-up]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var rid = inp.getAttribute('data-gwr-up');
          var c = root.querySelector('[data-gwr-code="' + rid + '"]');
          var o = root.querySelector('[data-gwr-obs="' + rid + '"]');
          readFileToDataUrl(inp.files && inp.files[0], async function (n, m, u) {
            var res = await apiWeb('POST', {
              action: 'upload_receta_digital',
              id: rid,
              estado: 'emitida',
              recetaCodigoValidacion: c ? c.value : '',
              observacionesAdmin: o ? o.value : '',
              recetaArchivoNombre: n,
              recetaArchivoMime: m,
              recetaArchivoDataUrl: u
            });
            if (res && res.ok) { applyRes(res); showToast(res.message, false); renderWorkspace(); }
          });
        });
      });
      return;
    }

    if (STATE.activeView === 'profesionales') {
      var accs = STATE.gestionWeb.profesionalAccounts || [];
      var profs = STATE.profesionalesTurnero || [];
      root.innerHTML =
        '<div style="display:grid;grid-template-columns:minmax(270px,360px) 1fr;gap:1rem;align-items:start;">' +
          '<form id="gw-prof-acc-form" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:1rem;display:flex;flex-direction:column;gap:0.55rem;">' +
            '<h3 style="margin:0;color:#112D3A;font-size:0.95rem;">🩺 Habilitar Acceso a Profesional</h3>' +
            '<select id="gwp-prof" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
              '<option value="*">Vista General (Todos los turnos del centro)</option>' +
              profs.map(function (p) {
                return '<option value="' + esc(p.id) + '" data-dni="' + esc(p.dni) + '" data-email="' + esc(p.email || '') + '" data-nom="' + esc(p.nombreCompleto) + '">' + esc(p.nombreCompleto) + ' (DNI ' + esc(p.dni) + ')</option>';
              }).join('') +
            '</select>' +
            '<input id="gwp-nom" required placeholder="Nombre del Profesional *" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<input id="gwp-dni" placeholder="DNI (para iniciar sesión)" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<input id="gwp-email" type="email" placeholder="Correo electrónico (alternativo)" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<input id="gwp-pass" type="password" required placeholder="Contraseña de acceso *" style="padding:0.48rem;border:1px solid #cbd5e1;border-radius:8px;font-size:0.82rem;">' +
            '<button type="submit" class="ms-sa-btn">Guardar Acceso Profesional</button>' +
          '</form>' +
          '<div>' +
            '<h3 style="margin:0 0 0.65rem;color:#112D3A;">Accesos Habilitados (' + accs.length + ')</h3>' +
            '<p style="font-size:0.8rem;color:#64748b;margin-top:0;">Nota: los usuarios ERP de MiniSistema también pueden ingresar automáticamente al Portal de Profesionales en /cemep.</p>' +
            (accs.length === 0
              ? '<p style="font-size:0.84rem;color:#64748b;">No creaste cuentas dedicadas de profesionales todavía.</p>'
              : accs.map(function (a) {
                  return (
                    '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:0.85rem;margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">' +
                      '<div><strong>' + esc(a.profesionalNombre) + '</strong><div style="font-size:0.78rem;color:#64748b;">DNI: ' + esc(a.dni || '—') + ' · Email: ' + esc(a.email || '—') + '</div></div>' +
                      '<button type="button" data-gwp-del="' + esc(a.id) + '" style="border:none;background:#fee2e2;color:#991b1b;border-radius:8px;padding:0.3rem 0.65rem;font-size:0.75rem;font-weight:700;cursor:pointer;">Eliminar</button>' +
                    '</div>'
                  );
                }).join('')) +
          '</div>' +
        '</div>';

      var sel = root.querySelector('#gwp-prof');
      if (sel) {
        sel.addEventListener('change', function () {
          var opt = sel.options[sel.selectedIndex];
          if (opt && opt.getAttribute('data-nom')) {
            root.querySelector('#gwp-nom').value = opt.getAttribute('data-nom') || '';
            root.querySelector('#gwp-dni').value = opt.getAttribute('data-dni') || '';
            root.querySelector('#gwp-email').value = opt.getAttribute('data-email') || '';
          }
        });
      }
      root.querySelector('#gw-prof-acc-form').addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var res = await apiWeb('POST', {
          action: 'save_prof_account',
          profesionalId: root.querySelector('#gwp-prof').value,
          profesionalNombre: root.querySelector('#gwp-nom').value,
          dni: root.querySelector('#gwp-dni').value,
          email: root.querySelector('#gwp-email').value,
          password: root.querySelector('#gwp-pass').value
        });
        if (res && res.ok) { applyRes(res); showToast(res.message, false); renderWorkspace(); }
        else showToast((res && res.message) || 'Error guardando acceso.', true);
      });
      root.querySelectorAll('[data-gwp-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!window.confirm('¿Eliminar este acceso profesional?')) return;
          var res = await apiWeb('POST', { action: 'delete_prof_account', id: b.getAttribute('data-gwp-del') });
          if (res && res.ok) { applyRes(res); showToast(res.message, false); renderWorkspace(); }
        });
      });
    }
  }

  function bindGlobalNavReset() {
    if (window.__MS_GW_NAV_BOUND__) return;
    window.__MS_GW_NAV_BOUND__ = true;
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || typeof t.closest !== 'function') return;
      var nav = t.closest('#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-cv-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card');
      if (nav) {
        var m = document.getElementById('sec-menu-gestion-web');
        var w = document.getElementById('sec-gestion-web-workspace');
        if (m) m.hidden = true;
        if (w) w.hidden = true;
      }
    }, true);
  }

  var initialLoaded = false;

  function syncHomeCard() {
    bindGlobalNavReset();
    var allowed = isGestionWebAllowed();
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-gestion-web-home-card');

    if (allowed && inicioGrid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-gestion-web-home-card';
      card.className = 'module-card';
      card.setAttribute('data-module-key', 'gestion_web');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>' +
        '</div>' +
        '<h3>Gestión Web</h3>';

      card.addEventListener('click', function () { openView('menu'); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openView('menu');
        }
      });

      var perfilCard = inicioGrid.querySelector('[data-module-key="perfil"]');
      if (perfilCard) inicioGrid.insertBefore(card, perfilCard);
      else inicioGrid.appendChild(card);

      if (!initialLoaded) {
        initialLoaded = true;
        reloadData(false);
      }
    } else if (existing) {
      existing.hidden = !allowed;
      existing.style.display = allowed ? '' : 'none';
    }
  }

  setInterval(syncHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncHomeCard);
})();
