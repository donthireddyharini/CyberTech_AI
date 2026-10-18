"""
Sentinel AI — Standalone Google Colab GPU Evaluator for Pretrained Toxicity Models
(CSEAIML2026-P03)

This script is engineered to run in a GPU-accelerated environment (e.g. Google Colab Free Tier T4 GPU).
It empirically benchmarks fine-tuned Hugging Face transformer models across genuine test splits
without train/test leakage and saves all metrics to reports/pretrained_model_comparison.json.

Evaluations Included:
1. English: unitary/toxic-bert on Civil Comments held-out test split (2,979 samples)
   - Tunes decision threshold on validation set (data/splits/val.csv) ONLY.
   - Evaluates once on held-out test set (data/splits/test.csv).
   - Computes ROC-AUC, PR-AUC, Precision, Recall, F1, Confusion Matrix, and Latency.
2. Hinglish: Keshav0av/HinTox-hinglish-hate-speech-abuse-detection on PRISM held-out test split (8,852 samples).
3. Telugu: ramesh070/indicbert-hatespeechdetection-telugu on IIIT-H held-out test split (7,033 samples).
4. Hindi: Hate-speech-CNERG/hindi-abusive-MuRIL on Multilingual HateCheck diagnostic test set (3,565 samples).
5. Kannada: Documented as skipped (no verified public fine-tuned Kannada toxicity checkpoint; Dravidian OffenseVal has only val split).

=== GOOGLE COLAB SETUP INSTRUCTIONS ===
Step 1: Open https://colab.research.google.com and create a new notebook.
Step 2: Change runtime type to GPU: Runtime -> Change runtime type -> Hardware accelerator -> T4 GPU.
Step 3: Upload the CyberTech AI project folder or files:
   Option A (Upload as zip):
     - On your local machine, zip the project directory.
     - In Colab file browser, upload 'CyberTech_AI.zip' and run:
         !unzip -q CyberTech_AI.zip
         %cd "CyberTech AI"
   Option B (Google Drive mount):
     - Place 'CyberTech AI' in your Google Drive root.
     - In Colab run:
         from google.colab import drive
         drive.mount('/content/drive')
         %cd "/content/drive/MyDrive/CyberTech AI"
Step 4: Install runtime packages:
     !pip install torch transformers scikit-learn pandas scipy
Step 5: Run the evaluation script:
     !python ml/colab_evaluate_pretrained_models.py
"""
import os
import json
import time
import pandas as pd
import numpy as np

def run_all_evaluations():
    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        from sklearn.metrics import (
            classification_report, roc_auc_score, precision_recall_curve,
            average_precision_score, confusion_matrix, accuracy_score,
            precision_score, recall_score, f1_score
        )
    except ImportError as e:
        print(f"Missing dependency: {e}")
        print("Please install requirements on Colab: !pip install torch transformers scikit-learn pandas scipy")
        return

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"==================================================")
    print(f"Sentinel AI Pretrained Model Evaluator")
    print(f"Target Hardware Device: {device}")
    if device == "cuda":
        print(f"GPU Model: {torch.cuda.get_device_name(0)}")
    print(f"==================================================\n")

    results_payload = {
        "evaluation_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "device": device,
        "gpu_name": torch.cuda.get_device_name(0) if device == "cuda" else "CPU",
        "evaluations": {},
        "skipped_evaluations": {}
    }

    # =========================================================================
    # 1. ENGLISH: unitary/toxic-bert vs Civil Comments
    # =========================================================================
    eng_val_path = "data/splits/val.csv"
    eng_test_path = "data/splits/test.csv"
    print("--- [1/4] Evaluating English: unitary/toxic-bert ---")
    if os.path.exists(eng_val_path) and os.path.exists(eng_test_path):
        df_val = pd.read_csv(eng_val_path)
        df_test = pd.read_csv(eng_test_path)
        
        print("Loading unitary/toxic-bert checkpoint...")
        tokenizer = AutoTokenizer.from_pretrained("unitary/toxic-bert")
        model = AutoModelForSequenceClassification.from_pretrained("unitary/toxic-bert").to(device)
        model.eval()

        def get_toxic_bert_probs(texts, batch_size=32):
            all_probs = []
            for i in range(0, len(texts), batch_size):
                b = texts[i:i+batch_size]
                enc = tokenizer(b, padding=True, truncation=True, max_length=128, return_tensors="pt").to(device)
                with torch.no_grad():
                    logits = model(**enc).logits
                    # Label 0 is 'toxic' in unitary/toxic-bert multi-label output
                    p = torch.sigmoid(logits)[:, 0].cpu().numpy()
                    all_probs.extend(p)
            return np.array(all_probs)

        # A. Tune threshold on VALIDATION SET ONLY
        print(f"Tuning threshold on validation set ({len(df_val)} samples)...")
        val_texts = df_val["cleaned_text"].tolist()
        val_y = df_val["label_toxic"].values
        val_probs = get_toxic_bert_probs(val_texts)

        best_t, best_val_f1 = 0.5, -1.0
        for t in np.arange(0.1, 0.9, 0.05):
            preds = (val_probs >= t).astype(int)
            f = f1_score(val_y, preds, zero_division=0)
            if f > best_val_f1:
                best_val_f1 = f
                best_t = round(float(t), 2)
        print(f"Optimal validation threshold selected: {best_t} (Validation Toxic F1: {best_val_f1:.4f})")

        # B. Evaluate once on HELD-OUT TEST SET
        print(f"Evaluating held-out test split ({len(df_test)} samples)...")
        test_texts = df_test["cleaned_text"].tolist()
        test_y = df_test["label_toxic"].values

        t0 = time.time()
        test_probs = get_toxic_bert_probs(test_texts)
        total_time = time.time() - t0
        latency_ms = (total_time / len(test_texts)) * 1000

        # Evaluate at default 0.50 and validation-tuned threshold
        for eval_thresh, desc in [(0.50, "default_0.50"), (best_t, f"val_tuned_{best_t}")]:
            test_preds = (test_probs >= eval_thresh).astype(int)
            cm = confusion_matrix(test_y, test_preds)
            tn, fp, fn, tp = cm.ravel()
            roc = roc_auc_score(test_y, test_probs)
            pr_auc = average_precision_score(test_y, test_probs)
            prec = precision_score(test_y, test_preds, pos_label=1, zero_division=0)
            rec = recall_score(test_y, test_preds, pos_label=1, zero_division=0)
            f1_bin = f1_score(test_y, test_preds, pos_label=1, zero_division=0)
            f1_mac = f1_score(test_y, test_preds, average="macro", zero_division=0)
            acc = accuracy_score(test_y, test_preds)

            key = f"english_toxic_bert_{desc}"
            results_payload["evaluations"][key] = {
                "model_id": "unitary/toxic-bert",
                "split": "held_out_test",
                "test_samples": len(test_texts),
                "operating_threshold": eval_thresh,
                "latency_ms_per_sample": round(latency_ms, 2),
                "accuracy": round(float(acc), 4),
                "roc_auc": round(float(roc), 4),
                "pr_auc": round(float(pr_auc), 4),
                "binary_toxic": {
                    "precision": round(float(prec), 4),
                    "recall": round(float(rec), 4),
                    "f1": round(float(f1_bin), 4)
                },
                "macro_f1": round(float(f1_mac), 4),
                "confusion_matrix": {
                    "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)
                }
            }
            print(f"Results [{desc}]: ROC-AUC={roc:.4f}, PR-AUC={pr_auc:.4f}, Prec={prec:.4f}, Rec={rec:.4f}, F1={f1_bin:.4f}, MacroF1={f1_mac:.4f}")
            print(f"Confusion: TN={tn}, FP={fp}, FN={fn}, TP={tp}")
    else:
        print("Skipping English: test or val files missing.")

    # =========================================================================
    # 2. HINGLISH: Keshav0av/HinTox on PRISM test split
    # =========================================================================
    hinglish_test_path = "data/processed/indic/hinglish_test.csv"
    print("\n--- [2/4] Evaluating Hinglish: Keshav0av/HinTox-hinglish-hate-speech-abuse-detection ---")
    if os.path.exists(hinglish_test_path):
        df_hi = pd.read_csv(hinglish_test_path)
        print(f"Loaded {len(df_hi)} held-out Hinglish test samples. Loading model...")
        try:
            tok_hi = AutoTokenizer.from_pretrained("Keshav0av/HinTox-hinglish-hate-speech-abuse-detection")
            mod_hi = AutoModelForSequenceClassification.from_pretrained("Keshav0av/HinTox-hinglish-hate-speech-abuse-detection").to(device)
            mod_hi.eval()

            texts = df_hi["text"].fillna("").tolist()
            y_true = df_hi["hate_speech"].values.astype(int)

            probs = []
            t0 = time.time()
            batch_size = 32
            with torch.no_grad():
                for i in range(0, len(texts), batch_size):
                    b = texts[i:i+batch_size]
                    enc = tok_hi(b, padding=True, truncation=True, max_length=128, return_tensors="pt").to(device)
                    logits = mod_hi(**enc).logits
                    p = torch.softmax(logits, dim=-1)[:, 1].cpu().numpy()
                    probs.extend(p)
            elapsed = time.time() - t0
            latency = (elapsed / len(texts)) * 1000
            probs = np.array(probs)
            preds = (probs >= 0.5).astype(int)

            roc = roc_auc_score(y_true, probs)
            pr_auc = average_precision_score(y_true, probs)
            prec = precision_score(y_true, preds, pos_label=1, zero_division=0)
            rec = recall_score(y_true, preds, pos_label=1, zero_division=0)
            f1_bin = f1_score(y_true, preds, pos_label=1, zero_division=0)
            f1_mac = f1_score(y_true, preds, average="macro", zero_division=0)
            acc = accuracy_score(y_true, preds)
            tn, fp, fn, tp = confusion_matrix(y_true, preds).ravel()

            results_payload["evaluations"]["hinglish_hintox_test"] = {
                "model_id": "Keshav0av/HinTox-hinglish-hate-speech-abuse-detection",
                "split": "held_out_test",
                "dataset_source": "pankajbiswas6/prism-hinglish-hate-speech",
                "test_samples": len(texts),
                "operating_threshold": 0.50,
                "label_compatibility_note": "Target label 1 is offensive/hate; compatible with PRISM binary label.",
                "latency_ms_per_sample": round(latency, 2),
                "accuracy": round(float(acc), 4),
                "roc_auc": round(float(roc), 4),
                "pr_auc": round(float(pr_auc), 4),
                "binary_toxic": {
                    "precision": round(float(prec), 4),
                    "recall": round(float(rec), 4),
                    "f1": round(float(f1_bin), 4)
                },
                "macro_f1": round(float(f1_mac), 4),
                "confusion_matrix": {
                    "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)
                }
            }
            print(f"Hinglish Test Results: ROC-AUC={roc:.4f}, Prec={prec:.4f}, Rec={rec:.4f}, F1={f1_bin:.4f}, MacroF1={f1_mac:.4f}")
            print(f"Confusion: TN={tn}, FP={fp}, FN={fn}, TP={tp}")
        except Exception as e:
            print(f"Hinglish evaluation failed to run: {e}")
            results_payload["skipped_evaluations"]["hinglish"] = str(e)

    # =========================================================================
    # 3. TELUGU: ramesh070/indicbert-hatespeechdetection-telugu
    # =========================================================================
    telugu_test_path = "data/processed/indic/telugu_test.csv"
    print("\n--- [3/4] Evaluating Telugu: ramesh070/indicbert-hatespeechdetection-telugu ---")
    if os.path.exists(telugu_test_path):
        df_te = pd.read_csv(telugu_test_path)
        print(f"Loaded {len(df_te)} held-out Telugu test samples (Severe imbalance: 76 positive / 6957 negative)...")
        try:
            tok_te = AutoTokenizer.from_pretrained("ramesh070/indicbert-hatespeechdetection-telugu")
            mod_te = AutoModelForSequenceClassification.from_pretrained("ramesh070/indicbert-hatespeechdetection-telugu").to(device)
            mod_te.eval()

            texts = df_te["text"].fillna("").tolist()
            y_true = df_te["hate_speech"].values.astype(int)

            probs = []
            t0 = time.time()
            batch_size = 32
            with torch.no_grad():
                for i in range(0, len(texts), batch_size):
                    b = texts[i:i+batch_size]
                    enc = tok_te(b, padding=True, truncation=True, max_length=128, return_tensors="pt").to(device)
                    logits = mod_te(**enc).logits
                    p = torch.softmax(logits, dim=-1)[:, 1].cpu().numpy()
                    probs.extend(p)
            elapsed = time.time() - t0
            latency = (elapsed / len(texts)) * 1000
            probs = np.array(probs)
            preds = (probs >= 0.5).astype(int)

            roc = roc_auc_score(y_true, probs)
            pr_auc = average_precision_score(y_true, probs)
            prec = precision_score(y_true, preds, pos_label=1, zero_division=0)
            rec = recall_score(y_true, preds, pos_label=1, zero_division=0)
            f1_bin = f1_score(y_true, preds, pos_label=1, zero_division=0)
            f1_mac = f1_score(y_true, preds, average="macro", zero_division=0)
            acc = accuracy_score(y_true, preds)
            tn, fp, fn, tp = confusion_matrix(y_true, preds).ravel()

            results_payload["evaluations"]["telugu_indicbert_test"] = {
                "model_id": "ramesh070/indicbert-hatespeechdetection-telugu",
                "split": "held_out_test",
                "dataset_source": "mounikaiiith/Telugu-Hatespeech",
                "test_samples": len(texts),
                "operating_threshold": 0.50,
                "label_compatibility_note": "Binary hate speech classification; severe imbalance (1.08% positive rate).",
                "latency_ms_per_sample": round(latency, 2),
                "accuracy": round(float(acc), 4),
                "roc_auc": round(float(roc), 4),
                "pr_auc": round(float(pr_auc), 4),
                "binary_toxic": {
                    "precision": round(float(prec), 4),
                    "recall": round(float(rec), 4),
                    "f1": round(float(f1_bin), 4)
                },
                "macro_f1": round(float(f1_mac), 4),
                "confusion_matrix": {
                    "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)
                }
            }
            print(f"Telugu Test Results: ROC-AUC={roc:.4f}, PR-AUC={pr_auc:.4f}, Prec={prec:.4f}, Rec={rec:.4f}, F1={f1_bin:.4f}, MacroF1={f1_mac:.4f}")
            print(f"Confusion: TN={tn}, FP={fp}, FN={fn}, TP={tp}")
        except Exception as e:
            print(f"Telugu evaluation failed: {e}")
            results_payload["skipped_evaluations"]["telugu"] = str(e)

    # =========================================================================
    # 4. HINDI: Hate-speech-CNERG/hindi-abusive-MuRIL on Multilingual HateCheck
    # =========================================================================
    hindi_test_path = "data/raw/indic/hatecheck_hindi_test.csv"
    print("\n--- [4/4] Evaluating Hindi: Hate-speech-CNERG/hindi-abusive-MuRIL ---")
    if os.path.exists(hindi_test_path):
        df_hi_hc = pd.read_csv(hindi_test_path)
        print(f"Loaded {len(df_hi_hc)} diagnostic HateCheck samples (Gold functional test suite)...")
        try:
            tok_hin = AutoTokenizer.from_pretrained("Hate-speech-CNERG/hindi-abusive-MuRIL")
            mod_hin = AutoModelForSequenceClassification.from_pretrained("Hate-speech-CNERG/hindi-abusive-MuRIL").to(device)
            mod_hin.eval()

            texts = df_hi_hc["test_case"].fillna("").tolist()
            y_true = (df_hi_hc["label_gold"].astype(str).str.lower() == "hateful").astype(int).values

            probs = []
            t0 = time.time()
            batch_size = 32
            with torch.no_grad():
                for i in range(0, len(texts), batch_size):
                    b = texts[i:i+batch_size]
                    enc = tok_hin(b, padding=True, truncation=True, max_length=128, return_tensors="pt").to(device)
                    logits = mod_hin(**enc).logits
                    p = torch.softmax(logits, dim=-1)[:, 1].cpu().numpy()
                    probs.extend(p)
            elapsed = time.time() - t0
            latency = (elapsed / len(texts)) * 1000
            probs = np.array(probs)
            preds = (probs >= 0.5).astype(int)

            roc = roc_auc_score(y_true, probs)
            pr_auc = average_precision_score(y_true, probs)
            prec = precision_score(y_true, preds, pos_label=1, zero_division=0)
            rec = recall_score(y_true, preds, pos_label=1, zero_division=0)
            f1_bin = f1_score(y_true, preds, pos_label=1, zero_division=0)
            f1_mac = f1_score(y_true, preds, average="macro", zero_division=0)
            acc = accuracy_score(y_true, preds)
            tn, fp, fn, tp = confusion_matrix(y_true, preds).ravel()

            results_payload["evaluations"]["hindi_muril_diagnostic_test"] = {
                "model_id": "Hate-speech-CNERG/hindi-abusive-MuRIL",
                "split": "diagnostic_functional_test_suite",
                "dataset_source": "Paul/hatecheck-hindi (NAACL 2022)",
                "test_samples": len(texts),
                "operating_threshold": 0.50,
                "label_compatibility_note": "Diagnostic functional test suite: abusive vs hateful gold labels.",
                "latency_ms_per_sample": round(latency, 2),
                "accuracy": round(float(acc), 4),
                "roc_auc": round(float(roc), 4),
                "pr_auc": round(float(pr_auc), 4),
                "binary_toxic": {
                    "precision": round(float(prec), 4),
                    "recall": round(float(rec), 4),
                    "f1": round(float(f1_bin), 4)
                },
                "macro_f1": round(float(f1_mac), 4),
                "confusion_matrix": {
                    "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)
                }
            }
            print(f"Hindi Diagnostic Test Results: ROC-AUC={roc:.4f}, Prec={prec:.4f}, Rec={rec:.4f}, F1={f1_bin:.4f}, MacroF1={f1_mac:.4f}")
            print(f"Confusion: TN={tn}, FP={fp}, FN={fn}, TP={tp}")
        except Exception as e:
            print(f"Hindi evaluation failed: {e}")
            results_payload["skipped_evaluations"]["hindi"] = str(e)

    # =========================================================================
    # 5. MULTILINGUAL INDIC: Hate-speech-CNERG/indic-abusive-allInOne-MuRIL
    # =========================================================================
    print("\n--- [5/5] Evaluating Multilingual Indic: Hate-speech-CNERG/indic-abusive-allInOne-MuRIL ---")
    if os.path.exists(hindi_test_path):
        try:
            print("Loading Hate-speech-CNERG/indic-abusive-allInOne-MuRIL...")
            tok_all = AutoTokenizer.from_pretrained("Hate-speech-CNERG/indic-abusive-allInOne-MuRIL")
            mod_all = AutoModelForSequenceClassification.from_pretrained("Hate-speech-CNERG/indic-abusive-allInOne-MuRIL").to(device)
            mod_all.eval()

            texts = df_hi_hc["test_case"].fillna("").tolist()
            y_true = (df_hi_hc["label_gold"].astype(str).str.lower() == "hateful").astype(int).values

            probs = []
            t0 = time.time()
            batch_size = 32
            with torch.no_grad():
                for i in range(0, len(texts), batch_size):
                    b = texts[i:i+batch_size]
                    enc = tok_all(b, padding=True, truncation=True, max_length=128, return_tensors="pt").to(device)
                    logits = mod_all(**enc).logits
                    p = torch.softmax(logits, dim=-1)[:, 1].cpu().numpy()
                    probs.extend(p)
            elapsed = time.time() - t0
            latency = (elapsed / len(texts)) * 1000
            probs = np.array(probs)
            preds = (probs >= 0.5).astype(int)

            roc = roc_auc_score(y_true, probs)
            pr_auc = average_precision_score(y_true, probs)
            prec = precision_score(y_true, preds, pos_label=1, zero_division=0)
            rec = recall_score(y_true, preds, pos_label=1, zero_division=0)
            f1_bin = f1_score(y_true, preds, pos_label=1, zero_division=0)
            f1_mac = f1_score(y_true, preds, average="macro", zero_division=0)
            acc = accuracy_score(y_true, preds)
            tn, fp, fn, tp = confusion_matrix(y_true, preds).ravel()

            results_payload["evaluations"]["indic_allinone_muril_diagnostic_test"] = {
                "model_id": "Hate-speech-CNERG/indic-abusive-allInOne-MuRIL",
                "split": "diagnostic_functional_test_suite",
                "dataset_source": "Paul/hatecheck-hindi (NAACL 2022)",
                "test_samples": len(texts),
                "operating_threshold": 0.50,
                "label_compatibility_note": "Multi-Indic allInOne MuRIL: Abusive (1) vs Normal (0).",
                "latency_ms_per_sample": round(latency, 2),
                "accuracy": round(float(acc), 4),
                "roc_auc": round(float(roc), 4),
                "pr_auc": round(float(pr_auc), 4),
                "binary_toxic": {
                    "precision": round(float(prec), 4),
                    "recall": round(float(rec), 4),
                    "f1": round(float(f1_bin), 4)
                },
                "macro_f1": round(float(f1_mac), 4),
                "confusion_matrix": {
                    "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)
                }
            }
            print(f"Indic AllInOne MuRIL Results: ROC-AUC={roc:.4f}, Prec={prec:.4f}, Rec={rec:.4f}, F1={f1_bin:.4f}, MacroF1={f1_mac:.4f}")
            print(f"Confusion: TN={tn}, FP={fp}, FN={fn}, TP={tp}")
        except Exception as e:
            print(f"Indic AllInOne MuRIL evaluation failed: {e}")
            results_payload["skipped_evaluations"]["indic_allinone_muril"] = str(e)

    # 6. Additional Indic Language Checkpoint Inventory
    results_payload["skipped_evaluations"]["kannada"] = (
        "Skipped empirical run: No verified, public, standalone fine-tuned sequence classification checkpoint "
        "exists for Kannada hate speech on Hugging Face. Dravidian OffenseVal has only val split (586 valid rows) "
        "and uses insult/offensive labels rather than hate speech."
    )
    results_payload["skipped_evaluations"]["bengali_candidate"] = "Hate-speech-CNERG/bengali-abusive-MuRIL registered; pending Bengali test corpus download."
    results_payload["skipped_evaluations"]["marathi_candidate"] = "l3cube-pune/hate-bert-hasoc-marathi registered; requires gated HF access."
    results_payload["skipped_evaluations"]["tamil_candidate"] = "ramesh070/indicbert-hatespeechdetection-tamil registered; pending Tamil test split."
    results_payload["skipped_evaluations"]["malayalam_candidate"] = "ramesh070/indicbert-hatespeechdetection-malayalam registered; pending Malayalam test split."
    results_payload["skipped_evaluations"]["urdu_candidate"] = "Hate-speech-CNERG/urdu-abusive-MuRIL registered; pending Urdu test split."

    # Save output report
    os.makedirs("reports", exist_ok=True)
    out_path = "reports/pretrained_model_comparison.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results_payload, f, indent=2)
    print(f"\nSuccessfully saved full empirical evaluation report to {out_path}")

if __name__ == "__main__":
    run_all_evaluations()
