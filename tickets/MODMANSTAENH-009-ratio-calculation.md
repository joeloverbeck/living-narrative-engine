# MODMANSTAENH-009: Core vs Optional Ratio Calculation

**Status:** Not Started
**Priority:** Medium (Phase 2)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-001
**Parent:** MODMANSTAENH-000

---

## Objective

Implement `getCoreOptionalRatio()` method in ModStatisticsService that calculates the ratio between foundation mods (core systems) and optional content mods, providing insight into configuration composition.

---

## Files to Touch

### Modified Files
- `src/modManager/services/ModStatisticsService.js` (add method)
- `tests/unit/modManager/services/ModStatisticsService.test.js` (add tests)

---

## Out of Scope

**DO NOT modify:**
- `src/modManager/services/ModGraphService.js` - use existing API only
- `src/modManager/views/SummaryPanelView.js` - UI is ticket MODMANSTAENH-012
- `src/modManager/ModManagerBootstrap.js` - already registered
- `css/mod-manager.css` - no styling changes
- Any other calculation methods (separate tickets)
- Category detection via mod ID parsing (deemed unreliable)

---

## Implementation Details

### Core Mod Classification

Foundation mods are classified based on the `status` field from ModGraphService:
- `status === 'core'` → Foundation mod
- `status === 'dependency'` → Foundation mod (required by explicit mods)
- `status === 'explicit'` → Optional/Content mod (user-selected)
- `status === 'inactive'` → Excluded from calculation

### Method Signature

```javascript
/**
 * @typedef {Object} RatioAnalysis
 * @property {number} foundationCount - Number of foundation mods (core + dependencies)
 * @property {number} optionalCount - Number of optional mods (explicit)
 * @property {number} totalActive - Total active mods
 * @property {number} foundationPercentage - Foundation percentage (0-100)
 * @property {number} optionalPercentage - Optional percentage (0-100)
 * @property {string[]} foundationMods - List of foundation mod IDs
 * @property {string} profile - Classification: 'foundation-heavy' | 'balanced' | 'content-heavy'
 */

/**
 * Calculate ratio of foundation vs optional mods
 * @returns {RatioAnalysis} Ratio analysis with profile classification
 */
getCoreOptionalRatio() {
  // Check cache
  if (this.#cache.isValid && this.#cache.data.ratio) {
    return this.#cache.data.ratio;
  }

  const nodes = this.#modGraphService.getAllNodes();

  const foundationMods = [];
  let optionalCount = 0;
  let totalActive = 0;

  for (const [modId, node] of nodes) {
    if (node.status === 'inactive') continue;

    totalActive++;

    if (node.status === 'core' || node.status === 'dependency') {
      foundationMods.push(modId);
    } else if (node.status === 'explicit') {
      optionalCount++;
    }
  }

  const foundationCount = foundationMods.length;
  const foundationPercentage = totalActive > 0
    ? Math.round((foundationCount / totalActive) * 100)
    : 0;
  const optionalPercentage = totalActive > 0
    ? Math.round((optionalCount / totalActive) * 100)
    : 0;

  // Classify profile
  let profile;
  if (foundationPercentage >= 60) {
    profile = 'foundation-heavy';
  } else if (optionalPercentage >= 60) {
    profile = 'content-heavy';
  } else {
    profile = 'balanced';
  }

  const result = {
    foundationCount,
    optionalCount,
    totalActive,
    foundationPercentage,
    optionalPercentage,
    foundationMods,
    profile
  };

  this.#cache.data.ratio = result;
  return result;
}
```

### Profile Classification Logic

```
foundationPercentage >= 60% → 'foundation-heavy'
    "This configuration has a strong foundation base"

optionalPercentage >= 60% → 'content-heavy'
    "This configuration is content-heavy"

Neither >= 60% → 'balanced'
    "This configuration is balanced between foundation and content"
```

### Data Flow

```
ModGraphService.getAllNodes()
    → Categorize by status (core/dependency vs explicit)
    → Calculate percentages
    → Determine profile classification
    → Return {counts, percentages, foundationMods[], profile}
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --no-coverage --verbose
```

### Specific Test Cases Required

1. **Basic functionality**
   - Correctly counts foundation mods (core + dependency)
   - Correctly counts optional mods (explicit)
   - Calculates accurate percentages

2. **Profile classification**
   - Returns 'foundation-heavy' when >= 60% foundation
   - Returns 'content-heavy' when >= 60% optional
   - Returns 'balanced' otherwise

3. **Edge cases**
   - Empty graph returns zeros
   - Only core mods returns 100% foundation
   - Inactive mods excluded from calculation

4. **Caching**
   - Multiple calls return cached results
   - `invalidateCache()` clears ratio cache

### Invariants That Must Remain True

1. `ModGraphService.getAllNodes()` returns unchanged structure
2. Method is pure (no side effects on graph)
3. foundationPercentage + optionalPercentage may not equal 100 due to rounding
4. Existing ModStatisticsService tests still pass

---

## Verification Steps

```bash
# 1. Run ratio-specific tests
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --testNamePattern="getCoreOptionalRatio" --no-coverage --verbose

# 2. Run all ModStatisticsService tests
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --no-coverage --verbose

# 3. Run full mod manager tests
NODE_ENV=test npx jest tests/unit/modManager/ --no-coverage --silent
```

---

## Test Cases to Add

```javascript
describe('getCoreOptionalRatio', () => {
  it('should return zeros for empty graph', () => {
    mockModGraphService.getAllNodes.mockReturnValue(new Map());

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getCoreOptionalRatio();

    expect(result.foundationCount).toBe(0);
    expect(result.optionalCount).toBe(0);
    expect(result.totalActive).toBe(0);
    expect(result.foundationPercentage).toBe(0);
    expect(result.optionalPercentage).toBe(0);
  });

  it('should count core and dependency as foundation', () => {
    const nodes = new Map([
      ['core', { id: 'core', dependencies: [], status: 'core' }],
      ['anatomy', { id: 'anatomy', dependencies: ['core'], status: 'dependency' }],
      ['positioning', { id: 'positioning', dependencies: ['core'], status: 'dependency' }],
      ['explicit1', { id: 'explicit1', dependencies: [], status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getCoreOptionalRatio();

    expect(result.foundationCount).toBe(3); // core + 2 dependencies
    expect(result.optionalCount).toBe(1); // 1 explicit
    expect(result.totalActive).toBe(4);
  });

  it('should calculate correct percentages', () => {
    const nodes = new Map([
      ['core', { id: 'core', status: 'core' }],
      ['dep1', { id: 'dep1', status: 'dependency' }],
      ['explicit1', { id: 'explicit1', status: 'explicit' }],
      ['explicit2', { id: 'explicit2', status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getCoreOptionalRatio();

    expect(result.foundationPercentage).toBe(50); // 2/4
    expect(result.optionalPercentage).toBe(50); // 2/4
  });

  it('should classify as foundation-heavy when >= 60% foundation', () => {
    const nodes = new Map([
      ['core', { id: 'core', status: 'core' }],
      ['dep1', { id: 'dep1', status: 'dependency' }],
      ['dep2', { id: 'dep2', status: 'dependency' }],
      ['explicit1', { id: 'explicit1', status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getCoreOptionalRatio();

    expect(result.foundationPercentage).toBe(75);
    expect(result.profile).toBe('foundation-heavy');
  });

  it('should classify as content-heavy when >= 60% optional', () => {
    const nodes = new Map([
      ['core', { id: 'core', status: 'core' }],
      ['explicit1', { id: 'explicit1', status: 'explicit' }],
      ['explicit2', { id: 'explicit2', status: 'explicit' }],
      ['explicit3', { id: 'explicit3', status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getCoreOptionalRatio();

    expect(result.optionalPercentage).toBe(75);
    expect(result.profile).toBe('content-heavy');
  });

  it('should classify as balanced when neither >= 60%', () => {
    const nodes = new Map([
      ['core', { id: 'core', status: 'core' }],
      ['dep1', { id: 'dep1', status: 'dependency' }],
      ['explicit1', { id: 'explicit1', status: 'explicit' }],
      ['explicit2', { id: 'explicit2', status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getCoreOptionalRatio();

    expect(result.foundationPercentage).toBe(50);
    expect(result.optionalPercentage).toBe(50);
    expect(result.profile).toBe('balanced');
  });

  it('should return list of foundation mod IDs', () => {
    const nodes = new Map([
      ['core', { id: 'core', status: 'core' }],
      ['anatomy', { id: 'anatomy', status: 'dependency' }],
      ['explicit1', { id: 'explicit1', status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getCoreOptionalRatio();

    expect(result.foundationMods).toContain('core');
    expect(result.foundationMods).toContain('anatomy');
    expect(result.foundationMods).not.toContain('explicit1');
  });

  it('should exclude inactive mods from calculation', () => {
    const nodes = new Map([
      ['core', { id: 'core', status: 'core' }],
      ['inactive', { id: 'inactive', status: 'inactive' }],
      ['explicit1', { id: 'explicit1', status: 'explicit' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result = service.getCoreOptionalRatio();

    expect(result.totalActive).toBe(2); // core + explicit1
    expect(result.foundationMods).not.toContain('inactive');
  });

  it('should cache results until invalidation', () => {
    const nodes = new Map([
      ['core', { id: 'core', status: 'core' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const service = new ModStatisticsService({
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    const result1 = service.getCoreOptionalRatio();
    const result2 = service.getCoreOptionalRatio();

    expect(result1).toBe(result2);
    expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(1);

    service.invalidateCache();
    service.getCoreOptionalRatio();

    expect(mockModGraphService.getAllNodes).toHaveBeenCalledTimes(2);
  });
});
```
