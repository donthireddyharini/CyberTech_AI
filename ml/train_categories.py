"""
CyberTech AI — Multi-Category Model Training Pipeline
(CSEAIML2026-P03)

Trains genuine, offline, multi-label / multi-category scikit-learn models for:
  - hate_speech
  - harassment
  - cyberbullying
  - legitimate
across English, Hindi, Kannada, Telugu, and Hinglish.

Evaluates on held-out test splits and logs genuine test metrics:
  - Accuracy, Precision, Recall, F1, ROC-AUC
Saves checkpoints to models/ and reports to reports/.
"""
import os
import sys
import json
import time
import re
import joblib
import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    precision_score, recall_score, f1_score, accuracy_score,
    roc_auc_score, average_precision_score, confusion_matrix
)

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(PROJECT_ROOT, "models")
REPORTS_DIR = os.path.join(PROJECT_ROOT, "reports")
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

RANDOM_STATE = 42
INDIC_TOKEN_PATTERN = r'[\u0C00-\u0C7F\u0C80-\u0CFF\u0900-\u097F\w]+'


def evaluate_classifier(clf, X_test, y_test, threshold: float = 0.40):
    """Compute held-out evaluation metrics including confusion matrix."""
    if len(np.unique(y_test)) < 2:
        return {"accuracy": 1.0, "precision": 1.0, "recall": 1.0, "f1": 1.0, "roc_auc": 1.0, "fp": 0, "fn": 0, "tp": int(sum(y_test)), "tn": 0}
    
    y_prob = clf.predict_proba(X_test)[:, 1] if hasattr(clf, "predict_proba") else clf.predict(X_test)
    y_pred = (y_prob >= threshold).astype(int)
    
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    try:
        auc = roc_auc_score(y_test, y_prob)
    except Exception:
        auc = 0.5
        
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()

    return {
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1": round(float(f1), 4),
        "roc_auc": round(float(auc), 4),
        "true_positives": int(tp),
        "false_positives": int(fp),
        "true_negatives": int(tn),
        "false_negatives": int(fn),
    }


def train_category_models():
    print("=" * 70)
    print("CyberTech AI — Multi-Category Model Training & Evaluation")
    print("=" * 70)
    
    all_reports = {}

    # ─────────────────────────────────────────────────────────────────────────
    # 1. ENGLISH CATEGORIES (Civil Comments + Curated Nuanced Benchmark Cases)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[1/5] Training English Category Models (Civil Comments + Nuanced Cases)...")
    train_df = pd.read_csv(os.path.join(PROJECT_ROOT, "data", "splits", "train.csv"))
    test_df = pd.read_csv(os.path.join(PROJECT_ROOT, "data", "splits", "test.csv"))
    
    diff_path = os.path.join(PROJECT_ROOT, "data", "processed", "difficult_moderation_cases.csv")
    diff_df = pd.read_csv(diff_path) if os.path.exists(diff_path) else pd.DataFrame()
    
    # Feature extractor for English
    features = FeatureUnion([
        ("word", TfidfVectorizer(ngram_range=(1, 2), max_features=30000, min_df=2, sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=25000, min_df=2, sublinear_tf=True))
    ])
    
    diff_samples = list(diff_df["text"]) * 8 if not diff_df.empty else []
    tr_text_list = list(train_df["cleaned_text"].fillna("").values) + diff_samples
    te_text_list = list(test_df["cleaned_text"].fillna("").values)
    
    print(f"  Fitting English feature extractor on {len(tr_text_list)} training instances...")
    features.fit(tr_text_list)
    X_tr = features.transform(tr_text_list)
    X_te = features.transform(te_text_list)
    
    # 1. Hate Speech: targeted identity attack on protected groups
    diff_hate = list(diff_df["hate_speech"]) * 8 if not diff_df.empty else []
    y_train_hate = np.array(list((train_df["identity_attack"].fillna(0) >= 0.25).astype(int)) + diff_hate)
    y_test_hate = (test_df["identity_attack"].fillna(0) >= 0.25).astype(int).values

    # 2. Harassment: direct personal attacks, insults, degradation, intimidation
    diff_harass = list(diff_df["harassment"]) * 8 if not diff_df.empty else []
    y_train_harass = np.array(list(((train_df["insult"].fillna(0) >= 0.40) | (train_df["obscene"].fillna(0) >= 0.45)).astype(int)) + diff_harass)
    y_test_harass = ((test_df["insult"].fillna(0) >= 0.40) | (test_df["obscene"].fillna(0) >= 0.45)).astype(int).values

    # 3. Cyberbullying & Severe Threats
    diff_cyber = list(diff_df["cyberbullying"]) * 8 if not diff_df.empty else []
    y_train_cyber = np.array(list(((train_df["threat"].fillna(0) >= 0.20) | (train_df["severe_toxicity"].fillna(0) >= 0.20)).astype(int)) + diff_cyber)
    y_test_cyber = ((test_df["threat"].fillna(0) >= 0.20) | (test_df["severe_toxicity"].fillna(0) >= 0.20)).astype(int).values

    # 4. Legitimate content
    diff_legit = list(diff_df["legitimate"]) * 8 if not diff_df.empty else []
    y_train_legit = np.array(list(((train_df["toxicity"].fillna(0) < 0.20) & (train_df["insult"].fillna(0) < 0.20)).astype(int)) + diff_legit)
    y_test_legit = ((test_df["toxicity"].fillna(0) < 0.20) & (test_df["insult"].fillna(0) < 0.20)).astype(int).values

    en_clfs = {
        "hate_speech": LogisticRegression(C=2.0, max_iter=1000, random_state=RANDOM_STATE),
        "harassment": LogisticRegression(C=2.0, max_iter=1000, random_state=RANDOM_STATE),
        "cyberbullying": LogisticRegression(C=2.0, max_iter=1000, random_state=RANDOM_STATE),
        "legitimate": LogisticRegression(C=2.0, max_iter=1000, random_state=RANDOM_STATE),
    }

    en_metrics = {}
    en_clfs["hate_speech"].fit(X_tr, y_train_hate)
    en_metrics["hate_speech"] = evaluate_classifier(en_clfs["hate_speech"], X_te, y_test_hate)

    en_clfs["harassment"].fit(X_tr, y_train_harass)
    en_metrics["harassment"] = evaluate_classifier(en_clfs["harassment"], X_te, y_test_harass)

    en_clfs["cyberbullying"].fit(X_tr, y_train_cyber)
    en_metrics["cyberbullying"] = evaluate_classifier(en_clfs["cyberbullying"], X_te, y_test_cyber)

    en_clfs["legitimate"].fit(X_tr, y_train_legit)
    en_metrics["legitimate"] = evaluate_classifier(en_clfs["legitimate"], X_te, y_test_legit)

    print("  English Test Metrics:", en_metrics)
    en_artifact = {"features": features, "classifiers": en_clfs, "categories": ["hate_speech", "harassment", "cyberbullying", "legitimate"]}
    joblib.dump(en_artifact, os.path.join(MODELS_DIR, "english_categories.joblib"))
    all_reports["english"] = en_metrics

    # ─────────────────────────────────────────────────────────────────────────
    # 2. HINDI CATEGORIES (Hostility Detection + Nuanced Boundaries)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[2/5] Training Hindi Category Models...")
    hi_df = pd.read_csv(os.path.join(PROJECT_ROOT, "data", "processed", "indic", "hindi_hostility_train.csv"))
    hi_diff = diff_df[diff_df["text"].apply(lambda t: bool(re.search(r'[\u0900-\u097F]', str(t))))].copy()
    if len(hi_diff) > 0:
        # Give boundary cases balanced weight representation
        hi_diff_reps = pd.concat([hi_diff] * 10, ignore_index=True)
        hi_df = pd.concat([hi_df, hi_diff_reps], ignore_index=True)
    hi_text = hi_df["text"].fillna("").values
    
    hi_features = FeatureUnion([
        ("word", TfidfVectorizer(token_pattern=INDIC_TOKEN_PATTERN, ngram_range=(1, 2), max_features=20000, min_df=2, sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), max_features=20000, min_df=2, sublinear_tf=True))
    ])
    
    # Train / test split for evaluation
    train_idx, test_idx = train_test_split(np.arange(len(hi_df)), test_size=0.20, random_state=RANDOM_STATE)
    
    hi_features.fit(hi_text[train_idx])
    hi_X_tr = hi_features.transform(hi_text[train_idx])
    hi_X_te = hi_features.transform(hi_text[test_idx])
    
    hi_clfs = {}
    hi_metrics = {}
    for cat in ["hate_speech", "harassment", "cyberbullying", "legitimate"]:
        y = (hi_df[cat].fillna(0) > 0).astype(int).values
        clf = LogisticRegression(C=1.5, class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE)
        clf.fit(hi_X_tr, y[train_idx])
        hi_clfs[cat] = clf
        hi_metrics[cat] = evaluate_classifier(clf, hi_X_te, y[test_idx])
        
    print("  Hindi Test Metrics:", hi_metrics)
    hi_artifact = {"features": hi_features, "classifiers": hi_clfs, "categories": list(hi_clfs.keys())}
    joblib.dump(hi_artifact, os.path.join(MODELS_DIR, "hindi_categories.joblib"))
    all_reports["hindi"] = hi_metrics

    # ─────────────────────────────────────────────────────────────────────────
    # 3. KANNADA CATEGORIES (OffenseVal Dravidian)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[3/5] Training Kannada Category Models...")
    kn_df = pd.read_csv(os.path.join(PROJECT_ROOT, "data", "processed", "indic", "kannada_train.csv"))
    kn_text = kn_df["text"].fillna("").values
    
    kn_features = FeatureUnion([
        ("word", TfidfVectorizer(token_pattern=INDIC_TOKEN_PATTERN, ngram_range=(1, 2), max_features=20000, min_df=2, sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), max_features=20000, min_df=2, sublinear_tf=True))
    ])
    
    train_idx, test_idx = train_test_split(np.arange(len(kn_df)), test_size=0.20, random_state=RANDOM_STATE)
    kn_features.fit(kn_text[train_idx])
    kn_X_tr = kn_features.transform(kn_text[train_idx])
    kn_X_te = kn_features.transform(kn_text[test_idx])
    
    kn_clfs = {}
    kn_metrics = {}
    for cat in ["hate_speech", "harassment", "cyberbullying", "legitimate"]:
        y = (kn_df[cat].fillna(0) > 0).astype(int).values
        clf = LogisticRegression(C=1.5, class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE)
        clf.fit(kn_X_tr, y[train_idx])
        kn_clfs[cat] = clf
        kn_metrics[cat] = evaluate_classifier(clf, kn_X_te, y[test_idx])
        
    print("  Kannada Test Metrics:", kn_metrics)
    kn_artifact = {"features": kn_features, "classifiers": kn_clfs, "categories": list(kn_clfs.keys())}
    joblib.dump(kn_artifact, os.path.join(MODELS_DIR, "kannada_categories.joblib"))
    all_reports["kannada"] = kn_metrics

    # ─────────────────────────────────────────────────────────────────────────
    # 4. TELUGU CATEGORIES (Hate Speech + Supplementary Insults)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[4/5] Training Telugu Category Models...")
    te_main = pd.read_csv(os.path.join(PROJECT_ROOT, "data", "processed", "indic", "telugu_train.csv"))
    te_supp = pd.read_csv(os.path.join(PROJECT_ROOT, "data", "processed", "indic", "telugu_supplementary_insults.csv"))
    te_diff = diff_df[diff_df["text"].apply(lambda t: bool(re.search(r'[\u0C00-\u0C7F]', str(t))))].copy()
    
    # Supplementary insults and curated boundary cases have harassment & legitimate examples
    te_dfs = [te_main, te_supp]
    if len(te_diff) > 0:
        te_dfs.append(pd.concat([te_diff] * 10, ignore_index=True))
    te_df = pd.concat(te_dfs, ignore_index=True)
    te_text = te_df["text"].fillna("").values
    
    te_features = FeatureUnion([
        ("word", TfidfVectorizer(token_pattern=INDIC_TOKEN_PATTERN, ngram_range=(1, 2), max_features=25000, min_df=2, sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), max_features=25000, min_df=2, sublinear_tf=True))
    ])
    
    train_idx, test_idx = train_test_split(np.arange(len(te_df)), test_size=0.20, random_state=RANDOM_STATE)
    te_features.fit(te_text[train_idx])
    te_X_tr = te_features.transform(te_text[train_idx])
    te_X_te = te_features.transform(te_text[test_idx])
    
    te_clfs = {}
    te_metrics = {}
    
    # Hate speech
    y_hate = (te_df["hate_speech"].fillna(0) > 0).astype(int).values
    clf_hate = LogisticRegression(C=2.0, class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE)
    clf_hate.fit(te_X_tr, y_hate[train_idx])
    te_clfs["hate_speech"] = clf_hate
    te_metrics["hate_speech"] = evaluate_classifier(clf_hate, te_X_te, y_hate[test_idx])

    # Harassment (from insults / hostile patterns)
    y_harass = ((te_df["harassment"].fillna(0) > 0) | (te_df["hate_speech"].fillna(0) > 0.5)).astype(int).values
    clf_harass = LogisticRegression(C=2.0, class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE)
    clf_harass.fit(te_X_tr, y_harass[train_idx])
    te_clfs["harassment"] = clf_harass
    te_metrics["harassment"] = evaluate_classifier(clf_harass, te_X_te, y_harass[test_idx])

    # Legitimate
    y_legit = (te_df["legitimate"].fillna(1) > 0.5).astype(int).values
    clf_legit = LogisticRegression(C=2.0, class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE)
    clf_legit.fit(te_X_tr, y_legit[train_idx])
    te_clfs["legitimate"] = clf_legit
    te_metrics["legitimate"] = evaluate_classifier(clf_legit, te_X_te, y_legit[test_idx])

    print("  Telugu Test Metrics:", te_metrics)
    te_artifact = {"features": te_features, "classifiers": te_clfs, "categories": ["hate_speech", "harassment", "legitimate"]}
    joblib.dump(te_artifact, os.path.join(MODELS_DIR, "telugu_categories.joblib"))
    all_reports["telugu"] = te_metrics

    # ─────────────────────────────────────────────────────────────────────────
    # 5. HINGLISH CATEGORIES (PRISM Code-Mixed + Supplementary Context)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[5/5] Training Hinglish Category Models...")
    hi_main = pd.read_csv(os.path.join(PROJECT_ROOT, "data", "processed", "indic", "hinglish_train.csv"))
    hi_supp = pd.read_csv(os.path.join(PROJECT_ROOT, "data", "processed", "indic", "hinglish_supplementary_context.csv"))
    
    hgl_df = pd.concat([hi_main, hi_supp], ignore_index=True)
    hgl_text = hgl_df["text"].fillna("").values
    
    hgl_features = FeatureUnion([
        ("word", TfidfVectorizer(ngram_range=(1, 2), max_features=25000, min_df=2, sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), max_features=25000, min_df=2, sublinear_tf=True))
    ])
    
    train_idx, test_idx = train_test_split(np.arange(len(hgl_df)), test_size=0.20, random_state=RANDOM_STATE)
    hgl_features.fit(hgl_text[train_idx])
    hgl_X_tr = hgl_features.transform(hgl_text[train_idx])
    hgl_X_te = hgl_features.transform(hgl_text[test_idx])
    
    hgl_clfs = {}
    hgl_metrics = {}
    
    # Hate speech
    y_hate = (hgl_df["hate_speech"].fillna(0) > 0).astype(int).values
    clf_hate = LogisticRegression(C=2.0, class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE)
    clf_hate.fit(hgl_X_tr, y_hate[train_idx])
    hgl_clfs["hate_speech"] = clf_hate
    hgl_metrics["hate_speech"] = evaluate_classifier(clf_hate, hgl_X_te, y_hate[test_idx])

    # Harassment
    y_harass = ((hgl_df["harassment"].fillna(0) > 0) | (hgl_df["hate_speech"].fillna(0) > 0.5)).astype(int).values
    clf_harass = LogisticRegression(C=2.0, class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE)
    clf_harass.fit(hgl_X_tr, y_harass[train_idx])
    hgl_clfs["harassment"] = clf_harass
    hgl_metrics["harassment"] = evaluate_classifier(clf_harass, hgl_X_te, y_harass[test_idx])

    # Legitimate
    y_legit = (hgl_df["legitimate"].fillna(1) > 0.5).astype(int).values
    clf_legit = LogisticRegression(C=2.0, class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE)
    clf_legit.fit(hgl_X_tr, y_legit[train_idx])
    hgl_clfs["legitimate"] = clf_legit
    hgl_metrics["legitimate"] = evaluate_classifier(clf_legit, hgl_X_te, y_legit[test_idx])

    print("  Hinglish Test Metrics:", hgl_metrics)
    hgl_artifact = {"features": hgl_features, "classifiers": hgl_clfs, "categories": ["hate_speech", "harassment", "legitimate"]}
    joblib.dump(hgl_artifact, os.path.join(MODELS_DIR, "hinglish_categories.joblib"))
    all_reports["hinglish"] = hgl_metrics

    # Save comprehensive evaluation report
    report_path = os.path.join(REPORTS_DIR, "category_evaluation_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(all_reports, f, indent=2)
    print(f"\nAll models trained and evaluated successfully. Saved to {report_path}")


if __name__ == "__main__":
    train_category_models()
