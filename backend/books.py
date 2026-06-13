"""Book data: Open Library (metadata, covers, TOC) + Project Gutenberg (legal free text).

Everything keyless and free. Legality matters for the app stores: full text is only
linked when Open Library marks the work `ebook_access == "public"` (public-domain
scans) or Project Gutenberg hosts it. Copyrighted books get a study plan built from
real metadata/TOC — never a pirated PDF.
"""
import re
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus

import httpx

_HEADERS = {"User-Agent": "SoloLevelingCouncil/1.0 (study planner; contact: app owner)"}

SEARCH_URL = "https://openlibrary.org/search.json"
COVER_URL = "https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"
GUTENBERG_OPDS = "https://www.gutenberg.org/ebooks/search.opds/?query={q}"


async def search_book(title: str, author: str = "") -> dict | None:
    """One Open Library search; sort=editions surfaces the canonical work."""
    params = {
        "title": title,
        "sort": "editions",
        "limit": "3",
        "fields": "key,title,author_name,first_publish_year,cover_i,edition_count,"
                  "ebook_access,ia,number_of_pages_median,subject",
    }
    if author.strip():
        params["author"] = author
    async with httpx.AsyncClient(timeout=25.0, headers=_HEADERS) as client:
        resp = await client.get(SEARCH_URL, params=params)
        resp.raise_for_status()
        docs = resp.json().get("docs") or []
    if not docs:
        return None
    d = docs[0]
    return {
        "ol_work_key": d.get("key") or "",
        "title": d.get("title") or title,
        "author": ", ".join(d.get("author_name") or []) or author,
        "first_publish_year": d.get("first_publish_year"),
        "cover_url": COVER_URL.format(cover_i=d["cover_i"]) if d.get("cover_i") else "",
        "ebook_access": d.get("ebook_access") or "",
        "ia_ids": d.get("ia") or [],
        "pages": d.get("number_of_pages_median"),
        "subjects": (d.get("subject") or [])[:12],
    }


async def get_toc(ol_work_key: str) -> list[str]:
    """Scan a work's editions for the first real table of contents (crowdsourced, often absent)."""
    if not ol_work_key:
        return []
    url = f"https://openlibrary.org{ol_work_key}/editions.json"
    try:
        async with httpx.AsyncClient(timeout=25.0, headers=_HEADERS) as client:
            resp = await client.get(url, params={"limit": "50"})
            resp.raise_for_status()
            entries = resp.json().get("entries") or []
    except httpx.HTTPError:
        return []
    for e in entries:
        toc = e.get("table_of_contents") or []
        titles = [t.get("title") or t.get("label") or "" for t in toc if isinstance(t, dict)]
        titles = [t.strip() for t in titles if t and t.strip()]
        if len(titles) >= 3:
            return titles[:40]
    return []


async def gutenberg_lookup(title: str, author: str = "") -> dict | None:
    """Official Project Gutenberg OPDS search → text + reader URLs (public domain only)."""
    q = quote_plus(f"{title} {author}".strip())
    try:
        async with httpx.AsyncClient(timeout=25.0, headers=_HEADERS, follow_redirects=True) as client:
            resp = await client.get(GUTENBERG_OPDS.format(q=q))
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
    except (httpx.HTTPError, ET.ParseError):
        return None
    ns = {"a": "http://www.w3.org/2005/Atom"}
    for entry in root.findall("a:entry", ns):
        eid = (entry.findtext("a:id", default="", namespaces=ns) or "")
        m = re.search(r"/ebooks/(\d+)", eid)
        if not m:
            for link in entry.findall("a:link", ns):
                m = re.search(r"/ebooks/(\d+)", link.get("href") or "")
                if m:
                    break
        if m:
            gid = m.group(1)
            return {
                "gutenberg_id": gid,
                "text_url": f"https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.txt",
                "reader_url": f"https://www.gutenberg.org/ebooks/{gid}",
            }
    return None


async def resolve_free_text(meta: dict) -> dict:
    """Legal free-text links for a book, or empty strings. Only for public works."""
    out = {"free_text_url": "", "free_reader_url": ""}
    if (meta.get("ebook_access") or "") != "public":
        return out
    pg = await gutenberg_lookup(meta.get("title") or "", meta.get("author") or "")
    if pg:
        out["free_text_url"] = pg["text_url"]
        out["free_reader_url"] = pg["reader_url"]
        return out
    ia = meta.get("ia_ids") or []
    if ia:
        out["free_reader_url"] = f"https://archive.org/details/{ia[0]}"
    return out
