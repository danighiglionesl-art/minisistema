/* ==========================================================================
   PANEL EXCLUSIVO DEL ADMINISTRADOR GENERAL (@danielg) — MINISISTEMA ERP
   1. Habilitación de nuevos comercios:
      - Opción 1: www.nuevoerp.com.ar/sistema (Dominio propio Vercel+GitHub + Marca propia)
      - Opción 2: www.minisistema.com.ar/nuevosistema (Subruta + Marca MiniSistema)
   2. Habilitación de Administradores y Usuarios por comercio.
   3. Módulo de Obtención de Valor Mensual, Descuentos (Temporales ej. 3 meses o
      Permanentes) y Adhesión a Débito Automático con Mercado Pago.
   ========================================================================== */
(function () {
  'use strict';

  var STATE_SA = {
    activeTab: 'tenants',
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
      var raw = sessionStorage.getItem(pfx + 'erp_active_admin_v1') || localStorage.getItem(pfx + 'erp_active_admin_v1');
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

  function ensureDialogMounted() {
    var existing = document.getElementById('ms-superadmin-dialog');
    if (existing) return existing;

    var dlg = document.createElement('dialog');
    dlg.id = 'ms-superadmin-dialog';
    dlg.className = 'ms-sa-dialog';
    dlg.innerHTML =
      '<div class="ms-sa-header">' +
        '<div style="display:flex;align-items:center;gap:0.85rem;">' +
          '<img src="/sistema/assets/img/minisistema/logo-symbol.png" alt="MiniSistema" style="width:40px;height:40px;border-radius:10px;background:#fff;padding:3px;object-fit:contain;">' +
          '<div>' +
            '<div style="font-size:1.1rem;font-weight:800;color:#FFFFFF;">Panel de Administrador General · @danielg</div>' +
            '<div style="font-size:0.78rem;color:#56D7A1;">Comercialización Multi-Sistema · Supabase Independiente · Abonos Mercado Pago</div>' +
          '</div>' +
        '</div>' +
        '<button type="button" id="ms-sa-close-btn" class="ms-sa-btn" style="padding:0.45rem 0.85rem;">✕ Cerrar</button>' +
      '</div>' +
      '<div class="ms-sa-tabs" id="ms-sa-tabs">' +
        '<button type="button" class="ms-sa-tab is-active" data-tab="tenants">🏢 Comercios Habilitados</button>' +
        '<button type="button" class="ms-sa-tab" data-tab="new">🚀 Habilitar Nuevo Sistema (Opción 1 / 2)</button>' +
        '<button type="button" class="ms-sa-tab" data-tab="pricing">💳 Valor Mensual, Descuentos y Mercado Pago</button>' +
        '<button type="button" class="ms-sa-tab" data-tab="secrets">🔐 Credenciales API (MP · GitHub · Vercel)</button>' +
      '</div>' +
      '<div id="ms-sa-feedback" style="display:none;margin:0.85rem 1.5rem 0;padding:0.75rem 1rem;border-radius:10px;font-weight:700;font-size:0.86rem;"></div>' +
      '<div class="ms-sa-body" id="ms-sa-body">Cargando datos...</div>';

    document.body.appendChild(dlg);

    dlg.querySelector('#ms-sa-close-btn').addEventListener('click', function () {
      dlg.close();
    });

    dlg.addEventListener('click', function (ev) {
      if (ev.target === dlg) dlg.close();
    });

    dlg.querySelector('#ms-sa-tabs').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-tab]');
      if (!btn) return;
      STATE_SA.activeTab = btn.getAttribute('data-tab');
      STATE_SA.managingUsersSlug = null;
      syncTabsUi();
      renderBody();
    });

    return dlg;
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

  function syncTabsUi() {
    var tabs = document.querySelectorAll('#ms-sa-tabs [data-tab]');
    tabs.forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-tab') === STATE_SA.activeTab);
    });
  }

  async function openSuperAdminModal(initialTab) {
    if (initialTab) STATE_SA.activeTab = initialTab;
    var dlg = ensureDialogMounted();
    syncTabsUi();
    if (!dlg.open) dlg.showModal();
    await reloadSuperAdminData();
  }

  async function reloadSuperAdminData() {
    var bodyEl = document.getElementById('ms-sa-body');
    if (bodyEl && !STATE_SA.data) {
      bodyEl.innerHTML = '<p style="font-weight:700;">Conectando con Supabase (minisistema-erp)...</p>';
    }
    var json = await apiSuperAdmin('GET');
    if (!json || !json.ok) {
      if (bodyEl) {
        bodyEl.innerHTML = '<p style="color:#991b1b;font-weight:700;">' + esc((json && json.message) || 'No se pudo cargar el panel.') + '</p>';
      }
      return;
    }
    STATE_SA.data = json;
    if (Object.keys(STATE_SA.quoteSelected).length === 0 && Array.isArray(json.commercialModules)) {
      json.commercialModules.forEach(function (m) {
        if (['facturacion', 'articulos', 'clientes'].indexOf(m.key) !== -1) {
          STATE_SA.quoteSelected[m.key] = true;
        }
      });
    }
    renderBody();
  }

  function computeLocalQuote(optionType, selectedMap, modDiscountMap, globalType, globalPct, globalFixed, tempMonths) {
    var data = STATE_SA.data;
    if (!data) return { optionBase: 0, modTotal: 0, subtotal: 0, promoMonthly: 0, regularMonthly: 0 };
    var cfg = data.pricingConfig || {};
    var optionBase = Number(optionType === 1 ? cfg.option_1_base : cfg.option_2_base) || 0;
    var modTotal = 0;
    (data.commercialModules || []).forEach(function (m) {
      if (!selectedMap[m.key]) return;
      var baseP = Number((cfg.module_prices && cfg.module_prices[m.key] && cfg.module_prices[m.key].price) ?? m.defaultMonthlyArs) || 0;
      var discP = Math.min(100, Math.max(0, Number(modDiscountMap[m.key] || 0)));
      modTotal += Math.round(baseP * (1 - discP / 100));
    });
    var subtotal = Math.round(optionBase + modTotal);
    var gPct = Math.min(100, Math.max(0, Number(globalPct || 0)));
    var gFix = Math.max(0, Number(globalFixed || 0));
    var discounted = Math.max(0, Math.round(subtotal * (1 - gPct / 100) - gFix));

    if (globalType === 'permanent') {
      return { optionBase: optionBase, modTotal: modTotal, subtotal: subtotal, promoMonthly: discounted, regularMonthly: discounted, months: 0 };
    }
    if (globalType === 'temporary') {
      return { optionBase: optionBase, modTotal: modTotal, subtotal: subtotal, promoMonthly: discounted, regularMonthly: subtotal, months: Math.max(1, Number(tempMonths || 3)) };
    }
    return { optionBase: optionBase, modTotal: modTotal, subtotal: subtotal, promoMonthly: subtotal, regularMonthly: subtotal, months: 0 };
  }

  function renderTenantsTab() {
    var d = STATE_SA.data;
    var tenants = (d && d.tenants) || [];

    if (STATE_SA.managingUsersSlug) {
      var targetT = tenants.find(function (x) { return x.slug === STATE_SA.managingUsersSlug; });
      var rowsHtml = STATE_SA.managingUsersList.map(function (u) {
        var isDaniel = String(u.username).toLowerCase() === 'danielg';
        return '<tr style="border-bottom:1px solid #e2ecf0;">' +
          '<td style="padding:0.55rem;"><strong>' + esc(u.name) + '</strong><br><small>@' + esc(u.username) + '</small></td>' +
          '<td style="padding:0.55rem;"><span class="ms-sa-pill">' + esc(u.role) + '</span></td>' +
          '<td style="padding:0.55rem;"><code>' + esc(isDaniel ? '••••••••' : (u.pass || '')) + '</code></td>' +
          '<td style="padding:0.55rem;">' + (u.active !== false ? '🟢 Habilitado' : '⛔ Suspendido') + '</td>' +
          '<td style="padding:0.55rem;">' +
            (isDaniel ? '<small>Fijo (Admin. General)</small>' :
              '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.3rem 0.65rem;font-size:0.76rem;" data-del-tuser="' + esc(u.username) + '">Dar de baja</button>') +
          '</td>' +
        '</tr>';
      }).join('');

      return '<div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">' +
          '<h3 style="margin:0;">👥 Habilitar Administradores y Usuarios — ' + esc(targetT ? targetT.fantasy_name : STATE_SA.managingUsersSlug) + '</h3>' +
          '<button type="button" class="ms-sa-btn ms-sa-btn--outline" id="ms-sa-back-tenants">← Volver a Comercios</button>' +
        '</div>' +
        '<div class="ms-sa-grid">' +
          '<div class="ms-sa-card">' +
            '<h4 style="margin-top:0;">Usuarios del Sistema (Esquema <code>' + esc(targetT ? targetT.db_schema : '') + '</code>)</h4>' +
            '<table style="width:100%;border-collapse:collapse;font-size:0.86rem;">' +
              '<thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:0.45rem;">Usuario</th><th style="padding:0.45rem;">Jerarquía</th><th style="padding:0.45rem;">Clave</th><th style="padding:0.45rem;">Estado</th><th style="padding:0.45rem;">Acción</th></tr></thead>' +
              '<tbody>' + rowsHtml + '</tbody>' +
            '</table>' +
          '</div>' +
          '<div class="ms-sa-card">' +
            '<h4 style="margin-top:0;">➕ Habilitar / Actualizar Administrador o Usuario</h4>' +
            '<p style="font-size:0.8rem;color:#3d5a68;margin-top:0;">Como Administrador General (@danielg), podés habilitar el <strong>Administrador</strong> del comercio (quien luego podrá habilitar a sus propios Usuarios) o crear Usuarios directamente.</p>' +
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
      '</div>';
    }

    var cards = tenants.map(function (t) {
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
        ? 'https://wa.me/?text=' + encodeURIComponent('¡Hola! Ya habilitamos el sistema ERP de ' + t.fantasy_name + ' (' + dep.publicErpUrl + '). Te compartimos el enlace de adhesión al abono mensual por débito automático de Mercado Pago (' + fmtArs.format(sub.activeMonthlyAmount || 0) + '/mes): ' + sub.mpInitPoint)
        : '';

      return '<div class="ms-sa-card" style="display:flex;flex-direction:column;justify-content:space-between;gap:0.85rem;">' +
        '<div>' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">' +
            '<div>' +
              '<div style="font-size:1.05rem;font-weight:800;color:#112D3A;">' + esc(t.fantasy_name) + '</div>' +
              '<div style="font-size:0.78rem;color:#486575;">' + esc(optBadge) + '</div>' +
            '</div>' +
            mpBadge +
          '</div>' +
          '<div style="margin-top:0.7rem;padding:0.65rem;background:#f4f8fa;border-radius:10px;font-size:0.8rem;display:grid;gap:0.28rem;">' +
            '<div><strong>BD Supabase independiente:</strong> <code>' + esc(t.db_schema) + '</code></div>' +
            '<div><strong>URL Sistema:</strong> <a href="' + esc(dep.publicErpUrl || '/sistema') + '" target="_blank" style="color:#0d5c3e;font-weight:700;">' + esc(dep.publicErpUrl || '/sistema') + '</a></div>' +
            (t.is_base ? '' : '<div><strong>Abono Mensual:</strong> ' + fmtArs.format(sub.activeMonthlyAmount || 0) + '/mes' +
              (sub.globalDiscountType === 'temporary' && sub.temporaryMonths > 0 ? ' <small>(Promo ' + sub.temporaryMonths + 'm · luego ' + fmtArs.format(sub.monthlyRegularAmount || 0) + ')</small>' : '') +
            '</div>') +
            (dep.githubRepoUrl ? '<div><strong>GitHub:</strong> <a href="' + esc(dep.githubRepoUrl) + '" target="_blank">' + esc(dep.githubRepoUrl) + '</a></div>' : '') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:0.45rem;">' +
          '<a class="ms-sa-btn" style="padding:0.42rem 0.75rem;font-size:0.78rem;" href="' + esc(dep.publicErpUrl || '/sistema') + '" target="_blank">Abrir ERP</a>' +
          '<button type="button" class="ms-sa-btn ms-sa-btn--dark" style="padding:0.42rem 0.75rem;font-size:0.78rem;" data-manage-users="' + esc(t.slug) + '">👥 Admin / Usuarios</button>' +
          (t.is_base ? '' :
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.42rem 0.75rem;font-size:0.78rem;" data-gen-mp="' + esc(t.slug) + '">💳 Link Débito MP</button>' +
            (sub.mpInitPoint ? '<a class="ms-sa-btn ms-sa-btn--outline" style="padding:0.42rem 0.75rem;font-size:0.78rem;" href="' + esc(sub.mpInitPoint) + '" target="_blank">Ver Adhesión</a>' : '') +
            (waMsg ? '<a class="ms-sa-btn ms-sa-btn--outline" style="padding:0.42rem 0.75rem;font-size:0.78rem;" href="' + esc(waMsg) + '" target="_blank">📲 Enviar WA</a>' : '') +
            (t.option_type === 1 ? '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.42rem 0.75rem;font-size:0.78rem;" data-reprov-opt1="' + esc(t.slug) + '">🔗 Vercel+GitHub</button>' : '') +
            '<button type="button" class="ms-sa-btn ms-sa-btn--outline" style="padding:0.42rem 0.75rem;font-size:0.78rem;" data-toggle-status="' + esc(t.slug) + '" data-curr-status="' + esc(t.status) + '">' + (t.status === 'active' ? '⏸ Suspender' : '▶ Reactivar') + '</button>'
          ) +
        '</div>' +
      '</div>';
    }).join('');

    return '<div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.6rem;">' +
        '<div>' +
          '<h3 style="margin:0;">Sistemas y Comercios Habilitados (' + tenants.length + ')</h3>' +
          '<p style="margin:0.2rem 0 0;font-size:0.83rem;color:#4a6675;">Cada sistema opera con su propio esquema PostgreSQL aislado en Supabase (inicializado limpio con Artículo 00020 y Consumidor Final).</p>' +
        '</div>' +
        '<button type="button" class="ms-sa-btn" id="ms-sa-go-new">+ Habilitar Nuevo Comercio</button>' +
      '</div>' +
      '<div class="ms-sa-grid">' + cards + '</div>' +
    '</div>';
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

    var modsChecks = mods.map(function (m) {
      var checked = Boolean(STATE_SA.quoteSelected[m.key]);
      var cfgP = Number((d.pricingConfig.module_prices && d.pricingConfig.module_prices[m.key] && d.pricingConfig.module_prices[m.key].price) ?? m.defaultMonthlyArs);
      return '<label style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.5rem 0.65rem;border:1px solid #d4e2e8;border-radius:9px;background:' + (checked ? '#eefbf5' : '#fff') + ';cursor:pointer;font-size:0.83rem;">' +
        '<span><input type="checkbox" data-new-mod="' + esc(m.key) + '" ' + (checked ? 'checked' : '') + '> <strong>' + esc(m.name) + '</strong></span>' +
        '<span style="font-weight:800;color:#112D3A;">' + fmtArs.format(cfgP) + '</span>' +
      '</label>';
    }).join('');

    return '<form id="ms-sa-create-tenant-form" style="display:grid;gap:1.1rem;">' +
      '<div class="ms-sa-grid">' +
        '<div class="ms-sa-card" style="border-width:2px;border-color:' + (STATE_SA.newOptionType === 1 ? '#56D7A1' : '#dbe7ec') + ';cursor:pointer;" data-pick-opt="1">' +
          '<div style="font-weight:800;font-size:1rem;">🌐 Opción 1: <code>www.nuevoerp.com.ar/sistema</code></div>' +
          '<p style="font-size:0.82rem;color:#415f6e;margin:0.35rem 0 0;">Incluye <strong>dominio propio en Vercel + repositorio GitHub</strong> e <strong>imagen corporativa propia</strong> (colores y logotipos del comercio).</p>' +
        '</div>' +
        '<div class="ms-sa-card" style="border-width:2px;border-color:' + (STATE_SA.newOptionType === 2 ? '#56D7A1' : '#dbe7ec') + ';cursor:pointer;" data-pick-opt="2">' +
          '<div style="font-weight:800;font-size:1rem;">⚡ Opción 2: <code>www.minisistema.com.ar/nuevosistema</code></div>' +
          '<p style="font-size:0.82rem;color:#415f6e;margin:0.35rem 0 0;">Alojado directo bajo <code>minisistema.com.ar</code>. <strong>Sin dominio propio ni imagen corporativa propia</strong> (conserva colores y logo de MiniSistema).</p>' +
        '</div>' +
      '</div>' +

      '<div class="ms-sa-grid">' +
        '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">1. Datos del Comercio y Ruta</h4>' +
          '<div style="display:grid;gap:0.7rem;">' +
            '<div><label class="ms-sa-label">Identificador corto (slug sin espacios)</label><input class="ms-sa-input" name="slug" required placeholder="ej: superalberdi o ferreteriasur"></div>' +
            '<div><label class="ms-sa-label">Nombre Comercial / Fantasía</label><input class="ms-sa-input" name="fantasyName" required placeholder="Ej: Despensa El Sol"></div>' +
            '<div><label class="ms-sa-label">Razón Social / Titular</label><input class="ms-sa-input" name="businessName" required placeholder="Ej: Despensa El Sol S.A.S."></div>' +
            (STATE_SA.newOptionType === 1 ?
              '<div><label class="ms-sa-label">Dominio Propio (Opción 1 — Vercel + GitHub)</label><input class="ms-sa-input" name="customDomain" required placeholder="www.nuevoerp.com.ar"></div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">' +
                '<div><label class="ms-sa-label">Color Principal Comercio</label><input type="color" class="ms-sa-input" name="primaryHex" value="#112D3A" style="height:40px;padding:3px;"></div>' +
                '<div><label class="ms-sa-label">Color Acento Comercio</label><input type="color" class="ms-sa-input" name="accentHex" value="#56D7A1" style="height:40px;padding:3px;"></div>' +
              '</div>' +
              '<div><label class="ms-sa-label">Logo 1x1 (URL o subir PNG/JPG)</label><input class="ms-sa-input" name="logo1x1Url" placeholder="https://... o seleccioná archivo abajo"><input type="file" accept="image/*" id="ms-sa-file-logo1x1" style="margin-top:0.3rem;font-size:0.76rem;"></div>' +
              '<div><label class="ms-sa-label">Logo Horizontal Cabecera (URL o subir PNG/JPG)</label><input class="ms-sa-input" name="logoHorizontalUrl" placeholder="https://... o seleccioná archivo abajo"><input type="file" accept="image/*" id="ms-sa-file-logohoriz" style="margin-top:0.3rem;font-size:0.76rem;"></div>'
              :
              '<div style="padding:0.65rem;border-radius:9px;background:#eefbf5;font-size:0.8rem;color:#0b5336;">✓ <strong>Identidad MiniSistema activa:</strong> usará automáticamente Azul Petróleo <code>#112D3A</code>, Verde Menta <code>#56D7A1</code> e isologotipo oficial de MiniSistema.</div>'
            ) +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;">' +
              '<div><label class="ms-sa-label">Localidad</label><input class="ms-sa-input" name="localidad" value="RÍO CUARTO"></div>' +
              '<div><label class="ms-sa-label">WhatsApp Comercio</label><input class="ms-sa-input" name="whatsappDigits" placeholder="549358..."></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">2. Administrador del Comercio + Base Limpia</h4>' +
          '<p style="font-size:0.8rem;color:#415f6e;margin-top:0;">Se creará automáticamente con <strong>@danielg</strong> como Administrador General + el siguiente <strong>Administrador</strong> habilitado para el cliente (solo Artículo <code>00020</code> y <code>CONSUMIDOR FINAL</code> en BD):</p>' +
          '<div style="display:grid;gap:0.65rem;">' +
            '<div><label class="ms-sa-label">Usuario Administrador del Comercio</label><input class="ms-sa-input" name="adminUsername" placeholder="ej: adminsol (opcional)"></div>' +
            '<div><label class="ms-sa-label">Contraseña Inicial del Administrador</label><input class="ms-sa-input" name="adminPassword" placeholder="Mínimo 4 caracteres"></div>' +
            '<div><label class="ms-sa-label">Nombre del Administrador</label><input class="ms-sa-input" name="adminName" placeholder="Ej: Carlos Gómez"></div>' +
            '<div><label class="ms-sa-label">Email Pagador Mercado Pago (Débito Automático)</label><input type="email" class="ms-sa-input" name="payerEmail" required placeholder="cliente@comercio.com.ar"></div>' +
          '</div>' +
          '<div class="ms-sa-card ms-sa-card--highlight" style="margin-top:0.9rem;">' +
            '<div style="font-size:0.78rem;color:#56D7A1;font-weight:800;">ABONO MENSUAL CALCULADO (MERCADO PAGO)</div>' +
            '<div style="font-size:1.75rem;font-weight:900;margin:0.2rem 0;">' + fmtArs.format(quote.promoMonthly) + ' <span style="font-size:0.9rem;font-weight:500;">/ mes</span></div>' +
            (quote.months > 0 ? '<div style="font-size:0.8rem;color:#d1fae5;">Promoción por <strong>' + quote.months + ' meses</strong> · Luego: ' + fmtArs.format(quote.regularMonthly) + '/mes</div>' : '') +
            '<div style="font-size:0.76rem;color:rgba(255,255,255,0.75);margin-top:0.35rem;">Podés ajustar módulos y descuentos acá abajo o en la pestaña "Valor Mensual".</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="ms-sa-card">' +
        '<h4 style="margin-top:0;">3. Módulos Contratados y Descuento del Abono</h4>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:0.5rem;margin-bottom:0.9rem;">' + modsChecks + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.7rem;align-items:end;">' +
          '<div><label class="ms-sa-label">Tipo de Descuento</label><select class="ms-sa-select" id="ms-new-disc-type">' +
            '<option value="none" ' + (STATE_SA.quoteGlobalType === 'none' ? 'selected' : '') + '>Sin descuento</option>' +
            '<option value="temporary" ' + (STATE_SA.quoteGlobalType === 'temporary' ? 'selected' : '') + '>Por tiempo determinado (ej. 3 meses)</option>' +
            '<option value="permanent" ' + (STATE_SA.quoteGlobalType === 'permanent' ? 'selected' : '') + '>Descuento Permanente</option>' +
          '</select></div>' +
          '<div><label class="ms-sa-label">% Descuento</label><input type="number" min="0" max="100" class="ms-sa-input" id="ms-new-disc-pct" value="' + esc(STATE_SA.quoteGlobalPct) + '"></div>' +
          (STATE_SA.quoteGlobalType === 'temporary' ? '<div><label class="ms-sa-label">Duración Promo (Meses)</label><input type="number" min="1" max="60" class="ms-sa-input" id="ms-new-disc-months" value="' + esc(STATE_SA.quoteTempMonths) + '"></div>' : '') +
          '<div><button type="submit" class="ms-sa-btn" style="width:100%;padding:0.75rem;">🚀 Crear Sistema + BD Limpia + Suscripción MP</button></div>' +
        '</div>' +
      '</div>' +
    '</form>';
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

    var modRows = mods.map(function (m) {
      var curPrice = Number((cfg.module_prices && cfg.module_prices[m.key] && cfg.module_prices[m.key].price) ?? m.defaultMonthlyArs);
      var checked = Boolean(STATE_SA.quoteSelected[m.key]);
      var modDisc = Number(STATE_SA.quoteDiscountsByMod[m.key] || 0);
      var netMod = Math.round(curPrice * (1 - modDisc / 100));
      return '<tr style="border-bottom:1px solid #e3eef2;">' +
        '<td style="padding:0.5rem;"><input type="checkbox" data-q-mod="' + esc(m.key) + '" ' + (checked ? 'checked' : '') + '></td>' +
        '<td style="padding:0.5rem;"><strong>' + esc(m.name) + '</strong><br><small style="color:#536f7e;">' + esc(m.description) + '</small></td>' +
        '<td style="padding:0.5rem;width:140px;"><input type="number" min="0" step="500" class="ms-sa-input" data-cfg-mod-price="' + esc(m.key) + '" value="' + esc(curPrice) + '"></td>' +
        '<td style="padding:0.5rem;width:110px;"><input type="number" min="0" max="100" class="ms-sa-input" data-q-mod-disc="' + esc(m.key) + '" value="' + esc(modDisc) + '"></td>' +
        '<td style="padding:0.5rem;font-weight:800;text-align:right;">' + (checked ? fmtArs.format(netMod) : '—') + '</td>' +
      '</tr>';
    }).join('');

    return '<div style="display:grid;gap:1.1rem;">' +
      '<div class="ms-sa-grid">' +
        '<div class="ms-sa-card">' +
          '<h4 style="margin-top:0;">⚙️ Valores Base por Opción</h4>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
            '<div><label class="ms-sa-label">Base Mensual Opción 1 (Dominio + Marca Propia)</label><input type="number" step="500" class="ms-sa-input" id="ms-cfg-opt1" value="' + esc(cfg.option_1_base || 35000) + '"></div>' +
            '<div><label class="ms-sa-label">Base Mensual Opción 2 (Subruta MiniSistema)</label><input type="number" step="500" class="ms-sa-input" id="ms-cfg-opt2" value="' + esc(cfg.option_2_base || 15000) + '"></div>' +
          '</div>' +
          '<button type="button" class="ms-sa-btn ms-sa-btn--dark" id="ms-save-pricing-btn" style="margin-top:0.85rem;">💾 Guardar Lista Oficial de Valores Mensuales</button>' +
        '</div>' +

        '<div class="ms-sa-card ms-sa-card--highlight">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="color:#56D7A1;font-weight:800;font-size:0.8rem;">SIMULADOR DE ABONO MENSUAL (DÉBITO MP)</span>' +
            '<select id="ms-q-opt" class="ms-sa-select" style="width:auto;padding:0.3rem 0.6rem;font-weight:700;">' +
              '<option value="1" ' + (STATE_SA.quoteOptionType === 1 ? 'selected' : '') + '>Opción 1 (Dominio Propio)</option>' +
              '<option value="2" ' + (STATE_SA.quoteOptionType === 2 ? 'selected' : '') + '>Opción 2 (Subruta MiniSistema)</option>' +
            '</select>' +
          '</div>' +
          '<div style="font-size:2rem;font-weight:900;margin:0.4rem 0;">' + fmtArs.format(quote.promoMonthly) + ' <span style="font-size:0.95rem;font-weight:500;">/ mes</span></div>' +
          '<div style="font-size:0.82rem;color:#d1fae5;">Base Opción ' + STATE_SA.quoteOptionType + ': ' + fmtArs.format(quote.optionBase) + ' + Módulos: ' + fmtArs.format(quote.modTotal) + ' = Subtotal: ' + fmtArs.format(quote.subtotal) + '</div>' +
          (quote.months > 0 ? '<div style="margin-top:0.35rem;font-size:0.83rem;color:#56D7A1;font-weight:700;">⏱ Descuento temporal por ' + quote.months + ' meses · Desde el mes ' + (quote.months + 1) + ': ' + fmtArs.format(quote.regularMonthly) + '/mes</div>' : '') +
          '<div style="display:grid;grid-template-columns:1.3fr 0.8fr 0.8fr;gap:0.5rem;margin-top:0.8rem;">' +
            '<select id="ms-q-gtype" class="ms-sa-select">' +
              '<option value="none" ' + (STATE_SA.quoteGlobalType === 'none' ? 'selected' : '') + '>Sin dto. global</option>' +
              '<option value="temporary" ' + (STATE_SA.quoteGlobalType === 'temporary' ? 'selected' : '') + '>Dto. Temporal (Meses)</option>' +
              '<option value="permanent" ' + (STATE_SA.quoteGlobalType === 'permanent' ? 'selected' : '') + '>Dto. Permanente</option>' +
            '</select>' +
            '<input type="number" min="0" max="100" id="ms-q-gpct" class="ms-sa-input" placeholder="% Dto" title="% Descuento Global" value="' + esc(STATE_SA.quoteGlobalPct) + '">' +
            '<input type="number" min="1" max="60" id="ms-q-gmonths" class="ms-sa-input" placeholder="Meses" title="Meses de promoción" value="' + esc(STATE_SA.quoteTempMonths) + '" ' + (STATE_SA.quoteGlobalType === 'temporary' ? '' : 'disabled') + '>' +
          '</div>' +
          '<button type="button" class="ms-sa-btn" id="ms-q-apply-to-new" style="margin-top:0.8rem;width:100%;">Usar esta Cotización en Nuevo Comercio →</button>' +
        '</div>' +
      '</div>' +

      '<div class="ms-sa-card">' +
        '<h4 style="margin-top:0;">📦 Valor Mensual y Descuento Individual por Módulo</h4>' +
        '<div style="overflow-x:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">' +
            '<thead><tr style="text-align:left;border-bottom:2px solid #112D3A;"><th style="padding:0.5rem;">Incluir</th><th style="padding:0.5rem;">Módulo del Sistema ERP</th><th style="padding:0.5rem;">Valor Mensual ($)</th><th style="padding:0.5rem;">Dto. Módulo (%)</th><th style="padding:0.5rem;text-align:right;">Neto Módulo</th></tr></thead>' +
            '<tbody>' + modRows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderSecretsTab() {
    var st = (STATE_SA.data && STATE_SA.data.credentialsStatus) || {};
    var webhookUrl = window.location.origin + '/api/mercadopago/webhook';

    return '<form id="ms-sa-secrets-form" style="display:grid;gap:1rem;">' +
      '<div class="ms-sa-grid">' +
        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<h4 style="margin:0;">💳 Mercado Pago (Débito Automático / Suscripciones)</h4>' +
            '<span class="ms-sa-pill">' + (st.mpConfigured ? '🟢 Producción Activa' : '🧪 Modo Prueba') + '</span>' +
          '</div>' +
          '<p style="font-size:0.8rem;color:#415f6e;">Vincula la API oficial <code>/preapproval</code> de Mercado Pago para cobrar los abonos mensuales por débito automático.</p>' +
          '<div style="display:grid;gap:0.65rem;">' +
            '<div><label class="ms-sa-label">Access Token de Producción (<code>APP_USR-...</code>)</label><input type="password" class="ms-sa-input" name="mp_access_token" placeholder="' + esc(st.mpAccessTokenMasked || 'Pegar APP_USR-... cuando quieras pasar a cobro real') + '"></div>' +
            '<div><label class="ms-sa-label">Public Key (<code>APP_USR-...</code>)</label><input class="ms-sa-input" name="mp_public_key" value="' + esc(st.mpPublicKey || '') + '" placeholder="APP_USR-..."></div>' +
            '<div><label class="ms-sa-label">Webhook URL para pegar en tu Panel de Mercado Pago</label><input class="ms-sa-input" readonly value="' + esc(webhookUrl) + '" onclick="this.select()"></div>' +
          '</div>' +
        '</div>' +

        '<div class="ms-sa-card">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<h4 style="margin:0;">🌐 GitHub + Vercel (Automatización Opción 1)</h4>' +
            '<span class="ms-sa-pill">' + ((st.githubConfigured && st.vercelConfigured) ? '🟢 Conectado' : '⚙️ Opcional / Manual') + '</span>' +
          '</div>' +
          '<p style="font-size:0.8rem;color:#415f6e;">Permite crear el repositorio privado en GitHub y vincular automáticamente el dominio propio del cliente en Vercel al dar de alta una Opción 1.</p>' +
          '<div style="display:grid;gap:0.65rem;">' +
            '<div><label class="ms-sa-label">GitHub Personal Access Token (<code>ghp_...</code>)</label><input type="password" class="ms-sa-input" name="github_token" placeholder="' + esc(st.githubTokenMasked || 'Pegar token con permiso repo') + '"></div>' +
            '<div><label class="ms-sa-label">Usuario / Organización GitHub</label><input class="ms-sa-input" name="github_owner" value="' + esc(st.githubOwner || 'danighiglionesl-art') + '"></div>' +
            '<div><label class="ms-sa-label">Vercel API Token</label><input type="password" class="ms-sa-input" name="vercel_token" placeholder="' + esc(st.vercelTokenMasked || 'Pegar token desde vercel.com/account/tokens') + '"></div>' +
            '<div><label class="ms-sa-label">Vercel Team ID</label><input class="ms-sa-input" name="vercel_team_id" value="' + esc(st.vercelTeamId || '') + '"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div><button type="submit" class="ms-sa-btn">🔐 Guardar Credenciales en Bóveda Segura Supabase</button></div>' +
    '</form>';
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || '')); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function renderBody() {
    var bodyEl = document.getElementById('ms-sa-body');
    if (!bodyEl || !STATE_SA.data) return;

    if (STATE_SA.activeTab === 'tenants') bodyEl.innerHTML = renderTenantsTab();
    else if (STATE_SA.activeTab === 'new') bodyEl.innerHTML = renderNewTenantTab();
    else if (STATE_SA.activeTab === 'pricing') bodyEl.innerHTML = renderPricingTab();
    else if (STATE_SA.activeTab === 'secrets') bodyEl.innerHTML = renderSecretsTab();

    bindBodyEvents(bodyEl);
  }

  function bindBodyEvents(bodyEl) {
    var goNew = bodyEl.querySelector('#ms-sa-go-new');
    if (goNew) {
      goNew.addEventListener('click', function () {
        STATE_SA.activeTab = 'new';
        syncTabsUi();
        renderBody();
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
          var listRes = await apiSuperAdmin('GET', { action: 'tenant_users', slug: STATE_SA.managingUsersSlug });
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
          var listRes = await apiSuperAdmin('GET', { action: 'tenant_users', slug: STATE_SA.managingUsersSlug });
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
          await reloadSuperAdminData();
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
        await reloadSuperAdminData();
      });
    });

    bodyEl.querySelectorAll('[data-toggle-status]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var slug = btn.getAttribute('data-toggle-status');
        var curr = btn.getAttribute('data-curr-status');
        var next = curr === 'active' ? 'suspended' : 'active';
        var res = await apiSuperAdmin('POST', { action: 'update_tenant', slug: slug, status: next });
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData();
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

    bodyEl.querySelectorAll('[data-new-mod]').forEach(function (chk) {
      chk.addEventListener('change', function () {
        STATE_SA.quoteSelected[chk.getAttribute('data-new-mod')] = chk.checked;
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
          initialAdmin: (adminUser && adminPass.length >= 4) ? {
            username: adminUser,
            password: adminPass,
            name: String(fd.get('adminName') || adminUser)
          } : null
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
          STATE_SA.activeTab = 'tenants';
          syncTabsUi();
          showFeedback(res.message, false);
          await reloadSuperAdminData();
        } else {
          showFeedback((res && res.message) || 'No se pudo crear el comercio.', true);
          renderBody();
        }
      });
    }

    // Tab 3: Pricing & Quote Simulator
    var qOpt = bodyEl.querySelector('#ms-q-opt');
    if (qOpt) {
      qOpt.addEventListener('change', function () {
        STATE_SA.quoteOptionType = Number(qOpt.value) === 1 ? 1 : 2;
        renderBody();
      });
    }
    var qGType = bodyEl.querySelector('#ms-q-gtype');
    if (qGType) {
      qGType.addEventListener('change', function () {
        STATE_SA.quoteGlobalType = qGType.value;
        renderBody();
      });
    }
    var qGPct = bodyEl.querySelector('#ms-q-gpct');
    if (qGPct) {
      qGPct.addEventListener('change', function () {
        STATE_SA.quoteGlobalPct = Number(qGPct.value || 0);
        renderBody();
      });
    }
    var qGMonths = bodyEl.querySelector('#ms-q-gmonths');
    if (qGMonths) {
      qGMonths.addEventListener('change', function () {
        STATE_SA.quoteTempMonths = Number(qGMonths.value || 3);
        renderBody();
      });
    }

    bodyEl.querySelectorAll('[data-q-mod]').forEach(function (chk) {
      chk.addEventListener('change', function () {
        STATE_SA.quoteSelected[chk.getAttribute('data-q-mod')] = chk.checked;
        renderBody();
      });
    });

    bodyEl.querySelectorAll('[data-q-mod-disc]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        STATE_SA.quoteDiscountsByMod[inp.getAttribute('data-q-mod-disc')] = Number(inp.value || 0);
        renderBody();
      });
    });

    var applyToNewBtn = bodyEl.querySelector('#ms-q-apply-to-new');
    if (applyToNewBtn) {
      applyToNewBtn.addEventListener('click', function () {
        STATE_SA.newOptionType = STATE_SA.quoteOptionType;
        STATE_SA.activeTab = 'new';
        syncTabsUi();
        renderBody();
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
          await reloadSuperAdminData();
        } else {
          showFeedback((res && res.message) || 'Error guardando precios.', true);
        }
      });
    }

    // Tab 4: Secrets
    var secretsForm = bodyEl.querySelector('#ms-sa-secrets-form');
    if (secretsForm) {
      secretsForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var fd = new FormData(secretsForm);
        var secrets = {};
        ['mp_access_token', 'mp_public_key', 'github_token', 'github_owner', 'vercel_token', 'vercel_team_id'].forEach(function (k) {
          var v = String(fd.get(k) || '').trim();
          if (v !== '' || k === 'mp_public_key' || k === 'github_owner' || k === 'vercel_team_id') {
            secrets[k] = v;
          }
        });
        var res = await apiSuperAdmin('POST', { action: 'save_platform_secrets', secrets: secrets });
        if (res && res.ok) {
          showFeedback(res.message, false);
          await reloadSuperAdminData();
        } else {
          showFeedback((res && res.message) || 'No se pudieron guardar las credenciales.', true);
        }
      });
    }
  }

  function syncSuperAdminEntrypointVisibility() {
    var allowed = isDanielGeneralAdmin();
    var topActions = document.querySelector('.topbar-actions');
    var existingBtn = document.getElementById('ms-open-superadmin-btn');

    if (allowed && topActions && !existingBtn) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'ms-open-superadmin-btn';
      btn.className = 'ms-superadmin-topbar-btn';
      btn.innerHTML = '🛡️ Admin General';
      btn.title = 'Abrir Panel de Administrador General (Comercios, Valor Mensual y Mercado Pago)';
      btn.addEventListener('click', function () {
        openSuperAdminModal('tenants');
      });
      topActions.insertBefore(btn, topActions.firstChild);
    } else if (existingBtn) {
      existingBtn.hidden = !allowed;
      existingBtn.style.display = allowed ? 'inline-flex' : 'none';
    }

    // Inyectar tarjeta destacada en #sec-inicio para @danielg
    var inicioGrid = document.querySelector('#sec-inicio .modules-grid');
    var existingCard = document.getElementById('ms-superadmin-home-card');
    if (allowed && inicioGrid && !existingCard) {
      var card = document.createElement('article');
      card.id = 'ms-superadmin-home-card';
      card.className = 'module-card';
      card.style.border = '2px solid #56D7A1';
      card.style.background = 'linear-gradient(135deg, #112D3A 0%, #183f52 100%)';
      card.style.color = '#FFFFFF';
      card.style.cursor = 'pointer';
      card.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">' +
          '<div class="module-icon" aria-hidden="true" style="margin:0;">' +
            '<span style="font-size:1.4rem;">🛡️</span>' +
          '</div>' +
          '<span style="background:#56D7A1;color:#112D3A;font-size:0.7rem;font-weight:800;padding:0.2rem 0.55rem;border-radius:999px;">EXCLUSIVO @danielg</span>' +
        '</div>' +
        '<h3 style="margin:0;color:#FFFFFF;">Administrador General</h3>';
      card.addEventListener('click', function () {
        openSuperAdminModal('tenants');
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
