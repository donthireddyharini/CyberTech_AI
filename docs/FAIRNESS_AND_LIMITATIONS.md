# docs/FAIRNESS_AND_LIMITATIONS.md
## Fairness, Ethics, and Responsible AI Policy

### 1. Human-in-the-Loop Oversight
- Sentinel AI is an advisory intelligence system. It recommends risk levels and classifies signals, but consequential moderation actions (account suspensions, comment deletion) require human moderator confirmation.

### 2. Mitigation of False Positives
- Heated political debate, disagreement, and criticism are explicitly separated from hate speech.
- Disagreement markers (*"I disagree"*, *"In my opinion"*, *"here is why"*) suppress false positive flags.

### 3. Empirical Disparity Reporting
- Multilingual performance is evaluated on separate language subsets.
- When evaluation data for a particular script (e.g. Kannada or transliterated Telugu) is insufficient, the system reports **"Insufficient data"** instead of claiming universal parity or fabricating evaluation scores.
