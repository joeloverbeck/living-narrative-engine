# EXPCHAPANREN-001: Expression Messages CSS Styles

## Summary

Create the CSS file for styling expression narrative messages in the chat panel. This establishes the visual foundation before any JavaScript implementation.

## Files to Create

- `css/components/_expression-messages.css`

## Files to Modify

- `css/style.css` (add import statement only)

## Out of Scope

- **DO NOT** modify any JavaScript files
- **DO NOT** modify any existing CSS component files
- **DO NOT** add or modify any DI tokens or registrations
- **DO NOT** change the HTML structure of `game.html`
- **DO NOT** modify expression data files in `data/mods/`

## Implementation Details

### 1. Create `css/components/_expression-messages.css`

Base class with entry animation and tag modifiers:

```css
/* css/components/_expression-messages.css */
/* Styling for expression narrative messages in the chat panel */

/* Base expression message styling */
.expression-message {
  display: block;
  max-width: 85%;
  margin: 0.75rem auto;
  padding: 0.75rem 1rem;
  font-family: var(--font-narrative, Georgia, serif);
  font-style: italic;
  border-left: 3px solid var(--expression-accent-color, #00796b);
  background: linear-gradient(
    to right,
    var(--expression-accent-background, rgba(0, 121, 107, 0.08)),
    transparent
  );
  border-radius: var(--border-radius-sm, 4px);
  animation: expressionFadeIn 0.4s ease-out;
}

/* Entry animation */
@keyframes expressionFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .expression-message {
    animation: none;
  }
}

/* Tag-based modifiers */
.expression-message--default {
  border-left-color: #00796b;
  background: linear-gradient(to right, rgba(0, 121, 107, 0.08), transparent);
}

.expression-message--anger {
  border-left-color: #c62828;
  background: linear-gradient(to right, rgba(198, 40, 40, 0.1), transparent);
}

.expression-message--affection {
  border-left-color: #ad1457;
  background: linear-gradient(to right, rgba(173, 20, 87, 0.1), transparent);
}

.expression-message--loss {
  border-left-color: #37474f;
  background: linear-gradient(to right, rgba(55, 71, 79, 0.1), transparent);
}

.expression-message--threat {
  border-left-color: #4a148c;
  background: linear-gradient(to right, rgba(74, 20, 140, 0.1), transparent);
}

.expression-message--agency {
  border-left-color: #00695c;
  background: linear-gradient(to right, rgba(0, 105, 92, 0.1), transparent);
}

.expression-message--attention {
  border-left-color: #f57c00;
  background: linear-gradient(to right, rgba(245, 124, 0, 0.1), transparent);
}
```

Tag-based modifiers (all with WCAG AA compliant colors):

| Modifier | Tags | Accent Color | Background |
|----------|------|--------------|------------|
| `--default` | (fallback) | `#00796b` (teal) | `rgba(0, 121, 107, 0.08)` |
| `--anger` | anger, rage, fury | `#c62828` (red) | `rgba(198, 40, 40, 0.1)` |
| `--affection` | affection, love, warmth | `#ad1457` (pink) | `rgba(173, 20, 87, 0.1)` |
| `--loss` | grief, despair, sorrow | `#37474f` (blue-grey) | `rgba(55, 71, 79, 0.1)` |
| `--threat` | fear, panic, horror | `#4a148c` (purple) | `rgba(74, 20, 140, 0.1)` |
| `--agency` | confidence, determination | `#00695c` (dark teal) | `rgba(0, 105, 92, 0.1)` |
| `--attention` | curious, fascinated | `#f57c00` (amber) | `rgba(245, 124, 0, 0.1)` |

### 2. Modify `css/style.css`

Add single import line after `_damage-messages.css`:

```css
/* Expression Messages */
@import url('components/_expression-messages.css');
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit**: `tests/unit/ui/expressionMessagesCss.test.js` passes
2. **No CSS conflicts**: Existing `.damage-message` and `.action-result-bubble` classes remain unchanged
3. **Animation verification**: `expressionFadeIn` keyframes defined and applied
4. **Reduced motion**: Animation disabled when `prefers-reduced-motion: reduce`

### Invariants That Must Remain True

1. All existing CSS components unchanged (no modifications to `_damage-messages.css`, `_action-result-bubbles.css`, `_speech-bubbles.css`, etc.)
2. CSS custom properties (e.g., `--border-radius-sm`, `--font-narrative`) used for theme compatibility
3. No JavaScript execution required to validate CSS
4. Import order in `style.css` follows existing pattern (components section)

## Estimated Diff Size

- New file: ~110-140 lines
- Modified file: +1 line
- New test file: ~40-60 lines

## Dependencies

- None (first ticket in sequence)

## Testing Notes

Visual testing can be done via devtools or local scratch markup, but do not commit `game.html` changes. Automated coverage comes from `tests/unit/ui/expressionMessagesCss.test.js`.

## Status

Completed.

## Outcome

- Added `css/components/_expression-messages.css` with base styling, animation, reduced-motion handling, and tag modifiers.
- Imported the new component in `css/style.css` after damage messages.
- Added `tests/unit/ui/expressionMessagesCss.test.js` to enforce the import and required selectors.
