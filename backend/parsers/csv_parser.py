import io
import json
import pandas as pd


# Covidence CSV column name aliases
COLUMN_MAP = {
    "title": ["title", "Title"],
    "abstract": ["abstract", "Abstract"],
    "year": ["year", "Year", "Publication Year"],
    "language": ["language", "Language"],
    "authors": ["authors", "Authors"],
    "source": ["journal", "Journal", "Source", "Publication"],
    "url": ["url", "URL", "DOI", "doi"],
    "external_id": ["id", "ID", "Covidence #", "Accession Number"],
    "decision": ["Consensus decision", "Decision"],
    "exclusion_reason": ["Exclusion Reasons", "Exclusion reasons", "Exclusion reason", "Reasons", "exclusion_reason"],
    "notes": ["Screening_Notes", "Screening Notes", "Notes"],
}

DECISION_MAP = {
    "include": "Include",
    "exclude": "Exclude",
    "maybe": "Uncertain",
}


def _find_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    for c in candidates:
        if c in df.columns:
            return c
    return None


def parse_csv_bytes(content: bytes) -> list[dict]:
    df = pd.read_csv(io.BytesIO(content), dtype=str)
    df = df.where(df.notna(), None)

    records = []
    for _, row in df.iterrows():
        def get(key: str):
            col = _find_col(df, COLUMN_MAP[key])
            return row[col] if col else None

        year_raw = get("year")
        try:
            year = int(str(year_raw)[:4]) if year_raw else None
        except (ValueError, TypeError):
            year = None

        authors_raw = get("authors") or ""
        if authors_raw:
            authors = [a.strip() for a in authors_raw.split(";") if a.strip()]
        else:
            authors = []

        decision_raw = get("decision")
        decision = DECISION_MAP.get(decision_raw.strip().lower(), None) if decision_raw else None

        records.append({
            "external_id": get("external_id"),
            "title": get("title"),
            "abstract": get("abstract"),
            "year": year,
            "language": get("language"),
            "authors": authors,
            "source": get("source"),
            "url": get("url"),
            "decision": decision,
            "exclusion_reason": get("exclusion_reason"),
            "notes": get("notes"),
        })
    return records
