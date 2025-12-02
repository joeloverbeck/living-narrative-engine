# INJREPANDUSEINT-008: InjuryStatusPanel Widget

## Description

Create left-pane widget displaying character's current physical condition.

## File List

| File | Action |
|------|--------|
| `src/domUI/injuryStatusPanel.js` | CREATE |
| `game.html` | MODIFY - add panel HTML between current-turn-actor-panel and perception-log-widget |
| `css/components/_injury-status-panel.css` | CREATE |
| `css/style.css` | MODIFY - import new CSS |
| `src/domUI/domUiFacade.js` | MODIFY - add injuryStatusPanel |
| `src/dependencyInjection/tokens/tokens-ui.js` | MODIFY - add token |
| `src/dependencyInjection/registrations/uiRegistrations.js` | MODIFY - add registration |
| `tests/unit/domUI/injuryStatusPanel.test.js` | CREATE |

## Out of Scope

- Damage event message rendering (INJREPANDUSEINT-009)
- LLM integration (INJREPANDUSEINT-011, INJREPANDUSEINT-012)
- Service implementations

## Acceptance Criteria

### Tests That Must Pass

- `tests/unit/domUI/injuryStatusPanel.test.js` - 80%+ branch coverage
- `npm run test:unit` passes
- `npx eslint src/domUI/injuryStatusPanel.js` passes

### Invariants

- Widget extends `BoundDomRendererBase`
- HTML structure:
  - `id="injury-status-widget"`
  - `role="region"`
  - `aria-labelledby="injury-status-heading"`
  - `aria-live="polite"` for updates
- Displays:
  - Overall health percentage with color-coded bar
  - List of injured body parts with severity indicators
  - Effect icons/badges (bleeding, burning, poisoned, fractured)
  - Dying countdown with urgent styling when applicable
- Subscribes to events from spec section 7.1:
  - `anatomy:damage_applied`
  - `anatomy:internal_damage_propagated`
  - `anatomy:entity_dying`
  - `anatomy:entity_died`
  - `anatomy:entity_stabilized`
  - `core:turn_started` (to refresh current actor's status)
- CSS uses severity classes from spec section 7.1:
  - `.severity-healthy` (green)
  - `.severity-scratched` (yellow)
  - `.severity-wounded` (orange)
  - `.severity-injured` (red-orange)
  - `.severity-critical` (red)
  - `.severity-destroyed` (dark red)
- WCAG AA color contrast compliance
- Token added to tokens-ui.js

## Dependencies

- INJREPANDUSEINT-003 (InjuryAggregationService)
- INJREPANDUSEINT-006 (InjuryNarrativeFormatterService)

## Reference

See `specs/injury-reporting-and-user-interface.md` section 7.1 for UI widget specification.
