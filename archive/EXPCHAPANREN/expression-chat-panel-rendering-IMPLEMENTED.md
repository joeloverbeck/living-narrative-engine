# Specification: Expression Message Rendering in Chat Panel

**Status: ✅ IMPLEMENTED - All tickets completed**

## Overview

This specification describes the implementation of a new renderer that displays triggered emotional expression narratives in the main chat panel (`#message-list`) of `game.html`. Currently, expressions dispatch `core:perceptible_event` events that only appear in the perception log sidebar—not the main chat. This feature adds a dedicated renderer to display these narrative beats prominently in the chat flow.

## Problem Statement

The expression system evaluates emotional/sexual state changes and dispatches perceptible events when expressions trigger. These events contain rich third-person narrative descriptions (e.g., *"Avery's features ease as if a tension they didn't notice has let go..."*), but they are not currently rendered to the main chat panel where players see speech, thoughts, and action results.

**Current Flow:**
1. `ExpressionPersistenceListener` detects mood/sexual state changes
2. `ExpressionEvaluatorService` evaluates expression prerequisites
3. `ExpressionDispatcher` dispatches `core:perceptible_event` with `perceptionType: 'emotion.expression'`
4. `PerceptionLogRenderer` displays in left sidebar (`#perception-log-content`)
5. **GAP:** No renderer displays expressions in main chat panel (`#message-list`)

**Desired Flow:**
- Add step 5: `ExpressionMessageRenderer` displays `descriptionText` in main chat panel

## Architectural Decision

**Recommendation: Create dedicated `ExpressionMessageRenderer`** (Option B)

**Rationale:**
1. **Pattern Consistency**: Follows existing renderer architecture (`SpeechBubbleRenderer`, `DamageEventMessageRenderer`, `ActionResultRenderer`, `ChatAlertRenderer`)
2. **Single Responsibility**: `DamageEventMessageRenderer` already filters by `perceptionType: 'damage_received'`—extending it would couple unrelated concerns
3. **Testability**: Dedicated class enables focused unit testing
4. **Maintainability**: Tag-based theming and future enhancements isolated to one file

**Rejected Alternatives:**
- **Option A (Extend DamageEventMessageRenderer)**: Violates SRP, creates coupling
- **Option C (Generic NarrativeBeatRenderer)**: Over-engineering for current requirements

## Implementation Details

### 1. Files to Create

#### 1.1 `src/domUI/expressionMessageRenderer.js`

New renderer class with:
- Extends `BoundDomRendererBase`
- Subscribes to `core:perceptible_event`
- Filters for `perceptionType === 'emotion.expression'` or `perceptionType.startsWith('emotion.')`
- Renders `descriptionText` to `#message-list`
- Applies tag-based CSS modifiers for emotional categories

**Key Methods:**
```javascript
class ExpressionMessageRenderer extends BoundDomRendererBase {
  #subscribeToEvents()           // Subscribe to core:perceptible_event
  #handlePerceptibleEvent()      // Filter and process expression events
  #isExpressionPerceptionType()  // Check if perceptionType matches emotion.*
  #buildCssClasses()             // Build CSS classes from tags
  #renderMessage()               // Create li element and append to list
}
```

**Element Configuration:**
```javascript
const elementsConfig = {
  scrollContainer: { selector: '#outputDiv', required: true },
  listContainerElement: { selector: '#message-list', required: true },
};
```

#### 1.2 `css/components/_expression-messages.css`

Dedicated CSS for expression narrative messages with:
- Base `.expression-message` class (italic prose style, left border accent, gradient background)
- Tag-based modifiers (`.expression-message--anger`, `--affection`, `--loss`, `--threat`, `--agency`, `--attention`)
- Entry animation (`expressionFadeIn`)
- Reduced motion support
- WCAG AA compliant color contrasts

**Visual Design:**
```css
.expression-message {
  max-width: 85%;
  margin: 0.75rem auto;
  padding: 0.75rem 1rem;
  font-family: var(--font-narrative);
  font-style: italic;
  border-left: 3px solid var(--expression-accent-color, #00796b);
  background: linear-gradient(to right, rgba(0, 121, 107, 0.08), transparent);
  animation: expressionFadeIn 0.4s ease-out;
}
```

**Tag-Based Color Modifiers:**
| Modifier | Tags | Accent Color |
|----------|------|--------------|
| `--default` | (fallback) | `#00796b` (teal) |
| `--anger` | anger, rage, fury | `#c62828` (red) |
| `--affection` | affection, love, warmth | `#ad1457` (pink) |
| `--loss` | grief, despair, sorrow | `#37474f` (blue-grey) |
| `--threat` | fear, panic, horror | `#4a148c` (purple) |
| `--agency` | confidence, determination | `#00695c` (dark teal) |
| `--attention` | curious, fascinated | `#f57c00` (amber) |

#### 1.3 `tests/unit/domUI/expressionMessageRenderer.test.js`

Comprehensive unit test suite (see Testing Strategy section).

### 2. Files to Modify

#### 2.1 `src/dependencyInjection/tokens/tokens-ui.js`

Add token:
```javascript
ExpressionMessageRenderer: 'ExpressionMessageRenderer',
```

#### 2.2 `src/dependencyInjection/registrations/uiRegistrations.js`

1. Import `ExpressionMessageRenderer`
2. Register with `singletonFactory` lifecycle
3. Add eager instantiation in `registerUI()`

```javascript
// Registration
registerWithLog(
  registrar,
  tokens.ExpressionMessageRenderer,
  (c) => new ExpressionMessageRenderer({
    logger: c.resolve(tokens.ILogger),
    documentContext: c.resolve(tokens.IDocumentContext),
    safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    domElementFactory: c.resolve(tokens.DomElementFactory),
  }),
  { lifecycle: 'singletonFactory' },
  logger
);

// Eager instantiation
container.resolve(tokens.ExpressionMessageRenderer);
```

#### 2.3 `css/style.css` (or component import file)

Add import:
```css
@import 'components/_expression-messages.css';
```

#### 2.4 `src/expressions/expressionDispatcher.js` (Optional Enhancement)

To enable tag-based styling, add `tags` to `contextualData`:
```javascript
contextualData: {
  source: 'expression_system',
  expressionId: expression?.id ?? null,
  tags: expression?.tags ?? [],  // ADD THIS LINE
},
```

### 3. Event Flow

```
ExpressionPersistenceListener.handleEvent()
    ↓
ExpressionEvaluatorService.evaluate()
    ↓
ExpressionDispatcher.dispatch()
    ↓
eventBus.dispatch('core:perceptible_event', {
  perceptionType: 'emotion.expression',
  descriptionText: "Third-person narrative...",
  contextualData: { source: 'expression_system', tags: [...] }
})
    ↓
ExpressionMessageRenderer.#handlePerceptibleEvent()
    ↓
#isExpressionPerceptionType() → true
    ↓
#buildCssClasses() → 'expression-message expression-message--affection'
    ↓
#renderMessage() → <li class="expression-message expression-message--affection">...</li>
    ↓
scrollToBottom()
```

### 4. Filtering Logic

```javascript
#isExpressionPerceptionType(perceptionType) {
  if (!perceptionType) return false;
  return (
    perceptionType === 'emotion.expression' ||
    perceptionType.startsWith('emotion.')
  );
}
```

This allows future emotion subtypes (e.g., `emotion.mood_shift`) to be handled by the same renderer.

### 5. CSS Class Building

```javascript
const EXPRESSION_TAG_MODIFIERS = {
  anger: 'expression-message--anger',
  rage: 'expression-message--anger',
  affection: 'expression-message--affection',
  love: 'expression-message--affection',
  // ... etc
};

#buildCssClasses(payload) {
  const classes = ['expression-message'];
  const tags = payload.contextualData?.tags || [];

  for (const tag of tags) {
    const modifier = EXPRESSION_TAG_MODIFIERS[tag.toLowerCase()];
    if (modifier && !classes.includes(modifier)) {
      classes.push(modifier);
    }
  }

  if (classes.length === 1) {
    classes.push('expression-message--default');
  }

  return classes.join(' ');
}
```

## Testing Strategy

### Unit Tests (`tests/unit/domUI/expressionMessageRenderer.test.js`)

**Test Structure:**
```javascript
describe('ExpressionMessageRenderer', () => {
  describe('Initialization', () => {
    it('should subscribe to core:perceptible_event on construction');
    it('should bind scrollContainer and listContainerElement');
    it('should log debug message on instantiation');
    it('should validate required dependencies');
  });

  describe('Event Filtering (#isExpressionPerceptionType)', () => {
    it('should return true for perceptionType "emotion.expression"');
    it('should return true for perceptionType starting with "emotion."');
    it('should return false for perceptionType "damage_received"');
    it('should return false for perceptionType "communication.speech"');
    it('should return false for null/undefined perceptionType');
  });

  describe('Event Handling (#handlePerceptibleEvent)', () => {
    it('should render message for emotion.expression events');
    it('should ignore non-emotion events');
    it('should warn and skip when descriptionText is empty');
    it('should warn and skip when descriptionText is whitespace-only');
  });

  describe('CSS Class Building (#buildCssClasses)', () => {
    it('should always include base "expression-message" class');
    it('should apply --anger modifier for "anger" tag');
    it('should apply --anger modifier for "rage" tag');
    it('should apply --affection modifier for "love" tag');
    it('should apply --affection modifier for "warmth" tag');
    it('should apply --loss modifier for "grief" tag');
    it('should apply --threat modifier for "panic" tag');
    it('should apply --agency modifier for "confidence" tag');
    it('should apply --attention modifier for "curious" tag');
    it('should apply --default when no tags match');
    it('should apply --default when tags array is empty');
    it('should apply --default when contextualData.tags is undefined');
    it('should handle case-insensitive tag matching');
    it('should deduplicate modifier classes from multiple matching tags');
  });

  describe('Rendering (#renderMessage)', () => {
    it('should create li element via domElementFactory');
    it('should apply CSS classes to li element');
    it('should set textContent to descriptionText');
    it('should append li to listContainerElement');
    it('should call scrollToBottom after appending');
  });

  describe('Error Handling', () => {
    it('should dispatch SYSTEM_ERROR_OCCURRED when listContainerElement is null');
    it('should dispatch SYSTEM_ERROR_OCCURRED when domElementFactory.li() returns null');
    it('should not throw when handling malformed event payloads');
  });

  describe('Cleanup', () => {
    it('should unsubscribe from events on dispose');
  });
});
```

**Estimated Test Count:** 25-30 unit tests

### Integration Tests (`tests/integration/domUI/expressionMessageRenderer.integration.test.js`)

```javascript
describe('ExpressionMessageRenderer Integration', () => {
  describe('Full Event Flow', () => {
    it('should render expression when ExpressionDispatcher dispatches event');
    it('should not interfere with DamageEventMessageRenderer');
    it('should not interfere with SpeechBubbleRenderer');
    it('should not interfere with ActionResultRenderer');
  });

  describe('DOM Integration', () => {
    it('should append to existing message list with other message types');
    it('should scroll chat panel to bottom after rendering');
  });

  describe('Visual Verification', () => {
    it('should render with correct CSS classes based on tags');
  });
});
```

**Estimated Test Count:** 6-8 integration tests

### CSS Tests (Manual/Visual)

1. Verify expression messages are visually distinct from speech bubbles
2. Verify expression messages are visually distinct from action results
3. Verify expression messages are visually distinct from damage messages
4. Verify tag-based color modifiers apply correctly
5. Verify animation respects `prefers-reduced-motion`
6. Verify responsive behavior on mobile viewports
7. Verify WCAG AA color contrast compliance

## Visual Design Rationale

Expression messages should feel like **narrative prose**—emotional beats woven between dialogue and action feedback. Key distinctions:

| Message Type | Visual Treatment |
|--------------|------------------|
| Speech Bubbles | Left-aligned with portrait, purple border, conversational |
| Thought Bubbles | Dashed border, lighter background, internal monologue |
| Action Results | Centered, solid green/red, feedback-like |
| Damage Messages | Severity-colored border, italic, warning tone |
| **Expression Messages** | Centered, gradient background, italic prose, subtle left accent |

The gradient background and left border accent create a "spotlight" effect that draws attention without being as visually urgent as success/failure feedback.

## Dependencies

**Existing Infrastructure Used:**
- `BoundDomRendererBase` (src/domUI/boundDomRendererBase.js)
- `DomElementFactory` (src/domUI/domElementFactory.js)
- `ISafeEventDispatcher` interface
- `ILogger` interface
- `IDocumentContext` interface
- Perception Type Registry (src/perception/registries/perceptionTypeRegistry.js)

**No New External Dependencies Required**

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Expression events fire too frequently, cluttering chat | Existing rate limiting in ExpressionDispatcher (once per turn) |
| Visual style clashes with theme variations | Use CSS custom properties for accent colors |
| Performance impact from additional event listener | Minimal—single subscriber filtering by perceptionType |
| Tags not available in event payload | Fallback to `--default` modifier; optional enhancement to ExpressionDispatcher |

## Acceptance Criteria

1. When an expression triggers, its `descriptionText` appears in the main chat panel
2. Expression messages use italic prose styling with gradient background and left border accent
3. Expression messages are visually distinct from speech, thoughts, action results, and damage messages
4. Tag-based color modifiers apply when tags are available in contextualData
5. Entry animation plays (respecting `prefers-reduced-motion`)
6. Chat panel scrolls to show new expression message
7. All unit tests pass with >90% branch coverage
8. All integration tests pass
9. No regressions in existing chat panel functionality

## Future Considerations

1. **First-Person View**: For player characters, could optionally show `actorDescription` (first-person) instead of `descriptionText` (third-person)
2. **Alternate Descriptions**: Support `alternateDescriptions` for non-visual perception contexts (blindness, etc.)
3. **Expanded Tag System**: More granular emotional categories and corresponding visual treatments
4. **Accessibility Enhancement**: Add `aria-live="polite"` for screen reader announcements
5. **Collapsible Expressions**: Option to collapse/expand verbose expressions to reduce chat clutter

## References

- `src/expressions/expressionDispatcher.js` - Event dispatch source
- `src/domUI/damageEventMessageRenderer.js` - Pattern to follow for perceptible event filtering
- `src/domUI/boundDomRendererBase.js` - Base class for DOM renderers
- `src/perception/registries/perceptionTypeRegistry.js` - Perception type metadata
- `css/components/_damage-messages.css` - CSS pattern reference
- `data/mods/emotions-*/expressions/*.expression.json` - Expression data files
