def preview_text(text: str, max_length: int = 240) -> str:
    stripped = " ".join(text.split())
    if len(stripped) <= max_length:
        return stripped
    return stripped[:max_length] + "..."
