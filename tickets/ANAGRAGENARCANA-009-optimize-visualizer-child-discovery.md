# ANAGRAGENARCANA-009: Optimize Visualizer Child Discovery

## Metadata
- **ID**: ANAGRAGENARCANA-009
- **Priority**: LOW
- **Severity**: P9
- **Effort**: Medium
- **Source**: `reports/anatomy-graph-generation-architecture-analysis.md` - R9
- **Related Issue**: LOW-02 (O(n²) Child Discovery in Visualizer)

---

## Problem Statement

The anatomy visualizer uses an O(n²) algorithm for discovering parent-child relationships. For each node, it iterates ALL unvisited entities to find children. This causes slow rendering for large anatomies with 100+ parts.

### Current Implementation

```javascript
// src/domUI/anatomy-renderer/VisualizationComposer.js:320-358
for (const partId of allPartIds) {  // O(n) per node
  if (!visited.has(partId)) {
    // Check if this is a child of the current node
    const parentComponent = entity.getComponent('core:parent');
    if (parentComponent?.entityId === currentNodeId) {
      // Found a child
    }
  }
}
```

**Complexity**: O(n²) where n = number of anatomy parts

For a humanoid with ~50 parts: ~2,500 iterations
For a complex creature with ~200 parts: ~40,000 iterations

---

## Affected Files

| File | Line(s) | Change Type |
|------|---------|-------------|
| `src/domUI/anatomy-renderer/VisualizationComposer.js` | 320-358 | Optimize algorithm |

---

## Implementation Steps

### Step 1: Build Parent-to-Children Index

Create an index during the initial entity iteration:

```javascript
/**
 * Builds a parent-to-children index from the entity list.
 * This allows O(1) child lookup instead of O(n) iteration.
 *
 * @param {Map<string, Entity>} entities - All anatomy entities
 * @returns {Map<string, string[]>} Parent ID -> Child IDs mapping
 */
#buildParentChildIndex(entities) {
  /** @type {Map<string, string[]>} */
  const parentToChildren = new Map();

  for (const [entityId, entity] of entities) {
    const parentComponent = entity.getComponent('core:parent');
    const parentId = parentComponent?.entityId;

    if (parentId) {
      const children = parentToChildren.get(parentId) || [];
      children.push(entityId);
      parentToChildren.set(parentId, children);
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
    const parentComponent = entity.getComponent('core:parent');
    if (parentComponent?.entityId === currentNodeId) {
      children.push(partId);
    }
  }
}

// After (O(1) lookup + O(k) iteration where k = number of children)
const children = this.#parentChildIndex.get(currentNodeId) || [];
for (const childId of children) {
  if (!visited.has(childId)) {
    // Process child
  }
}
```

### Step 3: Integrate Index Building into Composition

Build the index once at the start of composition:

```javascript
async compose(anatomyGraph, options = {}) {
  // Build index once - O(n)
  this.#parentChildIndex = this.#buildParentChildIndex(anatomyGraph.entities);

  // Rest of composition now benefits from O(1) child lookups
  await this.#buildVisualizationTree(anatomyGraph.rootId);
}
```

### Step 4: Handle Orphaned Entities

The index building should also detect orphaned entities:

```javascript
#buildParentChildIndex(entities) {
  const parentToChildren = new Map();
  const orphans = [];

  for (const [entityId, entity] of entities) {
    const parentComponent = entity.getComponent('core:parent');
    const parentId = parentComponent?.entityId;

    if (parentId) {
      // Entity has a parent
      if (!entities.has(parentId)) {
        // Parent doesn't exist - orphan
        orphans.push({ entityId, missingParent: parentId });
      } else {
        const children = parentToChildren.get(parentId) || [];
        children.push(entityId);
        parentToChildren.set(parentId, children);
      }
    }
  }

  if (orphans.length > 0) {
    this.#logger.warn(
      `Found ${orphans.length} orphaned entities with missing parents`,
      { orphans }
    );
  }

  return parentToChildren;
}
```

### Step 5: Clear Index After Use

Clean up the index when composition completes:

```javascript
async compose(anatomyGraph, options = {}) {
  try {
    this.#parentChildIndex = this.#buildParentChildIndex(anatomyGraph.entities);
    // ... composition logic
  } finally {
    this.#parentChildIndex = null;  // Allow garbage collection
  }
}
```

---

## Complexity Analysis

| Operation | Before | After |
|-----------|--------|-------|
| Build index | N/A | O(n) - one-time |
| Find children of one node | O(n) | O(1) lookup + O(k) children |
| Process entire tree | O(n²) | O(n) |

**Memory Trade-off**: Additional O(n) space for the index Map

---

## Testing Requirements

### Unit Tests

Create/update tests in `tests/unit/domUI/anatomy-renderer/VisualizationComposer.test.js`:

1. **Test: Should build correct parent-child index**
```javascript
it('should build parent-child index correctly', () => {
  const entities = new Map([
    ['root', createMockEntity('root', null)],
    ['child1', createMockEntity('child1', 'root')],
    ['child2', createMockEntity('child2', 'root')],
    ['grandchild', createMockEntity('grandchild', 'child1')]
  ]);

  const composer = new VisualizationComposer({ /* deps */ });
  const index = composer.#buildParentChildIndex(entities);

  expect(index.get('root')).toEqual(['child1', 'child2']);
  expect(index.get('child1')).toEqual(['grandchild']);
  expect(index.get('child2')).toBeUndefined();
});
```

2. **Test: Should handle entities with no children**
```javascript
it('should handle leaf nodes correctly', () => {
  const entities = new Map([
    ['root', createMockEntity('root', null)],
    ['leaf', createMockEntity('leaf', 'root')]
  ]);

  const composer = new VisualizationComposer({ /* deps */ });
  const index = composer.#buildParentChildIndex(entities);

  expect(index.get('leaf')).toBeUndefined();
  expect(index.get('root')).toEqual(['leaf']);
});
```

3. **Test: Should detect orphaned entities**
```javascript
it('should log warning for orphaned entities', () => {
  const mockLogger = { warn: jest.fn() };
  const entities = new Map([
    ['root', createMockEntity('root', null)],
    ['orphan', createMockEntity('orphan', 'nonexistent-parent')]
  ]);

  const composer = new VisualizationComposer({ logger: mockLogger });
  composer.#buildParentChildIndex(entities);

  expect(mockLogger.warn).toHaveBeenCalledWith(
    expect.stringContaining('orphaned entities'),
    expect.objectContaining({ orphans: expect.any(Array) })
  );
});
```

4. **Test: Should produce same visualization result as before**
```javascript
it('should produce identical output to original algorithm', async () => {
  const anatomyGraph = createComplexAnatomyGraph(50);

  const composerOld = new VisualizationComposerOld({ /* deps */ });
  const composerNew = new VisualizationComposer({ /* deps */ });

  const resultOld = await composerOld.compose(anatomyGraph);
  const resultNew = await composerNew.compose(anatomyGraph);

  expect(resultNew).toEqual(resultOld);
});
```

### Performance Tests

Create tests in `tests/performance/domUI/VisualizationComposer.performance.test.js`:

1. **Test: Should scale linearly with entity count**
```javascript
it('should scale linearly with entity count', async () => {
  const composer = new VisualizationComposer({ /* deps */ });

  // Test with increasing entity counts
  const times = [];
  for (const count of [10, 50, 100, 200, 500]) {
    const graph = createAnatomyGraph(count);
    const start = performance.now();
    await composer.compose(graph);
    const duration = performance.now() - start;
    times.push({ count, duration });
  }

  // Verify roughly linear scaling (not quadratic)
  const ratio500to100 = times[4].duration / times[2].duration;
  expect(ratio500to100).toBeLessThan(10); // Should be ~5 for linear, not ~25 for quadratic
});
```

2. **Test: Should handle large anatomies within timeout**
```javascript
it('should render 200-part anatomy in under 100ms', async () => {
  const graph = createAnatomyGraph(200);
  const composer = new VisualizationComposer({ /* deps */ });

  const start = performance.now();
  await composer.compose(graph);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(100);
});
```

---

## Acceptance Criteria

- [ ] `#buildParentChildIndex()` method implemented
- [ ] Index built once at start of `compose()`
- [ ] Child discovery uses index lookup instead of full iteration
- [ ] Index cleared after composition completes
- [ ] Orphaned entities detected and logged
- [ ] Unit tests verify correct index construction
- [ ] Unit tests verify same output as original algorithm
- [ ] Performance test confirms linear scaling
- [ ] Large anatomy (200+ parts) renders in under 100ms
- [ ] All existing tests pass

---

## Dependencies

- Can be implemented alongside ANAGRAGENARCANA-008 (name collision handling)

---

## Notes

- This is a performance optimization for large anatomies
- Low priority because most anatomies have <50 parts
- The index approach is standard for tree visualization
- Memory overhead is minimal (Map with n entries of small arrays)
- Consider profiling before/after to quantify improvement
- Could potentially reuse the index for other operations (e.g., tree traversal)
