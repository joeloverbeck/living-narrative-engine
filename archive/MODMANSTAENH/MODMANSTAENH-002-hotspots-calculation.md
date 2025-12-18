# MODMANSTAENH-002: Dependency Hotspots Calculation

**Status:** ✅ Completed
**Priority:** High (Phase 1)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-001
**Parent:** MODMANSTAENH-000

---

## Objective

Implement `getDependencyHotspots(limit = 5)` method in ModStatisticsService that returns the most depended-on mods, sorted by dependent count descending.

---

## Files to Touch

### Modified Files
- `src/modManager/services/ModStatisticsService.js` (add method)
- `tests/unit/modManager/services/ModStatisticsService.test.js` (add tests)

---

## Out of Scope

**DO NOT modify:**
- `src/modManager/services/ModGraphService.js` - use existing API only
- `src/modManager/views/SummaryPanelView.js` - UI is ticket MODMANSTAENH-005
- `src/modManager/ModManagerBootstrap.js` - already registered in 001
- `css/mod-manager.css` - no styling changes
- Any other calculation methods (separate tickets)

---

## Implementation Details

### Method Signature

```javascript
/**
 * @typedef {Object} HotspotEntry
 * @property {string} modId - Mod identifier
 * @property {number} dependentCount - Number of mods depending on this
 */

/**
 * Get mods with the most dependents (most depended-on)
 * @param {number} [limit=5] - Maximum number of results
 * @returns {HotspotEntry[]} Sorted by dependentCount descending
 */
getDependencyHotspots(limit = 5) {
  // Check cache
  if (this.#cache.isValid && this.#cache.data.hotspots) {
    return this.#cache.data.hotspots.slice(0, limit);
  }

  const nodes = this.#modGraphService.getAllNodes();
  const hotspots = [];

  for (const [modId, node] of nodes) {
    // Only count active mods (not inactive)
    if (node.status === 'inactive') continue;

    hotspots.push({
      modId,
      dependentCount: node.dependents.length,
    });
  }

  // Sort by dependentCount descending
  hotspots.sort((a, b) => b.dependentCount - a.dependentCount);

  // Cache full results and mark valid
  this.#cache.data.hotspots = hotspots;
  this.#cache.isValid = true;

  return hotspots.slice(0, limit);
}
```

### Data Flow

```
ModGraphService.getAllNodes()
    → Map<modId, {id, dependencies[], dependents[], status}>
    → Filter active mods
    → Map to {modId, dependentCount}
    → Sort descending
    → Slice to limit
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --no-coverage --verbose
```

### Specific Test Cases Required

1. **Basic functionality**
   - Returns array sorted by dependentCount descending
   - Default limit is 5
   - Custom limit parameter works correctly

2. **Edge cases**
   - Empty graph returns empty array
   - Graph with fewer mods than limit returns all mods
   - Inactive mods are excluded from results

3. **Caching**
   - Multiple calls use cached results (getAllNodes called once)
   - `invalidateCache()` clears hotspots cache (getAllNodes called again)

### Invariants That Must Remain True

1. `ModGraphService.getAllNodes()` returns unchanged structure
2. Method is pure (no side effects on graph)
3. Results are deterministic for same input
4. Existing ModStatisticsService tests still pass

---

## Verification Steps

```bash
# 1. Run hotspots-specific tests
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --testNamePattern="getDependencyHotspots" --no-coverage --verbose

# 2. Run all ModStatisticsService tests
NODE_ENV=test npx jest tests/unit/modManager/services/ModStatisticsService.test.js --no-coverage --verbose

# 3. Run full mod manager tests
NODE_ENV=test npx jest tests/unit/modManager/ --no-coverage --silent
```

---

## Test Cases Added

The following 9 test cases were implemented:

1. `should return empty array for empty graph` - Edge case for empty graph
2. `should return mods sorted by dependent count descending` - Core functionality
3. `should use default limit of 5` - Default parameter behavior
4. `should respect custom limit parameter` - Custom limit works
5. `should return all mods when fewer than limit exist` - Edge case
6. `should exclude inactive mods` - Filter out inactive status
7. `should cache results until invalidation` - Caching via call count verification
8. `should mark cache as valid after computation` - Cache validity flag
9. `should include all active status types` - core, explicit, dependency all included

---

## Corrections Made During Implementation

### Issue 1: Missing Cache Validity Flag
The original implementation did not set `this.#cache.isValid = true` after computation.

**Fix:** Added `this.#cache.isValid = true` after caching results.

### Issue 2: Test Cache Verification
The original test used reference equality (`expect(result1).toBe(result2)`), but `slice()` always creates new arrays.

**Fix:** Tests now verify caching by checking `getAllNodes` call count instead of reference equality.

---

## Outcome

### Originally Planned
- Add `getDependencyHotspots(limit = 5)` method to ModStatisticsService
- Add test cases for the new method

### Actually Changed
1. **`src/modManager/services/ModStatisticsService.js`**: Added `getDependencyHotspots()` method with corrected caching logic (added `this.#cache.isValid = true`)
2. **`tests/unit/modManager/services/ModStatisticsService.test.js`**: Added 9 test cases covering basic functionality, edge cases, and caching behavior

### Deviations from Ticket
- Fixed caching bug in ticket's proposed implementation (missing `isValid = true`)
- Fixed test expectations (use call count verification instead of reference equality)
- Added 3 additional test cases beyond the original 6 proposed:
  - `should use default limit of 5`
  - `should mark cache as valid after computation`
  - `should include all active status types`

### Test Results
- All 21 ModStatisticsService tests pass
- All 626 mod manager tests pass (no regressions)
