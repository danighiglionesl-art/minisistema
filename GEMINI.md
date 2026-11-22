# Reglas de Arquitectura y Diseño — MiniSistema

## Arquitectura Central (Unidad de Negocios)

- **Panel Maestro Único**: `www.minisistema.com.ar/sistema` con el usuario Administrador General (`@danielg`) es el **panel de administración general** de toda la unidad de negocios (todo lo diseñado y todo lo que se diseñe de ahora en más: aplicaciones, páginas web, sistemas, PWAs y servicios).
- **MiniSistema como Fuente Única de Verdad**: **MiniSistema** es el núcleo padre. **Casa Nueva ERP** (`cn.com.ar`) y **PaseoAlberdi.ar** (`paseoalberdi.ar`) pasan a ser instancias/hijos del ecosistema MiniSistema para evitar desarrollos duplicados.
- **Diseño en 3 Capas para cada nuevo producto o servicio**:
  1. **SuperAdmin (`@danielg`)**: alta de cliente/comercio, asignación de módulos, planes/precios/cobros, suspensión y control.
  2. **Panel de Administración del Cliente (`/sistema`)**: gestión operativa del producto con tarjetas uniformes y permisos por módulo/submódulo.
  3. **Cara Pública (Web / Portal / PWA)**: Opción 1 (dominio y marca propia) u Opción 2 (subruta en MiniSistema), configurable desde el panel.
- **Multi-Tenant desde el día 1**: Toda nueva funcionalidad debe aislar datos, archivos y configuraciones por `tenant` (en Supabase/Storage). Si un servicio específico conviene desplegarlo en un repositorio/proyecto Vercel separado por rendimiento o escala, debe igualmente integrarse por API/base de datos para administrarse desde MiniSistema.

## Tarjetas de Módulos y Submódulos (`.modules-grid` / `.module-card`)

- **Tamaño siempre uniforme**: Todos los módulos y submódulos deben tener **siempre el mismo tamaño** en todos los diseños y pantallas que hagamos, salvo directiva explícita en contrario.
  - Usar siempre el contenedor `.modules-grid` (`grid-template-columns: repeat(auto-fill, minmax(270px, 1fr))`, `grid-auto-rows: 1fr`, `align-items: stretch`) y tarjetas `.module-card` con `min-height: 158px` y `height: 100%`.
  - No agregar contenido extra que altere la altura o proporciones de unas tarjetas respecto de otras.
- **Sin sobretítulos / badges / pills en las tarjetas de módulos**: No colocar etiquetas superiores ni contadores pill (por ejemplo `0 turnos`, `0 evol.`, `CMS + USERS`, `ACTIVO`, etc.) dentro de las tarjetas de navegación de módulos o submódulos.
- **Sin descripciones en las tarjetas de módulos**: No incluir párrafos descriptivos (`<p>`) debajo del título `<h3>` en las tarjetas de módulos o submódulos.
- **Estructura canónica**: Cada tarjeta de módulo/submódulo lleva únicamente el ícono SVG monocromático dentro de `.module-icon` y su título en `<h3>`:
  ```html
  <article class="module-card" role="button" tabindex="0">
    <div class="module-icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">...</svg>
    </div>
    <h3>Nombre del Módulo</h3>
  </article>
  ```
