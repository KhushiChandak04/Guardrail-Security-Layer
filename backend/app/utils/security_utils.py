# def preview_text(text: str, max_length: int = 240) -> str:
#     stripped = " ".join(text.split())
#     if len(stripped) <= max_length:
#         return stripped
#     return stripped[:max_length] + "..."
import re
import unicodedata

OBFUSCATION_MAP = str.maketrans({
    "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
    "7": "t", "@": "a", "!": "i", "$": "s", "|": "i",
})

CLAUSE_SPLIT_REGEX = re.compile(
    r"(?:;|\bthen\b|\band\b|\bbut\b|\bafter\b|\bbefore\b|\balso\b|\bnext\b)"
)

def preview_text(text: str, max_length: int = 240) -> str:
    stripped = " ".join(text.split())
    return stripped if len(stripped) <= max_length else stripped[:max_length] + "..."

def normalize_text(text: str) -> dict:
    """Normalizes text against zero-width chars, leet-speak, and obfuscation."""
    unicode_normalized = unicodedata.normalize("NFKD", text)
    lowered = unicode_normalized.lower()
    replaced = lowered.translate(OBFUSCATION_MAP)
    replaced = replaced.replace("don't", "dont").replace("don t", "dont")

    cleaned = re.sub(r"[^a-z0-9]+", " ", replaced)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    compact = re.sub(r"[^a-z0-9]+", "", replaced)

    clauses = [segment.strip() for segment in CLAUSE_SPLIT_REGEX.split(cleaned) if segment.strip()]
    if not clauses:
        clauses = [cleaned]

    return {"normalized": cleaned, "compact": compact, "clauses": clauses}