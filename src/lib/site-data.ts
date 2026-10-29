import {
  AccompanimentPillar,
  CommercialService,
  FaqItem,
  PortfolioProject,
  SiteConfiguration,
  SolutionCategory,
  WorkflowStep,
} from "@/types/minisistema";

/**
 * Configuración inicial oficial de contactos y canales de MiniSistema.
 * Preparada como estado base para el Panel Administrativo Privado (Etapa 3),
 * sin inventar correos electrónicos ni direcciones físicas.
 */
export const INITIAL_SITE_CONFIG: SiteConfiguration = {
  whatsappNumber: "5493585095475",
  whatsappDisplay: "+54 9 358 5095475",
  whatsappUrl: "https://wa.me/5493585095475",
  defaultWhatsappMessage:
    "¡Hola! Estuve visitando la web de MiniSistema y me gustaría consultar sobre el desarrollo de un sistema a medida para mi negocio.",
  instagramUrl: "https://www.instagram.com/mini.sistema/",
  facebookUrl: "https://www.facebook.com/mini.sistema",
  commercialEmail: null, // Se configura desde el panel administrativo cuando sea proporcionado
  physicalAddress: null, // No se inventa dirección física
};

export function buildWhatsAppLink(customMessage?: string): string {
  const message = customMessage || INITIAL_SITE_CONFIG.defaultWhatsappMessage;
  return `https://wa.me/${INITIAL_SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const NAV_ITEMS = [
  { label: "Inicio", href: "#inicio" },
  { label: "Soluciones", href: "#soluciones" },
  { label: "Cómo trabajamos", href: "#como-trabajamos" },
  { label: "Nuestros proyectos", href: "#nuestros-proyectos" },
  { label: "Acompañamiento", href: "#acompanamiento" },
  { label: "Preguntas frecuentes", href: "#preguntas-frecuentes" },
  { label: "Contacto", href: "#contacto" },
] as const;

export const COMPARISON_DATA = {
  generic: {
    title: "Sistemas genéricos",
    subtitle: "Cuando tu actividad tiene que amoldarse a una estructura cerrada",
    points: [
      {
        label: "Funciones innecesarias",
        detail: "Pantallas cargadas de opciones que tu equipo no usa y complejizan la operación diaria.",
      },
      {
        label: "Procesos rígidos",
        detail: "Flujos predefinidos que obligan a cambiar tu forma de trabajar para encajar en el programa.",
      },
      {
        label: "Herramientas desconectadas",
        detail: "Planillas sueltas, mensajes y sistemas separados que obligan a cargar datos más de una vez.",
      },
      {
        label: "Limitaciones",
        detail: "Topes en roles, reportes o reglas propias de tu rubro que no podés personalizar.",
      },
      {
        label: "Dificultades para adaptarse",
        detail: "Cuando tu negocio suma una nueva etapa o modalidad, la herramienta no acompaña ese cambio.",
      },
    ],
  },
  minisistema: {
    title: "Tu propio MiniSistema",
    subtitle: "Tecnología que se adapta a vos, y no al revés",
    points: [
      {
        label: "Funciones personalizadas",
        detail: "Solo las pantallas, botones y herramientas que tu operatoria real necesita cada día.",
      },
      {
        label: "Procesos adaptados",
        detail: "El sistema respeta tu circuito comercial, administrativo u operativo tal como funciona mejor.",
      },
      {
        label: "Información organizada",
        detail: "Datos centralizados y claros para consultar clientes, stock, turnos o movimientos en un solo lugar.",
      },
      {
        label: "Automatizaciones",
        detail: "Reducción de tareas manuales repetitivas, cálculos, avisos y generación de resúmenes.",
      },
      {
        label: "Posibilidad de evolución",
        detail: "Una base pensada para incorporar nuevos módulos y funciones a medida que tu actividad crece.",
      },
    ],
  },
};

export const SOLUTION_CATEGORIES: SolutionCategory[] = [
  {
    id: "gestion",
    number: "01",
    title: "Sistemas de gestión",
    description:
      "Herramientas personalizadas para administrar clientes, productos, proveedores, inventarios, movimientos, reportes y operaciones.",
    iconName: "LayoutDashboard",
    defaultNeedPreselect: ["Gestión de clientes", "Administración de productos", "Control de stock", "Reportes"],
    previewLabel: "Panel de control, inventario y cuentas corrientes",
  },
  {
    id: "tiendas",
    number: "02",
    title: "Tiendas online y marketplaces",
    description:
      "Soluciones para mostrar productos, recibir pedidos, gestionar carritos, integrar pagos y administrar ventas.",
    iconName: "ShoppingBag",
    defaultNeedPreselect: ["Ventas online", "Pedidos", "Administración de productos", "Cobranzas"],
    previewLabel: "Catálogo interactivo, carrito y gestión de pedidos",
  },
  {
    id: "pwa",
    number: "03",
    title: "Aplicaciones web y PWA",
    description:
      "Aplicaciones accesibles desde navegadores, con posibilidad de instalación en dispositivos compatibles.",
    iconName: "Smartphone",
    defaultNeedPreselect: ["Gestión de clientes", "Pedidos", "Reportes"],
    previewLabel: "Experiencia ágil en celulares, tablets y escritorio",
  },
  {
    id: "reservas",
    number: "04",
    title: "Reservas y turnos",
    description:
      "Sistemas para gestionar reservas, turnos, inscripciones, disponibilidad y confirmaciones.",
    iconName: "CalendarCheck",
    defaultNeedPreselect: ["Reservas o turnos", "Gestión de clientes"],
    previewLabel: "Agenda inteligente, cupos y confirmaciones",
  },
  {
    id: "institucional",
    number: "05",
    title: "Plataformas institucionales",
    description:
      "Herramientas para clubes, bibliotecas, asociaciones civiles, cooperativas y otras organizaciones.",
    iconName: "Building2",
    defaultNeedPreselect: ["Gestión de clientes", "Cobranzas", "Reservas o turnos", "Reportes"],
    previewLabel: "Padrón de socios, préstamos, cuotas y actividades",
  },
  {
    id: "automatizaciones",
    number: "06",
    title: "Automatizaciones e integraciones",
    description:
      "Digitalización de tareas repetitivas e integración con herramientas y servicios externos compatibles.",
    iconName: "Workflow",
    defaultNeedPreselect: ["Automatización de tareas", "Integraciones", "Reportes"],
    previewLabel: "Sincronización de procesos y servicios externos",
  },
  {
    id: "especializadas",
    number: "07",
    title: "Plataformas especializadas",
    description:
      "Soluciones para industrias, distribuidoras, productores, servicios y actividades con procesos específicos.",
    iconName: "Factory",
    defaultNeedPreselect: ["Control de stock", "Pedidos", "Reportes", "Automatización de tareas"],
    previewLabel: "Trazabilidad, logística, producción y circuitos a medida",
  },
  {
    id: "idea-propia",
    number: "08",
    title: "Tu propia idea",
    description:
      "¿Necesitás algo diferente? Contanos tu proyecto y analizaremos cómo convertirlo en una solución digital.",
    iconName: "Sparkles",
    defaultNeedPreselect: ["Otra necesidad"],
    previewLabel: "Análisis personalizado para proyectos únicos",
  },
];

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    number: "01",
    title: "Escuchamos",
    description:
      "Nos contás qué necesitás, cómo funciona tu actividad y qué te gustaría mejorar.",
    highlight: "Entendemos tu realidad sin tecnicismos",
  },
  {
    number: "02",
    title: "Analizamos",
    description:
      "Estudiamos tus procesos y definimos las características que debería tener tu solución.",
    highlight: "Relevamiento claro de cada etapa",
  },
  {
    number: "03",
    title: "Proponemos",
    description:
      "Preparamos una propuesta que contempla funcionalidades, etapas, tiempos y presupuesto.",
    highlight: "Alcance transparente y a medida",
  },
  {
    number: "04",
    title: "Desarrollamos",
    description:
      "Construimos el sistema y realizamos las pruebas necesarias.",
    highlight: "Diseño limpio, seguro y adaptado",
  },
  {
    number: "05",
    title: "Implementamos",
    description:
      "Te ayudamos a ponerlo en funcionamiento y a comenzar a utilizarlo.",
    highlight: "Puesta en marcha acompañada",
  },
  {
    number: "06",
    title: "Acompañamos",
    description:
      "Ofrecemos mantenimiento, soporte y posibilidades de evolución para que tu MiniSistema siga respondiendo a tus necesidades.",
    highlight: "Aliado tecnológico a largo plazo",
  },
];

export const ACCOMPANIMENT_PILLARS: AccompanimentPillar[] = [
  {
    id: "desarrollamos",
    title: "DESARROLLAMOS",
    description: "Construimos una solución específica para tu actividad.",
    stageLabel: "Etapa Inicial · Base a medida",
    modulesAdded: ["Núcleo de gestión personalizado", "Panel principal adaptado", "Acceso web y móvil"],
  },
  {
    id: "implementamos",
    title: "IMPLEMENTAMOS",
    description: "Te ayudamos a ponerla en funcionamiento.",
    stageLabel: "Puesta en marcha · Operación real",
    modulesAdded: ["Configuración inicial", "Organización de datos", "Acompañamiento de arranque"],
  },
  {
    id: "mantenemos",
    title: "MANTENEMOS",
    description: "Ofrecemos servicios de soporte, mantenimiento y actualización según el plan contratado.",
    stageLabel: "Continuidad · Cuidado operativo",
    modulesAdded: ["Monitoreo y estabilidad", "Actualizaciones técnicas", "Soporte según plan acordado"],
  },
  {
    id: "evolucionamos",
    title: "EVOLUCIONAMOS",
    description: "Analizamos e incorporamos nuevas funcionalidades para acompañar el crecimiento de tu negocio.",
    stageLabel: "Expansión · Nuevos módulos",
    modulesAdded: ["Nuevas sucursales o roles", "Integración de cobros y envíos", "Reportes y automatizaciones avanzadas"],
  },
];

export const COMMERCIAL_SERVICES: CommercialService[] = [
  {
    id: "desarrollo-inicial",
    number: "SERVICIO 1",
    badge: "Proyecto a medida",
    title: "DESARROLLO INICIAL",
    headline: "Creamos tu MiniSistema.",
    description:
      "Diseñamos y desarrollamos una solución digital de acuerdo con las necesidades y objetivos de tu actividad.",
    itemsLabel: "Incluye, según la propuesta acordada:",
    items: [
      "Análisis de necesidades.",
      "Definición de funcionalidades.",
      "Diseño de interfaces.",
      "Programación.",
      "Pruebas.",
      "Implementación inicial.",
      "Capacitación o acompañamiento de puesta en marcha, cuando corresponda.",
    ],
    commercialModality: "Presupuesto personalizado por proyecto.",
    ctaLabel: "Quiero desarrollar mi sistema",
  },
  {
    id: "mantenimiento-soporte",
    number: "SERVICIO 2",
    badge: "Continuidad operativa",
    title: "MANTENIMIENTO Y SOPORTE",
    headline: "Cuidamos tu MiniSistema.",
    description:
      "Ofrecemos acompañamiento técnico para mantener el sistema funcionando correctamente, prevenir inconvenientes y atender las necesidades de soporte contempladas en cada plan.",
    itemsLabel: "Puede incluir:",
    items: [
      "Mantenimiento técnico.",
      "Corrección de errores.",
      "Actualizaciones.",
      "Monitoreo.",
      "Copias de seguridad cuando corresponda.",
      "Asistencia.",
      "Soporte operativo.",
    ],
    commercialModality: "Abono mensual según el alcance y las condiciones contratadas.",
    ctaLabel: "Quiero conocer los planes de soporte",
  },
  {
    id: "evolucion-funcionalidades",
    number: "SERVICIO 3",
    badge: "Crecimiento continuo",
    title: "EVOLUCIÓN Y NUEVAS FUNCIONALIDADES",
    headline: "Hacemos crecer tu MiniSistema.",
    description:
      "Cuando tu negocio incorpora nuevas necesidades, analizamos y desarrollamos funcionalidades adicionales.",
    itemsLabel: "Ejemplos:",
    items: [
      "Nuevos módulos.",
      "Integraciones.",
      "Automatizaciones.",
      "Ampliaciones de gestión.",
      "Nuevos usuarios o roles.",
      "Nuevos canales de venta.",
      "Reportes especializados.",
      "Modificaciones funcionales.",
    ],
    commercialModality: "Presupuesto adicional o plan de evolución previamente acordado.",
    ctaLabel: "Quiero ampliar mi sistema",
  },
];

/**
 * Estructura de portafolio administrable (Sección 14).
 * Los proyectos reales mencionados en el documento maestro (Casa Nueva, Campo Directo, Biblioteca Roncedo)
 * están preparados en la estructura de datos con `published: false` hasta contar con confirmación formal
 * e imágenes aprobadas, cumpliendo estrictamente la regla de no atribuir trabajos ni métricas sin verificar.
 */
export const PORTFOLIO_PROJECTS: PortfolioProject[] = [
  {
    id: "casa-nueva",
    name: "Casa Nueva",
    description:
      "Ficha preparada en el administrador de portafolio para documentar alcance, problema resuelto y capturas una vez aprobada su publicación oficial.",
    activity: "Comercio / Equipamiento y Hogar",
    problemSolved: "Estructura lista para describir el caso real verificado desde el panel administrativo.",
    features: ["Catálogo y gestión", "Organización comercial", "Atención digital"],
    screenshots: [],
    status: "En preparación de caso",
    published: false,
  },
  {
    id: "campo-directo",
    name: "Campo Directo",
    description:
      "Ficha preparada en el administrador de portafolio para incorporar información validada, módulos e imágenes autorizadas.",
    activity: "Actividad agropecuaria / Vinculación comercial",
    problemSolved: "Estructura lista para detallar la operatoria y solución específica aprobada.",
    features: ["Operaciones específicas", "Publicación y consultas", "Acceso multi-dispositivo"],
    screenshots: [],
    status: "En preparación de caso",
    published: false,
  },
  {
    id: "biblioteca-roncedo",
    name: "Biblioteca Roncedo",
    description:
      "Ficha preparada en el administrador de portafolio para presentar la solución institucional una vez confirmados sus contenidos.",
    activity: "Institución / Gestión cultural y comunitaria",
    problemSolved: "Estructura lista para publicar funcionalidades reales verificadas.",
    features: ["Gestión de socios", "Catálogo y préstamos", "Administración institucional"],
    screenshots: [],
    status: "En preparación de caso",
    published: false,
  },
];

export const BENEFITS_LIST = [
  {
    id: "hecho-para-vos",
    title: "Hecho para vos",
    description: "No tenés que adaptar tu actividad a una herramienta genérica.",
    iconName: "Fingerprint",
  },
  {
    id: "facil-de-utilizar",
    title: "Fácil de utilizar",
    description: "Interfaces claras y adaptadas a la forma de trabajar de cada cliente.",
    iconName: "MousePointerClick",
  },
  {
    id: "informacion-organizada",
    title: "Información organizada",
    description: "Centralizá las operaciones y los datos que necesita tu negocio.",
    iconName: "Database",
  },
  {
    id: "accesible",
    title: "Accesible",
    description: "Soluciones web que pueden utilizarse desde dispositivos compatibles.",
    iconName: "MonitorSmartphone",
  },
  {
    id: "preparado-para-evolucionar",
    title: "Preparado para evolucionar",
    description: "La arquitectura puede contemplar futuras ampliaciones.",
    iconName: "TrendingUp",
  },
  {
    id: "acompanamiento-real",
    title: "Acompañamiento real",
    description: "Mantenimiento, soporte y nuevas funcionalidades mediante servicios acordados.",
    iconName: "Handshake",
  },
] as const;

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-1",
    question: "¿Qué es un sistema a medida?",
    answer:
      "Es una solución digital diseñada para responder a las necesidades y procesos particulares de una actividad.",
  },
  {
    id: "faq-2",
    question: "¿Necesito saber de informática?",
    answer:
      "No. Nos contás qué necesitás y nosotros analizamos la mejor manera de desarrollarlo.",
  },
  {
    id: "faq-3",
    question: "¿Cuánto cuesta?",
    answer:
      "Cada proyecto tiene características diferentes. Por eso elaboramos presupuestos personalizados.",
  },
  {
    id: "faq-4",
    question: "¿Puedo comenzar con algo sencillo?",
    answer:
      "Sí. Podemos diseñar un proyecto por etapas y evaluar nuevas funcionalidades en el futuro.",
  },
  {
    id: "faq-5",
    question: "¿Mi MiniSistema puede crecer?",
    answer:
      "Sí. Diseñamos soluciones considerando posibilidades de ampliación, según la arquitectura y el alcance acordados.",
  },
  {
    id: "faq-6",
    question: "¿El mantenimiento se paga mensualmente?",
    answer:
      "Ofrecemos servicios de mantenimiento y soporte mediante abonos mensuales definidos según cada proyecto.",
  },
  {
    id: "faq-7",
    question: "¿Las nuevas funcionalidades están incluidas en el mantenimiento?",
    answer:
      "No necesariamente. El desarrollo de nuevas funcionalidades constituye un servicio diferente y se presupuesta por separado o mediante un plan de evolución.",
  },
  {
    id: "faq-8",
    question: "¿Puedo utilizarlo desde mi celular?",
    answer:
      "Podemos desarrollar interfaces compatibles con dispositivos móviles y, cuando corresponda, aplicaciones web instalables.",
  },
  {
    id: "faq-9",
    question: "¿Cuánto tiempo tarda el desarrollo?",
    answer:
      "Depende de la complejidad del proyecto. Los plazos se informan en la propuesta comercial.",
  },
  {
    id: "faq-10",
    question: "¿Puedo integrar Mercado Pago u otras plataformas?",
    answer:
      "Podemos analizar integraciones con servicios que dispongan de mecanismos técnicos y condiciones comerciales compatibles.",
  },
];

export const CONFIGURATOR_STEP1_ACTIVITIES = [
  "Comercio",
  "Distribución",
  "Industria",
  "Gastronomía",
  "Servicios profesionales",
  "Actividad agropecuaria",
  "Institución o asociación",
  "Emprendimiento",
  "Otra actividad",
] as const;

export const CONFIGURATOR_STEP2_NEEDS = [
  "Gestión de clientes",
  "Administración de productos",
  "Control de stock",
  "Ventas online",
  "Pedidos",
  "Cobranzas",
  "Reservas o turnos",
  "Reportes",
  "Automatización de tareas",
  "Integraciones",
  "Otra necesidad",
] as const;

export const CONFIGURATOR_STEP3_CURRENT_SYSTEM = [
  "No, comenzamos desde cero.",
  "Sí, pero queremos reemplazarlo.",
  "Sí, y queremos complementarlo.",
  "Tenemos una idea nueva.",
] as const;

export const ARGENTINA_PROVINCES = [
  "Córdoba",
  "Buenos Aires",
  "Ciudad Autónoma de Buenos Aires",
  "Santa Fe",
  "Mendoza",
  "Entre Ríos",
  "Tucumán",
  "Salta",
  "Neuquén",
  "Río Negro",
  "San Luis",
  "La Pampa",
  "San Juan",
  "Chaco",
  "Corrientes",
  "Misiones",
  "Jujuy",
  "Santiago del Estero",
  "Chubut",
  "Santa Cruz",
  "Tierra del Fuego",
  "Catamarca",
  "La Rioja",
  "Formosa",
  "Otra / Exterior",
] as const;
