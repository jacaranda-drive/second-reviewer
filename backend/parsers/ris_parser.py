import rispy


def parse_ris_bytes(content: bytes) -> list[dict]:
    text = content.decode("utf-8", errors="replace")
    entries = rispy.loads(text)
    records = []
    for entry in entries:
        authors = entry.get("authors") or entry.get("first_authors") or []
        year_raw = entry.get("year") or entry.get("publication_year")
        try:
            year = int(str(year_raw)[:4]) if year_raw else None
        except (ValueError, TypeError):
            year = None

        records.append({
            "external_id": entry.get("id") or entry.get("accession_number"),
            "title": entry.get("title") or entry.get("primary_title"),
            "abstract": entry.get("abstract"),
            "year": year,
            "language": entry.get("language"),
            "authors": authors if isinstance(authors, list) else [authors],
            "source": entry.get("journal_name") or entry.get("secondary_title"),
            "url": entry.get("url") or entry.get("doi"),
        })
    return records
