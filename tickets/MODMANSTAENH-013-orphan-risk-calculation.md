# MODMANSTAENH-013: Single-Parent Dependency (Orphan Risk) Calculation

**Status:** Not Started
**Priority:** Low (Phase 3)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-001
**Parent:** MODMANSTAENH-000

---

## Objective

Implement `getSingleParentDependencies()` method in ModStatisticsService that identifies mods which have only one dependent, creating potential fragility (if the single dependent is deactivated, the dependency becomes orphaned).

---

## Files to Touch

### Modified Files
- `src/modManager/services/ModStatisticsService.js` (add method)
- `tests/unit/modManager/services/ModStatisticsService.test.js` (add tests)

---

## Out of Scope

**DO NOT modify:**
- `src/modManager/services/ModGraphService.js` - use existing API only
- `src/modManager/views/SummaryPanelView.js` - UI is ticket MODMANSTAENH-014
- `src/modManager/ModManagerBootstrap.js` - already registered
- `css/mod-manager.css` - no styling changes
- Any other calculation methods (separate tickets)

---

## Implementation Details

### Method Signature

```javascript
/**
 * @typedef {Object} OrphanRisk
 * @property {string} modId - The at-risk dependency mod ID
 * @property {string} singleDependent - The only mod depending on it
 * @property {string} status - Status of the at-risk mod ('dependency' | 'core')
 */

/**
 * @typedef {Object} OrphanRiskAnalysis
 * @property {OrphanRisk[]} atRiskMods - List of mods with only one dependent
 * @property {number} totalAtRisk - Count of at-risk mods
 * @property {number} percentageOfDeps - Percentage of dependencies that are at-risk
 */

/**
 * Find dependencies that have only one dependent (orphan risk)
 * @returns {OrphanRiskAnalysis} Analysis of single-parent dependencies
 */
getSingleParentDependencies() {
  // Check cache
  if (this.#cache.isValid && this.#cache.data.orphanRisk) {
    return this.#cache.data.orphanRisk;
  }

  const nodes = this.#modGraphService.getAllNodes();

  const atRiskMods = [];
  let totalDependencies = 0;

  for (const [modId, node] of nodes) {
    // Skip inactive mods
    if (node.status === 'inactive') continue;

    // Only look at dependencies (not explicit mods)
    if (node.status === 'explicit') continue;

    // Count as a dependency
    totalDependencies++;

    // Check if this mod has only one active dependent
    const activeDependents = (node.dependents || []).filter(depId => {
      const depNode = nodes.get(depId);
      return depNode && depNode.status !== 'inactive';
    });

    if (activeDependents.length === 1) {
      atRiskMods.push({
        modId,
        singleDependent: activeDependents[0],
        status: node.status
      });
    }
  }

  // Sort by mod ID for consistent ordering
  atRiskMods.sort((a, b) => a.modId.localeCompare(b.modId));

  const percentageOfDeps = totalDependencies > 0
    ? Math.round((atRiskMods.length / totalDependencies) * 100)
    : 0;

  const result = {
    atRiskMods,
    totalAtRisk: atRiskMods.length,
    percentageOfDeps
  };

  this.#cache.data.orphanRisk = result;
  return result;
}
```

### Data Flow

```
ModGraphService.getAllNodes()
    → Filter to non-explicit, active mods (dependencies)
    → For each dependency:
        → Count active dependents
        → If exactly 1 → mark as at-risk
    → Calculate percentage of dependencies at risk
    → Return {atRiskMods[], totalAtRisk, percentageOfDeps}
```

### Risk Classification

```
Single Dependent (at-risk):
    "If 'clothing' is the only mod using 'anatomy', disabling 'clothing'
     would orphan 'anatomy'"

Multiple Dependents (safe):
    "If both 'clothing' and 'combat' use 'anatomy', disabling one still
     keeps 'anatomy' needed"
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --no-coverage --verbose
```

### Specific Test Cases Required

1. **Basic functionality**
   - Identifies mods with single dependent correctly
   - Excludes explicit mods from analysis
   - Returns correct percentage calculation

2. **Dependent tracking**
   - Correctly identifies the single dependent
   - Filters out inactive dependents
   - Handles mods with no dependents

3. **Edge cases**
   - Empty graph returns empty list
   - All mods have multiple dependents (0% at-risk)
   - All dependencies have single dependent (100% at-risk)

4. **Caching**
   - Multiple calls return cached results
   - `invalidateCache()` clears orphan risk cache

### Invariants That Must Remain True

1. `ModGraphService.getAllNodes()` returns unchanged structure
2. Method is pure (no side effects on graph)
3. Results are deterministic for same input
4. Existing ModStatisticsService tests still pass

---

## Verification Steps

```bash
# 1. Run orphan risk-specific tests
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --testNamePattern="getSingleParentDependencies" --no-coverage --verbose

# 2. Run all ModStatisticsService tests
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --no-coverage --verbose

# 3. Run full mod manager tests
NODE_ENV=test npx jest tests/unit/modManager/ --no-coverage --silent
```

---

## Test Cases to Add

```javascript
describe('getSingleParentDependencies', () => {
  it('should return empty list for empty graph', () => {
    mockModGraphService.getAllNodes.mockReturnValue(new Map());

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getSingleParentDependencies();

    expect(result.atRiskMods).toEqual([]);
    expect(result.totalAtRisk).toBe(0);
    expect(result.percentageOfDeps).toBe(0);
  });

  it('should identify mod with single dependent as at-risk', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: ['anatomy'], status: 'core' }],
      ['anatomy', { id: 'anatomy', dependencies: ['core'], dependents: ['clothing'], status: 'dependency' }],
      ['clothing', { id: 'clothing', dependencies: ['anatomy'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getSingleParentDependencies();

    // 'anatomy' is at-risk because only 'clothing' depends on it
    expect(result.atRiskMods).toHaveLength(1);
    expect(result.atRiskMods[0].modId).toBe('anatomy');
    expect(result.atRiskMods[0].singleDependent).toBe('clothing');
  });

  it('should not include mods with multiple dependents', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: ['anatomy', 'combat'], status: 'core' }],
      ['anatomy', { id: 'anatomy', dependencies: ['core'], dependents: ['clothing'], status: 'dependency' }],
      ['combat', { id: 'combat', dependencies: ['core'], dependents: [], status: 'explicit' }],
      ['clothing', { id: 'clothing', dependencies: ['anatomy'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getSingleParentDependencies();

    // 'core' has 2 dependents, should not be at-risk
    // 'anatomy' has 1 dependent, should be at-risk
    expect(result.atRiskMods.map(m => m.modId)).not.toContain('core');
    expect(result.atRiskMods.map(m => m.modId)).toContain('anatomy');
  });

  it('should exclude explicit mods from analysis', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: ['explicit1'], status: 'core' }],
      ['explicit1', { id: 'explicit1', dependencies: ['core'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getSingleParentDependencies();

    // explicit1 should not be in at-risk list (it's explicit, not a dependency)
    expect(result.atRiskMods.map(m => m.modId)).not.toContain('explicit1');
    // core is at-risk (only explicit1 depends on it)
    expect(result.atRiskMods.map(m => m.modId)).toContain('core');
  });

  it('should filter out inactive dependents when counting', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: ['active', 'inactive'], status: 'core' }],
      ['active', { id: 'active', dependencies: ['core'], dependents: [], status: 'explicit' }],
      ['inactive', { id: 'inactive', dependencies: ['core'], dependents: [], status: 'inactive' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getSingleParentDependencies();

    // 'core' has only 1 active dependent (inactive is filtered)
    expect(result.atRiskMods).toHaveLength(1);
    expect(result.atRiskMods[0].modId).toBe('core');
    expect(result.atRiskMods[0].singleDependent).toBe('active');
  });

  it('should calculate correct percentage of dependencies at risk', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: ['dep1', 'dep2'], status: 'core' }],
      ['dep1', { id: 'dep1', dependencies: ['core'], dependents: ['explicit1'], status: 'dependency' }],
      ['dep2', { id: 'dep2', dependencies: ['core'], dependents: ['explicit1', 'explicit2'], status: 'dependency' }],
      ['explicit1', { id: 'explicit1', dependencies: ['dep1', 'dep2'], dependents: [], status: 'explicit' }],
      ['explicit2', { id: 'explicit2', dependencies: ['dep2'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getSingleParentDependencies();

    // 3 dependencies total (core, dep1, dep2)
    // 1 at-risk (dep1 - only explicit1 depends on it)
    // core has 2 dependents (dep1, dep2)
    // dep2 has 2 dependents (explicit1, explicit2)
    expect(result.totalAtRisk).toBe(1);
    expect(result.percentageOfDeps).toBe(33); // 1/3 ≈ 33%
  });

  it('should return 0% when all dependencies have multiple dependents', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: ['explicit1', 'explicit2'], status: 'core' }],
      ['explicit1', { id: 'explicit1', dependencies: ['core'], dependents: [], status: 'explicit' }],
      ['explicit2', { id: 'explicit2', dependencies: ['core'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getSingleParentDependencies();

    expect(result.atRiskMods).toEqual([]);
    expect(result.percentageOfDeps).toBe(0);
  });

  it('should include mod status in at-risk entry', () => {
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

    const result = service.getSingleParentDependencies();

    const coreEntry = result.atRiskMods.find(m => m.modId === 'core');
    const dep1Entry = result.atRiskMods.find(m => m.modId === 'dep1');

    expect(coreEntry.status).toBe('core');
    expect(dep1Entry.status).toBe('dependency');
  });

  it('should sort at-risk mods by modId', () => {
    const nodes = new Map([
      ['zebra', { id: 'zebra', dependencies: [], dependents: ['explicit1'], status: 'dependency' }],
      ['alpha', { id: 'alpha', dependencies: [], dependents: ['explicit1'], status: 'dependency' }],
      ['middle', { id: 'middle', dependencies: [], dependents: ['explicit1'], status: 'dependency' }],
      ['explicit1', { id: 'explicit1', dependencies: ['zebra', 'alpha', 'middle'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getSingleParentDependencies();

    expect(result.atRiskMods.map(m => m.modId)).toEqual(['alpha', 'middle', 'zebra']);
  });

  it('should cache results until invalidation', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], dependents: ['explicit1'], status: 'core' }],
      ['explicit1', { id: 'explicit1', dependencies: ['core'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result1 = service.getSingleParentDependencies();
    const result2 = service.getSingleParentDependencies();

    expect(result1).toBe(result2);
    expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(1);

    service.invalidateCache();
    service.getSingleParentDependencies();

    expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(2);
  });

  it('should handle mods with no dependents', () => {
    const nodes = new Map([
      ['orphan', { id: 'orphan', dependencies: [], dependents: [], status: 'dependency' }],
      ['core', { id: 'core', dependencies: [], dependents: ['explicit1'], status: 'core' }],
      ['explicit1', { id: 'explicit1', dependencies: ['core'], dependents: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getSingleParentDependencies();

    // 'orphan' has 0 dependents, not 1, so not at-risk (it's already orphaned)
    expect(result.atRiskMods.map(m => m.modId)).not.toContain('orphan');
    expect(result.atRiskMods.map(m => m.modId)).toContain('core');
  });
});
```
