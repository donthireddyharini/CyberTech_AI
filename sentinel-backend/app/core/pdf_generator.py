"""
CyberTech AI — Automated Research Report PDF Generator
Produces detailed, publication-ready PDF research reports using ReportLab
and genuine empirical evaluation data stored in reports/ and data/.
"""
import os
import json
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)


def generate_research_report_pdf() -> bytes:
    """Build and return binary PDF bytes for the CyberTech AI research evaluation report."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
        alignment=1, # Center
        spaceAfter=6
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#6366f1"),
        alignment=1,
        spaceAfter=15
    )
    meta_style = ParagraphStyle(
        "DocMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
        spaceAfter=15
    )
    h1_style = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#1e1b4b"),
        spaceBefore=14,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#334155"),
        spaceAfter=8
    )
    table_text = ParagraphStyle(
        "TableText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b")
    )
    table_header = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    story = []

    # 1. Header Banner
    story.append(Paragraph("CYBERTECH AI: CONTEXT-AWARE CONTENT MODERATION", title_style))
    story.append(Paragraph("Empirical Evaluation & Social Intelligence Operations Report", subtitle_style))
    report_date = datetime.utcnow().strftime("%B %d, %Y - %H:%M UTC")
    story.append(Paragraph(f"CyberTech AI Intelligence Operations  |  Generated: {report_date}  |  Classification: Strict Local ML & Live Social Telemetry", meta_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#6366f1"), spaceAfter=14))

    # 2. Executive Summary
    story.append(Paragraph("1. Executive Summary", h1_style))
    summary_text = (
        "CyberTech AI is an enterprise context-aware, privacy-preserving content moderation intelligence platform designed to detect "
        "harassment, hate speech, and toxicity across English and major Indian languages (Hindi, Hinglish, "
        "Telugu, and Kannada). The platform integrates real-time telemetry from YouTube Data API v3 and Instagram Graph API v20.0. "
        "All inference models are executed strictly locally on-device without external AI inference "
        "APIs, third-party cloud LLMs, or telemetry leakage. This document details empirical benchmark evaluation results "
        "measured across held-out test splits without data leakage, combined with real-world multi-platform social moderation governance."
    )
    story.append(Paragraph(summary_text, body_style))

    # 3. Model Architecture & Language Coverage
    story.append(Paragraph("2. Model Architecture & Verified Language Pipelines", h1_style))
    arch_text = (
        "The classification pipeline integrates custom Indic-aware Unicode word n-gram (1-2) and character n-gram (2-5) "
        "FeatureUnions fed into balanced Logistic Regression classifiers with Platt-calibrated probability thresholds. "
        "Combining diacritic-aware tokenization patterns prevents morphological fragmentation in agglutinative Dravidian scripts."
    )
    story.append(Paragraph(arch_text, body_style))

    # Load real evaluation reports from reports/
    reports_data = {}
    langs = [
        ("English", "reports/evaluation_report.json"),
        ("Hindi", "reports/hindi_evaluation_report.json"),
        ("Hinglish", "reports/hinglish_evaluation_report.json"),
        ("Telugu", "reports/telugu_evaluation_report.json"),
        ("Kannada", "reports/kannada_evaluation_report.json"),
    ]
    for lang, path in langs:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    reports_data[lang] = json.load(f)
            except Exception:
                pass

    # 4. Multi-Language Empirical Metrics Table
    story.append(Paragraph("3. Empirical Evaluation Results Across Validated Languages", h1_style))
    story.append(Paragraph("Metrics evaluated strictly on held-out test sets with zero train-to-test leakage:", body_style))

    benchmark_data = [
        [
            Paragraph("Language", table_header),
            Paragraph("Dataset", table_header),
            Paragraph("Test N", table_header),
            Paragraph("Harmful", table_header),
            Paragraph("Thresh", table_header),
            Paragraph("Accuracy", table_header),
            Paragraph("Precision", table_header),
            Paragraph("Recall", table_header),
            Paragraph("F1-Score", table_header),
        ]
    ]

    for lang_name, _ in langs:
        r = reports_data.get(lang_name, {})
        m = r.get("metrics", {})
        ds = r.get("dataset", "Benchmark Corpus")
        if len(ds) > 28:
            ds = ds[:25] + "..."
        benchmark_data.append([
            Paragraph(lang_name, table_text),
            Paragraph(ds, table_text),
            Paragraph(str(r.get("total_test_samples", "—")), table_text),
            Paragraph(str(r.get("positive_samples", "—")), table_text),
            Paragraph(str(r.get("optimal_threshold", "—")), table_text),
            Paragraph(f"{m.get('accuracy', 0.0):.4f}" if "accuracy" in m else "—", table_text),
            Paragraph(f"{m.get('precision', 0.0):.4f}" if "precision" in m else "—", table_text),
            Paragraph(f"{m.get('recall', 0.0):.4f}" if "recall" in m else "—", table_text),
            Paragraph(f"{m.get('f1_score', 0.0):.4f}" if "f1_score" in m else "—", table_text),
        ])

    bench_table = Table(benchmark_data, colWidths=[55, 125, 45, 45, 42, 52, 52, 52, 52])
    bench_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e1b4b")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(bench_table)
    story.append(Spacer(1, 12))

    # 5. Confusion Matrices Breakdown
    story.append(Paragraph("4. Held-Out Confusion Matrices & Diagnostic Error Counts", h1_style))
    cm_data = [
        [
            Paragraph("Language", table_header),
            Paragraph("True Negatives (TN)", table_header),
            Paragraph("False Positives (FP)", table_header),
            Paragraph("False Negatives (FN)", table_header),
            Paragraph("True Positives (TP)", table_header),
            Paragraph("Harmful Class Recall", table_header),
        ]
    ]

    for lang_name, _ in langs:
        r = reports_data.get(lang_name, {})
        cm = r.get("confusion_matrix", {})
        rec = r.get("metrics", {}).get("recall", 0.0)
        cm_data.append([
            Paragraph(lang_name, table_text),
            Paragraph(str(cm.get("true_negatives", "—")), table_text),
            Paragraph(str(cm.get("false_positives", "—")), table_text),
            Paragraph(str(cm.get("false_negatives", "—")), table_text),
            Paragraph(str(cm.get("true_positives", "—")), table_text),
            Paragraph(f"{rec*100:.1f}%" if isinstance(rec, (int, float)) else "—", table_text),
        ])

    cm_table = Table(cm_data, colWidths=[90, 85, 85, 85, 85, 90])
    cm_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#312e81")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(cm_table)
    story.append(Spacer(1, 14))

    # 6. Dataset Provenance & Governance
    story.append(Paragraph("5. Dataset Provenance, Governance & Licences", h1_style))
    prov_text = (
        "<b>English:</b> Jigsaw / Civil Comments Corpus (CC0 1.0 Public Domain Dedication).<br/>"
        "<b>Hindi:</b> HASOC / necrosyth Social Media Hostility Detection (Academic Research Licence).<br/>"
        "<b>Hinglish:</b> PRISM Multilingual Code-Mixed Hate Speech (Apache 2.0 / Academic).<br/>"
        "<b>Telugu:</b> IIIT-H Telugu Hate Speech + Interpersonal Generalization Corpus (CC-BY 4.0).<br/>"
        "<b>Kannada:</b> OffenseVal Dravidian (ACL / EACL Benchmark, CC-BY 4.0)."
    )
    story.append(Paragraph(prov_text, body_style))

    # 6. Social Media Comment Intelligence Architecture
    story.append(Paragraph("6. Real-Time Social Media Ingestion & Multi-Platform Intelligence", h1_style))
    social_text = (
        "CyberTech AI ingests real content through official developer APIs without web scraping:<br/>"
        "• <b>YouTube Data API v3:</b> Ingests public video comment threads and nested replies with parent-child linkage.<br/>"
        "• <b>Instagram Graph API:</b> Queries public post and reel comments and conversation reply threads.<br/>"
        "All ingested social comments are treated as real unlabelled production data, deduplicated by platform source ID, "
        "and analyzed through CyberTech AI's local scikit-learn multilingual models without external LLM data leakage."
    )
    story.append(Paragraph(social_text, body_style))
    story.append(Spacer(1, 10))

    # 7. Limitations & Recommendations
    story.append(Paragraph("7. Operational Boundaries & Moderator Guidelines", h1_style))
    limitations_text = (
        "1. <b>Model Confidence vs. Empirical Truth:</b> Model output probabilities reflect classifier activation "
        "relative to decision boundaries, not absolute certainty. Content flagged with scores near threshold requires human moderation.<br/>"
        "2. <b>Sarcasm and Indirect Harassment:</b> Un-transliterated code-switching and highly veiled figurative attacks "
        "can produce subdued TF-IDF signals; human verification is mandatory for escalated review states.<br/>"
        "3. <b>Zero Cloud LLM Guarantee:</b> Content moderation inference runs 100% locally on-device. Social connectors use official APIs purely for content retrieval."
    )
    story.append(Paragraph(limitations_text, body_style))

    # Build PDF document
    doc.build(story)
    return buffer.getvalue()
