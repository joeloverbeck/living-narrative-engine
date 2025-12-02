# ENTRESROB-004: Warning Logging for Ambiguous Resolution

**Priority:** P2
**Effort:** Small (2-3 hours)
**Status:** Not Started
**Dependencies:** ENTRESROB-003 (deterministic resolution must be in place first)

## Report Reference

See `specs/entity-resolution-robustness.md` for full context.

## Problem Statement

When `resolveEntityId` encounters multiple entities with the same `subType`, it silently selects one based on priority rules. This makes debugging difficult because developers don't know:
- That multiple candidates existed
- Which entity was selected and why
- What the alternatives were

## Objective

Add informational logging when `resolveEntityId` encounters multiple candidates, providing observability for debugging and auditing entity resolution decisions.

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
# All unit tests pass
npm run test:unit -- --testPathPattern="socketExtractor"

# All integration tests pass
npm run test:integration

# No warnings appear in test output (logger should be mockable/optional)
```

### Functional Requirements

1. **Warning logged** when `candidates.length > 1`
2. **Warning includes**:
   - The `partType` being resolved
   - All candidate entity IDs
   - The selected entity ID
   - Brief explanation of selection criteria
3. **No warning** for single-candidate resolutions
4. **No warning** for no-match resolutions (null return)
5. **Logger is optional** - defaults to console but can be suppressed

### Invariants That Must Remain True

1. Logging is informational only, does not change control flow
2. Logger is optional, defaults to console
3. Function signature unchanged (logger passed via module-level setter or optional param)
4. All existing tests continue to pass
5. Tests can run without log spam (logger must be mockable)

## Implementation Notes

### Approach 1: Optional Logger Parameter

Add an optional logger parameter to internal functions:

```javascript
async function resolveEntityId(partType, dataRegistry, logger = console) {
  // ... existing code ...

  if (candidates.length > 1) {
    const candidateIds = candidates.map(e => e.id);
    const selectedId = candidates[0].id;
    logger.debug?.(
      `[socketExtractor] Multiple entities with subType "${partType}": ` +
      `${candidateIds.join(', ')}. Selected "${selectedId}" ` +
      `(priority: fewest underscores, shortest ID, alphabetical).`
    );
  }

  return candidates[0].id;
}
```

### Approach 2: Module-Level Logger Setter

```javascript
let _logger = console;

export function setLogger(logger) {
  _logger = logger;
}

async function resolveEntityId(partType, dataRegistry) {
  // ... use _logger.debug?.(...) ...
}
```

### Log Message Format

```
[socketExtractor] Multiple entities with subType "head": anatomy:humanoid_head, anatomy:humanoid_head_bearded, anatomy:humanoid_head_plain. Selected "anatomy:humanoid_head" (priority: fewest underscores, shortest ID, alphabetical).
```

### Caller Updates

If using Approach 1, update callers to pass logger:
- `extractSlotChildSockets` (line ~150)
- `extractLimbSetSockets` (line ~255)
- `extractAppendageSockets` (line ~310)
- `extractComposedSlots` (line ~345)

These functions already have access to context that may include a logger.

## Verification Commands

```bash
# Unit tests pass (no log spam expected)
npm run test:unit -- --testPathPattern="socketExtractor"

# Integration tests pass
npm run test:integration

# Manual verification: run validation and check for log output
node -e "
const { extractHierarchicalSockets } = require('./src/anatomy/validation/socketExtractor.js');
// ... setup and call to see logs ...
"
```

## Success Metrics

- [ ] Warning logged when multiple candidates exist
- [ ] Warning includes all candidate IDs
- [ ] Warning includes selected ID and reason
- [ ] No warnings for single-candidate or no-match cases
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Tests don't produce log spam (logger properly mocked/suppressed)
