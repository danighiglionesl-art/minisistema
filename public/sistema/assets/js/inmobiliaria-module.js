/* ==========================================================================
   MÓDULO "INMOBILIARIA" — MINISISTEMA ERP
   Administra el Marketplace Inmobiliario (/inmobiliaria o /<slug>/inmobiliaria):
   1. Banners 1530×370 (carrusel administrable)
   2. Propiedades (Ventas / Alquileres / Temporarios, urbanas/rurales, PH/condominio,
      con/sin construcción, cartel cruzado, destacadas, Google Maps, caducidad, características rápidas)
   3. Clientes (Inquilinos y Propietarios con mismos campos que registro web + localidades/provincias/WA)
   4. Contratos, PDFs y Cuenta Corriente (Vigentes / Pasados / Futuros + Split Propietario/Inmobiliaria)
   5. Modelos de Contratos Editables con Campos Automáticos ({{CLIENTE_...}}, {{PROPIEDAD_...}})
   6. Pagos Split (Modalidad ReikiOnline: % Propietario / % Inmobiliaria)
   7. Consultas, Visitas y Leads Web
   8. Portal Público /inmobiliaria, Código QR y Configuración (Google Sign-In, WhatsApp, Etiquetas, IA)
   ========================================================================== */
(function () {
  'use strict';

  var WA_COUNTRIES = [
    { country: 'Argentina', prefix: '+549', label: '🇦🇷 Argentina (+54 9)' },
    { country: 'Uruguay', prefix: '+598', label: '🇺🇾 Uruguay (+598)' },
    { country: 'Paraguay', prefix: '+595', label: '🇵🇾 Paraguay (+595)' },
    { country: 'Chile', prefix: '+56', label: '🇨🇱 Chile (+56)' },
    { country: 'Brasil', prefix: '+55', label: '🇧🇷 Brasil (+55)' },
    { country: 'Bolivia', prefix: '+591', label: '🇧🇴 Bolivia (+591)' },
    { country: 'Perú', prefix: '+51', label: '🇵🇪 Perú (+51)' },
    { country: 'Colombia', prefix: '+57', label: '🇨🇴 Colombia (+57)' },
    { country: 'España', prefix: '+34', label: '🇪🇸 España (+34)' },
    { country: 'Estados Unidos / Canadá', prefix: '+1', label: '🇺🇸 EE.UU. / Canadá (+1)' }
  ];

  var TIPOS_PROPIEDAD = [
    'Casa',
    'Departamento',
    'Dúplex / Tríplex',
    'PH',
    'Terreno / Lote',
    'Campo / Fracción Rural',
    'Quinta / Chacra',
    'Local Comercial',
    'Oficina / Consultorio',
    'Galpón / Depósito',
    'Cochera',
    'Cabaña / Temporario'
  ];

  var CALEFACCION_OPTS = [
    'Sin calefacción',
    'Calefactores gas natural',
    'Losa radiante',
    'Radiadores',
    'Caldera central',
    'Aire frío/calor',
    'Eléctrica',
    'Hogar a leña'
  ];

  var REFRIGERACION_OPTS = [
    'Sin refrigeración',
    'Aire acondicionado split',
    'Aire central',
    'Ventiladores de techo',
    'Preinstalación AA'
  ];

  var STATE = {
    activeView: 'menu',
    publicUrl: '/inmobiliaria',
    stats: {},
    placeholders: [],
    catalogs: { paises: [], provincias: [], localidadesPorProvincia: {} },
    data: {
      portalConfig: {},
      banners: [],
      propiedades: [],
      clientes: [],
      plantillasContrato: [],
      contratos: [],
      transaccionesSplit: [],
      consultas: []
    },
    // Estados de formularios / filtros
    editingBannerId: null,
    bannerDraftImg: '',
    editingPropId: null,
    propDraftFotos: [],
    filterPropOp: '',
    searchProp: '',
    editingClienteId: null,
    searchCliente: '',
    editingPlantillaId: null,
    editingContratoId: null,
    contratoDraftPdfB64: '',
    contratoDraftPdfName: '',
    viewingContratoCtaId: null
  };

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtMoney(val, mon) {
    var n = Number(val || 0);
    if (mon === 'USD') return 'USD ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
    return '$ ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
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

  function isModuleAllowed() {
    var u = getActiveUser();
    if (!u || !u.username) return false;
    if (String(u.username).toLowerCase() === 'danielg' || u.role === 'Administrador General') {
      return true;
    }
    var brandMods = (window.ERP_BRAND && window.ERP_BRAND.enabledModules) || [];
    if (Array.isArray(brandMods) && brandMods.length > 0 && brandMods.indexOf('inmobiliaria') === -1) {
      return false;
    }
    if (u.role === 'Administrador') return true;
    var uMods = Array.isArray(u.modules) ? u.modules : [];
    return uMods.some(function (k) {
      return k === 'inmobiliaria' || String(k).indexOf('inmobiliaria:') === 0;
    });
  }

  async function apiInmo(method, bodyOrQuery) {
    var url = '/sistema/api/inmobiliaria.php';
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

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function showToast(msg, isErr) {
    var el = document.getElementById('ms-inmo-toast');
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
    var backTop = document.getElementById('btn-topbar-back-facturacion');
    if (backTop) backTop.hidden = true;
    var ind = document.getElementById('topbar-caja-indicator');
    if (ind) ind.hidden = true;
  }

  function getSubTitle(viewKey) {
    var map = {
      banners: 'Banners 1530×370',
      propiedades: 'Propiedades (Ventas, Alquileres y Temporarios)',
      clientes: 'Clientes (Inquilinos y Propietarios)',
      contratos: 'Contratos, PDFs y Cuenta Corriente',
      plantillas: 'Modelos de Contratos con Campos Automáticos',
      pagos_split: 'Pagos Split (Propietario / Inmobiliaria)',
      consultas: 'Consultas, Visitas y Leads Web',
      portal: 'Portal Público /inmobiliaria, QR y Configuración'
    };
    return map[viewKey] || 'Inmobiliaria';
  }

  function ensureSectionsMounted() {
    var erpMain = document.querySelector('.erp-main');
    if (!erpMain) return null;

    var menuSec = document.getElementById('sec-menu-inmobiliaria');
    var workSec = document.getElementById('sec-inmobiliaria-workspace');

    if (!menuSec) {
      menuSec = document.createElement('section');
      menuSec.id = 'sec-menu-inmobiliaria';
      menuSec.className = 'erp-section';
      menuSec.hidden = true;
      menuSec.innerHTML =
        '<div class="module-back-bar">' +
          '<button type="button" class="btn-back-home" id="ms-inmo-back-home-btn">← Volver a Pantalla Principal</button>' +
          '<span class="module-breadcrumb">ERP en Línea · <strong>Inmobiliaria</strong></span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem;">' +
          '<div style="font-size:0.86rem;font-weight:700;color:#112D3A;">🏠 Gestión integral del Marketplace Inmobiliario, Contratos PDF y Split de Pagos</div>' +
          '<a href="/inmobiliaria" target="_blank" id="ms-inmo-open-public-top" class="ms-sa-btn">🌐 Abrir Portal Público /inmobiliaria ↗</a>' +
        '</div>' +
        '<div class="modules-grid" aria-label="Submódulos de Inmobiliaria">' +
          '<article class="module-card" role="button" tabindex="0" data-inmo-sub="propiedades">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
              '<div class="module-icon" aria-hidden="true">🏠</div>' +
              '<span id="ms-inmo-badge-props" class="ms-sa-pill">0 activas</span>' +
            '</div>' +
            '<h3>Propiedades (Ventas, Alquileres y Temporarios)</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-inmo-sub="banners">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
              '<div class="module-icon" aria-hidden="true">🖼️</div>' +
              '<span id="ms-inmo-badge-banners" class="ms-sa-pill">1530×370</span>' +
            '</div>' +
            '<h3>Banners 1530×370</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-inmo-sub="clientes">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
              '<div class="module-icon" aria-hidden="true">👥</div>' +
              '<span id="ms-inmo-badge-clientes" class="ms-sa-pill">0 clientes</span>' +
            '</div>' +
            '<h3>Clientes (Inquilinos y Propietarios)</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-inmo-sub="contratos">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
              '<div class="module-icon" aria-hidden="true">📄</div>' +
              '<span id="ms-inmo-badge-contratos" class="ms-sa-pill">0 vigentes</span>' +
            '</div>' +
            '<h3>Contratos, PDFs y Cuenta Corriente</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-inmo-sub="plantillas">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
              '<div class="module-icon" aria-hidden="true">📝</div>' +
              '<span id="ms-inmo-badge-plantillas" class="ms-sa-pill">Campos Auto</span>' +
            '</div>' +
            '<h3>Modelos de Contratos</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-inmo-sub="pagos_split">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
              '<div class="module-icon" aria-hidden="true">💳</div>' +
              '<span id="ms-inmo-badge-split" class="ms-sa-pill">Split MP</span>' +
            '</div>' +
            '<h3>Pagos Split (Propietario / Inmobiliaria)</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-inmo-sub="consultas">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
              '<div class="module-icon" aria-hidden="true">📩</div>' +
              '<span id="ms-inmo-badge-consultas" class="ms-sa-pill">0 nuevas</span>' +
            '</div>' +
            '<h3>Consultas, Visitas y Leads Web</h3>' +
          '</article>' +
          '<article class="module-card" role="button" tabindex="0" data-inmo-sub="portal">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
              '<div class="module-icon" aria-hidden="true">⚙️</div>' +
              '<span class="ms-sa-pill">/inmobiliaria</span>' +
            '</div>' +
            '<h3>Portal Web, QR y Configuración</h3>' +
          '</article>' +
        '</div>';

      erpMain.appendChild(menuSec);

      menuSec.querySelector('#ms-inmo-back-home-btn').addEventListener('click', closeToHome);
      menuSec.querySelectorAll('[data-inmo-sub]').forEach(function (card) {
        card.addEventListener('click', function () {
          openInmoView(card.getAttribute('data-inmo-sub'));
        });
        card.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            openInmoView(card.getAttribute('data-inmo-sub'));
          }
        });
      });
    }

    if (!workSec) {
      workSec = document.createElement('section');
      workSec.id = 'sec-inmobiliaria-workspace';
      workSec.className = 'erp-section';
      workSec.hidden = true;
      workSec.innerHTML =
        '<div id="ms-inmo-toast" style="display:none;margin-bottom:0.9rem;padding:0.75rem 1rem;border-radius:10px;font-weight:700;font-size:0.85rem;"></div>' +
        '<div id="ms-inmo-body"></div>';
      erpMain.appendChild(workSec);
    }

    return { menuSec: menuSec, workSec: workSec };
  }

  async function openInmoView(viewKey) {
    var refs = ensureSectionsMounted();
    if (!refs) return;
    STATE.activeView = viewKey || 'menu';
    hideAllErpSections();

    var backTop = document.getElementById('btn-topbar-back-facturacion');
    if (backTop) {
      backTop.hidden = false;
      backTop.textContent = '← Atrás';
    }
    var ind = document.getElementById('topbar-caja-indicator');
    if (ind) {
      ind.hidden = false;
      ind.textContent =
        STATE.activeView === 'menu'
          ? 'Inmobiliaria'
          : 'Inmobiliaria · ' + getSubTitle(STATE.activeView);
    }

    if (STATE.activeView === 'menu') {
      refs.menuSec.hidden = false;
      await reloadData(false);
    } else {
      refs.workSec.hidden = false;
      await reloadData(true);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function reloadData(renderAfter) {
    try {
      var res = await apiInmo('GET', { t: String(Date.now()) });
      if (res && res.ok) {
        STATE.publicUrl = res.publicInmoUrl || '/inmobiliaria';
        STATE.stats = res.stats || {};
        STATE.placeholders = Array.isArray(res.placeholders) ? res.placeholders : [];
        STATE.data = res.data || STATE.data;
        STATE.catalogs = res.catalogs || STATE.catalogs;
        syncCountersUi();
      }
    } catch (_e) {}
    if (renderAfter) renderWorkspace();
  }

  function syncCountersUi() {
    var s = STATE.stats || {};
    var el;
    el = document.getElementById('ms-inmo-badge-props');
    if (el) el.textContent = (s.propiedadesActivas || 0) + ' activas';
    el = document.getElementById('ms-inmo-badge-banners');
    if (el) el.textContent = (s.bannersActivos || 0) + ' banners';
    el = document.getElementById('ms-inmo-badge-clientes');
    if (el) el.textContent = (s.clientesTotal || 0) + ' clientes';
    el = document.getElementById('ms-inmo-badge-contratos');
    if (el) el.textContent = (s.contratosVigentes || 0) + ' vigentes';
    el = document.getElementById('ms-inmo-badge-plantillas');
    if (el) el.textContent = (s.plantillasTotal || 0) + ' modelos';
    el = document.getElementById('ms-inmo-badge-consultas');
    if (el) el.textContent = (s.consultasNuevas || 0) + ' nuevas';
    el = document.getElementById('ms-inmo-open-public-top');
    if (el && STATE.publicUrl) el.href = STATE.publicUrl;
    var homePill = document.getElementById('ms-inmo-home-pill');
    if (homePill) {
      homePill.textContent =
        Number(s.consultasNuevas || 0) > 0
          ? '🔔 ' + s.consultasNuevas + ' CONSULTAS'
          : (s.propiedadesActivas || 0) + ' PROPS';
    }
  }

  // ---------------- SUBMÓDULO 1: BANNERS 1530x370 ----------------
  function renderBannersView() {
    var list = STATE.data.banners || [];
    var editing = STATE.editingBannerId
      ? list.find(function (b) { return b.id === STATE.editingBannerId; })
      : null;

    var cards = list.map(function (b) {
      return (
        '<div class="ms-sa-card" style="display:grid;gap:0.65rem;">' +
        '<img src="' + esc(b.imageUrl) + '" alt="' + esc(b.titulo) + '" style="width:100%;aspect-ratio:1530/370;object-fit:cover;border-radius:10px;border:1px solid #cbd5e1;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">' +
        '<div><strong>#' + esc(b.orden) + ' · ' + esc(b.titulo) + '</strong><br><small style="opacity:0.75;">' + esc(b.subtitulo || '') + '</small></div>' +
        '<div style="display:flex;gap:0.4rem;">' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-edit-banner="' + esc(b.id) + '">✏️ Editar</button>' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="border-color:#dc2626;color:#dc2626;" data-del-banner="' + esc(b.id) + '">🗑</button>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }).join('');

    return (
      '<div style="display:grid;gap:1.1rem;">' +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">🖼️ ' + (editing ? 'Editar Banner 1530×370' : 'Nuevo Banner Publicitario (1530×370)') + '</h4>' +
      '<form id="ms-inmo-banner-form" style="display:grid;gap:0.75rem;">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.65rem;">' +
      '<div><label class="ms-sa-label">Título del Banner *</label><input class="ms-sa-input" name="titulo" required value="' + esc(editing ? editing.titulo : '') + '" placeholder="Ej: Tu próxima casa te espera"></div>' +
      '<div><label class="ms-sa-label">Subtítulo / Bajada</label><input class="ms-sa-input" name="subtitulo" value="' + esc(editing ? editing.subtitulo : '') + '" placeholder="Publicidad, marca inmobiliaria o campaña"></div>' +
      '<div><label class="ms-sa-label">Enlace al hacer clic (opcional)</label><input class="ms-sa-input" name="linkUrl" value="' + esc(editing ? editing.linkUrl : '#propiedades-tabs') + '" placeholder="#propiedades-tabs o https://..."></div>' +
      '<div><label class="ms-sa-label">Texto del botón CTA</label><input class="ms-sa-input" name="ctaLabel" value="' + esc(editing ? editing.ctaLabel : 'Ver Propiedades') + '"></div>' +
      '<div><label class="ms-sa-label">Orden</label><input type="number" class="ms-sa-input" name="orden" value="' + esc(editing ? editing.orden : list.length + 1) + '"></div>' +
      '<div><label class="ms-sa-label">URL Imagen o Subir Archivo (1530×370)</label><input class="ms-sa-input" name="imageUrl" value="' + esc(editing ? editing.imageUrl : '') + '" placeholder="https://... o subí archivo abajo"></div>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.75rem;">' +
      '<input type="file" id="ms-inmo-banner-file" accept="image/*">' +
      '<label style="display:inline-flex;align-items:center;gap:0.35rem;font-size:0.82rem;font-weight:700;"><input type="checkbox" name="activo" ' + (!editing || editing.activo !== false ? 'checked' : '') + '> Banner activo en el carrusel</label>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;">' +
      '<button type="submit" class="ms-sa-btn">💾 Guardar Banner</button>' +
      (editing ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-inmo-cancel-banner">Cancelar edición</button>' : '') +
      '</div>' +
      '</form>' +
      '</div>' +
      '<div style="display:grid;gap:0.85rem;">' + (cards || '<div class="ms-sa-card">No hay banners cargados.</div>') + '</div>' +
      '</div>'
    );
  }

  // ---------------- SUBMÓDULO 2: PROPIEDADES ----------------
  function renderPropiedadesView() {
    var list = STATE.data.propiedades || [];
    var editing = STATE.editingPropId
      ? list.find(function (p) { return p.id === STATE.editingPropId; })
      : null;
    var c = (editing && editing.caracteristicas) || {};
    var etiquetas = (STATE.data.portalConfig && STATE.data.portalConfig.etiquetasPersonalizadas) || [
      'Nuevo Ingreso', 'Oportunidad', 'Liquidación', 'Escucho Ofertas'
    ];
    var propietarios = (STATE.data.clientes || []).filter(function (cl) {
      return cl.rol === 'propietario' || cl.rol === 'ambos';
    });

    var filtered = list.filter(function (p) {
      if (STATE.filterPropOp && p.operacion !== STATE.filterPropOp) return false;
      if (STATE.searchProp) {
        var q = STATE.searchProp.toLowerCase();
        var hay = [p.codigo, p.titulo, p.barrio, p.localidad, p.cartelCruzado, p.tipoPropiedad].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var fotosPreview = (STATE.propDraftFotos || []).map(function (f, idx) {
      return (
        '<div style="position:relative;width:82px;height:62px;border-radius:8px;overflow:hidden;border:2px solid ' + (idx === 0 ? '#56D7A1' : '#cbd5e1') + ';">' +
        '<img src="' + esc(f) + '" style="width:100%;height:100%;object-fit:cover;">' +
        '<button type="button" data-rm-prop-foto="' + idx + '" style="position:absolute;top:2px;right:2px;background:#dc2626;color:#fff;border:none;border-radius:999px;width:18px;height:18px;font-size:10px;cursor:pointer;">✕</button>' +
        (idx === 0 ? '<span style="position:absolute;bottom:0;left:0;right:0;background:#112D3A;color:#56D7A1;font-size:9px;text-align:center;font-weight:800;">PORTADA</span>' : '') +
        '</div>'
      );
    }).join('');

    var rows = filtered.map(function (p) {
      var expired = p.fechaCaducidad && p.fechaCaducidad < new Date().toISOString().slice(0, 10);
      return (
        '<tr style="border-bottom:1px solid #e2ecf0;">' +
        '<td style="padding:0.55rem;"><strong>' + esc(p.codigo) + '</strong><br><span class="ms-sa-pill">' + esc(p.operacion) + '</span></td>' +
        '<td style="padding:0.55rem;"><strong>' + esc(p.titulo) + '</strong><br><small>' + esc(p.tipoPropiedad) + ' · ' + esc(p.ambito) + ' · ' + esc(p.localidad) + (p.cartelCruzado ? ' · 🏷️ ' + esc(p.cartelCruzado) : '') + '</small></td>' +
        '<td style="padding:0.55rem;font-weight:800;">' + (p.mostrarPrecio ? fmtMoney(p.precio, p.moneda) : esc(p.textoConsulta || 'Consultar')) + '</td>' +
        '<td style="padding:0.55rem;font-size:0.78rem;">' + (p.destacada ? '⭐ Destacada<br>' : '') + (p.fechaCaducidad ? (expired ? '<span style="color:#dc2626;font-weight:800;">⛔ Caducada ' + esc(p.fechaCaducidad) + '</span>' : '⏱ Hasta ' + esc(p.fechaCaducidad)) : 'Sin caducidad') + '</td>' +
        '<td style="padding:0.55rem;text-align:right;white-space:nowrap;">' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.35rem 0.65rem;font-size:0.75rem;" data-edit-prop="' + esc(p.id) + '">✏️ Editar</button> ' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.35rem 0.65rem;font-size:0.75rem;border-color:#dc2626;color:#dc2626;" data-del-prop="' + esc(p.id) + '">🗑</button>' +
        '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div style="display:grid;gap:1.1rem;">' +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">🏠 ' + (editing ? 'Editar Propiedad (' + esc(editing.codigo) + ')' : 'Publicar Nueva Propiedad') + '</h4>' +
      '<form id="ms-inmo-prop-form" style="display:grid;gap:0.9rem;">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.65rem;">' +
      '<div style="grid-column:span 2;"><label class="ms-sa-label">Título de la publicación *</label><input class="ms-sa-input" name="titulo" required value="' + esc(editing ? editing.titulo : '') + '" placeholder="Ej: Casa 3 dormitorios con pileta y garage doble"></div>' +
      '<div><label class="ms-sa-label">Operación (Pestaña) *</label><select class="ms-sa-select" name="operacion">' +
      '<option value="venta" ' + (!editing || editing.operacion === 'venta' ? 'selected' : '') + '>Ventas</option>' +
      '<option value="alquiler" ' + (editing && editing.operacion === 'alquiler' ? 'selected' : '') + '>Alquileres</option>' +
      '<option value="alquiler_temporario" ' + (editing && editing.operacion === 'alquiler_temporario' ? 'selected' : '') + '>Alquileres Temporarios</option>' +
      '</select></div>' +
      '<div><label class="ms-sa-label">Tipo de Propiedad</label><select class="ms-sa-select" name="tipoPropiedad">' +
      TIPOS_PROPIEDAD.map(function (t) { return '<option value="' + esc(t) + '" ' + (editing && editing.tipoPropiedad === t ? 'selected' : '') + '>' + esc(t) + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="ms-sa-label">Ámbito</label><select class="ms-sa-select" name="ambito"><option value="urbana" ' + (!editing || editing.ambito === 'urbana' ? 'selected' : '') + '>Urbana</option><option value="rural" ' + (editing && editing.ambito === 'rural' ? 'selected' : '') + '>Rural</option></select></div>' +
      '<div><label class="ms-sa-label">Régimen</label><select class="ms-sa-select" name="regimen">' +
      '<option value="propiedad_individual" ' + (!editing || editing.regimen === 'propiedad_individual' ? 'selected' : '') + '>Propiedad Individual</option>' +
      '<option value="propiedad_horizontal" ' + (editing && editing.regimen === 'propiedad_horizontal' ? 'selected' : '') + '>Propiedad Horizontal (PH)</option>' +
      '<option value="condominio" ' + (editing && editing.regimen === 'condominio' ? 'selected' : '') + '>Condominio</option>' +
      '<option value="barrio_privado_country" ' + (editing && editing.regimen === 'barrio_privado_country' ? 'selected' : '') + '>Barrio Privado / Country</option>' +
      '<option value="fideicomiso" ' + (editing && editing.regimen === 'fideicomiso' ? 'selected' : '') + '>Fideicomiso</option>' +
      '</select></div>' +
      '<div><label class="ms-sa-label">Estado Construcción</label><select class="ms-sa-select" name="estadoConstruccion">' +
      '<option value="con_construccion" ' + (!editing || editing.estadoConstruccion === 'con_construccion' ? 'selected' : '') + '>Con construcción</option>' +
      '<option value="sin_construccion" ' + (editing && editing.estadoConstruccion === 'sin_construccion' ? 'selected' : '') + '>Sin construcción</option>' +
      '<option value="en_construccion" ' + (editing && editing.estadoConstruccion === 'en_construccion' ? 'selected' : '') + '>En construcción / Pozo</option>' +
      '<option value="a_reciclar" ' + (editing && editing.estadoConstruccion === 'a_reciclar' ? 'selected' : '') + '>A reciclar</option>' +
      '</select></div>' +
      '<div><label class="ms-sa-label">Moneda</label><select class="ms-sa-select" name="moneda"><option value="USD" ' + (!editing || editing.moneda === 'USD' ? 'selected' : '') + '>USD (Dólares)</option><option value="ARS" ' + (editing && editing.moneda === 'ARS' ? 'selected' : '') + '>ARS (Pesos)</option></select></div>' +
      '<div><label class="ms-sa-label">Precio</label><input type="number" class="ms-sa-input" name="precio" value="' + esc(editing ? editing.precio : 0) + '"></div>' +
      '<div><label class="ms-sa-label">Mostrar Precio o Consulta</label><select class="ms-sa-select" name="mostrarPrecio"><option value="1" ' + (!editing || editing.mostrarPrecio !== false ? 'selected' : '') + '>Mostrar Precio</option><option value="0" ' + (editing && editing.mostrarPrecio === false ? 'selected' : '') + '>Mostrar "Consultar"</option></select></div>' +
      '<div><label class="ms-sa-label">Cartel Cruzado 1ra Foto</label><input list="ms-inmo-ribbons-dl" class="ms-sa-input" name="cartelCruzado" value="' + esc(editing ? editing.cartelCruzado : '') + '" placeholder="Ej: Nuevo Ingreso, Oportunidad..."><datalist id="ms-inmo-ribbons-dl">' +
      etiquetas.map(function (et) { return '<option value="' + esc(et) + '">'; }).join('') +
      '</datalist></div>' +
      '<div><label class="ms-sa-label">Color Cartel Cruzado</label><input type="color" class="ms-sa-input" style="height:40px;padding:4px;" name="cartelColorBg" value="' + esc((editing && editing.cartelColorBg) || '#56D7A1') + '"></div>' +
      '<div><label class="ms-sa-label">Fecha de Caducidad (opcional)</label><input type="date" class="ms-sa-input" name="fechaCaducidad" value="' + esc((editing && editing.fechaCaducidad) || '') + '"></div>' +
      '<div><label class="ms-sa-label">Propietario vinculado (Split)</label><select class="ms-sa-select" name="propietarioId"><option value="">Sin vincular</option>' +
      propietarios.map(function (pr) { return '<option value="' + esc(pr.id) + '" ' + (editing && editing.propietarioId === pr.id ? 'selected' : '') + '>' + esc(pr.nombreCompleto) + '</option>'; }).join('') +
      '</select></div>' +
      '</div>' +

      '<div style="display:flex;flex-wrap:wrap;gap:1rem;padding:0.65rem;background:rgba(86,215,161,0.1);border-radius:10px;font-size:0.82rem;font-weight:700;">' +
      '<label><input type="checkbox" name="destacada" ' + (editing && editing.destacada ? 'checked' : '') + '> ⭐ Mostrar en Carrusel de Destacadas</label>' +
      '<label><input type="checkbox" name="activa" ' + (!editing || editing.activa !== false ? 'checked' : '') + '> ✅ Publicación activa</label>' +
      '<label><input type="checkbox" name="mostrarDireccionExacta" ' + (!editing || editing.mostrarDireccionExacta !== false ? 'checked' : '') + '> 📍 Mostrar dirección exacta</label>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:0.6rem;">' +
      '<div><label class="ms-sa-label">Provincia</label><input class="ms-sa-input" name="provincia" value="' + esc((editing && editing.provincia) || 'CÓRDOBA') + '"></div>' +
      '<div><label class="ms-sa-label">Localidad</label><input class="ms-sa-input" name="localidad" value="' + esc((editing && editing.localidad) || 'RÍO CUARTO') + '"></div>' +
      '<div><label class="ms-sa-label">Barrio / Zona</label><input class="ms-sa-input" name="barrio" value="' + esc((editing && editing.barrio) || '') + '"></div>' +
      '<div><label class="ms-sa-label">Dirección</label><input class="ms-sa-input" name="direccion" value="' + esc((editing && editing.direccion) || '') + '"></div>' +
      '<div><label class="ms-sa-label">Latitud (Google Maps)</label><input class="ms-sa-input" name="lat" value="' + esc(editing && editing.lat != null ? editing.lat : '') + '" placeholder="-33.1232"></div>' +
      '<div><label class="ms-sa-label">Longitud (Google Maps)</label><input class="ms-sa-input" name="lng" value="' + esc(editing && editing.lng != null ? editing.lng : '') + '" placeholder="-64.3493"></div>' +
      '</div>' +

      '<div><label class="ms-sa-label">Descripción completa</label><textarea rows="3" class="ms-sa-input" name="descripcion">' + esc((editing && editing.descripcion) || '') + '</textarea></div>' +

      '<div style="padding:0.85rem;border:1.5px solid #cbd5e1;border-radius:12px;background:#f8fbfc;">' +
      '<div style="font-weight:800;font-size:0.84rem;margin-bottom:0.6rem;color:#112D3A;">⚡ Características Rápidas, Ambientes, Climatización y Garantías</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.55rem;margin-bottom:0.75rem;">' +
      '<div><label class="ms-sa-label">Habitaciones</label><input type="number" min="0" class="ms-sa-input" name="cantidadHabitaciones" value="' + esc(c.cantidadHabitaciones || 0) + '"></div>' +
      '<div><label class="ms-sa-label">Baños</label><input type="number" min="0" class="ms-sa-input" name="cantidadBanos" value="' + esc(c.cantidadBanos || 0) + '"></div>' +
      '<div><label class="ms-sa-label">Vehículos Garage</label><input type="number" min="0" class="ms-sa-input" name="cantidadVehiculosGarage" value="' + esc(c.cantidadVehiculosGarage || 0) + '"></div>' +
      '<div><label class="ms-sa-label">Sup. Total (m²)</label><input type="number" min="0" class="ms-sa-input" name="superficieTotalM2" value="' + esc(c.superficieTotalM2 || '') + '"></div>' +
      '<div><label class="ms-sa-label">Sup. Cubierta (m²)</label><input type="number" min="0" class="ms-sa-input" name="superficieCubiertaM2" value="' + esc(c.superficieCubiertaM2 || '') + '"></div>' +
      '<div><label class="ms-sa-label">Hectáreas (Rural)</label><input type="number" min="0" step="0.1" class="ms-sa-input" name="superficieHectareas" value="' + esc(c.superficieHectareas || '') + '"></div>' +
      '<div><label class="ms-sa-label">Calefacción</label><select class="ms-sa-select" name="tipoCalefaccion">' +
      CALEFACCION_OPTS.map(function (o) { return '<option value="' + esc(o) + '" ' + (c.tipoCalefaccion === o ? 'selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="ms-sa-label">Refrigeración</label><select class="ms-sa-select" name="tipoRefrigeracion">' +
      REFRIGERACION_OPTS.map(function (o) { return '<option value="' + esc(o) + '" ' + (c.tipoRefrigeracion === o ? 'selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="ms-sa-label">Piso (si es Dpto.)</label><input class="ms-sa-input" name="pisoDepartamento" value="' + esc(c.pisoDepartamento || '') + '" placeholder="Ej: 4° Piso"></div>' +
      '<div><label class="ms-sa-label">Expensas ($ ARS)</label><input type="number" class="ms-sa-input" name="expensasMensualesArs" value="' + esc(c.expensasMensualesArs || '') + '"></div>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.75rem;font-size:0.8rem;font-weight:700;margin-bottom:0.75rem;">' +
      [
        ['tieneGarage', '🚗 Garage'],
        ['garageCubierto', 'Garage Cubierto'],
        ['tienePileta', '🏊 Pileta'],
        ['tieneQuincho', '🍖 Quincho'],
        ['tieneCocina', 'Cocina'],
        ['tieneCocinaComedor', 'Cocina-Comedor'],
        ['tieneLavadero', 'Lavadero'],
        ['tieneDependencias', 'Dependencias'],
        ['tieneLiving', 'Living'],
        ['tieneLivingComedor', 'Living-Comedor'],
        ['tienePlacares', 'Con Placares'],
        ['esDepartamento', '🏢 Es Departamento'],
        ['esInterno', 'Es Interno'],
        ['tieneBalcon', '🌇 Tiene Balcón'],
        ['tieneAscensor', 'Ascensor'],
        ['permiteMascotas', '🐾 Mascotas'],
        ['aptoCredito', '🏦 Apto Crédito'],
        ['amoblado', '🛋️ Amoblado']
      ].map(function (pair) {
        return '<label><input type="checkbox" name="' + pair[0] + '" ' + (c[pair[0]] ? 'checked' : '') + '> ' + pair[1] + '</label>';
      }).join('') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.6rem;">' +
      '<div><label class="ms-sa-label">Garantías solicitadas</label><input class="ms-sa-input" name="garantiasSolicitadas" value="' + esc(c.garantiasSolicitadas || '') + '" placeholder="Ej: 1 propietaria + 2 recibos o Caución"></div>' +
      '<div><label class="ms-sa-label">Mes de depósito</label><input class="ms-sa-input" name="mesDeposito" value="' + esc(c.mesDeposito || '') + '" placeholder="Ej: 1 mes de depósito"></div>' +
      '<div><label class="ms-sa-label">Índice de ajuste / Plazo</label><input class="ms-sa-input" name="ajusteContrato" value="' + esc(c.ajusteContrato || '') + '" placeholder="Ej: Trimestral por ICL · 24 meses"></div>' +
      '</div>' +
      '</div>' +

      '<div style="padding:0.75rem;border:1.5px dashed #56D7A1;border-radius:12px;">' +
      '<label class="ms-sa-label">📷 Fotografías de la Propiedad (la 1ra lleva el Cartel Cruzado)</label>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-bottom:0.5rem;">' +
      '<input type="file" id="ms-inmo-prop-fotos-file" accept="image/*" multiple>' +
      '<input class="ms-sa-input" id="ms-inmo-prop-foto-url" style="max-width:300px;" placeholder="O pegar URL https://...">' +
      '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-inmo-add-foto-url">+ Agregar URL</button>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">' + (fotosPreview || '<small style="opacity:0.65;">Aún sin fotos cargadas.</small>') + '</div>' +
      '</div>' +

      '<div style="display:flex;gap:0.5rem;">' +
      '<button type="submit" class="ms-sa-btn">💾 Guardar y Publicar Propiedad</button>' +
      (editing ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-inmo-cancel-prop">Cancelar edición</button>' : '') +
      '</div>' +
      '</form>' +
      '</div>' +

      '<div class="ms-sa-card">' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.65rem;margin-bottom:0.85rem;">' +
      '<input class="ms-sa-input" id="ms-inmo-prop-search" style="max-width:280px;" value="' + esc(STATE.searchProp) + '" placeholder="Buscar propiedad por código, título o barrio...">' +
      '<select class="ms-sa-select" id="ms-inmo-prop-op-filter" style="max-width:220px;">' +
      '<option value="">Todas las operaciones</option>' +
      '<option value="venta" ' + (STATE.filterPropOp === 'venta' ? 'selected' : '') + '>Ventas</option>' +
      '<option value="alquiler" ' + (STATE.filterPropOp === 'alquiler' ? 'selected' : '') + '>Alquileres</option>' +
      '<option value="alquiler_temporario" ' + (STATE.filterPropOp === 'alquiler_temporario' ? 'selected' : '') + '>Alquileres Temporarios</option>' +
      '</select>' +
      '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.84rem;">' +
      '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;"><th style="padding:0.5rem;">Código / Op.</th><th style="padding:0.5rem;">Propiedad</th><th style="padding:0.5rem;">Precio</th><th style="padding:0.5rem;">Estado / Caducidad</th><th style="padding:0.5rem;text-align:right;">Acciones</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="5" style="padding:1.5rem;text-align:center;">Sin propiedades cargadas.</td></tr>') + '</tbody>' +
      '</table></div>' +
      '</div>' +
      '</div>'
    );
  }

  // ---------------- SUBMÓDULO 3: CLIENTES (MISMO ESQUEMA QUE REGISTRO WEB) ----------------
  function renderClientesView() {
    var list = STATE.data.clientes || [];
    var editing = STATE.editingClienteId
      ? list.find(function (c) { return c.id === STATE.editingClienteId; })
      : null;
    var provincias = (STATE.catalogs && STATE.catalogs.provincias) || ['CÓRDOBA'];
    var selProv = (editing && editing.provincia) || 'CÓRDOBA';
    var locs = ((STATE.catalogs && STATE.catalogs.localidadesPorProvincia) || {})[selProv] || [];

    var rows = list.filter(function (c) {
      if (!STATE.searchCliente) return true;
      var q = STATE.searchCliente.toLowerCase();
      return [c.nombreCompleto, c.nroDoc, c.email, c.localidad, c.rol].join(' ').toLowerCase().indexOf(q) !== -1;
    }).map(function (c) {
      return (
        '<tr style="border-bottom:1px solid #e2ecf0;">' +
        '<td style="padding:0.55rem;"><strong>' + esc(c.nombreCompleto) + '</strong><br><small>' + esc(c.tipoDoc) + ' ' + esc(c.nroDoc) + (c.cuitCuil ? ' · CUIT ' + esc(c.cuitCuil) : '') + '</small></td>' +
        '<td style="padding:0.55rem;"><span class="ms-sa-pill">' + esc(c.rol) + '</span><br><small>' + (c.origen === 'web' ? '🌐 Registro Web' : '🏢 Cargado Admin') + '</small></td>' +
        '<td style="padding:0.55rem;font-size:0.8rem;">' + esc(c.email || '—') + '<br>' + esc(c.whatsappCompleto || '') + '</td>' +
        '<td style="padding:0.55rem;font-size:0.8rem;">' + esc(c.domicilio || '') + '<br><small>' + esc(c.localidad || '') + ', ' + esc(c.provincia || '') + '</small></td>' +
        '<td style="padding:0.55rem;text-align:right;white-space:nowrap;">' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.35rem 0.65rem;font-size:0.75rem;" data-edit-cli="' + esc(c.id) + '">✏️ Editar</button> ' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.35rem 0.65rem;font-size:0.75rem;border-color:#dc2626;color:#dc2626;" data-del-cli="' + esc(c.id) + '">🗑</button>' +
        '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div style="display:grid;gap:1.1rem;">' +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">👥 ' + (editing ? 'Editar Cliente' : 'Alta de Cliente (Inquilino / Propietario — mismos datos que Registro Web)') + '</h4>' +
      '<form id="ms-inmo-cli-form" style="display:grid;gap:0.75rem;">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:0.6rem;">' +
      '<div><label class="ms-sa-label">Rol *</label><select class="ms-sa-select" name="rol">' +
      '<option value="inquilino" ' + (!editing || editing.rol === 'inquilino' ? 'selected' : '') + '>Inquilino</option>' +
      '<option value="propietario" ' + (editing && editing.rol === 'propietario' ? 'selected' : '') + '>Propietario / Locador</option>' +
      '<option value="ambos" ' + (editing && editing.rol === 'ambos' ? 'selected' : '') + '>Inquilino y Propietario</option>' +
      '</select></div>' +
      '<div><label class="ms-sa-label">Apellido(s) *</label><input class="ms-sa-input" name="apellidos" required value="' + esc(editing ? editing.apellidos : '') + '"></div>' +
      '<div><label class="ms-sa-label">Nombre(s) *</label><input class="ms-sa-input" name="nombres" required value="' + esc(editing ? editing.nombres : '') + '"></div>' +
      '<div><label class="ms-sa-label">Tipo Doc.</label><select class="ms-sa-select" name="tipoDoc"><option value="DNI">DNI</option><option value="CUIT">CUIT</option><option value="CUIL">CUIL</option></select></div>' +
      '<div><label class="ms-sa-label">N° Documento *</label><input class="ms-sa-input" name="nroDoc" required value="' + esc(editing ? editing.nroDoc : '') + '"></div>' +
      '<div><label class="ms-sa-label">CUIT / CUIL</label><input class="ms-sa-input" name="cuitCuil" value="' + esc(editing ? editing.cuitCuil : '') + '"></div>' +
      '<div><label class="ms-sa-label">Provincia</label><select class="ms-sa-select" name="provincia" id="ms-inmo-cli-prov">' +
      provincias.map(function (pr) { return '<option value="' + esc(pr) + '" ' + (selProv === pr ? 'selected' : '') + '>' + esc(pr) + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="ms-sa-label">Localidad</label><input list="ms-inmo-cli-locs-dl" class="ms-sa-input" name="localidad" value="' + esc((editing && editing.localidad) || 'RÍO CUARTO') + '"><datalist id="ms-inmo-cli-locs-dl">' +
      locs.map(function (l) { return '<option value="' + esc(l.nombre) + '">'; }).join('') +
      '</datalist></div>' +
      '<div><label class="ms-sa-label">Calle</label><input class="ms-sa-input" name="domicilioCalle" value="' + esc(editing ? editing.domicilioCalle : '') + '"></div>' +
      '<div><label class="ms-sa-label">Número</label><input class="ms-sa-input" name="domicilioNumero" value="' + esc(editing ? editing.domicilioNumero : '') + '"></div>' +
      '<div><label class="ms-sa-label">Barrio</label><input class="ms-sa-input" name="domicilioBarrio" value="' + esc(editing ? editing.domicilioBarrio : '') + '"></div>' +
      '<div><label class="ms-sa-label">País WhatsApp</label><select class="ms-sa-select" name="whatsappPrefijo">' +
      WA_COUNTRIES.map(function (w) { return '<option value="' + esc(w.prefix) + '" ' + (editing && editing.whatsappPrefijo === w.prefix ? 'selected' : '') + '>' + esc(w.label) + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="ms-sa-label">N° WhatsApp</label><input class="ms-sa-input" name="whatsappNumero" value="' + esc(editing ? editing.whatsappNumero : '') + '" placeholder="3585095475"></div>' +
      '<div><label class="ms-sa-label">Correo Electrónico *</label><input type="email" class="ms-sa-input" name="email" required value="' + esc(editing ? editing.email : '') + '"></div>' +
      '<div><label class="ms-sa-label">Clave Portal (opcional)</label><input type="password" class="ms-sa-input" name="password" placeholder="Dejar vacío para conservar"></div>' +
      '<div><label class="ms-sa-label">CBU / Alias (Propietario Split)</label><input class="ms-sa-input" name="cbuAlias" value="' + esc(editing ? editing.cbuAlias : '') + '" placeholder="Para liquidación propietario"></div>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;">' +
      '<button type="submit" class="ms-sa-btn">💾 Guardar Cliente</button>' +
      (editing ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-inmo-cancel-cli">Cancelar</button>' : '') +
      '</div>' +
      '</form>' +
      '</div>' +
      '<div class="ms-sa-card">' +
      '<input class="ms-sa-input" id="ms-inmo-cli-search" style="max-width:320px;margin-bottom:0.8rem;" value="' + esc(STATE.searchCliente) + '" placeholder="Buscar cliente por nombre, DNI o email...">' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.84rem;">' +
      '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;"><th style="padding:0.5rem;">Cliente</th><th style="padding:0.5rem;">Rol / Origen</th><th style="padding:0.5rem;">Contacto</th><th style="padding:0.5rem;">Ubicación</th><th style="padding:0.5rem;text-align:right;">Acción</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="5" style="padding:1.5rem;text-align:center;">Sin clientes registrados aún.</td></tr>') + '</tbody>' +
      '</table></div>' +
      '</div>' +
      '</div>'
    );
  }

  // ---------------- SUBMÓDULO 4: MODELOS DE CONTRATOS CON CAMPOS AUTOMÁTICOS ----------------
  function renderPlantillasView() {
    var list = STATE.data.plantillasContrato || [];
    var editing = STATE.editingPlantillaId
      ? list.find(function (t) { return t.id === STATE.editingPlantillaId; })
      : null;

    var placeholderBtns = (STATE.placeholders || []).map(function (ph) {
      return (
        '<button type="button" data-insert-ph="' + esc(ph.key) + '" title="' + esc(ph.desc) + '" style="padding:0.25rem 0.5rem;border-radius:8px;border:1px solid #56D7A1;background:rgba(86,215,161,0.14);color:#112D3A;font-size:0.72rem;font-weight:800;cursor:pointer;">' +
        esc(ph.key) +
        '</button>'
      );
    }).join('');

    var cards = list.map(function (t) {
      return (
        '<div class="ms-sa-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">' +
        '<div><strong>' + esc(t.nombre) + '</strong> <span class="ms-sa-pill">' + esc(t.tipoOperacion) + '</span><br><small style="opacity:0.78;">' + esc(t.descripcion || '') + '</small></div>' +
        '<div style="display:flex;gap:0.4rem;">' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" data-edit-tpl="' + esc(t.id) + '">✏️ Editar Modelo</button>' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="border-color:#dc2626;color:#dc2626;" data-del-tpl="' + esc(t.id) + '">🗑</button>' +
        '</div>' +
        '</div>'
      );
    }).join('');

    return (
      '<div style="display:grid;gap:1.1rem;">' +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">📝 ' + (editing ? 'Editar Modelo de Contrato' : 'Nuevo Modelo / Plantilla de Contrato Editable') + '</h4>' +
      '<form id="ms-inmo-tpl-form" style="display:grid;gap:0.75rem;">' +
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:0.65rem;">' +
      '<div><label class="ms-sa-label">Nombre del Modelo *</label><input class="ms-sa-input" name="nombre" required value="' + esc(editing ? editing.nombre : '') + '" placeholder="Ej: Contrato de Alquiler Comercial"></div>' +
      '<div><label class="ms-sa-label">Tipo</label><select class="ms-sa-select" name="tipoOperacion">' +
      '<option value="alquiler" ' + (!editing || editing.tipoOperacion === 'alquiler' ? 'selected' : '') + '>Alquiler Vivienda / Comercial</option>' +
      '<option value="alquiler_temporario" ' + (editing && editing.tipoOperacion === 'alquiler_temporario' ? 'selected' : '') + '>Alquiler Temporario</option>' +
      '<option value="boleto_compraventa" ' + (editing && editing.tipoOperacion === 'boleto_compraventa' ? 'selected' : '') + '>Boleto de Compraventa / Reserva</option>' +
      '<option value="otro" ' + (editing && editing.tipoOperacion === 'otro' ? 'selected' : '') + '>Otro</option>' +
      '</select></div>' +
      '</div>' +
      '<div><label class="ms-sa-label">Descripción breve</label><input class="ms-sa-input" name="descripcion" value="' + esc(editing ? editing.descripcion : '') + '"></div>' +
      '<div><label class="ms-sa-label">⚡ Insertar Campos Automáticos (se completan solos con los datos del cliente web/admin y la propiedad)</label>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-bottom:0.5rem;">' + placeholderBtns + '</div>' +
      '<textarea rows="12" class="ms-sa-input" id="ms-inmo-tpl-html" name="contenidoHtml" style="font-family:monospace;font-size:0.8rem;">' + esc(editing ? editing.contenidoHtml : '') + '</textarea></div>' +
      '<div style="display:flex;gap:0.5rem;">' +
      '<button type="submit" class="ms-sa-btn">💾 Guardar Modelo de Contrato</button>' +
      (editing ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-inmo-cancel-tpl">Cancelar</button>' : '') +
      '</div>' +
      '</form>' +
      '</div>' +
      '<div style="display:grid;gap:0.75rem;">' + cards + '</div>' +
      '</div>'
    );
  }

  // ---------------- SUBMÓDULO 5: CONTRATOS, PDFs Y CUENTA CORRIENTE ----------------
  function renderContratosView() {
    var contratos = STATE.data.contratos || [];
    var clientes = STATE.data.clientes || [];
    var props = STATE.data.propiedades || [];
    var plantillas = STATE.data.plantillasContrato || [];
    var cfg = STATE.data.portalConfig || {};
    var editing = STATE.editingContratoId
      ? contratos.find(function (c) { return c.id === STATE.editingContratoId; })
      : null;

    var viewingCta = STATE.viewingContratoCtaId
      ? contratos.find(function (c) { return c.id === STATE.viewingContratoCtaId; })
      : null;

    var ctaHtml = '';
    if (viewingCta) {
      var qRows = (viewingCta.cuotas || []).map(function (q) {
        return (
          '<tr style="border-bottom:1px solid #e2ecf0;">' +
          '<td style="padding:0.45rem;">#' + esc(q.numeroCuota) + ' · ' + esc(q.concepto) + '</td>' +
          '<td style="padding:0.45rem;">' + esc(q.vencimiento) + '</td>' +
          '<td style="padding:0.45rem;font-weight:800;text-align:right;">' + fmtMoney(q.montoTotal, q.moneda) + '</td>' +
          '<td style="padding:0.45rem;text-align:right;color:#065f46;font-weight:700;">' + fmtMoney(q.montoPropietario, q.moneda) + ' (' + esc(q.propietarioPct) + '%)</td>' +
          '<td style="padding:0.45rem;text-align:right;font-weight:700;">' + fmtMoney(q.montoInmobiliaria, q.moneda) + ' (' + esc(q.inmobiliariaPct) + '%)</td>' +
          '<td style="padding:0.45rem;"><span class="ms-sa-pill">' + esc(q.estado) + '</span></td>' +
          '<td style="padding:0.45rem;text-align:right;">' +
          (q.estado === 'pagado'
            ? '<small style="color:#065f46;font-weight:800;">✅ ' + esc(q.comprobanteRef || 'Pagado') + '</small>'
            : '<button type="button" class="ms-sa-btn" style="padding:0.3rem 0.65rem;font-size:0.74rem;" data-mark-cuota-paid="' + esc(viewingCta.id) + '|' + esc(q.id) + '">✓ Marcar Pagado</button>') +
          '</td>' +
          '</tr>'
        );
      }).join('');
      ctaHtml =
        '<div class="ms-sa-card" style="border:2px solid #56D7A1;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">' +
        '<h4 style="margin:0;">💳 Cuenta Corriente · ' + esc(viewingCta.codigo) + ' (' + esc(viewingCta.inquilinoNombre) + ')</h4>' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-inmo-close-cta">✕ Cerrar Cta. Cte.</button>' +
        '</div>' +
        '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.82rem;">' +
        '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;"><th style="padding:0.45rem;">Período</th><th style="padding:0.45rem;">Vto.</th><th style="padding:0.45rem;text-align:right;">Total</th><th style="padding:0.45rem;text-align:right;">Propietario</th><th style="padding:0.45rem;text-align:right;">Inmobiliaria</th><th style="padding:0.45rem;">Estado</th><th style="padding:0.45rem;text-align:right;">Acción</th></tr></thead>' +
        '<tbody>' + qRows + '</tbody>' +
        '</table></div>' +
        '</div>';
    }

    var rows = contratos.map(function (c) {
      return (
        '<tr style="border-bottom:1px solid #e2ecf0;">' +
        '<td style="padding:0.55rem;"><strong>' + esc(c.codigo) + '</strong><br><span class="ms-sa-pill">' + esc(c.estado) + '</span></td>' +
        '<td style="padding:0.55rem;"><strong>' + esc(c.inquilinoNombre) + '</strong><br><small>Propietario: ' + esc(c.propietarioNombre) + '</small></td>' +
        '<td style="padding:0.55rem;font-size:0.8rem;">' + esc(c.propiedadTitulo) + '<br><small>' + esc(c.fechaInicio) + ' → ' + esc(c.fechaFin) + ' (' + esc(c.duracionMeses) + 'm)</small></td>' +
        '<td style="padding:0.55rem;font-weight:800;">' + fmtMoney(c.valorMensualActual, c.moneda) + '<br><small>Split ' + esc(c.propietarioPct) + '% / ' + esc(c.inmobiliariaPct) + '%</small></td>' +
        '<td style="padding:0.55rem;text-align:right;white-space:nowrap;">' +
        '<button type="button" class="ms-sa-btn" style="padding:0.35rem 0.65rem;font-size:0.74rem;" data-open-cta="' + esc(c.id) + '">💳 Cta. Cte.</button> ' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.35rem 0.65rem;font-size:0.74rem;" data-print-ctr="' + esc(c.id) + '">🖨️ PDF</button> ' +
        '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.35rem 0.65rem;font-size:0.74rem;border-color:#dc2626;color:#dc2626;" data-del-ctr="' + esc(c.id) + '">🗑</button>' +
        '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div style="display:grid;gap:1.1rem;">' +
      ctaHtml +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">📄 Generar Contrato Automático (compila datos del cliente + propiedad + PDF + Cuenta Corriente Split)</h4>' +
      '<form id="ms-inmo-ctr-form" style="display:grid;gap:0.75rem;">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.6rem;">' +
      '<div><label class="ms-sa-label">Modelo de Contrato</label><select class="ms-sa-select" name="plantillaId">' +
      plantillas.map(function (t) { return '<option value="' + esc(t.id) + '" ' + (editing && editing.plantillaId === t.id ? 'selected' : '') + '>' + esc(t.nombre) + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="ms-sa-label">Cliente / Inquilino *</label><select class="ms-sa-select" name="inquilinoId" required><option value="">Seleccionar cliente...</option>' +
      clientes.map(function (cl) { return '<option value="' + esc(cl.id) + '" ' + (editing && editing.inquilinoId === cl.id ? 'selected' : '') + '>' + esc(cl.nombreCompleto) + ' (DNI ' + esc(cl.nroDoc) + ')</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="ms-sa-label">Propietario / Locador</label><select class="ms-sa-select" name="propietarioId"><option value="">Seleccionar propietario...</option>' +
      clientes.map(function (cl) { return '<option value="' + esc(cl.id) + '" ' + (editing && editing.propietarioId === cl.id ? 'selected' : '') + '>' + esc(cl.nombreCompleto) + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="ms-sa-label">Propiedad</label><select class="ms-sa-select" name="propiedadId"><option value="">Seleccionar propiedad...</option>' +
      props.map(function (pr) { return '<option value="' + esc(pr.id) + '" ' + (editing && editing.propiedadId === pr.id ? 'selected' : '') + '>' + esc(pr.codigo) + ' · ' + esc(pr.titulo) + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="ms-sa-label">Fecha Inicio *</label><input type="date" class="ms-sa-input" name="fechaInicio" required value="' + esc((editing && editing.fechaInicio) || new Date().toISOString().slice(0, 10)) + '"></div>' +
      '<div><label class="ms-sa-label">Fecha Fin *</label><input type="date" class="ms-sa-input" name="fechaFin" required value="' + esc((editing && editing.fechaFin) || '') + '"></div>' +
      '<div><label class="ms-sa-label">Duración (meses)</label><input type="number" min="1" max="60" class="ms-sa-input" name="duracionMeses" value="' + esc((editing && editing.duracionMeses) || 24) + '"></div>' +
      '<div><label class="ms-sa-label">Moneda</label><select class="ms-sa-select" name="moneda"><option value="ARS">ARS ($)</option><option value="USD">USD</option></select></div>' +
      '<div><label class="ms-sa-label">Valor Mensual *</label><input type="number" class="ms-sa-input" name="valorMensualActual" required value="' + esc((editing && editing.valorMensualActual) || 0) + '"></div>' +
      '<div><label class="ms-sa-label">% Comisión Inmobiliaria (Split)</label><input type="number" min="0" max="100" step="0.5" class="ms-sa-input" name="inmobiliariaPct" value="' + esc((editing && editing.inmobiliariaPct) ?? (cfg.defaultInmobiliariaPct ?? 10)) + '"></div>' +
      '<div><label class="ms-sa-label">Índice de Ajuste</label><input class="ms-sa-input" name="indiceAjuste" value="' + esc((editing && editing.indiceAjuste) || 'Trimestral por ICL') + '"></div>' +
      '<div><label class="ms-sa-label">Mes de Depósito</label><input class="ms-sa-input" name="mesDeposito" value="' + esc((editing && editing.mesDeposito) || '1 mes de depósito') + '"></div>' +
      '</div>' +
      '<div><label class="ms-sa-label">Adjuntar PDF firmado (opcional — también se genera PDF automático del modelo)</label><input type="file" id="ms-inmo-ctr-pdf" accept="application/pdf,.pdf"></div>' +
      '<button type="submit" class="ms-sa-btn">💾 Generar Contrato + Cuenta Corriente + Split</button>' +
      '</form>' +
      '</div>' +
      '<div class="ms-sa-card">' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.84rem;">' +
      '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;"><th style="padding:0.5rem;">Código / Estado</th><th style="padding:0.5rem;">Inquilino / Propietario</th><th style="padding:0.5rem;">Propiedad / Vigencia</th><th style="padding:0.5rem;">Valor / Split</th><th style="padding:0.5rem;text-align:right;">Acciones</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="5" style="padding:1.5rem;text-align:center;">Aún no hay contratos cargados.</td></tr>') + '</tbody>' +
      '</table></div>' +
      '</div>' +
      '</div>'
    );
  }

  // ---------------- SUBMÓDULO 6: PAGOS SPLIT (MODALIDAD REIKIONLINE) ----------------
  function renderPagosSplitView() {
    var txs = STATE.data.transaccionesSplit || [];
    var cfg = STATE.data.portalConfig || {};
    var rows = txs.map(function (t) {
      return (
        '<tr style="border-bottom:1px solid #e2ecf0;">' +
        '<td style="padding:0.5rem;"><strong>' + esc(t.contratoCodigo) + '</strong><br><small>' + esc(t.periodo) + '</small></td>' +
        '<td style="padding:0.5rem;">' + esc(t.inquilinoNombre) + '<br><small>Prop.: ' + esc(t.propietarioNombre) + '</small></td>' +
        '<td style="padding:0.5rem;font-weight:800;text-align:right;">' + fmtMoney(t.montoTotal, t.moneda) + '</td>' +
        '<td style="padding:0.5rem;text-align:right;color:#065f46;font-weight:800;">' + fmtMoney(t.montoPropietario, t.moneda) + ' (' + esc(t.propietarioPct) + '%)</td>' +
        '<td style="padding:0.5rem;text-align:right;font-weight:800;">' + fmtMoney(t.montoInmobiliaria, t.moneda) + ' (' + esc(t.inmobiliariaPct) + '%)</td>' +
        '<td style="padding:0.5rem;"><span class="ms-sa-pill">' + esc(t.status) + '</span></td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div style="display:grid;gap:1.1rem;">' +
      '<div class="ms-sa-card ms-sa-card--highlight">' +
      '<div style="font-size:0.78rem;font-weight:800;color:#56D7A1;">MODALIDAD SPLIT REIKIONLINE · MERCADO PAGO</div>' +
      '<h3 style="margin:0.3rem 0;color:#FFFFFF;">Distribución por defecto: ' + esc(cfg.defaultPropietarioPct ?? 90) + '% Propietario / ' + esc(cfg.defaultInmobiliariaPct ?? 10) + '% Inmobiliaria</h3>' +
      '<div style="font-size:0.84rem;color:#d1fae5;">Total cobrado: <strong>' + fmtMoney(STATE.stats.totalCobradoSplit || 0, 'ARS') + '</strong> · Honorarios Inmobiliaria: <strong>' + fmtMoney(STATE.stats.totalHonorariosInmo || 0, 'ARS') + '</strong></div>' +
      '</div>' +
      '<div class="ms-sa-card">' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.84rem;">' +
      '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;"><th style="padding:0.5rem;">Contrato</th><th style="padding:0.5rem;">Partes</th><th style="padding:0.5rem;text-align:right;">Total</th><th style="padding:0.5rem;text-align:right;">Al Propietario</th><th style="padding:0.5rem;text-align:right;">A Inmobiliaria</th><th style="padding:0.5rem;">Estado</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="6" style="padding:1.5rem;text-align:center;">Sin transacciones Split registradas aún.</td></tr>') + '</tbody>' +
      '</table></div>' +
      '</div>' +
      '</div>'
    );
  }

  // ---------------- SUBMÓDULO 7: CONSULTAS, VISITAS Y LEADS ----------------
  function renderConsultasView() {
    var list = STATE.data.consultas || [];
    var rows = list.map(function (q) {
      return (
        '<tr style="border-bottom:1px solid #e2ecf0;">' +
        '<td style="padding:0.55rem;"><strong>' + esc(q.nombre) + '</strong><br><small>' + esc(q.whatsapp) + ' · ' + esc(q.email) + '</small></td>' +
        '<td style="padding:0.55rem;"><strong>' + esc(q.propiedadCodigo || '') + ' ' + esc(q.propiedadTitulo || 'Consulta general') + '</strong><br><small>' + esc(q.mensaje) + '</small></td>' +
        '<td style="padding:0.55rem;font-size:0.8rem;">' + esc(q.fechaVisitaDeseada || 'Sin fecha') + '</td>' +
        '<td style="padding:0.55rem;"><select class="ms-sa-select" data-lead-estado="' + esc(q.id) + '" style="width:auto;padding:0.3rem 0.5rem;font-size:0.78rem;">' +
        ['nueva', 'contactada', 'visita_agendada', 'cerrada'].map(function (st) {
          return '<option value="' + st + '" ' + (q.estado === st ? 'selected' : '') + '>' + st + '</option>';
        }).join('') +
        '</select></td>' +
        '</tr>'
      );
    }).join('');
    return (
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">📩 Consultas y Solicitudes de Visita Web</h4>' +
      '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.84rem;">' +
      '<thead><tr style="text-align:left;border-bottom:2px solid #56D7A1;"><th style="padding:0.5rem;">Interesado</th><th style="padding:0.5rem;">Propiedad / Mensaje</th><th style="padding:0.5rem;">Visita</th><th style="padding:0.5rem;">Estado</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="4" style="padding:1.5rem;text-align:center;">Sin consultas recibidas aún.</td></tr>') + '</tbody>' +
      '</table></div>' +
      '</div>'
    );
  }

  // ---------------- SUBMÓDULO 8: PORTAL WEB, QR Y CONFIGURACIÓN ----------------
  function renderPortalConfigView() {
    var cfg = STATE.data.portalConfig || {};
    var fullUrl = STATE.publicUrl.indexOf('http') === 0 ? STATE.publicUrl : window.location.origin + STATE.publicUrl;
    var qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&ecc=M&margin=2&data=' + encodeURIComponent(fullUrl);
    return (
      '<div style="display:grid;gap:1.1rem;">' +
      '<div class="ms-sa-grid">' +
      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">🌐 Enlace Público del Marketplace Inmobiliario</h4>' +
      '<input class="ms-sa-input" readonly value="' + esc(fullUrl) + '" onclick="this.select()" style="font-weight:800;margin-bottom:0.75rem;">' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
      '<a href="' + esc(fullUrl) + '" target="_blank" class="ms-sa-btn">Abrir /inmobiliaria ↗</a>' +
      '<button type="button" class="ms-sa-btn ms-sa-btn--dark" id="ms-inmo-copy-url" data-url="' + esc(fullUrl) + '">📋 Copiar Enlace</button>' +
      '</div>' +
      '</div>' +
      '<div class="ms-sa-card" style="text-align:center;">' +
      '<h4 style="margin-top:0;">📱 Código QR para Vidriera y Cartelería</h4>' +
      '<img src="' + esc(qrSrc) + '" alt="QR Inmobiliaria" style="width:170px;height:170px;border-radius:12px;border:2px solid #56D7A1;padding:6px;background:#fff;">' +
      '</div>' +
      '</div>' +

      '<div class="ms-sa-card">' +
      '<h4 style="margin-top:0;">⚙️ Configuración General, Split por Defecto, Etiquetas y Google Sign-In</h4>' +
      '<form id="ms-inmo-cfg-form" style="display:grid;gap:0.75rem;">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.65rem;">' +
      '<div><label class="ms-sa-label">Título del Portal</label><input class="ms-sa-input" name="tituloPortal" value="' + esc(cfg.tituloPortal || '') + '"></div>' +
      '<div><label class="ms-sa-label">Matrícula Corredor (CPI / CUCICBA)</label><input class="ms-sa-input" name="matriculaCorredor" value="' + esc(cfg.matriculaCorredor || '') + '"></div>' +
      '<div><label class="ms-sa-label">WhatsApp Fijo (con código país)</label><input class="ms-sa-input" name="whatsappNumero" value="' + esc(cfg.whatsappNumero || '') + '"></div>' +
      '<div><label class="ms-sa-label">Email de Contacto</label><input class="ms-sa-input" name="emailContacto" value="' + esc(cfg.emailContacto || '') + '"></div>' +
      '<div><label class="ms-sa-label">Dirección de Oficina</label><input class="ms-sa-input" name="direccionOficina" value="' + esc(cfg.direccionOficina || '') + '"></div>' +
      '<div><label class="ms-sa-label">Vínculo Google Maps</label><input class="ms-sa-input" name="googleMapsUrl" value="' + esc(cfg.googleMapsUrl || '') + '" placeholder="https://www.google.com/maps/..."></div>' +
      '<div><label class="ms-sa-label">Horarios de Atención</label><input class="ms-sa-input" name="horariosAtencion" value="' + esc(cfg.horariosAtencion || '') + '"></div>' +
      '<div><label class="ms-sa-label">Instagram (URL)</label><input class="ms-sa-input" name="instagramUrl" value="' + esc(cfg.instagramUrl || '') + '" placeholder="https://www.instagram.com/..."></div>' +
      '<div><label class="ms-sa-label">Instagram (Usuario visible)</label><input class="ms-sa-input" name="instagramLabel" value="' + esc(cfg.instagramLabel || '') + '"></div>' +
      '<div><label class="ms-sa-label">Facebook (URL)</label><input class="ms-sa-input" name="facebookUrl" value="' + esc(cfg.facebookUrl || '') + '" placeholder="https://www.facebook.com/..."></div>' +
      '<div><label class="ms-sa-label">Facebook (Nombre visible)</label><input class="ms-sa-input" name="facebookLabel" value="' + esc(cfg.facebookLabel || '') + '"></div>' +
      '<div><label class="ms-sa-label">% Comisión Inmobiliaria por Defecto (Split)</label><input type="number" min="0" max="100" step="0.5" class="ms-sa-input" name="defaultInmobiliariaPct" value="' + esc(cfg.defaultInmobiliariaPct ?? 10) + '"></div>' +
      '<div><label class="ms-sa-label">Google OAuth Client ID (Acceso Clientes)</label><input class="ms-sa-input" name="googleClientId" value="' + esc(cfg.googleClientId || '') + '" placeholder="xxx.apps.googleusercontent.com"></div>' +
      '</div>' +
      '<div><label class="ms-sa-label">Carteles Cruzados disponibles (separados por coma)</label><input class="ms-sa-input" name="etiquetasPersonalizadas" value="' + esc((cfg.etiquetasPersonalizadas || []).join(', ')) + '"></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:1rem;font-size:0.82rem;font-weight:700;">' +
      '<label><input type="checkbox" name="habilitarIaBuscador" ' + (cfg.habilitarIaBuscador !== false ? 'checked' : '') + '> ✨ Activar Motor de Búsqueda con IA</label>' +
      '<label><input type="checkbox" name="habilitarCalculadoraCredito" ' + (cfg.habilitarCalculadoraCredito !== false ? 'checked' : '') + '> 🏦 Activar Simulador de Crédito</label>' +
      '<label><input type="checkbox" name="habilitarComparador" ' + (cfg.habilitarComparador !== false ? 'checked' : '') + '> ⚖️ Activar Comparador de Propiedades</label>' +
      '</div>' +
      '<button type="submit" class="ms-sa-btn">💾 Guardar Configuración</button>' +
      '</form>' +
      '</div>' +
      '</div>'
    );
  }

  function renderWorkspace() {
    var bodyEl = document.getElementById('ms-inmo-body');
    if (!bodyEl) return;
    if (STATE.activeView === 'banners') bodyEl.innerHTML = renderBannersView();
    else if (STATE.activeView === 'propiedades') bodyEl.innerHTML = renderPropiedadesView();
    else if (STATE.activeView === 'clientes') bodyEl.innerHTML = renderClientesView();
    else if (STATE.activeView === 'plantillas') bodyEl.innerHTML = renderPlantillasView();
    else if (STATE.activeView === 'contratos') bodyEl.innerHTML = renderContratosView();
    else if (STATE.activeView === 'pagos_split') bodyEl.innerHTML = renderPagosSplitView();
    else if (STATE.activeView === 'consultas') bodyEl.innerHTML = renderConsultasView();
    else if (STATE.activeView === 'portal') bodyEl.innerHTML = renderPortalConfigView();
    bindWorkspaceEvents(bodyEl);
  }

  function bindWorkspaceEvents(bodyEl) {
    // --- BANNERS ---
    var bnFile = bodyEl.querySelector('#ms-inmo-banner-file');
    if (bnFile) {
      bnFile.addEventListener('change', async function () {
        if (bnFile.files && bnFile.files[0]) {
          STATE.bannerDraftImg = await readFileAsDataUrl(bnFile.files[0]);
          showToast('Imagen de banner cargada en memoria. Presioná Guardar Banner.', false);
        }
      });
    }
    var bnForm = bodyEl.querySelector('#ms-inmo-banner-form');
    if (bnForm) {
      bnForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(bnForm);
        var res = await apiInmo('POST', {
          action: 'save_banner',
          banner: {
            id: STATE.editingBannerId,
            titulo: fd.get('titulo'),
            subtitulo: fd.get('subtitulo'),
            linkUrl: fd.get('linkUrl'),
            ctaLabel: fd.get('ctaLabel'),
            orden: Number(fd.get('orden') || 1),
            imageUrl: fd.get('imageUrl'),
            imageBase64: STATE.bannerDraftImg,
            activo: bnForm.querySelector('[name="activo"]').checked
          }
        });
        if (res && res.ok) {
          STATE.editingBannerId = null;
          STATE.bannerDraftImg = '';
          showToast(res.message, false);
          await reloadData(true);
        } else showToast((res && res.message) || 'Error guardando banner', true);
      });
    }
    var cancelBn = bodyEl.querySelector('#ms-inmo-cancel-banner');
    if (cancelBn) cancelBn.addEventListener('click', function () { STATE.editingBannerId = null; STATE.bannerDraftImg = ''; renderWorkspace(); });
    bodyEl.querySelectorAll('[data-edit-banner]').forEach(function (btn) {
      btn.addEventListener('click', function () { STATE.editingBannerId = btn.getAttribute('data-edit-banner'); STATE.bannerDraftImg = ''; renderWorkspace(); });
    });
    bodyEl.querySelectorAll('[data-del-banner]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar este banner?')) return;
        await apiInmo('POST', { action: 'delete_banner', id: btn.getAttribute('data-del-banner') });
        await reloadData(true);
      });
    });

    // --- PROPIEDADES ---
    var propFile = bodyEl.querySelector('#ms-inmo-prop-fotos-file');
    if (propFile) {
      propFile.addEventListener('change', async function () {
        var files = Array.from(propFile.files || []);
        for (var i = 0; i < files.length; i++) {
          var b64 = await readFileAsDataUrl(files[i]);
          STATE.propDraftFotos.push(b64);
        }
        renderWorkspace();
      });
    }
    var addFotoUrlBtn = bodyEl.querySelector('#ms-inmo-add-foto-url');
    if (addFotoUrlBtn) {
      addFotoUrlBtn.addEventListener('click', function () {
        var inp = bodyEl.querySelector('#ms-inmo-prop-foto-url');
        if (inp && inp.value.trim()) {
          STATE.propDraftFotos.push(inp.value.trim());
          renderWorkspace();
        }
      });
    }
    bodyEl.querySelectorAll('[data-rm-prop-foto]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = Number(btn.getAttribute('data-rm-prop-foto'));
        STATE.propDraftFotos.splice(idx, 1);
        renderWorkspace();
      });
    });
    var propForm = bodyEl.querySelector('#ms-inmo-prop-form');
    if (propForm) {
      propForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(propForm);
        var chk = function (n) { var el = propForm.querySelector('[name="' + n + '"]'); return Boolean(el && el.checked); };
        var res = await apiInmo('POST', {
          action: 'save_propiedad',
          propiedad: {
            id: STATE.editingPropId,
            titulo: fd.get('titulo'),
            descripcion: fd.get('descripcion'),
            operacion: fd.get('operacion'),
            tipoPropiedad: fd.get('tipoPropiedad'),
            ambito: fd.get('ambito'),
            regimen: fd.get('regimen'),
            estadoConstruccion: fd.get('estadoConstruccion'),
            moneda: fd.get('moneda'),
            precio: Number(fd.get('precio') || 0),
            mostrarPrecio: fd.get('mostrarPrecio') !== '0',
            cartelCruzado: fd.get('cartelCruzado'),
            cartelColorBg: fd.get('cartelColorBg'),
            fechaCaducidad: fd.get('fechaCaducidad') || null,
            propietarioId: fd.get('propietarioId') || null,
            destacada: chk('destacada'),
            activa: chk('activa'),
            mostrarDireccionExacta: chk('mostrarDireccionExacta'),
            provincia: fd.get('provincia'),
            localidad: fd.get('localidad'),
            barrio: fd.get('barrio'),
            direccion: fd.get('direccion'),
            lat: fd.get('lat'),
            lng: fd.get('lng'),
            fotos: STATE.propDraftFotos,
            caracteristicas: {
              cantidadHabitaciones: Number(fd.get('cantidadHabitaciones') || 0),
              cantidadBanos: Number(fd.get('cantidadBanos') || 0),
              cantidadVehiculosGarage: Number(fd.get('cantidadVehiculosGarage') || 0),
              superficieTotalM2: fd.get('superficieTotalM2'),
              superficieCubiertaM2: fd.get('superficieCubiertaM2'),
              superficieHectareas: fd.get('superficieHectareas'),
              tipoCalefaccion: fd.get('tipoCalefaccion'),
              tipoRefrigeracion: fd.get('tipoRefrigeracion'),
              pisoDepartamento: fd.get('pisoDepartamento'),
              expensasMensualesArs: fd.get('expensasMensualesArs'),
              garantiasSolicitadas: fd.get('garantiasSolicitadas'),
              mesDeposito: fd.get('mesDeposito'),
              ajusteContrato: fd.get('ajusteContrato'),
              tieneGarage: chk('tieneGarage'),
              garageCubierto: chk('garageCubierto'),
              tienePileta: chk('tienePileta'),
              tieneQuincho: chk('tieneQuincho'),
              tieneCocina: chk('tieneCocina'),
              tieneCocinaComedor: chk('tieneCocinaComedor'),
              tieneLavadero: chk('tieneLavadero'),
              tieneDependencias: chk('tieneDependencias'),
              tieneLiving: chk('tieneLiving'),
              tieneLivingComedor: chk('tieneLivingComedor'),
              tienePlacares: chk('tienePlacares'),
              esDepartamento: chk('esDepartamento'),
              esInterno: chk('esInterno'),
              tieneBalcon: chk('tieneBalcon'),
              tieneAscensor: chk('tieneAscensor'),
              permiteMascotas: chk('permiteMascotas'),
              aptoCredito: chk('aptoCredito'),
              amoblado: chk('amoblado')
            }
          }
        });
        if (res && res.ok) {
          STATE.editingPropId = null;
          STATE.propDraftFotos = [];
          showToast(res.message, false);
          await reloadData(true);
        } else showToast((res && res.message) || 'Error guardando propiedad', true);
      });
    }
    var cancelProp = bodyEl.querySelector('#ms-inmo-cancel-prop');
    if (cancelProp) cancelProp.addEventListener('click', function () { STATE.editingPropId = null; STATE.propDraftFotos = []; renderWorkspace(); });
    bodyEl.querySelectorAll('[data-edit-prop]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-edit-prop');
        var found = (STATE.data.propiedades || []).find(function (x) { return x.id === id; });
        STATE.editingPropId = id;
        STATE.propDraftFotos = found && Array.isArray(found.fotos) ? found.fotos.slice() : [];
        renderWorkspace();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    bodyEl.querySelectorAll('[data-del-prop]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar esta propiedad?')) return;
        await apiInmo('POST', { action: 'delete_propiedad', id: btn.getAttribute('data-del-prop') });
        await reloadData(true);
      });
    });
    var propSearch = bodyEl.querySelector('#ms-inmo-prop-search');
    if (propSearch) {
      propSearch.addEventListener('input', function () {
        STATE.searchProp = propSearch.value;
        renderWorkspace();
        var el = document.getElementById('ms-inmo-prop-search');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
    }
    var propOpSel = bodyEl.querySelector('#ms-inmo-prop-op-filter');
    if (propOpSel) propOpSel.addEventListener('change', function () { STATE.filterPropOp = propOpSel.value; renderWorkspace(); });

    // --- CLIENTES ---
    var cliForm = bodyEl.querySelector('#ms-inmo-cli-form');
    if (cliForm) {
      cliForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(cliForm);
        var res = await apiInmo('POST', {
          action: 'save_cliente',
          cliente: {
            id: STATE.editingClienteId,
            rol: fd.get('rol'),
            apellidos: fd.get('apellidos'),
            nombres: fd.get('nombres'),
            tipoDoc: fd.get('tipoDoc'),
            nroDoc: fd.get('nroDoc'),
            cuitCuil: fd.get('cuitCuil'),
            provincia: fd.get('provincia'),
            localidad: fd.get('localidad'),
            domicilioCalle: fd.get('domicilioCalle'),
            domicilioNumero: fd.get('domicilioNumero'),
            domicilioBarrio: fd.get('domicilioBarrio'),
            whatsappPrefijo: fd.get('whatsappPrefijo'),
            whatsappNumero: fd.get('whatsappNumero'),
            email: fd.get('email'),
            password: fd.get('password'),
            cbuAlias: fd.get('cbuAlias')
          }
        });
        if (res && res.ok) {
          STATE.editingClienteId = null;
          showToast(res.message, false);
          await reloadData(true);
        } else showToast((res && res.message) || 'Error guardando cliente', true);
      });
    }
    var cancelCli = bodyEl.querySelector('#ms-inmo-cancel-cli');
    if (cancelCli) cancelCli.addEventListener('click', function () { STATE.editingClienteId = null; renderWorkspace(); });
    bodyEl.querySelectorAll('[data-edit-cli]').forEach(function (btn) {
      btn.addEventListener('click', function () { STATE.editingClienteId = btn.getAttribute('data-edit-cli'); renderWorkspace(); });
    });
    bodyEl.querySelectorAll('[data-del-cli]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar cliente?')) return;
        await apiInmo('POST', { action: 'delete_cliente', id: btn.getAttribute('data-del-cli') });
        await reloadData(true);
      });
    });
    var cliSearch = bodyEl.querySelector('#ms-inmo-cli-search');
    if (cliSearch) {
      cliSearch.addEventListener('input', function () {
        STATE.searchCliente = cliSearch.value;
        renderWorkspace();
        var el = document.getElementById('ms-inmo-cli-search');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
    }

    // --- PLANTILLAS ---
    bodyEl.querySelectorAll('[data-insert-ph]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ta = bodyEl.querySelector('#ms-inmo-tpl-html');
        if (!ta) return;
        var token = btn.getAttribute('data-insert-ph');
        var start = ta.selectionStart || ta.value.length;
        ta.value = ta.value.slice(0, start) + token + ta.value.slice(ta.selectionEnd || start);
        ta.focus();
      });
    });
    var tplForm = bodyEl.querySelector('#ms-inmo-tpl-form');
    if (tplForm) {
      tplForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(tplForm);
        var res = await apiInmo('POST', {
          action: 'save_plantilla',
          plantilla: {
            id: STATE.editingPlantillaId,
            nombre: fd.get('nombre'),
            tipoOperacion: fd.get('tipoOperacion'),
            descripcion: fd.get('descripcion'),
            contenidoHtml: fd.get('contenidoHtml')
          }
        });
        if (res && res.ok) {
          STATE.editingPlantillaId = null;
          showToast(res.message, false);
          await reloadData(true);
        } else showToast((res && res.message) || 'Error guardando plantilla', true);
      });
    }
    var cancelTpl = bodyEl.querySelector('#ms-inmo-cancel-tpl');
    if (cancelTpl) cancelTpl.addEventListener('click', function () { STATE.editingPlantillaId = null; renderWorkspace(); });
    bodyEl.querySelectorAll('[data-edit-tpl]').forEach(function (btn) {
      btn.addEventListener('click', function () { STATE.editingPlantillaId = btn.getAttribute('data-edit-tpl'); renderWorkspace(); });
    });
    bodyEl.querySelectorAll('[data-del-tpl]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar plantilla?')) return;
        await apiInmo('POST', { action: 'delete_plantilla', id: btn.getAttribute('data-del-tpl') });
        await reloadData(true);
      });
    });

    // --- CONTRATOS ---
    var ctrPdf = bodyEl.querySelector('#ms-inmo-ctr-pdf');
    if (ctrPdf) {
      ctrPdf.addEventListener('change', async function () {
        if (ctrPdf.files && ctrPdf.files[0]) {
          STATE.contratoDraftPdfB64 = await readFileAsDataUrl(ctrPdf.files[0]);
          STATE.contratoDraftPdfName = ctrPdf.files[0].name;
          showToast('PDF adjuntado listo para guardar con el contrato.', false);
        }
      });
    }
    var ctrForm = bodyEl.querySelector('#ms-inmo-ctr-form');
    if (ctrForm) {
      ctrForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(ctrForm);
        var res = await apiInmo('POST', {
          action: 'save_contrato',
          contrato: {
            id: STATE.editingContratoId,
            plantillaId: fd.get('plantillaId'),
            inquilinoId: fd.get('inquilinoId'),
            propietarioId: fd.get('propietarioId'),
            propiedadId: fd.get('propiedadId'),
            fechaInicio: fd.get('fechaInicio'),
            fechaFin: fd.get('fechaFin'),
            duracionMeses: Number(fd.get('duracionMeses') || 24),
            moneda: fd.get('moneda'),
            valorMensualActual: Number(fd.get('valorMensualActual') || 0),
            inmobiliariaPct: Number(fd.get('inmobiliariaPct') || 10),
            indiceAjuste: fd.get('indiceAjuste'),
            mesDeposito: fd.get('mesDeposito'),
            pdfBase64: STATE.contratoDraftPdfB64,
            pdfNombreOriginal: STATE.contratoDraftPdfName
          }
        });
        if (res && res.ok) {
          STATE.editingContratoId = null;
          STATE.contratoDraftPdfB64 = '';
          STATE.contratoDraftPdfName = '';
          showToast(res.message, false);
          await reloadData(true);
        } else showToast((res && res.message) || 'Error guardando contrato', true);
      });
    }
    bodyEl.querySelectorAll('[data-open-cta]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        STATE.viewingContratoCtaId = btn.getAttribute('data-open-cta');
        renderWorkspace();
      });
    });
    var closeCta = bodyEl.querySelector('#ms-inmo-close-cta');
    if (closeCta) closeCta.addEventListener('click', function () { STATE.viewingContratoCtaId = null; renderWorkspace(); });
    bodyEl.querySelectorAll('[data-mark-cuota-paid]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var parts = String(btn.getAttribute('data-mark-cuota-paid') || '').split('|');
        var res = await apiInmo('POST', { action: 'mark_cuota_paid', contratoId: parts[0], cuotaId: parts[1] });
        if (res && res.ok) {
          showToast(res.message, false);
          await reloadData(true);
        }
      });
    });
    bodyEl.querySelectorAll('[data-print-ctr]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-print-ctr');
        var ctr = (STATE.data.contratos || []).find(function (x) { return x.id === id; });
        if (!ctr) return;
        if (ctr.pdfUrl) { window.open(ctr.pdfUrl, '_blank'); return; }
        var win = window.open('', '_blank', 'width=900,height=780');
        if (!win) return;
        win.document.write('<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8"><title>' + esc(ctr.codigo) + '</title></head><body style="padding:28px;">' + (ctr.contenidoCompiladoHtml || '') + '<script>window.onload=function(){window.print();};</script></body></html>');
        win.document.close();
      });
    });
    bodyEl.querySelectorAll('[data-del-ctr]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!window.confirm('¿Eliminar este contrato?')) return;
        await apiInmo('POST', { action: 'delete_contrato', id: btn.getAttribute('data-del-ctr') });
        await reloadData(true);
      });
    });

    // --- CONSULTAS ---
    bodyEl.querySelectorAll('[data-lead-estado]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        await apiInmo('POST', {
          action: 'update_consulta_estado',
          id: sel.getAttribute('data-lead-estado'),
          estado: sel.value
        });
        showToast('Estado de consulta actualizado.', false);
      });
    });

    // --- PORTAL CONFIG ---
    var copyBtn = bodyEl.querySelector('#ms-inmo-copy-url');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (navigator.clipboard) navigator.clipboard.writeText(copyBtn.getAttribute('data-url') || '');
        showToast('Enlace /inmobiliaria copiado al portapapeles.', false);
      });
    }
    var cfgForm = bodyEl.querySelector('#ms-inmo-cfg-form');
    if (cfgForm) {
      cfgForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(cfgForm);
        var res = await apiInmo('POST', {
          action: 'save_portal_config',
          portalConfig: {
            tituloPortal: fd.get('tituloPortal'),
            matriculaCorredor: fd.get('matriculaCorredor'),
            whatsappNumero: fd.get('whatsappNumero'),
            emailContacto: fd.get('emailContacto'),
            direccionOficina: fd.get('direccionOficina'),
            googleMapsUrl: fd.get('googleMapsUrl'),
            horariosAtencion: fd.get('horariosAtencion'),
            instagramUrl: fd.get('instagramUrl'),
            instagramLabel: fd.get('instagramLabel'),
            facebookUrl: fd.get('facebookUrl'),
            facebookLabel: fd.get('facebookLabel'),
            defaultInmobiliariaPct: Number(fd.get('defaultInmobiliariaPct') || 10),
            googleClientId: fd.get('googleClientId'),
            etiquetasPersonalizadas: fd.get('etiquetasPersonalizadas'),
            habilitarIaBuscador: cfgForm.querySelector('[name="habilitarIaBuscador"]').checked,
            habilitarCalculadoraCredito: cfgForm.querySelector('[name="habilitarCalculadoraCredito"]').checked,
            habilitarComparador: cfgForm.querySelector('[name="habilitarComparador"]').checked
          }
        });
        if (res && res.ok) {
          showToast(res.message, false);
          await reloadData(true);
        } else showToast((res && res.message) || 'Error guardando configuración', true);
      });
    }
  }

  function bindGlobalNav() {
    if (window.__MS_INMO_NAV_BOUND__) return;
    window.__MS_INMO_NAV_BOUND__ = true;
    document.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || typeof t.closest !== 'function') return;
      var navTrigger = t.closest('#topbar-home-btn, #btn-topbar-back-facturacion, [data-open-section], #ms-superadmin-home-card, #ms-cv-home-card, #ms-turnos-home-card');
      if (navTrigger) {
        var m = document.getElementById('sec-menu-inmobiliaria');
        var w = document.getElementById('sec-inmobiliaria-workspace');
        var isActive = (m && !m.hidden) || (w && !w.hidden);

        if (navTrigger.id === 'btn-topbar-back-facturacion' && isActive) {
          ev.preventDefault();
          ev.stopPropagation();
          if (w && !w.hidden) {
            openInmoView('menu');
          } else {
            closeToHome();
          }
          return;
        }
        if (m) m.hidden = true;
        if (w) w.hidden = true;
      }
    }, true);
  }

  var initialLoaded = false;
  function syncHomeCard() {
    bindGlobalNav();
    var allowed = isModuleAllowed();
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existing = document.getElementById('ms-inmo-home-card');

    if (allowed && inicioGrid && !existing) {
      var card = document.createElement('article');
      card.id = 'ms-inmo-home-card';
      card.className = 'module-card';
      card.setAttribute('data-module-key', 'inmobiliaria');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:0.35rem;">' +
          '<div class="module-icon" aria-hidden="true" style="margin:0;">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>' +
              '<polyline points="9 22 9 12 15 12 15 22"></polyline>' +
            '</svg>' +
          '</div>' +
          '<span id="ms-inmo-home-pill" style="background:rgba(86,215,161,0.18);color:#112D3A;font-size:0.7rem;font-weight:800;padding:0.2rem 0.55rem;border-radius:999px;">PORTAL</span>' +
        '</div>' +
        '<h3>Inmobiliaria</h3>';

      card.addEventListener('click', function () { openInmoView('menu'); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openInmoView('menu'); }
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
