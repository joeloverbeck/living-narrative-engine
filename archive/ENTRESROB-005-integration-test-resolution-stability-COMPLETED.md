# ENTRESROB-005: Integration Test for Entity Resolution Stability

**Priority:** P1
**Effort:** Small (2-3 hours)
**Status:** Completed
**Dependencies:** ENTRESROB-003 (deterministic resolution implemented)

## Report Reference

See `specs/entity-resolution-robustness.md` for full context.

## Problem Statement

Integration coverage is missing for entity resolution stability and for ensuring socket-bearing anatomy parts stay compatible with slot expectations when loaded from real mod data. The current code already implements deterministic resolution rules (fewest underscores → alphabetical → shortest ID) and has unit tests from ENTRESROB-001/003, but we still need end-to-end checks that:
1. Socket-bearing heads keep required sockets (`brain_socket`) while allowing non-socketed heads (e.g., `anatomy:kraken_head`) that intentionally omit anatomy sockets.
2. Torsos retain vital sockets (`heart_socket`, `spine_socket`).
3. `resolveEntityId` stays deterministic against registry ordering and still prefers the canonical head entity (`anatomy:humanoid_head`) when multiple heads are present.

## Objective

Create integration tests that verify entity resolution stability and anatomy socket consistency using real mod data from `data/mods/anatomy/`, leveraging the existing deterministic resolver rather than changing production code.

## Files to Touch

- `tests/integration/anatomy/entityResolutionConsistency.integration.test.js` (CREATE)

## Out of Scope

- **DO NOT** modify production code in `src/`
- **DO NOT** modify existing test files
- **DO NOT** modify entity definition files in `data/mods/`
- **DO NOT** duplicate validation script functionality (ENTRESROB-002)

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
# Integration test runs
npm run test:integration -- --testPathPattern="entityResolutionConsistency"
```

### Test Cases to Implement

```
entityResolutionConsistency > data consistency > head entities with sockets expose brain_socket (allows socket-less heads like anatomy:kraken_head)
entityResolutionConsistency > data consistency > all entities with subType "torso" have heart_socket
entityResolutionConsistency > data consistency > all entities with subType "torso" have spine_socket
entityResolutionConsistency > resolution stability > resolveEntityId returns consistent ID across shuffled registry order
entityResolutionConsistency > resolution stability > resolveEntityId prefers anatomy:humanoid_head for partType "head"
```

### Invariants That Must Remain True

1. Tests are read-only, do not modify any files
2. Tests use existing test infrastructure (e.g., `AnatomyIntegrationTestBed`)
3. Tests load real mod data from `data/mods/anatomy/`
4. Tests provide clear failure messages indicating which entity/socket is missing
5. `resolveEntityId` is exercised as exported from `socketExtractor.js` (no helper exports needed)

## Implementation Notes

### Test Shape

- Use `AnatomyIntegrationTestBed` (default export) to load `data/mods/anatomy/`.
- Filter entities by `anatomy:part.subType` for data checks, allowing socket-less heads to avoid false positives (e.g., `anatomy:kraken_head`).
- Import `resolveEntityId` from `src/anatomy/validation/socketExtractor.js` and verify it returns the same ID even when entity definitions are re-registered in randomized order.
- Assert the resolver picks `anatomy:humanoid_head` for `partType` "head" when the registry contains multiple head definitions.
- The current `AnatomyIntegrationTestBed` data is a curated subset (it includes a generic `anatomy:head` without sockets), so load canonical definitions directly from `data/mods/anatomy/entities/definitions` when asserting socket invariants and resolver behavior.

## Verification Commands

```bash
# Run integration test
npm run test:integration -- --testPathPattern="entityResolutionConsistency"

# Run with verbose output
npm run test:integration -- --testPathPattern="entityResolutionConsistency" --verbose

# Run all anatomy integration tests
npm run test:integration -- --testPathPattern="anatomy"
```

## Success Metrics

- [x] Test file created at `tests/integration/anatomy/entityResolutionConsistency.integration.test.js`
- [x] All 5 test cases pass
- [x] Tests use real mod data (not mocks)
- [x] Tests verify determinism with shuffled registry
- [x] Tests verify base entity preference
- [x] Clear failure messages when assertions fail

## Outcome

- Added `tests/integration/anatomy/entityResolutionConsistency.integration.test.js` to cover socket consistency (heads with sockets, torsos with heart/spine) and deterministic `resolveEntityId` behavior using canonical mod definitions loaded from disk.
- Left production code unchanged; the integration test builds registries from mod JSON to avoid the curated `AnatomyIntegrationTestBed` subset that includes a socket-less `anatomy:head`.
- Verified with `npm run test:integration -- --testPathPatterns="entityResolutionConsistency" --runInBand --coverage=false`.
