# MODMANSTAENH-013: Single-Parent Dependency (Orphan Risk) Calculation

**Status:** Completed
**Priority:** Low (Phase 3)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-001
**Parent:** MODMANSTAENH-000

---

## Objective

Implement `getSingleParentDependencies()` method in ModStatisticsService that identifies mods which have only one dependent, creating potential fragility (if the single dependent is deactivated, the dependency becomes orphaned).

---

## Outcome

### What Was Changed vs Originally Planned

**Implementation matched ticket specifications exactly**, with one minor correction:

1. **Ticket Code Correction**: The original ticket's code snippet was missing `this.#cache.isValid = true;` after storing the result. This was corrected in the implementation to match the existing caching pattern in ModStatisticsService (see lines 161-162, 241-242, 302-303 for reference).

2. **Files Modified**:
   - `src/modManager/services/ModStatisticsService.js` - Added typedefs and `getSingleParentDependencies()` method
   - `tests/unit/modManager/services/ModStatisticsService.test.js` - Added 12 test cases

3. **All 12 Specified Test Cases Implemented**:
   - Empty graph handling
   - Single dependent identification
   - Multiple dependents exclusion
   - Explicit mods exclusion
   - Inactive dependents filtering
   - Percentage calculation
   - 0% at-risk case
   - Status inclusion in entries
   - Alphabetical sorting
   - Caching behavior
   - No dependents handling
   - Inactive mods skipping

4. **Test Results**: All 70 tests pass (12 new + 58 existing)

### No Deviations from Plan

The implementation followed the ticket's specifications precisely. The only adjustment was adding the missing cache validity flag to maintain consistency with the existing codebase pattern.

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
  this.#cache.isValid = true;  // CORRECTED: Was missing in original ticket
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
