# MONCARADVMET-009: Update UI Data Binding and Columns - COMPLETED

## Summary

Update `ExpressionDiagnosticsController` to display the new advanced metrics in the blockers table, including percentiles, near-miss rate, last-mile rate, and ceiling analysis.

## Priority: Medium | Effort: Medium

## Status: ✅ COMPLETED

## Outcome

### What Was Actually Changed vs Originally Planned

#### Changes Made (Matching Plan)

1. **ExpressionDiagnosticsController.js** - Added 4 helper methods:
   - `#formatNumber(value)` - formats numbers to 2 decimal places with N/A fallback
   - `#formatViolationStats(blocker)` - renders violation mean, percentiles (p50/p90), and near-miss rate
   - `#formatLastMile(blocker)` - renders last-mile statistics with single-clause support
   - `#formatRecommendation(blocker)` - renders recommendations from advancedAnalysis

2. **ExpressionDiagnosticsController.js** - Updated `#populateBlockersTable()`:
   - Added new columns: Violation, Last-Mile, Recommendation
   - Updated colspan from 6 to 8 for hierarchical breakdown rows
   - Updated colspan for no-data rows

3. **ExpressionDiagnosticsController.js** - Updated `#renderHierarchicalTree()`:
   - Added percentilesDisplay for p50 values
   - Added lastMileDisplay for last-mile failure rate
   - Added ceilingDisplay for ceiling gap warnings

4. **expression-diagnostics.html** - Updated table headers:
   - Added "Last-Mile" and "Recommendation" columns
   - Renamed columns for brevity: "Fail %", "Violation"
   - Kept existing toggle and severity columns

5. **css/expression-diagnostics.css** - Added structural CSS:
   - `.violation-stats`, `.violation-mean`, `.violation-percentiles`, `.near-miss`
   - `.last-mile-overall`, `.last-mile-decisive`, `.last-mile-na`, `.last-mile-single`
   - `.recommendation-action`
   - `.tree-percentiles`, `.tree-last-mile`, `.tree-ceiling`

6. **Unit Tests** - Added 8 new tests in "Advanced Metrics Display" describe block:
   - Violation stats with percentiles and near-miss
   - Last-mile stats with both rates
   - Single-clause last-mile format
   - N/A for missing last-mile data
   - Recommendation from advanced analysis
   - Empty recommendation when no advanced analysis
   - Hierarchical tree with advanced metrics
   - Blocker without hierarchicalBreakdown gracefully handled

#### Deviations from Original Plan

1. **Data Source Adaptation**: The ticket assumed metrics would be directly on `blocker` object, but actual implementation reads from `blocker.hierarchicalBreakdown` (the HierarchicalClauseNode) with graceful fallback when unavailable.

2. **Method Naming**: Used `#formatPercentage()` (existing method) instead of `#formatPercent()` (ticket pseudocode) to maintain consistency with existing codebase.

3. **Additional Fallback Logic**: Added null/undefined checks for `hierarchicalBreakdown` to handle blockers that might not have hierarchical data.

### Test Results

All 8 new tests pass:
```
Advanced Metrics Display
  ✓ displays violation stats with percentiles and near-miss
  ✓ displays last-mile stats with both rates
  ✓ displays single-clause last-mile format
  ✓ displays N/A for missing last-mile data
  ✓ displays recommendation from advanced analysis
  ✓ renders empty recommendation when no advanced analysis
  ✓ renders hierarchical tree with advanced metrics
  ✓ handles blocker without hierarchicalBreakdown gracefully
```

### Files Modified

| File | Change Type |
|------|-------------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | Modified - 4 new methods, 2 updated methods |
| `expression-diagnostics.html` | Modified - table headers updated |
| `css/expression-diagnostics.css` | Modified - structural CSS added |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | Modified - 8 new tests |

---

## Original Ticket Content (Preserved Below)

## Rationale

The advanced metrics are computed but not yet visible to users. This ticket adds the structural UI changes:
- New columns in the blockers table
- Data binding for new ClauseResult fields
- Hierarchical tree updates

Visual styling (colors, badges, indicators) is handled in MONCARADVMET-010.

## Dependencies

- **MONCARADVMET-008** - Requires FailureExplainer to include advancedAnalysis

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Modify** |
| `expression-diagnostics.html` | **Modify** |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | **Modify** (if exists) |

## Out of Scope

- **DO NOT** modify `MonteCarloSimulator.js` - data is already computed
- **DO NOT** modify `FailureExplainer.js` - analysis is complete
- **DO NOT** add color coding or visual indicators - that's MONCARADVMET-010
- **DO NOT** add collapsible sections - that's MONCARADVMET-010
- **DO NOT** modify CSS styling beyond basic structure

## Definition of Done

- [x] Blockers table has new columns: Violation, Last-Mile, Recommendation
- [x] `#formatViolationStats()` shows mean, p50, p90, near-miss
- [x] `#formatLastMile()` shows both failure rates
- [x] `#formatRecommendation()` displays action and message
- [x] `#renderHierarchicalTree()` includes percentiles, last-mile, ceiling
- [x] HTML template updated with new table structure
- [x] Basic CSS structure added (no styling)
- [x] Helper methods for formatting numbers and percentages
- [x] HTML escaping for user content
- [x] N/A displayed for missing data
- [x] Unit tests updated/added
- [x] No JavaScript errors in console
- [x] All existing tests pass
- [x] No type errors
