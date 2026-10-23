"""
Sentinel AI Backend Tests
Tests API endpoints, NLP engine, input validation, and database operations.
"""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Override settings for testing
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_sentinel.db"
os.environ["DEMO_MODE"] = "false"

from main import app
from app.core.database import get_db, Base
from app.nlp.engine import BaselineNLPEngine

# Test database
TEST_DB_URL = "sqlite+aiosqlite:///./test_sentinel.db"
test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create test tables."""
    from app.models import moderation, evaluation, feedback, dataset, audit  # noqa
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    import os
    try:
        os.remove("./test_sentinel.db")
    except Exception:
        pass


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ─── Health Tests ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_endpoint(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_model_status(client):
    resp = await client.get("/api/model/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"
    assert data["model_type"] in ["rule_based_baseline", "hybrid_ml_and_rule_baseline"]
    assert len(data["limitations"]) > 0
    assert len(data["capabilities"]) > 0


# ─── Analysis Tests ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_analyze_legitimate_disagreement(client):
    """
    Critical test: 'I disagree with your opinion, and here is why.'
    must NOT be automatically classified as hate speech.
    """
    resp = await client.post("/api/analyze", json={
        "text": "I disagree with your opinion, and here is why."
    })
    assert resp.status_code == 200
    data = resp.json()
    labels = {l["label"]: l["score"] for l in data["labels"]}
    # Legitimate score should dominate
    assert labels.get("legitimate", 0) > labels.get("hate_speech", 0), (
        "Legitimate disagreement must not score higher for hate speech than legitimate."
    )
    assert data["decision"] != "flag_for_review" or data["ambiguity_warning"] is not None


@pytest.mark.asyncio
async def test_analyze_harassment_detected(client):
    """Harassment patterns should be detected."""
    resp = await client.post("/api/analyze", json={
        "text": "You should just shut up, nobody wants to hear from you."
    })
    assert resp.status_code == 200
    data = resp.json()
    labels = {l["label"]: l["score"] for l in data["labels"]}
    assert labels.get("harassment", 0) > 0.3, "Expected harassment score > 0.3 for explicit harassment text"


@pytest.mark.asyncio
async def test_analyze_hate_speech_detected(client):
    """Hate speech patterns should be detected."""
    resp = await client.post("/api/analyze", json={
        "text": "Your kind of people don't belong here. Go back to where you came from."
    })
    assert resp.status_code == 200
    data = resp.json()
    labels = {l["label"]: l["score"] for l in data["labels"]}
    assert labels.get("hate_speech", 0) > 0.3, "Expected hate speech score > 0.3 for explicit hate text"


@pytest.mark.asyncio
async def test_analyze_empty_text(client):
    """Empty text must be rejected with 422."""
    resp = await client.post("/api/analyze", json={"text": ""})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_whitespace_only(client):
    """Whitespace-only text must be rejected."""
    resp = await client.post("/api/analyze", json={"text": "   "})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_too_long_text(client):
    """Text exceeding 10,000 characters must be rejected."""
    resp = await client.post("/api/analyze", json={"text": "a" * 10001})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_multilingual_telugu(client):
    """Telugu script text should be detected."""
    resp = await client.post("/api/analyze", json={
        "text": "మీ పని చాలా బాగుంది! Great work!"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["detected_language"] in ["telugu", "code_mixed", "english"]


@pytest.mark.asyncio
async def test_analyze_hindi(client):
    """Hindi script text should be handled."""
    resp = await client.post("/api/analyze", json={
        "text": "आपकी राय से मैं सहमत नहीं हूँ।"
    })
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_analyze_code_mixed(client):
    """Code-mixed text should be detected."""
    resp = await client.post("/api/analyze", json={
        "text": "nahi yaar, ye theek nahi hai bhai."
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_code_mixed"] is True or data["detected_language"] in ["code_mixed", "english"]


@pytest.mark.asyncio
async def test_analyze_response_structure(client):
    """Response must contain all required fields."""
    resp = await client.post("/api/analyze", json={"text": "Hello world"})
    assert resp.status_code == 200
    data = resp.json()
    required_fields = [
        "id", "text", "original_text", "labels", "severity",
        "severity_reason", "decision", "confidence_level",
        "detected_language", "is_code_mixed", "model_name",
        "model_version", "inference_timestamp", "processing_time_ms",
        "recommended_action", "model_type_note"
    ]
    for field in required_fields:
        assert field in data, f"Missing required field: {field}"


@pytest.mark.asyncio
async def test_analyze_multi_label_structure(client):
    """Labels must include all four categories."""
    resp = await client.post("/api/analyze", json={"text": "Testing the system"})
    assert resp.status_code == 200
    data = resp.json()
    label_names = [l["label"] for l in data["labels"]]
    assert "hate_speech" in label_names
    assert "harassment" in label_names
    assert "cyberbullying" in label_names
    assert "legitimate" in label_names


@pytest.mark.asyncio
async def test_compare_context(client):
    """Context comparison must run two real inference passes."""
    resp = await client.post("/api/analyze/compare-context", json={
        "text": "I hate this!",
        "context_before": "Did you see the game last night?",
        "context_after": None,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "without_context" in data
    assert "with_context" in data
    assert "label_changes" in data
    assert "note" in data


# ─── Dashboard Tests ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dashboard_summary(client):
    resp = await client.get("/api/dashboard/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_analyzed" in data
    assert "flagged_comments" in data
    assert "pending_review" in data
    assert "high_priority" in data
    assert isinstance(data["total_analyzed"], int)


@pytest.mark.asyncio
async def test_dashboard_distributions(client):
    resp = await client.get("/api/dashboard/distributions")
    assert resp.status_code == 200
    data = resp.json()
    assert "severity_distribution" in data
    assert "category_distribution" in data
    assert "language_distribution" in data


# ─── Moderation Tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_moderation_list(client):
    resp = await client.get("/api/moderation")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_moderation_record_not_found(client):
    resp = await client.get("/api/moderation/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_moderation_review_decision(client):
    """Submit a review decision on a real record."""
    # First create a record
    analyze_resp = await client.post("/api/analyze", json={
        "text": "This is a test for the review decision workflow."
    })
    assert analyze_resp.status_code == 200
    record_id = analyze_resp.json()["id"]

    # Submit decision
    resp = await client.post(f"/api/moderation/{record_id}/decision", json={
        "action": "approve",
        "reviewer_notes": "Confirmed — no policy violation.",
        "reviewer_id": "test_moderator",
        "reviewer_name": "Test Moderator",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["new_status"] == "reviewed"


@pytest.mark.asyncio
async def test_moderation_invalid_action(client):
    """Invalid action must be rejected."""
    analyze_resp = await client.post("/api/analyze", json={"text": "Another test"})
    record_id = analyze_resp.json()["id"]
    resp = await client.post(f"/api/moderation/{record_id}/decision", json={
        "action": "invalid_action",
    })
    assert resp.status_code == 422


# ─── Feedback Tests ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_submit_feedback(client):
    resp = await client.post("/api/feedback", json={
        "is_false_positive": True,
        "explanation": "Test false positive feedback",
        "language": "english",
        "model_version": "1.0.0",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_false_positive"] is True
    assert data["validation_status"] == "pending"


@pytest.mark.asyncio
async def test_error_analysis(client):
    resp = await client.get("/api/feedback/errors")
    assert resp.status_code == 200
    data = resp.json()
    required = ["total_feedback", "false_positives", "false_negatives", "fp_rate", "fn_rate"]
    for field in required:
        assert field in data


# ─── NLP Engine Unit Tests ────────────────────────────────────────────────────

def test_nlp_engine_legitimate_disagreement():
    """Unit test: legitimate disagreement must not be flagged as hate speech."""
    engine = BaselineNLPEngine()
    result = engine.analyze("I disagree with your opinion, and here is why.")
    labels = {l.label: l.score for l in result.labels}
    assert labels["legitimate"] > labels["hate_speech"], (
        "Legitimate disagreement must score higher for legitimate than hate_speech."
    )


def test_nlp_engine_harassment_detection():
    engine = BaselineNLPEngine()
    result = engine.analyze("You should just shut up.")
    labels = {l.label: l.score for l in result.labels}
    assert labels["harassment"] > 0.3


def test_nlp_engine_empty_text():
    engine = BaselineNLPEngine()
    with pytest.raises(ValueError):
        engine.analyze("")


def test_nlp_engine_too_long():
    engine = BaselineNLPEngine()
    with pytest.raises(ValueError):
        engine.analyze("a" * 10001)


def test_nlp_engine_all_labels_present():
    engine = BaselineNLPEngine()
    result = engine.analyze("Just a normal message.")
    label_names = [l.label for l in result.labels]
    assert "hate_speech" in label_names
    assert "harassment" in label_names
    assert "cyberbullying" in label_names
    assert "legitimate" in label_names


def test_nlp_engine_telugu_detection():
    engine = BaselineNLPEngine()
    result = engine.analyze("మీ పని చాలా బాగుంది")
    assert result.detected_language == "telugu"


def test_nlp_engine_code_mixed_detection():
    engine = BaselineNLPEngine()
    result = engine.analyze("nahi yaar this is not right bhai")
    assert result.is_code_mixed is True


def test_nlp_engine_severity_policy():
    engine = BaselineNLPEngine()
    # Legitimate text should be low severity
    result = engine.analyze("In my opinion, this approach is incorrect because of the data.")
    assert result.severity in ["low", "uncertain"]


def test_nlp_engine_context_comparison():
    engine = BaselineNLPEngine()
    result_no_ctx = engine.analyze("I hate this!")
    result_with_ctx = engine.analyze(
        "I hate this!",
        context_before="Did you see the football game?",
    )
    # Both should produce valid results
    assert result_no_ctx.model_name == result_with_ctx.model_name
    assert result_no_ctx.processing_time_ms > 0
    assert result_with_ctx.processing_time_ms > 0


def test_nlp_engine_code_mixed_kannada_markers():
    engine = BaselineNLPEngine()
    result = engine.analyze("ಈ ವಿಷಯ ಬಗ್ಗೆ ನಿಮ್ಮ ಅಭಿಪ್ರಾಯ what do you think?")
    assert result.detected_language == "kannada"


# ─── Dataset Tests ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_datasets(client):
    resp = await client.get("/api/datasets")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ─── Evaluation Tests ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_evaluations(client):
    resp = await client.get("/api/evaluations")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_trigger_evaluation_insufficient_data(client):
    """Evaluation without labeled data should return insufficient_data status."""
    resp = await client.post("/api/evaluations/run")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert data["overall_metrics"]["status"] == "insufficient_labeled_data"


# ─── Project Overview Tests ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_project_overview(client):
    resp = await client.get("/api/project/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] == "CSEAIML2026-P03"
    assert "implemented_features" in data
    assert "planned_features" in data
    assert "limitations" in data
    assert "responsible_ai" in data


# ─── Language Routing & Multilingual MVP Tests ────────────────────────────────

@pytest.mark.asyncio
async def test_english_route_validated_model(client):
    """English text routes to the active production model with validated status."""
    resp = await client.post("/api/analyze", json={
        "text": "This is a standard civil comment on technology and governance."
    })
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["detected_language"] == "english"
    assert data["language_route"] is not None
    route = data["language_route"]
    assert route["status"] == "validated_model"
    assert route["target_language"] == "english"
    assert route["review_status"] == "automated_pass_or_flag"
    assert route["model_type"] == "scikit_learn_tfidf_logreg"
    assert "Validated production English toxicity model" in route["notice"]
    
    # Toxicity prediction should be active for validated English
    assert data["toxicity_prediction"] is not None
    assert data["toxicity_prediction"]["model_available"] is True
    assert data["toxicity_prediction"]["threshold"] == 0.40


@pytest.mark.asyncio
async def test_hindi_route_validated_model(client):
    """Hindi script text routes to validated_model status with active hostility model."""
    resp = await client.post("/api/analyze", json={
        "text": "यह एक हिंदी भाषा का संदेश है।"
    })
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["detected_language"] == "hindi"
    assert data["language_route"] is not None
    route = data["language_route"]
    assert route["status"] == "validated_model"
    assert route["target_language"] == "hindi"
    assert route["review_status"] == "automated_pass_or_flag"
    assert route["model_type"] == "scikit_learn_tfidf_logreg"
    assert "hindi" in route["model_name"].lower()
    
    # Validated route has model_available=True
    assert data["toxicity_prediction"] is not None
    assert data["toxicity_prediction"]["model_available"] is True


@pytest.mark.asyncio
async def test_telugu_route_validated_model(client):
    """Telugu script text routes to validated_model with active Telugu hate speech model."""
    resp = await client.post("/api/analyze", json={
        "text": "ఈ వార్త చాలా ఆసక్తికరంగా ఉంది మరియు ఆలోచింపజేస్తుంది."
    })
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["detected_language"] == "telugu"
    assert data["language_route"] is not None
    route = data["language_route"]
    assert route["status"] == "validated_model"
    assert route["target_language"] == "telugu"
    assert route["review_status"] == "automated_pass_or_flag"
    assert route["model_type"] == "scikit_learn_tfidf_logreg"
    assert "telugu" in route["model_name"].lower()
    assert data["toxicity_prediction"] is not None
    assert data["toxicity_prediction"]["model_available"] is True


@pytest.mark.asyncio
async def test_kannada_route_validated_model(client):
    """Kannada script text routes to validated_model with active Kannada model."""
    resp = await client.post("/api/analyze", json={
        "text": "ಇದು ಕನ್ನಡ ಭಾಷೆಯ ಒಂದು ಸಾಮಾನ್ಯ ವಾಕ್ಯ."
    })
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["detected_language"] == "kannada"
    assert data["language_route"] is not None
    route = data["language_route"]
    assert route["status"] == "validated_model"
    assert route["target_language"] == "kannada"
    assert route["review_status"] == "automated_pass_or_flag"
    assert route["model_type"] == "scikit_learn_tfidf_logreg"
    assert "kannada" in route["model_name"].lower()
    assert data["toxicity_prediction"] is not None
    assert data["toxicity_prediction"]["model_available"] is True


@pytest.mark.asyncio
async def test_hinglish_code_mixed_route_validated_model(client):
    """Code-mixed / Hinglish text routes to validated_model with active Hinglish model."""
    resp = await client.post("/api/analyze", json={
        "text": "bhai ye kya kar raha hai, bilkul samajh nahi aa raha yaar."
    })
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["is_code_mixed"] is True
    assert data["language_route"] is not None
    route = data["language_route"]
    assert route["status"] == "validated_model"
    assert route["target_language"] in ["hinglish", "code_mixed"]
    assert route["review_status"] == "automated_pass_or_flag"
    assert route["model_type"] == "scikit_learn_tfidf_logreg"
    assert "hinglish" in route["model_name"].lower()
    assert data["toxicity_prediction"] is not None
    assert data["toxicity_prediction"]["model_available"] is True


@pytest.mark.asyncio
async def test_telugu_harmful_detected(client):
    """Harmful Telugu text (direct personal insult) is classified as toxic with elevated severity."""
    resp = await client.post("/api/analyze", json={
        "text": "నువ్వు చాలా పనికిరాని వెధవవి"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["toxicity_prediction"]["is_toxic"] is True
    assert data["severity"] in ["high", "medium"]
    assert data["decision"] == "flag_for_review"


@pytest.mark.asyncio
async def test_telugu_regression_insults_and_controls(client):
    """Comprehensive regression test for Telugu insults and civil controls."""
    harmful_cases = [
        "నువ్వు చాలా పనికిరాని వెధవవి",
        "నువ్వు ఒక మూర్ఖుడివి",
        "నీకు ఏమీ చేతకాదు",
        "నువ్వు చాలా చెడ్డవాడివి",
    ]
    for text in harmful_cases:
        resp = await client.post("/api/analyze", json={"text": text})
        assert resp.status_code == 200, f"Failed for {text}"
        data = resp.json()
        assert data["toxicity_prediction"]["is_toxic"] is True, f"Expected toxic for '{text}', got {data['toxicity_prediction']}"
        assert data["severity"] in ["high", "medium"], f"Expected high/medium severity for '{text}', got {data['severity']}"
        assert data["decision"] == "flag_for_review", f"Expected flag_for_review for '{text}', got {data['decision']}"

    civil_cases = [
        "నమస్కారం, మీరు ఎలా ఉన్నారు?",
        "మీ సహాయానికి చాలా ధన్యవాదాలు",
        "ఈ పని సరిగ్గా చేయాలి",
    ]
    for text in civil_cases:
        resp = await client.post("/api/analyze", json={"text": text})
        assert resp.status_code == 200, f"Failed for {text}"
        data = resp.json()
        assert data["toxicity_prediction"]["is_toxic"] is False, f"Expected non-toxic for '{text}', got {data['toxicity_prediction']}"
        assert data["decision"] == "no_action", f"Expected no_action for '{text}', got {data['decision']}"


@pytest.mark.asyncio
async def test_kannada_regression_insults_and_controls(client):
    """Comprehensive regression test for Kannada insults and civil controls."""
    harmful_cases = [
        "ನೀನು ಮೂರ್ಖ",
        "ನೀನು ತುಂಬಾ ಕೆಟ್ಟವನು",
        "ನಿನಗೆ ಏನೂ ಮಾಡಲು ಬರುವುದಿಲ್ಲ",
    ]
    for text in harmful_cases:
        resp = await client.post("/api/analyze", json={"text": text})
        assert resp.status_code == 200, f"Failed for {text}"
        data = resp.json()
        assert data["toxicity_prediction"]["is_toxic"] is True, f"Expected toxic for '{text}', got {data['toxicity_prediction']}"
        assert data["severity"] in ["high", "medium"], f"Expected high/medium severity for '{text}', got {data['severity']}"
        assert data["decision"] == "flag_for_review", f"Expected flag_for_review for '{text}', got {data['decision']}"

    civil_cases = [
        "ನಮಸ್ಕಾರ, ನೀವು ಹೇಗಿದ್ದೀರಿ?",
        "ನಿಮ್ಮ ಸಹಾಯಕ್ಕೆ ಧನ್ಯವಾದಗಳು",
        "ಈ ಕೆಲಸ ಸರಿಯಾಗಿ ಮಾಡಬೇಕು",
    ]
    for text in civil_cases:
        resp = await client.post("/api/analyze", json={"text": text})
        assert resp.status_code == 200, f"Failed for {text}"
        data = resp.json()
        assert data["toxicity_prediction"]["is_toxic"] is False, f"Expected non-toxic for '{text}', got {data['toxicity_prediction']}"
        assert data["decision"] == "no_action", f"Expected no_action for '{text}', got {data['decision']}"



@pytest.mark.asyncio
async def test_hinglish_harmful_detected(client):
    """Harmful Hinglish text is classified as toxic with flag_for_review decision."""
    resp = await client.post("/api/analyze", json={
        "text": "tere baap ko bol saale kutte madarchod"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["toxicity_prediction"]["is_toxic"] is True
    assert data["severity"] in ["high", "medium"]
    assert data["decision"] == "flag_for_review" 


@pytest.mark.asyncio
async def test_manual_language_hint_override(client):
    """Manual language hint directs routing even with ambiguous or Latin text."""
    resp = await client.post("/api/analyze", json={
        "text": "mera dost accha hai",
        "language_hint": "hindi"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["detected_language"] == "hindi"
    assert data["language_route"]["status"] == "validated_model"
    assert data["language_route"]["target_language"] == "hindi"

    # Also verify that a pending language hint routes to needs_review
    resp_ta = await client.post("/api/analyze", json={
        "text": "vanakkam nanba",
        "language_hint": "tamil"
    })
    assert resp_ta.status_code == 200
    data_ta = resp_ta.json()
    assert data_ta["language_route"]["status"] == "needs_review"
    assert data_ta["language_route"]["target_language"] == "tamil"


@pytest.mark.asyncio
async def test_unsupported_language_route(client):
    """Text in unsupported language routes to unsupported_language_model status."""
    resp = await client.post("/api/analyze", json={
        "text": "Bonjour tout le monde, comment allez-vous?",
        "language_hint": "french"
    })
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["language_route"] is not None
    route = data["language_route"]
    assert route["status"] == "unsupported_language_model"
    assert route["review_status"] == "mandatory_human_review"
    assert route["model_type"] == "unsupported_fallback"


@pytest.mark.asyncio
async def test_cyrillic_script_detection_unsupported(client):
    """Cyrillic script automatically routes to unsupported language route."""
    resp = await client.post("/api/analyze", json={
        "text": "Привет мир, это тестовое сообщение на русском языке."
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["detected_language"] == "cyrillic"
    assert data["language_route"]["status"] == "unsupported_language_model"


def test_engine_fallback_when_model_unloaded():
    """Unit test: Engine gracefully sets needs_review if checkpoint is unloaded."""
    engine = BaselineNLPEngine()
    engine._toxicity_model_loaded = False
    result = engine.analyze("Testing English text without checkpoint")
    assert result.language_route.status == "needs_review"
    assert result.language_route.review_status == "mandatory_human_review"
    assert result.toxicity_prediction.model_available is False


# ─── Expanded 22 Scheduled Indian Languages Registry Tests ───────────────────

@pytest.mark.asyncio
async def test_model_languages_api_endpoint(client):
    """GET /api/model/languages returns all 22 scheduled languages plus English and Hinglish."""
    resp = await client.get("/api/model/languages")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_languages"] >= 24
    names = [l["name"] for l in data["languages"]]
    assert "English" in names
    assert "Hindi" in names
    assert "Telugu" in names
    assert "Kannada" in names
    assert "Bengali" in names
    assert "Marathi" in names
    assert "Tamil" in names
    assert "Malayalam" in names
    assert "Urdu" in names
    assert "Gujarati" in names
    assert "Punjabi" in names
    assert "Odia" in names
    assert "Assamese" in names
    assert "Sanskrit" in names


@pytest.mark.asyncio
async def test_tamil_script_detection(client):
    """Tamil script text routes to Tamil with needs_review status."""
    resp = await client.post("/api/analyze", json={
        "text": "வணக்கம், இது ஒரு தமிழ் பரிசோதனை உரை."
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["detected_language"] == "tamil"
    assert data["language_route"]["status"] == "needs_review"
    assert data["language_route"]["review_status"] == "mandatory_human_review"


@pytest.mark.asyncio
async def test_malayalam_script_detection(client):
    """Malayalam script text routes to Malayalam with needs_review status."""
    resp = await client.post("/api/analyze", json={
        "text": "നമസ്കാരം, ഇത് മലയാളം പരിശോധനാ വാചകമാണ്."
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["detected_language"] == "malayalam"
    assert data["language_route"]["status"] == "needs_review"
    assert data["language_route"]["review_status"] == "mandatory_human_review"


@pytest.mark.asyncio
async def test_bengali_script_detection(client):
    """Bengali script text routes to Bengali with MuRIL candidate reference."""
    resp = await client.post("/api/analyze", json={
        "text": "নমস্কার, এটি একটি বাংলা ভাষার বাক্য।"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["detected_language"] == "bengali"
    assert data["language_route"]["status"] == "needs_review"
    assert "MuRIL" in data["language_route"]["model_name"]


@pytest.mark.asyncio
async def test_devanagari_marathi_override(client):
    """Devanagari text with Marathi hint routes to Marathi."""
    resp = await client.post("/api/analyze", json={
        "text": "नमस्कार, हा एक मराठी भाषेतील संदेश आहे.",
        "language_hint": "marathi"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["detected_language"] == "marathi"
    assert data["language_route"]["status"] == "needs_review"
    assert "HASOC" in data["language_route"]["notice"] or "marathi" in data["language_route"]["model_name"].lower()


@pytest.mark.asyncio
async def test_punjabi_gurmukhi_script_detection(client):
    """Gurmukhi script text routes to Punjabi."""
    resp = await client.post("/api/analyze", json={
        "text": "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ, ਇਹ ਪੰਜਾਬੀ ਦਾ ਇੱਕ ਵਾਕ ਹੈ।"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["detected_language"] == "punjabi"
    assert data["language_route"]["status"] == "needs_review"


@pytest.mark.asyncio
async def test_urdu_perso_arabic_script_detection(client):
    """Perso-Arabic script text routes to Urdu."""
    resp = await client.post("/api/analyze", json={
        "text": "یہ اردو زبان کا ایک نمونہ جملہ ہے۔"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["detected_language"] == "urdu"
    assert data["language_route"]["status"] == "needs_review"
    assert "MuRIL" in data["language_route"]["model_name"]


# ─── Live Real-Time Comment Monitoring & Export Tests (No API Keys) ──────────

@pytest.mark.asyncio
async def test_monitoring_status_endpoint(client):
    """GET /api/monitor/status verifies zero external API keys and local offline inference."""
    resp = await client.get("/api/monitor/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["monitoring_status"] == "active_local_listening"
    assert data["offline_local_inference"] is True
    assert data["api_keys_required"] is False
    assert data["external_network_calls"] is False
    assert "models/baseline_toxicity.joblib" in data["active_model_name"]
    assert data["total_monitored_records"] >= 0


@pytest.mark.asyncio
async def test_monitoring_batch_analyze_with_deduplication(client):
    """POST /api/monitor/batch-analyze tests real-time processing and in-memory deduplication."""
    payload = {
        "comments": [
            "This is a respectful and thoughtful discussion point.",
            "You are a completely pathetic idiot and you should shut up.",
            "This is a respectful and thoughtful discussion point.", # Duplicate
            "bhai ye explanation kaafi mast hai, thanks!",
        ],
        "deduplicate": True,
        "platform_source": "Local Test Ingestion"
    }
    resp = await client.post("/api/monitor/batch-analyze", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_received"] == 4
    assert data["processed_count"] == 3
    assert data["duplicate_count"] == 1
    assert data["flagged_count"] >= 1
    assert data["approved_count"] >= 1
    assert len(data["items"]) == 3
    assert data["monitoring_mode"] == "local_offline_pipeline"


@pytest.mark.asyncio
async def test_monitoring_upload_csv(client):
    """POST /api/monitor/upload-csv tests CSV schema detection and local ingestion."""
    csv_content = (
        "comment,author\n"
        "\"Great progress on the project!\",user1\n"
        "\"You are a completely pathetic idiot and you should shut up.\",user2\n"
        "\"Great progress on the project!\",user3\n"
    )
    files = {
        "file": ("comments.csv", csv_content.encode("utf-8"), "text/csv")
    }
    data = {
        "deduplicate": "true",
        "platform_name": "Test CSV Upload"
    }
    resp = await client.post("/api/monitor/upload-csv", files=files, data=data)
    assert resp.status_code == 200
    res = resp.json()
    assert res["total_received"] == 3
    assert res["processed_count"] == 2
    assert res["duplicate_count"] == 1
    assert res["flagged_count"] >= 1


@pytest.mark.asyncio
async def test_export_reviewed_feedback_csv_and_jsonl(client):
    """GET /api/monitor/export-reviewed-feedback exports data for retraining."""
    # Test CSV format
    resp_csv = await client.get("/api/monitor/export-reviewed-feedback?format=csv")
    assert resp_csv.status_code == 200
    assert "text/csv" in resp_csv.headers["content-type"]
    assert "record_id" in resp_csv.text
    assert "target_binary_label" in resp_csv.text

    # Test JSONL format
    resp_jsonl = await client.get("/api/monitor/export-reviewed-feedback?format=jsonl")
    assert resp_jsonl.status_code == 200
    assert "application/x-ndjson" in resp_jsonl.headers["content-type"]



