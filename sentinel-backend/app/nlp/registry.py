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
        primary_checkpoint="hinglish_contextual_v2 (models/hinglish_model.joblib)",
        model_type="scikit_learn_tfidf_logreg",
        notice="Validated production Hinglish model active (threshold=0.36, ROC-AUC=0.7882, F1=0.7148).",
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
        primary_checkpoint="telugu_generalization_v3 (models/telugu_model.joblib)",
        model_type="scikit_learn_tfidf_logreg",
        notice="Validated production Telugu generalization model active (threshold=0.52, ROC-AUC=0.8566).",
        license_note="Academic Research (IIIT Hyderabad Telugu Corpus + Interpersonal Insults)",
        task_label_type="Hate Speech & Harassment (IIIT Telugu + Insults)"
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
        primary_checkpoint="kannada_word_char_v2 (models/kannada_model.joblib)",
        model_type="scikit_learn_tfidf_logreg",
        notice="Validated production Kannada model active (threshold=0.39, ROC-AUC=0.8883, F1=0.6970).",
        license_note="CC BY 4.0 (OffenseVal Dravidian + Interpersonal Insults)",
        task_label_type="Offensive & Harassment Language"
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
    # Pronouns & Address
    "tu", "tera", "teri", "tere", "tujhe", "tujhko", "tum", "tumhara", "tumhari", "tumhare",
    "tumhe", "aap", "aapka", "aapki", "aapke", "aapko", "aapne", "mera", "meri", "mere",
    "mujhe", "mujhko", "hum", "humara", "humari", "humare", "hume", "yaar", "bhai", "bhaiya", "dost",
    
    # Common Hindi verbs & auxiliaries
    "hai", "hain", "ho", "hoo", "tha", "theye", "thi", "hoga", "hogi", "hoge",
    "kya", "kyu", "kyun", "kaise", "kahan", "kab", "kaun",
    "nahi", "nahin", "na", "mat", "kar", "karo", "karega", "karegi", "karege", "karna", "kiya",
    "bol", "bolo", "bologe", "bolna", "bola", "baat", "batao", "dekh", "dekho", "dekhna",
    "chahiye", "aata", "aati", "aate", "raha", "rahe", "rahi", "hona", "hota", "hoti", "hote",
    "de", "dena", "jana", "jao", "ja", "gaya", "gayi", "gaye", "aao", "aana",
    "kuch", "sab", "apna", "apne", "apni", "kisi", "koi", "aur", "lekin", "par",
    
    # Common Hindi adjectives / nouns
    "insaan", "aadmi", "log", "duniya", "zindagi", "samay", "waqt",
    "theek", "sahi", "galat", "kaam", "naam",
    
    # Civil & Positive Markers
    "shukriya", "dhanyawad", "dhanyavad", "namaste", "namaskar",
    "accha", "achha", "acche", "acchi", "achhi", "acha", "ache", "achi", "bahut", "bohot", "bhut",
    "badhiya", "sundar", "shandar", "kamaal", "pyara", "pyare", "madad", "zabardast",
    
    # Harmful / Harassment / Insult Markers (Latin script)
    "kutta", "kutte", "kutti", "kuttiya", "kamina", "kamine", "kamini",
    "saala", "saale", "saali", "harami", "haramkhor", "haramzada",
    "chutiya", "chutiye", "chutiyapa", "bhenchod", "behenchod", "bc", "mc", "madarchod", "maderchod",
    "bhosdike", "bhosadike", "bhosdi", "lund", "lodu", "lavde", "laude", "chut", "choot", "maa ki chut", "teri maa ki",
    "gandu", "gaandu", "gadha", "gadhe", "gadhi", "ullu",
    "besharam", "nalayak", "pagal", "paagal", "bakwas", "chup",
    "bevakoof", "bewakoof", "bevakuf", "bewakuf", "bewkoof", "bevkoof", "bewaqoof",
    "mar ja", "marja", "maar dalunga", "randi", "bura", "bure",
    "dhokha", "dhokhebaz", "chor", "jhootha", "jhoothe", "laanat", "neech", "paapi",
    "thappad", "aukaat", "aukat", "sharam", "ghatiya", "badtameez", "badtamiz",
    "dafa", "wahiyat", "nikal", "bhadwa", "bhadwe", "suar", "suwar"
]

TELUGU_ROMAN_MARKERS = [
    # Pronouns & Common Words
    "nuvvu", "nuvv", "nuv", "meeru", "nenu", "neanu", "manamu", "memu", "vaallu",
    "avunu", "ippudu", "kona", "chepparu", "bokka", "mamuluga",
    "neeku", "neek", "naaku", "maaku", "meeku",
    "chala", "chaala", "bagundi", "bavundi", "bavundhi", "bagundhi", "bagunnavu", "bavunnavu",
    "sahayam", "cheppavu", "cheppu", "enti", "enduku", "ekkada", "eppudu",
    "kadu", "kaadhu", "ledu", "ledhu", "unnadu", "unnaru", "undi",
    "dabbulu", "pani", "katha", "vishayam",
    
    # Civil & Compliments
    "dhanyavadalu", "kruthagnathalu", "manchivadivi", "manchivi", "manchidi", "manchi",
    "manchodivi", "manchodu", "manchivadu",
    "goppa", "telivainavadivi", "adbhutam", "adbhutanga", "prema", "sneham", "snehitudivi",
    
    # Insults & Harassment
    "panikirani", "vedhava", "vedhavavi", "vedhavi", "chettaa", "chetta", "aipothavu",
    "daridram", "bathuku", "noru musuko", "musuko", "champesta", "dikkumalina",
    "picchoda", "pichoda", "donga", "sigguledu", "vellipo"
]

KANNADA_ROMAN_MARKERS = [
    # Pronouns & Common Words
    "neenu", "neevu", "naanu", "naavu", "avaru", "nimage", "ninage", "nanage",
    "tumba", "thumba", "yenu", "enu", "hege", "yaake", "yake", "elli", "yaava",
    "beku", "beda", "illa", "agalla", "ide", "kelsa", "kelasa", "maadu", "maadi",
    
    # Civil & Compliments
    "chennagi", "chennagide", "dhanyavada", "dhanyavadagalu", "olleya", "olleyavaru",
    "sundara", "sahaya", "preeti", "sneha", "upayukta", "upayuktavagide",
    
    # Insults & Harassment
    "moorukha", "murkha", "gottilla", "kettavanu", "kettavalu", "ketta",
    "illinda tolagu", "tolagu", "bayi mucchu", "mucchu", "halkat", "halagi hogu",
    "siggu illa", "donga", "bekku"
]


class ModelRegistry:
    """Manages language model resolution, script matching, and lazy transformer caching."""

    def __init__(self):
        self._cached_models: dict[str, Any] = {}
        self._resolve_cache: dict[tuple[str, Optional[str]], tuple[str, str, bool]] = {}

    def resolve_language(self, text: str, language_hint: Optional[str] = None) -> tuple[str, str, bool]:
        cache_key = (text[:250], language_hint) if text else ("", language_hint)
        if cache_key in self._resolve_cache:
            return self._resolve_cache[cache_key]
        """
        Resolves the target language key, script name, and code-mixing flag.
        Ensures native Indic scripts cannot be overridden by an incompatible hint,
        and accurately distinguishes Hinglish, Romanized Telugu, and Romanized Kannada.
        """
        hint_clean = language_hint.strip().lower() if (language_hint and language_hint.strip()) else None
        if hint_clean in ("auto", "auto-detect", "none", "null", ""):
            hint_clean = None

        # 1. Native Indic script detection (highest priority — native script cannot be overridden by incompatible hint)
        detected_script = "Latin"
        detected_lang = None
        is_code_mixed = False

        for script_name, pat in COMPILED_SCRIPT_PATTERNS.items():
            if pat.search(text):
                if script_name == "devanagari":
                    detected_script = "Devanagari"
                    detected_lang = "hindi"
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

        # If native script detected, let compatible hint refine it (e.g. Marathi/Nepali in Devanagari)
        if detected_lang is not None:
            if hint_clean:
                hint_key = LANGUAGE_ALIASES.get(hint_clean, hint_clean)
                devanagari_langs = {"hindi", "marathi", "nepali", "sanskrit", "bodo", "dogri", "konkani", "maithili"}
                bengali_langs = {"bengali", "assamese"}
                perso_arabic_langs = {"urdu", "kashmiri", "sindhi"}

                if detected_script == "Devanagari" and hint_key in devanagari_langs:
                    detected_lang = hint_key
                elif detected_script == "Bengali-Assamese" and hint_key in bengali_langs:
                    detected_lang = hint_key
                elif detected_script == "Perso-Arabic" and hint_key in perso_arabic_langs:
                    detected_lang = hint_key

            if len(self._resolve_cache) > 4000:
                self._resolve_cache.clear()
            self._resolve_cache[cache_key] = (detected_lang, detected_script, is_code_mixed)
            return detected_lang, detected_script, is_code_mixed

        # 2. Latin script text: check regional markers (Telugu, Kannada, Hinglish)
        lower = text.lower()
        has_telugu_markers = any(re.search(rf"\b{re.escape(marker)}\b", lower) for marker in TELUGU_ROMAN_MARKERS)
        has_kannada_markers = any(re.search(rf"\b{re.escape(marker)}\b", lower) for marker in KANNADA_ROMAN_MARKERS)
        has_codemix_markers = any(re.search(rf"\b{re.escape(marker)}\b", lower) for marker in CODE_MIX_MARKERS)

        if has_telugu_markers:
            detected_lang = "telugu"
            detected_script = "Latin / Telugu Transliteration"
            is_code_mixed = True
        elif has_kannada_markers:
            detected_lang = "kannada"
            detected_script = "Latin / Kannada Transliteration"
            is_code_mixed = True
        elif has_codemix_markers:
            if hint_clean:
                hint_key = LANGUAGE_ALIASES.get(hint_clean, hint_clean)
                if hint_key == "hindi":
                    detected_lang = "hindi"
                    detected_script = "Latin / Hindi Transliteration"
                    is_code_mixed = True
                else:
                    detected_lang = "code_mixed"
                    detected_script = "Latin / Hinglish (Code-Mixed)"
                    is_code_mixed = True
            else:
                detected_lang = "code_mixed"
                detected_script = "Latin / Hinglish (Code-Mixed)"
                is_code_mixed = True
        elif hint_clean:
            # Honor explicit user language hint for Latin text when no conflicting markers are present
            resolved_key = LANGUAGE_ALIASES.get(hint_clean, hint_clean)
            if resolved_key in LANGUAGE_CATALOG:
                meta = LANGUAGE_CATALOG[resolved_key]
                detected_lang = resolved_key
                detected_script = meta.script_family
                is_code_mixed = (resolved_key == "code_mixed")
            else:
                detected_lang = resolved_key
                detected_script = "Unsupported"
                is_code_mixed = False
        else:
            detected_lang = "english"
            detected_script = "Latin"
            is_code_mixed = False

        if len(self._resolve_cache) > 4000:
            self._resolve_cache.clear()
        self._resolve_cache[cache_key] = (detected_lang, detected_script, is_code_mixed)
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
