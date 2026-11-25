'use strict';

(() => {
  const CATALOG_API_URL = '../sistema/api/catalog.php';
  const CLIENTES_API_URL = '../sistema/api/clientes.php';
  const BANNERS_API_URL = '../sistema/api/banners.php';
  const SINERGIAL_IMG_BASE = 'https://ghrxmirhilrlveqyyscq.supabase.co/storage/v1/object/public/erp-product-images/';
  const STORE_BRAND = window.ERP_BRAND || {
    isPaseoAlberdi: false,
    storagePrefix: 'cn_',
    name: 'Casa Nueva',
    upperName: 'CASA NUEVA',
    fullName: 'Casa Nueva Supermercado',
    clubName: 'Club Fidel',
    clubUpper: 'CLUB FIDEL',
    accentHex: '#d4a41e',
    domain: 'cn.com.ar',
    address: 'Riveros Gigena N° 50 - Alcira Gigena (Córdoba)',
    whatsappDigits: '5493584198605',
    whatsappDisplay: '+54 9 3584 19-8605',
    whatsappMayoristaDigits: '5493584367910',
    whatsappMayoristaDisplay: '+54 9 3584 36-7910',
    defaultLocalidad: 'ALCIRA GIGENA',
    defaultCp: '5813'
  };
  const SESSION_STORAGE_KEY = STORE_BRAND.storagePrefix + 'carrito_client_session_v2';
  const CART_STORAGE_KEY = STORE_BRAND.storagePrefix + 'carrito_items_v2';

  const cfBadgeSvg = (size = 20) =>
    `<svg class="cf-badge-svg" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#092837" stroke="rgba(60,224,150,0.35)" stroke-width="1"/><path d="M7.5 22.2V13a5.5 5.5 0 0 1 5.5-5.5h6A5.5 5.5 0 0 1 24.5 13v6a5.5 5.5 0 0 1-5.5 5.5h-3.2" fill="none" stroke="#3ce096" stroke-width="2.8" stroke-linecap="round"/><path d="M11.8 23.5v-9.3a2.6 2.6 0 0 1 2.6-2.6h5.2M11.8 17.3h6.2" fill="none" stroke="#ffffff" stroke-width="3.1" stroke-linecap="round"/></svg>`;

  const DEFAULT_GEO = {
    paises: ['ARGENTINA', 'BRASIL', 'CHILE', 'PARAGUAY', 'URUGUAY'],
    provincias: {
      ARGENTINA: [
        'BUENOS AIRES', 'CABA', 'CATAMARCA', 'CHACO', 'CHUBUT', 'CÓRDOBA',
        'CORRIENTES', 'ENTRE RÍOS', 'FORMOSA', 'JUJUY', 'LA PAMPA', 'LA RIOJA',
        'MENDOZA', 'MISIONES', 'NEUQUÉN', 'RÍO NEGRO', 'SALTA', 'SAN JUAN',
        'SAN LUIS', 'SANTA CRUZ', 'SANTA FE', 'SANTIAGO DEL ESTERO',
        'TIERRA DEL FUEGO', 'TUCUMÁN'
      ]
    },
    localidades: {
      'CÓRDOBA': [
        { n: 'ALCIRA GIGENA', cp: '5813' },
        { n: 'ELENA', cp: '5815' },
        { n: 'BERROTARÁN', cp: '5817' },
        { n: 'CORONEL BAIGORRIA', cp: '5811' },
        { n: 'RÍO CUARTO', cp: '5800' },
        { n: 'LAS HIGUERAS', cp: '5805' },
        { n: 'SANTA CATALINA (HOLMBERG)', cp: '5825' },
        { n: 'LOS CÓNDORES', cp: '5853' },
        { n: 'ALMAFUERTE', cp: '5854' },
        { n: 'RÍO TERCERO', cp: '5850' },
        { n: 'GENERAL CABRERA', cp: '5809' },
        { n: 'GENERAL DEHEZA', cp: '5923' },
        { n: 'HERNANDO', cp: '5929' },
        { n: 'CARNERILLO', cp: '5807' },
        { n: 'CHUCUL', cp: '5806' },
        { n: 'LA CARLOTA', cp: '2670' },
        { n: 'ALEJANDRO ROCA', cp: '2686' },
        { n: 'MACKENNA (VICUÑA MACKENNA)', cp: '6140' },
        { n: 'LABOULAYE', cp: '6120' },
        { n: 'VILLA MARÍA', cp: '5900' },
        { n: 'CÓRDOBA CAPITAL', cp: '5000' }
      ]
    }
  };

  const state = {
    articulos: [],
    allArticulos: [],
    rubrosMap: new Map(),
    marcasMap: new Map(),
    rubroCounts: new Map(),
    marcaCounts: new Map(),
    filteredArticulos: [],
    currentPage: 1,
    pageSize: 24,
    gridCols: 4,
    listView: false,
    client: null,
    cart: [],
    soyCajeroItems: [],
    soyCajeroLastTicket: null,
    nextSoyCajeroCode: '',
    lastDrawnScQrCode: '',
    premiosCart: [],
    portalData: {
      fidelizacionConfig: {
        pesosPorPunto: 1000,
        diasVencimiento: 365,
        factorCanje: 1.12,
        mostrarEnCatalogo: 'solo_stock',
        nombrePrograma: STORE_BRAND.clubUpper
      },
      puntosResumen: { vigentes: 0, acumulados: 0, canjeados: 0 },
      movimientosFidelizacion: [],
      misCompras: [],
      ticketsSoyCajero: []
    },
    privacyHidden: false,
    activePortalSec: 'home',
    geo: {
      paises: [...DEFAULT_GEO.paises],
      provincias: { ...DEFAULT_GEO.provincias },
      localidades: JSON.parse(JSON.stringify(DEFAULT_GEO.localidades))
    }
  };

  const formatArs = (num) => {
    const val = Number(num) || 0;
    return '$ ' + val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const escapeHtml = (str) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const showToast = (msg) => {
    const toast = document.getElementById('store-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.hidden = true;
    }, 3600);
  };

  const validateCuitModulo11 = (raw) => {
    const digits = String(raw || '').replace(/\D+/g, '');
    if (digits.length !== 11) return false;
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += Number(digits[i]) * weights[i];
    }
    let mod = 11 - (sum % 11);
    if (mod === 11) mod = 0;
    if (mod === 10) mod = 9;
    return mod === Number(digits[10]);
  };

  const getClientListaLabel = () => {
    if (!state.client) return 'MINORISTA';
    const rawLista = String(state.client.listaPrecio || state.client.lp || '').toUpperCase();
    if (rawLista.includes('MAYORISTA') || Number(state.client.listaPrecioId) === 2) {
      return 'MAYORISTA';
    }
    return 'MINORISTA';
  };

  const COMMON_AR_FIRST_NAMES = new Set([
    'DANIEL', 'FEDERICO', 'JUAN', 'JOSE', 'CARLOS', 'LUIS', 'JORGE', 'MIGUEL', 'MARIO', 'ROBERTO',
    'FERNANDO', 'DIEGO', 'PABLO', 'ALEJANDRO', 'GUSTAVO', 'SERGIO', 'MARCELO', 'JAVIER', 'MARTIN', 'NICOLAS',
    'MATIAS', 'LUCAS', 'FACUNDO', 'SANTIAGO', 'SEBASTIAN', 'GABRIEL', 'CRISTIAN', 'EMANUEL', 'GONZALO', 'AGUSTIN',
    'TOMAS', 'FRANCO', 'BRUNO', 'IGNACIO', 'MAXIMILIANO', 'RODRIGO', 'MAURICIO', 'EDUARDO', 'RICARDO', 'OSCAR',
    'HECTOR', 'RAUL', 'RUBEN', 'OMAR', 'HUGO', 'WALTER', 'CLAUDIO', 'ADRIAN', 'HERNAN', 'LEANDRO', 'LEONARDO',
    'RAMIRO', 'JOAQUIN', 'BENJAMIN', 'MATEO', 'THIAGO', 'VALENTIN', 'LAUREANO', 'EMILIO', 'ESTEBAN', 'GERMAN',
    'GUILLERMO', 'HORACIO', 'JULIO', 'MARCOS', 'MARIANO', 'PATRICIO', 'PEDRO', 'RAFAEL', 'VICTOR', 'ALBERTO',
    'ALFREDO', 'ANDRES', 'ANTONIO', 'ARTURO', 'CESAR', 'DAMIAN', 'DARIO', 'DAVID', 'EDGARDO', 'ENRIQUE', 'ERNESTO',
    'EZEQUIEL', 'FABIAN', 'FRANCISCO', 'GASTON', 'GERARDO', 'IVAN', 'JONATAN', 'JONATHAN', 'JULIAN', 'LAUTARO',
    'LISANDRO', 'LUCIANO', 'MANUEL', 'MAURO', 'NAHUEL', 'NELSON', 'NESTOR', 'NORBERTO', 'OSVALDO', 'RAMON', 'RENZO',
    'MARIA', 'ANA', 'LAURA', 'ANDREA', 'CLAUDIA', 'PATRICIA', 'SILVIA', 'SUSANA', 'MONICA', 'GRACIELA', 'ADRIANA',
    'ALEJANDRA', 'VERONICA', 'PAULA', 'CAROLINA', 'VALERIA', 'NATALIA', 'GABRIELA', 'DANIELA', 'ROMINA', 'VANESA',
    'LORENA', 'CECILIA', 'MARIANA', 'FLORENCIA', 'CAMILA', 'SOFIA', 'VALENTINA', 'MARTINA', 'LUCIA', 'JULIETA',
    'MICAELA', 'AGUSTINA', 'MILAGROS', 'ROCIO', 'BELEN', 'SOL', 'CARLA', 'KARINA', 'CARINA', 'SANDRA', 'NORMA',
    'MARTA', 'MARTHA', 'ROSA', 'ALICIA', 'BEATRIZ', 'LILIANA', 'MIRIAM', 'MYRIAM', 'MIRTA', 'NANCY', 'ROXANA',
    'ROSANA', 'SILVINA', 'VIVIANA', 'YANINA', 'YESICA', 'JESSICA', 'NOELIA', 'NADIA', 'MELINA', 'DAIANA', 'BRENDA',
    'ANTONELA', 'ANTONELLA', 'CANDELA', 'PILAR', 'VICTORIA', 'ELENA', 'ESTELA', 'GLADYS', 'INES', 'IRMA', 'JUANA',
    'LUISA', 'MABEL', 'MARGARITA', 'MERCEDES', 'NELIDA', 'OLGA', 'RAQUEL', 'SARA', 'TERESA', 'ZULMA', 'GISELLE',
    'GISELA', 'IVANA', 'JIMENA', 'XIMENA', 'PAOLA', 'SABRINA', 'TAMARA', 'EUGENIA', 'JOSEFINA', 'DELFINA', 'CATALINA'
  ]);

  const toNiceTitleWord = (word) => {
    const clean = String(word || '').trim();
    if (!clean) return '';
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  };

  const normalizeNameToken = (word) =>
    String(word || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

  // Combina Nombre y Apellido separados en el formato estándar del ERP: "APELLIDO, NOMBRE"
  const composeErpFullName = (nombreRaw, apellidoRaw) => {
    const nom = String(nombreRaw || '').trim().replace(/,/g, ' ').replace(/\s+/g, ' ').toUpperCase();
    const ape = String(apellidoRaw || '').trim().replace(/,/g, ' ').replace(/\s+/g, ' ').toUpperCase();
    if (ape && nom) return `${ape}, ${nom}`;
    return ape || nom || '';
  };

  // Separa una ficha o cadena ("APELLIDO, NOMBRE" / "APELLIDO NOMBRE" / "NOMBRE APELLIDO") en { nombre, apellido }
  const splitClientFullNameParts = (cliOrRaw) => {
    if (!cliOrRaw) return { nombre: '', apellido: '' };
    if (typeof cliOrRaw === 'object') {
      const expNom = String(cliOrRaw.nombrePila || cliOrRaw.givenName || cliOrRaw.googleGivenName || '').trim().toUpperCase();
      const expApe = String(cliOrRaw.apellido || cliOrRaw.familyName || cliOrRaw.googleFamilyName || '').trim().toUpperCase();
      if (expNom && expApe) {
        return { nombre: expNom, apellido: expApe };
      }
    }
    const rawStr = typeof cliOrRaw === 'string'
      ? cliOrRaw
      : String(cliOrRaw.nombre || cliOrRaw.no || cliOrRaw.razonSocial || cliOrRaw.rs || '');
    const clean = rawStr.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!clean) return { nombre: '', apellido: '' };

    if (clean.includes(',')) {
      const [apePart, ...nomParts] = clean.split(',');
      return {
        apellido: String(apePart || '').trim(),
        nombre: nomParts.join(' ').trim()
      };
    }

    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      return { nombre: words[0], apellido: '' };
    }

    const w0Norm = normalizeNameToken(words[0]);
    const w1Norm = normalizeNameToken(words[1]);
    const w0IsFirst = COMMON_AR_FIRST_NAMES.has(w0Norm);
    const w1IsFirst = COMMON_AR_FIRST_NAMES.has(w1Norm);

    if (!w0IsFirst && w1IsFirst) {
      return {
        apellido: words[0],
        nombre: words.slice(1).join(' ')
      };
    }
    if (w0IsFirst) {
      return {
        nombre: words.slice(0, -1).join(' '),
        apellido: words[words.length - 1]
      };
    }
    if (typeof cliOrRaw === 'object' && String(cliOrRaw.origenRegistro || '').toUpperCase() === 'SISTEMA') {
      return {
        apellido: words[0],
        nombre: words.slice(1).join(' ')
      };
    }
    return {
      apellido: words[0],
      nombre: words.slice(1).join(' ')
    };
  };

  const extractClientFirstName = (cli) => {
    if (!cli) return 'Cliente';

    const explicitGiven = String(cli.nombrePila || cli.givenName || cli.googleGivenName || '').trim();
    if (explicitGiven) {
      const gw = explicitGiven.split(/[\s,]+/).filter(Boolean)[0];
      if (gw) return toNiceTitleWord(gw);
    }

    const rawNombre = String(cli.nombre || cli.no || '').trim();
    const rawRazon = String(cli.razonSocial || cli.rs || '').trim();
    const primary = rawNombre || rawRazon;
    if (!primary) return 'Cliente';

    const commaSource = rawNombre.includes(',') ? rawNombre : rawRazon.includes(',') ? rawRazon : '';
    if (commaSource) {
      const afterComma = commaSource.split(',').slice(1).join(' ').trim();
      const firstGiven = afterComma.split(/\s+/).filter(Boolean)[0];
      if (firstGiven) return toNiceTitleWord(firstGiven);
    }

    const docDigits = String(cli.nroDoc || cli.cuit || cli.dn || '').replace(/\D/g, '');
    const isCompanyByCuit = docDigits.length === 11 && /^(30|33|34)/.test(docDigits);
    const isCompanyByName = /\b(S\.?R\.?L\.?|S\.?A\.?S?\.?|S\.?H\.?|COOP\.?|COOPERATIVA|ASOC\.?|FUNDACION|MUNICIPALIDAD)\b/i.test(primary);
    if (isCompanyByCuit || isCompanyByName) {
      const cleanCorp = primary.replace(/\b(S\.?R\.?L\.?|S\.?A\.?S?\.?|S\.?H\.?)\b/gi, '').trim() || primary;
      return cleanCorp
        .split(/\s+/)
        .slice(0, 2)
        .map(toNiceTitleWord)
        .join(' ');
    }

    const words = primary.split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'Cliente';
    if (words.length === 1) return toNiceTitleWord(words[0]);

    const w0Norm = normalizeNameToken(words[0]);
    const w1Norm = normalizeNameToken(words[1]);
    const w0IsFirst = COMMON_AR_FIRST_NAMES.has(w0Norm);
    const w1IsFirst = COMMON_AR_FIRST_NAMES.has(w1Norm);

    if (!w0IsFirst && w1IsFirst) {
      return toNiceTitleWord(words[1]);
    }
    if (w0IsFirst) {
      return toNiceTitleWord(words[0]);
    }
    if (String(cli.origenRegistro || '').toUpperCase() === 'SISTEMA') {
      return toNiceTitleWord(words[1]);
    }
    return toNiceTitleWord(words[0]);
  };

  const getTimeOfDayGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 13) return 'Buen Día';
    if (h >= 13 && h < 20) return 'Buenas Tardes';
    return 'Buenas Noches';
  };

  const buildClientGreetingText = (cli) => {
    const firstName = extractClientFirstName(cli);
    return `${getTimeOfDayGreeting()} ${firstName}`;
  };

  // Regla de canales WhatsApp por listado:
  // - Listado Mayorista (Casa Nueva) -> +54 9 3584 36-7910 (5493584367910)
  // - Listado Minorista / Invitado   -> +54 9 3584 19-8605 (5493584198605)
  const getActiveStoreWhatsapp = () => {
    if (!STORE_BRAND.isPaseoAlberdi && state.client && getClientListaLabel() === 'MAYORISTA') {
      const digits = STORE_BRAND.whatsappMayoristaDigits || '5493584367910';
      const display = STORE_BRAND.whatsappMayoristaDisplay || '+54 9 3584 36-7910';
      return {
        digits,
        display,
        url: `https://wa.me/${digits}`,
        channelLabel: 'WhatsApp Mayorista'
      };
    }
    const digits = STORE_BRAND.whatsappDigits || '5493584198605';
    const display = STORE_BRAND.whatsappDisplay || '+54 9 3584 19-8605';
    return {
      digits,
      display,
      url: `https://wa.me/${digits}`,
      channelLabel: 'WhatsApp Minorista'
    };
  };

  const syncStoreWhatsappLinksByLista = () => {
    const wa = getActiveStoreWhatsapp();
    const fab = document.getElementById('floating-whatsapp-btn');
    if (fab) {
      fab.href = wa.url;
      fab.title = `Escribinos por ${wa.channelLabel} (${wa.display})`;
      fab.setAttribute('aria-label', `Contactar por ${wa.channelLabel} al ${wa.display}`);
    }
    document.querySelectorAll('.nx-help-pill').forEach((el) => {
      el.href = wa.url;
      el.title = `Ayuda por ${wa.channelLabel} (${wa.display})`;
    });
    document.querySelectorAll('.store-footer a[href*="wa.me/"]').forEach((el) => {
      el.href = wa.url;
      if (/\d{6,}/.test(el.textContent || '')) {
        el.textContent = `${wa.display} (${wa.channelLabel})`;
      }
    });
  };

  const getArticleUnitPrice = (art) => {
    if (!state.client) return 0;
    const lista = getClientListaLabel();
    if (lista === 'MAYORISTA' && Number(art.p2f) > 0) {
      return Number(art.p2f);
    }
    return Number(art.p1f) || 0;
  };

  const getArticleNetoPrice = (art) => {
    const finalPrice = getArticleUnitPrice(art);
    const alic = Number(art.al) || 21;
    return finalPrice / (1 + alic / 100);
  };

  // ==========================================
  // URL QUERY PARAMS (?searchComp=N&searchCat=N&page=1)
  // ==========================================
  const readUrlQueryParams = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pageParam = Number(params.get('page'));
      if (pageParam > 0) state.currentPage = pageParam;

      const searchParam = params.get('search') || params.get('q') || '';
      if (searchParam) {
        const sInp = document.getElementById('store-search-input');
        const hInp = document.getElementById('header-search-input');
        if (sInp) sInp.value = searchParam;
        if (hInp) hInp.value = searchParam;
      }

      const famParam = params.get('familia') || params.get('rubro');
      if (famParam) {
        state._initialRubro = famParam;
      }
      const marcaParam = params.get('marca');
      if (marcaParam) {
        state._initialMarca = marcaParam;
      }
    } catch (_e) {}
  };

  const syncUrlQueryParams = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('searchComp')) params.set('searchComp', 'N');
      if (!params.has('searchCat')) params.set('searchCat', 'N');
      params.set('page', String(state.currentPage));

      const q = (document.getElementById('store-search-input')?.value || '').trim();
      if (q) params.set('search', q);
      else params.delete('search');

      const rVal = document.getElementById('store-filter-rubro')?.value || 'ALL';
      if (rVal !== 'ALL') params.set('familia', rVal);
      else params.delete('familia');

      const mVal = document.getElementById('store-filter-marca')?.value || 'ALL';
      if (mVal !== 'ALL') params.set('marca', mVal);
      else params.delete('marca');

      const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState({}, '', newUrl);
    } catch (_e) {}
  };

  // ==========================================
  // SESSION & CART PERSISTENCE
  // ==========================================
  const loadSavedSession = () => {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id) {
          state.client = parsed;
        }
      }
    } catch (_e) {
      state.client = null;
    }

    try {
      const rawCart = localStorage.getItem(CART_STORAGE_KEY);
      if (rawCart) {
        const parsedCart = JSON.parse(rawCart);
        if (Array.isArray(parsedCart)) {
          state.cart = parsedCart;
        }
      }
    } catch (_e) {
      state.cart = [];
    }

    try {
      const rawSc = localStorage.getItem('cn_soy_cajero_items_v1');
      if (rawSc) {
        const parsedSc = JSON.parse(rawSc);
        if (Array.isArray(parsedSc)) {
          state.soyCajeroItems = parsedSc;
        }
      }
      localStorage.removeItem('cn_soy_cajero_last_ticket_v1');
      state.soyCajeroLastTicket = null;
    } catch (_e) {
      state.soyCajeroItems = [];
    }
  };

  const saveSoyCajeroLocal = () => {
    try {
      localStorage.setItem('cn_soy_cajero_items_v1', JSON.stringify(state.soyCajeroItems));
      localStorage.removeItem('cn_soy_cajero_last_ticket_v1');
    } catch (_e) {}
  };

  const saveSession = (clientObj) => {
    state.client = clientObj || null;
    try {
      if (clientObj) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(clientObj));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (_e) {}
    syncAuthUi();
    renderCatalogGrid();
    updateCartBadge();
    if (state.client) {
      loadClientPortalData();
    }
  };

  const saveCart = () => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
    } catch (_e) {}
    updateCartBadge();
    renderPortalHomeCards();
  };

  const syncAuthUi = () => {
    const guestActions = document.getElementById('guest-actions');
    const loggedActions = document.getElementById('logged-actions');
    const floatingLoginBtn = document.getElementById('btn-open-login');
    const guestBanner = document.getElementById('guest-promo-banner');
    const userNameEl = document.getElementById('logged-user-name');
    const userListaEl = document.getElementById('logged-user-lista');
    const bottomNav = document.getElementById('nx-bottom-nav');
    const storeFooter = document.getElementById('store-footer') || document.querySelector('.store-footer');
    const catalogSubbar = document.getElementById('catalog-logged-subbar');
    const heroWrap = document.getElementById('productos-hero-wrap');

    if (state.client) {
      document.documentElement.setAttribute('data-has-client', '1');
      if (guestActions) guestActions.hidden = true;
      if (floatingLoginBtn) floatingLoginBtn.hidden = true;
      if (loggedActions) loggedActions.hidden = false;
      if (guestBanner) guestBanner.hidden = true;
      if (heroWrap) heroWrap.hidden = true;
      if (bottomNav) bottomNav.hidden = false;
      if (storeFooter) storeFooter.hidden = true;
      if (catalogSubbar) catalogSubbar.hidden = false;
      document.body.classList.add('has-nx-bottom-nav');
      if (userNameEl) {
        userNameEl.textContent = buildClientGreetingText(state.client);
      }
      if (userListaEl) {
        userListaEl.textContent = 'LISTA ' + getClientListaLabel();
      }
      const headerAvatarSpan = document.querySelector('#chip-open-client-panel .logged-user-avatar');
      const fotoUrl = String(state.client.fotoUrl || state.client.picture || '').trim();
      if (headerAvatarSpan) {
        if (fotoUrl) {
          headerAvatarSpan.innerHTML = `<img src="${escapeHtml(fotoUrl)}" alt="" referrerpolicy="no-referrer" style="width:34px;height:34px;border-radius:50%;object-fit:cover;display:block;" onerror="this.parentElement.textContent='👤'" />`;
        } else {
          headerAvatarSpan.textContent = '👤';
        }
      }
      renderPortalHeader();
      renderPortalHomeCards();
      if (typeof showLoggedClientPromoPopupIfNeeded === 'function') {
        showLoggedClientPromoPopupIfNeeded();
      }
    } else {
      document.documentElement.removeAttribute('data-has-client');
      if (guestActions) guestActions.hidden = true;
      if (floatingLoginBtn) floatingLoginBtn.hidden = false;
      if (loggedActions) loggedActions.hidden = true;
      if (guestBanner) guestBanner.hidden = false;
      if (heroWrap && Array.isArray(state._publicBanners) && state._publicBanners.length > 0) {
        heroWrap.hidden = false;
      }
      if (bottomNav) bottomNav.hidden = true;
      if (storeFooter) storeFooter.hidden = false;
      if (catalogSubbar) catalogSubbar.hidden = true;
      document.body.classList.remove('has-nx-bottom-nav');
      if (typeof closeLoggedClientPromoPopup === 'function') {
        closeLoggedClientPromoPopup();
      }
    }
    syncStoreWhatsappLinksByLista();
  };

  // ==========================================
  // VIEW SWITCHING (CATÁLOGO <-> REGISTRACIÓN <-> PANEL DEL CLIENTE)
  // ==========================================
  const switchStoreView = (viewName) => {
    const viewCatalogo = document.getElementById('view-catalogo');
    const viewRegistro = document.getElementById('view-registro');
    const viewPanel = document.getElementById('view-panel-cliente');
    const tabCatalogo = document.getElementById('nav-tab-catalogo');
    const tabRegistro = document.getElementById('nav-tab-registro');

    if (viewName === 'registro') {
      if (viewCatalogo) {
        viewCatalogo.hidden = true;
        viewCatalogo.classList.remove('force-visible');
      }
      if (viewRegistro) viewRegistro.hidden = false;
      if (viewPanel) {
        viewPanel.hidden = true;
        viewPanel.classList.add('force-hidden');
      }
      tabCatalogo?.classList.remove('is-active');
      tabRegistro?.classList.add('is-active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (viewName === 'panel') {
      if (viewCatalogo) {
        viewCatalogo.hidden = true;
        viewCatalogo.classList.remove('force-visible');
      }
      if (viewRegistro) viewRegistro.hidden = true;
      if (viewPanel) {
        viewPanel.hidden = false;
        viewPanel.classList.remove('force-hidden');
      }
      tabCatalogo?.classList.remove('is-active');
      tabRegistro?.classList.remove('is-active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (viewCatalogo) {
        viewCatalogo.hidden = false;
        viewCatalogo.classList.add('force-visible');
      }
      if (viewRegistro) viewRegistro.hidden = true;
      if (viewPanel) {
        viewPanel.hidden = true;
        viewPanel.classList.add('force-hidden');
      }
      tabCatalogo?.classList.add('is-active');
      tabRegistro?.classList.remove('is-active');
      syncBottomNavActive('compra-web');
    }
  };

  // ==========================================
  // CATALOG LOADING & FILTERING
  // ==========================================
  const fetchCatalogPayloadWithFallback = async () => {
    const ts = Date.now();
    const endpoints = [
      `${CATALOG_API_URL}?action=store&t=${ts}`,
      `${CATALOG_API_URL}?action=all&t=${ts + 1}`
    ];
    let lastErr = null;
    for (const url of endpoints) {
      try {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), 18000) : null;
        const res = await fetch(url, {
          cache: 'no-store',
          signal: ctrl ? ctrl.signal : undefined
        });
        if (timer) clearTimeout(timer);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data && Array.isArray(data.articulos) && data.articulos.length > 0) {
          return data;
        }
        throw new Error('Catálogo vacío o formato inválido');
      } catch (e) {
        lastErr = e;
        console.warn('[Carrito] Intento de carga fallido en', url, e);
      }
    }
    throw lastErr || new Error('Error al cargar el catálogo');
  };

  const loadStoreCatalog = async () => {
    try {
      const labelLoading = document.getElementById('catalog-results-label');
      if (labelLoading) labelLoading.textContent = 'Cargando productos...';
      const data = await fetchCatalogPayloadWithFallback();

      state.rubrosMap.clear();
      (data.rubros || []).forEach((r) => {
        state.rubrosMap.set(Number(r.id), String(r.nombre || r.n || '').trim());
      });

      state.marcasMap.clear();
      (data.marcas || []).forEach((m) => {
        state.marcasMap.set(Number(m.id), String(m.nombre || m.n || '').trim());
      });

      if (data.fidelizacionCatalogConfig && typeof data.fidelizacionCatalogConfig === 'object') {
        if (Number(data.fidelizacionCatalogConfig.factorCanje) > 0) {
          state.portalData.fidelizacionConfig.factorCanje = Number(data.fidelizacionCatalogConfig.factorCanje);
        }
        if (data.fidelizacionCatalogConfig.mostrarEnCatalogo) {
          state.portalData.fidelizacionConfig.mostrarEnCatalogo =
            data.fidelizacionCatalogConfig.mostrarEnCatalogo === 'todos' ? 'todos' : 'solo_stock';
        }
        if (Array.isArray(data.fidelizacionCatalogConfig.reglasRubros)) {
          state.portalData.fidelizacionConfig.reglasRubros = data.fidelizacionCatalogConfig.reglasRubros;
        }
      }

      // Guardamos todos los artículos activos (bl !== 1) en state.allArticulos para Consultador de Precios y Soy Cajero en salón,
      // y filtramos state.articulos con Carrito Web (cw === 1) para el catálogo de Compra Web.
      const mappedActive = (data.articulos || [])
        .map((a) => ({
          id: Number(a.id),
          c: String(a.c || a.co || String(a.id).padStart(5, '0')),
          n: String(a.n || a.no || ''),
          r: Number(a.r ?? a.ru ?? 0),
          mk: Number(a.mk ?? a.ma ?? 0),
          bc: Array.isArray(a.bc) ? a.bc : [],
          fr: Number(a.fr) === 1 ? 1 : 0,
          bl: Number(a.bl) || 0,
          cw: a.cw === 0 || a.cw === false || a.cw === '0' ? 0 : 1,
          sf: Number(a.sf) || 0,
          al: Number(a.al) || 21,
          p1f: Number(a.p1f) || 0,
          p2f: Number(a.p2f) || 0,
          im: a.im || '',
          cfid: Number(a.cfid) || 0,
          pfidManual: Number(a.pfidManual) || 0,
          ptsCanje: Number(a.ptsCanje || a.pfid) || 0
        }))
        .filter((a) => a.bl !== 1);

      state.allArticulos = mappedActive;
      const onlyInStockStore = data.carritoWebStockMode !== 'todos_sin_stock';
      state.carritoWebStockMode = onlyInStockStore ? 'solo_con_stock' : 'todos_sin_stock';
      state.articulos = mappedActive.filter((a) => a.cw === 1 && (!onlyInStockStore || a.sf > 0));

      state.rubroCounts.clear();
      state.marcaCounts.clear();
      for (const art of state.articulos) {
        if (art.r) state.rubroCounts.set(art.r, (state.rubroCounts.get(art.r) || 0) + 1);
        if (art.mk) state.marcaCounts.set(art.mk, (state.marcaCounts.get(art.mk) || 0) + 1);
      }

      populateFilterDropdowns();
      if (state._initialRubro) {
        const rSel = document.getElementById('store-filter-rubro');
        if (rSel) rSel.value = state._initialRubro;
      }
      if (state._initialMarca) {
        const mSel = document.getElementById('store-filter-marca');
        if (mSel) mSel.value = state._initialMarca;
      }

      updateCatalogStats();
      applyCatalogFilters(false);
      renderPortalPremiosSection();
      updateCartBadge();
    } catch (err) {
      const label = document.getElementById('catalog-results-label');
      if (label) {
        label.innerHTML = 'No se pudo cargar el catálogo en este momento. <button type="button" id="btn-retry-catalog" style="margin-left:8px;padding:3px 10px;border-radius:999px;border:1px solid currentColor;background:transparent;cursor:pointer;font-weight:700;font-size:0.8rem;">🔄 Reintentar</button>';
        document.getElementById('btn-retry-catalog')?.addEventListener('click', () => loadStoreCatalog());
      }
      console.error(err);
    }
  };

  const populateFilterDropdowns = () => {
    const rubroSelect = document.getElementById('store-filter-rubro');
    const marcaSelect = document.getElementById('store-filter-marca');

    const sortedRubros = [...state.rubrosMap.entries()]
      .filter(([id]) => state.rubroCounts.has(id))
      .sort((a, b) => a[1].localeCompare(b[1], 'es-AR'));

    if (rubroSelect) {
      rubroSelect.innerHTML =
        `<option value="ALL">Todas las categorías</option>` +
        sortedRubros
          .map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`)
          .join('');
    }

    const sortedMarcas = [...state.marcasMap.entries()]
      .filter(([id]) => state.marcaCounts.has(id))
      .sort((a, b) => a[1].localeCompare(b[1], 'es-AR'));

    if (marcaSelect) {
      marcaSelect.innerHTML =
        `<option value="ALL">Todas las marcas</option>` +
        sortedMarcas
          .map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`)
          .join('');
    }

    renderSidebarListboxes();
  };

  const renderSidebarListboxes = () => {
    const rubroListEl = document.getElementById('rubro-listbox');
    const marcaListEl = document.getElementById('marca-listbox');
    const rubroSearch = (document.getElementById('rubro-list-search')?.value || '').trim().toUpperCase();
    const marcaSearch = (document.getElementById('marca-list-search')?.value || '').trim().toUpperCase();
    const currentRubro = document.getElementById('store-filter-rubro')?.value || 'ALL';
    const currentMarca = document.getElementById('store-filter-marca')?.value || 'ALL';

    if (rubroListEl) {
      const rubros = [...state.rubrosMap.entries()]
        .filter(([id, name]) => state.rubroCounts.has(id) && (!rubroSearch || name.toUpperCase().includes(rubroSearch)))
        .sort((a, b) => a[1].localeCompare(b[1], 'es-AR'));

      rubroListEl.innerHTML =
        `<li class="p-listbox-item ${currentRubro === 'ALL' ? 'is-selected' : ''}" data-rubro-id="ALL">
           <span>TODAS LAS CATEGORÍAS</span>
         </li>` +
        rubros
          .map(
            ([id, name]) => `
            <li class="p-listbox-item ${String(currentRubro) === String(id) ? 'is-selected' : ''}" data-rubro-id="${id}">
              <span>${escapeHtml(name)}</span>
            </li>`
          )
          .join('');
    }

    if (marcaListEl) {
      const marcas = [...state.marcasMap.entries()]
        .filter(([id, name]) => state.marcaCounts.has(id) && (!marcaSearch || name.toUpperCase().includes(marcaSearch)))
        .sort((a, b) => a[1].localeCompare(b[1], 'es-AR'));

      marcaListEl.innerHTML =
        `<li class="p-listbox-item ${currentMarca === 'ALL' ? 'is-selected' : ''}" data-marca-id="ALL">
           <span>TODAS LAS MARCAS</span>
         </li>` +
        marcas
          .map(
            ([id, name]) => `
            <li class="p-listbox-item ${String(currentMarca) === String(id) ? 'is-selected' : ''}" data-marca-id="${id}">
              <span>${escapeHtml(name)}</span>
            </li>`
          )
          .join('');
    }
  };

  const updateCatalogStats = () => {
    const total = state.articulos.length;
    let inStock = 0;
    let outStock = 0;
    for (const art of state.articulos) {
      if (Number(art.sf) > 0) inStock++;
      else outStock++;
    }
    const elTotal = document.getElementById('stat-total-published');
    const elIn = document.getElementById('stat-in-stock');
    const elOut = document.getElementById('stat-out-stock');
    const navTabCat = document.getElementById('nav-tab-catalogo');
    if (elTotal) elTotal.textContent = total.toLocaleString('es-AR');
    if (elIn) elIn.textContent = inStock.toLocaleString('es-AR');
    if (elOut) elOut.textContent = outStock.toLocaleString('es-AR');
    if (navTabCat) navTabCat.textContent = `📦 Catálogo (${total.toLocaleString('es-AR')})`;
  };

  const renderActiveFilterChips = () => {
    const container = document.getElementById('active-filter-chips');
    const badge = document.getElementById('active-filters-badge');
    if (!container) return;

    const q = (document.getElementById('store-search-input')?.value || '').trim().toUpperCase();
    const rubroVal = document.getElementById('store-filter-rubro')?.value || 'ALL';
    const marcaVal = document.getElementById('store-filter-marca')?.value || 'ALL';
    const stockVal = document.getElementById('store-filter-stock')?.value || 'ALL';

    const chips = [];
    if (q) {
      chips.push({ type: 'search', label: `Búsqueda: "${q}"` });
    }
    if (rubroVal !== 'ALL') {
      const rName = state.rubrosMap.get(Number(rubroVal)) || rubroVal;
      chips.push({ type: 'rubro', label: `Categoría: ${rName}` });
    }
    if (marcaVal !== 'ALL') {
      const mName = state.marcasMap.get(Number(marcaVal)) || marcaVal;
      chips.push({ type: 'marca', label: `Marca: ${mName}` });
    }
    if (stockVal !== 'ALL') {
      chips.push({
        type: 'stock',
        label: stockVal === 'IN_STOCK' ? 'Stock: Disponible' : 'Stock: Sin Stock'
      });
    }

    if (badge) {
      badge.textContent = String(chips.length);
      badge.hidden = chips.length === 0;
    }
    const barBadge = document.getElementById('bar-active-filters-badge');
    if (barBadge) {
      barBadge.textContent = String(chips.length);
      barBadge.hidden = chips.length === 0;
    }

    if (chips.length === 0) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }

    container.hidden = false;
    container.innerHTML = chips
      .map(
        (c) => `
        <span class="p-chip-tag">
          <span>${escapeHtml(c.label)}</span>
          <button type="button" data-remove-chip="${c.type}" aria-label="Quitar filtro">✕</button>
        </span>`
      )
      .join('');
  };

  const applyCatalogFilters = (resetPage = true) => {
    const q = (document.getElementById('store-search-input')?.value || '').trim().toUpperCase();
    const rubroVal = document.getElementById('store-filter-rubro')?.value || 'ALL';
    const marcaVal = document.getElementById('store-filter-marca')?.value || 'ALL';
    const stockVal = document.getElementById('store-filter-stock')?.value || 'ALL';
    const sortVal = document.getElementById('store-sort-select')?.value || 'NAME_ASC';

    // Sync header search input and stock quick pills
    const headerInput = document.getElementById('header-search-input');
    const headerClear = document.getElementById('btn-header-search-clear');
    if (headerInput && headerInput.value.trim().toUpperCase() !== q) {
      headerInput.value = q;
    }
    if (headerClear) {
      headerClear.hidden = q.length === 0;
    }

    document.querySelectorAll('[data-stock-filter]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-stock-filter') === stockVal);
    });

    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    const list = state.articulos.filter((art) => {
      if (rubroVal !== 'ALL' && Number(art.r) !== Number(rubroVal)) return false;
      if (marcaVal !== 'ALL' && Number(art.mk) !== Number(marcaVal)) return false;
      if (stockVal === 'IN_STOCK' && Number(art.sf) <= 0) return false;
      if (stockVal === 'OUT_OF_STOCK' && Number(art.sf) > 0) return false;

      if (tokens.length > 0) {
        const codeStr = String(art.c || '').toUpperCase();
        const nameStr = String(art.n || '').toUpperCase();
        const barStr = Array.isArray(art.bc) ? art.bc.map((b) => String(b.c || '')).join(' ').toUpperCase() : '';
        const marcaStr = String(state.marcasMap.get(Number(art.mk)) || '').toUpperCase();
        const rubroStr = String(state.rubrosMap.get(Number(art.r)) || '').toUpperCase();
        const haystack = `${codeStr} ${nameStr} ${barStr} ${marcaStr} ${rubroStr}`;
        for (const tk of tokens) {
          if (!haystack.includes(tk)) return false;
        }
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortVal === 'STOCK_FIRST') {
        const aStock = Number(a.sf) > 0 ? 1 : 0;
        const bStock = Number(b.sf) > 0 ? 1 : 0;
        if (aStock !== bStock) return bStock - aStock;
      }
      return String(a.n || '').localeCompare(String(b.n || ''), 'es-AR');
    });

    state.filteredArticulos = list;
    if (resetPage) state.currentPage = 1;

    renderSidebarListboxes();
    renderActiveFilterChips();
    renderCatalogGrid();
    syncUrlQueryParams();
  };

  const buildPageNumbersHtml = (currentPage, totalPages) => {
    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let p = start; p <= end; p++) {
      pages.push(
        `<button type="button" class="btn-page-num ${p === currentPage ? 'is-active' : ''}" data-goto-page="${p}">${p}</button>`
      );
    }
    return pages.join('');
  };

  const renderCatalogGrid = () => {
    const grid = document.getElementById('store-grid');
    if (!grid) return;

    const total = state.filteredArticulos.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    const startIdx = (state.currentPage - 1) * state.pageSize;
    const pageItems = state.filteredArticulos.slice(startIdx, startIdx + state.pageSize);

    const summaryText =
      total === 0
        ? 'No se encontraron resultados para la búsqueda..'
        : `Mostrando ${startIdx + 1}–${startIdx + pageItems.length} productos`;

    const lblTop = document.getElementById('catalog-results-label');
    const lblBot = document.getElementById('catalog-results-label-bottom');
    if (lblTop) lblTop.textContent = summaryText;
    if (lblBot) lblBot.textContent = summaryText;

    const pageText = `Página ${state.currentPage} de ${totalPages.toLocaleString('es-AR')}`;
    const indTop = document.getElementById('catalog-page-indicator');
    const indBot = document.getElementById('catalog-page-indicator-bottom');
    if (indTop) indTop.textContent = pageText;
    if (indBot) indBot.textContent = pageText;

    const numsHtml = buildPageNumbersHtml(state.currentPage, totalPages);
    const numTop = document.getElementById('pagination-numbers-top');
    const numBot = document.getElementById('pagination-numbers-bottom');
    if (numTop) numTop.innerHTML = numsHtml;
    if (numBot) numBot.innerHTML = numsHtml;

    const prevTop = document.getElementById('btn-page-prev');
    const nextTop = document.getElementById('btn-page-next');
    const prevBot = document.getElementById('btn-page-prev-bottom');
    const nextBot = document.getElementById('btn-page-next-bottom');
    if (prevTop) prevTop.disabled = state.currentPage <= 1;
    if (prevBot) prevBot.disabled = state.currentPage <= 1;
    if (nextTop) nextTop.disabled = state.currentPage >= totalPages;
    if (nextBot) nextBot.disabled = state.currentPage >= totalPages;

    if (pageItems.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 3rem 1.5rem; background:#fff; border:1px solid var(--surface-border); border-radius:12px;">
          <p style="font-size:1rem; font-weight:600; color:var(--text-primary); margin:0 0 0.5rem;">No se encuentran resultados para la búsqueda..</p>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">Probá con otro término o hacé clic en "Limpiar" en el panel de filtros.</p>
        </div>`;
      return;
    }

    const isLogged = Boolean(state.client);
    const clientListaLabel = isLogged ? getClientListaLabel() : '';

    grid.innerHTML = pageItems
      .map((art, idx) => {
        const hasStock = Number(art.sf) > 0;
        const code = escapeHtml(art.c || String(art.id).padStart(5, '0'));
        const name = escapeHtml(art.n || 'ARTÍCULO SIN NOMBRE');
        const rubroName = escapeHtml(state.rubrosMap.get(Number(art.r)) || 'ALMACÉN');
        const marcaName = escapeHtml(state.marcasMap.get(Number(art.mk)) || '');
        const resolvedImg = resolveStoreArticleImage(art);
        const loadingAttr = idx < 4 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy" decoding="async"';

        const mediaHtml = `<img src="${escapeHtml(resolvedImg.primary)}" data-fb="${escapeHtml(resolvedImg.fallback)}" alt="${name}" ${loadingAttr} onerror="if(!this.dataset.triedFb){this.dataset.triedFb='1';this.src=this.dataset.fb;}else{this.onerror=null;this.src='../sistema/assets/img/icon-192.png';}" />`;

        const stockBadgeHtml = hasStock
          ? `<span class="stock-badge in-stock">Disponible</span>`
          : `<span class="stock-badge out-stock">Sin Stock</span>`;

        const unitPrice = isLogged ? getArticleUnitPrice(art) : 0;
        const netoPrice = isLogged ? getArticleNetoPrice(art) : 0;

        const pricingSectionHtml = isLogged
          ? `<div class="product-card-pricing">
               <div class="price-unlocked-box">
                 <div class="price-unlocked-row">
                   <span class="price-unlocked-label">Precio Final (${escapeHtml(clientListaLabel)})</span>
                   <strong class="price-unlocked-value">${formatArs(unitPrice)}</strong>
                 </div>
                 <div class="price-neto-normativa">
                   Precio sin impuestos nacionales: ${formatArs(netoPrice)}
                 </div>
               </div>
             </div>`
          : '';

        let footerHtml = '';
        if (!isLogged) {
          footerHtml = `
            <button type="button" class="btn-card-action btn-card-login" data-action="prompt-login">
              🔑 Iniciar sesión para ver precios
            </button>
          `;
        } else if (!hasStock) {
          footerHtml = `
            <button type="button" class="btn-card-action btn-card-out" disabled>
              🚫 Sin Stock Disponible
            </button>
          `;
        } else {
          footerHtml = `
            <div class="touchspin-group">
              <button type="button" class="btn-touchspin" data-action="qty-dec" data-art-id="${art.id}" aria-label="Disminuir cantidad">−</button>
              <input type="number" class="qty-stepper" min="1" max="999" value="1" aria-label="Cantidad para ${name}" data-qty-for="${art.id}" />
              <button type="button" class="btn-touchspin" data-action="qty-inc" data-art-id="${art.id}" aria-label="Aumentar cantidad">+</button>
            </div>
            <button type="button" class="btn-card-action btn-card-add" data-action="add-to-cart" data-art-id="${art.id}">
              🛒 Agregar
            </button>
          `;
        }

        return `
          <article class="product-card ${hasStock ? '' : 'is-out-of-stock'}">
            <div class="product-card-media" data-action="quickview" data-art-id="${art.id}" title="Ver detalle del producto">
              <span class="code-badge">#${code}</span>
              ${stockBadgeHtml}
              ${mediaHtml}
              <button type="button" class="btn-quickview-eye" data-action="quickview" data-art-id="${art.id}" title="Ver Detalle" aria-label="Ver detalle de ${name}">
                👁️
              </button>
            </div>
            <header>
              <div class="product-meta-tags">
                <span class="product-meta-marca">${marcaName || STORE_BRAND.upperName}</span>
                <span> · ${rubroName}</span>
              </div>
              <h3 data-action="quickview" data-art-id="${art.id}">${name}</h3>
              <p class="product-code-line">Cód. #${code}</p>
            </header>
            ${pricingSectionHtml}
            <footer>
              ${footerHtml}
            </footer>
          </article>
        `;
      })
      .join('');
  };

  const getWebFallbackImageUrl = (art) => {
    const mainBc = Array.isArray(art.bc) && art.bc.length > 0 ? art.bc[0].c || '' : '';
    const query = `${mainBc ? mainBc + ' ' : ''}${art.n || ''} supermercado producto fondo blanco`.trim();
    const hostIdx = ((Number(art.id) || 1) % 4) + 1;
    return `https://tse${hostIdx}.mm.bing.net/th?q=${encodeURIComponent(query)}&w=400&h=400&c=7&rs=1&p=0`;
  };

  const resolveStoreArticleImage = (art) => {
    const webFallback = getWebFallbackImageUrl(art);
    const rawIm = String(art.im || '').trim();
    if (!rawIm) {
      return { primary: webFallback, fallback: webFallback };
    }
    if (
      rawIm.startsWith('http://') ||
      rawIm.startsWith('https://') ||
      rawIm.startsWith('/') ||
      rawIm.startsWith('data:')
    ) {
      return { primary: rawIm, fallback: webFallback };
    }
    if (rawIm.startsWith('assets/')) {
      return { primary: `../sistema/${rawIm}`, fallback: webFallback };
    }
    return {
      primary: SINERGIAL_IMG_BASE + encodeURIComponent(rawIm),
      fallback: webFallback
    };
  };

  const findAnyArticleById = (artId) => {
    const idNum = Number(artId);
    return (
      state.allArticulos.find((a) => Number(a.id) === idNum) ||
      state.articulos.find((a) => Number(a.id) === idNum) ||
      null
    );
  };

  // ==========================================
  // QUICKVIEW PRODUCT DETAIL MODAL
  // ==========================================
  const openQuickViewModal = (artId, opts = {}) => {
    const art = findAnyArticleById(artId);
    const dialog = document.getElementById('product-detail-dialog');
    const content = document.getElementById('quickview-content');
    const rubroEl = document.getElementById('detail-dialog-rubro');
    const titleEl = document.getElementById('detail-dialog-title');
    if (!art || !dialog || !content) return;

    const panelPremiosOpen =
      !document.getElementById('view-panel-cliente')?.hidden &&
      !document.getElementById('nx-subview-premios')?.hidden;
    const isPremio = Boolean((opts && opts.isPremio) || panelPremiosOpen);

    const hasStock = Number(art.sf) > 0;
    const code = escapeHtml(art.c || String(art.id).padStart(5, '0'));
    const name = escapeHtml(art.n || 'ARTÍCULO');
    const rubroName = escapeHtml(state.rubrosMap.get(Number(art.r)) || 'ALMACÉN');
    const marcaName = escapeHtml(state.marcasMap.get(Number(art.mk)) || STORE_BRAND.upperName);
    const barcodes = Array.isArray(art.bc) && art.bc.length ? art.bc.map((b) => escapeHtml(b.c)).join(', ') : 'No informado';
    const resolvedImg = resolveStoreArticleImage(art);

    if (rubroEl) rubroEl.textContent = `${marcaName} · ${rubroName}`;
    if (titleEl) titleEl.textContent = art.n || 'Detalle del Producto';

    if (isPremio) {
      const reqPts = getPremioRequiredPoints(art);
      const userPts = getActiveClientPoints();
      const usedPts = state.premiosCart.reduce((acc, it) => acc + it.cantidad * it.puntosUnit, 0);
      const availablePts = Math.max(0, userPts - usedPts);
      const canAfford = hasStock && reqPts > 0 && availablePts >= reqPts;
      const missingPts = Math.max(0, reqPts - availablePts);
      const maxQty = reqPts > 0 ? Math.max(1, Math.floor(availablePts / reqPts)) : 1;

      content.innerHTML = `
        <div class="quickview-img-box">
          <img src="${escapeHtml(resolvedImg.primary)}" data-fb="${escapeHtml(resolvedImg.fallback)}" alt="${name}" onerror="if(!this.dataset.triedFb){this.dataset.triedFb='1';this.src=this.dataset.fb;}else{this.onerror=null;this.src='../sistema/assets/img/icon-192.png';}" />
        </div>
        <div class="quickview-details">
          <span class="stock-badge ${hasStock ? 'in-stock' : 'out-stock'}" style="position:static; display:inline-block; margin-bottom:0.5rem;">
            ${hasStock ? 'Disponible' : 'Sin Stock'}
          </span>
          <h4>${name}</h4>
          <ul class="quickview-meta-list">
            <li><strong>Marca:</strong> ${marcaName}</li>
            <li><strong>Categoría / Rubro:</strong> ${rubroName}</li>
          </ul>
          <div style="margin-bottom: 1rem;">
            <div class="price-unlocked-box nx-premio-pts-box ${canAfford ? 'is-affordable' : 'is-locked'}" style="align-items:flex-start; text-align:left; padding:0.65rem 0.85rem; gap:0.28rem;">
              <div class="price-unlocked-row" style="justify-content:flex-start;">
                <strong class="price-unlocked-value" style="display:inline-flex; align-items:center; gap:0.42rem; font-size:1.38rem; font-weight:800;">${cfBadgeSvg(24)} <span>${reqPts.toLocaleString('es-AR')} pts</span></strong>
              </div>
              <div class="price-neto-normativa">
                ${
                  canAfford
                    ? `✅ Puntos suficientes (${availablePts.toLocaleString('es-AR')} pts disp.)`
                    : `🔒 Te faltan ${missingPts.toLocaleString('es-AR')} pts para canjear`
                }
              </div>
            </div>
          </div>
          <div style="display:flex; gap:0.6rem; align-items:center;">
            ${
              !hasStock
                ? `<button type="button" class="btn-card-action btn-card-out" disabled>🚫 Sin Stock Disponible</button>`
                : canAfford
                  ? `<input type="number" id="qv-premio-qty-input" class="qty-stepper" style="border:1px solid var(--surface-border); border-radius:6px; width:68px; height:38px;" min="1" max="${maxQty}" value="1" />
                     <button type="button" class="btn-primary-theme" id="btn-qv-add-premio" data-art-id="${art.id}">🎁 Agregar al Carrito de Premios</button>`
                  : `<button type="button" class="btn-card-action btn-premio-disabled" disabled aria-disabled="true">🎁 Agregar al Carrito de Premios</button>`
            }
          </div>
        </div>
      `;

      document.getElementById('btn-qv-add-premio')?.addEventListener('click', () => {
        const wantedQty = Math.max(1, Number(document.getElementById('qv-premio-qty-input')?.value) || 1);
        const curUserPts = getActiveClientPoints();
        const curUsedPts = state.premiosCart.reduce((acc, it) => acc + it.cantidad * it.puntosUnit, 0);
        const curAvail = Math.max(0, curUserPts - curUsedPts);
        const allowedQty = reqPts > 0 ? Math.min(wantedQty, Math.floor(curAvail / reqPts)) : 0;
        if (allowedQty <= 0) {
          showToast(`⚠️ No tenés puntos suficientes disponibles (${reqPts.toLocaleString('es-AR')} pts requeridos) para agregar este premio.`);
          renderPortalPremiosSection();
          dialog.close();
          return;
        }
        const existing = state.premiosCart.find((it) => Number(it.artId) === Number(art.id));
        if (existing) {
          existing.cantidad += allowedQty;
        } else {
          state.premiosCart.push({
            artId: art.id,
            artCodigo: art.c,
            artNombre: art.n,
            cantidad: allowedQty,
            puntosUnit: reqPts
          });
        }
        renderPortalPremiosSection();
        showToast(`🎁 "${art.n}" agregado a tu Carrito de Premios.`);
        dialog.close();
      });

      dialog.showModal();
      return;
    }

    const isLogged = Boolean(state.client);
    const unitPrice = isLogged ? getArticleUnitPrice(art) : 0;
    const netoPrice = isLogged ? getArticleNetoPrice(art) : 0;

    content.innerHTML = `
      <div class="quickview-img-box">
        <img src="${escapeHtml(resolvedImg.primary)}" data-fb="${escapeHtml(resolvedImg.fallback)}" alt="${name}" onerror="if(!this.dataset.triedFb){this.dataset.triedFb='1';this.src=this.dataset.fb;}else{this.onerror=null;this.src='../sistema/assets/img/icon-192.png';}" />
      </div>
      <div class="quickview-details">
        <span class="stock-badge ${hasStock ? 'in-stock' : 'out-stock'}" style="position:static; display:inline-block; margin-bottom:0.5rem;">
          ${hasStock ? 'Disponible' : 'Sin Stock'}
        </span>
        <h4>${name}</h4>
        <ul class="quickview-meta-list">
          <li><strong>Código de Artículo:</strong> #${code}</li>
          <li><strong>Marca:</strong> ${marcaName}</li>
          <li><strong>Categoría / Rubro:</strong> ${rubroName}</li>
          <li><strong>Código de Barras (EAN):</strong> ${barcodes}</li>
        </ul>
        ${
          isLogged
            ? `<div style="margin-bottom: 1rem;">
                 <div class="price-unlocked-box">
                   <div class="price-unlocked-row">
                     <span class="price-unlocked-label">Precio Final (${escapeHtml(getClientListaLabel())})</span>
                     <strong class="price-unlocked-value">${formatArs(unitPrice)}</strong>
                   </div>
                   <div class="price-neto-normativa">Precio sin impuestos nacionales: ${formatArs(netoPrice)}</div>
                 </div>
               </div>`
            : ''
        }
        <div style="display:flex; gap:0.6rem; align-items:center;">
          ${
            !isLogged
              ? `<button type="button" class="btn-primary-theme" id="btn-qv-login">🔑 Iniciar Sesión para Ver Precios</button>`
              : hasStock
                ? `<input type="number" id="qv-qty-input" class="qty-stepper" style="border:1px solid var(--surface-border); border-radius:6px; width:68px; height:38px;" min="1" max="999" value="1" />
                   <button type="button" class="btn-primary-theme" id="btn-qv-add" data-art-id="${art.id}">🛒 Agregar al Carrito</button>`
                : `<button type="button" class="btn-card-action btn-card-out" disabled>🚫 Sin Stock Disponible</button>`
          }
        </div>
      </div>
    `;

    document.getElementById('btn-qv-login')?.addEventListener('click', () => {
      dialog.close();
      document.getElementById('login-dialog')?.showModal();
    });

    document.getElementById('btn-qv-add')?.addEventListener('click', () => {
      const qvQty = Number(document.getElementById('qv-qty-input')?.value) || 1;
      addToCart(art.id, qvQty);
      dialog.close();
    });

    dialog.showModal();
  };

  // ==========================================
  // SHOPPING CART LOGIC
  // ==========================================
  const addToCart = (artId, qty) => {
    if (!state.client) {
      document.getElementById('login-dialog')?.showModal();
      return;
    }
    const art = findAnyArticleById(artId);
    if (!art) return;
    if (Number(art.sf) <= 0) {
      showToast('Este artículo se encuentra Sin Stock.');
      return;
    }

    const cleanQty = Math.max(1, Number(qty) || 1);
    const existing = state.cart.find((item) => Number(item.id) === Number(art.id));
    if (existing) {
      existing.qty += cleanQty;
    } else {
      state.cart.push({
        id: Number(art.id),
        co: art.c || String(art.id).padStart(5, '0'),
        no: art.n,
        qty: cleanQty
      });
    }
    saveCart();
    showToast(`🛒 Agregado al carrito: ${cleanQty} x ${art.n}`);
  };

  const updateCartBadge = () => {
    const countBadge = document.getElementById('cart-count-badge');
    const totalBadge = document.getElementById('cart-total-badge');
    const inlineCountBadge = document.getElementById('cart-inline-count-badge');
    const inlineTotalBadge = document.getElementById('cart-inline-total-badge');
    let totalUnits = 0;
    let totalAmount = 0;

    for (const item of state.cart) {
      const art = findAnyArticleById(item.id);
      const unitPrice = art ? getArticleUnitPrice(art) : 0;
      totalUnits += Number(item.qty) || 0;
      totalAmount += (Number(item.qty) || 0) * unitPrice;
    }

    if (countBadge) countBadge.textContent = String(totalUnits);
    if (totalBadge) totalBadge.textContent = formatArs(totalAmount);
    if (inlineCountBadge) inlineCountBadge.textContent = String(totalUnits);
    if (inlineTotalBadge) inlineTotalBadge.textContent = formatArs(totalAmount);
  };

  const renderCartModal = () => {
    const container = document.getElementById('cart-items-container');
    const modalTotal = document.getElementById('cart-modal-total');
    if (!container || !modalTotal) return;

    if (state.cart.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding: 1.5rem; color: var(--text-secondary);">Tu carrito de compras está vacío.</div>`;
      modalTotal.textContent = '$ 0,00';
      return;
    }

    let total = 0;
    container.innerHTML = state.cart
      .map((item) => {
        const art = findAnyArticleById(item.id);
        const unitPrice = art ? getArticleUnitPrice(art) : 0;
        const subtotal = unitPrice * (Number(item.qty) || 1);
        total += subtotal;

        return `
          <div class="cart-item-row">
            <div class="cart-item-info">
              <strong>${escapeHtml(item.no)}</strong>
              <small>Cód. #${escapeHtml(item.co)} · Unitario: ${formatArs(unitPrice)}</small>
            </div>
            <input type="number" class="qty-stepper" style="border:1px solid var(--surface-border); border-radius:6px; width:64px;" min="1" max="999" value="${item.qty}" data-cart-qty-id="${item.id}" />
            <strong style="font-family: var(--font-mono); min-width: 105px; text-align:right;">${formatArs(subtotal)}</strong>
            <button type="button" class="btn-ghost-danger" data-cart-remove-id="${item.id}" title="Quitar">✕</button>
          </div>
        `;
      })
      .join('');

    modalTotal.textContent = formatArs(total);
  };

  // ==========================================
  // CASCADING DROPDOWNS (PAÍS -> PROVINCIA -> LOCALIDAD -> C.P.)
  // ==========================================
  const loadGeoCatalogFromClientesApi = async () => {
    try {
      const res = await fetch(`${CLIENTES_API_URL}?action=all&t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data?.googleOAuthConfig?.clientId) {
        state.googleClientId = String(data.googleOAuthConfig.clientId).trim();
        try {
          localStorage.setItem('cn_google_oauth_client_id', state.googleClientId);
        } catch (_e) {}
      }
      const cats = data?.catalogs || data;
      if (cats) {
        if (Array.isArray(cats.paises) && cats.paises.length) {
          state.geo.paises = [...new Set([...DEFAULT_GEO.paises, ...cats.paises])].sort();
        }
        if (Array.isArray(cats.provincias) && cats.provincias.length) {
          const existing = state.geo.provincias.ARGENTINA || [];
          state.geo.provincias.ARGENTINA = [...new Set([...existing, ...cats.provincias])].sort();
        }
        const locByProv = cats.localidadesPorProvincia || cats.localidades;
        if (locByProv && typeof locByProv === 'object') {
          for (const [prov, locs] of Object.entries(locByProv)) {
            const existing = state.geo.localidades[prov] || [];
            const mapByName = new Map();
            existing.forEach((l) => mapByName.set(l.n, l));
            (locs || []).forEach((l) => {
              const name = String(l?.nombre || l?.n || '').toUpperCase();
              if (name) {
                mapByName.set(name, { n: name, cp: String(l?.cp || '') });
              }
            });
            state.geo.localidades[prov] = [...mapByName.values()].sort((a, b) => a.n.localeCompare(b.n, 'es-AR'));
          }
        }
      }
    } catch (_e) {}
    initRegistrationGeoDropdowns();
    initGoogleIdentityServices();
  };

  const initRegistrationGeoDropdowns = () => {
    const setupGeoCascade = (paisId, provId, locId, cpId) => {
      const selPais = document.getElementById(paisId);
      const selProv = document.getElementById(provId);
      const selLoc = document.getElementById(locId);
      const inpCp = document.getElementById(cpId);
      if (!selPais || !selProv || !selLoc) return;

      selPais.innerHTML = state.geo.paises
        .map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`)
        .join('');
      selPais.value = 'ARGENTINA';

      const populateProvincias = () => {
        const pais = selPais.value || 'ARGENTINA';
        const provs = state.geo.provincias[pais] || ['CÓRDOBA'];
        selProv.innerHTML = provs
          .map((pr) => `<option value="${escapeHtml(pr)}">${escapeHtml(pr)}</option>`)
          .join('');
        if (provs.includes('CÓRDOBA')) selProv.value = 'CÓRDOBA';
        populateLocalidades();
      };

      const populateLocalidades = () => {
        const prov = selProv.value || 'CÓRDOBA';
        const locs = state.geo.localidades[prov] || [{ n: 'ALCIRA GIGENA', cp: '5813' }];
        selLoc.innerHTML = locs
          .map((l) => `<option value="${escapeHtml(l.n)}" data-cp="${escapeHtml(l.cp || '')}">${escapeHtml(l.n)}${l.cp ? ` (CP ${escapeHtml(l.cp)})` : ''}</option>`)
          .join('');
        if (locs.some((l) => l.n === 'ALCIRA GIGENA')) {
          selLoc.value = 'ALCIRA GIGENA';
        }
        syncCpFromLocalidad();
      };

      const syncCpFromLocalidad = () => {
        const opt = selLoc.options[selLoc.selectedIndex];
        const cp = opt?.getAttribute('data-cp') || '';
        if (cp && inpCp) inpCp.value = cp;
      };

      selPais.onchange = populateProvincias;
      selProv.onchange = populateLocalidades;
      selLoc.onchange = syncCpFromLocalidad;

      populateProvincias();
    };

    setupGeoCascade('reg-pais', 'reg-provincia', 'reg-localidad', 'reg-cp');
    setupGeoCascade('reg-pais-fiscal', 'reg-provincia-fiscal', 'reg-localidad-fiscal', 'reg-cp-fiscal');
    setupGeoCascade('nx-prof-pais', 'nx-prof-provincia', 'nx-prof-localidad', 'nx-prof-cp');
    setupGeoCascade('nx-prof-pais-fiscal', 'nx-prof-provincia-fiscal', 'nx-prof-localidad-fiscal', 'nx-prof-cp-fiscal');
  };

  // ==========================================
  // BONOS CLUB FIDEL (+1.000 PTS APP + RECOMENDÁ A UN AMIGO)
  // ==========================================
  const PENDING_REF_STORAGE_KEY = STORE_BRAND.storagePrefix + 'pending_ref_code_v1';

  const normalizeReferralCodeInput = (raw) => {
    const clean = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!clean) return '';
    if (/^\d+$/.test(clean)) return `CF-${clean}`;
    return clean;
  };

  const getPendingRefCode = () => {
    const regInp = (document.getElementById('reg-codigo-referido')?.value || '').trim();
    if (regInp) return normalizeReferralCodeInput(regInp);
    const quickInp = (document.getElementById('quick-reg-codigo-referido')?.value || '').trim();
    if (quickInp) return normalizeReferralCodeInput(quickInp);
    const gInp = (document.getElementById('google-auth-codigo-referido')?.value || '').trim();
    if (gInp) return normalizeReferralCodeInput(gInp);
    try {
      const urlP = new URLSearchParams(window.location.search || '');
      const fromUrl = urlP.get('ref') || urlP.get('invitacion') || urlP.get('referido') || '';
      if (fromUrl) return normalizeReferralCodeInput(fromUrl);
      const saved = localStorage.getItem(PENDING_REF_STORAGE_KEY) || '';
      if (saved) return normalizeReferralCodeInput(saved);
    } catch (_e) {}
    return '';
  };

  const setPendingRefCode = (rawCode) => {
    const code = normalizeReferralCodeInput(rawCode);
    if (!code) return '';
    try {
      localStorage.setItem(PENDING_REF_STORAGE_KEY, code);
    } catch (_e) {}
    ['reg-codigo-referido', 'quick-reg-codigo-referido', 'google-auth-codigo-referido', 'nx-manual-ref-code-input'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.value.trim()) el.value = code;
    });
    return code;
  };

  const clearPendingRefCode = () => {
    try {
      localStorage.removeItem(PENDING_REF_STORAGE_KEY);
    } catch (_e) {}
  };

  const getClientReferralCode = (cli = state.client) => {
    if (!cli) return 'CF-000';
    const cod = String(cli.codigo || cli.co || cli.id || '').trim();
    return cod ? `CF-${cod}` : 'CF-000';
  };

  const getClientReferralUrl = (cli = state.client) => {
    const code = getClientReferralCode(cli);
    const baseUrl = STORE_BRAND.isPaseoAlberdi
      ? 'https://www.paseoalberdi.ar/carrito/'
      : 'https://www.cn.com.ar/carrito/';
    return `${baseUrl}?ref=${encodeURIComponent(code)}`;
  };

  const shareClientReferralWhatsApp = (cli = state.client) => {
    if (!cli) return;
    const code = getClientReferralCode(cli);
    const url = getClientReferralUrl(cli);
    const msg = [
      `🎁 ¡Hola! Te invito a registrarte en el *${STORE_BRAND.clubName}* de *${STORE_BRAND.name}*.`,
      `Registrate gratis desde mi enlace y nos regalan *+1.000 puntos a cada uno* para canjear por premios en el catálogo:`,
      `👉 ${url}`,
      `(Código de amigo: *${code}*)`
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const copyClientReferralLink = async (cli = state.client) => {
    if (!cli) return;
    const code = getClientReferralCode(cli);
    const url = getClientReferralUrl(cli);
    try {
      await navigator.clipboard.writeText(url);
      showToast(`🔗 ¡Link de invitación (${code}) copiado! Compartilo por WhatsApp para ganar +1.000 pts c/u.`);
    } catch (_e) {
      showToast(`🔗 Tu link: ${url}`);
    }
  };

  const isRunningStandalonePwa = () =>
    Boolean(
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
        window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
        window.navigator?.standalone === true
    );

  let claimingPwaBonusInProgress = false;
  const checkAndClaimPwaInstallBonus = async (forceClaim = false) => {
    if (!state.client || !state.client.id || claimingPwaBonusInProgress) return;
    if (state.client.bonoAppInstaladaOtorgado) return;
    if (!forceClaim && !isRunningStandalonePwa()) return;

    claimingPwaBonusInProgress = true;
    try {
      const res = await fetch(CLIENTES_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim_pwa_install_bonus',
          cId: state.client.id || 0,
          codigo: state.client.codigo || state.client.co || 0,
          nroDoc: state.client.nroDoc || state.client.nd || ''
        })
      });
      const data = await res.json();
      if (data && data.ok && data.client) {
        saveSession(data.client);
        renderPortalHomeCards();
        if (data.granted) {
          showToast(
            `🎉 ¡Felicitaciones! Sumaste +${(Number(data.pointsAdded) || 1000).toLocaleString('es-AR')} puntos en ${STORE_BRAND.clubName} por instalar la App Oficial.`
          );
          await loadClientPortalData();
        }
      }
    } catch (_e) {
      // Silencioso en segundo plano
    } finally {
      claimingPwaBonusInProgress = false;
    }
  };

  const initReferralInviteDetection = async () => {
    const code = getPendingRefCode();
    if (!code) return;
    setPendingRefCode(code);

    try {
      const res = await fetch(CLIENTES_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_referrer_info', ref: code })
      });
      const data = await res.json();
      if (data && data.ok && data.referrer) {
        const refName = String(data.referrer.nombre || 'UN AMIGO').trim();
        const refCodeNorm = String(data.referrer.refCode || code).trim();

        const b1 = document.getElementById('reg-referral-invite-banner');
        const t1 = document.getElementById('reg-referral-invite-title');
        const d1 = document.getElementById('reg-referral-invite-desc');
        if (b1) b1.hidden = false;
        if (t1) t1.textContent = `¡${refName} (${refCodeNorm}) te invitó a ${STORE_BRAND.clubName}!`;
        if (d1) {
          d1.innerHTML = `Completá tu registro gratis y ambos reciben <strong>+1.000 puntos de regalo</strong> para el Catálogo de Premios.`;
        }

        const b2 = document.getElementById('quick-reg-referral-banner');
        const t2 = document.getElementById('quick-reg-referral-title');
        const d2 = document.getElementById('quick-reg-referral-desc');
        if (b2) b2.hidden = false;
        if (t2) t2.textContent = `¡Invitación de ${refName} (${refCodeNorm})!`;
        if (d2) d2.innerHTML = `Al completar tu registro sumás <strong>+1.000 puntos</strong> gratis.`;

        const b3 = document.getElementById('google-auth-referral-banner');
        const t3 = document.getElementById('google-auth-referral-title');
        const d3 = document.getElementById('google-auth-referral-desc');
        if (b3) b3.hidden = false;
        if (t3) t3.textContent = `¡Invitación de ${refName} (${refCodeNorm})!`;
        if (d3) d3.innerHTML = `Al registrarte con Google sumás <strong>+1.000 puntos</strong> gratis.`;
      }
    } catch (_e) {}
  };

  // ==========================================
  // EVENT LISTENERS & INITIALIZATION
  // ==========================================
  const initStoreEvents = () => {
    // Uppercase enforcement for all .uppercase-input fields
    document.addEventListener('input', (e) => {
      const target = e.target;
      if (target && target.classList && target.classList.contains('uppercase-input')) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        target.value = target.value.toUpperCase();
        if (typeof start === 'number' && typeof end === 'number') {
          try {
            target.setSelectionRange(start, end);
          } catch (_err) {}
        }
      }
    });

    // Auto-copy Nombre to Razón Social if Razón Social is empty
    const regNombre = document.getElementById('reg-nombre');
    const regRazon = document.getElementById('reg-razon-social');
    regNombre?.addEventListener('blur', () => {
      if (regRazon && !regRazon.value.trim()) {
        regRazon.value = regNombre.value.trim().toUpperCase();
      }
    });

    // Toggle Left Filter Sidebar (Ocultos por defecto, botón Mostrar / Ocultar filtros en la barra)
    const syncFilterSidebarButtonState = () => {
      const wrapper = document.getElementById('product-wrapper');
      const barBtn = document.getElementById('btn-bar-toggle-filters');
      const barLbl = document.getElementById('btn-bar-toggle-filters-label');
      if (!wrapper) return;
      const isCollapsed = wrapper.classList.contains('sidebar-collapsed');
      const text = isCollapsed ? 'Mostrar filtros' : 'Ocultar filtros';
      if (barBtn) {
        barBtn.classList.toggle('is-active', !isCollapsed);
        barBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
        barBtn.setAttribute('title', text);
        barBtn.setAttribute('aria-label', text);
      }
      if (barLbl) {
        barLbl.textContent = text;
      }
    };

    const toggleFilterSidebar = () => {
      const wrapper = document.getElementById('product-wrapper');
      if (!wrapper) return;
      wrapper.classList.toggle('sidebar-collapsed');
      syncFilterSidebarButtonState();
    };

    document.getElementById('btn-bar-toggle-filters')?.addEventListener('click', toggleFilterSidebar);
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', toggleFilterSidebar);
    syncFilterSidebarButtonState();

    // View Navigation
    document.getElementById('brand-home-link')?.addEventListener('click', (e) => {
      const viewRegistro = document.getElementById('view-registro');
      if (viewRegistro && !viewRegistro.hidden) {
        e.preventDefault();
        switchStoreView('catalogo');
      }
    });
    document.getElementById('nav-tab-catalogo')?.addEventListener('click', () => switchStoreView('catalogo'));
    // Open Unified Auth Dialog (Reikionline format: 'login' | 'register' | 'recover')
    const loginDialog = document.getElementById('login-dialog');
    const setAuthModalMode = (mode = 'login') => {
      const titleEl = document.getElementById('login-dialog-title');
      const paneLogin = document.getElementById('auth-pane-login');
      const paneRegister = document.getElementById('auth-pane-register');
      const paneRecover = document.getElementById('auth-pane-recover');
      const loginFb = document.getElementById('login-feedback');
      const regFb = document.getElementById('quick-reg-feedback');
      const recoverForm = document.getElementById('recover-password-form');
      const recoverSent = document.getElementById('recover-sent-box');

      if (loginFb) loginFb.hidden = true;
      if (regFb) regFb.hidden = true;
      if (recoverForm) recoverForm.hidden = false;
      if (recoverSent) recoverSent.hidden = true;

      if (paneLogin) paneLogin.hidden = mode !== 'login';
      if (paneRegister) paneRegister.hidden = mode !== 'register';
      if (paneRecover) paneRecover.hidden = mode !== 'recover';

      if (titleEl) {
        titleEl.textContent =
          mode === 'register'
            ? 'Registrarme'
            : mode === 'recover'
              ? 'Recuperar contraseña'
              : 'Ingresar';
      }
    };

    const openAuthModal = (mode = 'login') => {
      setAuthModalMode(mode);
      if (loginDialog && !loginDialog.open) {
        loginDialog.showModal();
      }
    };

    loginDialog?.addEventListener('close', () => {
      setAuthModalMode('login');
    });

    document.getElementById('nav-tab-registro')?.addEventListener('click', () => {
      switchStoreView('registro');
      setRegistrationActiveTab('reg-tab-generales');
    });
    document.getElementById('btn-go-register')?.addEventListener('click', () => {
      switchStoreView('registro');
      setRegistrationActiveTab('reg-tab-generales');
    });
    document.getElementById('btn-banner-register')?.addEventListener('click', () => {
      switchStoreView('registro');
      setRegistrationActiveTab('reg-tab-generales');
    });
    document.getElementById('btn-back-to-catalog')?.addEventListener('click', () => switchStoreView('catalogo'));
    document.getElementById('btn-cancel-reg')?.addEventListener('click', () => switchStoreView('catalogo'));

    document.getElementById('btn-open-login')?.addEventListener('click', () => openAuthModal('login'));
    document.getElementById('btn-banner-login')?.addEventListener('click', () => openAuthModal('login'));
    document.getElementById('btn-switch-to-register')?.addEventListener('click', () => {
      const currentLoginVal = (document.getElementById('login-identifier')?.value || '').trim();
      loginDialog?.close();
      switchStoreView('registro');
      setRegistrationActiveTab('reg-tab-generales');
      if (currentLoginVal && currentLoginVal.includes('@')) {
        const regEm = document.getElementById('reg-email');
        if (regEm) {
          regEm.value = currentLoginVal.toUpperCase();
          lookupExistingErpClientAndPadron({ email: currentLoginVal.toUpperCase() });
        }
      }
    });
    document.getElementById('btn-back-to-login-from-reg')?.addEventListener('click', () => setAuthModalMode('login'));
    document.getElementById('btn-back-to-login-from-recover')?.addEventListener('click', () => setAuthModalMode('login'));
    document.getElementById('btn-open-recover-mode')?.addEventListener('click', () => {
      const currentLoginVal = (document.getElementById('login-identifier')?.value || '').trim();
      const recoverInp = document.getElementById('recover-email-input');
      if (recoverInp && currentLoginVal && !recoverInp.value) {
        recoverInp.value = currentLoginVal;
      }
      setAuthModalMode('recover');
    });

    // Close dialog buttons
    document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-close-dialog');
        if (id) document.getElementById(id)?.close();
      });
    });

    // Logout
    document.getElementById('btn-logout-client')?.addEventListener('click', () => {
      saveSession(null);
      showToast('Sesión cerrada correctamente.');
    });

    // Ver / Descargar Credencial QR de Socio Club Fidel (Formato 9:16 Estados / Historias)
    const buildStoreQrPayload = (cli) => {
      if (!cli) return '';
      const rawDoc = String(cli.nroDoc || cli.nd || '').replace(/\D/g, '');
      const cleanDni =
        rawDoc.length === 11 && /^(20|23|24|27)/.test(rawDoc)
          ? rawDoc.slice(2, 10).replace(/^0+/, '')
          : rawDoc.replace(/^0+/, '');
      const cleanCod = String(cli.codigo || cli.co || cli.id || '').trim();
      const prefix = STORE_BRAND.isPaseoAlberdi ? 'CPA' : 'CCN';
      const token = cleanDni ? `${prefix}-${cleanDni}-${cleanCod}` : `${prefix}-COD-${cleanCod}`;
      const baseUrl = STORE_BRAND.isPaseoAlberdi
        ? 'https://paseoalberdi.ar/carrito/'
        : 'https://cn.com.ar/carrito/';
      return `${baseUrl}?qr=${token}`;
    };

    const loadCanvasSafeImage = (src) =>
      new Promise((resolve) => {
        if (!src) {
          resolve(null);
          return;
        }
        const img = new Image();
        if (/^https?:\/\//i.test(src)) {
          img.crossOrigin = 'anonymous';
          img.referrerPolicy = 'no-referrer';
        }
        img.onload = () => {
          try {
            const testC = document.createElement('canvas');
            testC.width = 1;
            testC.height = 1;
            testC.getContext('2d').drawImage(img, 0, 0, 1, 1);
            testC.toDataURL('image/png');
            resolve(img);
          } catch (_e) {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = src;
      });

    const drawRoundedRectPath = (ctx, x, y, w, h, r) => {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      ctx.closePath();
    };

    const wrapStoryNameLines = (ctx, text, maxWidth) => {
      const words = String(text || 'SOCIO CLUB FIDEL').trim().split(/\s+/);
      const lines = [];
      let current = '';
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth || !current) {
          current = test;
        } else {
          lines.push(current);
          current = word;
        }
      }
      if (current) lines.push(current);
      return lines.slice(0, 2);
    };

    let activeQrCredentialClient = null;
    let qrCredentialRenderSeq = 0;

    const paintCredentialCanvasFrame = (out, cli, assets = {}) => {
      if (!out || !cli) return;
      out.width = 1080;
      out.height = 1920;
      const ctx = out.getContext('2d');
      if (!ctx) return;

      const { fidelLogoImg, brandBadgeImg, mascotaImg, userPhotoImg, fallbackIconImg, qrImg } = assets;

      // 1. Fondo degradado oscuro Club Fidel (#0b2733 -> #071c26 -> #05141c)
      const bgGrad = ctx.createLinearGradient(0, 0, 540, 1920);
      bgGrad.addColorStop(0, '#0b2733');
      bgGrad.addColorStop(0.55, '#071c26');
      bgGrad.addColorStop(1, '#05141c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, out.width, out.height);

      // Resplandores decorativos suaves
      const topGlow = ctx.createRadialGradient(540, 260, 20, 540, 260, 520);
      topGlow.addColorStop(0, 'rgba(67, 217, 147, 0.20)');
      topGlow.addColorStop(1, 'rgba(67, 217, 147, 0)');
      ctx.fillStyle = topGlow;
      ctx.fillRect(0, 0, out.width, 900);

      const bottomGlow = ctx.createRadialGradient(540, 1620, 20, 540, 1620, 480);
      bottomGlow.addColorStop(0, 'rgba(212, 164, 30, 0.16)');
      bottomGlow.addColorStop(1, 'rgba(212, 164, 30, 0)');
      ctx.fillStyle = bottomGlow;
      ctx.fillRect(0, 1050, out.width, 870);

      // Marco interior elegante
      drawRoundedRectPath(ctx, 36, 36, out.width - 72, out.height - 72, 48);
      ctx.strokeStyle = 'rgba(67, 217, 147, 0.32)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // 2. Cabecera con Logo Club Fidel + Insignia de Marca
      if (fidelLogoImg) {
        const fH = 148;
        const fW = Math.round((fidelLogoImg.width / fidelLogoImg.height) * fH);
        if (brandBadgeImg) {
          ctx.drawImage(fidelLogoImg, 96, 86, fW, fH);
          const cnSize = 152;
          ctx.drawImage(brandBadgeImg, out.width - 96 - cnSize, 84, cnSize, cnSize);
        } else {
          ctx.drawImage(fidelLogoImg, Math.round((out.width - fW) / 2), 86, fW, fH);
        }
      }

      // 3. Foto circular del socio (tomada de Google o elegida en Mi Perfil)
      const avatarCx = 540;
      const avatarCy = 415;
      const avatarR = 132;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCx, avatarCy, avatarR + 10, 0, Math.PI * 2);
      ctx.fillStyle = '#43d993';
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = '#0e3342';
      ctx.fillRect(avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2);
      const avatarToDraw = userPhotoImg || fallbackIconImg;
      if (avatarToDraw) {
        ctx.drawImage(avatarToDraw, avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2);
      }
      ctx.restore();

      // 4. Nombre y Apellido de la persona
      const fullName = String(cli.nombre || cli.no || 'SOCIO CLUB FIDEL').trim().toUpperCase();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = '900 46px "Plus Jakarta Sans", "Segoe UI", sans-serif';
      const nameLines = wrapStoryNameLines(ctx, fullName, 880);
      if (nameLines.length === 1) {
        ctx.fillText(nameLines[0], 540, 625);
      } else {
        ctx.font = '900 42px "Plus Jakarta Sans", "Segoe UI", sans-serif';
        ctx.fillText(nameLines[0], 540, 608);
        ctx.fillText(nameLines[1], 540, 660);
      }

      // Píldora "SOCIO/A CLUB FIDEL"
      const pillW = 360;
      const pillH = 50;
      const pillX = Math.round((out.width - pillW) / 2);
      const pillY = nameLines.length > 1 ? 684 : 655;
      drawRoundedRectPath(ctx, pillX, pillY, pillW, pillH, 25);
      ctx.fillStyle = 'rgba(67, 217, 147, 0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(67, 217, 147, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#43d993';
      ctx.font = '800 22px "Plus Jakarta Sans", "Segoe UI", sans-serif';
      ctx.fillText('SOCIO/A CLUB FIDEL', 540, pillY + 33);

      // 5. Tarjeta blanca central con el Código QR Dual
      const qrBoxSize = 620;
      const qrBoxX = Math.round((out.width - qrBoxSize) / 2);
      const qrBoxY = 765;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 16;
      drawRoundedRectPath(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 44);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      if (qrImg) {
        ctx.drawImage(qrImg, qrBoxX + 34, qrBoxY + 34, qrBoxSize - 68, qrBoxSize - 68);
      }

      // 6. Pie con Mascota de Club Fidel + Leyenda dual (Caja + Registración Web)
      const footerTopY = 1435;
      if (mascotaImg) {
        const mH = 390;
        const mW = Math.round((mascotaImg.width / mascotaImg.height) * mH);
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 10;
        ctx.drawImage(mascotaImg, 105, footerTopY, mW, mH);
        ctx.restore();
      }

      const infoX = 390;
      const infoW = 540;
      const infoY = 1515;
      const infoH = 244;
      drawRoundedRectPath(ctx, infoX, infoY, infoW, infoH, 28);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(67, 217, 147, 0.30)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#43d993';
      ctx.font = '900 34px "Plus Jakarta Sans", "Segoe UI", sans-serif';
      ctx.fillText('ESCANEAR EN CAJA', infoX + 30, infoY + 60);
      ctx.fillText('O EN TU CELULAR', infoX + 30, infoY + 100);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.font = '600 28px "Plus Jakarta Sans", "Segoe UI", sans-serif';
      ctx.fillText(`Sumá puntos en ${STORE_BRAND.name} o`, infoX + 30, infoY + 148);
      ctx.fillText('escanealo para registrarte gratis', infoX + 30, infoY + 184);
      ctx.fillStyle = '#f5d061';
      ctx.font = '800 28px "Plus Jakarta Sans", "Segoe UI", sans-serif';
      ctx.fillText(STORE_BRAND.isPaseoAlberdi ? 'www.paseoalberdi.ar/carrito' : 'www.cn.com.ar/carrito', infoX + 30, infoY + 224);
    };

    const renderClubCredentialPreview = async (cli) => {
      const previewCanvas = document.getElementById('store-qr-preview-canvas');
      if (!previewCanvas || !cli) return null;
      const seq = ++qrCredentialRenderSeq;

      // Primer pintado inmediato de estructura para apertura instantánea sin parpadeo
      paintCredentialCanvasFrame(previewCanvas, cli, {});

      const payload = buildStoreQrPayload(cli);
      const userPhotoSrc = cli.fotoUrl || cli.picture || '';
      const badgeSrc = STORE_BRAND.isPaseoAlberdi
        ? '../sistema/assets/img/paseo-alberdi/logo-1x1.png?v=1'
        : 'assets/img/club-fidel/casa-nueva-badge.png?v=40';
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=560x560&ecc=M&margin=2&color=0b2733&bgcolor=ffffff&data=${encodeURIComponent(payload)}`;

      const [fidelLogoImg, brandBadgeImg, mascotaImg, userPhotoImg, fallbackIconImg, qrImg] = await Promise.all([
        loadCanvasSafeImage('assets/img/club-fidel/club-fidel-logo-horiz.png?v=40'),
        loadCanvasSafeImage(badgeSrc),
        loadCanvasSafeImage('assets/img/club-fidel/club-fidel-mascota.png?v=41'),
        userPhotoSrc ? loadCanvasSafeImage(userPhotoSrc) : Promise.resolve(null),
        loadCanvasSafeImage('assets/img/club-fidel/club-fidel-icon.png?v=40'),
        loadCanvasSafeImage(qrSrc)
      ]);

      if (seq === qrCredentialRenderSeq) {
        paintCredentialCanvasFrame(previewCanvas, cli, {
          fidelLogoImg,
          brandBadgeImg,
          mascotaImg,
          userPhotoImg,
          fallbackIconImg,
          qrImg
        });
      }
      return previewCanvas;
    };

    const openStoreClubQrModal = (cli) => {
      const targetCli = cli || state.client;
      if (!targetCli) return;
      const dlg = document.getElementById('store-club-qr-dialog');
      if (!dlg) return;
      activeQrCredentialClient = targetCli;
      if (!dlg.open) dlg.showModal();
      renderClubCredentialPreview(targetCli);
    };

    document.getElementById('store-club-qr-dialog')?.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'store-club-qr-dialog') {
        e.target.close();
      }
    });

    document.getElementById('btn-open-my-qr')?.addEventListener('click', () => {
      if (state.client) openStoreClubQrModal(state.client);
    });

    // Subir / Cambiar foto de perfil desde Mi Perfil
    const triggerPhotoFilePicker = () => {
      const fileInp = document.getElementById('nx-perfil-photo-input');
      if (fileInp) {
        fileInp.value = '';
        fileInp.click();
      }
    };
    document.getElementById('nx-perfil-btn-photo')?.addEventListener('click', triggerPhotoFilePicker);

    document.getElementById('nx-perfil-photo-input')?.addEventListener('change', (ev) => {
      const file = ev.target?.files?.[0];
      if (!file || !state.client) return;
      const reader = new FileReader();
      reader.onload = () => {
        const tempImg = new Image();
        tempImg.onload = async () => {
          const targetSize = 280;
          const c = document.createElement('canvas');
          c.width = targetSize;
          c.height = targetSize;
          const cCtx = c.getContext('2d');
          const minSide = Math.min(tempImg.width, tempImg.height);
          const sx = Math.max(0, (tempImg.width - minSide) / 2);
          const sy = Math.max(0, (tempImg.height - minSide) / 2);
          cCtx.fillStyle = '#0b2733';
          cCtx.fillRect(0, 0, targetSize, targetSize);
          cCtx.drawImage(tempImg, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
          const dataUrl = c.toDataURL('image/jpeg', 0.86);

          state.client.fotoUrl = dataUrl;
          state.client.picture = dataUrl;
          saveSession(state.client);

          if (document.getElementById('store-club-qr-dialog')?.open) {
            renderClubCredentialPreview(state.client);
          }

          try {
            const res = await fetch(CLIENTES_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'update_client_profile',
                cId: state.client.id,
                profile: { fotoUrl: dataUrl }
              })
            });
            const d = await res.json();
            if (d && d.ok && d.client) {
              saveSession(d.client);
            }
          } catch (_e) {}
          showToast('📷 ¡Tu foto de perfil de Club Fidel se actualizó correctamente!');
        };
        tempImg.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('btn-store-download-qr')?.addEventListener('click', async () => {
      const cli = activeQrCredentialClient || state.client;
      if (!cli) return;
      const previewCanvas = await renderClubCredentialPreview(cli);
      if (!previewCanvas) return;

      const fullName = String(cli.nombre || cli.no || 'SOCIO CLUB FIDEL').trim().toUpperCase();
      const cleanNameSlug = fullName.replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28) || 'SOCIO';
      const a = document.createElement('a');
      a.download = `Credencial_${STORE_BRAND.clubName.replace(/\s+/g, '_')}_${cleanNameSlug}.png`;
      a.href = previewCanvas.toDataURL('image/png');
      a.click();
    });

    // Header Search Sync with Sidebar Search
    const headerSearch = document.getElementById('header-search-input');
    const sidebarSearch = document.getElementById('store-search-input');
    const inlineCatalogSearch = document.getElementById('catalog-inline-search-input');
    headerSearch?.addEventListener('input', () => {
      if (sidebarSearch) sidebarSearch.value = headerSearch.value;
      if (inlineCatalogSearch) inlineCatalogSearch.value = headerSearch.value;
      applyCatalogFilters(true);
    });
    inlineCatalogSearch?.addEventListener('input', () => {
      if (sidebarSearch) sidebarSearch.value = inlineCatalogSearch.value;
      if (headerSearch) headerSearch.value = inlineCatalogSearch.value;
      applyCatalogFilters(true);
    });
    document.getElementById('btn-header-search-submit')?.addEventListener('click', () => {
      if (sidebarSearch && headerSearch) sidebarSearch.value = headerSearch.value;
      if (inlineCatalogSearch && headerSearch) inlineCatalogSearch.value = headerSearch.value;
      switchStoreView('catalogo');
      applyCatalogFilters(true);
    });
    document.getElementById('btn-header-search-clear')?.addEventListener('click', () => {
      if (headerSearch) headerSearch.value = '';
      if (sidebarSearch) sidebarSearch.value = '';
      if (inlineCatalogSearch) inlineCatalogSearch.value = '';
      applyCatalogFilters(true);
    });

    // Catalog Filters
    sidebarSearch?.addEventListener('input', () => applyCatalogFilters(true));
    document.getElementById('store-filter-rubro')?.addEventListener('change', () => applyCatalogFilters(true));
    document.getElementById('store-filter-marca')?.addEventListener('change', () => applyCatalogFilters(true));
    document.getElementById('store-filter-stock')?.addEventListener('change', () => applyCatalogFilters(true));
    document.getElementById('store-sort-select')?.addEventListener('change', () => applyCatalogFilters(true));

    // Stock quick pills in sidebar
    document.querySelectorAll('[data-stock-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-stock-filter') || 'ALL';
        const stockSel = document.getElementById('store-filter-stock');
        if (stockSel) stockSel.value = val;
        applyCatalogFilters(true);
      });
    });

    // Internal search inside Rubro / Marca listboxes
    document.getElementById('rubro-list-search')?.addEventListener('input', () => renderSidebarListboxes());
    document.getElementById('marca-list-search')?.addEventListener('input', () => renderSidebarListboxes());

    // Click on Rubro / Marca listbox items
    document.getElementById('rubro-listbox')?.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-rubro-id]');
      if (!li) return;
      const rSel = document.getElementById('store-filter-rubro');
      if (rSel) {
        rSel.value = li.getAttribute('data-rubro-id') || 'ALL';
        applyCatalogFilters(true);
      }
    });

    document.getElementById('marca-listbox')?.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-marca-id]');
      if (!li) return;
      const mSel = document.getElementById('store-filter-marca');
      if (mSel) {
        mSel.value = li.getAttribute('data-marca-id') || 'ALL';
        applyCatalogFilters(true);
      }
    });

    // Remove Active Filter Chip
    document.getElementById('active-filter-chips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-remove-chip]');
      if (!btn) return;
      const type = btn.getAttribute('data-remove-chip');
      if (type === 'search') {
        if (sidebarSearch) sidebarSearch.value = '';
        if (headerSearch) headerSearch.value = '';
      } else if (type === 'rubro') {
        const el = document.getElementById('store-filter-rubro');
        if (el) el.value = 'ALL';
      } else if (type === 'marca') {
        const el = document.getElementById('store-filter-marca');
        if (el) el.value = 'ALL';
      } else if (type === 'stock') {
        const el = document.getElementById('store-filter-stock');
        if (el) el.value = 'ALL';
      }
      applyCatalogFilters(true);
    });

    // Reset All Filters
    const resetAllFilters = () => {
      if (sidebarSearch) sidebarSearch.value = '';
      if (headerSearch) headerSearch.value = '';
      const rSel = document.getElementById('store-filter-rubro');
      const mSel = document.getElementById('store-filter-marca');
      const sSel = document.getElementById('store-filter-stock');
      const rListQ = document.getElementById('rubro-list-search');
      const mListQ = document.getElementById('marca-list-search');
      if (rSel) rSel.value = 'ALL';
      if (mSel) mSel.value = 'ALL';
      if (sSel) sSel.value = 'ALL';
      if (rListQ) rListQ.value = '';
      if (mListQ) mListQ.value = '';
      applyCatalogFilters(true);
    };
    document.getElementById('btn-reset-filters')?.addEventListener('click', resetAllFilters);

    // Grid / List View & Column Layout Buttons
    const gridEl = document.getElementById('store-grid');
    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');

    btnGrid?.addEventListener('click', () => {
      state.listView = false;
      gridEl?.classList.remove('list-view');
      btnGrid.classList.add('is-active');
      btnList?.classList.remove('is-active');
    });

    btnList?.addEventListener('click', () => {
      state.listView = true;
      gridEl?.classList.add('list-view');
      btnList.classList.add('is-active');
      btnGrid?.classList.remove('is-active');
    });

    document.querySelectorAll('.col-layout-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cols = Number(btn.getAttribute('data-cols')) || 4;
        state.gridCols = cols;
        state.listView = false;
        btnGrid?.classList.add('is-active');
        btnList?.classList.remove('is-active');
        if (gridEl) {
          gridEl.classList.remove('list-view', 'cols-3', 'cols-4', 'cols-6');
          gridEl.classList.add(`cols-${cols}`);
        }
        document.querySelectorAll('.col-layout-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
      });
    });

    // Copy Page URL Button (copiar-url de cn.com.ar/productos)
    document.getElementById('btn-copy-page-url')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showToast('🔗 Enlace de página copiado al portapapeles.');
      } catch (_e) {
        showToast('🔗 URL: ' + window.location.href);
      }
    });

    // Page size selector
    document.getElementById('store-page-size')?.addEventListener('change', (e) => {
      state.pageSize = Number(e.target.value) || 24;
      state.currentPage = 1;
      renderCatalogGrid();
      syncUrlQueryParams();
    });

    // Pagination
    const goPage = (delta) => {
      state.currentPage += delta;
      renderCatalogGrid();
      syncUrlQueryParams();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    document.getElementById('btn-page-prev')?.addEventListener('click', () => goPage(-1));
    document.getElementById('btn-page-next')?.addEventListener('click', () => goPage(1));
    document.getElementById('btn-page-prev-bottom')?.addEventListener('click', () => goPage(-1));
    document.getElementById('btn-page-next-bottom')?.addEventListener('click', () => goPage(1));

    const handlePageNumberClick = (e) => {
      const btn = e.target.closest('button[data-goto-page]');
      if (!btn) return;
      state.currentPage = Number(btn.getAttribute('data-goto-page')) || 1;
      renderCatalogGrid();
      syncUrlQueryParams();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    document.getElementById('pagination-numbers-top')?.addEventListener('click', handlePageNumberClick);
    document.getElementById('pagination-numbers-bottom')?.addEventListener('click', handlePageNumberClick);

    // Product Grid Actions (Add to Cart, Touchspin, QuickView, Prompt Login)
    document.getElementById('store-grid')?.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.getAttribute('data-action');
      const artId = Number(actionEl.getAttribute('data-art-id'));

      if (action === 'prompt-login') {
        loginDialog?.showModal();
      } else if (action === 'quickview' && artId) {
        openQuickViewModal(artId);
      } else if (action === 'qty-inc' && artId) {
        const qtyInput = document.querySelector(`input[data-qty-for="${artId}"]`);
        if (qtyInput) qtyInput.value = String((Number(qtyInput.value) || 1) + 1);
      } else if (action === 'qty-dec' && artId) {
        const qtyInput = document.querySelector(`input[data-qty-for="${artId}"]`);
        if (qtyInput) qtyInput.value = String(Math.max(1, (Number(qtyInput.value) || 1) - 1));
      } else if (action === 'add-to-cart' && artId) {
        const qtyInput = document.querySelector(`input[data-qty-for="${artId}"]`);
        const qty = Number(qtyInput?.value) || 1;
        addToCart(artId, qty);
      }
    });

    // =========================================================
    // FICHA DE CLIENTE 2 SOLAPAS (ESTILO ERP) + CORROBORACIÓN ERP + PADRÓN ARCA + FOTO GOOGLE + WHATSAPP
    // =========================================================
    const setRegistrationActiveTab = (tabId = 'reg-tab-generales') => {
      const btnGen = document.getElementById('reg-tab-btn-generales');
      const btnImp = document.getElementById('reg-tab-btn-impositivos');
      const panGen = document.getElementById('reg-tab-generales');
      const panImp = document.getElementById('reg-tab-impositivos');

      const isImp = tabId === 'reg-tab-impositivos';
      if (btnGen) {
        btnGen.classList.toggle('is-active', !isImp);
        btnGen.setAttribute('aria-selected', !isImp ? 'true' : 'false');
      }
      if (btnImp) {
        btnImp.classList.toggle('is-active', isImp);
        btnImp.setAttribute('aria-selected', isImp ? 'true' : 'false');
      }
      if (panGen) panGen.hidden = isImp;
      if (panImp) panImp.hidden = !isImp;
    };

    document.getElementById('reg-tab-btn-generales')?.addEventListener('click', () => {
      setRegistrationActiveTab('reg-tab-generales');
    });
    document.getElementById('reg-tab-btn-impositivos')?.addEventListener('click', () => {
      setRegistrationActiveTab('reg-tab-impositivos');
    });
    document.getElementById('btn-reg-go-tab-2')?.addEventListener('click', () => {
      copyPersonalToFiscalIfEmpty();
      setRegistrationActiveTab('reg-tab-impositivos');
    });

    const ensureSelectOptionAndSet = (selectEl, rawVal, cpVal = '') => {
      if (!selectEl || !rawVal) return;
      const val = String(rawVal).trim().toUpperCase();
      if (!val) return;
      const exists = Array.from(selectEl.options).some((o) => o.value.toUpperCase() === val);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = val;
        if (cpVal) opt.setAttribute('data-cp', cpVal);
        opt.textContent = cpVal ? `${val} (CP ${cpVal})` : val;
        selectEl.appendChild(opt);
      }
      selectEl.value = val;
    };

    const sanitizeStreetNumber = (raw) => {
      let s = String(raw ?? '').trim().toUpperCase();
      if (!s) return '';
      const mPre = s.match(/^(?:S\/N|S\/D)\s*(.+)$/i);
      if (mPre && mPre[1].trim() && mPre[1].trim().toUpperCase() !== 'S/N') {
        s = mPre[1].trim().toUpperCase();
      }
      const mSuf = s.match(/^(.+?)\s*(?:S\/N|S\/D)$/i);
      if (mSuf && mSuf[1].trim() && mSuf[1].trim().toUpperCase() !== 'S/N') {
        s = mSuf[1].trim().toUpperCase();
      }
      return s;
    };

    const inputStreetNumber = (raw) => {
      const clean = sanitizeStreetNumber(raw);
      if (!clean || clean === 'S/N' || clean === 'S/D' || clean === '...') return '';
      return clean;
    };

    const copyPersonalToFiscal = () => {
      const setF = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v;
      };
      const nom = composeErpFullName(
        document.getElementById('reg-nombre')?.value || '',
        document.getElementById('reg-apellido')?.value || ''
      );
      const calle = (document.getElementById('reg-calle')?.value || '').trim().toUpperCase();
      const numero = inputStreetNumber(document.getElementById('reg-numero')?.value);
      const piso = (document.getElementById('reg-piso')?.value || '').trim().toUpperCase();
      const dpto = (document.getElementById('reg-dpto')?.value || '').trim().toUpperCase();
      const torre = (document.getElementById('reg-torre')?.value || '').trim().toUpperCase();
      const barrio = (document.getElementById('reg-barrio')?.value || '').trim().toUpperCase();
      const pais = (document.getElementById('reg-pais')?.value || 'ARGENTINA').trim().toUpperCase();
      const prov = (document.getElementById('reg-provincia')?.value || 'CÓRDOBA').trim().toUpperCase();
      const loc = (document.getElementById('reg-localidad')?.value || STORE_BRAND.defaultLocalidad || 'ALCIRA GIGENA').trim().toUpperCase();
      const cp = (document.getElementById('reg-cp')?.value || '5813').trim().toUpperCase();

      if (nom) setF('reg-razon-social', nom);
      setF('reg-calle-fiscal', calle);
      setF('reg-numero-fiscal', numero);
      setF('reg-piso-fiscal', piso);
      setF('reg-dpto-fiscal', dpto);
      setF('reg-torre-fiscal', torre);
      setF('reg-barrio-fiscal', barrio);

      const selPaisF = document.getElementById('reg-pais-fiscal');
      const selProvF = document.getElementById('reg-provincia-fiscal');
      const selLocF = document.getElementById('reg-localidad-fiscal');
      if (selPaisF) {
        ensureSelectOptionAndSet(selPaisF, pais);
        selPaisF.dispatchEvent(new Event('change'));
      }
      if (selProvF) {
        ensureSelectOptionAndSet(selProvF, prov);
        selProvF.dispatchEvent(new Event('change'));
      }
      if (selLocF) {
        ensureSelectOptionAndSet(selLocF, loc, cp);
      }
      setF('reg-cp-fiscal', cp);
    };

    const copyPersonalToFiscalIfEmpty = () => {
      const raz = (document.getElementById('reg-razon-social')?.value || '').trim();
      const calF = (document.getElementById('reg-calle-fiscal')?.value || '').trim();
      if (!raz || !calF) {
        copyPersonalToFiscal();
      }
    };

    document.getElementById('btn-reg-copy-personal-to-fiscal')?.addEventListener('click', () => {
      copyPersonalToFiscal();
      showToast('📋 Nombre y domicilio copiados a Datos Fiscales.');
    });

    // Sincronizar DNI/CUIT rápido de Solapa 1 con Número de Documento de Solapa 2
    const quickDocInp = document.getElementById('reg-quick-doc');
    const nroDocInp = document.getElementById('reg-nro-doc');
    const tipoDocSel = document.getElementById('reg-tipo-doc');

    const syncDocTypeFromDigits = (rawVal) => {
      const digits = String(rawVal || '').replace(/\D/g, '');
      if (digits.length === 11 && tipoDocSel) {
        tipoDocSel.value = 'CUIT';
      } else if (digits.length >= 7 && digits.length <= 8 && tipoDocSel) {
        tipoDocSel.value = 'DNI';
      }
    };

    quickDocInp?.addEventListener('input', () => {
      if (nroDocInp) nroDocInp.value = quickDocInp.value.toUpperCase();
      syncDocTypeFromDigits(quickDocInp.value);
    });

    nroDocInp?.addEventListener('input', () => {
      if (quickDocInp) quickDocInp.value = nroDocInp.value.toUpperCase();
      syncDocTypeFromDigits(nroDocInp.value);
    });

    // Rellenar la ficha de 2 solapas con un cliente existente del ERP (para no duplicar) y/o perfil de Google
    const populateRegistrationFormWithClient = (cli, options = {}) => {
      if (!cli) return;
      const setV = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null && String(val).trim() !== '') {
          el.value = String(val).trim();
        }
      };

      const existingId = Number(cli.id || 0);
      const existingCod = cli.codigo || cli.co || '';
      const badgeEl = document.getElementById('reg-dialog-badge');
      const titleEl = document.getElementById('reg-dialog-title');
      const erpBanner = document.getElementById('reg-erp-match-banner');
      const erpTitle = document.getElementById('reg-erp-match-title');
      const erpDesc = document.getElementById('reg-erp-match-desc');

      if (existingId > 0) {
        const idInp = document.getElementById('reg-existing-id');
        const codInp = document.getElementById('reg-existing-codigo');
        if (idInp) idInp.value = String(existingId);
        if (codInp) codInp.value = String(existingCod);
        if (badgeEl) badgeEl.textContent = `CLIENTE #${existingCod || existingId}`;
        if (titleEl) {
          titleEl.textContent = cli.nombre || cli.no || '';
          titleEl.hidden = !titleEl.textContent;
        }
        if (erpBanner) {
          erpBanner.hidden = false;
          if (erpTitle) {
            erpTitle.textContent = `✓ Tus datos ya estaban cargados en ${STORE_BRAND.name} ERP (Cliente #${existingCod || existingId})`;
          }
          if (erpDesc) {
            erpDesc.textContent =
              'Se recuperaron todos tus datos previamente cargados para evitar clientes duplicados. Podés revisarlos o corregirlos antes de confirmar.';
          }
        }
      }

      const docVal = (cli.nroDoc || cli.nd || '').trim().toUpperCase();
      if (docVal && docVal !== '00.000.000' && docVal !== '00-00000000-0') {
        setV('reg-quick-doc', docVal);
        setV('reg-nro-doc', docVal);
      }

      const tDoc = String(cli.tipoDoc || cli.td || '').toUpperCase();
      if (tDoc && tipoDocSel) {
        if (['CUIT', 'CUIL', 'DNI'].includes(tDoc)) tipoDocSel.value = tDoc;
      } else if (docVal) {
        syncDocTypeFromDigits(docVal);
      }

      const nameParts = splitClientFullNameParts(cli);
      setV('reg-nombre', nameParts.nombre);
      setV('reg-apellido', nameParts.apellido);
      setV('reg-razon-social', (cli.razonSocial || cli.rs || composeErpFullName(nameParts.nombre, nameParts.apellido) || cli.nombre || cli.no || '').toUpperCase());
      const rawRegCalle = (cli.calle || cli.ca || '').toUpperCase();
      setV('reg-calle', rawRegCalle !== 'S/D' ? rawRegCalle : '');
      setV('reg-numero', inputStreetNumber(cli.numero || cli.nu));
      setV('reg-piso', (cli.piso || '').toUpperCase());
      setV('reg-dpto', (cli.dpto || cli.depto || '').toUpperCase());
      setV('reg-torre', (cli.torre || '').toUpperCase());
      setV('reg-barrio', (cli.barrio || cli.ba || '').toUpperCase());

      const selPais = document.getElementById('reg-pais');
      const selProv = document.getElementById('reg-provincia');
      const selLoc = document.getElementById('reg-localidad');
      if (cli.pais && selPais) {
        ensureSelectOptionAndSet(selPais, cli.pais);
        selPais.dispatchEvent(new Event('change'));
      }
      if ((cli.provincia || cli.pr) && selProv) {
        ensureSelectOptionAndSet(selProv, cli.provincia || cli.pr);
        selProv.dispatchEvent(new Event('change'));
      }
      if ((cli.localidad || cli.lo) && selLoc) {
        ensureSelectOptionAndSet(selLoc, cli.localidad || cli.lo, cli.cp || '');
      }
      setV('reg-cp', (cli.cp || '').toUpperCase());

      // Celular (separando prefijo internacional si ya viene con +549)
      const rawCel = String(cli.celular || cli.ce || cli.telefono || '').trim();
      if (rawCel) {
        const cleanCel = rawCel.replace(/^\+?549?/, '');
        setV('reg-celular', cleanCel || rawCel);
      }
      if (cli.fechaNacimiento || cli.fn) {
        setV('reg-fecha-nacimiento', cli.fechaNacimiento || cli.fn);
      }
      if (cli.email || cli.em) {
        setV('reg-email', (cli.email || cli.em).toUpperCase());
      }
      setV('reg-observacion', (cli.observacion || cli.ob || '').toUpperCase());

      // Datos Fiscales (Solapa 2)
      const rawRegCalleF = (cli.calleFiscal || cli.calle || cli.ca || '').toUpperCase();
      setV('reg-calle-fiscal', rawRegCalleF !== 'S/D' ? rawRegCalleF : '');
      setV('reg-numero-fiscal', inputStreetNumber(cli.numeroFiscal || cli.numero || cli.nu));
      setV('reg-piso-fiscal', (cli.pisoFiscal || cli.piso || '').toUpperCase());
      setV('reg-dpto-fiscal', (cli.dptoFiscal || cli.deptoFiscal || cli.dpto || '').toUpperCase());
      setV('reg-torre-fiscal', (cli.torreFiscal || cli.torre || '').toUpperCase());
      setV('reg-barrio-fiscal', (cli.barrioFiscal || cli.barrio || cli.ba || '').toUpperCase());

      const selPaisF = document.getElementById('reg-pais-fiscal');
      const selProvF = document.getElementById('reg-provincia-fiscal');
      const selLocF = document.getElementById('reg-localidad-fiscal');
      if ((cli.paisFiscal || cli.pais) && selPaisF) {
        ensureSelectOptionAndSet(selPaisF, cli.paisFiscal || cli.pais);
        selPaisF.dispatchEvent(new Event('change'));
      }
      if ((cli.provinciaFiscal || cli.provincia || cli.pr) && selProvF) {
        ensureSelectOptionAndSet(selProvF, cli.provinciaFiscal || cli.provincia || cli.pr);
        selProvF.dispatchEvent(new Event('change'));
      }
      if ((cli.localidadFiscal || cli.localidad || cli.lo) && selLocF) {
        ensureSelectOptionAndSet(selLocF, cli.localidadFiscal || cli.localidad || cli.lo, cli.cpFiscal || cli.cp || '');
      }
      setV('reg-cp-fiscal', (cli.cpFiscal || cli.cp || '').toUpperCase());

      const rawIva = String(cli.respIva || cli.iv || '').toUpperCase();
      const selIva = document.getElementById('reg-resp-iva');
      if (selIva && rawIva) {
        if (rawIva.includes('MONOTRIBUTO')) selIva.value = 'MONOTRIBUTO';
        else if (rawIva.includes('INSCRIPTO')) selIva.value = 'INSCRIPTO';
        else if (rawIva.includes('EXENTO')) selIva.value = 'EXENTO';
        else selIva.value = 'CONSUMIDOR FINAL';
      }

      if (cli.googleSub) setV('reg-google-sub', cli.googleSub);
      const foto = String(cli.fotoUrl || cli.picture || options.picture || '').trim();
      if (foto) {
        setV('reg-foto-url', foto);
        const gBanner = document.getElementById('reg-google-profile-banner');
        const gImg = document.getElementById('reg-google-avatar-img');
        const gName = document.getElementById('reg-google-banner-name');
        const gEmail = document.getElementById('reg-google-banner-email');
        if (gBanner) gBanner.hidden = false;
        if (gImg) gImg.src = foto;
        if (gName) gName.textContent = `Cuenta de Google: ${cli.nombre || cli.no || ''}`;
        if (gEmail) {
          gEmail.textContent = `${cli.email || ''} · Podés revisar y corregir cualquiera de tus datos antes de guardar.`;
        }
      }

      const waInp = document.getElementById('reg-whatsapp-registrado');
      const waBtn = document.getElementById('btn-reg-verify-whatsapp');
      const waSt = document.getElementById('reg-whatsapp-status');
      const regOtpBox = document.getElementById('reg-otp-verify-box');
      if (regOtpBox) regOtpBox.hidden = true;
      if (cli.whatsappRegistrado) {
        if (waInp) waInp.value = '1';
        if (waBtn) {
          waBtn.classList.add('is-verified');
          waBtn.textContent = '✓ WhatsApp Registrado';
        }
        if (waSt) {
          waSt.textContent = '✓ Tu número de WhatsApp ya está registrado.';
          waSt.style.color = 'var(--status-ok)';
        }
      } else {
        if (waInp) waInp.value = '0';
        if (waBtn) {
          waBtn.classList.remove('is-verified');
          waBtn.textContent = '📲 Enviar Código';
        }
        if (waSt) {
          waSt.textContent = 'Solicitá el código de 6 dígitos para verificar tu WhatsApp.';
          waSt.style.color = '';
        }
      }
    };

    // Corroborar en el ERP por DNI / CUIT / Email y consultar Padrón ARCA si es CUIT de 11 dígitos
    let lastLookedUpDocKey = '';
    const lookupExistingErpClientAndPadron = async ({ nroDoc = '', email = '', googleSub = '', force = false } = {}) => {
      const cleanDoc = String(nroDoc || '').trim().toUpperCase();
      const docDigits = cleanDoc.replace(/\D/g, '');
      const cleanEmail = String(email || '').trim().toUpperCase();
      const lookupKey = `${docDigits}|${cleanEmail}|${googleSub}`;
      if (!force && lookupKey === lastLookedUpDocKey) return null;
      if (docDigits.length < 7 && !cleanEmail && !googleSub) return null;
      lastLookedUpDocKey = lookupKey;

      const quickHint = document.getElementById('reg-quick-doc-hint');
      const cuitStatus = document.getElementById('reg-cuit-status');
      if (quickHint && docDigits.length >= 7) {
        quickHint.textContent = '⏳ Verificando si ya estás cargado en el ERP...';
        quickHint.style.color = '#8a6405';
      }
      if (cuitStatus && docDigits.length >= 7) {
        cuitStatus.textContent = '⏳ Consultando base de clientes ERP / Padrón ARCA...';
      }

      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'lookup_client_by_doc',
            nroDoc: cleanDoc,
            email: cleanEmail,
            googleSub
          })
        });
        const data = await res.json();
        if (data && data.ok && data.found && data.client) {
          populateRegistrationFormWithClient(data.client);
          if (quickHint) {
            quickHint.textContent = `✓ Ya estabas cargado en el ERP (Cliente #${data.client.codigo || data.client.id}). Se trajeron tus datos.`;
            quickHint.style.color = 'var(--status-ok)';
          }
          if (cuitStatus) {
            cuitStatus.textContent = `✓ Cliente #${data.client.codigo || data.client.id} encontrado en el ERP (${data.client.nombre}).`;
            cuitStatus.style.color = 'var(--status-ok)';
          }
          showToast(`✅ ¡Encontramos tu ficha en el sistema (${data.client.nombre})! Revisá tus datos.`);
          return data.client;
        }
      } catch (_e) {}

      // Si no estaba en el ERP y tiene 11 dígitos, consultar Padrón ARCA
      if (docDigits.length === 11) {
        try {
          const arcaRes = await fetch(`../sistema/api/padron_arca.php?cuit=${encodeURIComponent(docDigits)}`);
          const arcaData = await arcaRes.json();
          const p = arcaData?.data || arcaData?.contribuyente || arcaData;
          if (arcaData && arcaData.ok && p && (p.razonSocial || p.nombre)) {
            const rs = String(p.razonSocial || p.nombre || '').trim().toUpperCase();
            const formattedCuit = `${docDigits.slice(0, 2)}-${docDigits.slice(2, 10)}-${docDigits.slice(10)}`;
            const currentFull = composeErpFullName(
              document.getElementById('reg-nombre')?.value || '',
              document.getElementById('reg-apellido')?.value || ''
            );
            populateRegistrationFormWithClient({
              nombre: (currentFull || rs).trim().toUpperCase(),
              razonSocial: rs,
              tipoDoc: 'CUIT',
              nroDoc: formattedCuit,
              respIva: p.condicionIva || p.respIva || 'INSCRIPTO',
              calle: p.calle || p.direccion || '',
              numero: p.numero || 'S/N',
              localidad: p.localidad || '',
              provincia: p.provincia || '',
              cp: p.cp || p.codigoPostal || '',
              calleFiscal: p.calle || p.direccion || '',
              numeroFiscal: p.numero || 'S/N',
              localidadFiscal: p.localidad || '',
              provinciaFiscal: p.provincia || '',
              cpFiscal: p.cp || p.codigoPostal || ''
            });
            if (cuitStatus) {
              cuitStatus.textContent = `✓ CUIT verificado en Padrón ARCA: ${rs}`;
              cuitStatus.style.color = 'var(--status-ok)';
            }
            if (quickHint) {
              quickHint.textContent = `✓ Datos obtenidos de Padrón ARCA: ${rs}`;
              quickHint.style.color = 'var(--status-ok)';
            }
            return null;
          }
        } catch (_e) {}
      }

      if (quickHint && docDigits.length >= 7) {
        quickHint.textContent = 'Documento verificado (Cliente nuevo en el sistema). Completá tus datos.';
        quickHint.style.color = '#64748b';
      }
      if (cuitStatus && docDigits.length >= 7) {
        cuitStatus.textContent = 'Documento disponible para alta.';
        cuitStatus.style.color = '#64748b';
      }
      return null;
    };

    quickDocInp?.addEventListener('blur', () => {
      const v = (quickDocInp.value || '').trim();
      if (v.replace(/\D/g, '').length >= 7) {
        lookupExistingErpClientAndPadron({ nroDoc: v });
      }
    });
    nroDocInp?.addEventListener('blur', () => {
      const v = (nroDocInp.value || '').trim();
      if (v.replace(/\D/g, '').length >= 7) {
        lookupExistingErpClientAndPadron({ nroDoc: v });
      }
    });
    document.getElementById('reg-email')?.addEventListener('blur', (e) => {
      const em = (e.target.value || '').trim().toUpperCase();
      if (em && em.includes('@')) {
        const usrInp = document.getElementById('reg-usuario-web');
        if (usrInp && !usrInp.value) usrInp.value = em;
        lookupExistingErpClientAndPadron({
          nroDoc: document.getElementById('reg-nro-doc')?.value || '',
          email: em
        });
      }
    });

    document.getElementById('btn-reg-check-erp-doc')?.addEventListener('click', () => {
      const v = (quickDocInp?.value || nroDocInp?.value || '').trim();
      lookupExistingErpClientAndPadron({ nroDoc: v, force: true });
    });
    document.getElementById('btn-reg-search-arca')?.addEventListener('click', () => {
      const v = (nroDocInp?.value || quickDocInp?.value || '').trim();
      lookupExistingErpClientAndPadron({ nroDoc: v, force: true });
    });

    // Botón para solicitar el código numérico de 6 dígitos (OTP) por WhatsApp (API Twilio) y confirmarlo
    const triggerWhatsAppRegistrationMessage = async ({ celularRaw, codPais = '+549', nombre = '', nroDoc = '', email = '', statusElId = 'reg-whatsapp-status', btnId = 'btn-reg-verify-whatsapp', otpBoxId = 'reg-otp-verify-box', otpInpId = 'reg-otp-code-input', cId = 0 }) => {
      const digits = String(celularRaw || '').replace(/\D/g, '');
      if (digits.length < 6) {
        showToast('⚠️ Ingresá primero tu número de Teléfono Celular / WhatsApp.');
        document.getElementById('reg-celular')?.focus();
        return;
      }
      const cleanPrefix = String(codPais || '+549').replace(/\D/g, '');
      const fullNumber = digits.startsWith(cleanPrefix) ? `+${digits}` : `+${cleanPrefix}${digits.replace(/^0+/, '')}`;

      const btn = document.getElementById(btnId);
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Enviando código...';
      }
      const st = document.getElementById(statusElId);
      if (st) {
        st.textContent = `⏳ Generando y enviando código de 6 dígitos al ${fullNumber}...`;
        st.style.color = 'var(--status-ok)';
      }

      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'request_whatsapp_otp',
            generateOtp: true,
            cId: cId || state.client?.id || 0,
            phone: fullNumber,
            nombre: nombre.toUpperCase(),
            nroDoc: nroDoc.toUpperCase(),
            email: email.toUpperCase(),
            listaPrecio: getClientListaLabel()
          })
        });
        const data = await res.json();
        const otpBox = document.getElementById(otpBoxId);
        const otpInp = document.getElementById(otpInpId);
        if (otpBox) otpBox.hidden = false;

        if (data && data.ok) {
          const sentApi = Boolean(data.twilioSent || data.webhookSent);
          if (!sentApi && data.otpCode && otpInp) {
            otpInp.value = String(data.otpCode);
          }
          if (otpInp) otpInp.focus();
          if (st) {
            st.textContent = sentApi
              ? `📲 Te enviamos el código de 6 dígitos por WhatsApp al ${fullNumber}. Ingresalo arriba y tocá "Confirmar Código".`
              : `🔐 Código de verificación generado: ${data.otpCode || ''}${data.emailSent ? ' (enviado también a tu e-mail)' : ''}. Tocá "Confirmar Código" para verificar.`;
            st.style.color = 'var(--status-ok)';
          }
          showToast(
            sentApi
              ? `📲 Código de 6 dígitos enviado por WhatsApp al ${fullNumber}.`
              : `🔐 Código de verificación ${data.otpCode || ''} generado. Confirmalo para vincular tu WhatsApp.`
          );
        }
      } catch (_e) {
        if (st) {
          st.textContent = '⚠️ No se pudo solicitar el código. Intentá nuevamente.';
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          if (!btn.classList.contains('is-verified')) {
            btn.textContent = '📲 Reenviar Código';
          }
        }
      }
    };

    const confirmWhatsAppOtpCode = async ({ celularRaw, codPais = '+549', codeRaw = '', nroDoc = '', email = '', statusElId = 'reg-whatsapp-status', btnId = 'btn-reg-verify-whatsapp', otpBoxId = 'reg-otp-verify-box', regInpId = 'reg-whatsapp-registrado', cId = 0 }) => {
      const code = String(codeRaw || '').replace(/\D/g, '');
      if (code.length < 4) {
        showToast('⚠️ Ingresá el código numérico de 6 dígitos.');
        return;
      }
      const digits = String(celularRaw || '').replace(/\D/g, '');
      const cleanPrefix = String(codPais || '+549').replace(/\D/g, '');
      const fullNumber = digits.startsWith(cleanPrefix) ? `+${digits}` : `+${cleanPrefix}${digits.replace(/^0+/, '')}`;
      const st = document.getElementById(statusElId);

      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify_whatsapp_otp',
            cId: cId || state.client?.id || 0,
            phone: fullNumber,
            code,
            nroDoc: String(nroDoc || '').toUpperCase(),
            email: String(email || '').toUpperCase()
          })
        });
        const data = await res.json();
        if (!res.ok || !data || !data.ok) {
          const msg = data?.message || 'El código ingresado es incorrecto.';
          if (st) {
            st.textContent = `❌ ${msg}`;
            st.style.color = '#ef4444';
          }
          showToast(`❌ ${msg}`);
          return;
        }
        const regInp = document.getElementById(regInpId);
        if (regInp) regInp.value = '1';
        const otpBox = document.getElementById(otpBoxId);
        if (otpBox) otpBox.hidden = true;
        const btn = document.getElementById(btnId);
        if (btn) {
          btn.classList.add('is-verified');
          btn.textContent = '✓ WhatsApp Verificado';
        }
        if (data.client) {
          saveSession(data.client);
        } else if (state.client) {
          state.client.celular = fullNumber;
          state.client.whatsappRegistrado = true;
          saveSession(state.client);
        }
        if (st) {
          st.textContent = `✓ WhatsApp ${fullNumber} verificado y vinculado en ${STORE_BRAND.clubName}.`;
          st.style.color = 'var(--status-ok)';
        }
        showToast(`✅ ¡WhatsApp ${fullNumber} verificado en ${STORE_BRAND.clubName}!`);
      } catch (_e) {
        showToast('⚠️ Error al verificar el código.');
      }
    };

    document.getElementById('btn-reg-verify-whatsapp')?.addEventListener('click', () => {
      triggerWhatsAppRegistrationMessage({
        celularRaw: document.getElementById('reg-celular')?.value || '',
        codPais: document.getElementById('reg-celular-cod-pais')?.value || '+549',
        nombre: composeErpFullName(
          document.getElementById('reg-nombre')?.value || '',
          document.getElementById('reg-apellido')?.value || ''
        ),
        nroDoc: document.getElementById('reg-nro-doc')?.value || document.getElementById('reg-quick-doc')?.value || '',
        email: document.getElementById('reg-email')?.value || '',
        statusElId: 'reg-whatsapp-status',
        btnId: 'btn-reg-verify-whatsapp',
        otpBoxId: 'reg-otp-verify-box',
        otpInpId: 'reg-otp-code-input'
      });
    });

    document.getElementById('btn-reg-confirm-otp')?.addEventListener('click', () => {
      confirmWhatsAppOtpCode({
        celularRaw: document.getElementById('reg-celular')?.value || '',
        codPais: document.getElementById('reg-celular-cod-pais')?.value || '+549',
        codeRaw: document.getElementById('reg-otp-code-input')?.value || '',
        nroDoc: document.getElementById('reg-nro-doc')?.value || document.getElementById('reg-quick-doc')?.value || '',
        email: document.getElementById('reg-email')?.value || '',
        statusElId: 'reg-whatsapp-status',
        btnId: 'btn-reg-verify-whatsapp',
        otpBoxId: 'reg-otp-verify-box',
        regInpId: 'reg-whatsapp-registrado'
      });
    });

    // Botones '+' para agregar Provincia y Localidad en Datos Personales y Datos Fiscales
    const bindAddProvinciaButton = (btnId, paisSelId, provSelId) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        const pais = document.getElementById(paisSelId)?.value || 'ARGENTINA';
        const nuevaProv = (window.prompt(`Agregar nueva provincia en ${pais}:`) || '').trim().toUpperCase();
        if (!nuevaProv) return;
        if (!state.geo.provincias[pais]) state.geo.provincias[pais] = [];
        if (!state.geo.provincias[pais].includes(nuevaProv)) {
          state.geo.provincias[pais].push(nuevaProv);
        }
        const selProv = document.getElementById(provSelId);
        if (selProv) {
          ensureSelectOptionAndSet(selProv, nuevaProv);
          selProv.dispatchEvent(new Event('change'));
        }
      });
    };

    const bindAddLocalidadButton = (btnId, provSelId, locSelId, cpInpId) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        const prov = document.getElementById(provSelId)?.value || 'CÓRDOBA';
        const nuevaLoc = (window.prompt(`Agregar nueva localidad en ${prov}:`) || '').trim().toUpperCase();
        if (!nuevaLoc) return;
        const nuevoCp = (window.prompt(`Código Postal (C.P.) para ${nuevaLoc}:`) || '').trim().toUpperCase();
        if (!state.geo.localidades[prov]) state.geo.localidades[prov] = [];
        state.geo.localidades[prov].push({ n: nuevaLoc, cp: nuevoCp });
        const selLoc = document.getElementById(locSelId);
        if (selLoc) {
          ensureSelectOptionAndSet(selLoc, nuevaLoc, nuevoCp);
        }
        const inpCp = document.getElementById(cpInpId);
        if (inpCp && nuevoCp) inpCp.value = nuevoCp;
      });
    };

    bindAddProvinciaButton('btn-add-prov-reg', 'reg-pais', 'reg-provincia');
    bindAddProvinciaButton('btn-add-prov-reg-fiscal', 'reg-pais-fiscal', 'reg-provincia-fiscal');
    bindAddLocalidadButton('btn-add-localidad-reg', 'reg-provincia', 'reg-localidad', 'reg-cp');
    bindAddLocalidadButton('btn-add-localidad-reg-fiscal', 'reg-provincia-fiscal', 'reg-localidad-fiscal', 'reg-cp-fiscal');

    // Login Form Submit
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('login-feedback');
      if (feedback) feedback.hidden = true;

      const username = (document.getElementById('login-identifier')?.value || '').trim().toUpperCase();
      const password = (document.getElementById('login-password')?.value || '').trim();

      const submitBtn = document.getElementById('btn-login-submit');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'client_login', username, password })
        });
        const data = await res.json();
        const cli = data?.client || data?.cliente;
        if (!data || !data.ok || !cli) {
          throw new Error(data?.message || data?.error || 'Credenciales inválidas');
        }
        saveSession(cli);
        loginDialog?.close();
        openClientPortalSection('home');
        showToast(`¡Bienvenido ${cli.nombre || cli.no}! Panel del Cliente habilitado.`);
      } catch (err) {
        if (feedback) {
          feedback.textContent = err.message || 'No se pudo iniciar sesión.';
          feedback.className = 'form-feedback is-error';
          feedback.hidden = false;
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    // Mostrar / Ocultar contraseña estilo Reikionline (Eye / EyeOff + Mostrar / Ocultar)
    const bindReikiPasswordToggle = (btnId, inputId) => {
      const btn = document.getElementById(btnId);
      const inp = document.getElementById(inputId);
      if (!btn || !inp) return;
      btn.addEventListener('click', () => {
        const willShow = inp.type === 'password';
        inp.type = willShow ? 'text' : 'password';
        btn.setAttribute('aria-pressed', willShow ? 'true' : 'false');
        btn.setAttribute('aria-label', willShow ? 'Ocultar contraseña' : 'Mostrar contraseña');
        const eyeOpen = btn.querySelector('.reiki-eye-open');
        const eyeOff = btn.querySelector('.reiki-eye-off');
        const txt = btn.querySelector('.reiki-pwd-toggle-text');
        if (eyeOpen) eyeOpen.hidden = willShow;
        if (eyeOff) eyeOff.hidden = !willShow;
        if (txt) txt.textContent = willShow ? 'Ocultar' : 'Mostrar';
      });
    };
    bindReikiPasswordToggle('btn-toggle-login-pwd', 'login-password');
    bindReikiPasswordToggle('btn-toggle-quick-reg-pwd', 'quick-reg-password');

    // Quick Registration Form Submit -> Lleva al formulario de 2 solapas con el correo, nombre y contraseña pre-cargados
    document.getElementById('quick-register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('quick-reg-feedback');
      if (feedback) feedback.hidden = true;

      const nombreRaw = (document.getElementById('quick-reg-nombre')?.value || '').trim();
      const apellidoRaw = (document.getElementById('quick-reg-apellido')?.value || '').trim();
      const emailRaw = (document.getElementById('quick-reg-email')?.value || '').trim();
      const passwordRaw = (document.getElementById('quick-reg-password')?.value || '').trim();

      if (!nombreRaw || !apellidoRaw || !emailRaw || !passwordRaw) {
        if (feedback) {
          feedback.textContent = 'Completá tu nombre, apellido, correo electrónico y contraseña.';
          feedback.className = 'form-feedback is-error';
          feedback.hidden = false;
        }
        return;
      }

      loginDialog?.close();
      switchStoreView('registro');
      setRegistrationActiveTab('reg-tab-generales');

      const regNom = document.getElementById('reg-nombre');
      const regApe = document.getElementById('reg-apellido');
      const regRaz = document.getElementById('reg-razon-social');
      const regEm = document.getElementById('reg-email');
      const regPwd = document.getElementById('reg-clave-web');
      const regUsr = document.getElementById('reg-usuario-web');
      const regRef = document.getElementById('reg-codigo-referido');
      const quickRefVal = (document.getElementById('quick-reg-codigo-referido')?.value || '').trim();
      const fullErpNom = composeErpFullName(nombreRaw, apellidoRaw);

      if (regNom) regNom.value = nombreRaw.toUpperCase();
      if (regApe) regApe.value = apellidoRaw.toUpperCase();
      if (regRaz) regRaz.value = fullErpNom;
      if (regEm) regEm.value = emailRaw.toUpperCase();
      if (regPwd) regPwd.value = passwordRaw.toUpperCase();
      if (regUsr) regUsr.value = emailRaw.toUpperCase();
      if (regRef && (quickRefVal || getPendingRefCode())) {
        regRef.value = normalizeReferralCodeInput(quickRefVal || getPendingRefCode());
      }

      await lookupExistingErpClientAndPadron({ email: emailRaw.toUpperCase(), force: true });
      showToast('📝 Completá o verificá tu DNI/CUIT y datos personales para finalizar.');
    });

    // Recuperar contraseña (fórmula automática por correo electrónico estilo ReikiOnline)
    document.getElementById('recover-password-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = (document.getElementById('recover-email-input')?.value || '').trim();
      if (!val) return;
      const recoverForm = document.getElementById('recover-password-form');
      const sentBox = document.getElementById('recover-sent-box');
      const submitBtn = document.getElementById('btn-recover-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando recordatorio...';
      }
      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'recover_client_password',
            email: val
          })
        });
        const data = await res.json();
        if (!res.ok || !data || !data.ok) {
          throw new Error(data?.message || 'No encontramos una cuenta registrada con ese correo.');
        }
        if (recoverForm) recoverForm.hidden = true;
        if (sentBox) {
          sentBox.textContent =
            data.message || `Te enviamos un correo automático a ${val} con el recordatorio de tu contraseña.`;
          sentBox.hidden = false;
        }
        showToast(`📧 Recordatorio automático de contraseña enviado a ${data.email || val}.`);
      } catch (err) {
        if (sentBox) {
          sentBox.textContent = err.message || 'No se pudo enviar el recordatorio.';
          sentBox.hidden = false;
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Enviar enlace';
        }
      }
    });

    // =========================================================
    // GOOGLE IDENTITY SERVICES (INICIAR SESIÓN / REGISTRARSE CON GOOGLE)
    // =========================================================
    const googleAuthDialog = document.getElementById('google-auth-dialog');
    const googleEmailInp = document.getElementById('google-auth-email');
    const googleNombreInp = document.getElementById('google-auth-nombre');
    const googleApellidoInp = document.getElementById('google-auth-apellido');
    const googleDniInp = document.getElementById('google-auth-dni');
    const googleCelInp = document.getElementById('google-auth-celular');
    const googleSubInp = document.getElementById('google-auth-sub');
    const googleFeedback = document.getElementById('google-auth-feedback');
    const googleLead = document.getElementById('google-auth-lead');
    const googleAdminInp = document.getElementById('google-admin-client-id');

    const DEFAULT_GOOGLE_CLIENT_ID =
      '384115038053-r4j6h8gvncncen7v83njbsa5dufrpfje.apps.googleusercontent.com';

    const getConfiguredGoogleClientId = () => {
      try {
        return (
          state.googleClientId ||
          window.CN_GOOGLE_CLIENT_ID ||
          localStorage.getItem('cn_google_oauth_client_id') ||
          DEFAULT_GOOGLE_CLIENT_ID
        ).trim();
      } catch (_e) {
        return state.googleClientId || DEFAULT_GOOGLE_CLIENT_ID;
      }
    };

    const openRegistrationWithGoogleData = async ({ email = '', nombre = '', givenName = '', familyName = '', googleSub = '', picture = '', existingClient = null } = {}) => {
      loginDialog?.close();
      googleAuthDialog?.close();
      switchStoreView('registro');
      setRegistrationActiveTab('reg-tab-generales');

      const cleanEmail = String(email || '').trim().toUpperCase();
      const cleanGiven = String(givenName || '').trim().toUpperCase();
      const cleanFamily = String(familyName || '').trim().toUpperCase();
      const cleanNombre = composeErpFullName(cleanGiven, cleanFamily) || String(nombre || '').trim().toUpperCase();

      if (existingClient) {
        populateRegistrationFormWithClient(
          {
            ...existingClient,
            email: existingClient.email || cleanEmail,
            nombre: existingClient.nombre || cleanNombre,
            nombrePila: existingClient.nombrePila || cleanGiven,
            apellido: existingClient.apellido || cleanFamily,
            googleSub: googleSub || existingClient.googleSub || '',
            fotoUrl: picture || existingClient.fotoUrl || ''
          },
          { picture }
        );
      } else {
        populateRegistrationFormWithClient(
          {
            nombre: cleanNombre,
            nombrePila: cleanGiven,
            apellido: cleanFamily,
            razonSocial: cleanNombre,
            email: cleanEmail,
            googleSub,
            fotoUrl: picture
          },
          { picture }
        );
        await lookupExistingErpClientAndPadron({ email: cleanEmail, googleSub, force: true });
      }

      const usrInp = document.getElementById('reg-usuario-web');
      if (usrInp && cleanEmail && !usrInp.value) {
        usrInp.value = cleanEmail;
      }
      showToast('📸 Se cargaron tu foto y datos de Google. Revisalos o corregilos y guardá tu ficha.');
    };

    const handleGoogleCredentialCallback = async (response) => {
      if (!response || !response.credential) return;
      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'client_google_auth',
            credential: response.credential,
            reviewData: true,
            requireDniStep: true
          })
        });
        const data = await res.json();
        if (data && data.ok && (data.googleProfile || data.existingClient || data.client)) {
          const gp = data.googleProfile || {};
          const ex = data.existingClient || data.client || null;
          const exDoc = String(ex?.nroDoc || '').replace(/\D/g, '');
          const exCalle = String(ex?.calle || '').trim();
          const exCel = String(ex?.celular || '').trim();
          const isOnRegView = !document.getElementById('view-registro')?.hidden;
          // Si ya tenía su ficha completa en el ERP (con DNI/CUIT, domicilio y celular) y no abrió desde la pantalla de registro, ingresa directo pero permite editar en Mi Perfil
          if (!isOnRegView && ex && ex.id && exDoc.length >= 7 && exCalle && exCel) {
            if (gp.givenName && !ex.givenName) ex.givenName = String(gp.givenName).trim();
            saveSession(ex);
            loginDialog?.close();
            googleAuthDialog?.close();
            openClientPortalSection('home');
            showToast(`✅ ¡Bienvenido nuevamente ${extractClientFirstName(ex)}! Ingresaste con tu cuenta de Google.`);
            return;
          }
          await openRegistrationWithGoogleData({
            email: gp.email || ex?.email || '',
            nombre: gp.nombre || ex?.nombre || '',
            givenName: gp.givenName || ex?.nombrePila || '',
            familyName: gp.familyName || ex?.apellido || '',
            googleSub: gp.googleSub || ex?.googleSub || '',
            picture: gp.picture || ex?.fotoUrl || '',
            existingClient: ex
          });
        }
      } catch (err) {
        console.error('Error al verificar credencial de Google:', err);
      }
    };

    window.initGoogleIdentityServices = () => {
      const cid = getConfiguredGoogleClientId();
      if (googleAdminInp && !googleAdminInp.value && cid) {
        googleAdminInp.value = cid;
      }
      if (!cid || !cid.includes('.apps.googleusercontent.com')) return;
      if (!window.google || !window.google.accounts || !window.google.accounts.id) return;

      try {
        window.google.accounts.id.initialize({
          client_id: cid,
          callback: handleGoogleCredentialCallback,
          auto_select: false,
          cancel_on_tap_outside: true
        });

        const hostModal = document.getElementById('google-gsi-modal-render');
        if (hostModal) {
          hostModal.hidden = false;
          hostModal.textContent = '';
          window.google.accounts.id.renderButton(hostModal, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: 340
          });
        }
      } catch (err) {
        console.warn('No se pudo inicializar Google Identity Services:', err);
      }
    };

    const openGoogleAuthModalFlow = () => {
      const cid = getConfiguredGoogleClientId();
      if (googleAdminInp) googleAdminInp.value = cid;
      if (googleFeedback) googleFeedback.hidden = true;

      // Flujo directo idéntico a Reikionline: abre el selector emergente oficial de cuentas de Google en 1 clic
      const oauth2 = window.google?.accounts?.oauth2;
      if (cid && cid.includes('.apps.googleusercontent.com') && oauth2) {
        try {
          const tokenClient = oauth2.initTokenClient({
            client_id: cid,
            scope: 'openid email profile',
            prompt: 'select_account',
            callback: async (tokenResponse) => {
              if (!tokenResponse || tokenResponse.error || !tokenResponse.access_token) {
                return;
              }
              try {
                const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                if (!profileRes.ok) {
                  throw new Error('No se pudo obtener el perfil de Google.');
                }
                const profile = await profileRes.json();
                const res = await fetch(CLIENTES_API_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'client_google_auth',
                    reviewData: true,
                    requireDniStep: true,
                    googleProfile: {
                      email: (profile.email || '').trim().toUpperCase(),
                      nombre: (profile.name || '').trim().toUpperCase(),
                      googleSub: profile.sub || '',
                      picture: profile.picture || ''
                    }
                  })
                });
                const data = await res.json();
                const ex = data?.existingClient || data?.client || data?.cliente || null;
                const exDoc = String(ex?.nroDoc || '').replace(/\D/g, '');
                const exCalle = String(ex?.calle || '').trim();
                const exCel = String(ex?.celular || '').trim();

                const isOnRegView = !document.getElementById('view-registro')?.hidden;
                if (!isOnRegView && ex && ex.id && exDoc.length >= 7 && exCalle && exCel) {
                  if (profile.given_name) ex.givenName = String(profile.given_name).trim();
                  saveSession(ex);
                  loginDialog?.close();
                  googleAuthDialog?.close();
                  openClientPortalSection('home');
                  showToast(`✅ ¡Bienvenido nuevamente ${extractClientFirstName(ex)}! Ingresaste con tu cuenta de Google.`);
                  return;
                }

                await openRegistrationWithGoogleData({
                  email: (profile.email || '').trim().toUpperCase(),
                  nombre: (profile.name || '').trim().toUpperCase(),
                  givenName: (profile.given_name || '').trim().toUpperCase(),
                  familyName: (profile.family_name || '').trim().toUpperCase(),
                  googleSub: profile.sub || '',
                  picture: profile.picture || '',
                  existingClient: ex
                });
              } catch (err) {
                const loginFb = document.getElementById('login-feedback');
                if (loginFb) {
                  loginFb.textContent = err.message || 'No se pudo iniciar sesión con Google.';
                  loginFb.className = 'form-feedback is-error';
                  loginFb.hidden = false;
                }
              }
            }
          });
          tokenClient.requestAccessToken({ prompt: 'select_account' });
          return;
        } catch (err) {
          console.warn('Fallback a modal de configuración de Google:', err);
        }
      }

      if (cid && cid.includes('.apps.googleusercontent.com') && !oauth2) {
        const loginFb = document.getElementById('login-feedback');
        if (loginFb) {
          loginFb.textContent = 'Cargando servicios de Google, intentá nuevamente en un segundo.';
          loginFb.className = 'form-feedback is-error';
          loginFb.hidden = false;
        }
        return;
      }

      loginDialog?.close();
      if (googleAuthDialog && !googleAuthDialog.open) {
        googleAuthDialog.showModal();
      }
    };

    document.getElementById('btn-google-login')?.addEventListener('click', openGoogleAuthModalFlow);
    document.getElementById('btn-google-from-quick-reg')?.addEventListener('click', openGoogleAuthModalFlow);
    document.getElementById('btn-google-from-register')?.addEventListener('click', openGoogleAuthModalFlow);
    document.getElementById('btn-back-to-login-from-google')?.addEventListener('click', () => {
      googleAuthDialog?.close();
      openAuthModal('login');
    });

    // Guardar Client ID de Google Cloud desde el panel de administrador
    document.getElementById('btn-save-google-client-id')?.addEventListener('click', async () => {
      const rawCid = (googleAdminInp?.value || '').trim();
      const statusEl = document.getElementById('google-admin-cfg-status');
      state.googleClientId = rawCid;
      try {
        if (rawCid) localStorage.setItem('cn_google_oauth_client_id', rawCid);
        else localStorage.removeItem('cn_google_oauth_client_id');
      } catch (_e) {}

      try {
        await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_google_oauth_config',
            googleClientId: rawCid
          })
        });
      } catch (_e) {}

      if (statusEl) {
        statusEl.textContent = rawCid
          ? '✓ Client ID guardado en el servidor. Botón oficial de Google activado.'
          : 'Client ID eliminado.';
        statusEl.style.color = 'var(--status-ok)';
      }
      initGoogleIdentityServices();
    });

    // Ir al formulario completo copiando los datos de Google
    document.getElementById('btn-google-fill-full-form')?.addEventListener('click', () => {
      const emailVal = (googleEmailInp?.value || '').trim().toUpperCase();
      const nombrePilaVal = (googleNombreInp?.value || '').trim().toUpperCase();
      const apellidoVal = (googleApellidoInp?.value || '').trim().toUpperCase();
      const fullNombreVal = composeErpFullName(nombrePilaVal, apellidoVal);
      const dniVal = (googleDniInp?.value || '').trim().toUpperCase();
      const celVal = (googleCelInp?.value || '').trim().toUpperCase();

      googleAuthDialog?.close();
      switchStoreView('registro');

      const regNom = document.getElementById('reg-nombre');
      const regApe = document.getElementById('reg-apellido');
      const regRaz = document.getElementById('reg-razon-social');
      const regEm = document.getElementById('reg-email');
      const regDoc = document.getElementById('reg-nro-doc');
      const regCel = document.getElementById('reg-celular');
      const regUsr = document.getElementById('reg-usuario-web');

      if (regNom && nombrePilaVal) regNom.value = nombrePilaVal;
      if (regApe && apellidoVal) regApe.value = apellidoVal;
      if (regRaz && fullNombreVal) regRaz.value = fullNombreVal;
      if (regEm && emailVal) regEm.value = emailVal;
      if (regDoc && dniVal) regDoc.value = dniVal;
      if (regCel && celVal) regCel.value = celVal;
      if (regUsr && emailVal && !regUsr.value) {
        regUsr.value = emailVal.split('@')[0].replace(/[^A-Z0-9]/g, '');
      }
    });

    // Envío del formulario rápido de Registro / Ingreso con Google
    document.getElementById('google-auth-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (googleFeedback) googleFeedback.hidden = true;

      const email = (googleEmailInp?.value || '').trim().toUpperCase();
      const nombrePila = (googleNombreInp?.value || '').trim().toUpperCase();
      const apellido = (googleApellidoInp?.value || '').trim().toUpperCase();
      const nombre = composeErpFullName(nombrePila, apellido);
      const nroDoc = (googleDniInp?.value || '').trim().toUpperCase();
      const celular = (googleCelInp?.value || '').trim().toUpperCase();
      const googleSub = (googleSubInp?.value || '').trim();

      const docDigits = nroDoc.replace(/\D/g, '');
      const tipoDoc = docDigits.length === 11 ? 'CUIT' : 'DNI';

      const submitBtn = document.getElementById('btn-google-auth-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Conectando con Google...';
      }

      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'client_google_auth',
            codigoReferido: getPendingRefCode(),
            googleProfile: {
              email,
              nombre,
              nombrePila,
              apellido,
              tipoDoc,
              nroDoc,
              celular,
              googleSub,
              codigoReferido: getPendingRefCode()
            }
          })
        });
        const data = await res.json();
        const savedCli = data?.client || data?.cliente;
        if (!data || !data.ok || !savedCli) {
          throw new Error(data?.message || 'No se pudo completar el acceso con Google.');
        }

        clearPendingRefCode();
        saveSession(savedCli);
        googleAuthDialog?.close();
        openClientPortalSection('home');

        if (data.referralBonus?.granted) {
          showToast(
            `🎉 ¡Bienvenido ${savedCli.nombre}! Sumaste +1.000 pts de regalo por la invitación de ${data.referralBonus.referrerNombre || 'tu amigo'} (y tu amigo también sumó +1.000 pts).`
          );
          openStoreClubQrModal(savedCli);
        } else if (data.isNew) {
          showToast(`✅ ¡Cuenta registrada con Google! Bienvenido ${savedCli.nombre} a ${STORE_BRAND.clubUpper}.`);
          openStoreClubQrModal(savedCli);
        } else {
          showToast(`✅ ¡Bienvenido nuevamente ${savedCli.nombre}! Precios habilitados.`);
        }
      } catch (err) {
        if (googleFeedback) {
          googleFeedback.textContent = err.message || 'No se pudo completar el registro con Google.';
          googleFeedback.className = 'form-feedback is-error';
          googleFeedback.hidden = false;
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Continuar con Google';
        }
      }
    });

    // Online Client Registration Form Submit (2 Solapas idénticas al ERP + sin duplicar por DNI/CUIT)
    document.getElementById('online-registration-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('reg-feedback');
      if (feedback) feedback.hidden = true;

      // Sincronizar campos entre solapas antes de validar
      const quickDocVal = (document.getElementById('reg-quick-doc')?.value || '').trim().toUpperCase();
      const nroDocEl = document.getElementById('reg-nro-doc');
      if (nroDocEl && !nroDocEl.value.trim() && quickDocVal) {
        nroDocEl.value = quickDocVal;
      }
      copyPersonalToFiscalIfEmpty();

      const nroDoc = (document.getElementById('reg-nro-doc')?.value || quickDocVal || '').trim().toUpperCase();
      const docDigits = nroDoc.replace(/\D/g, '');
      const tipoDocSelVal = (document.getElementById('reg-tipo-doc')?.value || (docDigits.length === 11 ? 'CUIT' : 'DNI')).toUpperCase();
      const tipoDoc = docDigits.length === 11 && tipoDocSelVal === 'DNI' ? 'CUIT' : tipoDocSelVal;

      if (docDigits.length < 7) {
        if (feedback) {
          feedback.textContent = 'Por favor ingresá tu número de DNI o CUIT para corroborar tus datos en el sistema.';
          feedback.className = 'form-feedback is-error';
          feedback.hidden = false;
        }
        setRegistrationActiveTab('reg-tab-generales');
        document.getElementById('reg-quick-doc')?.focus();
        return;
      }

      if (tipoDoc === 'CUIT' && docDigits.length === 11 && !validateCuitModulo11(nroDoc)) {
        if (feedback) {
          feedback.textContent = 'El número de CUIT ingresado no es válido (verificación Módulo 11).';
          feedback.className = 'form-feedback is-error';
          feedback.hidden = false;
        }
        setRegistrationActiveTab('reg-tab-impositivos');
        document.getElementById('reg-nro-doc')?.focus();
        return;
      }

      const nombrePila = (document.getElementById('reg-nombre')?.value || '').trim().toUpperCase();
      const apellido = (document.getElementById('reg-apellido')?.value || '').trim().toUpperCase();
      const nombre = composeErpFullName(nombrePila, apellido);
      const calle = (document.getElementById('reg-calle')?.value || '').trim().toUpperCase();
      const numero = sanitizeStreetNumber(document.getElementById('reg-numero')?.value) || 'S/N';
      const piso = (document.getElementById('reg-piso')?.value || '').trim().toUpperCase();
      const dpto = (document.getElementById('reg-dpto')?.value || '').trim().toUpperCase();
      const torre = (document.getElementById('reg-torre')?.value || '').trim().toUpperCase();
      const barrio = (document.getElementById('reg-barrio')?.value || '').trim().toUpperCase();
      const pais = (document.getElementById('reg-pais')?.value || 'ARGENTINA').trim().toUpperCase();
      const provincia = (document.getElementById('reg-provincia')?.value || 'CÓRDOBA').trim().toUpperCase();
      const localidad = (document.getElementById('reg-localidad')?.value || STORE_BRAND.defaultLocalidad || 'ALCIRA GIGENA').trim().toUpperCase();
      const cp = (document.getElementById('reg-cp')?.value || '5813').trim().toUpperCase();

      const razonSocial = (document.getElementById('reg-razon-social')?.value || nombre).trim().toUpperCase();
      const calleFiscal = (document.getElementById('reg-calle-fiscal')?.value || calle).trim().toUpperCase();
      const numeroFiscal = sanitizeStreetNumber(document.getElementById('reg-numero-fiscal')?.value) || numero || 'S/N';
      const pisoFiscal = (document.getElementById('reg-piso-fiscal')?.value || piso).trim().toUpperCase();
      const dptoFiscal = (document.getElementById('reg-dpto-fiscal')?.value || dpto).trim().toUpperCase();
      const torreFiscal = (document.getElementById('reg-torre-fiscal')?.value || torre).trim().toUpperCase();
      const barrioFiscal = (document.getElementById('reg-barrio-fiscal')?.value || barrio).trim().toUpperCase();
      const paisFiscal = (document.getElementById('reg-pais-fiscal')?.value || pais).trim().toUpperCase();
      const provinciaFiscal = (document.getElementById('reg-provincia-fiscal')?.value || provincia).trim().toUpperCase();
      const localidadFiscal = (document.getElementById('reg-localidad-fiscal')?.value || localidad).trim().toUpperCase();
      const cpFiscal = (document.getElementById('reg-cp-fiscal')?.value || cp).trim().toUpperCase();

      const codPaisCel = (document.getElementById('reg-celular-cod-pais')?.value || '+549').trim();
      const celLocal = (document.getElementById('reg-celular')?.value || '').trim().toUpperCase();
      const celDigits = celLocal.replace(/\D/g, '');
      const cleanPrefix = codPaisCel.replace(/\D/g, '');
      const celularFull = celDigits
        ? celDigits.startsWith(cleanPrefix)
          ? `+${celDigits}`
          : `${codPaisCel}${celDigits.replace(/^0+/, '')}`
        : celLocal;

      const email = (document.getElementById('reg-email')?.value || '').trim().toUpperCase();
      if (!nombrePila || !apellido || !calle || !email) {
        if (feedback) {
          feedback.textContent = 'Completá los campos obligatorios (* Nombre, * Apellido, * Calle y E-mail de registro).';
          feedback.className = 'form-feedback is-error';
          feedback.hidden = false;
        }
        setRegistrationActiveTab('reg-tab-generales');
        return;
      }

      const existingId = Number(document.getElementById('reg-existing-id')?.value || 0);
      const existingCod = Number(document.getElementById('reg-existing-codigo')?.value || 0);
      const googleSub = (document.getElementById('reg-google-sub')?.value || '').trim();
      const fotoUrl = (document.getElementById('reg-foto-url')?.value || '').trim();
      const whatsappRegistrado = document.getElementById('reg-whatsapp-registrado')?.value === '1';

      // Utilizar el correo con que se registra como usuarioWeb
      const usuarioWeb = email || (document.getElementById('reg-usuario-web')?.value || '').trim().toUpperCase();

      const payload = {
        action: 'register_online_client',
        client: {
          id: existingId > 0 ? existingId : undefined,
          codigo: existingCod > 0 ? existingCod : undefined,
          nombre,
          nombrePila,
          apellido,
          contacto: '',
          calle,
          numero,
          piso,
          dpto,
          depto: dpto,
          torre,
          barrio,
          pais,
          provincia,
          localidad,
          cp,
          calleFiscal,
          numeroFiscal,
          pisoFiscal,
          dptoFiscal,
          deptoFiscal: dptoFiscal,
          torreFiscal,
          barrioFiscal,
          paisFiscal,
          provinciaFiscal,
          localidadFiscal,
          cpFiscal,
          celular: celularFull,
          fechaNacimiento: (document.getElementById('reg-fecha-nacimiento')?.value || '').trim(),
          telefono: (document.getElementById('reg-telefono')?.value || '').trim().toUpperCase(),
          email,
          razonSocial,
          respIva: (document.getElementById('reg-resp-iva')?.value || 'CONSUMIDOR FINAL').trim().toUpperCase(),
          tipoDoc,
          nroDoc,
          regimenIibb: (document.getElementById('reg-regimen-iibb')?.value || 'NO INSCRIPTO').trim().toUpperCase(),
          nroIibb: (document.getElementById('reg-nro-iibb')?.value || '').trim().toUpperCase(),
          usuarioWeb,
          claveWeb: (document.getElementById('reg-clave-web')?.value || '').trim().toUpperCase(),
          observacion: (document.getElementById('reg-observacion')?.value || '').trim().toUpperCase(),
          googleSub,
          fotoUrl,
          whatsappRegistrado,
          canalFidelizacion: whatsappRegistrado ? 'WHATSAPP' : 'EMAIL',
          origenRegistro: googleSub ? 'GOOGLE_OAUTH' : 'CARRITO_WEB',
          codigoReferido: getPendingRefCode(),
          listaPrecio: 'MINORISTA',
          listaPrecioId: 1
        }
      };

      const submitBtn = document.getElementById('btn-submit-reg');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        const savedCli = data?.client || data?.cliente;
        if (!data || !data.ok || !savedCli) {
          throw new Error(data?.message || data?.error || 'No se pudo completar la registración');
        }

        clearPendingRefCode();
        saveSession(savedCli);

        e.target.reset();
        initRegistrationGeoDropdowns();
        openClientPortalSection('home');
        if (data.referralBonus?.granted) {
          showToast(
            `🎉 ¡Felicitaciones ${savedCli.nombre}! Sumaste +1.000 puntos de bienvenida por la invitación de ${data.referralBonus.referrerNombre || 'tu amigo'} (y tu amigo también sumó +1.000 pts).`
          );
          openStoreClubQrModal(savedCli);
        } else if (data.updatedExisting) {
          showToast(`✅ ¡Datos actualizados sobre tu ficha existente #${savedCli.codigo} (${savedCli.nombre}) sin duplicar!`);
        } else {
          showToast(`✅ ¡Registración exitosa! Bienvenido ${savedCli.nombre} a ${STORE_BRAND.clubUpper}.`);
          openStoreClubQrModal(savedCli);
        }
      } catch (err) {
        if (feedback) {
          feedback.textContent = err.message || 'Error al registrar cliente.';
          feedback.className = 'form-feedback is-error';
          feedback.hidden = false;
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    // Cart Modal Controls
    const cartDialog = document.getElementById('cart-dialog');
    document.getElementById('btn-open-cart')?.addEventListener('click', () => {
      renderCartModal();
      cartDialog?.showModal();
    });
    document.getElementById('btn-open-cart-inline')?.addEventListener('click', () => {
      renderCartModal();
      cartDialog?.showModal();
    });

    document.getElementById('cart-items-container')?.addEventListener('input', (e) => {
      const inp = e.target.closest('input[data-cart-qty-id]');
      if (!inp) return;
      const id = Number(inp.getAttribute('data-cart-qty-id'));
      const item = state.cart.find((i) => Number(i.id) === id);
      if (item) {
        item.qty = Math.max(1, Number(inp.value) || 1);
        saveCart();
        renderCartModal();
      }
    });

    document.getElementById('cart-items-container')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-cart-remove-id]');
      if (!btn) return;
      const id = Number(btn.getAttribute('data-cart-remove-id'));
      state.cart = state.cart.filter((i) => Number(i.id) !== id);
      saveCart();
      renderCartModal();
    });

    document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
      state.cart = [];
      saveCart();
      renderCartModal();
    });

    document.getElementById('btn-submit-order')?.addEventListener('click', async () => {
      const feedback = document.getElementById('cart-feedback');
      if (feedback) feedback.hidden = true;
      if (!state.client) {
        cartDialog?.close();
        loginDialog?.showModal();
        return;
      }
      if (state.cart.length === 0) {
        showToast('Agregá al menos un producto al pedido.');
        return;
      }

      const itemsPayload = state.cart.map((item) => {
        const art = findAnyArticleById(item.id);
        const unitPrice = art ? getArticleUnitPrice(art) : 0;
        return {
          id: item.id,
          co: item.co,
          no: item.no,
          qty: item.qty,
          pu: unitPrice,
          sub: unitPrice * item.qty
        };
      });

      const totalOrder = itemsPayload.reduce((acc, it) => acc + it.sub, 0);
      const notas = (document.getElementById('cart-order-notes')?.value || '').trim().toUpperCase();

      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_web_order',
            order: {
              clId: state.client.id,
              clNo: state.client.nombre || state.client.no,
              lp: getClientListaLabel(),
              items: itemsPayload,
              total: totalOrder,
              ob: notas
            }
          })
        });
        const data = await res.json();
        const savedOrder = data?.order || data?.pedido;
        if (!data || !data.ok || !savedOrder) {
          throw new Error(data?.message || data?.error || 'No se pudo enviar el pedido');
        }
        state.cart = [];
        saveCart();
        renderCartModal();
        cartDialog?.close();

        const openCashiers = Array.isArray(data.openCajaCashiers) ? data.openCajaCashiers : [];
        const isMayoristaOrder = !STORE_BRAND.isPaseoAlberdi && (savedOrder.lp || getClientListaLabel()) === 'MAYORISTA';
        if (isMayoristaOrder) {
          const waMay = getActiveStoreWhatsapp();
          const lines = itemsPayload.map((it) => `• ${it.qty}x ${it.no} (#${it.co}) — ${formatArs(it.sub)}`);
          const waMsg = [
            `📦 *NUEVO PEDIDO WEB MAYORISTA #${savedOrder.id}*`,
            `👤 *Cliente:* ${savedOrder.clNo || 'CLIENTE MAYORISTA'}`,
            `🏷️ *Lista:* MAYORISTA`,
            `🛒 *Artículos:*`,
            ...lines,
            `💰 *Total Pedido:* *${formatArs(totalOrder)}*`,
            notas ? `📝 *Notas:* ${notas}` : ''
          ]
            .filter(Boolean)
            .join('\n');
          try {
            window.open(`https://wa.me/${waMay.digits}?text=${encodeURIComponent(waMsg)}`, '_blank', 'noopener,noreferrer');
          } catch (_e) {}
          showToast(`✅ ¡Pedido Mayorista #${savedOrder.id} enviado y notificado al ${waMay.channelLabel} (${waMay.display})!`);
        } else if (openCashiers.length > 0 && openCashiers[0].waDigits) {
          const primaryCashier = openCashiers[0];
          const rawDigits = String(primaryCashier.waDigits).replace(/\D/g, '');
          const intlPhone = rawDigits.startsWith('54') ? rawDigits : `549${rawDigits.replace(/^0+/, '')}`;
          const lines = itemsPayload.map((it) => `• ${it.qty}x ${it.no} (#${it.co}) — ${formatArs(it.sub)}`);
          const waMsg = [
            `📦 *NUEVA VENTA WEB #${savedOrder.id} — LISTA PARA DESPACHAR*`,
            `👤 *Cliente:* ${savedOrder.clNo || 'CLIENTE WEB'}`,
            `🏷️ *Lista:* ${savedOrder.lp || 'MINORISTA'}`,
            `🖥️ *Caja Abierta:* ${(primaryCashier.cajaAbierta || 'CAJA').toUpperCase()} (${primaryCashier.name})`,
            `🛒 *Artículos:*`,
            ...lines,
            `💰 *Total Pedido:* *${formatArs(totalOrder)}*`,
            notas ? `📝 *Notas:* ${notas}` : ''
          ]
            .filter(Boolean)
            .join('\n');
          try {
            window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(waMsg)}`, '_blank', 'noopener,noreferrer');
          } catch (_e) {}
          showToast(`✅ ¡Pedido #${savedOrder.id} enviado y notificado al WhatsApp de ${primaryCashier.name} para despachar!`);
        } else {
          showToast(`✅ ¡Pedido #${savedOrder.id} enviado con éxito a ${STORE_BRAND.fullName}!`);
        }
      } catch (err) {
        if (feedback) {
          feedback.textContent = err.message || 'Error al enviar el pedido.';
          feedback.className = 'form-feedback is-error';
          feedback.hidden = false;
        }
      }
    });

    const urlParams = new URLSearchParams(window.location.search || '');
    const isStandaloneApp =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator?.standalone === true;
    const wantsPanel =
      urlParams.get('panel') === '1' ||
      urlParams.get('app') === '1' ||
      urlParams.get('instalar') === '1' ||
      window.location.hash === '#panel' ||
      window.location.hash === '#instalar' ||
      isStandaloneApp;
    let resumedSec = '';
    try {
      resumedSec = sessionStorage.getItem(STORE_BRAND.storagePrefix + 'pwa_resume_sec') || '';
      if (resumedSec) {
        sessionStorage.removeItem(STORE_BRAND.storagePrefix + 'pwa_resume_sec');
      }
    } catch (_e) {}
    const targetSec =
      urlParams.get('sec') ||
      resumedSec ||
      (urlParams.get('instalar') === '1' || window.location.hash === '#instalar' ? 'instalar-app' : 'home');

    const hasRefInvite = Boolean(urlParams.get('ref') || urlParams.get('invitacion') || urlParams.get('referido'));
    initReferralInviteDetection();

    if (
      window.location.hash === '#registro' ||
      urlParams.get('registro') === '1' ||
      ((urlParams.has('qr') || hasRefInvite) && !state.client)
    ) {
      switchStoreView('registro');
      if (hasRefInvite) {
        setTimeout(() => {
          showToast(`🎁 ¡Recibiste una invitación a ${STORE_BRAND.clubName}! Registrate gratis y sumen +1.000 puntos cada uno.`);
        }, 250);
      } else if (urlParams.has('qr')) {
        setTimeout(() => {
          showToast(`¡Bienvenido/a a ${STORE_BRAND.clubName}! Completá tu registración o iniciá sesión con Google.`);
        }, 250);
      }
    } else if (state.client && !urlParams.has('search') && !urlParams.has('familia')) {
      openClientPortalSection(hasRefInvite ? 'instalar-app' : targetSec);
    } else if (!state.client && wantsPanel) {
      setTimeout(() => {
        const loginDlg = document.getElementById('login-dialog');
        if (loginDlg && !loginDlg.open) {
          loginDlg.showModal();
        }
      }, 120);
    }
  };

  // =========================================================================
  // PANEL DEL CLIENTE REGISTRADO (ESTÉTICA NARANJA X + 7 SECCIONES + BARRA FIJA)
  // =========================================================================
  let activePortalCameraStream = null;
  let activePortalCameraTimer = null;

  const stopPortalCamera = () => {
    if (activePortalCameraTimer) {
      clearInterval(activePortalCameraTimer);
      activePortalCameraTimer = null;
    }
    if (activePortalCameraStream) {
      activePortalCameraStream.getTracks().forEach((t) => t.stop());
      activePortalCameraStream = null;
    }
    const consCam = document.getElementById('nx-cons-camera-wrap');
    const scCam = document.getElementById('nx-sc-camera-wrap');
    if (consCam) consCam.hidden = true;
    if (scCam) scCam.hidden = true;
  };

  const syncBottomNavActive = (key) => {
    document.querySelectorAll('#nx-bottom-nav [data-nx-nav]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-nx-nav') === key);
    });
  };

  const renderPortalHeader = () => {
    if (!state.client) return;
    const niceName = extractClientFirstName(state.client);

    const nameEl = document.getElementById('nx-portal-user-name');
    const subEl = document.getElementById('nx-portal-user-sub');
    const avatarEl = document.getElementById('nx-portal-avatar');
    const fotoUrl = String(state.client.fotoUrl || state.client.picture || '').trim();

    if (nameEl) nameEl.textContent = buildClientGreetingText(state.client);
    if (subEl) {
      subEl.textContent = '';
      subEl.hidden = true;
    }
    if (avatarEl) {
      const defaultCnIcon = `<img src="assets/img/icon-192.png?v=25" alt="CN" style="width:100%;height:100%;border-radius:50%;object-fit:contain;background:#ffffff;display:block;" />`;
      if (fotoUrl) {
        avatarEl.innerHTML = `<img src="${escapeHtml(fotoUrl)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" onerror="this.outerHTML='<img src=&quot;assets/img/icon-192.png?v=25&quot; alt=&quot;CN&quot; style=&quot;width:100%;height:100%;border-radius:50%;object-fit:contain;background:#ffffff;display:block;&quot; />'" />`;
      } else {
        avatarEl.innerHTML = defaultCnIcon;
      }
    }
  };

  const getActiveClientPoints = () => {
    const resPts = Number(state.portalData?.puntosResumen?.vigentes);
    if (Number.isFinite(resPts) && resPts >= 0) return resPts;
    return Number(state.client?.puntosFidelizacion) || 0;
  };

  const resolveStoreActiveFactorForRubro = (rubroId) => {
    const cfg = state.portalData?.fidelizacionConfig || {};
    const baseFactor = Number(cfg.factorCanje) || 1.12;
    const rules = Array.isArray(cfg.reglasRubros) ? cfg.reglasRubros : [];
    if (rules.length === 0) return { factor: baseFactor, hasSpecialRule: false };

    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dow = now.getDay();
    const rTarget = Number(rubroId) || 0;

    let spec = null;
    let gen = null;
    for (const r of rules) {
      if (!r || r.activa === false || !r.usaFactorCanje) continue;
      if (r.fechaDesde && todayIso < String(r.fechaDesde)) continue;
      if (r.fechaHasta && todayIso > String(r.fechaHasta)) continue;
      const dias = Array.isArray(r.diasSemana) ? r.diasSemana.map(Number) : [];
      if (dias.length > 0 && !dias.includes(dow)) continue;
      const rrId = Number(r.rubroId) || 0;
      if (rTarget > 0 && rrId === rTarget) spec = r;
      else if (rrId === 0) gen = r;
    }
    const chosen = spec || gen;
    if (chosen && Number(chosen.factorCanje) > 0) {
      return { factor: Number(chosen.factorCanje), hasSpecialRule: true };
    }
    return { factor: baseFactor, hasSpecialRule: false };
  };

  const getPremioRequiredPoints = (art) => {
    if (!art) return 0;
    if (Number(art.pfidManual) === 1 && Number(art.ptsCanje) > 0) {
      return Math.round(Number(art.ptsCanje));
    }
    const { factor, hasSpecialRule } = resolveStoreActiveFactorForRubro(art.r);
    const basePrice = Number(art.p1f) || getArticleUnitPrice(art) || 0;
    if (hasSpecialRule && basePrice > 0) {
      return Math.max(1, Math.round(basePrice * factor));
    }
    if (Number(art.ptsCanje) > 0) return Math.round(Number(art.ptsCanje));
    return Math.max(1, Math.round(basePrice * factor));
  };

  const renderPortalHomeCards = () => {
    if (!state.client) return;
    const pts = getActiveClientPoints();
    const hidden = state.privacyHidden;

    // Tarjeta 1: Puntos Club Fidel
    const ptsBalEl = document.getElementById('nx-card-pts-balance');
    const ptsHelpEl = document.getElementById('nx-card-pts-helper');
    const cfg = state.portalData?.fidelizacionConfig || {};
    const diasVenc = Number(cfg.diasVencimiento) || 365;

    if (ptsBalEl) {
      ptsBalEl.innerHTML = hidden
        ? `${cfBadgeSvg(28)} <span>•••• pts</span>`
        : `${cfBadgeSvg(28)} <span>${pts.toLocaleString('es-AR')} pts</span>`;
    }
    if (ptsHelpEl) {
      ptsHelpEl.textContent = `Puntos vigentes por ${diasVenc} días · Canjeá en nuestro Catálogo de Premios.`;
    }

    // Tarjeta 2: Soy Cajero
    const scTotalEl = document.getElementById('nx-card-sc-total');
    const scSubEl = document.getElementById('nx-card-sc-sub');
    const scTotal = state.soyCajeroItems.reduce(
      (acc, it) => acc + (Number(it.cantidad) || 1) * (Number(it.precioUnit) || 0),
      0
    );
    const scUnits = state.soyCajeroItems.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);

    if (scTotalEl) {
      scTotalEl.textContent = hidden ? '$ ••••' : formatArs(scTotal);
    }
    if (scSubEl) {
      scSubEl.textContent = 'Confirmá tu compra y presentá el QR o código en Caja.';
    }

    // Tarjeta 3 (Carrusel): Bono +1.000 pts Instalar App & Recomendá a un Amigo (+1.000 pts c/u)
    const appBonusClaimed = Boolean(state.client.bonoAppInstaladaOtorgado);
    const myRefCode = getClientReferralCode(state.client);
    const refFriendsCount = Math.max(0, Number(state.client.amigosReferidosCount) || 0);

    const promoTitleEl = document.getElementById('nx-card-promo-title');
    const promoBadgeEl = document.getElementById('nx-card-promo-pill') || document.getElementById('nx-card-promo-badge');
    const promoHeadEl = document.getElementById('nx-card-promo-balance') || document.getElementById('nx-card-promo-headline');
    const promoSubEl = document.getElementById('nx-card-promo-sub');
    const shortcutBadgeEl = document.getElementById('nx-shortcut-install-badge');

    if (shortcutBadgeEl) {
      shortcutBadgeEl.textContent = appBonusClaimed ? '🎁 +1.000 x Amigo' : '+1.000 pts';
    }

    if (appBonusClaimed) {
      if (promoTitleEl) promoTitleEl.textContent = 'Recomendá a un Amigo';
      if (promoBadgeEl) promoBadgeEl.textContent = myRefCode;
      if (promoHeadEl) {
        promoHeadEl.innerHTML = `${cfBadgeSvg(24)} <span>+1.000 pts c/u</span>`;
      }
      if (promoSubEl) {
        promoSubEl.textContent =
          refFriendsCount > 0
            ? `Invitaste a ${refFriendsCount} amigo(s). Compartí tu código ${myRefCode} por WhatsApp.`
            : `Invitá amigos por WhatsApp con tu código ${myRefCode} y sumen 1.000 pts c/u.`;
      }
    } else {
      if (promoTitleEl) promoTitleEl.textContent = 'Instalá la App Oficial';
      if (promoBadgeEl) promoBadgeEl.textContent = '+1.000 pts';
      if (promoHeadEl) {
        promoHeadEl.innerHTML = `${cfBadgeSvg(24)} <span>+1.000 pts</span>`;
      }
      if (promoSubEl) {
        promoSubEl.textContent = `Instalá la App (+1.000 pts) o invitá amigos por WhatsApp (${myRefCode}).`;
      }
    }

    // Sección Instalar App / Recomendá a un Amigo
    const instBannerTitle = document.getElementById('nx-install-bonus-title');
    const instBannerDesc = document.getElementById('nx-install-bonus-desc');
    const instBannerPill = document.getElementById('nx-install-bonus-pill');
    if (appBonusClaimed) {
      if (instBannerTitle) instBannerTitle.textContent = '✅ ¡Ya recibiste tus +1.000 puntos por instalar la App Oficial!';
      if (instBannerDesc) {
        instBannerDesc.textContent = 'Tus +1.000 puntos de regalo ya están acreditados en tu cuenta de Club Fidel.';
      }
      if (instBannerPill) {
        instBannerPill.textContent = '✓ +1.000 PTS ACREDITADOS';
        instBannerPill.style.background = '#15803d';
      }
    } else {
      if (instBannerTitle) instBannerTitle.textContent = '¡Regalo de +1.000 Puntos en el Catálogo!';
      if (instBannerDesc) {
        instBannerDesc.innerHTML =
          'Instalá la App Oficial en tu celular y al abrirla desde tu pantalla de inicio se acreditan automáticamente <strong>+1.000 puntos</strong> en tu cuenta.';
      }
      if (instBannerPill) {
        instBannerPill.textContent = '+1.000 PTS GRATIS';
        instBannerPill.style.background = '#d4a41e';
      }
    }

    const refCodeEl = document.getElementById('nx-ref-my-code');
    const refFriendsEl = document.getElementById('nx-ref-friends-count');
    const manualRefBox = document.getElementById('nx-manual-ref-claim-box');
    if (refCodeEl) refCodeEl.textContent = myRefCode;
    if (refFriendsEl) {
      refFriendsEl.textContent =
        refFriendsCount > 0
          ? `🎉 Ya invitaste a ${refFriendsCount} amigo(s) (+${(refFriendsCount * 1000).toLocaleString('es-AR')} pts ganados)`
          : 'Invitaciones ilimitadas · +1.000 pts por cada amigo que se registre';
    }
    if (manualRefBox) {
      manualRefBox.hidden = Boolean(state.client.bonoReferidoBienvenidaOtorgado);
    }
  };

  const loadClientPortalData = async () => {
    if (!state.client) return;
    try {
      const res = await fetch(CLIENTES_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_client_portal_data',
          cId: state.client.id || 0,
          codigo: state.client.codigo || state.client.co || 0,
          nroDoc: state.client.nroDoc || state.client.nd || '',
          googleSub: state.client.googleSub || '',
          email: state.client.email || state.client.em || ''
        })
      });
      const data = await res.json();
      if (data && data.ok) {
        if (data.client) {
          const prevCod = state.client.codigo || state.client.co || '';
          state.client = { ...state.client, ...data.client };
          try {
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state.client));
          } catch (_e) {}
          if (String(prevCod) !== String(state.client.codigo || '')) {
            syncAuthUi();
          }
        }
        state.portalData.fidelizacionConfig = data.fidelizacionConfig || state.portalData.fidelizacionConfig;
        state.portalData.puntosResumen = data.puntosResumen || state.portalData.puntosResumen;
        state.portalData.movimientosFidelizacion = Array.isArray(data.movimientosFidelizacion)
          ? data.movimientosFidelizacion
          : [];
        state.portalData.misCompras = Array.isArray(data.misCompras) ? data.misCompras : [];
        state.portalData.ticketsSoyCajero = Array.isArray(data.ticketsSoyCajero) ? data.ticketsSoyCajero : [];
        if (data.nextSoyCajeroCode) {
          state.nextSoyCajeroCode = String(data.nextSoyCajeroCode);
        }

        renderPortalHeader();
        renderPortalHomeCards();
        renderSoyCajeroSection();
        if (state.activePortalSec === 'perfil') renderPortalPerfilSection();
        if (state.activePortalSec === 'puntos') renderPortalPuntosSection();
        if (state.activePortalSec === 'compras') renderPortalComprasSection();
        if (state.activePortalSec === 'premios') renderPortalPremiosSection();

        // Si el cliente abrió la App instalada (standalone PWA) y aún no recibió sus +1.000 pts, acreditarlos automáticamente
        checkAndClaimPwaInstallBonus(false);
      }
    } catch (err) {
      console.warn('No se pudieron actualizar los datos del portal del cliente:', err);
    }
  };

  // Navegación entre las 7 secciones del Panel del Cliente
  const openClientPortalSection = (secKey, options = {}) => {
    stopPortalCamera();
    if (!state.client) {
      document.getElementById('login-dialog')?.showModal();
      return;
    }

    if (secKey !== 'soy-cajero') {
      state.soyCajeroLastTicket = null;
      stopSoyCajeroQueuePolling();
    } else {
      startSoyCajeroQueuePolling();
    }

    if (secKey === 'compra-web') {
      state.activePortalSec = 'compra-web';
      switchStoreView('catalogo');
      syncBottomNavActive('compra-web');
      return;
    }

    state.activePortalSec = secKey || 'home';
    switchStoreView('panel');

    const mapSubviews = {
      home: 'nx-subview-home',
      perfil: 'nx-subview-perfil',
      consultador: 'nx-subview-consultador',
      'soy-cajero': 'nx-subview-soy-cajero',
      puntos: 'nx-subview-puntos',
      compras: 'nx-subview-compras',
      premios: 'nx-subview-premios',
      'instalar-app': 'nx-subview-instalar-app'
    };

    const targetId = mapSubviews[state.activePortalSec] || 'nx-subview-home';
    document.querySelectorAll('#view-panel-cliente .nx-subview').forEach((el) => {
      el.hidden = el.id !== targetId;
      el.classList.toggle('is-active', el.id === targetId);
    });

    const navMap = {
      home: 'home',
      perfil: 'perfil',
      'soy-cajero': 'soy-cajero',
      premios: 'premios',
      puntos: 'premios',
      consultador: 'home',
      compras: 'home',
      'instalar-app': 'home'
    };
    syncBottomNavActive(navMap[state.activePortalSec] || 'home');

    renderPortalHeader();
    renderPortalHomeCards();

    if (state.activePortalSec === 'perfil') {
      renderPortalPerfilSection();
    } else if (state.activePortalSec === 'consultador') {
      renderConsultadorSection();
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    } else if (state.activePortalSec === 'soy-cajero') {
      renderSoyCajeroSection();
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      if (options.autoScan) {
        startPortalBarcodeScanner('soy-cajero');
      }
    } else if (state.activePortalSec === 'puntos') {
      renderPortalPuntosSection();
    } else if (state.activePortalSec === 'compras') {
      renderPortalComprasSection();
    } else if (state.activePortalSec === 'premios') {
      renderPortalPremiosSection();
    }
  };

  // 1. SECCIÓN MI PERFIL
  const renderPortalPerfilSection = () => {
    const cli = state.client;
    if (!cli) return;

    const origenBadge = document.getElementById('nx-perfil-origen-badge');
    const titleName = document.getElementById('nx-perfil-title-name');
    const titleMeta = document.getElementById('nx-perfil-title-meta');

    if (origenBadge) {
      origenBadge.hidden = true;
    }
    if (titleName) titleName.textContent = cli.nombre || cli.no || 'CLIENTE';
    if (titleMeta) {
      titleMeta.innerHTML = `Puntos: ${cfBadgeSvg(16)} <strong>${getActiveClientPoints().toLocaleString('es-AR')}</strong>`;
    }

    const perfilImg = document.getElementById('nx-perfil-avatar-img');
    const perfilFallback = document.getElementById('nx-perfil-avatar-fallback');
    const fotoUrl = String(cli.fotoUrl || cli.picture || '').trim();
    if (perfilImg) {
      if (fotoUrl) {
        perfilImg.src = fotoUrl;
        perfilImg.hidden = false;
        if (perfilFallback) perfilFallback.hidden = true;
      } else {
        perfilImg.hidden = true;
        if (perfilFallback) perfilFallback.hidden = false;
      }
    }

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };
    const ensureSelectVal = (selectId, rawVal, cpVal = '') => {
      const sel = document.getElementById(selectId);
      if (!sel || !rawVal) return;
      const val = String(rawVal).trim().toUpperCase();
      if (!val) return;
      const exists = Array.from(sel.options).some((o) => o.value.toUpperCase() === val);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = val;
        if (cpVal) opt.setAttribute('data-cp', cpVal);
        opt.textContent = cpVal ? `${val} (CP ${cpVal})` : val;
        sel.appendChild(opt);
      }
      sel.value = val;
    };

    const docVal = String(cli.nroDoc || cli.nd || '').trim().toUpperCase();
    setVal('nx-prof-quick-doc', docVal);
    setVal('nx-prof-nrodoc', docVal);
    const rawTipoDoc = String(cli.tipoDoc || cli.td || 'DNI').toUpperCase();
    setVal('nx-prof-tipodoc', ['CUIT', 'CUIL', 'DNI'].includes(rawTipoDoc) ? rawTipoDoc : 'DNI');

    const rawIva = String(cli.respIva || cli.iv || 'CONSUMIDOR FINAL').toUpperCase();
    const normIva = rawIva.includes('MONOTRIBUTO')
      ? 'MONOTRIBUTO'
      : rawIva.includes('INSCRIPTO')
        ? 'INSCRIPTO'
        : rawIva.includes('EXENTO')
          ? 'EXENTO'
          : 'CONSUMIDOR FINAL';
    setVal('nx-prof-respiva', normIva);

    const profNameParts = splitClientFullNameParts(cli);
    setVal('nx-prof-nombre', profNameParts.nombre);
    setVal('nx-prof-apellido', profNameParts.apellido);
    setVal('nx-prof-razon-social', cli.razonSocial || cli.rs || composeErpFullName(profNameParts.nombre, profNameParts.apellido) || cli.nombre || cli.no || '');
    setVal('nx-prof-email', cli.email || cli.em || '');

    const rawCel = String(cli.celular || cli.ce || cli.telefono || '').trim();
    const cleanCel = rawCel.replace(/^\+?549?/, '');
    setVal('nx-prof-celular', cleanCel || rawCel);
    setVal('nx-prof-fecha-nacimiento', cli.fechaNacimiento || cli.fn || '');
    setVal('nx-prof-observacion', cli.observacion || cli.ob || '');

    const cleanStreetNumForInput = (raw) => {
      let s = String(raw ?? '').trim().toUpperCase();
      if (!s) return '';
      const mPre = s.match(/^(?:S\/N|S\/D)\s*(.+)$/i);
      if (mPre && mPre[1].trim() && mPre[1].trim().toUpperCase() !== 'S/N') s = mPre[1].trim().toUpperCase();
      const mSuf = s.match(/^(.+?)\s*(?:S\/N|S\/D)$/i);
      if (mSuf && mSuf[1].trim() && mSuf[1].trim().toUpperCase() !== 'S/N') s = mSuf[1].trim().toUpperCase();
      if (!s || s === 'S/N' || s === 'S/D' || s === '...') return '';
      return s;
    };

    const rawProfCalle = cli.calle || cli.ca || '';
    setVal('nx-prof-calle', rawProfCalle !== 'S/D' ? rawProfCalle : '');
    setVal('nx-prof-numero', cleanStreetNumForInput(cli.numero || cli.nu));
    setVal('nx-prof-piso', cli.piso || '');
    setVal('nx-prof-dpto', cli.dpto || cli.depto || '');
    setVal('nx-prof-torre', cli.torre || '');
    setVal('nx-prof-barrio', cli.barrio || cli.ba || '');

    const paisVal = cli.pais || 'ARGENTINA';
    const provVal = cli.provincia || cli.pr || 'CÓRDOBA';
    const locVal = cli.localidad || cli.lo || STORE_BRAND.defaultLocalidad || 'ALCIRA GIGENA';
    const cpVal = cli.cp || '5813';
    ensureSelectVal('nx-prof-pais', paisVal);
    document.getElementById('nx-prof-pais')?.dispatchEvent(new Event('change'));
    ensureSelectVal('nx-prof-provincia', provVal);
    document.getElementById('nx-prof-provincia')?.dispatchEvent(new Event('change'));
    ensureSelectVal('nx-prof-localidad', locVal, cpVal);
    setVal('nx-prof-cp', cpVal);

    const rawProfCalleF = cli.calleFiscal || cli.calle || cli.ca || '';
    setVal('nx-prof-calle-fiscal', rawProfCalleF !== 'S/D' ? rawProfCalleF : '');
    setVal('nx-prof-numero-fiscal', cleanStreetNumForInput(cli.numeroFiscal || cli.numero || cli.nu));
    setVal('nx-prof-piso-fiscal', cli.pisoFiscal || cli.piso || '');
    setVal('nx-prof-dpto-fiscal', cli.dptoFiscal || cli.deptoFiscal || cli.dpto || cli.depto || '');
    setVal('nx-prof-torre-fiscal', cli.torreFiscal || cli.torre || '');
    setVal('nx-prof-barrio-fiscal', cli.barrioFiscal || cli.barrio || cli.ba || '');

    const paisFiscalVal = cli.paisFiscal || paisVal;
    const provFiscalVal = cli.provinciaFiscal || provVal;
    const locFiscalVal = cli.localidadFiscal || locVal;
    const cpFiscalVal = cli.cpFiscal || cpVal;
    ensureSelectVal('nx-prof-pais-fiscal', paisFiscalVal);
    document.getElementById('nx-prof-pais-fiscal')?.dispatchEvent(new Event('change'));
    ensureSelectVal('nx-prof-provincia-fiscal', provFiscalVal);
    document.getElementById('nx-prof-provincia-fiscal')?.dispatchEvent(new Event('change'));
    ensureSelectVal('nx-prof-localidad-fiscal', locFiscalVal, cpFiscalVal);
    setVal('nx-prof-cp-fiscal', cpFiscalVal);

    setVal('nx-prof-usuario', cli.email || cli.usuarioWeb || cli.uw || '');
    setVal('nx-prof-clave', '');

    const waBtn = document.getElementById('btn-prof-verify-whatsapp');
    const waHint = document.getElementById('nx-prof-whatsapp-status') || document.getElementById('nx-prof-wa-hint');
    const profOtpBox = document.getElementById('nx-prof-otp-verify-box');
    if (profOtpBox) profOtpBox.hidden = true;
    if (cli.whatsappRegistrado) {
      if (waBtn) {
        waBtn.classList.add('is-verified');
        waBtn.textContent = '✓ WhatsApp Registrado';
      }
      if (waHint) {
        waHint.textContent = '✓ Tu número de WhatsApp está registrado en tu ficha.';
        waHint.style.color = 'var(--status-ok)';
      }
    } else {
      if (waBtn) {
        waBtn.classList.remove('is-verified');
        waBtn.textContent = '📲 Enviar Código';
      }
      if (waHint) {
        waHint.textContent = 'Recibí un código de 6 dígitos para verificar tu número en Club Fidel.';
        waHint.style.color = '';
      }
    }
  };

  // 2. SECCIÓN CONSULTADOR DE PRECIOS
  const expandUpcEToUpcA = (upcE) => {
    if (!/^[01]\d{7}$/.test(upcE)) return null;
    const ns = upcE[0];
    const d1 = upcE[1];
    const d2 = upcE[2];
    const d3 = upcE[3];
    const d4 = upcE[4];
    const d5 = upcE[5];
    const d6 = upcE[6];
    const chk = upcE[7];
    if (d6 === '0' || d6 === '1' || d6 === '2') {
      return `${ns}${d1}${d2}${d6}0000${d3}${d4}${d5}${chk}`;
    }
    if (d6 === '3') {
      return `${ns}${d1}${d2}${d3}00000${d4}${d5}${chk}`;
    }
    if (d6 === '4') {
      return `${ns}${d1}${d2}${d3}${d4}00000${d5}${chk}`;
    }
    return `${ns}${d1}${d2}${d3}${d4}${d5}0000${d6}${chk}`;
  };

  const sanitizeScannedBarcodeStr = (raw) => {
    let s = String(raw || '').trim();
    if (!s) return '';
    s = s.replace(/^\][A-Za-z]\d/, '').trim();
    if (/^[\d\s\r\n\t-]+$/.test(s) && s.replace(/\D/g, '').length >= 8) {
      s = s.replace(/\D/g, '');
    }
    return s;
  };

  const buildBarcodeComparableKeys = (rawBc) => {
    const keys = new Set();
    const s = sanitizeScannedBarcodeStr(rawBc).toUpperCase();
    if (!s) return keys;
    keys.add(s);
    if (/^\d{8,18}$/.test(s)) {
      const stripped = s.replace(/^0+/, '');
      if (stripped.length >= 7) {
        keys.add(stripped);
      }
      if (s.length === 12) {
        keys.add('0' + s);
      } else if (s.length === 13 && s.startsWith('0')) {
        keys.add(s.slice(1));
      }
      if (s.length === 8 && (s[0] === '0' || s[0] === '1')) {
        const upcA = expandUpcEToUpcA(s);
        if (upcA) {
          keys.add(upcA);
          keys.add('0' + upcA);
          const upcStripped = upcA.replace(/^0+/, '');
          if (upcStripped.length >= 7) keys.add(upcStripped);
        }
      }
    }
    return keys;
  };

  const findArticlesByBarcodeOrQuery = (rawQuery) => {
    const cleanRaw = sanitizeScannedBarcodeStr(rawQuery);
    const q = cleanRaw.toUpperCase();
    if (!q) return { exact: null, list: [] };

    const catalogPool = state.allArticulos.length > 0 ? state.allArticulos : state.articulos;
    const digits = q.replace(/\D/g, '');
    const isPureNumeric = /^\d+$/.test(q);
    let scaleMeta = null;

    // 0. Soporte para etiquetas de balanza EAN-13 (prefijos 20, 21 o 23 + PLU 5 dígitos + peso/importe 5 dígitos + verificador)
    let scaleDigits = digits;
    if (isPureNumeric) {
      if (/^0(20|21|23)\d{11}$/.test(scaleDigits)) {
        scaleDigits = scaleDigits.slice(1);
      } else if (/^(20|21|23)\d{10}$/.test(scaleDigits)) {
        scaleDigits = scaleDigits + '0';
      }
    }
    if (
      isPureNumeric &&
      scaleDigits.length === 13 &&
      (scaleDigits.startsWith('20') || scaleDigits.startsWith('21') || scaleDigits.startsWith('23'))
    ) {
      const pluRaw = scaleDigits.slice(2, 7);
      const pluClean = String(Number(pluRaw));
      const valRaw = Number(scaleDigits.slice(7, 12)) || 0;
      let scaleArt = catalogPool.find(
        (a) =>
          String(a.c || '').padStart(5, '0') === pluRaw ||
          String(a.c) === pluRaw ||
          String(Number(a.c)) === pluClean
      );
      if (!scaleArt && pluRaw.endsWith('00')) {
        const altCod5 = '00' + pluRaw.slice(0, 3);
        scaleArt = catalogPool.find((a) => String(a.c || '').padStart(5, '0') === altCod5);
      }
      if (scaleArt) {
        const fixedOwner = catalogPool.find(
          (a) =>
            a.id !== scaleArt.id &&
            Array.isArray(a.bc) &&
            a.bc.some((b) => String(b.c || b || '').trim() === scaleDigits)
        );
        if (!fixedOwner || Number(scaleArt.fr) === 1) {
          const qtyKg = valRaw / 1000;
          scaleMeta = { isScaleTicket: true, qtyKg: qtyKg > 0 ? qtyKg : 1, rawBarcode: scaleDigits };
          return { exact: scaleArt, scaleMeta, list: [scaleArt] };
        }
      }
    }

    // 1. Coincidencia estricta por código de barras o código interno (incluye ceros a la izquierda en códigos internos <= 5 dígitos)
    const padded5 = isPureNumeric && q.length <= 5 ? q.padStart(5, '0') : null;
    let exact = catalogPool.find((a) => {
      if (Array.isArray(a.bc) && a.bc.some((b) => sanitizeScannedBarcodeStr(b.c || b || '').toUpperCase() === q)) {
        return true;
      }
      const codeUpper = String(a.c || '').toUpperCase();
      if (codeUpper === q || (padded5 && codeUpper === padded5) || (isPureNumeric && q.length <= 5 && String(Number(a.c)) === String(Number(q)))) {
        return true;
      }
      return false;
    });

    // 2. Equivalencia UPC-A (12 dígitos) <-> EAN-13 (13 dígitos con 0 inicial), UPC-E (8 dígitos) y ceros iniciales en códigos de barras
    if (!exact && isPureNumeric && q.length >= 8) {
      const qKeys = buildBarcodeComparableKeys(q);
      exact = catalogPool.find((a) => {
        if (!Array.isArray(a.bc) || a.bc.length === 0) return false;
        return a.bc.some((b) => {
          const bKeys = buildBarcodeComparableKeys(b.c || b || '');
          for (const k of bKeys) {
            if (qKeys.has(k)) return true;
          }
          return false;
        });
      });

      // 3. Fallback prefijo argentino 779 <-> 79 (cuando se almacenó o leyó truncado en 12 dígitos)
      if (!exact) {
        const altPref =
          q.length === 12 && q.startsWith('79')
            ? '7' + q
            : q.length === 13 && q.startsWith('779')
            ? q.slice(1)
            : '';
        if (altPref) {
          exact = catalogPool.find(
            (a) =>
              Array.isArray(a.bc) &&
              a.bc.some((b) => sanitizeScannedBarcodeStr(b.c || b || '') === altPref)
          );
        }
      }
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const matches = catalogPool
      .filter((a) => {
        const codeStr = String(a.c || '').toUpperCase();
        const nameStr = String(a.n || '').toUpperCase();
        const barStr = Array.isArray(a.bc) ? a.bc.map((b) => String(b.c || b || '')).join(' ').toUpperCase() : '';
        const marcaStr = String(state.marcasMap.get(Number(a.mk)) || '').toUpperCase();
        const hay = `${codeStr} ${nameStr} ${barStr} ${marcaStr}`;
        return tokens.every((tk) => hay.includes(tk));
      })
      .slice(0, 25);

    if (exact && !matches.some((m) => m.id === exact.id)) {
      matches.unshift(exact);
    }

    return { exact: exact || matches[0] || null, scaleMeta, list: matches };
  };

  const renderConsultadorSection = (queryOverride = null) => {
    const inp = document.getElementById('nx-cons-input');
    const featuredEl = document.getElementById('nx-cons-featured-result');
    const listEl = document.getElementById('nx-cons-results-list');
    if (!featuredEl || !listEl) return;

    const q = queryOverride !== null ? queryOverride : (inp?.value || '').trim();
    if (!q) {
      featuredEl.hidden = true;
      listEl.innerHTML = `
        <div style="text-align:center; padding:1.75rem 1rem; color:var(--text-secondary);">
          Escaneá un código de barras o escribí el nombre del artículo para ver su precio al instante.
        </div>`;
      return;
    }

    const { exact, scaleMeta, list } = findArticlesByBarcodeOrQuery(q);
    if (!exact) {
      featuredEl.hidden = true;
      listEl.innerHTML = `
        <div style="text-align:center; padding:1.5rem; color:var(--status-danger); font-weight:600;">
          No se encontró ningún producto para "${escapeHtml(q)}".
        </div>`;
      return;
    }

    const unitPrice = getArticleUnitPrice(exact);
    const rubroName = state.rubrosMap.get(Number(exact.r)) || 'GENERAL';
    const marcaName = state.marcasMap.get(Number(exact.mk)) || STORE_BRAND.upperName;
    const eanText = Array.isArray(exact.bc) && exact.bc.length > 0 ? exact.bc[0].c || exact.bc[0] : 'S/EAN';
    const scaleLine = scaleMeta
      ? `<div style="margin-top:0.4rem; font-size:0.86rem; color:#15803d; font-weight:700;">⚖️ Etiqueta Balanza: ${scaleMeta.qtyKg.toFixed(3)} Kg · Total: ${formatArs(unitPrice * scaleMeta.qtyKg)}</div>`
      : '';

    featuredEl.hidden = false;
    featuredEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
        <div>
          <span style="font-size:0.74rem; font-weight:800; color:#b45309; text-transform:uppercase;">CÓD. #${escapeHtml(exact.c)} · ${escapeHtml(rubroName)} · ${escapeHtml(marcaName)}</span>
          <h4 style="margin:0.25rem 0; font-size:1.25rem; color:#18181b;">${escapeHtml(exact.n)}</h4>
          <span style="font-size:0.78rem; color:#52525b;">EAN: ${escapeHtml(eanText)} · Stock: ${Number(exact.sf) > 0 ? 'Disponible' : 'Consultar'}</span>
          ${scaleLine}
        </div>
        <div style="text-align:right;">
          <span style="font-size:0.72rem; font-weight:700; color:#52525b; display:block;">PRECIO ${getClientListaLabel()} FINAL</span>
          <strong style="font-size:2rem; font-weight:900; color:#15803d; line-height:1.1;">${formatArs(unitPrice)}</strong>
          <div style="margin-top:0.65rem; display:flex; gap:0.5rem; justify-content:flex-end; flex-wrap:wrap;">
            <button type="button" class="btn-primary-theme" data-cons-add-sc="${exact.id}">🛒 Sumar a Soy Cajero</button>
            <button type="button" class="btn-outline-theme" data-cons-add-web="${exact.id}">🛍️ Sumar a Compra Web</button>
          </div>
        </div>
      </div>
    `;

    listEl.innerHTML = list
      .slice(0, 12)
      .map((art) => {
        const p = getArticleUnitPrice(art);
        return `
          <div class="nx-cons-row">
            <div>
              <strong style="display:block; font-size:0.9rem; color:#18181b;">${escapeHtml(art.n)}</strong>
              <small style="color:#71717a;">Cód. #${escapeHtml(art.c)} · ${escapeHtml(state.marcasMap.get(Number(art.mk)) || '')}</small>
            </div>
            <div style="display:flex; align-items:center; gap:0.65rem;">
              <strong style="font-size:1.05rem; color:#18181b;">${formatArs(p)}</strong>
              <button type="button" class="btn-outline-theme" style="padding:0.35rem 0.65rem; font-size:0.78rem;" data-cons-add-sc="${art.id}">+ Soy Cajero</button>
            </div>
          </div>`;
      })
      .join('');
  };

  // 3. SECCIÓN SOY CAJERO (Facturador Intermedio con Código Interno en fila para Caja)
  let soyCajeroQueueTimer = null;

  const drawSoyCajeroQrCanvas = (codeText, forceRedraw = false) => {
    const canvas = document.getElementById('nx-sc-qr-canvas');
    if (!canvas || !codeText) return;
    if (!forceRedraw && state.lastDrawnScQrCode === codeText) return;
    state.lastDrawnScQrCode = codeText;
    const ctx = canvas.getContext('2d');
    const size = canvas.width || 130;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=M&margin=2&color=202020&bgcolor=ffffff&data=${encodeURIComponent(codeText)}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
    };
    img.onerror = () => {
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(fallbackImg, 0, 0, size, size);
      };
      fallbackImg.src = qrUrl;
    };
    img.src = qrUrl;
  };

  const syncSoyCajeroNextCodeInQueue = async () => {
    try {
      const res = await fetch(CLIENTES_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'peek_soy_cajero_next_code' })
      });
      const data = await res.json();
      if (data && data.ok && data.nextSoyCajeroCode) {
        const incomingNext = String(data.nextSoyCajeroCode);
        const prevNext = state.nextSoyCajeroCode;
        state.nextSoyCajeroCode = incomingNext;
        if (prevNext !== incomingNext && !state.soyCajeroLastTicket) {
          renderSoyCajeroSection();
        }
      }
    } catch (_err) {}
  };

  const startSoyCajeroQueuePolling = () => {
    stopSoyCajeroQueuePolling();
    syncSoyCajeroNextCodeInQueue();
    soyCajeroQueueTimer = setInterval(() => {
      if (state.activePortalSec === 'soy-cajero' && !state.soyCajeroLastTicket) {
        syncSoyCajeroNextCodeInQueue();
      }
    }, 3500);
  };

  const stopSoyCajeroQueuePolling = () => {
    if (soyCajeroQueueTimer) {
      clearInterval(soyCajeroQueueTimer);
      soyCajeroQueueTimer = null;
    }
  };

  const addProductToSoyCajero = (art, qty = 1, options = {}) => {
    if (!art) return;
    const isScale = Boolean(options.isScaleTicket);
    const allowFrac = isScale || Number(art.fr) === 1;
    const rawQty = Number(qty) > 0 ? Number(qty) : 1;
    const cleanQty = allowFrac
      ? Math.round(rawQty * 1000) / 1000
      : Math.max(1, Math.round(rawQty));
    const unitPrice = getArticleUnitPrice(art);

    // Al comenzar/continuar cargando artículos, ocultamos cualquier código recién generado anterior
    state.soyCajeroLastTicket = null;

    const existing = !isScale
      ? state.soyCajeroItems.find((it) => Number(it.artId) === Number(art.id) && !it.isScaleTicket)
      : null;

    if (existing) {
      existing.cantidad = allowFrac
        ? Math.round((Number(existing.cantidad) + cleanQty) * 1000) / 1000
        : Math.max(1, Math.round(Number(existing.cantidad) + cleanQty));
      existing.precioUnit = unitPrice;
    } else {
      state.soyCajeroItems.push({
        uid: Date.now() + Math.random(),
        artId: art.id,
        c: art.c,
        n: art.n,
        bc: Array.isArray(art.bc) && art.bc.length > 0 ? String(art.bc[0].c || art.bc[0]) : '',
        cantidad: cleanQty,
        precioUnit: unitPrice,
        isScaleTicket: isScale,
        scaleBarcode: options.rawBarcode || ''
      });
    }

    saveSoyCajeroLocal();
    renderSoyCajeroSection();
    renderPortalHomeCards();
    showToast(`🛒 Agregado a Soy Cajero: ${art.n}`);
  };

  const renderSoyCajeroSection = () => {
    const wrap = document.getElementById('nx-sc-items-wrap');
    const footerEl = document.getElementById('nx-sc-footer');
    const explainEl = document.getElementById('nx-sc-bottom-explain');
    const countEl = document.getElementById('nx-sc-footer-count');
    const totalEl = document.getElementById('nx-sc-footer-total');
    const banner = document.getElementById('nx-sc-generated-code-banner');
    const codeDisp = document.getElementById('nx-sc-code-display');
    if (!wrap) return;

    const hasItems = state.soyCajeroItems.length > 0;
    if (footerEl) footerEl.hidden = !hasItems;
    if (explainEl) explainEl.hidden = !hasItems;

    // Mostrar siempre el código y su QR preparado:
    // - Si el cliente acaba de confirmar su compra, muestra su código confirmado definitivo.
    // - Mientras está cargando o antes de confirmar, muestra el próximo número en fila en tiempo real con su QR ya listo.
    if (banner) banner.hidden = false;
    if (!hasItems && state.soyCajeroLastTicket && state.soyCajeroLastTicket.codigoInterno) {
      const tk = state.soyCajeroLastTicket;
      if (codeDisp) codeDisp.textContent = tk.codigoInterno;
      drawSoyCajeroQrCanvas(tk.codigoFormateado || `FM-${tk.codigoInterno}`);
    } else {
      const nextCode = state.nextSoyCajeroCode || '';
      if (nextCode) {
        if (codeDisp) codeDisp.textContent = nextCode;
        drawSoyCajeroQrCanvas(`FM-${nextCode}`);
      } else {
        if (codeDisp) codeDisp.textContent = '...';
        syncSoyCajeroNextCodeInQueue();
      }
    }

    if (!hasItems) {
      wrap.innerHTML = state.soyCajeroLastTicket?.codigoInterno
        ? ''
        : `
        <div class="nx-sc-empty-hint" style="cursor:pointer;" onclick="document.getElementById('nx-sc-search-input')?.focus()">
          Si no lee el código podes escribirlo manualmente
        </div>`;
    } else {
      wrap.innerHTML = state.soyCajeroItems
        .map((it, idx) => {
          const sub = (Number(it.cantidad) || 1) * (Number(it.precioUnit) || 0);
          return `
            <div class="nx-sc-item-row">
              <div style="flex:1 1 200px;">
                <strong style="display:block; font-size:0.92rem; color:#18181b;">${escapeHtml(it.n)}</strong>
                <small style="color:#71717a;">Cód. #${escapeHtml(it.c)} · Unit.: ${formatArs(it.precioUnit)}</small>
              </div>
              <div style="display:flex; align-items:center; gap:0.45rem;">
                <button type="button" class="btn-outline-theme" style="padding:0.25rem 0.6rem;" data-sc-dec="${idx}">−</button>
                <strong style="min-width:36px; text-align:center; font-family:var(--font-mono);">${Number(it.cantidad) % 1 === 0 ? it.cantidad : Number(it.cantidad).toFixed(3)}</strong>
                <button type="button" class="btn-outline-theme" style="padding:0.25rem 0.6rem;" data-sc-inc="${idx}">+</button>
              </div>
              <div style="min-width:95px; text-align:right;">
                <strong style="font-size:1rem; color:#18181b;">${formatArs(sub)}</strong>
              </div>
              <button type="button" class="btn-ghost-danger" style="padding:0.3rem 0.55rem;" data-sc-del="${idx}" title="Quitar">✕</button>
            </div>`;
        })
        .join('');
    }

    const total = state.soyCajeroItems.reduce(
      (acc, it) => acc + (Number(it.cantidad) || 1) * (Number(it.precioUnit) || 0),
      0
    );
    if (countEl) countEl.textContent = `${state.soyCajeroItems.length} producto(s) cargado(s)`;
    if (totalEl) totalEl.textContent = formatArs(total);
  };

  // Escáner de cámara compartido para Consultador de Precios y Soy Cajero (compatible con iOS / iPhone / Android)
  let portalZXingReaders = null;
  let portalZXingCanvas = null;

  const isIOSOrSafariPortal = () => {
    const ua = String(navigator.userAgent || '');
    return (
      /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints) > 1) ||
      (/^((?!chrome|android).)*safari/i.test(ua))
    );
  };

  const getPortalZXingReaders = () => {
    if (portalZXingReaders) return portalZXingReaders;
    const ZX = window.ZXing;
    if (!ZX || !ZX.MultiFormatReader) return null;
    const hints = new Map();
    if (ZX.DecodeHintType && ZX.BarcodeFormat) {
      hints.set(ZX.DecodeHintType.TRY_HARDER, true);
      hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
        ZX.BarcodeFormat.EAN_13,
        ZX.BarcodeFormat.EAN_8,
        ZX.BarcodeFormat.UPC_A,
        ZX.BarcodeFormat.UPC_E,
        ZX.BarcodeFormat.CODE_128,
        ZX.BarcodeFormat.CODE_39,
        ZX.BarcodeFormat.ITF,
        ZX.BarcodeFormat.QR_CODE
      ]);
    }
    const oneD = ZX.MultiFormatOneDReader ? new ZX.MultiFormatOneDReader(hints) : null;
    const qr = ZX.QRCodeReader ? new ZX.QRCodeReader() : null;
    const multi = new ZX.MultiFormatReader();
    multi.setHints(hints);
    portalZXingReaders = { multi, oneD, qr, hints };
    return portalZXingReaders;
  };

  const decodePortalGrayBuffer = (ZX, readers, grayBuf, w, h, tryQr = true) => {
    if (!ZX || !readers || !ZX.RGBLuminanceSource || w < 16 || h < 16) return null;
    try {
      const lumHist = new ZX.RGBLuminanceSource(grayBuf, w, h);
      const bmpHist = new ZX.BinaryBitmap(new ZX.GlobalHistogramBinarizer(lumHist));
      if (readers.oneD) {
        try {
          const r1 = readers.oneD.decode(bmpHist, readers.hints);
          if (r1 && r1.getText()) return String(r1.getText()).trim();
        } catch (_e1) {}
      } else {
        try {
          const r1 = readers.multi.decodeWithState(bmpHist);
          if (r1 && r1.getText()) return String(r1.getText()).trim();
        } catch (_e1) {}
      }
    } catch (_e) {}

    try {
      const lumHyb = new ZX.RGBLuminanceSource(grayBuf, w, h);
      const bmpHyb = new ZX.BinaryBitmap(new ZX.HybridBinarizer(lumHyb));
      if (readers.oneD) {
        try {
          const r2 = readers.oneD.decode(bmpHyb, readers.hints);
          if (r2 && r2.getText()) return String(r2.getText()).trim();
        } catch (_e2) {}
      }
      if (tryQr && readers.qr) {
        try {
          const rQr = readers.qr.decode(bmpHyb, readers.hints);
          if (rQr && rQr.getText()) return String(rQr.getText()).trim();
        } catch (_e3) {}
      }
    } catch (_e) {}
    return null;
  };

  const pickBestPortalDetectedCode = (codes) => {
    if (!Array.isArray(codes) || codes.length === 0) return null;
    const vals = codes
      .map((c) => (c && c.rawValue ? String(c.rawValue).trim() : ''))
      .filter(Boolean);
    if (vals.length === 0) return null;
    for (const v of vals) {
      if (/^(FM-|CF-|https?:|\{)/i.test(v)) return v;
      const hit = findArticlesByBarcodeOrQuery(v);
      if (hit && hit.exact) return v;
    }
    vals.sort((a, b) => b.length - a.length);
    return vals[0];
  };

  const decodePortalVideoFrame = async (video) => {
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
    if (!isIOSOrSafariPortal() && 'BarcodeDetector' in window && typeof window.BarcodeDetector === 'function') {
      try {
        if (!window.__portalNativeDetector) {
          window.__portalNativeDetector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'qr_code']
          });
        }
        const codes = await Promise.race([
          window.__portalNativeDetector.detect(video),
          new Promise((r) => setTimeout(() => r(null), 90))
        ]);
        const bestNative = pickBestPortalDetectedCode(codes);
        if (bestNative) {
          return bestNative;
        }
      } catch (_e) {}
    }

    const ZX = window.ZXing;
    const readers = getPortalZXingReaders();
    if (!ZX || !readers) return null;
    if (!portalZXingCanvas) {
      portalZXingCanvas = document.createElement('canvas');
    }
    const ctx = portalZXingCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const regions = [
      { x: 0.05, y: 0.26, w: 0.90, h: 0.48, maxW: 960, rot90: false },
      { x: 0.12, y: 0.18, w: 0.76, h: 0.64, maxW: 800, rot90: true },
      { x: 0.0, y: 0.0, w: 1.0, h: 1.0, maxW: 720, rot90: true }
    ];

    for (const reg of regions) {
      const sx = Math.floor(vw * reg.x);
      const sy = Math.floor(vh * reg.y);
      const sw = Math.max(32, Math.floor(vw * reg.w));
      const sh = Math.max(32, Math.floor(vh * reg.h));
      const scale = sw > reg.maxW ? reg.maxW / sw : 1;
      const dw = Math.max(32, Math.round(sw * scale));
      const dh = Math.max(32, Math.round(sh * scale));

      portalZXingCanvas.width = dw;
      portalZXingCanvas.height = dh;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);

      if ('BarcodeDetector' in window && typeof window.BarcodeDetector === 'function') {
        try {
          if (!window.__portalNativeDetector) {
            window.__portalNativeDetector = new window.BarcodeDetector({
              formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'qr_code']
            });
          }
          const nativeCodes = await Promise.race([
            window.__portalNativeDetector.detect(portalZXingCanvas),
            new Promise((r) => setTimeout(() => r(null), 60))
          ]);
          const bestCanvasNative = pickBestPortalDetectedCode(nativeCodes);
          if (bestCanvasNative) {
            return bestCanvasNative;
          }
        } catch (_e) {}
      }

      let rgba;
      try {
        rgba = ctx.getImageData(0, 0, dw, dh).data;
      } catch (_e) {
        continue;
      }

      const len = dw * dh;
      const rawGray = new Uint8ClampedArray(len);
      let minL = 255;
      let maxL = 0;
      for (let i = 0, p = 0; i < len; i++, p += 4) {
        const lum = (306 * rgba[p] + 601 * rgba[p + 1] + 117 * rgba[p + 2] + 512) >> 10;
        rawGray[i] = lum;
        if (lum < minL) minL = lum;
        if (lum > maxL) maxL = lum;
      }

      const hitRaw = decodePortalGrayBuffer(ZX, readers, rawGray, dw, dh, true);
      if (hitRaw) return hitRaw;

      const range = maxL - minL;
      let normGray = rawGray;
      if (range >= 18 && range < 245) {
        normGray = new Uint8ClampedArray(len);
        const sc = 255 / range;
        for (let i = 0; i < len; i++) {
          normGray[i] = Math.min(255, Math.max(0, Math.round((rawGray[i] - minL) * sc)));
        }
        const hitNorm = decodePortalGrayBuffer(ZX, readers, normGray, dw, dh, true);
        if (hitNorm) return hitNorm;
      }

      if (reg.rot90) {
        const rotGray = new Uint8ClampedArray(len);
        for (let y = 0; y < dh; y++) {
          const rowOff = y * dw;
          const dstCol = dh - 1 - y;
          for (let x = 0; x < dw; x++) {
            rotGray[x * dh + dstCol] = normGray[rowOff + x];
          }
        }
        const hitRot = decodePortalGrayBuffer(ZX, readers, rotGray, dh, dw, false);
        if (hitRot) return hitRot;
      }
    }
    return null;
  };

  const startPortalBarcodeScanner = async (mode) => {
    stopPortalCamera();
    const wrapId = mode === 'consultador' ? 'nx-cons-camera-wrap' : 'nx-sc-camera-wrap';
    const videoId = mode === 'consultador' ? 'nx-cons-video' : 'nx-sc-video';
    const wrap = document.getElementById(wrapId);
    const video = document.getElementById(videoId);
    if (!wrap || !video) return;

    wrap.hidden = false;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('autoplay', '');
    video.muted = true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      wrap.hidden = true;
      showToast('⚠️ Tu navegador no permite abrir la cámara en este dispositivo. Ingresá el código manualmente.');
      return;
    }

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
      } catch (_hdErr) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
          });
        } catch (_cErr) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
          });
        }
      }
      activePortalCameraStream = stream;
      video.srcObject = stream;
      await video.play().catch(() => {});

      if (!isIOSOrSafariPortal()) {
        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function' && typeof track.applyConstraints === 'function') {
          try {
            const caps = track.getCapabilities() || {};
            if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
              await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
            }
          } catch (_fErr) {}
        }
      }

      let isScanning = false;
      let pendingUnknownCode = '';
      let pendingUnknownHits = 0;
      activePortalCameraTimer = setInterval(async () => {
        if (!video || isScanning) return;
        if (video.paused && !video.ended) {
          video.play().catch(() => {});
        }
        if (video.readyState < 2 || !video.videoWidth) return;
        isScanning = true;
        try {
          const rawVal = await decodePortalVideoFrame(video);
          if (rawVal) {
            const isQrLike = /^(FM-|CF-|https?:|\{)/i.test(rawVal);
            const lookup = findArticlesByBarcodeOrQuery(rawVal);
            const isKnownCatalogHit = Boolean(lookup && lookup.exact);

            // Protección anti-desenfoque en Android: si un cuadro borroso decodifica un 1D inexistente
            // mientras el lente está enfocando (ej. botella curva), exigimos 3 lecturas idénticas antes de descartar.
            if (!isQrLike && !isKnownCatalogHit) {
              if (rawVal === pendingUnknownCode) {
                pendingUnknownHits += 1;
              } else {
                pendingUnknownCode = rawVal;
                pendingUnknownHits = 1;
              }
              if (pendingUnknownHits < 3) {
                return;
              }
            }
            pendingUnknownCode = '';
            pendingUnknownHits = 0;

            stopPortalCamera();
            if (mode === 'consultador') {
              const inp = document.getElementById('nx-cons-input');
              if (inp) inp.value = rawVal;
              renderConsultadorSection(rawVal);
            } else {
              if (lookup && lookup.exact) {
                addProductToSoyCajero(lookup.exact, lookup.scaleMeta ? lookup.scaleMeta.qtyKg : 1, lookup.scaleMeta || {});
              } else {
                showToast(`⚠️ Código "${rawVal}" no encontrado en el padrón.`);
              }
            }
          }
        } catch (_e) {} finally {
          isScanning = false;
        }
      }, 115);
    } catch (_err) {
      wrap.hidden = true;
      showToast('⚠️ No se pudo acceder a la cámara. Verificá los permisos del navegador.');
    }
  };

  // 5. SECCIÓN CONSULTA DE PUNTOS
  const buildPuntosRangeBarHtml = (totalCount, currentPage, pageSize) => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const pages = [];
    const start = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)));
    const end = Math.min(totalPages, start + 4);

    for (let p = start; p <= end; p++) {
      pages.push(
        `<button type="button" class="btn-page-num ${p === currentPage ? 'is-active' : ''}" data-puntos-page="${p}">${p}</button>`
      );
    }

    return `
      <div class="catalog-pagination">
        <button type="button" class="btn-page" data-puntos-page="${currentPage - 1}" aria-label="Página anterior" ${currentPage <= 1 ? 'disabled' : ''}>‹ Anterior</button>
        <div class="pagination-numbers">${pages.join('')}</div>
        <span class="page-indicator">Página ${currentPage} de ${totalPages.toLocaleString('es-AR')}</span>
        <button type="button" class="btn-page" data-puntos-page="${currentPage + 1}" aria-label="Página siguiente" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente ›</button>
      </div>
    `;
  };

  const renderPortalPuntosSection = () => {
    const vigEl = document.getElementById('nx-pts-kpi-vigentes');
    const acumEl = document.getElementById('nx-pts-kpi-acum');
    const canjEl = document.getElementById('nx-pts-kpi-canjeados');
    const ruleEl = document.getElementById('nx-pts-kpi-rule');
    const listEl = document.getElementById('nx-pts-movs-list');
    const pagerTop = document.getElementById('nx-pts-pager-top');
    const pagerBottom = document.getElementById('nx-pts-pager-bottom');

    const res = state.portalData?.puntosResumen || {};
    const cfg = state.portalData?.fidelizacionConfig || {};
    const vig = getActiveClientPoints();

    if (vigEl) vigEl.innerHTML = `${cfBadgeSvg(32)} <span>${vig.toLocaleString('es-AR')} pts</span>`;
    if (acumEl) acumEl.textContent = `${(Number(res.acumulados) || vig).toLocaleString('es-AR')} pts`;
    if (canjEl) canjEl.textContent = `${(Number(res.canjeados) || 0).toLocaleString('es-AR')} pts`;
    if (ruleEl) {
      ruleEl.textContent = `Puntos vigentes por ${Number(cfg.diasVencimiento) || 365} días desde cada compra`;
    }

    if (!listEl) return;
    const movs = Array.isArray(state.portalData?.movimientosFidelizacion)
      ? state.portalData.movimientosFidelizacion
      : [];

    const totalCount = movs.length;
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    if (!state.puntosPage || state.puntosPage < 1) state.puntosPage = 1;
    if (state.puntosPage > totalPages) state.puntosPage = totalPages;

    const currentPage = state.puntosPage;
    const startOffset = (currentPage - 1) * pageSize;
    const pageMovs = movs.slice(startOffset, startOffset + pageSize);

    if (totalCount === 0) {
      if (pagerTop) pagerTop.hidden = true;
      if (pagerBottom) pagerBottom.hidden = true;
      listEl.innerHTML = `
        <div style="text-align:center; padding:1.5rem; color:#71717a;">
          Aún no registrás movimientos de puntos en ${STORE_BRAND.clubName}. Presentá tu QR o DNI en Caja en tu próxima compra.
        </div>`;
      return;
    }

    const rangeBarHtml = buildPuntosRangeBarHtml(totalCount, currentPage, pageSize);
    if (pagerTop) {
      pagerTop.hidden = false;
      pagerTop.innerHTML = rangeBarHtml;
    }
    if (pagerBottom) {
      pagerBottom.hidden = totalCount <= pageSize;
      pagerBottom.innerHTML = rangeBarHtml;
    }

    listEl.innerHTML = pageMovs
      .map((m) => {
        const pts = Number(m.puntos) || 0;
        const isPositive = pts >= 0;
        const isCanje = String(m.tipo || '').toUpperCase() === 'CANJE' || pts < 0;
        const tkCode = m.nroTicketCanje || (isCanje ? `CJ-${String(m.id || 1).padStart(5, '0')}` : '');
        const isEntregado = String(m.estadoEntrega || (m.stockDescontado ? 'ENTREGADO' : 'PENDIENTE')).toUpperCase() === 'ENTREGADO';
        return `
          <div class="nx-compact-card">
            <div>
              <strong style="font-size:0.9rem; color:#18181b;">${escapeHtml(m.comprobante || m.obs || m.tipo || ('MOVIMIENTO ' + STORE_BRAND.clubUpper))}</strong>
              <div style="font-size:0.78rem; color:#71717a;">
                Fecha: ${escapeHtml(m.fechaEmision || '')} ${escapeHtml(m.hora || '')}
                ${m.fechaVencimiento && m.fechaVencimiento !== '-' ? ` · Vence: ${escapeHtml(m.fechaVencimiento)}` : ''}
                ${isCanje ? ` · <strong style="color:${isEntregado ? '#15803d' : '#b45309'};">${isEntregado ? '✅ Entregado' : '⏳ Pendiente de retiro en Supermercado'}</strong>` : ''}
              </div>
            </div>
            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:0.35rem;">
              <strong style="font-size:1.05rem; color:${isPositive ? '#15803d' : '#dc2626'};">
                ${isPositive ? '+' : ''}${pts.toLocaleString('es-AR')} pts
              </strong>
              ${
                isCanje
                  ? `<button type="button" class="btn-outline-theme" style="padding:0.22rem 0.6rem; font-size:0.74rem; font-weight:800;" data-open-canje-mov-id="${m.id}">🎫 Ver Ticket (${escapeHtml(tkCode)})</button>`
                  : ''
              }
            </div>
          </div>`;
      })
      .join('');
  };

  let activeCanjeTicketObj = null;

  const buildCanjeTicketFromMov = (mov) => {
    if (!mov) return null;
    const tkCode = String(mov.nroTicketCanje || `CJ-${String(mov.id || 1).padStart(5, '0')}`).toUpperCase();
    const allMovs = Array.isArray(state.portalData?.movimientosFidelizacion)
      ? state.portalData.movimientosFidelizacion
      : [];
    const grouped = allMovs.filter(
      (x) =>
        String(x.tipo || '').toUpperCase() === 'CANJE' &&
        (String(x.nroTicketCanje || '').toUpperCase() === tkCode || Number(x.id) === Number(mov.id))
    );
    const sourceList = grouped.length > 0 ? grouped : [mov];
    let totalPts = 0;
    const items = sourceList.map((x) => {
      const qty = Math.max(1, Number(x.cantidad) || 1);
      const ptsSub = Math.abs(Math.round(Number(x.puntos) || 0));
      totalPts += ptsSub;
      return {
        artId: Number(x.artId || x.articuloId || 0),
        artCodigo: String(x.artCodigo || x.articuloCodigo || ''),
        artNombre: String(x.artNombre || x.productoNombre || x.comprobante || 'PREMIO CLUB FIDEL'),
        cantidad: qty,
        puntosUnit: Math.round(ptsSub / qty),
        puntosSub: ptsSub
      };
    });
    const isEntregado = sourceList.every(
      (x) => String(x.estadoEntrega || (x.stockDescontado ? 'ENTREGADO' : 'PENDIENTE')).toUpperCase() === 'ENTREGADO'
    );
    return {
      nroTicketCanje: tkCode,
      fechaEmision: mov.fechaEmision || '',
      hora: mov.hora || '',
      cId: state.client?.id || mov.cId || 0,
      clienteCodigo: String(state.client?.codigo || mov.clienteCodigo || state.client?.id || '1'),
      clienteNombre: String(state.client?.nombre || mov.clienteNombre || 'SOCIO CLUB FIDEL'),
      dni: String(state.client?.nroDoc || mov.dni || ''),
      items,
      puntosTotales: totalPts,
      saldoRestante: getActiveClientPoints(),
      estadoEntrega: isEntregado ? 'ENTREGADO' : 'PENDIENTE',
      fechaEntrega: mov.fechaEntrega || ''
    };
  };

  const buildCanjeTicketHtml = (tk) => {
    if (!tk) return '';
    const tkCode = String(tk.nroTicketCanje || 'CJ-00001').toUpperCase();
    const isEntregado = String(tk.estadoEntrega || 'PENDIENTE').toUpperCase() === 'ENTREGADO';
    const cliNom = tk.clienteNombre || state.client?.nombre || 'SOCIO CLUB FIDEL';
    const cliDni = tk.dni || state.client?.nroDoc || 'S/DNI';
    const cliCod = tk.clienteCodigo || state.client?.codigo || '1';
    const items = Array.isArray(tk.items) ? tk.items : [];
    const firstCod = items[0]?.artCodigo || 'PREMIO';
    const totalQty = items.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);
    const qrPayload = `CANJE:${tkCode}|DNI:${cliDni}|COD:${firstCod}|QTY:${totalQty}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&ecc=M&margin=2&data=${encodeURIComponent(qrPayload)}`;

    const itemsRowsHtml = items
      .map(
        (it) => `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; padding:0.42rem 0; border-bottom:1px dashed #d4d4d8; font-size:0.86rem;">
          <div>
            <strong style="color:#111827;">${Number(it.cantidad) || 1}x ${escapeHtml(it.artNombre || 'PREMIO')}</strong>
            ${it.artCodigo ? `<div style="font-size:0.74rem; color:#6b7280;">Código #${escapeHtml(it.artCodigo)}</div>` : ''}
          </div>
          <strong style="color:#092837; white-space:nowrap;">-${(Number(it.puntosSub) || 0).toLocaleString('es-AR')} pts</strong>
        </div>`
      )
      .join('');

    return `
      <div id="nx-canje-ticket-printable" style="background:#ffffff; color:#111827; border:2px dashed #092837; border-radius:16px; padding:1.1rem; font-family:'Inter', system-ui, sans-serif;">
        <div style="text-align:center; border-bottom:1px dashed #cbd5e1; padding-bottom:0.75rem; margin-bottom:0.75rem;">
          <div style="font-size:0.96rem; font-weight:900; color:#092837; letter-spacing:0.02em;">${escapeHtml(STORE_BRAND.fullName || 'CASA NUEVA SUPERMERCADO')}</div>
          <div style="font-size:0.76rem; font-weight:700; color:#64748b; margin-top:0.15rem;">${escapeHtml(STORE_BRAND.clubUpper || 'CLUB FIDEL')} · CATÁLOGO DE PREMIOS</div>
          <span style="display:inline-block; margin-top:0.45rem; background:#092837; color:#4be39a; font-weight:900; font-size:0.76rem; padding:0.25rem 0.75rem; border-radius:999px; letter-spacing:0.04em;">
            TICKET DE RETIRO DE CANJE
          </span>
        </div>

        <div style="text-align:center; margin-bottom:0.75rem;">
          <div style="font-size:0.72rem; font-weight:800; color:#64748b; text-transform:uppercase;">N° de Ticket de Canje</div>
          <div style="font-family:'JetBrains Mono', monospace; font-size:1.75rem; font-weight:900; color:#111827; letter-spacing:0.06em; margin:0.15rem 0;">${escapeHtml(tkCode)}</div>
          <div style="display:inline-block; font-size:0.76rem; font-weight:800; padding:0.25rem 0.7rem; border-radius:8px; background:${isEntregado ? '#dcfce7' : '#fef3c7'}; color:${isEntregado ? '#166534' : '#92400e'};">
            ${isEntregado ? `✅ ENTREGADO EN SUPERMERCADO${tk.fechaEntrega ? ' (' + escapeHtml(tk.fechaEntrega) + ')' : ''}` : '⏳ PENDIENTE DE RETIRO EN SUPERMERCADO'}
          </div>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.65rem 0.8rem; font-size:0.81rem; margin-bottom:0.75rem; display:grid; gap:0.28rem;">
          <div style="display:flex; justify-content:space-between; gap:0.5rem;"><span style="color:#64748b;">Fecha y Hora:</span><strong>${escapeHtml(tk.fechaEmision || '')} ${escapeHtml(tk.hora || '')}</strong></div>
          <div style="display:flex; justify-content:space-between; gap:0.5rem;"><span style="color:#64748b;">Socio / Cliente:</span><strong style="text-align:right;">${escapeHtml(cliNom)}</strong></div>
          <div style="display:flex; justify-content:space-between; gap:0.5rem;"><span style="color:#64748b;">DNI / N° Socio:</span><strong>${escapeHtml(cliDni)} (#${escapeHtml(String(cliCod))})</strong></div>
        </div>

        <div style="margin-bottom:0.75rem;">
          <div style="font-size:0.75rem; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:0.25rem;">Producto(s) a retirar en el Supermercado:</div>
          ${itemsRowsHtml}
          <div style="display:flex; justify-content:space-between; align-items:center; padding-top:0.5rem; font-size:0.9rem;">
            <strong style="color:#111827;">Total Puntos Canjeados:</strong>
            <strong style="color:#dc2626; font-size:1rem;">-${(Number(tk.puntosTotales) || 0).toLocaleString('es-AR')} pts</strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:#15803d; margin-top:0.15rem;">
            <span>Saldo de puntos disponible:</span>
            <strong>${(Number(tk.saldoRestante) || 0).toLocaleString('es-AR')} pts</strong>
          </div>
        </div>

        <div style="text-align:center; margin:0.65rem 0;">
          <img src="${qrUrl}" width="145" height="145" alt="QR Ticket ${escapeHtml(tkCode)}" style="border:1px solid #e2e8f0; border-radius:10px; padding:6px; background:#ffffff;" />
        </div>

        <div style="background:#fdf8e7; border:1px solid #d4a41e; border-radius:10px; padding:0.65rem 0.8rem; text-align:center; font-size:0.8rem; color:#78350f; line-height:1.45;">
          📍 <strong>Presentá este Ticket en el Supermercado</strong> (en Caja o Atención al Cliente) para retirar tu producto de canje.
        </div>
      </div>
    `;
  };

  const openPortalCanjeTicketDialog = (ticketObj) => {
    if (!ticketObj) return;
    activeCanjeTicketObj = ticketObj;
    const dlg = document.getElementById('nx-canje-ticket-dialog');
    const stage = document.getElementById('nx-canje-ticket-stage');
    if (!dlg || !stage) return;
    stage.innerHTML = buildCanjeTicketHtml(ticketObj);
    if (typeof dlg.showModal === 'function') {
      if (!dlg.open) dlg.showModal();
    } else {
      dlg.setAttribute('open', 'open');
    }
  };

  const printPortalCanjeTicket = (ticketObj) => {
    const tk = ticketObj || activeCanjeTicketObj;
    if (!tk) return;
    const html = buildCanjeTicketHtml(tk);
    const win = window.open('', '_blank', 'width=460,height=740');
    if (!win) {
      window.print();
      return;
    }
    win.document.open();
    win.document.write(`<!DOCTYPE html>
<html lang="es-AR">
<head>
  <meta charset="UTF-8">
  <title>Ticket_Canje_${escapeHtml(tk.nroTicketCanje || 'CJ')}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { margin: 0; padding: 12px; background: #ffffff; max-width: 360px; margin-inline: auto; }
  </style>
</head>
<body>
  ${html}
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.focus(); window.print(); }, 250);
    });
  </script>
</body>
</html>`);
    win.document.close();
  };

  // 6. SECCIÓN MIS COMPRAS (Últimos 10 Comprobantes Visibles + Barra de Avance + Ver/Bajar PDF en Formato A4)
  let activeA4Comprobante = null;

  const formatNumPlain2 = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatNumPlain4 = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  const buildPortalInvoiceA4Html = (sale) => {
    if (!sale) return '';
    const cli = state.client || {};
    const p = sale.payment || {};
    const isFiscal = Boolean(sale.isFiscal);
    const letra = String(sale.letra || 'B').toUpperCase();
    const isFacturaA = letra === 'A';
    const isRecibo = /recibo/i.test(String(sale.tipoBase || sale.tipo || ''));
    const compTitle = isRecibo
      ? 'RECIBO DE PAGO'
      : isFiscal
        ? String(sale.tipoBase || 'FACTURA').toUpperCase()
        : 'COMPROBANTE INTERNO';
    const codDisplay = isFiscal ? `Cod: ${sale.codArca || '06'}` : 'INTERNO';
    const fechaOnly = String(sale.fechaHora || '').split(' ')[0] || new Date().toLocaleDateString('es-AR');

    let pv = String(sale.pv || '');
    let nroStr = sale.nro ? String(sale.nro).padStart(8, '0') : '';
    if ((!pv || !nroStr) && sale.numero) {
      const m = String(sale.numero).match(/(\d{4})-(\d{8})/);
      if (m) {
        pv = m[1];
        nroStr = m[2];
      }
    }
    if (!pv) pv = '0101';
    if (!nroStr) nroStr = String(sale.numero || '00000001');

    const rawItems =
      Array.isArray(sale.items) && sale.items.length > 0
        ? sale.items
        : [
            {
              n: `SEGÚN COMPROBANTE ${sale.tipo || 'COMPRA'} ${sale.numero || ''}`.trim(),
              qty: 1,
              ivaPct: 21,
              unitPrice: Number(sale.importe) || 0,
              subtotal: Number(sale.importe) || 0
            }
          ];

    let totalUnits = 0;
    const rowsHtml = rawItems
      .map((it) => {
        const qty = Number(it.qty ?? it.cantidad ?? 1) || 1;
        totalUnits += qty;
        const qtyFormatted = Number.isInteger(qty)
          ? String(qty)
          : qty.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
        const ivaPctStr = `${(Number(it.ivaPct ?? it.iva) || 21).toLocaleString('es-AR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })} %`;
        const unitRaw = Number(it.unitPrice ?? it.precioUnit ?? it.pu ?? (Number(it.subtotal || 0) / qty)) || 0;
        const subRaw = Number(it.subtotal ?? it.sub ?? unitRaw * qty) || 0;
        const prUnit = isFacturaA ? Number(it.unitNeto) || unitRaw / 1.21 : unitRaw;
        const importeRow = isFacturaA ? Number(it.lineNeto) || subRaw / 1.21 : subRaw;
        const descItem = it.n || it.no || it.nombre || it.descripcion || 'ARTÍCULO';
        return `
          <tr>
            <td class="a4-center" style="width:58px;">${qtyFormatted}</td>
            <td>${escapeHtml(descItem)}</td>
            <td class="a4-num" style="width:78px;">${ivaPctStr}</td>
            <td class="a4-num" style="width:105px;">${formatNumPlain4(prUnit)}</td>
            <td class="a4-num" style="width:105px;">${formatNumPlain2(importeRow)}</td>
          </tr>
        `;
      })
      .join('');

    const impTotal = Number(sale.importe) || 0;
    const totGravado = Number(sale.totalGravado) || impTotal / 1.21;
    const totIva = Number(sale.totalIva) || impTotal - totGravado;
    const subBruto = Number(sale.subTotalBruto) || impTotal;
    const subtotalCol1 = isFacturaA ? formatNumPlain2(totGravado) : formatNumPlain2(subBruto);
    const descPctStr = (Number(sale.dtoPje) || 0).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const descValStr = formatNumPlain2(Math.abs(Number(sale.dtoImp) || 0));
    const subtotalCol3 = isFacturaA ? formatNumPlain2(totGravado) : formatNumPlain2(impTotal);
    const ivaCellStr = isFacturaA ? `%21,00: $ ${formatNumPlain2(totIva)}` : `$ ${formatNumPlain2(totIva)}`;

    const cliCodPadded = String(sale.clienteCodigo || cli.codigo || cli.id || '1').padStart(6, '0');
    const cliNombre = sale.cliente || cli.nombre || 'CONSUMIDOR FINAL';
    const senoresText = `${cliNombre} ${cliCodPadded}`;
    const cliDomicilio =
      sale.clienteDomicilio ||
      [cli.calle, cli.numero ? `NRO ${cli.numero}` : ''].filter(Boolean).join(' ') ||
      'S/D';
    const cliLocalidad =
      sale.clienteLocalidad ||
      (cli.localidad ? `${cli.localidad}(${cli.provincia || 'Córdoba'})` : `${STORE_BRAND.defaultLocalidad || 'ALCIRA GIGENA'}(Córdoba)`);
    const cliTel = sale.clienteTel || cli.celular || cli.telefono || '';
    const cliDoc = sale.clienteDoc || cli.nroDoc || '00.000.000';
    const cliRespIva = sale.clienteRespIva || cli.respIva || 'Consumidor Final';
    const cliIibb = sale.clienteIibb || cli.nroIibb || '';
    const condVenta =
      p.method === 'ctacte' || /corriente/i.test(String(sale.medioPago || ''))
        ? 'Cuenta Corriente'
        : sale.medioPago
          ? `Contado (${sale.medioPago})`
          : 'Contado';

    const isPendingArca = isFiscal && (sale.estadoArca === 'pendiente' || !sale.cae);
    const arcaBlockHtml = isFiscal
      ? isPendingArca
        ? `
          <div class="a4-arca-row">
            <div></div>
            <div class="a4-arca-box" style="text-align:center; padding:10px; border-style:dashed;">
              <strong>COMPROBANTE ELECTRÓNICO PENDIENTE DE EMISIÓN EN ARCA</strong><br>
              <span style="font-size:9.5px;">Comprobante fiscal en proceso de validación de C.A.E.</span>
            </div>
          </div>
        `
        : `
          <div class="a4-arca-row">
            <div></div>
            <div class="a4-arca-box">
              <div class="a4-arca-inner">
                ${sale.qrImgSrc ? `<img src="${escapeHtml(sale.qrImgSrc)}" alt="QR Oficial ARCA" class="a4-arca-qr">` : ''}
                <div>
                  <div class="a4-arca-brand">ARCA</div>
                  <div class="a4-arca-sub">AGENCIA DE RECAUDACIÓN<br>Y CONTROL ADUANERO</div>
                  <div class="a4-arca-auth">Comprobante Autorizado</div>
                  <div class="a4-arca-cae">C.A.E.: ${escapeHtml(sale.cae || '')} - Vencimiento: ${escapeHtml(sale.caeVto || '')}</div>
                </div>
              </div>
              <div class="a4-arca-disclaimer">
                Esta agencia no se responsabiliza por los datos ingresados en el detalle de la operación
              </div>
            </div>
          </div>
        `
      : '';

    const footerLine =
      p.footerValoresLine ||
      `${p.cajaDiariaLabel || sale.origen || 'CAJA POS'} ${sale.medioPago || 'Contado'}: $ ${formatNumPlain2(impTotal)} -`;

    return `
      <div class="invoice-a4-sheet" id="nx-active-a4-sheet">
        <div>
          <div class="a4-header-grid">
            <div class="a4-header-left">
              <div class="a4-logo-wrap">
                <img src="${STORE_BRAND.isPaseoAlberdi ? '../sistema/assets/img/paseo-alberdi/logo-horizontal.png' : '../sistema/assets/img/logo-full.png?v=75'}" alt="${STORE_BRAND.fullName}" class="a4-logo-img" crossorigin="anonymous">
              </div>
              <div class="a4-emisor-info">
                ${STORE_BRAND.isPaseoAlberdi ? '' : '<div style="font-weight:400;">BIANCHI MARIA ESTHER</div>'}
                <strong>${STORE_BRAND.isPaseoAlberdi ? 'PASEO ALBERDI SUPERMERCADO' : 'CASA NUEVA SUPER'}</strong>
                ${STORE_BRAND.isPaseoAlberdi ? '<div style="font-weight:400; font-size:10.5px;">Ignacio Pirovano 193, Barrio Alberdi, Río Cuarto</div><div style="font-weight:400; font-size:10.5px;">WhatsApp: +54 9 3584 29-2027</div>' : ''}
              </div>
            </div>

            <div class="a4-header-center">
              <div class="a4-letra-square">${escapeHtml(letra)}</div>
              <div class="a4-letra-cod">${escapeHtml(codDisplay)}</div>
              <div class="a4-center-vline"></div>
            </div>

            <div class="a4-header-right">
              <div class="a4-comp-top">
                <div class="a4-comp-title">${escapeHtml(compTitle)}</div>
                <div class="a4-comp-nro"><strong>NRO.</strong> ${escapeHtml(pv)} - ${escapeHtml(nroStr)}</div>
                <div class="a4-comp-fecha"><strong>FECHA</strong> ${escapeHtml(fechaOnly)}</div>
              </div>
              <div class="a4-fiscal-meta">
                <div>
                  <div>Nº CUIT: ${STORE_BRAND.isPaseoAlberdi ? 'A CONFIGURAR' : '27-05457050-9'}</div>
                  <div>Resp. IVA: Inscripto</div>
                  <div>Nro. IIBB: ${STORE_BRAND.isPaseoAlberdi ? '—' : '288462551'}</div>
                  <div>Inicio de Actividades: ${STORE_BRAND.isPaseoAlberdi ? '—' : '02/03/2026'}</div>
                </div>
                <div class="a4-page-badge">
                  <div>ORIGINAL</div>
                  <div style="font-size:12px;">Hoja 1 de 1</div>
                </div>
              </div>
            </div>
          </div>

          <div class="a4-client-box">
            <div class="a4-client-row a4-client-row--full">
              <div><span class="a4-lbl">SEÑOR/ES</span> ${escapeHtml(senoresText)}</div>
            </div>
            <div class="a4-client-row">
              <div><span class="a4-lbl">DOMICILIO</span> ${escapeHtml(cliDomicilio)}</div>
              <div><span class="a4-lbl">LOCALIDAD</span> ${escapeHtml(cliLocalidad)}</div>
            </div>
            <div class="a4-client-row">
              <div><span class="a4-lbl">TEL.</span> ${escapeHtml(cliTel)}</div>
              <div><span class="a4-lbl">C.U.I.T. Nº</span> ${escapeHtml(cliDoc)}</div>
            </div>
            <div class="a4-client-row">
              <div><span class="a4-lbl">CONDICION IVA</span> ${escapeHtml(cliRespIva)}</div>
              <div><span class="a4-lbl">IIBB Nº</span> ${escapeHtml(cliIibb)}</div>
            </div>
            <div class="a4-client-row a4-client-row--full">
              <div><span class="a4-lbl">CONDICION DE VENTA</span> ${escapeHtml(condVenta)}</div>
            </div>
          </div>

          <table class="a4-items-table">
            <thead>
              <tr>
                <th class="a4-center" style="width:58px;">CANT.</th>
                <th>DESCRIPCION</th>
                <th class="a4-num" style="width:78px;">% IVA</th>
                <th class="a4-num" style="width:105px;">PR. UNIT.</th>
                <th class="a4-num" style="width:105px;">IMPORTE</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <div class="a4-bottom-block">
          <div class="a4-total-qty-line">Cantidad total de artículos: ${
            Number.isInteger(totalUnits) ? totalUnits : totalUnits.toLocaleString('es-AR')
          }.</div>

          <table class="a4-totals-table">
            <thead>
              <tr>
                <th>SUBTOTAL</th>
                <th>DESC. %${descPctStr}</th>
                <th>SUBTOTAL</th>
                <th>I.V.A. INSC.</th>
                <th>Imp. Interno</th>
                <th>Perc. IIBB</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${subtotalCol1}</td>
                <td>${descValStr}</td>
                <td>${subtotalCol3}</td>
                <td>${ivaCellStr}</td>
                <td>0,00</td>
                <td>0,00% &nbsp; 0,00</td>
                <td class="a4-grand-total-cell">${formatNumPlain2(impTotal)}</td>
              </tr>
            </tbody>
          </table>

          ${arcaBlockHtml}

          <div class="a4-caja-footer-box">
            ${escapeHtml(footerLine)}
            ${p.observaciones ? `<div style="margin-top:2px; font-size:9.5px;">Obs: ${escapeHtml(p.observaciones)}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  };

  const buildPortalTicket78mmHtml = (sale) => {
    if (!sale) return '';
    const cli = state.client || {};
    const p = sale.payment || {};
    const isRetiro = sale.entryType === 'retiro' || p.method === 'retiro_efectivo';
    const isCompensacion = Boolean(sale.esCompensacion || p.method === 'compensacion');
    const isRecibo =
      isCompensacion ||
      sale.entryType === 'recibo' ||
      Boolean(p.isRecibo) ||
      /recibo/i.test(String(sale.tipoBase || sale.tipo || ''));
    const isFiscal = Boolean(sale.isFiscal);
    const letra = String(sale.letra || 'B').toUpperCase();
    const isFacturaA = letra === 'A' && isFiscal;
    const compHeader = isRetiro
      ? 'TICKET DE RETIRO DE EFECTIVO'
      : isCompensacion
        ? String(sale.tipo || 'RECIBO POR COMPENSACIÓN DE SALDOS').toUpperCase()
        : isRecibo
          ? 'RECIBO DE PAGO'
          : isFiscal
            ? `${String(sale.tipoBase || 'FACTURA').toUpperCase()} "${letra}" (Cód. ${sale.codArca || '06'})`
            : `COMPROBANTE INTERNO "${letra}"`;

    let pv = String(sale.pv || '');
    let nroStr = sale.nro ? String(sale.nro).padStart(8, '0') : '';
    if ((!pv || !nroStr) && sale.numero) {
      const m = String(sale.numero).match(/(\d{4})-(\d{8})/);
      if (m) {
        pv = m[1];
        nroStr = m[2];
      }
    }
    if (!pv) pv = '0101';
    if (!nroStr) nroStr = String(sale.numero || '00000001').padStart(8, '0');
    const fechaHoraStr = String(sale.fechaHora || '') || new Date().toLocaleDateString('es-AR');

    const rawItems =
      Array.isArray(sale.items) && sale.items.length > 0
        ? sale.items
        : [
            {
              n: `SEGÚN COMPROBANTE ${sale.tipo || 'COMPRA'} ${sale.numero || ''}`.trim(),
              qty: 1,
              ivaPct: 21,
              unitPrice: Number(sale.importe) || 0,
              subtotal: Number(sale.importe) || 0
            }
          ];

    const itemsHtml = rawItems
      .map((it) => {
        const qty = Number(it.qty ?? it.cantidad ?? 1) || 1;
        const qtyStr = Number.isInteger(qty) ? String(qty) : qty.toFixed(3);
        const unitRaw = Number(it.unitPrice ?? it.precioUnit ?? it.pu ?? (Number(it.subtotal || 0) / qty)) || 0;
        const subRaw = Number(it.subtotal ?? it.sub ?? unitRaw * qty) || 0;
        const unitDisplay = isFacturaA
          ? formatNumPlain2(Number(it.unitNeto) || unitRaw / 1.21)
          : formatNumPlain2(unitRaw);
        const lineDisplay = isFacturaA
          ? formatNumPlain2(Number(it.lineNeto) || subRaw / 1.21)
          : formatNumPlain2(subRaw);
        const descText = it.n || it.no || it.nombre || it.descripcion || 'CONCEPTO';
        const ivaVal = it.ivaPct !== undefined ? Number(it.ivaPct) : it.iva !== undefined ? Number(it.iva) : 21;
        return `
          <div class="t78-item">
            <div class="t78-item-desc">${escapeHtml(descText)}</div>
            <div class="t78-row">
              <span>${qtyStr} x $ ${unitDisplay}${isRetiro ? '' : ` (${ivaVal.toFixed(1)}%)`}</span>
              <span class="t78-bold">$ ${lineDisplay}</span>
            </div>
          </div>
        `;
      })
      .join('');

    const impTotal = Number(sale.importe) || 0;
    const totGravado = Number(sale.totalGravado) || impTotal / 1.21;
    const totIva = Number(sale.totalIva) || impTotal - totGravado;

    let payLinesHtml = '';
    if (isRetiro) {
      payLinesHtml = `
        <div class="t78-row"><span>Operación:</span><span class="t78-bold">RETIRO DE EFECTIVO</span></div>
        <div class="t78-row"><span>Cajero:</span><span class="t78-bold">${escapeHtml(sale.usuario || '')}</span></div>
      `;
    } else if (isCompensacion) {
      payLinesHtml = `
        <div class="t78-row"><span>Modalidad:</span><span class="t78-bold">COMPENSACIÓN DE SALDOS</span></div>
        <div class="t78-row"><span>Cruce:</span><span>CLIENTE ↔ PROVEEDOR (DEUDA MÁS VIEJA)</span></div>
        ${p.totalOpenDebeBefore !== undefined ? `<div class="t78-row"><span>Deuda Cliente (Antes → Ahora):</span><span>$ ${formatNumPlain2(p.totalOpenDebeBefore)} → $ ${formatNumPlain2(p.totalOpenDebeAfter || 0)}</span></div>` : ''}
        ${p.totalOpenHaberBefore !== undefined ? `<div class="t78-row"><span>Crédito Prov. (Antes → Ahora):</span><span>$ ${formatNumPlain2(p.totalOpenHaberBefore)} → $ ${formatNumPlain2(p.totalOpenHaberAfter || 0)}</span></div>` : ''}
        <div class="t78-row"><span>Saldo Neto Actual Cta. Cte.:</span><span class="t78-bold">$ ${formatNumPlain2(p.nuevoSaldoRestante ?? 0)}</span></div>
      `;
    } else if (p.method === 'efectivo') {
      payLinesHtml = `
        <div class="t78-row"><span>Medio de Pago:</span><span class="t78-bold">EFECTIVO</span></div>
        <div class="t78-row"><span>Efectivo Recibido:</span><span>$ ${formatNumPlain2(p.efectivoRecibido || impTotal)}</span></div>
        <div class="t78-row"><span>Vuelto Entregado:</span><span class="t78-bold">$ ${formatNumPlain2(p.vuelto || 0)}</span></div>
      `;
    } else if (p.method === 'combinado') {
      payLinesHtml = `
        <div class="t78-row"><span>Efectivo:</span><span>$ ${formatNumPlain2(p.efectivoAplicado || 0)}</span></div>
        <div class="t78-row"><span>${escapeHtml(p.electronicoTipo || 'Posnet')} (${escapeHtml(p.posnet || '')}):</span><span>$ ${formatNumPlain2(p.electronicoImporte || 0)}</span></div>
        ${p.mpPaymentId ? `<div class="t78-row"><span>Op. Mercado Pago:</span><span>#${escapeHtml(String(p.mpPaymentId))}</span></div>` : ''}
      `;
    } else if (p.method === 'ctacte' || /corriente/i.test(String(sale.medioPago || ''))) {
      payLinesHtml = `<div class="t78-row"><span>Medio de Pago:</span><span class="t78-bold">CUENTA CORRIENTE</span></div>`;
    } else if (p.method === 'transferencia') {
      const bankTxt = p.cuentaBancariaLabel || p.cuentaBancariaBanco || '';
      payLinesHtml = `
        <div class="t78-row"><span>Medio de Pago:</span><span class="t78-bold">TRANSFERENCIA BANCARIA</span></div>
        ${bankTxt ? `<div class="t78-row"><span>Cuenta Destino:</span><span class="t78-bold">${escapeHtml(bankTxt.toUpperCase())}</span></div>` : ''}
      `;
    } else {
      const medioTxt = (p.electronicoTipo || sale.medioPago || 'CONTADO').toUpperCase();
      payLinesHtml = `
        <div class="t78-row"><span>Medio de Pago:</span><span class="t78-bold">${escapeHtml(medioTxt)}</span></div>
        ${p.posnet ? `<div class="t78-row"><span>Posnet Destino:</span><span class="t78-bold">${escapeHtml(String(p.posnet).toUpperCase())}</span></div>` : ''}
        ${p.mpPaymentId ? `<div class="t78-row"><span>Op. Mercado Pago:</span><span>#${escapeHtml(String(p.mpPaymentId))}</span></div>` : ''}
      `;
    }

    const fiscalTotalsHtml = isRetiro
      ? ''
      : isFacturaA
        ? `
          <div class="t78-row"><span>SUBTOTAL NETO:</span><span>$ ${formatNumPlain2(totGravado)}</span></div>
          <div class="t78-row"><span>IVA 21,00%:</span><span>$ ${formatNumPlain2(totIva)}</span></div>
        `
        : `
          <div class="t78-row" style="font-size:10px;"><span>IVA Contenido (Ley 27.743):</span><span>$ ${formatNumPlain2(totIva)}</span></div>
        `;

    const isPendingArca = isFiscal && (sale.estadoArca === 'pendiente' || !sale.cae);
    const arcaFooterHtml = isFiscal
      ? isPendingArca
        ? `
          <div class="t78-divider"></div>
          <div class="t78-center" style="border:1px dashed #000; padding:4px; margin:2px 0;">
            <div class="t78-bold" style="font-size:10.5px;">COMPROBANTE PENDIENTE DE EMISIÓN EN ARCA</div>
            <div style="font-size:9.5px;">Contingencia por caída temporal del servicio ARCA · CAE pendiente</div>
          </div>
        `
        : `
          <div class="t78-divider"></div>
          <div class="t78-qr-box">
            ${sale.qrImgSrc ? `<img src="${escapeHtml(sale.qrImgSrc)}" alt="QR Oficial ARCA">` : ''}
            <div class="t78-bold" style="font-size:12px;">ARCA · Comprobante Autorizado</div>
            <div style="font-size:10px;">C.A.E.: ${escapeHtml(sale.cae || '')}</div>
            <div style="font-size:10px;">Vencimiento C.A.E.: ${escapeHtml(sale.caeVto || '')}</div>
          </div>
        `
      : `
        <div class="t78-divider"></div>
        <div class="t78-center" style="font-size:10px;">${isRetiro ? 'COMPROBANTE INTERNO DE RETIRO DE CAJA' : 'DOCUMENTO NO VÁLIDO COMO FACTURA'}</div>
      `;

    const bottomGreetingHtml = isRetiro
      ? `
        <div style="margin-top:8mm; border-top:1px dotted #000; padding-top:1.5mm; text-align:center; font-size:10px;">
          FIRMA Y ACLARACIÓN RECEPTOR
        </div>
      `
      : `<div class="t78-center t78-bold" style="font-size:10.5px;">¡MUCHAS GRACIAS POR SU COMPRA!</div>`;

    const cliNombre = sale.cliente || cli.nombre || 'CONSUMIDOR FINAL';
    const cliDoc = sale.clienteDoc || cli.nroDoc || '00.000.000';
    const cliRespIva = sale.clienteRespIva || cli.respIva || 'Consumidor Final';

    return `
      <div class="ticket-78mm-sheet" id="nx-active-ticket-78mm-sheet">
        <div class="t78-center">
          <img src="${STORE_BRAND.isPaseoAlberdi ? '../sistema/assets/img/paseo-alberdi/logo-horizontal.png' : '../sistema/assets/img/logo-full.png?v=75'}" alt="${STORE_BRAND.fullName}" class="t78-logo" crossorigin="anonymous">
          ${STORE_BRAND.isPaseoAlberdi ? '' : '<div style="font-size:12px; font-weight:400;">BIANCHI MARIA ESTHER</div>'}
          <div class="t78-bold" style="font-size:13px;">${STORE_BRAND.isPaseoAlberdi ? 'PASEO ALBERDI SUPERMERCADO' : 'CASA NUEVA SUPER'}</div>
          ${STORE_BRAND.isPaseoAlberdi ? '' : '<div style="font-size:10.5px;">CUIT: 27-05457050-9 · IIBB: 288462551</div>'}
          <div style="font-size:10.5px;">IVA Responsable Inscripto</div>
          ${STORE_BRAND.isPaseoAlberdi ? '<div style="font-size:10px;">Ignacio Pirovano 193 · Barrio Alberdi · Río Cuarto</div><div style="font-size:10px;">WhatsApp: +54 9 3584 29-2027</div>' : '<div style="font-size:10px;">Inicio Act.: 02/03/2026 · Alcira Gigena (Cba)</div>'}
        </div>

        <div class="t78-divider"></div>

        <div class="t78-center t78-bold" style="font-size:12px;">${escapeHtml(compHeader)}</div>
        <div class="t78-row" style="margin-top:1mm;">
          <span>NRO: <strong>${escapeHtml(pv)}-${escapeHtml(nroStr)}</strong></span>
          <span>${escapeHtml(fechaHoraStr)}</span>
        </div>

        <div class="t78-divider"></div>

        <div style="font-size:10.5px;">
          <div><strong>${isRetiro ? 'DESTINATARIO' : 'CLIENTE'}:</strong> ${escapeHtml(cliNombre)}</div>
          <div><strong>DOC/CUIT:</strong> ${escapeHtml(cliDoc)} · <strong>IVA:</strong> ${escapeHtml(cliRespIva)}</div>
        </div>

        <div class="t78-divider"></div>

        ${itemsHtml}

        ${Number(sale.dtoImp) !== 0 ? `<div class="t78-row"><span>Dto./Rec. (${Number(sale.dtoPje || 0).toFixed(2)}%):</span><span>$ ${formatNumPlain2(sale.dtoImp)}</span></div>` : ''}
        ${fiscalTotalsHtml}

        <div class="t78-row t78-total-box">
          <span>${isRetiro ? 'IMPORTE RETIRADO' : 'TOTAL'}</span>
          <span>$ ${formatNumPlain2(impTotal)}</span>
        </div>

        <div style="font-size:10.5px;">
          ${payLinesHtml}
          ${p.observaciones ? `<div style="margin-top:1mm;">Obs: ${escapeHtml(p.observaciones)}</div>` : ''}
          <div style="margin-top:1.5mm; font-size:9.5px;">${escapeHtml(p.cajaDiariaLabel || sale.origen || 'CAJA DIARIA 1')}</div>
        </div>

        ${arcaFooterHtml}

        <div class="t78-divider"></div>
        ${bottomGreetingHtml}
        <div class="t78-cutter-feed" aria-hidden="true">. . . . . . . . . . . . . . . .</div>
      </div>
    `;
  };

  const openPortalComprobanteA4Dialog = (comp) => {
    if (!comp) return;
    activeA4Comprobante = comp;
    const dlg = document.getElementById('nx-comprobante-a4-dialog');
    const stage = document.getElementById('nx-a4-preview-stage');
    if (!dlg || !stage) return;

    stage.innerHTML = buildPortalTicket78mmHtml(comp);
    if (typeof dlg.showModal === 'function') {
      if (!dlg.open) {
        dlg.showModal();
      }
    } else {
      dlg.setAttribute('open', 'open');
    }
    const bodyEl = dlg.querySelector('.nx-a4-dialog-body');
    if (bodyEl) bodyEl.scrollTop = 0;
    stage.scrollTop = 0;
  };

  const printPortalComprobanteA4 = (comp) => {
    const targetComp = comp || activeA4Comprobante;
    if (!targetComp) return;
    const a4Html = buildPortalInvoiceA4Html(targetComp);
    const stylesHref =
      document.querySelector('link[href*="assets/css/carrito.css"]')?.href || 'assets/css/carrito.css';
    const baseHref = window.location.href.replace(/[^/]*$/, '');
    const printWin = window.open('', '_blank', 'width=920,height=800');
    if (!printWin) {
      window.print();
      return;
    }
    printWin.document.open();
    printWin.document.write(`<!DOCTYPE html>
      <html lang="es-AR">
      <head>
        <meta charset="UTF-8">
        <base href="${baseHref}">
        <title>Comprobante_${escapeHtml(String(targetComp.numero || 'A4').replace(/\s+/g, '_'))}</title>
        <link rel="stylesheet" href="${stylesHref}">
        <style>
          @page { size: A4 portrait; margin: 6mm; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .invoice-a4-sheet {
            box-shadow: none !important;
            margin: 0 auto !important;
            width: 198mm !important;
            min-height: 278mm !important;
          }
        </style>
      </head>
      <body>
        ${a4Html}
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 250);
          });
        </script>
      </body>
      </html>`);
    printWin.document.close();
  };

  const downloadPortalComprobanteA4Pdf = async (comp) => {
    const targetComp = comp || activeA4Comprobante;
    if (!targetComp) return;

    const cleanNum = String(targetComp.numero || 'Comprobante')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_');
    const fileName = `Comprobante_A4_${cleanNum}.pdf`;

    if (typeof window.html2pdf === 'function') {
      try {
        showToast('📄 Generando comprobante PDF en Formato A4...');
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '794px';
        tempContainer.style.minWidth = '794px';
        tempContainer.style.maxWidth = 'none';
        tempContainer.style.background = '#ffffff';
        tempContainer.innerHTML = buildPortalInvoiceA4Html(targetComp);
        const sheetEl = tempContainer.querySelector('.invoice-a4-sheet');
        if (sheetEl) {
          sheetEl.style.boxShadow = 'none';
          sheetEl.style.margin = '0';
          sheetEl.style.width = '794px';
          sheetEl.style.minWidth = '794px';
          sheetEl.style.maxWidth = 'none';
        }
        document.body.appendChild(tempContainer);

        const opt = {
          margin: [4, 4, 4, 4],
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 794, windowWidth: 1024 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        await window.html2pdf().set(opt).from(sheetEl || tempContainer).save();
        document.body.removeChild(tempContainer);
        showToast(`✅ PDF Formato A4 descargado (${fileName}).`);
        return;
      } catch (err) {
        console.warn('Fallback a impresión A4 PDF:', err);
      }
    }

    // Fallback directo a ventana A4 lista para Guardar como PDF
    printPortalComprobanteA4(targetComp);
  };

  const formatShortComprobanteTitle = (comp) => {
    const rawTipo = String(comp?.tipo || '').toUpperCase().trim();
    const rawNum = String(comp?.numero || '').toUpperCase().trim();
    const combined = `${rawTipo} ${rawNum}`;

    const numMatch = rawNum.match(/(\d{3,5}\s*-\s*\d{4,10})/);
    const cleanNum = numMatch
      ? numMatch[1].replace(/\s+/g, '')
      : rawNum
          .replace(/^(COMPROBANTE\s+INTERNO|FACTURA|NOTA\s+DE\s+CR[EÉ]DITO|RECIBO|FA|FB|FC|CI|NC|NCA|NCB)\b\s*/i, '')
          .replace(/^[ABX]\b\s*/i, '')
          .trim();

    let prefix = 'CI';
    if (
      rawTipo.includes('INTERNO') ||
      /^CI\b/.test(rawNum) ||
      /^CI\b/.test(rawTipo) ||
      /\b0101-\d+/.test(cleanNum)
    ) {
      prefix = 'CI';
    } else if (rawTipo.includes('CRÉDITO') || rawTipo.includes('CREDITO') || /^NC/.test(rawNum)) {
      prefix = /\bA\b/.test(combined) ? 'NCA' : 'NCB';
    } else if (rawTipo.includes('RECIBO')) {
      prefix = 'REC';
    } else if (
      rawTipo.includes('FACTURA A') ||
      /\bFA\s+A\b/.test(combined) ||
      (/^FA\b/.test(rawNum) && !/\bB\b/.test(rawNum)) ||
      /\bFACTURA\b.*\bA\b/.test(combined)
    ) {
      prefix = 'FA';
    } else if (
      rawTipo.includes('FACTURA B') ||
      rawTipo.includes('FACTURA') ||
      /\bFA\s+B\b/.test(combined) ||
      /^FB\b/.test(rawNum)
    ) {
      prefix = 'FB';
    }

    return cleanNum ? `${prefix} ${cleanNum}` : prefix;
  };

  const buildComprasRangeBarHtml = (totalCount, currentPage, pageSize) => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const pages = [];
    const start = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)));
    const end = Math.min(totalPages, start + 4);

    for (let p = start; p <= end; p++) {
      pages.push(
        `<button type="button" class="btn-page-num ${p === currentPage ? 'is-active' : ''}" data-compras-page="${p}">${p}</button>`
      );
    }

    return `
      <div class="catalog-pagination">
        <button type="button" class="btn-page" data-compras-page="${currentPage - 1}" aria-label="Página anterior" ${currentPage <= 1 ? 'disabled' : ''}>‹ Anterior</button>
        <div class="pagination-numbers">${pages.join('')}</div>
        <span class="page-indicator">Página ${currentPage} de ${totalPages.toLocaleString('es-AR')}</span>
        <button type="button" class="btn-page" data-compras-page="${currentPage + 1}" aria-label="Página siguiente" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente ›</button>
      </div>
    `;
  };

  const renderPortalComprasSection = () => {
    const listEl = document.getElementById('nx-compras-list');
    const badgeEl = document.getElementById('nx-compras-counter-badge');
    const pagerTop = document.getElementById('nx-compras-pager-top');
    const pagerBottom = document.getElementById('nx-compras-pager-bottom');
    if (!listEl) return;

    const allCompras = Array.isArray(state.portalData?.misCompras) ? state.portalData.misCompras : [];
    const totalCount = allCompras.length;
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    if (!state.comprasPage || state.comprasPage < 1) state.comprasPage = 1;
    if (state.comprasPage > totalPages) state.comprasPage = totalPages;

    const currentPage = state.comprasPage;
    const startOffset = (currentPage - 1) * pageSize;
    const pageCompras = allCompras.slice(startOffset, startOffset + pageSize);

    if (badgeEl) {
      badgeEl.textContent =
        totalCount > 0
          ? `${totalCount} comprobante(s) histórico(s)`
          : 'Sin comprobantes';
    }

    if (totalCount === 0) {
      if (pagerTop) pagerTop.hidden = true;
      if (pagerBottom) pagerBottom.hidden = true;
      listEl.innerHTML = `
        <div style="text-align:center; padding:1.75rem 1rem; color:#71717a;">
          Todavía no se registran comprobantes emitidos asociados a tu cuenta.
        </div>`;
      return;
    }

    const rangeBarHtml = buildComprasRangeBarHtml(totalCount, currentPage, pageSize);
    if (pagerTop) {
      pagerTop.hidden = false;
      pagerTop.innerHTML = rangeBarHtml;
    }
    if (pagerBottom) {
      pagerBottom.hidden = totalCount <= pageSize;
      pagerBottom.innerHTML = rangeBarHtml;
    }

    listEl.innerHTML = pageCompras
      .map((c, idx) => {
        const globalIdx = startOffset + idx;
        const shortLabel = formatShortComprobanteTitle(c);

        return `
          <div class="nx-compact-card nx-compra-row">
            <div class="nx-compra-row-main">
              <strong class="nx-compra-short-code">${escapeHtml(shortLabel)}</strong>
              <span class="nx-compra-date">📅 ${escapeHtml(c.fechaHora || '')}</span>
            </div>
            <div class="nx-compra-row-right">
              <strong class="nx-compra-amount">${formatArs(c.importe)}</strong>
              <div class="nx-compra-card-actions">
                <button type="button" class="btn-compra-a4-view" data-ver-a4-idx="${globalIdx}" title="Previsualizar comprobante en Formato A4">
                  👁️ Ver A4
                </button>
              </div>
            </div>
          </div>`;
      })
      .join('');
  };

  // 7. SECCIÓN CATÁLOGO DE PREMIOS (Carrito de Premios Fidelización)
  const renderPortalPremiosSection = () => {
    const ptsEl = document.getElementById('nx-premios-user-pts');
    const summaryEl = document.getElementById('nx-premios-cart-count');
    const btnRedeem = document.getElementById('nx-premios-btn-redeem');
    const cartBox = document.getElementById('nx-premios-cart-box');
    const gridEl = document.getElementById('nx-premios-grid');
    const searchQ = (document.getElementById('nx-premios-search')?.value || '').trim().toUpperCase();

    const userPts = getActiveClientPoints();

    // Garantizar que el carrito de premios nunca retenga productos si no alcanzan los puntos disponibles
    let runningPts = 0;
    const validCart = [];
    for (const item of state.premiosCart) {
      const unit = Math.max(1, Number(item.puntosUnit) || 0);
      const maxAffordableQty = Math.floor(Math.max(0, userPts - runningPts) / unit);
      const keepQty = Math.min(Number(item.cantidad) || 0, maxAffordableQty);
      if (keepQty > 0) {
        validCart.push({ ...item, cantidad: keepQty, puntosUnit: unit });
        runningPts += keepQty * unit;
      }
    }
    state.premiosCart = validCart;

    const cartTotalPts = state.premiosCart.reduce((acc, it) => acc + it.cantidad * it.puntosUnit, 0);
    const cartTotalQty = state.premiosCart.reduce((acc, it) => acc + it.cantidad, 0);
    const availablePts = Math.max(0, userPts - cartTotalPts);

    if (ptsEl) {
      ptsEl.innerHTML =
        cartTotalPts > 0
          ? `${cfBadgeSvg(28)} ${availablePts.toLocaleString('es-AR')} pts disponibles (Total: ${userPts.toLocaleString('es-AR')} pts)`
          : `${cfBadgeSvg(28)} ${userPts.toLocaleString('es-AR')} pts`;
    }

    if (summaryEl) {
      summaryEl.textContent = `${cartTotalQty} premio(s) en carrito (${cartTotalPts.toLocaleString('es-AR')} pts requeridos)`;
    }
    if (btnRedeem) {
      btnRedeem.disabled = cartTotalQty === 0 || cartTotalPts > userPts || userPts <= 0;
    }

    if (cartBox) {
      if (state.premiosCart.length === 0) {
        cartBox.hidden = true;
      } else {
        cartBox.hidden = false;
        cartBox.innerHTML =
          `<div style="font-weight:800; font-size:0.84rem; margin-bottom:0.45rem; color:#18181b;">🎁 Tu Carrito de Premios Seleccionados:</div>` +
          state.premiosCart
            .map(
              (it, idx) => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:0.35rem 0; border-bottom:1px solid #e2e8f0; font-size:0.85rem;">
                <span><strong>${it.cantidad}x</strong> ${escapeHtml(it.artNombre)}</span>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <strong style="color:#092837; display:inline-flex; align-items:center; gap:0.28rem;">${cfBadgeSvg(16)} ${(it.cantidad * it.puntosUnit).toLocaleString('es-AR')} pts</strong>
                  <button type="button" class="btn-ghost-danger" style="padding:0.15rem 0.45rem; font-size:0.74rem;" data-premio-del="${idx}">✕</button>
                </div>
              </div>`
            )
            .join('');
      }
    }

    const myTicketsBox = document.getElementById('nx-premios-my-tickets-box');
    if (myTicketsBox) {
      const movs = Array.isArray(state.portalData?.fidelizacionMovs) ? state.portalData.fidelizacionMovs : [];
      const canjeMovs = movs.filter((m) => String(m.tipo || '').toUpperCase() === 'CANJE').slice(0, 8);
      if (canjeMovs.length === 0) {
        myTicketsBox.hidden = true;
      } else {
        myTicketsBox.hidden = false;
        myTicketsBox.innerHTML =
          `<div style="font-weight:900; font-size:0.84rem; margin-bottom:0.45rem; color:#092837; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.4rem;">
            <span>🎫 Tus Tickets de Canje para Retirar en el Supermercado:</span>
            <span style="font-size:0.75rem; font-weight:700; color:#64748b;">Presentá el ticket en Caja o Atención al Cliente</span>
          </div>` +
          canjeMovs
            .map((m, idx) => {
              const tk = buildCanjeTicketFromMov(m, idx);
              const isDelivered = tk.estadoEntrega === 'ENTREGADO';
              const badge = isDelivered
                ? `<span style="font-size:0.7rem; font-weight:800; color:#166534; background:#dcfce7; border:1px solid #86efac; padding:0.1rem 0.45rem; border-radius:999px;">✅ ENTREGADO</span>`
                : `<span style="font-size:0.7rem; font-weight:800; color:#92400e; background:#fef3c7; border:1px solid #fde68a; padding:0.1rem 0.45rem; border-radius:999px;">⏳ PENDIENTE DE RETIRO</span>`;
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.6rem; padding:0.42rem 0; border-bottom:1px solid #e2e8f0; font-size:0.84rem; flex-wrap:wrap;">
                  <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
                    <strong style="font-family:monospace; color:#092837; background:#e0f2fe; padding:0.12rem 0.45rem; border-radius:6px;">${escapeHtml(tk.nroTicket)}</strong>
                    <span><strong>${Number(m.cantidad || 1)}x</strong> ${escapeHtml(m.artNombre || m.motivo || 'Premio')}</span>
                    ${badge}
                  </div>
                  <button type="button" data-open-canje-mov-id="${escapeHtml(String(m.id || ''))}" style="border:1px solid #b8902a; background:#fffbeb; color:#78350f; font-size:0.76rem; font-weight:800; padding:0.28rem 0.65rem; border-radius:999px; cursor:pointer;">🎫 Ver Ticket de Retiro</button>
                </div>`;
            })
            .join('');
      }
    }

    if (!gridEl) return;

    // Si hay artículos marcados explícitamente con cfid === 1 los mostramos respetando la configuración con tilde "Mostrar en catálogo" (Solo con Stock vs Todos)
    const mostrarSoloStock = state.portalData?.fidelizacionConfig?.mostrarEnCatalogo !== 'todos';
    const hasExplicitCanje = state.articulos.some((a) => Number(a.cfid) === 1);
    let pool = hasExplicitCanje
      ? state.articulos.filter((a) => Number(a.cfid) === 1 && (!mostrarSoloStock || Number(a.sf) > 0))
      : state.articulos.filter((a) => (!mostrarSoloStock || Number(a.sf) > 0) && Number(a.p1f) > 0);
    if (searchQ) {
      pool = pool.filter(
        (a) =>
          String(a.n || '').toUpperCase().includes(searchQ) ||
          String(a.c || '').toUpperCase().includes(searchQ)
      );
    }

    const displayItems = pool.slice(0, 120);
    if (displayItems.length === 0) {
      gridEl.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:1.5rem; color:#71717a;">No se encontraron premios con ese criterio.</div>`;
      return;
    }

    gridEl.innerHTML = displayItems
      .map((art, idx) => {
        const hasStock = Number(art.sf) > 0;
        const code = escapeHtml(art.c || String(art.id).padStart(5, '0'));
        const name = escapeHtml(art.n || 'ARTÍCULO SIN NOMBRE');
        const rubroName = escapeHtml(state.rubrosMap.get(Number(art.r)) || 'ALMACÉN');
        const marcaName = escapeHtml(state.marcasMap.get(Number(art.mk)) || STORE_BRAND.upperName);
        const resolvedImg = resolveStoreArticleImage(art);
        const loadingAttr = idx < 4 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy" decoding="async"';

        const mediaHtml = `<img src="${escapeHtml(resolvedImg.primary)}" data-fb="${escapeHtml(resolvedImg.fallback)}" alt="${name}" ${loadingAttr} onerror="if(!this.dataset.triedFb){this.dataset.triedFb='1';this.src=this.dataset.fb;}else{this.onerror=null;this.src='../sistema/assets/img/icon-192.png';}" />`;

        const reqPts = getPremioRequiredPoints(art);
        const canAfford = hasStock && reqPts > 0 && availablePts >= reqPts;
        const missingPts = Math.max(0, reqPts - availablePts);

        return `
          <article class="product-card nx-premio-product-card ${canAfford ? '' : 'is-pts-insufficient'}">
            <div class="product-card-media" data-action="quickview" data-art-id="${art.id}" title="Ver detalle del premio">
              <span class="stock-badge ${hasStock ? 'in-stock' : 'out-stock'}">${hasStock ? 'Disponible' : 'Sin Stock'}</span>
              ${mediaHtml}
              <button type="button" class="btn-quickview-eye" data-action="quickview" data-art-id="${art.id}" title="Ver Detalle" aria-label="Ver detalle de ${name}">
                👁️
              </button>
            </div>
            <header>
              <h3 data-action="quickview" data-art-id="${art.id}">${name}</h3>
            </header>
            <div class="product-card-pricing">
              <div class="price-unlocked-box nx-premio-pts-box ${canAfford ? 'is-affordable' : 'is-locked'}">
                <div class="price-unlocked-row">
                  <strong class="price-unlocked-value">${cfBadgeSvg(24)} <span>${reqPts.toLocaleString('es-AR')} pts</span></strong>
                </div>
                <div class="price-neto-normativa">
                  ${
                    canAfford
                      ? `✅ Puntos suficientes (${availablePts.toLocaleString('es-AR')} pts disp.)`
                      : `🔒 Te faltan ${missingPts.toLocaleString('es-AR')} pts para canjear`
                  }
                </div>
              </div>
            </div>
            <footer>
              <button
                type="button"
                class="btn-card-action ${canAfford ? 'btn-card-add' : 'btn-premio-disabled'}"
                data-premio-add="${art.id}"
                ${canAfford ? '' : 'disabled aria-disabled="true"'}
              >
                🎁 Agregar al Carrito de Premios
              </button>
            </footer>
          </article>`;
      })
      .join('');
  };

  const bindClientPortalEvents = () => {
    // Botones para abrir Mi Panel desde la cabecera
    document.getElementById('btn-open-client-panel')?.addEventListener('click', () => {
      openClientPortalSection('home');
    });
    document.getElementById('chip-open-client-panel')?.addEventListener('click', () => {
      openClientPortalSection('home');
    });

    // Botón QR superior y atajos QR en el Panel
    document.getElementById('nx-btn-top-qr')?.addEventListener('click', () => {
      document.getElementById('btn-open-my-qr')?.click();
    });
    document.getElementById('nx-quick-open-qr')?.addEventListener('click', () => {
      document.getElementById('btn-open-my-qr')?.click();
    });
    document.getElementById('nx-shortcut-qr-btn')?.addEventListener('click', () => {
      document.getElementById('btn-open-my-qr')?.click();
    });
    document.getElementById('nx-perfil-btn-qr')?.addEventListener('click', () => {
      document.getElementById('btn-open-my-qr')?.click();
    });

    // Solapas directas en Mi Perfil (1. Datos Generales / 2. Datos Impositivos)
    const setPerfilActiveTab = (tabId = 'nx-prof-tab-generales') => {
      const btnGen = document.getElementById('nx-prof-tab-btn-generales');
      const btnImp = document.getElementById('nx-prof-tab-btn-impositivos');
      const panGen = document.getElementById('nx-prof-tab-generales');
      const panImp = document.getElementById('nx-prof-tab-impositivos');
      const isImp = tabId === 'nx-prof-tab-impositivos';
      if (btnGen) {
        btnGen.classList.toggle('is-active', !isImp);
        btnGen.setAttribute('aria-selected', !isImp ? 'true' : 'false');
      }
      if (btnImp) {
        btnImp.classList.toggle('is-active', isImp);
        btnImp.setAttribute('aria-selected', isImp ? 'true' : 'false');
      }
      if (panGen) panGen.hidden = isImp;
      if (panImp) panImp.hidden = !isImp;
    };

    const ensureProfSelectOptionAndSet = (selectEl, rawVal, cpVal = '') => {
      if (!selectEl || !rawVal) return;
      const val = String(rawVal).trim().toUpperCase();
      if (!val) return;
      const exists = Array.from(selectEl.options).some((o) => o.value.toUpperCase() === val);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = val;
        if (cpVal) opt.setAttribute('data-cp', cpVal);
        opt.textContent = cpVal ? `${val} (CP ${cpVal})` : val;
        selectEl.appendChild(opt);
      }
      selectEl.value = val;
    };

    const copyPerfilPersonalToFiscal = () => {
      const setF = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v;
      };
      const nom = composeErpFullName(
        document.getElementById('nx-prof-nombre')?.value || '',
        document.getElementById('nx-prof-apellido')?.value || ''
      );
      const calle = (document.getElementById('nx-prof-calle')?.value || '').trim().toUpperCase();
      let numero = (document.getElementById('nx-prof-numero')?.value || '').trim().toUpperCase();
      const mNumPre = numero.match(/^(?:S\/N|S\/D)\s*(.+)$/i);
      if (mNumPre && mNumPre[1].trim() && mNumPre[1].trim() !== 'S/N') numero = mNumPre[1].trim();
      if (numero === 'S/N' || numero === 'S/D') numero = '';
      const piso = (document.getElementById('nx-prof-piso')?.value || '').trim().toUpperCase();
      const dpto = (document.getElementById('nx-prof-dpto')?.value || '').trim().toUpperCase();
      const torre = (document.getElementById('nx-prof-torre')?.value || '').trim().toUpperCase();
      const barrio = (document.getElementById('nx-prof-barrio')?.value || '').trim().toUpperCase();
      const pais = (document.getElementById('nx-prof-pais')?.value || 'ARGENTINA').trim().toUpperCase();
      const prov = (document.getElementById('nx-prof-provincia')?.value || 'CÓRDOBA').trim().toUpperCase();
      const loc = (document.getElementById('nx-prof-localidad')?.value || STORE_BRAND.defaultLocalidad || 'ALCIRA GIGENA').trim().toUpperCase();
      const cp = (document.getElementById('nx-prof-cp')?.value || '5813').trim().toUpperCase();

      if (nom) setF('nx-prof-razon-social', nom);
      setF('nx-prof-calle-fiscal', calle);
      setF('nx-prof-numero-fiscal', numero);
      setF('nx-prof-piso-fiscal', piso);
      setF('nx-prof-dpto-fiscal', dpto);
      setF('nx-prof-torre-fiscal', torre);
      setF('nx-prof-barrio-fiscal', barrio);

      const selPaisF = document.getElementById('nx-prof-pais-fiscal');
      const selProvF = document.getElementById('nx-prof-provincia-fiscal');
      const selLocF = document.getElementById('nx-prof-localidad-fiscal');
      if (selPaisF) {
        ensureProfSelectOptionAndSet(selPaisF, pais);
        selPaisF.dispatchEvent(new Event('change'));
      }
      if (selProvF) {
        ensureProfSelectOptionAndSet(selProvF, prov);
        selProvF.dispatchEvent(new Event('change'));
      }
      if (selLocF) {
        ensureProfSelectOptionAndSet(selLocF, loc, cp);
      }
      setF('nx-prof-cp-fiscal', cp);
    };

    document.getElementById('nx-prof-tab-btn-generales')?.addEventListener('click', () => {
      setPerfilActiveTab('nx-prof-tab-generales');
    });
    document.getElementById('nx-prof-tab-btn-impositivos')?.addEventListener('click', () => {
      setPerfilActiveTab('nx-prof-tab-impositivos');
    });
    document.getElementById('btn-prof-go-tab-2')?.addEventListener('click', () => {
      const raz = (document.getElementById('nx-prof-razon-social')?.value || '').trim();
      const calF = (document.getElementById('nx-prof-calle-fiscal')?.value || '').trim();
      if (!raz || !calF) copyPerfilPersonalToFiscal();
      setPerfilActiveTab('nx-prof-tab-impositivos');
    });
    document.getElementById('btn-prof-copy-personal-to-fiscal')?.addEventListener('click', () => {
      copyPerfilPersonalToFiscal();
      showToast('📋 Nombre y domicilio copiados a Datos Fiscales.');
    });

    // Sincronizar DNI/CUIT entre Solapa 1 y Solapa 2 de Mi Perfil
    const profQuickDoc = document.getElementById('nx-prof-quick-doc');
    const profNroDoc = document.getElementById('nx-prof-nrodoc');
    const profTipoDoc = document.getElementById('nx-prof-tipodoc');
    profQuickDoc?.addEventListener('input', () => {
      if (profNroDoc) profNroDoc.value = profQuickDoc.value.toUpperCase();
      const d = profQuickDoc.value.replace(/\D/g, '');
      if (d.length === 11 && profTipoDoc) profTipoDoc.value = 'CUIT';
      else if (d.length >= 7 && d.length <= 8 && profTipoDoc) profTipoDoc.value = 'DNI';
    });
    profNroDoc?.addEventListener('input', () => {
      if (profQuickDoc) profQuickDoc.value = profNroDoc.value.toUpperCase();
      const d = profNroDoc.value.replace(/\D/g, '');
      if (d.length === 11 && profTipoDoc) profTipoDoc.value = 'CUIT';
      else if (d.length >= 7 && d.length <= 8 && profTipoDoc) profTipoDoc.value = 'DNI';
    });

    // Botones '+' de Provincia y Localidad en Mi Perfil
    const bindProfAddProv = (btnId, paisSelId, provSelId) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        const pais = document.getElementById(paisSelId)?.value || 'ARGENTINA';
        const nuevaProv = (window.prompt(`Agregar nueva provincia en ${pais}:`) || '').trim().toUpperCase();
        if (!nuevaProv) return;
        if (!state.geo.provincias[pais]) state.geo.provincias[pais] = [];
        if (!state.geo.provincias[pais].includes(nuevaProv)) state.geo.provincias[pais].push(nuevaProv);
        const selProv = document.getElementById(provSelId);
        if (selProv) {
          ensureProfSelectOptionAndSet(selProv, nuevaProv);
          selProv.dispatchEvent(new Event('change'));
        }
      });
    };
    const bindProfAddLoc = (btnId, provSelId, locSelId, cpInpId) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        const prov = document.getElementById(provSelId)?.value || 'CÓRDOBA';
        const nuevaLoc = (window.prompt(`Agregar nueva localidad en ${prov}:`) || '').trim().toUpperCase();
        if (!nuevaLoc) return;
        const nuevoCp = (window.prompt(`Código Postal (C.P.) para ${nuevaLoc}:`) || '').trim().toUpperCase();
        if (!state.geo.localidades[prov]) state.geo.localidades[prov] = [];
        state.geo.localidades[prov].push({ n: nuevaLoc, cp: nuevoCp });
        const selLoc = document.getElementById(locSelId);
        if (selLoc) ensureProfSelectOptionAndSet(selLoc, nuevaLoc, nuevoCp);
        const inpCp = document.getElementById(cpInpId);
        if (inpCp && nuevoCp) inpCp.value = nuevoCp;
      });
    };
    bindProfAddProv('btn-add-prov-prof', 'nx-prof-pais', 'nx-prof-provincia');
    bindProfAddProv('btn-add-prov-prof-fiscal', 'nx-prof-pais-fiscal', 'nx-prof-provincia-fiscal');
    bindProfAddLoc('btn-add-localidad-prof', 'nx-prof-provincia', 'nx-prof-localidad', 'nx-prof-cp');
    bindProfAddLoc('btn-add-localidad-prof-fiscal', 'nx-prof-provincia-fiscal', 'nx-prof-localidad-fiscal', 'nx-prof-cp-fiscal');

    // Consulta ARCA / ERP desde Mi Perfil
    const lookupPerfilDocInErpOrArca = async () => {
      const rawDoc = (profQuickDoc?.value || profNroDoc?.value || '').trim();
      const digits = rawDoc.replace(/\D/g, '');
      if (digits.length < 7) {
        showToast('⚠️ Ingresá un DNI o CUIT válido para consultar.');
        return;
      }
      const hint1 = document.getElementById('nx-prof-quick-doc-hint');
      const hint2 = document.getElementById('nx-prof-cuit-status');
      if (hint1) hint1.textContent = '⏳ Consultando ERP / Padrón ARCA...';
      if (hint2) hint2.textContent = '⏳ Consultando ERP / Padrón ARCA...';

      if (digits.length === 11) {
        try {
          const arcaRes = await fetch(`../sistema/api/padron_arca.php?cuit=${encodeURIComponent(digits)}`);
          const arcaData = await arcaRes.json();
          const p = arcaData?.data || arcaData?.contribuyente || arcaData;
          if (arcaData && arcaData.ok && p && (p.razonSocial || p.nombre)) {
            const rs = String(p.razonSocial || p.nombre || '').trim().toUpperCase();
            const fmtCuit = `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
            if (profNroDoc) profNroDoc.value = fmtCuit;
            if (profQuickDoc) profQuickDoc.value = fmtCuit;
            if (profTipoDoc) profTipoDoc.value = 'CUIT';
            const razInp = document.getElementById('nx-prof-razon-social');
            if (razInp) razInp.value = rs;
            const rawCondIva = String(p.condicionIva || p.respIva || '').toUpperCase();
            const profIvaSel = document.getElementById('nx-prof-respiva');
            if (profIvaSel && rawCondIva) {
              if (rawCondIva.includes('MONOTRIBUTO')) profIvaSel.value = 'MONOTRIBUTO';
              else if (rawCondIva.includes('INSCRIPTO')) profIvaSel.value = 'INSCRIPTO';
              else if (rawCondIva.includes('EXENTO')) profIvaSel.value = 'EXENTO';
              else profIvaSel.value = 'CONSUMIDOR FINAL';
            }
            const calF = document.getElementById('nx-prof-calle-fiscal');
            if (calF && (p.calle || p.direccion)) calF.value = String(p.calle || p.direccion).trim().toUpperCase();
            const numF = document.getElementById('nx-prof-numero-fiscal');
            if (numF && p.numero) numF.value = String(p.numero).trim().toUpperCase();
            const cpF = document.getElementById('nx-prof-cp-fiscal');
            const cpArca = String(p.cp || p.codigoPostal || '').trim().toUpperCase();
            if (cpF && cpArca) cpF.value = cpArca;
            const selProvF = document.getElementById('nx-prof-provincia-fiscal');
            if (selProvF && p.provincia) {
              ensureProfSelectOptionAndSet(selProvF, String(p.provincia).trim().toUpperCase());
              selProvF.dispatchEvent(new Event('change'));
            }
            const selLocF = document.getElementById('nx-prof-localidad-fiscal');
            if (selLocF && p.localidad) {
              ensureProfSelectOptionAndSet(selLocF, String(p.localidad).trim().toUpperCase(), cpArca);
            }
            if (hint1) {
              hint1.textContent = `✓ Verificado en Padrón ARCA: ${rs}`;
              hint1.style.color = 'var(--status-ok)';
            }
            if (hint2) {
              hint2.textContent = `✓ CUIT verificado en Padrón ARCA: ${rs}`;
              hint2.style.color = 'var(--status-ok)';
            }
            showToast(`✅ Datos fiscales verificados en ARCA: ${rs}`);
            return;
          }
        } catch (_e) {}
      }
      if (hint1) {
        hint1.textContent = `✓ Documento ${rawDoc} listo para guardar en tu ficha.`;
        hint1.style.color = 'var(--status-ok)';
      }
      if (hint2) {
        hint2.textContent = `✓ Documento ${rawDoc} verificado.`;
        hint2.style.color = 'var(--status-ok)';
      }
    };
    document.getElementById('btn-prof-check-erp-doc')?.addEventListener('click', lookupPerfilDocInErpOrArca);
    document.getElementById('btn-prof-search-arca')?.addEventListener('click', lookupPerfilDocInErpOrArca);

    document.getElementById('btn-prof-verify-whatsapp')?.addEventListener('click', async () => {
      const cel = (document.getElementById('nx-prof-celular')?.value || '').trim();
      const codPais = document.getElementById('nx-prof-celular-cod-pais')?.value || '+549';
      const digits = cel.replace(/\D/g, '');
      if (digits.length < 6) {
        showToast('⚠️ Ingresá primero tu número de celular / WhatsApp.');
        return;
      }
      const cleanPrefix = String(codPais).replace(/\D/g, '');
      const intl = digits.startsWith(cleanPrefix) ? `+${digits}` : `+${cleanPrefix}${digits.replace(/^0+/, '')}`;
      const nom = (
        composeErpFullName(
          document.getElementById('nx-prof-nombre')?.value || '',
          document.getElementById('nx-prof-apellido')?.value || ''
        ) ||
        state.client?.nombre ||
        ''
      ).trim().toUpperCase();
      const doc = (document.getElementById('nx-prof-nrodoc')?.value || document.getElementById('nx-prof-quick-doc')?.value || state.client?.nroDoc || '').trim().toUpperCase();
      const em = (document.getElementById('nx-prof-email')?.value || state.client?.email || '').trim().toUpperCase();

      const waBtn = document.getElementById('btn-prof-verify-whatsapp');
      const waSt = document.getElementById('nx-prof-whatsapp-status');
      const otpBox = document.getElementById('nx-prof-otp-verify-box');
      const otpInp = document.getElementById('nx-prof-otp-code-input');

      if (waBtn) {
        waBtn.disabled = true;
        waBtn.textContent = '⏳ Enviando código...';
      }
      if (waSt) {
        waSt.textContent = `⏳ Enviando código numérico de 6 dígitos al ${intl}...`;
        waSt.style.color = 'var(--status-ok)';
      }

      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'request_whatsapp_otp',
            generateOtp: true,
            cId: state.client?.id || 0,
            phone: intl,
            nombre: nom,
            nroDoc: doc,
            email: em,
            listaPrecio: getClientListaLabel()
          })
        });
        const data = await res.json();
        if (otpBox) otpBox.hidden = false;
        if (data && data.ok) {
          const sentTwilio = Boolean(data.twilioSent || data.webhookSent);
          if (!sentTwilio && data.otpCode && otpInp) {
            otpInp.value = String(data.otpCode);
          }
          if (otpInp) otpInp.focus();
          if (waSt) {
            waSt.textContent = sentTwilio
              ? `📲 Te enviamos el código de 6 dígitos por WhatsApp al ${intl}. Ingresalo arriba y tocá "Confirmar Código".`
              : `🔐 Código de verificación generado: ${data.otpCode || ''}${data.emailSent ? ' (enviado también a tu e-mail)' : ''}. Tocá "Confirmar Código" para verificar.`;
            waSt.style.color = 'var(--status-ok)';
          }
          showToast(
            sentTwilio
              ? `📲 Código de 6 dígitos enviado por WhatsApp al ${intl}.`
              : `🔐 Código ${data.otpCode || ''} generado. Tocá "Confirmar Código" para verificar tu WhatsApp.`
          );
        }
      } catch (_e) {
        if (waSt) {
          waSt.textContent = '⚠️ Error al generar el código de verificación.';
        }
      } finally {
        if (waBtn) {
          waBtn.disabled = false;
          if (!waBtn.classList.contains('is-verified')) {
            waBtn.textContent = '📲 Reenviar Código';
          }
        }
      }
    });

    document.getElementById('btn-prof-confirm-otp')?.addEventListener('click', async () => {
      const cel = (document.getElementById('nx-prof-celular')?.value || '').trim();
      const codPais = document.getElementById('nx-prof-celular-cod-pais')?.value || '+549';
      const digits = cel.replace(/\D/g, '');
      const cleanPrefix = String(codPais).replace(/\D/g, '');
      const intl = digits.startsWith(cleanPrefix) ? `+${digits}` : `+${cleanPrefix}${digits.replace(/^0+/, '')}`;
      const code = String(document.getElementById('nx-prof-otp-code-input')?.value || '').replace(/\D/g, '');
      if (code.length < 4) {
        showToast('⚠️ Ingresá el código numérico de 6 dígitos.');
        return;
      }
      const doc = (document.getElementById('nx-prof-nrodoc')?.value || document.getElementById('nx-prof-quick-doc')?.value || state.client?.nroDoc || '').trim().toUpperCase();
      const em = (document.getElementById('nx-prof-email')?.value || state.client?.email || '').trim().toUpperCase();
      const waBtn = document.getElementById('btn-prof-verify-whatsapp');
      const waSt = document.getElementById('nx-prof-whatsapp-status');
      const waRegInp = document.getElementById('nx-prof-whatsapp-registrado');
      const otpBox = document.getElementById('nx-prof-otp-verify-box');

      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify_whatsapp_otp',
            cId: state.client?.id || 0,
            phone: intl,
            code,
            nroDoc: doc,
            email: em
          })
        });
        const data = await res.json();
        if (!res.ok || !data || !data.ok) {
          const msg = data?.message || 'El código ingresado es incorrecto.';
          if (waSt) {
            waSt.textContent = `❌ ${msg}`;
            waSt.style.color = '#ef4444';
          }
          showToast(`❌ ${msg}`);
          return;
        }
        if (waRegInp) waRegInp.value = '1';
        if (otpBox) otpBox.hidden = true;
        if (waBtn) {
          waBtn.classList.add('is-verified');
          waBtn.textContent = '✓ WhatsApp Verificado';
        }
        if (data.client) {
          saveSession(data.client);
        } else if (state.client) {
          state.client.celular = intl;
          state.client.whatsappRegistrado = true;
          saveSession(state.client);
        }
        if (waSt) {
          waSt.textContent = `✓ WhatsApp ${intl} verificado y vinculado en ${STORE_BRAND.clubName}.`;
          waSt.style.color = 'var(--status-ok)';
        }
        showToast(`✅ ¡WhatsApp ${intl} verificado en ${STORE_BRAND.clubName}!`);
      } catch (_e) {
        showToast('⚠️ No se pudo verificar el código.');
      }
    });

    // Ocultar/Mostrar saldos (ojo estilo Naranja X)
    document.getElementById('nx-btn-toggle-privacy')?.addEventListener('click', () => {
      state.privacyHidden = !state.privacyHidden;
      renderPortalHomeCards();
    });

    // Sincronizar puntos indicadores del carrusel horizontal (Puntos Club Fidel / Soy Cajero / Promo +1.000 pts)
    const nxCardsTrackEl = document.getElementById('nx-cards-track');
    const nxCardsDotsEl = document.getElementById('nx-cards-dots');
    if (nxCardsTrackEl && nxCardsDotsEl) {
      nxCardsTrackEl.addEventListener(
        'scroll',
        () => {
          const cards = Array.from(nxCardsTrackEl.querySelectorAll('.nx-slide-card'));
          if (cards.length === 0) return;
          const scrollLeft = nxCardsTrackEl.scrollLeft;
          let activeIdx = 0;
          let minDiff = Infinity;
          cards.forEach((card, i) => {
            const diff = Math.abs(card.offsetLeft - scrollLeft);
            if (diff < minDiff) {
              minDiff = diff;
              activeIdx = i;
            }
          });
          nxCardsDotsEl.querySelectorAll('[data-nx-card-dot]').forEach((dot) => {
            dot.classList.toggle('is-active', Number(dot.getAttribute('data-nx-card-dot')) === activeIdx);
          });
        },
        { passive: true }
      );

      nxCardsDotsEl.addEventListener('click', (ev) => {
        const dot = ev.target.closest('[data-nx-card-dot]');
        if (!dot) return;
        const idx = Number(dot.getAttribute('data-nx-card-dot')) || 0;
        const cards = nxCardsTrackEl.querySelectorAll('.nx-slide-card');
        if (cards[idx]) {
          nxCardsTrackEl.scrollTo({ left: cards[idx].offsetLeft, behavior: 'smooth' });
        }
      });
    }

    // Alternar entre las 3 opciones de tema desde "Tus atajos":
    // 1) 'light' (Fondo Claro) -> 2) 'black-bg' (Fondo Negro + Tarjetas Claras) -> 3) 'dark' (Todo Oscuro)
    const THEME_MODES = ['light', 'black-bg', 'dark'];
    const THEME_META = {
      light: { badge: 'Claro', toast: '☀️ Fondo Claro activado', color: '#d4a41e' },
      'black-bg': { badge: 'Fondo Negro', toast: '◐ Fondo Negro con rectángulos gris claro activado', color: '#050507' },
      dark: { badge: 'Oscuro Total', toast: '🌙 Fondo Oscuro total activado', color: '#050507' }
    };

    const syncThemeShortcutBadge = (mode) => {
      const badgeEl = document.getElementById('nx-shortcut-theme-badge');
      if (badgeEl && THEME_META[mode]) {
        badgeEl.textContent = THEME_META[mode].badge;
      }
    };

    const initialThemeAttr = document.documentElement.getAttribute('data-theme') || 'black-bg';
    syncThemeShortcutBadge(THEME_MODES.includes(initialThemeAttr) ? initialThemeAttr : 'black-bg');

    document.getElementById('nx-shortcut-toggle-theme-btn')?.addEventListener('click', () => {
      const rawCurrent = document.documentElement.getAttribute('data-theme') || 'light';
      const idx = THEME_MODES.indexOf(rawCurrent);
      const next = THEME_MODES[(idx + 1) % THEME_MODES.length];
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem(STORE_BRAND.storagePrefix + 'carrito_theme_v1', next);
      } catch (_e) {}
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme && THEME_META[next]) {
        metaTheme.setAttribute('content', THEME_META[next].color);
      }
      syncThemeShortcutBadge(next);
      if (THEME_META[next]) {
        showToast(THEME_META[next].toast);
      }
    });

    // Instalación PWA Oficial y Actualización Automática en Segundo Plano (Android / Chrome / Edge / iOS)
    let deferredInstallPrompt = null;
    const CURRENT_PWA_VERSION = String(window.CARRITO_APP_VERSION || 'v49-20261124').trim();
    let pwaAutoReloading = false;
    let pendingAutoUpdateVer = '';
    let activeSwRegistration = null;

    const isClientBusyEditingOrScanning = () => {
      if (activePortalCameraStream) return true;
      const activeEl = document.activeElement;
      if (!activeEl) return false;
      const tag = String(activeEl.tagName || '').toUpperCase();
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return false;
      return Boolean(
        activeEl.closest(
          '#view-registro, #nx-subview-perfil, #login-dialog[open], #google-auth-dialog[open], #cart-dialog[open]'
        )
      );
    };

    const performSeamlessPwaReload = (nextVersion = '') => {
      if (pwaAutoReloading) return;
      const targetVer = String(nextVersion || '').trim();
      const guardKey = STORE_BRAND.storagePrefix + 'pwa_autoreload_guard';

      if (targetVer) {
        try {
          if (sessionStorage.getItem(guardKey) === targetVer) {
            return;
          }
        } catch (_e) {}
      }

      if (isClientBusyEditingOrScanning()) {
        pendingAutoUpdateVer = targetVer || 'sw-update';
        return;
      }

      pwaAutoReloading = true;
      try {
        if (targetVer) {
          sessionStorage.setItem(guardKey, targetVer);
        }
        if (state.client && state.activePortalSec) {
          sessionStorage.setItem(STORE_BRAND.storagePrefix + 'pwa_resume_sec', state.activePortalSec);
        }
      } catch (_e) {}

      const finalizeReload = () => {
        window.location.reload();
      };

      if ('caches' in window) {
        caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys.map((k) => {
                if (!targetVer || k.indexOf('-' + targetVer) === -1) {
                  return caches.delete(k).catch(() => {});
                }
                return null;
              })
            )
          )
          .finally(finalizeReload);
      } else {
        finalizeReload();
      }
    };

    document.addEventListener('focusout', () => {
      if (pendingAutoUpdateVer && !isClientBusyEditingOrScanning()) {
        const ver = pendingAutoUpdateVer;
        pendingAutoUpdateVer = '';
        setTimeout(() => performSeamlessPwaReload(ver), 200);
      }
    });

    const checkRemotePwaVersion = async () => {
      try {
        if (activeSwRegistration) {
          activeSwRegistration.update().catch(() => {});
          if (activeSwRegistration.waiting) {
            activeSwRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
        const res = await fetch(`version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) return;
        const data = await res.json();
        const serverVer = String(data?.version || '').trim();
        if (serverVer && serverVer !== CURRENT_PWA_VERSION) {
          performSeamlessPwaReload(serverVer);
        }
      } catch (_e) {}
    };

    if ('serviceWorker' in navigator) {
      const hadInitialController = Boolean(navigator.serviceWorker.controller);

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadInitialController) {
          performSeamlessPwaReload('');
        }
      });

      navigator.serviceWorker.addEventListener('message', (ev) => {
        if (ev.data && ev.data.type === 'CARRITO_SW_ACTIVATED') {
          const swVer = String(ev.data.version || '').trim();
          if (swVer && swVer !== CURRENT_PWA_VERSION) {
            performSeamlessPwaReload(swVer);
          }
        }
      });

      window.addEventListener('load', () => {
        const swScope =
          window.ERP_BRAND && window.ERP_BRAND.optionType === 2 && !window.ERP_BRAND.isBase && window.ERP_BRAND.slug
            ? '/' + window.ERP_BRAND.slug + '/'
            : '/';
        navigator.serviceWorker
          .register('/carrito/sw.js', { scope: swScope, updateViaCache: 'none' })
          .catch(() => navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }))
          .then((reg) => {
            if (!reg) return;
            activeSwRegistration = reg;
            reg.update().catch(() => {});
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            reg.addEventListener('updatefound', () => {
              const installingWorker = reg.installing;
              if (!installingWorker) return;
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  installingWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            });
          })
          .catch(() => {});

        setTimeout(checkRemotePwaVersion, 1500);
      });
    } else {
      window.addEventListener('load', () => {
        setTimeout(checkRemotePwaVersion, 1500);
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkRemotePwaVersion();
      }
    });
    window.addEventListener('pageshow', (ev) => {
      if (ev.persisted) {
        checkRemotePwaVersion();
      }
    });
    window.addEventListener('online', () => {
      checkRemotePwaVersion();
    });
    setInterval(() => {
      if (!document.hidden) {
        checkRemotePwaVersion();
      }
    }, 45000);
    window.addEventListener('beforeinstallprompt', (ev) => {
      ev.preventDefault();
      deferredInstallPrompt = ev;
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      const stEl = document.getElementById('nx-install-pwa-status');
      if (stEl) {
        stEl.textContent = '✅ ¡La App Oficial de Casa Nueva ya está instalada en tu dispositivo!';
        stEl.className = 'form-feedback is-success';
        stEl.hidden = false;
      }
      showToast('✅ ¡App Oficial Casa Nueva instalada correctamente!');
      checkAndClaimPwaInstallBonus(true);
    });

    const triggerNativePwaInstall = async () => {
      const stEl = document.getElementById('nx-install-pwa-status');
      if (deferredInstallPrompt) {
        try {
          deferredInstallPrompt.prompt();
          const choice = await deferredInstallPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') {
            deferredInstallPrompt = null;
          }
          return true;
        } catch (_e) {}
      }
      const isIOS =
        /iPad|iPhone|iPod/i.test(String(navigator.userAgent || '')) ||
        (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints) > 1);
      if (isIOS && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: STORE_BRAND.shortName || 'Casa Nueva',
            url: window.location.origin + window.location.pathname
          });
        } catch (_e) {}
      }
      if (stEl) {
        stEl.textContent = isIOS
          ? '📲 En el menú que se abrió, elegí "Agregar a inicio" (+) para finalizar la instalación.'
          : '📲 Si no apareció el cartel automático, abrí el menú (⋮) arriba a la derecha y tocá "Instalar aplicación".';
        stEl.className = 'form-feedback is-success';
        stEl.hidden = false;
      }
      return false;
    };

    document.getElementById('nx-btn-install-pwa')?.addEventListener('click', () => {
      triggerNativePwaInstall();
    });

    // Recomendá a un Amigo (+1.000 pts c/u): compartir por WhatsApp, copiar enlace y aplicar código manual
    document.getElementById('nx-card-promo-btn-wa')?.addEventListener('click', () => {
      shareClientReferralWhatsApp(state.client);
    });
    document.getElementById('nx-btn-share-ref-wa')?.addEventListener('click', () => {
      shareClientReferralWhatsApp(state.client);
    });
    document.getElementById('nx-card-promo-btn-copy')?.addEventListener('click', () => {
      copyClientReferralLink(state.client);
    });
    document.getElementById('nx-btn-copy-ref-link')?.addEventListener('click', () => {
      copyClientReferralLink(state.client);
    });

    document.getElementById('nx-btn-apply-manual-ref')?.addEventListener('click', async () => {
      if (!state.client) return;
      const inp = document.getElementById('nx-manual-ref-code-input');
      const fb = document.getElementById('nx-manual-ref-feedback');
      const btn = document.getElementById('nx-btn-apply-manual-ref');
      if (fb) fb.hidden = true;
      const rawCode = normalizeReferralCodeInput(inp?.value || '');
      if (!rawCode) {
        showToast('⚠️ Ingresá el código de tu amigo (ej. CF-106).');
        inp?.focus();
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Validando...';
      }
      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'apply_referral_code',
            cId: state.client.id || 0,
            codigo: state.client.codigo || state.client.co || 0,
            nroDoc: state.client.nroDoc || state.client.nd || '',
            codigoReferido: rawCode
          })
        });
        const data = await res.json();
        if (!res.ok || !data || !data.ok) {
          throw new Error(data?.message || 'No se pudo validar el código de amigo.');
        }
        clearPendingRefCode();
        if (data.client) saveSession(data.client);
        await loadClientPortalData();
        renderPortalHomeCards();
        showToast(data.message || '🎉 ¡Sumaste +1.000 puntos y tu amigo también sumó +1.000 puntos!');
      } catch (err) {
        if (fb) {
          fb.textContent = err.message || 'Código inválido.';
          fb.className = 'form-feedback is-error';
          fb.hidden = false;
        }
        showToast(`⚠️ ${err.message || 'No se pudo aplicar el código.'}`);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🎁 Canjear +1.000 pts';
        }
      }
    });

    // Delegación de clics para abrir cualquiera de las secciones del Panel
    document.addEventListener('click', (e) => {
      const secBtn = e.target.closest('[data-nx-open-sec]');
      if (secBtn) {
        const sec = secBtn.getAttribute('data-nx-open-sec') || 'home';
        const autoScan = secBtn.getAttribute('data-nx-sc-scan') === '1';
        openClientPortalSection(sec, { autoScan });
        if (sec === 'instalar-app' && deferredInstallPrompt) {
          triggerNativePwaInstall();
        }
        return;
      }

      const navBtn = e.target.closest('[data-nx-nav]');
      if (navBtn) {
        const navKey = navBtn.getAttribute('data-nx-nav') || 'home';
        openClientPortalSection(navKey);
      }
    });

    document.getElementById('nx-feature-banner-soycajero')?.addEventListener('click', () => {
      openClientPortalSection('soy-cajero');
    });

    // Barra de avance por rangos (1 a 10, 11 a 20, 21 a 30...) y acciones A4 en Mis Compras
    const handleComprasRangeClick = (e) => {
      const pageBtn = e.target.closest('button[data-compras-page]');
      if (!pageBtn || pageBtn.disabled) return;
      const targetPage = Number(pageBtn.getAttribute('data-compras-page'));
      if (!Number.isFinite(targetPage) || targetPage < 1) return;
      state.comprasPage = targetPage;
      renderPortalComprasSection();
    };
    document.getElementById('nx-compras-pager-top')?.addEventListener('click', handleComprasRangeClick);
    document.getElementById('nx-compras-pager-bottom')?.addEventListener('click', handleComprasRangeClick);

    document.getElementById('nx-compras-list')?.addEventListener('click', (e) => {
      const btnVerA4 = e.target.closest('button[data-ver-a4-idx]');
      if (btnVerA4) {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(btnVerA4.getAttribute('data-ver-a4-idx'));
        const allCompras = Array.isArray(state.portalData?.misCompras) ? state.portalData.misCompras : [];
        if (allCompras[idx]) {
          openPortalComprobanteA4Dialog(allCompras[idx]);
        }
        return;
      }

      const btnPdfA4 = e.target.closest('button[data-pdf-a4-idx]');
      if (btnPdfA4) {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number(btnPdfA4.getAttribute('data-pdf-a4-idx'));
        const allCompras = Array.isArray(state.portalData?.misCompras) ? state.portalData.misCompras : [];
        if (allCompras[idx]) {
          downloadPortalComprobanteA4Pdf(allCompras[idx]);
        }
      }
    });

    document.getElementById('btn-nx-close-a4-dialog')?.addEventListener('click', () => {
      const dlg = document.getElementById('nx-comprobante-a4-dialog');
      if (dlg?.open) dlg.close();
    });

    document.getElementById('btn-nx-download-a4-pdf')?.addEventListener('click', () => {
      if (activeA4Comprobante) {
        downloadPortalComprobanteA4Pdf(activeA4Comprobante);
      }
    });

    document.getElementById('btn-nx-print-a4')?.addEventListener('click', () => {
      if (activeA4Comprobante) {
        printPortalComprobanteA4(activeA4Comprobante);
      }
    });

    // Guardar cambios en Mi Perfil (ambas solapas: 1. Datos Generales + 2. Datos Impositivos)
    document.getElementById('nx-perfil-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.client) return;
      const fb = document.getElementById('nx-perfil-feedback');
      if (fb) fb.hidden = true;

      const emailVal = (document.getElementById('nx-prof-email')?.value || '').trim().toUpperCase();
      const rawCel = (document.getElementById('nx-prof-celular')?.value || '').trim();
      const codPais = (document.getElementById('nx-prof-celular-cod-pais')?.value || '+549').replace(/\D/g, '');
      const celDigits = rawCel.replace(/\D/g, '');
      const formattedCel = celDigits
        ? (celDigits.startsWith(codPais) ? `+${celDigits}` : `+${codPais}${celDigits.replace(/^0+/, '')}`)
        : '';

      const nroDocVal = (
        document.getElementById('nx-prof-nrodoc')?.value ||
        document.getElementById('nx-prof-quick-doc')?.value ||
        ''
      ).trim().toUpperCase();

      const nombrePilaVal = (document.getElementById('nx-prof-nombre')?.value || '').trim().toUpperCase();
      const apellidoVal = (document.getElementById('nx-prof-apellido')?.value || '').trim().toUpperCase();
      if (!nombrePilaVal || !apellidoVal) {
        if (fb) {
          fb.textContent = 'Por favor completá los campos obligatorios (* Nombre y * Apellido).';
          fb.className = 'form-feedback is-error';
          fb.hidden = false;
        }
        setPerfilActiveTab('nx-prof-tab-generales');
        return;
      }
      const nombreVal = composeErpFullName(nombrePilaVal, apellidoVal);
      const rawRazon = (document.getElementById('nx-prof-razon-social')?.value || '').trim().toUpperCase();
      const prevNombre = String(state.client?.nombre || state.client?.no || '').trim().toUpperCase();
      const razonVal = (!rawRazon || rawRazon === prevNombre) ? nombreVal : rawRazon;
      const cleanStreetNumSave = (raw) => {
        let s = String(raw ?? '').trim().toUpperCase();
        if (!s) return 'S/N';
        const mPre = s.match(/^(?:S\/N|S\/D)\s*(.+)$/i);
        if (mPre && mPre[1].trim() && mPre[1].trim().toUpperCase() !== 'S/N') s = mPre[1].trim().toUpperCase();
        const mSuf = s.match(/^(.+?)\s*(?:S\/N|S\/D)$/i);
        if (mSuf && mSuf[1].trim() && mSuf[1].trim().toUpperCase() !== 'S/N') s = mSuf[1].trim().toUpperCase();
        return s || 'S/N';
      };
      const calleVal = (document.getElementById('nx-prof-calle')?.value || '').trim().toUpperCase();
      const numeroVal = cleanStreetNumSave(document.getElementById('nx-prof-numero')?.value);
      const pisoVal = (document.getElementById('nx-prof-piso')?.value || '').trim().toUpperCase();
      const dptoVal = (document.getElementById('nx-prof-dpto')?.value || '').trim().toUpperCase();
      const torreVal = (document.getElementById('nx-prof-torre')?.value || '').trim().toUpperCase();
      const barrioVal = (document.getElementById('nx-prof-barrio')?.value || '').trim().toUpperCase();
      const paisVal = (document.getElementById('nx-prof-pais')?.value || 'ARGENTINA').trim().toUpperCase();
      const provVal = (document.getElementById('nx-prof-provincia')?.value || 'CÓRDOBA').trim().toUpperCase();
      const locVal = (document.getElementById('nx-prof-localidad')?.value || 'ALCIRA GIGENA').trim().toUpperCase();
      const cpVal = (document.getElementById('nx-prof-cp')?.value || '5813').trim().toUpperCase();

      const profile = {
        nombre: nombreVal,
        nombrePila: nombrePilaVal,
        apellido: apellidoVal,
        razonSocial: razonVal,
        email: emailVal,
        tipoDoc: document.getElementById('nx-prof-tipodoc')?.value || 'DNI',
        nroDoc: nroDocVal,
        respIva: document.getElementById('nx-prof-respiva')?.value || 'CONSUMIDOR FINAL',
        celular: formattedCel || rawCel,
        fechaNacimiento: document.getElementById('nx-prof-fecha-nacimiento')?.value || '',
        contacto: '',
        observacion: document.getElementById('nx-prof-observacion')?.value || '',
        calle: calleVal,
        numero: numeroVal,
        piso: pisoVal,
        dpto: dptoVal,
        torre: torreVal,
        barrio: barrioVal,
        pais: paisVal,
        provincia: provVal,
        localidad: locVal,
        cp: cpVal,
        calleFiscal: (document.getElementById('nx-prof-calle-fiscal')?.value || calleVal).trim().toUpperCase(),
        numeroFiscal: cleanStreetNumSave(document.getElementById('nx-prof-numero-fiscal')?.value || numeroVal),
        pisoFiscal: (document.getElementById('nx-prof-piso-fiscal')?.value || pisoVal).trim().toUpperCase(),
        dptoFiscal: (document.getElementById('nx-prof-dpto-fiscal')?.value || dptoVal).trim().toUpperCase(),
        torreFiscal: (document.getElementById('nx-prof-torre-fiscal')?.value || torreVal).trim().toUpperCase(),
        barrioFiscal: (document.getElementById('nx-prof-barrio-fiscal')?.value || barrioVal).trim().toUpperCase(),
        paisFiscal: (document.getElementById('nx-prof-pais-fiscal')?.value || paisVal).trim().toUpperCase(),
        provinciaFiscal: (document.getElementById('nx-prof-provincia-fiscal')?.value || provVal).trim().toUpperCase(),
        localidadFiscal: (document.getElementById('nx-prof-localidad-fiscal')?.value || locVal).trim().toUpperCase(),
        cpFiscal: (document.getElementById('nx-prof-cp-fiscal')?.value || cpVal).trim().toUpperCase(),
        fotoUrl: state.client.fotoUrl || state.client.picture || '',
        usuarioWeb: emailVal || document.getElementById('nx-prof-usuario')?.value || '',
        claveWeb: document.getElementById('nx-prof-clave')?.value || ''
      };

      const saveBtn = document.getElementById('nx-perfil-btn-save');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.remove('is-saved-ok');
        saveBtn.textContent = '⏳ Guardando cambios...';
      }

      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_client_profile',
            cId: state.client.id,
            profile
          })
        });
        const data = await res.json();
        if (!data || !data.ok || !data.client) {
          throw new Error(data?.message || 'No se pudo actualizar el perfil.');
        }
        saveSession(data.client);
        if (fb) {
          fb.textContent = '✅ ¡Cambios guardados correctamente en Mi Perfil!';
          fb.className = 'form-feedback is-success';
          fb.hidden = false;
          fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          clearTimeout(fb._hideTimer);
          fb._hideTimer = setTimeout(() => {
            fb.hidden = true;
          }, 6000);
        }
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.classList.add('is-saved-ok');
          saveBtn.textContent = '✅ ¡Cambios Guardados!';
          clearTimeout(saveBtn._resetTimer);
          saveBtn._resetTimer = setTimeout(() => {
            saveBtn.classList.remove('is-saved-ok');
            saveBtn.textContent = '💾 Guardar Cambios en Mi Perfil';
          }, 3500);
        }
        showToast('✅ ¡Tus datos de Mi Perfil se guardaron correctamente!');
      } catch (err) {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.classList.remove('is-saved-ok');
          saveBtn.textContent = '💾 Guardar Cambios en Mi Perfil';
        }
        if (fb) {
          fb.textContent = err.message || 'Error al guardar el perfil.';
          fb.className = 'form-feedback is-error';
          fb.hidden = false;
          fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        showToast(`⚠️ ${err.message || 'Error al guardar el perfil.'}`);
      }
    });

    document.getElementById('nx-perfil-btn-logout')?.addEventListener('click', () => {
      stopPortalCamera();
      saveSession(null);
      switchStoreView('catalogo');
      showToast('Sesión cerrada correctamente.');
    });

    // Consultador de Precios: input, cámara y botones de sumar
    const consInput = document.getElementById('nx-cons-input');
    consInput?.addEventListener('input', () => renderConsultadorSection());
    document.getElementById('nx-cons-btn-camera')?.addEventListener('click', () => {
      startPortalBarcodeScanner('consultador');
    });
    document.getElementById('nx-cons-btn-stop-cam')?.addEventListener('click', stopPortalCamera);

    document.getElementById('nx-subview-consultador')?.addEventListener('click', (e) => {
      const btnSc = e.target.closest('[data-cons-add-sc]');
      if (btnSc) {
        const art = findAnyArticleById(btnSc.getAttribute('data-cons-add-sc'));
        if (art) addProductToSoyCajero(art, 1);
        return;
      }
      const btnWeb = e.target.closest('[data-cons-add-web]');
      if (btnWeb) {
        const artId = Number(btnWeb.getAttribute('data-cons-add-web'));
        if (artId) addToCart(artId, 1);
      }
    });

    // Soy Cajero: buscador, sugerencias, cámara, +/- y generar Código Interno
    const scSearch = document.getElementById('nx-sc-search-input');
    const scSug = document.getElementById('nx-sc-suggestions');

    scSearch?.addEventListener('input', () => {
      const q = (scSearch.value || '').trim();
      if (!scSug) return;
      if (!q) {
        scSug.hidden = true;
        return;
      }
      const { list } = findArticlesByBarcodeOrQuery(q);
      if (list.length === 0) {
        scSug.hidden = true;
        return;
      }
      scSug.hidden = false;
      scSug.innerHTML = list
        .slice(0, 8)
        .map(
          (a) => `
          <div class="nx-sc-sug-item" data-sc-pick-id="${a.id}">
            <div>
              <strong>${escapeHtml(a.n)}</strong>
              <div style="font-size:0.75rem; color:#71717a;">Cód. #${escapeHtml(a.c)}</div>
            </div>
            <strong style="color:#15803d;">${formatArs(getArticleUnitPrice(a))}</strong>
          </div>`
        )
        .join('');
    });

    scSearch?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = (scSearch.value || '').trim();
        if (!q) return;
        const { exact, scaleMeta } = findArticlesByBarcodeOrQuery(q);
        if (exact) {
          addProductToSoyCajero(exact, scaleMeta ? scaleMeta.qtyKg : 1, scaleMeta || {});
          scSearch.value = '';
          if (scSug) scSug.hidden = true;
        } else {
          showToast('⚠️ No se encontró ningún artículo con ese código.');
        }
      }
    });

    scSug?.addEventListener('click', (e) => {
      const row = e.target.closest('[data-sc-pick-id]');
      if (!row) return;
      const art = findAnyArticleById(row.getAttribute('data-sc-pick-id'));
      if (art) {
        addProductToSoyCajero(art, 1);
        if (scSearch) scSearch.value = '';
        scSug.hidden = true;
      }
    });

    document.getElementById('nx-sc-btn-camera')?.addEventListener('click', () => {
      startPortalBarcodeScanner('soy-cajero');
    });
    document.getElementById('nx-sc-btn-stop-cam')?.addEventListener('click', stopPortalCamera);

    document.getElementById('nx-sc-items-wrap')?.addEventListener('click', (e) => {
      const inc = e.target.closest('[data-sc-inc]');
      const dec = e.target.closest('[data-sc-dec]');
      const del = e.target.closest('[data-sc-del]');
      if (inc) {
        const idx = Number(inc.getAttribute('data-sc-inc'));
        if (state.soyCajeroItems[idx]) {
          state.soyCajeroItems[idx].cantidad = Math.round((Number(state.soyCajeroItems[idx].cantidad) + 1) * 1000) / 1000;
          saveSoyCajeroLocal();
          renderSoyCajeroSection();
          renderPortalHomeCards();
        }
      } else if (dec) {
        const idx = Number(dec.getAttribute('data-sc-dec'));
        if (state.soyCajeroItems[idx]) {
          const nextQ = Math.round((Number(state.soyCajeroItems[idx].cantidad) - 1) * 1000) / 1000;
          if (nextQ <= 0) state.soyCajeroItems.splice(idx, 1);
          else state.soyCajeroItems[idx].cantidad = nextQ;
          saveSoyCajeroLocal();
          renderSoyCajeroSection();
          renderPortalHomeCards();
        }
      } else if (del) {
        const idx = Number(del.getAttribute('data-sc-del'));
        state.soyCajeroItems.splice(idx, 1);
        saveSoyCajeroLocal();
        renderSoyCajeroSection();
        renderPortalHomeCards();
      }
    });

    document.getElementById('nx-sc-btn-clear')?.addEventListener('click', () => {
      state.soyCajeroItems = [];
      state.soyCajeroLastTicket = null;
      saveSoyCajeroLocal();
      renderSoyCajeroSection();
      renderPortalHomeCards();
    });

    document.getElementById('nx-sc-btn-generate')?.addEventListener('click', async () => {
      if (!state.client) return;
      if (state.soyCajeroItems.length === 0) {
        showToast('⚠️ Cargá al menos un producto en Soy Cajero para generar el código.');
        return;
      }
      const btn = document.getElementById('nx-sc-btn-generate');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Grabando compra...';
      }
      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_soy_cajero_ticket',
            cId: state.client.id || 0,
            clienteCodigo: state.client.codigo || state.client.co || '1',
            clienteNombre: state.client.nombre || state.client.no || 'CLIENTE',
            clienteDoc: state.client.nroDoc || state.client.nd || '00.000.000',
            listaPrecio: getClientListaLabel(),
            expectedCode: state.nextSoyCajeroCode || '',
            items: state.soyCajeroItems
          })
        });
        const data = await res.json();
        if (!data || !data.ok || !data.ticket) {
          throw new Error(data?.message || 'No se pudo grabar la compra.');
        }
        state.soyCajeroLastTicket = data.ticket;
        if (data.nextSoyCajeroCode) {
          state.nextSoyCajeroCode = String(data.nextSoyCajeroCode);
        }
        state.soyCajeroItems = [];
        saveSoyCajeroLocal();
        await loadClientPortalData();
        renderSoyCajeroSection();
        renderPortalHomeCards();
        if (data.wasReassigned && data.previousExpectedCode) {
          showToast(
            `✅ Otro cliente confirmó antes el #${data.previousExpectedCode}. Tu código asignado es #${data.ticket.codigoInterno} (${data.ticket.codigoFormateado}).`
          );
        } else {
          showToast(`✅ ¡Compra grabada con Código #${data.ticket.codigoInterno}! Presentalo en Caja.`);
        }
        document.getElementById('nx-sc-generated-code-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) {
        showToast(err.message || 'Error al grabar la compra de Soy Cajero.');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Grabar Compra';
        }
      }
    });

    // Catálogo de Premios: buscar, sumar al carrito de premios y canjear
    document.getElementById('nx-premios-search')?.addEventListener('input', () => renderPortalPremiosSection());

    document.getElementById('nx-premios-grid')?.addEventListener('click', (e) => {
      const quickEl = e.target.closest('[data-action="quickview"]');
      if (quickEl) {
        const qId = Number(quickEl.getAttribute('data-art-id'));
        if (qId) openQuickViewModal(qId, { isPremio: true });
        return;
      }

      const btn = e.target.closest('[data-premio-add]');
      if (!btn || btn.disabled || btn.hasAttribute('disabled') || btn.classList.contains('btn-premio-disabled')) {
        return;
      }
      const artId = Number(btn.getAttribute('data-premio-add'));
      const art = state.articulos.find((a) => Number(a.id) === artId);
      if (!art) return;

      const ptsUnit = getPremioRequiredPoints(art);
      const userPts = getActiveClientPoints();
      const usedPts = state.premiosCart.reduce((acc, it) => acc + it.cantidad * it.puntosUnit, 0);
      const availablePts = Math.max(0, userPts - usedPts);

      if (ptsUnit <= 0 || availablePts < ptsUnit) {
        showToast(`⚠️ No tenés puntos suficientes disponibles (${ptsUnit.toLocaleString('es-AR')} pts requeridos) para agregar este premio.`);
        renderPortalPremiosSection();
        return;
      }

      const existing = state.premiosCart.find((it) => Number(it.artId) === artId);
      if (existing) {
        existing.cantidad += 1;
      } else {
        state.premiosCart.push({
          artId: art.id,
          artCodigo: art.c,
          artNombre: art.n,
          cantidad: 1,
          puntosUnit: ptsUnit
        });
      }
      renderPortalPremiosSection();
      showToast(`🎁 "${art.n}" agregado a tu Carrito de Premios.`);
    });

    document.getElementById('nx-premios-cart-box')?.addEventListener('click', (e) => {
      const del = e.target.closest('[data-premio-del]');
      if (!del) return;
      const idx = Number(del.getAttribute('data-premio-del'));
      state.premiosCart.splice(idx, 1);
      renderPortalPremiosSection();
    });

    document.getElementById('nx-premios-btn-redeem')?.addEventListener('click', async () => {
      if (!state.client || state.premiosCart.length === 0) return;
      const fb = document.getElementById('nx-premios-feedback');
      if (fb) fb.hidden = true;
      const btn = document.getElementById('nx-premios-btn-redeem');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Procesando canje...';
      }
      try {
        const res = await fetch(CLIENTES_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'redeem_fidelizacion_cart',
            cId: state.client.id,
            items: state.premiosCart
          })
        });
        const data = await res.json();
        if (!data || !data.ok) {
          throw new Error(data?.message || 'No se pudo completar el canje de premios.');
        }
        state.premiosCart = [];
        if (data.client) saveSession(data.client);
        await loadClientPortalData();
        renderPortalPremiosSection();
        showToast(`🎉 ¡Canje confirmado! ${data.summary || ''}`);
        const ticketToOpen =
          data.ticket ||
          (Array.isArray(data.movements) && data.movements[0]
            ? buildCanjeTicketFromMov(data.movements[0], 0)
            : null);
        if (ticketToOpen) {
          openPortalCanjeTicketDialog(ticketToOpen);
        }
      } catch (err) {
        if (fb) {
          fb.textContent = err.message || 'Error al canjear premios.';
          fb.className = 'form-feedback is-error';
          fb.hidden = false;
        }
      } finally {
        if (btn) {
          btn.textContent = '🎁 Confirmar Canje de Premios';
          renderPortalPremiosSection();
        }
      }
    });

    const handlePuntosRangeClick = (e) => {
      const pageBtn = e.target.closest('button[data-puntos-page]');
      if (!pageBtn || pageBtn.disabled) return;
      const targetPage = Number(pageBtn.getAttribute('data-puntos-page'));
      if (!Number.isFinite(targetPage) || targetPage < 1) return;
      state.puntosPage = targetPage;
      renderPortalPuntosSection();
    };
    document.getElementById('nx-pts-pager-top')?.addEventListener('click', handlePuntosRangeClick);
    document.getElementById('nx-pts-pager-bottom')?.addEventListener('click', handlePuntosRangeClick);

    document.addEventListener('click', (e) => {
      const btnOpenTk = e.target.closest('[data-open-canje-mov-id]');
      if (!btnOpenTk) return;
      const movId = String(btnOpenTk.getAttribute('data-open-canje-mov-id') || '');
      const movs = Array.isArray(state.portalData?.fidelizacionMovs) ? state.portalData.fidelizacionMovs : [];
      const idx = movs.findIndex((m) => String(m.id || '') === movId);
      const mov = idx >= 0 ? movs[idx] : null;
      if (!mov) return;
      openPortalCanjeTicketDialog(buildCanjeTicketFromMov(mov, idx));
    });

    document.getElementById('btn-nx-print-canje-ticket')?.addEventListener('click', () => {
      printPortalCanjeTicket();
    });
    const closeCanjeDialog = () => {
      const dlg = document.getElementById('nx-canje-ticket-dialog');
      if (dlg) {
        if (typeof dlg.close === 'function' && dlg.open) dlg.close();
        else dlg.removeAttribute('open');
      }
    };
    document.getElementById('btn-nx-close-canje-ticket')?.addEventListener('click', closeCanjeDialog);
    document.getElementById('btn-nx-done-canje-ticket')?.addEventListener('click', closeCanjeDialog);
  };

  // ==========================================
  // HOMEPAGE HERO BANNER CAROUSEL (1530x370 / 1920x370)
  // ==========================================
  const resolveBannerImageSrc = (rawUrl) => {
    const u = String(rawUrl || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u;
    if (u.startsWith('/sistema/')) return '..' + u;
    return u;
  };

  let promoPopupTimerId = null;
  let promoPopupCountdownId = null;

  const closeLoggedClientPromoPopup = () => {
    if (promoPopupTimerId) {
      clearTimeout(promoPopupTimerId);
      promoPopupTimerId = null;
    }
    if (promoPopupCountdownId) {
      clearInterval(promoPopupCountdownId);
      promoPopupCountdownId = null;
    }
    const overlay = document.getElementById('logged-promo-popup-overlay');
    if (overlay) overlay.hidden = true;
  };

  const showLoggedClientPromoPopupIfNeeded = () => {
    if (!state.client) return;
    const popups = Array.isArray(state._publicPopups) ? state._publicPopups : [];
    if (popups.length === 0) return;

    const clientIdKey = String(state.client.id || state.client.cuit || state.client.usuarioWeb || 'logged');
    const updatedKey = String(state._bannersUpdatedAt || 'v1');
    const sessionFlagKey = `${STORE_BRAND.storagePrefix}promo_popup_seen_${clientIdKey}_${updatedKey}`;
    try {
      if (sessionStorage.getItem(sessionFlagKey) === '1') return;
      sessionStorage.setItem(sessionFlagKey, '1');
    } catch (_e) {}

    const overlay = document.getElementById('logged-promo-popup-overlay');
    const stageEl = document.getElementById('logged-promo-popup-stage');
    const progressWrap = document.getElementById('logged-promo-popup-progress');
    const progressBar = document.getElementById('logged-promo-popup-progress-bar');
    const timerBadge = document.getElementById('logged-promo-popup-timer');
    const closeBtn = document.getElementById('btn-close-logged-promo-popup');
    const footerEl = document.getElementById('logged-promo-popup-footer');
    const dotsEl = document.getElementById('logged-promo-popup-dots');
    if (!overlay || !stageEl) return;

    const defaultDurSec = typeof state._popupDurationSec === 'number' ? state._popupDurationSec : 6;
    let currentIdx = 0;

    const getPopupDuration = (item) => {
      const d = item && typeof item.duracionSec === 'number' ? item.duracionSec : -1;
      return d >= 0 ? d : defaultDurSec;
    };

    const renderPopupSlide = (idx) => {
      if (promoPopupTimerId) {
        clearTimeout(promoPopupTimerId);
        promoPopupTimerId = null;
      }
      if (promoPopupCountdownId) {
        clearInterval(promoPopupCountdownId);
        promoPopupCountdownId = null;
      }

      if (idx >= popups.length) {
        closeLoggedClientPromoPopup();
        return;
      }
      currentIdx = idx;
      const item = popups[currentIdx];
      const imgSrc = escapeHtml(resolveBannerImageSrc(item.imageUrl));
      const title = escapeHtml(String(item.titulo || `Promoción ${STORE_BRAND.name}`));
      const link = String(item.linkUrl || '').trim();
      const durSec = getPopupDuration(item);

      const imgHtml = `<img src="${imgSrc}" alt="${title}" decoding="async" />`;
      if (link) {
        const isExternal = /^https?:\/\//i.test(link) && !link.includes('cn.com.ar') && !link.includes('paseoalberdi.ar');
        stageEl.innerHTML = `<a href="${escapeHtml(link)}" data-promo-popup-link="1"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''}>${imgHtml}</a>`;
      } else {
        stageEl.innerHTML = imgHtml;
      }

      if (dotsEl && footerEl) {
        if (popups.length > 1) {
          footerEl.hidden = false;
          dotsEl.innerHTML = popups
            .map(
              (_, i) =>
                `<button type="button" class="logged-promo-popup-dot${i === currentIdx ? ' is-active' : ''}" data-promo-dot="${i}" aria-label="Promoción ${i + 1}"></button>`
            )
            .join('');
        } else {
          footerEl.hidden = true;
          dotsEl.innerHTML = '';
        }
      }

      if (durSec > 0) {
        if (progressWrap) progressWrap.hidden = false;
        if (progressBar) {
          progressBar.style.transition = 'none';
          progressBar.style.transform = 'scaleX(1)';
          void progressBar.offsetWidth;
          progressBar.style.transition = `transform ${durSec}s linear`;
          progressBar.style.transform = 'scaleX(0)';
        }
        let remaining = durSec;
        if (timerBadge) {
          timerBadge.hidden = false;
          timerBadge.textContent = `${remaining}s`;
        }
        promoPopupCountdownId = setInterval(() => {
          remaining -= 1;
          if (remaining > 0 && timerBadge) {
            timerBadge.textContent = `${remaining}s`;
          }
        }, 1000);
        promoPopupTimerId = setTimeout(() => {
          renderPopupSlide(currentIdx + 1);
        }, durSec * 1000);
      } else {
        if (progressWrap) progressWrap.hidden = true;
        if (timerBadge) timerBadge.hidden = true;
      }
    };

    if (closeBtn) {
      closeBtn.onclick = () => closeLoggedClientPromoPopup();
    }
    overlay.onclick = (ev) => {
      if (ev.target === overlay) {
        closeLoggedClientPromoPopup();
      }
    };
    if (dotsEl) {
      dotsEl.onclick = (ev) => {
        const dot = ev.target.closest('button[data-promo-dot]');
        if (!dot) return;
        renderPopupSlide(Number(dot.getAttribute('data-promo-dot')) || 0);
      };
    }
    stageEl.onclick = (ev) => {
      const a = ev.target.closest('a[data-promo-popup-link]');
      if (!a) return;
      const href = String(a.getAttribute('href') || '').trim();
      if (href.startsWith('?')) {
        ev.preventDefault();
        closeLoggedClientPromoPopup();
        try {
          const params = new URLSearchParams(href);
          const q = params.get('q') || params.get('search') || '';
          if (q) {
            switchStoreView('catalogo');
            const sInp = document.getElementById('store-search-input');
            const hInp = document.getElementById('header-search-input');
            const cInp = document.getElementById('catalog-inline-search-input');
            if (sInp) sInp.value = q;
            if (hInp) hInp.value = q;
            if (cInp) cInp.value = q;
            applyCatalogFilters();
          }
        } catch (_e) {}
      }
    };

    overlay.hidden = false;
    renderPopupSlide(0);
  };

  let appAutogestionCarouselTimerId = null;
  let appAutogestionCarouselBoundSwipe = false;
  let appAutogestionCarouselGoTo = null;

  const renderAppAutogestionCarousel = () => {
    const viewportEl = document.getElementById('nx-app-carousel-viewport');
    const trackEl = document.getElementById('nx-app-carousel-track');
    const dotsEl = document.getElementById('nx-app-carousel-dots');
    if (!viewportEl || !trackEl) return;

    if (appAutogestionCarouselTimerId) {
      clearInterval(appAutogestionCarouselTimerId);
      appAutogestionCarouselTimerId = null;
    }

    trackEl.querySelectorAll('.nx-app-carousel-slide--dynamic').forEach((el) => el.remove());

    const items = Array.isArray(state._publicAppCarousel) ? state._publicAppCarousel.slice(0, 10) : [];
    const intervalSec = Math.max(2, Number(state._appCarouselIntervalSec) || 4);

    items.forEach((item, idx) => {
      const slide = document.createElement('div');
      slide.className = 'nx-app-carousel-slide nx-app-carousel-slide--dynamic';
      const imgSrc = escapeHtml(resolveBannerImageSrc(item.imageUrl));
      const title = escapeHtml(String(item.titulo || `Promoción ${STORE_BRAND.name} #${idx + 1}`));
      const link = String(item.linkUrl || '').trim();
      const imgTag = `<img src="${imgSrc}" alt="${title}" width="1080" height="360" loading="lazy" decoding="async" />`;
      if (link) {
        const isExternal = /^https?:\/\//i.test(link) && !link.includes('cn.com.ar') && !link.includes('paseoalberdi.ar');
        slide.innerHTML = `<a href="${escapeHtml(link)}" class="nx-app-carousel-banner-card" data-nx-app-carousel-link="1"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''}>${imgTag}</a>`;
      } else {
        slide.innerHTML = `<div class="nx-app-carousel-banner-card">${imgTag}</div>`;
      }
      trackEl.appendChild(slide);
    });

    const totalSlides = 1 + items.length;
    let currentIdx = 0;

    const updateSlidePosition = (nextIdx) => {
      currentIdx = ((nextIdx % totalSlides) + totalSlides) % totalSlides;
      trackEl.style.transform = `translate3d(-${currentIdx * 100}%, 0, 0)`;
      if (dotsEl) {
        dotsEl.querySelectorAll('.nx-app-carousel-dot').forEach((dot, i) => {
          dot.classList.toggle('is-active', i === currentIdx);
        });
      }
    };

    const restartAutoRotate = () => {
      if (appAutogestionCarouselTimerId) {
        clearInterval(appAutogestionCarouselTimerId);
        appAutogestionCarouselTimerId = null;
      }
      if (totalSlides > 1) {
        appAutogestionCarouselTimerId = setInterval(() => {
          updateSlidePosition(currentIdx + 1);
        }, intervalSec * 1000);
      }
    };

    appAutogestionCarouselGoTo = (targetIdx, delta = 0) => {
      if (typeof targetIdx === 'number') {
        updateSlidePosition(targetIdx);
      } else {
        updateSlidePosition(currentIdx + delta);
      }
      restartAutoRotate();
    };

    if (dotsEl) {
      if (totalSlides > 1) {
        dotsEl.hidden = false;
        dotsEl.innerHTML = Array.from({ length: totalSlides })
          .map(
            (_, i) =>
              `<button type="button" class="nx-app-carousel-dot${i === 0 ? ' is-active' : ''}" data-nx-ac-dot="${i}" aria-label="Ir a tarjeta ${i + 1}"></button>`
          )
          .join('');
        dotsEl.onclick = (ev) => {
          const btn = ev.target.closest('button[data-nx-ac-dot]');
          if (!btn) return;
          const idx = Number(btn.getAttribute('data-nx-ac-dot')) || 0;
          if (appAutogestionCarouselGoTo) appAutogestionCarouselGoTo(idx, 0);
        };
      } else {
        dotsEl.hidden = true;
        dotsEl.innerHTML = '';
      }
    }

    if (!appAutogestionCarouselBoundSwipe) {
      appAutogestionCarouselBoundSwipe = true;
      let startX = 0;
      let startY = 0;
      let touching = false;

      viewportEl.addEventListener(
        'touchstart',
        (ev) => {
          if (!ev.touches || !ev.touches[0]) return;
          startX = ev.touches[0].clientX;
          startY = ev.touches[0].clientY;
          touching = true;
        },
        { passive: true }
      );

      viewportEl.addEventListener(
        'touchend',
        (ev) => {
          if (!touching || !ev.changedTouches || !ev.changedTouches[0]) return;
          touching = false;
          const dx = ev.changedTouches[0].clientX - startX;
          const dy = ev.changedTouches[0].clientY - startY;
          if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) {
            if (appAutogestionCarouselGoTo) {
              appAutogestionCarouselGoTo(null, dx < 0 ? 1 : -1);
            }
          }
        },
        { passive: true }
      );

      trackEl.addEventListener('click', (ev) => {
        const a = ev.target.closest('a[data-nx-app-carousel-link]');
        if (!a) return;
        const href = String(a.getAttribute('href') || '').trim();
        if (href.startsWith('?')) {
          ev.preventDefault();
          try {
            const params = new URLSearchParams(href);
            const q = params.get('q') || params.get('search') || '';
            if (q) {
              switchStoreView('catalogo');
              const sInp = document.getElementById('store-search-input');
              const hInp = document.getElementById('header-search-input');
              const cInp = document.getElementById('catalog-inline-search-input');
              if (sInp) sInp.value = q;
              if (hInp) hInp.value = q;
              if (cInp) cInp.value = q;
              applyCatalogFilters();
            }
          } catch (_e) {}
        }
      });
    }

    updateSlidePosition(0);
    restartAutoRotate();
  };

  const loadHomepageBanners = async () => {
    const wrapEl = document.getElementById('productos-hero-wrap');
    const carouselEl = document.getElementById('homepage-hero-carousel');
    const trackEl = document.getElementById('hero-carousel-track');
    const prevBtn = document.getElementById('btn-hero-prev');
    const nextBtn = document.getElementById('btn-hero-next');
    const dotsEl = document.getElementById('hero-carousel-dots');
    if (!wrapEl || !carouselEl || !trackEl) return;

    let banners = [];
    let intervalSec = 5;

    try {
      const res = await fetch(`${BANNERS_API_URL}?action=public_list&t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          if (Array.isArray(data.items)) {
            banners = data.items.filter((it) => it && it.activo !== false && String(it.imageUrl || '').trim() !== '');
          }
          if (typeof data.intervalSec === 'number' && data.intervalSec >= 0) {
            intervalSec = data.intervalSec;
          }
          state._publicBanners = banners;
          const nowLocal = new Date();
          const todayIso = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
          state._publicPopups = Array.isArray(data.popups)
            ? data.popups.filter((p) => {
                if (!p || p.activo === false || String(p.imageUrl || '').trim() === '') return false;
                const fIni = String(p.fechaInicio || '').trim();
                const fFin = String(p.fechaFin || '').trim();
                if (fIni && todayIso < fIni) return false;
                if (fFin && todayIso > fFin) return false;
                return true;
              })
            : [];
          state._popupDurationSec = typeof data.popupDurationSec === 'number' ? data.popupDurationSec : 6;
          state._publicAppCarousel = Array.isArray(data.appCarousel)
            ? data.appCarousel
                .filter((ac) => {
                  if (!ac || ac.activo === false || String(ac.imageUrl || '').trim() === '') return false;
                  const fIni = String(ac.fechaInicio || '').trim();
                  const fFin = String(ac.fechaFin || '').trim();
                  if (fIni && todayIso < fIni) return false;
                  if (fFin && todayIso > fFin) return false;
                  return true;
                })
                .slice(0, 10)
            : [];
          state._appCarouselIntervalSec = typeof data.appCarouselIntervalSec === 'number' ? data.appCarouselIntervalSec : 4;
          state._bannersUpdatedAt = data.updatedAt || '';
        }
      }
    } catch (_err) {
      // Mantiene el banner oficial pre-cargado si la red demora o falla
      if (state.client) wrapEl.hidden = true;
      return;
    }

    renderAppAutogestionCarousel();

    if (state.client) {
      showLoggedClientPromoPopupIfNeeded();
    }

    if (banners.length === 0 || state.client) {
      wrapEl.hidden = true;
      if (banners.length === 0) return;
    } else {
      wrapEl.hidden = false;
    }
    trackEl.innerHTML = banners
      .map((b, idx) => {
        const imgSrc = escapeHtml(resolveBannerImageSrc(b.imageUrl));
        const title = escapeHtml(String(b.titulo || `Banner ${STORE_BRAND.name} #${idx + 1}`));
        const w = Number(b.width) > 0 ? Number(b.width) : 1530;
        const h = Number(b.height) > 0 ? Number(b.height) : 370;
        const link = String(b.linkUrl || '').trim();
        const imgTag = `<img src="${imgSrc}" alt="${title}" class="productos-banner-img" width="${w}" height="${h}" ${idx === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`;
        if (link) {
          const isExternal = /^https?:\/\//i.test(link) && !link.includes('cn.com.ar') && !link.includes('paseoalberdi.ar');
          return `<div class="hero-carousel-slide${idx === 0 ? ' is-active' : ''}" data-slide-index="${idx}"><a href="${escapeHtml(link)}" class="hero-carousel-slide-link"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''}>${imgTag}</a></div>`;
        }
        return `<div class="hero-carousel-slide${idx === 0 ? ' is-active' : ''}" data-slide-index="${idx}">${imgTag}</div>`;
      })
      .join('');

    let currentIdx = 0;
    const total = banners.length;
    let timerId = null;
    let isHovered = false;

    const updateCarouselView = (idx) => {
      currentIdx = ((idx % total) + total) % total;
      trackEl.style.transform = `translate3d(-${currentIdx * 100}%, 0, 0)`;
      trackEl.querySelectorAll('.hero-carousel-slide').forEach((sl, i) => {
        sl.classList.toggle('is-active', i === currentIdx);
      });
      if (dotsEl) {
        dotsEl.querySelectorAll('.hero-carousel-dot').forEach((d, i) => {
          const active = i === currentIdx;
          d.classList.toggle('is-active', active);
          d.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      }
    };

    const stopAutoPlay = () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    const startAutoPlay = () => {
      stopAutoPlay();
      if (total <= 1 || intervalSec <= 0 || isHovered) return;
      timerId = setInterval(() => {
        updateCarouselView(currentIdx + 1);
      }, intervalSec * 1000);
    };

    if (total > 1) {
      if (prevBtn) {
        prevBtn.hidden = false;
        prevBtn.onclick = () => {
          updateCarouselView(currentIdx - 1);
          startAutoPlay();
        };
      }
      if (nextBtn) {
        nextBtn.hidden = false;
        nextBtn.onclick = () => {
          updateCarouselView(currentIdx + 1);
          startAutoPlay();
        };
      }
      if (dotsEl) {
        dotsEl.hidden = false;
        dotsEl.innerHTML = banners
          .map(
            (b, i) =>
              `<button type="button" class="hero-carousel-dot${i === 0 ? ' is-active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-label="Ir al banner ${i + 1}: ${escapeHtml(b.titulo || '')}" data-hero-dot="${i}"></button>`
          )
          .join('');
        dotsEl.onclick = (ev) => {
          const dot = ev.target.closest('button[data-hero-dot]');
          if (!dot) return;
          updateCarouselView(Number(dot.getAttribute('data-hero-dot')) || 0);
          startAutoPlay();
        };
      }

      carouselEl.addEventListener('mouseenter', () => {
        isHovered = true;
        stopAutoPlay();
      });
      carouselEl.addEventListener('mouseleave', () => {
        isHovered = false;
        startAutoPlay();
      });

      let touchStartX = 0;
      carouselEl.addEventListener(
        'touchstart',
        (ev) => {
          if (ev.touches && ev.touches[0]) {
            touchStartX = ev.touches[0].clientX;
            stopAutoPlay();
          }
        },
        { passive: true }
      );
      carouselEl.addEventListener(
        'touchend',
        (ev) => {
          if (ev.changedTouches && ev.changedTouches[0] && touchStartX) {
            const diff = ev.changedTouches[0].clientX - touchStartX;
            if (Math.abs(diff) > 40) {
              updateCarouselView(diff < 0 ? currentIdx + 1 : currentIdx - 1);
            }
          }
          touchStartX = 0;
          startAutoPlay();
        },
        { passive: true }
      );

      startAutoPlay();
    } else {
      if (prevBtn) prevBtn.hidden = true;
      if (nextBtn) nextBtn.hidden = true;
      if (dotsEl) {
        dotsEl.hidden = true;
        dotsEl.innerHTML = '';
      }
      trackEl.style.transform = 'translate3d(0, 0, 0)';
    }
  };

  // Auto-borrado automático de ejemplos / valores por defecto del sistema al enfocar o escribir en cualquier campo
  const CARRITO_AUTO_CLEAR_DEFAULTS = new Set([
    'S/N',
    'S/D',
    '...',
    '—',
    '-',
    '00-00000000-0',
    '00.000.000',
    '00000000',
    '0',
    '0.0',
    '0.00',
    '0.000',
    '0,0',
    '0,00',
    '0,000'
  ]);

  function tryClearCarritoSystemExample(el) {
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
    if (el.readOnly || el.disabled) return;
    const type = String(el.type || 'text').toLowerCase();
    if (['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color', 'range', 'date', 'time', 'datetime-local', 'month', 'week', 'hidden'].includes(type)) {
      return;
    }
    const rawVal = String(el.value || '');
    const trimmedUpper = rawVal.trim().toUpperCase();
    if (!trimmedUpper) return;

    const idLower = String(el.id || '').toLowerCase();
    const phUpper = String(el.placeholder || '').trim().toUpperCase();
    const isCpDefault =
      (idLower.endsWith('-cp') || idLower.endsWith('-cp-fiscal')) &&
      (trimmedUpper === '5813' || trimmedUpper === String(STORE_BRAND?.defaultCp || '5813').toUpperCase());
    const isExamplePrefix = trimmedUpper.startsWith('EJ:') || trimmedUpper.startsWith('EJ.');
    const isSameAsPlaceholder =
      phUpper &&
      trimmedUpper === phUpper &&
      (phUpper === 'S/N' || phUpper === 'S/D' || phUpper === '5813' || phUpper === '00-00000000-0' || phUpper === '00.000.000' || phUpper.startsWith('EJ:'));

    if (CARRITO_AUTO_CLEAR_DEFAULTS.has(trimmedUpper) || isCpDefault || isExamplePrefix || isSameAsPlaceholder) {
      el.value = '';
      return;
    }

    if (idLower.includes('numero')) {
      const mPre = trimmedUpper.match(/^(?:S\/N|S\/D)\s*(.+)$/i);
      if (mPre && mPre[1].trim()) {
        el.value = mPre[1].trim() === 'S/N' ? '' : mPre[1].trim();
      }
    }
  }

  document.addEventListener('pointerdown', (e) => {
    const el = e.target;
    if (el && document.activeElement !== el) {
      tryClearCarritoSystemExample(el);
    }
  }, true);

  document.addEventListener('focusin', (e) => {
    tryClearCarritoSystemExample(e.target);
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
    if (el.readOnly || el.disabled) return;
    const rawVal = String(el.value || '');
    if (!rawVal) return;

    const idLower = String(el.id || '').toLowerCase();
    let cleaned = rawVal;

    if (idLower.includes('numero') || /^(?:S\/N|S\/D)\s*\S+/i.test(rawVal) || /\S+\s*(?:S\/N|S\/D)$/i.test(rawVal)) {
      const mPre = cleaned.match(/^(?:S\/N|S\/D)\s*(.+)$/i);
      if (mPre && mPre[1].trim() && !/^(?:S\/N|S\/D)$/i.test(mPre[1].trim())) {
        cleaned = mPre[1];
      }
      const mSuf = cleaned.match(/^(.+?)\s*(?:S\/N|S\/D)$/i);
      if (mSuf && mSuf[1].trim() && !/^(?:S\/N|S\/D)$/i.test(mSuf[1].trim())) {
        cleaned = mSuf[1];
      }
    }

    if (idLower.includes('doc') || /^(?:00-00000000-0|00\.000\.000|00000000)\s*\d+/i.test(cleaned)) {
      const mDocPre = cleaned.match(/^(?:00-00000000-0|00\.000\.000|00000000)\s*(.+)$/i);
      if (mDocPre && mDocPre[1].trim()) {
        cleaned = mDocPre[1];
      }
      const mDocSuf = cleaned.match(/^(.+?)\s*(?:00-00000000-0|00\.000\.000|00000000)$/i);
      if (mDocSuf && mDocSuf[1].trim()) {
        cleaned = mDocSuf[1];
      }
    }

    if (cleaned !== rawVal) {
      el.value = cleaned;
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    window.__CARRITO_BOOTED__ = true;
    readUrlQueryParams();
    loadSavedSession();
    bindClientPortalEvents();
    syncAuthUi();
    initStoreEvents();
    loadHomepageBanners();
    loadStoreCatalog();
    loadGeoCatalogFromClientesApi();
    if (state.client) {
      loadClientPortalData();
    }
  });
})();
