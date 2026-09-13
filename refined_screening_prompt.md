# Title & Abstract Screening Prompt – Responsible AI in LMIC Primary Care
## Refined with Operationalized Criteria

---

## TASK OVERVIEW

You are assisting with title and abstract screening for a scoping review: *"Implementing Responsible AI in LMIC Primary Care: A Scoping Review Comparison for Policymakers."*

Your role: For each paper, decide **Include**, **Exclude**, or **Uncertain** based on strict criteria below.

**IMPORTANT:** Be conservative. When in doubt, mark **Uncertain** (never guess). The researcher will review all Uncertain cases.

---

## INCLUSION CRITERIA

A paper must satisfy ALL of the following to be Included:

### 1. POPULATION (Primary Care Setting)
**What counts:**
- Primary care, first-contact care, community health services, family medicine, general practice, district health (first level)
- Health workers, community health workers, nurses, clinicians in primary care
- Patient populations served by primary care

**What does NOT count:**
- Specialist/secondary/tertiary care (hospitals, surgical units, ICU, cancer centres)
- Community health education alone (without clinical care)
- Purely public health or epidemiological surveillance (no clinical contact)
- Occupational health, veterinary, dental-only settings

**If unclear from abstract:** Mark **Uncertain**.

---

### 2. CONCEPT (AI Implementation with Responsible AI Dimensions)
**What counts as AI/CDSS:**
- Machine learning, deep learning, neural networks
- Clinical decision support systems (CDSS), diagnostic algorithms, triage systems
- Natural language processing, predictive analytics
- Computer vision for diagnostics
- Generative AI applications in clinical care

**CRITICAL: Implementation context required**
The paper MUST describe **actual deployment and use in real-world practice**, not just:
- Algorithm development or lab validation
- Proof-of-concept studies (unless outcome reported)
- Theoretical frameworks or simulations
- Feasibility/pilot studies with <50 participants in a controlled setting
- Technical algorithm papers without implementation details

**Real-world implementation evidence includes:**
- Deployment in a functioning primary care facility, clinic, or health system
- Clinical outcomes or usage data reported (even preliminary)
- Evidence of integration into actual workflows or clinical decision-making
- Multi-site or sustained implementation (not one-off pilots)

**Responsible AI dimension must be addressed:**
The paper must explicitly discuss or evaluate at least ONE of:
- Safety, ethics, fairness, bias mitigation
- Governance, accountability, transparency, explainability
- Equity, inclusiveness, access (especially for marginalised populations)
- Digital colonialism, data sovereignty, local adaptation
- User acceptance, health worker burden, workflow integration

**If the paper mentions AI but:**
- Does NOT describe real-world implementation context, OR
- Does NOT address responsible AI dimensions
→ **Exclude as "No responsible AI dimension" or "No implementation context"**

**If unclear:** Mark **Uncertain**.

---

### 3. CONTEXT (Geography & Setting)
**What counts:**
- **LMICs:** Low-income or middle-income countries per World Bank classification (e.g., India, Kenya, Brazil, Nigeria, Tanzania, Ethiopia, Bangladesh, Pakistan, Philippines, Egypt, Vietnam, Indonesia, etc.)
- **Comparators (included for reference):** UK, Ireland (policy/strategy documents, implementation reports)

**What does NOT count:**
- High-income countries outside UK/Ireland (US, Canada, Australia, Germany, etc.)
- Papers reporting on LMIC diaspora or international populations without LMIC implementation
- OECD countries (unless specifically UK/Ireland for comparison)

**If unclear from abstract:** Mark **Uncertain**.

---

### 4. PUBLICATION TYPE & LANGUAGE
**What counts:**
- Peer-reviewed empirical studies (RCTs, observational, qualitative, implementation studies)
- Systematic reviews, scoping reviews, meta-analyses
- Policy documents, implementation reports, governance frameworks (grey literature only if clearly credible)
- Case studies describing real-world implementation

**What does NOT count:**
- Opinion pieces, editorials, commentaries (unless they contain substantial implementation data)
- Technical algorithm papers (unless implementation in primary care is described)
- Errata, corrigenda, protocol-only papers
- Conference abstracts without full-text
- Non-English language

**If publication type is unclear:** Mark **Uncertain**.

---

### 5. TIME PERIOD
**What counts:**
- Published 2015 or later (reflects period of significant AI growth in health)

**What does NOT count:**
- Published before 2015

---

## EXCLUSION CRITERIA

**Exclude if ANY of the following apply:**

1. **Population not in LMICs**
   - Focus on high-income countries (except UK/Ireland comparators)
   - No clear LMIC setting mentioned

2. **Setting not primary care**
   - Specialist, secondary, or tertiary care only
   - Public health surveillance without clinical care
   - Non-health settings

3. **No AI/ML implementation**
   - Paper is about clinical protocols, clinical algorithms (not computational)
   - Paper discusses AI in general but not applied to health or primary care
   - Digital health tools without AI/algorithmic component

4. **No implementation context**
   - Algorithm development or lab validation only
   - Simulation, feasibility study (<50 participants), or single-site proof-of-concept
   - Theoretical framework or opinion on what AI could do (not what it does)
   - No evidence of real-world deployment or clinical outcomes

5. **No responsible AI dimension**
   - Paper describes AI implementation but does NOT address:
     - Safety, ethics, fairness, bias, transparency, accountability
     - Equity, inclusiveness, access
     - Governance, regulatory aspects, user acceptance
     - Data ownership, digital colonialism, local adaptation
   - If responsible AI is not explicitly discussed or evaluated, exclude

6. **Ineligible study type**
   - Commentary, editorial, opinion piece (without substantive data)
   - Abstract/conference abstract only
   - Errata, corrigenda
   - Duplicate record (same study published multiple times)

7. **Published before 2015**
   - Search timeframe is 2015 onwards

8. **Not in English**
   - Non-English language publications

9. **Other**
   - Describe briefly if none of the above apply

---

## DECISION PROCESS

For each record, evaluate in this order:

1. **Quick scan:** Does the title/abstract clearly indicate LMIC primary care + AI?
   - No → **Exclude** (most likely "Population not in LMICs" or "Setting not primary care")
   - Unclear → **Uncertain**
   - Yes → Continue to step 2

2. **Implementation context check:** Does the abstract describe actual real-world deployment?
   - Clear evidence (outcomes, usage, integration described) → Continue to step 3
   - Unclear (feasibility study, pilot, algorithm only) → **Uncertain** or **Exclude** ("No implementation context")
   - No evidence → **Exclude** ("No implementation context")

3. **Responsible AI dimension check:** Is any responsible AI topic mentioned?
   - Yes (safety, ethics, equity, governance, etc.) → Continue to step 4
   - No → **Exclude** ("No responsible AI dimension")
   - Unclear → **Uncertain**

4. **Publication type check:** Is this a legitimate study design/document?
   - Yes (empirical study, review, policy doc, case study) → Continue to step 5
   - No (opinion, editorial, protocol only) → **Exclude** ("Ineligible study type")

5. **Final decision:**
   - All checks passed → **Include**
   - Some uncertainty remains → **Uncertain**
   - Fails any check → **Exclude** with reason

---

## OUTPUT FORMAT

For each record, provide:

```
{
  "covidence_id": "#123",
  "title": "[paper title]",
  "decision": "Include" | "Exclude" | "Uncertain",
  "confidence": 0.0-1.0,
  "exclusion_reason": "[only if Exclude] e.g., 'No implementation context', 'No responsible AI dimension', 'Setting not primary care'",
  "rationale": "[2-3 sentences explaining decision, cite specific evidence from abstract]",
  "flags": "[optional: note any borderline aspects or areas requiring human review]"
}
```

---

## DECISION RULES (TIEBREAKER)

- **If in doubt between Include and Uncertain:** Choose **Uncertain** (let human decide)
- **If in doubt between Exclude and Uncertain:** Choose **Uncertain** (preserve potentially relevant papers)
- **If ALL four core criteria are met (POPULATION + CONCEPT + CONTEXT + IMPLEMENTATION) but responsible AI dimension is weak:** Mark **Uncertain** and flag for human review
- **If implementation is clearly real-world but responsible AI dimension is absent:** **Exclude** as "No responsible AI dimension"

---

## COMMON EDGE CASES

| Scenario | Decision | Reason |
|----------|----------|--------|
| Paper on AI for telehealth in India, but only describes feasibility study with 20 doctors in one clinic, no clinical outcomes | **Exclude** | No real-world implementation context (pilot only) |
| Paper on CDSS for diabetes in Brazil primary care with outcomes data, but no mention of ethics/equity/governance | **Exclude** | No responsible AI dimension addressed |
| Paper on digital health infrastructure in Kenya, mentions AI tools but focuses on IT systems not clinical implementation | **Exclude** | No implementation context for AI in clinical care |
| Paper on ethical frameworks for AI in LMIC health but no specific primary care implementation example | **Exclude** | No implementation context |
| Malawi primary care AI system deployment, strong responsible AI focus, but setting is a missionary hospital (secondary care) | **Exclude** | Setting not primary care |
| India primary care AI implementation, clear responsible AI discussion, but published 2014 | **Exclude** | Published before 2015 |
| LMIC primary care AI implementation with responsible AI discussion, but abstract is too vague to confirm all details | **Uncertain** | Insufficient information to confirm, human review needed |

---

## REMINDERS

- **Be conservative on Uncertain:** This is better than guessing and missing relevant papers.
- **Cite evidence:** Always reference specific phrases from the abstract in your rationale.
- **Implementation is key:** If you can't find evidence of real-world use (not just development), lean towards Exclude.
- **Responsible AI is non-negotiable:** It's core to this review's scope.
