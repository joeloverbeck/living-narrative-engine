# MONCARREPGEN-004: CSS Styling

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
  background: var(--bg-tertiary, #3a3a3a);
  border: 1px solid var(--border-color, #555);
  color: var(--text-primary, #e0e0e0);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s ease;
}

.action-button--secondary:hover:not(:disabled) {
  background: var(--bg-hover, #4a4a4a);
}

.action-button--secondary:focus {
  outline: 2px solid var(--focus-color, #5a9cf8);
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
  background: var(--bg-secondary, #1e1e1e);
  color: var(--text-primary, #e0e0e0);
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
  background: var(--bg-tertiary, #2a2a2a);
  border-radius: 4px;
}

.mc-report-content::-webkit-scrollbar-thumb {
  background: var(--border-color, #555);
  border-radius: 4px;
}

.mc-report-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary, #888);
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
  border-top: 1px solid var(--border-color, #555);
  gap: 1rem;
}

.modal-content--large .status-message-area {
  flex: 1;
  font-size: 0.875rem;
  min-height: 1.5rem;
}

.modal-content--large .status-message-area.success {
  color: var(--success-color, #4ade80);
}

.modal-content--large .status-message-area.error {
  color: var(--error-color, #f87171);
}
```

### CSS Variable Dependencies

The styles use these CSS variables (should already exist in the theme):
- `--bg-secondary`: Secondary background color
- `--bg-tertiary`: Tertiary background color
- `--bg-hover`: Hover state background
- `--text-primary`: Primary text color
- `--text-secondary`: Secondary text color
- `--border-color`: Border color
- `--focus-color`: Focus ring color
- `--success-color`: Success message color
- `--error-color`: Error message color

If any variables are missing, use the fallback values in parentheses.

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

- [ ] `.mc-results-actions` wrapper styles added
- [ ] `.action-button--secondary` styles added with hover/focus/disabled states
- [ ] `.modal-content--large` styles added with max dimensions
- [ ] `.mc-report-content` styles added with monospace font, scrolling
- [ ] Scrollbar styles for `.mc-report-content`
- [ ] Modal footer layout styles added
- [ ] Status message success/error color classes added
- [ ] Responsive breakpoint for smaller screens
- [ ] All styles use CSS variables with fallbacks
- [ ] No style conflicts with existing elements
- [ ] Button hover/focus states work correctly
- [ ] Modal content is scrollable for long reports
- [ ] Text is selectable in report content
