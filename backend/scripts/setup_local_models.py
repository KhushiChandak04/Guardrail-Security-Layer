from pathlib import Path

from huggingface_hub import snapshot_download


MODEL_TARGETS = {
    "sentence-transformers/all-MiniLM-L6-v2": "all-MiniLM-L6-v2",
    "protectai/deberta-v3-base-prompt-injection": "deberta-v3-base-prompt-injection",
    "unitary/toxic-bert": "toxic-bert",
}


def _file_count(path: Path) -> int:
    return sum(1 for item in path.rglob("*") if item.is_file())


def _ensure_model(repo_id: str, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    before = _file_count(destination)
    print(f"[setup] {repo_id} -> {destination} (existing_files={before})")

    snapshot_download(
        repo_id=repo_id,
        local_dir=str(destination),
    )

    after = _file_count(destination)
    print(f"[done]  {repo_id} (files={after})")


def main() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    models_dir = backend_dir / "models"

    for repo_id, folder_name in MODEL_TARGETS.items():
        _ensure_model(repo_id, models_dir / folder_name)


if __name__ == "__main__":
    main()
