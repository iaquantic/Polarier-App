# Diseño neoformista (lobby, chat y login)

Rediseño aprobado por Leo el 2026-10-16, sección a sección, sobre vistas previas en un canvas de Claude (*«Polarier Auto — Lobby neoformista»*) antes de tocar la app. Rama `leslie/rediseno-neoformista`.

## Reglas que aprobó Leo

- **Fondo:** mosaico de iconos de lavandería. **Amarillo en claro, azul en oscuro**, con los colores rebajados respecto a las imágenes originales, que estaban muy vivas.
- **Lobby y login:** las superficies son **del mismo color que el fondo** y salen en relieve (neomorfismo). El texto es oscuro.
- **Chat:** el amarillo o el azul **solo en el fondo**. Las superficies (barra lateral, cabecera, burbujas, barra de input) son **blancas**. En claro juegan con **blanco y azul marino**, y en oscuro con **blanco y amarillo**. La barra lateral es blanca en los dos temas.
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

## Fuera de alcance / pendiente

- **Documentos, Historial y Configuración no se han rediseñado.** Desde el 2026-10-16 tienen el mismo fondo de mosaico y la barra lateral blanca. Su contenido va dentro de `.neo-ground` (en `AppLayout`), que adapta los tokens de shadcn, pero conserva sus componentes de antes. El módulo de auditoría no se ha tocado.
- El estado «transcribiendo» de las vistas previas no se implementó: la app no pasa la voz a texto, el audio se envía tal cual a n8n.
- La grabación no se ha probado con un micrófono real ni en Android. La lógica es la de antes; lo nuevo es el paso de revisión antes de enviar.
