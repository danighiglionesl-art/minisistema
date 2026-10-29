# MiniSistema — Sitio Web Oficial (`minisistema-web`)

Sitio web corporativo, institucional y comercial de **MiniSistema — Sistemas a Medida** (`https://www.minisistema.com.ar`).

> **Eslogan principal:** *Tu negocio es único. Tu sistema también debería serlo.*  
> **Eslogan de evolución:** *Tu negocio evoluciona. Tu MiniSistema también.*

---

## Identidad Visual Oficial

El sistema de diseño respeta exclusivamente los tres colores institucionales oficiales:
- **Azul petróleo oscuro:** `#112D3A`
- **Verde menta:** `#56D7A1`
- **Blanco:** `#FFFFFF`

Los archivos originales del isologotipo se conservan sin alteraciones ni reinterpretaciones en `/public/brand/`.

---

## Arquitectura del Proyecto

```text
minisistema-web/
├── public/
│   └── brand/                  # Archivos originales del isologotipo oficial
├── src/
│   ├── app/                    # App Router de Next.js (Layout, SEO, Sitemap, Robots, Rutas)
│   ├── components/
│   │   ├── layout/             # Header sticky, menú móvil, Footer, Botón flotante WhatsApp
│   │   ├── sections/           # Secciones comerciales e institucionales (Hero a CTA final)
│   │   ├── configurator/       # Configurador comercial interactivo de 6 pasos (<dialog>)
│   │   └── illustrations/      # Representaciones realistas de interfaces (marcadas como ejemplos)
│   ├── lib/                    # Datos iniciales, configuración comercial y utilidades WhatsApp
│   └── types/                  # Definiciones TypeScript de dominio (Consultas, Proyectos, Config)
├── .env.example                # Plantilla de variables de entorno sin credenciales
└── package.json
```

## Etapas de Desarrollo

- **Etapa 1 — Identidad y Diseño:** Página principal completa, isologotipo oficial, diseño responsive mobile-first y representaciones visuales originales.
- **Etapa 2 — Experiencia Comercial:** Navegación, configurador interactivo de 6 pasos, formularios, validaciones e integración con WhatsApp (`+54 9 358 5095475`).
- **Etapa 3 — Base de Datos y Administración:** Almacenamiento persistente en PostgreSQL, autenticación segura y panel administrativo privado (`/admin`).
- **Etapa 4 — Integración e Infraestructura:** GitHub privado (`main`), Vercel, variables de entorno y dominio canónico `www.minisistema.com.ar`.
- **Etapa 5 — Pruebas y Publicación:** Auditoría de rendimiento, accesibilidad, SEO, seguridad y puesta en producción tras aprobación.
