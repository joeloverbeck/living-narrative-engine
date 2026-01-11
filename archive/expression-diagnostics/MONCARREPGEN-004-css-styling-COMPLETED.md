# MONCARREPGEN-004: CSS Styling [COMPLETED]

## Status: COMPLETED

## Summary

Add CSS styles for the Monte Carlo Report modal and the "Generate Report" button to `css/expression-diagnostics.css`.

## Priority: Medium | Effort: Small

## Rationale

Visual styling is essential for usability. The modal needs to:
- Display markdown content in a readable format
- Support long content with scrolling
- Match the existing expression diagnostics dark theme
- Provide clear button states and feedback areas

## Dependencies

- None (can be done in parallel with other tickets)

## Files to Touch

| File | Change Type |
|------|-------------|
| `css/expression-diagnostics.css` | **Modify** |

## Out of Scope

- **DO NOT** modify HTML structure - that's MONCARREPGEN-003
- **DO NOT** create new CSS files
- **DO NOT** modify other CSS files
- **DO NOT** add JavaScript for animations - CSS transitions only
- **DO NOT** change existing styles (only add new styles)

## Implementation Details

### Button Styling

Add styles for the action button wrapper and secondary button variant:

```css
/* Monte Carlo Report - Button */
.mc-results-actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}

.action-button--secondary {
  background: var(--secondary-bg-color, #3a3a3a);
  border: 1px solid var(--border-color-subtle, #555);
  color: var(--primary-text-color, #e0e0e0);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s ease;
}

.action-button--secondary:hover:not(:disabled) {
  background: var(--button-hover-bg-color, #4a4a4a);
}

.action-button--secondary:focus {
  outline: 2px solid var(--accent-color-primary, #5a9cf8);
  outline-offset: 2px;
}

.action-button--secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Modal Styling

Add styles for the large modal variant and report content:

```css
/* Monte Carlo Report - Modal */
.modal-content--large {
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.modal-content--large .modal-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mc-report-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  background: var(--secondary-bg-color, #1e1e1e);
  color: var(--primary-text-color, #e0e0e0);
  padding: 1rem;
  border-radius: 4px;
  overflow-y: auto;
  flex: 1;
  max-height: 60vh;
  user-select: text;
  margin: 0;
}

/* Scrollbar styling for report content */
.mc-report-content::-webkit-scrollbar {
  width: 8px;
}

.mc-report-content::-webkit-scrollbar-track {
  background: var(--panel-bg-color, #2a2a2a);
  border-radius: 4px;
}

.mc-report-content::-webkit-scrollbar-thumb {
  background: var(--border-color-subtle, #555);
  border-radius: 4px;
}

.mc-report-content::-webkit-scrollbar-thumb:hover {
  background: var(--secondary-text-color, #888);
}
```

### Modal Footer Styling

Add styles for the footer with status message and copy button:

```css
/* Monte Carlo Report - Modal Footer */
.modal-content--large .modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color-subtle, #555);
  gap: 1rem;
}

.modal-content--large .status-message-area {
  flex: 1;
  font-size: 0.875rem;
  min-height: 1.5rem;
}

.modal-content--large .status-message-area.success {
  color: var(--success-text-color, #4ade80);
}

.modal-content--large .status-message-area.error {
  color: var(--error-text-color, #f87171);
}
```

### CSS Variable Dependencies

The styles use these CSS variables from the project's theme (`css/themes/_default-theme.css`):
- `--secondary-bg-color`: Secondary background color
- `--button-hover-bg-color`: Hover state background
- `--primary-text-color`: Primary text color
- `--secondary-text-color`: Secondary text color
- `--border-color-subtle`: Border color
- `--accent-color-primary`: Focus ring color
- `--accent-color-focus-ring`: Focus ring glow
- `--success-text-color`: Success message color
- `--error-text-color`: Error message color
- `--panel-bg-color`: Panel background color

Fallback values are provided in parentheses for any variables that may not be defined in all contexts.

### Responsive Considerations

The modal should work on smaller screens:

```css
@media (max-width: 960px) {
  .modal-content--large {
    max-width: 95vw;
    margin: 1rem;
  }

  .mc-report-content {
    max-height: 50vh;
  }
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Visual verification
npm run dev
# Open http://localhost:3000/expression-diagnostics.html
# Run a Monte Carlo simulation
# Verify "Generate Report" button appears with proper styling
# Click button (once MONCARREPGEN-006 is complete) and verify modal styling
```

### Invariants That Must Remain True

1. **Theme consistency**: Colors match existing expression diagnostics theme
2. **Readability**: Monospace font for markdown, sufficient contrast
3. **Scrollability**: Long reports scroll within modal, not page
4. **Focus visibility**: Focus states are clearly visible
5. **No conflicts**: New styles don't affect existing elements

## Verification Commands

```bash
# Lint CSS file (if CSS linter is configured)
npx stylelint css/expression-diagnostics.css

# Visual check: Load page and inspect elements
npm run dev
```

## Definition of Done

- [x] `.mc-results-actions` wrapper styles added
- [x] `.action-button--secondary` styles added with hover/focus/disabled states
- [x] `.modal-content--large` styles added with max dimensions
- [x] `.mc-report-content` styles added with monospace font, scrolling
- [x] Scrollbar styles for `.mc-report-content`
- [x] Modal footer layout styles added
- [x] Status message success/error color classes added
- [x] Responsive breakpoint for smaller screens
- [x] All styles use CSS variables with fallbacks
- [x] No style conflicts with existing elements
- [x] Button hover/focus states work correctly
- [x] Modal content is scrollable for long reports
- [x] Text is selectable in report content

## Outcome

### What Was Changed vs Originally Planned

**Originally Planned:**
- Add button and modal CSS styles as specified in the ticket

**Actually Changed:**
1. **Ticket Corrections Made:**
   - Updated CSS variable names to match actual theme variables (`--bg-secondary` → `--secondary-bg-color`, etc.)
   - Fixed variable documentation section to reflect actual theme (`css/themes/_default-theme.css`)

2. **CSS Added (190 lines) to `css/expression-diagnostics.css`:**
   - `.mc-results-actions` wrapper styles
   - `.action-button--secondary` with hover/focus/disabled states
   - `.modal-content--large` for large modal variant
   - `.mc-report-content` with monospace font and scrolling
   - Custom scrollbar styles for WebKit browsers
   - `.modal-header` and `.modal-close-btn` styles (not in original ticket but needed for complete modal)
   - `.modal-footer` layout within large modal
   - `.btn-primary` button variant (not in original ticket but used by modal HTML)
   - Responsive breakpoint at 960px

3. **Additional Styles Added Beyond Ticket Scope:**
   - `.modal-header` - needed for proper header layout
   - `.modal-close-btn` - needed for close button styling
   - `.btn-primary` - needed as the modal HTML uses this class

**Files Modified:**
- `css/expression-diagnostics.css` - Added ~190 lines at end of file
- `tickets/MONCARREPGEN-004-css-styling.md` - Corrected CSS variable names

**No Tests Added/Modified:**
- This is a CSS-only ticket with no testable logic
- Visual verification is the acceptance criterion
