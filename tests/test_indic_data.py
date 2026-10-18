"""
Test suite validating Indian language dataset files, schemas, and harmonization.
Verifies that original data is intact and labels are strictly mapped without fabrication.
"""
import os
import json
import pytest
import pandas as pd
import numpy as np

INDIC_RAW_DIR = "data/raw/indic"
INDIC_PROCESSED_DIR = "data/processed/indic"
INVENTORY_PATH = "reports/indic_dataset_inventory.json"
SOURCES_DOC = "docs/INDIAN_LANGUAGE_DATASET_SOURCES.md"

def test_inventory_and_docs_exist():
    assert os.path.exists(INVENTORY_PATH), "Inventory report must exist"
    assert os.path.exists(SOURCES_DOC), "Documentation must exist"
    with open(INVENTORY_PATH, "r") as f:
        inv = json.load(f)
    assert len(inv) >= 7, "Inventory should cover all downloaded dataset files"

def test_raw_files_exist():
    expected_files = [
        "telugu_train.csv", "telugu_val.csv", "telugu_test.csv",
        "kannada_train.parquet", "kannada_val.parquet",
        "hindi_hostility_train.parquet",
        "hinglish_train.csv", "hinglish_val.csv", "hinglish_test.csv",
        "hatecheck_hindi_test.csv"
    ]
    for ef in expected_files:
        p = os.path.join(INDIC_RAW_DIR, ef)
        assert os.path.exists(p), f"Raw file {ef} must exist"
        assert os.path.getsize(p) > 1000, f"Raw file {ef} should not be empty"

def test_telugu_harmonization_integrity():
    p = os.path.join(INDIC_PROCESSED_DIR, "telugu_train.csv")
    assert os.path.exists(p), "Processed Telugu train file must exist"
    df = pd.read_csv(p)
    assert "text" in df.columns
    assert "hate_speech" in df.columns
    assert "legitimate" in df.columns
    # Unknown labels MUST be NaN/null, not 0.0
    assert df["harassment"].isna().all(), "Harassment should be unannotated (NaN) for Telugu dataset"
    assert df["cyberbullying"].isna().all(), "Cyberbullying should be unannotated (NaN) for Telugu dataset"
    # Hate + legitimate should equal 1.0
    assert ((df["hate_speech"] + df["legitimate"]) == 1.0).all()

def test_kannada_harmonization_integrity():
    p = os.path.join(INDIC_PROCESSED_DIR, "kannada_train.csv")
    assert os.path.exists(p), "Processed Kannada train file must exist"
    df = pd.read_csv(p)
    assert "text" in df.columns
    assert "harassment" in df.columns
    assert "cyberbullying" in df.columns
    # Insult individual maps to cyberbullying=1.0 and harassment=1.0
    cb_rows = df[df["cyberbullying"] == 1.0]
    assert len(cb_rows) > 0, "Should have positive cyberbullying instances from individual insult annotations"
    assert (cb_rows["harassment"] == 1.0).all()

def test_hinglish_harmonization_integrity():
    p = os.path.join(INDIC_PROCESSED_DIR, "hinglish_train.csv")
    assert os.path.exists(p), "Processed Hinglish train file must exist"
    df = pd.read_csv(p)
    assert len(df) == 17704
    assert set(df["language"].unique()).issubset({"english", "hindi", "hinglish"})
    assert df["harassment"].isna().all(), "Harassment should be unannotated (NaN) for PRISM dataset"

def test_english_baseline_unaffected():
    """Safety check: English baseline and reports remain intact and operational."""
    assert os.path.exists("models/baseline_toxicity.joblib")
    assert os.path.exists("models/model_config.json")
    assert os.path.exists("reports/evaluation_report.json")
    with open("models/model_config.json") as f:
        cfg = json.load(f)
    assert cfg["optimal_threshold"] == 0.40
