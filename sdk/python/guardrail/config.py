from dataclasses import dataclass


@dataclass
class SDKConfig:
    api_key: str
    base_url: str
