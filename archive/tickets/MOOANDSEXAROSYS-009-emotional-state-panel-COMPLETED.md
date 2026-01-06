# MOOANDSEXAROSYS-009: Emotional State UI Panel

## Summary

Create the EmotionalStatePanel UI component that displays the 7 mood axes as horizontal bars with color-coded visuals, updating in real-time based on component changes.

## Files to Touch

### CREATE

- `src/domUI/emotionalStatePanel.js` - Panel implementation
- `css/components/_emotional-state-panel.css` - Panel styling

### MODIFY

- `src/domUI/index.js` - Export new panel
- `game.html` - Add panel container element
- `src/dependencyInjection/tokens/tokens-ui.js` - Add DI token
- `src/dependencyInjection/registrations/uiRegistrations.js` - Register panel

## Out of Scope

- Sexual state panel (see MOOANDSEXAROSYS-010)
- EmotionCalculatorService implementation (see MOOANDSEXAROSYS-003)
- Component definitions (see MOOANDSEXAROSYS-001)
- LLM response processing (see MOOANDSEXAROSYS-007)
- Prompt instructions (see MOOANDSEXAROSYS-008)

## Technical Specification

### Component Architecture

The panel extends `BoundDomRendererBase` (following the InjuryStatusPanel pattern):

```javascript
/**
 * @file emotionalStatePanel.js
 * Displays the 7-axis emotional state for the current actor.
 */

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { MOOD_COMPONENT_ID } from '../constants/componentIds.js';
import { TURN_STARTED_ID, COMPONENT_ADDED_ID } from '../constants/eventIds.js';

class EmotionalStatePanel extends BoundDomRendererBase {
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
      panelElement: { selector: '#emotional-state-panel', required: true },
    };
    super({ logger, documentContext, validatedEventDispatcher, elementsConfig });

    // Validate dependencies
    if (!entityManager) {
      throw new Error('EmotionalStatePanel: entityManager dependency is required');
    }
    if (!emotionCalculatorService) {
      throw new Error('EmotionalStatePanel: emotionCalculatorService dependency is required');
    }

    this.#entityManager = entityManager;
    this.#emotionCalculatorService = emotionCalculatorService;
    this.#currentActorId = null;

    // Subscribe to events
    this._subscribe(TURN_STARTED_ID, this.#handleTurnStarted.bind(this));
    this._subscribe(COMPONENT_ADDED_ID, this.#handleComponentAdded.bind(this));
  }

  #handleTurnStarted(event) {
    this.#currentActorId = event.payload?.entityId;
    this.#render();
  }

  #handleComponentAdded(event) {
    const { entityId, componentId } = event.payload || {};
    if (entityId === this.#currentActorId && componentId === MOOD_COMPONENT_ID) {
      this.#render();
    }
  }

  #render() {
    // Render the 7 mood axes as horizontal bars
    // Then render calculated emotions text using emotionCalculatorService.formatEmotionsForPrompt()
  }
}

export default EmotionalStatePanel;
```

### Panel Layout

```
┌─────────────────────────────────────────┐
│ EMOTIONAL STATE                         │
├─────────────────────────────────────────┤
│ Unpleasant ◄────────┼────────► Pleasant │ valence
│ Depleted   ◄────────┼────────► Energized│ arousal
│ Helpless   ◄────────┼────────► In Control│ agency_control
│ Safe       ◄────────┼────────► Endangered│ threat
│ Indifferent◄────────┼────────► Absorbed │ engagement
│ Hopeless   ◄────────┼────────► Hopeful  │ future_expectancy
│ Shame      ◄────────┼────────► Pride    │ self_evaluation
├─────────────────────────────────────────┤
│ Current: joy: strong, curiosity: moderate │ (calculated emotions text)
└─────────────────────────────────────────┘
```

### Calculated Emotions Display

Below the 7 mood axis bars, display the calculated emotions text using `EmotionCalculatorService.formatEmotionsForPrompt()`. This reuses the same formatting logic used for LLM prompts, ensuring consistency between what the UI shows and what the LLM receives.

### Bar Configuration

Each axis displays as a horizontal bar with:
- Center marker at 0
- Left side represents negative values (-100 to 0)
- Right side represents positive values (0 to 100)
- Numeric value displayed on the bar

### Color Coding Per Axis

```javascript
const AXIS_COLORS = {
  valence: { negative: '#c45850', positive: '#47a847' },        // red to green
  arousal: { negative: '#6c757d', positive: '#ffc107' },        // gray to yellow
  agency_control: { negative: '#6c757d', positive: '#0d6efd' }, // gray to blue
  threat: { negative: '#47a847', positive: '#dc3545' },         // green to red
  engagement: { negative: '#6c757d', positive: '#0dcaf0' },     // gray to cyan
  future_expectancy: { negative: '#c45850', positive: '#198754' }, // red to green
  self_evaluation: { negative: '#6f42c1', positive: '#fd7e14' }  // purple to orange
};
```

### Axis Labels

```javascript
const AXIS_LABELS = {
  valence: { negative: 'Unpleasant', positive: 'Pleasant' },
  arousal: { negative: 'Depleted', positive: 'Energized' },
  agency_control: { negative: 'Helpless', positive: 'In Control' },
  threat: { negative: 'Safe', positive: 'Endangered' },
  engagement: { negative: 'Indifferent', positive: 'Absorbed' },
  future_expectancy: { negative: 'Hopeless', positive: 'Hopeful' },
  self_evaluation: { negative: 'Shame', positive: 'Pride' }
};
```

### Visibility Logic

The panel should be hidden if:
- No current actor is set
- Current actor lacks `core:mood` component

```javascript
#shouldShowPanel() {
  if (!this.#currentActorId) return false;
  const entity = this.#entityManager.getEntityInstance(this.#currentActorId);
  if (!entity) return false;
  return entity.hasComponent(MOOD_COMPONENT_ID);
}
```

### HTML Structure

Add to `game.html`:

```html
<div id="emotional-state-panel" class="emotional-state-panel hidden">
  <!-- Rendered dynamically -->
</div>
```

### CSS Structure

```css
/* css/components/_emotional-state-panel.css */

.emotional-state-panel {
  background: var(--panel-bg, #1a1a2e);
  border: 1px solid var(--panel-border, #16213e);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
}

.emotional-state-panel.hidden {
  display: none;
}

.emotional-state-panel__title {
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--text-primary, #eee);
}

.emotional-state-panel__axis {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.emotional-state-panel__label {
  width: 80px;
  font-size: 0.75rem;
  color: var(--text-secondary, #aaa);
}

.emotional-state-panel__bar-container {
  flex: 1;
  height: 16px;
  background: var(--bar-bg, #2d2d44);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.emotional-state-panel__bar-center {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--bar-center, #555);
}

.emotional-state-panel__bar-fill {
  position: absolute;
  top: 2px;
  bottom: 2px;
  border-radius: 2px;
}

.emotional-state-panel__bar-fill--negative {
  right: 50%;
}

.emotional-state-panel__bar-fill--positive {
  left: 50%;
}

.emotional-state-panel__value {
  width: 40px;
  text-align: right;
  font-size: 0.75rem;
  color: var(--text-primary, #eee);
}
```

### DI Token

Add to `tokens-ui.js`:

```javascript
EmotionalStatePanel: 'EmotionalStatePanel'
```

### DI Registration

Add to `uiRegistrations.js`:

```javascript
container.register(
  tokens.EmotionalStatePanel,
  (c) => new EmotionalStatePanel({
    logger: c.resolve(tokens.ILogger),
    documentContext: c.resolve(tokens.IDocumentContext),
    validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
    entityManager: c.resolve(tokens.IEntityManager),
    emotionCalculatorService: c.resolve(tokens.EmotionCalculatorService)
  }),
  Lifecycle.Singleton
);
```

## Acceptance Criteria

### Panel Implementation

- [ ] Class extends `BoundDomRendererBase`
- [ ] Constructor accepts `logger`, `documentContext`, `validatedEventDispatcher`, `entityManager`, `emotionCalculatorService`
- [ ] Constructor subscribes to `TURN_STARTED_ID` and `COMPONENT_ADDED_ID`
- [ ] Renders all 7 mood axes as horizontal bars
- [ ] Displays calculated emotions text below bars using `emotionCalculatorService.formatEmotionsForPrompt()`

### Visual Requirements

- [ ] Each axis has left/right labels showing negative/positive meaning
- [ ] Bars show center marker at 0
- [ ] Bar fill direction indicates negative (left) or positive (right)
- [ ] Numeric value displayed for each axis
- [ ] Color coding per axis as specified

### Visibility Logic

- [ ] Panel hidden when no current actor
- [ ] Panel hidden when actor lacks `core:mood` component
- [ ] Panel visible when actor has `core:mood` component

### Event Handling

- [ ] Updates on `TURN_STARTED_ID` event
- [ ] Updates on `COMPONENT_ADDED_ID` event for `core:mood`
- [ ] Only updates when relevant actor's mood changes

### CSS Styling

- [ ] New CSS file created at `css/components/_emotional-state-panel.css`
- [ ] Uses CSS custom properties for theming
- [ ] Responsive bar widths
- [ ] Hidden class support

### Integration

- [ ] Exported from `src/domUI/index.js`
- [ ] Container element added to `game.html`
- [ ] DI token defined in `tokens-ui.js`
- [ ] Registration added to `uiRegistrations.js`

### Unit Tests

- [ ] Test initialization subscribes to events
- [ ] Test render with valid mood component
- [ ] Test hidden state when actor lacks component
- [ ] Test hidden state when no current actor
- [ ] Test update on TURN_STARTED_ID
- [ ] Test update on COMPONENT_ADDED_ID for mood
- [ ] Test ignores COMPONENT_ADDED_ID for other components
- [ ] Test emotions text formatting displays below bars
- [ ] Test bar fill calculation for negative values
- [ ] Test bar fill calculation for positive values
- [ ] Test color selection per axis

### Test Commands

```bash
# Run panel tests
npm run test:unit -- --testPathPattern="emotionalStatePanel"

# Run integration tests
npm run test:integration -- --testPathPattern="emotionalStatePanel"
```

## Example Render Output

Given mood data:
```javascript
{
  valence: -35,
  arousal: 55,
  agency_control: -15,
  threat: 70,
  engagement: 40,
  future_expectancy: -20,
  self_evaluation: 0
}
```

The panel renders 7 bars:
- Valence: 35% width bar extending left from center, red, shows "-35"
- Arousal: 55% width bar extending right from center, yellow, shows "+55"
- Agency/Control: 15% width bar extending left from center, gray, shows "-15"
- Threat: 70% width bar extending right from center, red, shows "+70"
- Engagement: 40% width bar extending right from center, cyan, shows "+40"
- Future Expectancy: 20% width bar extending left from center, red, shows "-20"
- Self-Evaluation: No bar fill (value is 0), shows "0"

## Dependencies

- MOOANDSEXAROSYS-001 (component definitions must exist)
- MOOANDSEXAROSYS-007 (workflow updates components, triggering panel refresh)

## Dependent Tickets

- None (this is a leaf ticket)
