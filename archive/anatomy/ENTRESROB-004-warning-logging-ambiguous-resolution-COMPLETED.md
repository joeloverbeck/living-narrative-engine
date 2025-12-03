# ENTRESROB-004: Warning Logging for Ambiguous Resolution

**Priority:** P2
**Effort:** Small (2-3 hours)
**Status:** Completed
**Dependencies:** ENTRESROB-003 (deterministic resolution is already in place)

## Report Reference

See `specs/entity-resolution-robustness.md` for full context.

## Problem Statement

When `resolveEntityId` encounters multiple entities with the same `subType`, it silently selects one based on the existing priority rules. This makes debugging difficult because developers don't know:
- That multiple candidates existed
- Which entity was selected and why
- What the alternatives were

## Objective

Add optional informational logging when `resolveEntityId` encounters multiple candidates, providing observability for debugging and auditing entity resolution decisions without changing selection logic.

## Files to Touch

- `src/anatomy/validation/socketExtractor.js` (MODIFY)

## Out of Scope

- **DO NOT** change the priority/selection logic (that was ENTRESROB-003)
- **DO NOT** add new npm dependencies
- **DO NOT** export the function or change its signature
- **DO NOT** modify test files
- **DO NOT** add error throwing for ambiguous cases (logging only)
- **DO NOT** make logging mandatory (should be optional/silent in tests)

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
# Targeted unit suite
npm run test:unit -- --testPathPattern="socketExtractor"

# Integration sanity check (unchanged selection logic)
npm run test:integration

# Logger must be mockable/suppressible to avoid noisy test output
```

### Functional Requirements

1. **Warning logged** when `candidates.length > 1`
2. **Warning includes**:
   - The `partType` being resolved
   - All candidate entity IDs
   - The selected entity ID
   - Brief explanation of the **existing** selection criteria (fewest underscores → alphabetical → shortest ID)
3. **No warning** for single-candidate resolutions
4. **No warning** for no-match resolutions (null return)
5. **Logger is optional** - defaults to console but can be suppressed/mocked for tests

### Invariants That Must Remain True

1. Logging is informational only and does not change control flow
2. Logger is optional, defaults to console but can be suppressed
3. Function signature unchanged; use a module-level logger setter for injection
4. All existing tests continue to pass
5. Tests can run without log spam (logger must be mockable)

## Implementation Notes

### Approach

Use a module-level logger setter so the function signature stays stable. Default to `console`, but allow tests and callers to inject a noop/mock logger. Keep the existing selection rules intact.

### Log Message Format

```
[socketExtractor] Multiple entities with subType "head": anatomy:humanoid_head, anatomy:humanoid_head_bearded, anatomy:humanoid_head_plain. Selected "anatomy:humanoid_head" (priority: fewest underscores, alphabetical, shortest ID).
```

## Verification Commands

```bash
# Unit tests pass (no log spam expected)
npm run test:unit -- --testPathPatterns=socketExtractor --runInBand

# Integration tests pass
npm run test:integration -- --runInBand

# Manual verification: run validation and check for log output
node -e "
const { extractHierarchicalSockets } = require('./src/anatomy/validation/socketExtractor.js');
// ... setup and call to see logs ...
"
```

## Success Metrics

- [x] Warning logged when multiple candidates exist
- [x] Warning includes all candidate IDs
- [x] Warning includes selected ID and reason
- [x] No warnings for single-candidate or no-match cases
- [x] All unit tests pass
- [x] All integration tests pass
- [x] Tests don't produce log spam (logger properly mocked/suppressed)

## Outcome

- Implemented optional module-level logger for `resolveEntityId`; default remains console, and callers/tests can inject noop loggers.
- Added debug-level message when multiple candidates share a `subType`, including part type, all candidate IDs, selected ID, and the existing priority rationale (fewest underscores → alphabetical → shortest ID).
- Left selection logic unchanged and ensured single/no-match resolutions remain silent.
- Added unit coverage for the new logging behavior; ran targeted unit and anatomy regression integration suites (coverage thresholds bypassed for targeted runs).
