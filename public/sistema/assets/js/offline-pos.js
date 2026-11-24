/* ==========================================================================
   MINISISTEMA — MOTOR DE CONTINGENCIA OFFLINE PARA CAJA (CAPA 3)
   - Guarda copias locales en IndexedDB (aisladas por comercio/tenant) de:
     Artículos/Precios, Clientes, Ventas/Cajas, Ofertas, Usuarios y Atajos.
   - Si se corta Internet o falla el servidor, sirve el padrón local para
     seguir escaneando, cobrando e imprimiendo sin detener la fila.
   - Se integra con la cola transaccional de app.js (postPosWithOutbox /
     flushPosSyncOutbox) y sincroniza automáticamente al volver la conexión.
   - Cero tráfico extra sobre Supabase cuando el sistema opera normalmente.
   ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || window.__MS_OFFLINE_POS_INIT__) return;
  window.__MS_OFFLINE_POS_INIT__ = true;

  var IDB_NAME = 'ms_offline_pos_v1';
  var IDB_STORE = 'snapshots';
  var IDB_VERSION = 1;

  var brand = window.ERP_BRAND || {};
  var tenantSlug = String(brand.slug || (window.__ERP_TENANT_BOOT__ && window.__ERP_TENANT_BOOT__.slug) || 'minisistema').toLowerCase();
  var storagePrefix = String(brand.storagePrefix || ('ms_' + tenantSlug + '_'));
  var sessionStorageKey = storagePrefix + 'erp_active_admin_v1';

  var SNAPSHOT_LABELS = {
    catalog_all: 'Padrón de Artículos, Códigos y Precios',
    clientes_all: 'Clientes, Proveedores y Cta. Cte.',
    ventas_all: 'Ventas, Cajas y Numeración',
    ofertas_all: 'Ofertas y Promociones',
    auth_users: 'Usuarios y Permisos de Caja',
    auth_atajos: 'Atajos de Teclado',
    auth_session: 'Sesión Activa'
  };

  var state = {
    offlineMode: typeof navigator !== 'undefined' && navigator.onLine === false,
    offlineReason: typeof navigator !== 'undefined' && navigator.onLine === false ? 'Sin conexión a internet' : '',
    lastOnlineAt: null,
    lastSnapshotAt: null,
    minimized: false,
    probing: false,
    uiMounted: false
  };

  var idbPromise = null;

  function openIdb() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise(function (resolve) {
      try {
        if (!window.indexedDB) {
          resolve(null);
          return;
        }
        var req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = function (ev) {
          var db = ev.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = function (ev) {
          resolve(ev.target.result);
        };
        req.onerror = function () {
          resolve(null);
        };
      } catch (_e) {
        resolve(null);
      }
    });
    return idbPromise;
  }

  function makeSnapId(snapKey) {
    return tenantSlug + '::' + snapKey;
  }

  function idbGet(snapKey) {
    return openIdb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, 'readonly');
          var req = tx.objectStore(IDB_STORE).get(makeSnapId(snapKey));
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(null); };
        } catch (_e) {
          resolve(null);
        }
      });
    });
  }

  function idbPut(snapKey, text) {
    if (!text || typeof text !== 'string') return Promise.resolve(false);
    return openIdb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var now = Date.now();
          var rec = {
            id: makeSnapId(snapKey),
            tenant: tenantSlug,
            snapKey: snapKey,
            label: SNAPSHOT_LABELS[snapKey] || snapKey,
            text: text,
            savedAt: now,
            sizeBytes: text.length
          };
          var tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(rec);
          tx.oncomplete = function () {
            state.lastSnapshotAt = now;
            resolve(true);
          };
          tx.onerror = function () { resolve(false); };
        } catch (_e) {
          resolve(false);
        }
      });
    });
  }

  function idbListTenantSnapshots() {
    return openIdb().then(function (db) {
      if (!db) return [];
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, 'readonly');
          var req = tx.objectStore(IDB_STORE).getAll();
          req.onsuccess = function () {
            var all = Array.isArray(req.result) ? req.result : [];
            var prefix = tenantSlug + '::';
            var mine = all
              .filter(function (r) { return r && String(r.id || '').indexOf(prefix) === 0; })
              .map(function (r) {
                return {
                  snapKey: r.snapKey,
                  label: r.label || SNAPSHOT_LABELS[r.snapKey] || r.snapKey,
                  savedAt: r.savedAt || 0,
                  sizeBytes: r.sizeBytes || (r.text ? r.text.length : 0)
                };
              });
            resolve(mine);
          };
          req.onerror = function () { resolve([]); };
        } catch (_e) {
          resolve([]);
        }
      });
    });
  }

  function resolveSnapshotKeyForGet(rawUrl) {
    try {
      var u = new URL(rawUrl, window.location.origin);
      var p = u.pathname.toLowerCase();
      var action = (u.searchParams.get('action') || '').trim().toLowerCase();

      if (p.endsWith('/api/catalog.php')) {
        if (!action || action === 'all') return 'catalog_all';
        return null;
      }
      if (p.endsWith('/api/clientes.php')) {
        if (!action || action === 'all') return 'clientes_all';
        return null;
      }
      if (p.endsWith('/api/ventas.php')) {
        if (!action || action === 'all') return 'ventas_all';
        return null;
      }
      if (p.endsWith('/api/ofertas.php')) {
        if (!action || action === 'all') return 'ofertas_all';
        return null;
      }
      if (p.endsWith('/api/auth.php')) {
        if (action === 'list_users') return 'auth_users';
        if (action === 'get_global_atajos') return 'auth_atajos';
        if (!action) return 'auth_session';
        return null;
      }
    } catch (_e) {}
    return null;
  }

  function isValidCacheableJson(text) {
    if (!text || typeof text !== 'string') return false;
    var trimmed = text.trim();
    if (!trimmed) return false;
    var first = trimmed.charAt(0);
    if (first !== '{' && first !== '[') return false;
    if (trimmed.indexOf('"ok":false') !== -1 && trimmed.length < 400) return false;
    return true;
  }

  function makeJsonResponse(text, extraHeaders) {
    var headers = Object.assign(
      {
        'Content-Type': 'application/json; charset=utf-8',
        'X-MS-Offline-Cache': '1'
      },
      extraHeaders || {}
    );
    return new Response(text, { status: 200, headers: headers });
  }

  function getSavedSessionUser() {
    try {
      var raw = sessionStorage.getItem(sessionStorageKey) || localStorage.getItem(sessionStorageKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.username ? parsed : null;
    } catch (_e) {
      return null;
    }
  }

  function getPendingOutbox() {
    try {
      if (typeof window.getPosSyncOutbox === 'function') {
        var list = window.getPosSyncOutbox();
        return Array.isArray(list) ? list : [];
      }
    } catch (_e) {}
    return [];
  }

  function fetchWithTimeout(baseFetch, input, init, timeoutMs) {
    if (typeof AbortController !== 'function' || (init && init.signal)) {
      return baseFetch(input, init);
    }
    var controller = new AbortController();
    var timer = setTimeout(function () {
      try { controller.abort(); } catch (_e) {}
    }, timeoutMs);
    var nextInit = Object.assign({}, init || {}, { signal: controller.signal });
    return baseFetch(input, nextInit).then(
      function (res) {
        clearTimeout(timer);
        return res;
      },
      function (err) {
        clearTimeout(timer);
        throw err;
      }
    );
  }

  // Interceptar window.fetch encadenado sobre brand.js
  var chainedFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    var method = String((init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();

    // 1. Lecturas GET de endpoints críticos de caja (Read-Through + Fallback IndexedDB)
    if (method === 'GET') {
      var snapKey = resolveSnapshotKeyForGet(urlStr);
      if (snapKey) {
        var serveFromCache = function (reason, fallbackRes) {
          markOffline(reason);
          return idbGet(snapKey).then(function (snap) {
            if (snap && snap.text) {
              return makeJsonResponse(snap.text);
            }
            if (snapKey === 'auth_session') {
              var localUser = getSavedSessionUser();
              if (localUser) {
                return makeJsonResponse(JSON.stringify({ ok: true, user: localUser, offline: true }));
              }
            }
            if (fallbackRes) return fallbackRes;
            throw new Error(reason || 'Sin conexión y sin copia local');
          });
        };

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          return serveFromCache('Sin conexión a internet', null);
        }

        var timeoutMs = state.offlineMode ? 4500 : 12000;
        return fetchWithTimeout(chainedFetch, input, init, timeoutMs).then(
          function (res) {
            if (res && res.ok) {
              try {
                var clone = res.clone();
                clone.text().then(function (txt) {
                  if (isValidCacheableJson(txt)) {
                    idbPut(snapKey, txt);
                  }
                }).catch(function () {});
              } catch (_e) {}
              markOnline();
              return res;
            }
            if (res && res.status >= 500) {
              return serveFromCache('Servidor no disponible (HTTP ' + res.status + ')', res);
            }
            return res;
          },
          function () {
            return serveFromCache('Sin respuesta del servidor', null);
          }
        );
      }
    }

    // 2. Login offline en la PC de caja si el cajero intentó ingresar durante un corte
    if (method === 'POST' && /\/api\/auth\.php(?:$|\?)/i.test(urlStr)) {
      var bodyStr = init && typeof init.body === 'string' ? init.body : '';
      var parsedBody = null;
      try { parsedBody = bodyStr ? JSON.parse(bodyStr) : null; } catch (_e) {}
      if (parsedBody && (parsedBody.action === 'login' || parsedBody.action === 'restore_session')) {
        var tryOfflineAuth = function (reason, origRes) {
          markOffline(reason);
          var reqUser = String(parsedBody.username || '').trim().toLowerCase();
          var reqPass = String(parsedBody.password || '');
          if (parsedBody.action === 'restore_session') {
            var savedU = getSavedSessionUser();
            if (savedU && String(savedU.username || '').toLowerCase() === reqUser) {
              return Promise.resolve(makeJsonResponse(JSON.stringify({ ok: true, user: savedU, offline: true })));
            }
          }
          return idbGet('auth_users').then(function (snap) {
            if (snap && snap.text) {
              try {
                var data = JSON.parse(snap.text);
                var users = Array.isArray(data && data.users) ? data.users : (Array.isArray(data) ? data : []);
                var match = users.find(function (u) {
                  return u && String(u.username || '').trim().toLowerCase() === reqUser && u.active !== false;
                });
                if (match) {
                  var storedPass = String(match.plain_compat || match.pass || '');
                  if (storedPass && storedPass === reqPass) {
                    return makeJsonResponse(JSON.stringify({ ok: true, user: match, offline: true }));
                  }
                }
              } catch (_e) {}
            }
            if (origRes) return origRes;
            throw new Error(reason || 'Sin conexión');
          });
        };

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          return tryOfflineAuth('Sin conexión a internet', null);
        }
        return fetchWithTimeout(chainedFetch, input, init, 10000).then(
          function (res) {
            if (res && res.status >= 500) {
              return tryOfflineAuth('Servidor no disponible (HTTP ' + res.status + ')', res);
            }
            if (res && res.ok) markOnline();
            return res;
          },
          function () {
            return tryOfflineAuth('Sin respuesta del servidor', null);
          }
        );
      }
    }

    return chainedFetch(input, init);
  };

  function formatShortTime(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (_e) {
      return '—';
    }
  }

  function formatBytes(bytes) {
    var b = Number(bytes || 0);
    if (b >= 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + ' MB';
    if (b >= 1024) return Math.round(b / 1024) + ' KB';
    return b + ' B';
  }

  function markOffline(reason) {
    var wasOffline = state.offlineMode;
    state.offlineMode = true;
    state.offlineReason = String(reason || 'Sin conexión con el servidor');
    renderContingencyBar();
    if (!wasOffline && typeof window.showToast === 'function') {
      window.showToast('Modo Contingencia Offline activo: podés seguir escaneando, cobrando e imprimiendo.', 'warning');
    }
  }

  function markOnline() {
    var wasOffline = state.offlineMode;
    state.offlineMode = false;
    state.offlineReason = '';
    state.lastOnlineAt = Date.now();
    renderContingencyBar();
    if (wasOffline) {
      var pending = getPendingOutbox();
      if (pending.length > 0 && typeof window.flushPosSyncOutbox === 'function') {
        window.flushPosSyncOutbox(false).then(function () {
          renderContingencyBar();
        }).catch(function () {});
      } else if (typeof window.showToast === 'function') {
        window.showToast('Conexión con el servidor restablecida.');
      }
    }
  }

  function probeServerConnection(manual) {
    if (state.probing) return Promise.resolve(false);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      markOffline('Sin conexión a internet');
      return Promise.resolve(false);
    }
    state.probing = true;
    renderContingencyBar();
    return fetchWithTimeout(chainedFetch, '/sistema/api/db_status.php?_probe=' + Date.now(), { cache: 'no-store' }, 6000)
      .then(function (res) {
        state.probing = false;
        if (res && res.ok) {
          markOnline();
          if (typeof window.flushPosSyncOutbox === 'function' && getPendingOutbox().length > 0) {
            return window.flushPosSyncOutbox(Boolean(manual)).then(function () {
              renderContingencyBar();
              return true;
            });
          }
          return true;
        }
        markOffline('Servidor sin respuesta (HTTP ' + (res ? res.status : '0') + ')');
        return false;
      })
      .catch(function () {
        state.probing = false;
        markOffline('Sin respuesta del servidor');
        return false;
      });
  }

  function warmupOfflineSnapshots() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (typeof window.showToast === 'function') {
        window.showToast('No hay conexión para actualizar la copia local ahora.', 'warning');
      }
      return Promise.resolve(false);
    }
    var targets = [
      '/sistema/api/catalog.php?action=all&_warm=' + Date.now(),
      '/sistema/api/clientes.php?action=all&_warm=' + Date.now(),
      '/sistema/api/ventas.php?_warm=' + Date.now(),
      '/sistema/api/ofertas.php?_warm=' + Date.now(),
      '/sistema/api/auth.php?action=list_users&_warm=' + Date.now()
    ];
    return Promise.all(
      targets.map(function (u) {
        return window.fetch(u, { cache: 'no-store' }).catch(function () { return null; });
      })
    ).then(function () {
      refreshContingencyModal();
      if (typeof window.showToast === 'function') {
        window.showToast('Copia local offline actualizada en esta PC.');
      }
      return true;
    });
  }

  function downloadOutboxBackupJson() {
    var pending = getPendingOutbox();
    var payload = {
      exportedAt: new Date().toISOString(),
      tenant: tenantSlug,
      commerce: brand.name || tenantSlug,
      offlineMode: state.offlineMode,
      pendingCount: pending.length,
      pendingOperations: pending
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    a.href = url;
    a.download = 'respaldo-contingencia-' + tenantSlug + '-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      a.remove();
      try { URL.revokeObjectURL(url); } catch (_e) {}
    }, 200);
  }

  function ensureUiElements() {
    if (state.uiMounted || typeof document === 'undefined' || !document.body) return;
    state.uiMounted = true;

    var bar = document.createElement('div');
    bar.id = 'ms-contingency-bar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.style.cssText =
      'display:none;position:fixed;left:14px;right:14px;bottom:14px;max-width:980px;margin:0 auto;z-index:9998;' +
      'padding:10px 14px;border-radius:12px;font-family:inherit;box-shadow:0 12px 32px rgba(0,0,0,0.28);' +
      'align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;';
    document.body.appendChild(bar);

    var dlg = document.createElement('dialog');
    dlg.id = 'ms-contingency-dialog';
    dlg.className = 'erp-dialog';
    dlg.style.cssText = 'max-width:680px;width:94%;padding:0;border-radius:14px;overflow:hidden;';
    dlg.innerHTML =
      '<div class="dialog-form">' +
      '  <header class="dialog-header">' +
      '    <div class="dialog-title-wrap">' +
      '      <h2 style="margin:0;font-size:1.05rem;">Modo Contingencia Offline · Respaldo de Caja</h2>' +
      '    </div>' +
      '    <button type="button" id="btn-ms-cont-close" class="btn-icon-close" aria-label="Cerrar">✕</button>' +
      '  </header>' +
      '  <div class="dialog-body" style="display:flex;flex-direction:column;gap:0.9rem;max-height:72vh;overflow-y:auto;">' +
      '    <div id="ms-cont-status-box" style="padding:0.75rem 0.9rem;border-radius:8px;font-size:0.86rem;font-weight:700;"></div>' +
      '    <div>' +
      '      <div style="font-size:0.75rem;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-secondary);margin-bottom:0.4rem;">Copia Local en esta PC (IndexedDB)</div>' +
      '      <div id="ms-cont-snaps-list" style="display:flex;flex-direction:column;gap:0.35rem;font-size:0.83rem;"></div>' +
      '    </div>' +
      '    <div>' +
      '      <div style="font-size:0.75rem;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-secondary);margin-bottom:0.4rem;">Operaciones Pendientes de Sincronizar</div>' +
      '      <div id="ms-cont-queue-list" style="display:flex;flex-direction:column;gap:0.35rem;font-size:0.83rem;"></div>' +
      '    </div>' +
      '    <div style="font-size:0.78rem;color:var(--text-secondary);line-height:1.45;padding:0.65rem 0.8rem;border-radius:8px;background:var(--surface-elevated);border:1px solid var(--border-subtle);">' +
      '      <strong>Operación en contingencia:</strong> Si falla internet o el servidor, podés seguir escaneando artículos, cobrando y emitiendo <strong>Comprobante Interno / Ticket X</strong>. Todas las operaciones quedan resguardadas en esta PC y se suben automáticamente apenas vuelve la conexión. (Atajo en cualquier momento: <code>Alt + Shift + O</code>).' +
      '    </div>' +
      '  </div>' +
      '  <footer class="dialog-footer" style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">' +
      '    <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">' +
      '      <button type="button" id="btn-ms-cont-warmup" class="btn-secondary" style="width:auto;font-size:0.8rem;">Guardar Copia Offline Ahora</button>' +
      '      <button type="button" id="btn-ms-cont-download" class="btn-secondary" style="width:auto;font-size:0.8rem;">Descargar Respaldo JSON</button>' +
      '    </div>' +
      '    <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">' +
      '      <button type="button" id="btn-ms-cont-sync" class="btn-primary" style="width:auto;font-size:0.82rem;font-weight:800;">Sincronizar / Probar Conexión</button>' +
      '    </div>' +
      '  </footer>' +
      '</div>';
    document.body.appendChild(dlg);

    dlg.querySelector('#btn-ms-cont-close')?.addEventListener('click', function () { dlg.close && dlg.close(); });
    dlg.querySelector('#btn-ms-cont-warmup')?.addEventListener('click', function () {
      var btn = dlg.querySelector('#btn-ms-cont-warmup');
      if (btn) btn.disabled = true;
      warmupOfflineSnapshots().finally(function () { if (btn) btn.disabled = false; });
    });
    dlg.querySelector('#btn-ms-cont-download')?.addEventListener('click', downloadOutboxBackupJson);
    dlg.querySelector('#btn-ms-cont-sync')?.addEventListener('click', function () {
      var btn = dlg.querySelector('#btn-ms-cont-sync');
      if (btn) btn.disabled = true;
      probeServerConnection(true).finally(function () {
        if (btn) btn.disabled = false;
        refreshContingencyModal();
      });
    });
  }

  function refreshContingencyModal() {
    var dlg = document.getElementById('ms-contingency-dialog');
    if (!dlg) return;
    var statusBox = dlg.querySelector('#ms-cont-status-box');
    var snapsEl = dlg.querySelector('#ms-cont-snaps-list');
    var queueEl = dlg.querySelector('#ms-cont-queue-list');
    var pending = getPendingOutbox();

    if (statusBox) {
      if (state.offlineMode) {
        statusBox.style.background = 'rgba(245,158,11,0.16)';
        statusBox.style.border = '1px solid rgba(217,119,6,0.45)';
        statusBox.style.color = '#92400e';
        statusBox.textContent = 'MODO CONTINGENCIA OFFLINE ACTIVO · ' + (state.offlineReason || 'Trabajando con copia local en esta PC');
      } else {
        statusBox.style.background = 'rgba(16,185,129,0.14)';
        statusBox.style.border = '1px solid rgba(16,185,129,0.4)';
        statusBox.style.color = '#065f46';
        statusBox.textContent = 'CONECTADO AL SERVIDOR · Respaldo local listo para contingencias' + (state.lastOnlineAt ? ' (último contacto ' + formatShortTime(state.lastOnlineAt) + ')' : '');
      }
    }

    if (snapsEl) {
      idbListTenantSnapshots().then(function (snaps) {
        if (!snaps || snaps.length === 0) {
          snapsEl.innerHTML = '<div style="padding:0.55rem 0.7rem;border-radius:6px;background:var(--surface-elevated);border:1px solid var(--border-subtle);color:var(--text-secondary);">Todavía no hay copias locales guardadas en esta PC. Presioná "Guardar Copia Offline Ahora" con internet para dejar la caja preparada.</div>';
          return;
        }
        snapsEl.innerHTML = snaps.map(function (s) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;padding:0.45rem 0.7rem;border-radius:6px;background:var(--surface-elevated);border:1px solid var(--border-subtle);">' +
            '<span><strong>' + escapeTxt(s.label) + '</strong></span>' +
            '<span style="color:var(--text-secondary);font-size:0.77rem;">' + formatShortTime(s.savedAt) + ' · ' + formatBytes(s.sizeBytes) + '</span>' +
            '</div>';
        }).join('');
      });
    }

    if (queueEl) {
      if (pending.length === 0) {
        queueEl.innerHTML = '<div style="padding:0.55rem 0.7rem;border-radius:6px;background:var(--surface-elevated);border:1px solid var(--border-subtle);color:var(--text-secondary);">No hay operaciones pendientes de sincronizar. Todo está al día en el servidor.</div>';
      } else {
        queueEl.innerHTML = pending.map(function (j) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;padding:0.45rem 0.7rem;border-radius:6px;background:rgba(245,158,11,0.1);border:1px solid rgba(217,119,6,0.3);">' +
            '<span><strong>' + escapeTxt(j.label || j.dedupeKey || 'Operación POS') + '</strong>' + (j.lastError ? ' <small style="opacity:.8;">(' + escapeTxt(j.lastError) + ')</small>' : '') + '</span>' +
            '<span style="font-size:0.76rem;color:var(--text-secondary);">' + formatShortTime(j.queuedAt) + '</span>' +
            '</div>';
        }).join('');
      }
    }
  }

  function escapeTxt(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function openContingencyModal() {
    ensureUiElements();
    refreshContingencyModal();
    var dlg = document.getElementById('ms-contingency-dialog');
    if (dlg) {
      if (typeof dlg.showModal === 'function') {
        if (!dlg.open) dlg.showModal();
      } else {
        dlg.setAttribute('open', 'open');
      }
    }
  }

  function renderContingencyBar() {
    if (typeof document === 'undefined' || !document.body) return;
    ensureUiElements();
    var bar = document.getElementById('ms-contingency-bar');
    if (!bar) return;

    var pending = getPendingOutbox();
    var pendingCount = pending.length;
    var shouldShow = state.offlineMode || pendingCount > 0;

    // Ocultar el pill viejo de app.js si nuestra barra está activa para no duplicar avisos
    var legacyPill = document.getElementById('ms-offline-outbox-pill');
    if (legacyPill) {
      legacyPill.style.display = shouldShow ? 'none' : '';
    }

    if (!shouldShow) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'flex';
    if (state.minimized) {
      bar.style.left = 'auto';
      bar.style.right = '14px';
      bar.style.maxWidth = 'none';
      bar.style.margin = '0';
      bar.style.background = state.offlineMode ? '#92400e' : '#112D3A';
      bar.style.color = '#ffffff';
      bar.style.border = state.offlineMode ? '1px solid #f59e0b' : '1px solid #56D7A1';
      bar.innerHTML =
        '<button type="button" id="btn-ms-cont-expand" style="background:none;border:0;color:#fff;font-weight:800;font-size:0.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:0;">' +
        '<span>' + (state.offlineMode ? 'MODO OFFLINE' : 'COLA POS') + (pendingCount > 0 ? ' (' + pendingCount + ')' : '') + '</span>' +
        '</button>';
      bar.querySelector('#btn-ms-cont-expand')?.addEventListener('click', function () {
        state.minimized = false;
        renderContingencyBar();
      });
      return;
    }

    bar.style.left = '14px';
    bar.style.right = '14px';
    bar.style.maxWidth = '980px';
    bar.style.margin = '0 auto';

    if (state.offlineMode) {
      bar.style.background = '#78350f';
      bar.style.color = '#fffbeb';
      bar.style.border = '1px solid #f59e0b';
    } else {
      bar.style.background = '#112D3A';
      bar.style.color = '#f8fafc';
      bar.style.border = '1px solid #56D7A1';
    }

    var headline = state.offlineMode
      ? 'MODO CONTINGENCIA OFFLINE · Podés seguir escaneando, cobrando e imprimiendo (Comprobante Interno)'
      : 'CONEXIÓN RESTABLECIDA · Tenés ' + pendingCount + ' operación' + (pendingCount === 1 ? '' : 'es') + ' pendiente' + (pendingCount === 1 ? '' : 's') + ' de subir';

    var subline = state.offlineMode
      ? (pendingCount > 0 ? pendingCount + ' comprobante(s) guardados en esta PC · se sincronizan al volver la conexión' : 'Trabajando con copia local en esta PC')
      : 'Hacé clic en Sincronizar para subirlas ahora al servidor';

    bar.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">' +
      '  <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,0.14);flex-shrink:0;">' +
      '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
      '  </span>' +
      '  <div style="min-width:0;">' +
      '    <div style="font-size:0.82rem;font-weight:800;line-height:1.25;">' + escapeTxt(headline) + '</div>' +
      '    <div style="font-size:0.74rem;opacity:0.88;">' + escapeTxt(subline) + '</div>' +
      '  </div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
      '  <button type="button" id="btn-ms-cont-open" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.12);color:#fff;font-size:0.76rem;font-weight:700;cursor:pointer;">Ver Respaldo / Cola' + (pendingCount > 0 ? ' (' + pendingCount + ')' : '') + '</button>' +
      '  <button type="button" id="btn-ms-cont-retry" style="padding:6px 11px;border-radius:8px;border:0;background:#56D7A1;color:#112D3A;font-size:0.76rem;font-weight:800;cursor:pointer;">' + (state.probing ? 'Probando...' : (state.offlineMode ? 'Reintentar Conexión' : 'Sincronizar Ahora')) + '</button>' +
      '  <button type="button" id="btn-ms-cont-min" title="Minimizar aviso" style="padding:4px 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.22);background:transparent;color:#fff;font-size:0.76rem;cursor:pointer;">—</button>' +
      '</div>';

    bar.querySelector('#btn-ms-cont-open')?.addEventListener('click', openContingencyModal);
    bar.querySelector('#btn-ms-cont-retry')?.addEventListener('click', function () {
      probeServerConnection(true);
    });
    bar.querySelector('#btn-ms-cont-min')?.addEventListener('click', function () {
      state.minimized = true;
      renderContingencyBar();
    });
  }

  window.addEventListener('offline', function () {
    markOffline('Sin conexión a internet');
  });

  window.addEventListener('online', function () {
    probeServerConnection(false);
  });

  window.addEventListener('keydown', function (ev) {
    if (ev.altKey && ev.shiftKey && String(ev.key || '').toLowerCase() === 'o') {
      ev.preventDefault();
      openContingencyModal();
    }
  });

  // Sonda de recuperación liviana: SOLO corre si estamos en modo offline o hay pendientes en cola
  setInterval(function () {
    if (typeof document !== 'undefined' && document.hidden) return;
    var pendingCount = getPendingOutbox().length;
    if (state.offlineMode || pendingCount > 0) {
      renderContingencyBar();
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        probeServerConnection(false);
      }
    }
  }, 25000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderContingencyBar);
  } else {
    renderContingencyBar();
  }

  window.MS_OFFLINE_POS = {
    isOffline: function () { return state.offlineMode; },
    markOffline: markOffline,
    markOnline: markOnline,
    probe: probeServerConnection,
    warmup: warmupOfflineSnapshots,
    openModal: openContingencyModal,
    downloadBackup: downloadOutboxBackupJson,
    listSnapshots: idbListTenantSnapshots,
    refreshUi: renderContingencyBar
  };
})();
