# PASTHRBREACT-001: Add Breached Blocker Scopes

**Status**: Completed
**Priority**: High

## Overview
Create the new scope definitions that surface breached blockers at the actor's location and map a breached blocker to its destination exits. These scopes are the foundation for the pass-through-breach action targeting.

## Assumptions Recheck (2025-12-21)
- Scope DSL should mirror existing blockers scopes by using `location.locations:exits[].blocker[...]` and checking `entity.components.breaching:breached` for the breached marker.
- The destination scope should filter `location.locations:exits` by matching `entity.blocker` to the `target` provided via `contextFrom` (using `target.id` or `target` for compatibility with current scope conventions).

## File List
- `data/mods/breaching/scopes/breached_blockers_at_location.scope`
- `data/mods/movement/scopes/destinations_for_breached_blocker.scope`
- `tests/unit/mods/movement/scopes.test.js`
- `tests/integration/mods/breaching/scopes.test.js`

## Out of Scope
- Do not add or modify any movement actions or rules.
- Do not modify existing scope IDs or behavior for `movement:clear_directions` or `movement:dimensional_portals`.
- Do not change any JSON schema or engine code.

## Acceptance Criteria
### Specific tests that must pass
- `npm run test:unit -- tests/unit/mods/movement/scopes.test.js --runInBand`
- `npm run test:integration -- tests/integration/mods/breaching/scopes.test.js --runInBand`

### Invariants that must remain true
- Existing scopes that read `location.locations:exits` continue returning the same results.
- The new scopes resolve IDs consistent with existing scope DSL conventions (no new resolver behavior).
- No changes to action discovery ordering or formatting.

## Outcome
- Implemented new breaching/movement scope files using existing exit/blocker DSL patterns, with destination matching on `target.id`/`target`.
- Added unit/integration coverage for the new scopes in the listed test suites; no engine or schema changes were required.
