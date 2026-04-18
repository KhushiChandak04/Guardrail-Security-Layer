import os
from pathlib import Path
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from datasets import load_dataset

# FIX 1: Path updated to match running from inside the 'backend' folder
CHROMA_PATH = "./.chroma" 
COLLECTION_NAME = "jailbreak_patterns"

def ingest_datasets():
    print("Connecting to ChromaDB Persistent Client...")
    
    path = Path(CHROMA_PATH)
    client = chromadb.PersistentClient(path=str(path))
    embedding_fn = SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
    
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
        metadata={"hnsw:space": "cosine"}
    )

    print("Downloading datasets from Hugging Face (this might take a minute)...")
    
    dataset = load_dataset("deepset/prompt-injections", split="train")
    
    # The deepset dataset labels malicious prompt injections as '1'
    malicious_prompts = [item["text"] for item in dataset if item["label"] == 1]
    
    print(f"Successfully loaded {len(malicious_prompts)} malicious patterns.")
    print("Starting vector embedding and ingestion...")
    
    batch_size = 250
    for i in range(0, len(malicious_prompts), batch_size):
        batch = malicious_prompts[i : i + batch_size]
        ids = [f"hf-deepset-{i + j}" for j in range(len(batch))]
        
        collection.upsert(
            documents=batch,
            ids=ids
        )
        print(f"Ingested {min(i + batch_size, len(malicious_prompts))} / {len(malicious_prompts)}...")

    print(f"\nSuccess! Your vector database now protects against {collection.count()} known patterns.")

if __name__ == "__main__":
    # FIX 2: Check for the 'app' folder to verify we are inside 'backend'
    if not os.path.exists("./app"):
        print("Error: Please run this script from the 'backend' directory.")
    else:
        ingest_datasets()