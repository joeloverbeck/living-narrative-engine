# WOUBODPAROPE-005: Refactor Wounded Scopes to Use New Operators

**Goal:** Wire the `first-aid` wounded scopes to the already-existing `isBodyPartAccessible` and `isBodyPartWounded` operators (defaults: treat missing sockets/slots as exposed, exclude non-blocking layers) while preserving actor vs target selection.

**Status:** Completed 2026-02-06

## Current findings vs. original assumptions
- The operators `isBodyPartAccessible` and `isBodyPartWounded` are already implemented and unit-tested; the wounded scopes still embed manual checks.
- The integration test `disinfect_my_wounded_part_action_discovery` registers its own wounded scope resolver that diverges from the game scope (counts underwear as covering and bypasses `isBodyPartAccessible`). Update it to exercise the real scope via the unified resolver so the refactor is validated.
- No `tests/common/anatomy/anatomyIntegrationTestBed.js` changes are needed; operator wiring already exists in `jsonLogicCustomOperators`.

## File list
- `data/mods/first-aid/scopes/wounded_actor_body_parts.scope`
- `data/mods/first-aid/scopes/wounded_target_body_parts.scope`
- `tests/integration/mods/first-aid/disinfect_my_wounded_part_action_discovery.test.js` (remove custom wounded scope resolver and validate against the real scope/operator behavior)

## Out of scope
- Changing the selection semantics of other first-aid scopes (bleeding, disinfectant availability, etc.)
- Altering operator implementations beyond what is required to wire the new calls
- Tweaking action definitions or narrative content

## Acceptance criteria
- Tests:
  - `npm run test:integration -- --runInBand tests/integration/mods/first-aid/disinfect_my_wounded_part_action_discovery.test.js` passes (using the actual wounded scope)
  - `npm run test:unit -- tests/unit/logic/operators/isBodyPartAccessibleOperator.test.js` and `npm run test:unit -- tests/unit/logic/operators/isBodyPartWoundedOperator.test.js` continue to pass (operators unchanged but now exercised by the scope)
- Invariants:
  - Scope evaluation returns the same body parts for equivalent actors/targets as before the refactor
  - Missing `visibility_rules.clothingSlotId` or `joint.socketId` remain treated as exposed in wounded scopes
  - No new mod IDs or component references are introduced

## Outcome
- Wounded actor/target scopes now call `isBodyPartWounded` (boolean exclude-vitals shorthand) and `isBodyPartAccessible`, maintaining the missing slot/socket exposure behavior.
- `isBodyPartWounded` accepts a boolean for `excludeVitalOrgans` to avoid JSON Logic literal issues; unit coverage added for this path.
- The integration discovery test now registers the real wounded and disinfectant scopes instead of a hand-rolled resolver, validating the operator-backed behavior.
