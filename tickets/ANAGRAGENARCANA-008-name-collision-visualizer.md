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
name = nameComponent?.text || id
```

When multiple nodes share the same name, they all display identically, making it impossible to distinguish between them in the graph visualization.

---

## Affected Files

| File | Line(s) | Change Type |
|------|---------|-------------|
| `src/domUI/anatomy-renderer/VisualizationComposer.js` | ~293 | Modify name resolution |

---

## Implementation Steps

### Step 1: Add Name Usage Tracking

Add a Map to track name usage counts:

```javascript
class VisualizationComposer {
  /** @type {Map<string, number>} */
  #nameUsageCount = new Map();

  /**
   * Resets name tracking for a new visualization.
   */
  #resetNameTracking() {
    this.#nameUsageCount.clear();
  }
}
```

### Step 2: Create Unique Display Name Generator

Add a method to generate unique display names:

```javascript
/**
 * Generates a unique display name, appending an index if the name is already used.
 *
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

### Step 3: Integrate into Node Creation

Update the node creation logic to use unique names:

```javascript
// In the node building logic (around line 293)
const nameComponent = entity.getComponent('core:name');
const baseName = nameComponent?.text || id;
const displayName = this.#getUniqueDisplayName(baseName);

// Use displayName for visual representation
node.label = displayName;
node.baseName = baseName;  // Keep original for tooltips/details
```

### Step 4: Reset Tracking at Visualization Start

Ensure name tracking is reset when starting a new visualization:

```javascript
async compose(anatomyGraph, options = {}) {
  this.#resetNameTracking();

  // ... rest of composition logic
}
```

### Step 5: Add Tooltip with Full Context (Optional Enhancement)

Provide additional context on hover:

```javascript
node.tooltip = `${baseName}\nID: ${id}\nInstance: ${currentCount + 1}`;
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

1. **Test: Should append index to duplicate names**
```javascript
it('should append index to nodes with duplicate names', () => {
  const composer = new VisualizationComposer({ /* deps */ });

  // Simulate multiple entities with same name
  const entities = [
    { id: 'entity-1', components: { 'core:name': { text: 'finger' } } },
    { id: 'entity-2', components: { 'core:name': { text: 'finger' } } },
    { id: 'entity-3', components: { 'core:name': { text: 'finger' } } },
  ];

  const nodes = composer.buildNodes(entities);

  expect(nodes[0].label).toBe('finger');
  expect(nodes[1].label).toBe('finger [2]');
  expect(nodes[2].label).toBe('finger [3]');
});
```

2. **Test: Should not add index to unique names**
```javascript
it('should not add index when names are unique', () => {
  const composer = new VisualizationComposer({ /* deps */ });

  const entities = [
    { id: 'entity-1', components: { 'core:name': { text: 'head' } } },
    { id: 'entity-2', components: { 'core:name': { text: 'torso' } } },
    { id: 'entity-3', components: { 'core:name': { text: 'left_arm' } } },
  ];

  const nodes = composer.buildNodes(entities);

  expect(nodes[0].label).toBe('head');
  expect(nodes[1].label).toBe('torso');
  expect(nodes[2].label).toBe('left_arm');
});
```

3. **Test: Should reset name tracking between visualizations**
```javascript
it('should reset name tracking for new visualization', () => {
  const composer = new VisualizationComposer({ /* deps */ });

  // First visualization
  await composer.compose(graph1);
  // Names: finger, finger [2]

  // Second visualization
  await composer.compose(graph2);
  // Names should restart: finger, finger [2] (not finger [3], finger [4])

  // Verify by checking output nodes
});
```

4. **Test: Should preserve base name for details/tooltips**
```javascript
it('should preserve base name in node metadata', () => {
  const composer = new VisualizationComposer({ /* deps */ });

  const entities = [
    { id: 'entity-1', components: { 'core:name': { text: 'finger' } } },
    { id: 'entity-2', components: { 'core:name': { text: 'finger' } } },
  ];

  const nodes = composer.buildNodes(entities);

  expect(nodes[0].baseName).toBe('finger');
  expect(nodes[1].baseName).toBe('finger');
  expect(nodes[0].label).toBe('finger');
  expect(nodes[1].label).toBe('finger [2]');
});
```

### Visual Testing

1. Load an anatomy with multiple same-named parts (e.g., fingers, toes)
2. Verify each instance is distinguishable in the visualization
3. Verify hover/tooltip shows correct information

---

## Acceptance Criteria

- [ ] `#nameUsageCount` Map added for tracking name occurrences
- [ ] `#getUniqueDisplayName()` method implemented
- [ ] `#resetNameTracking()` called at start of each visualization
- [ ] First occurrence of a name shows without suffix
- [ ] Subsequent occurrences show with `[n]` suffix
- [ ] Base name preserved in node metadata for tooltips
- [ ] Unit tests cover duplicate and unique name scenarios
- [ ] Visual testing confirms distinguishable nodes
- [ ] All existing tests pass

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
