"""
Sentinel AI - Held-out Test Set Evaluation Pipeline
1. Loads the trained pipeline from models/baseline_toxicity.joblib.
2. Evaluates performance on the untouched test partition data/splits/test.csv.
3. Computes Precision, Recall, F1 (macro & binary), Confusion Matrix, and ROC AUC.
4. Identifies concrete False Positive and False Negative test samples for error diagnosis.
5. Emits structured report to reports/evaluation_report.json.
"""
import os
import json
import joblib
import pandas as pd
from sklearn.metrics import (
    precision_score, recall_score, f1_score, accuracy_score,
    confusion_matrix, classification_report, roc_auc_score
)

TEST_PATH = "data/splits/test.csv"
MODEL_PATH = "models/baseline_toxicity.joblib"
REPORT_PATH = "reports/evaluation_report.json"

def evaluate():
    print(f"Loading test dataset from {TEST_PATH}...")
    test_df = pd.read_csv(TEST_PATH)
    X_test = test_df["cleaned_text"].values
    y_test = test_df["label_toxic"].values
    
    print(f"Test samples: {len(X_test)} (Toxic: {y_test.sum()}, Non-Toxic: {len(y_test) - y_test.sum()})")
    
    print(f"Loading model from {MODEL_PATH}...")
    pipe = joblib.load(MODEL_PATH)
    
    # Predict binary and probabilities
    y_pred = pipe.predict(X_test)
    y_proba = pipe.predict_proba(X_test)[:, 1]
    
    # Calculate metrics
    acc = accuracy_score(y_test, y_pred)
    prec_binary = precision_score(y_test, y_pred, pos_label=1, zero_division=0)
    rec_binary = recall_score(y_test, y_pred, pos_label=1, zero_division=0)
    f1_binary = f1_score(y_test, y_pred, pos_label=1, zero_division=0)
    
    prec_macro = precision_score(y_test, y_pred, average="macro", zero_division=0)
    rec_macro = recall_score(y_test, y_pred, average="macro", zero_division=0)
    f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
    
    auc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()
    
    print("\n--- TEST EVALUATION RESULTS ---")
    print(f"Accuracy: {acc:.4f}")
    print(f"ROC-AUC:  {auc:.4f}")
    print(f"Binary Metrics (Toxic class): Precision={prec_binary:.4f}, Recall={rec_binary:.4f}, F1={f1_binary:.4f}")
    print(f"Macro Metrics:                Precision={prec_macro:.4f}, Recall={rec_macro:.4f}, F1={f1_macro:.4f}")
    print(f"Confusion Matrix: TN={tn}, FP={fp}, FN={fn}, TP={tp}")
    
    # Identify sample False Positives & False Negatives for qualitative auditing
    test_df["prediction"] = y_pred
    test_df["prob_toxic"] = y_proba
    
    fp_samples = test_df[(test_df["label_toxic"] == 0) & (test_df["prediction"] == 1)].head(5)[
        ["cleaned_text", "toxicity", "prob_toxic"]
    ].to_dict(orient="records")
    
    fn_samples = test_df[(test_df["label_toxic"] == 1) & (test_df["prediction"] == 0)].head(5)[
        ["cleaned_text", "toxicity", "prob_toxic"]
    ].to_dict(orient="records")
    
    report = {
        "evaluation_dataset": "Civil Comments Held-Out Test Split (15%)",
        "checkpoint": MODEL_PATH,
        "test_samples": len(X_test),
        "class_support": {
            "non_toxic_count": int(tn + fp),
            "toxic_count": int(fn + tp)
        },
        "metrics": {
            "accuracy": round(float(acc), 4),
            "roc_auc": round(float(auc), 4),
            "binary_toxic": {
                "precision": round(float(prec_binary), 4),
                "recall": round(float(rec_binary), 4),
                "f1": round(float(f1_binary), 4)
            },
            "macro_average": {
                "precision": round(float(prec_macro), 4),
                "recall": round(float(rec_macro), 4),
                "f1": round(float(f1_macro), 4)
            }
        },
        "confusion_matrix": {
            "true_negatives": int(tn),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_positives": int(tp)
        },
        "qualitative_error_analysis": {
            "sample_false_positives": fp_samples,
            "sample_false_negatives": fn_samples
        }
    }
    
    os.makedirs("reports", exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\nDetailed evaluation report saved to {REPORT_PATH}")

if __name__ == "__main__":
    evaluate()
