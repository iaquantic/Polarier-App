# Instalación en PC de producción (n8n)

## Requisitos previos
- Python 3.10 o superior
- Claude Code instalado y autenticado (`claude --version` debe funcionar)

## Pasos

### 1. Copiar el proyecto
Copiar esta carpeta completa al PC de destino. Ruta recomendada:
```
c:\Trabajo\Consejo Direccion Claude\polarier-consejo-direccion\
```

### 2. Instalar dependencias Python
Abrir una terminal en la carpeta del proyecto y ejecutar:
```
py -3 -m pip install -r requirements.txt
```

### 3. Verificar que funciona
```
py -3 scripts/generate_report.py
```
Debe generar `data/output/consejo_direccion_MARZO_2026.docx` sin errores
(mientras el archivo de marzo siga en `data/input/mes_actual/`).

---

## Uso mensual

### Lo que hace el usuario
Enviar el DOCX de tablas del mes por Telegram al bot (formato: `Informe MES tablas.docx`).

### Lo que hace n8n automáticamente
1. Recibe el DOCX y lo guarda en `data/input/mes_actual/`
2. Ejecuta este comando:
```
cd "c:\Trabajo\Consejo Direccion Claude\polarier-consejo-direccion" && claude -p "Genera el informe mensual del Consejo de Dirección. El DOCX de entrada ya está en data/input/mes_actual/. Sigue el flujo completo: lee las tablas, redacta todos los análisis con los agentes de agents/active/, crea el JSON en data/processed/ y ejecuta scripts/generate_report.py. No pidas confirmaciones intermedias, completa todo el proceso hasta tener el DOCX final en data/output/."
```
3. Recoge el DOCX generado de `data/output/`
4. Lo envía por Telegram al remitente
5. Borra el archivo de entrada

El comando completo también está en `prompts/n8n_claude_command.txt`.

---

## Estructura de carpetas clave

```
polarier-consejo-direccion/
├── data/
│   ├── input/mes_actual/     ← DOCX de entrada del mes (se reemplaza cada mes)
│   ├── output/               ← DOCX del informe generado
│   └── processed/            ← JSON de análisis generados por Claude
├── templates/master/         ← Plantilla maestra DOCX (no tocar)
├── agents/active/            ← Instrucciones de los agentes de análisis
├── skills/                   ← Skills de redacción
├── scripts/
│   └── generate_report.py    ← Script principal de generación
└── src/                      ← Módulos Python del sistema
```
