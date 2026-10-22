"""
Instala o actualiza en el VPS el montaje del informe del Consejo (Leslie/Consejo/).

Baja de GitHub (repositorio público), fijado a un commit, el código que usan
scripts/preparar_consejo.py y scripts/montar_consejo.py, y crea las carpetas de
ejemplos con permiso de escritura para n8n (que corre con otro usuario y copia
ahí los informes de ejemplo desde Storage). Los ejemplos no están en el
repositorio: son informes reales.

Uso, por el pythonrunner:
    {"script": "Leslie/instalar_consejo.py", "args": ["<commit>"]}
    {"script": "Leslie/instalar_consejo.py", "args": ["--verificar"]}   # lista lo instalado

Salida: JSON por stdout, con la ruta, el tamaño y el SHA-256 de cada fichero.
"""
import hashlib
import json
import os
import sys
import urllib.request
from pathlib import Path

REPO = "leonardojcddev/Polarier-App"
BASE = Path(__file__).resolve().parent / "Consejo"

FICHEROS = [
    "src/excel_eval.py",
    "src/formato_excel.py",
    "src/tablas_informe.py",
    "src/constructores_tablas.py",
    "src/table_markers.py",
    "src/monthly_docx_ingestion.py",
    "src/template_cloner.py",
    "src/docx_content_replacer.py",
    "src/report_builder.py",
    "scripts/preparar_consejo.py",
    "scripts/montar_consejo.py",
    "config/table_markers.yaml",
    "config/marker_mapping.yaml",
    "templates/master/consejo_direccion_master.docx",
]
CARPETAS_N8N = ["ejemplos/entrada", "ejemplos/informes", "ejemplos/aprobados", "ejemplos/analisis"]


def sha(ruta: Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


def carpeta(ruta: Path, abierta: bool) -> None:
    ruta.mkdir(parents=True, exist_ok=True)
    if abierta:  # n8n escribe con otro usuario
        for p in [ruta] + list(ruta.parents):
            if p == BASE.parent:
                break
            os.chmod(p, 0o777)


def listar() -> list:
    return [{"ruta": str(p.relative_to(BASE)), "bytes": p.stat().st_size, "sha256": sha(p)}
            for p in sorted(BASE.rglob("*")) if p.is_file() and "trabajo" not in p.parts]


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--verificar":
        print(json.dumps({"ok": True, "base": str(BASE), "ficheros": listar()}))
        return
    if len(sys.argv) < 2 or len(sys.argv[1]) < 7:
        raise ValueError("falta el commit (sha) del que bajar el código")
    commit = sys.argv[1]
    for c in CARPETAS_N8N:
        carpeta(BASE / c, abierta=True)
    carpeta(BASE / "trabajo", abierta=False)
    instalados = []
    for rel in FICHEROS:
        url = f"https://raw.githubusercontent.com/{REPO}/{commit}/consejo-direccion/{rel}"
        with urllib.request.urlopen(url, timeout=60) as r:
            datos = r.read()
        destino = BASE / rel
        carpeta(destino.parent, abierta=False)
        destino.write_bytes(datos)
        instalados.append({"ruta": rel, "bytes": len(datos), "sha256": hashlib.sha256(datos).hexdigest()})
    print(json.dumps({"ok": True, "commit": commit, "base": str(BASE), "instalados": instalados}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}))
