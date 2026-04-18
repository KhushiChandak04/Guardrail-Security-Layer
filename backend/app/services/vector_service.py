from dataclasses import dataclass
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer


@dataclass
class VectorMatch:
    pattern: str
    score: float


class VectorService:
    def __init__(self, *, persist_path: str, collection_name: str, seed_file: str) -> None:
        self.model = SentenceTransformer("all-MiniLM-L6-v2")

        path = Path(persist_path)
        path.mkdir(parents=True, exist_ok=True)

        self.client = chromadb.PersistentClient(path=str(path))
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        self._seed(seed_file)

    def _seed(self, seed_file: str) -> None:
        if self.collection.count() > 0:
            return

        seed_path = Path(seed_file)
        if not seed_path.exists():
            return

        patterns = [line.strip() for line in seed_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        if not patterns:
            return

        embeddings = self.model.encode(patterns).tolist()
        ids = [f"seed-{index}" for index in range(len(patterns))]
        self.collection.add(ids=ids, documents=patterns, embeddings=embeddings)

    def query_similar(self, text: str) -> VectorMatch | None:
        if self.collection.count() == 0:
            return None

        embedding = self.model.encode([text]).tolist()[0]
        result = self.collection.query(
            query_embeddings=[embedding],
            n_results=1,
            include=["distances", "documents"],
        )

        distances = result.get("distances") or []
        documents = result.get("documents") or []
        if not distances or not documents or not distances[0] or not documents[0]:
            return None

        distance = float(distances[0][0])
        similarity = max(0.0, 1.0 - distance)
        return VectorMatch(pattern=str(documents[0][0]), score=similarity)
