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
    view: 'menu', // 'menu' | 'panel' | 'catalogo' | 'presupuestos' | 'ordenes' | 'partes' | 'documentos' | 'agenda' | 'abonos' | 'informes'
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
    abonoPeriod: new Date().toISOString().slice(0, 7)
  };

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
      informes: 'Informes e Indicadores'
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
        openServiciosView('menu');
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
        if (renderAfter && STATE.view !== 'menu') renderWorkspace();
      }
    } catch (_e) {
    } finally {
      STATE.loading = false;
    }
  }

  async function openServiciosView(viewKey) {
    var secs = ensureSectionsMounted();
    if (!secs) return;
    STATE.view = viewKey || 'menu';
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

    hideAllErpSections();
    updateTopbar(
      true,
      STATE.view === 'menu' ? 'Gestión de Servicios' : 'Gestión de Servicios · ' + getViewLabel(STATE.view)
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
    var bc = document.getElementById('ms-srv-ws-breadcrumb');
    if (bc) bc.textContent = getViewLabel(STATE.view);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (!STATE.db) {
      await reloadData(false);
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
  // FACTURACIÓN INTEGRADA DIRECTO EN POS / ARCA NATIVO
  // =========================================================================
  function sendToNativePosBilling(payload) {
    if (typeof window.__MS_LOAD_SERVICES_INTO_POS__ !== 'function') {
      showToast('El facturador POS nativo todavía no terminó de inicializarse.', true);
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
  }

  // =========================================================================
  // NAVEGACIÓN GLOBAL ("ATRÁS" Y TARJETA EN #sec-inicio)
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
          openServiciosView('menu');
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

  function syncHomeCard() {
    bindGlobalNav();
    var allowed = isServiciosAllowed();
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

      var perfilCard = inicioGrid.querySelector('[data-module-key="perfil"]');
      if (perfilCard) inicioGrid.insertBefore(card, perfilCard);
      else inicioGrid.appendChild(card);
    } else if (existing) {
      existing.hidden = !allowed;
      existing.style.display = allowed ? '' : 'none';
    }
  }

  setInterval(syncHomeCard, 1000);
  document.addEventListener('DOMContentLoaded', syncHomeCard);
})();
