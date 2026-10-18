# Indian-Language & Multilingual Dataset Sources & Inventory
**Project ID:** CSEAIML2026-P03 | **Sentinel AI — Multilingual Content Moderation Intelligence Platform**  
**Document Version:** 1.0.0 (Research & Data Preparation Phase)  
**Date:** October 2026

---

## 1. Executive Summary & Research Context

Sentinel AI's core research question requires context-aware detection across:
- **English** (currently operational via Word+Char TF-IDF + LogisticRegression baseline on `google/civil_comments`).
- **Hindi** (Devanagari script).
- **Telugu** (Telugu script).
- **Kannada** (Kannada script and code-mixed transliteration).
- **Code-Mixed Conversations** (Romanized Indic text, Hinglish, Dravidian-English code-switching).

To prepare genuine training and validation pipelines for future multilingual models without synthetic fabrication or label leakage, we audited public research repositories (Hugging Face Hub, AI4Bharat Indic NLP Catalog, HASOC editions, DravidianLangTech / OffenseVal).

---

## 2. Dataset Candidates, Provenance, & Licensing Inventory

All downloaded raw datasets are stored in [`data/raw/indic/`](file:///c:/Users/girish/Downloads/CyberTech%20AI/data/raw/indic/) with their original labels preserved.

| Dataset Identifier | Language / Modality | Raw Split Rows | Primary License | Source & Citation | Primary Task / Annotations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`mounikaiiith/Telugu-Hatespeech`** | Telugu (Telugu script) | **Train:** 24,599<br>**Val:** 3,510<br>**Test:** 7,033<br>*(Total: 35,142)* | **CC-BY-4.0** (Open commercial & academic with attribution) | Marreddy et al., IIIT Hyderabad (*"Am I a Resource-Poor Language? Data Sets, Embeddings, Models and Analysis for four different NLP tasks in Telugu"*) | Binary Hate Speech (`no` / `yes`) crowdsourced & validated. |
| **`community-datasets/offenseval_dravidian` (kannada config)** | Kannada (Kannada script + Romanized Kannada) | **Train:** 6,217<br>**Val:** 777<br>*(Total: 6,994)* | **CC-BY-4.0** | Chakravarthi et al. (FIRE 2020 / DravidianLangTech, *"A Dataset of Offensive Language Identification in Dravidian Code-Mixed Social Media Comments"*) | 6-Class: `Not_offensive`, `Offensive_Untargetede`, `Offensive_Targeted_Insult_Individual`, `Offensive_Targeted_Insult_Group`, `Offensive_Targeted_Insult_Other`, `not-Kannada`. |
| **`necrosyth/hindi-social-media-hostility-detection`** | Hindi (Devanagari script) | **Train:** 5,728 | **CC-BY-4.0** | Constraint@AAAI 2021 Shared Task on Hostile Post Detection in Hindi | Multi-label sets: `non-hostile`, `hate`, `offensive`, `defamation`, `fake`. |
| **`Paul/hatecheck-hindi`** | Hindi (Devanagari script) | **Test:** 3,565 | **CC-BY-4.0** | Röttger et al. (*"Multilingual HateCheck: Functional Tests for Hate Speech Detection Models in 10 Languages"*, NAACL 2022) | Gold functional testing suite: `hateful` vs `non-hateful` across 27 distinct attack & counter-speech functionalities. |
| **`pankajbiswas6/prism-hinglish-hate-speech`** | Hindi–English Code-Mixed (Hinglish) | **Train:** 17,704<br>**Val:** 2,950<br>**Test:** 8,852<br>*(Total: 29,506)* | **MIT License** | PRISM Benchmark (*"Developing a Sentiment Analysis Model for Code-Mixed Social Media Text"*) | Binary Hate Speech (`0`: non-hate, `1`: hate) with per-row language tags (`hinglish`, `hindi`, `english`). |
| **`nikitadesai/hasoc`** *(Audited)* | Hindi / Code-mixed | **Train:** 4,914 | **CC-BY-NC-4.0** (Non-commercial restriction) | HASOC 2021 Shared Task on Hate Speech and Offensive Content Identification | `HOF` (Hate/Offensive) vs `NOT`, plus Sub-task B contextual labels `SHOF` / `CHOF`. |

> [!IMPORTANT]
> **Licensing Compliance:**
> `nikitadesai/hasoc` is licensed under **CC-BY-NC-4.0** (Non-Commercial). Consequently, it is logged for academic baseline reference only and **not included in production pipelines**. All operational candidates (`Telugu-Hatespeech`, `offenseval_dravidian`, `hindi-social-media-hostility`, `hatecheck-hindi`, `prism-hinglish`) use permissive **CC-BY-4.0** or **MIT** licenses.

---

## 3. Real Empirical Dataset Statistics (No Fabricated Counts)

From [`reports/indic_dataset_inventory.json`](file:///c:/Users/girish/Downloads/CyberTech%20AI/reports/indic_dataset_inventory.json):

### A. Telugu (`mounikaiiith/Telugu-Hatespeech`)
- **Total Rows:** 35,142 (Train: 24,599 | Val: 3,510 | Test: 7,033)
- **Missing Values:** 0
- **Duplicate Text:** Train has 60 duplicates (0.24%), Val has 1, Test has 12.
- **Label Imbalance:**
  - Train: `no` = 24,336 (98.93%), `yes` = 263 (1.07%)
  - Val: `no` = 3,479 (99.12%), `yes` = 31 (0.88%)
  - Test: `no` = 6,957 (98.92%), `yes` = 76 (1.08%)
- **Scientific Observation:** The Telugu dataset has an extreme real-world class imbalance (~1% positive rate). Direct accuracy metrics would be deceptive; evaluation must rely on precision, recall, and PR-AUC.

### B. Kannada & Code-Mixed Kannada (`offenseval_dravidian`)
- **Total Rows:** 6,994 (Train: 6,217 | Val: 777)
- **Missing Values:** 0
- **Duplicate Text:** Train has 316 duplicates (5.08%), Val has 21.
- **Label Distribution (Train):**
  - `Not_offensive` (0): 3,544 (57.0%)
  - `not-Kannada` (5): 1,522 (24.5%)
  - `Offensive_Targeted_Insult_Individual` (2): 487 (7.8%)
  - `Offensive_Targeted_Insult_Group` (3): 329 (5.3%)
  - `Offensive_Untargetede` (1): 212 (3.4%)
  - `Offensive_Targeted_Insult_Other` (4): 123 (2.0%)
- **Scientific Observation:** Captures offensive insults targeted at individuals vs groups, which maps well to Sentinel AI's cyberbullying and harassment definitions.

### C. Hindi Social Media Hostility (`necrosyth/hindi-social-media-hostility-detection`)
- **Total Rows:** 5,728
- **Missing Values:** 0
- **Duplicate Text:** 10
- **Label Distribution:**
  - `non-hostile`: 3,050 (53.25%)
  - `fake` (disinformation): 1,009 (17.62%)
  - `hate`: 478 (8.34%)
  - `offensive`: 405 (7.07%)
  - `defamation`: 305 (5.33%)
  - Multi-label combinations (e.g. `hate,offensive`, `defamation,hate`): 481 (8.39%)
- **Scientific Observation:** This is an explicit multi-label dataset where `hate`, `offensive`, and `defamation` are separately tagged on authentic Devanagari Hindi tweets.

### D. Hinglish & Hindi-English Code-Mixed (`prism-hinglish-hate-speech`)
- **Total Rows:** 29,506 (Train: 17,704 | Val: 2,950 | Test: 8,852)
- **Missing Values:** 0
- **Duplicate Text:** 0
- **Language Subsets (Train):** English: 8,963 | Hindi: 5,860 | Hinglish: 2,881
- **Class Balance (Train):** Non-hate (`0`): 9,479 (53.54%) | Hate (`1`): 8,225 (46.46%)
- **Scientific Observation:** Balanced code-mixed dataset with authentic Romanized Hindi transliterations (e.g., *"tu pagal hai"*, *"desh ko bachao"*).

### E. Hindi Multilingual HateCheck (`Paul/hatecheck-hindi`)
- **Total Rows:** 3,565 (Held-out diagnostic test suite)
- **Class Distribution:** `hateful`: 2,488 (69.79%) | `non-hateful`: 1,077 (30.21%)
- **Functionality Breakdown:** 27 targeted capabilities including spelling obfuscations (character swaps, deletions, leetspeak), counter-speech, neutral identity mentions, and slurs.

---

## 4. Multi-Label Harmonization Schema

Sentinel AI classifies four distinct target categories: `hate_speech`, `harassment`, `cyberbullying`, and `legitimate`. 
Because source corpora were annotated under varying academic definitions, **we do not map labels arbitrarily or assume unannotated categories are negative**:

```
Schema Harmonization Matrix:

1. mounikaiiith/Telugu-Hatespeech:
   - "Hate-Speech" == "yes"  --> hate_speech = 1.0, harassment = UNKNOWN, cyberbullying = UNKNOWN, legitimate = 0.0
   - "Hate-Speech" == "no"   --> hate_speech = 0.0, harassment = UNKNOWN, cyberbullying = UNKNOWN, legitimate = 1.0

2. offenseval_dravidian (Kannada):
   - "Not_offensive"         --> hate_speech = 0.0, harassment = 0.0, cyberbullying = 0.0, legitimate = 1.0
   - "Offensive_Targeted_Insult_Individual" --> harassment = 1.0, cyberbullying = 1.0, hate_speech = UNKNOWN
   - "Offensive_Targeted_Insult_Group"      --> hate_speech = 1.0, harassment = 0.5, cyberbullying = UNKNOWN
   - "Offensive_Untargetede" --> harassment = 0.5, hate_speech = UNKNOWN, cyberbullying = 0.0
   - "not-Kannada"           --> EXCLUDED / FLAGGED as language mismatch

3. hindi-social-media-hostility:
   - "hate" in labels        --> hate_speech = 1.0
   - "offensive" in labels   --> harassment = 1.0
   - "defamation" in labels  --> cyberbullying = 1.0
   - "non-hostile" in labels --> legitimate = 1.0, hate_speech = 0.0, harassment = 0.0, cyberbullying = 0.0

4. prism-hinglish-hate-speech:
   - label == 1              --> hate_speech = 1.0, harassment = UNKNOWN, cyberbullying = UNKNOWN
   - label == 0              --> legitimate = 1.0, hate_speech = 0.0
```

> [!CAUTION]
> **Preserving Unknowns:**
> If a dataset annotates binary hate speech (e.g. Telugu), `harassment` and `cyberbullying` must be set to `null` / `NaN` (unsupervised/masked in multi-task loss), **never to 0.0**. Treating unannotated toxicity as confirmed benign introduces severe label noise.

---

## 5. Language Readiness Assessment for Model Training

| Language / Variety | Available Labelled Samples | Positive Class Samples | Readiness Status | Experimental Recommendation |
| :--- | :---: | :---: | :---: | :--- |
| **English** | 20,000 | 1,234 | **READY & OPERATIONAL** | Baseline deployed; Word+Char model achieves 87.63% ROC-AUC, 59.46% toxic recall at $\tau=0.40$. |
| **Hinglish (Code-Mixed)** | 29,506 | 13,707 | **READY FOR TRAINING** | Abundant balanced data across train, val, and test splits. |
| **Hindi (Devanagari)** | 9,293 | 3,697 | **READY FOR TRAINING** | 5,728 authentic hostile tweets + 3,565 HateCheck diagnostic test cases. |
| **Kannada (Kannada & Code-Mixed)** | 6,994 | 1,151 | **READY FOR TRAINING** | Standard FIRE/OffenseVal splits available with insult granularity. |
| **Telugu (Telugu Script)** | 35,142 | 370 | **DATA PREPARED (HIGH IMBALANCE)** | 35k total samples, but only 370 positive examples (1.05%). Requires Focal Loss or class-weighted sampling. Additional cyberbullying annotation needed for multi-label maturity. |

---

## 6. Hardware & Dependency Compatibility Assessment for XLM-RoBERTa

An inspection of the local runtime environment reveals:
- **Operating System:** Windows 11 AMD64
- **Python Version:** 3.14.2
- **System Memory:** 15.69 GB Total RAM (Available: ~2.1 GB at test time due to running system processes)
- **Free Disk Space:** 169.5 GB
- **PyTorch (`torch`):** **NOT INSTALLED**
- **Hugging Face `transformers`:** **NOT INSTALLED**
- **Acceleration (`accelerate`):** **NOT INSTALLED**

### Assessment:
1. **Python 3.14 Compatibility:** Official pre-built PyTorch CUDA wheels for Windows are currently standardized on Python 3.10–3.12. Python 3.14 was recently released (December 2025) and lacks pre-compiled PyTorch GPU binaries for several architectures.
2. **GPU Availability:** No CUDA GPU runtime is presently active. Fine-tuning an XLM-RoBERTa base model (~278M parameters, ~1.1 GB weights) on CPU with only ~2.1 GB available RAM would risk out-of-memory thrashing or multi-day training times.
3. **Strategic Path:**
   - **Phase 1 (Immediate / Feasible):** Develop a multilingual scikit-learn feature pipeline (multilingual character n-grams + Indic tokenization) as a fast, reproducible baseline across the downloaded Indic corpora.
   - **Phase 2 (Transformer Fine-Tuning):** For XLM-RoBERTa / IndicBERT, use a dedicated Python 3.11 virtual environment or export the prepared datasets to Google Colab / AWS with NVIDIA T4/A10G GPUs.
