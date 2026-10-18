# docs/SYSTEM_ARCHITECTURE.md
## Sentinel AI — System Architecture & Component Blueprint

```
+---------------------------------------------------------------+
|               Frontend: React + Vite + Tailwind               |
|  - Dashboard: Metrics, Donuts (Recharts), Queues              |
|  - Context Lab: Dual-window analysis & sample test cases      |
|  - Moderator Center: Case drawer, audit actions, CSV export   |
|  - Fairness / Dataset / Feedback / Overview views             |
+-------------------------------+-------------------------------+
                                |
                   REST API / JSON HTTP Calls
                                |
+-------------------------------v-------------------------------+
|                 Backend: FastAPI (Python 3.14)                |
|  - CORS & Rate Limiting                                       |
|  - Pydantic v2 validation models                              |
|  - Asynchronous SQLAlchemy engine                             |
+-------------------------------+-------------------------------+
                                |
        +-----------------------+-----------------------+
        |                                               |
+-------v-----------------------+       +---------------v---------------+
|        Database: SQLite       |       |       NLP Inference Engine    |
| - Moderation records          |       | - Lexical Pattern Matching    |
| - Human review audits         |       | - Script & Code-Mix Detector  |
| - Evaluation runs & Metrics   |       | - Context-window merger       |
| - Feedback & Error tracking   |       | - Severity Policy Module      |
+-------------------------------+       +-------------------------------+
```

### Key Technical Decisions
1. **Async Engine & Greenlet:** Uses `aiosqlite` with asynchronous sessions to prevent I/O blocking during high-volume comment streams.
2. **Deterministic Baseline:** The baseline engine clearly separates pattern score heuristics from calibrated probabilities, guaranteeing research transparency.
3. **Multi-label Taxonomy:** Comments can simultaneously carry scores for harassment, hate speech, and cyberbullying rather than forcing false mutually exclusive buckets.
