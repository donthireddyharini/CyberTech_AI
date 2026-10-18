# docs/MODEL_TRAINING.md
## Multilingual Transformer Training Methodology

### 1. Target Architecture
- **Base Encoder:** `xlm-roberta-base` (560M parameters, 100+ languages covering Hindi, Telugu, and Kannada).
- **Classification Head:** 3-Head Multi-label Linear Classifier with Dropout (0.2).
- **Loss Function:** Binary Cross-Entropy with Logits (`torch.nn.BCEWithLogitsLoss`), computing independent loss for each label.

### 2. Training Workflow
1. **Tokenization:** Multilingual SentencePiece tokenizer with special preservation of punctuation and script-transition boundaries.
2. **Batching:** Dynamic padding to maximum length 256.
3. **Hyperparameters:**
   - Learning Rate: `2e-5` with AdamW optimizer and linear warmup (10% of total steps).
   - Batch Size: 16 or 32 (with gradient accumulation if GPU memory is constrained).
   - Epochs: 3–5 with early stopping monitored on validation macro-F1.
4. **Hardware Requirements:** Dedicated GPU with at least 12GB VRAM (or FP16 mixed precision on 8GB VRAM).
