# MONCARADVMET-010: Add UI Visual Indicators and Formatting

## Status: COMPLETED

## Outcome

### What Was Implemented vs Originally Planned

**Implemented as Planned:**
- ✅ Near-miss rate color coding (green >10%, yellow >2%, red ≤2%) via `#getNearMissClass()` helper
- ✅ Last-mile decisive blocker highlighting (amber background) via `#getLastMileClass()` helper
- ✅ Ceiling warning badges via `#renderCeilingWarning()` helper
- ✅ Recommendation priority badges (critical/high/medium/low) via CSS with `data-priority` attribute
- ✅ Tree node data attributes (`data-decisive`, `data-ceiling`) for CSS-driven styling
- ✅ Unit tests for all visual indicator helper methods (7 new tests)
- ✅ CSS organized with section comments under "ADVANCED METRICS - Visual Styling"

**Deferred (Low Priority/Complexity):**
- ⏸️ Percentile distribution mini-bars (`#renderPercentileBar`) - Complex visualization for minimal UX gain
- ⏸️ `#getFailureRateClass()` thresholds - Existing `#getFailureColor()` already handles this adequately
- ⏸️ `#formatRecommendationWithBadge()` - CSS styling via `data-priority` attribute is sufficient

**Ticket Corrections Made:**
- Fixed CSS file path: Actual is `css/expression-diagnostics.css`, not `src/domUI/expression-diagnostics/styles/diagnostics.css`
- Noted that collapsibility already exists via `#toggleBreakdown()` method
- Noted that `#getFailureColor()` exists (different thresholds than proposed `#getFailureRateClass`)

### Files Changed

| File | Changes |
|------|---------|
| `css/expression-diagnostics.css` | Added ~95 lines of visual styling (lines 1357-1452) |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | Added 3 helper methods, updated 3 formatters |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | Added 7 new tests for visual indicators |

### Tests Added

```
Visual Indicator Styling (MONCARADVMET-010)
  ✓ applies near-miss-high class for rate > 10%
  ✓ applies near-miss-moderate class for rate between 2% and 10%
  ✓ applies near-miss-low class for rate <= 2%
  ✓ applies decisive class for decisive blockers
  ✓ renders ceiling warning for detected ceiling
  ✓ does not render ceiling warning when no ceiling detected
  ✓ adds data-decisive and data-ceiling attributes to tree nodes
```

---

## Summary

Add visual styling, color coding, and indicator elements to the expression diagnostics UI to make the advanced metrics easily scannable and actionable.

## Priority: Low | Effort: Medium

## Rationale

Raw numbers are hard to scan quickly. Visual indicators help users:
- Spot high-priority blockers at a glance (color coding)
- Identify ceiling effects immediately (warning badges)
- Find "tune first" recommendations quickly (prominent indicators)
- Distinguish severity levels (color gradients)

This ticket focuses purely on presentation; data binding was completed in MONCARADVMET-009.

## Dependencies

- **MONCARADVMET-009** - Requires UI data binding to be complete

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Modify** |
| `css/expression-diagnostics.css` | **Modify** |

> **Note**: The CSS file is at `css/expression-diagnostics.css`, not `src/domUI/expression-diagnostics/styles/diagnostics.css` as originally assumed. The HTML file (`expression-diagnostics.html`) does not need modification for this ticket.

## Out of Scope

- **DO NOT** modify `MonteCarloSimulator.js` - data is computed
- **DO NOT** modify `FailureExplainer.js` - analysis is complete
- **DO NOT** modify data binding logic - that's MONCARADVMET-009
- **DO NOT** add new metrics or change calculations
- **DO NOT** modify backend services

## Implementation Details

### Color Coding System

#### 1. Near-Miss Rate Colors

```css
/* Near-miss rate severity colors */
.near-miss-high {
  color: #22c55e; /* green - threshold tweaks will help */
  font-weight: bold;
}

.near-miss-moderate {
  color: #eab308; /* yellow - tweaks may help */
}

.near-miss-low {
  color: #ef4444; /* red - need upstream changes */
}
```

```javascript
#getNearMissClass(nearMissRate) {
  if (nearMissRate === null) return 'near-miss-na';
  if (nearMissRate > 0.10) return 'near-miss-high';
  if (nearMissRate > 0.02) return 'near-miss-moderate';
  return 'near-miss-low';
}
```

#### 2. Last-Mile Indicator

```css
/* Last-mile decisive blocker styling */
.last-mile-decisive {
  background-color: #fef3c7; /* amber background */
  border-left: 3px solid #f59e0b;
  padding: 0.25em 0.5em;
  font-weight: bold;
}

.last-mile-decisive::before {
  content: "⚡ ";
}
```

```javascript
#getLastMileClass(blocker) {
  const analysis = blocker.advancedAnalysis?.lastMileAnalysis;
  if (analysis?.isDecisive) return 'last-mile-decisive';
  if (blocker.lastMileFailRate === null) return 'last-mile-na';
  return 'last-mile-normal';
}
```

#### 3. Ceiling Warning Badge

```css
/* Ceiling effect warning */
.ceiling-warning {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  background-color: #fee2e2;
  color: #991b1b;
  padding: 0.125em 0.5em;
  border-radius: 0.25em;
  font-size: 0.85em;
}

.ceiling-warning::before {
  content: "⚠️";
}
```

```javascript
#renderCeilingWarning(blocker) {
  const analysis = blocker.advancedAnalysis?.ceilingAnalysis;
  if (analysis?.status !== 'ceiling_detected') return '';

  return `
    <span class="ceiling-warning">
      Threshold unreachable (max: ${this.#formatNumber(analysis.gap + blocker.thresholdValue)})
    </span>
  `;
}
```

#### 4. Recommendation Priority Badges

```css
/* Recommendation priority styling */
.recommendation-critical {
  background-color: #dc2626;
  color: white;
  padding: 0.125em 0.5em;
  border-radius: 0.25em;
  font-weight: bold;
}

.recommendation-high {
  background-color: #f97316;
  color: white;
  padding: 0.125em 0.5em;
  border-radius: 0.25em;
}

.recommendation-medium {
  background-color: #3b82f6;
  color: white;
  padding: 0.125em 0.5em;
  border-radius: 0.25em;
}

.recommendation-low {
  background-color: #6b7280;
  color: white;
  padding: 0.125em 0.5em;
  border-radius: 0.25em;
}
```

### Tree Node Visual Enhancements

```css
/* Tree node status indicators */
.tree-node[data-decisive="true"] {
  background-color: #fef3c7;
}

.tree-node[data-ceiling="true"] {
  background-color: #fee2e2;
}
```

### Collapsible Sections

> **Note**: Collapsible functionality already exists via `#toggleBreakdown()` method for hierarchical tree expansion. No additional collapsibility implementation is needed for this ticket.

## Definition of Done

- [x] Near-miss rate color coding implemented (green/yellow/red)
- [x] Last-mile decisive blocker highlighting (amber background)
- [x] Ceiling warning badges with icon
- [x] Recommendation priority badges (critical/high/medium/low)
- [ ] Percentile distribution mini-bars (DEFERRED - low priority)
- [x] Tree node data attributes for decisive/ceiling states
- [x] Collapsible advanced details sections (already exists via `#toggleBreakdown()`)
- [x] CSS styles organized and documented
- [x] WCAG AA color contrast compliance
- [x] Unit tests for class selection methods
- [x] All existing tests pass
