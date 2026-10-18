# Dataset Sources & Provenance

## 1. Primary Corpus: google/civil_comments
- **Hugging Face Repository**: [google/civil_comments](https://huggingface.co/datasets/google/civil_comments)
- **Original Source**: The Civil Comments platform archive (released by Jigsaw / Google Conversation AI).
- **License**: Creative Commons Zero v1.0 Universal (CC0: Public Domain Dedication).
- **Domain**: English public online comments with crowd-sourced toxicity ratings.

## 2. Selected Subset Specification
- **Subset Size**: 20,000 raw examples.
- **Split Extracted**: `train` partition (streamed head).
- **Storage Location**: `data/raw/civil_comments_raw_subset.csv`
- **Metadata Spec**: `data/raw/download_metadata.json`

## 3. Schema & Label Definitions
- `text` (string): Comment content.
- `toxicity` (float, [0.0, 1.0]): Fraction of annotators who flagged the comment as toxic.
- `severe_toxicity` (float, [0.0, 1.0]): Fraction flagging severe toxicity.
- `obscene` (float, [0.0, 1.0]): Fraction flagging obscene language.
- `threat` (float, [0.0, 1.0]): Fraction flagging threatening language.
- `insult` (float, [0.0, 1.0]): Fraction flagging insults.
- `identity_attack` (float, [0.0, 1.0]): Fraction flagging identity-based attacks.
- `sexual_explicit` (float, [0.0, 1.0]): Fraction flagging sexually explicit content.

## 4. Important Scoping Note
- This dataset is used specifically to train an **English toxicity-classification baseline**.
- Toxicity is **not** automatically mapped to hate speech, harassment, or cyberbullying.
