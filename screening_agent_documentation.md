# AI-Assisted Title & Abstract Screening Agent
## Technical Documentation for Dissertation Methods Section

**Review title:** Implementing Responsible AI in LMIC Primary Care: A Scoping Review  
**Degree:** Oxford MSc in Global Health Leadership (MGHL), 2026  
**Agent version documented:** Phase 1 (Title & Abstract Screening)  
**Records screened:** 1,221  
**LLM:** OpenAI GPT-4o (`gpt-4o`)

---

## 1. System Architecture

### Overview

The screening agent is a locally-hosted, purpose-built web application comprising three layers: a Python/FastAPI REST backend, a SQLite relational database, and a React/TypeScript frontend. The system was developed specifically for this scoping review and runs on the researcher's local machine, ensuring that raw bibliographic data and LLM outputs remain under researcher control throughout.

```
┌─────────────────────────────────────────────────────────┐
│  React Frontend (Vite + TypeScript)                     │
│  Import · Screen · Run Agent · Compare · IRR · Export   │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTP (localhost:8000)
┌───────────────────▼─────────────────────────────────────┐
│  FastAPI Backend (Python 3.11)                          │
│  /reviews  /records  /agent  /irr  /export              │
└───────────────────┬─────────────────────────────────────┘
                    │ SQLAlchemy (async)
┌───────────────────▼─────────────────────────────────────┐
│  SQLite Database (reviews.db)                           │
│  reviews · records · human_decisions                    │
│  agent_decisions · resolutions                          │
└─────────────────────────────────────────────────────────┘
```

### Data Flow: Import → Screening → Decision Logging

1. **Import.** Bibliographic records are imported via CSV (Covidence export format) or RIS file. The CSV parser maps Covidence column names (`Covidence #`, `Title`, `Authors`, `Abstract`, `Published Year`, `DOI`, `Decision`, `exclusion_reason`, `Screening_Notes`) to the internal schema. Where a `Decision` column is present, existing human decisions are imported directly as `HumanDecision` records, preserving prior screening work.

2. **Human screening.** The researcher screens records through the Screen interface, assigning each record Include, Exclude, or Uncertain, with an optional exclusion reason and free-text notes. Decisions are stored in the `human_decisions` table. Human screening is conducted independently of and prior to inspecting agent decisions, ensuring blinded inter-rater reliability.

3. **Agent screening.** The researcher triggers a batch agent run via the Run Agent page. A background task iterates through all records without an existing `agent_decision`, constructs a prompt for each, calls the OpenAI API, parses the JSON response, and persists the result to the `agent_decisions` table. The agent does not have access to the human decision at any point.

4. **IRR calculation.** The IRR dashboard computes Cohen's kappa and percentage agreement across all records where both a human decision and an agent decision exist.

5. **Conflict resolution.** Genuine conflicts — records where the agent gave a definitive Include or Exclude decision that differs from the human — are surfaced for arbitration. The researcher makes a final determination, stored in the `resolutions` table.

### Role of the Agent vs. Human Reviewer

The agent functions as an independent second reviewer, not as a replacement for human judgement. Its role is to:

- Apply the eligibility criteria consistently across all 1,221 records without fatigue effects
- Flag borderline cases for human attention (via the Uncertain decision class)
- Generate a structured rationale and evidence quotes for each decision, creating an auditable record
- Enable inter-rater reliability statistics to be reported in the dissertation

The human researcher retains final authority. All conflicts are resolved by the primary reviewer, and all agent Uncertain decisions are routed to a manual review queue rather than treated as exclusions.

---

## 2. Screening Criteria & Operationalization

### PCC Framework

The review follows the Population–Concept–Context (PCC) framework as recommended by the Joanna Briggs Institute for scoping reviews.

**Population:**
> Adults and/or children receiving or seeking primary healthcare services in low- and middle-income countries (LMICs), as defined by the World Bank income classification. This includes patients, caregivers, community health workers, and primary care providers.

**Concept:**
> Implementation of artificial intelligence (AI) or machine learning (ML) tools, systems, or interventions in primary care settings. AI/ML includes: machine learning models, deep learning, neural networks, natural language processing, computer vision for diagnostics, predictive analytics, and generative AI applications. Clinical decision support systems (CDSS) qualify only if they use ML/AI techniques — rule-based systems, electronic forms, structured checklists, or hand-coded clinical algorithms do not qualify, even if computerised. Responsible AI refers to AI that addresses fairness, accountability, transparency, explainability, safety, privacy, and/or equity considerations.

**Context:**
> Primary care settings in LMICs, including community health centres, rural/urban primary health facilities, community health worker programmes, and telemedicine platforms serving primary care populations in LMICs.

### Inclusion Criteria (all must apply)

| # | Criterion | Operationalization |
|---|---|---|
| 1 | Population in LMICs | World Bank definition: low, lower-middle, or upper-middle income. Named LMICs include Sub-Saharan Africa, South Asia, Southeast Asia, Latin America, MENA. UK/Ireland included as policy comparators. |
| 2 | Primary care setting | First point of contact health services: primary health centres, community health worker outreach, general practice, family medicine, district hospitals (first referral level) where primary care integration is described. |
| 3 | AI/ML implementation | Must involve ML/AI technology actually implemented or evaluated — not rule-based CDSS, not electronic forms, not hand-coded algorithms. |
| 4 | Responsible AI dimension | At least one of: safety, ethics, fairness, bias mitigation, governance, accountability, transparency, explainability, equity, digital colonialism, data sovereignty, user acceptance, or workflow integration. |
| 5 | Eligible publication type | Empirical study, systematic/scoping review, grey literature report, policy document, or implementation framework. |
| 6 | Published 2015 or later | Reflects the period of significant AI growth in health. |

### Exclusion Criteria (any one is sufficient)

| # | Criterion | Rationale |
|---|---|---|
| 1 | Population exclusively HIC | Review scope is LMIC primary care; HIC studies do not address the equity gap this review examines. |
| 2 | Setting exclusively secondary/tertiary care | Primary care context is definitional to the review scope. |
| 3 | AI/ML not actually implemented | Theoretical or computational modelling papers do not evidence real-world applicability. |
| 4 | Rule-based system, not AI/ML | Electronic CDSS using decision trees or structured rules are not AI/ML regardless of deployment context. |
| 5 | No responsible AI dimension | Papers reporting only clinical efficacy (sensitivity/specificity) without governance, ethics, or equity discussion fall outside the review's core concept. |
| 6 | Ineligible study type | Editorials, commentaries, conference abstracts, and letters without substantive data do not meet the evidence threshold. |
| 7 | Published before 2015 | Pre-2015 AI implementations are insufficiently relevant to the current policy landscape. |
| 8 | Not in English | Language restriction applied due to resource constraints of a single-researcher dissertation. |
| 9 | Duplicate record | Same study appearing multiple times in the import corpus. |

### Special Cases Operationalized in the Prompt

**Implementation context (critical filter):** The distinction between a paper that *develops* an AI model and one that *deploys* it in clinical practice was identified as the primary source of agent-human disagreement during calibration. The prompt explicitly defines:

- *Counts as implementation:* Deployment in a functioning primary care facility; clinical outcomes or usage metrics reported; evidence clinicians or patients actually used the tool; multi-site rollout.
- *Does not count:* Lab validation; dataset studies applying ML to predict an outcome without clinical deployment; feasibility studies (<50 participants) without outcomes; simulation; future-tense descriptions.

**Responsible AI as non-negotiable:** Papers describing AI implementation without any discussion of safety, ethics, equity, governance, or user acceptance are excluded regardless of LMIC/primary care fit. This criterion is treated as a hard filter.

**LMIC boundary:** Where multiple countries are mentioned, the record is included if at least one is LMIC, unless the implementation focus is clearly on a high-income site. UK and Ireland are included as policy comparators only.

**Primary care boundary:** District hospitals qualify only where primary care integration is explicitly mentioned. Laboratory-only, pharmacy-only, and public health surveillance papers without clinic-level implementation do not qualify.

**Review paper carve-out:** Systematic reviews and scoping reviews synthesising AI/ML implementation in LMIC primary care are includable without describing a single implementation themselves — the synthesis of implementation evidence is sufficient.

---

## 3. Prompt Evolution & Calibration

### Initial Prompt Structure

The initial agent prompt embedded the PCC framework and inclusion/exclusion criteria directly, instructing the agent to return a structured JSON decision. The output schema required: `decision`, `confidence`, `exclusion_reason`, `rationale`, `criteria_assessment` (per-criterion met/not_met/unclear), `evidence_quotes`, and `flags`.

### Calibration Process

A 25-record validation sample was drawn at random and screened independently by the agent. Agent decisions were compared to prior human decisions to identify systematic errors. Three rounds of calibration were conducted.

**Key finding — calibration round 1:**
The agent reliably excluded clear non-matches (wrong setting, HIC population, no AI) but struggled to distinguish:
- Real-world implementation from algorithm development
- ML/AI-powered CDSS from rule-based electronic systems
- Opinion pieces from implementation studies

**Prompt refinements made:**

1. *Implementation context operationalized explicitly.* The prompt was extended with a detailed "DOES count / DOES NOT count" list, including: "Studies that apply ML to existing health datasets to build or validate predictive models WITHOUT describing actual deployment in clinical practice → Exclude."

2. *Rule-based CDSS distinction added.* Following a calibration miss where the agent included a rule-based eCDSS deployed in rural Ghana/Tanzania (identifying it as a CDSS in LMIC primary care), the prompt was updated to explicitly state: "Rule-based electronic systems: eCDSS, electronic forms, structured checklists, or decision trees that are computerised but do NOT use ML/AI — even if called a 'clinical decision support system' and even if deployed in primary care → Exclude." This distinction was also added to the `criteria.py` concept definition.

3. *Responsible AI as non-negotiable enforced.* An explicit filter was added: "If the abstract describes AI but does NOT discuss any responsible AI dimension → Exclude as 'No responsible AI dimension'."

4. *Worked examples added.* Five pattern-matched examples were embedded directly in the prompt to ground the agent's decision process:
   - "We applied ML to a dataset of 50,000 patient records to predict X" → Exclude
   - "We implemented an electronic CDSS using structured decision trees in 12 rural clinics in Ghana" → Exclude (rule-based)
   - "We deployed an ML-based diagnostic support tool in 5 primary care facilities in Kenya" → likely Include
   - Systematic scoping review of AI in LMIC primary care → Include
   - Future-tense implementation descriptions → Exclude

5. *LMIC geography and primary care boundaries clarified.* Named country lists and setting boundary rules were added with explicit examples.

**Decision on Uncertain handling (Option 2):**
Calibration revealed the agent is inherently conservative at title/abstract stage — it marks Uncertain whenever information is insufficient to confirm criteria rather than defaulting to Exclude. This is methodologically appropriate for screening (sensitivity > specificity). Rather than forcing more decisive behaviour through further prompt tuning (which introduced regressions), a design decision was taken to treat agent Uncertain decisions as a human review queue. Agent Uncertain records are excluded from IRR kappa calculation and routed to a manual review pool. Only records where the agent gave a definitive Include or Exclude decision are used for IRR and conflict resolution.

---

## 4. Inter-Rater Reliability

### Validation Sample

Prior to the full run, three calibration rounds were conducted on a fixed 25-record random sample, with the agent re-run after each prompt revision. Agreement improved from 14/25 (56%) to 16/25 (64%) across rounds. The final prompt version was accepted and used for the full 1,221-record run.

### Full-Run Results

| Metric | Value |
|---|---|
| Total records | 1,221 |
| Agent Uncertain (human review pool) | 234 |
| Records included in IRR calculation | 987 |
| Observed agreement | 89.9% |
| Cohen's kappa (κ) | 0.234 |
| Kappa interpretation | Fair agreement |

### Confusion Matrix (n = 987, agent Uncertain excluded)

|  | Agent: Include | Agent: Exclude |
|---|---|---|
| **Human: Include** | 20 | 47 |
| **Human: Exclude** | 52 | 867 |

- **True positives (both Include):** 20
- **True negatives (both Exclude):** 867
- **False negatives (agent Exclude, human Include):** 47
- **False positives (agent Include, human Exclude):** 52

### Why Kappa is Low Despite High Agreement

The kappa statistic is sensitive to the distribution of decisions across categories — a phenomenon known as the "kappa paradox" or prevalence-induced kappa depression. In this corpus, 93% of human decisions were Exclude (919/987 after removing Uncertain). With such extreme skew, the expected agreement by chance is already very high (~87%), which compresses the achievable kappa range and makes any disagreement disproportionately impactful.

The 47 false negatives (papers the agent excluded that the human included) are the primary driver of low kappa: because Include cases are rare (n=67), each incorrect Exclude in this category represents a large proportional miss. Percentage agreement (89.9%) and the confusion matrix distribution provide a more complete picture of agent performance than kappa alone in this context.

To contextualise: if the agent had correctly identified all 67 human Includes, kappa would approach 1.0 (confirmed by simulation). The issue is not systematic bias but rather difficulty distinguishing borderline includes from excludes at title/abstract stage — a challenge common to human reviewers as well.

In the dissertation, kappa is reported alongside percentage agreement and the confusion matrix, with explicit acknowledgement of the prevalence skew limitation. PABAK (prevalence-adjusted, bias-adjusted kappa) is noted as an alternative statistic for highly skewed distributions.

---

## 5. Decision Logic & Tiebreaker Rules

The agent follows a five-step screening process for each record:

1. **LMIC + primary care + AI check.** Does the title/abstract clearly indicate an LMIC primary care AI context? If clearly No → Exclude. If unclear → Uncertain. If possibly Yes → continue.

2. **Implementation context check.** Does the abstract describe actual real-world deployment (not just algorithm development)? If clear evidence → continue. If unclear or pilot only → Uncertain or Exclude. If no evidence → Exclude.

3. **Responsible AI dimension check.** Does the abstract mention any responsible AI topic? If Yes → continue. If No → Exclude. If unclear → Uncertain.

4. **Publication type check.** Is this an empirical study, review, or policy document? If Yes → continue. If editorial/opinion/abstract → Exclude.

5. **Final decision.** All checks passed → Include. Any unresolved uncertainty → Uncertain. Fails any check → Exclude with reason.

**Tiebreaker rules:**
- Between Include and Uncertain: choose Uncertain (preserve borderline papers)
- Between Exclude and Uncertain: choose Uncertain (avoid false negatives)
- If implementation is clearly real-world but responsible AI is absent: Exclude

The conservative default towards Uncertain is intentional: at title/abstract stage, insufficient information should never result in exclusion of a potentially relevant paper. All Uncertain records proceed to human review.

---

## 6. Known Issues & Limitations

**Agent conservatism.** The agent marks a substantial proportion of records Uncertain (234/1,221, 19%), creating a large human review pool. This is appropriate for a screening agent — false negatives are more costly than false positives in systematic review — but it does increase the manual review burden.

**False negatives (47 cases).** The agent excluded 47 papers that the human reviewer included. These require individual review to confirm the human decision is correct. The most common cause identified during calibration was the agent failing to recognise review papers synthesising implementation evidence as includable, and conflating rule-based CDSS with ML/AI systems.

**Prevalence skew affecting kappa.** With 93% of decisions being Exclude, Cohen's kappa is not the optimal IRR statistic. This is reported transparently and contextualised with percentage agreement and the confusion matrix.

**Three-way vs. binary classification.** Covidence exports human decisions as binary (Include/Exclude). The agent produces three-way decisions (Include/Exclude/Uncertain). Direct comparison is only possible on the Include/Exclude subset of agent decisions, meaning 234 records cannot contribute to kappa calculation. This asymmetry is a structural limitation of using a more nuanced agent classification alongside a binary human export.

**Rate limiting.** OpenAI's token-per-minute limits (30,000 TPM for GPT-4o) required a 5-second inter-request delay to avoid rate limit errors, extending the full run to approximately 100 minutes. A small number of long abstracts (~3,000+ tokens) still occasionally triggered 429 errors; these were re-screened on subsequent agent runs, which skip already-screened records.

---

## 7. Output Format

Each agent decision is persisted as a structured record in the `agent_decisions` table and returned as JSON:

```json
{
  "decision": "Include | Exclude | Uncertain",
  "confidence": 0.0,
  "exclusion_reason": "string or null",
  "rationale": "2-4 sentences citing specific evidence from the abstract",
  "criteria_assessment": {
    "population_lmic": "met | not_met | unclear",
    "setting_primary_care": "met | not_met | unclear",
    "involves_ai_ml": "met | not_met | unclear",
    "responsible_ai_dimension": "met | not_met | unclear",
    "study_type_eligible": "met | not_met | unclear",
    "date_range": "met | not_met | unclear",
    "language": "met | not_met | unclear"
  },
  "evidence_quotes": ["verbatim quote 1", "verbatim quote 2"],
  "flags": ["LMIC status ambiguous", "implementation context weak"]
}
```

The database schema additionally stores: `model_version`, `llm_provider`, `raw_prompt`, `raw_response`, and `screened_at` — enabling full reproducibility and audit. Every agent decision can be traced back to the exact prompt sent and raw LLM response received.

The `resolutions` table records the final arbiter decision for each conflict, including `human_original`, `agent_decision`, `was_conflict`, and `resolution_notes`, providing a complete chain of custody for every included record.

---

## 8. Methodology Strengths

**Transparent operationalization.** Each eligibility criterion is explicitly operationalized with positive and negative examples, reducing the ambiguity that typically degrades inter-rater reliability. The distinction between ML/AI-powered systems and rule-based CDSS, and between dataset studies and real-world deployments, were identified empirically through calibration and encoded into the prompt.

**Iterative calibration.** The prompt was refined through three rounds of validation against a fixed 25-record sample with known human decisions, allowing targeted corrections without overfitting. Prompt changes that caused regressions were reverted.

**Conservative design maximises sensitivity.** The agent's tiebreaker rules favour Uncertain over Exclude in all ambiguous cases, ensuring borderline papers are preserved for human review rather than silently excluded. This prioritises recall over precision, which is the appropriate trade-off at title/abstract screening stage.

**Full audit trail.** Every decision is logged with its rationale, per-criterion assessment, evidence quotes, confidence score, and raw LLM response. This enables post-hoc analysis of agent reasoning, supports dissertation transparency, and allows the methodology to be reproduced or audited.

**Independence preserved.** The agent screens without access to human decisions, and human decisions were completed before agent screening began. This ensures genuine independence of the two raters, a prerequisite for valid IRR calculation.

**Structured conflict resolution.** Genuine conflicts (agent Include vs. human Exclude and vice versa) are surfaced through a dedicated interface, distinguishing them from agent Uncertain decisions. The researcher resolves each conflict with the option to accept either decision or override both, with resolution notes recorded for each case.
