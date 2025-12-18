# MODMANSTAENH-007: Dependency Depth Calculation

**Status:** Not Started
**Priority:** Medium (Phase 2)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-001
**Parent:** MODMANSTAENH-000

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

---

## Test Cases to Add

```javascript
describe('getDependencyDepthAnalysis', () => {
  it('should return zeros for empty graph', () => {
    mockModGraphService.getAllNodes.mockReturnValue(new Map());

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getDependencyDepthAnalysis();

    expect(result.maxDepth).toBe(0);
    expect(result.deepestChain).toEqual([]);
    expect(result.averageDepth).toBe(0);
  });

  it('should return depth 1 for mod with no dependencies', () => {
    const nodes = new Map([
      ['standalone', { id: 'standalone', dependencies: [], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getDependencyDepthAnalysis();

    expect(result.maxDepth).toBe(1);
    expect(result.deepestChain).toEqual(['standalone']);
  });

  it('should calculate correct depth for linear chain', () => {
    // Chain: mod-c → mod-b → mod-a (depth 3)
    const nodes = new Map([
      ['mod-a', { id: 'mod-a', dependencies: [], dependents: ['mod-b'], status: 'core' }],
      ['mod-b', { id: 'mod-b', dependencies: ['mod-a'], dependents: ['mod-c'], status: 'dependency' }],
      ['mod-c', { id: 'mod-c', dependencies: ['mod-b'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getDependencyDepthAnalysis();

    expect(result.maxDepth).toBe(3);
    expect(result.deepestChain).toEqual(['mod-c', 'mod-b', 'mod-a']);
  });

  it('should find longest path when multiple paths exist', () => {
    // mod-d depends on mod-b (short) and mod-c (long via mod-a)
    const nodes = new Map([
      ['mod-a', { id: 'mod-a', dependencies: [], dependents: ['mod-c'], status: 'core' }],
      ['mod-b', { id: 'mod-b', dependencies: [], dependents: ['mod-d'], status: 'dependency' }],
      ['mod-c', { id: 'mod-c', dependencies: ['mod-a'], dependents: ['mod-d'], status: 'dependency' }],
      ['mod-d', { id: 'mod-d', dependencies: ['mod-b', 'mod-c'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getDependencyDepthAnalysis();

    expect(result.maxDepth).toBe(3); // mod-d → mod-c → mod-a
    expect(result.deepestChain[0]).toBe('mod-d');
    expect(result.deepestChain).toContain('mod-c');
    expect(result.deepestChain).toContain('mod-a');
  });

  it('should calculate correct average depth', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: [], status: 'core' }], // depth 1
      ['dep', { id: 'dep', dependencies: ['core'], dependents: [], status: 'dependency' }], // depth 2
      ['leaf', { id: 'leaf', dependencies: ['dep'], dependents: [], status: 'explicit' }], // depth 3
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getDependencyDepthAnalysis();

    expect(result.averageDepth).toBe(2); // (1 + 2 + 3) / 3 = 2
  });

  it('should exclude inactive mods from analysis', () => {
    const nodes = new Map([
      ['active', { id: 'active', dependencies: [], dependents: [], status: 'explicit' }],
      ['inactive', { id: 'inactive', dependencies: ['deep1', 'deep2'], dependents: [], status: 'inactive' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getDependencyDepthAnalysis();

    expect(result.maxDepth).toBe(1);
    expect(result.deepestChain).toEqual(['active']);
  });

  it('should cache results until invalidation', () => {
    const nodes = new Map([
      ['mod', { id: 'mod', dependencies: [], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result1 = service.getDependencyDepthAnalysis();
    const result2 = service.getDependencyDepthAnalysis();

    expect(result1).toBe(result2);
    expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(1);

    service.invalidateCache();
    service.getDependencyDepthAnalysis();

    expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(2);
  });

  it('should handle circular dependencies without infinite loop', () => {
    const nodes = new Map([
      ['mod-a', { id: 'mod-a', dependencies: ['mod-b'], dependents: ['mod-b'], status: 'explicit' }],
      ['mod-b', { id: 'mod-b', dependencies: ['mod-a'], dependents: ['mod-a'], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    // Should complete without hanging
    const result = service.getDependencyDepthAnalysis();

    expect(result.maxDepth).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.deepestChain)).toBe(true);
  });
});
```
