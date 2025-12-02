# INJREPANDUSEINT-002: Event Definitions [COMPLETED]

**Status:** ✅ COMPLETED
**Completed:** 2025-12-02

## Description

Create the four new event JSON schemas for entity dying, entity died, entity stabilized, and internal damage propagated.

## File List

| File | Action | Status |
|------|--------|--------|
| `data/mods/anatomy/events/entity_dying.event.json` | CREATE | ✅ |
| `data/mods/anatomy/events/entity_died.event.json` | CREATE | ✅ |
| `data/mods/anatomy/events/entity_stabilized.event.json` | CREATE | ✅ |
| `data/mods/anatomy/events/internal_damage_propagated.event.json` | CREATE | ✅ |

## Out of Scope

- Component definitions (INJREPANDUSEINT-001)
- Service implementations that dispatch these events
- UI components that listen to these events

## Acceptance Criteria

### Tests That Must Pass

- ✅ `npm run validate` passes for all four event files
- ✅ `npm run test:unit` continues to pass (38,309 tests passed)

### Invariants

- ✅ Event IDs follow `anatomy:*` namespace pattern
- ✅ `entity_dying` payload includes all required fields
- ✅ `entity_died` payload includes all required fields
- ✅ `entity_stabilized` payload includes all required fields
- ✅ `internal_damage_propagated` payload includes all required fields

## Dependencies

None

## Reference

See `specs/injury-reporting-and-user-interface.md` section 6 for detailed event specifications.

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
- Create 4 new event JSON files in `data/mods/anatomy/events/`

**Actually Changed:**
- ✅ Created all 4 event files exactly as specified
- All events follow the existing pattern from `part_state_changed.event.json`
- Each event uses relative `$schema` path: `"../../../schemas/event.schema.json"`
- All payloads have `additionalProperties: false` for strict validation

**Discrepancies:** None - implementation matched specification exactly.

### New/Modified Tests

No new tests were created. Per ticket scope, event schemas are validated by the existing validation infrastructure (`npm run validate`). The existing 38,309 unit tests continue to pass, confirming no regressions.

### Validation Results

- `npm run validate`: ✅ PASSED - 0 cross-reference violations across 47 mods
- `npm run test:unit`: ✅ PASSED - 38,309 tests passed
