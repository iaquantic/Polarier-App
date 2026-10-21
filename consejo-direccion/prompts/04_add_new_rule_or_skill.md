# Prompt 04 — Añadir una nueva regla o skill

## Cuándo usar
Cuando la dirección identifica un nuevo error recurrente, o cuando se detecta un patrón de análisis que no está cubierto por las skills existentes.

## Instrucción para Claude Code

### Para añadir una nueva REGLA

Necesito añadir la siguiente regla al sistema:

**Descripción del problema detectado:**
[Describir aquí el error o la situación que debe evitarse]

**Ejemplo de texto incorrecto:**
[Pegar aquí un fragmento de texto que viola la regla]

**Ejemplo de texto correcto:**
[Pegar aquí cómo debería escribirse correctamente]

**Sección del informe afectada:**
[Nombre de la sección, o "global" si aplica a todo el informe]

**Severidad:**
[error | advertencia | sugerencia]

---

Realiza los siguientes pasos:

1. Clasificar la nueva regla por categoría (datos | redaccion | estructura | tono | coherencia).
2. Asignar el siguiente ID correlativo disponible en `config/review_rules.yaml`.
3. Añadir la regla al archivo YAML sin modificar las reglas existentes.
4. Identificar qué skill(s) deben actualizarse para incorporar esta regla:
   - Si es de categoría "datos" → actualizar `skills/evidence-validation/SKILL.md`
   - Si es de categoría "redaccion" o "tono" → actualizar `skills/council-report-writing/SKILL.md`
   - Si es de categoría "coherencia" → actualizar `skills/evidence-validation/SKILL.md`
5. Actualizar el SKILL.md correspondiente añadiendo la regla en la sección apropiada.
6. Confirmar que la regla quedó registrada correctamente en ambos archivos.

---

### Para añadir una nueva SKILL

Necesito crear la siguiente skill:

**Nombre de la skill:**
[nombre-en-kebab-case]

**Propósito:**
[Qué hace esta skill y cuándo se usa]

**Patrones que cubre:**
[Lista de patrones de análisis que esta skill implementa]

**Reglas que aplica:**
[IDs de las reglas RULE-NNN que esta skill hace cumplir]

---

Realiza los siguientes pasos:

1. Crear el directorio `skills/[nombre-skill]/`.
2. Copiar `skills/_skill_template/SKILL.md` al nuevo directorio.
3. Rellenar todos los campos del template con el contenido proporcionado.
4. Añadir la nueva skill a `config/skills.yaml`.
5. Si algún agente en `agents/` debe usar esta skill, actualizar su sección "Patrones de análisis".
6. Confirmar la creación mostrando la estructura del nuevo SKILL.md.

## Restricciones
- No crear una skill sin patrones ni reglas concretas que la respalden.
- No modificar el ID de reglas existentes.
- No eliminar reglas o skills al añadir nuevas.
