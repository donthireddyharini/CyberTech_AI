"""
Sentinel AI — Rule-Based Baseline NLP Engine
A transparent, documented rule-based classifier for hate speech, harassment,
and cyberbullying detection. This is NOT a fine-tuned transformer.
It serves as a baseline for comparison and as a fallback when no trained
model is available.
"""
import re
import time
import logging
from dataclasses import dataclass, field
from typing import Optional
from app.core.config import settings
from app.nlp.registry import get_model_registry

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# KEYWORD LEXICONS  (illustrative only — not a comprehensive hate lexicon)
# These are minimal demonstration keywords. A real system requires a curated,
# validated, and regularly-updated lexicon reviewed by domain experts.
# ─────────────────────────────────────────────────────────────────────────────

HATE_SPEECH_PATTERNS = [
    r"\b(hate|despise)\s+(all\s+)?(you\s+)?(people|them|those)\b",
    r"\b(go\s+back\s+to|belong\s+in)\b",
    r"\b(inferior|subhuman|vermin|parasite)\b",
    r"\b(slur_placeholder_1|slur_placeholder_2)\b",  # Real slurs redacted from source
]

HARASSMENT_PATTERNS = [
    r"\b(shut\s+up|you('re|\s+are)\s+(stupid|dumb|idiot|moron|loser|pathetic))\b",
    r"\b(kill\s+your(self|selves)|end\s+it\s+all)\b",
    r"\b(nobody\s+(likes|wants)\s+you)\b",
    r"\b(i('ll|\s+will)\s+(hurt|destroy|ruin|find)\s+you)\b",
    r"\b(worthless|useless)\s+(piece|person|human)?\b",
]

CYBERBULLYING_PATTERNS = [
    r"\b(everyone\s+(hates|knows)\s+you)\b",
    r"\b(you\s+(should|deserve\s+to)\s+(die|suffer))\b",
    r"\b(ugly|fat|disgusting)\s+(freak|pig|cow|loser)\b",
    r"\b(spread(ing)?\s+(rumors|lies)\s+about)\b",
    r"\b(screenshot|expose|leak)\s+(your|his|her|their)\b",
]

LEGITIMATE_INDICATORS = [
    r"\b(i\s+(disagree|respectfully\s+disagree|think\s+differently))\b",
    r"\b(in\s+my\s+opinion|from\s+my\s+perspective|i\s+believe)\b",
    r"\b(here\s+is\s+why|because|the\s+reason\s+is|my\s+argument)\b",
    r"\b(constructive\s+criticism|feedback|suggestion)\b",
    r"\b(agree\s+to\s+disagree|let's\s+discuss)\b",
]

UNCERTAINTY_INDICATORS = [
    r"\b(maybe|perhaps|possibly|probably|might|could)\b",
    r"\b(i\s+think|i\s+feel|seems\s+(like|to))\b",
    r"\b(not\s+sure|uncertain|unclear)\b",
]

# Supported languages for detection
LANGUAGE_SCRIPTS = {
    "telugu": r"[\u0C00-\u0C7F]",
    "kannada": r"[\u0C80-\u0CFF]",
    "hindi": r"[\u0900-\u097F]",
    "arabic": r"[\u0600-\u06FF]",
}

OTHER_SCRIPTS = {
    "tamil": r"[\u0B80-\u0BFF]",
    "malayalam": r"[\u0D00-\u0D7F]",
    "bengali": r"[\u0980-\u09FF]",
    "gujarati": r"[\u0A80-\u0AFF]",
    "cyrillic": r"[\u0400-\u04FF]",
    "cjk": r"[\u4E00-\u9FFF]",
}

CODE_MIX_MARKERS = ["yaar", "bhai", "kya", "nahi", "hai", "bol", "kar", "mat", "mera", "tera",
                    "antha", "ikkade", "cheppandi", "mari", "ante", "em", "endi",
                    "yen", "illa", "aru", "yenu", "bekku"]


@dataclass
class LabelScore:
    label: str
    score: float
    evidence: list[str] = field(default_factory=list)


@dataclass
class ToxicityPrediction:
    is_toxic: bool
    toxicity_score: float
    confidence: float
    threshold: float
    model_version: str
    model_available: bool = True
    scope_notice: str = "English toxicity baseline only. Not multilingual hate speech."


@dataclass
class LanguageRouteInfo:
    status: str  # validated_model | needs_review | unsupported_language_model
    target_language: str
    model_name: str
    model_type: str
    review_status: str  # automated_pass_or_flag | mandatory_human_review
    notice: str


@dataclass
class InferenceResult:
    text: str
    original_text: str
    labels: list[LabelScore]
    severity: str
    severity_reason: str
    decision: str
    confidence_level: str  # high / medium / low / uncertain
    detected_language: str
    is_code_mixed: bool
    model_name: str
    model_version: str
    inference_timestamp: float
    processing_time_ms: float
    ambiguity_warning: Optional[str]
    recommended_action: str
    toxicity_prediction: Optional[ToxicityPrediction] = None
    language_route: Optional[LanguageRouteInfo] = None


class BaselineNLPEngine:
    """
    NLP Engine for Sentinel AI.
    Integrates the trained English toxicity classification baseline (models/baseline_toxicity.joblib)
    alongside the multilingual multi-label moderation policy engine.
    """
    MODEL_STATUS = "ready"

    def __init__(self):
        self._hate_patterns = [re.compile(p, re.IGNORECASE) for p in HATE_SPEECH_PATTERNS]
        self._harassment_patterns = [re.compile(p, re.IGNORECASE) for p in HARASSMENT_PATTERNS]
        self._cyberbullying_patterns = [re.compile(p, re.IGNORECASE) for p in CYBERBULLYING_PATTERNS]
        self._legit_patterns = [re.compile(p, re.IGNORECASE) for p in LEGITIMATE_INDICATORS]
        self._uncertainty_patterns = [re.compile(p, re.IGNORECASE) for p in UNCERTAINTY_INDICATORS]
        self._lang_patterns = {k: re.compile(v) for k, v in LANGUAGE_SCRIPTS.items()}
        self._other_lang_patterns = {k: re.compile(v) for k, v in OTHER_SCRIPTS.items()}
        self._toxicity_predictor = None
        self._toxicity_model_loaded = False
        self._init_toxicity_model()

    def _init_toxicity_model(self):
        """Safely load trained English toxicity baseline model."""
        import os
        import sys
        
        # Ensure project root is in sys.path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(current_dir, "..", "..", ".."))
        if project_root not in sys.path:
            sys.path.insert(0, project_root)
            
        try:
            from ml.inference import get_toxicity_predictor, get_multilingual_predictor
            self._toxicity_predictor = get_toxicity_predictor()
            self._multilingual_predictor = get_multilingual_predictor()
            self._toxicity_model_loaded = True
            logger.info("Successfully loaded trained English and multilingual models.")
        except Exception as e:
            logger.warning(f"Could not load trained models: {e}")
            self._toxicity_predictor = None
            self._multilingual_predictor = None
            self._toxicity_model_loaded = False

    @property
    def toxicity_predictor(self):
        return self._toxicity_predictor

    def _detect_language(self, text: str) -> tuple[str, bool]:
        """Detect script-based language and code-mixing."""
        script_detected = "english"
        for lang, pattern in self._lang_patterns.items():
            if pattern.search(text):
                script_detected = lang
                break
        
        if script_detected == "english":
            for lang, pattern in self._other_lang_patterns.items():
                if pattern.search(text):
                    script_detected = lang
                    break
        
        lower = text.lower()
        is_code_mixed = any(re.search(rf"\b{re.escape(marker)}\b", lower) for marker in CODE_MIX_MARKERS)
        if is_code_mixed and script_detected == "english":
            script_detected = "code_mixed"
        
        return script_detected, is_code_mixed

    def _normalize_text(self, text: str) -> str:
        """Normalize text preserving meaningful content."""
        text = text.strip()
        # Normalize excessive whitespace but preserve structure
        text = re.sub(r' {3,}', '  ', text)
        return text

    def _match_patterns(self, text: str, patterns: list) -> list[str]:
        """Return matched pattern strings."""
        evidence = []
        for pat in patterns:
            m = pat.search(text)
            if m:
                evidence.append(m.group(0))
        return evidence

    def _compute_severity(
        self,
        hate_score: float,
        harassment_score: float,
        cyberbullying_score: float,
        legit_score: float,
    ) -> tuple[str, str]:
        max_score = max(hate_score, harassment_score, cyberbullying_score)
        if legit_score > 0.5 and max_score < 0.4:
            return "low", "Strong legitimate indicators found; low harm signal."
        if max_score >= 0.7:
            return "high", "Strong harmful pattern match detected."
        if max_score >= 0.4:
            return "medium", "Moderate harmful signals detected; review recommended."
        if max_score > 0.0:
            return "uncertain", "Weak signals detected; context needed for reliable assessment."
        return "low", "No harmful patterns detected."

    def analyze(
        self,
        text: str,
        context_before: Optional[str] = None,
        context_after: Optional[str] = None,
        language_hint: Optional[str] = None,
    ) -> InferenceResult:
        """
        Run inference on the provided text.
        Returns structured inference result with all relevant metadata.
        """
        if not text or not text.strip():
            raise ValueError("Input text must not be empty.")
        if len(text) > 10000:
            raise ValueError("Input text exceeds maximum length of 10,000 characters.")

        start = time.time()
        normalized = self._normalize_text(text)
        
        # Include context in analysis window
        analysis_window = normalized
        if context_before:
            analysis_window = context_before + " " + analysis_window
        if context_after:
            analysis_window = analysis_window + " " + context_after

        # Pattern matching
        hate_evidence = self._match_patterns(analysis_window, self._hate_patterns)
        harassment_evidence = self._match_patterns(analysis_window, self._harassment_patterns)
        cyber_evidence = self._match_patterns(analysis_window, self._cyberbullying_patterns)
        legit_evidence = self._match_patterns(analysis_window, self._legit_patterns)

        # Score calculation (simple presence-based, NOT calibrated probabilities)
        hate_score = min(len(hate_evidence) * 0.35, 0.95)
        harassment_score = min(len(harassment_evidence) * 0.35, 0.95)
        cyber_score = min(len(cyber_evidence) * 0.35, 0.95)
        legit_score = min(len(legit_evidence) * 0.4, 0.9)

        # Uncertainty
        uncertainty_evidence = self._match_patterns(analysis_window, self._uncertainty_patterns)

        # Build label scores
        labels = [
            LabelScore("hate_speech", round(hate_score, 3), hate_evidence),
            LabelScore("harassment", round(harassment_score, 3), harassment_evidence),
            LabelScore("cyberbullying", round(cyber_score, 3), cyber_evidence),
            LabelScore("legitimate", round(legit_score, 3), legit_evidence),
        ]

        # Severity
        severity, severity_reason = self._compute_severity(hate_score, harassment_score, cyber_score, legit_score)

        # Decision
        max_harmful = max(hate_score, harassment_score, cyber_score)
        if max_harmful >= 0.6 and legit_score < 0.4:
            decision = "flag_for_review"
            recommended_action = "Escalate to human moderator for review."
        elif max_harmful >= 0.3 and severity == "uncertain":
            decision = "human_review"
            recommended_action = "Ambiguous content — recommend human review with full context."
        else:
            decision = "no_action"
            recommended_action = "No policy violation detected. Monitor if patterns persist."

        # Confidence level — this is NOT a calibrated score
        if max_harmful >= 0.7 or legit_score >= 0.7:
            confidence_level = "medium"  # Pattern matching gives medium confidence at best
        elif uncertainty_evidence:
            confidence_level = "low"
        else:
            confidence_level = "medium"

        # Ambiguity warning
        ambiguity_warning = None
        if max_harmful >= 0.3 and legit_score >= 0.3:
            ambiguity_warning = (
                "Both harmful and legitimate signals detected. "
                "Context may be necessary to resolve the classification. "
                "Human review is recommended."
            )
        elif uncertainty_evidence:
            ambiguity_warning = "Uncertainty markers detected; definitive classification is unreliable."

        registry = get_model_registry()
        resolved_key, detected_script, is_code_mixed = registry.resolve_language(text, language_hint)
        meta = registry.get_route_metadata(resolved_key)
        lang = meta.name.lower() if resolved_key != "code_mixed" else "code_mixed"

        is_model_available = False
        if self._toxicity_model_loaded and self._multilingual_predictor:
            is_model_available = self._multilingual_predictor.is_language_supported(resolved_key)
            
        if meta.route_status == "validated_model" and is_model_available:
            route = LanguageRouteInfo(
                status="validated_model",
                target_language=meta.name.lower() if meta.code != "code_mixed" else "hinglish",
                model_name=meta.primary_checkpoint,
                model_type=meta.model_type,
                review_status="automated_pass_or_flag",
                notice=meta.notice
            )
        elif meta.route_status == "validated_model" and not is_model_available:
            route = LanguageRouteInfo(
                status="needs_review",
                target_language=meta.name.lower() if meta.code != "code_mixed" else "hinglish",
                model_name="fallback_rule_engine",
                model_type="rule_policy_pending_checkpoint",
                review_status="mandatory_human_review",
                notice=f"{meta.name} model checkpoint not found locally; routed to human review fallback."
            )
        else:
            route = LanguageRouteInfo(
                status=meta.route_status,
                target_language=meta.name.lower() if meta.code != "code_mixed" else "hinglish",
                model_name=meta.primary_checkpoint,
                model_type=meta.model_type,
                review_status=meta.review_status,
                notice=meta.notice
            )

        # Policy adjustments for non-validated routes
        if route.status == "needs_review":
            if decision == "no_action":
                decision = "human_review"
                recommended_action = f"Language ({route.target_language}) evaluation pending GPU execution. Mandatory human verification recommended."
        elif route.status == "unsupported_language_model":
            if decision == "no_action":
                decision = "human_review"
                recommended_action = f"Unsupported language ({route.target_language}). Mandatory human verification required."

        elapsed_ms = (time.time() - start) * 1000

        # Toxicity prediction using genuine local calibrated model
        toxicity_pred = None
        if route.status == "validated_model":
            try:
                raw_pred = self._multilingual_predictor.predict(text, language=resolved_key)
                toxicity_pred = ToxicityPrediction(
                    is_toxic=raw_pred['is_toxic'],
                    toxicity_score=raw_pred['toxicity_score'],
                    confidence=raw_pred['confidence'],
                    threshold=raw_pred['threshold'],
                    model_version=raw_pred['model_version'],
                    model_available=True,
                    scope_notice=raw_pred['scope_notice']
                )
                
                # Propagate machine-learning toxicity signals into multi-label scores and severity
                if raw_pred['is_toxic']:
                    if resolved_key == "telugu":
                        hate_score = max(hate_score, raw_pred['toxicity_score'])
                        if not hate_evidence:
                            hate_evidence = [f"Telugu hate speech model ({raw_pred['model_version']}) score: {raw_pred['toxicity_score']:.3f}"]
                    elif resolved_key == "hindi":
                        hate_score = max(hate_score, round(raw_pred['toxicity_score'] * 0.9, 3))
                        harassment_score = max(harassment_score, round(raw_pred['toxicity_score'] * 0.9, 3))
                        if not hate_evidence:
                            hate_evidence = [f"Hindi hostility model ({raw_pred['model_version']}) score: {raw_pred['toxicity_score']:.3f}"]
                    elif resolved_key in ["hinglish", "code_mixed"]:
                        hate_score = max(hate_score, raw_pred['toxicity_score'])
                        harassment_score = max(harassment_score, round(raw_pred['toxicity_score'] * 0.85, 3))
                        if not hate_evidence:
                            hate_evidence = [f"Hinglish hate model ({raw_pred['model_version']}) score: {raw_pred['toxicity_score']:.3f}"]
                    elif resolved_key == "kannada":
                        harassment_score = max(harassment_score, raw_pred['toxicity_score'])
                        hate_score = max(hate_score, round(raw_pred['toxicity_score'] * 0.85, 3))
                        if not harassment_evidence:
                            harassment_evidence = [f"Kannada offensive model ({raw_pred['model_version']}) score: {raw_pred['toxicity_score']:.3f}"]
                    elif resolved_key == "english" and raw_pred['toxicity_score'] >= 0.70:
                        harassment_score = max(harassment_score, raw_pred['toxicity_score'])
                        if not harassment_evidence:
                            harassment_evidence = [f"English toxicity model ({raw_pred['model_version']}) score: {raw_pred['toxicity_score']:.3f}"]

                    legit_score = min(legit_score, 0.20)
                    
                    # Rebuild labels with ML-augmented scores
                    labels = [
                        LabelScore("hate_speech", round(hate_score, 3), hate_evidence),
                        LabelScore("harassment", round(harassment_score, 3), harassment_evidence),
                        LabelScore("cyberbullying", round(cyber_score, 3), cyber_evidence),
                        LabelScore("legitimate", round(legit_score, 3), legit_evidence),
                    ]
                    
                    # Recompute severity and decision
                    severity, severity_reason = self._compute_severity(hate_score, harassment_score, cyber_score, legit_score)
                    max_harmful = max(hate_score, harassment_score, cyber_score)
                    if max_harmful >= 0.6:
                        decision = "flag_for_review"
                        recommended_action = "Escalate to human moderator for review (harmful language detected)."
                    elif max_harmful >= 0.35:
                        decision = "flag_for_review"
                        recommended_action = "Flagged by validated machine learning safety model."
                    confidence_level = "high" if max_harmful >= 0.75 else "medium"
            except Exception as e:
                logger.error(f"Model inference failed: {e}")
                toxicity_pred = ToxicityPrediction(
                    is_toxic=False,
                    toxicity_score=0.0,
                    confidence=0.0,
                    threshold=0.40,
                    model_version="unknown",
                    model_available=False,
                    scope_notice=f"Model inference failed: {e}"
                )
        else:
            toxicity_pred = ToxicityPrediction(
                is_toxic=False,
                toxicity_score=0.0,
                confidence=0.0,
                threshold=0.40,
                model_version="unavailable",
                model_available=False,
                scope_notice=f"No validated local model for {route.target_language}. Pending model training and evaluation."
            )

        return InferenceResult(
            text=normalized,
            original_text=text,
            labels=labels,
            severity=severity,
            severity_reason=severity_reason,
            decision=decision,
            confidence_level=confidence_level,
            detected_language=lang,
            is_code_mixed=is_code_mixed,
            model_name=settings.MODEL_NAME,
            model_version=settings.MODEL_VERSION,
            inference_timestamp=time.time(),
            processing_time_ms=round(elapsed_ms, 2),
            ambiguity_warning=ambiguity_warning,
            recommended_action=recommended_action,
            toxicity_prediction=toxicity_pred,
            language_route=route,
        )


# Singleton engine instance
_engine_instance: Optional[BaselineNLPEngine] = None


def get_nlp_engine() -> BaselineNLPEngine:
    """Get or create the singleton NLP engine instance."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = BaselineNLPEngine()
    return _engine_instance
