# LUNVITORGDEA-000: Respiratory Organ Death System - Overview

**Status**: ✅ COMPLETED (Full Series)

## Problem Statement

Currently, lungs do NOT have the `anatomy:vital_organ` component while heart, brain, and spine do. This creates an inconsistency:
- Heart destroyed → instant death
- Brain destroyed → instant death
- Spine destroyed → instant death
- Both lungs destroyed → NO instant death (only gradual hypoxia)

The desired behavior is:
- **Gradual death (hypoxia)**: If at least one lung remains functional
- **Instant death**: If ALL respiratory organs are destroyed

## Solution Overview

Extend the `anatomy:vital_organ` component with a `requiresAllDestroyed` flag:
- `false` (default): ANY organ destroyed = death (brain, heart, spine)
- `true`: ALL organs of this type destroyed = death (lungs)

## Ticket Series

| Ticket | Title | Description | Dependencies | Status |
|--------|-------|-------------|--------------|--------|
| LUNVITORGDEA-001 | Schema Update | Add `requiresAllDestroyed` and `respiratory` organType | None | ✅ COMPLETED |
| LUNVITORGDEA-002 | Human Lung Entities | Add vital_organ to human lungs | 001 | ✅ COMPLETED |
| LUNVITORGDEA-003 | Collective Death Check | Implement `#checkCollectiveVitalOrganDestruction` | 001 | ✅ COMPLETED |
| LUNVITORGDEA-004 | Oxygen Handler Filter | Filter destroyed organs from oxygen calculations | None | ✅ COMPLETED |
| LUNVITORGDEA-005 | Death Message | Add respiratory death message | 001, 003 | ✅ COMPLETED |
| LUNVITORGDEA-006 | Unit Tests | Test collective organ death logic | 003, 005 | ✅ COMPLETED |
| LUNVITORGDEA-007 | Integration Tests | End-to-end respiratory death scenarios | 001-006 | ✅ COMPLETED |
| LUNVITORGDEA-008 | Creature Lungs | Apply vital_organ to creature lungs (optional) | 001 | ✅ COMPLETED |

## Dependency Graph

```
001 (Schema) ─────┬────────────────────────> 002 (Human Lungs)
                  │                                │
                  │                                v
                  ├───────────> 003 (Death Check) ─────> 006 (Unit Tests)
                  │                    │                      │
                  │                    v                      v
                  └───────────> 005 (Death Message) ───> 007 (Integration)
                                                              ^
004 (Oxygen Filter) ──────────────────────────────────────────┘
                                                              ^
008 (Creature Lungs) ─────────────────────────────────────────┘
```

## Recommended Implementation Order

1. LUNVITORGDEA-001 (Schema) - Foundation for all other work
2. LUNVITORGDEA-003 (Collective Death Check) - Core logic
3. LUNVITORGDEA-004 (Oxygen Handler Filter) - Independent, can parallel
4. LUNVITORGDEA-005 (Death Message) - Simple addition
5. LUNVITORGDEA-002 (Human Lung Entities) - Data changes
6. LUNVITORGDEA-006 (Unit Tests) - Verify core logic
7. LUNVITORGDEA-007 (Integration Tests) - End-to-end validation
8. LUNVITORGDEA-008 (Creature Lungs) - Optional consistency work

## Success Criteria

The system is complete when:
1. Destroying one lung does NOT cause instant death
2. Destroying both lungs DOES cause instant death
3. Destroying one lung triggers hypoxia when oxygen depletes
4. Brain/heart/spine behavior is unchanged
5. All unit and integration tests pass

---

## Final Outcome

**Series Completed**: 2026-01-03

### Summary of Work

The LUNVITORGDEA series successfully implemented a collective vital organ death system for respiratory organs:

1. **Schema Enhancement** (001): Added `requiresAllDestroyed` boolean and `"respiratory"` to `organType` enum
2. **Human Lungs** (002): Added `anatomy:vital_organ` to both human lung entities with correct configuration
3. **Death Check Service** (003): Implemented `#checkCollectiveVitalOrganDestruction` method in `deathCheckService.js`
4. **Oxygen Handler Filter** (004): Updated `depleteOxygenHandler.js` and `restoreOxygenHandler.js` to filter destroyed organs
5. **Death Message** (005): Added respiratory-specific death message support
6. **Unit Tests** (006): Comprehensive unit tests for collective organ death logic
7. **Integration Tests** (007): End-to-end scenarios for respiratory death
8. **Creature Lungs** (008): Applied vital_organ to 8 creature lung entities (feline, mustelid, amphibian, reptilian)

### All Success Criteria Met

✅ Destroying one lung does NOT cause instant death
✅ Destroying both lungs DOES cause instant death
✅ Destroying one lung triggers hypoxia when oxygen depletes
✅ Brain/heart/spine behavior is unchanged
✅ All unit and integration tests pass (17 tests in respiratory death integration suite)

### Archived Tickets

All tickets archived to `archive/oxygenation/`:
- LUNVITORGDEA-001 through LUNVITORGDEA-008 with Outcome sections
- This overview file (LUNVITORGDEA-000)
