# MOOANDSEXAROSYS-010: Sexual State UI Panel

## Outcome

**Status**: COMPLETED

### Implementation Summary

Successfully implemented the SexualStatePanel UI component that displays sexual state variables as horizontal bars with color-coded visuals.

### Files Created

1. **`src/domUI/sexualStatePanel.js`** - Full panel implementation
   - Extends `BoundDomRendererBase`
   - Subscribes to `TURN_STARTED_ID` and `COMPONENT_ADDED_ID` events
   - Renders 3 bars: Excitation (0-100), Inhibition (0-100), Arousal (0-1)
   - Displays Baseline Libido with +/- sign and color coding
   - Displays qualitative sexual states text using `formatSexualStatesForPrompt()`
   - Full dependency validation for `entityManager` and `emotionCalculatorService`

2. **`css/components/_sexual-state-panel.css`** - Panel styling
   - Warm sepia theme matching project aesthetic
   - Pink/rose accent colors (#e91e63) for bars
   - CSS custom properties for theming
   - Bar fill animations with smooth transitions
   - Baseline libido color coding (positive green, negative red)

3. **`tests/unit/domUI/sexualStatePanel.test.js`** - Comprehensive unit tests
   - 52 test cases covering all functionality
   - Constructor validation tests
   - Event handling tests
   - Bar rendering tests with correct scales
   - Baseline libido rendering tests
   - Sexual states text rendering tests
   - Panel visibility logic tests
   - Edge case tests

### Files Modified

1. **`src/domUI/index.js`** - Added export for SexualStatePanel
2. **`src/dependencyInjection/tokens/tokens-ui.js`** - Added `SexualStatePanel` token
3. **`src/dependencyInjection/registrations/uiRegistrations.js`** - Added registration with proper dependency injection
4. **`game.html`** - Added `#sexual-state-panel` div container after `#emotional-state-panel`
5. **`css/style.css`** - Added import for `_sexual-state-panel.css`

### Ticket Corrections Applied

During implementation, the following ticket inaccuracies were corrected:

1. **Event Name**: Changed reference from `COMPONENT_UPDATED` to `COMPONENT_ADDED_ID` (matching codebase pattern)
2. **Dependency Name**: Changed `eventBus` to `validatedEventDispatcher` (matching DI pattern)
3. **Missing Feature**: Added qualitative sexual states text display requirement using `formatSexualStatesForPrompt()`

### Test Results

All 52 unit tests pass with full coverage of:
- Constructor validation (12 tests)
- Event handling (10 tests)
- Bar rendering (9 tests)
- Baseline libido rendering (4 tests)
- Sexual states text rendering (5 tests)
- Panel visibility (5 tests)
- Dispose functionality (1 test)
- Edge cases (6 tests)

---

## Summary

Create the SexualStatePanel UI component that displays the sexual state variables (excitation, inhibition, arousal) as horizontal bars with color-coded visuals, updating in real-time based on component changes.

## Files to Touch

### CREATE

- `src/domUI/sexualStatePanel.js` - Panel implementation
- `css/components/_sexual-state-panel.css` - Panel styling

### MODIFY

- `src/domUI/index.js` - Export new panel
- `game.html` - Add panel container element
- `src/dependencyInjection/tokens/tokens-ui.js` - Add DI token
- `src/dependencyInjection/registrations/uiRegistrations.js` - Register panel

## Out of Scope

- Emotional state panel (see MOOANDSEXAROSYS-009)
- EmotionCalculatorService implementation (see MOOANDSEXAROSYS-003)
- Component definitions (see MOOANDSEXAROSYS-001)
- LLM response processing (see MOOANDSEXAROSYS-007)
- Prompt instructions (see MOOANDSEXAROSYS-008)

## Technical Specification

### Component Architecture

The panel extends `BoundDomRendererBase` (following the InjuryStatusPanel pattern):

```javascript
/**
 * @file sexualStatePanel.js
 * Displays the sexual state variables for the current actor.
 */

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { SEXUAL_STATE_COMPONENT_ID } from '../constants/componentIds.js';
import { TURN_STARTED_ID, COMPONENT_ADDED_ID } from '../constants/eventIds.js';

class SexualStatePanel extends BoundDomRendererBase {
  #entityManager;
  #emotionCalculatorService;
  #currentActorId;

  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    entityManager,
    emotionCalculatorService
  }) {
    const elementsConfig = {
      panelElement: {
        selector: '#sexual-state-panel',
        required: true,
      },
    };

    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
    });

    this.#entityManager = entityManager;
    this.#emotionCalculatorService = emotionCalculatorService;
    this.#currentActorId = null;

    // Subscribe to events
    this._subscribe(TURN_STARTED_ID, this.#handleTurnStarted.bind(this));
    this._subscribe(COMPONENT_ADDED_ID, this.#handleComponentAdded.bind(this));
  }

  #handleTurnStarted(eventWrapper) {
    const actualPayload = eventWrapper.payload;
    if (!actualPayload || typeof actualPayload.entityId !== 'string') {
      this.#currentActorId = null;
      this.#hidePanel();
      return;
    }
    this.#currentActorId = actualPayload.entityId;
    this.#render();
  }

  #handleComponentAdded(eventWrapper) {
    const actualPayload = eventWrapper.payload;
    if (!actualPayload || !actualPayload.entityId || !actualPayload.componentId) {
      return;
    }
    // Only re-render if this is the current actor's sexual_state component
    if (actualPayload.entityId === this.#currentActorId &&
        actualPayload.componentId === SEXUAL_STATE_COMPONENT_ID) {
      this.#render();
    }
  }

  #render() {
    // Render the sexual state variables as horizontal bars
    // Also displays qualitative sexual states text below Baseline Libido
  }
}

export default SexualStatePanel;
```

### Panel Layout

```
┌─────────────────────────────────────────┐
│ SEXUAL STATE                            │
├─────────────────────────────────────────┤
│ Excitation  ████████████░░░░░░░░░ 65    │ 0-100 (pink/red)
│ Inhibition  ██████░░░░░░░░░░░░░░░ 30    │ 0-100 (blue)
│ Arousal     ███████░░░░░░░░░░░░░░ 0.35  │ 0-1 (purple)
├─────────────────────────────────────────┤
│ Baseline Libido: +15                    │ -50 to +50 (numeric only)
├─────────────────────────────────────────┤
│ Current: sexual lust: strong, ...       │ Qualitative text from sexual states
└─────────────────────────────────────────┘
```

### Bar Configuration

- **Excitation**: 0-100 scale, pink/red gradient
- **Inhibition**: 0-100 scale, blue gradient
- **Arousal**: 0-1 scale (calculated), purple gradient
- **Baseline Libido**: Numeric display only (not a bar)
- **Qualitative Sexual States**: Text display below baseline using `formatSexualStatesForPrompt()`

### Color Coding

```javascript
const BAR_COLORS = {
  excitation: { background: '#2d2d44', fill: '#e91e63' },  // pink/red
  inhibition: { background: '#2d2d44', fill: '#2196f3' },  // blue
  arousal: { background: '#2d2d44', fill: '#9c27b0' }      // purple
};
```

### Visibility Logic

The panel should be hidden if:
- No current actor is set
- Current actor lacks `core:sexual_state` component

```javascript
#shouldShowPanel() {
  if (!this.#currentActorId) return false;
  const entity = this.#entityManager.getEntityInstance(this.#currentActorId);
  if (!entity) return false;
  return entity.hasComponent(SEXUAL_STATE_COMPONENT_ID);
}
```

### HTML Structure

Add to `game.html`:

```html
<div id="sexual-state-panel" class="sexual-state-panel hidden">
  <!-- Rendered dynamically -->
</div>
```

### CSS Structure

```css
/* css/components/_sexual-state-panel.css */

.sexual-state-panel {
  background: var(--panel-bg, #1a1a2e);
  border: 1px solid var(--panel-border, #16213e);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
}

.sexual-state-panel.hidden {
  display: none;
}

.sexual-state-panel__title {
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--text-primary, #eee);
}

.sexual-state-panel__row {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.sexual-state-panel__label {
  width: 80px;
  font-size: 0.75rem;
  color: var(--text-secondary, #aaa);
}

.sexual-state-panel__bar-container {
  flex: 1;
  height: 16px;
  background: var(--bar-bg, #2d2d44);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.sexual-state-panel__bar-fill {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.sexual-state-panel__bar-fill--excitation {
  background: linear-gradient(90deg, #e91e63, #f44336);
}

.sexual-state-panel__bar-fill--inhibition {
  background: linear-gradient(90deg, #2196f3, #1976d2);
}

.sexual-state-panel__bar-fill--arousal {
  background: linear-gradient(90deg, #9c27b0, #7b1fa2);
}

.sexual-state-panel__value {
  width: 50px;
  text-align: right;
  font-size: 0.75rem;
  color: var(--text-primary, #eee);
}

.sexual-state-panel__divider {
  border-top: 1px solid var(--panel-border, #16213e);
  margin: 8px 0;
}

.sexual-state-panel__baseline {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-secondary, #aaa);
}

.sexual-state-panel__baseline-value {
  color: var(--text-primary, #eee);
}

.sexual-state-panel__baseline-value--positive {
  color: #4caf50;
}

.sexual-state-panel__baseline-value--negative {
  color: #f44336;
}
```

### DI Token

Add to `tokens-ui.js`:

```javascript
SexualStatePanel: 'SexualStatePanel'
```

### DI Registration

Add to `uiRegistrations.js` (following EmotionalStatePanel pattern):

```javascript
container.register(
  uiTokens.SexualStatePanel,
  (c) => new SexualStatePanel({
    logger: c.resolve(coreTokens.ILogger),
    documentContext: c.resolve(uiTokens.IDocumentContext),
    validatedEventDispatcher: c.resolve(coreTokens.IValidatedEventDispatcher),
    entityManager: c.resolve(coreTokens.IEntityManager),
    emotionCalculatorService: c.resolve(aiTokens.EmotionCalculatorService),
  }),
  Lifecycle.Singleton
);
```

## Acceptance Criteria

### Panel Implementation

- [x] Class extends `BoundDomRendererBase`
- [x] Constructor accepts `logger`, `documentContext`, `validatedEventDispatcher`, `entityManager`, `emotionCalculatorService`
- [x] Constructor subscribes to `TURN_STARTED_ID` and `COMPONENT_ADDED_ID`
- [x] Renders 3 bars: excitation, inhibition, arousal

### Visual Requirements

- [x] Excitation bar (0-100): pink/red fill
- [x] Inhibition bar (0-100): blue fill
- [x] Arousal bar (0-1): purple fill, calculated value
- [x] Baseline libido as numeric display only (not a bar)
- [x] Baseline shows +/- sign with color coding
- [x] Qualitative sexual states text displayed below baseline using `formatSexualStatesForPrompt()`

### Arousal Calculation

- [x] Uses formula: `clamp01((excitation - inhibition + baseline) / 100)`
- [x] Displays as 0.00 to 1.00 with 2 decimal places

### Visibility Logic

- [x] Panel hidden when no current actor
- [x] Panel hidden when actor lacks `core:sexual_state` component
- [x] Panel visible when actor has `core:sexual_state` component

### Event Handling

- [x] Updates on `TURN_STARTED_ID` event
- [x] Updates on `COMPONENT_ADDED_ID` event for `core:sexual_state`
- [x] Only updates when relevant actor's sexual state changes

### CSS Styling

- [x] New CSS file created at `css/components/_sexual-state-panel.css`
- [x] Uses CSS custom properties for theming
- [x] Bar fill animations (transition)
- [x] Hidden class support
- [x] Baseline libido color coding (positive = green, negative = red)

### Integration

- [x] Exported from `src/domUI/index.js`
- [x] Container element added to `game.html`
- [x] DI token defined in `tokens-ui.js`
- [x] Registration added to `uiRegistrations.js`

### Unit Tests

- [x] Test initialization subscribes to events
- [x] Test render with valid sexual_state component
- [x] Test hidden state when actor lacks component
- [x] Test hidden state when no current actor
- [x] Test update on TURN_STARTED_ID
- [x] Test update on COMPONENT_ADDED_ID for sexual_state
- [x] Test ignores COMPONENT_ADDED_ID for other components
- [x] Test qualitative sexual states text rendering
- [x] Test arousal calculation: (65 - 30 + 15) / 100 = 0.50
- [x] Test arousal clamping: minimum 0, maximum 1
- [x] Test baseline display: positive with +, negative with -
- [x] Test bar width calculation

### Test Commands

```bash
# Run panel tests
npm run test:unit -- --testPathPattern="sexualStatePanel"

# Run integration tests
npm run test:integration -- --testPathPattern="sexualStatePanel"
```

## Example Render Output

Given sexual_state data:
```javascript
{
  sex_excitation: 65,
  sex_inhibition: 30,
  baseline_libido: 15
}
```

The panel renders:
- Excitation bar: 65% width, pink/red fill, shows "65"
- Inhibition bar: 30% width, blue fill, shows "30"
- Arousal bar: 50% width (calculated: (65-30+15)/100 = 0.50), purple fill, shows "0.50"
- Baseline: "Baseline Libido: +15" in green text

### Edge Cases

**High inhibition scenario:**
```javascript
{
  sex_excitation: 20,
  sex_inhibition: 80,
  baseline_libido: -10
}
// Arousal = clamp01((20 - 80 + -10) / 100) = clamp01(-0.70) = 0.00
```

**Maximum arousal scenario:**
```javascript
{
  sex_excitation: 100,
  sex_inhibition: 0,
  baseline_libido: 50
}
// Arousal = clamp01((100 - 0 + 50) / 100) = clamp01(1.50) = 1.00
```

## Dependencies

- MOOANDSEXAROSYS-001 (component definitions must exist)
- MOOANDSEXAROSYS-007 (workflow updates components, triggering panel refresh)

## Dependent Tickets

- None (this is a leaf ticket)
