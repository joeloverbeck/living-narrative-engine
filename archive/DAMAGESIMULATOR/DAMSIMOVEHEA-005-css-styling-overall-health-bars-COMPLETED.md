# DAMSIMOVEHEA-005: CSS Styling for Overall Health Bars

## Summary
Add CSS classes for the compact overall health bar styling used in the Anatomy panel header and the Analytics "Hits to Destroy" section header.

## Status
Completed

## Motivation
Both panels need consistent, compact health bar styling that fits inline with headers and doesn't dominate the visual hierarchy (the detailed per-part health bars should remain the focus).

## Prerequisites
- None (CSS can be added independently)

## Files to Touch

| File | Changes |
|------|---------|
| `css/damage-simulator.css` | Add new CSS classes for overall health bar |

## Out of Scope

- **NO JavaScript changes** - This is CSS only
- **NO HTML structure changes** - HTML is already present in `HierarchicalAnatomyRenderer` and `DamageAnalyticsPanel`
- **NO changes to existing `.ds-health-bar*` classes** - Only adding new classes
- **NO changes to per-part health bar styling** - Must remain visually distinct

## Implementation Details

### New CSS Classes

Add to `css/damage-simulator.css`:

```css
/* ============================================
   Overall Health Bar - Compact inline version
   Used in Anatomy panel header and Analytics "Hits to Destroy" section header
   ============================================ */

/* Container for the overall health header in Anatomy panel */
.ds-overall-health-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-sm, 0.5rem);
  margin-bottom: var(--spacing-sm, 0.5rem);
  padding: var(--spacing-xs, 0.25rem) var(--spacing-sm, 0.5rem);
  background: var(--surface-color-subtle, rgba(0, 0, 0, 0.05));
  border-radius: var(--border-radius-sm, 4px);
}

/* Inline container for health bar + text */
.ds-overall-health-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 0.25rem);
}

/* Compact health bar width for inline display */
.ds-overall-health-bar .ds-health-bar {
  width: 100px;
  height: 6px;
}

/* Percentage text styling */
.ds-overall-health-text {
  font-size: var(--font-size-small, 0.875rem);
  font-weight: 600;
  min-width: 40px;
  text-align: right;
  color: var(--primary-text-color, #333);
  font-variant-numeric: tabular-nums;  /* Prevents width jitter on number changes */
}

/* "Overall:" label styling */
.ds-overall-health-label {
  font-size: var(--font-size-small, 0.875rem);
  color: var(--secondary-text-color, #666);
  margin-right: var(--spacing-xs, 0.25rem);
}

/* Inline placement for Analytics "Hits to Destroy" section header */
.ds-overall-health-inline {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 0.25rem);
  margin-left: auto;
  margin-right: var(--spacing-sm, 0.5rem);
}

/* Analytics section header flex layout to accommodate health bar */
.ds-analytics-section-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 1rem);
  flex-wrap: nowrap;
}

.ds-analytics-section-header h4 {
  margin: 0;
  flex-shrink: 0;
}

/* ============================================
   Responsive adjustments for smaller screens
   ============================================ */

@media (max-width: 600px) {
  .ds-overall-health-bar .ds-health-bar {
    width: 80px;
  }

  .ds-overall-health-text {
    min-width: 35px;
    font-size: var(--font-size-xs, 0.75rem);
  }

  .ds-overall-health-label {
    display: none;  /* Hide label on small screens */
  }
}
```

### Design Rationale

1. **Compact Size**: 100px width, 6px height vs full-width per-part bars
2. **Right Alignment**: Pushes to the right to not compete with main content
3. **Tabular Nums**: Prevents width changes when percentage updates (e.g., "99%" vs "100%")
4. **Subtle Background**: Header has subtle background to group label + bar + text
5. **Responsive**: Shrinks gracefully on mobile, hides label

### Visual Hierarchy

```
[Full-width anatomy cards with 8px tall per-part bars]
     ↑ Primary focus

[Compact 100px, 6px overall bar in top-right]
     ↑ Secondary/summary info
```

## Acceptance Criteria

### Tests That Must Pass

Since these are CSS-only changes, verification is visual:

1. **Visual: Compact bar width**
   - Health bar is 100px wide (not full width)
   - Health bar is 6px tall (smaller than per-part 8px)

2. **Visual: Right alignment**
   - Health bar aligns to the right in the Anatomy header and Hits to Destroy section header
   - Does not push other content awkwardly

3. **Visual: Percentage text**
   - Text is right-aligned
   - Uses tabular figures (numbers don't shift)
   - Font weight is 600 (semi-bold)

4. **Visual: Proper spacing**
   - Gap between label, bar, and text is consistent
   - Margins don't cause overflow or clipping

5. **Visual: Responsive behavior**
   - At 600px width, bar shrinks to 80px
   - At 600px width, label hides
   - No horizontal scrolling introduced

6. **Visual: No regressions**
   - Per-part health bars unchanged
   - Existing damage simulator UI unchanged
   - Colors match existing health bar colors

### Invariants

1. **Existing per-part health bars unchanged** - `.ds-health-bar` base class not modified
2. **Color thresholds unchanged** - `.ds-health-bar-fill--healthy/damaged/critical` not modified
3. **CSS variables used** - All values reference existing CSS variables with fallbacks
4. **No !important** - No use of `!important` overrides

## Manual Testing Checklist

- [ ] Load damage-simulator.html
- [ ] Select an entity
- [ ] Verify overall health bar appears in Anatomy panel
- [ ] Verify overall health bar appears in the Hits to Destroy header row
- [ ] Resize browser to <600px and verify responsive behavior
- [ ] Apply damage and verify health bar updates smoothly
- [ ] Compare to game.html health bar - colors should match

## Definition of Done

- [ ] All CSS classes added to `damage-simulator.css`
- [ ] CSS uses existing variables with fallbacks
- [ ] Responsive breakpoint at 600px
- [ ] No changes to existing CSS classes
- [ ] Visual verification in Chrome/Firefox/Safari
- [ ] No horizontal scrolling on any screen size
- [ ] Code reviewed and merged

## Test Notes

- Existing unit tests cover the overall health bar markup in `HierarchicalAnatomyRenderer` and `DamageAnalyticsPanel`.
- CSS behavior is still verified visually; no snapshot tests currently assert computed styles.

## Outcome

- Updated scope to target the Anatomy header and the "Hits to Destroy" section header (not the analytics panel header).
- Added compact overall health bar styling and section header layout classes in `css/damage-simulator.css`.
- No HTML or JavaScript changes required; unit tests run for the two rendering components.
