# EXPCHAPANREN-002: ExpressionMessageRenderer Class Implementation

## Status: ✅ COMPLETED

## Summary

Implement the `ExpressionMessageRenderer` class that subscribes to `core:perceptible_event` events, filters for emotion-related perception types, and renders narrative text to the chat panel.

## Files to Create

- `src/domUI/expressionMessageRenderer.js`

## Files to Modify

- `src/domUI/index.js` (add export statement only)
- `src/dependencyInjection/tokens/tokens-ui.js` (add DI token)
- `src/dependencyInjection/registrations/uiRegistrations.js` (register + eager instantiate)
- `tests/unit/domUI/expressionMessageRenderer.test.js` (unit coverage for new renderer)

## Out of Scope

- **DO NOT** modify `ExpressionDispatcher` or any expression system files
- **DO NOT** modify CSS files (handled in EXPCHAPANREN-001)
- **DO NOT** modify `game.html`

## Implementation Details

### 1. Create `src/domUI/expressionMessageRenderer.js`

#### Structure

```javascript
/**
 * @file Renders expression narrative messages to the chat message list.
 * @module ExpressionMessageRenderer
 */

// Type imports
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./domElementFactory.js').default} DomElementFactory */

// Runtime imports
import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';
```

#### Tag-to-Modifier Mapping

```javascript
const EXPRESSION_TAG_MODIFIERS = Object.freeze({
  // Anger family
  anger: 'expression-message--anger',
  rage: 'expression-message--anger',
  fury: 'expression-message--anger',
  // Affection family
  affection: 'expression-message--affection',
  love: 'expression-message--affection',
  warmth: 'expression-message--affection',
  // Loss family
  grief: 'expression-message--loss',
  despair: 'expression-message--loss',
  sorrow: 'expression-message--loss',
  // Threat family
  fear: 'expression-message--threat',
  panic: 'expression-message--threat',
  horror: 'expression-message--threat',
  // Agency family
  confidence: 'expression-message--agency',
  determination: 'expression-message--agency',
  // Attention family
  curious: 'expression-message--attention',
  fascinated: 'expression-message--attention',
});
```

#### Tag Data Availability

`ExpressionDispatcher` does **not** currently include `contextualData.tags` in its payload. The renderer must therefore fall back to `expression-message--default` unless tags are already present via another source. Do **not** add tags here; that remains out of scope.

#### Key Methods

| Method | Purpose |
|--------|---------|
| `constructor({ logger, documentContext, safeEventDispatcher, domElementFactory })` | Initialize and subscribe to events |
| `#subscribeToEvents()` | Subscribe to `core:perceptible_event` |
| `#handlePerceptibleEvent({ payload })` | Filter and process expression events |
| `#isExpressionPerceptionType(perceptionType)` | Check if `emotion.expression` or starts with `emotion.` |
| `#buildCssClasses(payload)` | Build CSS class string from tags |
| `#renderMessage(message, cssClass)` | Create `<li>` and append to list |

#### Elements Configuration

```javascript
const elementsConfig = {
  scrollContainer: { selector: '#outputDiv', required: true },
  listContainerElement: { selector: '#message-list', required: true },
};
```

#### Filtering Logic

```javascript
#isExpressionPerceptionType(perceptionType) {
  if (!perceptionType) return false;
  return (
    perceptionType === 'emotion.expression' ||
    perceptionType.startsWith('emotion.')
  );
}
```

#### CSS Class Building Logic

```javascript
#buildCssClasses(payload) {
  const classes = ['expression-message'];
  const tags = payload.contextualData?.tags || [];

  for (const tag of tags) {
    const modifier = EXPRESSION_TAG_MODIFIERS[tag.toLowerCase()];
    if (modifier && !classes.includes(modifier)) {
      classes.push(modifier);
    }
  }

  // Apply default if no tag matched
  if (classes.length === 1) {
    classes.push('expression-message--default');
  }

  return classes.join(' ');
}
```

### 2. Modify `src/domUI/index.js`

Add export after `DamageEventMessageRenderer`:

```javascript
// Expression Message Renderer
export { ExpressionMessageRenderer } from './expressionMessageRenderer.js';
```

### 3. Register in UI DI

- Add `ExpressionMessageRenderer` token in `tokens-ui.js`
- Register the renderer in `registerRenderers` using `singletonFactory`
- Eagerly instantiate in `registerUI` to attach event listeners (parallel to `DamageEventMessageRenderer`)

## Acceptance Criteria

### Tests That Must Pass

- File compiles without TypeScript/ESLint errors: `npm run typecheck && npx eslint src/domUI/expressionMessageRenderer.js`
- Import resolves from index: `import { ExpressionMessageRenderer } from './domUI/index.js'`
- `npm run test:unit -- tests/unit/domUI/expressionMessageRenderer.test.js`

### Invariants That Must Remain True

1. `DamageEventMessageRenderer` behavior unchanged (still filters `damage_received`)
2. All existing exports from `src/domUI/index.js` unchanged
3. No circular dependencies introduced
4. Class extends `BoundDomRendererBase` following existing pattern
5. Event subscription uses `_subscribe()` method from base class
6. Error handling dispatches `SYSTEM_ERROR_OCCURRED_ID` events (not logging directly)

## Dependencies

- **EXPCHAPANREN-001** must be completed (CSS classes referenced must exist)

## Pattern Reference

Follow `src/domUI/damageEventMessageRenderer.js` structure:
- Same constructor signature pattern
- Same `elementsConfig` structure
- Same `#renderBubble` pattern for DOM element creation
- Same error handling pattern for missing elements

## Estimated Diff Size

- New file: ~150-180 lines
- Modified files: +30-60 lines

## Outcome

Implemented `ExpressionMessageRenderer` with emotion.* filtering, default styling fallback when tags are absent, DI registration + eager instantiation, and unit tests. No CSS or expression system changes were required beyond the renderer wiring outlined here.
