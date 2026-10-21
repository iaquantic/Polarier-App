# Guía de estilo — Informes de Consejo de Dirección de Polarier

## Principios generales

- **Formalidad**: el informe se dirige a la dirección ejecutiva. Registro formal en todo momento.
- **Precisión**: cada cifra tiene su fuente. Sin estimaciones ni redondeos no explicitados.
- **Concisión**: frases directas. Sin párrafos introductivos que no aporten datos.
- **Estructura**: Contexto → Datos → Análisis → Conclusión.

---

## Normas tipográficas

### Títulos
- Nivel 1 (`#`): solo para el título principal del informe.
- Nivel 2 (`##`): para secciones principales.
- Nivel 3 (`###`): para subsecciones.
- Los títulos deben coincidir exactamente con los de `config/report_sections.yaml`.

### Cifras
- Separador de miles: punto (1.234.567)
- Separador decimal: coma (1.234,56)
- Porcentajes: con símbolo % sin espacio (12,5%)
- Monedas: anteponer la moneda al valor (CUP 1.234, MLC 567)

### Unidades
- Kilogramos: kg
- Toneladas: t
- Litros: l
- Unidades de servicio: us (o la denominación específica del sector)

---

## Vocabulario aprobado

### Verbos para describir resultados
| Correcto | Evitar |
|---|---|
| Se registró | Se vio |
| Alcanzó | Llegó a |
| Presentó | Tuvo |
| Evidenció | Mostró (informal) |
| Se situó en | Estuvo en |

### Comparaciones
| Correcto | Evitar |
|---|---|
| Superior al plan en X | Mejor que el plan |
| Inferior al plan en X | Peor que el plan |
| Desviación de +X% | Subió un X% |
| Desviación de –X% | Bajó un X% |

### Conectores de causa
| Correcto | Evitar |
|---|---|
| Debido a | Por culpa de |
| Como consecuencia de | A raíz de (informal) |
| Atribuible a | Por |
| Derivado de | Como resultado de (puede usarse) |

### Conectores de conclusión
| Correcto | Evitar |
|---|---|
| Lo que representa | Lo que es |
| Lo cual indica | Lo que dice |
| En consecuencia | Por eso |
| Esto supone | Esto significa (puede usarse) |

---

## Expresiones prohibidas

Las siguientes expresiones están prohibidas en el informe:

- `aproximadamente`, `en torno a`, `alrededor de`
- `se estima`, `se calcula`, `se supone`, `podría ser`
- `probablemente`, `parece que`, `al parecer`, `aparentemente`
- `es importante destacar que`, `cabe señalar que`, `hay que mencionar que`
- `como se puede ver`, `como se observa`, `como se aprecia`
- `hemos visto`, `vemos que`, `notamos`, `encontramos`
- `más o menos`, `aproximado`

---

## Marcadores de datos ausentes

Cuando un dato no está disponible en la tabla de entrada:

```
[dato no disponible: nombre_del_dato]
```

Cuando un dato existe pero genera dudas de coherencia:

```
[requiere revisión: descripción del problema]
```

Estos marcadores deben permanecer visibles en el borrador hasta que sean resueltos. No eliminar un marcador sin haber verificado el dato.

---

## Estructura estándar de párrafo analítico

```
[Período/Contexto], [indicador] [verbo] [valor real] [unidad].
[Comparación con plan/anterior]: [valor referencia], desviación de [±X] ([±Y%]).
[Causa o factor]: debido a [explicación basada en datos].
[Conclusión]: lo que [impacto o tendencia].
```

**Ejemplo:**
> "Durante enero de 2026, la producción total de la red registró 1.234.567 kg. El plan establecido para el período fue de 1.300.000 kg, lo que representa una desviación de –65.433 kg (–5,0%). Esta situación se debe a la reducción de capacidad operativa en las lavanderías de mayor volumen, lo cual indica la necesidad de revisar los planes de mantenimiento preventivo."
