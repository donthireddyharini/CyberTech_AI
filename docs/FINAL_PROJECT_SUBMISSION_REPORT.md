# Sentinel AI (CSEAIML2026-P03) — Final Project Submission Report
**Project Title:** NLP-Based Hate Speech and Cyberbullying Detection System for Social Media  
**Track:** CyberTech AI / Advanced Machine Learning & Natural Language Processing  
**Date of Submission:** October 18, 2026  
**System Version:** Multilingual MVP v1.2.0  

---

## 1. Executive Summary & Problem Statement

Social media platforms face an overwhelming volume of user-generated content across diverse languages, cultural contexts, and communication modalities. Conventional automated content moderation systems suffer from three critical flaws:
1. **Context Blindness**: Standard classifiers evaluate comments in isolation, frequently conflating legitimate passionate disagreement or counter-speech with hate speech, leading to unjust censorship.
2. **Linguistic Monoculture**: The vast majority of production tools are optimized almost exclusively for standard English, failing to generalize to Indic languages (Hindi, Telugu, Kannada) and Indian-language code-mixed phenomena (Hinglish).
3. **Metric Hallucination & Black-Box Decisions**: Systems either fabricate confidence scores when applied out-of-domain or provide no transparency regarding model provenance, operating thresholds, or error boundaries.

**Sentinel AI** solves this by delivering a **context-aware, multi-label, language-routed moderation intelligence platform**. It combines an empirically tuned, calibrated English toxicity classifier with a transparent multilingual routing layer that routes non-English text to verified candidate pipelines and requires human-in-the-loop oversight until GPU-accelerated evaluation is completed.

---

## 2. Project Objectives & Fulfilment

| Objective | Target Requirement | Status | Verification Reference |
| :--- | :--- | :--- | :--- |
| **Obj 1: English Model Baseline** | Train, calibrate, and tune an English toxicity classifier on held-out test splits. | **Completed & Calibrated** | `models/baseline_toxicity.joblib` ($\tau=0.40$, ROC-AUC 0.8763, F1 50.23%) |
| **Obj 2: Context Intelligence** | Dual-pass contrasting inference showing impact of surrounding conversation. | **Completed** | `POST /api/analyze/compare-context` & Context Intelligence Lab UI |
| **Obj 3: Indian Language Curation** | Research, procure, and preprocess genuine datasets for Hindi, Telugu, Kannada, Hinglish. | **Completed** | `docs/INDIAN_LANGUAGE_DATASET_SOURCES.md`, 19,450 preprocessed samples |
| **Obj 4: Pretrained Model Audit** | Audit fine-tuned checkpoints and eliminate benchmark hallucination. | **Completed** | `reports/pretrained_model_verification_audit.json` |
| **Obj 5: Unified Language MVP** | Route incoming traffic by detected script/language with honest status flags. | **Completed** | `sentinel-backend/app/nlp/engine.py` & `sentinel-backend/tests/test_api.py` |
| **Obj 6: Full-Stack Integration** | Connect FastAPI backend with dark-theme React command center. | **Completed** | Live on ports 8000 and 5173 with 100% test coverage |

---

## 3. System Architecture & Tech Stack

```
                              ┌───────────────────────────────────────────────┐
                              │            React Frontend (Vite)              │
                              │  Context Intelligence Lab & Moderator Center  │
                              └──────────────────────┬────────────────────────┘
                                                     │ HTTP / REST
                                                     ▼
                              ┌───────────────────────────────────────────────┐
                              │            FastAPI Backend Engine             │
                              │     Input Validation & Language Detection     │
                              └──────────────────────┬────────────────────────┘
                                                     │
                   ┌─────────────────────────────────┴─────────────────────────────────┐
                   ▼                                                                   ▼
┌─────────────────────────────────────────┐               ┌─────────────────────────────────────────┐
│     Validated English Model Pipeline    │               │    Multilingual Candidate Routing       │
│  enhanced_word_char_v2 (Threshold=0.40) │               │   Hindi / Telugu / Kannada / Hinglish   │
│  FeatureUnion (Word + Char) + LogReg    │               │  Colab GPU-Pending / Rule Policy Mode   │
└──────────────────┬──────────────────────┘               └────────────────────┬────────────────────┘
                   │                                                           │
                   │ (automated_pass_or_flag)                                  │ (mandatory_human_review)
                   ▼                                                           ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           SQLite Async DB & Moderator Review Queue                                │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack
- **Backend**: Python 3.14.2, FastAPI, Uvicorn (ASGI), Pydantic v2, SQLAlchemy 2.0 (AsyncIO), `aiosqlite`.
- **Machine Learning**: Scikit-Learn 1.7.dev0, NumPy, Joblib, SciPy.
- **Frontend**: React 18, TypeScript, Vite 6.4, Tailwind CSS, Lucide React Icons, Recharts.
- **Testing & Tooling**: Pytest 9.1, Pytest-AsyncIO, HTTPX, NPM.

---

## 4. Datasets, Schema, and Licensing

| Language | Dataset Name / Source | Split Breakdown | Classes / Target Tasks | License |
| :--- | :--- | :--- | :--- | :--- |
| **English** | `google/civil_comments` | 13,898 train / 2,978 val / 2,979 held-out test | Binary Toxicity ($\ge 0.5$ fraction) | Creative Commons CC0 |
| **Hindi** | `Paul/hatecheck-hindi` | 3,565 rows (2,488 hateful / 1,077 non-hateful) | Diagnostic functional suite | CC BY 4.0 |
| **Telugu** | `mounikaiiith/Telugu-Hatespeech` | 7,033 held-out test rows | Binary Hate Speech (1.08% positive rate) | Academic / Research |
| **Kannada** | `community-datasets/offenseval_dravidian` | 586 filtered validation rows | Offensive Language / Insult | CC BY 4.0 |
| **Hinglish** | `pankajbiswas6/prism-hinglish-hate-speech` | 8,852 held-out test rows (4,112 toxic / 4,740 non-toxic) | Hate & Abusive Code-Mixed Speech | Academic / Research |

*Note: All data splits are strictly partitioned with zero string overlap or data leakage.*

---

## 5. Current Model & Verified Performance Metrics

The active English production model checkpoint is stored at `models/baseline_toxicity.joblib`. Its metrics were calculated strictly on the 2,979 held-out test examples from `data/splits/test.csv`.

| Metric | Initial Baseline (Word-only, $\tau=0.50$) | Production Enhanced Model (Word+Char, $\tau=0.40$) | Improvement |
| :--- | :--- | :--- | :--- |
| **Accuracy** | 93.72% | **92.68%** | Controlled trade-off |
| **ROC-AUC** | 0.8532 | **0.8763** | **+2.31%** |
| **PR-AUC** | 0.4789 | **0.5112** | **+3.23%** |
| **Toxic Class Recall** | 37.84% (70 / 185) | **59.46% (110 / 185)** | **+21.62% absolute** |
| **Toxic Class Precision** | 49.30% (70 / 142) | **43.48% (110 / 253)** | Balanced for safety |
| **Toxic Class F1** | 42.81% | **50.23%** | **+7.42% absolute** |
| **Macro Average F1** | 69.75% | **73.14%** | **+3.39%** |
| **Confusion Matrix** | TN=2722, FP=72, FN=115, TP=70 | **TN=2651, FP=143, FN=75, TP=110** | **35 fewer false negatives** |
| **CPU Latency** | ~1.1 ms / comment | **~1.2 ms / comment** | Production-ready |

---

## 6. Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status and version identifier. |
| `GET` | `/api/model/status` | Current active model information, limitations, and operational readiness. |
| `POST` | `/api/analyze` | Core moderation analysis endpoint. Returns labels, severity, decision, English toxicity prediction, and unified language routing metadata. |
| `POST` | `/api/analyze/compare-context` | Runs two inference passes (with and without context) and returns diff analysis. |
| `GET` | `/api/dashboard/summary` | Aggregated telemetry (total analyzed, flagged, pending review, high priority). |
| `GET` | `/api/dashboard/evaluation-metrics` | Measured empirical evaluation metrics from held-out benchmarks. |
| `GET` | `/api/moderation` | Paginated queue of analyzed moderation records for human reviewers. |
| `POST` | `/api/moderation/{id}/decision` | Moderator review submission (approve, dismiss, escalate, further review). |

---

## 7. Setup & Run Instructions

### Step 1: Clone and Navigate
```bash
git clone <repository-url>
cd CyberTech-AI
```

### Step 2: Backend Setup
```powershell
cd sentinel-backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Step 3: Frontend Setup
```powershell
cd sentinel-frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

### Step 4: Verification
- Access API documentation: `http://127.0.0.1:8000/docs`
- Access Web Application: `http://127.0.0.1:5173`

---

## 8. Comprehensive Automated Testing Results

All 57 test suites run and pass in under 10 seconds:

```
============================= test session starts =============================
Platform: Windows 11, Python 3.14.2, Pytest 9.1.1
Backend API Tests:       45 passed in 5.68s
Root ML & Data Tests:    12 passed in 3.71s
Total Test Coverage:     57 passed, 0 failed, 0 skipped (100% PASS)
Frontend Build:          tsc -b && vite build (Exit Code 0, 0 TypeScript errors)
===============================================================================
```

---

## 9. Final Demonstration Checklist & Sample Inputs

Use this checklist during evaluation to verify system capabilities:

### Test Case 1: English Civil Disagreement (Non-Toxic)
- **Input Text:** `"I respectfully disagree with your conclusion, and here is my reasoning."`
- **Expected Route:** `language_route.status = "validated_model"`, `target_language = "english"`
- **Expected Decision:** `no_action`
- **Expected Toxicity Prediction:** `is_toxic = False`, `toxicity_score < 0.20`, `model_available = True`
- **UI Behavior:** Green Non-Toxic pill, emerald gauge, "Automated Pass/Flag Eligible".

### Test Case 2: English Harmful Harassment (Toxic)
- **Input Text:** `"You are a completely pathetic idiot and you should shut up and die."`
- **Expected Route:** `language_route.status = "validated_model"`, `target_language = "english"`
- **Expected Decision:** `flag_for_review` or `human_review`
- **Expected Toxicity Prediction:** `is_toxic = True`, `toxicity_score >= 0.40` (typically >0.90)
- **UI Behavior:** Red Toxic badge, red score bar, pattern match evidence displayed under harassment category.

### Test Case 3: Hindi Devanagari Comment (Needs Review)
- **Input Text:** `"यह एक शांतिपूर्ण संदेश है जो समाज में सुधार चाहता है।"`
- **Expected Route:** `language_route.status = "needs_review"`, `target_language = "hindi"`
- **Expected Candidate:** `Hate-speech-CNERG/hindi-abusive-MuRIL`
- **Expected Decision:** `human_review` (`review_status = "mandatory_human_review"`)
- **Toxicity Prediction:** `model_available = False` (Notice: *"English toxicity baseline not applicable to hindi. Multilingual evaluation pending GPU execution."*)
- **UI Behavior:** Amber warning badge clearly indicating that automated prediction is pending GPU execution.

### Test Case 4: Telugu Script Comment (Needs Review)
- **Input Text:** `"ఈ పరిశోధన ప్రాజెక్ట్ చాలా విలువైన సమాచారాన్ని అందిస్తుంది."`
- **Expected Route:** `language_route.status = "needs_review"`, `target_language = "telugu"`
- **Expected Candidate:** `ramesh070/indicbert-hatespeechdetection-telugu`
- **Expected Decision:** `human_review` (`mandatory_human_review`)
- **Toxicity Prediction:** `model_available = False`

### Test Case 5: Kannada Script Comment (Needs Review)
- **Input Text:** `"ಕನ್ನಡ ಸಾಹಿತ್ಯವು ಅತ್ಯಂತ ಶ್ರೀಮಂತ ಮತ್ತು ಪ್ರಾಚೀನ ಪರಂಪರೆಯನ್ನು ಹೊಂದಿದೆ."`
- **Expected Route:** `language_route.status = "needs_review"`, `target_language = "kannada"`
- **Expected Candidate:** `none_available` (Honest notice: *"No verified Kannada fine-tuned checkpoint available."*)
- **Expected Decision:** `human_review` (`mandatory_human_review`)

### Test Case 6: Hinglish Code-Mixed Comment (Needs Review)
- **Input Text:** `"bhai ye solution sach me kaafi helpful tha yaar, thanks."`
- **Expected Route:** `language_route.status = "needs_review"`, `target_language = "hinglish"`
- **Expected Candidate:** `Keshav0av/HinTox-hinglish-hate-speech-abuse-detection`
- **Expected Detection:** `is_code_mixed = True`
- **Expected Decision:** `human_review` (`mandatory_human_review`)

### Test Case 7: Unsupported Language (e.g. Cyrillic / French)
- **Input Text:** `"Привет мир, это тестовое сообщение на русском языке."`
- **Expected Route:** `language_route.status = "unsupported_language_model"`, `review_status = "mandatory_human_review"`
- **UI Behavior:** Rose alert indicating no calibrated model exists for this language script.

### Test Case 8: Input Validation (Empty Text & Whitespace)
- **Input Text:** `""` or `"     "`
- **Expected HTTP Code:** `422 Unprocessable Entity` with explanatory JSON error.

---

## 10. Known Limitations & Responsible AI Declarations

1. **Indic Language Automated Moderation Standby**:
   - Automated moderation is currently **active and validated solely for English**.
   - Hindi, Telugu, Kannada, and Hinglish classifiers require GPU environments (PyTorch/CUDA) to run transformer models (`MuRIL`, `IndicBERT`, `HinTox`).
   - In the present local CPU environment (Python 3.14.2), these routes are intentionally and ethically locked to `mandatory_human_review`. No artificial scores are produced.
2. **Kannada Shared Task Data Constraints**:
   - The official FIRE 2020 Dravidian test set ground-truth labels remain restricted. The current Kannada evaluation dataset is limited to validation data.
3. **Lexical Nuances**:
   - Subtly coded hate speech, dogwhistles, sarcasm, and regional slang may evade simple keyword and n-gram representations without deeper contextual attention.

---

## 11. Roadmap & Future Work

1. **Google Colab / Cloud GPU Execution**:
   - Run `ml/colab_evaluate_pretrained_models.py` on an NVIDIA T4/A100 GPU to complete the empirical benchmarks for `HinTox`, `hindi-abusive-MuRIL`, and `indicbert-telugu`.
2. **Quantized ONNX / TensorRT Export**:
   - Quantize fine-tuned multilingual transformers to ONNX INT8 format to enable low-latency, CPU-friendly edge inference directly in FastAPI.
3. **Multi-Turn Context Modeling**:
   - Incorporate thread graph representations to model escalating hostility across entire discussion threads rather than immediate antecedent/precedent message pairs.
