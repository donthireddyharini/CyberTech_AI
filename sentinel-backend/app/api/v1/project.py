"""Project overview endpoint."""
from fastapi import APIRouter

router = APIRouter()

PROJECT_OVERVIEW = {
    "project_id": "CSEAIML2026-P03",
    "title": "NLP-Based Hate Speech and Cyberbullying Detection System for Social Media",
    "application_name": "Sentinel AI",
    "tagline": "Understand Context. Detect Harm. Protect Conversations.",
    "research_question": (
        "Can context-aware multilingual NLP identify hate speech, harassment, and cyberbullying "
        "while preserving legitimate disagreement and reducing false positives across English, "
        "Hindi, Telugu, Kannada, and code-mixed conversations?"
    ),
    "problem_statement": (
        "Social media platforms process billions of messages daily. Traditional keyword-based "
        "moderation systems generate excessive false positives (flagging satire, disagreement, "
        "and criticism) and miss context-dependent harmful content. Multilingual and code-mixed "
        "content — particularly from South Asian language communities — is severely underserved "
        "by existing English-centric moderation systems."
    ),
    "objectives": [
        "Build a context-aware multi-label classification system for hate speech, harassment, and cyberbullying.",
        "Support English, Hindi, Telugu, Kannada, and code-mixed (transliterated) text.",
        "Reduce false positives by distinguishing disagreement, criticism, and satire from genuine harm.",
        "Provide explainable, uncertainty-aware recommendations to support human moderators.",
        "Implement a full human-in-the-loop moderation workflow with audit trail.",
        "Evaluate fairly across languages, reporting data gaps honestly.",
    ],
    "supported_languages": ["English", "Hindi", "Telugu", "Kannada", "Code-Mixed (English + Indian languages)"],
    "classification_labels": {
        "hate_speech": "Content targeting groups based on protected characteristics.",
        "harassment": "Direct personal attacks, threats, or sustained abusive behavior.",
        "cyberbullying": "Repeated harmful behavior targeting individuals in online spaces.",
        "legitimate": "Disagreement, criticism, satire, or non-harmful negative sentiment.",
    },
    "severity_levels": {
        "low": "No clear policy violation detected, or low-risk content.",
        "medium": "Potentially harmful content requiring moderator attention.",
        "high": "Strong evidence of harmful or abusive content requiring escalation.",
        "uncertain": "Ambiguous or insufficient evidence; human review required.",
    },
    "model_status": {
        "current_model": "Rule-based baseline classifier",
        "model_type": "Pattern matching — NOT a fine-tuned transformer",
        "transformer_model": "XLM-RoBERTa (planned; requires labeled training data)",
        "training_status": "Not trained — no labeled dataset imported",
        "evaluation_status": "Insufficient labeled data for real metric computation",
    },
    "implemented_features": [
        "Context-aware analysis (before/after message window)",
        "Multi-label classification output",
        "Severity scoring with documented policy",
        "Moderator command center with full CRUD",
        "Human review with audit trail",
        "Feedback and error analysis pipeline",
        "Dataset upload, validation, and import",
        "Evaluation run tracking",
        "Multilingual script detection (Telugu, Hindi, Kannada, Code-mixed markers)",
        "Context comparison (with vs. without context)",
        "Project overview in-app",
        "API documentation via OpenAPI/Swagger",
        "Demo data mode with clear labeling",
    ],
    "planned_features": [
        "Fine-tuned XLM-RoBERTa transformer model (requires labeled dataset)",
        "Real calibrated confidence scores (requires held-out calibration data)",
        "Token-level attribution (requires transformer model)",
        "Automated retraining pipeline",
        "User authentication and role-based access",
        "Production deployment configuration",
        "Language-validated evaluation metrics (requires per-language test sets)",
    ],
    "responsible_ai": {
        "human_oversight": "All consequential moderation decisions require human review.",
        "no_auto_action": "The model recommends; it never automatically bans or penalizes.",
        "false_positive_risk": "Rule-based systems have significant false-positive rates.",
        "data_privacy": "User text is processed locally; no external API calls for inference.",
        "transparency": "Model type, limitations, and confidence caveats are always disclosed.",
        "fairness_gaps": "Evaluation data is insufficient for validated fairness claims.",
    },
    "dataset_sources": [
        {
            "name": "HateXplain",
            "url": "https://github.com/hate-alert/HateXplain",
            "note": "English hate speech with rationales. Check license before use.",
        },
        {
            "name": "HASOC (Hate Speech and Offensive Content Identification)",
            "url": "https://hasocfire.github.io/hasoc/",
            "note": "Multilingual including Hindi. Competition datasets — check terms.",
        },
        {
            "name": "Telugu Abuse Dataset",
            "url": "https://github.com/tthesh/hate-speech-telugu",
            "note": "Telugu language dataset. Verify license and terms.",
        },
        {
            "name": "Dravidian-CodeMix (FIRE)",
            "url": "https://dravidian-codemix.github.io/",
            "note": "Dravidian code-mixed content. Academic competition datasets.",
        },
    ],
    "architecture_summary": {
        "frontend": "React + TypeScript + Vite + Tailwind CSS + Recharts",
        "backend": "Python + FastAPI + SQLAlchemy + SQLite",
        "nlp_engine": "Rule-based baseline (XLM-RoBERTa planned)",
        "database": "SQLite (development) — migration-ready for PostgreSQL",
    },
    "evaluation_methodology": (
        "Evaluation uses precision, recall, F1-score, and support per label and per language. "
        "Real metrics are only computed when a labeled test dataset is available. "
        "The current system shows 'insufficient data' rather than fabricating metrics. "
        "Confusion matrices and threshold analysis are supported when sufficient data exists."
    ),
    "limitations": [
        "No trained transformer model — only rule-based baseline available.",
        "Rule-based system cannot understand semantic context, sarcasm, or cultural nuance.",
        "Insufficient labeled data for validated per-language metrics.",
        "No calibrated confidence scores — pattern match scores are NOT probabilities.",
        "Limited code-mixed handling — keyword-based only.",
        "No user authentication in the current prototype.",
        "Demo data is illustrative only and not real social media data.",
    ],
    "references": [
        "Devlin et al. (2019). BERT: Pre-training of Deep Bidirectional Transformers.",
        "Conneau et al. (2020). Unsupervised Cross-lingual Representation Learning at Scale (XLM-RoBERTa).",
        "Mathew et al. (2021). HateXplain: A Benchmark Dataset for Explainable Hate Speech Detection.",
        "Mandl et al. (2019). Overview of the HASOC Track at FIRE 2019.",
        "Chakravarthi et al. (2021). Findings of the Shared Task on Offensive Language Identification in Tamil, Malayalam, and Kannada.",
    ],
}


@router.get("/overview")
async def get_project_overview():
    """Get complete project overview information."""
    return PROJECT_OVERVIEW
