# Diseño neoformista (lobby, chat y login)

Rediseño aprobado por Leo el 2026-10-16, sección a sección, sobre vistas previas en un canvas de Claude (*«Polarier Auto — Lobby neoformista»*) antes de tocar la app. Rama `leslie/rediseno-neoformista`.

## Reglas que aprobó Leo

- **Fondo:** mosaico de iconos de lavandería. **Amarillo en claro, azul en oscuro**, con los colores rebajados respecto a las imágenes originales, que estaban muy vivas.
- **Lobby y login:** las superficies son **del mismo color que el fondo** y salen en relieve (neomorfismo). El texto es oscuro.
  - **Cambio del 2026-10-16:** en el lobby, del input para abajo las superficies son **blancas**: la barra de input, los accesos (Auditoría, Mis documentos…), «Continuar donde lo dejaste» y los documentos recientes. Esas secciones usan el ámbito `.neo-chat`. La cabecera y el saludo siguen en el color del fondo.
  - **Tono (2026-10-16):** Leo eligió entre seis tonos claros, en el tablero «Tonos» del canvas. Las superficies no son blancas puras: son **crema vainilla `#FAEFD4` en claro** y **azul hielo `#EAEFFC` en oscuro**, con pozos `#EEDDB2` y `#D7DFF6`. El 2026-10-19 Leo confirmó que valen también para el **chat, las barras laterales y la auditoría**. Los tonos viven en los ámbitos `.neo-chat` y `.neo-audit`: ya no hay clase aparte. La barra de input (lobby y chat) toma el color de la superficie con `.neo-well-surface`, y `.neo-white-btn` usa `--neo-white`, que es la superficie en esos ámbitos y blanco en el login. Los campos del login siguen blancos.
- **Chat:** el amarillo o el azul **solo en el fondo**. Las superficies (barra lateral, cabecera, burbujas, barra de input) son **claras** (crema vainilla / azul hielo desde el 2026-10-19). En claro juegan con **blanco y azul marino**, y en oscuro con **blanco y amarillo**. La barra lateral es blanca en los dos temas.
- **Login:** los campos de correo y contraseña llevan **fondo blanco**. El logo va sin placa detrás.
- **Botones uniformes:** solo hay **uno principal relleno** (Enviar, Iniciar sesión, tus burbujas): azul marino en claro y dorado/amarillo en oscuro. **Todo lo demás es secundario en relieve**, con el icono en el color de acento. Las etiquetas de tipo de fichero (PDF, XLS…) son todas iguales.
- **Micrófono en la barra de input** del lobby y del chat. Tiene tres estados:
  1. Grabando: X para cancelar, tiempo y cuadrado para terminar.
  2. Revisar: escuchar, descartar o enviar.
  3. Enviada.

## Cómo está hecho

- **Fondos:** `public/backgrounds/fondo-claro.svg` y `fondo-oscuro.svg`. Son mosaicos SVG sin costuras que no pierden calidad y sustituyen a los `.webp` antiguos. Salen de `scripts/generar-fondos.py` (`python scripts/generar-fondos.py public/backgrounds`). Los colores (`#F0D274` / `#23347C`) están en ese script.
- **Estilos:** capa `@layer components` en `src/index.css`. Hay dos ámbitos que fijan las variables `--neo-*`:
  - `.neo-ground`: lobby y `AuthCard`, es decir, login, registro y recuperar contraseña.
  - `.neo-chat`: `Chat.tsx` y `AppSidebar`.
  - Las clases `.neo-raised`, `.neo-inset`, `.neo-primary`, `.neo-field`, `.neo-strip`… solo leen esas variables. Para cambiar un color basta tocar el ámbito.
- `.neo-ground` también reescribe algunos tokens de shadcn (`--foreground`, `--card`…). Así registro y recuperar contraseña, que siguen con clases shadcn, se leen bien sobre el amarillo.
- **Logo:** el original es todo amarillo y desaparece sobre el fondo claro. Por eso existe `src/assets/polarier-logo-azul.png`, el mismo dibujo en `#30397F`, y `PolarierLogo` elige uno u otro:
  - `tone="auto"`: azul en claro y amarillo en oscuro.
  - `tone="azul"`: siempre azul, sobre blanco.
- **Input:** `ChatInput` se usa en el chat y en el lobby (`variant="lobby"`). La nota de voz grabada en el lobby crea el chat y entra como `initialFile`, por el mismo camino que un audio del chat.
- Tipografía: Plus Jakarta Sans dentro de los dos ámbitos.

## Módulo de auditoría (2026-10-16)

- **Mismo criterio que el chat:**
  - El amarillo o el azul solo en el fondo.
  - Superficies claras (crema vainilla / azul hielo), con azul marino en claro y amarillo/ocre en oscuro.
  - Barra lateral blanca en relieve, con el hotel en un recuadro hundido.
  - Quien no es solo auditor tiene además «Volver al inicio».
- **Ámbito `.neo-audit`** (en `AuditLayout`): fija las `--neo-*` y además reescribe los tokens de shadcn, porque formularios, tablas y dashboard siguen usando `bg-card`, `text-primary`, `border-border`… En oscuro:
  - `--primary` es ocre, porque también se usa como color de texto sobre blanco.
  - `--secondary` es amarillo: es el de los botones rellenos.
  - La cabecera de las tablas (`.tbl-head`) y los paneles del dashboard (`.polarier-head`) pasan a amarillo con texto oscuro.
  - La banda superior del dashboard sigue siendo azul marino en los dos temas.
- Tarjetas y cabeceras de página con `neo-raised-sm`. Botones de añadir fila, Volver y Guardar borrador como secundarios en relieve, y Completar como principal.
- Como ya no hay superficies oscuras, se quitaron las variantes `dark:` del dashboard.
- **Lobby:** tarjeta «Auditoría» para quien tiene algún rol en el módulo (`hasAuditAccess`). Va la primera de los accesos y en móvil ocupa las dos columnas.

## Fuera de alcance / pendiente

- **Documentos, Historial y Configuración no se han rediseñado.** Desde el 2026-10-16 tienen el mismo fondo de mosaico y la barra lateral blanca. Su contenido va dentro de `.neo-ground` (en `AppLayout`), que adapta los tokens de shadcn, pero conserva sus componentes de antes.
- El estado «transcribiendo» de las vistas previas no se implementó: la app no pasa la voz a texto, el audio se envía tal cual a n8n.
- La grabación se probó con un micrófono real el 2026-10-16 y funciona (grabar, revisar y enviar). Falta probarla en Android. La lógica es la de antes; lo nuevo es el paso de revisión antes de enviar.
