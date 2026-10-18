"""
Test suite for the English toxicity baseline model, data splits, and inference module.
"""
import os
import pytest
from ml.inference import ToxicityBaselinePredictor, get_toxicity_predictor

def test_model_artifact_exists():
    assert os.path.exists("models/baseline_toxicity.joblib"), "Model artifact should exist"
    assert os.path.exists("models/model_config.json"), "Model config should exist"
    assert os.path.exists("reports/evaluation_report.json"), "Evaluation report should exist"
    assert os.path.exists("reports/data_quality_report.json"), "Data quality report should exist"

def test_splits_exist():
    assert os.path.exists("data/splits/train.csv"), "Train split should exist"
    assert os.path.exists("data/splits/val.csv"), "Val split should exist"
    assert os.path.exists("data/splits/test.csv"), "Test split should exist"

def test_inference_clean_input():
    predictor = get_toxicity_predictor()
    res = predictor.predict("Thank you for sharing this well-researched perspective.")
    assert "toxicity_score" in res
    assert "is_toxic" in res
    assert res["is_toxic"] is False
    assert res["toxicity_score"] < 0.5

def test_inference_toxic_input():
    predictor = get_toxicity_predictor()
    res = predictor.predict("You are a complete idiot and should just shut up!")
    assert "toxicity_score" in res
    assert "is_toxic" in res
    assert res["is_toxic"] is True
    assert res["toxicity_score"] >= 0.5

def test_inference_empty_input():
    predictor = get_toxicity_predictor()
    res = predictor.predict("")
    assert res["is_toxic"] is False
    assert res["toxicity_score"] == 0.0

def test_inference_batch():
    predictor = get_toxicity_predictor()
    texts = [
        "Great work everyone!",
        "Stupid moron, go away."
    ]
    results = predictor.predict_batch(texts)
    assert len(results) == 2
    assert results[0]["is_toxic"] is False
    assert results[1]["is_toxic"] is True
