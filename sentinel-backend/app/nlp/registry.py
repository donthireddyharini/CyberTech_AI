"""
Sentinel AI — Configurable Multilingual Model Registry & Language Catalog
(CSEAIML2026-P03)

Provides script-aware detection, explicit language routing, and lazy model loading
for all 22 scheduled Indian languages plus English and Hinglish / Code-Mixed input.
Strictly distinguishes validated automated models from GPU-pending candidate models
and human-review-only fallbacks without fabricating predictions.
"""
import re
import logging
from dataclasses import dataclass
from typing import Optional, Any

logger = logging.getLogger(__name__)

# ─── Operational Status Taxonomy ─────────────────────────────────────────────
# 1. "validated_automated_model": Formally benchmarked, calibrated threshold, automated scoring active.
# 2. "evaluated_limited_model": Fine-tuned checkpoint identified & benchmark script ready; pending GPU execution.
# 3. "human_review_only": No standalone calibrated checkpoint; routed to research rule policy + mandatory human review.

@dataclass
class ModelMetadata:
    code: str
    name: str
    script_family: str
    operational_status: str  # validated_automated_model | evaluated_limited_model | human_review_only
    route_status: str        # validated_model | needs_review | unsupported_language_model
    review_status: str       # automated_pass_or_flag | mandatory_human_review
    primary_checkpoint: str
    model_type: str
    notice: str
    license_note: str
    task_label_type: str


# ─── 22 Scheduled Indian Languages + English + Hinglish Registry ─────────────

LANGUAGE_CATALOG: dict[str, ModelMetadata] = {
    # ── Operational Production Model ──
    "english": ModelMetadata(
        code="en",
        name="English",
        script_family="Latin",
        operational_status="validated_automated_model",
        route_status="validated_model",
        review_status="automated_pass_or_flag",
        primary_checkpoint="enhanced_word_char_v2 (models/baseline_toxicity.joblib)",
        model_type="scikit_learn_tfidf_logreg",
        notice="Validated production English toxicity model active (threshold=0.40, ROC-AUC=0.8763).",
        license_note="CC0 (Civil Comments)",
        task_label_type="Binary Toxicity (Toxicity >= 0.50)"
    ),

    # ── Priority Indic Validated Models (Locally Trained Scikit-Learn Pipelines) ──
    "hindi": ModelMetadata(
        code="hi",
        name="Hindi",
        script_family="Devanagari",
        operational_status="validated_automated_model",
        route_status="validated_model",
        review_status="automated_pass_or_flag",
        primary_checkpoint="hindi_word_char_v1 (models/hindi_model.joblib)",
        model_type="scikit_learn_tfidf_logreg",
        notice="Validated production Hindi hostility model active (threshold=0.50, ROC-AUC=0.9899, F1=0.9645).",
        license_note="Academic Research (necrosyth/hindi-social-media-hostility-detection)",
        task_label_type="Social Media Hostility (Hate / Abuse / Cyberbullying)"
    ),
    "code_mixed": ModelMetadata(
        code="code_mixed",
        name="Hinglish / Code-Mixed",
        script_family="Latin / Transliterated",
        operational_status="validated_automated_model",
        route_status="validated_model",
        review_status="automated_pass_or_flag",
        primary_checkpoint="hinglish_word_char_v1 (models/hinglish_model.joblib)",
        model_type="scikit_learn_tfidf_logreg",
        notice="Validated production Hinglish model active (threshold=0.29, ROC-AUC=0.7855, F1=0.7098).",
        license_note="Apache 2.0 / Academic (PRISM Corpus)",
        task_label_type="Binary Hate & Abusive Speech (PRISM Hinglish)"
    ),
    "telugu": ModelMetadata(
        code="te",
        name="Telugu",
        script_family="Telugu",
        operational_status="validated_automated_model",
        route_status="validated_model",
        review_status="automated_pass_or_flag",
        primary_checkpoint="telugu_word_char_v1 (models/telugu_model.joblib)",
        model_type="scikit_learn_tfidf_logreg",
        notice="Validated production Telugu model active (threshold=0.29, ROC-AUC=0.8361).",
        license_note="Academic Research (IIIT Hyderabad Telugu Corpus)",
        task_label_type="Binary Hate Speech (mounikaiiith/Telugu-Hatespeech)"
    ),
    "bengali": ModelMetadata(
        code="bn",
        name="Bengali",
        script_family="Bengali",
        operational_status="evaluated_limited_model",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="Hate-speech-CNERG/bengali-abusive-MuRIL",
        model_type="transformer_checkpoint_pending_gpu",
        notice="Bengali MuRIL checkpoint pending Colab GPU execution; routed to research policy with mandatory human review.",
        license_note="Academic Research (Hate-speech-CNERG)",
        task_label_type="Binary Abusive Language"
    ),
    "marathi": ModelMetadata(
        code="mr",
        name="Marathi",
        script_family="Devanagari",
        operational_status="evaluated_limited_model",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="l3cube-pune/hate-bert-hasoc-marathi",
        model_type="transformer_checkpoint_pending_gpu",
        notice="Marathi HASOC checkpoint pending Colab GPU execution; routed to research policy with mandatory human review.",
        license_note="Academic Research (HASOC Shared Task)",
        task_label_type="Hate & Offensive Content"
    ),
    "tamil": ModelMetadata(
        code="ta",
        name="Tamil",
        script_family="Tamil",
        operational_status="evaluated_limited_model",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="ramesh070/indicbert-hatespeechdetection-tamil",
        model_type="transformer_checkpoint_pending_gpu",
        notice="Tamil IndicBERT checkpoint pending Colab GPU execution; routed to research policy with mandatory human review.",
        license_note="Academic Research",
        task_label_type="Hate & Offensive Content"
    ),
    "malayalam": ModelMetadata(
        code="ml",
        name="Malayalam",
        script_family="Malayalam",
        operational_status="evaluated_limited_model",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="ramesh070/indicbert-hatespeechdetection-malayalam",
        model_type="transformer_checkpoint_pending_gpu",
        notice="Malayalam IndicBERT checkpoint pending Colab GPU execution; routed to research policy with mandatory human review.",
        license_note="Academic Research",
        task_label_type="Hate & Offensive Content"
    ),
    "urdu": ModelMetadata(
        code="ur",
        name="Urdu",
        script_family="Perso-Arabic",
        operational_status="evaluated_limited_model",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="Hate-speech-CNERG/urdu-abusive-MuRIL",
        model_type="transformer_checkpoint_pending_gpu",
        notice="Urdu MuRIL checkpoint pending Colab GPU execution; routed to research policy with mandatory human review.",
        license_note="Academic Research (Hate-speech-CNERG)",
        task_label_type="Binary Abusive Language"
    ),
    "gujarati": ModelMetadata(
        code="gu",
        name="Gujarati",
        script_family="Gujarati",
        operational_status="evaluated_limited_model",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="Jayveersinh-Raj/Gujarati_hatespeech_extension",
        model_type="transformer_checkpoint_pending_gpu",
        notice="Gujarati candidate checkpoint pending Colab GPU execution; routed to research policy with mandatory human review.",
        license_note="Academic Research",
        task_label_type="Hate Speech"
    ),

    # ── Additional Scheduled Languages (Human-Review-Only / Fallback Mode) ──
    "kannada": ModelMetadata(
        code="kn",
        name="Kannada",
        script_family="Kannada",
        operational_status="validated_automated_model",
        route_status="validated_model",
        review_status="automated_pass_or_flag",
        primary_checkpoint="kannada_word_char_v1 (models/kannada_model.joblib)",
        model_type="scikit_learn_tfidf_logreg",
        notice="Validated production Kannada model active (threshold=0.55, ROC-AUC=0.8682, F1=0.6945).",
        license_note="CC BY 4.0 (OffenseVal Dravidian)",
        task_label_type="Offensive / Abusive Language"
    ),
    "assamese": ModelMetadata(
        code="as",
        name="Assamese",
        script_family="Bengali-Assamese",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Assamese hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
    "bodo": ModelMetadata(
        code="brx",
        name="Bodo",
        script_family="Devanagari",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Bodo hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
    "dogri": ModelMetadata(
        code="doi",
        name="Dogri",
        script_family="Devanagari",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Dogri hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
    "kashmiri": ModelMetadata(
        code="ks",
        name="Kashmiri",
        script_family="Perso-Arabic",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Kashmiri hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
    "konkani": ModelMetadata(
        code="kok",
        name="Konkani",
        script_family="Devanagari",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Konkani hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
    "maithili": ModelMetadata(
        code="mai",
        name="Maithili",
        script_family="Devanagari",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Maithili hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
    "manipuri": ModelMetadata(
        code="mni",
        name="Manipuri / Meitei",
        script_family="Meetei Mayek / Bengali",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Manipuri hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
    "nepali": ModelMetadata(
        code="ne",
        name="Nepali",
        script_family="Devanagari",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Nepali hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
    "odia": ModelMetadata(
        code="or",
        name="Odia",
        script_family="Odia",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Odia hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
    "punjabi": ModelMetadata(
        code="pa",
        name="Punjabi",
        script_family="Gurmukhi",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Punjabi hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
    "sanskrit": ModelMetadata(
        code="sa",
        name="Sanskrit",
        script_family="Devanagari",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Sanskrit hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
    "santali": ModelMetadata(
        code="sat",
        name="Santali",
        script_family="Ol Chiki",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Santali hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
    "sindhi": ModelMetadata(
        code="sd",
        name="Sindhi",
        script_family="Perso-Arabic / Devanagari",
        operational_status="human_review_only",
        route_status="needs_review",
        review_status="mandatory_human_review",
        primary_checkpoint="none_available",
        model_type="rule_baseline_pending_model",
        notice="No fine-tuned Sindhi hate speech checkpoint available; routed to rule policy with mandatory human review.",
        license_note="N/A",
        task_label_type="Pending Annotation"
    ),
}

# Aliases for robust language resolution
LANGUAGE_ALIASES: dict[str, str] = {
    "en": "english", "eng": "english",
    "hi": "hindi", "hin": "hindi",
    "te": "telugu", "tel": "telugu",
    "kn": "kannada", "kan": "kannada",
    "bn": "bengali", "ben": "bengali", "bangla": "bengali",
    "mr": "marathi", "mar": "marathi",
    "ta": "tamil", "tam": "tamil",
    "ml": "malayalam", "mal": "malayalam",
    "ur": "urdu", "urd": "urdu",
    "gu": "gujarati", "guj": "gujarati",
    "pa": "punjabi", "pan": "punjabi",
    "or": "odia", "ori": "odia", "oriya": "odia",
    "as": "assamese", "asm": "assamese",
    "brx": "bodo", "bodo": "bodo",
    "doi": "dogri", "dogri": "dogri",
    "ks": "kashmiri", "kas": "kashmiri",
    "kok": "konkani", "konkani": "konkani",
    "mai": "maithili", "maithili": "maithili",
    "mni": "manipuri", "meitei": "manipuri",
    "ne": "nepali", "nep": "nepali",
    "sa": "sanskrit", "san": "sanskrit",
    "sat": "santali", "santali": "santali",
    "sd": "sindhi", "snd": "sindhi",
    "hinglish": "code_mixed", "code-mixed": "code_mixed", "codemixed": "code_mixed"
}

# ─── Script Regex Mapping ───────────────────────────────────────────────────
# Script detection maps characters to script family.
# Note: Devanagari, Bengali-Assamese, and Perso-Arabic scripts are shared across multiple languages.

SCRIPT_PATTERNS: dict[str, str] = {
    "telugu": r"[\u0C00-\u0C7F]",
    "kannada": r"[\u0C80-\u0CFF]",
    "tamil": r"[\u0B80-\u0BFF]",
    "malayalam": r"[\u0D00-\u0D7F]",
    "gujarati": r"[\u0A80-\u0AFF]",
    "punjabi_gurmukhi": r"[\u0A00-\u0A7F]",
    "odia": r"[\u0B00-\u0B7F]",
    "bengali_assamese": r"[\u0980-\u09FF]",
    "devanagari": r"[\u0900-\u097F]",
    "perso_arabic": r"[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]",
    "ol_chiki": r"[\u1C50-\u1C7F]",
    "meetei_mayek": r"[\uABC0-\uABFF]",
    "cyrillic": r"[\u0400-\u04FF]",
    "cjk": r"[\u4E00-\u9FFF]"
}

COMPILED_SCRIPT_PATTERNS = {k: re.compile(v) for k, v in SCRIPT_PATTERNS.items()}

CODE_MIX_MARKERS = [
    "yaar", "bhai", "kya", "nahi", "hai", "bol", "kar", "mat", "mera", "tera",
    "antha", "ikkade", "cheppandi", "mari", "ante", "em", "endi",
    "yen", "illa", "aru", "yenu", "bekku", "dhanyawad", "shukriya"
]


class ModelRegistry:
    """Manages language model resolution, script matching, and lazy transformer caching."""

    def __init__(self):
        self._cached_models: dict[str, Any] = {}

    def resolve_language(self, text: str, language_hint: Optional[str] = None) -> tuple[str, str, bool]:
        """
        Resolves the target language key, script name, and code-mixing flag.
        Returns (target_lang_key, detected_script_name, is_code_mixed).
        """
        # If user explicitly selected a language hint, honor it
        if language_hint and language_hint.strip():
            hint_norm = language_hint.strip().lower()
            resolved_key = LANGUAGE_ALIASES.get(hint_norm, hint_norm)
            if resolved_key in LANGUAGE_CATALOG:
                meta = LANGUAGE_CATALOG[resolved_key]
                return resolved_key, meta.script_family, (resolved_key == "code_mixed")
            else:
                return resolved_key, "Unsupported", False

        # Automatic Script Detection
        detected_script = "Latin"
        detected_lang = "english"

        for script_name, pat in COMPILED_SCRIPT_PATTERNS.items():
            if pat.search(text):
                if script_name == "devanagari":
                    detected_script = "Devanagari"
                    detected_lang = "hindi"  # Primary Devanagari route
                elif script_name == "telugu":
                    detected_script = "Telugu"
                    detected_lang = "telugu"
                elif script_name == "kannada":
                    detected_script = "Kannada"
                    detected_lang = "kannada"
                elif script_name == "tamil":
                    detected_script = "Tamil"
                    detected_lang = "tamil"
                elif script_name == "malayalam":
                    detected_script = "Malayalam"
                    detected_lang = "malayalam"
                elif script_name == "bengali_assamese":
                    detected_script = "Bengali-Assamese"
                    detected_lang = "bengali"
                elif script_name == "gujarati":
                    detected_script = "Gujarati"
                    detected_lang = "gujarati"
                elif script_name == "punjabi_gurmukhi":
                    detected_script = "Gurmukhi"
                    detected_lang = "punjabi"
                elif script_name == "odia":
                    detected_script = "Odia"
                    detected_lang = "odia"
                elif script_name == "perso_arabic":
                    detected_script = "Perso-Arabic"
                    detected_lang = "urdu"
                elif script_name == "ol_chiki":
                    detected_script = "Ol Chiki"
                    detected_lang = "santali"
                elif script_name == "meetei_mayek":
                    detected_script = "Meetei Mayek"
                    detected_lang = "manipuri"
                else:
                    detected_script = script_name.capitalize()
                    detected_lang = script_name
                break

        # Check for code mixing in Latin text
        lower = text.lower()
        is_code_mixed = any(re.search(rf"\b{re.escape(marker)}\b", lower) for marker in CODE_MIX_MARKERS)
        if is_code_mixed and detected_lang == "english":
            detected_lang = "code_mixed"
            detected_script = "Latin / Code-Mixed"

        return detected_lang, detected_script, is_code_mixed

    def get_route_metadata(self, lang_key: str) -> ModelMetadata:
        """Fetch metadata for resolved language key with safe fallback for unknown languages."""
        if lang_key in LANGUAGE_CATALOG:
            return LANGUAGE_CATALOG[lang_key]

        # Unsupported fallback
        return ModelMetadata(
            code=lang_key[:3],
            name=lang_key.capitalize(),
            script_family="Unsupported",
            operational_status="human_review_only",
            route_status="unsupported_language_model",
            review_status="mandatory_human_review",
            primary_checkpoint="none",
            model_type="unsupported_fallback",
            notice=f"No calibrated model available for '{lang_key}'; flagged for mandatory human review.",
            license_note="N/A",
            task_label_type="N/A"
        )

    def get_catalog_summary(self) -> list[dict[str, Any]]:
        """Return full catalog summary for UI and API endpoints."""
        return [
            {
                "code": m.code,
                "name": m.name,
                "script_family": m.script_family,
                "operational_status": m.operational_status,
                "route_status": m.route_status,
                "review_status": m.review_status,
                "primary_checkpoint": m.primary_checkpoint,
                "model_type": m.model_type,
                "notice": m.notice,
                "license_note": m.license_note
            }
            for m in LANGUAGE_CATALOG.values()
        ]


# Singleton instance
_registry_instance: Optional[ModelRegistry] = None

def get_model_registry() -> ModelRegistry:
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = ModelRegistry()
    return _registry_instance
