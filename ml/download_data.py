"""
Sentinel AI - Data Acquisition Script
Downloads a reproducible, manageable subset of google/civil_comments (approx 20,000 samples)
using streaming or split slicing to conserve disk space and bandwidth.
"""
import os
import json
import pandas as pd
from datasets import load_dataset

RAW_DATA_PATH = "data/raw/civil_comments_raw_subset.csv"
META_PATH = "data/raw/download_metadata.json"
TARGET_SAMPLES = 20000

def download_subset():
    print(f"Starting download of google/civil_comments subset ({TARGET_SAMPLES} samples)...")
    os.makedirs("data/raw", exist_ok=True)
    
    # We load streaming to avoid pulling the entire 2M+ record dataset
    ds_stream = load_dataset("google/civil_comments", split="train", streaming=True)
    
    records = []
    print("Streaming records...")
    for idx, item in enumerate(ds_stream):
        records.append({
            "text": item.get("text", ""),
            "toxicity": float(item.get("toxicity", 0.0)),
            "severe_toxicity": float(item.get("severe_toxicity", 0.0)),
            "obscene": float(item.get("obscene", 0.0)),
            "threat": float(item.get("threat", 0.0)),
            "insult": float(item.get("insult", 0.0)),
            "identity_attack": float(item.get("identity_attack", 0.0)),
            "sexual_explicit": float(item.get("sexual_explicit", 0.0))
        })
        if (idx + 1) % 5000 == 0:
            print(f"Streamed {idx + 1} records...")
        if len(records) >= TARGET_SAMPLES:
            break
            
    df = pd.DataFrame(records)
    df.to_csv(RAW_DATA_PATH, index=False, encoding="utf-8")
    print(f"Saved {len(df)} records to {RAW_DATA_PATH}")
    
    metadata = {
        "dataset_name": "google/civil_comments",
        "huggingface_url": "https://huggingface.co/datasets/google/civil_comments",
        "license": "CC0: Public Domain",
        "source_split": "train (streamed first 20,000)",
        "download_count": len(df),
        "fields": list(df.columns),
        "file_path": RAW_DATA_PATH
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print("Metadata written to", META_PATH)

if __name__ == "__main__":
    download_subset()
