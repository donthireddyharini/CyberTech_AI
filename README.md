# Sentinel AI — Context-Aware Multilingual Content Moderation Intelligence Platform
**Project ID:** CSEAIML2026-P03  
**Title:** NLP-Based Hate Speech and Cyberbullying Detection System for Social Media  
**Tagline:** *Understand Context. Detect Harm. Protect Conversations.*

---

## 🚀 Quick Start Guide (Windows PowerShell)

Both backend and frontend can be started quickly in separate Windows PowerShell windows.

### 1. Prerequisites
- **Python**: 3.10+ (Tested on Python 3.14.2)
- **Node.js**: v18+ (Tested on Node v24.11.1)
- **NPM**: v9+ (Tested on NPM 11.6.4)

---

### 2. Backend Setup & Run (PowerShell)

Open PowerShell in the project root directory:

```powershell
# Navigate to backend
cd "c:\Users\girish\Downloads\CyberTech AI\sentinel-backend"

# (Optional) Install dependencies
pip install -r requirements.txt

# Run all 45 automated backend & language routing tests
pytest tests/ -v

# Run the 12 root ML baseline and Indic dataset tests (from project root)
cd ..
python -m pytest tests/test_toxicity_baseline.py tests/test_indic_data.py -v

# Start the FastAPI ASGI server
cd "sentinel-backend"
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

- **API Base URL**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Model Status Endpoint**: [http://127.0.0.1:8000/api/model/status](http://127.0.0.1:8000/api/model/status)

---

### 3. Frontend Setup & Run (PowerShell)

Open a second PowerShell window:

```powershell
# Navigate to frontend
cd "c:\Users\girish\Downloads\CyberTech AI\sentinel-frontend"

# (Optional) Install npm packages
npm install

# Verify TypeScript build
npm run build

# Start Vite development server
npm run dev -- --host 127.0.0.1 --port 5173
```

- **Application URL**: [http://127.0.0.1:5173](http://127.0.0.1:5173)

---

## 🤖 Multilingual MVP Architecture & Operating Status

Sentinel AI implements a transparent, responsible language-aware routing system. It strictly distinguishes measured, validated production models from candidate transformer models awaiting external GPU execution:

| Language / Route | Route Status | Model Name | Model Type | Review Policy | Operating Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **English** | `validated_model` | `enhanced_word_char_v2` | `scikit_learn_tfidf_logreg` | `automated_pass_or_flag` | **Operational** ($\tau=0.40$, ROC-AUC 0.8763, F1 50.23%) |
| **Hindi** | `needs_review` | `Hate-speech-CNERG/hindi-abusive-MuRIL` | `transformer_checkpoint_pending_gpu` | `mandatory_human_review` | **Rule Policy Standby** (Pending Colab GPU execution) |
| **Telugu** | `needs_review` | `ramesh070/indicbert-hatespeechdetection-telugu` | `transformer_checkpoint_pending_gpu` | `mandatory_human_review` | **Rule Policy Standby** (Pending Colab GPU execution) |
| **Kannada** | `needs_review` | `none_available` | `rule_baseline_pending_model` | `mandatory_human_review` | **Rule Policy Standby** (No public verified checkpoint) |
| **Hinglish / Code-Mixed** | `needs_review` | `Keshav0av/HinTox-hinglish-hate-speech-abuse-detection` | `transformer_checkpoint_pending_gpu` | `mandatory_human_review` | **Rule Policy Standby** (Pending Colab GPU execution) |
| **Unsupported Language** | `unsupported_language_model` | `none` | `unsupported_fallback` | `mandatory_human_review` | **Mandatory Review** (Fallback rule policy) |

> ⚠️ **Important Responsible AI Principle**: Sentinel AI does NOT fabricate classifications, probabilities, or confidence scores for languages whose classifiers have not been executed and benchmarked on genuine hardware. Hindi, Telugu, Kannada, and Hinglish comments are routed to research rule policies and flagged with `mandatory_human_review`.

---

## 📊 Trained English Model & Verified Metrics

### Checkpoint & Split Provenance
- **Checkpoint**: `models/baseline_toxicity.joblib`
- **Config**: `models/model_config.json`
- **Audit Report**: `reports/pretrained_model_verification_audit.json`
- **Dataset**: `google/civil_comments` (20,000 samples; 13,898 train, 2,978 val, 2,979 held-out test).
- **Architecture**: `FeatureUnion` combining word n-grams (1–2, 25,000 features) and character n-grams (3–5, 25,000 features) with balanced `LogisticRegression` ($C=2.0$).
- **Selected Operating Threshold**: $\tau = 0.40$ (Tuned on validation split to prioritize recall on harmful comments).

### Verified Test Split Metrics (2,979 Held-out Samples)
- **Accuracy**: 92.68%
- **ROC-AUC**: 0.8763
- **PR-AUC**: 0.5112
- **Toxic Precision**: 43.48% (110 / 253 flagged)
- **Toxic Recall**: 59.46% (110 / 185 actual toxic)
- **Toxic F1 Score**: 50.23%
- **Macro Average F1**: 73.14% (Macro Precision: 70.36%, Macro Recall: 77.17%)
- **Confusion Matrix**: TN=2,651, FP=143, FN=75, TP=110
- **Latency**: ~1.2 ms per sample on CPU

---

## 🏛️ System Architecture

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, React Router v6.
- **Visual Design**: Dark cyber-intelligence theme inspired by the Sentinel AI reference design (Midnight navy `#050a1d`, electric purple `#7c3aed`, cyan `#06b6d4`, glowing glassmorphism cards).
- **Backend API**: Python FastAPI, SQLAlchemy Async ORM, SQLite (`sqlite+aiosqlite`), Pydantic validation.
- **Inference Pipeline**: Hybrid NLP Engine combining verified English ML classifier with multilingual routing policies.
- **Human-in-the-Loop**: Moderator Command Center with audit logging, review queues, and error analysis.

---

## 🧪 Automated Test Suites (57 Total Tests)

1. **Backend API & Language Routing Tests** (`sentinel-backend/tests/test_api.py`):
   - **45 tests passing** covering health, model status, legitimate disagreement detection, harassment, hate speech, Dravidian script detection, language routing for all 5 languages, unsupported languages, empty inputs, context comparison, dashboard aggregations, and moderator decision overrides.
2. **ML Baseline & Indic Data Tests** (`tests/test_toxicity_baseline.py` & `tests/test_indic_data.py`):
   - **12 tests passing** covering model serialization, threshold adherence, feature union extraction, and integrity of prepared Hindi, Telugu, Kannada, and Hinglish dataset splits.

---

## 📚 Project Documentation

- [`docs/FINAL_PROJECT_SUBMISSION_REPORT.md`](file:///c:/Users/girish/Downloads/CyberTech%20AI/docs/FINAL_PROJECT_SUBMISSION_REPORT.md): Comprehensive final project submission report.
- [`docs/INDIAN_LANGUAGE_DATASET_SOURCES.md`](file:///c:/Users/girish/Downloads/CyberTech%20AI/docs/INDIAN_LANGUAGE_DATASET_SOURCES.md): Curated Indic datasets, schemas, and licenses.
- [`reports/pretrained_model_verification_audit.json`](file:///c:/Users/girish/Downloads/CyberTech%20AI/reports/pretrained_model_verification_audit.json): Strict empirical verification audit of model checkpoints and claims.
- [`ml/colab_evaluate_pretrained_models.py`](file:///c:/Users/girish/Downloads/CyberTech%20AI/ml/colab_evaluate_pretrained_models.py): Ready-to-run Google Colab GPU evaluation runner.
