# ANAGRAGENARCANA-008: Add Name Collision Handling in Visualizer

## Metadata

- **ID**: ANAGRAGENARCANA-008
- **Priority**: LOW
- **Severity**: P8
- **Effort**: Low
- **Source**: `reports/anatomy-graph-generation-architecture-analysis.md` - R8
- **Related Issue**: LOW-01 (Visualization Name Collision)

---

## Problem Statement

Two anatomy parts with the same `core:name.text` value are indistinguishable in the visualizer. This causes user confusion when viewing anatomy graphs that have multiple instances of similar parts (e.g., "finger" appearing 10 times, or "left leg" and "right leg" both showing as "leg").

### Current Behavior

```javascript
// src/domUI/anatomy-renderer/VisualizationComposer.js:293
name = nameComponent?.text || id;
```

When multiple nodes share the same name, they all display identically, making it impossible to distinguish between them in the graph visualization.

---

## Affected Files

| File                                                              | Line(s)                        | Change Type            |
| ----------------------------------------------------------------- | ------------------------------ | ---------------------- |
| `src/domUI/anatomy-renderer/VisualizationComposer.js`             | ~110, ~195, ~291-296, ~501-506 | Modify name resolution |
| `tests/unit/domUI/anatomy-renderer/VisualizationComposer.test.js` | New tests                      | Add test coverage      |

---

## Implementation Steps

### Step 1: Add Name Usage Tracking

Add a private field after the existing private fields (around line 110):

```javascript
/** @type {Map<string, number>} */
#nameUsageCount = new Map();
```

Add a reset method:

```javascript
/**
 * Resets name tracking for a new visualization.
 * @private
 */
#resetNameTracking() {
  this.#nameUsageCount.clear();
}
```

### Step 2: Create Unique Display Name Generator

Add a method to generate unique display names:

```javascript
/**
 * Generates a unique display name, appending an index if the name is already used.
 *
 * @private
 * @param {string} baseName - The base name from the entity
 * @returns {string} Unique display name
 */
#getUniqueDisplayName(baseName) {
  const currentCount = this.#nameUsageCount.get(baseName) || 0;
  this.#nameUsageCount.set(baseName, currentCount + 1);

  if (currentCount === 0) {
    // First occurrence - use base name without suffix
    return baseName;
  }

  // Subsequent occurrences - append index
  return `${baseName} [${currentCount + 1}]`;
}
```

### Step 3: Integrate into Node Creation (TWO locations)

**Location 1** - In `buildGraphData()` around line 291-296:

```javascript
const baseName = nameComponent?.text || id;
const displayName = this.#getUniqueDisplayName(baseName);
const node = new AnatomyNode(
  id,
  displayName, // Use unique display name
  partComponent?.subType || 'unknown',
  depth
);
node.baseName = baseName; // Keep original for tooltips
```

**Location 2** - In `#handleUnconnectedParts()` around line 501-506:

```javascript
const baseName = nameComponent?.text || name || id;
const displayName = this.#getUniqueDisplayName(baseName);
const node = new AnatomyNode(
  id,
  displayName, // Use unique display name
  partComponent?.subType || 'unknown',
  0
);
node.baseName = baseName; // Keep original for tooltips
```

### Step 4: Reset Tracking in clear()

Add reset call in `clear()` method (around line 195):

```javascript
// Clear data
this.#nodes.clear();
this.#edges = [];
this.#resetNameTracking(); // Reset name tracking for next visualization
```

### Step 5: Update Tooltip to Use baseName

Update the tooltip display (line 576) to prefer `baseName` if available:

```javascript
<div class="tooltip-header">
  ${DomUtils.escapeHtml(node.baseName || node.name)}
</div>
```

---

## Alternative Approaches

### Option A: Index Suffix (Recommended)

```
finger [1], finger [2], finger [3]
```

- Pros: Clear, consistent, minimal visual noise
- Cons: Numbers may not be meaningful

### Option B: Parent Context

```
left_hand/finger, right_hand/finger
```

- Pros: Provides structural context
- Cons: Can get long with deep hierarchies

### Option C: Entity ID Suffix

```
finger (entity-abc123)
```

- Pros: Guaranteed unique
- Cons: Technical/ugly, takes up space

### Option D: Hybrid

```
finger [left_hand], finger [right_hand]
```

- Pros: Meaningful context
- Cons: Requires parent name lookup

**Recommendation**: Start with Option A (index suffix), consider Option D as future enhancement.

---

## Testing Requirements

### Unit Tests

Create/update tests in `tests/unit/domUI/anatomy-renderer/VisualizationComposer.test.js`:

**Note**: Tests use `buildGraphData(bodyData)` method with mock entity manager, not a non-existent `buildNodes()` method.

1. **Test: Should append index to duplicate names**

```javascript
it('should append index to nodes with duplicate names', async () => {
  // Setup mock entities with same name
  mockEntityManager.getEntityInstance.mockImplementation((id) => {
    const entities = {
      'root-id': createMockEntity('root-id', { 'core:name': { text: 'root' } }),
      'finger-1': createMockEntity('finger-1', {
        'core:name': { text: 'finger' },
        'anatomy:joint': { parentId: 'root-id', socketId: 'socket1' },
      }),
      'finger-2': createMockEntity('finger-2', {
        'core:name': { text: 'finger' },
        'anatomy:joint': { parentId: 'root-id', socketId: 'socket2' },
      }),
      'finger-3': createMockEntity('finger-3', {
        'core:name': { text: 'finger' },
        'anatomy:joint': { parentId: 'root-id', socketId: 'socket3' },
      }),
    };
    return Promise.resolve(entities[id]);
  });

  const bodyData = {
    root: 'root-id',
    parts: { finger1: 'finger-1', finger2: 'finger-2', finger3: 'finger-3' },
  };

  await composer.buildGraphData(bodyData);

  const nodes = Array.from(composer.getNodes().values());
  const fingerNodes = nodes.filter((n) => n.baseName === 'finger');

  expect(fingerNodes[0].name).toBe('finger');
  expect(fingerNodes[1].name).toBe('finger [2]');
  expect(fingerNodes[2].name).toBe('finger [3]');
});
```

2. **Test: Should not add index to unique names**

```javascript
it('should not add index when names are unique', async () => {
  // Setup mock entities with unique names
  mockEntityManager.getEntityInstance.mockImplementation((id) => {
    const entities = {
      'root-id': createMockEntity('root-id', {
        'core:name': { text: 'torso' },
      }),
      'head-id': createMockEntity('head-id', {
        'core:name': { text: 'head' },
        'anatomy:joint': { parentId: 'root-id', socketId: 'head-socket' },
      }),
      'arm-id': createMockEntity('arm-id', {
        'core:name': { text: 'left_arm' },
        'anatomy:joint': { parentId: 'root-id', socketId: 'arm-socket' },
      }),
    };
    return Promise.resolve(entities[id]);
  });

  const bodyData = {
    root: 'root-id',
    parts: { head: 'head-id', arm: 'arm-id' },
  };

  await composer.buildGraphData(bodyData);

  const nodes = composer.getNodes();
  expect(nodes.get('root-id').name).toBe('torso');
  expect(nodes.get('head-id').name).toBe('head');
  expect(nodes.get('arm-id').name).toBe('left_arm');
});
```

3. **Test: Should reset name tracking between visualizations**

```javascript
it('should reset name tracking for new visualization', async () => {
  // First visualization with "finger" entities
  await composer.renderGraph('root1', bodyData1);
  // clear() is called internally by renderGraph, which resets tracking

  // Second visualization - names should restart counting
  await composer.renderGraph('root2', bodyData2);

  // Verify nodes from second render start fresh (finger, not finger [3])
});
```

4. **Test: Should preserve base name for details/tooltips**

```javascript
it('should preserve base name in node metadata', async () => {
  // Setup two entities with same name
  // ... mock setup

  await composer.buildGraphData(bodyData);

  const nodes = composer.getNodes();
  const fingerNode1 = nodes.get('finger-1');
  const fingerNode2 = nodes.get('finger-2');

  expect(fingerNode1.baseName).toBe('finger');
  expect(fingerNode2.baseName).toBe('finger');
  expect(fingerNode1.name).toBe('finger');
  expect(fingerNode2.name).toBe('finger [2]');
});
```

### Visual Testing

1. Load an anatomy with multiple same-named parts (e.g., fingers, toes)
2. Verify each instance is distinguishable in the visualization
3. Verify hover/tooltip shows correct information

---

## Acceptance Criteria

- [x] `#nameUsageCount` Map added for tracking name occurrences
- [x] `#getUniqueDisplayName()` method implemented
- [x] `#resetNameTracking()` called at start of each visualization
- [x] First occurrence of a name shows without suffix
- [x] Subsequent occurrences show with `[n]` suffix
- [x] Base name preserved in node metadata for tooltips
- [x] Unit tests cover duplicate and unique name scenarios
- [x] Visual testing confirms distinguishable nodes
- [x] All existing tests pass

---

## Dependencies

- None (can be implemented independently)

---

## Notes

- This is a UI improvement that enhances usability
- Low priority because the visualizer still functions correctly
- Consider user feedback on preferred naming approach
- Future enhancement could allow user to toggle between naming strategies
- The approach should work well with the performance optimization in ANAGRAGENARCANA-009

---

## Outcome

**Status**: ✅ COMPLETED

### Ticket Assumptions Corrected

During implementation, several incorrect assumptions in the original ticket were identified and corrected:

1. **Method Name Error**: Ticket assumed `buildNodes(entities)` method exists → Actually `buildGraphData(bodyData)`
2. **Single vs. Dual Location**: Ticket only addressed one node creation point → Reality: nodes created in TWO places (BFS loop ~line 293, unconnected parts handler ~line 501)
3. **Reset Location**: Ticket suggested `compose()` method → Actually `clear()` method for consistency

### Implementation Summary

**Files Modified**:

- `src/domUI/anatomy-renderer/VisualizationComposer.js` - Added name collision handling infrastructure
- `tests/unit/domUI/anatomy-renderer/VisualizationComposer.test.js` - Added 5 new test cases

**Changes Made**:

1. Added `#nameUsageCount` private Map field for tracking name occurrences
2. Added `#resetNameTracking()` private method to clear tracking state
3. Added `#getUniqueDisplayName(baseName)` private method with index suffix logic
4. Modified node creation at BOTH locations to use unique display names
5. Added `node.baseName` property to preserve original name for tooltips
6. Added reset call in `clear()` method
7. Updated tooltip to display `baseName || name`

### New Tests Added

| Test                                                            | Rationale                                              |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| `should append index to nodes with duplicate names`             | Core requirement - validates `[2]`, `[3]` suffix logic |
| `should not add index when names are unique`                    | No regression - first occurrence stays clean           |
| `should reset name tracking between visualizations via clear()` | Prevents index carryover across renders                |
| `should preserve baseName in node metadata for tooltips`        | Enables tooltips to show original name                 |
| `should handle name collisions in unconnected parts`            | Covers second node creation location                   |

### Test Results

All 71 tests pass (66 existing + 5 new).

### Public API Preserved

No breaking changes to public API. The `baseName` property is additive.
