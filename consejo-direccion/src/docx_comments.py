"""Extrae y clasifica comentarios de revisión de archivos DOCX."""

from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional
import re

try:
    from docx import Document
    from docx.oxml.ns import qn
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False


SEVERITY_KEYWORDS = {
    "error": ["incorrecto", "error", "no coincide", "equivocado", "mal", "falta"],
    "advertencia": ["revisar", "verificar", "comprobar", "inconsistente", "dudoso"],
    "sugerencia": ["mejorar", "considerar", "sugerir", "podría", "proponer"],
}

CATEGORY_KEYWORDS = {
    "datos": ["cifra", "dato", "número", "total", "suma", "valor", "porcentaje", "%"],
    "redaccion": ["redacción", "frase", "párrafo", "texto", "expresión", "palabra"],
    "estructura": ["sección", "orden", "estructura", "título", "encabezado"],
    "tono": ["tono", "formal", "informal", "registro", "lenguaje"],
    "coherencia": ["coherencia", "consistente", "contradicción", "coincide"],
}


@dataclass
class ReviewComment:
    source_file: str
    author: Optional[str]
    text: str
    paragraph_context: str
    severity: str = "advertencia"
    category: str = "redaccion"
    rule_id: Optional[str] = None

    def classify(self):
        text_lower = self.text.lower()
        for sev, keywords in SEVERITY_KEYWORDS.items():
            if any(k in text_lower for k in keywords):
                self.severity = sev
                break
        for cat, keywords in CATEGORY_KEYWORDS.items():
            if any(k in text_lower for k in keywords):
                self.category = cat
                break


def extract_comments_from_docx(docx_path: Path) -> List[ReviewComment]:
    """Extrae todos los comentarios de revisión de un DOCX vía zipfile+ElementTree."""
    import zipfile
    import xml.etree.ElementTree as ET

    NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    comments: List[ReviewComment] = []

    with zipfile.ZipFile(str(docx_path)) as z:
        if "word/comments.xml" not in z.namelist():
            return comments
        with z.open("word/comments.xml") as f:
            tree = ET.parse(f)

    for comment_elem in tree.findall(f".//{{{NS}}}comment"):
        author = comment_elem.get(f"{{{NS}}}author", "")
        texts = [t.text for t in comment_elem.iter(f"{{{NS}}}t") if t.text]
        comment_text = " ".join(t.strip() for t in texts if t.strip())

        if not comment_text:
            continue

        rc = ReviewComment(
            source_file=docx_path.name,
            author=author if author else None,
            text=comment_text,
            paragraph_context="",
        )
        rc.classify()
        comments.append(rc)

    return comments


def extract_all_comments(docx_paths: List[Path]) -> List[ReviewComment]:
    """Extrae comentarios de múltiples DOCX."""
    all_comments: List[ReviewComment] = []
    for path in docx_paths:
        try:
            comments = extract_comments_from_docx(path)
            all_comments.extend(comments)
        except Exception as e:
            print(f"[WARN] No se pudieron extraer comentarios de {path.name}: {e}")
    return all_comments


def assign_rule_ids(comments: List[ReviewComment]) -> List[ReviewComment]:
    """Asigna IDs de regla correlativos a los comentarios."""
    for i, comment in enumerate(comments, start=1):
        comment.rule_id = f"RULE-{i:03d}"
    return comments
