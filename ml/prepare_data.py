"""
Sentinel AI - Data Preprocessing & Splitting Pipeline
1. Inspects raw dataset records, generates a data quality report.
2. Cleans text, handles missing values, strips whitespace, and removes exact duplicates.
3. Defines a standard binary toxicity label: is_toxic = 1 if toxicity >= 0.5 else 0.
4. Preserves continuous continuous scores and original text.
5. Produces stratified, reproducible train (70%), validation (15%), and test (15%) splits.
6. Saves data to data/processed and data/splits, and outputs data_quality_report.json.
"""
import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

RAW_PATH = "data/raw/civil_comments_raw_subset.csv"
PROCESSED_PATH = "data/processed/civil_comments_clean.csv"
SPLITS_DIR = "data/splits"
REPORT_PATH = "reports/data_quality_report.json"
RANDOM_STATE = 42
TOXIC_THRESHOLD = 0.5

def prepare_data():
    print(f"Loading raw dataset from {RAW_PATH}...")
    if not os.path.exists(RAW_PATH):
        raise FileNotFoundError(f"{RAW_PATH} does not exist. Run ml/download_data.py first.")
        
    df = pd.read_csv(RAW_PATH)
    initial_rows = len(df)
    print(f"Initial raw count: {initial_rows}")
    
    # 1. Quality inspection
    missing_text_count = int(df["text"].isnull().sum())
    # Fill NaN or coerce
    df["text"] = df["text"].fillna("").astype(str)
    
    # Filter out empty or whitespace-only texts
    df["cleaned_text"] = df["text"].str.strip()
    empty_text_count = int((df["cleaned_text"] == "").sum())
    df = df[df["cleaned_text"] != ""].copy()
    
    # Check duplicates on original text
    duplicate_count = int(df.duplicated(subset=["cleaned_text"]).sum())
    df = df.drop_duplicates(subset=["cleaned_text"]).reset_index(drop=True)
    
    # Binary label based on consensus threshold >= 0.5
    # Standard benchmark convention for Civil Comments
    df["label_toxic"] = (df["toxicity"] >= TOXIC_THRESHOLD).astype(int)
    
    # Compute class distribution
    toxic_count = int((df["label_toxic"] == 1).sum())
    non_toxic_count = int((df["label_toxic"] == 0).sum())
    imbalance_ratio = round(non_toxic_count / max(toxic_count, 1), 2)
    
    # Save cleaned processed dataset
    os.makedirs("data/processed", exist_ok=True)
    df.to_csv(PROCESSED_PATH, index=False, encoding="utf-8")
    print(f"Cleaned dataset saved to {PROCESSED_PATH} ({len(df)} rows)")
    
    # 2. Stratified train/val/test split (70% train, 15% val, 15% test)
    os.makedirs(SPLITS_DIR, exist_ok=True)
    train_df, temp_df = train_test_split(
        df,
        test_size=0.30,
        random_state=RANDOM_STATE,
        stratify=df["label_toxic"]
    )
    val_df, test_df = train_test_split(
        temp_df,
        test_size=0.50,
        random_state=RANDOM_STATE,
        stratify=temp_df["label_toxic"]
    )
    
    # Verify no leakage between splits
    train_texts = set(train_df["cleaned_text"])
    val_texts = set(val_df["cleaned_text"])
    test_texts = set(test_df["cleaned_text"])
    leakage_train_val = len(train_texts.intersection(val_texts))
    leakage_train_test = len(train_texts.intersection(test_texts))
    leakage_val_test = len(val_texts.intersection(test_texts))
    
    train_df.to_csv(os.path.join(SPLITS_DIR, "train.csv"), index=False, encoding="utf-8")
    val_df.to_csv(os.path.join(SPLITS_DIR, "val.csv"), index=False, encoding="utf-8")
    test_df.to_csv(os.path.join(SPLITS_DIR, "test.csv"), index=False, encoding="utf-8")
    
    print(f"Splits created: Train={len(train_df)}, Val={len(val_df)}, Test={len(test_df)}")
    
    # 3. Save comprehensive data quality report
    os.makedirs("reports", exist_ok=True)
    quality_report = {
        "raw_rows": initial_rows,
        "missing_text_rows": missing_text_count,
        "empty_text_rows": empty_text_count,
        "duplicate_rows_removed": duplicate_count,
        "final_clean_rows": len(df),
        "toxic_threshold": TOXIC_THRESHOLD,
        "class_distribution": {
            "toxic_count": toxic_count,
            "non_toxic_count": non_toxic_count,
            "toxic_percentage": round((toxic_count / len(df)) * 100, 2),
            "imbalance_ratio": f"{imbalance_ratio}:1 (non-toxic to toxic)"
        },
        "splits": {
            "train_count": len(train_df),
            "train_toxic": int(train_df["label_toxic"].sum()),
            "val_count": len(val_df),
            "val_toxic": int(val_df["label_toxic"].sum()),
            "test_count": len(test_df),
            "test_toxic": int(test_df["label_toxic"].sum()),
        },
        "leakage_verification": {
            "train_val_overlap": leakage_train_val,
            "train_test_overlap": leakage_train_test,
            "val_test_overlap": leakage_val_test,
            "leakage_free": (leakage_train_val == 0 and leakage_train_test == 0 and leakage_val_test == 0)
        }
    }
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(quality_report, f, indent=2)
    print(f"Data quality report saved to {REPORT_PATH}")

if __name__ == "__main__":
    prepare_data()
