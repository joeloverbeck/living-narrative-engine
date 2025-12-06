# ANAGRAGENARCANA-009: Optimize Visualizer Child Discovery

## Metadata

- **ID**: ANAGRAGENARCANA-009
- **Priority**: LOW
- **Severity**: P9
- **Effort**: Medium
- **Source**: `reports/anatomy-graph-generation-architecture-analysis.md` - R9
- **Related Issue**: LOW-02 (O(n²) Child Discovery in Visualizer)
- **Status**: COMPLETED ✅

---

## Problem Statement

The anatomy visualizer uses an O(n²) algorithm for discovering parent-child relationships. For each node, it iterates ALL unvisited entities to find children. This causes slow rendering for large anatomies with 100+ parts.

### Current Implementation

```javascript
// src/domUI/anatomy-renderer/VisualizationComposer.js:326-365
for (const partId of allPartIds) {
  // O(n) per node
  if (!visited.has(partId)) {
    try {
      const partEntity = await this.#entityManager.getEntityInstance(partId);
      if (partEntity) {
        const partJoint = partEntity.getComponentData('anatomy:joint');
        if (partJoint && partJoint.parentId === id) {
          children.push(partId);
          queue.push({ id: partId, depth: depth + 1, parent: id });
        }
      }
    } catch (err) {
      this.#logger.warn(`Failed to check entity ${partId}:`, err);
    }
  }
}
```

**Note**: The original ticket incorrectly referenced `core:parent` component. The actual implementation uses `anatomy:joint` with a `parentId` field.

**Complexity**: O(n²) where n = number of anatomy parts

For a humanoid with ~50 parts: ~2,500 iterations
For a complex creature with ~200 parts: ~40,000 iterations

---

## Affected Files

| File                                                  | Line(s) | Change Type        |
| ----------------------------------------------------- | ------- | ------------------ |
| `src/domUI/anatomy-renderer/VisualizationComposer.js` | 326-365 | Optimize algorithm |

---

## Implementation Steps

### Step 1: Build Parent-to-Children Index

Create an index during the initial entity iteration:

```javascript
/**
 * Builds a parent-to-children index from the entity list.
 * This allows O(1) child lookup instead of O(n) iteration.
 *
 * @param {Set<string>} allPartIds - All anatomy part IDs
 * @returns {Promise<Map<string, string[]>>} Parent ID -> Child IDs mapping
 */
async #buildParentChildIndex(allPartIds) {
  /** @type {Map<string, string[]>} */
  const parentToChildren = new Map();

  for (const partId of allPartIds) {
    try {
      const entity = await this.#entityManager.getEntityInstance(partId);
      const joint = entity?.getComponentData('anatomy:joint');
      if (joint?.parentId) {
        const children = parentToChildren.get(joint.parentId) || [];
        children.push(partId);
        parentToChildren.set(joint.parentId, children);
      }
    } catch (err) {
      this.#logger.warn(`Failed to index entity ${partId}:`, err);
    }
  }

  return parentToChildren;
}
```

### Step 2: Use Index for Child Discovery

Replace the O(n) loop with O(1) index lookup:

```javascript
// Before (O(n) per node)
for (const partId of allPartIds) {
  if (!visited.has(partId)) {
    const partEntity = await this.#entityManager.getEntityInstance(partId);
    const partJoint = partEntity?.getComponentData('anatomy:joint');
    if (partJoint && partJoint.parentId === id) {
      children.push(partId);
      queue.push({ id: partId, depth: depth + 1, parent: id });
    }
  }
}

// After (O(1) lookup + O(k) iteration where k = number of children)
const childIds = parentChildIndex.get(id) || [];
for (const childId of childIds) {
  if (!visited.has(childId)) {
    queue.push({ id: childId, depth: depth + 1, parent: id });
    // Diagnostic logging preserved
  }
}
```

### Step 3: Integrate Index Building into buildGraphData

Build the index once at the start of `buildGraphData()`:

```javascript
async buildGraphData(bodyData) {
  // ... existing setup code ...

  // Collect all part IDs
  const allPartIds = new Set();
  if (bodyData.parts) {
    Object.values(bodyData.parts).forEach((partId) => allPartIds.add(partId));
  }
  allPartIds.add(bodyData.root);

  // Build parent-child index once - O(n)
  const parentChildIndex = await this.#buildParentChildIndex(allPartIds);

  // BFS traversal now uses O(1) child lookups
  while (queue.length > 0) {
    // ... existing node processing ...

    // O(1) child lookup instead of O(n) iteration
    const childIds = parentChildIndex.get(id) || [];
    for (const childId of childIds) {
      if (!visited.has(childId)) {
        queue.push({ id: childId, depth: depth + 1, parent: id });
      }
    }
  }
}
```

### Step 4: Orphan Detection Preserved

Orphan detection is already handled by `#handleUnconnectedParts()` at the end of `buildGraphData()`. No changes needed - the index approach doesn't affect this existing functionality.

---

## Complexity Analysis

| Operation                 | Before | After                       |
| ------------------------- | ------ | --------------------------- |
| Build index               | N/A    | O(n) - one-time             |
| Find children of one node | O(n)   | O(1) lookup + O(k) children |
| Process entire tree       | O(n²)  | O(n)                        |

**Memory Trade-off**: Additional O(n) space for the index Map

---

## Testing Requirements

### Unit Tests

Update tests in `tests/unit/domUI/anatomy-renderer/VisualizationComposer.test.js`:

1. **Test: Index correctly maps parents to children via anatomy:joint**
   - Validates that `#buildParentChildIndex` correctly builds the Map
   - Uses mock entities with `anatomy:joint.parentId` component data

2. **Test: Index handles leaf nodes (entities with no children)**
   - Verifies entities without children are not in the index

3. **Test: Index handles errors gracefully when entity fetch fails**
   - Ensures failed entity fetches are logged and skipped

4. **Test: buildGraphData produces same node/edge structure**
   - Verifies the optimization doesn't change the output graph

### Performance Tests

Create tests in `tests/performance/domUI/VisualizationComposer.performance.test.js`:

1. **Test: Should scale linearly with entity count**
   - Tests with increasing entity counts (10, 50, 100, 200)
   - Verifies ratio200/ratio50 < 10 (linear, not quadratic)

2. **Test: Should handle large anatomies within timeout**
   - Ensures 200-part anatomy renders in reasonable time

---

## Acceptance Criteria

- [x] `#buildParentChildIndex()` method implemented
- [x] Index built once at start of `buildGraphData()`
- [x] Child discovery uses index lookup instead of full iteration
- [x] Index is local variable (auto-cleaned by GC)
- [x] Unit tests verify correct index construction
- [x] Unit tests verify same output as original algorithm
- [x] Performance test confirms linear scaling
- [x] All existing tests pass

---

## Dependencies

- Can be implemented alongside ANAGRAGENARCANA-008 (name collision handling)

---

## Outcome

### Implementation Summary

The O(n²) child discovery algorithm was successfully optimized to O(n) by introducing a parent-to-children index.

### Changes Made

1. **Added `#buildParentChildIndex(allPartIds)` method** (`src/domUI/anatomy-renderer/VisualizationComposer.js`)
   - Iterates all parts once to build Map<parentId, childId[]>
   - Handles entity fetch errors gracefully with logging

2. **Modified `buildGraphData()` method**
   - Builds index before BFS traversal
   - Replaced O(n) child iteration loop with O(1) index lookup
   - Preserved orphan detection functionality

3. **Added 7 unit tests for index optimization** (`tests/unit/domUI/anatomy-renderer/VisualizationComposer.test.js`)
   - Index building with debug logging
   - O(1) child discovery verification
   - Leaf node handling
   - Error graceful handling during index building
   - Same graph structure verification
   - Deep tree structure handling
   - Null joint component handling

4. **Fixed 6 existing unit tests**
   - Changed from `mockResolvedValueOnce` to `mockImplementation` pattern
   - Required because new algorithm calls `getEntityInstance` in two phases (index building + BFS)

5. **Created performance test suite** (`tests/performance/domUI/VisualizationComposer.performance.test.js`)
   - Linear scaling verification (ratio check between 50 and 100 entities)
   - 200-part anatomy within 500ms
   - Wide tree (star topology) efficiency
   - Index building overhead verification

### Test Results

- **Unit tests**: 78 passed
- **Performance tests**: 4 passed
- **Total**: 82 tests passing

### Performance Improvements

| Operation                 | Before | After                       |
| ------------------------- | ------ | --------------------------- |
| Build index               | N/A    | O(n) - one-time             |
| Find children of one node | O(n)   | O(1) lookup + O(k) children |
| Process entire tree       | O(n²)  | O(n)                        |

For a 200-part anatomy: ~40,000 iterations → ~400 iterations

---

## Notes

- This is a performance optimization for large anatomies
- Low priority because most anatomies have <50 parts
- The index approach is standard for tree visualization
- Memory overhead is minimal (Map with n entries of small arrays)
- Consider profiling before/after to quantify improvement
- Could potentially reuse the index for other operations (e.g., tree traversal)
