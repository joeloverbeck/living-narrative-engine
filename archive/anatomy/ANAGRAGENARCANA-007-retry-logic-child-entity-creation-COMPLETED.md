# ANAGRAGENARCANA-007: Add Retry Logic to Child Entity Creation

## Metadata

- **ID**: ANAGRAGENARCANA-007
- **Priority**: MEDIUM
- **Severity**: P7
- **Effort**: Low
- **Source**: `reports/anatomy-graph-generation-architecture-analysis.md` - R7
- **Related Issue**: HIGH-02 (No Root Entity Retry for Child Entities)
- **Status**: ✅ COMPLETED

---

## Problem Statement

Root entity creation has exponential backoff retry logic (max 5 retries) for **entity verification** after creation, but child entity creation only has a single retry with a fixed delay. This inconsistency means that if the entity manager is slow or temporarily unavailable during graph construction, child entities might fail to verify while the root succeeds, leading to incomplete anatomy graphs.

### Current Implementation (CORRECTED)

```javascript
// src/anatomy/entityGraphBuilder.js

// Root entity - HAS exponential backoff retry for VERIFICATION (5 retries)
async createRootEntity(rootDefinitionId, recipe, ownerId, componentOverrides = {}) {
  const rootEntity = await this.#entityManager.createEntityInstance(actualRootDefinitionId, { componentOverrides });

  // Verification with exponential backoff retry
  let verifyEntity = this.#entityManager.getEntityInstance(rootEntity.id);
  let retries = 0;
  const maxRetries = 5;

  while (!verifyEntity && retries < maxRetries) {
    const delay = 10 * Math.pow(2, retries); // 10ms, 20ms, 40ms, 80ms, 160ms
    await new Promise(resolve => setTimeout(resolve, delay));
    verifyEntity = this.#entityManager.getEntityInstance(rootEntity.id);
    retries++;
  }
}

// Child entity - ONLY 1 retry with fixed 10ms delay (INCONSISTENT)
async createAndAttachPart(parentId, socketId, partDefinitionId, ...) {
  const childEntity = await this.#entityManager.createEntityInstance(partDefinitionId, { componentOverrides });

  const verifyChildEntity = this.#entityManager.getEntityInstance(childEntity.id);
  if (!verifyChildEntity) {
    await new Promise(resolve => setTimeout(resolve, 10)); // Single fixed retry
    const retryVerify = this.#entityManager.getEntityInstance(childEntity.id);
    if (!retryVerify) throw new Error('...');
  }
}
```

---

## Affected Files

| File                                            | Line(s)                                | Change Type                                             |
| ----------------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| `src/anatomy/entityGraphBuilder.js`             | `createAndAttachPart` (lines ~210-222) | Extend verification retry to 5 with exponential backoff |
| `tests/unit/anatomy/entityGraphBuilder.test.js` | lines 475-540                          | Update existing retry tests                             |

---

## Implementation Steps (CORRECTED)

### Step 1: Update createAndAttachPart Verification Retry

Replace single-retry verification with exponential backoff matching `createRootEntity`:

**Before (1 retry, 10ms fixed):**

```javascript
const verifyChildEntity = this.#entityManager.getEntityInstance(childEntity.id);
if (!verifyChildEntity) {
  this.#logger.error(
    `EntityGraphBuilder: Created child entity ${childEntity.id} not immediately available`,
    { entityId: childEntity.id, partDefinitionId, parentId }
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  const retryVerify = this.#entityManager.getEntityInstance(childEntity.id);
  if (!retryVerify) {
    throw new Error(
      `Child entity creation-verification race condition: ${childEntity.id}`
    );
  }
}
```

**After (5 retries, exponential backoff):**

```javascript
let verifyEntity = this.#entityManager.getEntityInstance(childEntity.id);
let retries = 0;
const maxRetries = 5;

while (!verifyEntity && retries < maxRetries) {
  this.#logger.warn(
    `EntityGraphBuilder: Created child entity ${childEntity.id} not immediately available, retry ${retries + 1}/${maxRetries}`,
    { entityId: childEntity.id, partDefinitionId, parentId }
  );
  const delay = 10 * Math.pow(2, retries);
  await new Promise((resolve) => setTimeout(resolve, delay));
  verifyEntity = this.#entityManager.getEntityInstance(childEntity.id);
  retries++;
}

if (!verifyEntity) {
  this.#logger.error(
    `EntityGraphBuilder: Child entity creation-verification failed after ${maxRetries} retries`,
    { entityId: childEntity.id, partDefinitionId, parentId }
  );
  throw new Error(
    `Child entity creation-verification race condition: ${childEntity.id}`
  );
}
```

### Step 2: Update Existing Tests

**Modify test "retries child verification before continuing":**

- Mock `getEntityInstance` to fail 2+ times before success
- Add timer advances for exponential backoff

**Modify test "returns null when child verification fails after retry":**

- Mock `getEntityInstance` to fail all 6 attempts (initial + 5 retries)
- Update call count assertion from 2 to 6

---

## Testing Requirements (CORRECTED)

### Unit Tests

**Update existing tests** in `tests/unit/anatomy/entityGraphBuilder.test.js`:

1. **Test: "retries child verification before continuing" (lines 475-506)**
   - Update mock to return null multiple times before success
   - Add timer advances for exponential backoff pattern (10, 20, 40ms...)

2. **Test: "returns null when child verification fails after retry" (lines 508-540)**
   - Ensure mock returns null 6 times (initial + 5 retries)
   - Update getEntityInstance call count assertion from 2 to 6
   - Verify logger.error message updated for 5-retry failure

---

## Acceptance Criteria (CORRECTED)

- [x] `createAndAttachPart` uses same retry pattern as `createRootEntity`
- [x] Exponential backoff implemented (10 \* 2^attempt ms): 10, 20, 40, 80, 160ms
- [x] Max 5 retries for verification (matching root entity)
- [x] Retry attempts logged as warnings with retry count
- [x] Final failure logged as error with context
- [x] Unit tests updated for 5-retry verification behavior
- [x] All existing tests pass

---

## Dependencies

- None (minimal change, self-contained)

---

## Notes

- This is a **MUCH SIMPLER** fix than originally scoped
- No new helper method required - just replicate existing root entity pattern
- No constructor changes or configuration needed
- The existing retry mechanism is for VERIFICATION, not CREATION
- Both root and child entity creation calls succeed immediately; retries handle async availability

---

## Outcome

### What Changed vs Originally Planned

**Original Ticket Assumptions (INCORRECT)**:

- Claimed root entity wraps `createEntity()` in retry loop for CREATION
- Claimed child entity has "NO retry logic"
- Used incorrect API names (`createEntity()` vs `createEntityInstance()`)

**Actual Situation Discovered**:

- Both root and child call `createEntityInstance()` once - no creation retries
- Retries are for VERIFICATION via `getEntityInstance()`, not creation
- Root entity already had 5 retries with exponential backoff
- Child entity had 1 retry with 10ms fixed delay (not zero as claimed)

**Actual Fix Implemented**:
Extended child entity verification retry from 1 retry/10ms to 5 retries with exponential backoff (10, 20, 40, 80, 160ms) to match root entity behavior.

### Files Modified

| File                                                               | Change Description                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `src/anatomy/entityGraphBuilder.js`                                | Updated `createAndAttachPart` verification retry (lines 207-233) |
| `tests/unit/anatomy/entityGraphBuilder.test.js`                    | Updated 2 existing tests for 5-retry behavior                    |
| `tickets/ANAGRAGENARCANA-007-retry-logic-child-entity-creation.md` | Corrected assumptions before implementation                      |

### Tests Updated

1. **"retries child verification with exponential backoff before succeeding"** (was: "retries child verification before continuing")
   - Now tests multiple retries (2) with exponential backoff timing
   - Verifies warn logs contain retry count ("retry 1/5", "retry 2/5")

2. **"returns null when child verification fails after all 5 retries"** (was: "returns null when child verification fails after retry")
   - Now tests all 6 calls (initial + 5 retries) with full timer advancement
   - Verifies error log message reflects 5-retry failure

### Test Results

All 24 tests pass ✅
