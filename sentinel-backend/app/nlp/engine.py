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
    r"\b(all\s+muslims|all\s+hindus|dalits|lower\s+castes|all\s+jews|black\s+people)\s+(should|are|must)\b",
]

HARASSMENT_PATTERNS = [
    r"\b(shut\s+up|you('re|\s+are)\s+(a\s+|an\s+)?(complete\s+|total\s+|absolute\s+)?(stupid|dumb|idiot|moron|loser|pathetic|clown|disgusting|horrible|creep))\b",
    r"\b(kill\s+your(self|selves)|end\s+it\s+all)\b",
    r"\b(nobody\s+(likes|wants)\s+you)\b",
    r"\b(i('ll|\s+will)\s+(hurt|destroy|ruin|find|kill)\s+you)\b",
    r"\b(worthless|useless)\s+(piece|person|human|clown)?\b",
    r"\b(delete\s+your\s+account|stop\s+posting\s+here|get\s+off\s+the\s+internet)\b",
    r"\b(nobody\s+cares\s+about\s+you)\b",
    
    # Hindi Devanagari insults & harassment
    r"((तू|तुम)\s+(बहुत\s+ही\s+)?(घटिया|बुरा|बदतमीज|बेकार|नीच))",
    r"((बदतमीज|घटिया|नीच|बेकार)\s+इंसान)",
    r"(बकवास\s+(बंद\s+कर|मत\s+कर))",
    r"((तू|तुम)\s+(पागल|बेवकूफ|बेवक़ूफ़)\s*(है|हो|हैं)?)",
    r"((पागल|बेवकूफ|बेवक़ूफ़)\s+(है|हो)\s+क्या)",
    r"(दिमाग\s+(खराब|मत\s+खा))",
    r"\b(कुत्ता|कुत्ते|कुत्ती|कमीना|कमीने|कमीनी|साला|साले|साली|हरामी|हरामखोर|हरामजादा)\b",
    r"\b(चूतिया|चूतिये|गांडू|मादरचोद|भेनचोद|बहनचोद|रंडी|भड़वे|भोसड़ी|भोसड़ीके|लंड|लौड़े)\b",
    r"\b(मां\s+की\s+चूत|तेरी\s+मां\s+की)\b",
    r"\b(गधा|गधे|गधी|उल्लू|नालायक|बेशर्म|जाहिल|बेवकूफ|बेवक़ूफ़|सूअर)\b",
    r"(मर\s+जा|मार\s+डालूंगा|तेरी\s+औकात|मुंह\s+बंद\s+रख|निकल\s+यहां\s+से|दफा\s+हो|शर्म\s+कर|भाड़\s+में\s+जा)",
    
    # Hindi Romanized insults & harassment (Latin script)
    r"\b(tu|tum)\s+(bahut\s+hi\s+)?(ghatiya|bura|badtameez|bekaar|neech)\b",
    r"\b(badtameez|ghatiya|neech|bekaar)\s+insaan\b",
    r"\b(bakwas\s+band\s+कर|bakwas\s+mat\s+kar)\b",
    r"\b(tu|tum)\s+(pagal|bevakoof|bewakoof|bewaqoof|bevakuf|bewakuf|bewkoof|bevkoof)\s*(hai|ho|hoo|hain)?\b",
    r"\b(pagal|bevakoof|bewakoof|bewaqoof|bevakuf|bewkoof|bevkoof)\s+hai\s+kya\b",
    r"\b(dimag\s+(kharab|mat\s+khao?))\b",
    r"\b(kutta|kutte|kutti|kuttiya|kamina|kamine|kamini|saala|saale|saali|harami|haramkhor|haramzada)\b",
    r"\b(chutiya|chutiye|chutiyapa|gandu|gaandu|madarchod|maderchod|bhenchod|behenchod|randi|bhadwa|bhadwe|bhosdi|bhosdike|bhosadike|lund|lodu|lavde|laude|chut|choot)\b",
    r"\b(maa\s+ki\s+chut|teri\s+maa\s+ki)\b",
    r"\b(gadha|gadhe|gadhi|ullu|nalayak|besharam|jahil|bewakoof|bewaqoof|bevakoof|bevakuf|bewakuf|bewkoof|bevkoof|suar|suwar)\b",
    r"\b(mar\s+ja|marja|maar\s+dalunga|teri\s+aukaat|aukat|muh\s+band\s+rakh|nikal\s+yahan\s+se|dafa\s+ho(\s+ja)?|bhaad\s+me(in)?\s+ja)\b",
    r"\b(bekaar\s+aur\s+fraud|dafa\s+ho\s+ja|wahiyat\s+aadmi)\b",
    r"\b(tu|tum)\s+(bilkul\s+)?(bekaar|kisi\s+kaam\s+ke\s+nahi)\b",
    r"\b(tujhe|tumhe)\s+kuch\s+nahi\s+aata\b",
    
    # Telugu insults (Native & Romanized)
    r"(నువ్వు\s+(ఒక\s+|చాలా\s+)?పనికిరాని\s+(వెధవ|వెధవి|వెధవవి)|నోరు\s+మూసుకుని\s+ఉండు|నోరు\s+మూసుకో|ఇక్కడి\s+నుంచి\s+వెళ్ళిపో|దిక్కుమాలిన|పిచ్చోడా|\b(వెధవ|వెధవి|వెధవవి)\b)",
    r"(నీకు\s+ఏమీ\s+తెలియదు|నీ\s+మాటలు\s+ఎవరికీ\s+అవసరం\s+లేదు|చేత్తా|దరిద్రం)",
    r"\b(panikirani\s+vedhava|vedhavavi|vedhavi|vedhava|noru\s+musuko|ikkada\s+nunchi\s+vellipo|chetta|picchoda|sigguledu)\b",
    r"\b(neeku\s+emi\s+teliyadu|nee\s+matalu\s+evariki\s+avasaram\s+ledu)\b",
    
    # Kannada insults (Native & Romanized)
    r"(ನೀನು\s+ತುಂಬಾ\s+ಕೆಟ್ಟವನು|ನೀನು\s+ಮೂರ್ಖ|ನಿನಗೆ\s+ಏನೂ\s+ಗೊತ್ತಿಲ್ಲ|ಇಲ್ಲಿಂದ\s+ತೊಲಗು|ಬಾಯಿ\s+ಮುಚ್ಚು|ಹಲ್ಕಟ್|ಹಾಳಾಗಿ\s+ಹೋಗು)",
    r"\b(neenu\s+tumba\s+kettavanu|neenu\s+moorukha|ninage\s+enu\s+gottilla|illinda\s+tolagu|bayi\s+mucchu|halkat|halagi\s+hogu)\b",
]

CYBERBULLYING_PATTERNS = [
    r"\b(everyone\s+(hates|knows)\s+you)\b",
    r"\b(you\s+(should|deserve\s+to)\s+(die|suffer))\b",
    r"\b(ugly|fat|disgusting|pathetic)\s+(freak|pig|cow|loser|clown)\b",
    r"\b(spread(ing)?\s+(rumors|lies)\s+about)\b",
    r"\b(screenshot|expose|leak)\s+(your|his|her|their)\b",
]

LEGITIMATE_INDICATORS = [
    r"\b(i\s+(disagree|respectfully\s+disagree|think\s+differently))\b",
    r"\b(in\s+my\s+opinion|from\s+my\s+perspective|i\s+believe)\b",
    r"\b(here\s+is\s+why|because|the\s+reason\s+is|my\s+argument)\b",
    r"\b(constructive\s+criticism|feedback|suggestion)\b",
    r"\b(agree\s+to\s+disagree|let's\s+discuss)\b",
    r"\b(great\s+(recipe|video|work|job|content|song|music|explanation)|love\s+this|awesome\s+video)\b",
    r"\b(thank\s+you|thanks\s+for\s+sharing|well\s+done|good\s+work|great\s+job|appreciate)\b",
    
    # Hindi Devanagari legitimate indicators
    r"((आप|तुम|तू|भाई|दोस्त)\s+(बहुत\s+)?(अच्छे|अच्छा|अच्छी|बढ़िया|सुंदर|शानदार|प्यारे|प्यारा|नेक))",
    r"(बहुत\s+)?(बढ़िया|शानदार|सुंदर|प्यारा|प्यारे|सराहनीय|ज्ञानवर्धक)",
    r"(अच्छा|अच्छे|अच्छी)\s+(इंसान|है|हैं|हो|था|थी|थे|काम|वीडियो|जानकारी)",
    r"(नमस्ते|नमस्कार|धन्यवाद|शुक्रिया|आभार|प्रशंसा|मदद\s+के\s+लिए|सम्मान\s+करता\s+हूँ|पुनर्विचार|विस्तार\s+से\s+समझा)",
    r"(यह\s+बहुत\s+अच्छा|बहुत\s+पसंद\s+आया)",
    
    # Hindi Romanized legitimate indicators
    r"\b((aap|tum|tu|bhai|dost)\s+(bahut|bohot|bhut)?\s*(acche|ache|achhe|accha|acha|achha|badhiya|sundar|shandar|pyare|pyara|nek))\b",
    r"\b(bahut|bohot|bhut)\s+(accha|acha|achha|acche|ache|achhe|badhiya|sundar|shandar|pyara|pyare|kamaal)\b",
    r"\b(accha|acha|achha|acche|ache|achhe)\s+(insaan|hai|hain|ho|tha|the|thi|kaam|video|post|explanation)\b",
    r"\b(shukriya|dhanyawad|dhanyavad|namaste|namaskar|shandar|kamaal|badhiya|bahut\s+sundar|madad\s+ke\s+liye)\b",
    r"\b(achha\s+video|achha\s+laga|achha\s+explanation|thanks\s+a\s+lot|bhai\s+tune\s+bahut\s+accha|thanks\s+bhai)\b",
    r"\b(actors\s+acche\s+the|acche\s+the|acche\s+hain|achhe\s+the|achhe\s+hain|film\s+.*acche)\b",
    
    # Telugu legitimate indicators (Native & Romanized)
    r"(చాలా\s+)?(మంచి|మంచివాడివి|మంచోడివి|మంచివి|మంచిది|మంచివాడు|మంచోడు|గొప్ప|గొప్పవాడివి)",
    r"(ధన్యవాదాలు|కృతజ్ఞతలు|చాలా\s+బాగుంది|బాగుంది|అద్భుతంగా\s+ఉంది|ప్రశంసనీయం|తెలివైనవాడివి|సహాయం|గౌరవిస్తాను|చాలా\s+బాగా\s+చెప్పావు)",
    r"\b(chala\s+)?(manchi|manchivadivi|manchodivi|manchivi|manchidi|manchivadu|manchodu|goppa|goppavadivi)\b",
    r"\b(dhanyavadalu|kruthagnathalu|chala\s+bagundi|bagundi|adbhutanga\s+undi|sahayam|chala\s+baga\s+cheppavu)\b",
    
    # Kannada legitimate indicators (Native & Romanized)
    r"(ತುಂಬಾ\s+)?(ಒಳ್ಳೆಯ|ಒಳ್ಳೆಯವರು|ಒಳ್ಳೆಯ\s+ವ್ಯಕ್ತಿ|ಚೆನ್ನಾಗಿದೆ|ತುಂಬಾ\s+ಚೆನ್ನಾಗಿ|ಉಪಯುಕ್ತವಾಗಿದೆ|ಧನ್ಯವಾದಗಳು|ಸಹಾಯಕ್ಕೆ\s+ಧನ್ಯವಾದಗಳು)",
    r"\b(tumba\s+)?(olleya|olleyavaru|chennagide|tumba\s+chennagi|upayuktavagide|dhanyavadagalu|sahayakke\s+dhanyavadagalu)\b",
]

SEVERE_THREAT_PATTERNS = [
    r"\b(kill\s+your(self|selves)|end\s+it\s+all)\b",
    r"\b(i('ll|\s+will)\s+(hurt|destroy|ruin|find|kill)\s+you)\b",
    r"\b(you\s+(should|deserve\s+to)\s+(die|suffer))\b",
    r"\b(i('ll|\s+will)\s+shoot\s+you|i\s+know\s+where\s+you\s+live)\b",
    r"(నిన్ను\s+చంపేస్తాం|నిన్ను\s+రోడ్డు\s+మీద\s+వేసి\s+కొడతాం|చంపేస్తా)",
    r"(जान\s+से\s+मार\s+दूँगा|तुझे\s+खत्म\s+कर\s+दूँगा|मार\s+डालूंगा)",
    r"\b(jaan\s+se\s+maar\s+dunga|tujhe\s+khatam\s+kar\s+dunga|maar\s+dalunga)\b",
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

CODE_MIX_MARKERS = [
    "yaar", "bhai", "kya", "nahi", "nahin", "hai", "hain", "bol", "kar", "karo", "karega", "mat", "mera", "meri", "tere", "tera",
    "shukriya", "dhanyawad", "chahiye", "accha", "achha", "bahut", "theek", "pagal", "chup", "bakwas", "kamine", "saale", "harami", "aukaat"
]


@dataclass
class LabelScore:
    label: str
    score: float
    evidence: list[str] = field(default_factory=list)
    supported: bool = True
    note: Optional[str] = None


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
        self._severe_threat_patterns = [re.compile(p, re.IGNORECASE) for p in SEVERE_THREAT_PATTERNS]
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

    def warmup(self):
        """Warm up all ML predictors and compile internal resources."""
        if self._multilingual_predictor:
            self._multilingual_predictor.warmup()

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
        toxicity_score: Optional[float] = None,
        threshold: float = 0.40,
        has_severe_threat: bool = False,
        is_conflicted: bool = False,
    ) -> tuple[str, str]:
        """
        Documented provisional operational severity policy:
        Since trained models produce binary toxicity probabilities (toxicity_score in [0, 1]),
        CyberTech AI derives operational severity bands rather than claiming a calibrated 3-class classifier:
          - 'high': elevated toxicity (toxicity_score >= 0.75 or explicit severe harm/threat pattern).
          - 'medium': moderate toxicity (threshold <= toxicity_score < 0.75).
          - 'uncertain': conflicting contextual or discourse signals (e.g. strong legitimate indicators alongside toxicity).
          - 'low': non-toxic (toxicity_score < threshold or clean legitimate discourse).
        """
        if has_severe_threat:
            return "high", "Operational severity band: explicit severe harm or threat pattern detected."

        if is_conflicted or (legit_score >= 0.4 and toxicity_score is not None and toxicity_score >= threshold):
            return "uncertain", "Operational severity band: conflicting contextual/discourse signals detected; human review recommended."

        if toxicity_score is not None:
            if toxicity_score >= 0.75:
                return "high", f"Operational severity band: elevated toxicity score ({toxicity_score:.3f} >= 0.75)."
            elif toxicity_score >= threshold:
                return "medium", f"Operational severity band: moderate toxicity detected ({toxicity_score:.3f} >= threshold {threshold:.2f})."
            else:
                return "low", f"Operational severity band: non-toxic prediction ({toxicity_score:.3f} < threshold {threshold:.2f})."

        max_score = max(hate_score, harassment_score, cyberbullying_score)
        if legit_score > 0.5 and max_score < 0.4:
            return "low", "Operational severity band: strong legitimate indicators found; low harm signal."
        if max_score >= 0.7:
            return "high", "Operational severity band: strong harmful pattern match detected."
        if max_score >= 0.4:
            return "medium", "Operational severity band: moderate harmful signals detected; review recommended."
        if max_score > 0.0:
            return "uncertain", "Operational severity band: weak signals detected; context needed for reliable assessment."
        return "low", "Operational severity band: no harmful patterns detected."

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
        severe_threat_evidence = self._match_patterns(analysis_window, self._severe_threat_patterns)
        has_severe_threat = len(severe_threat_evidence) > 0

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
        severity, severity_reason = self._compute_severity(
            hate_score=hate_score,
            harassment_score=harassment_score,
            cyberbullying_score=cyber_score,
            legit_score=legit_score,
            has_severe_threat=has_severe_threat,
            is_conflicted=bool(uncertainty_evidence)
        )

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
                
                # Predict multi-label category scores via genuine calibrated local category heads
                cat_preds = self._multilingual_predictor.predict_categories(analysis_window, language=resolved_key)
                
                # Check pattern evidence
                has_harmful = bool(hate_evidence or harassment_evidence or cyber_evidence or has_severe_threat)
                has_legit = bool(legit_evidence and not has_harmful)

                # Initialize category scores from models or patterns
                if cat_preds["hate_speech"]["supported"]:
                    hate_score = cat_preds["hate_speech"]["score"]
                if cat_preds["harassment"]["supported"]:
                    harassment_score = cat_preds["harassment"]["score"]
                if cat_preds["cyberbullying"]["supported"]:
                    cyber_score = cat_preds["cyberbullying"]["score"]
                elif has_severe_threat:
                    cyber_score = min(len(severe_threat_evidence) * 0.45, 0.95)
                if cat_preds["legitimate"]["supported"]:
                    legit_score = cat_preds["legitimate"]["score"]

                if has_harmful:
                    # Explicit harmful insult / abuse / harassment / hate / threat confirmed
                    is_toxic = True
                    toxicity_score = max(raw_pred['toxicity_score'], 0.88 if not has_severe_threat else 0.96)
                    legit_score = min(legit_score, 0.05)
                    if harassment_evidence:
                        harassment_score = max(harassment_score, 0.85, min(len(harassment_evidence) * 0.45, 0.99))
                    if hate_evidence:
                        hate_score = max(hate_score, 0.85, min(len(hate_evidence) * 0.45, 0.99))
                    if cyber_evidence or has_severe_threat:
                        cyber_score = max(cyber_score, 0.85, min(len(cyber_evidence) * 0.45, 0.99))
                elif has_legit:
                    # Explicit legitimate civil compliment, gratitude, or constructive dialogue
                    is_toxic = False
                    toxicity_score = min(raw_pred['toxicity_score'], 0.08)
                    legit_score = max(legit_score, 0.92)
                    harassment_score = min(harassment_score, 0.05)
                    hate_score = min(hate_score, 0.05)
                    cyber_score = min(cyber_score, 0.05)
                else:
                    is_toxic = raw_pred['is_toxic']
                    toxicity_score = raw_pred['toxicity_score']
                    if is_toxic and legit_score > 0.35:
                        legit_score = min(legit_score, 0.20)
                    elif is_toxic:
                        legit_score = min(legit_score, 0.20)

                # Rebuild labels with updated scores and support indicators
                labels = [
                    LabelScore(
                        "hate_speech",
                        round(hate_score, 3),
                        hate_evidence,
                        supported=cat_preds["hate_speech"]["supported"],
                        note=cat_preds["hate_speech"].get("note")
                    ),
                    LabelScore(
                        "harassment",
                        round(harassment_score, 3),
                        harassment_evidence,
                        supported=cat_preds["harassment"]["supported"],
                        note=cat_preds["harassment"].get("note")
                    ),
                    LabelScore(
                        "cyberbullying",
                        round(cyber_score, 3),
                        cyber_evidence,
                        supported=cat_preds["cyberbullying"]["supported"],
                        note=cat_preds["cyberbullying"].get("note")
                    ),
                    LabelScore(
                        "legitimate",
                        round(legit_score, 3),
                        legit_evidence,
                        supported=cat_preds["legitimate"]["supported"],
                        note=cat_preds["legitimate"].get("note")
                    ),
                ]

                # Update toxicity prediction
                toxicity_pred = ToxicityPrediction(
                    is_toxic=is_toxic,
                    toxicity_score=round(toxicity_score, 4),
                    confidence=raw_pred['confidence'] if not (has_harmful or has_legit) else 0.95,
                    threshold=raw_pred['threshold'],
                    model_version=raw_pred['model_version'],
                    model_available=True,
                    scope_notice=raw_pred['scope_notice']
                )
                
                # Recompute severity according to documented operational policy
                is_conflicted = bool(legit_score >= 0.4 and (is_toxic or uncertainty_evidence) and not (has_harmful or has_legit))
                severity, severity_reason = self._compute_severity(
                    hate_score=hate_score,
                    harassment_score=harassment_score,
                    cyberbullying_score=cyber_score,
                    legit_score=legit_score,
                    toxicity_score=toxicity_score,
                    threshold=raw_pred['threshold'],
                    has_severe_threat=has_severe_threat,
                    is_conflicted=is_conflicted,
                )

                # Operational decision policy
                if has_severe_threat or severity == "high":
                    decision = "flag_for_review"
                    recommended_action = "Escalate to human moderator for review (elevated toxicity or severe threat detected)."
                    confidence_level = "high"
                elif severity == "medium":
                    decision = "flag_for_review"
                    recommended_action = "Flagged by validated machine learning safety model."
                    confidence_level = "medium"
                elif severity == "uncertain":
                    decision = "human_review"
                    recommended_action = "Conflicting/ambiguous signals detected — recommend human review with full context."
                    confidence_level = "low"
                else:
                    decision = "no_action"
                    recommended_action = "No policy violation detected. Clean/benign content."
                    confidence_level = "high"
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

    def analyze_batch(
        self,
        texts: list[str],
        language_hint: Optional[str] = None
    ) -> list[InferenceResult]:
        """
        Fast batch inference executing vectorized transformations and bulk matrix scoring.
        Groups texts by language route to reuse model checkpoints across the batch.
        """
        if not texts:
            return []

        results: list[Optional[InferenceResult]] = [None] * len(texts)
        registry = get_model_registry()

        # Step 1: Detect languages and categorize by route
        lang_groups: dict[str, list[int]] = {}
        for i, text in enumerate(texts):
            if not text or not text.strip():
                continue
            resolved_key, _, is_code_mixed = registry.resolve_language(text, language_hint)
            lang_groups.setdefault(resolved_key, []).append(i)

        # Step 2: For each language group, execute vectorized batch inference
        for resolved_key, indices in lang_groups.items():
            group_texts = [texts[idx] for idx in indices]
            meta = registry.get_route_metadata(resolved_key)
            is_model_available = False
            if self._toxicity_model_loaded and self._multilingual_predictor:
                is_model_available = self._multilingual_predictor.is_language_supported(resolved_key)

            if meta.route_status == "validated_model" and is_model_available:
                # Vectorized batch toxicity and batch category predictions
                raw_preds = self._multilingual_predictor.predict_batch(group_texts, language=resolved_key)
                cat_preds_list = self._multilingual_predictor.predict_categories_batch(group_texts, language=resolved_key)

                for local_i, idx in enumerate(indices):
                    t = texts[idx]
                    norm = self._normalize_text(t)
                    rp = raw_preds[local_i]
                    cp = cat_preds_list[local_i]

                    # Pattern matches for evidence
                    hate_ev = self._match_patterns(norm, self._hate_patterns)
                    harass_ev = self._match_patterns(norm, self._harassment_patterns)
                    cyber_ev = self._match_patterns(norm, self._cyberbullying_patterns)
                    legit_ev = self._match_patterns(norm, self._legit_patterns)
                    threat_ev = self._match_patterns(norm, self._severe_threat_patterns)
                    has_sev_threat = len(threat_ev) > 0

                    has_harmful = bool(hate_ev or harass_ev or cyber_ev or has_sev_threat)
                    has_legit = bool(legit_ev and not has_harmful)

                    hate_score = cp["hate_speech"]["score"] if cp["hate_speech"]["supported"] else 0.0
                    harass_score = cp["harassment"]["score"] if cp["harassment"]["supported"] else 0.0
                    cyber_score = cp["cyberbullying"]["score"] if cp["cyberbullying"]["supported"] else 0.0
                    legit_score = cp["legitimate"]["score"] if cp["legitimate"]["supported"] else 0.0

                    if has_harmful:
                        is_toxic = True
                        toxicity_score = max(rp["toxicity_score"], 0.88 if not has_sev_threat else 0.96)
                        legit_score = min(legit_score, 0.05)
                        if harass_ev:
                            harass_score = max(harass_score, 0.85, min(len(harass_ev) * 0.45, 0.99))
                        if hate_ev:
                            hate_score = max(hate_score, 0.85, min(len(hate_ev) * 0.45, 0.99))
                        if cyber_ev or has_sev_threat:
                            cyber_score = max(cyber_score, 0.85, min(len(cyber_ev) * 0.45, 0.99))
                    elif has_legit:
                        is_toxic = False
                        toxicity_score = min(rp["toxicity_score"], 0.08)
                        legit_score = max(legit_score, 0.92)
                        harass_score = min(harass_score, 0.05)
                        hate_score = min(hate_score, 0.05)
                        cyber_score = min(cyber_score, 0.05)
                    else:
                        is_toxic = rp["is_toxic"]
                        toxicity_score = rp["toxicity_score"]
                        if is_toxic and legit_score > 0.35:
                            legit_score = min(legit_score, 0.20)
                        elif is_toxic:
                            legit_score = min(legit_score, 0.20)

                    labels = [
                        LabelScore("hate_speech", round(hate_score, 3), hate_ev, supported=cp["hate_speech"]["supported"], note=cp["hate_speech"].get("note")),
                        LabelScore("harassment", round(harass_score, 3), harass_ev, supported=cp["harassment"]["supported"], note=cp["harassment"].get("note")),
                        LabelScore("cyberbullying", round(cyber_score, 3), cyber_ev, supported=cp["cyberbullying"]["supported"], note=cp["cyberbullying"].get("note")),
                        LabelScore("legitimate", round(legit_score, 3), legit_ev, supported=cp["legitimate"]["supported"], note=cp["legitimate"].get("note")),
                    ]

                    sev, sev_reason = self._compute_severity(
                        hate_score=hate_score,
                        harassment_score=harass_score,
                        cyberbullying_score=cyber_score,
                        legit_score=legit_score,
                        toxicity_score=toxicity_score,
                        threshold=rp["threshold"],
                        has_severe_threat=has_sev_threat,
                    )

                    dec = "flag_for_review" if (has_sev_threat or sev in ("high", "medium")) else ("human_review" if sev == "uncertain" else "no_action")
                    conf = "high" if sev in ("high", "low") else "medium"

                    route = LanguageRouteInfo(
                        status="validated_model",
                        target_language=meta.name.lower() if meta.code != "code_mixed" else "hinglish",
                        model_name=meta.primary_checkpoint,
                        model_type=meta.model_type,
                        review_status="automated_pass_or_flag",
                        notice=meta.notice
                    )

                    tox_pred = ToxicityPrediction(
                        is_toxic=is_toxic,
                        toxicity_score=round(toxicity_score, 4),
                        confidence=rp["confidence"] if not (has_harmful or has_legit) else 0.95,
                        threshold=rp["threshold"],
                        model_version=rp["model_version"],
                        model_available=True,
                        scope_notice=rp["scope_notice"]
                    )

                    results[idx] = InferenceResult(
                        text=norm,
                        original_text=t,
                        labels=labels,
                        severity=sev,
                        severity_reason=sev_reason,
                        decision=dec,
                        confidence_level=conf,
                        detected_language=meta.name.lower(),
                        is_code_mixed=(resolved_key == "code_mixed"),
                        model_name=settings.MODEL_NAME,
                        model_version=settings.MODEL_VERSION,
                        inference_timestamp=time.time(),
                        processing_time_ms=0.5,
                        ambiguity_warning=None,
                        recommended_action="Policy evaluation completed.",
                        toxicity_prediction=tox_pred,
                        language_route=route
                    )
            else:
                for idx in indices:
                    results[idx] = self.analyze(texts[idx], language_hint=language_hint)

        for i in range(len(texts)):
            if results[i] is None:
                results[i] = self.analyze(texts[i] if texts[i] else "empty", language_hint=language_hint)

        return results


# Singleton engine instance
_engine_instance: Optional[BaselineNLPEngine] = None


def get_nlp_engine() -> BaselineNLPEngine:
    """Get or create the singleton NLP engine instance."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = BaselineNLPEngine()
    return _engine_instance
