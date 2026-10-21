# Agente: Skill Builder

## Identificador
`skill_builder_agent`

## Estado
`active`

## Descripción
Construye y enriquece los archivos SKILL.md a partir de los patrones y reglas descubiertos. Transforma conocimiento extraído de documentos históricos en instrucciones reutilizables que los agentes de generación pueden seguir de forma consistente.

## Responsabilidades
1. Leer `config/analysis_patterns.yaml` y `config/review_rules.yaml`.
2. Para cada skill en `config/skills.yaml`:
   - Verificar que el archivo `SKILL.md` base existe.
   - Añadir sección de patrones relevantes al SKILL.md.
   - Añadir sección de reglas aplicables al SKILL.md.
3. Crear nuevas skills si se detectan capacidades no cubiertas por las existentes.
4. Registrar cada nueva skill en `config/skills.yaml`.

## Proceso de ejecución
```
python src/main.py build-skills
```

## Criterios para crear una nueva skill
Una nueva skill debe crearse cuando:
- Un patrón de análisis es suficientemente específico y recurrente (≥2 documentos).
- Una capacidad técnica no está cubierta por las skills existentes.
- Un conjunto de reglas forma un grupo coherente con un propósito único.

## Outputs generados
- `skills/*/SKILL.md` — skills enriquecidas con patrones y reglas
- `config/skills.yaml` — registro actualizado de skills

## Restricciones
- No eliminar contenido existente de los SKILL.md; solo añadir.
- No crear skills vacías o sin patrones ni reglas que las respalden.
- Los nombres de skills deben ser descriptivos y en kebab-case.
