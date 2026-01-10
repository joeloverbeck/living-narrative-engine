# MONCARREPGEN-003: HTML Structure

## Summary

Add the "Generate Report" button inside the Monte Carlo results section and add the modal HTML structure to `expression-diagnostics.html`.

## Priority: High | Effort: Small

## Rationale

The HTML structure provides the DOM elements that the modal renderer (MONCARREPGEN-005) and controller integration (MONCARREPGEN-006) will bind to. By placing the button inside the `#mc-results` div, it automatically shows/hides with the results section.

## Dependencies

- None (can be done in parallel with other tickets)

## Files to Touch

| File | Change Type |
|------|-------------|
| `expression-diagnostics.html` | **Modify** |

## Out of Scope

- **DO NOT** add CSS styles - that's MONCARREPGEN-004
- **DO NOT** add JavaScript event handlers - that's MONCARREPGEN-005/006
- **DO NOT** modify any other HTML files
- **DO NOT** modify the Monte Carlo results display structure

## Implementation Details

### Button Placement

Add the button inside `#mc-results` div, after the `#mc-summary` paragraph. The button should be in a wrapper div for layout control:

```html
<!-- Inside #mc-results, after #mc-summary -->
<div class="mc-results-actions">
  <button id="generate-report-btn" class="action-button action-button--secondary">
    Generate Report
  </button>
</div>
```

**Location context**: Find the `<p id="mc-summary">` element and add the button wrapper immediately after it.

### Modal Structure

Add the modal at the end of the `<body>`, before the closing `</body>` tag (alongside other modals if any exist):

```html
<!-- Monte Carlo Report Modal -->
<div id="mc-report-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="mc-report-title" style="display: none;">
  <div class="modal-content modal-content--large">
    <div class="modal-header">
      <h2 id="mc-report-title">Monte Carlo Analysis Report</h2>
      <button id="mc-report-close-btn" class="modal-close-btn" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      <pre id="mc-report-content" class="mc-report-content"></pre>
    </div>
    <div class="modal-footer">
      <div id="mc-report-status" class="status-message-area"></div>
      <button id="mc-report-copy-btn" class="btn btn-primary">
        Copy to Clipboard
      </button>
    </div>
  </div>
</div>
```

### Element IDs Reference

| Element ID | Purpose | Used By |
|------------|---------|---------|
| `generate-report-btn` | Trigger button | Controller (MONCARREPGEN-006) |
| `mc-report-modal` | Modal overlay | Modal renderer (MONCARREPGEN-005) |
| `mc-report-title` | Modal heading | ARIA labelledby reference |
| `mc-report-close-btn` | Close button | BaseModalRenderer |
| `mc-report-content` | Report text display | Modal renderer |
| `mc-report-status` | Status messages | Modal renderer |
| `mc-report-copy-btn` | Clipboard button | Modal renderer |

### Accessibility Requirements

- `role="dialog"` on modal overlay
- `aria-modal="true"` to indicate modal behavior
- `aria-labelledby="mc-report-title"` to associate with heading
- `aria-label="Close"` on close button
- `style="display: none;"` initially hidden

### HTML Validation

Ensure:
- All IDs are unique within the document
- Proper nesting of semantic elements
- No duplicate attribute declarations
- Valid HTML5 structure

## Acceptance Criteria

### Tests That Must Pass

```bash
# HTML validation (if validator available)
# Manual check: Open expression-diagnostics.html in browser, verify no console errors

# Visual check: Run Monte Carlo simulation, verify button appears
npm run dev
# Open http://localhost:3000/expression-diagnostics.html
```

### Invariants That Must Remain True

1. **Button visibility**: Button is inside `#mc-results` so it hides when results are hidden
2. **Modal hidden**: Modal has `style="display: none;"` initially
3. **ID uniqueness**: All new IDs are unique in the document
4. **ARIA compliance**: Modal has proper accessibility attributes
5. **Structure preservation**: Existing MC results structure unchanged

## Verification Commands

```bash
# Verify HTML is valid
# (Manual: paste into https://validator.w3.org/)

# Check for ID uniqueness
grep -c 'id="generate-report-btn"' expression-diagnostics.html  # Should be 1
grep -c 'id="mc-report-modal"' expression-diagnostics.html      # Should be 1
grep -c 'id="mc-report-content"' expression-diagnostics.html    # Should be 1

# Check ARIA attributes
grep 'role="dialog"' expression-diagnostics.html
grep 'aria-modal="true"' expression-diagnostics.html
grep 'aria-labelledby="mc-report-title"' expression-diagnostics.html
```

## Definition of Done

- [ ] Button wrapper div added after `#mc-summary`
- [ ] Button has ID `generate-report-btn`
- [ ] Button has classes `action-button action-button--secondary`
- [ ] Modal structure added before closing `</body>` tag
- [ ] Modal has ID `mc-report-modal`
- [ ] Modal has `role="dialog"` and `aria-modal="true"`
- [ ] Modal has `aria-labelledby="mc-report-title"`
- [ ] Modal has `style="display: none;"` (initially hidden)
- [ ] Close button has ID `mc-report-close-btn`
- [ ] Close button has `aria-label="Close"`
- [ ] Content area has ID `mc-report-content`
- [ ] Status area has ID `mc-report-status`
- [ ] Copy button has ID `mc-report-copy-btn`
- [ ] All IDs are unique in document
- [ ] HTML validates without errors
