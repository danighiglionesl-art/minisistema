/* ==========================================================================
   MÓDULO "CURRICULUM VITAE" — EXCLUSIVO DE MINISISTEMA ERP
   Vinculado en vivo con el portal público /cv:
   - Submódulo "CV recibidos" (todos los recibidos aún sin previsualizar)
   - Submódulo "CV previsualizados" (todos los previsualizados + valoración 1 a 10)
   - Visor completo de ficha, fotografía, adjunto PDF, WhatsApp y Código QR
   ========================================================================== */
(function () {
  'use strict';

  var STATE_CV = {
    activeView: 'menu', // 'menu' | 'recibidos' | 'previsualizados' | 'portal' | 'detail'
    previousListView: 'recibidos',
    publicCvUrl: '/cv',
    stats: {
      totalActivos: 0,
      recibidosSinVer: 0,
      actualizadosSinVerCount: 0,
      previsualizadosCount: 0,
      promedioValoracion: null
    },
    recibidos: [],
    previsualizados: [],
    selectedCv: null,
    filterPuesto: '',
    filterMinRating: 0,
    filterSearch: '',
    filterDni: '',
    sortBy: 'recent' // 'recent' | 'rating_desc'
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

  function isCvModuleAllowed() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    if (String(u.username).toLowerCase() === 'danielg' || u.role === 'Administrador General') {
      return true;
    }
    var brandMods = (window.ERP_BRAND && window.ERP_BRAND.enabledModules) || [];
    if (Array.isArray(brandMods) && brandMods.length > 0 && brandMods.indexOf('cv') === -1) {
      return false;
    }
    if (u.role === 'Administrador') return true;
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return (
      uMods.indexOf('cv') !== -1 ||
      uMods.indexOf('cv:recibidos') !== -1 ||
      uMods.indexOf('cv:previsualizados') !== -1
    );
  }

  async function apiCv(method, bodyOrQuery) {
    var url = '/sistema/api/curriculum.php';
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

  function ratingBadgeColor(val) {
    var n = Number(val || 0);
    if (!n) return { bg: '#e2e8f0', fg: '#334155', label: 'Sin valorar' };
    if (n >= 8) return { bg: '#dcfce7', fg: '#065f46', label: '⭐ ' + n + ' / 10' };
    if (n >= 5) return { bg: '#fef3c7', fg: '#92400e', label: '⭐ ' + n + ' / 10' };
    return { bg: '#fee2e2', fg: '#991b1b', label: '⭐ ' + n + ' / 10' };
  }

  function ensureCvSectionsMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var menuSec = document.getElementById('sec-menu-cv');
    var detailSec = document.getElementById('sec-cv-workspace');

    if (!menuSec) {
      menuSec = document.createElement('section');
      menuSec.id = 'sec-menu-cv';
      menuSec.className = 'erp-section';
      menuSec.hidden = true;
      menuSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-cv-back-home-btn">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">ERP en Línea · <strong>Curriculum Vitae</strong></span>' +
          '</div>' +
          '<a href="/cv" target="_blank" class="ms-sa-btn" style="padding:0.42rem 0.9rem;font-size:0.8rem;" id="ms-cv-open-public-top">🌐 Abrir Formulario Público /cv ↗</a>' +
        '</div>' +
        '<div class="modules-grid" aria-label="Submódulos de Curriculum Vitae">' +
          '<article class="module-card" role="button" tabindex="0" data-cv-sub="recibidos">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
              '<div class="module-icon" aria-hidden="true">' +
                '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                  '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>' +
                  '<path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>' +
                '</svg>' +
              '</div>' +
              '<span id="ms-cv-badge-recibidos" style="background:#56D7A1;color:#112D3A;font-size:0.76rem;font-weight:900;padding:0.2rem 0.65rem;border-radius:999px;">0 sin ver</span>' +
            '</div>' +
            '<h3>CV recibidos</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-cv-sub="previsualizados">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
              '<div class="module-icon" aria-hidden="true">' +
                '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                  '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>' +
                '</svg>' +
              '</div>' +
              '<span id="ms-cv-badge-prev" style="background:rgba(17,45,58,0.1);color:#112D3A;font-size:0.76rem;font-weight:800;padding:0.2rem 0.65rem;border-radius:999px;">0 evaluados</span>' +
            '</div>' +
            '<h3>CV previsualizados</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-cv-sub="portal">' +
            '<div class="module-icon" aria-hidden="true">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect>' +
                '<rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>' +
              '</svg>' +
            '</div>' +
            '<h3>Enlace y Código QR (/cv)</h3>' +
          '</article>' +
        '</div>';

      erpMain.appendChild(menuSec);

      menuSec.querySelector('#ms-cv-back-home-btn').addEventListener('click', closeCvToHome);
      menuSec.querySelectorAll('[data-cv-sub]').forEach(function (card) {
        card.addEventListener('click', function () {
          openCvView(card.getAttribute('data-cv-sub'));
        });
        card.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            openCvView(card.getAttribute('data-cv-sub'));
          }
        });
      });
    }

    if (!detailSec) {
      detailSec = document.createElement('section');
      detailSec.id = 'sec-cv-workspace';
      detailSec.className = 'erp-section';
      detailSec.hidden = true;
      detailSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-cv-back-sub-btn">← Volver a Curriculum Vitae</button>' +
            '<span class="module-breadcrumb">Curriculum Vitae · <strong id="ms-cv-sub-title">CV recibidos</strong></span>' +
          '</div>' +
          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-cv-refresh-btn" style="padding:0.38rem 0.8rem;font-size:0.78rem;">🔄 Actualizar</button>' +
        '</div>' +
        '<div id="ms-cv-toast" style="display:none;margin-bottom:0.9rem;padding:0.7rem 1rem;border-radius:10px;font-weight:700;font-size:0.85rem;"></div>' +
        '<div id="ms-cv-body"></div>';

      erpMain.appendChild(detailSec);

      detailSec.querySelector('#ms-cv-back-sub-btn').addEventListener('click', function () {
        if (STATE_CV.activeView === 'detail') {
          openCvView(STATE_CV.previousListView || 'previsualizados');
        } else {
          openCvView('menu');
        }
      });
      detailSec.querySelector('#ms-cv-refresh-btn').addEventListener('click', function () {
        reloadCvData(true);
      });
    }

    return { menuSec: menuSec, detailSec: detailSec };
  }

  function showCvToast(msg, isErr) {
    var el = document.getElementById('ms-cv-toast');
    if (!el) return;
    el.style.display = 'block';
    el.style.background = isErr ? '#fee2e2' : '#dcfce7';
    el.style.color = isErr ? '#991b1b' : '#065f46';
    el.style.border = isErr ? '1px solid #f87171' : '1px solid #34d399';
    el.textContent = msg;
    setTimeout(function () {
      if (el.textContent === msg) el.style.display = 'none';
    }, 5000);
  }

  function hideAllErpSections() {
    document.querySelectorAll('.erp-main > .erp-section').forEach(function (sec) {
      sec.hidden = true;
    });
  }

  function closeCvToHome() {
    hideAllErpSections();
    var inicio = document.getElementById('sec-inicio');
    if (inicio) inicio.hidden = false;
    var backTopBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backTopBtn) backTopBtn.hidden = true;
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    if (topbarModInd) topbarModInd.hidden = true;
  }

  async function openCvView(viewName) {
    var refs = ensureCvSectionsMounted();
    if (!refs) return;
    STATE_CV.activeView = viewName || 'menu';
    hideAllErpSections();

    var titleMap = {
      recibidos: 'CV recibidos (sin previsualizar)',
      previsualizados: 'CV previsualizados (Valoración 1 a 10)',
      portal: 'Enlace Público y Código QR (/cv)',
      detail: 'Ficha Completa del Postulante'
    };

    var backTopBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backTopBtn) {
      backTopBtn.hidden = false;
      backTopBtn.textContent = '← Atrás';
    }
    var topbarModInd = document.getElementById('topbar-caja-indicator');
    if (topbarModInd) {
      topbarModInd.hidden = false;
      topbarModInd.textContent =
        STATE_CV.activeView === 'menu'
          ? 'Curriculum Vitae'
          : 'Curriculum Vitae · ' + (titleMap[STATE_CV.activeView] || '');
    }

    if (STATE_CV.activeView === 'menu') {
      refs.menuSec.hidden = false;
      await reloadCvData(false);
    } else {
      refs.detailSec.hidden = false;
      var tEl = document.getElementById('ms-cv-sub-title');
      if (tEl) tEl.textContent = titleMap[STATE_CV.activeView] || 'Curriculum Vitae';
      if (STATE_CV.activeView !== 'detail') {
        await reloadCvData(true);
      } else {
        renderCvWorkspace();
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function reloadCvData(renderAfter) {
    try {
      var res = await apiCv('GET', { action: 'list', t: String(Date.now()) });
      if (res && res.ok) {
        STATE_CV.publicCvUrl = res.publicCvUrl || '/cv';
        STATE_CV.stats = res.stats || STATE_CV.stats;
        STATE_CV.recibidos = Array.isArray(res.recibidos) ? res.recibidos : [];
        STATE_CV.previsualizados = Array.isArray(res.previsualizados) ? res.previsualizados : [];
        syncCountersUi();
      }
    } catch (_e) {}
    if (renderAfter) {
      renderCvWorkspace();
    }
  }

  function syncCountersUi() {
    var unread = Number(STATE_CV.stats.recibidosSinVer || 0);
    var updatedUnread = Number(STATE_CV.stats.actualizadosSinVerCount || 0);
    var prevCount = Number(STATE_CV.stats.previsualizadosCount || 0);

    var bRec = document.getElementById('ms-cv-badge-recibidos');
    if (bRec) {
      bRec.textContent =
        unread +
        ' sin ver' +
        (updatedUnread > 0 ? ' · 🔔 ' + updatedUnread + ' actualizados' : '');
    }

    var bPrev = document.getElementById('ms-cv-badge-prev');
    if (bPrev) {
      var avgTxt = STATE_CV.stats.promedioValoracion ? ' · Prom: ' + STATE_CV.stats.promedioValoracion + '/10' : '';
      bPrev.textContent = prevCount + ' previsualizados' + avgTxt;
    }

    var homeBadge = document.getElementById('ms-cv-home-unread-pill');
    if (homeBadge) {
      if (updatedUnread > 0) {
        homeBadge.textContent = '🔔 ' + unread + ' (' + updatedUnread + ' ACT.)';
        homeBadge.style.background = '#56D7A1';
      } else {
        homeBadge.textContent = unread > 0 ? unread + ' NUEVOS' : 'ACTIVO';
        homeBadge.style.background = unread > 0 ? '#56D7A1' : 'rgba(86,215,161,0.18)';
      }
    }

    var openTop = document.getElementById('ms-cv-open-public-top');
    if (openTop && STATE_CV.publicCvUrl) {
      openTop.href = STATE_CV.publicCvUrl;
    }
  }

  function renderAvatarHtml(cv, sizePx) {
    var sz = sizePx || 46;
    if (cv.archivos && cv.archivos.fotoUrl) {
      return (
        '<img src="' +
        esc(cv.archivos.fotoUrl) +
        '" alt="' +
        esc(cv.personal && cv.personal.nombreCompleto) +
        '" style="width:' +
        sz +
        'px;height:' +
        sz +
        'px;border-radius:12px;object-fit:cover;border:2px solid #56D7A1;flex-shrink:0;">'
      );
    }
    var ini =
      ((cv.personal && cv.personal.apellidos && cv.personal.apellidos.charAt(0)) || 'C').toUpperCase();
    return (
      '<span style="display:inline-flex;align-items:center;justify-content:center;width:' +
      sz +
      'px;height:' +
      sz +
      'px;border-radius:12px;background:#112D3A;color:#56D7A1;font-weight:900;font-size:1rem;flex-shrink:0;">' +
      esc(ini) +
      '</span>'
    );
  }

  function renderCvListView(isPrevisualizados) {
    var sourceList = isPrevisualizados ? STATE_CV.previsualizados : STATE_CV.recibidos;
    var allPuestos = {};
    sourceList.forEach(function (c) {
      var p = c.postulacion && c.postulacion.puestoPrincipal;
      if (p) allPuestos[p] = true;
    });

    var filtered = sourceList.filter(function (c) {
      if (STATE_CV.filterDni) {
        var qDni = String(STATE_CV.filterDni).replace(/\D/g, '') || String(STATE_CV.filterDni).toLowerCase();
        var docRaw = String((c.personal && c.personal.nroDoc) || '');
        var docClean = docRaw.replace(/\D/g, '') || docRaw.toLowerCase();
        if (docClean.indexOf(qDni) === -1 && docRaw.toLowerCase().indexOf(String(STATE_CV.filterDni).toLowerCase()) === -1) {
          return false;
        }
      }
      if (STATE_CV.filterPuesto && (!c.postulacion || c.postulacion.puestoPrincipal !== STATE_CV.filterPuesto)) {
        return false;
      }
      if (isPrevisualizados && STATE_CV.filterMinRating > 0) {
        if (Number(c.rating || 0) < STATE_CV.filterMinRating) return false;
      }
      if (STATE_CV.filterSearch) {
        var q = STATE_CV.filterSearch.toLowerCase();
        var hay = [
          c.codigo,
          c.personal && c.personal.nombreCompleto,
          c.personal && c.personal.nroDoc,
          c.ubicacionContacto && c.ubicacionContacto.localidad,
          c.postulacion && c.postulacion.puestoPrincipal
        ]
          .join(' ')
          .toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (isPrevisualizados && STATE_CV.sortBy === 'rating_desc') {
      filtered.sort(function (a, b) {
        return Number(b.rating || 0) - Number(a.rating || 0);
      });
    }

    var puestoOptions = Object.keys(allPuestos)
      .sort()
      .map(function (p) {
        return (
          '<option value="' +
          esc(p) +
          '" ' +
          (STATE_CV.filterPuesto === p ? 'selected' : '') +
          '>' +
          esc(p) +
          '</option>'
        );
      })
      .join('');

    var rowsHtml =
      filtered.length === 0
        ? '<tr><td colspan="7" style="padding:2rem;text-align:center;color:#546e7a;font-weight:700;">' +
          (isPrevisualizados
            ? 'Aún no hay CVs previsualizados con los filtros actuales.'
            : '🎉 No hay CVs pendientes de previsualizar en este momento.') +
          '</td></tr>'
        : filtered
            .map(function (c) {
              var p = c.personal || {};
              var u = c.ubicacionContacto || {};
              var post = c.postulacion || {};
              var arch = c.archivos || {};
              var rb = ratingBadgeColor(c.rating);
              var quickSelectRating = '';

              if (isPrevisualizados) {
                var opts1to10 = '<option value="">Valorar (1-10)</option>';
                for (var score = 1; score <= 10; score++) {
                  opts1to10 +=
                    '<option value="' +
                    score +
                    '" ' +
                    (Number(c.rating) === score ? 'selected' : '') +
                    '>' +
                    score +
                    ' / 10</option>';
                }
                quickSelectRating =
                  '<div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">' +
                  '<span style="background:' +
                  rb.bg +
                  ';color:' +
                  rb.fg +
                  ';padding:0.22rem 0.55rem;border-radius:999px;font-size:0.76rem;font-weight:800;">' +
                  rb.label +
                  '</span>' +
                  '<select class="ms-sa-select" data-quick-rate="' +
                  esc(c.id) +
                  '" style="width:auto;padding:0.25rem 0.45rem;font-size:0.76rem;font-weight:700;">' +
                  opts1to10 +
                  '</select>' +
                  '</div>';
              }

              var updateBadgeHtml = c.hasCandidateUpdate
                ? '<span style="display:inline-flex;align-items:center;gap:0.25rem;background:#56D7A1;color:#112D3A;font-size:0.7rem;font-weight:900;padding:0.15rem 0.5rem;border-radius:999px;margin-left:0.4rem;">🔔 NUEVOS DATOS ACTUALIZADOS</span>'
                : Number(c.candidateUpdateCount || 0) > 0
                  ? '<span style="display:inline-flex;align-items:center;gap:0.25rem;background:rgba(86,215,161,0.2);color:#0f5d3f;font-size:0.7rem;font-weight:800;padding:0.12rem 0.45rem;border-radius:999px;margin-left:0.4rem;">↻ Actualizado (' +
                    esc(c.candidateUpdateCount) +
                    ')</span>'
                  : '';

              return (
                '<tr style="border-bottom:1px solid #e2ecf0;' +
                (c.hasCandidateUpdate ? 'background:rgba(86,215,161,0.1);' : '') +
                '">' +
                '<td style="padding:0.65rem;">' +
                '<div style="display:flex;align-items:center;gap:0.65rem;">' +
                renderAvatarHtml(c, 44) +
                '<div>' +
                '<div style="font-weight:800;color:#112D3A;display:flex;align-items:center;flex-wrap:wrap;gap:0.2rem;">' +
                esc(p.nombreCompleto || '') +
                updateBadgeHtml +
                '</div>' +
                '<div style="font-size:0.75rem;color:#546e7a;">' +
                esc(p.tipoDoc || 'DNI') +
                ' <strong>' +
                esc(p.nroDoc || '') +
                '</strong>' +
                (p.edad ? ' · ' + esc(p.edad) + ' años' : '') +
                ' · <code>' +
                esc(c.codigo) +
                '</code></div>' +
                '</div>' +
                '</div>' +
                '</td>' +
                '<td style="padding:0.65rem;font-size:0.83rem;"><strong>' +
                esc(post.puestoPrincipal || '') +
                '</strong><br><small style="color:#546e7a;">' +
                esc(post.disponibilidadHoraria || '') +
                '</small></td>' +
                '<td style="padding:0.65rem;font-size:0.82rem;">' +
                esc(u.localidad || '') +
                '<br><small style="color:#546e7a;">' +
                esc(u.provincia || '') +
                '</small></td>' +
                '<td style="padding:0.65rem;font-size:0.8rem;">' +
                (arch.pdfUrl
                  ? '<a href="' +
                    esc(arch.pdfUrl) +
                    '" target="_blank" style="color:#0b5e3e;font-weight:800;text-decoration:underline;">📄 PDF adjunto</a>'
                  : '<span style="color:#94a3b8;">Sin PDF</span>') +
                '</td>' +
                '<td style="padding:0.65rem;font-size:0.78rem;color:#475569;">' +
                esc(new Date(c.lastCandidateUpdateAt || c.updatedAt || c.createdAt).toLocaleDateString('es-AR')) +
                (c.lastCandidateUpdateAt
                  ? '<br><small style="color:#0f5d3f;font-weight:800;">Act. ' +
                    esc(new Date(c.lastCandidateUpdateAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })) +
                    '</small>'
                  : '') +
                '</td>' +
                (isPrevisualizados
                  ? '<td style="padding:0.65rem;">' + quickSelectRating + '</td>'
                  : '') +
                '<td style="padding:0.65rem;text-align:right;">' +
                '<button type="button" class="ms-sa-btn" style="padding:0.42rem 0.8rem;font-size:0.78rem;" data-open-cv-id="' +
                esc(c.id) +
                '">' +
                (isPrevisualizados ? '👁️ Abrir / Valorar' : '👁️ Previsualizar CV') +
                '</button>' +
                '</td>' +
                '</tr>'
              );
            })
            .join('');

    var updatedAlertsInList = sourceList.filter(function (c) {
      return Boolean(c.hasCandidateUpdate);
    });
    var alertBannerHtml =
      updatedAlertsInList.length > 0
        ? '<div style="margin-bottom:0.9rem;padding:0.75rem 1rem;border-radius:12px;border:2px solid #56D7A1;background:#112D3A;color:#FFFFFF;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">' +
          '<div style="font-size:0.84rem;">' +
          '<strong style="color:#56D7A1;">🔔 Alerta de Nuevos Datos en CV:</strong> Hay <strong>' +
          esc(updatedAlertsInList.length) +
          '</strong> postulante(s) que actualizaron su Curriculum Vitae usando su DNI (sin duplicar registro).' +
          '</div>' +
          '</div>'
        : '';

    return (
      '<div class="ms-sa-card">' +
      alertBannerHtml +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.65rem;margin-bottom:1rem;">' +
      '<div><label class="ms-sa-label">🔎 Filtro por DNI / Documento</label><input class="ms-sa-input" id="ms-cv-dni-inp" value="' +
      esc(STATE_CV.filterDni) +
      '" placeholder="Ej: 38123456"></div>' +
      '<div><label class="ms-sa-label">Buscar por Nombre, Código o Localidad</label><input class="ms-sa-input" id="ms-cv-search-inp" value="' +
      esc(STATE_CV.filterSearch) +
      '" placeholder="Ej: González, CV-2026..., Río Cuarto"></div>' +
      '<div><label class="ms-sa-label">Filtrar por Puesto</label><select class="ms-sa-select" id="ms-cv-puesto-sel"><option value="">Todos los puestos</option>' +
      puestoOptions +
      '</select></div>' +
      (isPrevisualizados
        ? '<div><label class="ms-sa-label">Valoración Mínima (1 a 10)</label><select class="ms-sa-select" id="ms-cv-minrate-sel">' +
          '<option value="0" ' +
          (STATE_CV.filterMinRating === 0 ? 'selected' : '') +
          '>Todas las valoraciones</option>' +
          '<option value="8" ' +
          (STATE_CV.filterMinRating === 8 ? 'selected' : '') +
          '>8 a 10 (Destacados)</option>' +
          '<option value="6" ' +
          (STATE_CV.filterMinRating === 6 ? 'selected' : '') +
          '>6 o más</option>' +
          '<option value="4" ' +
          (STATE_CV.filterMinRating === 4 ? 'selected' : '') +
          '>4 o más</option>' +
          '</select></div>' +
          '<div><label class="ms-sa-label">Ordenar listado</label><select class="ms-sa-select" id="ms-cv-sort-sel">' +
          '<option value="recent" ' +
          (STATE_CV.sortBy === 'recent' ? 'selected' : '') +
          '>Más recientes primero</option>' +
          '<option value="rating_desc" ' +
          (STATE_CV.sortBy === 'rating_desc' ? 'selected' : '') +
          '>Mayor valoración (10 → 1)</option>' +
          '</select></div>'
        : '') +
      '</div>' +
      '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;">' +
      '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;font-size:0.8rem;">' +
      '<th style="padding:0.55rem;">Postulante</th>' +
      '<th style="padding:0.55rem;">Puesto y Horario</th>' +
      '<th style="padding:0.55rem;">Ubicación</th>' +
      '<th style="padding:0.55rem;">Adjunto PDF</th>' +
      '<th style="padding:0.55rem;">Fecha</th>' +
      (isPrevisualizados ? '<th style="padding:0.55rem;">Valoración (1 a 10)</th>' : '') +
      '<th style="padding:0.55rem;text-align:right;">Acción</th>' +
      '</tr></thead>' +
      '<tbody>' +
      rowsHtml +
      '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>'
    );
  }

  function renderCvDetailView() {
    var c = STATE_CV.selectedCv;
    if (!c) return '<div class="ms-sa-card">No se seleccionó ningún CV.</div>';

    var p = c.personal || {};
    var u = c.ubicacionContacto || {};
    var post = c.postulacion || {};
    var fh = c.formacionHabilidades || {};
    var arch = c.archivos || {};
    var exps = Array.isArray(c.experiencias) ? c.experiencias : [];

    var waDigits = String(u.whatsappCompleto || '').replace(/\D/g, '');
    var waHref = waDigits
      ? 'https://wa.me/' +
        waDigits +
        '?text=' +
        encodeURIComponent(
          '¡Hola ' +
            (p.nombres || '') +
            '! Nos comunicamos desde Recursos Humanos respecto a tu CV (' +
            c.codigo +
            ') enviado para el puesto de ' +
            (post.puestoPrincipal || '') +
            '.'
        )
      : '';

    var ratingButtons = '';
    for (var r = 1; r <= 10; r++) {
      var active = Number(c.rating) === r;
      ratingButtons +=
        '<button type="button" data-set-cv-score="' +
        r +
        '" style="width:38px;height:38px;border-radius:10px;font-weight:900;font-size:0.92rem;cursor:pointer;border:2px solid ' +
        (active ? '#56D7A1' : 'rgba(255,255,255,0.25)') +
        ';background:' +
        (active ? '#56D7A1' : 'rgba(255,255,255,0.08)') +
        ';color:' +
        (active ? '#112D3A' : '#FFFFFF') +
        ';">' +
        r +
        '</button>';
    }

    var expHtml =
      exps.length === 0
        ? '<p style="font-size:0.84rem;color:#546e7a;margin:0;">Sin experiencia laboral previa declarada (Primer Empleo).</p>'
        : exps
            .map(function (e) {
              return (
                '<div style="padding:0.75rem;border:1px solid #dbe7ec;border-radius:10px;background:#f8fbfc;">' +
                '<div style="font-weight:800;color:#112D3A;">' +
                esc(e.puesto || 'Puesto') +
                ' — ' +
                esc(e.empresa || 'Empresa') +
                ' <span style="font-weight:600;color:#546e7a;">(' +
                esc(e.desdeAnio || '') +
                ' - ' +
                esc(e.hastaAnio || '') +
                ' · ' +
                esc(e.antiguedad || '') +
                ')</span></div>' +
                '<div style="font-size:0.78rem;color:#334155;margin-top:0.2rem;"><strong>Rubro:</strong> ' +
                esc(e.rubroEmpresa || '') +
                ' · <strong>Motivo egreso:</strong> ' +
                esc(e.motivoEgreso || '') +
                '</div>' +
                (e.tareas
                  ? '<div style="font-size:0.8rem;margin-top:0.25rem;"><strong>Tareas:</strong> ' +
                    esc(e.tareas) +
                    '</div>'
                  : '') +
                (e.referenciaNombre || e.referenciaTelefono
                  ? '<div style="font-size:0.78rem;color:#0f5d3f;margin-top:0.25rem;"><strong>Referencia:</strong> ' +
                    esc(e.referenciaNombre || '') +
                    ' ' +
                    esc(e.referenciaTelefono || '') +
                    '</div>'
                  : '') +
                '</div>'
              );
            })
            .join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
      '<div class="ms-sa-card ms-sa-card--highlight">' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:1rem;">' +
      '<div style="display:flex;align-items:center;gap:1rem;">' +
      renderAvatarHtml(c, 74) +
      '<div>' +
      '<span style="background:#56D7A1;color:#112D3A;font-size:0.72rem;font-weight:900;padding:0.18rem 0.6rem;border-radius:999px;">' +
      esc(c.codigo) +
      ' · PREVISUALIZADO</span>' +
      (Number(c.candidateUpdateCount || 0) > 0
        ? '<span style="background:rgba(86,215,161,0.22);color:#56D7A1;border:1px solid #56D7A1;font-size:0.7rem;font-weight:900;padding:0.16rem 0.55rem;border-radius:999px;margin-left:0.4rem;">🔔 ACTUALIZADO POR DNI (' +
          esc(c.candidateUpdateCount) +
          (c.lastCandidateUpdateAt
            ? ' · ' + esc(new Date(c.lastCandidateUpdateAt).toLocaleString('es-AR'))
            : '') +
          ')</span>'
        : '') +
      '<h3 style="margin:0.35rem 0 0.15rem;font-size:1.35rem;color:#FFFFFF;">' +
      esc(p.nombreCompleto || '') +
      '</h3>' +
      '<div style="font-size:0.84rem;color:#d1fae5;">' +
      esc(post.puestoPrincipal || '') +
      ' · ' +
      esc(u.localidad || '') +
      ', ' +
      esc(u.provincia || '') +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">' +
      (waHref
        ? '<a href="' +
          esc(waHref) +
          '" target="_blank" class="ms-sa-btn">📲 Contactar por WhatsApp</a>'
        : '') +
      (arch.pdfUrl
        ? '<a href="' +
          esc(arch.pdfUrl) +
          '" target="_blank" class="ms-sa-btn ms-sa-btn--outline" style="background:#fff;">📄 Abrir PDF</a>' +
          '<a href="' +
          esc(arch.pdfUrl) +
          '&download=1" class="ms-sa-btn ms-sa-btn--outline" style="background:#fff;">⬇ Descargar PDF</a>'
        : '') +
      '</div>' +
      '</div>' +

      '<div style="margin-top:1.1rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.16);">' +
      '<div style="font-size:0.8rem;font-weight:800;color:#56D7A1;margin-bottom:0.45rem;">VALORACIÓN DEL POSTULANTE (DE 1 A 10):</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;">' +
      ratingButtons +
      '<span style="margin-left:0.5rem;font-size:0.85rem;font-weight:800;color:#FFFFFF;">' +
      (c.rating ? 'Puntaje actual: ' + c.rating + ' / 10' : 'Seleccioná un puntaje del 1 al 10') +
      '</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr auto;gap:0.6rem;margin-top:0.85rem;">' +
      '<input class="ms-sa-input" id="ms-cv-notes-inp" value="' +
      esc(c.notes || '') +
      '" placeholder="Observaciones internas del selector (ej: excelente trato, disponibilidad inmediata, citar a entrevista)...">' +
      '<button type="button" class="ms-sa-btn" id="ms-cv-save-notes-btn">💾 Guardar Nota</button>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div class="ms-sa-grid">' +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">👤 Datos Personales y Contacto</h4>' +
      '<div style="display:grid;gap:0.35rem;font-size:0.84rem;">' +
      '<div><strong>Documento:</strong> ' +
      esc(p.tipoDoc) +
      ' ' +
      esc(p.nroDoc) +
      '</div>' +
      '<div><strong>Nacimiento / Edad:</strong> ' +
      esc(p.fechaNacimiento || '—') +
      (p.edad ? ' (' + esc(p.edad) + ' años)' : '') +
      '</div>' +
      '<div><strong>Género / Nacionalidad:</strong> ' +
      esc(p.genero || '—') +
      ' · ' +
      esc(p.nacionalidad || '—') +
      '</div>' +
      '<div><strong>Estado Civil / Cargas:</strong> ' +
      esc(p.estadoCivil || '—') +
      ' · ' +
      esc(p.hijosACargo || '') +
      '</div>' +
      '<div><strong>Ubicación:</strong> ' +
      esc(u.domicilio || '') +
      ' — ' +
      esc(u.localidad || '') +
      ', ' +
      esc(u.provincia || '') +
      ' (' +
      esc(u.pais || '') +
      ' · CP ' +
      esc(u.cp || '') +
      ')</div>' +
      '<div><strong>WhatsApp:</strong> ' +
      esc(u.whatsappCompleto || '') +
      ' (' +
      esc(u.whatsappPais || '') +
      ')</div>' +
      '<div><strong>Email:</strong> ' +
      esc(u.email || '') +
      '</div>' +
      (u.facebookUrl
        ? '<div><strong>Facebook:</strong> ' +
          (/^https?:\/\//i.test(u.facebookUrl)
            ? '<a href="' + esc(u.facebookUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(u.facebookUrl) + '</a>'
            : esc(u.facebookUrl)) +
          '</div>'
        : '') +
      (u.instagramUrl
        ? '<div><strong>Instagram:</strong> ' +
          (/^https?:\/\//i.test(u.instagramUrl)
            ? '<a href="' + esc(u.instagramUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(u.instagramUrl) + '</a>'
            : esc(u.instagramUrl)) +
          '</div>'
        : '') +
      (u.linkedinUrl
        ? '<div><strong>LinkedIn / Web:</strong> <a href="' +
          esc(u.linkedinUrl) +
          '" target="_blank" rel="noopener noreferrer">' +
          esc(u.linkedinUrl) +
          '</a></div>'
        : '') +
      '</div>' +
      '</div>' +

      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">💼 Perfil Laboral, Estudios y Sistemas</h4>' +
      '<div style="display:grid;gap:0.35rem;font-size:0.84rem;">' +
      '<div><strong>Puesto Principal:</strong> ' +
      esc(post.puestoPrincipal || '') +
      '</div>' +
      (post.puestoSecundario
        ? '<div><strong>2° Puesto:</strong> ' + esc(post.puestoSecundario) + '</div>'
        : '') +
      '<div><strong>Disponibilidad / Modalidad:</strong> ' +
      esc(post.disponibilidadHoraria || '') +
      ' · ' +
      esc(post.modalidad || '') +
      ' · Inicio: ' +
      esc(post.incorporacion || '') +
      '</div>' +
      '<div><strong>Experiencia / Movilidad:</strong> ' +
      esc(post.experienciaTotal || '') +
      ' · ' +
      esc(post.movilidadPropia || '') +
      ' (Licencia: ' +
      esc(post.licenciaConducir || '') +
      ')</div>' +
      '<div><strong>Pretensión Salarial:</strong> ' +
      esc(post.pretensionSalarial || 'A convenir') +
      '</div>' +
      '<div><strong>Estudios:</strong> ' +
      esc(fh.nivelEstudios || '') +
      ' (' +
      esc(fh.estadoEstudios || '') +
      ') ' +
      esc(fh.tituloCarrera || '') +
      '</div>' +
      '<div><strong>Manejo Sistemas:</strong> POS/Caja: ' +
      esc(fh.nivelPosFacturacion || '') +
      ' · Excel: ' +
      esc(fh.nivelExcel || '') +
      ' · Digital/WA: ' +
      esc(fh.nivelAtencionDigital || '') +
      '</div>' +
      '<div><strong>Idioma Extra:</strong> ' +
      esc(fh.idiomaPrincipal || 'Ninguno') +
      (fh.idiomaPrincipal && fh.idiomaPrincipal !== 'Ninguno' && fh.nivelIdioma
        ? ' (' + esc(fh.nivelIdioma) + ')'
        : '') +
      '</div>' +
      (fh.cursosAdicionales
        ? '<div><strong>Cursos / Carnets:</strong> ' + esc(fh.cursosAdicionales) + '</div>'
        : '') +
      '</div>' +
      '</div>' +
      '</div>' +

      (post.presentacion
        ? '<div class="ms-sa-card"><h4 style="margin-top:0;">📝 Presentación del Postulante</h4><p style="margin:0;font-size:0.86rem;line-height:1.5;">' +
          esc(post.presentacion) +
          '</p></div>'
        : '') +

      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">🏢 Experiencia Laboral y Referencias</h4>' +
      '<div style="display:grid;gap:0.65rem;">' +
      expHtml +
      '</div>' +
      '</div>' +

      (arch.pdfUrl
        ? '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">📄 Vista Previa de CV Adjunto en PDF (' +
          esc(arch.pdfNombreOriginal || 'CV.pdf') +
          ')</h4>' +
          '<iframe src="' +
          esc(arch.pdfUrl) +
          '" style="width:100%;height:560px;border:1px solid #cbd5e1;border-radius:12px;" title="CV en PDF"></iframe>' +
          '</div>'
        : '') +

      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">' +
      '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-cv-mark-unread-btn">↩ Devolver a "CV recibidos" (sin previsualizar)</button>' +
      '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="border-color:#dc2626;color:#dc2626;" id="ms-cv-delete-btn">🗑 Eliminar CV</button>' +
      '</div>' +
      '</div>'
    );
  }

  function renderPortalQrView() {
    var fullUrl = STATE_CV.publicCvUrl.indexOf('http') === 0
      ? STATE_CV.publicCvUrl
      : window.location.origin + STATE_CV.publicCvUrl;
    var qrSrc =
      'https://api.qrserver.com/v1/create-qr-code/?size=260x260&ecc=M&margin=2&data=' +
      encodeURIComponent(fullUrl);

    return (
      '<div class="ms-sa-grid">' +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">🌐 Enlace Público de Postulaciones</h4>' +
      '<p style="font-size:0.84rem;color:#475569;">Compartí este enlace en tus redes sociales, WhatsApp o avisos de empleo. Todo CV enviado ingresa directo a <strong>CV recibidos</strong>.</p>' +
      '<input class="ms-sa-input" readonly value="' +
      esc(fullUrl) +
      '" onclick="this.select()" style="font-weight:700;margin-bottom:0.75rem;">' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
      '<a href="' +
      esc(fullUrl) +
      '" target="_blank" class="ms-sa-btn">Abrir Formulario /cv ↗</a>' +
      '<button type="button" class="ms-sa-btn ms-sa-btn--dark" id="ms-cv-copy-link-btn" data-url="' +
      esc(fullUrl) +
      '">📋 Copiar Enlace</button>' +
      '</div>' +
      '</div>' +
      '<div class="ms-sa-card" style="text-align:center;">' +
      '<h4 style="margin-top:0;">📱 Código QR para Mostrador / Vidriera</h4>' +
      '<img src="' +
      esc(qrSrc) +
      '" alt="QR Curriculum Vitae" style="width:190px;height:190px;margin:0.4rem auto;border-radius:14px;border:2px solid #56D7A1;padding:6px;background:#fff;">' +
      '<p style="font-size:0.78rem;color:#475569;margin:0.4rem 0 0;">"Escaneá el QR y cargá tu Curriculum Vitae en línea"</p>' +
      '</div>' +
      '</div>'
    );
  }

  function renderCvWorkspace() {
    var bodyEl = document.getElementById('ms-cv-body');
    if (!bodyEl) return;

    if (STATE_CV.activeView === 'recibidos') {
      bodyEl.innerHTML = renderCvListView(false);
    } else if (STATE_CV.activeView === 'previsualizados') {
      bodyEl.innerHTML = renderCvListView(true);
    } else if (STATE_CV.activeView === 'detail') {
      bodyEl.innerHTML = renderCvDetailView();
    } else if (STATE_CV.activeView === 'portal') {
      bodyEl.innerHTML = renderPortalQrView();
    }

    bindCvWorkspaceEvents(bodyEl);
  }

  function findCvById(id) {
    return (
      STATE_CV.recibidos.find(function (x) {
        return x.id === id;
      }) ||
      STATE_CV.previsualizados.find(function (x) {
        return x.id === id;
      }) ||
      null
    );
  }

  function bindCvWorkspaceEvents(bodyEl) {
    var dniInp = bodyEl.querySelector('#ms-cv-dni-inp');
    if (dniInp) {
      dniInp.addEventListener('input', function () {
        STATE_CV.filterDni = dniInp.value;
        renderCvWorkspace();
        var nextDniInp = document.getElementById('ms-cv-dni-inp');
        if (nextDniInp) {
          nextDniInp.focus();
          nextDniInp.setSelectionRange(nextDniInp.value.length, nextDniInp.value.length);
        }
      });
    }

    var searchInp = bodyEl.querySelector('#ms-cv-search-inp');
    if (searchInp) {
      searchInp.addEventListener('input', function () {
        STATE_CV.filterSearch = searchInp.value;
        renderCvWorkspace();
        var nextInp = document.getElementById('ms-cv-search-inp');
        if (nextInp) {
          nextInp.focus();
          nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length);
        }
      });
    }

    var puestoSel = bodyEl.querySelector('#ms-cv-puesto-sel');
    if (puestoSel) {
      puestoSel.addEventListener('change', function () {
        STATE_CV.filterPuesto = puestoSel.value;
        renderCvWorkspace();
      });
    }

    var minRateSel = bodyEl.querySelector('#ms-cv-minrate-sel');
    if (minRateSel) {
      minRateSel.addEventListener('change', function () {
        STATE_CV.filterMinRating = Number(minRateSel.value || 0);
        renderCvWorkspace();
      });
    }

    var sortSel = bodyEl.querySelector('#ms-cv-sort-sel');
    if (sortSel) {
      sortSel.addEventListener('change', function () {
        STATE_CV.sortBy = sortSel.value;
        renderCvWorkspace();
      });
    }

    bodyEl.querySelectorAll('[data-open-cv-id]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-open-cv-id');
        var found = findCvById(id);
        if (!found) return;
        STATE_CV.previousListView = STATE_CV.activeView === 'recibidos' ? 'previsualizados' : STATE_CV.activeView;
        if (!found.viewed) {
          var res = await apiCv('POST', { action: 'mark_previewed', id: id });
          if (res && res.ok && res.cv) {
            found = res.cv;
          }
          await reloadCvData(false);
        }
        STATE_CV.selectedCv = found;
        openCvView('detail');
      });
    });

    bodyEl.querySelectorAll('[data-quick-rate]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        var id = sel.getAttribute('data-quick-rate');
        var val = Number(sel.value || 0);
        if (!val) return;
        var res = await apiCv('POST', { action: 'rate_cv', id: id, rating: val });
        if (res && res.ok) {
          showCvToast(res.message || 'Valoración guardada.', false);
          await reloadCvData(true);
        }
      });
    });

    bodyEl.querySelectorAll('[data-set-cv-score]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!STATE_CV.selectedCv) return;
        var score = Number(btn.getAttribute('data-set-cv-score'));
        var notesEl = bodyEl.querySelector('#ms-cv-notes-inp');
        var res = await apiCv('POST', {
          action: 'rate_cv',
          id: STATE_CV.selectedCv.id,
          rating: score,
          notes: notesEl ? notesEl.value : STATE_CV.selectedCv.notes
        });
        if (res && res.ok && res.cv) {
          STATE_CV.selectedCv = res.cv;
          showCvToast(res.message || 'Valoración guardada.', false);
          await reloadCvData(false);
          renderCvWorkspace();
        }
      });
    });

    var saveNotesBtn = bodyEl.querySelector('#ms-cv-save-notes-btn');
    if (saveNotesBtn) {
      saveNotesBtn.addEventListener('click', async function () {
        if (!STATE_CV.selectedCv) return;
        var notesEl = bodyEl.querySelector('#ms-cv-notes-inp');
        var res = await apiCv('POST', {
          action: 'rate_cv',
          id: STATE_CV.selectedCv.id,
          notes: notesEl ? notesEl.value : ''
        });
        if (res && res.ok && res.cv) {
          STATE_CV.selectedCv = res.cv;
          showCvToast('Observaciones guardadas.', false);
          await reloadCvData(false);
        }
      });
    }

    var unreadBtn = bodyEl.querySelector('#ms-cv-mark-unread-btn');
    if (unreadBtn) {
      unreadBtn.addEventListener('click', async function () {
        if (!STATE_CV.selectedCv) return;
        await apiCv('POST', { action: 'unmark_previewed', id: STATE_CV.selectedCv.id });
        showCvToast('El CV volvió a la bandeja de CV recibidos.', false);
        openCvView('recibidos');
      });
    }

    var delBtn = bodyEl.querySelector('#ms-cv-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', async function () {
        if (!STATE_CV.selectedCv) return;
        if (!window.confirm('¿Confirmás eliminar este Curriculum Vitae?')) return;
        await apiCv('POST', { action: 'delete_cv', id: STATE_CV.selectedCv.id });
        openCvView('previsualizados');
      });
    }

    var copyBtn = bodyEl.querySelector('#ms-cv-copy-link-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var url = copyBtn.getAttribute('data-url') || '';
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url);
          showCvToast('Enlace copiado al portapapeles.', false);
        }
      });
    }
  }

  function bindGlobalCvNavReset() {
    if (window.__MS_CV_NAV_BOUND__) return;
    window.__MS_CV_NAV_BOUND__ = true;
    document.addEventListener(
      'click',
      function (ev) {
        var t = ev.target;
        if (!t || typeof t.closest !== 'function') return;
        var navTrigger = t.closest('#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card');
        if (navTrigger) {
          var m = document.getElementById('sec-menu-cv');
          var d = document.getElementById('sec-cv-workspace');
          var isCvActive = (m && !m.hidden) || (d && !d.hidden);

          if (navTrigger.id === 'btn-topbar-back-facturacion' && isCvActive) {
            ev.preventDefault();
            ev.stopPropagation();
            if (d && !d.hidden) {
              if (STATE_CV.activeView === 'detail') {
                openCvView(STATE_CV.previousListView || 'previsualizados');
              } else {
                openCvView('menu');
              }
            } else {
              closeCvToHome();
            }
            return;
          }

          if (m) m.hidden = true;
          if (d) d.hidden = true;
        }
      },
      true
    );
  }

  var initialBadgeLoaded = false;

  function syncCvHomeCard() {
    bindGlobalCvNavReset();
    var allowed = isCvModuleAllowed();
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existingCard = document.getElementById('ms-cv-home-card');

    if (allowed && inicioGrid && !existingCard) {
      var card = document.createElement('article');
      card.id = 'ms-cv-home-card';
      card.className = 'module-card';
      card.setAttribute('data-module-key', 'cv');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
            '<polyline points="14 2 14 8 20 8"></polyline>' +
            '<circle cx="10" cy="13" r="2"></circle>' +
            '<path d="M14 17c0-1.5-1.8-2.5-4-2.5s-4 1-4 2.5"></path>' +
          '</svg>' +
        '</div>' +
        '<h3>Curriculum Vitae</h3>';

      card.addEventListener('click', function () {
        openCvView('menu');
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openCvView('menu');
        }
      });

      // Insertar antes de Perfil / Ayuda para mantener orden natural de módulos operativos
      var perfilCard = inicioGrid.querySelector('[data-module-key="perfil"]');
      if (perfilCard) {
        inicioGrid.insertBefore(card, perfilCard);
      } else {
        inicioGrid.appendChild(card);
      }

      if (!initialBadgeLoaded) {
        initialBadgeLoaded = true;
        reloadCvData(false);
      }
    } else if (existingCard) {
      existingCard.hidden = !allowed;
      existingCard.style.display = allowed ? '' : 'none';
    }
  }

  setInterval(syncCvHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncCvHomeCard);
})();
