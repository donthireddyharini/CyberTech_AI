"""
Sentinel AI - English Toxicity Baseline Training Pipeline
1. Trains a TF-IDF + LogisticRegression baseline with balanced class weighting.
2. Supports tuning C parameter on validation set using F1 optimization.
3. Computes and saves training history and hyperparameter configuration.
4. Serializes model artifact pipeline to models/baseline_toxicity.joblib.
"""
import os
import json
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import f1_score, precision_score, recall_score, classification_report

TRAIN_PATH = "data/splits/train.csv"
VAL_PATH = "data/splits/val.csv"
MODEL_DIR = "models"
MODEL_PATH = "models/baseline_toxicity.joblib"
CONFIG_PATH = "models/model_config.json"
RANDOM_STATE = 42

def train_baseline():
    print("Loading train and validation splits...")
    train_df = pd.read_csv(TRAIN_PATH)
    val_df = pd.read_csv(VAL_PATH)
    
    X_train = train_df["cleaned_text"].values
    y_train = train_df["label_toxic"].values
    X_val = val_df["cleaned_text"].values
    y_val = val_df["label_toxic"].values
    
    print(f"Train samples: {len(X_train)} (Toxic: {y_train.sum()})")
    print(f"Val samples: {len(X_val)} (Toxic: {y_val.sum()})")
    
    # Grid of regularization parameters to optimize validation F1
    c_candidates = [0.1, 0.5, 1.0, 2.0, 5.0]
    best_c = 1.0
    best_f1 = -1.0
    best_pipe = None
    validation_tuning_results = []
    
    for c_val in c_candidates:
        print(f"\nEvaluating pipeline with LogisticRegression(C={c_val}, class_weight='balanced')...")
        pipe = Pipeline([
            ("tfidf", TfidfVectorizer(
                ngram_range=(1, 2),
                max_features=25000,
                sublinear_tf=True,
                strip_accents="unicode"
            )),
            ("clf", LogisticRegression(
                C=c_val,
                class_weight="balanced",
                max_iter=1000,
                random_state=RANDOM_STATE,
                solver="lbfgs"
            ))
        ])
        
        pipe.fit(X_train, y_train)
        preds_val = pipe.predict(X_val)
        val_f1 = f1_score(y_val, preds_val, pos_label=1)
        val_prec = precision_score(y_val, preds_val, pos_label=1, zero_division=0)
        val_rec = recall_score(y_val, preds_val, pos_label=1, zero_division=0)
        
        print(f"Validation Metrics (C={c_val}): F1={val_f1:.4f}, Precision={val_prec:.4f}, Recall={val_rec:.4f}")
        validation_tuning_results.append({
            "C": c_val,
            "val_f1": round(float(val_f1), 4),
            "val_precision": round(float(val_prec), 4),
            "val_recall": round(float(val_rec), 4)
        })
        
        if val_f1 > best_f1:
            best_f1 = val_f1
            best_c = c_val
            best_pipe = pipe
            
    print(f"\nBest configuration selected: C={best_c} with Validation F1={best_f1:.4f}")
    
    # Save selected model artifact
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(best_pipe, MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")
    
    # Save training configuration and validation tuning records
    config_record = {
        "model_type": "TF-IDF + LogisticRegression (Balanced Class Weights)",
        "framework": "scikit-learn",
        "random_state": RANDOM_STATE,
        "ngram_range": [1, 2],
        "max_features": 25000,
        "selected_C": best_c,
        "best_val_f1": round(float(best_f1), 4),
        "validation_tuning": validation_tuning_results,
        "training_samples": len(X_train),
        "training_positives": int(y_train.sum()),
        "checkpoint_path": MODEL_PATH,
        "task_scope": "English toxicity binary classification baseline"
    }
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config_record, f, indent=2)
    print(f"Configuration saved to {CONFIG_PATH}")

if __name__ == "__main__":
    train_baseline()
