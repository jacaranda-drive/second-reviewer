# Key Operationalizations – Agent Calibration Guide

## The Core Problem the Agent Struggled With

**Agent confusion:** Seeing "LMIC + primary care + AI mentioned" but unable to distinguish:
- Actual implementation/deployment in practice
- vs. Algorithm development, feasibility studies, theoretical discussion

---

## CRITICAL OPERATIONALIZATIONS

### 1. "IMPLEMENTATION CONTEXT" – EXPLICIT DEFINITION

**DOES count as real-world implementation:**
- ✓ Study describes deployment in a functioning primary care clinic, health centre, or district health system
- ✓ Clinical outcomes, usage metrics, or adoption data are reported (even preliminary)
- ✓ Evidence that clinicians or patients actually used the AI tool in practice
- ✓ Multi-site implementation or scale-up across >1 facility
- ✓ Long-term follow-up or sustainability assessment
- ✓ Integration into existing workflows or decision-making processes

**DOES NOT count (exclude these):**
- ✗ Lab validation, in vitro testing, algorithm development papers
- ✗ Feasibility studies with <50 participants in controlled settings (unless outcomes reported)
- ✗ Single-site pilot with no clinical outcomes or usage data
- ✗ Simulation or modeling studies
- ✗ Proof-of-concept that hasn't moved to practice
- ✗ Papers mentioning "would be" or "could be" implemented (future tense without evidence)
- ✗ Papers on tool development without any mention of actual use

**Agent instruction:** If the abstract does NOT explicitly state:
- WHERE it was implemented (named facility/system)
- WHO used it (clinicians, patients, health workers)
- WHAT outcomes/data resulted (even preliminary)

→ Mark as **Uncertain or Exclude** ("No implementation context")

---

### 2. "RESPONSIBLE AI DIMENSION" – EXPLICIT DEFINITION

**DOES count (must include at least ONE):**
- ✓ Safety evaluation, adverse event monitoring, or risk assessment
- ✓ Bias detection, fairness analysis, or equity impact assessment
- ✓ Ethics review, informed consent, or privacy considerations
- ✓ Transparency, explainability, or model interpretability discussion
- ✓ Accountability mechanisms, governance structures, or regulatory frameworks
- ✓ User acceptance, health worker burden, or workflow integration challenges
- ✓ Equity for marginalised populations (e.g., rural areas, low-literacy users, non-English speakers)
- ✓ Data ownership, data sovereignty, or risk of digital colonialism
- ✓ Local adaptation, contextual fit, or cultural appropriateness

**DOES NOT count (exclude these):**
- ✗ Paper only describes clinical efficacy (sensitivity/specificity) with no governance/ethics discussion
- ✗ General discussion of "benefits and risks" without addressing responsible AI principles
- ✗ Paper assumes AI is neutral; no reflection on power asymmetries or equity implications
- ✗ Mentions "ethical AI" in title but doesn't substantively address any responsible AI dimension in content

**Agent instruction:** If the abstract mentions AI but does NOT discuss:
- Safety, ethics, bias, fairness, transparency, accountability, OR
- Governance, equity, inclusiveness, cultural fit, OR
- User acceptance, health worker perspectives, workflow integration

→ **Exclude** ("No responsible AI dimension")

---

### 3. "PRIMARY CARE SETTING" – BOUNDARY CLARIFICATIONS

**DOES count:**
- ✓ Primary health centre, clinic, health post, dispensary
- ✓ Community health worker outreach in community
- ✓ General practice, family medicine, first-contact care
- ✓ District hospital (first referral level) if primary care integration mentioned
- ✓ Telemedicine/remote care IF connecting primary care clinicians/patients

**DOES NOT count:**
- ✗ Hospital-based specialist units (even if adjacent to primary care)
- ✗ Laboratory services alone
- ✗ Pharmacy without clinical engagement
- ✗ Administrative health systems (no direct patient care)
- ✗ Public health surveillance without clinic-level implementation

**Agent instruction:** If the abstract mentions a health facility but doesn't clearly identify it as primary care:
→ Mark as **Uncertain** (human reviewer will check)

---

### 4. "LMIC DEFINITION" – GEOGRAPHIC CLARITY

**DOES count (examples):**
- ✓ Sub-Saharan Africa: Kenya, Tanzania, Uganda, Ghana, Nigeria, Sierra Leone, Ethiopia, Malawi, Zambia, Zimbabwe
- ✓ South Asia: India, Pakistan, Bangladesh, Nepal, Sri Lanka
- ✓ Southeast Asia: Vietnam, Indonesia, Philippines, Myanmar, Cambodia, Laos, Thailand (Thailand is borderline)
- ✓ Latin America: Brazil, Mexico, Peru, Colombia, Bolivia, Ecuador
- ✓ Middle East/North Africa: Egypt, Morocco, Tunisia
- ✓ Central Asia: Tajikistan, Kyrgyzstan, Uzbekistan

**DOES NOT count:**
- ✗ High-income countries: USA, Canada, Australia, NZ, Western Europe, Japan, South Korea
- ✗ Upper-middle-income that are OECD members (some debate here — see protocol)
- ✗ International/diaspora populations without LMIC implementation

**Agent instruction:** If the paper mentions multiple countries, **include if at least one is LMIC** (unless focus is clearly on high-income site)

---

### 5. "RESPONSIBLE AI" vs "CLINICAL EFFICACY" – THE CRITICAL DISTINCTION

Many papers report on AI for health in LMICs but focus ONLY on clinical outcomes (sensitivity, specificity, accuracy).

**This is NOT enough if:**
- No discussion of governance, ethics, safety frameworks, equity considerations

**Example of EXCLUDE:**
- Title: "Deep learning for tuberculosis diagnosis in rural India"
- Content: Reports diagnostic accuracy of algorithm; no mention of implementation context, ethical approval, or equity considerations
- Decision: **EXCLUDE** ("No responsible AI dimension")

**Example of INCLUDE:**
- Title: "Implementing TB diagnosis support in rural India: A community-centred approach with equity focus"
- Content: Describes actual deployment in 5 clinics, discusses bias in training data, addresses health worker acceptance, reports clinical outcomes
- Decision: **INCLUDE** (all criteria met)

---

## AGENT CALIBRATION CHECKLIST

Before running agent on full 1,221, test on 50 random records and ask:

- [ ] Is agent correctly identifying papers WITHOUT implementation context as Exclude? (Should be ~high sensitivity)
- [ ] Is agent correctly flagging papers WITHOUT responsible AI discussion as Exclude?
- [ ] Is agent marking borderline cases (weak implementation data, vague responsible AI) as Uncertain?
- [ ] Is agent confident on clear Excludes (e.g., "algorithm development only" → 0.90+ confidence Exclude)?
- [ ] Is agreement with human reviewer on implementation context >80%?
- [ ] Is agreement on responsible AI dimension presence >75%?

If not: Refine prompt further before full run.

---

## EXPECTED OUTCOME

With these clarifications, agent should:
- Reduce "Uncertain" from ~354 to ~100–150 (more decisive)
- Increase agreement with human on implementation context (κ > 0.65)
- Clearly distinguish feasibility studies from real-world deployments
- Enforce responsible AI dimension as a hard filter
