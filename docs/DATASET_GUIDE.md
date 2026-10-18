# docs/DATASET_GUIDE.md
## Dataset Collection, Preparation, and Schema Guide

### 1. Supported Schema
Datasets imported via the **Dataset & Model Lab** must follow this CSV or JSONL schema:
- `text` (string, required): The target social media post or comment.
- `label` (string, required): One of `hate_speech`, `harassment`, `cyberbullying`, `legitimate`, or `none`.
- `language` (string, optional): One of `english`, `hindi`, `telugu`, `kannada`, or `code_mixed`.
- `context_before` (string, optional): The preceding conversational message.
- `context_after` (string, optional): The subsequent conversational reply.

### 2. Permitted Benchmark Corpora
1. **HateXplain (Mathew et al., 2021):**
   - Focus: English multi-class hate speech with span-level rationales.
2. **HASOC (Mandl et al., 2019–2021):**
   - Focus: Multilingual Hate Speech and Offensive Content identification in Indo-Aryan languages (Hindi, English, Marathi).
3. **Dravidian-CodeMix (Chakravarthi et al., 2021):**
   - Focus: Offensive Language Identification in Dravidian languages (Tamil, Malayalam, Kannada) in code-mixed Latin script.
4. **Telugu Hate Speech Corpus (Sreeja et al.):**
   - Focus: Regional Telugu abuse detection in native and transliterated scripts.

### 3. Annotation & Validation Policy
- All raw datasets undergo automatic deduplication, missing value checks, and label validity enforcement upon upload.
- Stratified 70/15/15 train/val/test splits are applied while avoiding comment group leakage across conversation threads.
