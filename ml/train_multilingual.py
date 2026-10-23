"""
Sentinel AI — Multilingual Model Training Pipeline
(CSEAIML2026-P03)

Trains genuine, local scikit-learn models for non-English languages:
  1. Telugu (mounikaiiith/Telugu-Hatespeech + vetted interpersonal insults dataset)
  2. Hindi (necrosyth/hindi-social-media-hostility-detection in Devanagari script)
  3. Hinglish / Code-Mixed (pankajbiswas6/prism-hinglish-hate-speech)
  4. Kannada (community-datasets/offenseval_dravidian + vetted interpersonal insults dataset)

Uses Indic-aware Unicode Word + Character n-gram FeatureUnion with balanced LogisticRegression.
Tunes decision threshold on validation set without test leakage.
Evaluates on held-out test splits and serializes model checkpoints to models/
and evaluation metrics to reports/.
"""
import os
import sys
import json
import time
import joblib
import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    precision_score, recall_score, f1_score, accuracy_score,
    confusion_matrix, roc_auc_score, average_precision_score,
    classification_report
)

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

MODELS_DIR = "models"
REPORTS_DIR = "reports"
RANDOM_STATE = 42

# Indic Unicode Regex: matches words containing Telugu (0C00-0C7F), Kannada (0C80-0CFF), Devanagari (0900-097F), and Latin alphanumeric
INDIC_TOKEN_PATTERN = r'[\u0C00-\u0C7F\u0C80-\u0CFF\u0900-\u097F\w]+'

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)


def build_pipeline(
    char_ngrams=(2, 4),
    word_ngrams=(1, 2),
    c_val=1.0,
    token_pattern=INDIC_TOKEN_PATTERN,
    word_min_df=1
) -> Pipeline:
    """Builds a robust TF-IDF Word + Character n-gram pipeline with balanced LogisticRegression."""
    feature_union = FeatureUnion([
        ("word", TfidfVectorizer(
            token_pattern=token_pattern,
            ngram_range=word_ngrams,
            max_features=25000,
            min_df=word_min_df,
            sublinear_tf=True
        )),
        ("char", TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=char_ngrams,
            max_features=30000,
            min_df=1,
            sublinear_tf=True
        ))
    ])
    return Pipeline([
        ("features", feature_union),
        ("clf", LogisticRegression(
            C=c_val,
            class_weight="balanced",
            max_iter=1000,
            random_state=RANDOM_STATE,
            solver="lbfgs"
        ))
    ])


def tune_threshold(model: Pipeline, X_val: np.ndarray, y_val: np.ndarray, min_recall: float = 0.50) -> float:
    """
    Find optimal decision threshold on validation set.
    For class-imbalanced safety moderation, we balance precision and recall.
    Finds threshold with highest F1 that maintains recall >= min_recall if possible,
    otherwise max F1.
    """
    val_probs = model.predict_proba(X_val)[:, 1]
    thresholds = np.linspace(0.15, 0.85, 71)
    
    best_f1_overall = -1.0
    best_th_overall = 0.50
    
    best_f1_with_recall = -1.0
    best_th_with_recall = 0.50
    
    for th in thresholds:
        preds = (val_probs >= th).astype(int)
        if preds.sum() == 0:
            continue
        f1 = f1_score(y_val, preds, zero_division=0)
        rec = recall_score(y_val, preds, zero_division=0)
        
        if f1 > best_f1_overall:
            best_f1_overall = f1
            best_th_overall = float(th)
            
        if rec >= min_recall and f1 > best_f1_with_recall:
            best_f1_with_recall = f1
            best_th_with_recall = float(th)
            
    chosen = best_th_with_recall if best_f1_with_recall > 0 else best_th_overall
    return round(chosen, 3)


def evaluate_model(
    model: Pipeline,
    threshold: float,
    X_test: np.ndarray,
    y_test: np.ndarray,
    lang_name: str,
    dataset_name: str,
    split_name: str = "held_out_test"
) -> dict:
    """Evaluates pipeline on test split and computes standard classification metrics."""
    probs = model.predict_proba(X_test)[:, 1]
    preds = (probs >= threshold).astype(int)
    
    cm = confusion_matrix(y_test, preds).tolist()
    tn, fp, fn, tp = int(cm[0][0]), int(cm[0][1]), int(cm[1][0]), int(cm[1][1])
    
    acc = float(accuracy_score(y_test, preds))
    prec = float(precision_score(y_test, preds, zero_division=0))
    rec = float(recall_score(y_test, preds, zero_division=0))
    f1 = float(f1_score(y_test, preds, zero_division=0))
    
    try:
        roc_auc = float(roc_auc_score(y_test, probs))
    except Exception:
        roc_auc = None
        
    try:
        pr_auc = float(average_precision_score(y_test, probs))
    except Exception:
        pr_auc = None
        
    return {
        "language": lang_name,
        "dataset": dataset_name,
        "split": split_name,
        "total_test_samples": len(y_test),
        "positive_samples": int(y_test.sum()),
        "negative_samples": int((y_test == 0).sum()),
        "optimal_threshold": threshold,
        "metrics": {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "roc_auc": round(roc_auc, 4) if roc_auc is not None else None,
            "pr_auc": round(pr_auc, 4) if pr_auc is not None else None,
        },
        "confusion_matrix": {
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives": fn,
            "true_positives": tp,
            "raw_matrix": cm
        }
    }


# =====================================================================
# 1. TELUGU MODEL TRAINING (with Indic Unicode tokenization & insults data)
# =====================================================================
def train_telugu():
    print("\n" + "="*60)
    print(">>> [1/4] Training Telugu Model (mounikaiiith/Telugu-Hatespeech + Generalization Corpus)")
    print("="*60)
    
    train_orig = pd.read_csv("data/processed/indic/telugu_train.csv")
    val_orig = pd.read_csv("data/processed/indic/telugu_val.csv")
    test_orig = pd.read_csv("data/processed/indic/telugu_test.csv")
    
    # Stratified split of supplementary insults dataset: 70% train, 15% val, 15% test
    supp_path = "data/processed/indic/telugu_supplementary_insults.csv"
    if os.path.exists(supp_path):
        supp_df = pd.read_csv(supp_path)
        supp_train, supp_temp = train_test_split(supp_df, test_size=0.30, stratify=supp_df['legitimate'], random_state=RANDOM_STATE)
        supp_val, supp_test = train_test_split(supp_temp, test_size=0.50, stratify=supp_temp['legitimate'], random_state=RANDOM_STATE)
        
        # 3x weighting of conversational generalization samples during training
        supp_train_rep = pd.concat([supp_train] * 3, ignore_index=True)
        train_df = pd.concat([train_orig, supp_train_rep], ignore_index=True)
        val_df = pd.concat([val_orig, supp_val], ignore_index=True).drop_duplicates(subset=['text'])
        test_df = pd.concat([test_orig, supp_test], ignore_index=True).drop_duplicates(subset=['text'])
    else:
        train_df, val_df, test_df = train_orig, val_orig, test_orig
    
    X_train = np.array(train_df["text"].fillna("").tolist(), dtype=object)
    y_train = np.array((train_df["legitimate"] == 0.0).astype(int).tolist(), dtype=int)
    
    X_val = np.array(val_df["text"].fillna("").tolist(), dtype=object)
    y_val = np.array((val_df["legitimate"] == 0.0).astype(int).tolist(), dtype=int)
    
    X_test = np.array(test_df["text"].fillna("").tolist(), dtype=object)
    y_test = np.array((test_df["legitimate"] == 0.0).astype(int).tolist(), dtype=int)
    
    print(f"Telugu Train: {len(X_train)} samples ({y_train.sum()} harmful, {(y_train==0).sum()} legit)")
    print(f"Telugu Val:   {len(X_val)} samples ({y_val.sum()} harmful, {(y_val==0).sum()} legit)")
    print(f"Telugu Test:  {len(X_test)} samples ({y_test.sum()} harmful, {(y_test==0).sum()} legit)")
    
    t0 = time.time()
    pipe = build_pipeline(char_ngrams=(2, 5), word_ngrams=(1, 2), c_val=2.5, token_pattern=INDIC_TOKEN_PATTERN, word_min_df=1)
    pipe.fit(X_train, y_train)
    fit_time = time.time() - t0
    print(f"Training completed in {fit_time:.2f}s")
    
    best_th = tune_threshold(pipe, X_val, y_val, min_recall=0.40)
    print(f"Optimal validation threshold: {best_th}")
    
    eval_res = evaluate_model(pipe, best_th, X_test, y_test, "Telugu", "mounikaiiith/Telugu-Hatespeech + Generalization Corpus")
    print(f"Test Results: Acc={eval_res['metrics']['accuracy']}, Prec={eval_res['metrics']['precision']}, "
          f"Rec={eval_res['metrics']['recall']}, F1={eval_res['metrics']['f1_score']}, ROC-AUC={eval_res['metrics']['roc_auc']}")
    print(f"Confusion Matrix: {eval_res['confusion_matrix']}")
    
    model_path = os.path.join(MODELS_DIR, "telugu_model.joblib")
    config_path = os.path.join(MODELS_DIR, "telugu_config.json")
    report_path = os.path.join(REPORTS_DIR, "telugu_evaluation_report.json")
    
    joblib.dump(pipe, model_path)
    
    config = {
        "language": "telugu",
        "model_version": "telugu_generalization_v3",
        "model_type": "scikit_learn_tfidf_logreg",
        "architecture": "FeatureUnion(IndicWord (1,2) + Char_wb (2,5)) -> LogisticRegression(balanced)",
        "dataset_source": "mounikaiiith/Telugu-Hatespeech + Generalization Corpus",
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "optimal_threshold": best_th,
        "metrics": eval_res["metrics"],
        "checkpoint_path": model_path
    }
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(eval_res, f, indent=2)
        
    print(f"Saved artifacts to {model_path}, {config_path}, {report_path}")
    return eval_res


# =====================================================================
# 2. HINDI MODEL TRAINING
# =====================================================================
def train_hindi():
    print("\n" + "="*60)
    print(">>> [2/4] Training Hindi Model (necrosyth/hindi-social-media-hostility-detection)")
    print("="*60)
    
    raw_df = pd.read_csv("data/processed/indic/hindi_hostility_train.csv")
    X = np.array(raw_df["text"].fillna("").tolist(), dtype=object)
    y = np.array((raw_df["legitimate"] == 0.0).astype(int).tolist(), dtype=int)
    
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=RANDOM_STATE
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, stratify=y_temp, random_state=RANDOM_STATE
    )
    
    print(f"Hindi Train: {len(X_train)} samples ({y_train.sum()} hostile, {(y_train==0).sum()} non-hostile)")
    print(f"Hindi Val:   {len(X_val)} samples ({y_val.sum()} hostile, {(y_val==0).sum()} non-hostile)")
    print(f"Hindi Test:  {len(X_test)} samples ({y_test.sum()} hostile, {(y_test==0).sum()} non-hostile)")
    
    t0 = time.time()
    pipe = build_pipeline(char_ngrams=(2, 4), word_ngrams=(1, 2), c_val=1.5, token_pattern=INDIC_TOKEN_PATTERN, word_min_df=2)
    pipe.fit(X_train, y_train)
    fit_time = time.time() - t0
    print(f"Training completed in {fit_time:.2f}s")
    
    best_th = tune_threshold(pipe, X_val, y_val)
    print(f"Optimal validation threshold: {best_th}")
    
    eval_res = evaluate_model(pipe, best_th, X_test, y_test, "Hindi", "necrosyth/hindi-social-media-hostility-detection")
    print(f"Test Results: Acc={eval_res['metrics']['accuracy']}, Prec={eval_res['metrics']['precision']}, "
          f"Rec={eval_res['metrics']['recall']}, F1={eval_res['metrics']['f1_score']}, ROC-AUC={eval_res['metrics']['roc_auc']}")
    print(f"Confusion Matrix: {eval_res['confusion_matrix']}")
    
    model_path = os.path.join(MODELS_DIR, "hindi_model.joblib")
    config_path = os.path.join(MODELS_DIR, "hindi_config.json")
    report_path = os.path.join(REPORTS_DIR, "hindi_evaluation_report.json")
    
    joblib.dump(pipe, model_path)
    
    config = {
        "language": "hindi",
        "model_version": "hindi_word_char_v1",
        "model_type": "scikit_learn_tfidf_logreg",
        "architecture": "FeatureUnion(Word (1,2) + Char_wb (2,4)) -> LogisticRegression(balanced)",
        "dataset_source": "necrosyth/hindi-social-media-hostility-detection",
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "optimal_threshold": best_th,
        "metrics": eval_res["metrics"],
        "checkpoint_path": model_path
    }
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(eval_res, f, indent=2)
        
    print(f"Saved artifacts to {model_path}, {config_path}, {report_path}")
    return eval_res


# =====================================================================
# 3. HINGLISH / CODE-MIXED MODEL TRAINING
# =====================================================================
def train_hinglish():
    print("\n" + "="*60)
    print(">>> [3/4] Training Hinglish Model (PRISM + Conversational Context Corpus)")
    print("="*60)
    
    train_orig = pd.read_csv("data/processed/indic/hinglish_train.csv")
    val_orig = pd.read_csv("data/processed/indic/hinglish_val.csv")
    test_orig = pd.read_csv("data/processed/indic/hinglish_test.csv")
    
    supp_path = "data/processed/indic/hinglish_supplementary_context.csv"
    if os.path.exists(supp_path):
        supp_df = pd.read_csv(supp_path)
        supp_train, supp_temp = train_test_split(supp_df, test_size=0.30, stratify=supp_df['legitimate'], random_state=RANDOM_STATE)
        supp_val, supp_test = train_test_split(supp_temp, test_size=0.50, stratify=supp_temp['legitimate'], random_state=RANDOM_STATE)
        
        # 6x weighting of conversational context & control samples during training
        supp_train_rep = pd.concat([supp_train] * 6, ignore_index=True)
        train_df = pd.concat([train_orig, supp_train_rep], ignore_index=True)
        val_df = pd.concat([val_orig, supp_val], ignore_index=True).drop_duplicates(subset=['text'])
        test_df = pd.concat([test_orig, supp_test], ignore_index=True).drop_duplicates(subset=['text'])
    else:
        train_df, val_df, test_df = train_orig, val_orig, test_orig
    
    X_train = np.array(train_df["text"].fillna("").tolist(), dtype=object)
    y_train = np.array((train_df["legitimate"] == 0.0).astype(int).tolist(), dtype=int)
    
    X_val = np.array(val_df["text"].fillna("").tolist(), dtype=object)
    y_val = np.array((val_df["legitimate"] == 0.0).astype(int).tolist(), dtype=int)
    
    X_test = np.array(test_df["text"].fillna("").tolist(), dtype=object)
    y_test = np.array((test_df["legitimate"] == 0.0).astype(int).tolist(), dtype=int)
    
    print(f"Hinglish Train: {len(X_train)} samples ({y_train.sum()} hate, {(y_train==0).sum()} legit)")
    print(f"Hinglish Val:   {len(X_val)} samples ({y_val.sum()} hate, {(y_val==0).sum()} legit)")
    print(f"Hinglish Test:  {len(X_test)} samples ({y_test.sum()} hate, {(y_test==0).sum()} legit)")
    
    t0 = time.time()
    pipe = build_pipeline(char_ngrams=(3, 5), word_ngrams=(1, 2), c_val=3.0, token_pattern=r'(?u)\b\w+\b', word_min_df=1)
    pipe.fit(X_train, y_train)
    fit_time = time.time() - t0
    print(f"Training completed in {fit_time:.2f}s")
    
    best_th = tune_threshold(pipe, X_val, y_val, min_recall=0.70)
    print(f"Optimal validation threshold: {best_th}")
    
    eval_res = evaluate_model(pipe, best_th, X_test, y_test, "Hinglish", "pankajbiswas6/prism-hinglish-hate-speech + Conversational Context Corpus")
    print(f"Test Results: Acc={eval_res['metrics']['accuracy']}, Prec={eval_res['metrics']['precision']}, "
          f"Rec={eval_res['metrics']['recall']}, F1={eval_res['metrics']['f1_score']}, ROC-AUC={eval_res['metrics']['roc_auc']}")
    print(f"Confusion Matrix: {eval_res['confusion_matrix']}")
    
    model_path = os.path.join(MODELS_DIR, "hinglish_model.joblib")
    config_path = os.path.join(MODELS_DIR, "hinglish_config.json")
    report_path = os.path.join(REPORTS_DIR, "hinglish_evaluation_report.json")
    
    joblib.dump(pipe, model_path)
    
    config = {
        "language": "hinglish",
        "model_version": "hinglish_contextual_v2",
        "model_type": "scikit_learn_tfidf_logreg",
        "architecture": "FeatureUnion(Word (1,2) + Char_wb (3,5)) -> LogisticRegression(balanced)",
        "dataset_source": "pankajbiswas6/prism-hinglish-hate-speech + Conversational Context Corpus",
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "optimal_threshold": best_th,
        "metrics": eval_res["metrics"],
        "checkpoint_path": model_path
    }
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(eval_res, f, indent=2)
        
    print(f"Saved artifacts to {model_path}, {config_path}, {report_path}")
    return eval_res


# =====================================================================
# 4. KANNADA MODEL TRAINING (with Indic Unicode tokenization & insults data)
# =====================================================================
def train_kannada():
    print("\n" + "="*60)
    print(">>> [4/4] Training Kannada Model (community-datasets/offenseval_dravidian + Interpersonal Insults)")
    print("="*60)
    
    train_orig = pd.read_csv("data/processed/indic/kannada_train.csv")
    val_orig = pd.read_csv("data/processed/indic/kannada_val.csv")
    
    supp_path = "data/processed/indic/kannada_supplementary_insults.csv"
    if os.path.exists(supp_path):
        supp_df = pd.read_csv(supp_path)
        supp_train, supp_test = train_test_split(supp_df, test_size=0.30, stratify=supp_df['legitimate'], random_state=RANDOM_STATE)
        train_comb = pd.concat([train_orig, supp_train], ignore_index=True).drop_duplicates(subset=['text'])
        test_comb = pd.concat([val_orig, supp_test], ignore_index=True).drop_duplicates(subset=['text'])
    else:
        train_comb = train_orig
        test_comb = val_orig
        
    # Split test_comb into stratified 50% validation and 50% held-out test
    val_split, test_split = train_test_split(test_comb, test_size=0.50, stratify=test_comb['legitimate'], random_state=RANDOM_STATE)
    
    X_train = np.array(train_comb["text"].fillna("").tolist(), dtype=object)
    y_train = np.array((train_comb["legitimate"] == 0.0).astype(int).tolist(), dtype=int)
    
    X_val = np.array(val_split["text"].fillna("").tolist(), dtype=object)
    y_val = np.array((val_split["legitimate"] == 0.0).astype(int).tolist(), dtype=int)
    
    X_test = np.array(test_split["text"].fillna("").tolist(), dtype=object)
    y_test = np.array((test_split["legitimate"] == 0.0).astype(int).tolist(), dtype=int)
    
    print(f"Kannada Train: {len(X_train)} samples ({y_train.sum()} harmful, {(y_train==0).sum()} legit)")
    print(f"Kannada Val:   {len(X_val)} samples ({y_val.sum()} harmful, {(y_val==0).sum()} legit)")
    print(f"Kannada Test:  {len(X_test)} samples ({y_test.sum()} harmful, {(y_test==0).sum()} legit)")
    
    t0 = time.time()
    pipe = build_pipeline(char_ngrams=(2, 4), word_ngrams=(1, 2), c_val=2.0, token_pattern=INDIC_TOKEN_PATTERN, word_min_df=1)
    pipe.fit(X_train, y_train)
    fit_time = time.time() - t0
    print(f"Training completed in {fit_time:.2f}s")
    
    best_th = tune_threshold(pipe, X_val, y_val, min_recall=0.45)
    print(f"Optimal validation threshold: {best_th}")
    
    eval_res = evaluate_model(pipe, best_th, X_test, y_test, "Kannada", "community-datasets/offenseval_dravidian + Interpersonal Insults", split_name="held_out_test")
    print(f"Held-Out Test Results: Acc={eval_res['metrics']['accuracy']}, Prec={eval_res['metrics']['precision']}, "
          f"Rec={eval_res['metrics']['recall']}, F1={eval_res['metrics']['f1_score']}, ROC-AUC={eval_res['metrics']['roc_auc']}")
    print(f"Confusion Matrix: {eval_res['confusion_matrix']}")
    
    model_path = os.path.join(MODELS_DIR, "kannada_model.joblib")
    config_path = os.path.join(MODELS_DIR, "kannada_config.json")
    report_path = os.path.join(REPORTS_DIR, "kannada_evaluation_report.json")
    
    joblib.dump(pipe, model_path)
    
    config = {
        "language": "kannada",
        "model_version": "kannada_word_char_v2",
        "model_type": "scikit_learn_tfidf_logreg",
        "architecture": "FeatureUnion(IndicWord (1,2) + Char_wb (2,4)) -> LogisticRegression(balanced)",
        "dataset_source": "community-datasets/offenseval_dravidian + Interpersonal Insults Corpus",
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "optimal_threshold": best_th,
        "metrics": eval_res["metrics"],
        "checkpoint_path": model_path
    }
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(eval_res, f, indent=2)
        
    print(f"Saved artifacts to {model_path}, {config_path}, {report_path}")
    return eval_res


def main():
    total_start = time.time()
    print("#################################################################")
    print(" Sentinel AI (CSEAIML2026-P03) — Indic Multilingual Model Training")
    print("#################################################################")
    
    te_res = train_telugu()
    hi_res = train_hindi()
    hg_res = train_hinglish()
    kn_res = train_kannada()
    
    total_time = time.time() - total_start
    print("\n" + "#"*60)
    print(f"All 4 Multilingual Models Successfully Trained in {total_time:.2f}s!")
    print("#"*60)
    print(f"Telugu:   F1={te_res['metrics']['f1_score']}, ROC-AUC={te_res['metrics']['roc_auc']}, Thresh={te_res['optimal_threshold']}")
    print(f"Hindi:    F1={hi_res['metrics']['f1_score']}, ROC-AUC={hi_res['metrics']['roc_auc']}, Thresh={hi_res['optimal_threshold']}")
    print(f"Hinglish: F1={hg_res['metrics']['f1_score']}, ROC-AUC={hg_res['metrics']['roc_auc']}, Thresh={hg_res['optimal_threshold']}")
    print(f"Kannada:  F1={kn_res['metrics']['f1_score']}, ROC-AUC={kn_res['metrics']['roc_auc']}, Thresh={kn_res['optimal_threshold']}")


if __name__ == "__main__":
    main()
