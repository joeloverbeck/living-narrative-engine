# PHYCONNARIMP-000: Physical Condition Narrative Improvements - Overview

## Epic Summary

Fix four issues in the injury narrative system that produces first-person descriptions of an actor's physical state. These descriptions appear in the UI panel and are included in LLM prompts.

## Source Specification

`specs/physical-condition-narrative-improvements.md`

## Issues Addressed

| Issue | Severity | Description | Ticket |
|-------|----------|-------------|--------|
| Duplicate part counting | High | "My right ear and right ear is completely numb" | PHYCONNARIMP-001 |
| Dismembered parts show health state | High | Missing ear shows "is completely numb" | PHYCONNARIMP-002 |
| Missing parts not prioritized | Medium | "is missing" appears after health states | PHYCONNARIMP-003 |
| Bleeding parts not grouped | Medium | Separate sentences for each bleeding part | PHYCONNARIMP-004 |

## Ticket Breakdown

```
PHYCONNARIMP-000 (this file) - Overview
    │
    ├── PHYCONNARIMP-001 - Fix duplicate part counting
    │   └── Remove redundant filter that merges destroyedParts with injuredParts
    │
    ├── PHYCONNARIMP-002 - Filter dismembered from health states
    │   └── Exclude dismembered parts from health state and effects output
    │
    ├── PHYCONNARIMP-003 - Prioritize dismemberment ordering
    │   └── Move dismemberment to top of narrative output
    │
    ├── PHYCONNARIMP-004 - Group bleeding by severity
    │   └── Combine bleeding parts into grouped sentences with Oxford comma
    │
    ├── PHYCONNARIMP-005 - Extract helper methods
    │   └── Refactor into focused private methods for maintainability
    │
    └── PHYCONNARIMP-006 - Integration tests
        └── End-to-end tests for UI panel and LLM integration
```

## Dependency Graph

```
001 (duplicate fix) ──┐
                      │
002 (dismemberment) ──┼──► 003 (ordering) ──┐
                      │                      │
004 (bleeding group) ─┘                      ├──► 005 (refactor) ──► 006 (integration)
```

**Recommended execution order:** 001 → 002 → 003 → 004 → 005 → 006

Tickets 001, 002, and 004 can be worked in parallel. 003 depends on 002. 005 depends on all of 001-004. 006 depends on 005.

## Files Affected

| File | Tickets | Change Type |
|------|---------|-------------|
| `src/anatomy/services/injuryNarrativeFormatterService.js` | 001-005 | Modify |
| `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` | 001-004 | Add tests |
| `tests/integration/anatomy/physicalConditionNarrativeImprovements.integration.test.js` | 006 | Create |

## Files NOT Changed

- `src/anatomy/services/injuryAggregationService.js` - Data source is correct
- `src/anatomy/registries/healthStateRegistry.js` - Registry unchanged
- `src/domUI/injuryStatusPanel.js` - UI consumes formatter output (no changes)
- `src/turns/services/actorDataExtractor.js` - LLM consumes formatter output (no changes)

## Expected Output Transformation

**Before (Buggy):**
```
My right ear and right ear is completely numb. My torso screams with agony.
My upper head throbs painfully. My brain stings slightly. My right ear is missing.
Blood flows steadily from my torso. Blood flows steadily from my upper head.
```

**After (Fixed):**
```
My right ear is missing. My torso screams with agony. My upper head throbs painfully.
My brain stings slightly. Blood flows steadily from my torso and my upper head.
```

## Risk Assessment

- **Overall Risk**: Low
- **Rationale**:
  - Changes isolated to single service file
  - Existing test coverage provides safety net
  - Public API unchanged
  - Well-defined acceptance criteria

## Success Criteria

1. All unit tests pass (existing + new)
2. All integration tests pass
3. No performance regression (< 1ms for formatFirstPerson)
4. Manual verification in game UI
5. LLM prompts receive correct narrative format

## Estimated Effort

| Ticket | Complexity | Lines Changed |
|--------|------------|---------------|
| 001 | Low | ~5 |
| 002 | Low-Medium | ~20 |
| 003 | Low | ~30 |
| 004 | Medium | ~50 |
| 005 | Medium | ~100 (reorganization) |
| 006 | Medium | ~150 (new file) |
| **Total** | | ~355 |
