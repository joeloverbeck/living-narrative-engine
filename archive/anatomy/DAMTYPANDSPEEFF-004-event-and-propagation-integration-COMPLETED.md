# DAMTYPANDSPEEFF-004: Event payloads and propagation integration for damage effects

**Status**: Completed
**Priority**: Medium
**Estimated Effort**: 1 day
**Dependencies**: DAMTYPANDSPEEFF-002, DAMTYPANDSPEEFF-003
**Blocks**: DAMTYPANDSPEEFF-005

## Problem / Objective

Ensure all events defined in the spec are emitted with correct payloads during damage application and ongoing tick processing, and that per-part propagation flows preserve event context (e.g., propagatedFrom). Provide hooks for narrative/mod listeners without altering UI.

## Reassessed Scope

Most of this ticket was already implemented in prior work:

**Already Complete:**

- Event constants are centralized in `src/anatomy/services/damageTypeEffectsService.js` (lines 32-44)
- `DamageTypeEffectsService` emits all "started" events with correct payloads
- `BleedingTickSystem`, `BurningTickSystem`, `PoisonTickSystem` all exist and process tick effects
- `ApplyDamageHandler` passes `propagatedFrom` through propagation pipeline
- Unknown damage types log warnings and skip effects gracefully

**Gaps Fixed in This Ticket:**

- `BleedingTickSystem` and `BurningTickSystem` "stopped" events were missing `entityId` (spec requirement)
- Integration test file for event verification was missing

## File list (Corrected from original)

- `src/anatomy/services/damageTypeEffectsService.js` - Event constants already centralized here ✅
- `src/anatomy/services/bleedingTickSystem.js` - Add entityId to stopped event payload
- `src/anatomy/services/burningTickSystem.js` - Add entityId to stopped event payload
- `src/anatomy/services/poisonTickSystem.js` - Already correct (scope-based entityId/partId) ✅
- `src/logic/operationHandlers/applyDamageHandler.js` - propagatedFrom already flows through ✅
- `tests/integration/anatomy/damage-type-events.integration.test.js` - New test file

## Out of scope

- UI or narrative consumer changes; only event emission and documentation.
- Balancing or altering damage amounts; focus on event correctness only.
- Adding new event bus implementations beyond existing architecture.

## Acceptance criteria

### Tests that must pass

- `npm run test:integration -- tests/integration/anatomy/damage-type-events.test.ts`
- Relevant unit suites from DAMTYPANDSPEEFF-002 and DAMTYPANDSPEEFF-003 continue to pass after event wiring.
- Lint on touched files, especially event helpers and system updates.

### Invariants that must remain true

- Event payloads match the spec fields (no missing entityId/partId/damageTypeId when applicable).
- Propagated damage continues to respect existing per-part health logic; only context propagation is added.
- No additional console logging beyond warnings for unknown damage types.
- Event emission does not introduce duplicate dispatches per effect lifecycle.

---

## Outcome

**Completed: 2025-12-02**

### What Was Actually Changed

1. **`src/anatomy/services/bleedingTickSystem.js`** (lines 24-25, 128-129, 140, 162, 182-191)
   - Added `PART_COMPONENT_ID` constant for looking up part owner
   - Modified `#processBleedingPart()` to retrieve `ownerEntityId` from part component
   - Updated `#stopBleeding()` signature and event payload to include `entityId`

2. **`src/anatomy/services/burningTickSystem.js`** (lines 27-28, 131-132, 143, 165, 185-194)
   - Same pattern as BleedingTickSystem
   - Added `entityId` lookup and propagation to stopped events

3. **`tests/integration/anatomy/damage-type-events.integration.test.js`** (new file, 496 lines)
   - 12 integration tests covering:
     - BleedingTickSystem stopped events (3 tests)
     - BurningTickSystem stopped events (3 tests)
     - DamageTypeEffectsService started events (5 tests)
     - Event payload consistency (1 test)
   - Tests verify entityId inclusion, null handling for orphan parts, and timestamp presence

### Versus Originally Planned

The original ticket assumed most systems needed to be created from scratch. Upon reassessment:

- **90% was already complete** - event constants, started events, tick systems, propagation context
- **Actual work was minimal** - ~15 lines of code changes per tick system + test file creation
- **File extensions corrected** - codebase uses `.js`, not `.ts`

### Test Results

- `tests/integration/anatomy/damage-type-events.integration.test.js`: **12/12 passed**
- `tests/unit/anatomy/services/bleedingTickSystem.test.js`: **18/18 passed**
- `tests/unit/anatomy/services/burningTickSystem.test.js`: **19/19 passed**
- Lint: 0 errors (warnings only for pre-existing JSDoc style)
