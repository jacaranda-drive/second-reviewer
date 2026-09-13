# Prompt for Claude Code: Build PRISMA-ScR Live Dashboard Tab

## Task

Add a new "PRISMA Dashboard" tab to the screening agent frontend (React) that displays an interactive PRISMA-ScR flow diagram. The diagram should:

1. **Query SQLite database in real-time** to fetch current screening counts
2. **Render as interactive SVG** with expandable nodes
3. **Update live** as screening progresses
4. **Allow download** as HTML or SVG for dissertation inclusion

---

## Data Schema & Queries Required

Query the following from `reviews.db`:

```sql
-- T/A Screening counts
SELECT COUNT(*) FROM records WHERE phase = 1;  -- Total records screened
SELECT COUNT(*) FROM human_decisions WHERE phase = 1 AND decision = 'Exclude';  -- Human Excludes
SELECT COUNT(*) FROM human_decisions WHERE phase = 1 AND decision = 'Include';  -- Human Includes
SELECT COUNT(*) FROM human_decisions WHERE phase = 1 AND decision = 'Uncertain';  -- Human Uncertain
SELECT COUNT(*) FROM agent_decisions WHERE decision = 'Exclude';  -- Agent Excludes
SELECT COUNT(*) FROM agent_decisions WHERE decision = 'Include';  -- Agent Includes
SELECT COUNT(*) FROM agent_decisions WHERE decision = 'Uncertain';  -- Agent Uncertain

-- Exclusion reasons breakdown
SELECT exclusion_reason, COUNT(*) FROM human_decisions WHERE phase = 1 AND decision = 'Exclude' GROUP BY exclusion_reason;

-- Full-text screening (when available)
SELECT COUNT(*) FROM records WHERE phase = 2;  -- FT screened
SELECT COUNT(*) FROM human_decisions WHERE phase = 2 AND decision = 'Exclude';  -- FT Excludes
SELECT COUNT(*) FROM human_decisions WHERE phase = 2 AND decision = 'Include';  -- FT Includes
```

---

## Frontend Component Structure

### React Component: `PrismaaDashboard.tsx`

**Location:** `src/pages/PrismaDashboard.tsx`

**Features:**

1. **Data Fetching**
   - Fetch counts from backend endpoint `/api/prisma-stats`
   - Backend queries SQLite and returns JSON:
   ```json
   {
     "imported": 1882,
     "deduplicated": 1221,
     "duplicates_removed": 661,
     "screening": {
       "phase": "Title & Abstract",
       "total_screened": 1221,
       "human_include": 102,
       "human_exclude": 1119,
       "human_uncertain": 0,
       "agent_include": 57,
       "agent_exclude": 810,
       "agent_uncertain": 234,
       "exclusion_reasons": {
         "Population not in LMICs": 250,
         "Setting not primary care": 180,
         "No AI/ML implementation": 400,
         "No responsible AI dimension": 150,
         "Ineligible study type": 89,
         "Published before 2015": 45,
         "Not in English": 5
       }
     },
     "fulltext": {
       "phase": "Full-Text Review",
       "screened": 0,
       "excludes": 0,
       "includes": 0
     }
   }
   ```

2. **SVG Diagram Rendering**
   - Render PRISMA-ScR flow diagram as SVG (not image)
   - Use D3.js or raw SVG with React
   - Box styling: white background, black border, rounded corners
   - Text: center-aligned, readable font size
   - Arrows: solid lines between boxes
   - Colors: 
     - Include (green): #4CAF50
     - Exclude (red): #F44336
     - Uncertain (orange): #FF9800
     - Neutral (gray): #9E9E9E

3. **Interactive Elements**
   - **Click on any box** to expand/collapse a detail panel showing:
     - Exact count
     - Percentage of total
     - Breakdown by reason (if Exclude)
     - Timestamp of last update
   - **Hover effects**: Highlight box and connected arrows
   - **Live update indicator**: Show "Last updated: X seconds ago" at bottom

4. **Download Functionality**
   - **Download SVG button**: Exports current diagram as .svg file (preserves interactivity)
   - **Download HTML button**: Wraps SVG + stats in a standalone HTML document for dissertation inclusion
   - HTML template should include:
     - Title: "PRISMA-ScR Flow Diagram: Responsible AI in LMIC Primary Care"
     - Subtitle: "Title & Abstract Screening"
     - Timestamp: "Generated: [date]"
     - SVG diagram
     - Summary table below diagram:
       ```
       Stage | Count | Notes
       ------|-------|-------
       Records identified | 1,882 | From 4 databases
       Duplicates removed | 661 | Via Covidence
       Records screened (T/A) | 1,221 | Human + AI review
       Excluded at T/A | 1,119 | See breakdown
       Advancing to FT | 102 | Human Includes
       Agent Uncertain | 234 | Pending human review
       ```

5. **Visual Layout**
   - **Left side (60%)**: SVG diagram
   - **Right side (40%)**: 
     - Summary stats box
     - Exclusion reasons breakdown (pie chart or list)
     - Download buttons
     - "Last updated" timestamp

---

## PRISMA-ScR Flow Diagram Structure

```
┌─────────────────────────────────────────┐
│ Records identified from databases (n) │ ← Database search results
│ PubMed: 890, Scopus: 728, GH: 258, LILACS: 6
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Total records imported (1,882)         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Duplicates removed (661)                │
│ Records after dedup (1,221)             │
└─────────────────────────────────────────┘
              ↓
      ┌───────┴────────┐
      ↓                ↓
┌──────────────┐  ┌──────────────┐
│ Human Review │  │ Agent Review │
│ (single)     │  │ (independent)│
└──────────────┘  └──────────────┘
      ↓                ↓
┌──────────────┐  ┌──────────────┐
│ Include: 102 │  │ Include: 57  │
│ Exclude: 1119│  │ Exclude: 810 │
│ Uncertain: 0 │  │ Uncertain: 234
└──────────────┘  └──────────────┘
      ↓                ↓
      └────────┬───────┘
               ↓
    ┌──────────────────────┐
    │ Full-Text Review     │
    │ (102 + 234 pending)  │
    └──────────────────────┘
               ↓
    ┌──────────────────────┐
    │ Studies Included (n) │
    │ [to be completed]    │
    └──────────────────────┘
```

---

## Backend Endpoint

**Endpoint:** `GET /api/prisma-stats`

**Location:** `backend/app/routers/prisma.py` (create new file)

**Logic:**
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

router = APIRouter(prefix="/api/prisma", tags=["prisma"])

@router.get("/stats")
async def get_prisma_stats(db: AsyncSession = Depends(get_db)):
    # Query counts from human_decisions and agent_decisions tables
    # Return JSON with structure above
    # Add caching (e.g., cache for 10 seconds) to avoid DB thrashing
    pass
```

---

## Implementation Checklist

- [ ] Create `backend/app/routers/prisma.py` with `/api/prisma-stats` endpoint
- [ ] Create `src/pages/PrismaDashboard.tsx` component
- [ ] Add PRISMA Dashboard tab to main navigation (e.g., next to "Screen" or "Compare")
- [ ] Implement SVG rendering (use D3.js or Recharts for chart, custom SVG for flow)
- [ ] Implement click-to-expand on boxes
- [ ] Implement download SVG button
- [ ] Implement download HTML button with template
- [ ] Add "Last updated" timestamp with auto-refresh every 30 seconds
- [ ] Test with current screening data
- [ ] Style to match existing app theme

---

## Notes

- The diagram should **live-update** as you complete human screening and agent runs
- Once you move to full-text screening (phase=2), the diagram should show FT progress
- The HTML export should be **standalone and printable** (no external dependencies)
- Consider adding a **progress percentage** under each phase (e.g., "T/A Screening: 45% complete")
- Exclusion reasons should be **clickable** to filter/highlight related records in the screening interface

---

## Files to Create/Modify

**New files:**
- `backend/app/routers/prisma.py` (endpoint)
- `src/pages/PrismaDashboard.tsx` (React component)
- `src/components/PrismaFlow.tsx` (SVG rendering)

**Modify:**
- `backend/app/main.py` (add router)
- `src/layout/Navigation.tsx` (add tab)
- `src/App.tsx` (add route)

