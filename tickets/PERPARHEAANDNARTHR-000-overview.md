# PERPARHEAANDNARTHR-000: Per-Part Health and Narrative Thresholds - Overview

**Status:** Active
**Epic:** Per-Part Health System (Iteration 1)
**Source Spec:** `specs/per-part-health-and-narrative-thresholds.md`

---

## Epic Summary

Implement a foundational per-part health system that tracks health values on body part entities, maps health percentages to narrative state labels, and provides operations for modifying health with proper event notifications.

---

## Scope Boundaries

### In Scope (This Epic)

1. `anatomy:part_health` component for tracking health on body part entities
2. Health threshold lookup file for modder-configurable state boundaries
3. `MODIFY_PART_HEALTH` operation for changing health values
4. `UPDATE_PART_HEALTH_STATE` operation for recalculating narrative state
5. `anatomy:part_health_changed` event for any health modification
6. `anatomy:part_state_changed` event for threshold crossings only
7. Full DI registration and pre-validation whitelist updates
8. Unit and integration tests

### Out of Scope (Future Iterations)

- Damage types (cutting, blunt, piercing, fire, etc.)
- Damage application with hit distribution and targeting
- Bleeding and status effects
- Healing mechanics beyond basic health modification
- Death logic (brain destruction, heart failure, overall health threshold)
- Armor and protection calculations
- Irrecoverable injuries and permanent damage
- Automatic limb detachment when destroyed
- Pain and shock mechanics
- Damage propagation to connected parts

---

## Ticket List

| Ticket | Title | Dependencies | Status |
|--------|-------|--------------|--------|
| 001 | Part Health Component Schema | None | Ready |
| 002 | Health Thresholds Lookup File | None | Ready |
| 003 | MODIFY_PART_HEALTH Schema | None | Ready |
| 004 | MODIFY_PART_HEALTH Handler | 001, 003 | Ready |
| 005 | MODIFY_PART_HEALTH DI Registration | 003, 004 | Ready |
| 006 | UPDATE_PART_HEALTH_STATE Schema | None | Ready |
| 007 | UPDATE_PART_HEALTH_STATE Handler | 001, 002, 006 | Ready |
| 008 | UPDATE_PART_HEALTH_STATE DI Registration | 006, 007 | Ready |
| 009 | Part Health Changed Event | None | Ready |
| 010 | Part State Changed Event | None | Ready |
| 011 | Mod Manifest Update | 001, 002, 009, 010 | Ready |
| 012 | Integration Tests | All others | Ready |

---

## Dependency Graph

```
[001] Component ─────┬─→ [004] Handler ─→ [005] DI
                     │
[003] Schema ────────┘

[002] Lookup ────────┬─→ [007] Handler ─→ [008] DI
                     │
[006] Schema ────────┘
[001] Component ─────┘

[009] Event ─────────┬─→ [011] Manifest
[010] Event ─────────┘

All ──────────────────→ [012] Integration Tests
```

---

## Implementation Order (Recommended)

**Phase 1: Data Definitions (can run in parallel)**
1. PERPARHEAANDNARTHR-001 (Component)
2. PERPARHEAANDNARTHR-002 (Lookup)
3. PERPARHEAANDNARTHR-003 (MODIFY schema)
4. PERPARHEAANDNARTHR-006 (UPDATE schema)
5. PERPARHEAANDNARTHR-009 (Health Changed Event)
6. PERPARHEAANDNARTHR-010 (State Changed Event)

**Phase 2: MODIFY_PART_HEALTH Operation**
7. PERPARHEAANDNARTHR-004 (Handler)
8. PERPARHEAANDNARTHR-005 (DI Registration)

**Phase 3: UPDATE_PART_HEALTH_STATE Operation**
9. PERPARHEAANDNARTHR-007 (Handler)
10. PERPARHEAANDNARTHR-008 (DI Registration)

**Phase 4: Finalization**
11. PERPARHEAANDNARTHR-011 (Mod Manifest)
12. PERPARHEAANDNARTHR-012 (Integration Tests)

---

## Success Criteria

1. Body part entities can have health tracked via `anatomy:part_health` component
2. Health values can be modified via `MODIFY_PART_HEALTH` operation
3. State labels update automatically based on health percentage
4. `anatomy:part_health_changed` event fires on any health modification
5. `anatomy:part_state_changed` event fires only on threshold crossings
6. All operations follow established DI and registration patterns
7. Unit and integration tests pass with 80%+ coverage
8. No breaking changes to existing anatomy system

---

## Reference Files

| File | Purpose |
|------|---------|
| `src/logic/operationHandlers/updateHungerStateHandler.js` | Pattern for state update handler |
| `data/mods/metabolism/components/hunger_state.component.json` | Pattern for component schema |
| `data/mods/metabolism/lookups/hunger_thresholds.json` | Pattern for threshold lookup |
| `data/mods/anatomy/events/limb_detached.event.json` | Pattern for anatomy events |
| `src/utils/preValidationUtils.js` | Operation type whitelist |
