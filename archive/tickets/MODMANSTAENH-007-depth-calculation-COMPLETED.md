# MODMANSTAENH-007: Dependency Depth Calculation

**Status:** Completed
**Priority:** Medium (Phase 2)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-001
**Parent:** MODMANSTAENH-000

---

## Outcome

### What Was Planned
- Add `getDependencyDepthAnalysis()` method to `ModStatisticsService`
- Add private helper `#calculateDepth()` for recursive depth calculation
- Add `DepthAnalysis` typedef
- Add 8 test cases covering basic functionality, edge cases, caching, and cycle handling

### What Was Actually Changed

**Files Modified:**
1. `src/modManager/services/ModStatisticsService.js`
   - Added `DepthAnalysis` typedef (lines 27-34)
   - Added `getDependencyDepthAnalysis()` public method (lines 220-273)
   - Added `#calculateDepth()` private helper method (lines 283-321)

2. `tests/unit/modManager/services/ModStatisticsService.test.js`
   - Added 10 test cases (lines 561-881) covering:
     - Empty graph returns zeros
     - Single mod with no deps = depth 1
     - Linear chain depth calculation
     - Longest path selection with multiple paths
     - Average depth calculation
     - Inactive mod exclusion
     - Caching behavior
     - Circular dependency handling
     - Cache validity marking
     - Average rounding to one decimal place (extra test)

### Deviations from Plan
- **Additional test**: Added "should round average depth to one decimal place" to explicitly verify the rounding behavior
- **Minor implementation detail**: Added `this.#cache.isValid = true` in the empty graph case (the ticket's pseudocode omitted this)
- All ticket assumptions about the codebase were correct - no corrections were needed

### Verification Results
- All 38 `ModStatisticsService` tests pass
- All 678 `modManager` unit tests pass
- No ESLint errors

---

## Objective

Implement `getDependencyDepthAnalysis()` method in ModStatisticsService that calculates the maximum dependency chain length, finds the deepest chain, and computes average depth across all active mods.

---

## Files to Touch

### Modified Files
- `src/modManager/services/ModStatisticsService.js` (add method)
- `tests/unit/modManager/services/ModStatisticsService.test.js` (add tests)

---

## Out of Scope

**DO NOT modify:**
- `src/modManager/services/ModGraphService.js` - use existing API only
- `src/modManager/views/SummaryPanelView.js` - UI is ticket MODMANSTAENH-010
- `src/modManager/ModManagerBootstrap.js` - already registered
- `css/mod-manager.css` - no styling changes
- Any other calculation methods (separate tickets)

---

## Implementation Details

### Method Signature

```javascript
/**
 * @typedef {Object} DepthAnalysis
 * @property {number} maxDepth - Maximum chain length in the graph
 * @property {string[]} deepestChain - Mod IDs in the deepest chain (leaf to root)
 * @property {number} averageDepth - Average depth across all mods
 */

/**
 * Analyze dependency chain depths
 * @returns {DepthAnalysis} Depth analysis results
 */
getDependencyDepthAnalysis() {
  // Check cache
  if (this.#cache.isValid && this.#cache.data.depth) {
    return this.#cache.data.depth;
  }

  const nodes = this.#modGraphService.getAllNodes();

  if (nodes.size === 0) {
    const result = { maxDepth: 0, deepestChain: [], averageDepth: 0 };
    this.#cache.data.depth = result;
    return result;
  }

  // Calculate depth for each mod
  const depths = new Map();
  const chains = new Map();

  for (const [modId, node] of nodes) {
    if (node.status === 'inactive') continue;
    const { depth, chain } = this.#calculateDepth(modId, nodes, new Set());
    depths.set(modId, depth);
    chains.set(modId, chain);
  }

  // Find maximum depth and deepest chain
  let maxDepth = 0;
  let deepestChain = [];

  for (const [modId, depth] of depths) {
    if (depth > maxDepth) {
      maxDepth = depth;
      deepestChain = chains.get(modId);
    }
  }

  // Calculate average
  const depthValues = Array.from(depths.values());
  const averageDepth = depthValues.length > 0
    ? depthValues.reduce((sum, d) => sum + d, 0) / depthValues.length
    : 0;

  const result = {
    maxDepth,
    deepestChain,
    averageDepth: Math.round(averageDepth * 10) / 10 // One decimal place
  };

  this.#cache.data.depth = result;
  return result;
}

/**
 * Calculate depth for a single mod (recursive helper)
 * @param {string} modId - Mod to calculate depth for
 * @param {Map} nodes - All nodes map
 * @param {Set} visited - Visited nodes (for cycle detection)
 * @returns {{depth: number, chain: string[]}}
 */
#calculateDepth(modId, nodes, visited) {
  // Cycle detection
  if (visited.has(modId)) {
    return { depth: 0, chain: [] };
  }

  const node = nodes.get(modId);
  if (!node || node.status === 'inactive') {
    return { depth: 0, chain: [] };
  }

  // No dependencies = depth of 1
  if (!node.dependencies || node.dependencies.length === 0) {
    return { depth: 1, chain: [modId] };
  }

  visited.add(modId);

  // Find max depth among dependencies
  let maxChildDepth = 0;
  let maxChildChain = [];

  for (const depId of node.dependencies) {
    const { depth, chain } = this.#calculateDepth(depId, nodes, new Set(visited));
    if (depth > maxChildDepth) {
      maxChildDepth = depth;
      maxChildChain = chain;
    }
  }

  return {
    depth: 1 + maxChildDepth,
    chain: [modId, ...maxChildChain]
  };
}
```

### Data Flow

```
ModGraphService.getAllNodes()
    → Map<modId, {id, dependencies[], dependents[], status}>
    → For each active mod, calculate depth recursively
    → Track deepest chain
    → Compute average
    → Return {maxDepth, deepestChain[], averageDepth}
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --no-coverage --verbose
```

### Specific Test Cases Required

1. **Basic functionality**
   - Returns correct max depth for simple chain
   - Returns correct deepest chain order (leaf to root)
   - Calculates correct average depth

2. **Edge cases**
   - Empty graph returns zeros
   - Single mod with no deps returns depth 1
   - Mods with multiple dependency paths uses longest path

3. **Cycle handling**
   - Circular dependencies don't cause infinite loop
   - Returns sensible result for cycles

4. **Caching**
   - Multiple calls return cached results
   - `invalidateCache()` clears depth cache

### Invariants That Must Remain True

1. `ModGraphService.getAllNodes()` returns unchanged structure
2. Method is pure (no side effects on graph)
3. Results are deterministic for same input
4. Existing ModStatisticsService tests still pass

---

## Verification Steps

```bash
# 1. Run depth-specific tests
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --testNamePattern="getDependencyDepthAnalysis" --no-coverage --verbose

# 2. Run all ModStatisticsService tests
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --no-coverage --verbose

# 3. Run full mod manager tests
NODE_ENV=test npx jest tests/unit/modManager/ --no-coverage --silent
```
