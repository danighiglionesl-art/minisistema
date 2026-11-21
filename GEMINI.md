# Reglas de Diseño — MiniSistema

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
