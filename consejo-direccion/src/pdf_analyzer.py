"""Analiza la estructura de los PDF finales aprobados."""

from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import re

try:
    import fitz  # PyMuPDF
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False


HEADING_MIN_SIZE = 12.0
BODY_MIN_SIZE = 9.0


@dataclass
class PdfSection:
    title: str
    page: int
    level: int  # 1 = título principal, 2 = subtítulo
    content_preview: str = ""
    metrics_mentioned: List[str] = field(default_factory=list)


@dataclass
class PdfAnalysisResult:
    source_file: str
    sections: List[PdfSection] = field(default_factory=list)
    page_count: int = 0
    all_text: str = ""
    metrics_found: List[str] = field(default_factory=list)
    patterns_found: List[str] = field(default_factory=list)


METRIC_PATTERNS = [
    r"\b\d+[\.,]\d+\s*%",
    r"\b(?:plan|real|presupuesto|meta|objetivo)\b",
    r"\b(?:CUP|MLC|USD)\b",
    r"\b(?:kg|ton|litros?|unidades?)\b",
    r"\b(?:vs\.?|versus|comparado con)\b",
]

COMPARISON_PATTERNS = [
    "plan vs real",
    "vs mes anterior",
    "vs año anterior",
    "desviación",
    "cumplimiento",
    "incremento",
    "decremento",
    "superior",
    "inferior",
]


def analyze_pdf(pdf_path: Path) -> PdfAnalysisResult:
    """Extrae estructura, secciones y métricas de un PDF final."""
    if not PDF_AVAILABLE:
        raise ImportError("PyMuPDF no está instalado. Ejecutar: pip install pymupdf")

    result = PdfAnalysisResult(source_file=pdf_path.name)
    doc = fitz.open(str(pdf_path))
    result.page_count = len(doc)

    all_text_parts = []

    for page_num, page in enumerate(doc, start=1):
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    size = span.get("size", 0)
                    if not text:
                        continue
                    all_text_parts.append(text)
                    if size >= HEADING_MIN_SIZE and len(text) > 5:
                        level = 1 if size >= HEADING_MIN_SIZE + 2 else 2
                        section = PdfSection(
                            title=text,
                            page=page_num,
                            level=level,
                        )
                        result.sections.append(section)

    result.all_text = " ".join(all_text_parts)
    result.metrics_found = _extract_metrics(result.all_text)
    result.patterns_found = _extract_patterns(result.all_text)

    doc.close()
    return result


def _extract_metrics(text: str) -> List[str]:
    found = []
    for pattern in METRIC_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        found.extend(matches)
    return list(set(found))


def _extract_patterns(text: str) -> List[str]:
    text_lower = text.lower()
    return [p for p in COMPARISON_PATTERNS if p in text_lower]


def analyze_all_pdfs(pdf_paths: List[Path]) -> List[PdfAnalysisResult]:
    """Analiza múltiples PDF finales."""
    results = []
    for path in pdf_paths:
        try:
            result = analyze_pdf(path)
            results.append(result)
        except Exception as e:
            print(f"[WARN] No se pudo analizar {path.name}: {e}")
    return results
