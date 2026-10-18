# docs/DEMO_SCRIPT.md
## Sentinel AI — Demonstration & Evaluator Script

This script provides step-by-step instructions to showcase the core research contributions of Sentinel AI during a viva or project evaluation.

### Flow 1: Command Center Overview
1. Start the app and open `http://localhost:5173`.
2. Observe the **Sentinel AI Shield brand**, dark cyber-intelligence layout, and **Model Status** pill (*baseline v1.0.0*).
3. Review the **4 Metric Cards**: Total Analyzed, Flagged Comments, Pending Review, and High Priority.
4. Inspect the **3 Distribution Panels**: Donut charts displaying real Severity, Category, and Language proportions.
5. Note the **Review Queue** and **Model Performance strip** indicating honest metric statuses.

### Flow 2: Testing Legitimate Disagreement (Key Research Test)
1. Navigate to **Context Intelligence Lab** (`/context-lab`).
2. Click the sample scenario: *"Legitimate Disagreement (MUST NOT be flagged)"*.
   - Text: *"I disagree with your opinion, and here is why — the data doesn't support your conclusion."*
3. Click **Analyze**.
4. Observe the result:
   - Severity: **Low**
   - Decision: **No Action**
   - Classification: **Legitimate score dominates (>80%)**
   - Verifies the system does not confuse academic criticism or disagreement with hate speech.

### Flow 3: Context Comparison Studio
1. In the Context Lab, switch to **Compare Context** mode.
2. Enter comment: *"I hate this!"*
3. Enter context before: *"Did you see the game last night? That referee decision was awful."*
4. Click **Compare Context**.
5. Observe dual inference panels:
   - Evaluates the message with and without the conversation window.
   - Highlights that sport frustration changes contextual harm severity.

### Flow 4: Multilingual & Code-Mixed Stress Test
1. Load example: *"మీ పని చాలా బాగుంది! Keep up the great work bhai."*
2. Analyze and verify:
   - Detected Language: **Telugu / Code-mixed**
   - Correctly recognized as non-harmful commendation despite non-English vocabulary markers.

### Flow 5: Human-in-the-Loop Override & Audit
1. Navigate to **Moderator Command Center** (`/moderation`).
2. Click **Review** on a pending case to open the side review drawer.
3. Select decision: **Dismiss / False Pos** or **Escalate Harm**.
4. Fill out the **Override / Decision Rationale** and submit.
5. Check the updated status in the table and verify that the feedback event is recorded in **Feedback & Error Analysis** (`/feedback`).
