/* ==========================================================================
   MÓDULO INTEGRAL: GESTIÓN DE SERVICIOS — MINISISTEMA ERP
   Completamente integrado con:
   - Clientes (clientes_db / openClientModal — sin duplicar padrón)
   - Facturación POS y Electrónica ARCA (individual, parcial, lote, abonos y mixta)
   - Cuentas Corrientes Únicas (con filtro por Origen: Comercio / Servicios / Mixta)
   - Administración de Personal (reutiliza asistencia_db.employees + matrículas técnicas)
   - Identidad visual oficial MiniSistema y tarjetas uniformes (.modules-grid / .module-card)
   ========================================================================== */
(function () {
  'use strict';

  var STATE = {
    view: 'menu', // 'menu' | 'panel' | 'catalogo' | 'presupuestos' | 'ordenes' | 'partes' | 'documentos' | 'agenda' | 'abonos' | 'informes' | 'facturar_directo' | 'cobranza_directa'
    returnTo: 'servicios', // 'servicios' | 'sec-menu-facturacion'
    loading: false,
    db: null,
    unidades: [],
    clientes: [],
    empleadosAsistencia: [],
    informes: null,
    search: '',
    statusFilter: 'ALL',
    docTypeFilter: 'ALL',
    docOtFilter: 'ALL',
    selectedOtIdsForBatch: {},
    selectedProfileClientId: '',
    editingService: null,
    editingPresupuesto: null,
    editingOt: null,
    editingParte: null,
    editingPersonal: null,
    editingAbono: null,
    billingModalOtId: null,
    retencionModalFacturaId: null,
    abonoPeriod: new Date().toISOString().slice(0, 7),
    directInvoice: null,
    lastEmittedInvoice: null,
    directCobranza: null,
    lastEmittedRecibo: null
  };

  function getActiveActividadMode() {
    var m =
      (STATE.db && STATE.db.config && STATE.db.config.actividadNegocio) ||
      (window.__ERP_TENANT_BOOT__ && window.__ERP_TENANT_BOOT__.actividadNegocio) ||
      document.documentElement.getAttribute('data-actividad') ||
      'comercial';
    if (m === 'servicios' || m === 'mixta' || m === 'comercial') return m;
    return 'comercial';
  }

  function applyActividadModeUi(modeOverride) {
    var mode =
      modeOverride === 'servicios' || modeOverride === 'mixta' || modeOverride === 'comercial'
        ? modeOverride
        : getActiveActividadMode();
    if (document.documentElement.getAttribute('data-actividad') !== mode) {
      document.documentElement.setAttribute('data-actividad', mode);
    }
    if (window.__ERP_TENANT_BOOT__) {
      window.__ERP_TENANT_BOOT__.actividadNegocio = mode;
    }
    var factBc = document.querySelector('#sec-menu-facturacion .module-breadcrumb strong');
    if (factBc) {
      factBc.textContent =
        mode === 'servicios' ? 'Facturación de Servicios (ARCA)' : 'Facturación Electrónica ARCA';
    }
  }
  window.__MS_APPLY_ACTIVIDAD_MODE__ = applyActividadModeUi;

  var fmtArs = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  });

  function fmtMoney(amount, currency) {
    var n = Number(amount) || 0;
    if (currency === 'USD') {
      return 'USD ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return fmtArs.format(n);
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function nowLocalDateTime() {
    var d = new Date();
    return (
      todayIso() +
      'T' +
      String(d.getHours()).padStart(2, '0') +
      ':' +
      String(d.getMinutes()).padStart(2, '0')
    );
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

  function isServiciosAllowed() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    if (String(u.username).toLowerCase() === 'danielg' || u.role === 'Administrador General') {
      return true;
    }
    var brandMods = (window.ERP_BRAND && window.ERP_BRAND.enabledModules) || [];
    if (Array.isArray(brandMods) && brandMods.length > 0) {
      var hasTenant = brandMods.some(function (k) {
        var s = String(k || '');
        return s === 'servicios' || s.indexOf('servicios:') === 0;
      });
      if (!hasTenant) return false;
    }
    if (u.role === 'Administrador') return true;
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return uMods.some(function (k) {
      var s = String(k || '');
      return s === 'servicios' || s.indexOf('servicios:') === 0;
    });
  }

  function isSubAllowed(subKey) {
    var u = getActiveUser();
    if (!u) return false;
    if (
      String(u.username).toLowerCase() === 'danielg' ||
      u.role === 'Administrador General' ||
      u.role === 'Administrador'
    ) {
      return true;
    }
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return uMods.indexOf('servicios') >= 0 || uMods.indexOf('servicios:' + subKey) >= 0;
  }

  function getActorName() {
    var u = getActiveUser();
    return (u && (u.username || u.name)) || 'sistema';
  }

  async function apiServicios(method, payloadOrQuery) {
    var url = '/sistema/api/servicios.php';
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (method === 'GET') {
      var q = new URLSearchParams(payloadOrQuery || {});
      q.set('_t', String(Date.now()));
      url += '?' + q.toString();
      delete opts.headers['Content-Type'];
    } else {
      var body = Object.assign({ usuario: getActorName() }, payloadOrQuery || {});
      opts.body = JSON.stringify(body);
    }
    var res = await fetch(url, opts);
    return res.json();
  }

  function showToast(msg, isError) {
    var el = document.getElementById('ms-srv-feedback');
    if (!el) return;
    el.style.display = 'block';
    el.style.background = isError ? '#fee2e2' : '#dcfce7';
    el.style.color = isError ? '#991b1b' : '#166534';
    el.style.border = '1px solid ' + (isError ? '#fca5a5' : '#86efac');
    el.textContent = msg;
    clearTimeout(window.__msSrvToastTimer);
    window.__msSrvToastTimer = setTimeout(function () {
      if (el) el.style.display = 'none';
    }, 5500);
  }

  function getViewLabel(v) {
    var map = {
      panel: 'Panel de Servicios',
      catalogo: 'Catálogo de Servicios',
      presupuestos: 'Presupuestos y Cotizaciones',
      ordenes: 'Órdenes de Trabajo',
      partes: 'Partes de Servicio',
      documentos: 'Documentación Técnica',
      agenda: 'Agenda y Personal',
      abonos: 'Abonos Recurrentes',
      informes: 'Informes e Indicadores',
      facturar_directo: 'Emitir Comprobante de Servicios',
      cobranza_directa: 'Registrar Cobranza / Recibo'
    };
    return map[v] || 'Gestión de Servicios';
  }

  function estadoBadgeHtml(estado) {
    var cfg = {
      borrador: { bg: '#f1f5f9', fg: '#334155', lbl: 'Borrador' },
      enviado: { bg: '#e0f2fe', fg: '#0369a1', lbl: 'Enviado' },
      aprobado: { bg: '#dcfce7', fg: '#166534', lbl: 'Aprobado' },
      rechazado: { bg: '#fee2e2', fg: '#991b1b', lbl: 'Rechazado' },
      vencido: { bg: '#fef3c7', fg: '#92400e', lbl: 'Vencido' },
      cancelado: { bg: '#f1f5f9', fg: '#64748b', lbl: 'Cancelado' },
      cancelada: { bg: '#f1f5f9', fg: '#64748b', lbl: 'Cancelada' },
      pendiente: { bg: '#fef3c7', fg: '#92400e', lbl: 'Pendiente' },
      programada: { bg: '#e0f2fe', fg: '#0369a1', lbl: 'Programada' },
      en_ejecucion: { bg: '#dbeafe', fg: '#1d4ed8', lbl: 'En Ejecución' },
      finalizada: { bg: '#dcfce7', fg: '#166534', lbl: 'Finalizada' },
      parcial: { bg: '#ffedd5', fg: '#9a3412', lbl: 'Fact. Parcial' },
      facturada: { bg: '#dcfce7', fg: '#065f46', lbl: 'Facturada' },
      activo: { bg: '#dcfce7', fg: '#166534', lbl: 'Activo' },
      pausado: { bg: '#fef3c7', fg: '#92400e', lbl: 'Pausado' },
      finalizado: { bg: '#f1f5f9', fg: '#475569', lbl: 'Finalizado' }
    }[String(estado || '').toLowerCase()] || { bg: '#f1f5f9', fg: '#334155', lbl: String(estado || '—') };
    return (
      '<span style="display:inline-block;padding:0.18rem 0.55rem;border-radius:999px;font-size:0.72rem;font-weight:800;background:' +
      cfg.bg +
      ';color:' +
      cfg.fg +
      ';white-space:nowrap;">' +
      esc(cfg.lbl) +
      '</span>'
    );
  }

  function getClientName(cid) {
    var c = (STATE.clientes || []).find(function (x) {
      return Number(x.id) === Number(cid);
    });
    return c ? c.nombre : cid ? 'Cliente #' + cid : '—';
  }

  function getClientSpecialPrice(clientId, servicioId) {
    if (!STATE.db || !STATE.db.clientProfiles || !clientId || !servicioId) return null;
    var prof = STATE.db.clientProfiles[String(clientId)];
    if (!prof || !Array.isArray(prof.tarifasEspeciales)) return null;
    var today = todayIso();
    var match = prof.tarifasEspeciales.find(function (t) {
      if (t.servicioId !== servicioId) return false;
      if (t.vigenteDesde && today < t.vigenteDesde) return false;
      if (t.vigenteHasta && today > t.vigenteHasta) return false;
      return true;
    });
    return match ? match : null;
  }

  function getPersonalName(pid) {
    var p = ((STATE.db && STATE.db.personal) || []).find(function (x) {
      return x.id === pid;
    });
    return p ? p.nombre : pid;
  }

  function hideAllErpSections() {
    document.querySelectorAll('.erp-main > .erp-section').forEach(function (sec) {
      sec.hidden = true;
    });
  }

  function updateTopbar(visible, label) {
    var backBtn = document.getElementById('btn-topbar-back-facturacion');
    if (backBtn) {
      backBtn.hidden = !visible;
      if (visible) backBtn.textContent = '← Atrás';
    }
    var ind = document.getElementById('topbar-caja-indicator');
    if (ind) {
      ind.hidden = !visible;
      if (visible && label) ind.textContent = label;
    }
  }

  function closeToHome() {
    hideAllErpSections();
    var inicio = document.getElementById('sec-inicio');
    if (inicio) inicio.hidden = false;
    updateTopbar(false);
    STATE.view = 'menu';
  }

  function buildSubCard(subKey, title, svgHtml) {
    return (
      '<article class="module-card" role="button" tabindex="0" data-srv-sub="' + esc(subKey) + '">' +
        '<div class="module-icon" aria-hidden="true">' + svgHtml + '</div>' +
        '<h3>' + esc(title) + '</h3>' +
      '</article>'
    );
  }

  function ensureSectionsMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var menuSec = document.getElementById('sec-menu-servicios');
    var wsSec = document.getElementById('sec-servicios-workspace');

    if (!menuSec) {
      menuSec = document.createElement('section');
      menuSec.id = 'sec-menu-servicios';
      menuSec.className = 'erp-section';
      menuSec.hidden = true;
      menuSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-srv-back-home">← Volver a Pantalla Principal</button>' +
            '<span class="module-breadcrumb">ERP en Línea · <strong>Gestión de Servicios</strong></span>' +
          '</div>' +
          '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;">' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-srv-jump-erp="sec-clientes" style="padding:0.38rem 0.75rem;font-size:0.78rem;">👥 Clientes (Padrón)</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-srv-jump-erp="sec-menu-facturacion" style="padding:0.38rem 0.75rem;font-size:0.78rem;">🧾 Facturación ARCA</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-srv-jump-ctacte" style="padding:0.38rem 0.75rem;font-size:0.78rem;">📒 Cta. Cte. Servicios</button>' +
          '</div>' +
        '</div>' +
        '<div class="modules-grid" aria-label="Submódulos de Gestión de Servicios">' +
          buildSubCard('panel', 'Panel de Servicios', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>') +
          buildSubCard('catalogo', 'Catálogo de Servicios', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>') +
          buildSubCard('presupuestos', 'Presupuestos', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>') +
          buildSubCard('ordenes', 'Órdenes de Trabajo', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>') +
          buildSubCard('partes', 'Partes de Servicio', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1"></rect><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="13" y2="16"></line></svg>') +
          buildSubCard('documentos', 'Documentación Técnica', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>') +
          buildSubCard('agenda', 'Agenda y Personal', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>') +
          buildSubCard('abonos', 'Abonos Recurrentes', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>') +
          buildSubCard('informes', 'Informes de Servicios', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>') +
        '</div>';

      erpMain.appendChild(menuSec);
      menuSec.querySelector('#ms-srv-back-home').addEventListener('click', closeToHome);
      menuSec.querySelectorAll('[data-srv-sub]').forEach(function (card) {
        var openFn = function () {
          var sub = card.getAttribute('data-srv-sub');
          if (!isSubAllowed(sub)) return;
          openServiciosView(sub);
        };
        card.addEventListener('click', openFn);
        card.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            openFn();
          }
        });
      });
      menuSec.querySelectorAll('[data-srv-jump-erp]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var target = btn.getAttribute('data-srv-jump-erp');
          menuSec.hidden = true;
          if (typeof window.__MS_OPEN_ERP_SECTION__ === 'function') {
            window.__MS_OPEN_ERP_SECTION__(target);
          }
        });
      });
      menuSec.querySelector('#ms-srv-jump-ctacte').addEventListener('click', function () {
        menuSec.hidden = true;
        if (typeof window.__MS_OPEN_CTACTE_ORIGIN__ === 'function') {
          window.__MS_OPEN_CTACTE_ORIGIN__('SERVICIOS');
        }
      });
    }

    if (!wsSec) {
      wsSec = document.createElement('section');
      wsSec.id = 'sec-servicios-workspace';
      wsSec.className = 'erp-section';
      wsSec.hidden = true;
      wsSec.innerHTML =
        '<div class="module-back-bar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">' +
            '<button type="button" class="btn-back-home" id="ms-srv-back-menu">← Volver a Gestión de Servicios</button>' +
            '<span class="module-breadcrumb">Gestión de Servicios · <strong id="ms-srv-ws-breadcrumb">Panel de Servicios</strong></span>' +
          '</div>' +
          '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-srv-quick-client" style="padding:0.36rem 0.7rem;font-size:0.76rem;">➕ Nuevo Cliente</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-srv-quick-ctacte" style="padding:0.36rem 0.7rem;font-size:0.76rem;">📒 Cta. Cte. Servicios</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-srv-refresh" style="padding:0.36rem 0.7rem;font-size:0.76rem;">↻ Actualizar</button>' +
          '</div>' +
        '</div>' +
        '<div id="ms-srv-feedback" style="display:none;margin:0 0 1rem;padding:0.72rem 1rem;border-radius:10px;font-weight:700;font-size:0.85rem;"></div>' +
        '<div id="ms-srv-body">Cargando Gestión de Servicios...</div>';

      erpMain.appendChild(wsSec);
      wsSec.querySelector('#ms-srv-back-menu').addEventListener('click', function () {
        if (STATE.returnTo === 'sec-menu-facturacion') {
          wsSec.hidden = true;
          STATE.returnTo = 'servicios';
          if (typeof window.__MS_OPEN_ERP_SECTION__ === 'function') {
            window.__MS_OPEN_ERP_SECTION__('sec-menu-facturacion');
          } else {
            closeToHome();
          }
        } else {
          openServiciosView('menu');
        }
      });
      wsSec.querySelector('#ms-srv-quick-client').addEventListener('click', function () {
        if (typeof window.__MS_OPEN_CLIENT_MODAL__ === 'function') {
          window.__MS_OPEN_CLIENT_MODAL__(null);
        }
      });
      wsSec.querySelector('#ms-srv-quick-ctacte').addEventListener('click', function () {
        wsSec.hidden = true;
        if (typeof window.__MS_OPEN_CTACTE_ORIGIN__ === 'function') {
          window.__MS_OPEN_CTACTE_ORIGIN__('SERVICIOS');
        }
      });
      wsSec.querySelector('#ms-srv-refresh').addEventListener('click', function () {
        reloadData(true);
      });
    }

    return { menuSec: menuSec, wsSec: wsSec };
  }

  async function reloadData(renderAfter) {
    if (STATE.loading) return;
    STATE.loading = true;
    try {
      var res = await apiServicios('GET');
      if (res && res.ok) {
        STATE.db = res.db;
        STATE.unidades = Array.isArray(res.unidadesDisponibles) ? res.unidadesDisponibles : [];
        STATE.clientes = Array.isArray(res.clientes) ? res.clientes : [];
        STATE.empleadosAsistencia = Array.isArray(res.empleadosAsistencia) ? res.empleadosAsistencia : [];
        STATE.informes = res.informes || null;
        if (STATE.db && STATE.db.config && STATE.db.config.actividadNegocio) {
          applyActividadModeUi(STATE.db.config.actividadNegocio);
        }
        if (renderAfter && STATE.view !== 'menu') renderWorkspace();
      }
    } catch (_e) {
    } finally {
      STATE.loading = false;
    }
  }

  async function openServiciosView(viewKey, opts) {
    var secs = ensureSectionsMounted();
    if (!secs) return;
    opts = opts || {};
    STATE.view = viewKey || 'menu';
    STATE.returnTo = opts.returnTo || 'servicios';
    STATE.search = '';
    STATE.statusFilter = 'ALL';
    STATE.editingService = null;
    STATE.editingPresupuesto = null;
    STATE.editingOt = null;
    STATE.editingParte = null;
    STATE.editingPersonal = null;
    STATE.editingAbono = null;
    STATE.billingModalOtId = null;
    STATE.retencionModalFacturaId = null;
    if (!opts.keepDirectDraft) {
      STATE.lastEmittedInvoice = null;
      STATE.lastEmittedRecibo = null;
    }

    hideAllErpSections();
    var parentLabel =
      STATE.returnTo === 'sec-menu-facturacion' ? 'Facturación de Servicios' : 'Gestión de Servicios';
    updateTopbar(
      true,
      STATE.view === 'menu' ? 'Gestión de Servicios' : parentLabel + ' · ' + getViewLabel(STATE.view)
    );

    if (STATE.view === 'menu') {
      secs.menuSec.hidden = false;
      secs.wsSec.hidden = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (!STATE.db) reloadData(false);
      return;
    }

    secs.menuSec.hidden = true;
    secs.wsSec.hidden = false;
    var backBtn = document.getElementById('ms-srv-back-menu');
    if (backBtn) {
      backBtn.textContent =
        STATE.returnTo === 'sec-menu-facturacion'
          ? '← Volver a Facturación'
          : '← Volver a Gestión de Servicios';
    }
    var bcWrap = secs.wsSec.querySelector('.module-breadcrumb');
    if (bcWrap) {
      bcWrap.innerHTML =
        esc(parentLabel) + ' · <strong id="ms-srv-ws-breadcrumb">' + esc(getViewLabel(STATE.view)) + '</strong>';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (!STATE.db) {
      await reloadData(false);
    }
    if (STATE.view === 'facturar_directo' && !STATE.directInvoice) {
      STATE.directInvoice = buildEmptyDirectInvoice();
    }
    if (STATE.view === 'cobranza_directa' && !STATE.directCobranza) {
      STATE.directCobranza = buildEmptyDirectCobranza();
    }
    renderWorkspace();
  }

  // =========================================================================
  // IMPRESIÓN PDF: PRESUPUESTO Y PARTE DE SERVICIO
  // =========================================================================
  function printPresupuestoPdf(pres) {
    if (!pres) return;
    var brand = window.ERP_BRAND || {};
    var logo = brand.logoHorizontalUrl || '/sistema/assets/img/minisistema/logo-horizontal.png';
    var rows = (pres.items || [])
      .map(function (it) {
        return (
          '<tr>' +
            '<td>' + esc(it.codigo) + '</td>' +
            '<td><strong>' + esc(it.nombre) + '</strong>' + (it.descripcion ? '<div style="font-size:11px;color:#475569;">' + esc(it.descripcion) + '</div>' : '') + '</td>' +
            '<td style="text-align:center;">' + esc(it.cantidad) + ' ' + esc(it.unidadMedida) + '</td>' +
            '<td style="text-align:right;">' + esc(fmtMoney(it.precioUnitario, pres.moneda)) + '</td>' +
            '<td style="text-align:center;">' + esc(it.descuentoPct) + '%</td>' +
            '<td style="text-align:center;">' + esc(it.ivaPct) + '%</td>' +
            '<td style="text-align:right;font-weight:700;">' + esc(fmtMoney(it.totalConIva, pres.moneda)) + '</td>' +
          '</tr>'
        );
      })
      .join('');
    var gastosRows = (pres.gastosAdicionales || [])
      .map(function (g) {
        return (
          '<tr>' +
            '<td>ADIC</td>' +
            '<td>' + esc(g.concepto) + '</td>' +
            '<td style="text-align:center;">' + esc(g.cantidad) + '</td>' +
            '<td style="text-align:right;">' + esc(fmtMoney(g.precioUnitario, pres.moneda)) + '</td>' +
            '<td style="text-align:center;">0%</td>' +
            '<td style="text-align:center;">' + esc(g.ivaPct) + '%</td>' +
            '<td style="text-align:right;font-weight:700;">' + esc(fmtMoney(g.totalConIva, pres.moneda)) + '</td>' +
          '</tr>'
        );
      })
      .join('');

    var html =
      '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Presupuesto ' + esc(pres.numero) + '</title>' +
      '<style>body{font-family:Segoe UI,Arial,sans-serif;color:#112D3A;margin:24px;}header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #56D7A1;padding-bottom:12px;margin-bottom:18px;}table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12px;}th,td{border:1px solid #cbd5e1;padding:7px;}th{background:#112D3A;color:#fff;text-align:left;}.box{background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;}@media print{.no-print{display:none;}}</style></head><body>' +
      '<header><div><img src="' + esc(logo) + '" style="height:44px;object-fit:contain;"><div style="font-size:11px;color:#475569;margin-top:4px;">' + esc(brand.businessName || brand.fantasyName || 'MiniSistema ERP') + ' · CUIT: ' + esc(brand.cuitFmt || '') + '</div></div>' +
      '<div style="text-align:right;"><h2 style="margin:0;">PRESUPUESTO ' + esc(pres.numero) + ' (v' + esc(pres.version) + ')</h2><div style="font-size:12px;">Fecha: ' + esc(pres.fecha) + ' · Válido hasta: ' + esc(pres.vigenteHasta) + '</div><div style="font-size:12px;font-weight:700;">Estado: ' + esc(String(pres.estado || '').toUpperCase()) + '</div></div></header>' +
      '<div class="box"><strong>Cliente Solicitante:</strong> ' + esc(pres.clientNombre) +
      (pres.billingClientId && pres.billingClientId !== pres.clientId ? '<br><strong>Destinatario de Factura:</strong> ' + esc(pres.billingClientNombre) : '') +
      (pres.establecimientoNombre ? '<br><strong>Establecimiento / Sitio:</strong> ' + esc(pres.establecimientoNombre) + (pres.establecimientoDireccion ? ' — ' + esc(pres.establecimientoDireccion) : '') : '') +
      '</div>' +
      '<table><thead><tr><th>Cód.</th><th>Servicio / Concepto</th><th>Cant.</th><th>P. Unitario</th><th>Dto.</th><th>IVA</th><th>Total c/IVA</th></tr></thead><tbody>' + rows + gastosRows + '</tbody></table>' +
      '<div style="text-align:right;font-size:13px;margin-top:8px;"><div>Subtotal Neto: <strong>' + esc(fmtMoney(pres.subtotalNeto, pres.moneda)) + '</strong></div><div>IVA: <strong>' + esc(fmtMoney(pres.totalIva, pres.moneda)) + '</strong></div><div style="font-size:17px;margin-top:4px;">TOTAL: <strong>' + esc(fmtMoney(pres.totalGeneral, pres.moneda)) + '</strong></div></div>' +
      (pres.condicionesComerciales ? '<div class="box" style="margin-top:14px;"><strong>Condiciones Comerciales:</strong><br>' + esc(pres.condicionesComerciales) + '</div>' : '') +
      (pres.observaciones ? '<div class="box"><strong>Observaciones:</strong><br>' + esc(pres.observaciones) + '</div>' : '') +
      '<div class="no-print" style="margin-top:18px;text-align:center;"><button onclick="window.print()" style="padding:10px 20px;background:#112D3A;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">🖨️ Imprimir / Guardar PDF</button></div>' +
      '</body></html>';
    var w = window.open('', '_blank', 'width=940,height=780');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  function printPartePdf(parte) {
    if (!parte) return;
    var ot = ((STATE.db && STATE.db.ordenesTrabajo) || []).find(function (o) {
      return o.id === parte.otId;
    });
    var brand = window.ERP_BRAND || {};
    var logo = brand.logoHorizontalUrl || '/sistema/assets/img/minisistema/logo-horizontal.png';
    var rows = (parte.itemsEjecutados || [])
      .map(function (it) {
        return (
          '<tr><td>' + esc(it.codigo) + '</td><td>' + esc(it.nombre) + '</td><td style="text-align:center;">' +
          esc(it.cantidadPresupuestada) + ' ' + esc(it.unidadMedida) + '</td><td style="text-align:center;font-weight:700;">' +
          esc(it.cantidadEjecutada) + ' ' + esc(it.unidadMedida) + '</td></tr>'
        );
      })
      .join('');
    var personalTxt = (parte.personalIntervinienteIds || []).map(getPersonalName).join(', ') || '—';
    var conf = parte.conformidad || {};
    var html =
      '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Parte de Servicio ' + esc(parte.numero) + '</title>' +
      '<style>body{font-family:Segoe UI,Arial,sans-serif;color:#112D3A;margin:24px;}header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #56D7A1;padding-bottom:12px;margin-bottom:16px;}table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;}th,td{border:1px solid #cbd5e1;padding:7px;}th{background:#112D3A;color:#fff;text-align:left;}.box{background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:12px;}@media print{.no-print{display:none;}}</style></head><body>' +
      '<header><div><img src="' + esc(logo) + '" style="height:44px;object-fit:contain;"></div>' +
      '<div style="text-align:right;"><h2 style="margin:0;">PARTE DE SERVICIO ' + esc(parte.numero) + '</h2><div style="font-size:12px;">OT Asociada: <strong>' + esc(parte.otNumero) + '</strong></div><div style="font-size:12px;">Inicio: ' + esc(parte.fechaInicio) + ' · Fin: ' + esc(parte.fechaFin) + ' (' + esc(parte.horasTrabajadas) + ' hs)</div></div></header>' +
      '<div class="box"><strong>Cliente:</strong> ' + esc(parte.clientNombre) +
      (ot && ot.lugarTrabajo ? '<br><strong>Establecimiento / Sitio:</strong> ' + esc(ot.lugarTrabajo) + ' — ' + esc(ot.domicilioTrabajo) : '') +
      (ot && ot.equipoInstalacion ? '<br><strong>Equipo / Instalación:</strong> ' + esc(ot.equipoInstalacion) : '') +
      '<br><strong>Personal Interviniente:</strong> ' + esc(personalTxt) + '</div>' +
      '<table><thead><tr><th>Cód.</th><th>Servicio Ejecutado</th><th>Presupuestado</th><th>Ejecutado Real</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="box"><strong>Movilidad:</strong> ' + esc(parte.movilidadKm) + ' km (' + esc(fmtArs.format(parte.movilidadCosto || 0)) + ') · <strong>Viáticos:</strong> ' + esc(fmtArs.format(parte.viaticosCosto || 0)) + ' · <strong>Materiales:</strong> ' + esc(parte.materialesUtilizados || '—') + ' (' + esc(fmtArs.format(parte.materialesCosto || 0)) + ')</div>' +
      (parte.observaciones ? '<div class="box"><strong>Observaciones:</strong> ' + esc(parte.observaciones) + '</div>' : '') +
      (parte.incidencias ? '<div class="box"><strong>Incidencias:</strong> ' + esc(parte.incidencias) + '</div>' : '') +
      '<div class="box"><strong>CONFORMIDAD DEL CLIENTE</strong><br>Receptor: <strong>' + esc(conf.nombreReceptor || '—') + '</strong>' + (conf.cargoDniReceptor ? ' (' + esc(conf.cargoDniReceptor) + ')' : '') + ' · Fecha: ' + esc(conf.fechaConformidad || '—') +
      (conf.observaciones ? '<br>Obs.: ' + esc(conf.observaciones) : '') +
      (conf.firmaDataUrl ? '<div style="margin-top:8px;"><img src="' + conf.firmaDataUrl + '" style="max-height:95px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:4px;"></div>' : '') +
      '<div style="font-size:10px;color:#64748b;margin-top:6px;">' + esc(conf.avisoLegal || 'Constancia operativa de conformidad mediante trazo digitalizado simple.') + '</div></div>' +
      '<div class="no-print" style="margin-top:16px;text-align:center;"><button onclick="window.print()" style="padding:10px 20px;background:#112D3A;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">🖨️ Imprimir / Guardar PDF</button></div>' +
      '</body></html>';
    var w = window.open('', '_blank', 'width=940,height=780');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  // =========================================================================
  // FACTURACIÓN DIRECTA DE SERVICIOS (SIN CAJA) + IMPRESIÓN PDF A4
  // =========================================================================
  function suggestLetraForClient(clientId) {
    var cli = (STATE.clientes || []).find(function (c) { return Number(c.id) === Number(clientId); });
    var resp = String((cli && cli.respIva) || '').toUpperCase();
    var brandCond = String((window.ERP_BRAND && window.ERP_BRAND.condIva) || '').toUpperCase();
    if (brandCond.indexOf('MONOTRIBUTO') >= 0) return 'C';
    if (resp.indexOf('RESPONSABLE INSCRIPTO') >= 0 || resp.indexOf('MONOTRIBUTO') >= 0) return 'A';
    return 'B';
  }

  function buildEmptyDirectInvoice() {
    var firstCli = (STATE.clientes || []).find(function (c) { return Number(c.id) !== 1; }) || (STATE.clientes || [])[0];
    var cid = firstCli ? Number(firstCli.id) : 1;
    var letra = suggestLetraForClient(cid);
    return {
      billingClientId: cid,
      tipoBase: 'Factura',
      letra: letra,
      pv: '0004',
      fechaIso: todayIso(),
      medioPago: 'CUENTA CORRIENTE',
      autorizarArca: letra !== 'X',
      observacion: '',
      items: [],
      context: { sourceType: 'directo', links: [] }
    };
  }

  function buildEmptyDirectCobranza() {
    var withDebt = (STATE.clientes || []).find(function (c) { return Number(c.saldoActual || 0) > 0.01; });
    var firstCli = withDebt || (STATE.clientes || []).find(function (c) { return Number(c.id) !== 1; }) || (STATE.clientes || [])[0];
    return {
      clientId: firstCli ? Number(firstCli.id) : 1,
      fechaIso: todayIso(),
      importeCobrado: withDebt ? Number(withDebt.saldoActual || 0) : 0,
      medioPago: 'TRANSFERENCIA BANCARIA',
      referencia: '',
      retencionTipo: '',
      retencionImporte: 0,
      retencionCertificado: '',
      facturaId: '',
      observaciones: ''
    };
  }

  function openDirectServiceInvoice(payload, returnToOverride) {
    var base = buildEmptyDirectInvoice();
    if (payload) {
      var cid = Number(payload.billingClientId || base.billingClientId || 1);
      base.billingClientId = cid;
      base.letra = payload.letra || suggestLetraForClient(cid);
      base.autorizarArca = base.letra !== 'X';
      base.observacion = String(payload.observacion || '');
      base.items = Array.isArray(payload.items)
        ? payload.items.map(function (it) {
            return {
              codigo: String(it.codigo || 'SRV'),
              nombre: String(it.nombre || 'Servicio'),
              unidadMedida: String(it.unidadMedida || 'Unidad'),
              cantidad: Number(it.cantidad) || 1,
              precioFinal: Number(it.precioFinal) || 0,
              descPct: Number(it.descPct) || 0,
              ivaPct: it.ivaPct != null ? Number(it.ivaPct) : 21,
              isService: true,
              itemType: 'service',
              serviceLink: it.serviceLink || null
            };
          })
        : [];
      base.context = payload.context || { sourceType: 'directo', links: [] };
    }
    STATE.directInvoice = base;
    STATE.lastEmittedInvoice = null;
    openServiciosView('facturar_directo', {
      returnTo: returnToOverride || (STATE.returnTo === 'sec-menu-facturacion' ? 'sec-menu-facturacion' : 'servicios'),
      keepDirectDraft: true
    });
  }

  function printDirectInvoicePdf(inv) {
    if (!inv) return;
    var brand = window.ERP_BRAND || {};
    var logo = brand.logoHorizontalUrl || '/sistema/assets/img/minisistema/logo-horizontal.png';
    var rows = (inv.items || [])
      .map(function (it) {
        var qty = Number(it.cantidad) || 1;
        var unit = Number(it.precioFinal) || 0;
        var disc = Number(it.descPct) || 0;
        var sub = Math.round(qty * unit * (1 - disc / 100) * 100) / 100;
        return (
          '<tr>' +
            '<td>' + esc(it.codigo || 'SRV') + '</td>' +
            '<td><strong>' + esc(it.nombre) + '</strong>' + (it.unidadMedida ? ' <small>(' + esc(it.unidadMedida) + ')</small>' : '') + '</td>' +
            '<td style="text-align:center;">' + esc(qty) + '</td>' +
            '<td style="text-align:right;">' + esc(fmtArs.format(unit)) + '</td>' +
            '<td style="text-align:center;">' + esc(it.ivaPct != null ? it.ivaPct : 21) + '%</td>' +
            '<td style="text-align:right;font-weight:700;">' + esc(fmtArs.format(sub)) + '</td>' +
          '</tr>'
        );
      })
      .join('');
    var html =
      '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + esc(inv.tipoBase) + ' ' + esc(inv.letra) + ' ' + esc(inv.numeroCompleto) + '</title>' +
      '<style>body{font-family:Segoe UI,Arial,sans-serif;color:#112D3A;margin:24px;}header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #56D7A1;padding-bottom:12px;margin-bottom:16px;}.letra-box{border:2px solid #112D3A;border-radius:10px;padding:6px 16px;text-align:center;font-size:24px;font-weight:900;background:#f8fafc;}table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12px;}th,td{border:1px solid #cbd5e1;padding:7px;}th{background:#112D3A;color:#fff;text-align:left;}.box{background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;}.tot{max-width:340px;margin-left:auto;border:2px solid #112D3A;border-radius:8px;padding:10px 14px;}@media print{.no-print{display:none;}}</style></head><body>' +
      '<header>' +
        '<div><img src="' + esc(logo) + '" style="height:44px;object-fit:contain;"><div style="font-size:11px;margin-top:4px;"><strong>' + esc(brand.fantasyName || brand.businessName || 'MiniSistema') + '</strong><br>' + esc(brand.address || '') + '<br>CUIT: ' + esc(brand.cuitFmt || '—') + ' · ' + esc(brand.condIva || '') + '</div></div>' +
        '<div class="letra-box">' + esc(inv.letra) + '<div style="font-size:9px;font-weight:700;">' + esc(inv.letra === 'X' ? 'NO FISCAL' : 'COD. ARCA') + '</div></div>' +
        '<div style="text-align:right;"><h2 style="margin:0;">' + esc(String(inv.tipoBase || 'Factura').toUpperCase()) + ' ' + esc(inv.letra) + '</h2><div style="font-size:15px;font-weight:900;">N° ' + esc(inv.numeroCompleto) + '</div><div style="font-size:12px;">Fecha: ' + esc(inv.fechaIso) + '</div><div style="font-size:11px;">Cond. Pago: <strong>' + esc(inv.medioPago) + '</strong></div></div>' +
      '</header>' +
      '<div class="box"><strong>Cliente:</strong> ' + esc(inv.billingClientNombre) +
      (inv.clienteDoc ? ' · <strong>CUIT / DNI:</strong> ' + esc(inv.clienteDoc) : '') +
      (inv.clienteRespIva ? ' · <strong>IVA:</strong> ' + esc(inv.clienteRespIva) : '') +
      (inv.observacion ? '<br><strong>Referencia / OC:</strong> ' + esc(inv.observacion) : '') + '</div>' +
      '<table><thead><tr><th>Cód.</th><th>Concepto / Servicio</th><th>Cant.</th><th>Precio Unit.</th><th>IVA</th><th>Subtotal</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="tot">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;"><span>Neto Gravado:</span><strong>' + esc(fmtArs.format(inv.neto || 0)) + '</strong></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;"><span>IVA Discriminado:</span><strong>' + esc(fmtArs.format(inv.iva || 0)) + '</strong></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;border-top:2px solid #112D3A;margin-top:8px;padding-top:6px;"><span>TOTAL:</span><span>' + esc(fmtArs.format(inv.importe || 0)) + '</span></div>' +
      '</div>' +
      (inv.cae
        ? '<div class="box" style="margin-top:14px;border-color:#56D7A1;"><strong>🏛️ Comprobante Electrónico Autorizado ARCA (WSFEv1)</strong><br>CAE N°: <strong>' + esc(inv.cae) + '</strong> · Vencimiento CAE: <strong>' + esc(inv.caeVto || '—') + '</strong></div>'
        : '<div class="box" style="margin-top:14px;"><strong>Estado ARCA:</strong> ' + (inv.letra === 'X' ? 'Comprobante interno no fiscal' : 'Registrado en Administración Comprobantes Electrónicos (Pendiente de informar CAE)') + '</div>') +
      '<div class="no-print" style="margin-top:16px;text-align:center;"><button onclick="window.print()" style="padding:10px 20px;background:#112D3A;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">🖨️ Imprimir / Guardar PDF</button></div>' +
      '</body></html>';
    var w = window.open('', '_blank', 'width=940,height=780');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  function printDirectReciboPdf(rec) {
    if (!rec) return;
    var brand = window.ERP_BRAND || {};
    var logo = brand.logoHorizontalUrl || '/sistema/assets/img/minisistema/logo-horizontal.png';
    var html =
      '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recibo ' + esc(rec.numero) + '</title>' +
      '<style>body{font-family:Segoe UI,Arial,sans-serif;color:#112D3A;margin:24px;}header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #56D7A1;padding-bottom:12px;margin-bottom:16px;}.box{background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px 16px;margin-bottom:12px;font-size:13px;}table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;}th,td{border:1px solid #cbd5e1;padding:8px;}th{background:#112D3A;color:#fff;text-align:left;}@media print{.no-print{display:none;}}</style></head><body>' +
      '<header><div><img src="' + esc(logo) + '" style="height:44px;object-fit:contain;"><div style="font-size:11px;margin-top:4px;"><strong>' + esc(brand.fantasyName || brand.businessName || 'MiniSistema') + '</strong> · CUIT: ' + esc(brand.cuitFmt || '—') + '</div></div>' +
      '<div style="text-align:right;"><h2 style="margin:0;">RECIBO DE COBRANZA</h2><div style="font-size:14px;font-weight:900;">N° ' + esc(rec.numero) + '</div><div style="font-size:12px;">Fecha: ' + esc(rec.fechaIso) + '</div></div></header>' +
      '<div class="box"><strong>Recibimos de:</strong> ' + esc(rec.clientNombre) + (rec.clientDoc ? ' (CUIT/DNI: ' + esc(rec.clientDoc) + ')' : '') +
      '<br><strong>Medio de Pago:</strong> ' + esc(rec.medioPago) + (rec.referencia ? ' · Ref.: ' + esc(rec.referencia) : '') +
      (rec.observaciones ? '<br><strong>Observaciones:</strong> ' + esc(rec.observaciones) : '') + '</div>' +
      '<table><thead><tr><th>Concepto</th><th style="text-align:right;">Importe</th></tr></thead><tbody>' +
        '<tr><td>Cobranza de Servicios (' + esc(rec.medioPago) + ')</td><td style="text-align:right;font-weight:700;">' + esc(fmtArs.format(rec.importeCobrado || 0)) + '</td></tr>' +
        (rec.retencionImporte > 0
          ? '<tr><td>Retención Impositiva (' + esc(rec.retencionTipo || 'IMPUESTO') + (rec.retencionCertificado ? ' · Cert. ' + esc(rec.retencionCertificado) : '') + ')</td><td style="text-align:right;font-weight:700;">' + esc(fmtArs.format(rec.retencionImporte)) + '</td></tr>'
          : '') +
        '<tr style="background:#ecfdf5;"><td><strong>TOTAL ACREDITADO EN CUENTA CORRIENTE</strong></td><td style="text-align:right;font-size:16px;font-weight:900;color:#065f46;">' + esc(fmtArs.format(rec.totalAcreditado || 0)) + '</td></tr>' +
      '</tbody></table>' +
      '<div class="box"><strong>Saldo restante en Cuenta Corriente del Cliente:</strong> ' + esc(fmtArs.format(rec.saldoPosterior || 0)) + '</div>' +
      '<div class="no-print" style="margin-top:16px;text-align:center;"><button onclick="window.print()" style="padding:10px 20px;background:#112D3A;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">🖨️ Imprimir / Guardar PDF</button></div>' +
      '</body></html>';
    var w = window.open('', '_blank', 'width=860,height=720');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  // =========================================================================
  // FACTURACIÓN INTEGRADA: DIRECTA EN MODO SERVICIOS / POS NATIVO EN MIXTA
  // =========================================================================
  function sendToNativePosBilling(payload) {
    if (getActiveActividadMode() === 'servicios') {
      openDirectServiceInvoice(payload, 'servicios');
      return;
    }
    if (typeof window.__MS_LOAD_SERVICES_INTO_POS__ !== 'function') {
      openDirectServiceInvoice(payload, 'servicios');
      return;
    }
    window.__MS_LOAD_SERVICES_INTO_POS__(payload);
  }

  function buildOtBillingLines(ot, mode, pctOverride) {
    var lines = [];
    var links = [];
    var pct = mode === 'partial_pct' ? Math.min(100, Math.max(1, Number(pctOverride) || 50)) / 100 : 1;

    (ot.items || []).forEach(function (l) {
      var baseQty = mode === 'executed' && l.cantidadEjecutada > 0 ? l.cantidadEjecutada : (l.cantidadEjecutada > 0 ? l.cantidadEjecutada : l.cantidadPrevista);
      var remaining = Math.max(0, Math.round((baseQty - (Number(l.cantidadFacturada) || 0)) * 1000) / 1000);
      if (remaining <= 0) return;
      var qtyToBill = mode === 'partial_pct' ? Math.max(0.01, Math.round(remaining * pct * 1000) / 1000) : remaining;
      var unitConIva = Math.round(l.precioUnitario * (1 + (Number(l.ivaPct) || 0) / 100) * 100) / 100;
      var lineMonto = Math.round(qtyToBill * unitConIva * (1 - (Number(l.descuentoPct) || 0) / 100) * 100) / 100;
      lines.push({
        codigo: l.codigo || 'SRV',
        nombre: '[' + ot.numero + '] ' + l.nombre + ' (' + l.unidadMedida + ')',
        cantidad: qtyToBill,
        precioFinal: unitConIva,
        descPct: l.descuentoPct || 0,
        ivaPct: l.ivaPct != null ? l.ivaPct : 21,
        unidadMedida: l.unidadMedida,
        serviceLink: { otId: ot.id, lineId: l.id, servicioId: l.servicioId }
      });
      links.push({
        otId: ot.id,
        lineId: l.id,
        servicioId: l.servicioId,
        descripcion: l.nombre,
        cantidad: qtyToBill,
        monto: lineMonto
      });
    });

    if (mode !== 'partial_pct' && ot.totalFacturado <= 0.01) {
      (ot.gastosAdicionales || []).forEach(function (g) {
        var unitConIva = Math.round(g.precioUnitario * (1 + (Number(g.ivaPct) || 0) / 100) * 100) / 100;
        var gMonto = Math.round(g.cantidad * unitConIva * 100) / 100;
        lines.push({
          codigo: 'ADIC',
          nombre: '[' + ot.numero + '] ' + g.concepto,
          cantidad: g.cantidad || 1,
          precioFinal: unitConIva,
          descPct: 0,
          ivaPct: g.ivaPct != null ? g.ivaPct : 21,
          unidadMedida: 'Unidad',
          serviceLink: { otId: ot.id, lineId: g.id }
        });
        links.push({
          otId: ot.id,
          lineId: g.id,
          descripcion: g.concepto,
          cantidad: g.cantidad || 1,
          monto: gMonto
        });
      });
    }

    return { lines: lines, links: links };
  }

  // Callback que invoca app.js automáticamente cuando se emite un comprobante POS/ARCA con servicios
  window.__MS_ON_POS_SALE_COMPLETED__ = function (saleRecord, billingCtx) {
    if (!saleRecord) return;
    var isNC = /cr[eé]dito/i.test(String(saleRecord.tipoBase || ''));
    var links = [];
    if (billingCtx && Array.isArray(billingCtx.links) && billingCtx.links.length > 0) {
      links = billingCtx.links;
    } else if (Array.isArray(saleRecord.items)) {
      saleRecord.items.forEach(function (it) {
        if (!it || (!it.isService && it.itemType !== 'service')) return;
        var sl = it.serviceLink || {};
        links.push({
          otId: sl.otId || undefined,
          parteId: sl.parteId || undefined,
          abonoId: sl.abonoId || undefined,
          periodo: sl.periodo || undefined,
          lineId: sl.lineId || '',
          servicioId: sl.servicioId || '',
          descripcion: it.nombre || 'Servicio',
          cantidad: Number(it.cantidad) || 1,
          monto: Math.round((Number(it.cantidad) || 1) * (Number(it.precioFinal) || 0) * (1 - (Number(it.descPct) || 0) / 100) * 100) / 100
        });
      });
    }
    apiServicios('POST', {
      action: 'register_invoice_link',
      invoice: {
        saleId: saleRecord.id || '',
        numeroCompleto: saleRecord.numeroCompleto || '',
        tipoBase: saleRecord.tipoBase || 'Factura',
        letra: saleRecord.letra || 'A',
        fechaIso: saleRecord.fechaIso || todayIso(),
        billingClientId: saleRecord.billingClientId || 0,
        billingClientNombre: saleRecord.billingClientNombre || '',
        montoFacturado: Number(saleRecord.importe) || 0,
        origenOperacion: saleRecord.origenOperacion === 'MIXTA' ? 'MIXTA' : 'SERVICIOS',
        esNotaCredito: isNC,
        lineasFacturadas: links
      }
    })
      .then(function (r) {
        if (r && r.ok && r.db) {
          STATE.db = r.db;
        }
      })
      .catch(function () {});
  };

  // =========================================================================
  // RENDERERS DE CADA SUBMÓDULO
  // =========================================================================
  function renderClientOptions(selectedId, allowEmptyLabel) {
    var html = allowEmptyLabel ? '<option value="">' + esc(allowEmptyLabel) + '</option>' : '';
    (STATE.clientes || []).forEach(function (c) {
      html +=
        '<option value="' + esc(c.id) + '" ' + (Number(c.id) === Number(selectedId) ? 'selected' : '') + '>' +
        esc(c.nombre) + (c.nroDoc ? ' (' + esc(c.nroDoc) + ')' : '') +
        '</option>';
    });
    return html;
  }

  function renderPanelView() {
    var db = STATE.db;
    var inf = STATE.informes || {};
    var cfg = db.config;
    var selCliId = STATE.selectedProfileClientId || (STATE.clientes[0] ? String(STATE.clientes[0].id) : '');
    var prof = (db.clientProfiles && db.clientProfiles[selCliId]) || {};

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:0.75rem;">' +
          '<div class="ms-sa-card" style="border-left:4px solid #112D3A;"><div style="font-size:0.72rem;font-weight:800;opacity:0.7;text-transform:uppercase;">Presupuestado</div><div style="font-size:1.35rem;font-weight:900;">' + esc(fmtArs.format(inf.montoPresupuestado || 0)) + '</div><div style="font-size:0.74rem;opacity:0.75;">' + (inf.presupuestosAprobados || 0) + ' aprobados / ' + (inf.presupuestosTotal || 0) + ' totales</div></div>' +
          '<div class="ms-sa-card" style="border-left:4px solid #3b82f6;"><div style="font-size:0.72rem;font-weight:800;opacity:0.7;text-transform:uppercase;">Órdenes Activas</div><div style="font-size:1.35rem;font-weight:900;">' + ((inf.otsPendientes || 0) + (inf.otsEnEjecucion || 0)) + '</div><div style="font-size:0.74rem;opacity:0.75;">' + (inf.otsEnEjecucion || 0) + ' en ejecución · ' + (inf.otsFinalizadas || 0) + ' finalizadas</div></div>' +
          '<div class="ms-sa-card" style="border-left:4px solid #f59e0b;"><div style="font-size:0.72rem;font-weight:800;opacity:0.7;text-transform:uppercase;">Pendiente de Facturar</div><div style="font-size:1.35rem;font-weight:900;color:#b45309;">' + esc(fmtArs.format(inf.montoPendienteFacturar || 0)) + '</div><div style="font-size:0.74rem;opacity:0.75;">' + (inf.pendientesFacturarCount || 0) + ' orden(es) con saldo</div></div>' +
          '<div class="ms-sa-card" style="border-left:4px solid #56D7A1;"><div style="font-size:0.72rem;font-weight:800;opacity:0.7;text-transform:uppercase;">Facturado Período</div><div style="font-size:1.35rem;font-weight:900;color:#065f46;">' + esc(fmtArs.format(inf.facturacionPeriodo || 0)) + '</div><div style="font-size:0.74rem;opacity:0.75;">Histórico: ' + esc(fmtArs.format(inf.facturacionHistorica || 0)) + '</div></div>' +
          '<div class="ms-sa-card" style="border-left:4px solid #ef4444;"><div style="font-size:0.72rem;font-weight:800;opacity:0.7;text-transform:uppercase;">Cobranzas Pendientes</div><div style="font-size:1.35rem;font-weight:900;color:#b91c1c;">' + esc(fmtArs.format(inf.cobranzasPendientesServicios || 0)) + '</div><div style="font-size:0.74rem;opacity:0.75;">' + (inf.cobranzasPendientesCount || 0) + ' comp. Cta. Cte. Servicios</div></div>' +
        '</div>' +

        // Configuración de Actividad del Negocio
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.7rem;margin-bottom:0.85rem;">' +
            '<div>' +
              '<h4 style="margin:0;">⚙️ Configuración de Actividad del Negocio y Parámetros</h4>' +
              '<div style="font-size:0.78rem;opacity:0.75;margin-top:0.2rem;">Cambiá la modalidad operativa en cualquier momento sin perder datos históricos. En modalidad Mixta podés facturar productos y servicios juntos.</div>' +
            '</div>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-srv-load-demo-end" style="font-size:0.78rem;">🧪 Cargar Caso de Validación: END Comodoro Rivadavia (15 Soldaduras UT)</button>' +
          '</div>' +
          '<form id="ms-srv-config-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.75rem;">' +
            '<div>' +
              '<label class="ms-sa-label">Modalidad Operativa del Negocio</label>' +
              '<select class="ms-sa-select" name="actividadNegocio">' +
                '<option value="comercial" ' + (cfg.actividadNegocio === 'comercial' ? 'selected' : '') + '>1. Comercial (Productos físicos)</option>' +
                '<option value="servicios" ' + (cfg.actividadNegocio === 'servicios' ? 'selected' : '') + '>2. Servicios (Prestaciones técnicas / profesionales)</option>' +
                '<option value="mixta" ' + (cfg.actividadNegocio === 'mixta' ? 'selected' : '') + '>3. Mixta: Comercial + Servicios</option>' +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label class="ms-sa-label">Moneda por Defecto</label>' +
              '<select class="ms-sa-select" name="monedaDefault">' +
                '<option value="ARS" ' + (cfg.monedaDefault === 'ARS' ? 'selected' : '') + '>ARS ($ Pesos)</option>' +
                '<option value="USD" ' + (cfg.monedaDefault === 'USD' ? 'selected' : '') + '>USD (Dólares)</option>' +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label class="ms-sa-label">IVA por Defecto (%)</label>' +
              '<input class="ms-sa-input" type="number" step="0.5" name="ivaDefaultPct" value="' + esc(cfg.ivaDefaultPct) + '">' +
            '</div>' +
            '<div>' +
              '<label class="ms-sa-label">Validez Presupuestos (días)</label>' +
              '<input class="ms-sa-input" type="number" min="1" name="validezPresupuestoDias" value="' + esc(cfg.validezPresupuestoDias) + '">' +
            '</div>' +
            '<div style="grid-column:1 / -1;">' +
              '<label class="ms-sa-label">Unidades de Facturación Personalizadas (separadas por coma)</label>' +
              '<input class="ms-sa-input" name="unidadesPersonalizadas" value="' + esc((cfg.unidadesPersonalizadas || []).join(', ')) + '" placeholder="Ej: Ensayo, Soldadura, Punto de medición, Informe">' +
            '</div>' +
            '<div style="grid-column:1 / -1;">' +
              '<label class="ms-sa-label">Condiciones Comerciales por Defecto (Presupuestos / OT)</label>' +
              '<textarea class="ms-sa-input" rows="2" name="condicionesComercialesDefault">' + esc(cfg.condicionesComercialesDefault || '') + '</textarea>' +
            '</div>' +
            '<div style="grid-column:1 / -1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;">' +
              '<label style="display:inline-flex;align-items:center;gap:0.45rem;font-size:0.82rem;font-weight:700;cursor:pointer;">' +
                '<input type="checkbox" name="requiereAprobacionAdminFacturacion" ' + (cfg.requiereAprobacionAdminFacturacion ? 'checked' : '') + '> Registrar aprobación administrativa y retenciones en comprobantes de servicios' +
              '</label>' +
              '<button type="submit" class="ms-sa-btn">💾 Guardar Configuración</button>' +
            '</div>' +
          '</form>' +
        '</div>' +

        // Módulo A: Atributos Complementarios de Clientes (reutilizando clientes_db)
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.8rem;">' +
            '<div>' +
              '<h4 style="margin:0;">👥 Datos Complementarios de Servicios por Cliente (Padrón Único)</h4>' +
              '<div style="font-size:0.78rem;opacity:0.75;">Reutiliza el padrón existente de Clientes. Permite definir contactos técnicos/administrativos, establecimientos, razón social destinataria de factura y condiciones de pago.</div>' +
            '</div>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-srv-edit-native-client" style="font-size:0.76rem;">✏️ Abrir Ficha en Padrón Clientes</button>' +
          '</div>' +
          '<div style="margin-bottom:0.75rem;">' +
            '<label class="ms-sa-label">Seleccionar Cliente del Padrón</label>' +
            '<select class="ms-sa-select" id="ms-srv-prof-client-sel" style="max-width:460px;">' + renderClientOptions(selCliId, '— Elegir cliente —') + '</select>' +
          '</div>' +
          (selCliId
            ? '<form id="ms-srv-client-profile-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.7rem;">' +
                '<input type="hidden" name="clientId" value="' + esc(selCliId) + '">' +
                '<div><label class="ms-sa-label">Contacto Técnico (Nombre)</label><input class="ms-sa-input" name="contactoTecnicoNombre" value="' + esc(prof.contactoTecnicoNombre || '') + '"></div>' +
                '<div><label class="ms-sa-label">Contacto Técnico (Tel / WA)</label><input class="ms-sa-input" name="contactoTecnicoTel" value="' + esc(prof.contactoTecnicoTel || '') + '"></div>' +
                '<div><label class="ms-sa-label">Contacto Administrativo</label><input class="ms-sa-input" name="contactoAdminNombre" value="' + esc(prof.contactoAdminNombre || '') + '"></div>' +
                '<div><label class="ms-sa-label">Email Facturación / Admin</label><input class="ms-sa-input" name="contactoAdminEmail" value="' + esc(prof.contactoAdminEmail || '') + '"></div>' +
                '<div><label class="ms-sa-label">Código Interno / Proveedor</label><input class="ms-sa-input" name="codigoInternoCliente" value="' + esc(prof.codigoInternoCliente || '') + '"></div>' +
                '<div><label class="ms-sa-label">Órdenes de Compra / Contrato Ref.</label><input class="ms-sa-input" name="ordenesCompraRef" value="' + esc(prof.ordenesCompraRef || '') + '"></div>' +
                '<div><label class="ms-sa-label">Plazo Pago (días)</label><input class="ms-sa-input" type="number" name="plazoPagoDias" value="' + esc(prof.plazoPagoDias != null ? prof.plazoPagoDias : 30) + '"></div>' +
                '<div><label class="ms-sa-label">Razón Social Destinataria Factura (si es distinta)</label><select class="ms-sa-select" name="defaultBillingClientId">' + renderClientOptions(prof.defaultBillingClientId || '', 'Misma razón social del solicitante') + '</select></div>' +
                '<div style="grid-column:1 / -1;"><label class="ms-sa-label">Condiciones de Contratación y Pago</label><input class="ms-sa-input" name="condicionesContratacion" value="' + esc(prof.condicionesContratacion || '') + '"></div>' +
                '<div style="grid-column:1 / -1;text-align:right;"><button type="submit" class="ms-sa-btn">💾 Guardar Perfil de Servicios del Cliente</button></div>' +
              '</form>'
            : '<div style="opacity:0.7;font-size:0.84rem;">Seleccioná o creá un cliente para configurar sus datos técnicos de servicios.</div>') +
        '</div>' +

        // Comprobantes vinculados + Aprobación Administrativa y Retenciones
        '<div class="ms-sa-card">' +
          '<h4 style="margin:0 0 0.7rem;">🧾 Comprobantes Emitidos de Servicios, Aprobación Administrativa y Retenciones</h4>' +
          '<div style="overflow-x:auto;">' +
            '<table class="ms-sa-table" data-excel-table-key="srv-facturas" style="width:100%;">' +
              '<thead><tr><th>Fecha</th><th>Comprobante</th><th>Destinatario</th><th>Origen</th><th>Importe</th><th>Aprobación</th><th>Retenciones</th><th>Acciones</th></tr></thead>' +
              '<tbody>' +
                ((db.facturasVinculadas || []).length === 0
                  ? '<tr><td colspan="8" style="text-align:center;padding:1.2rem;opacity:0.7;">Todavía no hay facturas vinculadas desde Gestión de Servicios. Emití una desde Órdenes de Trabajo, Presupuestos o Abonos.</td></tr>'
                  : db.facturasVinculadas
                      .map(function (f) {
                        var retSum = (f.retenciones || []).reduce(function (a, r) { return a + (Number(r.importe) || 0); }, 0);
                        return (
                          '<tr>' +
                            '<td>' + esc(f.fechaIso) + '</td>' +
                            '<td><strong>' + esc(f.tipoBase) + ' ' + esc(f.letra) + ' ' + esc(f.numeroCompleto) + '</strong></td>' +
                            '<td>' + esc(f.billingClientNombre || getClientName(f.billingClientId)) + '</td>' +
                            '<td>' + estadoBadgeHtml(f.origenOperacion === 'MIXTA' ? 'en_ejecucion' : 'aprobado') + ' <span style="font-size:0.72rem;font-weight:700;">' + esc(f.origenOperacion) + '</span></td>' +
                            '<td style="font-weight:800;">' + (f.esNotaCredito ? '− ' : '') + esc(fmtArs.format(f.montoFacturado || 0)) + '</td>' +
                            '<td>' + estadoBadgeHtml(f.aprobacionAdminEstado === 'aprobada' ? 'aprobado' : 'pendiente') + '</td>' +
                            '<td>' + (retSum > 0 ? '<strong>' + esc(fmtArs.format(retSum)) + '</strong> (' + (f.retenciones || []).length + ')' : '—') + '</td>' +
                            '<td><button type="button" class="ms-sa-btn ms-sa-btn--outline" data-srv-retencion="' + esc(f.id) + '" style="padding:0.25rem 0.55rem;font-size:0.72rem;">🏛️ Aprob. / Retención</button></td>' +
                          '</tr>'
                        );
                      })
                      .join('')) +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderCatalogoView() {
    var db = STATE.db;
    var q = String(STATE.search || '').trim().toLowerCase();
    var list = (db.catalogo || []).filter(function (s) {
      if (!q) return true;
      return (
        String(s.codigo || '').toLowerCase().includes(q) ||
        String(s.nombre || '').toLowerCase().includes(q) ||
        String(s.categoria || '').toLowerCase().includes(q) ||
        String(s.unidadMedida || '').toLowerCase().includes(q)
      );
    });
    var ed = STATE.editingService;

    var formHtml = ed
      ? '<div class="ms-sa-card" style="border:2px solid #56D7A1;">' +
          '<h4 style="margin:0 0 0.8rem;">' + (ed.id ? '✏️ Editar Servicio' : '➕ Nuevo Servicio en Catálogo') + '</h4>' +
          '<form id="ms-srv-service-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.75rem;">' +
            '<input type="hidden" name="id" value="' + esc(ed.id || '') + '">' +
            '<div><label class="ms-sa-label">Código Interno</label><input class="ms-sa-input" name="codigo" value="' + esc(ed.codigo || '') + '" placeholder="Ej: END-UT-01"></div>' +
            '<div style="grid-column:span 2;"><label class="ms-sa-label">Nombre del Servicio *</label><input class="ms-sa-input" name="nombre" required value="' + esc(ed.nombre || '') + '" placeholder="Ej: Inspección por Ultrasonido"></div>' +
            '<div><label class="ms-sa-label">Categoría / Rubro</label><input class="ms-sa-input" name="categoria" value="' + esc(ed.categoria || 'Servicios Generales') + '"></div>' +
            '<div><label class="ms-sa-label">Unidad de Facturación</label><select class="ms-sa-select" name="unidadMedida">' +
              STATE.unidades.map(function (u) { return '<option value="' + esc(u) + '" ' + (ed.unidadMedida === u ? 'selected' : '') + '>' + esc(u) + '</option>'; }).join('') +
            '</select></div>' +
            '<div><label class="ms-sa-label">Precio Base (Neto)</label><input class="ms-sa-input" type="number" step="0.01" name="precioBase" required value="' + esc(ed.precioBase != null ? ed.precioBase : 0) + '"></div>' +
            '<div><label class="ms-sa-label">Costo Directo Estimado</label><input class="ms-sa-input" type="number" step="0.01" name="costoEstimado" value="' + esc(ed.costoEstimado != null ? ed.costoEstimado : 0) + '"></div>' +
            '<div><label class="ms-sa-label">Moneda</label><select class="ms-sa-select" name="moneda"><option value="ARS" ' + (ed.moneda !== 'USD' ? 'selected' : '') + '>ARS ($)</option><option value="USD" ' + (ed.moneda === 'USD' ? 'selected' : '') + '>USD</option></select></div>' +
            '<div><label class="ms-sa-label">IVA (%)</label><input class="ms-sa-input" type="number" step="0.5" name="ivaPct" value="' + esc(ed.ivaPct != null ? ed.ivaPct : db.config.ivaDefaultPct) + '"></div>' +
            '<div><label class="ms-sa-label">Duración Estimada (min)</label><input class="ms-sa-input" type="number" name="duracionEstimadaMin" value="' + esc(ed.duracionEstimadaMin || 60) + '"></div>' +
            '<div><label class="ms-sa-label">Estado</label><select class="ms-sa-select" name="activo"><option value="1" ' + (ed.activo !== false ? 'selected' : '') + '>Activo</option><option value="0" ' + (ed.activo === false ? 'selected' : '') + '>Inactivo</option></select></div>' +
            '<div style="grid-column:1 / -1;"><label class="ms-sa-label">Descripción</label><textarea class="ms-sa-input" rows="2" name="descripcion">' + esc(ed.descripcion || '') + '</textarea></div>' +
            '<div style="grid-column:1 / -1;"><label class="ms-sa-label">Observaciones / Motivo de cambio de tarifa</label><input class="ms-sa-input" name="observaciones" value="' + esc(ed.observaciones || '') + '"></div>' +
            '<div style="grid-column:1 / -1;display:flex;justify-content:flex-end;gap:0.5rem;">' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-srv-cancel-edit">Cancelar</button>' +
              '<button type="submit" class="ms-sa-btn">💾 Guardar Servicio</button>' +
            '</div>' +
          '</form>' +
        '</div>'
      : '';

    return (
      '<div style="display:grid;gap:1rem;">' +
        formHtml +
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.7rem;margin-bottom:0.85rem;">' +
            '<input class="ms-sa-input" id="ms-srv-search" style="max-width:340px;" value="' + esc(STATE.search) + '" placeholder="🔎 Buscar por código, servicio, rubro o unidad...">' +
            '<button type="button" class="ms-sa-btn" id="ms-srv-new-service">➕ Nuevo Servicio</button>' +
          '</div>' +
          '<div style="overflow-x:auto;">' +
            '<table class="ms-sa-table" data-excel-table-key="srv-catalogo" style="width:100%;">' +
              '<thead><tr><th>Código</th><th>Servicio</th><th>Categoría</th><th>Unidad</th><th>Precio Base</th><th>IVA</th><th>Duración</th><th>Estado</th><th>Acciones</th></tr></thead>' +
              '<tbody>' +
                (list.length === 0
                  ? '<tr><td colspan="9" style="text-align:center;padding:1.4rem;opacity:0.7;">Sin servicios cargados. Hacé clic en "➕ Nuevo Servicio" o cargá el escenario de validación desde el Panel.</td></tr>'
                  : list
                      .map(function (s) {
                        return (
                          '<tr>' +
                            '<td><code>' + esc(s.codigo) + '</code></td>' +
                            '<td><strong>' + esc(s.nombre) + '</strong>' + (s.descripcion ? '<div style="font-size:0.73rem;opacity:0.75;">' + esc(s.descripcion) + '</div>' : '') + '</td>' +
                            '<td>' + esc(s.categoria) + '</td>' +
                            '<td>' + esc(s.unidadMedida) + '</td>' +
                            '<td style="font-weight:800;">' + esc(fmtMoney(s.precioBase, s.moneda)) + '</td>' +
                            '<td>' + esc(s.ivaPct) + '%</td>' +
                            '<td>' + esc(s.duracionEstimadaMin) + ' min</td>' +
                            '<td>' + estadoBadgeHtml(s.activo ? 'activo' : 'pausado') + '</td>' +
                            '<td style="white-space:nowrap;">' +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-srv-edit-cat="' + esc(s.id) + '" style="padding:0.25rem 0.5rem;font-size:0.73rem;margin-right:0.25rem;">✏️</button>' +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-srv-del-cat="' + esc(s.id) + '" style="padding:0.25rem 0.5rem;font-size:0.73rem;border-color:#ef4444;color:#b91c1c;">🗑</button>' +
                            '</td>' +
                          '</tr>'
                        );
                      })
                      .join('')) +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderPresupuestosView() {
    var db = STATE.db;
    var list = (db.presupuestos || []).filter(function (p) {
      if (STATE.statusFilter !== 'ALL' && p.estado !== STATE.statusFilter) return false;
      var q = String(STATE.search || '').trim().toLowerCase();
      if (!q) return true;
      return (
        String(p.numero || '').toLowerCase().includes(q) ||
        String(p.clientNombre || '').toLowerCase().includes(q) ||
        String(p.establecimientoNombre || '').toLowerCase().includes(q)
      );
    });

    var ed = STATE.editingPresupuesto;
    var formHtml = '';
    if (ed) {
      var itemRows = (ed.items || [])
        .map(function (it, idx) {
          return (
            '<div class="ms-srv-line-row" data-line-idx="' + idx + '" style="display:grid;grid-template-columns:2fr 1fr 0.7fr 1fr 0.6fr 0.6fr auto;gap:0.45rem;align-items:center;margin-bottom:0.45rem;">' +
              '<select class="ms-sa-select ms-p-srv">' +
                '<option value="">— Servicio manual / catálogo —</option>' +
                (db.catalogo || []).map(function (s) {
                  return '<option value="' + esc(s.id) + '" ' + (it.servicioId === s.id ? 'selected' : '') + '>' + esc(s.codigo + ' · ' + s.nombre) + '</option>';
                }).join('') +
              '</select>' +
              '<input class="ms-sa-input ms-p-nom" placeholder="Descripción" value="' + esc(it.nombre || '') + '">' +
              '<input class="ms-sa-input ms-p-qty" type="number" step="0.01" placeholder="Cant." value="' + esc(it.cantidad != null ? it.cantidad : 1) + '">' +
              '<input class="ms-sa-input ms-p-price" type="number" step="0.01" placeholder="Precio" value="' + esc(it.precioUnitario != null ? it.precioUnitario : 0) + '">' +
              '<input class="ms-sa-input ms-p-desc" type="number" step="0.5" placeholder="Dto%" value="' + esc(it.descuentoPct || 0) + '">' +
              '<input class="ms-sa-input ms-p-iva" type="number" step="0.5" placeholder="IVA%" value="' + esc(it.ivaPct != null ? it.ivaPct : 21) + '">' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline ms-p-rem" style="padding:0.35rem 0.55rem;color:#b91c1c;border-color:#ef4444;">✕</button>' +
            '</div>'
          );
        })
        .join('');

      var gastosRows = (ed.gastosAdicionales || [])
        .map(function (g, idx) {
          return (
            '<div class="ms-srv-gasto-row" data-gasto-idx="' + idx + '" style="display:grid;grid-template-columns:2.4fr 0.7fr 1fr 0.7fr auto;gap:0.45rem;align-items:center;margin-bottom:0.4rem;">' +
              '<input class="ms-sa-input ms-g-concepto" placeholder="Concepto (Traslado, Viáticos, etc.)" value="' + esc(g.concepto || '') + '">' +
              '<input class="ms-sa-input ms-g-qty" type="number" step="0.01" value="' + esc(g.cantidad != null ? g.cantidad : 1) + '">' +
              '<input class="ms-sa-input ms-g-price" type="number" step="0.01" value="' + esc(g.precioUnitario != null ? g.precioUnitario : 0) + '">' +
              '<input class="ms-sa-input ms-g-iva" type="number" step="0.5" value="' + esc(g.ivaPct != null ? g.ivaPct : 21) + '">' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline ms-g-rem" style="padding:0.35rem 0.55rem;color:#b91c1c;border-color:#ef4444;">✕</button>' +
            '</div>'
          );
        })
        .join('');

      formHtml =
        '<div class="ms-sa-card" style="border:2px solid #56D7A1;">' +
          '<h4 style="margin:0 0 0.85rem;">' + (ed.id ? '✏️ Editar Presupuesto ' + esc(ed.numero) + ' (v' + esc(ed.version) + ')' : '➕ Nuevo Presupuesto de Servicios') + '</h4>' +
          '<form id="ms-srv-pres-form" style="display:grid;gap:0.85rem;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.7rem;">' +
              '<div><label class="ms-sa-label">Cliente Solicitante *</label><select class="ms-sa-select" name="clientId" required>' + renderClientOptions(ed.clientId, '— Elegir cliente —') + '</select></div>' +
              '<div><label class="ms-sa-label">Destinatario de Factura</label><select class="ms-sa-select" name="billingClientId">' + renderClientOptions(ed.billingClientId || ed.clientId, 'Mismo cliente solicitante') + '</select></div>' +
              '<div><label class="ms-sa-label">Establecimiento / Sitio de Trabajo</label><input class="ms-sa-input" name="establecimientoNombre" value="' + esc(ed.establecimientoNombre || '') + '" placeholder="Ej: Planta Km 8"></div>' +
              '<div><label class="ms-sa-label">Domicilio del Sitio</label><input class="ms-sa-input" name="establecimientoDireccion" value="' + esc(ed.establecimientoDireccion || '') + '"></div>' +
              '<div><label class="ms-sa-label">Fecha</label><input class="ms-sa-input" type="date" name="fecha" value="' + esc(ed.fecha || todayIso()) + '"></div>' +
              '<div><label class="ms-sa-label">Vigente Hasta</label><input class="ms-sa-input" type="date" name="vigenteHasta" value="' + esc(ed.vigenteHasta || todayIso()) + '"></div>' +
              '<div><label class="ms-sa-label">Moneda</label><select class="ms-sa-select" name="moneda"><option value="ARS" ' + (ed.moneda !== 'USD' ? 'selected' : '') + '>ARS ($)</option><option value="USD" ' + (ed.moneda === 'USD' ? 'selected' : '') + '>USD</option></select></div>' +
              '<div><label class="ms-sa-label">Descuento Global (%)</label><input class="ms-sa-input" type="number" step="0.5" name="descuentoGlobalPct" value="' + esc(ed.descuentoGlobalPct || 0) + '"></div>' +
            '</div>' +
            '<div>' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">' +
                '<strong style="font-size:0.84rem;">Servicios Cotizados</strong>' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-p-add-line" style="padding:0.28rem 0.65rem;font-size:0.75rem;">➕ Agregar Servicio</button>' +
              '</div>' +
              '<div id="ms-p-lines-wrap">' + itemRows + '</div>' +
            '</div>' +
            '<div>' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">' +
                '<strong style="font-size:0.84rem;">Gastos Adicionales (Traslados, Viáticos, Materiales)</strong>' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-p-add-gasto" style="padding:0.28rem 0.65rem;font-size:0.75rem;">➕ Agregar Gasto</button>' +
              '</div>' +
              '<div id="ms-p-gastos-wrap">' + gastosRows + '</div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem;">' +
              '<div><label class="ms-sa-label">Condiciones Comerciales</label><textarea class="ms-sa-input" rows="2" name="condicionesComerciales">' + esc(ed.condicionesComerciales || db.config.condicionesComercialesDefault || '') + '</textarea></div>' +
              '<div><label class="ms-sa-label">Observaciones</label><textarea class="ms-sa-input" rows="2" name="observaciones">' + esc(ed.observaciones || '') + '</textarea></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:flex-end;gap:0.5rem;flex-wrap:wrap;">' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-srv-cancel-edit">Cancelar</button>' +
              (ed.id ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-p-save-new-ver">📌 Guardar como Nueva Versión (v' + (Number(ed.version || 1) + 1) + ')</button>' : '') +
              '<button type="submit" class="ms-sa-btn">💾 Guardar Presupuesto</button>' +
            '</div>' +
          '</form>' +
        '</div>';
    }

    return (
      '<div style="display:grid;gap:1rem;">' +
        formHtml +
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.85rem;">' +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
              '<input class="ms-sa-input" id="ms-srv-search" style="max-width:260px;" value="' + esc(STATE.search) + '" placeholder="🔎 Buscar presupuesto o cliente...">' +
              '<select class="ms-sa-select" id="ms-srv-status-filter" style="max-width:190px;">' +
                '<option value="ALL">Todos los estados</option>' +
                ['borrador', 'enviado', 'aprobado', 'rechazado', 'vencido', 'cancelado'].map(function (st) {
                  return '<option value="' + st + '" ' + (STATE.statusFilter === st ? 'selected' : '') + '>' + st.toUpperCase() + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
            '<button type="button" class="ms-sa-btn" id="ms-srv-new-pres">➕ Nuevo Presupuesto</button>' +
          '</div>' +
          '<div style="overflow-x:auto;">' +
            '<table class="ms-sa-table" data-excel-table-key="srv-presupuestos" style="width:100%;">' +
              '<thead><tr><th>Número</th><th>Fecha / Vigencia</th><th>Solicitante / Sitio</th><th>Ítems</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>' +
              '<tbody>' +
                (list.length === 0
                  ? '<tr><td colspan="7" style="text-align:center;padding:1.4rem;opacity:0.7;">Sin presupuestos registrados.</td></tr>'
                  : list
                      .map(function (p) {
                        return (
                          '<tr>' +
                            '<td><strong>' + esc(p.numero) + '</strong> <span style="font-size:0.72rem;opacity:0.7;">v' + esc(p.version) + '</span></td>' +
                            '<td>' + esc(p.fecha) + '<div style="font-size:0.72rem;opacity:0.75;">Vto: ' + esc(p.vigenteHasta) + '</div></td>' +
                            '<td><strong>' + esc(p.clientNombre) + '</strong>' + (p.establecimientoNombre ? '<div style="font-size:0.72rem;opacity:0.75;">📍 ' + esc(p.establecimientoNombre) + '</div>' : '') + '</td>' +
                            '<td>' + (p.items || []).length + ' serv.' + ((p.gastosAdicionales || []).length ? ' + ' + p.gastosAdicionales.length + ' adic.' : '') + '</td>' +
                            '<td style="font-weight:800;">' + esc(fmtMoney(p.totalGeneral, p.moneda)) + '</td>' +
                            '<td>' + estadoBadgeHtml(p.estado) + (p.convertedOtId ? '<div style="font-size:0.68rem;color:#0f766e;font-weight:700;">→ Convertido a OT</div>' : '') + '</td>' +
                            '<td style="white-space:nowrap;">' +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-pres-edit="' + esc(p.id) + '" title="Editar" style="padding:0.25rem 0.48rem;font-size:0.72rem;margin-right:0.2rem;">✏️</button>' +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-pres-pdf="' + esc(p.id) + '" title="Exportar PDF" style="padding:0.25rem 0.48rem;font-size:0.72rem;margin-right:0.2rem;">📄 PDF</button>' +
                              (p.estado !== 'aprobado' ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-pres-approve="' + esc(p.id) + '" style="padding:0.25rem 0.48rem;font-size:0.72rem;margin-right:0.2rem;">✓ Aprobar</button>' : '') +
                              (!p.convertedOtId ? '<button type="button" class="ms-sa-btn" data-pres-to-ot="' + esc(p.id) + '" style="padding:0.25rem 0.55rem;font-size:0.72rem;margin-right:0.2rem;">⚡ A Orden de Trabajo</button>' : '') +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-pres-bill="' + esc(p.id) + '" title="Facturar directo en ARCA" style="padding:0.25rem 0.48rem;font-size:0.72rem;">🧾</button>' +
                            '</td>' +
                          '</tr>'
                        );
                      })
                      .join('')) +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderOrdenesView() {
    var db = STATE.db;
    var list = (db.ordenesTrabajo || []).filter(function (o) {
      if (STATE.statusFilter !== 'ALL' && o.estado !== STATE.statusFilter) return false;
      var q = String(STATE.search || '').trim().toLowerCase();
      if (!q) return true;
      return (
        String(o.numero || '').toLowerCase().includes(q) ||
        String(o.clientNombre || '').toLowerCase().includes(q) ||
        String(o.billingClientNombre || '').toLowerCase().includes(q) ||
        String(o.lugarTrabajo || '').toLowerCase().includes(q) ||
        String(o.ordenCompraCliente || '').toLowerCase().includes(q)
      );
    });

    var selectedBatchCount = Object.keys(STATE.selectedOtIdsForBatch).filter(function (k) {
      return STATE.selectedOtIdsForBatch[k];
    }).length;

    var ed = STATE.editingOt;
    var formHtml = '';
    if (ed) {
      var itemRows = (ed.items || [])
        .map(function (it, idx) {
          return (
            '<div class="ms-ot-line-row" data-idx="' + idx + '" style="display:grid;grid-template-columns:2fr 1.2fr 0.7fr 1fr 0.6fr auto;gap:0.45rem;align-items:center;margin-bottom:0.45rem;">' +
              '<select class="ms-sa-select ms-ot-srv"><option value="">— Servicio —</option>' +
                (db.catalogo || []).map(function (s) {
                  return '<option value="' + esc(s.id) + '" ' + (it.servicioId === s.id ? 'selected' : '') + '>' + esc(s.codigo + ' · ' + s.nombre) + '</option>';
                }).join('') +
              '</select>' +
              '<input class="ms-sa-input ms-ot-nom" value="' + esc(it.nombre || '') + '" placeholder="Servicio">' +
              '<input class="ms-sa-input ms-ot-qty" type="number" step="0.01" value="' + esc(it.cantidadPrevista != null ? it.cantidadPrevista : 1) + '" placeholder="Cant.">' +
              '<input class="ms-sa-input ms-ot-price" type="number" step="0.01" value="' + esc(it.precioUnitario != null ? it.precioUnitario : 0) + '" placeholder="Precio">' +
              '<input class="ms-sa-input ms-ot-iva" type="number" step="0.5" value="' + esc(it.ivaPct != null ? it.ivaPct : 21) + '" placeholder="IVA%">' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline ms-ot-rem" style="padding:0.35rem 0.55rem;color:#b91c1c;border-color:#ef4444;">✕</button>' +
            '</div>'
          );
        })
        .join('');

      formHtml =
        '<div class="ms-sa-card" style="border:2px solid #56D7A1;">' +
          '<h4 style="margin:0 0 0.85rem;">' + (ed.id ? '✏️ Editar Orden de Trabajo ' + esc(ed.numero) : '➕ Nueva Orden de Trabajo') + '</h4>' +
          '<form id="ms-srv-ot-form" style="display:grid;gap:0.8rem;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.7rem;">' +
              '<div><label class="ms-sa-label">Cliente Solicitante *</label><select class="ms-sa-select" name="clientId" required>' + renderClientOptions(ed.clientId, '— Elegir —') + '</select></div>' +
              '<div><label class="ms-sa-label">Destinatario de Factura (si es distinto)</label><select class="ms-sa-select" name="billingClientId">' + renderClientOptions(ed.billingClientId || ed.clientId, 'Mismo solicitante') + '</select></div>' +
              '<div><label class="ms-sa-label">N° Orden de Compra Cliente</label><input class="ms-sa-input" name="ordenCompraCliente" value="' + esc(ed.ordenCompraCliente || '') + '" placeholder="Ej: OC-2026-0418"></div>' +
              '<div><label class="ms-sa-label">Fecha Prevista Ejecución</label><input class="ms-sa-input" type="date" name="fechaPrevista" value="' + esc(ed.fechaPrevista || todayIso()) + '"></div>' +
              '<div><label class="ms-sa-label">Estado</label><select class="ms-sa-select" name="estado">' +
                ['pendiente', 'programada', 'en_ejecucion', 'finalizada', 'cancelada'].map(function (st) {
                  return '<option value="' + st + '" ' + (ed.estado === st ? 'selected' : '') + '>' + st.toUpperCase() + '</option>';
                }).join('') +
              '</select></div>' +
              '<div><label class="ms-sa-label">Establecimiento / Lugar</label><input class="ms-sa-input" name="lugarTrabajo" value="' + esc(ed.lugarTrabajo || '') + '" placeholder="Planta / Obra / Domicilio"></div>' +
              '<div><label class="ms-sa-label">Domicilio / Ubicación</label><input class="ms-sa-input" name="domicilioTrabajo" value="' + esc(ed.domicilioTrabajo || '') + '"></div>' +
              '<div><label class="ms-sa-label">Equipo / Instalación a Intervenir</label><input class="ms-sa-input" name="equipoInstalacion" value="' + esc(ed.equipoInstalacion || '') + '"></div>' +
              '<div><label class="ms-sa-label">Duración Estimada (hs)</label><input class="ms-sa-input" type="number" step="0.5" name="duracionEstimadaHoras" value="' + esc(ed.duracionEstimadaHoras || 2) + '"></div>' +
              '<div><label class="ms-sa-label">Personal Técnico Asignado</label><select class="ms-sa-select" name="personalAsignadoId">' +
                '<option value="">— Sin asignar —</option>' +
                (db.personal || []).map(function (p) {
                  var sel = (ed.personalAsignadoIds || []).indexOf(p.id) >= 0;
                  return '<option value="' + esc(p.id) + '" ' + (sel ? 'selected' : '') + '>' + esc(p.nombre) + (p.matricula ? ' (' + esc(p.matricula) + ')' : '') + '</option>';
                }).join('') +
              '</select></div>' +
            '</div>' +
            '<div><label class="ms-sa-label">Descripción del Trabajo</label><textarea class="ms-sa-input" rows="2" name="descripcionTrabajo">' + esc(ed.descripcionTrabajo || '') + '</textarea></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem;">' +
              '<div><label class="ms-sa-label">Materiales / Recursos Necesarios</label><input class="ms-sa-input" name="materialesRecursos" value="' + esc(ed.materialesRecursos || '') + '"></div>' +
              '<div><label class="ms-sa-label">Instrucciones Especiales</label><input class="ms-sa-input" name="instruccionesEspeciales" value="' + esc(ed.instruccionesEspeciales || '') + '"></div>' +
            '</div>' +
            '<div>' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">' +
                '<strong style="font-size:0.84rem;">Servicios Contratados</strong>' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-ot-add-line" style="padding:0.28rem 0.65rem;font-size:0.75rem;">➕ Agregar Servicio</button>' +
              '</div>' +
              '<div id="ms-ot-lines-wrap">' + itemRows + '</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:flex-end;gap:0.5rem;">' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-srv-cancel-edit">Cancelar</button>' +
              '<button type="submit" class="ms-sa-btn">💾 Guardar Orden de Trabajo</button>' +
            '</div>' +
          '</form>' +
        '</div>';
    }

    var billingModalHtml = '';
    if (STATE.billingModalOtId) {
      var bOt = (db.ordenesTrabajo || []).find(function (x) { return x.id === STATE.billingModalOtId; });
      if (bOt) {
        billingModalHtml =
          '<div class="ms-sa-card" style="border:2px solid #112D3A;background:#f8fafc;">' +
            '<h4 style="margin:0 0 0.5rem;">🧾 Facturar ' + esc(bOt.numero) + ' en Facturador ARCA / POS Nativo</h4>' +
            '<div style="font-size:0.82rem;margin-bottom:0.75rem;">' +
              'Destinatario de Factura: <strong>' + esc(bOt.billingClientNombre) + '</strong>' +
              (bOt.ordenCompraCliente ? ' · OC: <strong>' + esc(bOt.ordenCompraCliente) + '</strong>' : '') +
              ' · Saldo pendiente de facturar: <strong style="color:#065f46;">' + esc(fmtMoney(bOt.saldoPendienteFacturar, bOt.moneda)) + '</strong>' +
            '</div>' +
            '<div style="display:flex;gap:0.55rem;flex-wrap:wrap;align-items:center;">' +
              '<button type="button" class="ms-sa-btn" id="ms-ot-bill-full">🧾 Facturar Saldo Completo (100%)</button>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-ot-bill-exec">📋 Facturar Cantidades Ejecutadas</button>' +
              '<div style="display:inline-flex;align-items:center;gap:0.35rem;">' +
                '<input type="number" id="ms-ot-bill-pct" class="ms-sa-input" value="50" min="1" max="99" style="width:74px;padding:0.32rem 0.5rem;">' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-ot-bill-partial">✂️ Facturar % Parcial</button>' +
              '</div>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-ot-bill-cancel">Cancelar</button>' +
            '</div>' +
            '<div style="font-size:0.74rem;opacity:0.75;margin-top:0.55rem;">Una vez abierto el Facturador ARCA / POS, podés agregar también productos físicos si es una factura mixta. Al emitir, la OT actualizará automáticamente sus cantidades facturadas y su cuenta corriente.</div>' +
          '</div>';
      }
    }

    return (
      '<div style="display:grid;gap:1rem;">' +
        billingModalHtml +
        formHtml +
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.85rem;">' +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
              '<input class="ms-sa-input" id="ms-srv-search" style="max-width:260px;" value="' + esc(STATE.search) + '" placeholder="🔎 Buscar OT, cliente, sitio u OC...">' +
              '<select class="ms-sa-select" id="ms-srv-status-filter" style="max-width:185px;">' +
                '<option value="ALL">Todos los estados</option>' +
                ['pendiente', 'programada', 'en_ejecucion', 'finalizada', 'cancelada'].map(function (st) {
                  return '<option value="' + st + '" ' + (STATE.statusFilter === st ? 'selected' : '') + '>' + st.toUpperCase() + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
              (selectedBatchCount > 0
                ? '<button type="button" class="ms-sa-btn ms-sa-btn--dark" id="ms-ot-bill-batch">🧾 Facturar Lote (' + selectedBatchCount + ' OTs)</button>'
                : '') +
              '<button type="button" class="ms-sa-btn" id="ms-srv-new-ot">➕ Nueva Orden de Trabajo</button>' +
            '</div>' +
          '</div>' +
          '<div style="overflow-x:auto;">' +
            '<table class="ms-sa-table" data-excel-table-key="srv-ordenes" style="width:100%;">' +
              '<thead><tr><th>Lote</th><th>Orden</th><th>Solicitante / Facturar a / Sitio</th><th>Personal / Fecha</th><th>Prev. / Ejec. / Pend. Fact.</th><th>Estado</th><th>Facturación</th><th>Acciones</th></tr></thead>' +
              '<tbody>' +
                (list.length === 0
                  ? '<tr><td colspan="8" style="text-align:center;padding:1.4rem;opacity:0.7;">Sin órdenes de trabajo cargadas.</td></tr>'
                  : list
                      .map(function (o) {
                        var canBill = o.estado !== 'cancelada' && o.estadoFacturacion !== 'facturada' && o.saldoPendienteFacturar > 0.01;
                        return (
                          '<tr>' +
                            '<td style="text-align:center;"><input type="checkbox" data-ot-batch="' + esc(o.id) + '" ' + (STATE.selectedOtIdsForBatch[o.id] ? 'checked' : '') + (canBill ? '' : ' disabled') + '></td>' +
                            '<td><strong>' + esc(o.numero) + '</strong>' + (o.presupuestoNumero ? '<div style="font-size:0.7rem;opacity:0.75;">De ' + esc(o.presupuestoNumero) + '</div>' : '') + (o.ordenCompraCliente ? '<div style="font-size:0.7rem;color:#0f766e;">OC: ' + esc(o.ordenCompraCliente) + '</div>' : '') + '</td>' +
                            '<td><strong>' + esc(o.clientNombre) + '</strong>' +
                              (o.billingClientId && o.billingClientId !== o.clientId ? '<div style="font-size:0.72rem;color:#0369a1;">🧾 Facturar a: ' + esc(o.billingClientNombre) + '</div>' : '') +
                              (o.lugarTrabajo ? '<div style="font-size:0.72rem;opacity:0.75;">📍 ' + esc(o.lugarTrabajo) + '</div>' : '') +
                            '</td>' +
                            '<td><div>' + esc((o.personalAsignadoIds || []).map(getPersonalName).join(', ') || 'Sin asignar') + '</div><div style="font-size:0.72rem;opacity:0.75;">📅 ' + esc(o.fechaPrevista) + '</div></td>' +
                            '<td>' +
                              '<div style="font-size:0.76rem;">Prev: <strong>' + esc(fmtMoney(o.totalPrevisto, o.moneda)) + '</strong></div>' +
                              '<div style="font-size:0.74rem;">Ejec: ' + esc(fmtMoney(o.totalEjecutado, o.moneda)) + '</div>' +
                              '<div style="font-size:0.74rem;color:#b45309;font-weight:800;">Pend: ' + esc(fmtMoney(o.saldoPendienteFacturar, o.moneda)) + '</div>' +
                            '</td>' +
                            '<td>' + estadoBadgeHtml(o.estado) + '</td>' +
                            '<td>' + estadoBadgeHtml(o.estadoFacturacion) + '</td>' +
                            '<td style="white-space:nowrap;">' +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-ot-edit="' + esc(o.id) + '" style="padding:0.25rem 0.45rem;font-size:0.72rem;margin-right:0.2rem;" title="Editar OT">✏️</button>' +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-ot-parte="' + esc(o.id) + '" style="padding:0.25rem 0.5rem;font-size:0.72rem;margin-right:0.2rem;">📝 Parte</button>' +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-ot-docs="' + esc(o.id) + '" style="padding:0.25rem 0.45rem;font-size:0.72rem;margin-right:0.2rem;" title="Documentación técnica">📎</button>' +
                              (canBill ? '<button type="button" class="ms-sa-btn" data-ot-bill="' + esc(o.id) + '" style="padding:0.25rem 0.55rem;font-size:0.72rem;">🧾 Facturar</button>' : '') +
                            '</td>' +
                          '</tr>'
                        );
                      })
                      .join('')) +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderPartesView() {
    var db = STATE.db;
    var ed = STATE.editingParte;
    var formHtml = '';
    if (ed) {
      var targetOt = (db.ordenesTrabajo || []).find(function (o) { return o.id === ed.otId; });
      var lines = ed.itemsEjecutados && ed.itemsEjecutados.length > 0
        ? ed.itemsEjecutados
        : targetOt
          ? (targetOt.items || []).map(function (l) {
              return {
                otLineId: l.id,
                servicioId: l.servicioId,
                codigo: l.codigo,
                nombre: l.nombre,
                unidadMedida: l.unidadMedida,
                cantidadPresupuestada: l.cantidadPrevista,
                cantidadEjecutada: l.cantidadPrevista,
                precioUnitario: l.precioUnitario,
                ivaPct: l.ivaPct
              };
            })
          : [];

      formHtml =
        '<div class="ms-sa-card" style="border:2px solid #56D7A1;">' +
          '<h4 style="margin:0 0 0.8rem;">📝 Registrar Parte de Servicio (Ejecución Real y Conformidad)</h4>' +
          '<form id="ms-srv-parte-form" style="display:grid;gap:0.8rem;">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.7rem;">' +
              '<div><label class="ms-sa-label">Orden de Trabajo *</label><select class="ms-sa-select" name="otId" id="ms-parte-ot-sel" required>' +
                '<option value="">— Seleccionar OT —</option>' +
                (db.ordenesTrabajo || []).map(function (o) {
                  return '<option value="' + esc(o.id) + '" ' + (ed.otId === o.id ? 'selected' : '') + '>' + esc(o.numero + ' · ' + o.clientNombre) + '</option>';
                }).join('') +
              '</select></div>' +
              '<div><label class="ms-sa-label">Inicio</label><input class="ms-sa-input" type="datetime-local" name="fechaInicio" value="' + esc(ed.fechaInicio || nowLocalDateTime()) + '"></div>' +
              '<div><label class="ms-sa-label">Finalización</label><input class="ms-sa-input" type="datetime-local" name="fechaFin" value="' + esc(ed.fechaFin || nowLocalDateTime()) + '"></div>' +
              '<div><label class="ms-sa-label">Horas Trabajadas</label><input class="ms-sa-input" type="number" step="0.25" name="horasTrabajadas" value="' + esc(ed.horasTrabajadas != null ? ed.horasTrabajadas : 4) + '"></div>' +
              '<div><label class="ms-sa-label">Movilidad (Km)</label><input class="ms-sa-input" type="number" step="1" name="movilidadKm" value="' + esc(ed.movilidadKm || 0) + '"></div>' +
              '<div><label class="ms-sa-label">Costo Movilidad ($)</label><input class="ms-sa-input" type="number" step="0.01" name="movilidadCosto" value="' + esc(ed.movilidadCosto || 0) + '"></div>' +
              '<div><label class="ms-sa-label">Viáticos ($)</label><input class="ms-sa-input" type="number" step="0.01" name="viaticosCosto" value="' + esc(ed.viaticosCosto || 0) + '"></div>' +
              '<div><label class="ms-sa-label">Costo Materiales ($)</label><input class="ms-sa-input" type="number" step="0.01" name="materialesCosto" value="' + esc(ed.materialesCosto || 0) + '"></div>' +
            '</div>' +
            '<div><label class="ms-sa-label">Materiales Utilizados</label><input class="ms-sa-input" name="materialesUtilizados" value="' + esc(ed.materialesUtilizados || '') + '"></div>' +
            '<div>' +
              '<strong style="font-size:0.84rem;display:block;margin-bottom:0.4rem;">Cantidades Presupuestadas vs. Ejecutadas</strong>' +
              (lines.length === 0
                ? '<div style="font-size:0.8rem;opacity:0.7;">Seleccioná una Orden de Trabajo para cargar sus servicios previstos.</div>'
                : lines
                    .map(function (l, idx) {
                      return (
                        '<div class="ms-parte-item-row" data-pidx="' + idx + '" style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:0.5rem;align-items:center;padding:0.4rem 0;border-bottom:1px solid rgba(17,45,58,0.08);">' +
                          '<div><strong>' + esc(l.nombre) + '</strong> <span style="font-size:0.72rem;opacity:0.7;">(' + esc(l.unidadMedida) + ')</span></div>' +
                          '<div style="font-size:0.82rem;">Presupuestado: <strong>' + esc(l.cantidadPresupuestada) + '</strong></div>' +
                          '<div><label style="font-size:0.7rem;font-weight:700;">Ejecutado real:</label><input type="number" step="0.01" class="ms-sa-input ms-parte-exec-qty" value="' + esc(l.cantidadEjecutada) + '"></div>' +
                        '</div>'
                      );
                    })
                    .join('')) +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem;">' +
              '<div><label class="ms-sa-label">Observaciones de Ejecución</label><textarea class="ms-sa-input" rows="2" name="observaciones">' + esc(ed.observaciones || '') + '</textarea></div>' +
              '<div><label class="ms-sa-label">Incidencias / Hallazgos</label><textarea class="ms-sa-input" rows="2" name="incidencias">' + esc(ed.incidencias || '') + '</textarea></div>' +
            '</div>' +
            '<div style="border:1.5px dashed rgba(17,45,58,0.22);border-radius:12px;padding:0.85rem;">' +
              '<strong style="font-size:0.84rem;display:block;margin-bottom:0.5rem;">✍️ Conformidad del Cliente en Sitio</strong>' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.65rem;margin-bottom:0.65rem;">' +
                '<div><label class="ms-sa-label">Nombre de quien recibe el servicio</label><input class="ms-sa-input" name="nombreReceptor" value="' + esc((ed.conformidad && ed.conformidad.nombreReceptor) || '') + '" placeholder="Nombre y Apellido"></div>' +
                '<div><label class="ms-sa-label">Cargo / DNI Receptor</label><input class="ms-sa-input" name="cargoDniReceptor" value="' + esc((ed.conformidad && ed.conformidad.cargoDniReceptor) || '') + '"></div>' +
                '<div><label class="ms-sa-label">Observaciones de Conformidad</label><input class="ms-sa-input" name="obsConformidad" value="' + esc((ed.conformidad && ed.conformidad.observaciones) || '') + '"></div>' +
              '</div>' +
              '<div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem;"><span style="font-size:0.75rem;font-weight:700;">Firma digitalizada simple (dibujar con mouse o dedo en celular):</span><button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-parte-clear-sig" style="padding:0.2rem 0.55rem;font-size:0.72rem;">Limpiar trazo</button></div>' +
                '<canvas id="ms-parte-sig-canvas" width="460" height="120" style="width:100%;max-width:460px;height:120px;border:1px solid #94a3b8;border-radius:8px;background:#ffffff;touch-action:none;cursor:crosshair;"></canvas>' +
                '<div style="font-size:0.7rem;opacity:0.72;margin-top:0.25rem;">Nota: Constancia operativa de recepción mediante firma digitalizada simple (no equivale a firma digital criptográfica Ley 25.506).</div>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;">' +
              '<label style="display:inline-flex;align-items:center;gap:0.45rem;font-size:0.82rem;font-weight:700;cursor:pointer;"><input type="checkbox" name="marcarOtFinalizada" checked> Marcar Orden de Trabajo como Finalizada</label>' +
              '<div style="display:flex;gap:0.5rem;"><button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-srv-cancel-edit">Cancelar</button><button type="submit" class="ms-sa-btn">💾 Guardar Parte de Servicio</button></div>' +
            '</div>' +
          '</form>' +
        '</div>';
    }

    var list = db.partesServicio || [];
    return (
      '<div style="display:grid;gap:1rem;">' +
        formHtml +
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.85rem;">' +
            '<h4 style="margin:0;">📋 Partes de Servicio Registrados</h4>' +
            '<button type="button" class="ms-sa-btn" id="ms-srv-new-parte">➕ Nuevo Parte de Servicio</button>' +
          '</div>' +
          '<div style="overflow-x:auto;">' +
            '<table class="ms-sa-table" data-excel-table-key="srv-partes" style="width:100%;">' +
              '<thead><tr><th>Parte</th><th>OT / Cliente</th><th>Inicio — Fin</th><th>Horas</th><th>Conformidad</th><th>Facturación</th><th>Acciones</th></tr></thead>' +
              '<tbody>' +
                (list.length === 0
                  ? '<tr><td colspan="7" style="text-align:center;padding:1.4rem;opacity:0.7;">Todavía no se cargaron partes de servicio.</td></tr>'
                  : list
                      .map(function (p) {
                        var c = p.conformidad || {};
                        return (
                          '<tr>' +
                            '<td><strong>' + esc(p.numero) + '</strong></td>' +
                            '<td><strong>' + esc(p.otNumero) + '</strong><div style="font-size:0.74rem;opacity:0.78;">' + esc(p.clientNombre) + '</div></td>' +
                            '<td style="font-size:0.78rem;">' + esc(p.fechaInicio) + ' → ' + esc(p.fechaFin) + '</td>' +
                            '<td><strong>' + esc(p.horasTrabajadas) + ' hs</strong></td>' +
                            '<td>' + (c.conforme ? '✅ ' + esc(c.nombreReceptor || 'Conforme') : '<span style="opacity:0.65;">Sin conformidad</span>') + '</td>' +
                            '<td>' + estadoBadgeHtml(p.facturado ? 'facturada' : 'pendiente') + '</td>' +
                            '<td style="white-space:nowrap;">' +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-parte-pdf="' + esc(p.id) + '" style="padding:0.25rem 0.5rem;font-size:0.72rem;margin-right:0.25rem;">📄 Parte PDF</button>' +
                              (!p.facturado ? '<button type="button" class="ms-sa-btn" data-parte-bill="' + esc(p.id) + '" style="padding:0.25rem 0.5rem;font-size:0.72rem;">🧾 Facturar</button>' : '') +
                            '</td>' +
                          '</tr>'
                        );
                      })
                      .join('')) +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderDocumentosView() {
    var db = STATE.db;
    var docs = (db.documentos || []).filter(function (d) {
      if (STATE.docTypeFilter !== 'ALL' && d.tipo !== STATE.docTypeFilter) return false;
      if (STATE.docOtFilter !== 'ALL' && d.otId !== STATE.docOtFilter) return false;
      return true;
    });
    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="ms-sa-card">' +
          '<h4 style="margin:0 0 0.75rem;">📎 Adjuntar Documentación Técnica (Informes, Certificados, Protocolos, Fotos, PDF)</h4>' +
          '<form id="ms-srv-doc-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.7rem;">' +
            '<div><label class="ms-sa-label">Orden de Trabajo *</label><select class="ms-sa-select" name="otId" required>' +
              '<option value="">— Seleccionar OT —</option>' +
              (db.ordenesTrabajo || []).map(function (o) {
                return '<option value="' + esc(o.id) + '" ' + (STATE.docOtFilter === o.id ? 'selected' : '') + '>' + esc(o.numero + ' · ' + o.clientNombre) + '</option>';
              }).join('') +
            '</select></div>' +
            '<div><label class="ms-sa-label">Tipo Documental</label><select class="ms-sa-select" name="tipo">' +
              '<option value="informe_tecnico">Informe Técnico</option>' +
              '<option value="certificado">Certificado</option>' +
              '<option value="protocolo">Protocolo de Ensayo</option>' +
              '<option value="fotografia">Fotografía</option>' +
              '<option value="planilla">Planilla</option>' +
              '<option value="pdf">Documento PDF</option>' +
              '<option value="cliente">Documentación del Cliente</option>' +
            '</select></div>' +
            '<div><label class="ms-sa-label">Título del Documento *</label><input class="ms-sa-input" name="titulo" required placeholder="Ej: Informe UT Juntas J-01 a J-15"></div>' +
            '<div><label class="ms-sa-label">Archivo (PDF / Imagen / Planilla)</label><input class="ms-sa-input" type="file" id="ms-srv-doc-file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx"></div>' +
            '<div style="grid-column:1 / -1;display:flex;gap:0.65rem;align-items:flex-end;">' +
              '<div style="flex:1;"><label class="ms-sa-label">Notas / Referencia</label><input class="ms-sa-input" name="notas" placeholder="Norma aplicada, número de certificado, observaciones..."></div>' +
              '<button type="submit" class="ms-sa-btn">📤 Subir y Vincular Documento</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;margin-bottom:0.8rem;">' +
            '<h4 style="margin:0;">📂 Gestor Documental Técnico (' + docs.length + ')</h4>' +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
              '<select class="ms-sa-select" id="ms-doc-ot-filter" style="max-width:240px;"><option value="ALL">Todas las OTs</option>' +
                (db.ordenesTrabajo || []).map(function (o) {
                  return '<option value="' + esc(o.id) + '" ' + (STATE.docOtFilter === o.id ? 'selected' : '') + '>' + esc(o.numero + ' · ' + o.clientNombre) + '</option>';
                }).join('') +
              '</select>' +
              '<select class="ms-sa-select" id="ms-doc-type-filter" style="max-width:190px;"><option value="ALL">Todos los tipos</option><option value="informe_tecnico">Informes Técnicos</option><option value="certificado">Certificados</option><option value="protocolo">Protocolos</option><option value="fotografia">Fotografías</option><option value="planilla">Planillas</option><option value="pdf">PDFs</option><option value="cliente">Del Cliente</option></select>' +
            '</div>' +
          '</div>' +
          '<div style="overflow-x:auto;">' +
            '<table class="ms-sa-table" data-excel-table-key="srv-documentos" style="width:100%;">' +
              '<thead><tr><th>Fecha</th><th>OT / Cliente</th><th>Tipo</th><th>Título / Archivo</th><th>Subido por</th><th>Acciones</th></tr></thead>' +
              '<tbody>' +
                (docs.length === 0
                  ? '<tr><td colspan="6" style="text-align:center;padding:1.3rem;opacity:0.7;">Sin documentos adjuntos para este filtro.</td></tr>'
                  : docs
                      .map(function (d) {
                        return (
                          '<tr>' +
                            '<td>' + esc(d.fechaDocumento) + '</td>' +
                            '<td><strong>' + esc(d.otNumero) + '</strong><div style="font-size:0.72rem;opacity:0.75;">' + esc(d.clientNombre) + '</div></td>' +
                            '<td>' + esc(String(d.tipo || '').replace(/_/g, ' ').toUpperCase()) + '</td>' +
                            '<td><strong>' + esc(d.titulo) + '</strong><div style="font-size:0.72rem;opacity:0.75;">' + esc(d.nombreArchivo) + (d.notas ? ' · ' + esc(d.notas) : '') + '</div></td>' +
                            '<td style="font-size:0.76rem;">' + esc(d.uploadedBy) + '</td>' +
                            '<td style="white-space:nowrap;">' +
                              (d.dataUrl ? '<a href="' + d.dataUrl + '" download="' + esc(d.nombreArchivo) + '" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.25rem 0.5rem;font-size:0.72rem;text-decoration:none;margin-right:0.25rem;">⬇ Descargar</a>' : '') +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-doc-del="' + esc(d.id) + '" style="padding:0.25rem 0.45rem;font-size:0.72rem;border-color:#ef4444;color:#b91c1c;">🗑</button>' +
                            '</td>' +
                          '</tr>'
                        );
                      })
                      .join('')) +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderAgendaPersonalView() {
    var db = STATE.db;
    var agendaOts = (db.ordenesTrabajo || [])
      .filter(function (o) { return o.estado !== 'cancelada'; })
      .slice()
      .sort(function (a, b) { return String(a.fechaPrevista || '').localeCompare(String(b.fechaPrevista || '')); });
    var ed = STATE.editingPersonal;

    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div class="ms-sa-card">' +
          '<h4 style="margin:0 0 0.75rem;">📅 Agenda de Trabajos Programados y en Ejecución</h4>' +
          '<div style="overflow-x:auto;">' +
            '<table class="ms-sa-table" data-excel-table-key="srv-agenda" style="width:100%;">' +
              '<thead><tr><th>Fecha Prevista</th><th>OT</th><th>Cliente / Establecimiento</th><th>Personal Asignado</th><th>Horas Est.</th><th>Estado</th><th>Cambiar Estado</th></tr></thead>' +
              '<tbody>' +
                (agendaOts.length === 0
                  ? '<tr><td colspan="7" style="text-align:center;padding:1.2rem;opacity:0.7;">Sin trabajos agendados.</td></tr>'
                  : agendaOts
                      .map(function (o) {
                        return (
                          '<tr>' +
                            '<td><strong>' + esc(o.fechaPrevista || '—') + '</strong></td>' +
                            '<td><strong>' + esc(o.numero) + '</strong></td>' +
                            '<td>' + esc(o.clientNombre) + (o.lugarTrabajo ? '<div style="font-size:0.72rem;opacity:0.75;">📍 ' + esc(o.lugarTrabajo) + '</div>' : '') + '</td>' +
                            '<td>' + esc((o.personalAsignadoIds || []).map(getPersonalName).join(', ') || 'Sin asignar') + '</td>' +
                            '<td>' + esc(o.duracionEstimadaHoras || 0) + ' hs</td>' +
                            '<td>' + estadoBadgeHtml(o.estado) + '</td>' +
                            '<td><select class="ms-sa-select" data-agenda-status="' + esc(o.id) + '" style="padding:0.25rem 0.45rem;font-size:0.76rem;">' +
                              ['pendiente', 'programada', 'en_ejecucion', 'finalizada'].map(function (st) {
                                return '<option value="' + st + '" ' + (o.estado === st ? 'selected' : '') + '>' + st.toUpperCase() + '</option>';
                              }).join('') +
                            '</select></td>' +
                          '</tr>'
                        );
                      })
                      .join('')) +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +

        (ed
          ? '<div class="ms-sa-card" style="border:2px solid #56D7A1;">' +
              '<h4 style="margin:0 0 0.75rem;">' + (ed.id ? '✏️ Editar Perfil Técnico' : '➕ Registrar Técnico / Inspector / Prestador') + '</h4>' +
              '<form id="ms-srv-personal-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.7rem;">' +
                '<input type="hidden" name="id" value="' + esc(ed.id || '') + '">' +
                '<input type="hidden" name="linkedAsistenciaEmployeeId" value="' + esc(ed.linkedAsistenciaEmployeeId || '') + '">' +
                '<div><label class="ms-sa-label">Nombre Completo *</label><input class="ms-sa-input" name="nombre" required value="' + esc(ed.nombre || '') + '"></div>' +
                '<div><label class="ms-sa-label">DNI</label><input class="ms-sa-input" name="dni" value="' + esc(ed.dni || '') + '"></div>' +
                '<div><label class="ms-sa-label">Especialidad</label><input class="ms-sa-input" name="especialidad" value="' + esc(ed.especialidad || '') + '" placeholder="Ej: Inspector END UT/MT, Electricista..."></div>' +
                '<div><label class="ms-sa-label">Matrícula Profesional</label><input class="ms-sa-input" name="matricula" value="' + esc(ed.matricula || '') + '"></div>' +
                '<div><label class="ms-sa-label">Habilitaciones</label><input class="ms-sa-input" name="habilitaciones" value="' + esc(ed.habilitaciones || '') + '"></div>' +
                '<div><label class="ms-sa-label">Certificaciones</label><input class="ms-sa-input" name="certificaciones" value="' + esc(ed.certificaciones || '') + '"></div>' +
                '<div><label class="ms-sa-label">Costo / Hora ($)</label><input class="ms-sa-input" type="number" step="0.01" name="costoHora" value="' + esc(ed.costoHora || 0) + '"></div>' +
                '<div><label class="ms-sa-label">Teléfono / WhatsApp</label><input class="ms-sa-input" name="telefono" value="' + esc(ed.telefono || '') + '"></div>' +
                '<div style="grid-column:1 / -1;display:flex;justify-content:flex-end;gap:0.5rem;"><button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-srv-cancel-edit">Cancelar</button><button type="submit" class="ms-sa-btn">💾 Guardar Perfil</button></div>' +
              '</form>' +
            '</div>'
          : '') +

        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.8rem;">' +
            '<div><h4 style="margin:0;">👷 Personal Técnico / Prestadores (con Matrículas y Habilitaciones)</h4><div style="font-size:0.76rem;opacity:0.75;">Independiente de los usuarios de login del ERP. Podés importar empleados desde Administración de Personal.</div></div>' +
            '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
              (STATE.empleadosAsistencia.length > 0
                ? '<select class="ms-sa-select" id="ms-srv-import-emp-sel" style="max-width:240px;"><option value="">+ Importar desde Personal...</option>' +
                  STATE.empleadosAsistencia.map(function (e) {
                    return '<option value="' + esc(e.id) + '">' + esc(e.nombre + (e.puesto ? ' (' + e.puesto + ')' : '')) + '</option>';
                  }).join('') +
                  '</select>'
                : '') +
              '<button type="button" class="ms-sa-btn" id="ms-srv-new-personal">➕ Nuevo Técnico / Prestador</button>' +
            '</div>' +
          '</div>' +
          '<div style="overflow-x:auto;">' +
            '<table class="ms-sa-table" data-excel-table-key="srv-personal" style="width:100%;">' +
              '<thead><tr><th>Nombre</th><th>Especialidad</th><th>Matrícula / Habilitaciones</th><th>Costo/Hora</th><th>Contacto</th><th>Acciones</th></tr></thead>' +
              '<tbody>' +
                ((db.personal || []).length === 0
                  ? '<tr><td colspan="6" style="text-align:center;padding:1.2rem;opacity:0.7;">Sin personal técnico cargado todavía.</td></tr>'
                  : db.personal
                      .map(function (p) {
                        return (
                          '<tr>' +
                            '<td><strong>' + esc(p.nombre) + '</strong>' + (p.dni ? '<div style="font-size:0.72rem;opacity:0.75;">DNI ' + esc(p.dni) + '</div>' : '') + '</td>' +
                            '<td>' + esc(p.especialidad || '—') + '</td>' +
                            '<td><div>' + esc(p.matricula || '—') + '</div>' + (p.habilitaciones ? '<div style="font-size:0.72rem;opacity:0.75;">' + esc(p.habilitaciones) + '</div>' : '') + '</td>' +
                            '<td><strong>' + esc(fmtArs.format(p.costoHora || 0)) + '/h</strong></td>' +
                            '<td style="font-size:0.76rem;">' + esc(p.telefono || p.email || '—') + '</td>' +
                            '<td style="white-space:nowrap;">' +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-pers-edit="' + esc(p.id) + '" style="padding:0.25rem 0.45rem;font-size:0.72rem;margin-right:0.2rem;">✏️</button>' +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-pers-del="' + esc(p.id) + '" style="padding:0.25rem 0.45rem;font-size:0.72rem;border-color:#ef4444;color:#b91c1c;">🗑</button>' +
                            '</td>' +
                          '</tr>'
                        );
                      })
                      .join('')) +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderAbonosView() {
    var db = STATE.db;
    var ed = STATE.editingAbono;
    var per = STATE.abonoPeriod || todayIso().slice(0, 7);

    return (
      '<div style="display:grid;gap:1rem;">' +
        (ed
          ? '<div class="ms-sa-card" style="border:2px solid #56D7A1;">' +
              '<h4 style="margin:0 0 0.75rem;">' + (ed.id ? '✏️ Editar Abono ' + esc(ed.codigo) : '➕ Nuevo Abono / Contrato Recurrente') + '</h4>' +
              '<form id="ms-srv-abono-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0.7rem;">' +
                '<input type="hidden" name="id" value="' + esc(ed.id || '') + '">' +
                '<div><label class="ms-sa-label">Cliente *</label><select class="ms-sa-select" name="clientId" required>' + renderClientOptions(ed.clientId, '— Elegir —') + '</select></div>' +
                '<div><label class="ms-sa-label">Destinatario de Factura</label><select class="ms-sa-select" name="billingClientId">' + renderClientOptions(ed.billingClientId || ed.clientId, 'Mismo cliente') + '</select></div>' +
                '<div><label class="ms-sa-label">Servicio Asociado</label><select class="ms-sa-select" name="servicioId"><option value="">— Servicio manual —</option>' +
                  (db.catalogo || []).map(function (s) {
                    return '<option value="' + esc(s.id) + '" ' + (ed.servicioId === s.id ? 'selected' : '') + '>' + esc(s.codigo + ' · ' + s.nombre) + '</option>';
                  }).join('') +
                '</select></div>' +
                '<div><label class="ms-sa-label">Concepto / Nombre del Abono *</label><input class="ms-sa-input" name="servicioNombre" required value="' + esc(ed.servicioNombre || '') + '" placeholder="Ej: Abono Mantenimiento Mensual"></div>' +
                '<div><label class="ms-sa-label">Importe Neto</label><input class="ms-sa-input" type="number" step="0.01" name="importe" required value="' + esc(ed.importe != null ? ed.importe : 0) + '"></div>' +
                '<div><label class="ms-sa-label">IVA (%)</label><input class="ms-sa-input" type="number" step="0.5" name="ivaPct" value="' + esc(ed.ivaPct != null ? ed.ivaPct : 21) + '"></div>' +
                '<div><label class="ms-sa-label">Frecuencia</label><select class="ms-sa-select" name="frecuencia">' +
                  ['mensual', 'bimestral', 'trimestral', 'semestral', 'anual'].map(function (f) {
                    return '<option value="' + f + '" ' + (ed.frecuencia === f ? 'selected' : '') + '>' + f.toUpperCase() + '</option>';
                  }).join('') +
                '</select></div>' +
                '<div><label class="ms-sa-label">Próximo Vencimiento</label><input class="ms-sa-input" type="date" name="proximoVencimiento" value="' + esc(ed.proximoVencimiento || todayIso()) + '"></div>' +
                '<div><label class="ms-sa-label">Estado</label><select class="ms-sa-select" name="estado"><option value="activo" ' + (ed.estado === 'activo' ? 'selected' : '') + '>Activo</option><option value="pausado" ' + (ed.estado === 'pausado' ? 'selected' : '') + '>Pausado</option><option value="finalizado" ' + (ed.estado === 'finalizado' ? 'selected' : '') + '>Finalizado</option></select></div>' +
                '<div style="grid-column:1 / -1;"><label class="ms-sa-label">Condiciones de Actualización</label><input class="ms-sa-input" name="condicionesActualizacion" value="' + esc(ed.condicionesActualizacion || '') + '" placeholder="Ej: Actualización trimestral por IPC"></div>' +
                '<div style="grid-column:1 / -1;display:flex;justify-content:flex-end;gap:0.5rem;"><button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-srv-cancel-edit">Cancelar</button><button type="submit" class="ms-sa-btn">💾 Guardar Abono</button></div>' +
              '</form>' +
            '</div>'
          : '') +
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.85rem;">' +
            '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
              '<label class="ms-sa-label" style="margin:0;">Período:</label>' +
              '<input type="month" class="ms-sa-input" id="ms-abono-period-inp" value="' + esc(per) + '" style="width:165px;">' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-abono-gen-drafts">⚡ Generar Borradores ' + esc(per) + '</button>' +
            '</div>' +
            '<button type="button" class="ms-sa-btn" id="ms-srv-new-abono">➕ Nuevo Abono</button>' +
          '</div>' +
          '<div style="overflow-x:auto;">' +
            '<table class="ms-sa-table" data-excel-table-key="srv-abonos" style="width:100%;">' +
              '<thead><tr><th>Código</th><th>Cliente / Destinatario</th><th>Servicio / Actualización</th><th>Importe Neto</th><th>Frecuencia / Próx. Vto</th><th>Estado</th><th>Período ' + esc(per) + '</th><th>Acciones</th></tr></thead>' +
              '<tbody>' +
                ((db.abonos || []).length === 0
                  ? '<tr><td colspan="8" style="text-align:center;padding:1.3rem;opacity:0.7;">Sin abonos recurrentes registrados.</td></tr>'
                  : db.abonos
                      .map(function (a) {
                        var pInfo = a.periodosGenerados && a.periodosGenerados[per];
                        var isFact = pInfo && pInfo.status === 'facturado';
                        return (
                          '<tr>' +
                            '<td><strong>' + esc(a.codigo) + '</strong></td>' +
                            '<td><strong>' + esc(a.clientNombre) + '</strong>' + (a.billingClientId !== a.clientId ? '<div style="font-size:0.72rem;color:#0369a1;">Facturar a: ' + esc(a.billingClientNombre) + '</div>' : '') + '</td>' +
                            '<td>' + esc(a.servicioNombre) + (a.condicionesActualizacion ? '<div style="font-size:0.72rem;opacity:0.75;">' + esc(a.condicionesActualizacion) + '</div>' : '') + '</td>' +
                            '<td style="font-weight:800;">' + esc(fmtMoney(a.importe, a.moneda)) + ' <span style="font-size:0.7rem;">+' + esc(a.ivaPct) + '%</span></td>' +
                            '<td>' + esc(String(a.frecuencia || '').toUpperCase()) + '<div style="font-size:0.72rem;opacity:0.75;">Vto: ' + esc(a.proximoVencimiento) + '</div></td>' +
                            '<td>' + estadoBadgeHtml(a.estado) + '</td>' +
                            '<td>' + (pInfo ? estadoBadgeHtml(isFact ? 'facturada' : 'borrador') + (pInfo.numeroCompleto ? '<div style="font-size:0.68rem;">' + esc(pInfo.numeroCompleto) + '</div>' : '') : '<span style="opacity:0.6;font-size:0.76rem;">Sin generar</span>') + '</td>' +
                            '<td style="white-space:nowrap;">' +
                              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-abono-edit="' + esc(a.id) + '" style="padding:0.25rem 0.45rem;font-size:0.72rem;margin-right:0.2rem;">✏️</button>' +
                              (a.estado === 'activo' && !isFact
                                ? '<button type="button" class="ms-sa-btn" data-abono-bill="' + esc(a.id) + '" style="padding:0.25rem 0.55rem;font-size:0.72rem;">🧾 Facturar ' + esc(per) + '</button>'
                                : '') +
                            '</td>' +
                          '</tr>'
                        );
                      })
                      .join('')) +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderInformesView() {
    var inf = STATE.informes || {};
    return (
      '<div style="display:grid;gap:1rem;">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.75rem;">' +
          '<div class="ms-sa-card"><div style="font-size:0.72rem;font-weight:800;opacity:0.7;text-transform:uppercase;">Servicios Presupuestados</div><div style="font-size:1.3rem;font-weight:900;">' + esc(fmtArs.format(inf.montoPresupuestado || 0)) + '</div><div style="font-size:0.74rem;opacity:0.75;">Aprobados: ' + esc(fmtArs.format(inf.montoAprobado || 0)) + '</div></div>' +
          '<div class="ms-sa-card"><div style="font-size:0.72rem;font-weight:800;opacity:0.7;text-transform:uppercase;">Pendiente de Facturación</div><div style="font-size:1.3rem;font-weight:900;color:#b45309;">' + esc(fmtArs.format(inf.montoPendienteFacturar || 0)) + '</div><div style="font-size:0.74rem;opacity:0.75;">' + (inf.pendientesFacturarCount || 0) + ' OT(s) pendientes/parciales</div></div>' +
          '<div class="ms-sa-card"><div style="font-size:0.72rem;font-weight:800;opacity:0.7;text-transform:uppercase;">Facturación del Período (' + esc(inf.periodoActual || '') + ')</div><div style="font-size:1.3rem;font-weight:900;color:#065f46;">' + esc(fmtArs.format(inf.facturacionPeriodo || 0)) + '</div><div style="font-size:0.74rem;opacity:0.75;">Acumulado: ' + esc(fmtArs.format(inf.facturacionHistorica || 0)) + '</div></div>' +
          '<div class="ms-sa-card"><div style="font-size:0.72rem;font-weight:800;opacity:0.7;text-transform:uppercase;">Cobranzas Pendientes (Cta. Cte.)</div><div style="font-size:1.3rem;font-weight:900;color:#b91c1c;">' + esc(fmtArs.format(inf.cobranzasPendientesServicios || 0)) + '</div><div style="font-size:0.74rem;opacity:0.75;">' + (inf.cobranzasPendientesCount || 0) + ' comprobantes con saldo</div></div>' +
        '</div>' +

        '<div class="ms-sa-grid">' +
          '<div class="ms-sa-card"><h4 style="margin:0 0 0.65rem;">📊 Ventas por Tipo de Servicio</h4><table class="ms-sa-table" data-excel-table-key="srv-inf-servicios" style="width:100%;"><thead><tr><th>Código</th><th>Servicio</th><th>Cant.</th><th>Importe</th></tr></thead><tbody>' +
            ((inf.ventasPorServicio || []).length === 0
              ? '<tr><td colspan="4" style="text-align:center;opacity:0.7;padding:1rem;">Sin datos aún.</td></tr>'
              : inf.ventasPorServicio.map(function (r) {
                  return '<tr><td><code>' + esc(r.codigo) + '</code></td><td>' + esc(r.nombre) + '</td><td>' + esc(r.cantidad) + '</td><td style="font-weight:800;">' + esc(fmtArs.format(r.monto)) + '</td></tr>';
                }).join('')) +
          '</tbody></table></div>' +

          '<div class="ms-sa-card"><h4 style="margin:0 0 0.65rem;">🏢 Facturación por Cliente</h4><table class="ms-sa-table" data-excel-table-key="srv-inf-clientes" style="width:100%;"><thead><tr><th>Cliente</th><th>OTs</th><th>Facturado</th><th>Pendiente</th></tr></thead><tbody>' +
            ((inf.facturacionPorCliente || []).length === 0
              ? '<tr><td colspan="4" style="text-align:center;opacity:0.7;padding:1rem;">Sin datos aún.</td></tr>'
              : inf.facturacionPorCliente.map(function (r) {
                  return '<tr><td><strong>' + esc(r.nombre) + '</strong></td><td>' + esc(r.ots) + '</td><td style="font-weight:800;color:#065f46;">' + esc(fmtArs.format(r.montoFacturado)) + '</td><td style="color:#b45309;">' + esc(fmtArs.format(r.saldoPendiente)) + '</td></tr>';
                }).join('')) +
          '</tbody></table></div>' +
        '</div>' +

        '<div class="ms-sa-grid">' +
          '<div class="ms-sa-card"><h4 style="margin:0 0 0.65rem;">👷 Productividad por Técnico / Prestador</h4><table class="ms-sa-table" data-excel-table-key="srv-inf-tecnicos" style="width:100%;"><thead><tr><th>Técnico</th><th>OTs Asig.</th><th>Finalizadas</th><th>Partes</th><th>Horas</th></tr></thead><tbody>' +
            ((inf.productividadPorTecnico || []).length === 0
              ? '<tr><td colspan="5" style="text-align:center;opacity:0.7;padding:1rem;">Sin datos aún.</td></tr>'
              : inf.productividadPorTecnico.map(function (r) {
                  return '<tr><td><strong>' + esc(r.nombre) + '</strong><div style="font-size:0.71rem;opacity:0.75;">' + esc(r.especialidad) + '</div></td><td>' + esc(r.otsAsignadas) + '</td><td>' + esc(r.otsFinalizadas) + '</td><td>' + esc(r.partesRegistrados) + '</td><td><strong>' + esc(r.horasTrabajadas) + ' hs</strong></td></tr>';
                }).join('')) +
          '</tbody></table></div>' +

          '<div class="ms-sa-card"><h4 style="margin:0 0 0.65rem;">💹 Rentabilidad Estimada por Trabajo (OT)</h4><table class="ms-sa-table" data-excel-table-key="srv-inf-rentabilidad" style="width:100%;"><thead><tr><th>OT</th><th>Cliente</th><th>Ingreso</th><th>Costo Directo</th><th>Margen</th></tr></thead><tbody>' +
            ((inf.rentabilidadPorTrabajo || []).length === 0
              ? '<tr><td colspan="5" style="text-align:center;opacity:0.7;padding:1rem;">Sin datos aún.</td></tr>'
              : inf.rentabilidadPorTrabajo.map(function (r) {
                  return '<tr><td><strong>' + esc(r.numero) + '</strong></td><td>' + esc(r.clientNombre) + '</td><td>' + esc(fmtArs.format(r.ingresoBase)) + '</td><td>' + esc(fmtArs.format(r.costoDirecto)) + '</td><td style="font-weight:800;color:' + (r.margenMonto >= 0 ? '#065f46' : '#b91c1c') + ';">' + esc(fmtArs.format(r.margenMonto)) + ' (' + esc(r.margenPct) + '%)</td></tr>';
                }).join('')) +
          '</tbody></table></div>' +
        '</div>' +
      '</div>'
    );
  }

  function computeDirectInvoiceTotals(items) {
    var neto = 0;
    var iva = 0;
    var total = 0;
    (items || []).forEach(function (it) {
      var qty = Number(it.cantidad) || 0;
      var unit = Number(it.precioFinal) || 0;
      var disc = Number(it.descPct) || 0;
      var sub = Math.round(qty * unit * (1 - disc / 100) * 100) / 100;
      var ivaRate = Number(it.ivaPct != null ? it.ivaPct : 21) / 100;
      var subNeto = ivaRate > 0 ? Math.round((sub / (1 + ivaRate)) * 100) / 100 : sub;
      var subIva = Math.round((sub - subNeto) * 100) / 100;
      neto += subNeto;
      iva += subIva;
      total += sub;
    });
    return {
      neto: Math.round(neto * 100) / 100,
      iva: Math.round(iva * 100) / 100,
      total: Math.round(total * 100) / 100
    };
  }

  function renderFacturarDirectoView() {
    var db = STATE.db;
    if (!STATE.directInvoice) STATE.directInvoice = buildEmptyDirectInvoice();
    var inv = STATE.directInvoice;
    var cli = (STATE.clientes || []).find(function (c) { return Number(c.id) === Number(inv.billingClientId); });
    var totals = computeDirectInvoiceTotals(inv.items);

    var pendingOts = (db.ordenesTrabajo || []).filter(function (o) {
      return o.estado !== 'cancelada' && o.estadoFacturacion !== 'facturada';
    });
    var readyPres = (db.presupuestos || []).filter(function (p) {
      return p.estado === 'aprobado' || p.estado === 'enviado' || p.estado === 'borrador';
    });
    var partesList = db.partesServicio || [];
    var abonosList = (db.abonos || []).filter(function (a) { return a.estado === 'activo'; });

    var successBanner = STATE.lastEmittedInvoice
      ? '<div class="ms-sa-card" style="border:2px solid #56D7A1;background:rgba(86,215,161,0.12);margin-bottom:0.85rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">' +
          '<div>' +
            '<div style="font-size:0.74rem;font-weight:900;color:#065f46;">✅ COMPROBANTE EMITIDO SIN APERTURA DE CAJA</div>' +
            '<div style="font-size:1.05rem;font-weight:900;">' + esc(STATE.lastEmittedInvoice.tipoBase) + ' ' + esc(STATE.lastEmittedInvoice.letra) + ' N° ' + esc(STATE.lastEmittedInvoice.numeroCompleto) + ' · ' + esc(fmtArs.format(STATE.lastEmittedInvoice.importe || 0)) + '</div>' +
            '<div style="font-size:0.78rem;opacity:0.85;">Cliente: <strong>' + esc(STATE.lastEmittedInvoice.billingClientNombre) + '</strong>' + (STATE.lastEmittedInvoice.cae ? ' · CAE ARCA: <strong>' + esc(STATE.lastEmittedInvoice.cae) + '</strong>' : '') + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;">' +
            '<button type="button" class="ms-sa-btn" id="ms-df-print-last">🖨️ Imprimir / PDF A4</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-df-go-emitidos">📋 Ver Comprobantes Emitidos</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-df-new-blank">➕ Nuevo Comprobante</button>' +
          '</div>' +
        '</div>'
      : '';

    var linesHtml = (inv.items || []).length === 0
      ? '<tr><td colspan="8" style="text-align:center;padding:1.25rem;opacity:0.75;">Traé una <strong>Orden de Trabajo</strong>, <strong>Presupuesto</strong>, <strong>Parte</strong> o <strong>Abono</strong> arriba en 1 clic, o presioná <strong>+ Agregar Servicio</strong>.</td></tr>'
      : inv.items
          .map(function (it, idx) {
            var sub = Math.round((Number(it.cantidad) || 0) * (Number(it.precioFinal) || 0) * (1 - (Number(it.descPct) || 0) / 100) * 100) / 100;
            return (
              '<tr class="ms-df-row" data-idx="' + idx + '">' +
                '<td><input class="ms-sa-input ms-df-cod" value="' + esc(it.codigo || 'SRV') + '" style="min-width:74px;"></td>' +
                '<td><input class="ms-sa-input ms-df-nom" value="' + esc(it.nombre) + '" placeholder="Descripción del servicio" style="min-width:220px;"></td>' +
                '<td><input class="ms-sa-input ms-df-uni" value="' + esc(it.unidadMedida || 'Unidad') + '" style="width:96px;"></td>' +
                '<td><input type="number" step="0.01" class="ms-sa-input ms-df-qty" value="' + esc(it.cantidad) + '" style="width:76px;"></td>' +
                '<td><input type="number" step="0.01" class="ms-sa-input ms-df-price" value="' + esc(it.precioFinal) + '" style="width:118px;"></td>' +
                '<td><input type="number" step="0.01" class="ms-sa-input ms-df-iva" value="' + esc(it.ivaPct != null ? it.ivaPct : 21) + '" style="width:68px;"></td>' +
                '<td style="text-align:right;font-weight:800;white-space:nowrap;">' + esc(fmtArs.format(sub)) + '</td>' +
                '<td><button type="button" class="ms-sa-btn ms-sa-btn--outline" data-df-del-line="' + idx + '" style="padding:0.25rem 0.5rem;">✕</button></td>' +
              '</tr>'
            );
          })
          .join('');

    return (
      '<div style="display:grid;gap:1rem;">' +
        successBanner +
        '<div class="ms-sa-card">' +
          '<h4 style="margin:0 0 0.65rem;">📥 Traer Servicios desde Gestión de Servicios (Sin Apertura ni Cierre de Caja)</h4>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0.65rem;">' +
            '<div style="display:grid;gap:0.35rem;">' +
              '<label class="ms-sa-label">Orden de Trabajo Pendiente</label>' +
              '<select class="ms-sa-select" id="ms-df-pick-ot"><option value="">— Elegir OT (' + pendingOts.length + ') —</option>' +
                pendingOts.map(function (o) {
                  return '<option value="' + esc(o.id) + '">' + esc(o.numero) + ' · ' + esc(o.clientNombre) + ' (' + esc(fmtArs.format(o.saldoPendienteFacturar || o.totalPrevisto || 0)) + ')</option>';
                }).join('') +
              '</select>' +
              '<div style="display:flex;gap:0.35rem;">' +
                '<button type="button" class="ms-sa-btn" id="ms-df-load-ot-full" style="padding:0.34rem 0.65rem;font-size:0.76rem;flex:1;">📥 Traer OT</button>' +
                '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-df-load-ot-pct" style="padding:0.34rem 0.65rem;font-size:0.76rem;">% Parcial</button>' +
              '</div>' +
            '</div>' +
            '<div style="display:grid;gap:0.35rem;">' +
              '<label class="ms-sa-label">Presupuesto</label>' +
              '<select class="ms-sa-select" id="ms-df-pick-pres"><option value="">— Elegir Presupuesto (' + readyPres.length + ') —</option>' +
                readyPres.map(function (p) {
                  return '<option value="' + esc(p.id) + '">' + esc(p.numero) + ' · ' + esc(p.clientNombre) + ' (' + esc(fmtMoney(p.total, p.moneda)) + ')</option>';
                }).join('') +
              '</select>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-df-load-pres" style="padding:0.34rem 0.65rem;font-size:0.76rem;">📥 Traer Presupuesto</button>' +
            '</div>' +
            '<div style="display:grid;gap:0.35rem;">' +
              '<label class="ms-sa-label">Parte de Servicio Ejecutado</label>' +
              '<select class="ms-sa-select" id="ms-df-pick-parte"><option value="">— Elegir Parte (' + partesList.length + ') —</option>' +
                partesList.map(function (p) {
                  return '<option value="' + esc(p.id) + '">' + esc(p.numero) + ' (' + esc(p.otNumero) + ') · ' + esc(p.clientNombre) + '</option>';
                }).join('') +
              '</select>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-df-load-parte" style="padding:0.34rem 0.65rem;font-size:0.76rem;">📥 Traer Parte</button>' +
            '</div>' +
            '<div style="display:grid;gap:0.35rem;">' +
              '<label class="ms-sa-label">Abono Recurrente (' + esc(STATE.abonoPeriod) + ')</label>' +
              '<select class="ms-sa-select" id="ms-df-pick-abono"><option value="">— Elegir Abono (' + abonosList.length + ') —</option>' +
                abonosList.map(function (a) {
                  return '<option value="' + esc(a.id) + '">' + esc(a.codigo) + ' · ' + esc(a.clientNombre) + ' (' + esc(fmtArs.format(a.importe)) + ')</option>';
                }).join('') +
              '</select>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-df-load-abono" style="padding:0.34rem 0.65rem;font-size:0.76rem;">📥 Traer Abono</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<form id="ms-df-form" class="ms-sa-card" style="display:grid;gap:0.9rem;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">' +
            '<h4 style="margin:0;">🧾 Datos del Comprobante de Servicios</h4>' +
            '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">' +
              '<select class="ms-sa-select" id="ms-df-cat-picker" style="width:auto;min-width:210px;font-size:0.8rem;"><option value="">+ Agregar desde Catálogo de Servicios...</option>' +
                (db.catalogo || []).filter(function (s) { return s.activo !== false; }).map(function (s) {
                  return '<option value="' + esc(s.id) + '">' + esc(s.codigo) + ' — ' + esc(s.nombre) + ' (' + esc(fmtMoney(s.precioBase, s.moneda)) + ')</option>';
                }).join('') +
              '</select>' +
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-df-add-blank-line" style="padding:0.35rem 0.7rem;font-size:0.78rem;">+ Ítem Manual</button>' +
            '</div>' +
          '</div>' +

          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.65rem;">' +
            '<div style="grid-column:span 2;"><label class="ms-sa-label">Cliente Destinatario de Factura</label><select class="ms-sa-select" name="billingClientId" id="ms-df-client">' + renderClientOptions(inv.billingClientId) + '</select>' +
              (cli ? '<div style="font-size:0.73rem;opacity:0.78;margin-top:0.2rem;">CUIT/DNI: <strong>' + esc(cli.nroDoc || 'S/D') + '</strong> · IVA: <strong>' + esc(cli.respIva || '—') + '</strong> · Saldo Cta. Cte.: <strong>' + esc(fmtArs.format(cli.saldoActual || 0)) + '</strong></div>' : '') +
            '</div>' +
            '<div><label class="ms-sa-label">Tipo Comprobante</label><select class="ms-sa-select" name="tipoBase">' +
              ['Factura', 'Nota de Crédito', 'Nota de Débito', 'Comprobante Interno'].map(function (t) {
                return '<option value="' + t + '"' + (inv.tipoBase === t ? ' selected' : '') + '>' + t + '</option>';
              }).join('') +
            '</select></div>' +
            '<div><label class="ms-sa-label">Letra</label><select class="ms-sa-select" name="letra" id="ms-df-letra">' +
              ['A', 'B', 'C', 'X'].map(function (l) {
                return '<option value="' + l + '"' + (inv.letra === l ? ' selected' : '') + '>' + l + (l === 'X' ? ' (Interno)' : '') + '</option>';
              }).join('') +
            '</select></div>' +
            '<div><label class="ms-sa-label">Punto de Venta</label><input class="ms-sa-input" name="pv" value="' + esc(inv.pv || '0004') + '" maxlength="4"></div>' +
            '<div><label class="ms-sa-label">Fecha</label><input type="date" class="ms-sa-input" name="fechaIso" value="' + esc(inv.fechaIso || todayIso()) + '"></div>' +
            '<div><label class="ms-sa-label">Condición / Medio de Pago</label><select class="ms-sa-select" name="medioPago">' +
              ['CUENTA CORRIENTE', 'TRANSFERENCIA BANCARIA', 'EFECTIVO', 'CHEQUE / ECHEQ', 'MERCADO PAGO'].map(function (mp) {
                return '<option value="' + mp + '"' + (inv.medioPago === mp ? ' selected' : '') + '>' + mp + '</option>';
              }).join('') +
            '</select></div>' +
            '<div style="grid-column:span 2;"><label class="ms-sa-label">Referencia / Orden de Compra / Observaciones</label><input class="ms-sa-input" name="observacion" value="' + esc(inv.observacion || '') + '" placeholder="Ej: OT-0001 · OC Cliente #450012"></div>' +
          '</div>' +

          '<div style="overflow-x:auto;"><table class="ms-sa-table" data-excel-table-key="srv-direct-invoice" style="width:100%;"><thead><tr><th>Cód.</th><th>Concepto / Servicio</th><th>Unidad</th><th>Cant.</th><th>Precio Unit. (c/IVA)</th><th>IVA %</th><th style="text-align:right;">Subtotal</th><th></th></tr></thead><tbody>' + linesHtml + '</tbody></table></div>' +

          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;padding:0.85rem;border-radius:10px;background:rgba(17,45,58,0.04);border:1px solid rgba(17,45,58,0.12);">' +
            '<label style="display:flex;align-items:center;gap:0.45rem;font-size:0.84rem;font-weight:700;cursor:pointer;">' +
              '<input type="checkbox" name="autorizarArca" id="ms-df-arca-chk"' + (inv.autorizarArca && inv.letra !== 'X' ? ' checked' : '') + '> 🏛️ Solicitar autorización electrónica ARCA (WSFEv1 / CAE) al emitir' +
            '</label>' +
            '<div style="display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap;">' +
              '<div style="font-size:0.82rem;">Neto: <strong id="ms-df-tot-neto">' + esc(fmtArs.format(totals.neto)) + '</strong> · IVA: <strong id="ms-df-tot-iva">' + esc(fmtArs.format(totals.iva)) + '</strong></div>' +
              '<div style="font-size:1.3rem;font-weight:900;">TOTAL: <span id="ms-df-tot-final">' + esc(fmtArs.format(totals.total)) + '</span></div>' +
            '</div>' +
          '</div>' +

          '<div style="display:flex;justify-content:flex-end;gap:0.55rem;flex-wrap:wrap;">' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-df-clear">Limpiar</button>' +
            '<button type="submit" class="ms-sa-btn" id="ms-df-emit-btn" style="padding:0.65rem 1.35rem;font-size:0.92rem;">🧾 Emitir Comprobante de Servicios</button>' +
          '</div>' +
        '</form>' +
      '</div>'
    );
  }

  function renderCobranzaDirectaView() {
    var db = STATE.db;
    if (!STATE.directCobranza) STATE.directCobranza = buildEmptyDirectCobranza();
    var cob = STATE.directCobranza;
    var cli = (STATE.clientes || []).find(function (c) { return Number(c.id) === Number(cob.clientId); });
    var cliFacts = (db.facturasVinculadas || []).filter(function (f) {
      return Number(f.billingClientId) === Number(cob.clientId) && !f.esNotaCredito;
    });

    var recBanner = STATE.lastEmittedRecibo
      ? '<div class="ms-sa-card" style="border:2px solid #56D7A1;background:rgba(86,215,161,0.12);margin-bottom:0.85rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">' +
          '<div>' +
            '<div style="font-size:0.74rem;font-weight:900;color:#065f46;">✅ COBRANZA REGISTRADA EN CUENTA CORRIENTE</div>' +
            '<div style="font-size:1.05rem;font-weight:900;">Recibo ' + esc(STATE.lastEmittedRecibo.numero) + ' · Acreditado: ' + esc(fmtArs.format(STATE.lastEmittedRecibo.totalAcreditado || 0)) + '</div>' +
            '<div style="font-size:0.78rem;opacity:0.85;">Cliente: <strong>' + esc(STATE.lastEmittedRecibo.clientNombre) + '</strong> · Saldo restante: <strong>' + esc(fmtArs.format(STATE.lastEmittedRecibo.saldoPosterior || 0)) + '</strong></div>' +
          '</div>' +
          '<div style="display:flex;gap:0.45rem;flex-wrap:wrap;">' +
            '<button type="button" class="ms-sa-btn" id="ms-dc-print-last">🖨️ Imprimir Recibo PDF</button>' +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-dc-open-ctacte">📒 Ver Cuenta Corriente</button>' +
          '</div>' +
        '</div>'
      : '';

    return (
      '<div style="display:grid;gap:1rem;">' +
        recBanner +
        '<div class="ms-sa-grid">' +
          '<form id="ms-dc-form" class="ms-sa-card" style="display:grid;gap:0.75rem;">' +
            '<h4 style="margin:0;">💵 Registrar Cobranza / Recibo de Servicios</h4>' +
            '<div><label class="ms-sa-label">Cliente</label><select class="ms-sa-select" name="clientId" id="ms-dc-client">' + renderClientOptions(cob.clientId) + '</select>' +
              (cli ? '<div style="font-size:0.8rem;margin-top:0.28rem;">Saldo Actual en Cuenta Corriente: <strong style="color:' + (Number(cli.saldoActual || 0) > 0 ? '#b91c1c' : '#065f46') + ';">' + esc(fmtArs.format(cli.saldoActual || 0)) + '</strong></div>' : '') +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.65rem;">' +
              '<div><label class="ms-sa-label">Fecha de Cobro</label><input type="date" class="ms-sa-input" name="fechaIso" value="' + esc(cob.fechaIso || todayIso()) + '"></div>' +
              '<div><label class="ms-sa-label">Medio de Cobro</label><select class="ms-sa-select" name="medioPago">' +
                ['TRANSFERENCIA BANCARIA', 'EFECTIVO', 'CHEQUE / ECHEQ', 'MERCADO PAGO', 'COMPENSACIÓN'].map(function (m) {
                  return '<option value="' + m + '"' + (cob.medioPago === m ? ' selected' : '') + '>' + m + '</option>';
                }).join('') +
              '</select></div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.65rem;">' +
              '<div><label class="ms-sa-label">Importe Cobrado ($)</label><input type="number" step="0.01" min="0" class="ms-sa-input" name="importeCobrado" id="ms-dc-imp" value="' + esc(cob.importeCobrado || 0) + '" required></div>' +
              '<div><label class="ms-sa-label">N° Referencia / Comprobante Bancario</label><input class="ms-sa-input" name="referencia" value="' + esc(cob.referencia || '') + '" placeholder="Ej: Transf. #892140"></div>' +
            '</div>' +
            '<div style="padding:0.75rem;border-radius:10px;background:rgba(17,45,58,0.04);border:1px solid rgba(17,45,58,0.12);display:grid;gap:0.55rem;">' +
              '<strong style="font-size:0.8rem;">🏛️ Retenciones Impositivas Sufridas (Opcional)</strong>' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.55rem;">' +
                '<div><label class="ms-sa-label">Tipo</label><select class="ms-sa-select" name="retencionTipo">' +
                  ['', 'IIBB', 'Ganancias', 'SUSS', 'IVA'].map(function (r) {
                    return '<option value="' + r + '"' + (cob.retencionTipo === r ? ' selected' : '') + '>' + (r || 'Sin retención') + '</option>';
                  }).join('') +
                '</select></div>' +
                '<div><label class="ms-sa-label">Importe Retenido ($)</label><input type="number" step="0.01" min="0" class="ms-sa-input" name="retencionImporte" value="' + esc(cob.retencionImporte || 0) + '"></div>' +
                '<div><label class="ms-sa-label">N° Certificado</label><input class="ms-sa-input" name="retencionCertificado" value="' + esc(cob.retencionCertificado || '') + '" placeholder="Cert. retención"></div>' +
              '</div>' +
              '<div><label class="ms-sa-label">Vincular a Factura de Servicios (opcional)</label><select class="ms-sa-select" name="facturaId"><option value="">— Sin vincular a factura puntual —</option>' +
                cliFacts.map(function (f) {
                  return '<option value="' + esc(f.id) + '"' + (cob.facturaId === f.id ? ' selected' : '') + '>' + esc(f.tipoBase) + ' ' + esc(f.letra) + ' ' + esc(f.numeroCompleto) + ' (' + esc(fmtArs.format(f.montoFacturado)) + ')</option>';
                }).join('') +
              '</select></div>' +
            '</div>' +
            '<div><label class="ms-sa-label">Observaciones</label><input class="ms-sa-input" name="observaciones" value="' + esc(cob.observaciones || '') + '" placeholder="Ej: Cancelación parcial / total factura servicios"></div>' +
            '<div style="display:flex;justify-content:flex-end;gap:0.5rem;">' +
              '<button type="submit" class="ms-sa-btn" id="ms-dc-submit-btn">💵 Emitir Recibo y Acreditar Cta. Cte.</button>' +
            '</div>' +
          '</form>' +

          '<div class="ms-sa-card">' +
            '<h4 style="margin:0 0 0.65rem;">🧾 Facturas de Servicios del Cliente</h4>' +
            '<table class="ms-sa-table" data-excel-table-key="srv-cob-facts" style="width:100%;"><thead><tr><th>Fecha</th><th>Comprobante</th><th>Monto</th><th>Acción</th></tr></thead><tbody>' +
              (cliFacts.length === 0
                ? '<tr><td colspan="4" style="text-align:center;opacity:0.7;padding:1rem;">Sin facturas de servicios registradas para este cliente.</td></tr>'
                : cliFacts.slice(0, 20).map(function (f) {
                    return (
                      '<tr>' +
                        '<td>' + esc(f.fechaIso) + '</td>' +
                        '<td><strong>' + esc(f.tipoBase) + ' ' + esc(f.letra) + ' ' + esc(f.numeroCompleto) + '</strong></td>' +
                        '<td><strong>' + esc(fmtArs.format(f.montoFacturado)) + '</strong></td>' +
                        '<td><button type="button" class="ms-sa-btn ms-sa-btn--outline" data-dc-pick-fact="' + esc(f.id) + '" data-dc-pick-amt="' + esc(f.montoFacturado) + '" style="padding:0.24rem 0.55rem;font-size:0.74rem;">Usar Monto</button></td>' +
                      '</tr>'
                    );
                  }).join('')) +
            '</tbody></table>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderWorkspace() {
    var bodyEl = document.getElementById('ms-srv-body');
    if (!bodyEl || !STATE.db) return;

    var html = '';
    if (STATE.view === 'panel') html = renderPanelView();
    else if (STATE.view === 'catalogo') html = renderCatalogoView();
    else if (STATE.view === 'presupuestos') html = renderPresupuestosView();
    else if (STATE.view === 'ordenes') html = renderOrdenesView();
    else if (STATE.view === 'partes') html = renderPartesView();
    else if (STATE.view === 'documentos') html = renderDocumentosView();
    else if (STATE.view === 'agenda') html = renderAgendaPersonalView();
    else if (STATE.view === 'abonos') html = renderAbonosView();
    else if (STATE.view === 'informes') html = renderInformesView();
    else if (STATE.view === 'facturar_directo') html = renderFacturarDirectoView();
    else if (STATE.view === 'cobranza_directa') html = renderCobranzaDirectaView();

    bodyEl.innerHTML = html;
    bindWorkspaceEvents(bodyEl);
  }

  // =========================================================================
  // EVENTOS DEL WORKSPACE
  // =========================================================================
  function bindSignaturePad(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#112D3A';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    var drawing = false;
    var getPos = function (e) {
      var r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * canvas.width,
        y: ((e.clientY - r.top) / r.height) * canvas.height
      };
    };
    canvas.addEventListener('pointerdown', function (e) {
      drawing = true;
      canvas.dataset.hasStroke = '1';
      var p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    var end = function () { drawing = false; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  function bindWorkspaceEvents(bodyEl) {
    var searchInp = bodyEl.querySelector('#ms-srv-search');
    if (searchInp) {
      searchInp.addEventListener('input', function () {
        var pos = searchInp.selectionStart || 0;
        STATE.search = searchInp.value;
        renderWorkspace();
        var next = document.getElementById('ms-srv-search');
        if (next) {
          next.focus();
          try { next.setSelectionRange(pos, pos); } catch (_e) {}
        }
      });
    }

    var stSel = bodyEl.querySelector('#ms-srv-status-filter');
    if (stSel) {
      stSel.addEventListener('change', function () {
        STATE.statusFilter = stSel.value;
        renderWorkspace();
      });
    }

    var cancelBtn = bodyEl.querySelector('#ms-srv-cancel-edit');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        STATE.editingService = null;
        STATE.editingPresupuesto = null;
        STATE.editingOt = null;
        STATE.editingParte = null;
        STATE.editingPersonal = null;
        STATE.editingAbono = null;
        renderWorkspace();
      });
    }

    // --- PANEL ---
    var demoBtn = bodyEl.querySelector('#ms-srv-load-demo-end');
    if (demoBtn) {
      demoBtn.addEventListener('click', async function () {
        demoBtn.disabled = true;
        var res = await apiServicios('POST', { action: 'load_demo_end_comodoro' });
        if (res && res.ok) {
          showToast(res.message || 'Escenario END cargado.', false);
          await reloadData(true);
        } else {
          showToast((res && res.message) || 'Error al cargar escenario.', true);
          demoBtn.disabled = false;
        }
      });
    }

    var cfgForm = bodyEl.querySelector('#ms-srv-config-form');
    if (cfgForm) {
      cfgForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(cfgForm);
        var res = await apiServicios('POST', {
          action: 'save_config',
          config: {
            actividadNegocio: fd.get('actividadNegocio'),
            monedaDefault: fd.get('monedaDefault'),
            ivaDefaultPct: Number(fd.get('ivaDefaultPct') || 21),
            validezPresupuestoDias: Number(fd.get('validezPresupuestoDias') || 15),
            unidadesPersonalizadas: String(fd.get('unidadesPersonalizadas') || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean),
            condicionesComercialesDefault: String(fd.get('condicionesComercialesDefault') || ''),
            requiereAprobacionAdminFacturacion: Boolean(cfgForm.querySelector('[name="requiereAprobacionAdminFacturacion"]').checked)
          }
        });
        if (res && res.ok) {
          showToast(res.message || 'Configuración guardada.', false);
          await reloadData(true);
        } else {
          showToast((res && res.message) || 'No se pudo guardar.', true);
        }
      });
    }

    var profCliSel = bodyEl.querySelector('#ms-srv-prof-client-sel');
    if (profCliSel) {
      profCliSel.addEventListener('change', function () {
        STATE.selectedProfileClientId = profCliSel.value;
        renderWorkspace();
      });
    }
    var editNativeCliBtn = bodyEl.querySelector('#ms-srv-edit-native-client');
    if (editNativeCliBtn) {
      editNativeCliBtn.addEventListener('click', function () {
        var cid = Number(STATE.selectedProfileClientId || (STATE.clientes[0] && STATE.clientes[0].id) || 0) || null;
        if (typeof window.__MS_OPEN_CLIENT_MODAL__ === 'function') window.__MS_OPEN_CLIENT_MODAL__(cid);
      });
    }
    var profForm = bodyEl.querySelector('#ms-srv-client-profile-form');
    if (profForm) {
      profForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(profForm);
        var res = await apiServicios('POST', {
          action: 'save_client_profile',
          profile: {
            clientId: Number(fd.get('clientId')),
            contactoTecnicoNombre: fd.get('contactoTecnicoNombre'),
            contactoTecnicoTel: fd.get('contactoTecnicoTel'),
            contactoAdminNombre: fd.get('contactoAdminNombre'),
            contactoAdminEmail: fd.get('contactoAdminEmail'),
            codigoInternoCliente: fd.get('codigoInternoCliente'),
            ordenesCompraRef: fd.get('ordenesCompraRef'),
            plazoPagoDias: Number(fd.get('plazoPagoDias') || 30),
            defaultBillingClientId: Number(fd.get('defaultBillingClientId') || 0) || null,
            condicionesContratacion: fd.get('condicionesContratacion')
          }
        });
        if (res && res.ok) {
          showToast(res.message || 'Perfil guardado.', false);
          await reloadData(true);
        }
      });
    }

    bodyEl.querySelectorAll('[data-srv-retencion]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var fid = btn.getAttribute('data-srv-retencion');
        var tipo = window.prompt('Tipo de retención (Ganancias, IIBB, SUSS, IVA) — dejar vacío solo para marcar Aprobación Administrativa:', 'IIBB');
        if (tipo === null) return;
        var payload = { action: 'update_invoice_admin_retencion', facturaId: fid, aprobacionAdminEstado: 'aprobada' };
        if (tipo.trim()) {
          var imp = Number(window.prompt('Importe retenido ($):', '0') || 0);
          var cert = window.prompt('N° de Certificado de Retención:', '') || '';
          if (imp > 0) payload.retencion = { tipo: tipo.trim(), importe: imp, certificado: cert, fecha: todayIso() };
        }
        var res = await apiServicios('POST', payload);
        if (res && res.ok) {
          showToast(res.message || 'Actualizado.', false);
          await reloadData(true);
        }
      });
    });

    // --- CATÁLOGO ---
    var newSrvBtn = bodyEl.querySelector('#ms-srv-new-service');
    if (newSrvBtn) {
      newSrvBtn.addEventListener('click', function () {
        STATE.editingService = { moneda: STATE.db.config.monedaDefault || 'ARS', ivaPct: STATE.db.config.ivaDefaultPct || 21, unidadMedida: 'Unidad', activo: true };
        renderWorkspace();
      });
    }
    bodyEl.querySelectorAll('[data-srv-edit-cat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-srv-edit-cat');
        STATE.editingService = (STATE.db.catalogo || []).find(function (x) { return x.id === id; }) || null;
        renderWorkspace();
      });
    });
    bodyEl.querySelectorAll('[data-srv-del-cat]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar este servicio del catálogo?')) return;
        var res = await apiServicios('POST', { action: 'delete_service', id: btn.getAttribute('data-srv-del-cat') });
        if (res && res.ok) { showToast(res.message, false); await reloadData(true); }
      });
    });
    var srvForm = bodyEl.querySelector('#ms-srv-service-form');
    if (srvForm) {
      srvForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(srvForm);
        var res = await apiServicios('POST', {
          action: 'save_service',
          service: {
            id: fd.get('id') || undefined,
            codigo: fd.get('codigo'),
            nombre: fd.get('nombre'),
            categoria: fd.get('categoria'),
            unidadMedida: fd.get('unidadMedida'),
            precioBase: Number(fd.get('precioBase') || 0),
            costoEstimado: Number(fd.get('costoEstimado') || 0),
            moneda: fd.get('moneda'),
            ivaPct: Number(fd.get('ivaPct') || 21),
            duracionEstimadaMin: Number(fd.get('duracionEstimadaMin') || 60),
            activo: fd.get('activo') === '1',
            descripcion: fd.get('descripcion'),
            observaciones: fd.get('observaciones')
          }
        });
        if (res && res.ok) {
          STATE.editingService = null;
          showToast(res.message, false);
          await reloadData(true);
        } else {
          showToast((res && res.message) || 'Error al guardar servicio.', true);
        }
      });
    }

    // --- PRESUPUESTOS ---
    var newPresBtn = bodyEl.querySelector('#ms-srv-new-pres');
    if (newPresBtn) {
      newPresBtn.addEventListener('click', function () {
        STATE.editingPresupuesto = {
          fecha: todayIso(),
          vigenteHasta: new Date(Date.now() + (STATE.db.config.validezPresupuestoDias || 15) * 86400000).toISOString().slice(0, 10),
          moneda: STATE.db.config.monedaDefault || 'ARS',
          items: [{ servicioId: '', codigo: 'SRV', nombre: '', unidadMedida: 'Unidad', cantidad: 1, precioUnitario: 0, descuentoPct: 0, ivaPct: STATE.db.config.ivaDefaultPct || 21 }],
          gastosAdicionales: []
        };
        renderWorkspace();
      });
    }
    var presForm = bodyEl.querySelector('#ms-srv-pres-form');
    if (presForm) {
      var readPresDraftFromDom = function () {
        var fd = new FormData(presForm);
        var ed = STATE.editingPresupuesto;
        ed.clientId = Number(fd.get('clientId') || 0);
        ed.billingClientId = Number(fd.get('billingClientId') || ed.clientId || 0);
        ed.establecimientoNombre = String(fd.get('establecimientoNombre') || '');
        ed.establecimientoDireccion = String(fd.get('establecimientoDireccion') || '');
        ed.fecha = String(fd.get('fecha') || todayIso());
        ed.vigenteHasta = String(fd.get('vigenteHasta') || todayIso());
        ed.moneda = String(fd.get('moneda') || 'ARS');
        ed.descuentoGlobalPct = Number(fd.get('descuentoGlobalPct') || 0);
        ed.condicionesComerciales = String(fd.get('condicionesComerciales') || '');
        ed.observaciones = String(fd.get('observaciones') || '');
        ed.items = [];
        presForm.querySelectorAll('.ms-srv-line-row').forEach(function (row) {
          var sid = row.querySelector('.ms-p-srv').value;
          var srv = (STATE.db.catalogo || []).find(function (x) { return x.id === sid; });
          ed.items.push({
            servicioId: sid,
            codigo: srv ? srv.codigo : 'SRV',
            nombre: row.querySelector('.ms-p-nom').value,
            unidadMedida: srv ? srv.unidadMedida : 'Unidad',
            cantidad: Number(row.querySelector('.ms-p-qty').value || 1),
            precioUnitario: Number(row.querySelector('.ms-p-price').value || 0),
            descuentoPct: Number(row.querySelector('.ms-p-desc').value || 0),
            ivaPct: Number(row.querySelector('.ms-p-iva').value || 21)
          });
        });
        ed.gastosAdicionales = [];
        presForm.querySelectorAll('.ms-srv-gasto-row').forEach(function (row) {
          ed.gastosAdicionales.push({
            concepto: row.querySelector('.ms-g-concepto').value,
            cantidad: Number(row.querySelector('.ms-g-qty').value || 1),
            precioUnitario: Number(row.querySelector('.ms-g-price').value || 0),
            ivaPct: Number(row.querySelector('.ms-g-iva').value || 21)
          });
        });
      };

      presForm.querySelectorAll('.ms-p-srv').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var row = sel.closest('.ms-srv-line-row');
          var srv = (STATE.db.catalogo || []).find(function (x) { return x.id === sel.value; });
          if (srv && row) {
            var cid = Number(presForm.querySelector('[name="clientId"]').value || 0);
            var special = getClientSpecialPrice(cid, srv.id);
            row.querySelector('.ms-p-nom').value = srv.nombre;
            row.querySelector('.ms-p-price').value = special ? special.precioEspecial : srv.precioBase;
            row.querySelector('.ms-p-iva').value = srv.ivaPct;
          }
        });
      });
      var addLineBtn = presForm.querySelector('#ms-p-add-line');
      if (addLineBtn) addLineBtn.addEventListener('click', function () {
        readPresDraftFromDom();
        STATE.editingPresupuesto.items.push({ servicioId: '', codigo: 'SRV', nombre: '', unidadMedida: 'Unidad', cantidad: 1, precioUnitario: 0, descuentoPct: 0, ivaPct: 21 });
        renderWorkspace();
      });
      var addGastoBtn = presForm.querySelector('#ms-p-add-gasto');
      if (addGastoBtn) addGastoBtn.addEventListener('click', function () {
        readPresDraftFromDom();
        STATE.editingPresupuesto.gastosAdicionales.push({ concepto: 'Traslado / Viáticos', cantidad: 1, precioUnitario: 0, ivaPct: 21 });
        renderWorkspace();
      });
      presForm.querySelectorAll('.ms-p-rem').forEach(function (b) {
        b.addEventListener('click', function () {
          var idx = Number(b.closest('.ms-srv-line-row').getAttribute('data-line-idx'));
          readPresDraftFromDom();
          STATE.editingPresupuesto.items.splice(idx, 1);
          renderWorkspace();
        });
      });
      presForm.querySelectorAll('.ms-g-rem').forEach(function (b) {
        b.addEventListener('click', function () {
          var idx = Number(b.closest('.ms-srv-gasto-row').getAttribute('data-gasto-idx'));
          readPresDraftFromDom();
          STATE.editingPresupuesto.gastosAdicionales.splice(idx, 1);
          renderWorkspace();
        });
      });

      var submitPres = async function (bumpVersion) {
        readPresDraftFromDom();
        var ed = STATE.editingPresupuesto;
        ed.clientNombre = getClientName(ed.clientId);
        ed.billingClientNombre = getClientName(ed.billingClientId || ed.clientId);
        var res = await apiServicios('POST', { action: 'save_presupuesto', presupuesto: ed, bumpVersion: Boolean(bumpVersion) });
        if (res && res.ok) {
          STATE.editingPresupuesto = null;
          showToast(res.message, false);
          await reloadData(true);
        } else {
          showToast((res && res.message) || 'Error al guardar presupuesto.', true);
        }
      };
      presForm.addEventListener('submit', function (ev) { ev.preventDefault(); submitPres(false); });
      var verBtn = presForm.querySelector('#ms-p-save-new-ver');
      if (verBtn) verBtn.addEventListener('click', function () { submitPres(true); });
    }

    bodyEl.querySelectorAll('[data-pres-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var found = (STATE.db.presupuestos || []).find(function (x) { return x.id === b.getAttribute('data-pres-edit'); });
        if (found) { STATE.editingPresupuesto = JSON.parse(JSON.stringify(found)); renderWorkspace(); }
      });
    });
    bodyEl.querySelectorAll('[data-pres-pdf]').forEach(function (b) {
      b.addEventListener('click', function () {
        var found = (STATE.db.presupuestos || []).find(function (x) { return x.id === b.getAttribute('data-pres-pdf'); });
        if (found) printPresupuestoPdf(found);
      });
    });
    bodyEl.querySelectorAll('[data-pres-approve]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiServicios('POST', { action: 'change_presupuesto_status', id: b.getAttribute('data-pres-approve'), estado: 'aprobado' });
        if (res && res.ok) { showToast(res.message, false); await reloadData(true); }
      });
    });
    bodyEl.querySelectorAll('[data-pres-to-ot]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var res = await apiServicios('POST', { action: 'convert_presupuesto_to_ot', presupuestoId: b.getAttribute('data-pres-to-ot') });
        if (res && res.ok) {
          showToast(res.message, false);
          await reloadData(false);
          openServiciosView('ordenes');
        }
      });
    });
    bodyEl.querySelectorAll('[data-pres-bill]').forEach(function (b) {
      b.addEventListener('click', function () {
        var pres = (STATE.db.presupuestos || []).find(function (x) { return x.id === b.getAttribute('data-pres-bill'); });
        if (!pres) return;
        var items = (pres.items || []).map(function (it) {
          return {
            codigo: it.codigo || 'SRV',
            nombre: '[' + pres.numero + '] ' + it.nombre,
            cantidad: it.cantidad,
            precioFinal: Math.round(it.precioUnitario * (1 + (Number(it.ivaPct) || 0) / 100) * 100) / 100,
            descPct: it.descuentoPct || 0,
            ivaPct: it.ivaPct != null ? it.ivaPct : 21,
            unidadMedida: it.unidadMedida,
            serviceLink: { presupuestoId: pres.id, lineId: it.id, servicioId: it.servicioId }
          };
        });
        sendToNativePosBilling({
          billingClientId: pres.billingClientId || pres.clientId,
          observacion: 'Presupuesto ' + pres.numero + ' v' + pres.version,
          items: items,
          context: { sourceType: 'presupuesto', presupuestoId: pres.id }
        });
      });
    });

    // --- ÓRDENES DE TRABAJO ---
    var newOtBtn = bodyEl.querySelector('#ms-srv-new-ot');
    if (newOtBtn) {
      newOtBtn.addEventListener('click', function () {
        STATE.editingOt = {
          estado: 'pendiente',
          fechaPrevista: todayIso(),
          personalAsignadoIds: [],
          items: [{ servicioId: '', codigo: 'SRV', nombre: '', unidadMedida: 'Unidad', cantidadPrevista: 1, precioUnitario: 0, ivaPct: 21 }]
        };
        renderWorkspace();
      });
    }
    var otForm = bodyEl.querySelector('#ms-srv-ot-form');
    if (otForm) {
      var readOtDraft = function () {
        var fd = new FormData(otForm);
        var ed = STATE.editingOt;
        ed.clientId = Number(fd.get('clientId') || 0);
        ed.billingClientId = Number(fd.get('billingClientId') || ed.clientId || 0);
        ed.ordenCompraCliente = String(fd.get('ordenCompraCliente') || '');
        ed.fechaPrevista = String(fd.get('fechaPrevista') || todayIso());
        ed.estado = String(fd.get('estado') || 'pendiente');
        ed.lugarTrabajo = String(fd.get('lugarTrabajo') || '');
        ed.domicilioTrabajo = String(fd.get('domicilioTrabajo') || '');
        ed.equipoInstalacion = String(fd.get('equipoInstalacion') || '');
        ed.duracionEstimadaHoras = Number(fd.get('duracionEstimadaHoras') || 0);
        var pid = String(fd.get('personalAsignadoId') || '');
        ed.personalAsignadoIds = pid ? [pid] : [];
        ed.descripcionTrabajo = String(fd.get('descripcionTrabajo') || '');
        ed.materialesRecursos = String(fd.get('materialesRecursos') || '');
        ed.instruccionesEspeciales = String(fd.get('instruccionesEspeciales') || '');
        ed.items = [];
        otForm.querySelectorAll('.ms-ot-line-row').forEach(function (row) {
          var sid = row.querySelector('.ms-ot-srv').value;
          var srv = (STATE.db.catalogo || []).find(function (x) { return x.id === sid; });
          ed.items.push({
            servicioId: sid,
            codigo: srv ? srv.codigo : 'SRV',
            nombre: row.querySelector('.ms-ot-nom').value,
            unidadMedida: srv ? srv.unidadMedida : 'Unidad',
            cantidadPrevista: Number(row.querySelector('.ms-ot-qty').value || 1),
            precioUnitario: Number(row.querySelector('.ms-ot-price').value || 0),
            ivaPct: Number(row.querySelector('.ms-ot-iva').value || 21)
          });
        });
      };
      otForm.querySelectorAll('.ms-ot-srv').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var row = sel.closest('.ms-ot-line-row');
          var srv = (STATE.db.catalogo || []).find(function (x) { return x.id === sel.value; });
          if (srv && row) {
            row.querySelector('.ms-ot-nom').value = srv.nombre;
            row.querySelector('.ms-ot-price').value = srv.precioBase;
            row.querySelector('.ms-ot-iva').value = srv.ivaPct;
          }
        });
      });
      var addOtL = otForm.querySelector('#ms-ot-add-line');
      if (addOtL) addOtL.addEventListener('click', function () {
        readOtDraft();
        STATE.editingOt.items.push({ servicioId: '', codigo: 'SRV', nombre: '', unidadMedida: 'Unidad', cantidadPrevista: 1, precioUnitario: 0, ivaPct: 21 });
        renderWorkspace();
      });
      otForm.querySelectorAll('.ms-ot-rem').forEach(function (b) {
        b.addEventListener('click', function () {
          var idx = Number(b.closest('.ms-ot-line-row').getAttribute('data-idx'));
          readOtDraft();
          STATE.editingOt.items.splice(idx, 1);
          renderWorkspace();
        });
      });
      otForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        readOtDraft();
        var ed = STATE.editingOt;
        ed.clientNombre = getClientName(ed.clientId);
        ed.billingClientNombre = getClientName(ed.billingClientId || ed.clientId);
        var res = await apiServicios('POST', { action: 'save_ot', ot: ed });
        if (res && res.ok) {
          STATE.editingOt = null;
          showToast(res.message, false);
          await reloadData(true);
        } else {
          showToast((res && res.message) || 'Error al guardar OT.', true);
        }
      });
    }

    bodyEl.querySelectorAll('[data-ot-batch]').forEach(function (chk) {
      chk.addEventListener('change', function () {
        STATE.selectedOtIdsForBatch[chk.getAttribute('data-ot-batch')] = chk.checked;
        renderWorkspace();
      });
    });
    var batchBillBtn = bodyEl.querySelector('#ms-ot-bill-batch');
    if (batchBillBtn) {
      batchBillBtn.addEventListener('click', function () {
        var ots = (STATE.db.ordenesTrabajo || []).filter(function (o) { return STATE.selectedOtIdsForBatch[o.id]; });
        if (ots.length === 0) return;
        var allLines = [];
        var allLinks = [];
        ots.forEach(function (o) {
          var built = buildOtBillingLines(o, 'full');
          allLines = allLines.concat(built.lines);
          allLinks = allLinks.concat(built.links);
        });
        if (allLines.length === 0) { showToast('Las OTs seleccionadas no tienen saldo pendiente.', true); return; }
        STATE.selectedOtIdsForBatch = {};
        sendToNativePosBilling({
          billingClientId: ots[0].billingClientId || ots[0].clientId,
          observacion: 'Facturación acumulada: ' + ots.map(function (o) { return o.numero; }).join(', '),
          items: allLines,
          context: { sourceType: 'lote_ot', links: allLinks }
        });
      });
    }
    bodyEl.querySelectorAll('[data-ot-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var found = (STATE.db.ordenesTrabajo || []).find(function (x) { return x.id === b.getAttribute('data-ot-edit'); });
        if (found) { STATE.editingOt = JSON.parse(JSON.stringify(found)); renderWorkspace(); }
      });
    });
    bodyEl.querySelectorAll('[data-ot-parte]').forEach(function (b) {
      b.addEventListener('click', function () {
        var otId = b.getAttribute('data-ot-parte');
        STATE.view = 'partes';
        STATE.editingParte = { otId: otId, fechaInicio: nowLocalDateTime(), fechaFin: nowLocalDateTime(), horasTrabajadas: 4 };
        var bc = document.getElementById('ms-srv-ws-breadcrumb');
        if (bc) bc.textContent = getViewLabel('partes');
        renderWorkspace();
      });
    });
    bodyEl.querySelectorAll('[data-ot-docs]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.docOtFilter = b.getAttribute('data-ot-docs');
        STATE.view = 'documentos';
        var bc = document.getElementById('ms-srv-ws-breadcrumb');
        if (bc) bc.textContent = getViewLabel('documentos');
        renderWorkspace();
      });
    });
    bodyEl.querySelectorAll('[data-ot-bill]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.billingModalOtId = b.getAttribute('data-ot-bill');
        renderWorkspace();
      });
    });

    if (STATE.billingModalOtId) {
      var targetBillOt = (STATE.db.ordenesTrabajo || []).find(function (x) { return x.id === STATE.billingModalOtId; });
      var launchOtBill = function (mode, pct) {
        if (!targetBillOt) return;
        var built = buildOtBillingLines(targetBillOt, mode, pct);
        if (built.lines.length === 0) {
          showToast('No quedan cantidades pendientes de facturar en ' + targetBillOt.numero + '.', true);
          return;
        }
        STATE.billingModalOtId = null;
        sendToNativePosBilling({
          billingClientId: targetBillOt.billingClientId || targetBillOt.clientId,
          observacion: targetBillOt.numero + (targetBillOt.ordenCompraCliente ? ' · OC ' + targetBillOt.ordenCompraCliente : ''),
          items: built.lines,
          context: { sourceType: 'ot', otId: targetBillOt.id, links: built.links }
        });
      };
      var bFull = bodyEl.querySelector('#ms-ot-bill-full');
      if (bFull) bFull.addEventListener('click', function () { launchOtBill('full'); });
      var bExec = bodyEl.querySelector('#ms-ot-bill-exec');
      if (bExec) bExec.addEventListener('click', function () { launchOtBill('executed'); });
      var bPart = bodyEl.querySelector('#ms-ot-bill-partial');
      if (bPart) bPart.addEventListener('click', function () {
        var pct = Number(bodyEl.querySelector('#ms-ot-bill-pct').value || 50);
        launchOtBill('partial_pct', pct);
      });
      var bCan = bodyEl.querySelector('#ms-ot-bill-cancel');
      if (bCan) bCan.addEventListener('click', function () { STATE.billingModalOtId = null; renderWorkspace(); });
    }

    // --- PARTES DE SERVICIO ---
    var newParteBtn = bodyEl.querySelector('#ms-srv-new-parte');
    if (newParteBtn) {
      newParteBtn.addEventListener('click', function () {
        STATE.editingParte = { otId: (STATE.db.ordenesTrabajo[0] && STATE.db.ordenesTrabajo[0].id) || '', fechaInicio: nowLocalDateTime(), fechaFin: nowLocalDateTime(), horasTrabajadas: 4 };
        renderWorkspace();
      });
    }
    var parteOtSel = bodyEl.querySelector('#ms-parte-ot-sel');
    if (parteOtSel) {
      parteOtSel.addEventListener('change', function () {
        STATE.editingParte.otId = parteOtSel.value;
        STATE.editingParte.itemsEjecutados = [];
        renderWorkspace();
      });
    }
    var sigCanvas = bodyEl.querySelector('#ms-parte-sig-canvas');
    if (sigCanvas) bindSignaturePad(sigCanvas);
    var clearSigBtn = bodyEl.querySelector('#ms-parte-clear-sig');
    if (clearSigBtn && sigCanvas) {
      clearSigBtn.addEventListener('click', function () {
        sigCanvas.getContext('2d').clearRect(0, 0, sigCanvas.width, sigCanvas.height);
        sigCanvas.dataset.hasStroke = '';
      });
    }
    var parteForm = bodyEl.querySelector('#ms-srv-parte-form');
    if (parteForm) {
      parteForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(parteForm);
        var otId = String(fd.get('otId') || '');
        var targetOt = (STATE.db.ordenesTrabajo || []).find(function (o) { return o.id === otId; });
        var itemsEjecutados = [];
        if (targetOt) {
          var qtyInps = parteForm.querySelectorAll('.ms-parte-exec-qty');
          (targetOt.items || []).forEach(function (l, i) {
            itemsEjecutados.push({
              otLineId: l.id,
              servicioId: l.servicioId,
              codigo: l.codigo,
              nombre: l.nombre,
              unidadMedida: l.unidadMedida,
              cantidadPresupuestada: l.cantidadPrevista,
              cantidadEjecutada: Number((qtyInps[i] && qtyInps[i].value) || l.cantidadPrevista),
              precioUnitario: l.precioUnitario,
              ivaPct: l.ivaPct
            });
          });
        }
        var firmaDataUrl = sigCanvas && sigCanvas.dataset.hasStroke === '1' ? sigCanvas.toDataURL('image/png') : '';
        var res = await apiServicios('POST', {
          action: 'save_parte',
          marcarOtFinalizada: Boolean(parteForm.querySelector('[name="marcarOtFinalizada"]').checked),
          parte: {
            otId: otId,
            fechaInicio: fd.get('fechaInicio'),
            fechaFin: fd.get('fechaFin'),
            horasTrabajadas: Number(fd.get('horasTrabajadas') || 0),
            movilidadKm: Number(fd.get('movilidadKm') || 0),
            movilidadCosto: Number(fd.get('movilidadCosto') || 0),
            viaticosCosto: Number(fd.get('viaticosCosto') || 0),
            materialesUtilizados: fd.get('materialesUtilizados'),
            materialesCosto: Number(fd.get('materialesCosto') || 0),
            observaciones: fd.get('observaciones'),
            incidencias: fd.get('incidencias'),
            itemsEjecutados: itemsEjecutados,
            conformidad: {
              conforme: Boolean(String(fd.get('nombreReceptor') || '').trim() || firmaDataUrl),
              nombreReceptor: fd.get('nombreReceptor'),
              cargoDniReceptor: fd.get('cargoDniReceptor'),
              observaciones: fd.get('obsConformidad'),
              firmaDataUrl: firmaDataUrl
            }
          }
        });
        if (res && res.ok) {
          STATE.editingParte = null;
          showToast(res.message, false);
          await reloadData(true);
        } else {
          showToast((res && res.message) || 'Error al guardar parte.', true);
        }
      });
    }
    bodyEl.querySelectorAll('[data-parte-pdf]').forEach(function (b) {
      b.addEventListener('click', function () {
        var found = (STATE.db.partesServicio || []).find(function (x) { return x.id === b.getAttribute('data-parte-pdf'); });
        if (found) printPartePdf(found);
      });
    });
    bodyEl.querySelectorAll('[data-parte-bill]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = (STATE.db.partesServicio || []).find(function (x) { return x.id === b.getAttribute('data-parte-bill'); });
        if (!p) return;
        var ot = (STATE.db.ordenesTrabajo || []).find(function (o) { return o.id === p.otId; });
        var lines = [];
        var links = [];
        (p.itemsEjecutados || []).forEach(function (it) {
          var unitConIva = Math.round(it.precioUnitario * (1 + (Number(it.ivaPct) || 0) / 100) * 100) / 100;
          lines.push({
            codigo: it.codigo || 'SRV',
            nombre: '[' + p.numero + '/' + p.otNumero + '] ' + it.nombre,
            cantidad: it.cantidadEjecutada,
            precioFinal: unitConIva,
            descPct: 0,
            ivaPct: it.ivaPct != null ? it.ivaPct : 21,
            unidadMedida: it.unidadMedida,
            serviceLink: { otId: p.otId, parteId: p.id, lineId: it.otLineId, servicioId: it.servicioId }
          });
          links.push({
            otId: p.otId,
            parteId: p.id,
            lineId: it.otLineId,
            servicioId: it.servicioId,
            descripcion: it.nombre,
            cantidad: it.cantidadEjecutada,
            monto: Math.round(it.cantidadEjecutada * unitConIva * 100) / 100
          });
        });
        sendToNativePosBilling({
          billingClientId: (ot && (ot.billingClientId || ot.clientId)) || p.clientId,
          observacion: 'Parte ' + p.numero + ' (' + p.otNumero + ')',
          items: lines,
          context: { sourceType: 'parte', parteId: p.id, links: links }
        });
      });
    });

    // --- DOCUMENTOS ---
    var docOtSel = bodyEl.querySelector('#ms-doc-ot-filter');
    if (docOtSel) docOtSel.addEventListener('change', function () { STATE.docOtFilter = docOtSel.value; renderWorkspace(); });
    var docTypeSel = bodyEl.querySelector('#ms-doc-type-filter');
    if (docTypeSel) docTypeSel.addEventListener('change', function () { STATE.docTypeFilter = docTypeSel.value; renderWorkspace(); });
    var docForm = bodyEl.querySelector('#ms-srv-doc-form');
    if (docForm) {
      docForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var fd = new FormData(docForm);
        var fileInp = docForm.querySelector('#ms-srv-doc-file');
        var file = fileInp && fileInp.files && fileInp.files[0];
        var sendDoc = async function (dataUrl, fileName, mimeType) {
          var res = await apiServicios('POST', {
            action: 'save_documento',
            documento: {
              otId: fd.get('otId'),
              tipo: fd.get('tipo'),
              titulo: fd.get('titulo'),
              notas: fd.get('notas'),
              nombreArchivo: fileName || (String(fd.get('titulo') || 'documento') + '.pdf'),
              mimeType: mimeType || 'application/pdf',
              dataUrl: dataUrl || ''
            }
          });
          if (res && res.ok) { showToast(res.message, false); await reloadData(true); }
        };
        if (file) {
          var reader = new FileReader();
          reader.onload = function () { sendDoc(String(reader.result || ''), file.name, file.type); };
          reader.readAsDataURL(file);
        } else {
          sendDoc('', String(fd.get('titulo') || 'registro') + '.pdf', 'application/pdf');
        }
      });
    }
    bodyEl.querySelectorAll('[data-doc-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar este documento técnico?')) return;
        var res = await apiServicios('POST', { action: 'delete_documento', id: b.getAttribute('data-doc-del') });
        if (res && res.ok) { showToast(res.message, false); await reloadData(true); }
      });
    });

    // --- AGENDA Y PERSONAL ---
    bodyEl.querySelectorAll('[data-agenda-status]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        var res = await apiServicios('POST', { action: 'change_ot_status', id: sel.getAttribute('data-agenda-status'), estado: sel.value });
        if (res && res.ok) { showToast(res.message, false); await reloadData(true); }
      });
    });
    var newPersBtn = bodyEl.querySelector('#ms-srv-new-personal');
    if (newPersBtn) newPersBtn.addEventListener('click', function () { STATE.editingPersonal = { activo: true }; renderWorkspace(); });
    var impEmpSel = bodyEl.querySelector('#ms-srv-import-emp-sel');
    if (impEmpSel) {
      impEmpSel.addEventListener('change', function () {
        var emp = STATE.empleadosAsistencia.find(function (e) { return e.id === impEmpSel.value; });
        if (emp) {
          STATE.editingPersonal = {
            linkedAsistenciaEmployeeId: emp.id,
            nombre: emp.nombre,
            dni: emp.dni,
            especialidad: emp.puesto || emp.sector || '',
            telefono: emp.telefono,
            email: emp.email,
            activo: true
          };
          renderWorkspace();
        }
      });
    }
    bodyEl.querySelectorAll('[data-pers-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.editingPersonal = (STATE.db.personal || []).find(function (x) { return x.id === b.getAttribute('data-pers-edit'); }) || null;
        renderWorkspace();
      });
    });
    bodyEl.querySelectorAll('[data-pers-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar este perfil técnico?')) return;
        var res = await apiServicios('POST', { action: 'delete_personal', id: b.getAttribute('data-pers-del') });
        if (res && res.ok) { showToast(res.message, false); await reloadData(true); }
      });
    });
    var persForm = bodyEl.querySelector('#ms-srv-personal-form');
    if (persForm) {
      persForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(persForm);
        var res = await apiServicios('POST', {
          action: 'save_personal',
          personal: {
            id: fd.get('id') || undefined,
            linkedAsistenciaEmployeeId: fd.get('linkedAsistenciaEmployeeId') || null,
            nombre: fd.get('nombre'),
            dni: fd.get('dni'),
            especialidad: fd.get('especialidad'),
            matricula: fd.get('matricula'),
            habilitaciones: fd.get('habilitaciones'),
            certificaciones: fd.get('certificaciones'),
            costoHora: Number(fd.get('costoHora') || 0),
            telefono: fd.get('telefono')
          }
        });
        if (res && res.ok) { STATE.editingPersonal = null; showToast(res.message, false); await reloadData(true); }
      });
    }

    // --- ABONOS ---
    var abPerInp = bodyEl.querySelector('#ms-abono-period-inp');
    if (abPerInp) abPerInp.addEventListener('change', function () { STATE.abonoPeriod = abPerInp.value; renderWorkspace(); });
    var genDraftsBtn = bodyEl.querySelector('#ms-abono-gen-drafts');
    if (genDraftsBtn) {
      genDraftsBtn.addEventListener('click', async function () {
        var res = await apiServicios('POST', { action: 'generate_abono_period_drafts', periodo: STATE.abonoPeriod });
        if (res && res.ok) { showToast(res.message, false); await reloadData(true); }
      });
    }
    var newAbBtn = bodyEl.querySelector('#ms-srv-new-abono');
    if (newAbBtn) newAbBtn.addEventListener('click', function () { STATE.editingAbono = { frecuencia: 'mensual', estado: 'activo', ivaPct: 21, proximoVencimiento: todayIso() }; renderWorkspace(); });
    bodyEl.querySelectorAll('[data-abono-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.editingAbono = (STATE.db.abonos || []).find(function (x) { return x.id === b.getAttribute('data-abono-edit'); }) || null;
        renderWorkspace();
      });
    });
    var abForm = bodyEl.querySelector('#ms-srv-abono-form');
    if (abForm) {
      abForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(abForm);
        var cid = Number(fd.get('clientId') || 0);
        var bcid = Number(fd.get('billingClientId') || cid);
        var res = await apiServicios('POST', {
          action: 'save_abono',
          abono: {
            id: fd.get('id') || undefined,
            clientId: cid,
            clientNombre: getClientName(cid),
            billingClientId: bcid,
            billingClientNombre: getClientName(bcid),
            servicioId: fd.get('servicioId'),
            servicioNombre: fd.get('servicioNombre'),
            importe: Number(fd.get('importe') || 0),
            ivaPct: Number(fd.get('ivaPct') || 21),
            frecuencia: fd.get('frecuencia'),
            proximoVencimiento: fd.get('proximoVencimiento'),
            estado: fd.get('estado'),
            condicionesActualizacion: fd.get('condicionesActualizacion')
          }
        });
        if (res && res.ok) { STATE.editingAbono = null; showToast(res.message, false); await reloadData(true); }
      });
    }
    bodyEl.querySelectorAll('[data-abono-bill]').forEach(function (b) {
      b.addEventListener('click', function () {
        var ab = (STATE.db.abonos || []).find(function (x) { return x.id === b.getAttribute('data-abono-bill'); });
        if (!ab) return;
        var unitConIva = Math.round(ab.importe * (1 + (Number(ab.ivaPct) || 0) / 100) * 100) / 100;
        sendToNativePosBilling({
          billingClientId: ab.billingClientId || ab.clientId,
          observacion: 'Abono ' + ab.codigo + ' · Período ' + STATE.abonoPeriod,
          items: [{
            codigo: ab.codigo,
            nombre: ab.servicioNombre + ' (Período ' + STATE.abonoPeriod + ')',
            cantidad: 1,
            precioFinal: unitConIva,
            descPct: 0,
            ivaPct: ab.ivaPct != null ? ab.ivaPct : 21,
            unidadMedida: 'Abono mensual',
            serviceLink: { abonoId: ab.id, periodo: STATE.abonoPeriod, lineId: ab.id }
          }],
          context: {
            sourceType: 'abono',
            links: [{ abonoId: ab.id, periodo: STATE.abonoPeriod, lineId: ab.id, descripcion: ab.servicioNombre, cantidad: 1, monto: unitConIva }]
          }
        });
      });
    });

    // --- FACTURACIÓN DIRECTA DE SERVICIOS (SIN CAJA) ---
    var dfForm = bodyEl.querySelector('#ms-df-form');
    if (dfForm && STATE.directInvoice) {
      var readDfFromDom = function () {
        var inv = STATE.directInvoice;
        var fd = new FormData(dfForm);
        inv.billingClientId = Number(fd.get('billingClientId') || inv.billingClientId || 1);
        inv.tipoBase = String(fd.get('tipoBase') || 'Factura');
        inv.letra = String(fd.get('letra') || 'B').toUpperCase();
        inv.pv = String(fd.get('pv') || '0004').replace(/\D/g, '').padStart(4, '0');
        inv.fechaIso = String(fd.get('fechaIso') || todayIso());
        inv.medioPago = String(fd.get('medioPago') || 'CUENTA CORRIENTE');
        inv.observacion = String(fd.get('observacion') || '');
        var arcaEl = dfForm.querySelector('#ms-df-arca-chk');
        inv.autorizarArca = Boolean(arcaEl && arcaEl.checked) && inv.letra !== 'X';
        var rows = dfForm.querySelectorAll('.ms-df-row');
        if (rows.length > 0) {
          inv.items = Array.prototype.map.call(rows, function (row, i) {
            var prev = (inv.items && inv.items[i]) || {};
            return {
              codigo: String((row.querySelector('.ms-df-cod') && row.querySelector('.ms-df-cod').value) || 'SRV'),
              nombre: String((row.querySelector('.ms-df-nom') && row.querySelector('.ms-df-nom').value) || 'Servicio'),
              unidadMedida: String((row.querySelector('.ms-df-uni') && row.querySelector('.ms-df-uni').value) || 'Unidad'),
              cantidad: Math.max(0.01, Number((row.querySelector('.ms-df-qty') && row.querySelector('.ms-df-qty').value) || 1)),
              precioFinal: Math.max(0, Number((row.querySelector('.ms-df-price') && row.querySelector('.ms-df-price').value) || 0)),
              descPct: Number(prev.descPct || 0),
              ivaPct: Math.max(0, Number((row.querySelector('.ms-df-iva') && row.querySelector('.ms-df-iva').value) || 21)),
              isService: true,
              itemType: 'service',
              serviceLink: prev.serviceLink || null
            };
          });
        }
        return inv;
      };

      var refreshDfTotals = function () {
        var inv = readDfFromDom();
        var t = computeDirectInvoiceTotals(inv.items);
        var eN = dfForm.querySelector('#ms-df-tot-neto');
        var eI = dfForm.querySelector('#ms-df-tot-iva');
        var eF = dfForm.querySelector('#ms-df-tot-final');
        if (eN) eN.textContent = fmtArs.format(t.neto);
        if (eI) eI.textContent = fmtArs.format(t.iva);
        if (eF) eF.textContent = fmtArs.format(t.total);
      };

      dfForm.querySelectorAll('.ms-df-qty, .ms-df-price, .ms-df-iva').forEach(function (inp) {
        inp.addEventListener('input', refreshDfTotals);
      });

      var dfCliSel = dfForm.querySelector('#ms-df-client');
      if (dfCliSel) {
        dfCliSel.addEventListener('change', function () {
          var inv = readDfFromDom();
          inv.letra = suggestLetraForClient(inv.billingClientId);
          inv.autorizarArca = inv.letra !== 'X';
          renderWorkspace();
        });
      }

      var dfLetraSel = dfForm.querySelector('#ms-df-letra');
      if (dfLetraSel) {
        dfLetraSel.addEventListener('change', function () {
          var inv = readDfFromDom();
          inv.autorizarArca = inv.letra !== 'X';
          renderWorkspace();
        });
      }

      var dfCatPick = dfForm.querySelector('#ms-df-cat-picker');
      if (dfCatPick) {
        dfCatPick.addEventListener('change', function () {
          var sid = dfCatPick.value;
          if (!sid) return;
          var inv = readDfFromDom();
          var srv = (STATE.db.catalogo || []).find(function (s) { return s.id === sid; });
          if (srv) {
            var sp = getClientSpecialPrice(inv.billingClientId, srv.id);
            var basePrice = sp ? Number(sp.precioEspecial) : Number(srv.precioBase || 0);
            var iva = Number(srv.ivaPct != null ? srv.ivaPct : 21);
            var unitConIva = Math.round(basePrice * (1 + iva / 100) * 100) / 100;
            inv.items.push({
              codigo: srv.codigo || 'SRV',
              nombre: srv.nombre,
              unidadMedida: srv.unidadMedida || 'Unidad',
              cantidad: 1,
              precioFinal: unitConIva,
              descPct: 0,
              ivaPct: iva,
              isService: true,
              itemType: 'service',
              serviceLink: { servicioId: srv.id }
            });
            renderWorkspace();
          }
        });
      }

      var dfAddBlank = dfForm.querySelector('#ms-df-add-blank-line');
      if (dfAddBlank) {
        dfAddBlank.addEventListener('click', function () {
          var inv = readDfFromDom();
          inv.items.push({
            codigo: 'SRV',
            nombre: '',
            unidadMedida: 'Unidad',
            cantidad: 1,
            precioFinal: 0,
            descPct: 0,
            ivaPct: (STATE.db && STATE.db.config && STATE.db.config.ivaDefaultPct) || 21,
            isService: true,
            itemType: 'service',
            serviceLink: null
          });
          renderWorkspace();
        });
      }

      dfForm.querySelectorAll('[data-df-del-line]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = Number(btn.getAttribute('data-df-del-line'));
          var inv = readDfFromDom();
          inv.items.splice(idx, 1);
          renderWorkspace();
        });
      });

      var dfClear = dfForm.querySelector('#ms-df-clear');
      if (dfClear) {
        dfClear.addEventListener('click', function () {
          STATE.directInvoice = buildEmptyDirectInvoice();
          STATE.lastEmittedInvoice = null;
          renderWorkspace();
        });
      }

      var loadOtDirect = function (mode, pct) {
        var otSel = bodyEl.querySelector('#ms-df-pick-ot');
        var otId = otSel ? otSel.value : '';
        if (!otId) { showToast('Elegí primero una Orden de Trabajo pendiente.', true); return; }
        var ot = (STATE.db.ordenesTrabajo || []).find(function (o) { return o.id === otId; });
        if (!ot) return;
        var built = buildOtBillingLines(ot, mode, pct);
        if (built.lines.length === 0) {
          showToast('No quedan cantidades pendientes de facturar en ' + ot.numero + '.', true);
          return;
        }
        var inv = readDfFromDom();
        inv.billingClientId = Number(ot.billingClientId || ot.clientId || inv.billingClientId || 1);
        inv.letra = suggestLetraForClient(inv.billingClientId);
        inv.autorizarArca = inv.letra !== 'X';
        inv.observacion = inv.observacion
          ? inv.observacion + ' · ' + ot.numero
          : ot.numero + (ot.ordenCompraCliente ? ' · OC ' + ot.ordenCompraCliente : '');
        built.lines.forEach(function (l) { inv.items.push(l); });
        inv.context = inv.context || { sourceType: 'ot', links: [] };
        inv.context.links = (inv.context.links || []).concat(built.links);
        showToast('Se cargaron ' + built.lines.length + ' concepto(s) de ' + ot.numero + '.', false);
        renderWorkspace();
      };

      var btnLoadOtFull = bodyEl.querySelector('#ms-df-load-ot-full');
      if (btnLoadOtFull) btnLoadOtFull.addEventListener('click', function () { loadOtDirect('full'); });
      var btnLoadOtPct = bodyEl.querySelector('#ms-df-load-ot-pct');
      if (btnLoadOtPct) {
        btnLoadOtPct.addEventListener('click', function () {
          var pct = Number(window.prompt('Porcentaje de avance / anticipo a facturar (1 a 100):', '50') || 0);
          if (pct > 0 && pct <= 100) loadOtDirect('partial_pct', pct);
        });
      }

      var btnLoadPres = bodyEl.querySelector('#ms-df-load-pres');
      if (btnLoadPres) {
        btnLoadPres.addEventListener('click', function () {
          var sel = bodyEl.querySelector('#ms-df-pick-pres');
          var pid = sel ? sel.value : '';
          if (!pid) { showToast('Elegí primero un Presupuesto.', true); return; }
          var pres = (STATE.db.presupuestos || []).find(function (p) { return p.id === pid; });
          if (!pres) return;
          var inv = readDfFromDom();
          inv.billingClientId = Number(pres.billingClientId || pres.clientId || 1);
          inv.letra = suggestLetraForClient(inv.billingClientId);
          inv.autorizarArca = inv.letra !== 'X';
          inv.observacion = pres.numero + (pres.establecimientoNombre ? ' · ' + pres.establecimientoNombre : '');
          (pres.items || []).forEach(function (l) {
            var unitConIva = Math.round(Number(l.precioUnitario || 0) * (1 + (Number(l.ivaPct) || 0) / 100) * 100) / 100;
            inv.items.push({
              codigo: l.codigo || 'SRV',
              nombre: '[' + pres.numero + '] ' + l.nombre,
              unidadMedida: l.unidadMedida || 'Unidad',
              cantidad: Number(l.cantidad) || 1,
              precioFinal: unitConIva,
              descPct: Number(l.descuentoPct) || 0,
              ivaPct: l.ivaPct != null ? Number(l.ivaPct) : 21,
              isService: true,
              itemType: 'service',
              serviceLink: { servicioId: l.servicioId, lineId: l.id }
            });
          });
          showToast('Presupuesto ' + pres.numero + ' cargado en el comprobante.', false);
          renderWorkspace();
        });
      }

      var btnLoadParte = bodyEl.querySelector('#ms-df-load-parte');
      if (btnLoadParte) {
        btnLoadParte.addEventListener('click', function () {
          var sel = bodyEl.querySelector('#ms-df-pick-parte');
          var pid = sel ? sel.value : '';
          if (!pid) { showToast('Elegí primero un Parte de Servicio.', true); return; }
          var p = (STATE.db.partesServicio || []).find(function (x) { return x.id === pid; });
          if (!p) return;
          var ot = (STATE.db.ordenesTrabajo || []).find(function (o) { return o.id === p.otId; });
          var inv = readDfFromDom();
          inv.billingClientId = Number((ot && (ot.billingClientId || ot.clientId)) || p.clientId || 1);
          inv.letra = suggestLetraForClient(inv.billingClientId);
          inv.autorizarArca = inv.letra !== 'X';
          inv.observacion = 'Parte ' + p.numero + ' (' + p.otNumero + ')';
          inv.context = inv.context || { sourceType: 'parte', links: [] };
          (p.itemsEjecutados || []).forEach(function (it) {
            var unitConIva = Math.round(Number(it.precioUnitario || 0) * (1 + (Number(it.ivaPct) || 0) / 100) * 100) / 100;
            var monto = Math.round((Number(it.cantidadEjecutada) || 1) * unitConIva * 100) / 100;
            inv.items.push({
              codigo: it.codigo || 'SRV',
              nombre: '[' + p.numero + '/' + p.otNumero + '] ' + it.nombre,
              unidadMedida: it.unidadMedida || 'Unidad',
              cantidad: Number(it.cantidadEjecutada) || 1,
              precioFinal: unitConIva,
              descPct: 0,
              ivaPct: it.ivaPct != null ? Number(it.ivaPct) : 21,
              isService: true,
              itemType: 'service',
              serviceLink: { otId: p.otId, parteId: p.id, lineId: it.otLineId, servicioId: it.servicioId }
            });
            inv.context.links.push({
              otId: p.otId,
              parteId: p.id,
              lineId: it.otLineId,
              servicioId: it.servicioId,
              descripcion: it.nombre,
              cantidad: Number(it.cantidadEjecutada) || 1,
              monto: monto
            });
          });
          showToast('Parte ' + p.numero + ' cargado con cantidades ejecutadas reales.', false);
          renderWorkspace();
        });
      }

      var btnLoadAbono = bodyEl.querySelector('#ms-df-load-abono');
      if (btnLoadAbono) {
        btnLoadAbono.addEventListener('click', function () {
          var sel = bodyEl.querySelector('#ms-df-pick-abono');
          var aid = sel ? sel.value : '';
          if (!aid) { showToast('Elegí primero un Abono Activo.', true); return; }
          var ab = (STATE.db.abonos || []).find(function (a) { return a.id === aid; });
          if (!ab) return;
          var inv = readDfFromDom();
          inv.billingClientId = Number(ab.billingClientId || ab.clientId || 1);
          inv.letra = suggestLetraForClient(inv.billingClientId);
          inv.autorizarArca = inv.letra !== 'X';
          inv.observacion = 'Abono ' + ab.codigo + ' · Período ' + STATE.abonoPeriod;
          var unitConIva = Math.round(Number(ab.importe || 0) * (1 + (Number(ab.ivaPct) || 0) / 100) * 100) / 100;
          inv.items.push({
            codigo: ab.codigo,
            nombre: ab.servicioNombre + ' (Período ' + STATE.abonoPeriod + ')',
            unidadMedida: 'Abono mensual',
            cantidad: 1,
            precioFinal: unitConIva,
            descPct: 0,
            ivaPct: ab.ivaPct != null ? Number(ab.ivaPct) : 21,
            isService: true,
            itemType: 'service',
            serviceLink: { abonoId: ab.id, periodo: STATE.abonoPeriod, lineId: ab.id }
          });
          inv.context = inv.context || { sourceType: 'abono', links: [] };
          inv.context.links.push({
            abonoId: ab.id,
            periodo: STATE.abonoPeriod,
            lineId: ab.id,
            descripcion: ab.servicioNombre,
            cantidad: 1,
            monto: unitConIva
          });
          showToast('Abono ' + ab.codigo + ' cargado para el período ' + STATE.abonoPeriod + '.', false);
          renderWorkspace();
        });
      }

      dfForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var inv = readDfFromDom();
        if (!inv.items || inv.items.length === 0) {
          showToast('Agregá al menos un servicio o traé una Orden de Trabajo / Presupuesto antes de emitir.', true);
          return;
        }
        var totals = computeDirectInvoiceTotals(inv.items);
        if (totals.total <= 0) {
          showToast('El importe total del comprobante debe ser mayor a $ 0.', true);
          return;
        }
        var cli = (STATE.clientes || []).find(function (c) { return Number(c.id) === Number(inv.billingClientId); });
        var cliNombre = (cli && cli.nombre) || 'CONSUMIDOR FINAL';
        var isNC = /cr[eé]dito/i.test(inv.tipoBase);
        var isND = /d[eé]bito/i.test(inv.tipoBase);

        var emitBtn = dfForm.querySelector('#ms-df-emit-btn');
        if (emitBtn) { emitBtn.disabled = true; emitBtn.textContent = 'Emitiendo comprobante...'; }

        try {
          // 1. Registrar venta en ventas_db (sin apertura/cierre de caja y sin descontar stock)
          var salePayload = {
            action: 'record_pos_sale',
            usuario: getActorName(),
            sale: {
              cajaId: 'caja3',
              pv: inv.pv,
              letra: inv.letra,
              tipoBase: inv.tipoBase,
              fechaIso: inv.fechaIso,
              importe: totals.total,
              neto: totals.neto,
              iva: totals.iva,
              medioPago: inv.medioPago,
              billingClientId: inv.billingClientId,
              billingClientNombre: cliNombre,
              clienteId: inv.billingClientId,
              clienteNombre: cliNombre,
              clienteDoc: (cli && cli.nroDoc) || '',
              origenOperacion: 'SERVICIOS',
              sinCajaServicios: true,
              observacion: inv.observacion,
              items: inv.items.map(function (it) {
                return Object.assign({}, it, { isService: true, itemType: 'service' });
              })
            }
          };
          var vRes = await fetch('/sistema/api/ventas.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(salePayload)
          }).then(function (r) { return r.json(); });

          if (!vRes || !vRes.ok || !vRes.sale) {
            throw new Error((vRes && vRes.message) || 'No se pudo registrar el comprobante.');
          }
          var saleRec = vRes.sale;

          // 2. Registrar en ARCA Comprobantes Electrónicos (si es comprobante fiscal A/B/C)
          var cae = '';
          var caeVto = '';
          if (inv.letra !== 'X') {
            var regRes = await fetch('/sistema/api/arca_comprobantes.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'register_comprobante',
                usuario: getActorName(),
                comprobante: {
                  pv: saleRec.pv,
                  nro: saleRec.nro,
                  letra: saleRec.letra,
                  tipoBase: saleRec.tipoBase,
                  fechaIso: saleRec.fechaIso,
                  fechaHora: saleRec.fechaHora,
                  clienteId: inv.billingClientId,
                  clienteNombre: cliNombre,
                  clienteDoc: (cli && cli.nroDoc) || '',
                  importe: totals.total,
                  neto: totals.neto,
                  iva: totals.iva,
                  medioPago: inv.medioPago,
                  origen: 'SERVICIOS',
                  observacion: inv.observacion
                }
              })
            }).then(function (r) { return r.json(); }).catch(function () { return null; });

            if (inv.autorizarArca && regRes && regRes.ok && regRes.comprobante) {
              var infRes = await fetch('/sistema/api/arca_comprobantes.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'informar_comprobantes',
                  usuario: getActorName(),
                  comprobantes: [regRes.comprobante]
                })
              }).then(function (r) { return r.json(); }).catch(function () { return null; });
              if (infRes && infRes.ok && Array.isArray(infRes.informados) && infRes.informados[0]) {
                cae = infRes.informados[0].cae || '';
                caeVto = infRes.informados[0].caeVto || '';
              }
            }
          }

          // 3. Impactar Cuenta Corriente Unificada (si es Cuenta Corriente o Nota de Crédito)
          if (inv.medioPago === 'CUENTA CORRIENTE' || isNC) {
            await fetch('/sistema/api/clientes.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'add_ctacte_movement',
                usuario: getActorName(),
                idCliente: inv.billingClientId,
                movement: {
                  cId: inv.billingClientId,
                  fi: saleRec.fechaIso,
                  f: saleRec.fechaIso.split('-').reverse().join('/'),
                  tcn: String(saleRec.tipoBase || 'FACTURA').toUpperCase() + ' SERVICIOS',
                  tca: isNC ? 'NC' : isND ? 'ND' : 'FC',
                  l: saleRec.letra,
                  n: saleRec.numeroCompleto,
                  dh: isNC ? -1 : 1,
                  imp: totals.total,
                  obs: inv.observacion || 'Facturación de Servicios',
                  origen: 'SERVICIOS',
                  items: inv.items
                }
              })
            }).catch(function () {});
          }

          // 4. Registrar trazabilidad anti-doble-facturación en servicios_db
          var linksToSave = [];
          inv.items.forEach(function (it) {
            var sl = it.serviceLink || {};
            var sub = Math.round((Number(it.cantidad) || 1) * (Number(it.precioFinal) || 0) * (1 - (Number(it.descPct) || 0) / 100) * 100) / 100;
            linksToSave.push({
              otId: sl.otId || undefined,
              parteId: sl.parteId || undefined,
              abonoId: sl.abonoId || undefined,
              periodo: sl.periodo || undefined,
              lineId: sl.lineId || '',
              servicioId: sl.servicioId || '',
              descripcion: it.nombre || 'Servicio',
              cantidad: Number(it.cantidad) || 1,
              monto: sub
            });
          });

          var linkRes = await apiServicios('POST', {
            action: 'register_invoice_link',
            invoice: {
              saleId: saleRec.id,
              numeroCompleto: saleRec.numeroCompleto,
              tipoBase: saleRec.tipoBase,
              letra: saleRec.letra,
              fechaIso: saleRec.fechaIso,
              billingClientId: inv.billingClientId,
              billingClientNombre: cliNombre,
              montoFacturado: totals.total,
              origenOperacion: 'SERVICIOS',
              esNotaCredito: isNC,
              lineasFacturadas: linksToSave
            }
          });

          if (linkRes && linkRes.ok === false && linkRes.message) {
            showToast('Comprobante emitido con aviso de trazabilidad: ' + linkRes.message, true);
          } else {
            showToast('✅ ' + saleRec.tipoBase + ' ' + saleRec.letra + ' ' + saleRec.numeroCompleto + ' emitida correctamente' + (cae ? ' (CAE ' + cae + ')' : '') + '.', false);
          }

          STATE.lastEmittedInvoice = {
            tipoBase: saleRec.tipoBase,
            letra: saleRec.letra,
            numeroCompleto: saleRec.numeroCompleto,
            fechaIso: saleRec.fechaIso,
            medioPago: inv.medioPago,
            billingClientNombre: cliNombre,
            clienteDoc: (cli && cli.nroDoc) || '',
            clienteRespIva: (cli && cli.respIva) || '',
            observacion: inv.observacion,
            items: inv.items.slice(),
            neto: totals.neto,
            iva: totals.iva,
            importe: totals.total,
            cae: cae,
            caeVto: caeVto
          };
          STATE.directInvoice = buildEmptyDirectInvoice();
          await reloadData(true);
          printDirectInvoicePdf(STATE.lastEmittedInvoice);
        } catch (err) {
          showToast((err && err.message) || 'Error al emitir comprobante.', true);
          if (emitBtn) { emitBtn.disabled = false; emitBtn.textContent = '🧾 Emitir Comprobante de Servicios'; }
        }
      });
    }

    var dfPrintLast = bodyEl.querySelector('#ms-df-print-last');
    if (dfPrintLast && STATE.lastEmittedInvoice) {
      dfPrintLast.addEventListener('click', function () { printDirectInvoicePdf(STATE.lastEmittedInvoice); });
    }
    var dfGoEmitidos = bodyEl.querySelector('#ms-df-go-emitidos');
    if (dfGoEmitidos) {
      dfGoEmitidos.addEventListener('click', function () {
        var ws = document.getElementById('sec-servicios-workspace');
        if (ws) ws.hidden = true;
        if (typeof window.__MS_OPEN_ERP_SECTION__ === 'function') {
          window.__MS_OPEN_ERP_SECTION__('sec-comprobantes-emitidos');
        }
      });
    }
    var dfNewBlank = bodyEl.querySelector('#ms-df-new-blank');
    if (dfNewBlank) {
      dfNewBlank.addEventListener('click', function () {
        STATE.directInvoice = buildEmptyDirectInvoice();
        STATE.lastEmittedInvoice = null;
        renderWorkspace();
      });
    }

    // --- COBRANZA / RECIBO DIRECTO DE SERVICIOS ---
    var dcForm = bodyEl.querySelector('#ms-dc-form');
    if (dcForm && STATE.directCobranza) {
      var dcCliSel = dcForm.querySelector('#ms-dc-client');
      if (dcCliSel) {
        dcCliSel.addEventListener('change', function () {
          var nextCid = Number(dcCliSel.value || 1);
          var c = (STATE.clientes || []).find(function (x) { return Number(x.id) === nextCid; });
          STATE.directCobranza.clientId = nextCid;
          STATE.directCobranza.importeCobrado = c && Number(c.saldoActual) > 0 ? Number(c.saldoActual) : 0;
          STATE.directCobranza.facturaId = '';
          renderWorkspace();
        });
      }

      bodyEl.querySelectorAll('[data-dc-pick-fact]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          STATE.directCobranza.facturaId = btn.getAttribute('data-dc-pick-fact') || '';
          STATE.directCobranza.importeCobrado = Number(btn.getAttribute('data-dc-pick-amt') || 0);
          renderWorkspace();
        });
      });

      dcForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(dcForm);
        var cid = Number(fd.get('clientId') || 0);
        var fechaIso = String(fd.get('fechaIso') || todayIso());
        var medioPago = String(fd.get('medioPago') || 'TRANSFERENCIA BANCARIA');
        var importeCobrado = Math.max(0, Number(fd.get('importeCobrado') || 0));
        var referencia = String(fd.get('referencia') || '').trim();
        var retTipo = String(fd.get('retencionTipo') || '').trim();
        var retImp = Math.max(0, Number(fd.get('retencionImporte') || 0));
        var retCert = String(fd.get('retencionCertificado') || '').trim();
        var facturaId = String(fd.get('facturaId') || '').trim();
        var obs = String(fd.get('observaciones') || '').trim();
        var totalAcreditado = Math.round((importeCobrado + (retTipo ? retImp : 0)) * 100) / 100;

        if (!cid || totalAcreditado <= 0) {
          showToast('Seleccioná un cliente e ingresá un importe cobrado mayor a $ 0.', true);
          return;
        }

        var submitBtn = dcForm.querySelector('#ms-dc-submit-btn');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Registrando recibo...'; }

        try {
          var cli = (STATE.clientes || []).find(function (c) { return Number(c.id) === cid; });
          var obsParts = ['Cobro ' + medioPago + ': ' + fmtArs.format(importeCobrado)];
          if (referencia) obsParts.push('Ref: ' + referencia);
          if (retTipo && retImp > 0) {
            obsParts.push('Ret. ' + retTipo + (retCert ? ' Cert. ' + retCert : '') + ': ' + fmtArs.format(retImp));
          }
          if (obs) obsParts.push(obs);
          var nroRecibo = 'RC-SRV-' + String(Date.now()).slice(-6);

          var rcRes = await fetch('/sistema/api/clientes.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add_ctacte_movement',
              usuario: getActorName(),
              idCliente: cid,
              movement: {
                cId: cid,
                fi: fechaIso,
                f: fechaIso.split('-').reverse().join('/'),
                tcn: 'RECIBO DE SERVICIOS',
                tca: 'RC',
                l: 'X',
                n: nroRecibo,
                dh: -1,
                imp: totalAcreditado,
                obs: obsParts.join(' · '),
                origen: 'SERVICIOS'
              }
            })
          }).then(function (r) { return r.json(); });

          if (!rcRes || !rcRes.ok) {
            throw new Error((rcRes && rcRes.message) || 'No se pudo registrar el recibo en Cuenta Corriente.');
          }

          if (retTipo && retImp > 0 && facturaId) {
            await apiServicios('POST', {
              action: 'update_invoice_admin_retencion',
              facturaId: facturaId,
              aprobacionAdminEstado: 'aprobada',
              retencion: { tipo: retTipo, importe: retImp, certificado: retCert, fecha: fechaIso }
            }).catch(function () {});
          }

          var saldoPosterior = rcRes.client && rcRes.client.saldoActual != null
            ? Number(rcRes.client.saldoActual)
            : Math.round(((cli && Number(cli.saldoActual)) || 0) - totalAcreditado);

          STATE.lastEmittedRecibo = {
            numero: (rcRes.movimiento && rcRes.movimiento.n) || nroRecibo,
            fechaIso: fechaIso,
            clientNombre: (cli && cli.nombre) || 'Cliente #' + cid,
            clientDoc: (cli && cli.nroDoc) || '',
            medioPago: medioPago,
            referencia: referencia,
            importeCobrado: importeCobrado,
            retencionTipo: retTipo,
            retencionImporte: retTipo ? retImp : 0,
            retencionCertificado: retCert,
            totalAcreditado: totalAcreditado,
            saldoPosterior: saldoPosterior,
            observaciones: obs
          };
          STATE.directCobranza = buildEmptyDirectCobranza();
          showToast('✅ Recibo ' + STATE.lastEmittedRecibo.numero + ' acreditado en Cuenta Corriente.', false);
          await reloadData(true);
          printDirectReciboPdf(STATE.lastEmittedRecibo);
        } catch (err) {
          showToast((err && err.message) || 'Error al registrar cobranza.', true);
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '💵 Emitir Recibo y Acreditar Cta. Cte.'; }
        }
      });
    }

    var dcPrintLast = bodyEl.querySelector('#ms-dc-print-last');
    if (dcPrintLast && STATE.lastEmittedRecibo) {
      dcPrintLast.addEventListener('click', function () { printDirectReciboPdf(STATE.lastEmittedRecibo); });
    }
    var dcOpenCta = bodyEl.querySelector('#ms-dc-open-ctacte');
    if (dcOpenCta) {
      dcOpenCta.addEventListener('click', function () {
        var ws = document.getElementById('sec-servicios-workspace');
        if (ws) ws.hidden = true;
        if (typeof window.__MS_OPEN_CTACTE_ORIGIN__ === 'function') {
          window.__MS_OPEN_CTACTE_ORIGIN__('SERVICIOS');
        }
      });
    }
  }

  // =========================================================================
  // NAVEGACIÓN GLOBAL ("ATRÁS" Y TARJETAS EN #sec-inicio Y #sec-menu-facturacion)
  // =========================================================================
  var navBound = false;
  function bindGlobalNav() {
    if (navBound) return;
    navBound = true;
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || typeof t.closest !== 'function') return;

      var backTop = t.closest('#btn-topbar-back-facturacion');
      if (backTop) {
        var wsSec = document.getElementById('sec-servicios-workspace');
        var menuSec = document.getElementById('sec-menu-servicios');
        if (wsSec && !wsSec.hidden) {
          ev.preventDefault();
          ev.stopPropagation();
          if (STATE.returnTo === 'sec-menu-facturacion') {
            wsSec.hidden = true;
            STATE.returnTo = 'servicios';
            if (typeof window.__MS_OPEN_ERP_SECTION__ === 'function') {
              window.__MS_OPEN_ERP_SECTION__('sec-menu-facturacion');
            } else {
              closeToHome();
            }
          } else {
            openServiciosView('menu');
          }
          return;
        }
        if (menuSec && !menuSec.hidden) {
          ev.preventDefault();
          ev.stopPropagation();
          closeToHome();
          return;
        }
      }

      var navTrigger = t.closest('#topbar-home-btn, [data-open-section], #ms-superadmin-home-card, #ms-cv-home-card, #ms-personal-home-card, #ms-turnos-home-card, #ms-inmo-home-card, #ms-micontador-home-card, #ms-gestion-consultorios-home-card, #ms-gestion-web-home-card');
      if (navTrigger) {
        var m = document.getElementById('sec-menu-servicios');
        var w = document.getElementById('sec-servicios-workspace');
        if (m) m.hidden = true;
        if (w) w.hidden = true;
      }
    }, true);
  }

  function syncFacturacionServicesCards(allowed) {
    var factGrid = document.querySelector('#sec-menu-facturacion .modules-grid');
    if (!factGrid) return;
    var emitirCard = document.getElementById('ms-srv-fact-emitir-card');
    var reciboCard = document.getElementById('ms-srv-fact-recibo-card');

    if (allowed && !emitirCard) {
      emitirCard = document.createElement('article');
      emitirCard.id = 'ms-srv-fact-emitir-card';
      emitirCard.className = 'module-card ms-srv-fact-card';
      emitirCard.setAttribute('role', 'button');
      emitirCard.setAttribute('tabindex', '0');
      emitirCard.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
            '<polyline points="14 2 14 8 20 8"></polyline>' +
            '<line x1="12" y1="18" x2="12" y2="12"></line>' +
            '<line x1="9" y1="15" x2="15" y2="15"></line>' +
          '</svg>' +
        '</div>' +
        '<h3>Emitir Comprobante de Servicios</h3>';
      var openEmitir = function () {
        STATE.directInvoice = null;
        openServiciosView('facturar_directo', { returnTo: 'sec-menu-facturacion' });
      };
      emitirCard.addEventListener('click', openEmitir);
      emitirCard.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openEmitir(); }
      });

      reciboCard = document.createElement('article');
      reciboCard.id = 'ms-srv-fact-recibo-card';
      reciboCard.className = 'module-card ms-srv-fact-card';
      reciboCard.setAttribute('role', 'button');
      reciboCard.setAttribute('tabindex', '0');
      reciboCard.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<rect x="2" y="5" width="20" height="14" rx="2"></rect>' +
            '<line x1="2" y1="10" x2="22" y2="10"></line>' +
            '<line x1="6" y1="15" x2="10" y2="15"></line>' +
          '</svg>' +
        '</div>' +
        '<h3>Registrar Cobranza / Recibo</h3>';
      var openRecibo = function () {
        STATE.directCobranza = null;
        openServiciosView('cobranza_directa', { returnTo: 'sec-menu-facturacion' });
      };
      reciboCard.addEventListener('click', openRecibo);
      reciboCard.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openRecibo(); }
      });

      var compEmitidosCard = factGrid.querySelector('[data-open-section="sec-comprobantes-emitidos"]');
      if (compEmitidosCard) {
        factGrid.insertBefore(emitirCard, compEmitidosCard);
        factGrid.insertBefore(reciboCard, compEmitidosCard);
      } else {
        factGrid.appendChild(emitirCard);
        factGrid.appendChild(reciboCard);
      }
    }
    if (emitirCard) emitirCard.hidden = !allowed;
    if (reciboCard) reciboCard.hidden = !allowed;
  }

  function syncHomeCard() {
    bindGlobalNav();
    applyActividadModeUi();
    var allowed = isServiciosAllowed();
    syncFacturacionServicesCards(allowed);
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-servicios-home-card');

    if (allowed && inicioGrid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-servicios-home-card';
      card.className = 'module-card';
      card.setAttribute('data-module-key', 'servicios');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div class="module-icon" aria-hidden="true">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>' +
          '</svg>' +
        '</div>' +
        '<h3>Gestión de Servicios</h3>';

      card.addEventListener('click', function () { openServiciosView('menu'); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openServiciosView('menu'); }
      });

      if (getActiveActividadMode() === 'servicios' && inicioGrid.firstElementChild) {
        inicioGrid.insertBefore(card, inicioGrid.firstElementChild);
      } else {
        var perfilCard = inicioGrid.querySelector('[data-module-key="perfil"]');
        if (perfilCard) inicioGrid.insertBefore(card, perfilCard);
        else inicioGrid.appendChild(card);
      }
    } else if (existing) {
      existing.hidden = !allowed;
      existing.style.display = allowed ? '' : 'none';
    }
  }

  setInterval(syncHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncHomeCard);
})();
