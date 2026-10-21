"""Localiza y clasifica documentos históricos DOCX y PDF."""

from pathlib import Path
from dataclasses import dataclass, field
from typing import List


DRAFTS_DIR = Path("data/historical/drafts_docx")
FINALS_DIR = Path("data/historical/final_pdfs")


@dataclass
class HistoricalDocument:
    path: Path
    doc_type: str  # "draft_docx" | "final_pdf"
    filename: str = field(init=False)

    def __post_init__(self):
        self.filename = self.path.name


def find_draft_docx(base_dir: Path = DRAFTS_DIR) -> List[HistoricalDocument]:
    """Devuelve todos los DOCX en el directorio de borradores."""
    if not base_dir.exists():
        return []
    return [
        HistoricalDocument(path=p, doc_type="draft_docx")
        for p in sorted(base_dir.glob("*.docx"))
    ]


def find_final_pdfs(base_dir: Path = FINALS_DIR) -> List[HistoricalDocument]:
    """Devuelve todos los PDF en el directorio de finales."""
    if not base_dir.exists():
        return []
    return [
        HistoricalDocument(path=p, doc_type="final_pdf")
        for p in sorted(base_dir.glob("*.pdf"))
    ]


def load_all_historical(
    drafts_dir: Path = DRAFTS_DIR,
    finals_dir: Path = FINALS_DIR,
) -> dict:
    """Carga y clasifica todos los documentos históricos disponibles."""
    drafts = find_draft_docx(drafts_dir)
    finals = find_final_pdfs(finals_dir)

    return {
        "drafts": drafts,
        "finals": finals,
        "total": len(drafts) + len(finals),
        "summary": {
            "drafts_count": len(drafts),
            "finals_count": len(finals),
            "drafts_files": [d.filename for d in drafts],
            "finals_files": [f.filename for f in finals],
        },
    }


def validate_historical_dirs() -> dict:
    """Comprueba que existen los directorios de documentos históricos."""
    return {
        "drafts_dir_exists": DRAFTS_DIR.exists(),
        "finals_dir_exists": FINALS_DIR.exists(),
        "drafts_dir_path": str(DRAFTS_DIR),
        "finals_dir_path": str(FINALS_DIR),
    }
