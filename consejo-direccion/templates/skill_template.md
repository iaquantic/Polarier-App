# Plantilla de skill

```markdown
# Skill: [NOMBRE LEGIBLE]

## Identificador
`nombre-en-kebab-case`

## Propósito
Una frase concisa que describe qué hace esta skill y cuándo se usa.

## Cuándo aplicar
- Situación 1 que activa esta skill.
- Situación 2 que activa esta skill.

## Proceso paso a paso

### Paso 1: [Nombre]
Descripción.

### Paso 2: [Nombre]
Descripción.

## Restricciones
- Qué NO debe hacer esta skill.

## Outputs esperados
- Tipo de output 1.
- Tipo de output 2.
```

## Convenciones de naming

| Tipo | Formato | Ejemplo |
|---|---|---|
| Identificador | kebab-case | `evidence-validation` |
| Directorio | kebab-case | `skills/evidence-validation/` |
| Archivo | SKILL.md | `skills/evidence-validation/SKILL.md` |

## Registro en skills.yaml

Al crear una nueva skill, añadir en `config/skills.yaml`:

```yaml
- id: nombre-en-kebab-case
  path: skills/nombre-en-kebab-case/SKILL.md
  status: base  # base | enriched | deprecated
  description: "Descripción de una línea."
```
