# MODMANSTAENH-008: Transitive Footprint Calculation

**Status:** Not Started
**Priority:** Medium (Phase 2)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-001
**Parent:** MODMANSTAENH-000

---

## Objective

Implement `getTransitiveDependencyFootprints()` method in ModStatisticsService that calculates, for each explicit mod, how many transitive dependencies it brings, including overlap analysis across all explicit mods.

---

## Files to Touch

### Modified Files
- `src/modManager/services/ModStatisticsService.js` (add method)
- `tests/unit/modManager/services/ModStatisticsService.test.js` (add tests)

---

## Out of Scope

**DO NOT modify:**
- `src/modManager/services/ModGraphService.js` - use existing API only
- `src/modManager/views/SummaryPanelView.js` - UI is ticket MODMANSTAENH-011
- `src/modManager/ModManagerBootstrap.js` - already registered
- `css/mod-manager.css` - no styling changes
- Any other calculation methods (separate tickets)

---

## Implementation Details

### Method Signature

```javascript
/**
 * @typedef {Object} ModFootprint
 * @property {string} modId - Explicit mod ID
 * @property {string[]} dependencies - List of transitive dependency IDs
 * @property {number} count - Number of transitive dependencies
 */

/**
 * @typedef {Object} FootprintAnalysis
 * @property {ModFootprint[]} footprints - Per-mod footprint data sorted by count desc
 * @property {number} totalUniqueDeps - Total unique dependencies across all explicit mods
 * @property {number} sharedDepsCount - Number of dependencies shared by 2+ explicit mods
 * @property {number} overlapPercentage - Percentage of deps that are shared (0-100)
 */

/**
 * Get transitive dependency footprint for each explicit mod
 * @returns {FootprintAnalysis} Footprint analysis with overlap data
 */
getTransitiveDependencyFootprints() {
  // Check cache
  if (this.#cache.isValid && this.#cache.data.footprints) {
    return this.#cache.data.footprints;
  }

  const nodes = this.#modGraphService.getAllNodes();

  // Find explicit mods
  const explicitMods = [];
  for (const [modId, node] of nodes) {
    if (node.status === 'explicit') {
      explicitMods.push(modId);
    }
  }

  // Calculate footprint for each explicit mod
  const footprints = [];
  const allDeps = new Set();
  const depCounts = new Map(); // Count how many explicit mods depend on each dep

  for (const modId of explicitMods) {
    const deps = this.#collectTransitiveDeps(modId, nodes, new Set());

    footprints.push({
      modId,
      dependencies: Array.from(deps),
      count: deps.size
    });

    // Track for overlap analysis
    for (const depId of deps) {
      allDeps.add(depId);
      depCounts.set(depId, (depCounts.get(depId) || 0) + 1);
    }
  }

  // Sort by count descending
  footprints.sort((a, b) => b.count - a.count);

  // Calculate shared dependencies (used by 2+ explicit mods)
  let sharedDepsCount = 0;
  for (const count of depCounts.values()) {
    if (count >= 2) {
      sharedDepsCount++;
    }
  }

  const totalUniqueDeps = allDeps.size;
  const overlapPercentage = totalUniqueDeps > 0
    ? Math.round((sharedDepsCount / totalUniqueDeps) * 100)
    : 0;

  const result = {
    footprints,
    totalUniqueDeps,
    sharedDepsCount,
    overlapPercentage
  };

  this.#cache.data.footprints = result;
  return result;
}

/**
 * Collect all transitive dependencies for a mod
 * @param {string} modId - Starting mod
 * @param {Map} nodes - All nodes
 * @param {Set} visited - Already visited (cycle prevention)
 * @returns {Set<string>} All dependency mod IDs
 */
#collectTransitiveDeps(modId, nodes, visited) {
  const result = new Set();

  if (visited.has(modId)) {
    return result;
  }
  visited.add(modId);

  const node = nodes.get(modId);
  if (!node || node.status === 'inactive') {
    return result;
  }

  for (const depId of node.dependencies || []) {
    if (depId !== modId) { // Don't include self
      result.add(depId);
      // Recursively add transitive deps
      const transitive = this.#collectTransitiveDeps(depId, nodes, visited);
      for (const transitiveId of transitive) {
        result.add(transitiveId);
      }
    }
  }

  return result;
}
```

### Data Flow

```
ModGraphService.getAllNodes()
    → Find explicit mods
    → For each explicit mod:
        → Recursively collect all dependencies
        → Track which deps are shared
    → Calculate overlap percentage
    → Return {footprints[], totalUniqueDeps, sharedDepsCount, overlapPercentage}
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --no-coverage --verbose
```

### Specific Test Cases Required

1. **Basic functionality**
   - Returns footprint for each explicit mod
   - Includes all transitive dependencies
   - Sorted by count descending

2. **Overlap calculation**
   - Correctly counts shared dependencies
   - Calculates accurate overlap percentage
   - Handles no overlap case (0%)

3. **Edge cases**
   - No explicit mods returns empty footprints
   - Single explicit mod with no deps returns empty dependencies
   - Circular dependencies handled

4. **Caching**
   - Multiple calls return cached results
   - `invalidateCache()` clears footprints cache

### Invariants That Must Remain True

1. `ModGraphService.getAllNodes()` returns unchanged structure
2. Method is pure (no side effects on graph)
3. Results are deterministic for same input
4. Existing ModStatisticsService tests still pass

---

## Verification Steps

```bash
# 1. Run footprint-specific tests
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --testNamePattern="getTransitiveDependencyFootprints" --no-coverage --verbose

# 2. Run all ModStatisticsService tests
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --no-coverage --verbose

# 3. Run full mod manager tests
NODE_ENV=test npx jest tests/unit/modManager/ --no-coverage --silent
```

---

## Test Cases to Add

```javascript
describe('getTransitiveDependencyFootprints', () => {
  it('should return empty footprints for no explicit mods', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: [], status: 'core' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getTransitiveDependencyFootprints();

    expect(result.footprints).toEqual([]);
    expect(result.totalUniqueDeps).toBe(0);
    expect(result.overlapPercentage).toBe(0);
  });

  it('should calculate correct footprint for single explicit mod', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: ['anatomy'], status: 'core' }],
      ['anatomy', { id: 'anatomy', dependencies: ['core'], dependents: ['explicit1'], status: 'dependency' }],
      ['explicit1', { id: 'explicit1', dependencies: ['anatomy'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getTransitiveDependencyFootprints();

    expect(result.footprints).toHaveLength(1);
    expect(result.footprints[0].modId).toBe('explicit1');
    expect(result.footprints[0].count).toBe(2); // anatomy + core
    expect(result.footprints[0].dependencies).toContain('anatomy');
    expect(result.footprints[0].dependencies).toContain('core');
  });

  it('should sort footprints by count descending', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: [], status: 'core' }],
      ['dep1', { id: 'dep1', dependencies: ['core'], dependents: [], status: 'dependency' }],
      ['dep2', { id: 'dep2', dependencies: ['core'], dependents: [], status: 'dependency' }],
      ['small', { id: 'small', dependencies: ['core'], dependents: [], status: 'explicit' }],
      ['large', { id: 'large', dependencies: ['core', 'dep1', 'dep2'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getTransitiveDependencyFootprints();

    expect(result.footprints[0].modId).toBe('large');
    expect(result.footprints[1].modId).toBe('small');
  });

  it('should calculate correct overlap percentage', () => {
    // Two explicit mods both depending on 'core' (shared)
    // explicit1 also depends on dep1, explicit2 on dep2 (unique)
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: [], status: 'core' }],
      ['dep1', { id: 'dep1', dependencies: [], dependents: [], status: 'dependency' }],
      ['dep2', { id: 'dep2', dependencies: [], dependents: [], status: 'dependency' }],
      ['explicit1', { id: 'explicit1', dependencies: ['core', 'dep1'], dependents: [], status: 'explicit' }],
      ['explicit2', { id: 'explicit2', dependencies: ['core', 'dep2'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getTransitiveDependencyFootprints();

    expect(result.totalUniqueDeps).toBe(3); // core, dep1, dep2
    expect(result.sharedDepsCount).toBe(1); // only core is shared
    expect(result.overlapPercentage).toBe(33); // 1/3 ≈ 33%
  });

  it('should report 100% overlap when all deps are shared', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: [], status: 'core' }],
      ['explicit1', { id: 'explicit1', dependencies: ['core'], dependents: [], status: 'explicit' }],
      ['explicit2', { id: 'explicit2', dependencies: ['core'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getTransitiveDependencyFootprints();

    expect(result.overlapPercentage).toBe(100);
  });

  it('should report 0% overlap when no deps are shared', () => {
    const nodes = new Map([
      ['dep1', { id: 'dep1', dependencies: [], dependents: [], status: 'dependency' }],
      ['dep2', { id: 'dep2', dependencies: [], dependents: [], status: 'dependency' }],
      ['explicit1', { id: 'explicit1', dependencies: ['dep1'], dependents: [], status: 'explicit' }],
      ['explicit2', { id: 'explicit2', dependencies: ['dep2'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getTransitiveDependencyFootprints();

    expect(result.sharedDepsCount).toBe(0);
    expect(result.overlapPercentage).toBe(0);
  });

  it('should include transitive dependencies', () => {
    // explicit1 → dep1 → core (transitive)
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: ['dep1'], status: 'core' }],
      ['dep1', { id: 'dep1', dependencies: ['core'], dependents: ['explicit1'], status: 'dependency' }],
      ['explicit1', { id: 'explicit1', dependencies: ['dep1'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getTransitiveDependencyFootprints();

    expect(result.footprints[0].dependencies).toContain('core');
    expect(result.footprints[0].dependencies).toContain('dep1');
    expect(result.footprints[0].count).toBe(2);
  });

  it('should cache results until invalidation', () => {
    const nodes = new Map([
      ['explicit1', { id: 'explicit1', dependencies: [], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result1 = service.getTransitiveDependencyFootprints();
    const result2 = service.getTransitiveDependencyFootprints();

    expect(result1).toBe(result2);
    expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(1);

    service.invalidateCache();
    service.getTransitiveDependencyFootprints();

    expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(2);
  });
});
```
