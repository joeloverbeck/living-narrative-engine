# TURORDTIC-017: Accessibility and Polish

## Status
Ready for Implementation

## Priority
Medium - Ensures inclusive design and professional finish

## Dependencies
- TURORDTIC-001 through TURORDTIC-016 (complete implementation and testing)

## Description
Conduct comprehensive accessibility audit, implement accessibility improvements, test with assistive technologies, and add final polish touches. Ensure WCAG 2.1 AA compliance and excellent user experience.

## Affected Files
- `src/domUI/turnOrderTickerRenderer.js` (potential improvements)
- `css/turn-order-ticker.css` (accessibility enhancements)
- `game.html` (ARIA attributes verification)
- `tests/accessibility/turnOrderTicker.accessibility.test.js` (create)

## Accessibility Requirements (WCAG 2.1 AA)

### 1. Perceivable

#### 1.1 Text Alternatives
- [ ] All portrait images have descriptive `alt` text
- [ ] Decorative elements have `alt=""` or `role="presentation"`
- [ ] Icon-only UI elements have `aria-label`

**Verify:**
```javascript
// All images should have alt text
document.querySelectorAll('.ticker-actor-portrait').forEach(img => {
  console.assert(img.alt, 'Portrait missing alt text');
});
```

#### 1.2 Color and Contrast
- [ ] Current actor highlight visible without color (border/scale)
- [ ] Non-participating state visible without color (opacity + pattern)
- [ ] Contrast ratio ≥ 4.5:1 for text
- [ ] Contrast ratio ≥ 3:1 for UI components

**Test:** Use browser DevTools or axe DevTools extension

#### 1.3 Sensory Characteristics
- [ ] Instructions don't rely solely on color, shape, or position
- [ ] Current actor indicated by multiple cues (color + border + scale)

### 2. Operable

#### 2.1 Keyboard Accessible
- [ ] All interactive elements keyboard accessible
- [ ] Focus order logical (left to right)
- [ ] Focus indicators visible
- [ ] No keyboard traps

**Test:**
```bash
# Manual test: Tab through ticker elements
# Verify focus ring visible on all actors
```

**Implementation:**
```css
/* Enhanced focus indicator */
.ticker-actor:focus {
  outline: 3px solid #3498db;
  outline-offset: 3px;
}

.ticker-actor:focus-visible {
  outline: 3px solid #3498db;
  outline-offset: 3px;
}
```

#### 2.2 Timing Adjustable
- [ ] Animations respect `prefers-reduced-motion`
- [ ] No automatic timeouts that can't be disabled

**Already implemented in TURORDTIC-011 and TURORDTIC-012**

#### 2.3 Navigation
- [ ] Ticker has clear heading/label structure
- [ ] Landmarks used appropriately (`role="region"`)

### 3. Understandable

#### 3.1 Readable
- [ ] Text content at least 16px (or rem equivalent)
- [ ] Line height adequate (1.2+)
- [ ] Font weights appropriate

**Verify CSS:**
```css
.ticker-actor-name {
  font-size: 0.75rem; /* 12px - consider increasing to 0.875rem (14px) */
  line-height: 1.2;
}
```

#### 3.2 Predictable
- [ ] Actor order doesn't change unexpectedly
- [ ] Consistent visual design
- [ ] No sudden movements without user action

#### 3.3 Input Assistance
- [ ] Error states clearly communicated
- [ ] Help text provided where needed

### 4. Robust

#### 4.1 Compatible
- [ ] Valid HTML5
- [ ] ARIA attributes used correctly
- [ ] Works with screen readers (NVDA, JAWS, VoiceOver)

## Screen Reader Testing

### Manual Testing Checklist

**NVDA (Windows):**
```
1. Start NVDA
2. Navigate to ticker: H key to find heading/region
3. Tab through actors
4. Verify announcements:
   - "Round 1"
   - "Actor Alice, participating"
   - "Actor Bob, not participating, dimmed"
   - "Turn order, region"
```

**JAWS (Windows):**
```
1. Start JAWS
2. Navigate to ticker: R key for region
3. Use arrow keys to explore content
4. Verify proper role and state announcements
```

**VoiceOver (macOS):**
```
1. Cmd + F5 to start VoiceOver
2. Cmd + Right Arrow to navigate
3. VO + Shift + Down to interact with region
4. Verify announcements match NVDA
```

### Screen Reader Announcements

**When round starts:**
```
"Turn order region. Round 1. Alice, Bob, Charlie."
```

**When actor's turn starts:**
```
"Alice's turn"
```

**When actor removed:**
```
"Alice removed from turn order. 2 actors remaining."
```

**When participation changes:**
```
"Bob disabled from participation"
```

## ARIA Implementation

### Current ARIA (from TURORDTIC-001)

```html
<div id="turn-order-ticker" role="region" aria-label="Turn order" aria-live="polite">
  <!-- ... -->
</div>
```

### Enhanced ARIA

**File:** `src/domUI/turnOrderTickerRenderer.js`

Add ARIA attributes to actor elements:

```javascript
#createActorElement(entity) {
  // ... existing code ...

  // Add ARIA attributes
  container.setAttribute('role', 'listitem');
  container.setAttribute('aria-label', `${displayData.name}, ${displayData.participating ? 'participating' : 'not participating'}`);

  if (!displayData.participating) {
    container.setAttribute('aria-disabled', 'true');
  }

  // ... rest of code ...
}
```

Add live region announcements:

```javascript
updateCurrentActor(entityId) {
  // ... existing code ...

  // Announce to screen readers
  const actorName = this.#getActorDisplayData(entityId).name;
  this.#announceToScreenReader(`${actorName}'s turn`);

  // ... rest of code ...
}

#announceToScreenReader(message) {
  // Create temporary live region for announcements
  const announcement = this.#domElementFactory.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only'; // Visually hidden
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    announcement.remove();
  }, 1000);
}
```

### Visually Hidden Class

**File:** `css/turn-order-ticker.css`

Add:

```css
/* Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

## High Contrast Mode Support

**File:** `css/turn-order-ticker.css`

Add high contrast styles:

```css
@media (prefers-contrast: high) {
  #turn-order-ticker {
    border-bottom: 3px solid currentColor;
  }

  .ticker-actor.current::before {
    border-width: 4px;
    box-shadow: none;
  }

  .ticker-actor-portrait,
  .ticker-actor-name-badge {
    border-width: 3px;
    border-color: currentColor;
  }

  .ticker-actor[data-participating="false"] {
    text-decoration: line-through;
  }
}
```

## Dark Mode Support (Optional)

If the application has dark mode:

```css
@media (prefers-color-scheme: dark) {
  #turn-order-ticker {
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    border-bottom-color: #4a9eff;
  }

  .ticker-actor-portrait,
  .ticker-actor-name-badge {
    background: #2d2d2d;
    border-color: #444;
  }

  .ticker-actor-name {
    color: #e0e0e0;
  }
}
```

## Automated Accessibility Testing

**File:** `tests/accessibility/turnOrderTicker.accessibility.test.js`

```javascript
/**
 * @file Accessibility Tests for Turn Order Ticker
 * Uses axe-core for automated WCAG compliance testing.
 */

import { axe, toHaveNoViolations } from 'jest-axe';
import { setupIntegrationEnvironment } from '../integration/common/turnOrderTickerTestSetup.js';

expect.extend(toHaveNoViolations);

describe('Turn Order Ticker - Accessibility', () => {
  it('should have no WCAG 2.1 AA violations', async () => {
    const { eventBus, entityManager } = await setupIntegrationEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor']);
    await entityManager.createEntity('actor-2', ['core:actor']);

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2'],
      strategy: 'round-robin',
    });

    const results = await axe(document.body, {
      rules: {
        'color-contrast': { enabled: true },
        'aria-roles': { enabled: true },
        'aria-allowed-attr': { enabled: true },
        'landmark-one-main': { enabled: false }, // Not applicable to component
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA structure', () => {
    const ticker = document.querySelector('#turn-order-ticker');

    expect(ticker.getAttribute('role')).toBe('region');
    expect(ticker.getAttribute('aria-label')).toBe('Turn order');
    expect(ticker.getAttribute('aria-live')).toBe('polite');
  });

  it('should have keyboard-accessible actors', async () => {
    const { eventBus, entityManager } = await setupIntegrationEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor']);

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1'],
      strategy: 'round-robin',
    });

    const actorElement = document.querySelector('[data-entity-id="actor-1"]');

    // Should be focusable (or explicitly not if not interactive)
    // Since ticker actors are not interactive, they may not need tabindex
    // This is a design decision - verify with UX requirements
  });
});
```

## Polish and UX Improvements

### 1. Loading State
Add skeleton/loading state while actors are being fetched:

```css
.ticker-actor.loading {
  background: linear-gradient(90deg, #2c3e50 25%, #34495e 50%, #2c3e50 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 2. Hover Effects
Add subtle hover effects for better interactivity feedback:

```css
.ticker-actor:hover {
  transform: translateY(-2px);
  transition: transform 0.2s ease;
}

.ticker-actor:hover .ticker-actor-portrait,
.ticker-actor:hover .ticker-actor-name-badge {
  border-color: #5dade2;
}
```

### 3. Tooltip on Hover
Show full actor information on hover:

```javascript
#createActorElement(entity) {
  // ... existing code ...

  // Add title for tooltip
  container.title = `${displayData.name}${displayData.participating ? '' : ' (Not participating)'}`;

  // ... rest of code ...
}
```

### 4. Smooth Scroll Indicator
Add fade gradient for horizontal overflow:

```css
.ticker-actor-queue::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 40px;
  background: linear-gradient(to right, transparent, #2c3e50);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
}

.ticker-actor-queue.has-overflow::after {
  opacity: 1;
}
```

## Testing Commands

```bash
# Run accessibility tests
NODE_ENV=test npm run test:accessibility -- tests/accessibility/turnOrderTicker.accessibility.test.js --verbose

# Run with axe-core
NODE_ENV=test npx jest tests/accessibility/ --verbose

# Manual testing checklist
npm run dev
# Then follow manual testing steps above
```

## Acceptance Criteria
- [ ] Passes automated axe-core tests
- [ ] All images have alt text
- [ ] Color contrast meets WCAG AA standards
- [ ] Keyboard navigation works correctly
- [ ] Focus indicators visible
- [ ] Screen reader announces round start
- [ ] Screen reader announces turn changes
- [ ] Screen reader announces participation changes
- [ ] Respects `prefers-reduced-motion`
- [ ] Respects `prefers-contrast: high`
- [ ] Works with NVDA
- [ ] Works with JAWS
- [ ] Works with VoiceOver
- [ ] Valid HTML5
- [ ] Proper ARIA roles and attributes
- [ ] Visual polish complete (hover, tooltips, gradients)

## Tools and Resources

### Testing Tools
- **axe DevTools:** Browser extension for accessibility testing
- **WAVE:** Web accessibility evaluation tool
- **Lighthouse:** Chrome DevTools accessibility audit
- **Screen Readers:** NVDA (free), JAWS (trial), VoiceOver (built-in macOS)

### References
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

## Documentation Updates

After completing accessibility work, update:
- `docs/accessibility/turn-order-ticker.md` - Accessibility features
- `README.md` - Mention WCAG compliance
- `CLAUDE.md` - Add ticker to UI components list

## Final Checklist

- [ ] All accessibility tests pass
- [ ] Manual screen reader testing complete
- [ ] High contrast mode tested
- [ ] Reduced motion tested
- [ ] Keyboard navigation tested
- [ ] Color contrast verified
- [ ] ARIA implementation complete
- [ ] Documentation updated
- [ ] User guide includes accessibility notes

## Notes
- Accessibility is not optional; it's a requirement
- Test with real assistive technologies, not just automated tools
- Consider diverse user needs (visual, motor, cognitive, auditory)
- Involve users with disabilities in testing if possible

## Completion
This is the final ticket in the turn order ticker implementation. Upon completion, the feature should be:
- Fully functional
- Well-tested (unit, integration, accessibility)
- Documented
- Accessible to all users
- Polished and production-ready
