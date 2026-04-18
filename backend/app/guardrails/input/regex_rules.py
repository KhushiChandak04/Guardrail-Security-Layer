import re

from app.config.constants import INPUT_JAILBREAK_PATTERNS

COMPILED_INPUT_PATTERNS = [
    (re.compile(pattern, re.IGNORECASE), label) for pattern, label in INPUT_JAILBREAK_PATTERNS
]
