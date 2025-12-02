# ENTRESROB-003: Deterministic Entity Resolution with Priority Rules

**Priority:** P0
**Effort:** Medium (4-5 hours)
**Status:** Not Started
**Dependencies:** ENTRESROB-001 (unit tests must be in place first)

## Report Reference

See `specs/entity-resolution-robustness.md` for full context.

## Problem Statement

The `resolveEntityId` function in `src/anatomy/validation/socketExtractor.js` (lines 376-399) returns the **first** entity matching a `partType`. Since entity iteration order depends on registry load order (non-deterministic), this causes unstable entity resolution.

With 13+ entities having `subType: "head"`, the function sometimes returns `anatomy:humanoid_face_bearded_full_trimmed` instead of `anatomy:humanoid_head`, causing `SOCKET_NOT_FOUND_ON_PARENT` errors for `brain_socket`.

## Objective

Modify `resolveEntityId` to use deterministic priority rules that prefer base entities over variants, ensuring stable resolution regardless of registry load order.

## Files to Touch

- `src/anatomy/validation/socketExtractor.js` (MODIFY - lines 376-399)

## Out of Scope

- **DO NOT** add logging (that's ENTRESROB-004)
- **DO NOT** create new files
- **DO NOT** modify tests (unit tests should already pass from ENTRESROB-001)
- **DO NOT** change function signature
- **DO NOT** add configuration options or external dependencies
- **DO NOT** modify slot library files
- **DO NOT** modify entity definition files

## Acceptance Criteria

### Specific Tests That Must Pass

```bash
# All unit tests pass
npm run test:unit -- --testPathPattern="socketExtractor"

# All integration tests pass
npm run test:integration

# Regression test specifically
npm run test:integration -- --testPathPattern="recipeValidationComparison"
```

### Functional Requirements

1. `resolveEntityId("head", registry)` returns `anatomy:humanoid_head` (base entity)
2. `resolveEntityId("torso", registry)` returns a base torso entity (e.g., `anatomy:human_male_torso`)
3. Function returns the same entity ID on every call with identical inputs
4. `socket_slot_compatibility` appears in passed checks for human_male recipe

### Priority Rules to Implement

1. **Fewer underscores wins**: Prefer `humanoid_head` over `humanoid_head_bearded`
2. **Alphabetical order**: Prefer `humanoid_head` over `kraken_head` (fixes regression where shorter `kraken_head` was selected)
3. **Shorter ID wins** (final tie-breaker): Keep as fallback

### Invariants That Must Remain True

1. Function signature unchanged: `async function resolveEntityId(partType, dataRegistry) -> Promise<string | null>`
2. Returns `null` for null/undefined `partType` or `dataRegistry`
3. Returns `null` when no matching entity found
4. No external dependencies added
5. Deterministic ordering across Node.js versions and platforms
6. Single-match case still returns that single match

## Implementation Notes

### Current Code (lines 376-399)

```javascript
async function resolveEntityId(partType, dataRegistry) {
  if (!dataRegistry || !partType) {
    return null;
  }

  let allEntities = [];
  if (typeof dataRegistry.getAll === 'function') {
    allEntities = dataRegistry.getAll('entityDefinitions') || [];
  } else if (typeof dataRegistry.getAllEntityDefinitions === 'function') {
    allEntities = dataRegistry.getAllEntityDefinitions() || [];
  }

  // PROBLEM: Returns FIRST match (order-dependent)
  for (const entity of allEntities) {
    const partComponent = entity?.components?.['anatomy:part'];
    if (partComponent?.subType === partType) {
      return entity.id;
    }
  }

  return null;
}
```

### Proposed Implementation

```javascript
async function resolveEntityId(partType, dataRegistry) {
  if (!dataRegistry || !partType) {
    return null;
  }

  let allEntities = [];
  if (typeof dataRegistry.getAll === 'function') {
    allEntities = dataRegistry.getAll('entityDefinitions') || [];
  } else if (typeof dataRegistry.getAllEntityDefinitions === 'function') {
    allEntities = dataRegistry.getAllEntityDefinitions() || [];
  }

  // Find all entities with matching subType
  const candidates = allEntities.filter(entity => {
    const partComponent = entity?.components?.['anatomy:part'];
    return partComponent?.subType === partType;
  });

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0].id;
  }

  // Multiple candidates: apply deterministic priority rules
  candidates.sort((a, b) => {
    const aId = a.id || '';
    const bId = b.id || '';

    // Rule 1: Fewer underscores = higher priority (base entities)
    const aUnderscores = (aId.match(/_/g) || []).length;
    const bUnderscores = (bId.match(/_/g) || []).length;

    if (aUnderscores !== bUnderscores) {
      return aUnderscores - bUnderscores;
    }

    // Rule 2: Alphabetical for determinism and to prefer humanoid_head over kraken_head
    const alpha = aId.localeCompare(bId);
    if (alpha !== 0) {
        return alpha;
    }

    // Rule 3: Shorter ID = higher priority (fallback)
    return aId.length - bId.length;
  });

  return candidates[0].id;
}
```

### Key Design Decisions

1. **Filter first, then sort**: Collect all candidates before sorting to avoid iterating multiple times
2. **Stable sort**: JavaScript's `.sort()` is stable in modern engines, but using `localeCompare` as final tie-breaker ensures determinism
3. **No early return in loop**: Changed from `for` loop with early return to `filter` + `sort` + `return first`

## Verification Commands

```bash
# Unit tests
npm run test:unit -- --testPathPattern="socketExtractor"

# Integration tests
npm run test:integration

# Specific regression test
npm run test:integration -- --testPathPattern="recipeValidationComparison"

# Verify socket_slot_compatibility appears
npm run test:integration -- --testPathPattern="recipeValidationComparison" 2>&1 | grep "socket_slot_compatibility"
```

## Success Metrics

- [ ] `resolveEntityId("head", registry)` returns `anatomy:humanoid_head`
- [ ] All unit tests pass (from ENTRESROB-001)
- [ ] All integration tests pass
- [ ] `recipeValidationComparison.regression.test.js` shows 10 checks, not 9
- [ ] `socket_slot_compatibility` appears in passed checks
- [ ] No new dependencies added
