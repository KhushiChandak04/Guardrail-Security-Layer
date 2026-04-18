INPUT_JAILBREAK_PATTERNS: list[tuple[str, str]] = [
    (r"ignore\s+(all\s+)?previous\s+instructions", "instruction_override"),
    (r"reveal\s+(the\s+)?system\s+prompt", "system_prompt_exfiltration"),
    (r"developer\s+mode|jailbreak", "jailbreak_attempt"),
    (r"disable\s+guardrails|bypass\s+safety", "safety_bypass"),
]

WATCHLIST_TERMS: list[str] = [
    "exploit",
    "payload",
    "exfiltrate",
    "override",
    "steal",
]

TOXICITY_TERMS: list[str] = [
    "kill",
    "harm",
    "attack",
    "violence",
]

PII_ENTITIES: list[str] = [
    "PHONE_NUMBER",
    "EMAIL_ADDRESS",
    "US_SSN",
    "CREDIT_CARD",
    "IBAN_CODE",
]

DEFAULT_SYSTEM_PROMPT = (
    "You are a safe assistant behind a security middleware. "
    "Provide concise useful responses and avoid unsafe instructions."
)
