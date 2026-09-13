"""
Eligibility criteria for the scoping review:
"Implementing responsible AI in LMIC primary care"
PCC framework (Population, Concept, Context)
"""

POPULATION = (
    "Adults and/or children receiving or seeking primary healthcare services in "
    "low- and middle-income countries (LMICs), as defined by the World Bank income "
    "classification. This includes patients, caregivers, community health workers, "
    "and primary care providers."
)

CONCEPT = (
    "Implementation of artificial intelligence (AI) or machine learning (ML) tools, "
    "systems, or interventions in primary care settings. AI/ML includes but is not "
    "limited to: machine learning models, deep learning, neural networks, natural language "
    "processing tools, computer vision for diagnostics, predictive analytics, and "
    "generative AI applications. "
    "IMPORTANT: Clinical decision support systems (CDSS) only qualify if they use ML/AI "
    "techniques — rule-based systems, electronic forms, structured checklists, or "
    "hand-coded clinical algorithms do NOT qualify as AI/ML, even if computerised. "
    "Responsible AI refers to AI that addresses fairness, accountability, transparency, "
    "explainability, safety, privacy, and/or equity considerations."
)

CONTEXT = (
    "Primary care settings in LMICs, including community health centres, rural/urban "
    "primary health facilities, community health worker programmes, and telemedicine "
    "platforms serving primary care populations in LMICs."
)

INCLUSION_CRITERIA = [
    "Population is in LMICs (World Bank definition: low, lower-middle, or upper-middle income)",
    "Setting is primary care (first point of contact health services, community health)",
    "Involves AI or ML technology implementation, deployment, or evaluation",
    "Addresses at least one dimension of responsible AI (fairness, safety, transparency, accountability, privacy, equity, explainability)",
    "Empirical study, grey literature report, policy document, or framework describing implementation or lessons learned",
    "Published or produced from 2015 onwards (AI in health has grown rapidly since then)",
]

EXCLUSION_CRITERIA = [
    "Population exclusively in high-income countries (HIC) with no LMIC component",
    "Setting is exclusively secondary or tertiary care with no primary care component",
    "AI/ML not actually implemented — purely theoretical or computational modelling only",
    "Tool is a rule-based system, electronic form, structured checklist, or hand-coded clinical algorithm — not AI/ML",
    "No engagement with responsible AI dimensions (purely technical performance papers with no equity/ethics/safety discussion)",
    "Conference abstracts, editorials, or letters with no substantive data or methodology",
    "Published before 2015",
    "Not available in English (or English translation unavailable)",
    "Duplicate record (identical study reported elsewhere in the corpus)",
]

GREY_LITERATURE_APPRAISAL = {
    "credible_traceable": (
        "Source is credible, traceable, and attributable to an identifiable organisation or author. "
        "Must be a formally released document (not a draft, landing page, or pending publication) "
        "that can be independently retrieved and verified."
    ),
    "directly_relevant": (
        "Content substantively engages with responsible AI implementation, governance, or equity "
        "in primary care or health system contexts. Documents mentioning AI only in passing, "
        "or focused exclusively on non-health AI, fail this criterion."
    ),
    "additive": (
        "Source provides substantive insight not adequately captured by the academic literature "
        "already in the corpus, or by other already-included grey literature sources. "
        "Brochures, landing pages, or companion documents that duplicate primary included sources fail."
    ),
}

PHASE_DESCRIPTIONS = {
    1: "Title and abstract screening",
    2: "Full-text screening",
    3: "Grey literature appraisal",
}
