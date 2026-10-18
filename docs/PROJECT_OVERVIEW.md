# docs/PROJECT_OVERVIEW.md
## Sentinel AI — Project Overview & Research Identity

**Project ID:** CSEAIML2026-P03  
**Title:** NLP-Based Hate Speech and Cyberbullying Detection System for Social Media  
**Tagline:** Understand Context. Detect Harm. Protect Conversations.  

### 1. Research Question
*Can context-aware multilingual NLP identify hate speech, harassment, and cyberbullying while preserving legitimate disagreement and reducing false positives across English, Hindi, Telugu, Kannada, and code-mixed conversations?*

### 2. Core Problem & Motivation
Traditional content moderation pipelines rely on keyword-blocklists or single-sentence classification. These systems suffer from:
1. **False Positives on Legitimate Disagreement:** Legitimate debate, academic critiques, and political opposition are often flagged merely due to intense vocabulary.
2. **Context Blindness:** A statement like *"I'm going to kill you in the game tonight"* is malicious without context, but benign in a gaming discussion.
3. **Severe Underservice in Indic & Dravidian Languages:** Regional Indian languages (Telugu, Kannada, Hindi) and transliterated code-mixing (*"yaar"*, *"antha"*, *"ikkade"*) lack adequate production-grade moderation classifiers.

### 3. Implemented vs Planned Features
- **Implemented:**
  - Full-stack dark cyberpunk command center UI matching target design.
  - Multi-label classification schema (`hate_speech`, `harassment`, `cyberbullying`, `legitimate`).
  - Context Intelligence Lab with dual-pass inference comparison.
  - Moderator Command Center with audit logging, review drawer, and severity overrides.
  - Transparent research metrics (honest "Insufficient Data" reporting when ground truth is absent).
  - Corpus validation & ingestion pipeline (CSV/JSONL).
  - Automated test suite covering 36 unit and integration test cases.
- **Planned:**
  - Multi-head XLM-RoBERTa fine-tuned transformer weights (requires labeled corpus & GPU).
  - Token-level attention saliency heatmaps.
  - Role-based token access & multi-tenant auth.
